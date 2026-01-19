# Root Cause Analysis: Recurring Export Failure

## Issue Summary

Export jobs remain in `QUEUED` status and are never processed by workers, preventing users from downloading `.md` and `.pdf` exports.

## Error Message

```
Could not find the function public.claim_next_job(lease_seconds) in the schema cache
```

## Root Cause

### Primary Issue: Database Function Signature Mismatch

**The Problem:**
1. **Code expects:** `claim_next_job(worker_id TEXT, lease_seconds INTEGER)`
   - Location: `src/lib/dbqueue.js:107-110`
   ```javascript
   await supabase.rpc("claim_next_job", {
     worker_id: workerId,
     lease_seconds: LOCK_SECONDS,
   });
   ```

2. **Database has:** The function either:
   - Doesn't exist in the database
   - Has a different signature (e.g., only `lease_seconds` parameter)
   - Was created incorrectly or dropped

3. **Supabase error interpretation:** The error message suggests Supabase is finding a function with signature `claim_next_job(lease_seconds)` (single parameter), but the code is calling it with two parameters.

### Why This Is Recurring

1. **Database migrations not applied:** The `claim_next_job` function may not have been created in the production/staging database, or was dropped during a migration.

2. **Multiple migration scripts:** There are multiple SQL scripts that define this function:
   - `scripts/fix-claim-next-job-comprehensive-clean.sql` (recommended - comprehensive version)
   - `scripts/update-claim-job-by-id-function.sql` (for claiming specific jobs by ID)
   - `scripts/supabase_schema.sql` (placeholder - not for production use)

3. **No verification step:** There's no automated check to verify the function exists with the correct signature after deployment.

4. **Worker silently fails:** When `claimNextJob()` throws an error, the worker catches it but doesn't process jobs, leaving them stuck in `QUEUED` status.

## Impact

- **Export jobs never processed:** All export jobs remain `QUEUED` indefinitely
- **User experience:** Users cannot download exports even though reports are completed
- **No error visibility:** The error only appears in worker logs, not in the UI
- **Manual workaround required:** Exports must be processed manually using scripts

## Evidence

1. **Export jobs stuck in QUEUED:**
   ```
   Job Status: QUEUED
   Attempts: 0/3
   Error: Could not find the function public.claim_next_job(lease_seconds) in the schema cache
   ```

2. **Workers running but not processing:**
   - Workers are active and polling
   - But `claimNextJob()` fails immediately
   - Jobs never get claimed

3. **Manual processing works:**
   - When exports are processed directly (bypassing `claimNextJob`), they complete successfully
   - This confirms the export logic itself is correct

4. **Current status (after fix):**
   - Function verification shows `claim_next_job` exists and is callable ✅
   - Exports were manually processed and are now READY
   - This confirms the function was missing or had wrong signature earlier

## Solution

### Immediate Fix

1. **Verify function exists:**
   ```sql
   SELECT proname, pg_get_function_arguments(oid) 
   FROM pg_proc 
   WHERE proname = 'claim_next_job';
   ```

2. **Create/update function if missing:**
   - Run `scripts/fix-claim-next-job-comprehensive-clean.sql`
   - This creates the function with correct signature: `claim_next_job(worker_id TEXT, lease_seconds INTEGER)`

3. **Grant permissions:**
   ```sql
   GRANT EXECUTE ON FUNCTION claim_next_job(TEXT, INTEGER) TO authenticated, service_role;
   ```

### Long-term Prevention

1. **Add function verification to deployment:**
   - Create a deployment script that verifies the function exists before starting workers
   - Fail fast if function is missing

2. **Consolidate migration scripts:**
   - Remove duplicate/conflicting SQL scripts
   - Use a single source of truth for the function definition

3. **Add health check:**
   - Workers should check if `claim_next_job` is callable on startup
   - Log error and exit if function is missing

4. **Better error handling:**
   - Surface database function errors in the UI
   - Alert when jobs are stuck in QUEUED for too long

## Related Files

- `src/lib/dbqueue.js` - Calls `claim_next_job` RPC
- `workers/worker-core.js` - Uses `claimNextJob()` to get jobs
- `scripts/fix-claim-next-job-comprehensive-clean.sql` - Function definition
- `scripts/process-export-direct.js` - Manual workaround script

## Prevention Checklist

- [x] Verify `claim_next_job` function exists in all environments (use `scripts/verify-db-functions.js`)
- [x] Add function verification to deployment pipeline (`scripts/ci-verify-db.js`)
- [x] Consolidate duplicate SQL migration scripts (removed redundant scripts)
- [x] Add worker startup health check for database functions (`workers/worker-with-health.js`)
- [x] Add monitoring/alerting for stuck QUEUED jobs (`/queue-health` endpoint)
- [ ] Document database function dependencies

## Prevention Safeguards Implemented

### 1. Schema Integrity (CI/Deploy)

Run `scripts/ci-verify-db.js` in your CI/CD pipeline before deploying:
```bash
node scripts/ci-verify-db.js
```
- Verifies all required database functions exist
- Exits with code 1 if any critical function is missing
- Blocks deployment to prevent jobs from queueing forever

### 2. Worker Startup Checks

The worker (`workers/worker-with-health.js`) now:
- Verifies database functions on startup
- **Hard-fails** and exits if critical functions are missing
- Prevents silent failures where jobs queue forever

### 3. Operational Monitoring

New `/queue-health` endpoint detects stuck jobs:
```bash
curl http://localhost:8080/queue-health
```

Response:
```json
{
  "healthy": true,
  "totalQueued": 0,
  "totalRunning": 0,
  "stuckCount": 0,
  "stuckThresholdMinutes": 30,
  "stuckJobs": []
}
```

Returns HTTP 503 if jobs are stuck > 30 minutes (configurable via `QUEUE_STUCK_THRESHOLD_MINUTES`).

### 4. Verification Scripts

**Quick verification:**
```bash
node scripts/verify-db-functions.js
```

**CI/Deploy verification:**
```bash
node scripts/ci-verify-db.js
```

Both scripts:
- Test if `claim_next_job` is callable with correct parameters
- Exit with error code if functions are missing
- Provide instructions to fix missing functions

## Related Files

- `src/lib/dbqueue.js` - Calls `claim_next_job` RPC
- `workers/worker-core.js` - Uses `claimNextJob()` to get jobs
- `workers/worker-with-health.js` - Startup verification + health endpoints
- `scripts/fix-claim-next-job-comprehensive-clean.sql` - Function definition
- `scripts/ci-verify-db.js` - CI/deploy verification script
- `scripts/verify-db-functions.js` - Quick verification script
- `scripts/process-export-direct.js` - Manual workaround script
