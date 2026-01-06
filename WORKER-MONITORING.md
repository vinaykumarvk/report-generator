# Worker Service Monitoring Guide

## Quick Check: Is the Worker Running?

### Method 1: Use the Check Script (Recommended)

```bash
./scripts/check-worker-status.sh
```

This script will:
- ✅ Check if worker service is deployed
- ✅ Show service configuration
- ✅ Display environment variables
- ✅ Show recent logs
- ✅ Test health endpoint
- ✅ Check for job processing activity

---

## Manual Checks

### 1. List All Services

```bash
gcloud run services list --region europe-west1
```

Look for `report-generator-worker` in the list.

**Expected output:**
```
SERVICE                      REGION          URL
report-generator            europe-west1    https://report-generator-...
report-generator-worker     europe-west1    https://report-generator-worker-...
```

If you only see `report-generator` (web service), the worker is NOT deployed.

---

### 2. Check Worker Service Details

```bash
gcloud run services describe report-generator-worker --region europe-west1
```

**Key things to check:**
- `status.conditions[0].status: "True"` - Service is ready
- `spec.template.metadata.annotations['autoscaling.knative.dev/minScale']: "1"` - Always running
- `spec.template.spec.containers[0].env` - Contains `SERVICE_MODE=worker`

---

### 3. View Worker Logs

#### Recent Logs (last 50 lines)
```bash
gcloud run services logs read report-generator-worker --region europe-west1 --limit 50
```

#### Follow Logs in Real-Time
```bash
gcloud run services logs read report-generator-worker --region europe-west1 --follow
```

#### Filter Logs
```bash
# Only show errors
gcloud run services logs read report-generator-worker --region europe-west1 --log-filter="severity>=ERROR"

# Show job processing logs
gcloud run services logs read report-generator-worker --region europe-west1 --log-filter="textPayload=~'Processing job'"
```

**What to look for in logs:**
- ✅ `🚀 Starting in WORKER mode...` - Worker started
- ✅ `✅ Health check server listening on port 8080` - Health endpoint running
- ✅ `Worker process is running in the background` - Background worker active
- ✅ `Processing job: <job-id>` - Jobs being processed
- ✅ `Job <job-id> completed successfully` - Jobs completing
- ❌ `Error:` or `Failed:` - Problems to investigate

---

### 4. Check Worker Health Endpoint

```bash
# Get worker URL
WORKER_URL=$(gcloud run services describe report-generator-worker --region europe-west1 --format='value(status.url)')

# Test health endpoint (requires authentication)
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" $WORKER_URL/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "report-generator-worker",
  "uptime": 123.45,
  "timestamp": "2025-12-30T18:30:00.000Z"
}
```

---

### 5. Check Environment Variables

```bash
gcloud run services describe report-generator-worker --region europe-west1 --format="value(spec.template.spec.containers[0].env)"
```

**Must have:**
- `SERVICE_MODE: worker` ⬅️ **Critical!**
- `NODE_ENV: production`
- `DEFAULT_WORKSPACE_ID: c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`

**Should have (via secrets):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

---

### 6. Check Worker Metrics (Cloud Console)

Visit: https://console.cloud.google.com/run/detail/europe-west1/report-generator-worker/metrics

**Key metrics:**
- **Request count**: Should be steady (health checks)
- **Container instance count**: Should be 1 (always running)
- **CPU utilization**: Spikes when processing jobs
- **Memory utilization**: Monitor for memory leaks

---

## Troubleshooting

### Worker Not Deployed

**Symptom:** `gcloud run services list` doesn't show `report-generator-worker`

**Solution:**
```bash
./deploy-worker.sh
```

---

### Worker Deployed but Not Processing Jobs

**Check 1: Is SERVICE_MODE set correctly?**
```bash
gcloud run services describe report-generator-worker --region europe-west1 --format="value(spec.template.spec.containers[0].env)" | grep SERVICE_MODE
```

Should show: `name: SERVICE_MODE, value: worker`

**If wrong or missing:**
```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --set-env-vars "SERVICE_MODE=worker"
```

---

**Check 2: Are there any errors in logs?**
```bash
gcloud run services logs read report-generator-worker --region europe-west1 --log-filter="severity>=ERROR" --limit 50
```

Common errors:
- **Database connection failed**: Check Supabase credentials
- **OpenAI API error**: Check `OPENAI_API_KEY`
- **Job processing timeout**: Increase `--timeout` setting

---

**Check 3: Is the worker actually running?**
```bash
# Look for startup messages
gcloud run services logs read report-generator-worker --region europe-west1 --limit 100 | grep "Starting in WORKER mode"
```

