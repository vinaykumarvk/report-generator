# Enable HTTP Trigger Mode - Cloud Shell Commands

## Quick Start: Copy & Paste These Commands

Since you have CI/CD, you don't need to clone the repo. Just run these commands directly in **Google Cloud Shell**.

---

## Step 1: Generate Secret

```bash
TRIGGER_SECRET=$(openssl rand -hex 32)
echo "Generated secret: ${TRIGGER_SECRET}"
echo ""
echo "⚠️  SAVE THIS SECRET - You'll need it if you need to update services later:"
echo "WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}"
```

---

## Step 2: Update Worker Service

```bash
gcloud run services update report-generator-worker \
  --region=europe-west1 \
  --project=wealth-report \
  --update-env-vars "WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}"
```

**Wait for:** "Service [report-generator-worker] revision [XXX] has been deployed and is serving 100 percent of traffic."

---

## Step 3: Update Web Service

```bash
gcloud run services update report-generator \
  --region=europe-west1 \
  --project=wealth-report \
  --update-env-vars "\
JOB_TRIGGER_MODE=http,\
WORKER_TRIGGER_URL=https://report-generator-worker-47249889063.europe-west1.run.app/process-job,\
WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}"
```

**Wait for:** "Service [report-generator] revision [XXX] has been deployed and is serving 100 percent of traffic."

---

## Step 4: Test Worker Health

```bash
curl https://report-generator-worker-47249889063.europe-west1.run.app/health | jq .
```

**Expected output:**
```json
{
  "status": "healthy",
  "service": "report-generator-worker",
  "triggerMode": "http",
  "pollingEnabled": true,
  "uptime": 123.45,
  "timestamp": "2025-12-31T12:00:00.000Z"
}
```

---

## Step 5: Test with a Report Run

1. **Open web app:**
   ```
   https://report-generator-47249889063.europe-west1.run.app
   ```

2. **Create a test report run**

3. **Check worker logs:**
   ```bash
   gcloud run services logs read report-generator-worker \
     --region=europe-west1 \
     --limit=50
   ```

4. **Look for:**
   ```
   📥 Received trigger for job: <job-id>
   ✅ Claimed job: <job-id> (START_RUN)
   ✅ Job processed: <job-id>
   ```

---

## Complete Script (All-in-One)

If you want to run everything at once, copy this entire block:

```bash
#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Enabling HTTP Trigger Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Generate secret
echo "Step 1: Generating trigger secret..."
TRIGGER_SECRET=$(openssl rand -hex 32)
echo "✅ Secret generated: ${TRIGGER_SECRET}"
echo ""

# Update worker
echo "Step 2: Updating worker service..."
gcloud run services update report-generator-worker \
  --region=europe-west1 \
  --project=wealth-report \
  --update-env-vars "WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}" \
  --quiet

echo "✅ Worker updated"
echo ""

# Update web
echo "Step 3: Updating web service..."
gcloud run services update report-generator \
  --region=europe-west1 \
  --project=wealth-report \
  --update-env-vars "\
JOB_TRIGGER_MODE=http,\
WORKER_TRIGGER_URL=https://report-generator-worker-47249889063.europe-west1.run.app/process-job,\
WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}" \
  --quiet

echo "✅ Web updated"
echo ""

# Test health
echo "Step 4: Testing worker health..."
sleep 5
curl -s https://report-generator-worker-47249889063.europe-west1.run.app/health | jq .
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ HTTP Trigger Mode Enabled!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💾 Save this secret:"
echo "   WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}"
echo ""
echo "🧪 Test it:"
echo "   1. Open: https://report-generator-47249889063.europe-west1.run.app"
echo "   2. Create a report run"
echo "   3. Check logs: gcloud run services logs read report-generator-worker --region europe-west1 --limit 50"
echo ""
```

---

## Rollback (if needed)

To revert to database polling:

```bash
gcloud run services update report-generator \
  --region=europe-west1 \
  --project=wealth-report \
  --update-env-vars "JOB_TRIGGER_MODE=db"
```

---

## Verify Configuration

Check what's currently set:

### Check Web Service
```bash
gcloud run services describe report-generator \
  --region=europe-west1 \
  --project=wealth-report \
  --format='value(spec.template.spec.containers[0].env)' | grep -E 'JOB_TRIGGER_MODE|WORKER_TRIGGER'
```

### Check Worker Service
```bash
gcloud run services describe report-generator-worker \
  --region=europe-west1 \
  --project=wealth-report \
  --format='value(spec.template.spec.containers[0].env)' | grep WORKER_TRIGGER_SECRET
```

---

## Troubleshooting

### Issue: "Permission denied"

**Solution:**
```bash
# Check your permissions
gcloud projects get-iam-policy wealth-report --flatten="bindings[].members" --filter="bindings.members:user:$(gcloud config get-value account)"

# You need at least: roles/run.admin
```

### Issue: Services not updating

**Solution:**
```bash
# Check service status
gcloud run services list --region=europe-west1

# Force new revision
gcloud run services update report-generator \
  --region=europe-west1 \
  --no-traffic  # Deploy without switching traffic
```

### Issue: Health check fails

**Solution:**
```bash
# Check worker logs
gcloud run services logs read report-generator-worker \
  --region=europe-west1 \
  --limit=100

# Check if worker is running
gcloud run services describe report-generator-worker \
  --region=europe-west1 \
  --format='value(status.conditions)'
```

---

## What These Commands Do

### Worker Service Update
- Adds `WORKER_TRIGGER_SECRET` for validating incoming triggers
- Worker validates `x-worker-trigger` header matches this secret

### Web Service Update
- Sets `JOB_TRIGGER_MODE=http` to enable HTTP triggering
- Sets `WORKER_TRIGGER_URL` to worker's `/process-job` endpoint
- Sets `WORKER_TRIGGER_SECRET` to authenticate with worker

### Result
- When a job is created, web service sends HTTP POST to worker
- Worker receives trigger and processes job immediately
- Worker still polls database as fallback (safety net)

---

## Expected Timeline

- **Step 1 (Generate secret):** Instant
- **Step 2 (Update worker):** ~1-2 minutes
- **Step 3 (Update web):** ~1-2 minutes
- **Step 4 (Test health):** Instant
- **Total:** ~3-5 minutes

---

## Success Criteria

✅ Worker health check returns `"status": "healthy"`  
✅ Worker health shows `"triggerMode": "http"`  
✅ Test report run processes within 1 second  
✅ Worker logs show "Received trigger for job"  
✅ No jobs stuck in QUEUED status  

---

**Last Updated:** 2025-12-31



