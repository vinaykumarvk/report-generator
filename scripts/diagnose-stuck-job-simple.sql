-- ============================================================================
-- SIMPLE DIAGNOSTIC: Check Job 4dba4520-9073-42af-9d90-57042e3b75f5
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Check the job status
SELECT 
  id,
  type,
  status,
  created_at,
  updated_at,
  NOW() - created_at as job_age,
  locked_by,
  locked_at,
  lock_expires_at,
  CASE 
    WHEN lock_expires_at IS NULL THEN '✅ Unlocked'
    WHEN lock_expires_at > NOW() THEN '⏳ Locked (valid)'
    ELSE '❌ Locked (EXPIRED)'
  END as lock_status,
  attempt_count,
  max_attempts,
  run_id,
  last_error
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';

-- 2. Check the run
SELECT 
  id as run_id,
  status as run_status,
  created_at,
  started_at,
  completed_at,
  NOW() - created_at as run_age,
  template_version_snapshot_json->>'name' as template_name,
  input_json->>'topic' as topic,
  blueprint_json IS NOT NULL as has_blueprint,
  final_report_json IS NOT NULL as has_final_report
FROM report_runs
WHERE id = (
  SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
);

-- 3. Check all jobs for this run
SELECT 
  id,
  type,
  status,
  created_at,
  locked_by,
  CASE 
    WHEN lock_expires_at IS NULL THEN 'Unlocked'
    WHEN lock_expires_at > NOW() THEN 'Locked'
    ELSE 'EXPIRED'
  END as lock_status,
  attempt_count
FROM jobs
WHERE run_id = (
  SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
)
ORDER BY created_at;

-- 4. Check queue health
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM jobs
GROUP BY status;

