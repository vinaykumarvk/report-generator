-- Atomic claim by job id with attempt_count increment and lock enforcement

DROP FUNCTION IF EXISTS claim_job_by_id(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION claim_job_by_id(
  job_id UUID,
  worker_id TEXT,
  lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  status TEXT,
  priority INTEGER,
  payload_json JSONB,
  run_id UUID,
  section_run_id UUID,
  attempt_count INTEGER,
  max_attempts INTEGER,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  workspace_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  lock_expires TIMESTAMPTZ := NOW() + (lease_seconds || ' seconds')::INTERVAL;
BEGIN
  RETURN QUERY
  UPDATE jobs
  SET
    status = 'RUNNING',
    locked_by = worker_id,
    locked_at = now_ts,
    lock_expires_at = lock_expires,
    attempt_count = COALESCE(jobs.attempt_count, 0) + 1,
    updated_at = now_ts
  WHERE jobs.id = job_id
    AND jobs.status = 'QUEUED'
    AND jobs.scheduled_at <= now_ts
    AND (jobs.lock_expires_at IS NULL OR jobs.lock_expires_at <= now_ts)
    AND (jobs.attempt_count IS NULL OR jobs.attempt_count < jobs.max_attempts)
  RETURNING
    jobs.id,
    jobs.type,
    jobs.status,
    jobs.priority,
    jobs.payload_json,
    jobs.run_id,
    jobs.section_run_id,
    jobs.attempt_count,
    jobs.max_attempts,
    jobs.locked_by,
    jobs.locked_at,
    jobs.lock_expires_at,
    jobs.scheduled_at,
    jobs.last_error,
    jobs.created_at,
    jobs.updated_at,
    jobs.workspace_id;
END;
$$;

COMMENT ON FUNCTION claim_job_by_id(UUID, TEXT, INTEGER) IS
  'Atomically claims a specific job by id with lock enforcement and attempt increment.';

GRANT EXECUTE ON FUNCTION claim_job_by_id(UUID, TEXT, INTEGER) TO authenticated, service_role;
