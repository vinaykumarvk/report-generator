# Google Cloud Scheduler Setup for Job Reaper

This guide walks you through setting up Google Cloud Scheduler to automatically run the job reaper function every 5 minutes.

## Prerequisites

- Google Cloud Project with billing enabled
- Cloud Scheduler API enabled
- Cloud Run service deployed (your web app)
- Admin secret configured (use `WORKER_TRIGGER_SECRET` or set `ADMIN_SECRET`)

---

## Step-by-Step Setup

### Step 1: Enable Cloud Scheduler API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Library**
4. Search for "Cloud Scheduler API"
5. Click **Enable**

**Or via command line:**
```bash
gcloud services enable cloudscheduler.googleapis.com
```

---

### Step 2: Get Your Cloud Run Service URL

1. Go to **Cloud Run** in Google Cloud Console
2. Find your web service (e.g., `report-generator`)
3. Copy the **URL** (e.g., `https://report-generator-47249889063.europe-west1.run.app`)
4. Note the **region** (e.g., `europe-west1`)

**Or via command line:**
```bash
gcloud run services list --region=europe-west1
```

---

### Step 3: Set Up Authentication Secret

The endpoint uses the `x-admin-secret` header for authentication. Use your existing `WORKER_TRIGGER_SECRET` or set a new `ADMIN_SECRET`.

**Check your current secret:**
```bash
gcloud run services describe report-generator \
  --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"
```

**If you need to set ADMIN_SECRET:**
```bash
gcloud run services update report-generator \
  --region=europe-west1 \
  --set-env-vars="ADMIN_SECRET=your-secret-here"
```

---

### Step 4: Create Cloud Scheduler Job via Console

#### 4.1 Navigate to Cloud Scheduler

1. Go to **Cloud Scheduler** in Google Cloud Console
2. Click **Create Job**

#### 4.2 Configure Basic Settings

- **Name**: `reap-expired-jobs`
- **Region**: Same as your Cloud Run service (e.g., `europe-west1`)
- **Description**: `Periodically runs job reaper to clean up stuck jobs`
- **Frequency**: `*/5 * * * *` (every 5 minutes)
  - Format: `minute hour day-of-month month day-of-week`
  - `*/5 * * * *` = every 5 minutes
  - `0 */1 * * *` = every hour
  - `0 0 * * *` = daily at midnight

#### 4.3 Configure Target

- **Target type**: `HTTP`
- **URL**: `https://your-service-url.run.app/api/admin/reap-jobs`
  - Replace `your-service-url` with your actual Cloud Run URL
- **HTTP method**: `POST`
- **Headers**: Click **Add header**
  - **Name**: `x-admin-secret`
  - **Value**: Your `WORKER_TRIGGER_SECRET` or `ADMIN_SECRET` value
- **Body**: (Optional) JSON payload
  ```json
  {
    "max_age_minutes": 60
  }
  ```
  - Leave empty to use default (60 minutes)

#### 4.4 Configure Options (Optional)

- **Retry configuration**: 
  - **Retry attempts**: `3` (default)
  - **Retry window**: `3600` seconds (1 hour)
- **Time zone**: `UTC` (default)

#### 4.5 Create the Job

Click **Create** to save the scheduler job.

---

### Step 5: Create Cloud Scheduler Job via Command Line

**Alternative: Use gcloud command**

```bash
# Set variables
PROJECT_ID="your-project-id"
REGION="europe-west1"
SERVICE_URL="https://report-generator-47249889063.europe-west1.run.app"
ADMIN_SECRET="your-admin-secret-here"

# Create the scheduler job
gcloud scheduler jobs create http reap-expired-jobs \
  --project=$PROJECT_ID \
  --location=$REGION \
  --schedule="*/5 * * * *" \
  --uri="$SERVICE_URL/api/admin/reap-jobs" \
  --http-method=POST \
  --headers="x-admin-secret=$ADMIN_SECRET" \
  --message-body='{"max_age_minutes": 60}' \
  --time-zone="UTC" \
  --description="Periodically runs job reaper to clean up stuck jobs"
```

**Replace:**
- `your-project-id` with your GCP project ID
- `europe-west1` with your region
- `https://report-generator-47249889063.europe-west1.run.app` with your actual service URL
- `your-admin-secret-here` with your actual secret

---

### Step 6: Test the Scheduler Job

#### 6.1 Manual Test via Console

1. Go to **Cloud Scheduler**
2. Find your job `reap-expired-jobs`
3. Click the **⋮** (three dots) menu
4. Click **Run now**
5. Wait a few seconds
6. Click **View logs** to see the execution result

