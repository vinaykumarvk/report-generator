# Production Issue: Jobs Stuck in QUEUED Status

## 🎯 Root Cause

**The worker service is not deployed!**

Jobs are being created successfully by the web service, but there's no worker process running to pick them up and process them. This is why they remain in `QUEUED` status indefinitely.

## ✅ What's Working

1. **Web Service**: Deployed and running correctly
   - URL: https://report-generator-47249889063.europe-west1.run.app
   - Templates API: ✅ Working (49 templates visible)
   - Health Check: ✅ Working
   - Job Creation: ✅ Working

2. **Database**: Connected and accessible
   - Workspace ID: `c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`
   - Templates: All 49 templates correctly assigned
   - Jobs table: Jobs are being created

## ❌ What's Missing

**Worker Service**: Not deployed

The worker is a separate Cloud Run service that:
- Polls the `jobs` table for new jobs
- Processes jobs (starts runs, generates reports, handles exports)
- Updates job status from `QUEUED` → `IN_PROGRESS` → `COMPLETED`

Without the worker, jobs just sit in `QUEUED` status forever.

## 🔧 Solution

Deploy the worker as a separate Cloud Run service.

### Quick Deploy

```bash
./deploy-worker.sh
```

### Manual Deploy

```bash
gcloud run deploy report-generator-worker \
  --source . \
  --region europe-west1 \
  --platform managed \
  --project wealth-report \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 3600 \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4" \
  --set-secrets "NEXT_PUBLIC_SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

### Important Settings

- `SERVICE_MODE=worker` - **Critical!** Tells the app to run as worker
- `--min-instances 1` - Keeps worker always running
- `--max-instances 1` - Only one worker (prevents duplicate processing)
- `--no-allow-unauthenticated` - Worker doesn't need public access
- `--timeout 3600` - Allow long-running jobs (1 hour)

## 🔍 Verification

### 1. Check if Worker is Deployed

```bash
gcloud run services list --region europe-west1
```

You should see both:
- `report-generator` (or similar) - Web service
- `report-generator-worker` - Worker service

### 2. Check Worker Logs

```bash
gcloud run services logs read report-generator-worker --region europe-west1 --limit 50
```

Look for:
```
🚀 Starting in WORKER mode...
✅ Health check server listening on port 8080
Worker process is running in the background
```

### 3. Test Worker Health

```bash
WORKER_URL=$(gcloud run services describe report-generator-worker --region europe-west1 --format='value(status.url)')
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" $WORKER_URL/health
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

### 4. Monitor Job Processing

After deploying the worker, create a new report run and watch the logs:

```bash
gcloud run services logs read report-generator-worker --region europe-west1 --follow
```

You should see:
- Jobs being picked up
- Status changes: `QUEUED` → `IN_PROGRESS` → `COMPLETED`
- Report generation progress

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Google Cloud Run                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────┐   │
│  │   Web Service        │      │   Worker Service      │   │
│  │                      │      │                       │   │
│  │ - Next.js App        │      │ - Job Processor       │   │
│  │ - API Routes         │      │ - Always Running      │   │
│  │ - Creates Jobs       │      │ - Processes Jobs      │   │
│  │ - Public Access      │      │ - Private Access      │   │
│  │                      │      │                       │   │
│  │ SERVICE_MODE=web     │      │ SERVICE_MODE=worker   │   │
│  └──────────┬───────────┘      └──────────┬────────────┘   │
│             │                              │                │
│             │    ┌────────────────────┐   │                │
│             └────┤   Supabase DB      ├───┘                │
│                  │                    │                     │
│                  │ - jobs table       │                     │
│                  │ - templates        │                     │
│                  │ - runs             │                     │
│                  │ - workspaces       │                     │
│                  └────────────────────┘                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🐛 How This Happened

The same issue occurred locally earlier:
1. Started the web server (`npm run dev`)
2. Jobs were created but stuck in `QUEUED`
3. **Forgot to start the worker** (`npm run worker`)

In production:
1. Deployed the web service ✅
2. **Forgot to deploy the worker service** ❌

## 📝 Checklist for Production Deployment

- [x] Build passes without TypeScript errors
- [x] Web service deployed
- [x] Environment variables configured
- [x] Database connection working
- [x] Templates visible
- [ ] **Worker service deployed** ⬅️ **YOU ARE HERE**
- [ ] Jobs processing successfully
- [ ] Reports generating correctly

## 🚨 Important Notes

1. **Two Separate Services**: The web and worker are separate Cloud Run services using the same codebase but different configurations.

2. **Worker Must Stay Running**: Set `--min-instances 1` so the worker is always polling for jobs.

3. **Only One Worker**: Set `--max-instances 1` to prevent duplicate job processing.

4. **Environment Variables**: Both services need the same Supabase credentials and workspace ID.

5. **Secrets**: Use Google Secret Manager for sensitive data (API keys, database credentials).

## 📚 Additional Resources

- Full deployment guide: `DEPLOYMENT.md`
- Worker implementation: `workers/worker-with-health.js`
- Job processing logic: `workers/worker.js`
- Start script: `scripts/start.js`

## 🆘 If Jobs Still Don't Process

1. **Check worker is running**:
   ```bash
   gcloud run services describe report-generator-worker --region europe-west1
   ```

2. **Check worker logs for errors**:
   ```bash
   gcloud run services logs read report-generator-worker --region europe-west1
   ```

3. **Verify environment variables**:
   ```bash
   gcloud run services describe report-generator-worker --region europe-west1 --format="value(spec.template.spec.containers[0].env)"
   ```

4. **Check database connection**: Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct.

5. **Check jobs table**: Query the database to see if jobs are being created:
   ```sql
   SELECT id, type, status, created_at 
   FROM jobs 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## ✨ After Worker Deployment

Once the worker is deployed and running:
1. Create a new report run from the UI
2. The job should move from `QUEUED` → `IN_PROGRESS` within seconds
3. Watch the worker logs to see progress
4. The report should complete successfully

---

**Next Step**: Run `./deploy-worker.sh` to deploy the worker service!




