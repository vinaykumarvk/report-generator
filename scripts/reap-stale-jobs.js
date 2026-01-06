const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

async function reapStaleJobs() {
  const now = new Date().toISOString();

  const { data: staleJobs, error: listError } = await supabase
    .from("jobs")
    .select("id,type,run_id,status,locked_by,lock_expires_at,attempt_count,max_attempts")
    .eq("status", "RUNNING")
    .lt("lock_expires_at", now);

  if (listError) {
    throw listError;
  }

  console.log(`Found ${staleJobs?.length || 0} stale jobs.`);
  if (!staleJobs || staleJobs.length === 0) return;

  if (dryRun) {
    console.log("Dry run enabled. Stale jobs:");
    staleJobs.forEach((job) => {
      console.log(
        `- ${job.id} ${job.type} run=${job.run_id} locked_by=${job.locked_by} lock_expires_at=${job.lock_expires_at}`
      );
    });
    return;
  }

  const staleIds = staleJobs.map((job) => job.id);
  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      status: "QUEUED",
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      last_error: "Reaped stale lock",
      scheduled_at: now,
      updated_at: now,
    })
    .in("id", staleIds);

  if (updateError) {
    throw updateError;
  }

  console.log(`Requeued ${staleIds.length} stale jobs.`);
}

reapStaleJobs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to reap stale jobs:", err.message || err);
    process.exit(1);
  });
