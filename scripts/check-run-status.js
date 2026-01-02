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

async function checkRunStatus(runId) {
  console.log(`\n🔍 Checking status for run: ${runId}\n`);

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

  console.log("📊 Run Status:");
  console.log(`   Status: ${run.status}`);
  console.log(`   Created: ${run.created_at}`);
  console.log(`   Started: ${run.started_at || "Not started"}`);
  console.log(`   Completed: ${run.completed_at || "Not completed"}`);

  // Get section runs
  const { data: sections, error: sectionsError } = await supabase
    .from("section_runs")
    .select("id, title, status, attempt_count")
    .eq("report_run_id", runId)
    .order("created_at", { ascending: true });

  if (!sectionsError && sections) {
    console.log(`\n📝 Section Runs (${sections.length} total):`);
    sections.forEach((section) => {
      console.log(`   ${section.status.padEnd(12)} - ${section.title} (attempts: ${section.attempt_count})`);
    });

    const statusCounts = sections.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});
    console.log("\n📈 Status Summary:");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
  }

  // Get pending jobs
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, type, status, attempt_count, last_error")
    .eq("run_id", runId)
    .in("status", ["QUEUED", "RUNNING"])
    .order("created_at", { ascending: true });

  if (!jobsError && jobs && jobs.length > 0) {
    console.log(`\n⏳ Pending Jobs (${jobs.length}):`);
    jobs.forEach((job) => {
      console.log(`   ${job.status.padEnd(8)} - ${job.type} (attempts: ${job.attempt_count})`);
      if (job.last_error) {
        console.log(`            Error: ${job.last_error.substring(0, 100)}...`);
      }
    });
  } else {
    console.log("\n✅ No pending jobs");
  }

  // Get failed jobs
  const { data: failedJobs, error: failedError } = await supabase
    .from("jobs")
    .select("id, type, status, attempt_count, last_error")
    .eq("run_id", runId)
    .eq("status", "FAILED")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!failedError && failedJobs && failedJobs.length > 0) {
    console.log(`\n❌ Failed Jobs (showing last ${failedJobs.length}):`);
    failedJobs.forEach((job) => {
      console.log(`   ${job.type} (attempts: ${job.attempt_count})`);
      if (job.last_error) {
        console.log(`   Error: ${job.last_error.substring(0, 150)}...`);
      }
    });
  }

  console.log("\n");
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node check-run-status.js <run-id>");
  process.exit(1);
}

checkRunStatus(runId).then(() => process.exit(0));

