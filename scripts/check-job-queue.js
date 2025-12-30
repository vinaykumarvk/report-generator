const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJobQueue() {
  console.log('🔍 Checking job queue status...\n');
  
  // Check all jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (!jobs || jobs.length === 0) {
    console.log('   No jobs in queue\n');
    return;
  }
  
  console.log(`📊 Found ${jobs.length} recent jobs:\n`);
  
  const statusCounts = {};
  jobs.forEach(job => {
    statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
  });
  
  console.log('Status Summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  console.log('\n📋 Recent Jobs:\n');
  jobs.forEach((job, i) => {
    const age = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
    console.log(`${i + 1}. Job ${job.id.substring(0, 8)}...`);
    console.log(`   Type: ${job.type}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Age: ${age} minutes`);
    console.log(`   Run ID: ${job.run_id || 'N/A'}`);
    console.log(`   Locked by: ${job.locked_by || 'None'}`);
    if (job.status === 'QUEUED') {
      console.log(`   ⏳ Still waiting to be processed`);
    }
    if (job.status === 'FAILED') {
      console.log(`   ❌ Error: ${job.last_error || 'Unknown'}`);
    }
    console.log('');
  });
  
  // Check for stuck jobs
  const { data: stuckJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'QUEUED')
    .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // > 5 min old
  
  if (stuckJobs && stuckJobs.length > 0) {
    console.log(`⚠️  Found ${stuckJobs.length} potentially stuck QUEUED job(s) (>5 min old):\n`);
    stuckJobs.forEach(job => {
      const age = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
      console.log(`   • Job ${job.id.substring(0, 8)}: ${job.type} (${age} min old)`);
    });
  }
}

checkJobQueue().catch(err => {
  console.error('❌ Error:', err.message);
});
