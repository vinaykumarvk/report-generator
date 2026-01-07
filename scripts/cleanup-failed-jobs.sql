-- Cleanup Failed Jobs
-- This script removes failed jobs that are no longer needed
-- 
-- Options:
-- 1. Delete failed jobs for COMPLETED runs (safe - runs are done)
-- 2. Delete failed jobs for FAILED runs (safe - runs are failed)
-- 3. Delete old GENERATE_TRANSITIONS jobs (safe - feature removed)
-- 4. Delete all failed jobs older than X days (configurable)

-- ============================================
-- STEP 1: PREVIEW - See what will be deleted
-- ============================================

-- Failed jobs by run status
SELECT 
    COALESCE(rr.status, 'RUN_DELETED') as run_status,
    j.type as job_type,
    COUNT(*) as count,
    MIN(j.created_at) as oldest,
    MAX(j.created_at) as newest
FROM jobs j
LEFT JOIN report_runs rr ON j.run_id = rr.id
WHERE j.status = 'FAILED'
GROUP BY COALESCE(rr.status, 'RUN_DELETED'), j.type
ORDER BY run_status, job_type;

-- Failed jobs for COMPLETED runs (safe to delete)
SELECT 
    COUNT(*) as count,
    array_agg(j.id ORDER BY j.created_at) as job_ids
FROM jobs j
INNER JOIN report_runs rr ON j.run_id = rr.id
WHERE j.status = 'FAILED'
  AND rr.status = 'COMPLETED';

-- Failed GENERATE_TRANSITIONS jobs (feature removed, safe to delete)
SELECT 
    COUNT(*) as count,
    array_agg(j.id ORDER BY j.created_at) as job_ids
FROM jobs j
WHERE j.status = 'FAILED'
  AND j.type = 'GENERATE_TRANSITIONS';

-- Failed jobs older than 7 days (configurable)
SELECT 
    COUNT(*) as count,
    array_agg(j.id ORDER BY j.created_at) as job_ids
FROM jobs j
WHERE j.status = 'FAILED'
  AND j.created_at < NOW() - INTERVAL '7 days';

-- ============================================
-- STEP 2: ACTUAL DELETION
-- Choose one or more of these options
-- ============================================

BEGIN;

-- Option 1: Delete failed jobs for COMPLETED runs (recommended)
-- These runs are done, failed jobs are just clutter
DELETE FROM jobs
WHERE status = 'FAILED'
  AND run_id IN (
    SELECT id FROM report_runs WHERE status = 'COMPLETED'
  );

-- Option 2: Delete failed GENERATE_TRANSITIONS jobs (recommended)
-- This feature was removed, these jobs will never succeed
DELETE FROM jobs
WHERE status = 'FAILED'
  AND type = 'GENERATE_TRANSITIONS';

-- Option 3: Delete failed jobs older than 7 days (optional)
-- Adjust the interval as needed
-- DELETE FROM jobs
-- WHERE status = 'FAILED'
--   AND created_at < NOW() - INTERVAL '7 days';

-- Option 4: Delete all failed jobs (use with caution)
-- Only use if you're sure you don't need to debug these failures
-- DELETE FROM jobs
-- WHERE status = 'FAILED';

-- Verify deletion
SELECT 
    'Remaining Failed Jobs' as category,
    COUNT(*) as count
FROM jobs
WHERE status = 'FAILED';

-- Review the results above, then either:
-- COMMIT;  -- to finalize the deletion
-- ROLLBACK;  -- to undo if something looks wrong

