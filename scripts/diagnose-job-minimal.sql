-- ============================================================================
-- ULTRA-SIMPLE DIAGNOSTIC: Job 4dba4520-9073-42af-9d90-57042e3b75f5
-- ============================================================================
-- This version only checks what we KNOW exists in the schema
-- ============================================================================

-- 1. THE JOB
SELECT 
  'JOB STATUS' as info,
  id,
  type,
  status,
  created_at,
  NOW() - created_at as age,
  locked_by,
  CASE 
    WHEN lock_expires_at IS NULL THEN 'UNLOCKED ✅'
    WHEN lock_expires_at > NOW() THEN 'LOCKED ⏳'
    ELSE 'EXPIRED ❌'
  END as lock_state,
  attempt_count,
  last_error
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';

-- 2. THE RUN
SELECT 
  'RUN STATUS' as info,
  id,
  status,
  created_at,
  started_at,
  completed_at,
  NOW() - created_at as age
FROM report_runs
WHERE id = (SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5');

-- 3. ALL JOBS FOR THIS RUN
SELECT 
  'ALL JOBS' as info,
  type,
  status,
  created_at,
  CASE 
    WHEN lock_expires_at IS NULL THEN 'UNLOCKED'
    WHEN lock_expires_at > NOW() THEN 'LOCKED'
    ELSE 'EXPIRED'
  END as lock_state
FROM jobs
WHERE run_id = (SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5')
ORDER BY created_at;

-- 4. QUEUE STATUS
SELECT 
  'QUEUE' as info,
  status,
  COUNT(*) as count
FROM jobs
GROUP BY status;

-- 5. STUCK JOBS?
SELECT 
  'STUCK JOBS' as info,
  COUNT(*) as count
FROM jobs
WHERE status = 'RUNNING' 
  AND (lock_expires_at IS NULL OR lock_expires_at < NOW())
  AND created_at < NOW() - interval '5 minutes';




