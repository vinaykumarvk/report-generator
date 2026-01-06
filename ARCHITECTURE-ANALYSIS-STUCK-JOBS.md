# 🔍 Architecture Analysis: Database-Driven Job Queue

## 🚨 **Current Issue: Job Hanging**

**Job ID:** `4dba4520-9073-42af-9d90-57042e3b75f5`  
**Status:** Hanging/Stuck  
**Symptom:** Job not progressing, likely stuck in RUNNING or QUEUED state

---

## 🏗️ **Current Architecture**

### **Design: Database-Driven Queue**

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Web App    │────────▶│  Jobs Table  │◀────────│   Worker    │
│ (Next.js)   │  Insert │  (Supabase)  │  Poll   │ (Cloud Run) │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Lock/Claim
                              ▼
                        ┌──────────────┐
                        │ RPC Function │
                        │ claim_next_  │
                        │    job()     │
                        └──────────────┘
```

**How It Works:**
1. Web app creates a `job` record in database
2. Worker polls database every 1 second
3. Worker claims job using `claim_next_job()` RPC
4. Worker processes job
5. Worker updates job status to COMPLETED/FAILED

---

## ⚠️ **Known Issues with This Architecture**

### **1. Lock Expiration Problems**

**Issue:** Jobs can get stuck if:
- Worker crashes/restarts while processing
- Lock expires but job stays in RUNNING state
- Network issues prevent heartbeat updates

**Current Mitigation:**
- Lock expiration: 5 minutes
- Heartbeat every 60 seconds
- BUT: No automatic recovery for expired locks

### **2. Polling Overhead**

**Issue:**
- Worker polls database every 1 second
- Creates unnecessary database load
- Not scalable for many workers
- Introduces latency (up to 1 second delay)

### **3. Worker Restarts Cause Job Loss**

**Issue:**
- Cloud Run scales to zero when idle
- Worker restart loses in-flight jobs
- Jobs stay locked until timeout
- No graceful shutdown handling

### **4. No Visibility into Worker State**

**Issue:**
- Hard to tell if worker is actually processing
- No real-time progress updates
- Can't distinguish between:
  - Worker crashed
  - Worker busy with long-running task
  - Worker waiting for OpenAI API

### **5. Race Conditions (Partially Fixed)**

**Issue:**
- Multiple workers can try to claim same job
- `claim_next_job()` RPC helps but not perfect
- Database transactions can still conflict

---

## 🎯 **Root Causes of Current Stuck Job**

### **Most Likely Scenarios:**

#### **Scenario A: Expired Lock (70% probability)**
```sql
-- Job is RUNNING but lock expired
status = 'RUNNING'
locked_by = 'worker-123456789'
lock_expires_at < NOW()  -- Expired!
```

**Why:**
- Worker crashed/restarted
- Job stays in RUNNING state forever
- No auto-recovery mechanism

#### **Scenario B: Worker Processing But Appears Stuck (20% probability)**
```sql
-- Job is actually being processed
status = 'RUNNING'
locked_by = 'worker-current'
lock_expires_at > NOW()  -- Still valid
```

**Why:**
- OpenAI API call taking very long (>5 min timeout)
- Worker is responsive but task is slow
- No progress visibility

#### **Scenario C: Database Polling Failure (10% probability)**
```sql
-- Job ready but worker not claiming
status = 'QUEUED'
locked_by = NULL
scheduled_at <= NOW()
```

**Why:**
- Worker not polling (crashed/not running)
- Worker environment variables missing
- Database connection issues

---

## 🔧 **Immediate Diagnostic Steps**

### **Step 1: Run Diagnostic SQL**

```bash
# Copy scripts/diagnose-stuck-job.sql to Supabase SQL Editor and run
```

**This will tell you:**
- ✅ Job's exact status and lock state
- ✅ Whether lock is expired
- ✅ Associated run and section status
- ✅ All jobs in the queue
- ✅ Global queue health

### **Step 2: Check Worker Logs**

```bash
# If you have gcloud access:
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --limit 200

