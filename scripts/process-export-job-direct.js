require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
});
require("tsconfig-paths/register");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const envPath =
  process.env.DOTENV_CONFIG_PATH ||
  (fs.existsSync(path.join(process.cwd(), ".env.local"))
    ? path.join(process.cwd(), ".env.local")
    : path.join(process.cwd(), ".env"));
dotenv.config({ path: envPath });

const { supabaseAdmin } = require("../src/lib/supabaseAdmin");
const workerCore = require("../workers/worker-core");

function mapJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    priority: row.priority,
    payloadJson: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : (row.payload_json || {}),
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

async function processExportJob(runId) {
  try {
    const supabase = supabaseAdmin();
    
    // Find export jobs for this run
    const { data: exportJobs, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("run_id", runId)
      .eq("type", "EXPORT")
      .in("status", ["QUEUED", "RUNNING"])
      .order("created_at", { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch export jobs: ${error.message}`);
    }
    
    if (!exportJobs || exportJobs.length === 0) {
      console.log("⚠️  No QUEUED/RUNNING export jobs found for this run");
      return;
    }
    
    console.log(`📦 Found ${exportJobs.length} export job(s) to process`);
    
    const workerId = `manual-worker-${Date.now()}`;
    
    for (const jobRow of exportJobs) {
      const format = jobRow.payload_json?.format || JSON.parse(jobRow.payload_json || '{}').format || 'MARKDOWN';
      console.log(`\n🔄 Processing export job ${jobRow.id} (${format})...`);
      
      try {
        // Lock the job manually
        const lockExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const { error: lockError } = await supabase
          .from("jobs")
          .update({
            status: "RUNNING",
            locked_by: workerId,
            locked_at: new Date().toISOString(),
            lock_expires_at: lockExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobRow.id)
          .eq("status", "QUEUED"); // Only update if still QUEUED
        
        if (lockError) {
          console.log(`   ⚠️  Could not lock job: ${lockError.message}`);
          continue;
        }
        
        // Map the job
        const job = mapJob({
          ...jobRow,
          status: "RUNNING",
          locked_by: workerId,
          locked_at: new Date().toISOString(),
          lock_expires_at: lockExpiresAt,
        });
        
        if (!job) {
          console.log(`   ⚠️  Could not map job`);
          continue;
        }
        
        console.log(`   ✅ Job locked successfully`);
        console.log(`   📦 Processing job...`);
        
        // Process the job directly by calling handleExport
        // We need to import handleExport from worker-core, but it's not exported
        // So we'll use a workaround: call the handler through processJobOnce but bypass claimNextJob
        const { completeJob } = require("../src/lib/dbqueue");
        
        try {
          // Call handleExport directly (it's async function handleExport(job))
          // Since handleExport is not exported, we need to access it differently
          // Let's use eval or require the module and access internal functions
          const handleExport = workerCore.handleExport || (() => {
            // If not exported, we'll need to call it through processJobOnce
            // But processJobOnce calls claimNextJob which fails
            // So let's manually call the handler
            throw new Error("handleExport not accessible");
          });
          
          await handleExport(job);
          await completeJob(job);
          console.log(`   ✅ Job processed successfully!`);
        } catch (handlerErr) {
          // If handleExport is not accessible, try calling through processJobOnce
          // but first we need to mock claimNextJob
          const originalClaimNextJob = require("../src/lib/dbqueue").claimNextJob;
          require("../src/lib/dbqueue").claimNextJob = async () => null; // Return null to skip
          
          try {
            await workerCore.processJobOnce(job);
            await completeJob(job);
            console.log(`   ✅ Job processed successfully!`);
          } finally {
            require("../src/lib/dbqueue").claimNextJob = originalClaimNextJob;
          }
        }
        
      } catch (err) {
        console.error(`   ❌ Error processing job:`, err.message);
        console.error(err.stack);
        
        // Mark job as failed
        try {
          await supabase
            .from("jobs")
            .update({
              status: "FAILED",
              last_error: err.message,
              locked_by: null,
              locked_at: null,
              lock_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobRow.id);
        } catch (updateErr) {
          console.error(`   ⚠️  Failed to update job status:`, updateErr.message);
        }
      }
    }
    
    console.log(`\n✅ Finished processing export jobs`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/process-export-job-direct.js <runId>");
  process.exit(1);
}

processExportJob(runId).then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