#### 6.2 Manual Test via Command Line

```bash
# Test the endpoint directly
curl -X POST \
  -H "x-admin-secret: your-admin-secret-here" \
  -H "Content-Type: application/json" \
  -d '{"max_age_minutes": 60}' \
  https://your-service-url.run.app/api/admin/reap-jobs
```

**Expected response:**
```json
{
  "success": true,
  "jobs_reclaimed": 0,
  "jobs_failed": 0,
  "details": {
    "reclaimed": 0,
    "failed": 0,
    "jobs": [],
    "reaped_at": "2026-01-07T10:00:00.000Z"
  }
}
```

#### 6.3 Test via gcloud

```bash
gcloud scheduler jobs run reap-expired-jobs \
  --location=europe-west1
```

---

### Step 7: Verify It's Working

#### 7.1 Check Scheduler Execution Logs

1. Go to **Cloud Scheduler**
2. Click on `reap-expired-jobs`
3. Click **View logs** tab
4. You should see successful executions every 5 minutes

#### 7.2 Check Application Logs

1. Go to **Cloud Run** > Your service
2. Click **Logs** tab
3. Filter for `/api/admin/reap-jobs`
4. You should see reaper execution logs

#### 7.3 Check Database

Query the audit logs to see reaper activity:

```sql
SELECT * FROM audit_logs 
WHERE action_type IN ('JOB_REQUEUED_BY_REAPER', 'JOB_FAILED_MAX_ATTEMPTS_REAPER')
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Issue: 401 Unauthorized

**Problem**: Scheduler job returns 401 error

**Solution**:
1. Verify the `x-admin-secret` header value matches your environment variable
2. Check that `ADMIN_SECRET` or `WORKER_TRIGGER_SECRET` is set in Cloud Run
3. Ensure the header name is exactly `x-admin-secret` (case-sensitive)

### Issue: 404 Not Found

**Problem**: Endpoint not found

**Solution**:
1. Verify the URL is correct: `/api/admin/reap-jobs`
2. Ensure the service is deployed with the latest code
3. Check that the route file exists: `app/api/admin/reap-jobs/route.ts`

### Issue: Scheduler Not Running

**Problem**: Job is created but not executing

**Solution**:
1. Check if the job is **Enabled** (toggle in console)
2. Verify the schedule expression is valid: `*/5 * * * *`
3. Check Cloud Scheduler quotas/limits
4. Verify the service account has necessary permissions

### Issue: Permission Denied

**Problem**: Scheduler can't invoke Cloud Run

**Solution**:
1. Ensure Cloud Scheduler service account has `Cloud Run Invoker` role
2. Grant permission:
   ```bash
   gcloud run services add-iam-policy-binding report-generator \
     --region=europe-west1 \
     --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
     --role="roles/run.invoker"
   ```
   Replace `PROJECT_NUMBER` with your project number.

---

## Monitoring

### View Scheduler Job Status

```bash
gcloud scheduler jobs describe reap-expired-jobs \
  --location=europe-west1
```

### View Execution History

```bash
gcloud scheduler jobs list-executions reap-expired-jobs \
  --location=europe-west1
```

### Set Up Alerts

1. Go to **Monitoring** > **Alerting**
2. Create alert for scheduler job failures
3. Condition: `cloudscheduler.googleapis.com/job/execution_count` with failed status

---

## Schedule Examples

- **Every 5 minutes**: `*/5 * * * *`
- **Every 15 minutes**: `*/15 * * * *`
- **Every hour**: `0 * * * *`
- **Every 6 hours**: `0 */6 * * *`
- **Daily at midnight**: `0 0 * * *`
- **Daily at 2 AM**: `0 2 * * *`

---

## Cost Considerations

- Cloud Scheduler: **Free** (first 3 jobs per month, then $0.10 per job per month)
- Cloud Run invocations: Charged per request (very minimal for this use case)
- Total estimated cost: **~$0.10-0.50/month** depending on frequency

---

## Security Best Practices

1. ✅ Use strong, unique secret for `ADMIN_SECRET`
2. ✅ Rotate secrets periodically
3. ✅ Restrict Cloud Run service to only allow scheduler service account
4. ✅ Monitor audit logs for unauthorized access
5. ✅ Use least privilege IAM roles

---

## Next Steps

After setup:
1. ✅ Monitor the first few executions
2. ✅ Check audit logs for reaper activity
3. ✅ Verify stuck jobs are being cleaned up
4. ✅ Adjust `max_age_minutes` if needed
5. ✅ Set up alerts for failures

