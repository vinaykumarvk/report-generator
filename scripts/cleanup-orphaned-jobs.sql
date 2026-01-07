-- Cleanup Orphaned Jobs
-- Jobs that reference deleted runs or section runs
-- 
-- After deleting failed/stuck runs, some jobs may still reference
-- those deleted runs. This script cleans them up.

-- ============================================
-- STEP 1: PREVIEW - See what will be deleted
-- ============================================

-- Orphaned jobs (run_id doesn't exist)
SELECT 
    'Orphaned by run_id' as category,
    COUNT(*) as count,
    array_agg(j.id ORDER BY j.created_at) as job_ids
FROM jobs j
WHERE j.run_id IS NOT NULL
  AND j.run_id NOT IN (SELECT id FROM report_runs);

-- Orphaned jobs (section_run_id doesn't exist)
SELECT 
    'Orphaned by section_run_id' as category,
    COUNT(*) as count,
    array_agg(j.id ORDER BY j.created_at) as job_ids
FROM jobs j
WHERE j.section_run_id IS NOT NULL
  AND j.section_run_id NOT IN (SELECT id FROM section_runs);

-- All orphaned jobs (either condition)
SELECT 
    j.id,
    j.type,
    j.status,
    j.run_id,
    j.section_run_id,
    j.created_at,
    CASE 
        WHEN j.run_id IS NOT NULL AND j.run_id NOT IN (SELECT id FROM report_runs) 
            THEN 'Orphaned by run_id'
        WHEN j.section_run_id IS NOT NULL AND j.section_run_id NOT IN (SELECT id FROM section_runs)
            THEN 'Orphaned by section_run_id'
        ELSE 'Valid'
    END as orphan_reason
FROM jobs j
WHERE (j.run_id IS NOT NULL AND j.run_id NOT IN (SELECT id FROM report_runs))
   OR (j.section_run_id IS NOT NULL AND j.section_run_id NOT IN (SELECT id FROM section_runs))
ORDER BY j.created_at DESC;

-- ============================================
-- STEP 2: ACTUAL DELETION
-- ============================================

BEGIN;

-- Delete orphaned jobs (jobs that reference deleted report_runs or section_runs)
DELETE FROM jobs
WHERE (run_id IS NOT NULL AND run_id NOT IN (SELECT id FROM report_runs))
   OR (section_run_id IS NOT NULL AND section_run_id NOT IN (SELECT id FROM section_runs));

-- Verify deletion
SELECT 
    'Remaining Orphaned Jobs' as category,
    COUNT(*) as count
FROM jobs
WHERE (run_id IS NOT NULL AND run_id NOT IN (SELECT id FROM report_runs))
   OR (section_run_id IS NOT NULL AND section_run_id NOT IN (SELECT id FROM section_runs));

-- Review the results above, then either:
-- COMMIT;  -- to finalize the deletion
-- ROLLBACK;  -- to undo if something looks wrong

