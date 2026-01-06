-- ============================================================================
-- COMPREHENSIVE BUT SAFE DIAGNOSTIC
-- ============================================================================
-- Only uses columns we know exist from the schema
-- ============================================================================

-- 1. JOB DETAILS
SELECT 
  '=== JOB ===' as section,
  id,
  type,
  status,
  priority,
  created_at,
  updated_at,
  NOW() - created_at as job_age,
  locked_by,
  locked_at,
  lock_expires_at,
  CASE 
    WHEN lock_expires_at IS NULL THEN '✅ UNLOCKED'
    WHEN lock_expires_at > NOW() THEN '⏳ LOCKED (valid)'
    ELSE '❌ EXPIRED LOCK'
  END as lock_status,
  attempt_count,
  max_attempts,
  run_id,
  section_run_id,
  last_error
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';

-- 2. RUN STATUS
SELECT 
  '=== RUN ===' as section,
  id,
  status,
  created_at,
  started_at,
  completed_at,
  NOW() - created_at as run_age,
  template_version_snapshot_json->>'name' as template_name,
  input_json->>'topic' as topic,
  blueprint_json IS NOT NULL as has_blueprint,
  final_report_json IS NOT NULL as has_final_report
FROM report_runs
WHERE id = (SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5');

-- 3. SECTIONS STATUS
SELECT 
  '=== SECTIONS ===' as section,
  id,
  title,
  status,
  created_at,
  NOW() - created_at as age,
  attempt_count,
  model_used
FROM section_runs
WHERE report_run_id = (SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5')
ORDER BY created_at;

-- 4. ALL JOBS FOR THIS RUN
SELECT 
  '=== ALL JOBS ===' as section,
  type,
  status,
  created_at,
  locked_by,
  CASE 
    WHEN lock_expires_at IS NULL THEN 'UNLOCKED'
    WHEN lock_expires_at > NOW() THEN 'LOCKED'
    ELSE 'EXPIRED'
  END as lock_state,
  attempt_count,
  last_error
FROM jobs
WHERE run_id = (SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5')
ORDER BY created_at;

-- 5. QUEUE HEALTH
SELECT 
  '=== QUEUE ===' as section,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM jobs
GROUP BY status;

-- 6. STUCK JOBS CHECK
SELECT 
  '=== STUCK JOBS ===' as section,
  id,
  type,
  status,
  locked_by,
  locked_at,
  lock_expires_at,
  NOW() - created_at as age,
  attempt_count
FROM jobs
WHERE (
  (status = 'RUNNING' AND lock_expires_at < NOW())
  OR (status = 'RUNNING' AND created_at < NOW() - interval '10 minutes')
  OR (status = 'QUEUED' AND created_at < NOW() - interval '10 minutes')
)
ORDER BY created_at
LIMIT 10;



