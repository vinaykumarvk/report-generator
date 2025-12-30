const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllRuns() {
  console.log('🔍 Checking all report runs...\n');
  
  const { data: runs } = await supabase
    .from('report_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!runs || runs.length === 0) {
    console.log('   No runs found\n');
    return;
  }
  
  console.log(`📊 Found ${runs.length} recent runs:\n`);
  
  runs.forEach((run, i) => {
    const age = Math.round((Date.now() - new Date(run.created_at).getTime()) / 1000 / 60);
    console.log(`${i + 1}. Run ${run.id.substring(0, 8)}...`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Created: ${age} minutes ago`);
    console.log(`   Started: ${run.started_at ? 'Yes' : 'No'}`);
    console.log(`   Completed: ${run.completed_at ? 'Yes' : 'No'}`);
    
    if (run.status === 'QUEUED') {
      console.log(`   ⏳ Waiting for START_RUN job`);
    } else if (run.status === 'RUNNING') {
      console.log(`   🔄 Currently processing`);
    } else if (run.status === 'COMPLETED') {
      console.log(`   ✅ Finished`);
    }
    console.log('');
  });
}

checkAllRuns().catch(err => {
  console.error('❌ Error:', err.message);
});
