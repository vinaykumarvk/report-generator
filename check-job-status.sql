-- Check the specific job status
SELECT 
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
  attempt_count,
  max_attempts,
  run_id,
  section_run_id,
  payload_json,
  error_message
FROM jobs
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5';

-- Check the associated run
SELECT 
  r.id,
  r.status,
  r.created_at,
  r.started_at,
  r.completed_at,
  r.template_version_snapshot_json->>'name' as template_name,
  r.input_json->>'topic' as topic,
  COUNT(sr.id) as total_sections,
  COUNT(CASE WHEN sr.status = 'COMPLETED' THEN 1 END) as completed_sections,
  COUNT(CASE WHEN sr.status = 'FAILED' THEN 1 END) as failed_sections,
  COUNT(CASE WHEN sr.status = 'RUNNING' THEN 1 END) as running_sections,
  COUNT(CASE WHEN sr.status = 'QUEUED' THEN 1 END) as queued_sections
FROM report_runs r
LEFT JOIN section_runs sr ON sr.report_run_id = r.id
WHERE r.id IN (
  SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
)
GROUP BY r.id, r.status, r.created_at, r.started_at, r.completed_at, r.template_version_snapshot_json, r.input_json;

-- Check all jobs for this run
SELECT 
  id,
  type,
  status,
  created_at,
  locked_by,
  attempt_count,
  error_message
FROM jobs
WHERE run_id IN (
  SELECT run_id FROM jobs WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
)
ORDER BY created_at;

-- Check for any stuck jobs in general
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM jobs
GROUP BY status;