If no startup message, the worker might be crashing. Check logs for errors.

---

### Worker Keeps Restarting

**Check logs for crash reason:**
```bash
gcloud run services logs read report-generator-worker --region europe-west1 --limit 100
```

**Common causes:**
- Missing environment variables
- Database connection issues
- Out of memory (increase `--memory`)
- Timeout issues (increase `--timeout`)

**Fix memory issues:**
```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --memory 2Gi
```

---

### Jobs Still Stuck in QUEUED

**Verify worker is processing:**
```bash
# Create a test job, then check logs
gcloud run services logs read report-generator-worker --region europe-west1 --follow
```

**Check database directly:**
```sql
-- In Supabase SQL Editor
SELECT id, type, status, created_at, updated_at
FROM jobs
ORDER BY created_at DESC
LIMIT 10;
```

**If jobs are created but not picked up:**
1. Check worker logs for errors
2. Verify `DEFAULT_WORKSPACE_ID` matches your workspace
3. Check database connectivity
4. Restart worker service:
   ```bash
   gcloud run services update report-generator-worker --region europe-west1 --no-traffic
   gcloud run services update report-generator-worker --region europe-west1 --traffic=latest=100
   ```

---

## Monitoring Commands Cheat Sheet

```bash
# Quick status check
./scripts/check-worker-status.sh

# List services
gcloud run services list --region europe-west1

# View recent logs
gcloud run services logs read report-generator-worker --region europe-west1 --limit 50

# Follow logs in real-time
gcloud run services logs read report-generator-worker --region europe-west1 --follow

# Check health
WORKER_URL=$(gcloud run services describe report-generator-worker --region europe-west1 --format='value(status.url)')
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" $WORKER_URL/health

# Check environment variables
gcloud run services describe report-generator-worker --region europe-west1 --format="value(spec.template.spec.containers[0].env)"

# Restart worker
gcloud run services update report-generator-worker --region europe-west1 --no-traffic
gcloud run services update report-generator-worker --region europe-west1 --traffic=latest=100

# View metrics in browser
open "https://console.cloud.google.com/run/detail/europe-west1/report-generator-worker/metrics"
```

---

## Setting Up Alerts

### Create Alert for Worker Down

1. Go to: https://console.cloud.google.com/monitoring/alerting
2. Click "Create Policy"
3. Add condition:
   - **Resource type**: Cloud Run Revision
   - **Metric**: Request count
   - **Filter**: `service_name = "report-generator-worker"`
   - **Condition**: Below threshold (e.g., < 1 request per 5 minutes)
4. Set notification channel (email, Slack, etc.)

### Create Alert for Worker Errors

1. Go to: https://console.cloud.google.com/monitoring/alerting
2. Click "Create Policy"
3. Add condition:
   - **Resource type**: Cloud Run Revision
   - **Metric**: Log entries
   - **Filter**: `severity >= ERROR AND resource.labels.service_name = "report-generator-worker"`
   - **Condition**: Above threshold (e.g., > 5 errors per minute)
4. Set notification channel

---

## Daily Health Check Routine

1. **Check worker is running:**
   ```bash
   ./scripts/check-worker-status.sh
   ```

2. **Review recent logs for errors:**
   ```bash
   gcloud run services logs read report-generator-worker --region europe-west1 --log-filter="severity>=ERROR" --limit 20
   ```

3. **Check job processing stats:**
   ```sql
   -- In Supabase SQL Editor
   SELECT 
     status,
     COUNT(*) as count,
     MAX(updated_at) as last_updated
   FROM jobs
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY status;
   ```

4. **Verify no jobs stuck in QUEUED:**
   ```sql
   -- Jobs queued for more than 10 minutes
   SELECT id, type, created_at, updated_at
   FROM jobs
   WHERE status = 'QUEUED'
   AND created_at < NOW() - INTERVAL '10 minutes';
   ```

---

## Emergency: Worker Not Responding

If the worker is completely unresponsive:

```bash
# 1. Force redeploy
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --clear-env-vars \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4"

# 2. Or delete and redeploy
gcloud run services delete report-generator-worker --region europe-west1
./deploy-worker.sh
```

---

## Additional Resources

- **Cloud Run Console**: https://console.cloud.google.com/run?project=wealth-report
- **Logs Explorer**: https://console.cloud.google.com/logs/query?project=wealth-report
- **Monitoring Dashboard**: https://console.cloud.google.com/monitoring?project=wealth-report
- **Deployment Guide**: See `DEPLOYMENT.md`
- **Production Fix Guide**: See `PRODUCTION-FIX.md`



