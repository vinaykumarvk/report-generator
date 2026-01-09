require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔧 Cleaning Up Expired Export Jobs\n');
  console.log('='.repeat(70));
  
  const now = new Date();
  
  // Get expired RUNNING export jobs
  const { data: expiredJobs } = await supabase
    .from('jobs')
    .select('id, attempt_count, max_attempts, payload_json, lock_expires_at')
    .eq('status', 'RUNNING')
    .eq('type', 'EXPORT')
    .lt('lock_expires_at', now.toISOString());
  
  if (!expiredJobs || expiredJobs.length === 0) {
    console.log('✅ No expired export jobs to clean up');
    return;
  }
  
  console.log(`Found ${expiredJobs.length} expired export jobs\n`);
  
  let reclaimed = 0;
  let failed = 0;
  
  for (const job of expiredJobs) {
    const maxAttempts = job.max_attempts || 3;
    const attempts = job.attempt_count || 0;
    const expiredBy = Math.round((now - new Date(job.lock_expires_at).getTime()) / 1000);
    
    console.log(`   Job ${job.id.substring(0, 8)}... - Expired ${expiredBy}s ago, Attempts: ${attempts}/${maxAttempts}`);
    
    if (attempts >= maxAttempts) {
      // Mark as FAILED
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'FAILED',
          last_error: `Job exceeded max attempts (${maxAttempts}) and lock expired`,
          updated_at: now.toISOString()
        })
        .eq('id', job.id);
      
      if (!error) {
        failed++;
        console.log(`      ❌ Marked as FAILED`);
        
        // Also mark export as FAILED
        if (job.payload_json?.exportId) {
          await supabase
            .from('exports')
            .update({
              status: 'FAILED',
              error_message: `Export job exceeded max attempts (${maxAttempts})`
            })
            .eq('id', job.payload_json.exportId);
          console.log(`      📋 Marked export ${job.payload_json.exportId.substring(0, 8)}... as FAILED`);
        }
      } else {
        console.log(`      ⚠️  Error updating job: ${error.message}`);
      }
    } else {
      // Reset to QUEUED so it can be reclaimed
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'QUEUED',
          locked_by: null,
          locked_at: null,
          lock_expires_at: null,
          updated_at: now.toISOString()
        })
        .eq('id', job.id);
      
      if (!error) {
        reclaimed++;
        console.log(`      🔄 Reset to QUEUED (can be retried)`);
      } else {
        console.log(`      ⚠️  Error resetting job: ${error.message}`);
      }
    }
  }
  
  console.log(`\n✅ Cleanup complete:`);
  console.log(`   Reclaimed: ${reclaimed}`);
  console.log(`   Failed: ${failed}`);
  
  console.log('='.repeat(70));
})();
