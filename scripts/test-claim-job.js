const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const jobId = process.argv[2] || '05394c2e-757f-4558-8e98-b8a2ba054e5a';
const workerId = 'test-worker-' + Date.now();
const now = new Date().toISOString();
const LOCK_SECONDS = 5 * 60;

async function testClaim() {
  console.log('Attempting to claim job:', jobId);
  console.log('Worker ID:', workerId);
  console.log('Now:', now);
  console.log('');

  // First check current job state
  const { data: currentJob } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  console.log('Current job state:');
  console.log(JSON.stringify(currentJob, null, 2));
  console.log('');

  // Try to claim
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'RUNNING',
      locked_by: workerId,
      locked_at: now,
      lock_expires_at: new Date(Date.now() + LOCK_SECONDS * 1000).toISOString(),
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('status', 'QUEUED')
    .lte('scheduled_at', now)
    .or('lock_expires_at.is.null,lock_expires_at.lte.' + now)
    .select('*')
    .single();

  if (error) {
    console.log('❌ Error claiming job:');
    console.log('   Code:', error.code);
    console.log('   Message:', error.message);
    console.log('   Details:', error.details);
  } else if (data) {
    console.log('✅ Successfully claimed job!');
    console.log('   Status:', data.status);
    console.log('   Locked by:', data.locked_by);
    console.log('   Lock expires at:', data.lock_expires_at);
  } else {
    console.log('⚠️  No job returned');
    console.log('   This means the job conditions were not met');
    console.log('   Possible reasons:');
    console.log('   - Job status is not QUEUED');
    console.log('   - scheduled_at is in the future');
    console.log('   - Job is already locked and lock not expired');
  }
}

testClaim().catch(console.error);

