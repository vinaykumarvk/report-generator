# Environment Variables Reference

## Required Environment Variables

### Essential (Must Have)

These are **absolutely required** for the worker to function:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVICE_MODE` | ✅ Yes | - | Must be `worker` for worker service, `web` for web service |
| `NODE_ENV` | ✅ Yes | - | Set to `production` for production deployment |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | - | Your Supabase project URL (e.g., `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | - | Supabase service role key (starts with `eyJhbGc...`) |
| `OPENAI_API_KEY` | ✅ Yes | - | OpenAI API key (starts with `sk-...`) |
| `DEFAULT_WORKSPACE_ID` | ✅ Yes | - | Workspace UUID (e.g., `c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`) |

### Optional (Nice to Have)

These have sensible defaults but can be customized:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_REVIEW_MODEL` | ❌ No | `gpt-4o-mini` | Model used for reviewing/validating outputs |
| `SUPABASE_DB_PASSWORD` | ❌ No | - | Direct database password (not needed if using Supabase client) |
| `SUPABASE_EXPORTS_BUCKET` | ❌ No | `exports` | Supabase Storage bucket for report exports |
| `PORT` | ❌ No | `8080` | Port for health check server (Cloud Run sets this automatically) |
| `JOB_TRIGGER_MODE` | ❌ No | `db` | Job trigger mode: `db` (polling), `http` (event-driven), `cloud-tasks`, or `none` |
| `WORKER_TRIGGER_URL` | ❌ No | - | HTTP endpoint for triggering the worker (`/process-job`) |
| `WORKER_TRIGGER_SECRET` | ❌ No | - | Shared secret for worker trigger requests |
| `WORKER_POLL_INTERVAL_MS` | ❌ No | `1000` | Polling interval in ms when using DB polling |
| `WORKER_POLLING_ENABLED` | ❌ No | - | Set `true` to enable polling even when in `http` trigger mode |
| `CLOUD_TASKS_PROJECT` | ❌ No | - | Google Cloud project ID for Cloud Tasks |
| `CLOUD_TASKS_LOCATION` | ❌ No | - | Cloud Tasks location (e.g., `europe-west1`) |
| `CLOUD_TASKS_QUEUE` | ❌ No | - | Cloud Tasks queue name |
| `WORKER_TASK_SERVICE_ACCOUNT` | ❌ No | - | Service account email for Cloud Tasks OIDC (optional) |
| `CLOUD_TASKS_ACCESS_TOKEN` | ❌ No | - | Override access token for Cloud Tasks (local testing) |

---

## Detailed Breakdown

### 1. SERVICE_MODE
**Required:** ✅ Yes  
**Values:** `web` or `worker`

```bash
# For web service
SERVICE_MODE=web

