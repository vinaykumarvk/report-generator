-- Step 2: Report Runs Indexes

-- RUN THIS SECOND (separately)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_runs_workspace_status_created
  ON report_runs(workspace_id, status, created_at DESC);

-- Verify:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_report_runs_workspace_status_created';




