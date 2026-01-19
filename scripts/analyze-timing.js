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

async function analyzeTiming(runId) {
  const supabase = supabaseAdmin();
  
  // Get section runs with timestamps
  const { data: sectionRuns } = await supabase
    .from("section_runs")
    .select("id, title, status, created_at, updated_at")
    .eq("report_run_id", runId)
    .order("created_at", { ascending: true });
  
  // Get failed RUN_SECTION jobs
  const { data: failedJobs } = await supabase
    .from("jobs")
    .select("id, section_run_id, created_at, updated_at, last_error")
    .eq("run_id", runId)
    .eq("type", "RUN_SECTION")
    .eq("status", "FAILED")
    .order("created_at", { ascending: true });
  
  console.log("📊 Timeline Analysis:\n");
  
  console.log("Section Runs Completion:");
  sectionRuns?.forEach(sr => {
    console.log(`  ${sr.title || 'Untitled'}`);
    console.log(`    Created: ${sr.created_at}`);
    console.log(`    Updated: ${sr.updated_at}`);
    console.log(`    Status: ${sr.status}`);
    console.log('');
  });
  
  console.log("\nFailed RUN_SECTION Jobs:");
  failedJobs?.forEach(job => {
    const sectionRun = sectionRuns?.find(sr => sr.id === job.section_run_id);
    console.log(`  Job ${job.id}`);
    console.log(`    Section: ${sectionRun?.title || job.section_run_id}`);
    console.log(`    Created: ${job.created_at}`);
    console.log(`    Failed: ${job.updated_at}`);
    console.log(`    Error: ${job.last_error}`);
    console.log('');
  });
  
  // Check if sections were completed BEFORE jobs failed
  console.log("\n🔍 Analysis:\n");
  
  failedJobs?.forEach(job => {
    const sectionRun = sectionRuns?.find(sr => sr.id === job.section_run_id);
    if (sectionRun && sectionRun.status === "COMPLETED") {
      const sectionCompleted = new Date(sectionRun.updated_at);
      const jobFailed = new Date(job.updated_at);
      
      if (sectionCompleted < jobFailed) {
        console.log(`  ✅ Section "${sectionRun.title}" was COMPLETED at ${sectionCompleted.toISOString()}`);
        console.log(`     But job failed later at ${jobFailed.toISOString()}`);
        console.log(`     This suggests the section completed successfully, but a retry attempt failed.`);
      } else {
        console.log(`  ⚠️  Section "${sectionRun.title}" was updated AFTER job failed`);
        console.log(`     Job failed: ${jobFailed.toISOString()}`);
        console.log(`     Section updated: ${sectionCompleted.toISOString()}`);
      }
      console.log('');
    }
  });
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/analyze-timing.js <runId>");
  process.exit(1);
}

analyzeTiming(runId).then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
