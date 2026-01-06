# Local Worker Setup Guide

## Quick Start

### Option 1: Using the Local Start Script (Recommended)

```bash
npm run worker:local
```

This script:
- ✅ Automatically uses `.env.local`
- ✅ Finds an available port (starts at 18081)
- ✅ Sets up HTTP trigger mode for local development
- ✅ Handles port conflicts gracefully

### Option 2: Manual Start

```bash
PORT=18081 \
JOB_TRIGGER_MODE=http \
WORKER_TRIGGER_URL=http://localhost:18081/process-job \
WORKER_TRIGGER_SECRET=local-dev-secret \
node workers/worker-with-health.js
```

## Configuration

### Environment Variables

The worker needs these in `.env.local`:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (Required)
OPENAI_API_KEY=sk-proj-...

# Worker Configuration (Optional)
PORT=18081                                    # Default: 18081
JOB_TRIGGER_MODE=http                        # Default: http (for local)
WORKER_TRIGGER_URL=http://localhost:18081/process-job
WORKER_TRIGGER_SECRET=local-dev-secret       # Auto-generated if not set
HOST=127.0.0.1                               # Default: 127.0.0.1 (localhost)
```

### Web App Configuration

For the web app to trigger the worker, set in `.env.local`:

```bash
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_URL=http://localhost:18081/process-job
WORKER_TRIGGER_SECRET=local-dev-secret  # Must match worker's secret
```

## Troubleshooting

### Port Already in Use

The script automatically finds the next available port. If you want to use a specific port:

```bash
PORT=18082 npm run worker:local
```

### Worker Not Processing Jobs

1. **Check worker is running:**
   ```bash
   curl http://localhost:18081/health
   ```

2. **Check worker logs:**
   Look for:
   - `✅ Health check server listening on 127.0.0.1:18081`
   - `[DBQueue] Using Supabase host: ...`
   - `🚀 HTTP trigger mode enabled; polling is disabled.`

3. **Verify Supabase credentials:**
   - Check `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`
   - Worker logs should show the Supabase host

4. **Manually trigger a job:**
   ```bash
   curl -X POST http://localhost:18081/process-job \
     -H "Content-Type: application/json" \
     -H "X-Worker-Trigger: local-dev-secret" \
     -d '{"jobId": "your-job-id"}'
   ```

### Worker Can't See Jobs

If the worker returns `no_job`:

1. **Check Supabase credentials:**
   ```bash
   # Worker should log: [DBQueue] Using Supabase host: ...
   # If this is missing, credentials aren't loaded
   ```

2. **Verify job exists in database:**
   ```sql
   SELECT id, type, status, run_id 
   FROM jobs 
   WHERE status = 'QUEUED' 
   ORDER BY created_at 
   LIMIT 5;
   ```

3. **Check job trigger configuration:**
   - Web app must have `JOB_TRIGGER_MODE=http`
   - `WORKER_TRIGGER_URL` must match worker's port
   - `WORKER_TRIGGER_SECRET` must match on both sides

## Testing the Setup

1. **Start the worker:**
   ```bash
   npm run worker:local
   ```

2. **In another terminal, check health:**
   ```bash
   curl http://localhost:18081/health
   ```

3. **Create a report run** (via web UI or API)

4. **Check worker logs** - should see job processing

## Port Binding

- **Local development:** Binds to `127.0.0.1` (localhost only)
- **Production:** Binds to `0.0.0.0` (all interfaces)

Override with `HOST` environment variable:
```bash
HOST=0.0.0.0 npm run worker:local  # Allow external connections
```

## Next Steps

After the worker is running:

1. ✅ Verify health endpoint responds
2. ✅ Check worker logs show Supabase connection
3. ✅ Create a test report run
4. ✅ Watch worker process the job
5. ✅ Verify report completes successfully

