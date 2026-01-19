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

const { claimJobById } = require("../src/lib/dbqueue");
const { processJobOnce } = require("../workers/worker-core");

async function processExportJob(runId) {
  try {
    const { supabaseAdmin } = require("../src/lib/supabaseAdmin");
    const supabase = supabaseAdmin();
    
    // Find export jobs for this run
    const { data: exportJobs, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("run_id", runId)
      .eq("type", "EXPORT")
      .eq("status", "QUEUED")
      .order("created_at", { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch export jobs: ${error.message}`);
    }
    
    if (!exportJobs || exportJobs.length === 0) {
      console.log("⚠️  No QUEUED export jobs found for this run");
      return;
    }
    
    console.log(`📦 Found ${exportJobs.length} QUEUED export job(s)`);
    
    const workerId = `manual-worker-${Date.now()}`;
    
    for (const jobRow of exportJobs) {
      console.log(`\n🔄 Processing export job ${jobRow.id} (${jobRow.payload_json?.format || 'unknown format'})...`);
      
      try {
        // Claim the job
        const job = await claimJobById(jobRow.id, workerId);
        if (!job) {
          console.log(`   ⚠️  Could not claim job (might be locked by another worker)`);
          continue;
        }
        
        console.log(`   ✅ Job claimed successfully`);
        console.log(`   📦 Processing job...`);
        
        // Process the job
        await processJobOnce(job);
        
        console.log(`   ✅ Job processed successfully!`);
        
      } catch (err) {
        console.error(`   ❌ Error processing job:`, err.message);
        console.error(err.stack);
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
  console.error("Usage: node scripts/process-export-job.js <runId>");
  process.exit(1);
}

processExportJob(runId).then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