# Look for:
# - "Claimed job: 4dba4520..."
# - "Processing job..."
# - Any error messages
# - "Health check" (proves worker is alive)
```

### **Step 3: Check Worker Health**

```bash
# Test worker is responsive:
WORKER_URL=$(gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format='value(status.url)')

curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  $WORKER_URL/health
```

---

## 🛠️ **Immediate Fixes**

### **Fix 1: Release Expired Locks**

```sql
-- Run this in Supabase SQL Editor to release stuck jobs
UPDATE jobs
SET 
  status = 'QUEUED',
  locked_by = NULL,
  locked_at = NULL,
  lock_expires_at = NULL,
  updated_at = NOW()
WHERE id = '4dba4520-9073-42af-9d90-57042e3b75f5'
  AND (lock_expires_at < NOW() OR locked_at < NOW() - interval '10 minutes');
```

### **Fix 2: Restart Worker**

```bash
# Force worker to restart and pick up new code/config
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --clear-env-vars DUMMY=1

# Or just redeploy
gcloud run deploy report-generator-worker \
  --source . \
  --region europe-west1
```

### **Fix 3: Check Worker Environment**

```bash
# Verify worker has correct env vars
gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format="table(spec.template.spec.containers[0].env[].name,\
spec.template.spec.containers[0].env[].value)"

# Must have:
# - SERVICE_MODE=worker
# - NEXT_PUBLIC_SUPABASE_URL=...
# - SUPABASE_SERVICE_ROLE_KEY=...
# - OPENAI_API_KEY=...
```

---

## 🔄 **Better Architecture Options**

### **Option 1: Cloud Tasks (Recommended)**

**Pros:**
- ✅ No polling overhead
- ✅ Built-in retry logic
- ✅ Automatic dead-letter queue
- ✅ Scalable and reliable
- ✅ Visibility into task status
- ✅ Google-managed infrastructure

**Cons:**
- ⚠️ Migration effort (we have scripts ready!)
- ⚠️ Slightly more complex setup

**How It Works:**
```
Web App ──▶ Cloud Tasks ──▶ Worker HTTP Endpoint
              (Queue)         (Only runs when called)
```

**Status:** We have `scripts/deploy-with-cloud-tasks.sh` ready!

### **Option 2: Pub/Sub + Cloud Run**

**Pros:**
- ✅ Event-driven (no polling)
- ✅ Highly scalable
- ✅ Decoupled architecture
- ✅ Good for complex workflows

**Cons:**
- ⚠️ More complex than Cloud Tasks
- ⚠️ Requires Pub/Sub setup
- ⚠️ At-least-once delivery (need idempotency)

### **Option 3: Hybrid: Database + HTTP Trigger**

**Pros:**
- ✅ Minimal migration
- ✅ Keep database as source of truth
- ✅ Eliminate polling

**Cons:**
- ⚠️ Still has some DB-based issues
- ⚠️ Not as robust as Cloud Tasks

**How It Works:**
```
Web App ──▶ Database ──▶ Web App calls Worker HTTP
            (Insert)      (Trigger: /process-job)
```

**Status:** Already implemented in code! Just set `JOB_TRIGGER_MODE=http`

---

## 📊 **Architecture Comparison**

| Feature | Current (DB Poll) | Cloud Tasks | Pub/Sub | Hybrid (HTTP) |
|---------|-------------------|-------------|---------|---------------|
| **Reliability** | ⚠️ Medium | ✅ High | ✅ High | ✅ Good |
| **Scalability** | ❌ Poor | ✅ Excellent | ✅ Excellent | ✅ Good |
| **Latency** | ⚠️ 1-2s | ✅ < 100ms | ✅ < 100ms | ✅ < 500ms |
| **Visibility** | ❌ Poor | ✅ Excellent | ✅ Good | ✅ Good |
| **Retry Logic** | ⚠️ Manual | ✅ Built-in | ✅ Built-in | ⚠️ Manual |
| **Dead Letter** | ❌ None | ✅ Built-in | ✅ Built-in | ❌ None |
| **Cost** | ✅ Low | ✅ Low | ⚠️ Medium | ✅ Low |
| **Setup Complexity** | ✅ Simple | ⚠️ Medium | ❌ Complex | ✅ Simple |
| **Migration Effort** | - | ⚠️ Medium | ❌ High | ✅ Minimal |

---

## 🎯 **Recommendation**

### **Short-term (Today):**
1. ✅ Run diagnostic SQL to identify issue
2. ✅ Release expired locks
3. ✅ Verify worker environment variables
4. ✅ Ensure worker is running with `min-instances=1`

### **Medium-term (This Week):**
**Migrate to HTTP Trigger Mode** (Minimal effort, big improvement)

```bash
# 1. Update web service
gcloud run services update report-generator-web \
  --set-env-vars "JOB_TRIGGER_MODE=http,\
WORKER_TRIGGER_URL=https://report-generator-worker-xxx.run.app/process-job,\
WORKER_TRIGGER_SECRET=<generate-secret>"