# For worker service
SERVICE_MODE=worker
```

**Why it's needed:** This tells the application whether to run as a web server or a background worker.

---

### 2. NODE_ENV
**Required:** ✅ Yes  
**Values:** `production`, `development`, `test`

```bash
NODE_ENV=production
```

**Why it's needed:** Enables production optimizations and proper logging.

---

### 3. NEXT_PUBLIC_SUPABASE_URL
**Required:** ✅ Yes  
**Format:** `https://YOUR_PROJECT.supabase.co`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
```

**Why it's needed:** The worker needs to connect to Supabase to:
- Fetch jobs from the `jobs` table
- Read templates and prompts
- Store run results
- Update job statuses

**Where to find it:**
1. Supabase Dashboard → Settings → API → Project URL
2. Or check your web service configuration

---

### 4. SUPABASE_SERVICE_ROLE_KEY
**Required:** ✅ Yes  
**Format:** Starts with `eyJhbGc...`

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Why it's needed:** Provides full database access for server-side operations. The worker needs this to:
- Read/write jobs
- Update run statuses
- Store generated content

**Where to find it:**
1. Supabase Dashboard → Settings → API → `service_role` key (secret)
2. **Warning:** Keep this secret! Never expose in client-side code.

---

### 5. SUPABASE_EXPORTS_BUCKET
**Required:** ❌ No  
**Default:** `exports`

```bash
SUPABASE_EXPORTS_BUCKET=exports
```

**Why it's needed:** Tells the app which Supabase Storage bucket to store exports in.

---

### 6. JOB_TRIGGER_MODE
**Required:** ❌ No  
**Default:** `db`

```bash
JOB_TRIGGER_MODE=cloud-tasks
```

**Why it's needed:** Controls whether the worker polls the DB (`db`) or waits for HTTP/Cloud Tasks triggers. When set to `cloud-tasks` or `http`, polling is disabled unless `WORKER_POLLING_ENABLED=true`.

---

### 7. OPENAI_API_KEY
**Required:** ✅ Yes  
**Format:** Starts with `sk-...`

```bash
OPENAI_API_KEY=sk-proj-...
```

**Why it's needed:** The worker uses OpenAI to:
- Generate report content
- Process sections
- Create embeddings
- Review outputs

**Where to find it:**
1. OpenAI Dashboard → API Keys
2. Create a new key if you don't have one

---

### 6. DEFAULT_WORKSPACE_ID
**Required:** ✅ Yes  
**Format:** UUID (e.g., `c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`)

```bash
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
```

**Why it's needed:** Ensures the worker processes jobs for the correct workspace. Without this:
- Worker might not find jobs (different workspace)
- Templates might not be visible
- Data isolation breaks

**Where to find it:**
1. Run the diagnostic script: `node scripts/diagnose-workspace.js`
2. Or query your database: `SELECT id FROM workspaces WHERE name = 'Default Workspace'`

---

### 7. OPENAI_REVIEW_MODEL (Optional)
**Required:** ❌ No  
**Default:** `gpt-4o-mini`

```bash
OPENAI_REVIEW_MODEL=gpt-4o-mini
```

**Why it's optional:** The code has a default value:
```typescript
function getModel() {
  return process.env.OPENAI_REVIEW_MODEL || "gpt-4o-mini";
}
```

**When to set it:** If you want to use a different model for reviewing outputs (e.g., `gpt-4o`, `gpt-4-turbo`).

---

### 8. SUPABASE_DB_PASSWORD (Optional)
**Required:** ❌ No  
**Default:** Not used

```bash
SUPABASE_DB_PASSWORD=your-password
```

**Why it's optional:** The application uses the Supabase client library with the service role key, not direct database connections. This variable is listed in `DEPLOYMENT.md` but isn't actually used in the code.

**When you might need it:** Only if you're making direct PostgreSQL connections (which this app doesn't do).

---

### 9. PORT (Optional)
**Required:** ❌ No  
**Default:** `8080`

```bash
PORT=8080
```

**Why it's optional:** Cloud Run automatically sets this. The worker's health check server uses it.

**When to set it:** Only for local development if you want a different port.

---

### 10. JOB_TRIGGER_MODE (Optional)
**Required:** ❌ No  
**Default:** `db`  
**Values:** `db`, `http`, `cloud-tasks`, `none`

```bash
JOB_TRIGGER_MODE=db
```

**Why it's optional:** Keeps the current DB polling behavior by default. Set to `http` to trigger the worker via HTTP when jobs are created.

---

### 11. WORKER_TRIGGER_URL (Optional)
**Required:** ❌ No  
**Default:** Not set

```bash
WORKER_TRIGGER_URL=https://YOUR-WORKER-URL/process-job
```

**Why it's optional:** Needed only when `JOB_TRIGGER_MODE=http` so the web service can wake the worker on job creation.

---

### 12. WORKER_TRIGGER_SECRET (Optional)
**Required:** ❌ No  
**Default:** Not set

```bash
WORKER_TRIGGER_SECRET=your-shared-secret
```

**Why it's optional:** Secures the worker trigger endpoint. If set, the worker expects `x-worker-trigger` header to match.

---

### 13. WORKER_POLL_INTERVAL_MS (Optional)
**Required:** ❌ No  
**Default:** `1000`

```bash
WORKER_POLL_INTERVAL_MS=1000
```

**Why it's optional:** Controls how frequently the worker polls when using DB polling.

---

### 14. WORKER_POLLING_ENABLED (Optional)
**Required:** ❌ No  
**Default:** Not set

```bash
WORKER_POLLING_ENABLED=true
```

**Why it's optional:** Allows DB polling to remain active even when `JOB_TRIGGER_MODE=http`.

---

### 15. CLOUD_TASKS_PROJECT (Optional)
**Required:** ❌ No  
**Default:** Not set

```bash
CLOUD_TASKS_PROJECT=wealth-report
```

**Why it's optional:** Required only when `JOB_TRIGGER_MODE=cloud-tasks`.

---

### 16. CLOUD_TASKS_LOCATION (Optional)
**Required:** ❌ No  
**Default:** Not set

```bash
CLOUD_TASKS_LOCATION=europe-west1
```

**Why it's optional:** Required only when `JOB_TRIGGER_MODE=cloud-tasks`.

---

### 17. CLOUD_TASKS_QUEUE (Optional)
**Required:** ❌ No  
**Default:** Not set

```bash
CLOUD_TASKS_QUEUE=report-generator-jobs
```

**Why it's optional:** Required only when `JOB_TRIGGER_MODE=cloud-tasks`.

---

### 18. WORKER_TASK_SERVICE_ACCOUNT (Optional)
**Required:** ❌ No  
**Default:** Not set

```bash
WORKER_TASK_SERVICE_ACCOUNT=report-generator-sa@wealth-report.iam.gserviceaccount.com
```

**Why it's optional:** Adds OIDC auth to Cloud Tasks requests. Use this if the worker service requires authenticated requests.

---

### 19. CLOUD_TASKS_ACCESS_TOKEN (Optional)
**Required:** ❌ No  
**Default:** Not set

```bash
CLOUD_TASKS_ACCESS_TOKEN=ya29...
```

**Why it's optional:** Useful for local testing when the metadata server isn't available.

---

## Quick Reference: Minimum Required Variables

For the **worker service** to work, you need exactly these 6:

```bash
SERVICE_MODE=worker
NODE_ENV=production
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...
```

**Optional (can be added later):**
```bash
OPENAI_REVIEW_MODEL=gpt-4o-mini  # Has default
```

**Not needed:**
```bash
SUPABASE_DB_PASSWORD=...  # Not used by the app
```

---

## How to Set These in Cloud Run

### Option 1: Cloud Console (What you're doing now)

In the deployment page, add each variable:

```
Name 1: SERVICE_MODE
Value 1: worker

