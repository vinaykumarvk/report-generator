const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRunDetails() {
  const runId = '75f5435b-df23-4ade-808a-1d2988e8ecae';
  
  console.log('🔍 Fetching complete run details...\n');
  
  const { data: run, error: runError } = await supabase
    .from('report_runs')
    .select('*')
    .eq('id', runId)
    .single();
  
  if (runError) {
    console.error('❌ Error fetching run:', runError);
    return;
  }
  
  console.log('📊 Run Details:');
  console.log(`   ID: ${run.id}`);
  console.log(`   Status: ${run.status}`);
  console.log(`   Template ID: ${run.template_id}`);
  console.log(`   Started: ${run.started_at}`);
  console.log(`   Completed: ${run.completed_at}`);
  console.log(`   Final Report JSON: ${run.final_report_json ? 'YES' : 'NO'}`);
  
  if (run.final_report_json) {
    console.log(`   Final Report Length: ${JSON.stringify(run.final_report_json).length} chars`);
  }
  
  console.log(`   Blueprint: ${run.blueprint ? 'YES' : 'NO'}\n`);
  
  // Check all columns in section_runs table
  const { data: sectionTest } = await supabase
    .from('section_runs')
    .select('*')
    .eq('report_run_id', runId)
    .limit(1);
  
  if (sectionTest && sectionTest.length > 0) {
    console.log('📑 Section Runs Found:', sectionTest.length);
    console.log('   Sample section columns:', Object.keys(sectionTest[0]));
  } else {
    console.log('❌ No section runs found for this report run');
    
    // Check if there are ANY section runs in the database
    const { data: allSections, count } = await supabase
      .from('section_runs')
      .select('report_run_id', { count: 'exact' })
      .limit(5);
    
    console.log(`\n   Total section runs in database: ${count || 0}`);
    if (allSections && allSections.length > 0) {
      console.log('   Sample report_run_ids:', allSections.map(s => s.report_run_id).join(', '));
    }
  }
}

checkRunDetails().catch(err => {
  console.error('❌ Error:', err.message);
});
