# Deep Root Cause Analysis: Stuck Jobs

## Executive Summary

**Problem:** Jobs are stuck in QUEUED status and not being processed by workers.

**Status:** 🔴 CRITICAL - 6 jobs stuck, oldest 162 minutes old

**Root Cause:** Worker service is NOT running or NOT polling for jobs.

---

## Investigation Findings

### ✅ What's Working

1. **Database RPC Function** - `claim_next_job()` exists and works correctly
   - Successfully claimed a job during testing
   - Function signature correct
   - Atomic locking mechanism working

2. **Job Data Integrity** - All jobs are claimable
   - Status: QUEUED ✅
   - Scheduled time passed ✅
   - No expired locks ✅
   - Attempts within limits ✅

3. **Database Schema** - All required fields present
   - `scheduled_at`, `lock_expires_at`, `locked_by` all exist
   - Indexes in place

### ❌ What's Broken

1. **Worker Service Not Active**
   - 0 RUNNING jobs (except test claim)
   - 0 active worker processes
   - Last real worker activity: Unknown (possibly days/weeks ago)

2. **No Worker Polling**
   - Jobs are claimable but no worker is claiming them
   - Worker polling loop either:
     - Not started
     - Crashed
     - Disabled
     - Not deployed

---

## Root Cause Analysis

### Hypothesis 1: Worker Not Deployed ⚠️ HIGH PROBABILITY

**Evidence:**
- No worker activity in database
- Jobs piling up for hours/days
- No RUNNING jobs except test claims

**Verification:**
```bash
gcloud run services list --region=europe-west1
# Check if report-generator-worker exists and is running
```

**Fix:**
- Deploy worker service to Cloud Run
- Ensure `SERVICE_MODE=worker` is set
- Ensure `JOB_TRIGGER_MODE=db` or `WORKER_POLLING_ENABLED=true`

---

### Hypothesis 2: Worker Crashed on Startup ⚠️ MEDIUM PROBABILITY

**Evidence:**
- Worker might have started but crashed immediately
- No error logs visible (need to check Cloud Run logs)

**Possible Causes:**
1. Missing environment variables
2. Database connection failure
3. Code error in worker startup
4. Missing dependencies

**Verification:**
```bash
gcloud run services logs read report-generator-worker --region=europe-west1 --limit=50
```

**Fix:**
- Check Cloud Run logs for errors
- Verify all required env vars are set
- Test worker locally first

---

### Hypothesis 3: Worker in HTTP Mode Without Triggers ⚠️ MEDIUM PROBABILITY

**Evidence:**
- Worker might be deployed with `JOB_TRIGGER_MODE=http`
- Polling disabled (`pollingEnabled = false`)
- But web service not sending HTTP triggers

**Code Location:**
```javascript
// workers/worker-with-health.js:23-26
const triggerMode = String(process.env.JOB_TRIGGER_MODE || "db").toLowerCase();
const pollingEnabled = triggerMode === "db" || process.env.WORKER_POLLING_ENABLED === "true";
```

**Verification:**
```bash
# Check worker env vars
gcloud run services describe report-generator-worker --region=europe-west1 --format="value(spec.template.spec.containers[0].env)"
```

**Fix:**
- Set `JOB_TRIGGER_MODE=db` OR
- Set `WORKER_POLLING_ENABLED=true` OR
- Ensure web service sends HTTP triggers when jobs are created

---

### Hypothesis 4: Worker Polling Loop Crashed ⚠️ LOW PROBABILITY

**Evidence:**
- Worker started successfully
- Polling loop began
- But crashed during job processing
- Process exited

**Code Location:**
```javascript
// workers/worker-core.js:592-620
async function startPolling({ workerId }) {
  while (true) {
    try {
      const job = await claimNextJob(workerId);
      // ... process job
    } catch (err) {
      console.error("❌ Error in polling loop:", message);
      await sleep(5000); // Should continue, not exit
    }
  }
}
```

**Note:** The code has error handling that should prevent crashes, but unhandled promise rejections could still crash the process.

**Verification:**
- Check Cloud Run logs for unhandled errors
- Check if worker process is still running

**Fix:**
- Add unhandled rejection handler
- Add process exit handlers
- Improve error logging

---

## Recent Code Changes

### Relevant Commits:
1. `9677066` - "Fix report generation: blueprint storage, job claiming, and worker configuration"
2. `67a036f` - "http trigger"
3. `05e9d9c` - "feat: Add Cloud Tasks event-driven architecture"
4. `6e15163` - "Fix worker deployment for Cloud Run"

**Risk:** Recent changes to worker configuration might have broken deployment or startup.

---

## Diagnostic Steps

### Step 1: Check Worker Deployment Status
```bash
gcloud run services list --region=europe-west1 --filter="metadata.name:worker"
```

### Step 2: Check Worker Logs
```bash
gcloud run services logs read report-generator-worker \
  --region=europe-west1 \
  --limit=100
```

### Step 3: Check Worker Environment Variables
```bash
gcloud run services describe report-generator-worker \
  --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### Step 4: Test Worker Locally
```bash
cd /Users/n15318/report-generator
SERVICE_MODE=worker JOB_TRIGGER_MODE=db npm run worker:local
```

### Step 5: Check Worker Health Endpoint
```bash
curl https://report-generator-worker-XXX.run.app/health
```

---

## Immediate Actions Required

### Priority 1: Verify Worker Deployment
1. Check if worker service exists in Cloud Run
2. Check if it's running and healthy
3. Check recent logs for errors

### Priority 2: Fix Configuration
1. Ensure `JOB_TRIGGER_MODE=db` OR `WORKER_POLLING_ENABLED=true`
2. Ensure all required env vars are set
3. Redeploy if needed

### Priority 3: Test and Monitor
1. Deploy worker with correct config
2. Monitor logs for first few job claims
3. Verify jobs are being processed

---

## Long-Term Fixes

1. **Add Health Monitoring**
   - Worker should report last job processed time
   - Alert if no jobs processed in X minutes

2. **Improve Error Handling**
   - Catch all unhandled promise rejections
   - Add process exit handlers
   - Better logging

3. **Add Deployment Verification**
   - Script to verify worker is running after deploy
   - Test job claiming after deployment

4. **Documentation**
   - Clear deployment checklist
   - Troubleshooting guide
   - Environment variable reference

---

## Conclusion

**Most Likely Root Cause:** Worker service is either:
1. Not deployed to Cloud Run, OR
2. Deployed but crashed on startup, OR
3. Deployed but configured incorrectly (HTTP mode without triggers)

**Next Step:** Check Cloud Run deployment status and logs to confirm which scenario.

