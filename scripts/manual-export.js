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

const { getRunById } = require("../src/lib/workerStore");
const { enqueueJob } = require("../src/lib/dbqueue");

async function manualExport(runId, format = "MARKDOWN") {
  try {
    console.log(`🔍 Checking run ${runId}...`);
    
    const run = await getRunById(runId);
    if (!run) {
      throw new Error("Run not found");
    }
    
    console.log(`📊 Run Status: ${run.status}`);
    console.log(`📄 Has finalReport: ${!!run.finalReport}`);
    
    if (run.status !== "COMPLETED") {
      throw new Error(`Run is not COMPLETED (status: ${run.status})`);
    }
    
    if (!run.finalReport) {
      throw new Error("Run has no finalReport");
    }
    
    // Check final report content
    const finalReportContent = 
      (run.finalReport && typeof run.finalReport === 'object' && run.finalReport.content) ||
      (typeof run.finalReport === 'string' ? run.finalReport : '');
    
    if (!finalReportContent) {
      throw new Error("Final report has no content");
    }
    
    console.log(`✅ Final report content length: ${finalReportContent.length} chars`);
    console.log(`📦 Enqueuing ${format} export job...`);
    
    await enqueueJob({
      type: "EXPORT",
      payloadJson: {
        format: format.toUpperCase(),
      },
      runId: runId,
      workspaceId: run.workspaceId ?? null,
      priority: 10, // Higher priority
    });
    
    console.log(`✅ Export job enqueued successfully!`);
    console.log(`\n💡 Note: Make sure a worker is running to process the export job.`);
    console.log(`   Run: npm run worker (or SERVICE_MODE=worker npm start)`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

const runId = process.argv[2];
const format = process.argv[3] || "MARKDOWN";

if (!runId) {
  console.error("Usage: node scripts/manual-export.js <runId> [format]");
  console.error("  format: MARKDOWN or PDF (default: MARKDOWN)");
  process.exit(1);
}

manualExport(runId, format).then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
