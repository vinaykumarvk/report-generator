# SERVICE_MODE Configuration Guide

## Quick Answer

**Yes, you need to define `SERVICE_MODE` in BOTH services, but with different values:**

- **Web Service:** `SERVICE_MODE=web` (or omit it - defaults to "web")
- **Worker Service:** `SERVICE_MODE=worker` (REQUIRED - must be set explicitly)

---

## Why Both Services Need It

### How It Works

The same codebase is deployed to both services. The `scripts/start.js` file checks `SERVICE_MODE` to decide what to run:

```javascript
const mode = (process.env.SERVICE_MODE || "web").toLowerCase();

const command =
  mode === "worker"
    ? { cmd: "node", args: ["workers/worker-with-health.js"] }
    : { cmd: "next", args: ["start"] };
```

**Logic:**
- If `SERVICE_MODE=worker` → runs worker code
- If `SERVICE_MODE=web` or undefined → runs Next.js web app

---

## Configuration for Each Service

### Web Service (`report-generator`)

**Required:**
```
SERVICE_MODE=web
```
(Actually optional - defaults to "web" if not set)

**Other variables:**
- `NODE_ENV=production`
- `DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`
- Supabase credentials
- OpenAI API key

---

### Worker Service (`report-generator-worker`)

**REQUIRED:**
```
SERVICE_MODE=worker
```
**This is critical!** Without it, worker runs web app instead.

**Other variables:**
- `NODE_ENV=production`
- `DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4`
- `JOB_TRIGGER_MODE=db` (or `http` with `WORKER_POLLING_ENABLED=true`)
- Supabase credentials
- OpenAI API key

---

## Current Status

### Web Service
- ✅ Probably fine (defaults to "web" if not set)
- ✅ Can explicitly set `SERVICE_MODE=web` for clarity

### Worker Service
- ❌ **MISSING `SERVICE_MODE=worker`** ← This is the problem!
- ❌ Currently running web app instead of worker

---

## Best Practice

**Explicitly set `SERVICE_MODE` in both services** for clarity and to avoid confusion:

### Web Service
```
SERVICE_MODE=web
NODE_ENV=production
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
```

### Worker Service
```
SERVICE_MODE=worker          ← CRITICAL!
NODE_ENV=production
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
JOB_TRIGGER_MODE=db          ← Or http with WORKER_POLLING_ENABLED=true
```

---

## Summary

| Service | SERVICE_MODE Value | Required? |
|---------|-------------------|-----------|
| Web | `web` | Optional (defaults to "web") |
| Worker | `worker` | **YES - REQUIRED** |

**Action Items:**
1. ✅ Add `SERVICE_MODE=worker` to worker service (CRITICAL)
2. ✅ Optionally add `SERVICE_MODE=web` to web service (for clarity)
3. ✅ Verify worker health endpoint returns JSON after deployment

