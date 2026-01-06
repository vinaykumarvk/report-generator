-- ============================================================================
-- DIAGNOSTIC SCRIPT FOR STUCK JOB: 4dba4520-9073-42af-9d90-57042e3b75f5
-- ============================================================================
-- Run this in Supabase SQL Editor to diagnose the issue
-- ============================================================================

-- 1. Check the specific job details
SELECT 
  '=== JOB DETAILS ===' as section,
  id,
  type,
  status,
  priority,
  created_at,
  updated_at,
  scheduled_at,
  locked_by,
  locked_at,
  lock_expires_at,
  CASE 
    WHEN lock_expires_at IS NOT NULL AND lock_expires_at < NOW() THEN 'EXPIRED'
    WHEN locked_by IS NOT NULL THEN 'LOCKED'
    ELSE 'UNLOCKED'
  END as lock_status,
  NOW() - created_at as age,
  attempt_count,
  max_attempts,
  run_id,
  section_run_id,
  last_error
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';

-- 2. Check the associated run status
SELECT 
  '=== RUN STATUS ===' as section,
  r.id as run_id,
  r.status as run_status,
  r.created_at,
  r.started_at,
  r.completed_at,
  NOW() - r.created_at as run_age,
  r.template_version_snapshot_json->>'name' as template_name,
  r.input_json->>'topic' as topic,
  r.blueprint_json IS NOT NULL as has_blueprint,
  r.final_report_json IS NOT NULL as has_final_report
FROM report_runs r
WHERE r.id = (
  SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
);

-- 3. Check all sections for this run
SELECT 
  '=== SECTION STATUS ===' as section,
  sr.id as section_id,
  sr.title,
  sr.status,
  sr.created_at,
  sr.started_at,
  sr.completed_at,
  NOW() - sr.created_at as age,
  sr.attempt_count,
  LENGTH(sr.output_markdown) as output_length,
  sr.error_message
FROM section_runs sr
WHERE sr.report_run_id = (
  SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
)
ORDER BY sr.created_at;

-- 4. Check all jobs for this run
SELECT 
  '=== ALL JOBS FOR THIS RUN ===' as section,
  j.id,
  j.type,
  j.status,
  j.created_at,
  j.locked_by,
  j.locked_at,
  j.lock_expires_at,
  CASE 
    WHEN j.lock_expires_at IS NOT NULL AND j.lock_expires_at < NOW() THEN 'EXPIRED'
    WHEN j.locked_by IS NOT NULL THEN 'LOCKED'
    ELSE 'UNLOCKED'
  END as lock_status,
  j.attempt_count,
  j.section_run_id,
  j.error_message
FROM jobs j
WHERE j.run_id = (
  SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
)
ORDER BY j.created_at;

-- 5. Check global job queue health
SELECT 
  '=== GLOBAL QUEUE HEALTH ===' as section,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job,
  COUNT(CASE WHEN locked_by IS NOT NULL THEN 1 END) as locked_count,
  COUNT(CASE WHEN lock_expires_at < NOW() THEN 1 END) as expired_locks
FROM jobs
GROUP BY status
ORDER BY status;

-- 6. Check for stuck/expired locks
SELECT 
  '=== EXPIRED LOCKS ===' as section,
  id,
  type,
  status,
  locked_by,
  locked_at,
  lock_expires_at,
  NOW() - lock_expires_at as expired_since,
  attempt_count
FROM jobs
WHERE lock_expires_at IS NOT NULL 
  AND lock_expires_at < NOW()
  AND status IN ('RUNNING', 'QUEUED')
ORDER BY lock_expires_at
LIMIT 20;

-- 7. Check recent run_events for this run
SELECT 
  '=== RECENT EVENTS ===' as section,
  event_type,
  created_at,
  payload_json
FROM run_events
WHERE run_id = (
  SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
)
ORDER BY created_at DESC
LIMIT 20;

-- 8. Architecture diagnosis
SELECT 
  '=== ARCHITECTURE DIAGNOSIS ===' as section,
  'Total Jobs' as metric,
  COUNT(*) as value
FROM jobs
UNION ALL
SELECT 
  '=== ARCHITECTURE DIAGNOSIS ===' as section,
  'Stuck in RUNNING' as metric,
  COUNT(*) as value
FROM jobs
WHERE status = 'RUNNING' 
  AND locked_at < NOW() - interval '5 minutes'
UNION ALL
SELECT 
  '=== ARCHITECTURE DIAGNOSIS ===' as section,
  'Stuck in QUEUED' as metric,
  COUNT(*) as value
FROM jobs
WHERE status = 'QUEUED' 
  AND created_at < NOW() - interval '10 minutes'
  AND (locked_by IS NULL OR lock_expires_at < NOW())
UNION ALL
SELECT 
  '=== ARCHITECTURE DIAGNOSIS ===' as section,
  'Expired Locks' as metric,
  COUNT(*) as value
FROM jobs
WHERE lock_expires_at IS NOT NULL 
  AND lock_expires_at < NOW()
  AND status = 'RUNNING';

