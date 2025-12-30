const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProgress() {
  console.log('🔍 Checking job progress...\n');
  
  // Check the specific stuck run
  const runId = '75f5435b-df23-4ade-808a-1d2988e8ecae';
  
  const { data: run } = await supabase
    .from('report_runs')
    .select('id, status, started_at, completed_at')
    .eq('id', runId)
    .single();
  
  if (run) {
    console.log('📊 Run Status:');
    console.log(`   ID: ${run.id}`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Started: ${run.started_at}`);
    console.log(`   Completed: ${run.completed_at || 'Not completed'}\n`);
  }
  
  // Check sections
  const { data: sections } = await supabase
    .from('section_runs')
    .select('id, title, status, started_at, completed_at, output_text')
    .eq('report_run_id', runId)
    .order('created_at');
  
  if (sections && sections.length > 0) {
    console.log('📑 Section Status:');
    sections.forEach((s, i) => {
      const hasOutput = s.output_text && s.output_text.length > 0;
      console.log(`   ${i + 1}. ${s.title}`);
      console.log(`      Status: ${s.status}`);
      console.log(`      Output: ${hasOutput ? `${s.output_text.length} chars` : 'None'}`);
      console.log(`      Started: ${s.started_at || 'Not started'}`);
      console.log(`      Completed: ${s.completed_at || 'Not completed'}\n`);
    });
  } else {
    console.log('   No sections found\n');
  }
  
  // Check for recent events
  const { data: events } = await supabase
    .from('run_events')
    .select('type, created_at')
    .eq('report_run_id', runId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (events && events.length > 0) {
    console.log('📋 Recent Events:');
    events.forEach(e => {
      console.log(`   • ${e.type} at ${e.created_at}`);
    });
  }
}

checkProgress().catch(err => {
  console.error('❌ Error:', err.message);
});
