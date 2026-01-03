-- Step 4: Exports and Templates Indexes

-- RUN THIS FOURTH (separately)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exports_run_created
  ON exports(report_run_id, created_at DESC);

-- Verify:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_exports_run_created';

