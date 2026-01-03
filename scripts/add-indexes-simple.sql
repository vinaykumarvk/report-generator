-- Critical Performance Indexes Migration (NON-CONCURRENT VERSION)
-- This version can be run all at once in a single transaction
-- Use this if you're okay with brief table locks during index creation

-- IMPORTANT: This will lock tables briefly during index creation
-- For production with active traffic, use the step-by-step files instead

BEGIN;

-- ============================================================================
-- JOBS TABLE - Worker Polling (CRITICAL)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_jobs_status_created 
  ON jobs(status, created_at) 
  WHERE status IN ('PENDING', 'CLAIMED');

-- ============================================================================
-- REPORT_RUNS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_report_runs_workspace_status_created
  ON report_runs(workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_runs_template
  ON report_runs(template_id);

-- ============================================================================
-- SECTION_RUNS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_section_runs_report_run
  ON section_runs(report_run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_section_runs_status
  ON section_runs(report_run_id, status);

-- ============================================================================
-- EXPORTS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_exports_run_created
  ON exports(report_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exports_status
  ON exports(status, created_at)
  WHERE status IN ('QUEUED', 'RUNNING');

-- ============================================================================
-- TEMPLATES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_templates_workspace
  ON templates(workspace_id, created_at DESC);

-- ============================================================================
-- TEMPLATE_SECTIONS TABLE
-- ============================================================================
-- Note: order_index column may not exist in your schema
-- Uncomment if you have this column:
-- CREATE INDEX IF NOT EXISTS idx_template_sections_template
--   ON template_sections(template_id, order_index);

-- Basic index on template_id only
CREATE INDEX IF NOT EXISTS idx_template_sections_template
  ON template_sections(template_id);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify all indexes were created:
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

