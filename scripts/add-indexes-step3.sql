-- Step 3: Section Runs Indexes

-- RUN THIS THIRD (separately)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_section_runs_report_run
  ON section_runs(report_run_id, created_at);

-- Verify:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_section_runs_report_run';

