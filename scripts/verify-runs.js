const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyRuns() {
  console.log('🔍 Verifying remaining runs...\n');
  
  const { data: runs } = await supabase
    .from('report_runs')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!runs || runs.length === 0) {
    console.log('   No runs found\n');
    return;
  }
  
  console.log(`✅ Found ${runs.length} active run(s):\n`);
  
  runs.forEach((run, i) => {
    console.log(`${i + 1}. Run ${run.id.substring(0, 8)}...`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Template: ${run.template_version_snapshot_json?.name || 'N/A'}`);
    console.log(`   Created: ${run.created_at}`);
    console.log(`   Completed: ${run.completed_at || 'Not completed'}`);
    console.log('');
  });
}

verifyRuns().catch(err => {
  console.error('❌ Error:', err.message);
});
