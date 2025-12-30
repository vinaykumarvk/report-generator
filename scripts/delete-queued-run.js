const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteQueuedRun() {
  const runId = 'ac346ee7-a8c6-41f5-8baa-c1409c862849';
  
  console.log('🗑️  Deleting queued run...\n');
  console.log(`   Run ID: ${runId}\n`);
  
  // First, delete any associated section runs
  console.log('1. Deleting section runs...');
  const { error: sectionError } = await supabase
    .from('section_runs')
    .delete()
    .eq('report_run_id', runId);
  
  if (sectionError) {
    console.log('   ⚠️  No section runs found (or error):', sectionError.message);
  } else {
    console.log('   ✅ Section runs deleted');
  }
  
  // Delete any jobs
  console.log('\n2. Deleting associated jobs...');
  const { error: jobError } = await supabase
    .from('jobs')
    .delete()
    .eq('run_id', runId);
  
  if (jobError) {
    console.log('   ⚠️  No jobs found (or error):', jobError.message);
  } else {
    console.log('   ✅ Jobs deleted');
  }
  
  // Delete the run
  console.log('\n3. Deleting the run...');
  const { error: runError } = await supabase
    .from('report_runs')
    .delete()
    .eq('id', runId);
  
  if (runError) {
    console.error('   ❌ Error deleting run:', runError.message);
    throw runError;
  }
  
  console.log('   ✅ Run deleted successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Queued run removed from database');
  console.log('   Refresh your browser to see the updated list');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

deleteQueuedRun().catch(err => {
  console.error('❌ Error:', err.message);
});
