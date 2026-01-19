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

async function resetExportJobs(runId) {
  const supabase = supabaseAdmin();
  
  // Reset FAILED export jobs to QUEUED
  const { data: jobs, error } = await supabase
    .from("jobs")
    .update({
      status: "QUEUED",
      attempt_count: 0,
      last_error: null,
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("run_id", runId)
    .eq("type", "EXPORT")
    .eq("status", "FAILED")
    .select();
  
  if (error) {
    console.error("❌ Error resetting jobs:", error.message);
    return;
  }
  
  console.log(`✅ Reset ${jobs?.length || 0} export job(s) to QUEUED`);
  if (jobs && jobs.length > 0) {
    jobs.forEach(job => {
      const format = (typeof job.payload_json === 'string' 
        ? JSON.parse(job.payload_json) 
        : job.payload_json)?.format || 'unknown';
      console.log(`   - ${job.id}: ${format}`);
    });
  }
  
  console.log(`\n💡 Workers should pick up these jobs automatically.`);
  console.log(`   Check status in a few seconds.`);
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/reset-export-jobs.js <runId>");
  process.exit(1);
}

resetExportJobs(runId).then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
