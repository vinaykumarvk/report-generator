const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { notifyJobQueued } = require("./jobTrigger");

const envPath =
  process.env.DOTENV_CONFIG_PATH ||
  (fs.existsSync(path.join(process.cwd(), ".env.local"))
    ? path.join(process.cwd(), ".env.local")
    : path.join(process.cwd(), ".env"));
dotenv.config({ path: envPath });
if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn(`[DBQueue] Supabase URL missing after loading env from ${envPath}`);
} else {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    const hostname = new URL(url).hostname;
    console.log(`[DBQueue] Using Supabase host: ${hostname} (env: ${path.basename(envPath)})`);
  } catch (err) {
    console.log(`[DBQueue] Using Supabase URL (env: ${path.basename(envPath)})`);
  }
}

const LOCK_SECONDS = 5 * 60;

// Lazy-initialized Supabase client to avoid build-time errors
let _supabaseClient = null;

function getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _supabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return _supabaseClient;
}

function nowIso() {
  return new Date().toISOString();
}

function mapJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    priority: row.priority,
    payloadJson: row.payload_json,
    runId: row.run_id,
    sectionRunId: row.section_run_id,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    lockedBy: row.locked_by,
    lockedAt: row.locked_at,
    lockExpiresAt: row.lock_expires_at,
    scheduledAt: row.scheduled_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspaceId: row.workspace_id,
  };
}

async function enqueueJob(params) {
  const supabase = getSupabaseClient();
  const payload = {
    type: params.type,
    status: "QUEUED",
    priority: params.priority ?? 100,
    payload_json: params.payloadJson ?? null,
    run_id: params.runId ?? null,
    section_run_id: params.sectionRunId ?? null,
    attempt_count: 0,
    max_attempts: params.maxAttempts ?? 3,
    locked_by: null,
    locked_at: null,
    lock_expires_at: null,
    scheduled_at: nowIso(),
    last_error: null,
    workspace_id: params.workspaceId ?? null,
  };
  const { data, error } = await supabase
    .from("jobs")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message || "Failed to enqueue job");
  }
  const job = mapJob(data);
  await notifyJobQueued({
    id: job.id,
    type: job.type,
    runId: job.runId,
    sectionRunId: job.sectionRunId,
    workspaceId: job.workspaceId,
  });
  return job;
}

async function claimNextJob(workerId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("claim_next_job", {
    worker_id: workerId,
    lease_seconds: LOCK_SECONDS,
  });
  if (error) {
    throw new Error(error.message || "Failed to claim job");
  }
  const row = Array.isArray(data) ? data[0] : data;
  return mapJob(row);
}

async function claimJobById(jobId, workerId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("claim_job_by_id", {
    job_id: jobId,
    worker_id: workerId,
    lease_seconds: LOCK_SECONDS,
  });
  if (error) {
    throw new Error(error.message || "Failed to claim job by id");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapJob(row);
}

async function completeJob(job) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "COMPLETED",
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      updated_at: nowIso(),
    })
    .eq("id", job.id);
  if (error) {
    throw new Error(error.message || "Failed to complete job");
  }
}

async function failJob(job, errorMessage) {
  const supabase = getSupabaseClient();
  const now = new Date();
  if (job.attemptCount >= job.maxAttempts) {
    const { error } = await supabase
      .from("jobs")
      .update({
        status: "FAILED",
        last_error: errorMessage,
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        updated_at: nowIso(),
      })
      .eq("id", job.id);
    if (error) {
      throw new Error(error.message || "Failed to mark job failed");
    }
    return;
  }

  const backoffMs =
    job.attemptCount === 1
      ? 30000
      : job.attemptCount === 2
      ? 120000
      : 600000;
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "QUEUED",
      last_error: errorMessage,
      scheduled_at: new Date(now.getTime() + backoffMs).toISOString(),
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      updated_at: nowIso(),
    })
    .eq("id", job.id);
  if (error) {
    throw new Error(error.message || "Failed to requeue job");
  }
}

async function heartbeat(job) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      lock_expires_at: new Date(Date.now() + LOCK_SECONDS * 1000).toISOString(),
      updated_at: nowIso(),
    })
    .eq("id", job.id)
    .eq("locked_by", job.lockedBy);
  if (error) {
    throw new Error(error.message || "Failed to heartbeat job");
  }
}

module.exports = {
  enqueueJob,
  claimNextJob,
  claimJobById,
  completeJob,
  failJob,
  heartbeat,
};
