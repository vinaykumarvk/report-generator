# Cost Optimization Guide for Cloud Run

## Current Worker Configuration

### How It's Currently Deployed

The worker is configured with:
- `--min-instances 1` - **Always running** (1 instance always active)
- `--max-instances 1` - Only 1 instance maximum

### Cost Impact

**Current Setup:**
- ✅ **Pros:** Jobs process immediately (no cold start delay)
- ❌ **Cons:** You pay for 1 instance running 24/7, even when idle

**Estimated Monthly Cost (Always Running):**
- CPU: 1 vCPU × 730 hours/month × $0.00002400/vCPU-second = ~$63/month
- Memory: 1GB × 730 hours/month × $0.00000250/GB-second = ~$6.50/month
- **Total: ~$70/month** (even when not processing jobs)

---

## Cost Optimization Options

### Option 1: Scale to Zero (Recommended for Low Usage)

**Configuration:**
```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --min-instances 0 \
  --max-instances 1
```

**How it works:**
- Worker shuts down when idle (no jobs)
- Starts up when a job is queued (cold start: ~10-30 seconds)
- You only pay when the worker is actually running

**Cost Impact:**
- If worker runs 2 hours/day: ~$5/month (vs $70/month)
- If worker runs 8 hours/day: ~$20/month (vs $70/month)

**Trade-offs:**
- ✅ **Much cheaper** for infrequent usage
- ❌ **Cold start delay** (10-30 seconds before first job processes)
- ❌ **Polling overhead** (worker needs to stay alive while polling)

**Best for:**
- Development/testing environments
- Low-frequency report generation (few reports per day)
- Cost-sensitive deployments

---

### Option 2: Scheduled Scaling (Hybrid Approach)

Keep worker running during business hours, scale to zero at night.

**Using Cloud Scheduler + Cloud Functions:**

1. **Morning (8 AM) - Scale Up:**
   ```bash
   gcloud run services update report-generator-worker --min-instances 1
   ```

2. **Evening (6 PM) - Scale Down:**
   ```bash
   gcloud run services update report-generator-worker --min-instances 0
   ```

**Cost Impact:**
- Worker runs 10 hours/day (business hours): ~$32/month
- 54% savings vs always-on

**Best for:**
- Predictable usage patterns (business hours only)
- Balance between cost and responsiveness

---

### Option 3: Keep Always Running (Current Setup)

**Configuration:**
```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --min-instances 1 \
  --max-instances 1
```

**Cost Impact:**
- ~$70/month (always running)

**Best for:**
- High-frequency report generation
- Need immediate job processing (no delays)
- Production environments with SLA requirements

---

## Recommended Approach: Scale to Zero with Smart Polling

### The Problem with Scale-to-Zero

Cloud Run's scale-to-zero works by:
1. Receiving an HTTP request
2. Starting the container
3. Processing the request

But our worker **polls the database** - it doesn't receive HTTP requests!

### Solution: Event-Driven Worker

Instead of continuous polling, trigger the worker when jobs are created.

#### Implementation Options

**Option A: Cloud Tasks (Recommended)**

Modify the web service to push jobs to Cloud Tasks instead of just database:

```javascript
// In web service - when creating a job
const { data: job } = await supabase.from('jobs').insert({...}).single();

// Push to Cloud Tasks to trigger worker
await cloudTasks.createTask({
  parent: queuePath,
  task: {
    httpRequest: {
      url: workerUrl + '/process-job',
      method: 'POST',
      body: Buffer.from(JSON.stringify({ jobId: job.id }))
    }
  }
});
```

**Benefits:**
- Worker only runs when jobs exist
- No polling overhead
- Automatic retries
- Scale to zero when idle

**Cost:** ~$0.40 per million tasks (essentially free for most use cases)

---

**Option B: Pub/Sub Trigger**

Use Pub/Sub to trigger worker when jobs are created:

```javascript
// In web service - when creating a job
await pubsub.topic('job-created').publish({
  jobId: job.id,
  type: job.type
});
```

**Benefits:**
- Fully event-driven
- Scale to zero
- No polling

**Cost:** ~$0.40 per million messages

---

**Option C: Database Triggers (Supabase Functions)**

Use Supabase Edge Functions to trigger worker via webhook:

```sql
-- Create database trigger
CREATE TRIGGER on_job_created
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION notify_worker();
```

**Benefits:**
- No code changes to web service
- Automatic triggering
- Scale to zero

---

## Quick Cost Comparison

