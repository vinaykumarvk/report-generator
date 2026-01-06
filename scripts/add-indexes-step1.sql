-- Critical Performance Indexes Migration
-- This adds indexes to hot query paths to prevent performance degradation
--
-- IMPORTANT: Run each CREATE INDEX statement SEPARATELY in Supabase SQL Editor
-- Do NOT select all and run at once - run one at a time

-- ============================================================================
-- JOBS TABLE - Worker Polling (CRITICAL)
-- ============================================================================
-- Worker polls for PENDING jobs constantly (every 1s)
-- Without index, this does full table scan

-- RUN THIS FIRST (separately)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_created 
  ON jobs(status, created_at) 
  WHERE status IN ('PENDING', 'CLAIMED');

-- Then verify it worked:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_jobs_status_created';



