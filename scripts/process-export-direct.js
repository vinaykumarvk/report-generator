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

// Manual export processor (uses workerStore + exporter/pdfExport)
async function processExportJobDirect(runId) {
  const { supabaseAdmin } = require("../src/lib/supabaseAdmin");
  const supabase = supabaseAdmin();
  
  // Find export jobs
  const { data: exportJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("run_id", runId)
    .eq("type", "EXPORT")
    .in("status", ["QUEUED", "RUNNING"])
    .order("created_at", { ascending: true });
  
  if (!exportJobs || exportJobs.length === 0) {
    console.log("⚠️  No export jobs found");
    return;
  }
  
  console.log(`📦 Found ${exportJobs.length} export job(s)`);
  
  // Import the handler functions we need
  const workerStore = require("../src/lib/workerStore");
  const { getRunById, listSectionRunsWithArtifacts, addRunEvent, createExportRecord, updateExportRecord } = workerStore;
  const { writeMarkdownExport } = require("../src/lib/exporter");
  const { writePdfExport } = require("../src/lib/pdfExport");
  const { uploadExportFile } = require("../src/lib/exportStorage");
  const { completeJob } = require("../src/lib/dbqueue");
  const crypto = require("crypto");
  
  for (const jobRow of exportJobs) {
    const format = (typeof jobRow.payload_json === 'string' 
      ? JSON.parse(jobRow.payload_json) 
      : jobRow.payload_json)?.format || "MARKDOWN";
    
    console.log(`\n🔄 Processing ${format} export...`);
    
    try {
      // Lock job
      const workerId = `manual-${Date.now()}`;
      await supabase
        .from("jobs")
        .update({
          status: "RUNNING",
          locked_by: workerId,
          locked_at: new Date().toISOString(),
          lock_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq("id", jobRow.id)
        .eq("status", "QUEUED");
      
      const job = {
        id: jobRow.id,
        type: jobRow.type,
        runId: jobRow.run_id,
        payloadJson: typeof jobRow.payload_json === 'string' ? JSON.parse(jobRow.payload_json) : jobRow.payload_json,
        workspaceId: jobRow.workspace_id,
      };
      
      const run = await getRunById(job.runId);
      if (!run) throw new Error("Run not found");
      
      const exportId = job.payloadJson?.exportId || crypto.randomUUID();
      
      // Check if export already exists
      const { data: existingExport } = await supabase
        .from("exports")
        .select("id,status")
        .eq("id", exportId)
        .single();
      
      if (existingExport?.status === "READY") {
        console.log(`   ✅ Export already complete`);
        await completeJob(job);
        continue;
      }
      
      // Create/update export record
      if (job.payloadJson?.exportId) {
        await updateExportRecord(exportId, { status: "RUNNING", errorMessage: null });
      } else {
        await createExportRecord(run.id, run.workspaceId, {
          id: exportId,
          format,
          status: "RUNNING",
        });
      }
      
      // Get sources
      const sectionRuns = await listSectionRunsWithArtifacts(run.id);
      const sources = [];
      sectionRuns.forEach((sectionRun) => {
        const evidence = (sectionRun.artifacts || []).find(a => a.type === "EVIDENCE");
        if (!evidence) return;
        (evidence.content || []).forEach((item) => {
          if (item.kind === "web" && item.metadata?.url) {
            sources.push(item.metadata.url);
          }
        });
      });
      const uniqueSources = Array.from(new Set(sources));
      
      // Get final report content
      const finalReportContent = 
        (run.finalReport && typeof run.finalReport === 'object' && run.finalReport.content) ||
        (typeof run.finalReport === 'string' ? run.finalReport : '') ||
        '';
      
      if (!finalReportContent) {
        throw new Error("No final report content available");
      }
      
      console.log(`   📄 Final report: ${finalReportContent.length} chars`);
      
      // Generate export
      let exportRecord;
      if (format === "MARKDOWN") {
        exportRecord = writeMarkdownExport(
          {
            id: run.id,
            templateSnapshot: run.templateSnapshot,
            finalReport: finalReportContent,
            inputJson: run.inputJson,
          },
          { sourcesAppendix: uniqueSources, exportId }
        );
      } else if (format === "PDF") {
        exportRecord = await writePdfExport(
          {
            id: run.id,
            templateSnapshot: run.templateSnapshot,
            finalReport: finalReportContent,
            inputJson: run.inputJson,
          },
          { sourcesAppendix: uniqueSources, exportId }
        );
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }
      
      await updateExportRecord(exportId, { filePath: exportRecord.filePath });
      
      // Upload to storage
      try {
        const storageResult = await uploadExportFile({
          runId: run.id,
          exportId,
          format,
          filePath: exportRecord.filePath,
        });
        await updateExportRecord(exportId, {
          status: "READY",
          filePath: exportRecord.filePath,
          storageUrl: storageResult.storageUrl,
          fileSize: storageResult.fileSize,
          checksum: storageResult.checksum,
        });
        console.log(`   ✅ Export ready: ${storageResult.storageUrl || exportRecord.filePath}`);
      } catch (uploadErr) {
        console.warn(`   ⚠️  Storage upload failed: ${uploadErr.message}`);
        await updateExportRecord(exportId, {
          status: "READY",
          filePath: exportRecord.filePath,
        });
      }
      
      await addRunEvent(run.id, run.workspaceId, "EXPORT_READY", {
        exportId,
        format,
      });
      
      await completeJob(job);
      console.log(`   ✅ Export completed successfully!`);
      
    } catch (err) {
      console.error(`   ❌ Error:`, err.message);
      const { failJob } = require("../src/lib/dbqueue");
      await failJob({
        id: jobRow.id,
        attemptCount: jobRow.attempt_count,
        maxAttempts: jobRow.max_attempts,
      }, err.message);
    }
  }
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/process-export-direct.js <runId>");
  process.exit(1);
}

processExportJobDirect(runId).then(() => {
  console.log("\n✅ All exports processed!");
  process.exit(0);
}).catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
