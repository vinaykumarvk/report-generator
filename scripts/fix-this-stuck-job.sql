-- ============================================================================
-- FIX STUCK JOB: 4dba4520-9073-42af-9d90-57042e3b75f5
-- ============================================================================
-- This will release the stuck job so the worker can retry it
-- ============================================================================

-- First, let's see what we're fixing
SELECT 
  '🔍 BEFORE FIX' as status,
  id,
  type,
  status,
  locked_by,
  lock_expires_at,
  attempt_count
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';

-- Now release the stuck job
UPDATE jobs
SET 
  status = 'QUEUED',
  locked_by = NULL,
  locked_at = NULL,
  lock_expires_at = NULL,
  updated_at = NOW()
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
  AND (
    status = 'RUNNING'  -- If it's stuck in RUNNING
    OR lock_expires_at < NOW()  -- Or lock expired
    OR locked_at < NOW() - interval '10 minutes'  -- Or locked too long
  );

-- Verify the fix
SELECT 
  '✅ AFTER FIX' as status,
  id,
  type,
  status,
  locked_by,
  lock_expires_at,
  attempt_count,
  'Worker should pick this up within 1 second' as next_step
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';



