-- ============================================================================
-- CLEAN UP ALL STUCK JOBS
-- ============================================================================
-- This will release ALL jobs with expired locks
-- Run this to clean up the entire queue
-- ============================================================================

-- First, show what we're about to fix
SELECT 
  '🔍 STUCK JOBS TO FIX' as status,
  id,
  type,
  status,
  created_at,
  NOW() - created_at as stuck_for,
  locked_by,
  lock_expires_at,
  attempt_count
FROM jobs
WHERE status = 'RUNNING' 
  AND lock_expires_at < NOW()
ORDER BY created_at;

-- Release all stuck jobs
UPDATE jobs
SET 
  status = 'QUEUED',
  locked_by = NULL,
  locked_at = NULL,
  lock_expires_at = NULL,
  updated_at = NOW()
WHERE status = 'RUNNING' 
  AND lock_expires_at < NOW()
RETURNING id, type, 'Released!' as action;

-- Verify all jobs are now clean
SELECT 
  '✅ QUEUE STATUS AFTER CLEANUP' as status,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM jobs
GROUP BY status
ORDER BY 
  CASE status 
    WHEN 'RUNNING' THEN 1
    WHEN 'QUEUED' THEN 2
    WHEN 'COMPLETED' THEN 3
    WHEN 'FAILED' THEN 4
    ELSE 5
  END;

-- Check for any remaining issues
SELECT 
  '⚠️ ANY REMAINING ISSUES?' as status,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All good! Queue is healthy.'
    ELSE '❌ Still have ' || COUNT(*) || ' stuck jobs!'
  END as result
FROM jobs
WHERE status = 'RUNNING' 
  AND lock_expires_at < NOW();



