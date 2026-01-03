-- Fix Race Conditions in Job Claiming
-- This creates an atomic job claiming function to prevent multiple workers
-- from claiming the same job

-- ============================================================================
-- DROP EXISTING FUNCTION (if any)
-- ============================================================================
DROP FUNCTION IF EXISTS claim_job(TEXT);

-- ============================================================================
-- CREATE ATOMIC JOB CLAIMING FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_job(worker_id_param TEXT)
RETURNS TABLE (
  id UUID,
  type TEXT,
  payload JSONB,
  workspace_id UUID,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use FOR UPDATE SKIP LOCKED to prevent race conditions
  -- This ensures only ONE worker can claim a job at a time
  RETURN QUERY
  UPDATE jobs
  SET 
    status = 'CLAIMED',
    worker_id = worker_id_param,
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE jobs.id = (
    SELECT jobs.id 
    FROM jobs
    WHERE jobs.status = 'PENDING'
    ORDER BY jobs.created_at ASC
    FOR UPDATE SKIP LOCKED  -- ✅ CRITICAL: Prevents race conditions!
    LIMIT 1
  )
  RETURNING 
    jobs.id,
    jobs.type,
    jobs.payload,
    jobs.workspace_id,
    jobs.created_at;
END;
$$;

COMMENT ON FUNCTION claim_job(TEXT) IS 
  'Atomically claims a job for a worker. Uses FOR UPDATE SKIP LOCKED to prevent race conditions.';

-- ============================================================================
-- CREATE JOB COMPLETION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_job(job_id_param UUID, result_payload JSONB DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE jobs
  SET 
    status = 'COMPLETED',
    result = result_payload,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = job_id_param
  AND status = 'CLAIMED';  -- Only complete if still claimed
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

COMMENT ON FUNCTION complete_job(UUID, JSONB) IS 
  'Marks a job as completed with optional result payload.';

-- ============================================================================
-- CREATE JOB FAILURE FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION fail_job(
  job_id_param UUID,
  error_message TEXT,
  should_retry BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected INTEGER;
  current_attempts INTEGER;
  max_attempts INTEGER := 3;
BEGIN
  -- Get current retry count
  SELECT COALESCE(retry_count, 0) INTO current_attempts
  FROM jobs
  WHERE id = job_id_param;
  
  -- If should retry and haven't exceeded max attempts, reset to PENDING
  IF should_retry AND current_attempts < max_attempts THEN
    UPDATE jobs
    SET 
      status = 'PENDING',
      error = error_message,
      retry_count = COALESCE(retry_count, 0) + 1,
      worker_id = NULL,
      claimed_at = NULL,
      updated_at = NOW()
    WHERE id = job_id_param;
  ELSE
    -- Mark as failed permanently
    UPDATE jobs
    SET 
      status = 'FAILED',
      error = error_message,
      failed_at = NOW(),
      updated_at = NOW()
    WHERE id = job_id_param;
  END IF;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

COMMENT ON FUNCTION fail_job(UUID, TEXT, BOOLEAN) IS 
  'Marks a job as failed. Optionally retries up to 3 times.';

-- ============================================================================
-- CREATE JOB CLEANUP FUNCTION (Remove stale claims)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_stale_jobs(timeout_minutes INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- Reset jobs that have been claimed for too long
  UPDATE jobs
  SET 
    status = 'PENDING',
    worker_id = NULL,
    claimed_at = NULL,
    retry_count = COALESCE(retry_count, 0) + 1,
    updated_at = NOW(),
    error = CONCAT('Timed out after ', timeout_minutes, ' minutes')
  WHERE status = 'CLAIMED'
  AND claimed_at < NOW() - (timeout_minutes || ' minutes')::INTERVAL
  AND COALESCE(retry_count, 0) < 3;  -- Only retry up to 3 times
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  -- Mark as failed if exceeded max retries
  UPDATE jobs
  SET 
    status = 'FAILED',
    failed_at = NOW(),
    updated_at = NOW(),
    error = 'Exceeded maximum retry attempts'
  WHERE status = 'CLAIMED'
  AND claimed_at < NOW() - (timeout_minutes || ' minutes')::INTERVAL
  AND COALESCE(retry_count, 0) >= 3;
  
  RETURN rows_affected;
END;
$$;

COMMENT ON FUNCTION cleanup_stale_jobs(INTEGER) IS 
  'Resets jobs that have been claimed for too long (default 30 minutes).';

-- ============================================================================
-- ADD RETRY_COUNT COLUMN (if not exists)
-- ============================================================================
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS error TEXT;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS result JSONB;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION claim_job(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION complete_job(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fail_job(UUID, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_stale_jobs(INTEGER) TO authenticated, service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Test job claiming (should return one job)
-- SELECT * FROM claim_job('worker-1');

-- Test multiple workers (should get different jobs)
-- SELECT * FROM claim_job('worker-2');
-- SELECT * FROM claim_job('worker-3');

-- Test job completion
-- SELECT complete_job('job-id-here', '{"status": "success"}'::jsonb);

-- Test job failure with retry
-- SELECT fail_job('job-id-here', 'Connection timeout', true);

-- Test cleanup of stale jobs (jobs claimed > 30 min ago)
-- SELECT cleanup_stale_jobs(30);

