-- ============================================================================
-- FIX STUCK EXPORT JOB: 990b1d0d-c446-4d09-967c-566da3032ca8
-- ============================================================================
-- This job has been stuck for 3+ days with an expired lock
-- ============================================================================

-- Show current state
SELECT 
  '🔍 BEFORE FIX' as status,
  id,
  type,
  status,
  created_at,
  NOW() - created_at as stuck_for,
  locked_by,
  lock_expires_at,
  attempt_count,
  run_id
FROM jobs
WHERE id = '990b1d0d-c446-4d09-967c-566da3032ca8';

-- Release the stuck job
UPDATE jobs
SET 
  status = 'QUEUED',
  locked_by = NULL,
  locked_at = NULL,
  lock_expires_at = NULL,
  updated_at = NOW()
WHERE id = '990b1d0d-c446-4d09-967c-566da3032ca8';

-- Verify the fix
SELECT 
  '✅ AFTER FIX' as status,
  id,
  type,
  status,
  locked_by,
  lock_expires_at,
  attempt_count,
  'Worker should pick this up within 1 second!' as next_step
FROM jobs
WHERE id = '990b1d0d-c446-4d09-967c-566da3032ca8';

-- Also check if there are any other stuck jobs
SELECT 
  '⚠️ OTHER STUCK JOBS?' as status,
  COUNT(*) as count
FROM jobs
WHERE status = 'RUNNING' 
  AND lock_expires_at < NOW();



