#!/usr/bin/env node
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStuckRun(runId) {
  console.log(`\n🔧 Fixing stuck run: ${runId}\n`);

  // Get run details
  const { data: run, error: runError } = await supabase
    .from("report_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runError || !run) {
    console.error("❌ Run not found:", runError?.message);
    return;
  }

  if (run.status !== "RUNNING") {
    console.log(`ℹ️  Run is not stuck (status: ${run.status})`);
    return;
  }

  // Get section runs
  const { data: sections } = await supabase
    .from("section_runs")
    .select("id, title, status")
    .eq("report_run_id", runId);

  // Check for failed jobs
  const { data: failedJobs } = await supabase
    .from("jobs")
    .select("section_run_id, type")
    .eq("run_id", runId)
    .eq("status", "FAILED");

  const failedSectionIds = new Set(
    failedJobs?.filter((j) => j.section_run_id).map((j) => j.section_run_id) || []
  );

  // Update sections that have failed jobs but are still QUEUED
  const sectionsToFix = sections?.filter(
    (s) => s.status === "QUEUED" && failedSectionIds.has(s.id)
  ) || [];

  if (sectionsToFix.length > 0) {
    console.log(`📝 Marking ${sectionsToFix.length} failed sections:`);
    for (const section of sectionsToFix) {
      console.log(`   - ${section.title}`);
      await supabase
        .from("section_runs")
        .update({ status: "FAILED" })
        .eq("id", section.id);
    }
  }

  // Check if there are any pending jobs
  const { data: pendingJobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("run_id", runId)
    .in("status", ["QUEUED", "RUNNING"]);

  if (pendingJobs && pendingJobs.length > 0) {
    console.log(`⏳ Run still has ${pendingJobs.length} pending jobs, not marking as failed`);
    return;
  }

  // Check if all sections are done (either COMPLETED or FAILED)
  const { data: allSections } = await supabase
    .from("section_runs")
    .select("status")
    .eq("report_run_id", runId);

  const allDone = allSections?.every((s) => 
    s.status === "COMPLETED" || s.status === "FAILED"
  );

  if (!allDone) {
    console.log("⏳ Some sections are still pending, not marking run as failed");
    return;
  }

  const hasFailures = allSections?.some((s) => s.status === "FAILED");

  if (hasFailures) {
    console.log("\n❌ Marking run as FAILED (some sections failed)");
    await supabase
      .from("report_runs")
      .update({ 
        status: "FAILED",
        completed_at: new Date().toISOString()
      })
      .eq("id", runId);
  } else {
    console.log("\n✅ All sections completed, marking run as COMPLETED");
    await supabase
      .from("report_runs")
      .update({ 
        status: "COMPLETED",
        completed_at: new Date().toISOString()
      })
      .eq("id", runId);
  }

  console.log("✅ Run fixed!\n");
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node fix-stuck-run.js <run-id>");
  process.exit(1);
}

fixStuckRun(runId).then(() => process.exit(0));

