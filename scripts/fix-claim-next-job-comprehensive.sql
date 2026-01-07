-- ============================================================================
-- Comprehensive Fix for claim_next_job Function
-- 
-- This script implements all recommended improvements:
-- 1. Reclaim RUNNING jobs with expired locks atomically
-- 2. Cap retries and mark FAILED when max_attempts exceeded
-- 3. Include scheduled_at check for expired-lock reclaim
-- 4. Emit audit events when reclaiming
-- 5. Add periodic reaper function as safety net
-- ============================================================================

-- ============================================================================
-- STEP 1: Enhanced claim_next_job Function
-- ============================================================================
-- This function now atomically handles both QUEUED jobs and RUNNING jobs
-- with expired locks in a single transaction, preventing race conditions.

DROP FUNCTION IF EXISTS claim_next_job(TEXT, INTEGER);

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
  lock_expires TIMESTAMPTZ := now_ts + (lease_seconds || ' seconds')::INTERVAL;
  job_record jobs%ROWTYPE;
  was_reclaimed BOOLEAN := FALSE;
  previous_worker TEXT;
BEGIN
  -- First, try to find and reclaim a RUNNING job with expired lock
  -- This handles the case where a worker crashed/stalled
  SELECT *
    INTO job_record
    FROM jobs
   WHERE status = 'RUNNING'
     AND lock_expires_at < now_ts  -- Lock has expired
     AND scheduled_at <= now_ts     -- Don't reclaim intentionally delayed jobs
     AND (attempt_count IS NULL OR attempt_count < max_attempts)  -- Not exceeded retries
   ORDER BY priority DESC, created_at ASC  -- Higher priority first, then oldest
   LIMIT 1
   FOR UPDATE SKIP LOCKED;  -- Prevent race conditions

  -- If found an expired RUNNING job, reclaim it
  IF FOUND THEN
    was_reclaimed := TRUE;
    previous_worker := job_record.locked_by;
    
    -- Check if max_attempts exceeded
    IF (job_record.attempt_count IS NOT NULL AND job_record.attempt_count >= job_record.max_attempts) THEN
      -- Mark as FAILED instead of reclaiming
      UPDATE jobs
         SET status = 'FAILED',
             updated_at = now_ts,
             last_error = COALESCE(last_error, '') || E'\n' || 
                         format('Job exceeded max_attempts (%s) and was marked FAILED at %s', 
                                job_record.max_attempts, now_ts)
       WHERE jobs.id = job_record.id;
      
      -- Emit audit event
      INSERT INTO audit_logs (workspace_id, action_type, target_type, target_id, details_json)
      VALUES (
        job_record.workspace_id,
        'JOB_FAILED_MAX_ATTEMPTS',
        'Job',
        job_record.id,
        jsonb_build_object(
          'type', job_record.type,
          'run_id', job_record.run_id,
          'attempt_count', job_record.attempt_count,
          'max_attempts', job_record.max_attempts,
          'previous_worker', previous_worker
        )
      );
      
      -- Return empty (job is now FAILED, not claimable)
      RETURN;
    END IF;
    
    -- Reclaim the expired RUNNING job
    UPDATE jobs
       SET status = 'RUNNING',
           locked_by = worker_id,
           locked_at = now_ts,
           lock_expires_at = lock_expires,
           attempt_count = COALESCE(attempt_count, 0) + 1,
           updated_at = now_ts
     WHERE jobs.id = job_record.id
     RETURNING * INTO job_record;
    
    -- Emit audit event for reclaim
    INSERT INTO audit_logs (workspace_id, action_type, target_type, target_id, details_json)
    VALUES (
      job_record.workspace_id,
      'JOB_RECLAIMED',
      'Job',
      job_record.id,
      jsonb_build_object(
        'type', job_record.type,
        'run_id', job_record.run_id,
        'previous_worker', previous_worker,
        'new_worker', worker_id,
        'attempt_count', job_record.attempt_count,
        'lock_expired_at', job_record.lock_expires_at
      )
    );
    
    -- Emit run event if run_id exists
    IF job_record.run_id IS NOT NULL THEN
      INSERT INTO run_events (run_id, workspace_id, type, payload_json)
      VALUES (
        job_record.run_id,
        job_record.workspace_id,
        'JOB_RECLAIMED',
        jsonb_build_object(
          'job_id', job_record.id,
          'job_type', job_record.type,
          'previous_worker', previous_worker,
          'new_worker', worker_id
        )
      );
    END IF;
    
    -- Return the reclaimed job
    RETURN QUERY SELECT 
      job_record.id,
      job_record.type,
      job_record.status,
      job_record.priority,
      job_record.payload_json,
      job_record.run_id,
      job_record.section_run_id,
      job_record.attempt_count,
      job_record.max_attempts,
      job_record.locked_by,
      job_record.locked_at,
      job_record.lock_expires_at,
      job_record.scheduled_at,
      job_record.last_error,
      job_record.created_at,
      job_record.updated_at,
      job_record.workspace_id;
    RETURN;
  END IF;

  -- If no expired RUNNING job found, look for a QUEUED job
  SELECT *
    INTO job_record
    FROM jobs
   WHERE status = 'QUEUED'
     AND scheduled_at <= now_ts
     AND (lock_expires_at IS NULL OR lock_expires_at <= now_ts)
     AND (attempt_count IS NULL OR attempt_count < max_attempts)
   ORDER BY priority DESC, created_at ASC  -- Higher priority first, then oldest
   LIMIT 1
   FOR UPDATE SKIP LOCKED;  -- Prevent race conditions

  -- If no job found, return empty
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Claim the QUEUED job
  UPDATE jobs
     SET status = 'RUNNING',
         locked_by = worker_id,
         locked_at = now_ts,
         lock_expires_at = lock_expires,
         attempt_count = COALESCE(attempt_count, 0) + 1,
         updated_at = now_ts
   WHERE jobs.id = job_record.id
   RETURNING * INTO job_record;

  -- Return the claimed job
  RETURN QUERY SELECT 
    job_record.id,
    job_record.type,
    job_record.status,
    job_record.priority,
    job_record.payload_json,
    job_record.run_id,
    job_record.section_run_id,
    job_record.attempt_count,
    job_record.max_attempts,
    job_record.locked_by,
    job_record.locked_at,
    job_record.lock_expires_at,
    job_record.scheduled_at,
    job_record.last_error,
    job_record.created_at,
    job_record.updated_at,
    job_record.workspace_id;
