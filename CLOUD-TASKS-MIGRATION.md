# Cloud Tasks Migration Guide

## Overview

This guide explains how to migrate from database polling to Cloud Tasks event-driven architecture.

---

## What Changed?

### Before (Database Polling)

```
┌─────────────┐
│ Web Service │
│             │
│ 1. Insert   │
│    job in   │──┐
│    DB       │  │
└─────────────┘  │
                 │
                 └──► Database
                      │
                      │ Worker polls
                      │ every 1 second
                      ▼
                  ┌────────────┐
                  │   Worker   │
                  └────────────┘
```

**Issues:**
- ❌ Worker polls database every second (overhead)
- ❌ 1-5 second latency before job starts
- ❌ Database load from constant polling
- ❌ Worker must always run (can't truly scale to zero)

---

### After (Cloud Tasks)

```
┌─────────────┐
│ Web Service │
│             │
│ 1. Insert   │──┐
│    job in   │  │
│    DB       │  │
│             │  │
│ 2. Enqueue  │  │
│    Cloud    │──┼──► Cloud Tasks Queue
│    Task     │  │         │
└─────────────┘  │         │ Triggers worker
                 │         │ immediately
                 │         ▼
                 │    ┌────────────┐
                 │    │   Worker   │
                 │    └────────────┘
                 │         │
                 └──► Database (job status)
```

**Benefits:**
- ✅ Instant job processing (no polling delay)
- ✅ No polling overhead
- ✅ Worker truly scales to zero
- ✅ Built-in retries and rate limiting
- ✅ Better cost efficiency

---

## Architecture

### Key Components

#### 1. `jobTrigger.js` Module

Handles job triggering with multiple modes:

- **`db`** (default): Traditional polling, no changes
- **`http`**: Direct HTTP POST to worker
- **`cloud-tasks`**: Google Cloud Tasks (recommended)
- **`none`**: No trigger (for testing)

#### 2. `worker-core.js`

Core worker logic extracted to support both modes:

- **`processJobOnce`**: Event-driven processing (triggered by Cloud Tasks/HTTP)
- **`startPolling`**: Traditional polling (backward compatible)

#### 3. Worker HTTP Endpoints

- **`/health`**: Health check
- **`/process-job`**: Receives job triggers from Cloud Tasks

---

## Migration Modes

### Mode 1: Database Polling (Default)

**No changes needed - current behavior**

```bash
# .env
JOB_TRIGGER_MODE=db  # or omit (default)
```

Worker continuously polls database every second.

---

### Mode 2: HTTP Trigger

**Direct HTTP POST from web → worker**

```bash
# .env for web service
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_URL=https://report-generator-worker-XXX.run.app/process-job
WORKER_TRIGGER_SECRET=your-secret-here

# .env for worker service
WORKER_TRIGGER_SECRET=your-secret-here
```

**Pros:**
- Simple setup
- No GCP resources needed

**Cons:**
- No built-in retries
- No rate limiting
- Must handle failures manually

---

### Mode 3: Cloud Tasks (Recommended)

**Production-ready event-driven architecture**

```bash
# .env for web service
JOB_TRIGGER_MODE=cloud-tasks
CLOUD_TASKS_PROJECT=wealth-report
CLOUD_TASKS_LOCATION=europe-west1
CLOUD_TASKS_QUEUE=job-queue
WORKER_TASK_SERVICE_ACCOUNT=worker-tasks@PROJECT.iam.gserviceaccount.com
WORKER_TRIGGER_URL=https://report-generator-worker-XXX.run.app/process-job
WORKER_TRIGGER_SECRET=your-secret-here

# .env for worker service
WORKER_TRIGGER_SECRET=your-secret-here
```

**Pros:**
- ✅ Instant processing
- ✅ Built-in retries (up to 3 attempts)
- ✅ Rate limiting (max 10 concurrent)
- ✅ OIDC authentication
- ✅ Monitoring and logging

**Cons:**
- Requires GCP setup
- Additional costs (minimal)

---

## Setup Instructions

### Quick Start (Automated)

```bash
# 1. Setup Cloud Tasks (creates queue, service account, IAM)
./scripts/setup-cloud-tasks.sh

# 2. Deploy both services with Cloud Tasks enabled
./scripts/deploy-with-cloud-tasks.sh

# 3. Test the setup
./scripts/test-cloud-tasks.sh
```

---

### Manual Setup

#### Step 1: Create Cloud Tasks Queue

```bash
PROJECT_ID="wealth-report"
LOCATION="europe-west1"
QUEUE_NAME="job-queue"

gcloud tasks queues create $QUEUE_NAME \
  --location=$LOCATION \
  --project=$PROJECT_ID \
  --max-concurrent-dispatches=10 \
  --max-attempts=3 \
  --max-retry-duration=1h \
  --min-backoff=10s \
  --max-backoff=5m
```

#### Step 2: Create Service Account

```bash
SA_NAME="worker-tasks"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Create service account
gcloud iam service-accounts create $SA_NAME \
  --display-name="Report Generator Worker Tasks" \
  --project=$PROJECT_ID

# Grant permission to enqueue tasks
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudtasks.enqueuer"

# Grant permission to invoke worker
gcloud run services add-iam-policy-binding report-generator-worker \
  --region=$LOCATION \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker"
```

#### Step 3: Deploy Worker Service

```bash
# Generate secret
TRIGGER_SECRET=$(openssl rand -hex 32)

gcloud run deploy report-generator-worker \
  --source . \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --set-env-vars "SERVICE_MODE=worker,\
WORKER_TRIGGER_SECRET=${TRIGGER_SECRET},\
NEXT_PUBLIC_SUPABASE_URL=...,\
SUPABASE_SERVICE_ROLE_KEY=...,\
OPENAI_API_KEY=..."
```

#### Step 4: Deploy Web Service

```bash
# Get worker URL
WORKER_URL=$(gcloud run services describe report-generator-worker \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

gcloud run deploy report-generator \
  --source . \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --set-env-vars "SERVICE_MODE=web,\
JOB_TRIGGER_MODE=cloud-tasks,\
CLOUD_TASKS_PROJECT=${PROJECT_ID},\
CLOUD_TASKS_LOCATION=${LOCATION},\
CLOUD_TASKS_QUEUE=job-queue,\
WORKER_TASK_SERVICE_ACCOUNT=${SA_EMAIL},\
WORKER_TRIGGER_URL=${WORKER_URL}/process-job,\
WORKER_TRIGGER_SECRET=${TRIGGER_SECRET},\
NEXT_PUBLIC_SUPABASE_URL=...,\
SUPABASE_SERVICE_ROLE_KEY=...,\
OPENAI_API_KEY=..."
```

---

## Testing

### Test 1: Health Check

```bash
curl https://report-generator-worker-XXX.run.app/health
```

Expected:
```json
{
  "status": "healthy",
  "service": "report-generator-worker",
  "triggerMode": "http",
  "pollingEnabled": false,
  "uptime": 123.45,
  "timestamp": "2025-12-31T12:00:00.000Z"
}
```

### Test 2: Manual Job Trigger

```bash
# Get worker URL and secret from environment
WORKER_URL="https://report-generator-worker-XXX.run.app"
TRIGGER_SECRET="your-secret"

curl -X POST "${WORKER_URL}/process-job" \
  -H "Content-Type: application/json" \
  -H "x-worker-trigger: ${TRIGGER_SECRET}" \
  -d '{"jobId":"test-job-123"}'
```

Expected:
```json
{
  "ok": true,
  "result": {
    "status": "no_job"  // or "completed" if job exists
  }
}
```

### Test 3: End-to-End

1. Create a report run in the web UI
2. Check worker logs:
   ```bash
   gcloud run services logs read report-generator-worker \
     --region europe-west1 \
     --limit 50
   ```
3. Should see:
   ```
   ✅ Claimed job: <job-id> (START_RUN)
   ... processing ...
   ✅ Job processed: <job-id>
   ```

### Test 4: Cloud Tasks Queue

```bash
# List tasks
gcloud tasks list \
  --queue=job-queue \
  --location=europe-west1

# Describe queue
gcloud tasks queues describe job-queue \
  --location=europe-west1
```

---

## Monitoring

### Worker Logs

```bash
# Real-time logs
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --limit 50

# Follow logs (in Cloud Console)
# https://console.cloud.google.com/run/detail/europe-west1/report-generator-worker/logs
```

### Cloud Tasks Metrics

```bash
# Queue stats
gcloud tasks queues describe job-queue \
  --location=europe-west1

# Recent tasks
gcloud tasks list \
  --queue=job-queue \
  --location=europe-west1 \
  --limit=10
```

### Database Jobs

```bash
# Check job status
node scripts/check-runs.js

# Or query directly in Supabase dashboard
```

---

## Troubleshooting

### Issue: Jobs stay in QUEUED

**Symptom:** Jobs created but never processed

**Check:**
1. Worker service deployed?
   ```bash
   gcloud run services list --region europe-west1
   ```

2. Worker healthy?
   ```bash
   curl https://WORKER-URL/health
   ```

3. Environment variables set?
   ```bash
   gcloud run services describe report-generator-worker \
     --region europe-west1 \
     --format='value(spec.template.spec.containers[0].env)'
   ```

4. Cloud Tasks queue exists?
   ```bash
   gcloud tasks queues describe job-queue --location europe-west1
   ```

5. Check worker logs for errors:
   ```bash
   gcloud run services logs read report-generator-worker \
     --region europe-west1 \
     --limit 100
   ```

---

### Issue: "Unauthorized" when triggering worker

**Symptom:** 401 or 403 errors in logs

**Fix:**
1. Check `WORKER_TRIGGER_SECRET` matches on both services
2. Check service account has `run.invoker` role
3. Verify OIDC token configuration

```bash
# Check IAM
gcloud run services get-iam-policy report-generator-worker \
  --region europe-west1
```

---

### Issue: "Queue not found"

**Symptom:** Cloud Tasks enqueue fails

**Fix:**
```bash
# Create queue
gcloud tasks queues create job-queue \
  --location=europe-west1 \
  --max-concurrent-dispatches=10
```

---

### Issue: High latency / slow processing

**Symptom:** Jobs take long to process

**Check:**
1. Queue configuration (rate limits)
   ```bash
   gcloud tasks queues describe job-queue --location europe-west1
   ```

2. Worker concurrency settings
   ```bash
   gcloud run services describe report-generator-worker \
     --region europe-west1 \
     --format='value(spec.template.spec.containerConcurrency)'
   ```

3. Worker scaling (min/max instances)

---

## Rollback Plan

If Cloud Tasks causes issues, you can instantly rollback to polling:

### Option 1: Change Environment Variable

```bash
# Update web service
gcloud run services update report-generator \
  --region europe-west1 \
  --set-env-vars "JOB_TRIGGER_MODE=db"

# Worker will automatically fall back to polling
```

### Option 2: Redeploy Old Version

```bash
# List revisions
gcloud run revisions list \
  --service report-generator \
  --region europe-west1

# Rollback to previous revision
gcloud run services update-traffic report-generator \
  --region europe-west1 \
  --to-revisions REVISION-NAME=100
```

---

## Cost Comparison

### Database Polling Mode

**Worker costs:**
- Always running (min-instances=1): ~$50-100/month
- CPU usage from constant polling: ~10-20%
- Database read operations: ~86,400/day (1/sec)

**Total:** ~$50-100/month + database costs

---

### Cloud Tasks Mode

**Worker costs:**
- Scales to zero (min-instances=0): $0 when idle
- Only runs when processing jobs
- No polling overhead

**Cloud Tasks costs:**
- First 1M operations: Free
- After: $0.40 per million operations
- Typical usage: <100K/month = Free

**Total:** $0-10/month (mostly for active job processing)

**💰 Savings: ~$40-90/month (~80% cost reduction)**

---

## Performance Comparison

| Metric | Polling | Cloud Tasks |
|--------|---------|-------------|
| **Latency** | 1-5 seconds | <500ms |
| **Database Load** | High (constant polling) | Low (only job updates) |
| **Worker Idle Cost** | $50-100/month | $0/month |
| **Retry Logic** | Manual | Built-in |
| **Rate Limiting** | Manual | Built-in |
| **Monitoring** | Custom | GCP Console |
| **Scalability** | Limited by polling | Highly scalable |

---

## Best Practices

### 1. Use OIDC Authentication

Always set `WORKER_TASK_SERVICE_ACCOUNT` for secure authentication:

```bash
WORKER_TASK_SERVICE_ACCOUNT=worker-tasks@PROJECT.iam.gserviceaccount.com
```

### 2. Set Reasonable Rate Limits

```bash
gcloud tasks queues update job-queue \
  --location=europe-west1 \
  --max-concurrent-dispatches=10  # Adjust based on load
```

### 3. Monitor Queue Depth

```bash
# Alert if queue depth > 100
gcloud tasks list --queue=job-queue --location=europe-west1 | wc -l
```

### 4. Use Structured Logging

Already implemented in `worker-core.js`:
```javascript
console.log(`✅ Claimed job: ${job.id} (${job.type})`);
```

### 5. Set Up Alerting

Create alerts for:
- Queue depth > threshold
- Task retry rate > threshold
- Worker error rate > threshold

---

## FAQ

### Q: Can I use both polling and Cloud Tasks?

**A:** Yes! Set `WORKER_POLLING_ENABLED=true` to keep polling as a safety net:

```bash
JOB_TRIGGER_MODE=http
WORKER_POLLING_ENABLED=true  # Poll every 60s as backup
WORKER_POLL_INTERVAL_MS=60000
```

---

### Q: What happens if Cloud Tasks fails?

**A:** Jobs remain in the database with status QUEUED. You can:
1. Enable polling as backup (see above)
2. Manually trigger jobs via HTTP endpoint
3. Jobs will be picked up when Cloud Tasks recovers

---

### Q: How many concurrent workers can I run?

**A:** Set via Cloud Run `max-instances`:

```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --max-instances=10  # Adjust based on load
```

Each worker can process jobs concurrently based on `containerConcurrency` setting.

---

### Q: Is this secure?

**A:** Yes, multiple layers of security:
1. OIDC authentication (service account)
2. Shared secret (`WORKER_TRIGGER_SECRET`)
3. GCP IAM permissions
4. HTTPS only

---

### Q: What about local development?

**A:** Use `db` mode locally:

```bash
# .env.local
JOB_TRIGGER_MODE=db
```

Or test HTTP mode:
```bash
# .env.local
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_URL=http://localhost:8080/process-job
WORKER_TRIGGER_SECRET=test-secret
```

---

## Additional Resources

- [Google Cloud Tasks Documentation](https://cloud.google.com/tasks/docs)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [Architecture Decisions (ARCHITECTURE-DECISIONS.md)](./ARCHITECTURE-DECISIONS.md)
- [Migration Evaluation (MIGRATION-EVALUATION.md)](./MIGRATION-EVALUATION.md)

---

## Support

If you encounter issues:

1. Check logs: `./scripts/check-worker-status.sh`
2. Test setup: `./scripts/test-cloud-tasks.sh`
3. Review troubleshooting section above
4. Check worker health: `curl https://WORKER-URL/health`

---

**Last Updated:** 2025-12-31

