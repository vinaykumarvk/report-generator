const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRunningJobs() {
  console.log('🔍 Checking running jobs in the system...\n');
  
  // Check report runs
  const { data: runs } = await supabase
    .from('report_runs')
    .select('id, status, created_at, started_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('📊 Recent Report Runs:\n');
  runs?.forEach((run, i) => {
    const duration = run.started_at 
      ? Math.round((new Date() - new Date(run.started_at)) / 1000 / 60)
      : 0;
    console.log(`${i + 1}. Run ID: ${run.id}`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Created: ${run.created_at}`);
    console.log(`   Started: ${run.started_at || 'Not started'}`);
    console.log(`   Duration: ${duration} minutes`);
    console.log(`   Completed: ${run.completed_at || 'Not completed'}\n`);
  });
  
  // Check section runs for IN_PROGRESS runs
  const inProgressRuns = runs?.filter(r => r.status === 'IN_PROGRESS') || [];
  
  if (inProgressRuns.length > 0) {
    console.log('🔄 Checking sections for IN_PROGRESS runs:\n');
    
    for (const run of inProgressRuns) {
      const { data: sections } = await supabase
        .from('section_runs')
        .select('id, title, status, created_at, started_at, completed_at')
        .eq('report_run_id', run.id)
        .order('created_at');
      
      console.log(`   Run: ${run.id}`);
      console.log(`   Sections (${sections?.length || 0}):`);
      sections?.forEach(s => {
        const sectionDuration = s.started_at 
          ? Math.round((new Date() - new Date(s.started_at)) / 1000 / 60)
          : 0;
        console.log(`      • ${s.title}: ${s.status} (${sectionDuration}m)`);
      });
      console.log('');
    }
  }
  
  // Check for stuck jobs (running > 30 minutes)
  const stuckRuns = runs?.filter(r => {
    if (r.status !== 'IN_PROGRESS' || !r.started_at) return false;
    const duration = (new Date() - new Date(r.started_at)) / 1000 / 60;
    return duration > 30;
  }) || [];
  
  if (stuckRuns.length > 0) {
    console.log('⚠️  WARNING: Found potentially stuck runs:\n');
    stuckRuns.forEach(run => {
      const duration = Math.round((new Date() - new Date(run.started_at)) / 1000 / 60);
      console.log(`   • Run ${run.id}: Running for ${duration} minutes`);
    });
    console.log('\n💡 These runs may need to be cancelled or restarted.\n');
  }
  
  // Check worker process
  console.log('🔧 Checking worker process...\n');
  const { data: jobs } = await supabase
    .from('job_queue')
    .select('id, type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (jobs && jobs.length > 0) {
    console.log('📋 Recent Jobs in Queue:\n');
    jobs.forEach((job, i) => {
      console.log(`${i + 1}. Job ${job.id}`);
      console.log(`   Type: ${job.type}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Created: ${job.created_at}\n`);
    });
  } else {
    console.log('   ℹ️  No jobs in queue (job_queue table may not exist)\n');
  }
}

checkRunningJobs().catch(err => {
  console.error('❌ Error:', err.message);
});
