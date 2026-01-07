-- Delete Stuck Reports (0 sections) and Failed Reports
-- This script identifies and deletes:
-- 1. Reports with 0 sections (stuck reports)
-- 2. Reports with status = 'FAILED'
--
-- Related data will be automatically deleted via CASCADE:
-- - section_runs, evidence_bundles, section_artifacts, section_scores
-- - exports, run_events, dependency_snapshots

-- ============================================
-- STEP 1: PREVIEW - See what will be deleted
-- ============================================

-- Reports with 0 sections
SELECT 
    'Reports with 0 sections' as category,
    COUNT(*) as count,
    array_agg(rr.id ORDER BY rr.created_at) as report_ids
FROM report_runs rr
LEFT JOIN section_runs sr ON rr.id = sr.report_run_id
WHERE sr.id IS NULL;

-- Reports with FAILED status
SELECT 
    'Reports with FAILED status' as category,
    COUNT(*) as count,
    array_agg(id ORDER BY created_at) as report_ids
FROM report_runs
WHERE status = 'FAILED';

-- Combined detailed list of reports to be deleted
SELECT 
    rr.id,
    rr.status,
    rr.created_at,
    COUNT(sr.id) as section_count,
    CASE 
        WHEN COUNT(sr.id) = 0 AND rr.status = 'FAILED' THEN 'No sections + Failed'
        WHEN COUNT(sr.id) = 0 THEN 'No sections'
        WHEN rr.status = 'FAILED' THEN 'Failed status'
        ELSE 'Other'
    END as deletion_reason
FROM report_runs rr
LEFT JOIN section_runs sr ON rr.id = sr.report_run_id
WHERE (sr.id IS NULL OR rr.status = 'FAILED')
GROUP BY rr.id, rr.status, rr.created_at
ORDER BY rr.created_at DESC;

-- ============================================
-- STEP 2: ACTUAL DELETION
-- Run this in a transaction for safety
-- ============================================

BEGIN;

-- Delete reports with 0 sections OR status = 'FAILED'
-- This single query handles both cases efficiently
DELETE FROM report_runs
WHERE id IN (
    SELECT DISTINCT rr.id
    FROM report_runs rr
    LEFT JOIN section_runs sr ON rr.id = sr.report_run_id
    WHERE sr.id IS NULL  -- No sections
       OR rr.status = 'FAILED'  -- Failed status
);

-- Clean up orphaned jobs (jobs that reference deleted report_runs or section_runs)
-- Note: jobs table doesn't have foreign key constraints with CASCADE, so we clean these manually
DELETE FROM jobs
WHERE (run_id IS NOT NULL AND run_id NOT IN (SELECT id FROM report_runs))
   OR (section_run_id IS NOT NULL AND section_run_id NOT IN (SELECT id FROM section_runs));

-- Verify deletion
SELECT 
    'Deletion Summary' as category,
    COUNT(*) as total_reports_remaining,
    COUNT(CASE WHEN subq.status = 'FAILED' THEN 1 END) as failed_reports_remaining,
    COUNT(CASE WHEN subq.section_count = 0 THEN 1 END) as reports_with_zero_sections_remaining
FROM (
    SELECT 
        rr.id,
        rr.status,
        COUNT(sr.id) as section_count
    FROM report_runs rr
    LEFT JOIN section_runs sr ON rr.id = sr.report_run_id
    GROUP BY rr.id, rr.status
) subq;

-- Review the results above, then either:
-- COMMIT;  -- to finalize the deletion
-- ROLLBACK;  -- to undo if something looks wrong

