# 🔐 Deployment Environment Variables Guide

## ✅ **Short Answer: NO new variables needed for indexes!**

The database indexes are created **directly in the database** using SQL scripts. They don't require any environment variables.

However, here's what you **currently have** and what you **might need** for optimal performance:

---

## 📊 **Current Deployment Configuration**

### **Worker Service** (`report-generator-worker`)

#### ✅ Already Configured:
```bash
SERVICE_MODE=worker
NODE_ENV=production
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
```

#### 🔴 **MISSING (Critical for worker to run):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...
```

**These are REQUIRED!** Without them, the worker cannot:
- Connect to Supabase database
- Fetch jobs
- Call OpenAI APIs
- Store results

---

### **Web Service** (`report-generator-web`)

Should already have these from your Cloud Tasks deployment:

```bash
SERVICE_MODE=web
JOB_TRIGGER_MODE=cloud-tasks
CLOUD_TASKS_PROJECT=wealth-report
CLOUD_TASKS_LOCATION=europe-west1
CLOUD_TASKS_QUEUE=report-generator-queue
WORKER_TRIGGER_URL=https://report-generator-worker-xxx.run.app/process-job
WORKER_TRIGGER_SECRET=<generated-secret>
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
```

---

## 🚀 **How to Update Worker Environment Variables**

### **Option 1: Quick Update (Single Command)**

```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --set-env-vars "SERVICE_MODE=worker,\
NODE_ENV=production,\
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4,\
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,\
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY,\
OPENAI_API_KEY=YOUR_OPENAI_KEY"
```

**⚠️ Replace:**
- `YOUR_PROJECT` - Your actual Supabase project subdomain
- `YOUR_SERVICE_ROLE_KEY` - Your Supabase service role key
- `YOUR_OPENAI_KEY` - Your OpenAI API key

---

### **Option 2: Interactive Update (Safer)**

```bash
# 1. Get your current Supabase URL
echo "Your Supabase URL:"
gcloud run services describe report-generator-web \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env.filter(name:NEXT_PUBLIC_SUPABASE_URL).value)"

# 2. Update worker with the same credentials
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --update-env-vars NEXT_PUBLIC_SUPABASE_URL=<PASTE_URL_HERE>

# 3. Add service role key
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --update-env-vars SUPABASE_SERVICE_ROLE_KEY=<PASTE_KEY_HERE>

# 4. Add OpenAI key
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --update-env-vars OPENAI_API_KEY=<PASTE_KEY_HERE>
```

---

### **Option 3: Use Secrets Manager (Most Secure) ⭐**

Instead of passing keys directly, use Google Cloud Secrets Manager:

```bash
# 1. Create secrets (one-time setup)
echo -n "YOUR_SUPABASE_SERVICE_ROLE_KEY" | \
  gcloud secrets create supabase-service-role-key --data-file=-

echo -n "YOUR_OPENAI_API_KEY" | \
  gcloud secrets create openai-api-key --data-file=-

# 2. Update worker to use secrets
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --update-secrets=SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,\
OPENAI_API_KEY=openai-api-key:latest
```

**Benefits:**
- ✅ Keys not visible in Cloud Run console
- ✅ Automatic rotation support
- ✅ Audit logging
- ✅ Better security compliance

---

## 🔍 **How to Check Current Variables**

### Check Worker Variables:
```bash
gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format="table(spec.template.spec.containers[0].env[].name,\
spec.template.spec.containers[0].env[].value)"
```

### Check Web Variables:
```bash
gcloud run services describe report-generator-web \
  --region europe-west1 \
  --format="table(spec.template.spec.containers[0].env[].name,\
spec.template.spec.containers[0].env[].value)"
```

---

## 🎯 **Performance Tuning Variables (Optional)**

After adding the indexes, you might want to tune these:

### Worker Performance:
```bash
# Increase timeout for long reports
--timeout 3600

# Increase memory for large documents
--memory 2Gi

# Increase CPU for faster processing
--cpu 2

# Scale to multiple workers (if needed)
--min-instances 1
--max-instances 5
```

### OpenAI Timeout:
```bash
# Add this to worker env vars if you want longer timeouts
OPENAI_TIMEOUT=300000  # 5 minutes (default is 10 seconds)
```

**Update command:**
```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --update-env-vars OPENAI_TIMEOUT=300000
```

---

## 📋 **Complete Deployment Checklist**

### Phase 1: Database Indexes ✅
- [x] Create indexes using `scripts/add-indexes-simple.sql`
- [x] Verify indexes with verification query
- No deployment needed - indexes are in database!

### Phase 2: Update Worker Environment Variables 🔄
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Add `OPENAI_API_KEY`
- [ ] Verify worker restarts successfully
- [ ] Check worker logs for connection

### Phase 3: Test 🧪
- [ ] Create a new report run
- [ ] Verify job appears in database
- [ ] Check worker logs - should show job processing
- [ ] Verify sections generate successfully
- [ ] Test export functionality

### Phase 4: Monitor 📊
- [ ] Watch worker logs for errors
- [ ] Check job processing speed (should be faster!)
- [ ] Monitor Cloud Run metrics
- [ ] Verify no queued jobs stuck

---

## 🆘 **Troubleshooting**

### Worker not processing jobs?

**Check logs:**
```bash
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --limit 100
```

**Look for:**
- ❌ "Supabase credentials not found" → Missing `SUPABASE_SERVICE_ROLE_KEY`
- ❌ "Invalid JWT" → Wrong `SUPABASE_SERVICE_ROLE_KEY`
- ❌ "OpenAI API key not found" → Missing `OPENAI_API_KEY`
- ✅ "Polling for jobs..." → Worker is running!

---

### Web service can't trigger worker?

**Check these variables in web service:**
```bash
WORKER_TRIGGER_URL=<should match worker URL>/process-job
WORKER_TRIGGER_SECRET=<must match worker's secret>
```

---

### Database connection errors?

**Verify Supabase URL format:**
```bash
# ✅ Correct:
NEXT_PUBLIC_SUPABASE_URL=https://abcdefg.supabase.co

# ❌ Wrong:
NEXT_PUBLIC_SUPABASE_URL=https://abcdefg.supabase.co/
NEXT_PUBLIC_SUPABASE_URL=abcdefg.supabase.co
```

---

## 🎬 **Quick Start: Update Worker Now**

**Copy and customize this command:**

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

**After running:**
1. Worker will restart automatically
2. Check logs: `gcloud run services logs read report-generator-worker --region europe-west1 --limit 20`
3. Should see: "Polling for jobs..." or "Health check server started"
4. Test by creating a new report!

---

## 📚 **Where to Find Your Keys**

### Supabase URL & Service Role Key:
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - service_role key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

### OpenAI API Key:
1. Go to: https://platform.openai.com/api-keys
2. Create new key or copy existing
3. Format: `sk-...`

### Your Web Service Variables:
```bash
# See what the web service is using:
gcloud run services describe report-generator-web \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"
```

---

## ✅ **Summary**

### For Database Indexes:
**NO environment variables needed!** Just run the SQL script in Supabase.

### For Worker to Function:
**YES, add these 3 variables:**
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`
3. `OPENAI_API_KEY`

**Use the quick start command above with your actual keys!**

---

**Need help?** Share any error messages and I'll provide the exact fix! 🔧

