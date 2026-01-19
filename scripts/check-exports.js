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

async function checkExports(runId) {
  const supabase = supabaseAdmin();
  
  // Get run
  const { data: run, error: runError } = await supabase
    .from("report_runs")
    .select("*")
    .eq("id", runId)
    .single();
  
  if (runError || !run) {
    console.error("❌ Run not found:", runError?.message);
    return;
  }
  
  console.log(`📊 Run Status: ${run.status}`);
  console.log(`📄 Has final_report_json: ${!!run.final_report_json}`);
  if (run.final_report_json) {
    const fr = run.final_report_json;
    console.log(`   Content length: ${fr.content ? fr.content.length : 0} chars`);
  }
  console.log('');
  
  // Get export jobs
  const { data: exportJobs, error: jobsError } = await supabase
    .from("jobs")
    .select("*")
    .eq("run_id", runId)
    .eq("type", "EXPORT")
    .order("created_at", { ascending: false });
  
  if (jobsError) {
    console.error("❌ Error fetching export jobs:", jobsError.message);
    return;
  }
  
  console.log(`📦 Export Jobs: ${exportJobs?.length || 0}`);
  if (exportJobs && exportJobs.length > 0) {
    exportJobs.forEach((job, idx) => {
      console.log(`\n${idx + 1}. Job ${job.id}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Created: ${job.created_at}`);
      console.log(`   Updated: ${job.updated_at}`);
      console.log(`   Attempts: ${job.attempt_count}/${job.max_attempts}`);
      if (job.last_error) {
        console.log(`   ❌ Error: ${job.last_error}`);
      }
      if (job.payload_json) {
        const payload = typeof job.payload_json === 'string' 
          ? JSON.parse(job.payload_json) 
          : job.payload_json;
        console.log(`   Format: ${payload.format || 'N/A'}`);
      }
    });
  } else {
    console.log("   ⚠️  No export jobs found");
  }
  
  // Get export records
  const { data: exports, error: exportsError } = await supabase
    .from("exports")
    .select("*")
    .eq("report_run_id", runId)
    .order("created_at", { ascending: false });
  
  if (exportsError) {
    console.error("❌ Error fetching exports:", exportsError.message);
    return;
  }
  
  console.log(`\n📥 Export Records: ${exports?.length || 0}`);
  if (exports && exports.length > 0) {
    exports.forEach((exp, idx) => {
      console.log(`\n${idx + 1}. Export ${exp.id}`);
      console.log(`   Format: ${exp.format}`);
      console.log(`   Status: ${exp.status}`);
      console.log(`   Created: ${exp.created_at}`);
      console.log(`   Storage path: ${exp.storage_path || 'N/A'}`);
    });
  } else {
    console.log("   ⚠️  No export records found");
  }
  
  // Check if export API would work
  console.log("\n🔍 Export API Requirements Check:");
  console.log(`   ✅ Run status COMPLETED: ${run.status === "COMPLETED"}`);
  console.log(`   ✅ Has final_report_json: ${!!run.final_report_json}`);
  if (run.final_report_json) {
    const fr = run.final_report_json;
    console.log(`   ✅ Final report has content: ${!!(fr.content && fr.content.length > 0)}`);
  }
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/check-exports.js <runId>");
  process.exit(1);
}

checkExports(runId).then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