END;
$$;

COMMENT ON FUNCTION claim_next_job(TEXT, INTEGER) IS 
  'Atomically claims the next available job. Handles both QUEUED jobs and RUNNING jobs with expired locks. Marks jobs as FAILED if max_attempts exceeded. Emits audit events for reclaims.';

-- ============================================================================
-- STEP 2: Periodic Reaper Function (Safety Net)
-- ============================================================================
-- This function can be called periodically (e.g., via cron or scheduled job)
-- to clean up any stuck jobs that the claim_next_job function might have missed.

CREATE OR REPLACE FUNCTION reap_expired_jobs(
  max_age_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  jobs_reclaimed INTEGER,
  jobs_failed INTEGER,
  details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  age_threshold TIMESTAMPTZ := now_ts - (max_age_minutes || ' minutes')::INTERVAL;
  reclaimed_count INTEGER := 0;
  failed_count INTEGER := 0;
  job_details JSONB := '[]'::JSONB;
  job_record jobs%ROWTYPE;
BEGIN
  -- Find RUNNING jobs with expired locks that are older than threshold
  FOR job_record IN
    SELECT *
      FROM jobs
     WHERE status = 'RUNNING'
       AND lock_expires_at < now_ts
       AND updated_at < age_threshold
       AND scheduled_at <= now_ts
     ORDER BY updated_at ASC
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Check if max_attempts exceeded
    IF (job_record.attempt_count IS NOT NULL AND job_record.attempt_count >= job_record.max_attempts) THEN
      -- Mark as FAILED
      UPDATE jobs
         SET status = 'FAILED',
             updated_at = now_ts,
             last_error = COALESCE(last_error, '') || E'\n' || 
                         format('Job exceeded max_attempts (%s) and was marked FAILED by reaper at %s', 
                                job_record.max_attempts, now_ts)
       WHERE jobs.id = job_record.id;
      
      failed_count := failed_count + 1;
      
      -- Emit audit event
      INSERT INTO audit_logs (workspace_id, action_type, target_type, target_id, details_json)
      VALUES (
        job_record.workspace_id,
        'JOB_FAILED_MAX_ATTEMPTS_REAPER',
        'Job',
        job_record.id,
        jsonb_build_object(
          'type', job_record.type,
          'run_id', job_record.run_id,
          'attempt_count', job_record.attempt_count,
          'max_attempts', job_record.max_attempts,
          'previous_worker', job_record.locked_by,
          'reaped_at', now_ts
        )
      );
      
      -- Add to details
      job_details := job_details || jsonb_build_object(
        'action', 'failed',
        'job_id', job_record.id,
        'type', job_record.type,
        'run_id', job_record.run_id
      );
    ELSE
      -- Reset to QUEUED for reclaim
      UPDATE jobs
         SET status = 'QUEUED',
             locked_by = NULL,
             locked_at = NULL,
             lock_expires_at = NULL,
             updated_at = now_ts
       WHERE jobs.id = job_record.id;
      
      reclaimed_count := reclaimed_count + 1;
      
      -- Emit audit event
      INSERT INTO audit_logs (workspace_id, action_type, target_type, target_id, details_json)
      VALUES (
        job_record.workspace_id,
        'JOB_REQUEUED_BY_REAPER',
        'Job',
        job_record.id,
        jsonb_build_object(
          'type', job_record.type,
          'run_id', job_record.run_id,
          'previous_worker', job_record.locked_by,
          'reaped_at', now_ts
        )
      );
      
      -- Add to details
      job_details := job_details || jsonb_build_object(
        'action', 'requeued',
        'job_id', job_record.id,
        'type', job_record.type,
        'run_id', job_record.run_id
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT 
    reclaimed_count,
    failed_count,
    jsonb_build_object(
      'reclaimed', reclaimed_count,
      'failed', failed_count,
      'jobs', job_details,
      'reaped_at', now_ts
    );
END;
$$;

COMMENT ON FUNCTION reap_expired_jobs(INTEGER) IS 
  'Periodic reaper function to clean up stuck RUNNING jobs with expired locks. Can be called via cron or scheduled job.';

-- ============================================================================
-- STEP 3: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION claim_next_job(TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reap_expired_jobs(INTEGER) TO authenticated, service_role;

-- ============================================================================
-- STEP 4: Create Index for Performance
-- ============================================================================
-- Index to speed up queries for expired RUNNING jobs

CREATE INDEX IF NOT EXISTS idx_jobs_expired_running 
  ON jobs(status, lock_expires_at, scheduled_at, updated_at) 
  WHERE status = 'RUNNING';

-- ============================================================================
-- STEP 5: Verification Queries
-- ============================================================================

-- Test 1: Verify function exists
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'claim_next_job';

-- Test 2: Test claiming a job
-- SELECT * FROM claim_next_job('test-worker-1', 300);

-- Test 3: Test reaper function
-- SELECT * FROM reap_expired_jobs(60);

-- Test 4: Check for stuck jobs
-- SELECT id, type, status, locked_by, lock_expires_at, updated_at
-- FROM jobs
-- WHERE status = 'RUNNING' AND lock_expires_at < NOW()
-- ORDER BY updated_at ASC;

