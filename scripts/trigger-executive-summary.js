#!/usr/bin/env node
/**
 * Script to manually trigger executive summary generation for a run
 * Usage: node scripts/trigger-executive-summary.js <runId>
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerExecutiveSummary(runId) {
  console.log(`🔍 Checking run: ${runId}\n`);

  // Get run details
  const { data: run, error: runError } = await supabase
    .from("report_runs")
    .select("id, status, workspace_id")
    .eq("id", runId)
    .single();

  if (runError || !run) {
    console.error("❌ Run not found:", runError?.message || "Unknown error");
    process.exit(1);
  }

  console.log("✅ Run found");
  console.log(`   Status: ${run.status}`);
  console.log(`   Workspace ID: ${run.workspace_id || "N/A"}\n`);

  // Get section runs
  const { data: sections, error: sectionsError } = await supabase
    .from("section_runs")
    .select("id, title, status")
    .eq("report_run_id", runId)
    .order("created_at", { ascending: true });

  if (sectionsError) {
    console.error("❌ Error fetching sections:", sectionsError.message);
    process.exit(1);
  }

  const execSummary = sections?.find((s) =>
    s.title?.toLowerCase().includes("executive summary")
  );
  const nonExecSections = sections?.filter(
    (s) => !s.title?.toLowerCase().includes("executive summary")
  );

  console.log("📊 Section Status:");
  console.log(`   Total sections: ${sections?.length || 0}`);
  console.log(`   Executive Summary: ${execSummary ? execSummary.status : "NOT FOUND"}`);
  console.log(
    `   Non-executive sections completed: ${nonExecSections?.filter((s) => s.status === "COMPLETED").length || 0} / ${nonExecSections?.length || 0}`
  );

  if (!execSummary) {
    console.error("\n❌ Executive Summary section not found in this run");
    process.exit(1);
  }

  if (execSummary.status === "COMPLETED") {
    console.log("\n✅ Executive Summary is already COMPLETED");
    console.log("   No action needed.");
    process.exit(0);
  }

  const allNonExecDone = nonExecSections?.every((s) => s.status === "COMPLETED");

  if (!allNonExecDone) {
    console.error(
      "\n❌ Not all non-executive summary sections are COMPLETED"
    );
    console.log("   Incomplete sections:");
    nonExecSections
      ?.filter((s) => s.status !== "COMPLETED")
      .forEach((s) => {
        console.log(`     - ${s.title}: ${s.status}`);
      });
    process.exit(1);
  }

  // Check if GENERATE_EXEC_SUMMARY job already exists
  const { data: existingJobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("run_id", runId)
    .eq("type", "GENERATE_EXEC_SUMMARY")
    .in("status", ["QUEUED", "RUNNING", "COMPLETED"]);

  if (jobsError) {
    console.error("❌ Error checking existing jobs:", jobsError.message);
    process.exit(1);
  }

  if (existingJobs && existingJobs.length > 0) {
    console.log("\n⚠️  GENERATE_EXEC_SUMMARY job already exists:");
    existingJobs.forEach((j) => {
      console.log(`   Job ID: ${j.id}, Status: ${j.status}`);
    });
    console.log("\n   If the job is stuck, you may need to reset it first.");
    process.exit(0);
  }

  // Enqueue the job
  console.log("\n🚀 Enqueuing GENERATE_EXEC_SUMMARY job...");

  const { data: job, error: enqueueError } = await supabase
    .from("jobs")
    .insert({
      workspace_id: run.workspace_id,
      type: "GENERATE_EXEC_SUMMARY",
      status: "QUEUED",
      priority: 100,
      payload_json: {},
      run_id: runId,
    })
    .select("id, type, status")
    .single();

  if (enqueueError || !job) {
    console.error("❌ Failed to enqueue job:", enqueueError?.message || "Unknown error");
    process.exit(1);
  }

  console.log("✅ Job enqueued successfully!");
  console.log(`   Job ID: ${job.id}`);
  console.log(`   Type: ${job.type}`);
  console.log(`   Status: ${job.status}`);
  console.log("\n💡 The worker will process this job automatically.");
  console.log("   Check the run status in a few moments.");
}

const runId = process.argv[2];
if (!runId) {
  console.error("❌ Usage: node scripts/trigger-executive-summary.js <runId>");
  process.exit(1);
}

triggerExecutiveSummary(runId).catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
