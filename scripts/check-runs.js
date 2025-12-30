#!/usr/bin/env node

/**
 * Check runs and their section statuses
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRuns() {
  console.log('🔍 Checking Report Runs');
  console.log('=======================');
  console.log('');

  // Get recent runs
  const { data: runs, error: runsError } = await supabase
    .from('runs')
    .select('id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (runsError) {
    console.error('❌ Error fetching runs:', runsError.message);
    process.exit(1);
  }

  console.log(`Found ${runs.length} recent runs:`);
  console.log('');

  for (const run of runs) {
    console.log(`📊 Run: ${run.id.substring(0, 8)}...`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Created: ${new Date(run.created_at).toLocaleString()}`);

    // Get section runs for this run
    const { data: sectionRuns, error: sectionsError } = await supabase
      .from('section_runs')
      .select('id, section_id, status, created_at')
      .eq('run_id', run.id)
      .order('created_at', { ascending: true });

    if (sectionsError) {
      console.error('   ❌ Error fetching sections:', sectionsError.message);
    } else {
      console.log(`   Sections: ${sectionRuns.length} total`);
      
      const statusCounts = sectionRuns.reduce((acc, sr) => {
        acc[sr.status] = (acc[sr.status] || 0) + 1;
        return acc;
      }, {});

      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`      ${status}: ${count}`);
      });

      // Check for jobs related to these section runs
      const sectionRunIds = sectionRuns.map(sr => sr.id);
      if (sectionRunIds.length > 0) {
        const { data: jobs, error: jobsError } = await supabase
          .from('jobs')
          .select('id, type, status, section_run_id')
          .in('section_run_id', sectionRunIds);

        if (!jobsError && jobs) {
          console.log(`   Jobs: ${jobs.length} total`);
          const jobStatusCounts = jobs.reduce((acc, j) => {
            acc[j.status] = (acc[j.status] || 0) + 1;
            return acc;
          }, {});
          Object.entries(jobStatusCounts).forEach(([status, count]) => {
            console.log(`      ${status}: ${count}`);
          });
        }
      }
    }
    console.log('');
  }

  // Check for RUNNING runs specifically
  const runningRuns = runs.filter(r => r.status === 'RUNNING');
  if (runningRuns.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  DIAGNOSIS: Runs stuck in RUNNING status');
    console.log('');
    console.log('This usually means:');
    console.log('1. START_RUN job completed, but section jobs were not created');
    console.log('2. Section jobs are stuck in QUEUED (but we found 0 QUEUED jobs)');
    console.log('3. There was an error during run initialization');
    console.log('');
    console.log('💡 Solution: Check the START_RUN job logs for errors');
    console.log('');
  }

  // Check for any jobs in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentJobs, error: recentJobsError } = await supabase
    .from('jobs')
    .select('id, type, status, created_at, last_error')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!recentJobsError && recentJobs) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`📋 Recent jobs (last hour): ${recentJobs.length}`);
    console.log('');
    
    recentJobs.forEach(job => {
      const time = new Date(job.created_at).toLocaleTimeString();
      console.log(`   ${time} - ${job.type.padEnd(12)} ${job.status.padEnd(12)} ${job.id.substring(0, 8)}...`);
      if (job.last_error) {
        console.log(`      Error: ${job.last_error.substring(0, 100)}`);
      }
    });
    console.log('');
  }
}

checkRuns().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

