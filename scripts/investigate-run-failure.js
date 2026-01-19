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

const { getRunById, listSectionRuns } = require("../src/lib/workerStore");
const { supabaseAdmin } = require("../src/lib/supabaseAdmin");

async function investigateRun(runId) {
  try {
    console.log(`🔍 Investigating run ${runId}...\n`);
    
    const supabase = supabaseAdmin();
    
    // Get run details
    const run = await getRunById(runId);
    console.log(`📊 Run Status: ${run.status}`);
    console.log(`📅 Created: ${run.createdAt || 'N/A'}`);
    console.log(`📅 Completed: ${run.completedAt || 'N/A'}\n`);
    
    // Get all jobs for this run
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });
    
    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }
    
    console.log(`📋 Jobs for this run (${jobs?.length || 0} total):\n`);
    
    if (!jobs || jobs.length === 0) {
      console.log("  ⚠️  No jobs found!");
      return;
    }
    
    const jobTypes = {};
    jobs.forEach(job => {
      const type = job.type;
      if (!jobTypes[type]) {
        jobTypes[type] = { total: 0, byStatus: {} };
      }
      jobTypes[type].total++;
      const status = job.status || 'UNKNOWN';
      jobTypes[type].byStatus[status] = (jobTypes[type].byStatus[status] || 0) + 1;
    });
    
    jobs.forEach((job, idx) => {
      console.log(`${idx + 1}. ${job.type} (${job.status})`);
      console.log(`   ID: ${job.id}`);
      console.log(`   Created: ${job.created_at}`);
      console.log(`   Updated: ${job.updated_at}`);
      console.log(`   Attempts: ${job.attempt_count}/${job.max_attempts}`);
      if (job.last_error) {
        console.log(`   ❌ Error: ${job.last_error}`);
      }
      if (job.locked_by) {
        console.log(`   🔒 Locked by: ${job.locked_by}`);
      }
      console.log('');
    });
    
    console.log(`\n📊 Job Summary:`);
    Object.entries(jobTypes).forEach(([type, stats]) => {
      console.log(`  ${type}: ${stats.total} total`);
      Object.entries(stats.byStatus).forEach(([status, count]) => {
        console.log(`    - ${status}: ${count}`);
      });
    });
    
    // Check for ASSEMBLE job specifically
    const assembleJobs = jobs.filter(j => j.type === "ASSEMBLE");
    console.log(`\n🔨 ASSEMBLE Jobs: ${assembleJobs.length}`);
    if (assembleJobs.length === 0) {
      console.log("  ❌ No ASSEMBLE job was ever created!");
    } else {
      assembleJobs.forEach(job => {
        console.log(`  - ${job.id}: ${job.status}`);
        if (job.last_error) {
          console.log(`    Error: ${job.last_error}`);
        }
      });
    }
    
    // Check for GENERATE_EXEC_SUMMARY job
    const execSummaryJobs = jobs.filter(j => j.type === "GENERATE_EXEC_SUMMARY");
    console.log(`\n📊 GENERATE_EXEC_SUMMARY Jobs: ${execSummaryJobs.length}`);
    execSummaryJobs.forEach(job => {
      console.log(`  - ${job.id}: ${job.status}`);
      if (job.last_error) {
        console.log(`    Error: ${job.last_error}`);
      }
    });
    
    // Check section runs
    const sectionRuns = await listSectionRuns(runId);
    console.log(`\n📄 Section Runs: ${sectionRuns.length}`);
    const execSummarySection = sectionRuns.find(sr => 
      sr.title && sr.title.toLowerCase().includes("executive summary")
    );
    
    const nonExecSections = sectionRuns.filter(sr => 
      !sr.title || !sr.title.toLowerCase().includes("executive summary")
    );
    
    console.log(`  - Non-executive sections: ${nonExecSections.length}`);
    console.log(`  - Completed: ${nonExecSections.filter(s => s.status === "COMPLETED").length}`);
    console.log(`  - Executive Summary: ${execSummarySection ? execSummarySection.status : 'NOT FOUND'}`);
    
    // Check run events
    const { data: events } = await supabase
      .from("run_events")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });
    
    console.log(`\n📝 Run Events (${events?.length || 0}):`);
    if (events && events.length > 0) {
      events.forEach(event => {
        console.log(`  - ${event.type} at ${event.created_at}`);
        if (event.payload_json) {
          const payload = typeof event.payload_json === 'string' 
            ? JSON.parse(event.payload_json) 
            : event.payload_json;
          if (payload.error || payload.jobId) {
            console.log(`    ${JSON.stringify(payload)}`);
          }
        }
      });
    }
    
    // Analyze the failure
    console.log(`\n🔍 Root Cause Analysis:\n`);
    
    if (run.status === "FAILED") {
      console.log("  ❌ Run was marked as FAILED");
      
      // Check if a job failed and caused the run to fail
      const failedJobs = jobs.filter(j => j.status === "FAILED");
      if (failedJobs.length > 0) {
        console.log(`  ⚠️  Found ${failedJobs.length} failed job(s):`);
        failedJobs.forEach(job => {
          console.log(`    - ${job.type} (${job.id}): ${job.last_error || 'No error message'}`);
        });
        
        // Check if the last failed job caused the run to fail
        const lastFailedJob = failedJobs.sort((a, b) => 
          new Date(b.updated_at) - new Date(a.updated_at)
        )[0];
        
        if (lastFailedJob.attempt_count >= lastFailedJob.max_attempts) {
          console.log(`\n  💡 Root Cause: Job ${lastFailedJob.type} (${lastFailedJob.id}) failed after ${lastFailedJob.attempt_count} attempts.`);
          console.log(`     This likely caused the run to be marked as FAILED, preventing ASSEMBLE from running.`);
        }
      }
    }
    
    if (assembleJobs.length === 0) {
      console.log("  ❌ ASSEMBLE job was never enqueued");
      
      // Check if executive summary was completed
      if (execSummarySection && execSummarySection.status === "COMPLETED") {
        console.log("  ⚠️  Executive Summary is COMPLETED but ASSEMBLE was never triggered");
        console.log("  💡 Root Cause: The ASSEMBLE job should have been enqueued after executive summary completion.");
        console.log("     This suggests the handleGenerateExecSummary function didn't enqueue ASSEMBLE, or");
        console.log("     the job was enqueued but failed before being processed.");
      } else if (execSummaryJobs.length > 0) {
        const lastExecJob = execSummaryJobs.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        )[0];
        
        if (lastExecJob.status === "FAILED") {
          console.log(`  💡 Root Cause: GENERATE_EXEC_SUMMARY job failed (${lastExecJob.id}), so ASSEMBLE was never enqueued.`);
        } else if (lastExecJob.status !== "COMPLETED") {
          console.log(`  💡 Root Cause: GENERATE_EXEC_SUMMARY job is still ${lastExecJob.status}, so ASSEMBLE hasn't been enqueued yet.`);
        }
      }
    } else {
      const assembleJob = assembleJobs[0];
      if (assembleJob.status === "FAILED") {
        console.log(`  💡 Root Cause: ASSEMBLE job failed (${assembleJob.id}): ${assembleJob.last_error || 'No error message'}`);
      } else if (assembleJob.status !== "COMPLETED") {
        console.log(`  💡 Root Cause: ASSEMBLE job exists but is ${assembleJob.status}, not COMPLETED.`);
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/investigate-run-failure.js <runId>");
  process.exit(1);
}

investigateRun(runId).then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
