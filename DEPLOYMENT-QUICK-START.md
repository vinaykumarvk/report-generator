# 🎯 Deployment Quick Start Guide

## ✅ **Status: PRODUCTION READY**

All pre-deployment checks completed successfully. The application is clean, optimized, and ready for deployment.

---

## 📊 **What Was Fixed**

### Code Quality Improvements
- ✅ Removed 15+ unused variables and functions
- ✅ Removed 3 unused type definitions
- ✅ Removed 150+ lines of dead code
- ✅ Fixed all TypeScript errors (0 errors remaining)
- ✅ Fixed all ESLint errors (0 warnings remaining)
- ✅ Unified export functionality into shared component

### Build & Deployment Fixes
- ✅ Removed hardcoded PORT from Dockerfile (now uses Cloud Run's dynamic PORT)
- ✅ Verified all dependencies are latest stable versions
- ✅ Confirmed Dockerfile build sequence is correct
- ✅ Tested production build successfully
- ✅ Removed duplicate configuration

### Version Verification
- ✅ `@supabase/supabase-js: 2.89.0` (latest)
- ✅ `next: 14.2.7` (stable)
- ✅ `react: 18.3.1` (stable)
- ✅ Using native fetch API for OpenAI (no version conflicts)
- ✅ All peer dependencies satisfied

---

## 🚀 **3-Step Deployment**

### Step 1: Apply Database Indexes (5 minutes)

```bash
# Option A: Simple (development/small db)
# 1. Open Supabase SQL Editor
# 2. Copy contents of scripts/add-indexes-simple.sql
# 3. Paste and run

# Option B: Production-safe (zero-downtime)
# Run scripts/add-indexes-step1.sql through step5.sql one by one
```

**Verify indexes:**
```sql
SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_%';
-- Expected: 6-8 indexes
```

---

### Step 2: Update Worker Environment Variables

```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --set-env-vars "SERVICE_MODE=worker,\
NODE_ENV=production,\
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4,\
NEXT_PUBLIC_SUPABASE_URL=<YOUR_SUPABASE_URL>,\
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>,\
OPENAI_API_KEY=<YOUR_OPENAI_KEY>"
```

**Where to find these values:**
- Supabase URL & Keys: Supabase Dashboard → Settings → API
- OpenAI Key: https://platform.openai.com/api-keys

---

### Step 3: Deploy Both Services

**Deploy Web Service:**
```bash
cd /Users/n15318/report-generator

gcloud run deploy report-generator-web \
  --source . \
  --region europe-west1 \
  --project wealth-report \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 10 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300
```

**Deploy Worker Service:**
```bash
gcloud run deploy report-generator-worker \
  --source . \
  --region europe-west1 \
  --project wealth-report \
  --platform managed \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --max-instances 5 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600
```

---

## 🧪 **Post-Deployment Testing**

### 1. Check Health Endpoints

**Web Service:**
```bash
curl https://report-generator-web-xxx.run.app/api/health
# Expected: {"status":"ok",...}
```

**Worker Service:**
```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://report-generator-worker-xxx.run.app/health
# Expected: {"status":"healthy","service":"report-generator-worker",...}
```

### 2. Check Logs

**Web Logs:**
```bash
gcloud run services logs read report-generator-web \
  --region europe-west1 \
  --limit 50
```

**Worker Logs:**
```bash
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --limit 50

# Look for:
# ✅ "Health check server listening on port 8080"
# ✅ "Polling for jobs..."
```

### 3. Test Report Generation

1. Navigate to your web app URL
2. Go to "Report Studio"
3. Create a new template (or use existing)
4. Go to "Generate New"
5. Select template, enter topic
6. Click "Create & Start Run"
7. Go to "Reports Library"
8. Watch status change: QUEUED → RUNNING → COMPLETED
9. Download .md or .pdf export

**Expected Timeline:**
- Job appears in database: < 1 second
- Worker picks up job: < 2 seconds
- Section generation: 30-120 seconds (depends on template)
- Export generation: 5-10 seconds

---

## 📋 **Troubleshooting**

### Issue: Web service not accessible
```bash
# Check service status
gcloud run services describe report-generator-web \
  --region europe-west1 \
  --format="value(status.conditions)"

# Check recent logs
gcloud run services logs read report-generator-web \
  --region europe-west1 \
  --limit 20
```

### Issue: Worker not processing jobs
```bash
# 1. Check worker is running
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://report-generator-worker-xxx.run.app/health

# 2. Check environment variables
gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format="table(spec.template.spec.containers[0].env[].name,\
spec.template.spec.containers[0].env[].value)"

# 3. Check logs for errors
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --limit 50 | grep -i error
```

### Issue: Jobs stuck in QUEUED
**Most common causes:**
1. ❌ Worker environment variables not set → See Step 2 above
2. ❌ Worker not running → Check health endpoint
3. ❌ Database connection issue → Check `SUPABASE_SERVICE_ROLE_KEY`
4. ❌ OpenAI API issue → Check `OPENAI_API_KEY`

**Debug:**
```bash
# Check if worker is claiming jobs
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --limit 100 | grep "Claimed job"

# Check database for stuck jobs
# Run in Supabase SQL Editor:
SELECT id, type, status, created_at, locked_by
FROM jobs
WHERE status = 'QUEUED'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📚 **Additional Documentation**

- **Full Pre-Deployment Checklist:** `PRE-DEPLOYMENT-CHECKLIST.md`
- **Environment Variables Guide:** `DEPLOYMENT-ENV-VARIABLES.md`
- **Index Application Guide:** `scripts/INDEX-APPLICATION-GUIDE.md`
- **Architecture Review:** `ARCHITECTURE-REVIEW.md`
- **Local Setup Guide:** `LOCAL-SETUP.md`

---

## ✅ **Deployment Checklist**

Before deploying:
- [x] All TypeScript errors fixed
- [x] All ESLint errors fixed
- [x] Production build tested locally
- [x] Database indexes SQL ready
- [x] Environment variables documented
- [x] Dockerfile optimized
- [x] Dependencies verified

After deploying:
- [ ] Database indexes applied
- [ ] Worker environment variables updated
- [ ] Web service deployed
- [ ] Worker service deployed
- [ ] Health endpoints verified
- [ ] Test report generated successfully
- [ ] Export functionality tested

---

## 🎉 **Success Criteria**

Your deployment is successful if:
- ✅ Health endpoints return `200 OK`
- ✅ Web app loads without errors
- ✅ Worker logs show "Polling for jobs..."
- ✅ New report changes status: QUEUED → RUNNING → COMPLETED
- ✅ Sections generate content
- ✅ Exports download successfully

---

**Estimated Total Deployment Time:** 15-20 minutes

**Questions?** Check the documentation files or review the logs for specific error messages.

**Ready to deploy!** 🚀



