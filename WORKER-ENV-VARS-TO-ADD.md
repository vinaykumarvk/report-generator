# Environment Variables to Add to Worker Service

## Critical Missing Variables

Add these to the `report-generator-worker` service configuration:

### 1. SERVICE_MODE (CRITICAL - Missing!)
```
Name: SERVICE_MODE
Value: worker
```
**Why:** Without this, the service runs Next.js web app instead of worker code.

### 2. NODE_ENV
```
Name: NODE_ENV
Value: production
```
**Why:** Enables production optimizations.

### 3. DEFAULT_WORKSPACE_ID
```
Name: DEFAULT_WORKSPACE_ID
Value: c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
```
**Why:** Required for workspace filtering.

### 4. WORKER_POLLING_ENABLED (If using HTTP trigger mode)
```
Name: WORKER_POLLING_ENABLED
Value: true
```
**Why:** Since `JOB_TRIGGER_MODE=http`, you need this to enable polling as a fallback.

**OR** change `JOB_TRIGGER_MODE` to `db` to use polling by default.

---

## Current Configuration Analysis

### What You Have:
- ✅ `JOB_TRIGGER_MODE=http` - HTTP trigger mode
- ✅ `WORKER_TRIGGER_SECRET=01@Welcome` - Secret for HTTP triggers
- ✅ Supabase credentials
- ❌ **Missing `SERVICE_MODE=worker`** - **THIS IS THE PROBLEM**

### What Happens Now:
1. Service starts → runs `npm run start`
2. `scripts/start.js` checks `SERVICE_MODE`
3. `SERVICE_MODE` is undefined → defaults to `"web"`
4. Runs `next start` (web app) instead of `node workers/worker-with-health.js`
5. Worker never polls for jobs → jobs stuck in QUEUED

### What Should Happen:
1. Service starts → runs `npm run start`
2. `scripts/start.js` checks `SERVICE_MODE`
3. `SERVICE_MODE=worker` → runs `node workers/worker-with-health.js`
4. Worker starts polling loop (if `WORKER_POLLING_ENABLED=true` or `JOB_TRIGGER_MODE=db`)
5. Jobs get claimed and processed ✅

---

## Recommended Configuration

### Option 1: Database Polling (Simpler)
```
SERVICE_MODE=worker
NODE_ENV=production
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
JOB_TRIGGER_MODE=db
```

### Option 2: HTTP Trigger + Polling Fallback
```
SERVICE_MODE=worker
NODE_ENV=production
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_SECRET=01@Welcome
WORKER_POLLING_ENABLED=true
```

### Option 3: HTTP Trigger Only (Requires web service to send triggers)
```
SERVICE_MODE=worker
NODE_ENV=production
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_SECRET=01@Welcome
WORKER_TRIGGER_URL=https://report-generator-worker-47249889063.europe-west1.run.app/process-job
```

---

## Quick Fix Steps

1. **Click "Add variable"** in the Cloud Run UI
2. **Add these variables:**
   - `SERVICE_MODE` = `worker`
   - `NODE_ENV` = `production`
   - `DEFAULT_WORKSPACE_ID` = `c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`
   - `WORKER_POLLING_ENABLED` = `true` (if keeping HTTP mode)

3. **OR change `JOB_TRIGGER_MODE` to `db`** (simpler, no HTTP triggers needed)

4. **Click "Deploy"**

5. **Verify after deployment:**
   ```bash
   curl https://report-generator-worker-47249889063.europe-west1.run.app/health
   ```
   Should return JSON, not HTML 404.

---

## After Fix

Once `SERVICE_MODE=worker` is set:
- Worker will start polling for jobs
- Stuck jobs will be claimed and processed
- Health endpoint will return proper JSON response
- Jobs will start flowing through the system

