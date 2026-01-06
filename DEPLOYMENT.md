# Deployment Guide

## Architecture

This application consists of two services:

1. **Web Service** - Next.js application serving the UI and API routes
2. **Worker Service** - Background worker processing jobs from the queue

Both services share the same codebase but run with different configurations.

---

## Environment Variables

### Required for Both Services

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_PASSWORD=your-db-password

# Workspace
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Node Environment
NODE_ENV=production
```

### Web Service Specific

```bash
SERVICE_MODE=web
PORT=8080
```

### Worker Service Specific

```bash
SERVICE_MODE=worker
PORT=8080
```

---

## Google Cloud Run Deployment

### 1. Deploy Web Service

```bash
gcloud run deploy report-generator-web \
  --source . \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "SERVICE_MODE=web,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4" \
  --set-secrets "NEXT_PUBLIC_SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

### 2. Deploy Worker Service

```bash
gcloud run deploy report-generator-worker \
  --source . \
  --region europe-west1 \
  --platform managed \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4" \
  --set-secrets "NEXT_PUBLIC_SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

**Important Worker Settings:**
- `--min-instances 1` - Keeps worker always running
- `--max-instances 1` - Only one worker instance (prevents duplicate job processing)
- `--no-allow-unauthenticated` - Worker doesn't need public access

---

## Cloud Build Configuration

If using Cloud Build, create two separate build configs:

### cloudbuild-web.yaml

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/report-generator-web', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/report-generator-web']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'report-generator-web'
      - '--image'
      - 'gcr.io/$PROJECT_ID/report-generator-web'
      - '--region'
      - 'europe-west1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'SERVICE_MODE=web,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4'
```

### cloudbuild-worker.yaml

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/report-generator-worker', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/report-generator-worker']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'report-generator-worker'
      - '--image'
      - 'gcr.io/$PROJECT_ID/report-generator-worker'
      - '--region'
      - 'europe-west1'
      - '--platform'
      - 'managed'
      - '--no-allow-unauthenticated'
      - '--min-instances'
      - '1'
      - '--max-instances'
      - '1'
      - '--set-env-vars'
      - 'SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4'
```

---

## Verification

### Check Web Service

```bash
curl https://your-web-service-url.run.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-30T...",
  "supabase": { "connected": true, "message": "Connected" },
  "env": { "loaded": true }
}
```

### Check Worker Service

```bash
curl https://your-worker-service-url.run.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "report-generator-worker",
  "uptime": 123.45,
  "timestamp": "2025-12-30T..."
}
```

### Check Worker Logs

```bash
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --limit 50
```

Look for:
- `🚀 Starting in WORKER mode...`
- `✅ Health check server listening on port 8080`
- `Worker process is running in the background`
- Job processing logs

---

## Troubleshooting

### Worker Not Processing Jobs

1. **Check if worker is running:**
   ```bash
   gcloud run services describe report-generator-worker --region europe-west1
   ```

2. **Check worker logs:**
   ```bash
   gcloud run services logs read report-generator-worker --region europe-west1
   ```

3. **Verify environment variables:**
   ```bash
   gcloud run services describe report-generator-worker --region europe-west1 --format="value(spec.template.spec.containers[0].env)"
   ```

4. **Check database connection:**
   - Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
   - Check if worker can connect to Supabase

### Worker Keeps Restarting

- Check if `SERVICE_MODE=worker` is set
- Verify the health check endpoint is responding
- Check for errors in worker logs

### Jobs Not Being Created

- Check web service logs
- Verify API routes are creating jobs in the database
- Check `jobs` table in Supabase

---

## Local Development

### Run Web Server

```bash
npm run dev
```

### Run Worker

```bash
npm run worker
```

Or with the health check wrapper:

```bash
SERVICE_MODE=worker npm start
```

---

## Monitoring

### View Logs

```bash
# Web service
gcloud run services logs read report-generator-web --region europe-west1

# Worker service
gcloud run services logs read report-generator-worker --region europe-west1
```

### Check Service Status

```bash
gcloud run services list --region europe-west1
```

### Monitor Job Queue

Query the `jobs` table in Supabase:

```sql
SELECT status, type, COUNT(*) 
FROM jobs 
GROUP BY status, type;
```

---

## Scaling

### Web Service
- Auto-scales based on traffic
- Default: 0-100 instances

### Worker Service
- **Must** keep `min-instances=1` and `max-instances=1`
- This ensures only one worker processes jobs (prevents duplicates)
- If you need more throughput, optimize the worker code instead of adding instances

---

## Cost Optimization

1. **Web Service**: Set `--min-instances=0` to scale to zero when idle
2. **Worker Service**: Keep `--min-instances=1` (required for job processing)
3. Use Cloud Run's CPU allocation options:
   - `--cpu-throttling` for worker (CPU always allocated)
   - Default for web (CPU only during request)

---

## Security

1. **Secrets Management**: Use Google Secret Manager for sensitive data
2. **Service Account**: Create a dedicated service account for each service
3. **Network**: Consider using VPC connector for database access
4. **Authentication**: Web service can be public, worker should be private

---

## Next Steps

1. Set up Cloud Build triggers for automatic deployment
2. Configure Cloud Monitoring alerts
3. Set up log-based metrics for job processing
4. Implement health check monitoring



