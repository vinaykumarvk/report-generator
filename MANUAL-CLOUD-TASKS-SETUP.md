# Manual Cloud Tasks Setup

If you prefer to run commands manually instead of using the automated script, follow these steps in **Google Cloud Shell**.

---

## Prerequisites

1. Open Google Cloud Shell: https://console.cloud.google.com
2. Set your project:
   ```bash
   gcloud config set project wealth-report
   ```

---

## Step 1: Enable Cloud Tasks API

```bash
gcloud services enable cloudtasks.googleapis.com --project=wealth-report
```

---

## Step 2: Create Cloud Tasks Queue

```bash
gcloud tasks queues create job-queue \
  --location=europe-west1 \
  --project=wealth-report \
  --max-concurrent-dispatches=10 \
  --max-attempts=3 \
  --max-retry-duration=1h \
  --min-backoff=10s \
  --max-backoff=5m
```

**Verify:**
```bash
gcloud tasks queues describe job-queue --location=europe-west1
```

---

## Step 3: Create Service Account

```bash
gcloud iam service-accounts create worker-tasks \
  --display-name="Report Generator Worker Tasks" \
  --project=wealth-report
```

**Verify:**
```bash
gcloud iam service-accounts list --project=wealth-report
```

---

## Step 4: Grant IAM Permissions

### Permission 1: Enqueue Cloud Tasks

```bash
gcloud projects add-iam-policy-binding wealth-report \
  --member="serviceAccount:worker-tasks@wealth-report.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### Permission 2: Invoke Worker Service

```bash
gcloud run services add-iam-policy-binding report-generator-worker \
  --region=europe-west1 \
  --member="serviceAccount:worker-tasks@wealth-report.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --platform=managed
```

**Verify:**
```bash
gcloud run services get-iam-policy report-generator-worker --region=europe-west1
```

---

## Step 5: Generate Trigger Secret

```bash
# Generate a random secret
TRIGGER_SECRET=$(openssl rand -hex 32)
echo "WORKER_TRIGGER_SECRET=${TRIGGER_SECRET}"

# Save this secret - you'll need it for both services!
```

---

## Step 6: Get Worker URL

```bash
WORKER_URL=$(gcloud run services describe report-generator-worker \
  --region=europe-west1 \
  --project=wealth-report \
  --format='value(status.url)')

echo "Worker URL: ${WORKER_URL}"
echo "Trigger URL: ${WORKER_URL}/process-job"
```

---

## Step 7: Deploy Worker Service

```bash
gcloud run deploy report-generator-worker \
  --source . \
  --region=europe-west1 \
  --project=wealth-report \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=3600 \
  --set-env-vars "\
SERVICE_MODE=worker,\
WORKER_TRIGGER_SECRET=${TRIGGER_SECRET},\
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL,\
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY,\
OPENAI_API_KEY=YOUR_OPENAI_KEY,\
DEFAULT_WORKSPACE_ID=YOUR_WORKSPACE_ID"
```

**Replace:**
- `YOUR_SUPABASE_URL` with your actual Supabase URL
- `YOUR_SERVICE_ROLE_KEY` with your Supabase service role key
- `YOUR_OPENAI_KEY` with your OpenAI API key
- `YOUR_WORKSPACE_ID` with your workspace ID

---

## Step 8: Deploy Web Service

```bash
# Get the actual worker URL after deployment
WORKER_URL=$(gcloud run services describe report-generator-worker \
  --region=europe-west1 \
  --project=wealth-report \
  --format='value(status.url)')

gcloud run deploy report-generator \
  --source . \
  --region=europe-west1 \
  --project=wealth-report \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --set-env-vars "\
SERVICE_MODE=web,\
JOB_TRIGGER_MODE=cloud-tasks,\
CLOUD_TASKS_PROJECT=wealth-report,\
CLOUD_TASKS_LOCATION=europe-west1,\
CLOUD_TASKS_QUEUE=job-queue,\
WORKER_TASK_SERVICE_ACCOUNT=worker-tasks@wealth-report.iam.gserviceaccount.com,\
WORKER_TRIGGER_URL=${WORKER_URL}/process-job,\
WORKER_TRIGGER_SECRET=${TRIGGER_SECRET},\
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL,\
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY,\
OPENAI_API_KEY=YOUR_OPENAI_KEY,\
DEFAULT_WORKSPACE_ID=YOUR_WORKSPACE_ID"
```

---

## Step 9: Test the Setup

### Test 1: Worker Health

```bash
WORKER_URL=$(gcloud run services describe report-generator-worker \
  --region=europe-west1 \
  --format='value(status.url)')

curl "${WORKER_URL}/health"
```

**Expected:**
```json
{
  "status": "healthy",
  "service": "report-generator-worker",
  "triggerMode": "http",
  "uptime": 123.45
}
```

### Test 2: Queue Status

```bash
gcloud tasks queues describe job-queue --location=europe-west1
```

### Test 3: List Tasks

```bash
gcloud tasks list --queue=job-queue --location=europe-west1
```

---

## Step 10: Create a Test Report

1. Open your web app:
   ```bash
   WEB_URL=$(gcloud run services describe report-generator \
     --region=europe-west1 \
     --format='value(status.url)')
   echo "Web app: ${WEB_URL}"
   ```

2. Create a report run in the UI

3. Check worker logs:
   ```bash
   gcloud run services logs read report-generator-worker \
     --region=europe-west1 \
     --limit=50
   ```

4. Check queue:
   ```bash
   gcloud tasks list --queue=job-queue --location=europe-west1
   ```

---

## Troubleshooting

### Issue: "Permission denied"

**Solution:**
```bash
# Check your permissions
gcloud projects get-iam-policy wealth-report

# You need at least these roles:
# - roles/run.admin
# - roles/cloudtasks.admin
# - roles/iam.serviceAccountAdmin
```

### Issue: "Queue already exists"

**Solution:**
```bash
# Update existing queue instead
gcloud tasks queues update job-queue \
  --location=europe-west1 \
  --max-concurrent-dispatches=10
```

### Issue: "Service account not found"

**Solution:**
```bash
# List service accounts
gcloud iam service-accounts list --project=wealth-report

# Create if missing
gcloud iam service-accounts create worker-tasks \
  --display-name="Report Generator Worker Tasks"
```

---

## Environment Variables Summary

Save these for reference:

```bash
# Web Service
JOB_TRIGGER_MODE=cloud-tasks
CLOUD_TASKS_PROJECT=wealth-report
CLOUD_TASKS_LOCATION=europe-west1
CLOUD_TASKS_QUEUE=job-queue
WORKER_TASK_SERVICE_ACCOUNT=worker-tasks@wealth-report.iam.gserviceaccount.com
WORKER_TRIGGER_URL=https://YOUR-WORKER-URL/process-job
WORKER_TRIGGER_SECRET=YOUR-GENERATED-SECRET

# Worker Service
WORKER_TRIGGER_SECRET=YOUR-GENERATED-SECRET
```

---

## Next Steps

After setup is complete:

1. ✅ Test with a real report run
2. ✅ Monitor logs and queue
3. ✅ Verify cost savings (worker scales to zero)
4. ✅ Set up alerts for queue depth

---

## Rollback

If you need to rollback to polling mode:

```bash
gcloud run services update report-generator \
  --region=europe-west1 \
  --set-env-vars "JOB_TRIGGER_MODE=db"
```

Worker will automatically fall back to database polling.

