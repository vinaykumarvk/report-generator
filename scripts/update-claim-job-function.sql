-- Update claim_next_job to use atomic FOR UPDATE SKIP LOCKED
-- This replaces the old version with a race-condition-free implementation

-- ============================================================================
-- DROP EXISTING FUNCTION
-- ============================================================================
DROP FUNCTION IF EXISTS claim_next_job(TEXT, INTEGER);

-- ============================================================================
-- CREATE ATOMIC JOB CLAIMING FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_next_job(
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
  -- Use FOR UPDATE SKIP LOCKED to prevent race conditions
  -- This ensures only ONE worker can claim a job at a time
  RETURN QUERY
  UPDATE jobs
  SET 
    status = 'RUNNING',
    locked_by = worker_id,
    locked_at = now_ts,
    lock_expires_at = lock_expires,
    attempt_count = COALESCE(jobs.attempt_count, 0) + 1,
    updated_at = now_ts
  WHERE jobs.id = (
    SELECT jobs.id 
    FROM jobs
    WHERE jobs.status = 'QUEUED'
    AND jobs.scheduled_at <= now_ts
    AND (jobs.attempt_count IS NULL OR jobs.attempt_count < jobs.max_attempts)
    ORDER BY jobs.priority DESC, jobs.created_at ASC
    FOR UPDATE SKIP LOCKED  -- ✅ CRITICAL: Prevents race conditions!
    LIMIT 1
  )
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

COMMENT ON FUNCTION claim_next_job(TEXT, INTEGER) IS 
  'Atomically claims the next available job for a worker. Uses FOR UPDATE SKIP LOCKED to prevent race conditions.';

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION claim_next_job(TEXT, INTEGER) TO authenticated, service_role;

-- ============================================================================
-- VERIFICATION TEST
-- ============================================================================
-- Simulate multiple workers claiming jobs simultaneously
-- Each should get a different job (no duplicates)

-- Test 1: Verify function exists and works
-- SELECT * FROM claim_next_job('test-worker-1', 300);

-- Test 2: Run from multiple psql sessions simultaneously
-- Session 1: SELECT * FROM claim_next_job('worker-1', 300);
-- Session 2: SELECT * FROM claim_next_job('worker-2', 300);
-- Session 3: SELECT * FROM claim_next_job('worker-3', 300);
-- Each should get a DIFFERENT job ID (no duplicates)

-- Test 3: Verify locked jobs are skipped
-- SELECT id, status, locked_by FROM jobs WHERE status = 'RUNNING';
-- Should show jobs locked by different workers

