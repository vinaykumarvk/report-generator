const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExport() {
  const runId = '75f5435b-df23-4ade-808a-1d2988e8ecae';
  
  console.log('🔍 Testing export functionality...\n');
  
  // Create an export job
  console.log('1. Creating export job via API...');
  const response = await fetch(`http://localhost:3000/api/report-runs/${runId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'MARKDOWN' })
  });
  
  if (!response.ok) {
    console.error('   ❌ Failed to create export job:', await response.text());
    return;
  }
  
  const result = await response.json();
  console.log('   ✅ Export job created:', result.jobId);
  
  // Check if job is in the queue
  console.log('\n2. Checking job queue...');
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', result.jobId)
    .single();
  
  if (job) {
    console.log('   ✅ Job found in queue:');
    console.log('      Type:', job.type);
    console.log('      Status:', job.status);
    console.log('      Run ID:', job.run_id);
  } else {
    console.log('   ❌ Job not found in queue');
    return;
  }
  
  // Wait for worker to process
  console.log('\n3. Waiting for worker to process (10 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Check job status
  console.log('\n4. Checking job status...');
  const { data: updatedJob } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', result.jobId)
    .single();
  
  if (updatedJob) {
    console.log('   Status:', updatedJob.status);
    if (updatedJob.status === 'COMPLETED') {
      console.log('   ✅ Job completed successfully');
    } else if (updatedJob.status === 'FAILED') {
      console.log('   ❌ Job failed:', updatedJob.last_error);
    } else {
      console.log('   ⏳ Job still processing...');
    }
  }
  
  // Check for exports
  console.log('\n5. Checking for export records...');
  const { data: exports } = await supabase
    .from('exports')
    .select('*')
    .eq('report_run_id', runId)
    .order('created_at', { ascending: false });
  
  if (exports && exports.length > 0) {
    console.log(`   ✅ Found ${exports.length} export(s):`);
    exports.forEach((exp, i) => {
      console.log(`\n   Export ${i + 1}:`);
      console.log('      ID:', exp.id);
      console.log('      Format:', exp.format);
      console.log('      File Path:', exp.file_path);
      console.log('      Created:', exp.created_at);
    });
  } else {
    console.log('   ⚠️  No exports found yet');
  }
}

testExport().catch(err => {
  console.error('❌ Error:', err.message);
});
