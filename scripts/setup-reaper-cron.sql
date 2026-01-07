-- ============================================================================
-- Setup Periodic Reaper Job (Optional)
-- 
-- This sets up a PostgreSQL cron job to run the reaper function periodically.
-- Requires pg_cron extension to be installed.
-- 
-- Note: This is optional. You can also call reap_expired_jobs() manually
-- or via an external cron job that calls a database function.
-- ============================================================================

-- Check if pg_cron extension is available
-- If not available, you'll need to install it or use an external cron job

-- Uncomment the following if pg_cron is installed:
/*
-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule reaper to run every 5 minutes
SELECT cron.schedule(
  'reap-expired-jobs',
  '*/5 * * * *',  -- Every 5 minutes
  $$SELECT * FROM reap_expired_jobs(60)$$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('reap-expired-jobs');
*/

-- Alternative: If pg_cron is not available, you can:
-- 1. Create a simple API endpoint that calls reap_expired_jobs()
-- 2. Set up an external cron job (crontab, Cloud Scheduler, etc.) to call that endpoint
-- 3. Or call it manually when needed

