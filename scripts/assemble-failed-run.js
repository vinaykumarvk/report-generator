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

const { getRunById, updateRun, listSectionRunsWithArtifacts } = require("../src/lib/workerStore");
const { enqueueJob } = require("../src/lib/dbqueue");

async function assembleFailedRun(runId) {
  try {
    console.log(`🔍 Checking run ${runId}...`);
    
    const run = await getRunById(runId);
    if (!run) {
      throw new Error("Run not found");
    }
    
    console.log(`📊 Run status: ${run.status}`);
    console.log(`📄 Has final report: ${!!run.finalReport}`);
    
    if (run.status === "COMPLETED" && run.finalReport) {
      console.log("✅ Run is already completed with final report!");
      return;
    }
    
    // Check sections
    const sectionRuns = await listSectionRunsWithArtifacts(runId);
    console.log(`📋 Found ${sectionRuns.length} sections`);
    
    const completedSections = sectionRuns.filter(sr => sr.status === "COMPLETED");
    console.log(`✅ ${completedSections.length} sections are COMPLETED`);
    
    const execSummarySection = sectionRuns.find(sr => 
      sr.title && sr.title.toLowerCase().includes("executive summary")
    );
    
    if (execSummarySection) {
      console.log(`📊 Executive Summary section: ${execSummarySection.status}`);
    }
    
    // Check if all non-exec sections are done
    const nonExecSections = sectionRuns.filter(sr => 
      !sr.title || !sr.title.toLowerCase().includes("executive summary")
    );
    const allNonExecDone = nonExecSections.every(sr => sr.status === "COMPLETED");
    
    if (!allNonExecDone) {
      console.log("⚠️  Not all non-executive sections are completed:");
      nonExecSections.forEach(sr => {
        if (sr.status !== "COMPLETED") {
          console.log(`  - ${sr.title}: ${sr.status}`);
        }
      });
      return;
    }
    
    // Check if executive summary is done
    if (execSummarySection && execSummarySection.status !== "COMPLETED") {
      console.log("⚠️  Executive summary is not completed. Triggering executive summary generation...");
      
      // Check if GENERATE_EXEC_SUMMARY job already exists
      const { supabaseAdmin } = require("../src/lib/supabaseAdmin");
      const supabase = supabaseAdmin();
      const { data: existingJobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("run_id", runId)
        .in("type", ["GENERATE_EXEC_SUMMARY", "ASSEMBLE"])
        .in("status", ["QUEUED", "RUNNING", "COMPLETED"])
        .limit(1);
      
      if (!existingJobs || existingJobs.length === 0) {
        await enqueueJob({
          type: "GENERATE_EXEC_SUMMARY",
          payloadJson: {},
          runId: runId,
          workspaceId: run.workspaceId ?? null,
        });
        console.log("✅ Enqueued GENERATE_EXEC_SUMMARY job");
        console.log("⏳ Please wait for executive summary to complete, then run this script again to assemble.");
        return;
      } else {
        console.log("⏳ Executive summary job already exists, waiting...");
        return;
      }
    }
    
    // All sections are done, trigger ASSEMBLE
    console.log("🔨 All sections complete, triggering ASSEMBLE job...");
    
    // Check if ASSEMBLE job already exists
    const { supabaseAdmin } = require("../src/lib/supabaseAdmin");
    const supabase = supabaseAdmin();
    const { data: existingAssembleJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("run_id", runId)
      .eq("type", "ASSEMBLE")
      .in("status", ["QUEUED", "RUNNING", "COMPLETED"])
      .limit(1);
    
    if (existingAssembleJobs && existingAssembleJobs.length > 0) {
      console.log("⏳ ASSEMBLE job already exists");
      return;
    }
    
    await enqueueJob({
      type: "ASSEMBLE",
      payloadJson: {},
      runId: runId,
      workspaceId: run.workspaceId ?? null,
    });
    
    console.log("✅ Enqueued ASSEMBLE job");
    console.log("⏳ The worker will process it shortly. Check the run details page to see the final report.");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/assemble-failed-run.js <runId>");
  process.exit(1);
}

assembleFailedRun(runId).then(() => {
  console.log("✅ Done");
  process.exit(0);
}).catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
