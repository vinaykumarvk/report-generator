-- URGENT FIX: claim_next_job function with resolved ambiguity
-- This fixes the "column reference status is ambiguous" error

DROP FUNCTION IF EXISTS claim_next_job(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION claim_next_job(
  worker_id TEXT,
  lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF jobs
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  lock_expires TIMESTAMPTZ := now_ts + (lease_seconds || ' seconds')::INTERVAL;
  job_record jobs%ROWTYPE;
  previous_worker TEXT;
BEGIN
  -- First, try to find and reclaim a RUNNING job with expired lock
  SELECT j.*
    INTO job_record
    FROM jobs j
   WHERE j.status = 'RUNNING'
     AND j.lock_expires_at < now_ts
     AND j.scheduled_at <= now_ts
     AND (j.attempt_count IS NULL OR j.attempt_count < j.max_attempts)
   ORDER BY j.priority DESC, j.created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- If found an expired RUNNING job, reclaim it
  IF FOUND THEN
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
    RETURN NEXT job_record;
    RETURN;
  END IF;

  -- If no expired RUNNING job found, look for a QUEUED job
  SELECT j.*
    INTO job_record
    FROM jobs j
   WHERE j.status = 'QUEUED'
     AND j.scheduled_at <= now_ts
     AND (j.lock_expires_at IS NULL OR j.lock_expires_at <= now_ts)
     AND (j.attempt_count IS NULL OR j.attempt_count < j.max_attempts)
   ORDER BY j.priority DESC, j.created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

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
  RETURN NEXT job_record;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_next_job(TEXT, INTEGER) TO authenticated, service_role;

