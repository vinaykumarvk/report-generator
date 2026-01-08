-- ============================================================================
-- GET DETAILS OF THE STUCK JOB
-- ============================================================================
-- This will show us exactly what's wrong
-- ============================================================================

-- Show the stuck job details
SELECT 
  '🔍 STUCK JOB DETAILS' as info,
  id,
  type,
  status,
  created_at,
  NOW() - created_at as stuck_for,
  locked_by,
  locked_at,
  lock_expires_at,
  CASE 
    WHEN lock_expires_at IS NULL THEN '❌ No lock (should not be RUNNING)'
    WHEN lock_expires_at < NOW() THEN '❌ EXPIRED LOCK - Worker crashed/restarted'
    ELSE '⏳ Valid lock - Still processing'
  END as diagnosis,
  attempt_count || '/' || max_attempts as attempts,
  last_error
FROM jobs
WHERE status = 'RUNNING' 
  AND (lock_expires_at IS NULL OR lock_expires_at < NOW())
  AND created_at < NOW() - interval '5 minutes'
LIMIT 5;

-- Show ALL details for job 4dba4520-9073-42af-9d90-57042e3b75f5
SELECT 
  '📋 YOUR SPECIFIC JOB' as info,
  id,
  type,
  status,
  created_at,
  locked_by,
  locked_at,
  lock_expires_at,
  CASE 
    WHEN lock_expires_at IS NULL AND status = 'RUNNING' THEN '❌ PROBLEM: Running without lock'
    WHEN lock_expires_at < NOW() THEN '❌ PROBLEM: Lock expired at ' || lock_expires_at::text
    WHEN lock_expires_at > NOW() THEN '✅ OK: Lock valid until ' || lock_expires_at::text
    ELSE '✅ OK: Not locked'
  END as lock_diagnosis,
  attempt_count,
  max_attempts,
  last_error
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';

-- What is the worker supposed to be doing?
SELECT 
  '📝 JOB PAYLOAD' as info,
  id,
  type,
  payload_json,
  run_id,
  section_run_id
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';




