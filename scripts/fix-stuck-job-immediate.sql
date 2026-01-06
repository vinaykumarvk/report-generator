-- ============================================================================
-- QUICK FIX: Release Stuck Job 4dba4520-9073-42af-9d90-57042e3b75f5
-- ============================================================================
-- Run this in Supabase SQL Editor to immediately fix the stuck job
-- ============================================================================

-- Option 1: Release the specific job if lock is expired
UPDATE jobs
SET 
  status = 'QUEUED',
  locked_by = NULL,
  locked_at = NULL,
  lock_expires_at = NULL,
  updated_at = NOW()
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
  AND (
    lock_expires_at < NOW()  -- Lock expired
    OR locked_at < NOW() - interval '10 minutes'  -- Locked too long
    OR status = 'RUNNING'  -- Force reset if stuck in RUNNING
  )
RETURNING id, type, status, 'Released!' as action;

-- Option 2: If you want to fail it instead of retry
-- UPDATE jobs
-- SET 
--   status = 'FAILED',
--   last_error = 'Manually failed due to stuck state',
--   updated_at = NOW()
-- WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
-- RETURNING id, type, status, 'Failed!' as action;

-- Verify the fix
SELECT 
  id,
  type,
  status,
  locked_by,
  lock_expires_at,
  CASE 
    WHEN lock_expires_at IS NULL THEN 'Unlocked'
    WHEN lock_expires_at > NOW() THEN 'Locked (valid)'
    ELSE 'Locked (expired)'
  END as lock_status,
  attempt_count,
  created_at,
  updated_at
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';

