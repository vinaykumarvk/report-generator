# Worker Deployment Fix - Root Cause Found

## 🔴 CRITICAL ISSUE

**Problem:** Worker service is running Next.js web app instead of worker code.

**Evidence:**
- Health endpoint `/health` returns Next.js 404 page
- Worker should return JSON: `{"status": "healthy", "service": "report-generator-worker", ...}`
- Instead returns HTML 404 page from Next.js

**Root Cause:** `SERVICE_MODE=worker` is either:
1. Not set in Cloud Run environment variables, OR
2. Not being read correctly by `scripts/start.js`

---

## ✅ Solution

### Step 1: Verify Current Configuration

Check if `SERVICE_MODE` is set in the worker deployment:

```bash
gcloud run services describe report-generator-worker \
  --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"
```

Look for `SERVICE_MODE=worker` in the output.

### Step 2: Fix the Deployment

If `SERVICE_MODE` is missing or incorrect, update it:

```bash
gcloud run services update report-generator-worker \
  --region=europe-west1 \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4,JOB_TRIGGER_MODE=db"
```

**Critical Variables:**
- `SERVICE_MODE=worker` - **MUST BE SET** or worker won't start
- `JOB_TRIGGER_MODE=db` - Enables database polling (default, but explicit is better)
- `DEFAULT_WORKSPACE_ID` - Required for workspace filtering

### Step 3: Verify Fix

After updating, check the health endpoint:

```bash
curl https://report-generator-worker-47249889063.europe-west1.run.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "report-generator-worker",
  "triggerMode": "db",
  "pollingEnabled": true,
  "uptime": 123.45,
  "timestamp": "2026-01-06T20:30:00.000Z"
}
```

**If you still get 404:** The service needs to be redeployed or restarted.

### Step 4: Restart the Service

If environment variables were updated, restart the service:

```bash
gcloud run services update report-generator-worker \
  --region=europe-west1 \
  --update-env-vars "SERVICE_MODE=worker"
```

Or trigger a new revision:

```bash
gcloud run services update report-generator-worker \
  --region=europe-west1 \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production"
```

---

## How It Works

### Startup Flow

1. **Dockerfile** runs: `CMD ["npm", "run", "start"]`
2. **package.json** script: `"start": "node scripts/start.js"`
3. **scripts/start.js** checks: `process.env.SERVICE_MODE`
   - If `SERVICE_MODE === "worker"` → runs `node workers/worker-with-health.js`
   - Otherwise → runs `next start` (web app)

### Worker Code

`workers/worker-with-health.js`:
- Creates HTTP server on port 8080
- Handles `/health` endpoint (returns JSON)
- Handles `/process-job` endpoint (for HTTP triggers)
- Starts polling loop if `JOB_TRIGGER_MODE=db`

---

## Verification Checklist

After fixing, verify:

- [ ] Health endpoint returns JSON (not HTML 404)
- [ ] Health response shows `"service": "report-generator-worker"`
- [ ] Health response shows `"pollingEnabled": true`
- [ ] Worker logs show: `"🚀 Starting worker polling loop..."`
- [ ] Jobs start being claimed and processed
- [ ] No more stuck QUEUED jobs

---

## Why This Happened

Most likely causes:
1. **Deployment script didn't set SERVICE_MODE**
2. **Environment variable was removed/overwritten**
3. **Deployment used wrong service name/config**
4. **Cloud Run cached old configuration**

---

## Prevention

1. **Always verify SERVICE_MODE after deployment:**
   ```bash
   gcloud run services describe report-generator-worker \
     --region=europe-west1 \
     --format="value(spec.template.spec.containers[0].env)" | grep SERVICE_MODE
   ```

2. **Use deployment scripts** that explicitly set all required variables

3. **Add health check validation** in CI/CD pipeline

4. **Monitor worker logs** for startup messages

---

## Quick Fix Command

```bash
# One command to fix everything
gcloud run services update report-generator-worker \
  --region=europe-west1 \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4,JOB_TRIGGER_MODE=db" \
  --set-secrets "NEXT_PUBLIC_SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

Then verify:
```bash
curl https://report-generator-worker-47249889063.europe-west1.run.app/health
```