Name 2: NODE_ENV
Value 2: production

Name 3: DEFAULT_WORKSPACE_ID
Value 3: c8e2bd7a-abe8-4ae2-9d77-720fabab07e4

Name 4: NEXT_PUBLIC_SUPABASE_URL
Value 4: https://YOUR_PROJECT.supabase.co

Name 5: SUPABASE_SERVICE_ROLE_KEY
Value 5: eyJhbGc...

Name 6: OPENAI_API_KEY
Value 6: sk-...
```

### Option 2: Command Line

```bash
gcloud run services update report-generator-worker \
  --region europe-west1 \
  --project wealth-report \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4,NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co,SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...,OPENAI_API_KEY=sk-..."
```

### Option 3: Using Secrets (Recommended for Production)

For sensitive values, use Google Secret Manager:

```bash
# Create secrets
echo -n "eyJhbGc..." | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
echo -n "sk-..." | gcloud secrets create OPENAI_API_KEY --data-file=-

# Deploy with secrets
gcloud run deploy report-generator-worker \
  --region europe-west1 \
  --set-env-vars "SERVICE_MODE=worker,NODE_ENV=production,DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4" \
  --set-secrets "NEXT_PUBLIC_SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

---

## Troubleshooting

### Worker can't connect to database
**Symptom:** Jobs stay in QUEUED, logs show "Supabase credentials not found"  
**Fix:** Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Worker can't generate content
**Symptom:** Jobs fail with "OPENAI_API_KEY is not set"  
**Fix:** Add `OPENAI_API_KEY`

### Worker processes wrong workspace
**Symptom:** Jobs are created but worker doesn't see them  
**Fix:** Ensure `DEFAULT_WORKSPACE_ID` matches between web and worker services

### Worker doesn't start
**Symptom:** Cloud Run shows "Container failed to start"  
**Fix:** Check `SERVICE_MODE=worker` is set

---

## Verification

After setting environment variables, verify they're correct:

```bash
# Check what's set
gcloud run services describe report-generator-worker \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"

# Check worker logs
gcloud run services logs read report-generator-worker \
  --region europe-west1 \
  --limit 50
```

Look for:
- ✅ "🚀 Starting in WORKER mode..."
- ✅ No "credentials not found" errors
- ✅ "Processing job: ..." messages

---

## Summary

**Absolutely Required (6 variables):**
1. ✅ SERVICE_MODE=worker
2. ✅ NODE_ENV=production
3. ✅ DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
4. ✅ NEXT_PUBLIC_SUPABASE_URL=https://...
5. ✅ SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
6. ✅ OPENAI_API_KEY=sk-...

**Optional (has defaults):**
- OPENAI_REVIEW_MODEL (defaults to gpt-4o-mini)

**Not needed:**
- SUPABASE_DB_PASSWORD (not used by the app)
- PORT (Cloud Run sets this automatically)