# 2. Update worker service
gcloud run services update report-generator-worker \
  --set-env-vars "WORKER_TRIGGER_SECRET=<same-secret>"

# 3. Keep min-instances=1 for worker (or use Cloud Tasks)
```

**Benefits:**
- ✅ No polling overhead
- ✅ Instant job processing
- ✅ Better visibility
- ✅ Same database as source of truth

### **Long-term (Next Sprint):**
**Migrate to Cloud Tasks** (Best solution)

```bash
# Use the ready-made script:
./scripts/deploy-with-cloud-tasks.sh
```

**Benefits:**
- ✅ Production-grade reliability
- ✅ Built-in retry and DLQ
- ✅ Google-managed infrastructure
- ✅ Better cost optimization (scale to zero)

---

## 🔍 **Why Database Polling is Problematic**

### **Fundamental Issues:**

1. **Inherent Latency**
   - Worker checks every 1 second
   - Job might wait up to 1 second before processing
   - Not suitable for real-time requirements

2. **Resource Waste**
   - Database queries every second (even when idle)
   - Worker always running (`min-instances=1` required)
   - Costs money even with no jobs

3. **Lock Management Complexity**
   - Locks can expire
   - No automatic cleanup
   - Race conditions possible
   - Hard to debug

4. **Scalability Limits**
   - Can't scale to many workers easily
   - Database becomes bottleneck
   - Polling creates load

5. **Poor Observability**
   - Can't tell if worker is healthy
   - No visibility into progress
   - Hard to debug stuck jobs

---

## ✅ **Action Plan**

### **Immediate (Next 10 minutes):**
1. [ ] Run `scripts/diagnose-stuck-job.sql` in Supabase
2. [ ] Share results
3. [ ] Apply fix based on diagnosis

### **Today:**
1. [ ] Verify worker environment variables are set
2. [ ] Ensure `min-instances=1` for worker
3. [ ] Add monitoring/alerting for stuck jobs

### **This Week:**
1. [ ] Migrate to HTTP Trigger mode
2. [ ] Test thoroughly
3. [ ] Document new flow

### **Next Sprint:**
1. [ ] Evaluate Cloud Tasks migration
2. [ ] Run `scripts/deploy-with-cloud-tasks.sh`
3. [ ] Migrate to Cloud Tasks

---

## 📝 **Conclusion**

**Is the architecture faulty?**  
**Yes, for production use.** Database polling is:
- ❌ Not production-grade
- ❌ Hard to debug
- ❌ Prone to stuck jobs
- ❌ Resource-intensive

**Should we migrate?**  
**Yes, but in stages:**
1. **Today:** Fix the immediate stuck job
2. **This week:** Migrate to HTTP trigger (easy win)
3. **Next sprint:** Migrate to Cloud Tasks (best solution)

**The good news:**
- ✅ We have migration paths ready
- ✅ Code already supports HTTP trigger mode
- ✅ Cloud Tasks script is ready
- ✅ Migration is straightforward

---

**Let's fix the immediate issue first, then plan the migration!**

Please run `scripts/diagnose-stuck-job.sql` in Supabase SQL Editor and share the results. That will tell us exactly what's wrong with job `4dba4520-9073-42af-9d90-57042e3b75f5`.



