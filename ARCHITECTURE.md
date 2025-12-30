# Application Architecture

## How Web and Worker Services Communicate

**Important:** The web service and worker service **DO NOT** communicate directly with each other. They communicate through the **Supabase database** using a job queue pattern.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ARCHITECTURE                                    │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐                    ┌──────────────────────┐
│   Web Service        │                    │   Worker Service     │
│   (report-generator) │                    │ (report-generator-   │
│                      │                    │       worker)        │
│  - User Interface    │                    │                      │
│  - API Routes        │                    │  - Job Processor     │
│  - Creates Jobs      │                    │  - Polls for Jobs    │
│                      │                    │  - Processes Reports │
└──────────┬───────────┘                    └──────────┬───────────┘
           │                                           │
           │         ┌─────────────────────┐          │
           │         │                     │          │
           └────────►│   Supabase DB       │◄─────────┘
                     │                     │
                     │  ┌───────────────┐  │
                     │  │  jobs table   │  │
                     │  │               │  │
                     │  │ QUEUED ───────┼──┼──► Worker picks up
                     │  │ IN_PROGRESS   │  │
                     │  │ COMPLETED     │  │
                     │  │ FAILED        │  │
                     │  └───────────────┘  │
                     │                     │
                     │  Other tables:      │
                     │  - templates        │
                     │  - runs             │
                     │  - workspaces       │
                     └─────────────────────┘
```

## Communication Flow

### 1. Job Creation (Web Service)

When a user starts a report:

```javascript
// In web service API route
const { data: job } = await supabase
  .from('jobs')
  .insert({
    type: 'START_RUN',
    status: 'QUEUED',
    payload: { runId: '...' },
    workspace_id: '...'
  })
  .select()
  .single();

// Job is now in database with status: QUEUED
```

### 2. Job Processing (Worker Service)

The worker continuously polls the database:

```javascript
// In worker service
setInterval(async () => {
  // 1. Find next QUEUED job
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'QUEUED')
    .order('created_at', { ascending: true })
    .limit(1);

  if (jobs && jobs.length > 0) {
    const job = jobs[0];
    
    // 2. Mark as IN_PROGRESS
    await supabase
      .from('jobs')
      .update({ status: 'IN_PROGRESS' })
      .eq('id', job.id);
    
    // 3. Process the job
    await processJob(job);
    
    // 4. Mark as COMPLETED
    await supabase
      .from('jobs')
      .update({ status: 'COMPLETED' })
      .eq('id', job.id);
  }
}, 5000); // Poll every 5 seconds
```

### 3. Status Updates (Web Service)

The web service checks job status:

```javascript
// In web service API route
const { data: job } = await supabase
  .from('jobs')
  .select('*')
  .eq('id', jobId)
  .single();

// Returns: { status: 'COMPLETED', ... }
```

## Key Points

### ✅ No Direct Communication Required

- Web and worker services are **completely independent**
- They **never** make HTTP requests to each other
- They only share the **same database**

### ✅ Both Services Need

1. **Same Supabase credentials:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Same workspace ID:**
   - `DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`

3. **Different service mode:**
   - Web: `SERVICE_MODE=web`
   - Worker: `SERVICE_MODE=worker`

### ✅ Service Names Don't Matter

The service names (`report-generator`, `report-generator-worker`) are just for Cloud Run identification. They don't affect communication because there is no direct communication!

## Verification Checklist

### 1. Check Both Services Have Same Database

**Web Service:**
```bash
gcloud run services describe report-generator \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" | grep SUPABASE
```

**Worker Service:**
```bash
gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" | grep SUPABASE
```

Both should have the **same** `NEXT_PUBLIC_SUPABASE_URL`.

### 2. Check Both Services Have Same Workspace ID

**Web Service:**
```bash
gcloud run services describe report-generator \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" | grep WORKSPACE
```

**Worker Service:**
```bash
gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" | grep WORKSPACE
```

Both should have: `DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`

### 3. Check Service Modes Are Different

**Web Service:**
```bash
gcloud run services describe report-generator \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" | grep SERVICE_MODE
```

Should show: `name: SERVICE_MODE, value: web`

**Worker Service:**
```bash
gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" | grep SERVICE_MODE
```

Should show: `name: SERVICE_MODE, value: worker`

### 4. Test End-to-End

1. **Create a job** (via web UI or API)
2. **Check database** - job should be QUEUED
3. **Wait 5-10 seconds**
4. **Check database again** - job should be IN_PROGRESS or COMPLETED
5. **Check worker logs** - should see job processing

```bash
# Follow worker logs in real-time
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --follow
```

## Troubleshooting

### Jobs Stay in QUEUED Status

**Possible causes:**

1. **Worker not running**
   ```bash
   gcloud run services list --region europe-west1
   # Should see report-generator-worker
   ```

2. **Worker has wrong SERVICE_MODE**
   ```bash
   gcloud run services describe report-generator-worker \
     --region europe-west1 \
     --format="value(spec.template.spec.containers[0].env)" | grep SERVICE_MODE
   # Should be: worker
   ```

3. **Worker can't connect to database**
   ```bash
   gcloud run services logs read report-generator-worker \
     --region europe-west1 \
     --limit 50 | grep -i "error\|failed\|connection"
   ```

4. **Worker and web using different databases**
   ```bash
   # Compare SUPABASE_URL in both services
   # They MUST be identical
   ```

5. **Worker and web using different workspace IDs**
   ```bash
   # Compare DEFAULT_WORKSPACE_ID in both services
   # They MUST be identical
   ```

### Worker Logs Show "No jobs found"

This is **normal** if no jobs are queued. The worker polls every 5 seconds and will show this message when the queue is empty.

### Worker Logs Show Database Errors

Check Supabase credentials:
```bash
gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"
```

Verify:
- `NEXT_PUBLIC_SUPABASE_URL` is correct
- `SUPABASE_SERVICE_ROLE_KEY` secret is set correctly

## Database Schema

The `jobs` table is the communication channel:

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL,           -- 'START_RUN', 'EXPORT', etc.
  status TEXT NOT NULL,         -- 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
  payload JSONB NOT NULL,       -- Job-specific data
  result JSONB,                 -- Job result (set by worker)
  error TEXT,                   -- Error message if failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,       -- When worker picked it up
  completed_at TIMESTAMPTZ      -- When worker finished
);
```

## Summary

- ✅ Services communicate via **database**, not HTTP
- ✅ Service names don't matter for communication
- ✅ Both services must have **same database credentials**
- ✅ Both services must have **same workspace ID**
- ✅ Worker polls database every 5 seconds for new jobs
- ✅ No service discovery or networking configuration needed

The worker is **already discoverable** by the web service because they both connect to the same database!

