# Comprehensive Fix for claim_next_job Function

## Problem

The `claim_next_job` RPC function had a critical design flaw:
- It only searched for `QUEUED` jobs
- It did NOT handle `RUNNING` jobs with expired locks
- When a worker crashed/stalled, jobs remained `RUNNING` forever
- These jobs could never be reclaimed automatically

## Root Cause

1. Worker claims job → status becomes `RUNNING`, lock set
2. Worker crashes/stops → job remains `RUNNING`
3. Lock expires → job still `RUNNING` (not reset to `QUEUED`)
4. `claim_next_job` runs → only searches `QUEUED`, never finds the stuck job
5. Job is permanently stuck until manually reset

## Solution

A comprehensive fix that implements all recommended improvements:

### 1. Enhanced claim_next_job Function

**Key Improvements:**
- ✅ Atomically handles both `QUEUED` jobs AND `RUNNING` jobs with expired locks
- ✅ Prevents race conditions using `FOR UPDATE SKIP LOCKED`
- ✅ Caps retries: Marks jobs as `FAILED` when `max_attempts` exceeded
- ✅ Includes `scheduled_at` check: Doesn't reclaim intentionally delayed jobs
- ✅ Emits audit events: Tracks when jobs are reclaimed
- ✅ Emits run events: Notifies the system when jobs are reclaimed

**How it works:**
1. First, tries to find and reclaim a `RUNNING` job with expired lock
2. If found, checks if `max_attempts` exceeded → marks `FAILED` if so
3. Otherwise, reclaims it (resets lock, increments attempt count)
4. If no expired `RUNNING` job found, looks for a `QUEUED` job
5. All operations are atomic (single transaction)

### 2. Periodic Reaper Function (Safety Net)

**Function:** `reap_expired_jobs(max_age_minutes)`

**Purpose:**
- Safety net for any stuck jobs that `claim_next_job` might miss
- Can be called periodically (via cron, scheduled job, or manually)
- Cleans up jobs older than specified threshold

**How it works:**
1. Finds `RUNNING` jobs with expired locks older than threshold
2. For each job:
   - If `max_attempts` exceeded → marks `FAILED`
   - Otherwise → resets to `QUEUED` for reclaim
3. Emits audit events for all actions
4. Returns summary of actions taken

### 3. Performance Index

Added index `idx_jobs_expired_running` to speed up queries for expired `RUNNING` jobs.

## Files

1. **`scripts/fix-claim-next-job-comprehensive-clean.sql`**
   - Main migration script with enhanced `claim_next_job` function
   - Reaper function
   - Index creation
   - Grant permissions

2. **`scripts/setup-reaper-cron.sql`**
   - Optional: Sets up PostgreSQL cron job (requires `pg_cron` extension)
   - Alternative: Use external cron or call manually

3. **`scripts/reap-expired-jobs.js`**
   - Standalone Node.js script to run the reaper
   - Can be called via external cron, Cloud Scheduler, etc.

## Installation

### Step 1: Run the Migration

```sql
-- Run in Supabase SQL Editor or via psql
\i scripts/fix-claim-next-job-comprehensive-clean.sql
```

Or copy-paste the SQL from `scripts/fix-claim-next-job-comprehensive-clean.sql` into your Supabase SQL Editor.

### Step 2: (Optional) Set Up Periodic Reaper

**Option A: Using PostgreSQL cron (if pg_cron extension available)**
```sql
\i scripts/setup-reaper-cron.sql
```

**Option B: Using external cron**
```bash
# Add to crontab (runs every 5 minutes)
*/5 * * * * cd /path/to/report-generator && node scripts/reap-expired-jobs.js
```

**Option C: Using Cloud Scheduler (Google Cloud)**
- Create a Cloud Scheduler job that calls an API endpoint
- The endpoint should call `reap_expired_jobs()` RPC function

**Option D: Manual execution**
```bash
node scripts/reap-expired-jobs.js
```

## Verification

### Test 1: Verify Function Exists
```sql
SELECT proname, prosrc FROM pg_proc WHERE proname = 'claim_next_job';
```

### Test 2: Test Claiming a Job
```sql
SELECT * FROM claim_next_job('test-worker-1', 300);
```

### Test 3: Test Reaper Function
```sql
SELECT * FROM reap_expired_jobs(60);
```

### Test 4: Check for Stuck Jobs
```sql
SELECT id, type, status, locked_by, lock_expires_at, updated_at
FROM jobs
WHERE status = 'RUNNING' AND lock_expires_at < NOW()
ORDER BY updated_at ASC;
```

## Benefits

1. **Automatic Recovery**: Stuck jobs are automatically reclaimed
2. **No Manual Intervention**: System self-heals from worker crashes
3. **Audit Trail**: All reclaims are logged for debugging
4. **Retry Limits**: Jobs that fail repeatedly are marked `FAILED` instead of retrying forever
5. **Performance**: Index speeds up queries for expired jobs
6. **Safety Net**: Reaper function catches any edge cases

## Migration Notes

- **Backward Compatible**: Existing workers will continue to work
- **No Data Loss**: All existing jobs remain intact
- **Atomic Operations**: All changes are transactional
- **Zero Downtime**: Can be applied while system is running

## Monitoring

After deployment, monitor:
1. Audit logs for `JOB_RECLAIMED` events
2. Audit logs for `JOB_FAILED_MAX_ATTEMPTS` events
3. Number of stuck jobs (should decrease to zero)
4. Worker job processing rates (should improve)

## Rollback

If needed, you can rollback by restoring the original `claim_next_job` function from `scripts/supabase_schema.sql`. However, this is not recommended as it reintroduces the original bug.

