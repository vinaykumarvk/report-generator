-- Critical Performance Indexes Migration
-- This adds indexes to hot query paths to prevent performance degradation

-- ============================================================================
-- JOBS TABLE - Worker Polling (CRITICAL)
-- ============================================================================
-- Worker polls for PENDING jobs constantly (every 1s)
-- Without index, this does full table scan

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_created 
  ON jobs(status, created_at) 
  WHERE status IN ('PENDING', 'CLAIMED');

COMMENT ON INDEX idx_jobs_status_created IS 
  'Optimizes worker job polling. CRITICAL for performance.';

-- ============================================================================
-- REPORT_RUNS TABLE - User Queries
-- ============================================================================
-- Dashboard filters by workspace and status, sorts by created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_runs_workspace_status_created
  ON report_runs(workspace_id, status, created_at DESC);

COMMENT ON INDEX idx_report_runs_workspace_status_created IS 
  'Optimizes dashboard queries with search/filter/sort.';

-- Template lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_runs_template
  ON report_runs(template_id);

COMMENT ON INDEX idx_report_runs_template IS 
  'Optimizes reports grouped by template.';

-- ============================================================================
-- SECTION_RUNS TABLE - N+1 Query Prevention
-- ============================================================================
-- Run details page fetches all sections for a run
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_section_runs_report_run
  ON section_runs(report_run_id, created_at);

COMMENT ON INDEX idx_section_runs_report_run IS 
  'Prevents N+1 queries when loading run details.';

-- Section status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_section_runs_status
  ON section_runs(report_run_id, status);

COMMENT ON INDEX idx_section_runs_status IS 
  'Optimizes section status checks and filtering.';

-- ============================================================================
-- EXPORTS TABLE - Export Management
-- ============================================================================
-- Export listing and status checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exports_run_created
  ON exports(report_run_id, created_at DESC);

COMMENT ON INDEX idx_exports_run_created IS 
  'Optimizes export history display.';

-- Export status polling
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exports_status
  ON exports(status, created_at)
  WHERE status IN ('QUEUED', 'RUNNING');

COMMENT ON INDEX idx_exports_status IS 
  'Optimizes worker export job polling.';

-- ============================================================================
-- TEMPLATES TABLE - Template Management
-- ============================================================================
-- Template listing by workspace
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_workspace
  ON templates(workspace_id, created_at DESC);

COMMENT ON INDEX idx_templates_workspace IS 
  'Optimizes template studio listing.';

-- ============================================================================
-- TEMPLATE_SECTIONS TABLE - Section Lookups
-- ============================================================================
-- Fetching sections for a template
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_template_sections_template
  ON template_sections(template_id, order_index);

COMMENT ON INDEX idx_template_sections_template IS 
  'Optimizes section loading when creating runs.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify indexes are being used:

-- 1. Worker job polling (should use idx_jobs_status_created)
-- EXPLAIN ANALYZE 
-- SELECT * FROM jobs 
-- WHERE status = 'PENDING' 
-- ORDER BY created_at 
-- LIMIT 1;

-- 2. Dashboard query (should use idx_report_runs_workspace_status_created)
-- EXPLAIN ANALYZE 
-- SELECT * FROM report_runs 
-- WHERE workspace_id = 'xxx' 
-- AND status = 'COMPLETED'
-- ORDER BY created_at DESC;

-- 3. Run details (should use idx_section_runs_report_run)
-- EXPLAIN ANALYZE 
-- SELECT * FROM section_runs 
-- WHERE report_run_id = 'xxx';

-- ============================================================================
-- PERFORMANCE MONITORING
-- ============================================================================
-- Check index usage statistics
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- Check for missing indexes (queries doing sequential scans)
-- SELECT 
--   schemaname,
--   tablename,
--   seq_scan,
--   seq_tup_read,
--   idx_scan,
--   seq_tup_read / NULLIF(seq_scan, 0) as avg_seq_scan_size
-- FROM pg_stat_user_tables
-- WHERE schemaname = 'public'
-- ORDER BY seq_scan DESC;