| Approach | Monthly Cost | Cold Start | Complexity |
|----------|-------------|------------|------------|
| **Always Running** (current) | ~$70 | None | Low |
| **Scale to Zero** (polling) | ~$5-20 | 10-30s | Low |
| **Cloud Tasks** | ~$5-10 | None | Medium |
| **Pub/Sub** | ~$5-10 | None | Medium |
| **Scheduled Scaling** | ~$32 | None (business hours) | Medium |

---

## Immediate Cost Savings (No Code Changes)

### Step 1: Scale Worker to Zero

```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --min-instances 0 \
  --max-instances 1
```

**Savings:** ~$50-60/month

**Trade-off:** 10-30 second delay before first job processes after idle period

### Step 2: Optimize Worker Resources

Reduce CPU/memory if not needed:

```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --memory 512Mi \
  --cpu 1
```

**Savings:** Additional ~$3-5/month

---

## How to Decide

### Choose **Scale to Zero** if:
- ✅ You generate reports infrequently (< 10 per day)
- ✅ 10-30 second delay is acceptable
- ✅ Cost is a primary concern
- ✅ Development/testing environment

### Choose **Always Running** if:
- ✅ You generate reports frequently (> 50 per day)
- ✅ Immediate processing is critical
- ✅ Production environment with SLAs
- ✅ Cost is not a primary concern

### Choose **Event-Driven** (Cloud Tasks/Pub/Sub) if:
- ✅ You want best of both worlds (cost + performance)
- ✅ Willing to modify code
- ✅ Long-term production deployment

### Choose **Scheduled Scaling** if:
- ✅ Predictable usage patterns (business hours)
- ✅ Want balance between cost and performance
- ✅ Don't want to modify code

---

## Implementation: Scale to Zero (Quick Win)

### 1. Update Worker Configuration

```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --min-instances 0 \
  --max-instances 1 \
  --cpu-throttling
```

### 2. Test It

1. **Create a job** from the web UI
2. **Wait 10-30 seconds** (cold start)
3. **Check logs:**
   ```bash
   gcloud run services logs read report-generator-worker --region europe-west1 --follow
   ```
4. **Verify job completes**

### 3. Monitor Costs

Check Cloud Run billing:
```bash
gcloud billing accounts list
```

Or visit: https://console.cloud.google.com/billing

---

## Advanced: Event-Driven Worker (Future Enhancement)

If you want to implement event-driven processing later, here's the approach:

### 1. Modify Web Service

```typescript
// app/api/report-runs/route.ts
import { CloudTasksClient } from '@google-cloud/tasks';

const tasksClient = new CloudTasksClient();

export async function POST(request: Request) {
  // Create job in database
  const { data: job } = await supabase.from('jobs').insert({...}).single();
  
  // Trigger worker via Cloud Tasks
  await tasksClient.createTask({
    parent: 'projects/wealth-report/locations/europe-west1/queues/job-queue',
    task: {
      httpRequest: {
        url: process.env.WORKER_URL + '/process-job',
        method: 'POST',
        body: Buffer.from(JSON.stringify({ jobId: job.id })),
        headers: { 'Content-Type': 'application/json' }
      }
    }
  });
}
```

### 2. Modify Worker

```javascript
// workers/worker.js
// Remove polling loop, add HTTP endpoint

app.post('/process-job', async (req, res) => {
  const { jobId } = req.body;
  await processJob(jobId);
  res.json({ success: true });
});
```

### 3. Benefits

- ✅ Worker only runs when needed
- ✅ No cold start delay (Cloud Tasks waits for worker to be ready)
- ✅ Automatic retries
- ✅ ~90% cost savings

---

## Monitoring Costs

### View Current Costs

```bash
# List Cloud Run services and their costs
gcloud run services list --region europe-west1

# View detailed metrics
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/billable_instance_time"'
```

### Set Budget Alerts

1. Go to: https://console.cloud.google.com/billing/budgets
2. Create budget alert
3. Set threshold (e.g., $100/month)
4. Get email notifications

---

## Recommendation for Your Use Case

Based on typical usage patterns:

### For Development/Testing
```bash
# Scale to zero - save ~$60/month
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --min-instances 0 \
  --max-instances 1
```

### For Production (Low-Medium Usage)
```bash
# Scale to zero with optimized resources
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1
```

### For Production (High Usage)
```bash
# Keep 1 instance always running
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --min-instances 1 \
  --max-instances 5
```

---

## Summary

- **Current cost:** ~$70/month (always running)
- **Quick win:** Scale to zero → ~$5-20/month (90% savings)
- **Trade-off:** 10-30 second cold start delay
- **Best long-term:** Event-driven architecture (Cloud Tasks/Pub/Sub)

**My recommendation:** Start with scale-to-zero, monitor usage, then decide if event-driven is worth the implementation effort.



