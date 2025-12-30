# Quick Fix: Worker Not Processing Jobs

## Problem

✅ Worker service is deployed  
❌ But `SERVICE_MODE=worker` is NOT set  
❌ Jobs stuck in QUEUED status

## Solution

Run this command in your **Cloud Shell**:

```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --set-env-vars 'SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4'
```

## What This Does

Sets three critical environment variables:
- `SERVICE_MODE=worker` - Tells the app to run as a worker
- `NODE_ENV=production` - Sets production mode
- `DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4` - Sets workspace ID

## After Running the Command

1. **Wait 30 seconds** for the service to restart

2. **Verify it's working:**
   ```bash
   gcloud run services logs read report-generator-worker --region europe-west1 --limit 50
   ```
   
   Look for: `🚀 Starting in WORKER mode...`

3. **Test with a job:**
   - Create a report run from the web UI
   - Watch the logs:
     ```bash
     gcloud run services logs read report-generator-worker --region europe-west1 --follow
     ```
   - You should see: `Processing job: <job-id>`

## Expected Result

Jobs will now process automatically:
- QUEUED → IN_PROGRESS → COMPLETED

## If Still Not Working

Run the verification script:
```bash
./scripts/verify-services-config.sh
```

Check for other configuration issues.

---

**Need Help?** See:
- `ARCHITECTURE.md` - How services communicate
- `WORKER-MONITORING.md` - Monitoring guide
- `PRODUCTION-FIX.md` - Detailed troubleshooting

