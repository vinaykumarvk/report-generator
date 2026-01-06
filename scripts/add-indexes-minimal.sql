-- Critical Performance Indexes - MINIMAL VERSION
-- This version only creates indexes on columns we know exist
-- Safe for any schema

BEGIN;

-- ============================================================================
-- JOBS TABLE - Worker Polling (CRITICAL)
-- ============================================================================
-- This is the most important index - worker polls constantly
CREATE INDEX IF NOT EXISTS idx_jobs_status_created 
  ON jobs(status, created_at);

-- ============================================================================
-- REPORT_RUNS TABLE
-- ============================================================================
-- Dashboard queries
CREATE INDEX IF NOT EXISTS idx_report_runs_workspace_created
  ON report_runs(workspace_id, created_at DESC);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_report_runs_status
  ON report_runs(status);

-- Template lookup
CREATE INDEX IF NOT EXISTS idx_report_runs_template
  ON report_runs(template_id);

-- ============================================================================
-- SECTION_RUNS TABLE
-- ============================================================================
-- Run details page
CREATE INDEX IF NOT EXISTS idx_section_runs_report_run
  ON section_runs(report_run_id);

-- ============================================================================
-- EXPORTS TABLE
-- ============================================================================
-- Export listing
CREATE INDEX IF NOT EXISTS idx_exports_report_run
  ON exports(report_run_id);

-- ============================================================================
-- TEMPLATES TABLE
-- ============================================================================
-- Template listing
CREATE INDEX IF NOT EXISTS idx_templates_workspace
  ON templates(workspace_id);

-- ============================================================================
-- TEMPLATE_SECTIONS TABLE
-- ============================================================================
-- Section lookup
CREATE INDEX IF NOT EXISTS idx_template_sections_template
  ON template_sections(template_id);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify all indexes were created:
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;



