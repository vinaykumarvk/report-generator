#!/usr/bin/env node
/**
 * Script to regenerate and save executive summary for a run
 * Usage: node scripts/save-executive-summary.js <runId>
 */

require("dotenv").config({ path: ".env.local" });
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
});
require("tsconfig-paths/register");

const { createClient } = require("@supabase/supabase-js");
const { getRunById, listSectionRunsWithArtifacts } = require("../src/lib/workerStore");
const { generateHierarchicalExecutiveSummary } = require("../src/lib/executiveSummaryGenerator");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function saveExecutiveSummary(runId) {
  console.log(`🔍 Processing run: ${runId}\n`);

  const run = await getRunById(runId);
  if (!run) {
    console.error("❌ Run not found");
    process.exit(1);
  }

  const sectionRuns = await listSectionRunsWithArtifacts(run.id);

  // Filter out executive summary section and get content
  const sectionsForSummary = sectionRuns
    .filter((sr) => {
      const isExecSummary = sr.title && sr.title.toLowerCase().includes("executive summary");
      return !isExecSummary && sr.status === "COMPLETED";
    })
    .map((sr) => {
      const finalArtifact = (sr.artifacts || []).find((a) => a.type === "FINAL");
      return {
        id: sr.id,
        title: sr.title || "Untitled",
        content:
          typeof finalArtifact?.content === "string"
            ? finalArtifact.content
            : finalArtifact?.content_markdown || "",
      };
    });

  console.log(`📊 Found ${sectionsForSummary.length} completed sections for summary\n`);

  if (sectionsForSummary.length === 0) {
    console.error("❌ No completed sections found");
    process.exit(1);
  }

  console.log("📝 Generating executive summary...");
  const executiveSummaryContent = await generateHierarchicalExecutiveSummary(sectionsForSummary);
  console.log(`✅ Generated executive summary (${executiveSummaryContent.length} characters)\n`);

  // Find the executive summary section run
  const execSummarySectionRun = sectionRuns.find(
    (sr) => sr.title && sr.title.toLowerCase().includes("executive summary")
  );

  if (!execSummarySectionRun) {
    console.error("❌ Executive summary section not found");
    process.exit(1);
  }

  console.log(`💾 Saving to section: ${execSummarySectionRun.id}`);

  // Delete existing artifacts
  const { error: deleteError } = await supabase
    .from("section_artifacts")
    .delete()
    .eq("section_run_id", execSummarySectionRun.id);

  if (deleteError) {
    console.error("❌ Error deleting artifacts:", deleteError);
    process.exit(1);
  }

  // Insert new FINAL artifact
  const { error: insertError } = await supabase.from("section_artifacts").insert({
    section_run_id: execSummarySectionRun.id,
    type: "FINAL",
    content_markdown: executiveSummaryContent,
    content_json: null,
  });

  if (insertError) {
    console.error("❌ Error inserting artifact:", insertError);
    process.exit(1);
  }

  console.log("✅ Executive summary saved successfully\n");

  // Update section status
  const { error: statusError } = await supabase
    .from("section_runs")
    .update({ status: "COMPLETED" })
    .eq("id", execSummarySectionRun.id);

  if (statusError) {
    console.error("⚠️  Error updating status:", statusError);
  } else {
    console.log("✅ Section status updated to COMPLETED\n");
  }

  // Mark job as completed if it exists
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("run_id", runId)
    .eq("type", "GENERATE_EXEC_SUMMARY")
    .in("status", ["QUEUED", "RUNNING"]);

  if (jobs && jobs.length > 0) {
    for (const job of jobs) {
      const { error: jobError } = await supabase
        .from("jobs")
        .update({ status: "COMPLETED" })
        .eq("id", job.id);

      if (jobError) {
        console.error(`⚠️  Error updating job ${job.id}:`, jobError);
      } else {
        console.log(`✅ Job ${job.id} marked as COMPLETED\n`);
      }
    }
  }

  console.log("🎉 Executive summary generation complete!");
}

const runId = process.argv[2];
if (!runId) {
  console.error("❌ Usage: node scripts/save-executive-summary.js <runId>");
  process.exit(1);
}

saveExecutiveSummary(runId).catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
