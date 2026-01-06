# WORKER_POLLING_ENABLED - Where It's Needed

## Quick Answer

**Only in the Worker Service** - The web app doesn't use this variable at all.

---

## Detailed Explanation

### Where It's Used

Looking at the code in `workers/worker-with-health.js`:

```javascript
const triggerMode = String(process.env.JOB_TRIGGER_MODE || "db").toLowerCase();
const triggerSecret = String(process.env.WORKER_TRIGGER_SECRET || "");
const pollingEnabled =
  triggerMode === "db" || process.env.WORKER_POLLING_ENABLED === "true";
```

**This code only exists in the worker service**, not in the web app.

---

## How It Works

### Worker Service Logic

1. **Default behavior:**
   - If `JOB_TRIGGER_MODE=db` → polling is **enabled** automatically
   - If `JOB_TRIGGER_MODE=http` → polling is **disabled** by default

2. **With WORKER_POLLING_ENABLED:**
   - If `WORKER_POLLING_ENABLED=true` → polling is **enabled** regardless of `JOB_TRIGGER_MODE`
   - This allows you to use HTTP triggers AND polling as a fallback

### Web Service

The web app **doesn't poll for jobs** - it only:
- Creates jobs
- Triggers workers (if using HTTP/Cloud Tasks mode)
- Serves the UI and API

So `WORKER_POLLING_ENABLED` is **not used** and **not needed** in the web service.

---

## Configuration Examples

### Scenario 1: Database Polling (Default)

**Worker Service:**
```
SERVICE_MODE=worker
JOB_TRIGGER_MODE=db
# WORKER_POLLING_ENABLED not needed - polling enabled by default
```

**Web Service:**
```
SERVICE_MODE=web
# WORKER_POLLING_ENABLED not needed - web doesn't poll
```

---

### Scenario 2: HTTP Trigger Mode with Polling Fallback

**Worker Service:**
```
SERVICE_MODE=worker
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_SECRET=01@Welcome
WORKER_POLLING_ENABLED=true    ← Only here!
```

**Web Service:**
```
SERVICE_MODE=web
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_URL=https://report-generator-worker-XXX.run.app/process-job
WORKER_TRIGGER_SECRET=01@Welcome
# WORKER_POLLING_ENABLED not needed - web doesn't poll
```

---

### Scenario 3: HTTP Trigger Only (No Polling)

**Worker Service:**
```
SERVICE_MODE=worker
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_SECRET=01@Welcome
# WORKER_POLLING_ENABLED not set - polling disabled
```

**Web Service:**
```
SERVICE_MODE=web
JOB_TRIGGER_MODE=http
WORKER_TRIGGER_URL=https://report-generator-worker-XXX.run.app/process-job
WORKER_TRIGGER_SECRET=01@Welcome
# WORKER_POLLING_ENABLED not needed - web doesn't poll
```

---

## Summary

| Variable | Web Service | Worker Service | Notes |
|----------|------------|----------------|-------|
| `WORKER_POLLING_ENABLED` | ❌ Not used | ✅ Only if needed | Only worker polls for jobs |

**When to set it in worker:**
- ✅ When `JOB_TRIGGER_MODE=http` but you want polling as fallback
- ❌ When `JOB_TRIGGER_MODE=db` (polling enabled by default)
- ❌ When `JOB_TRIGGER_MODE=http` and you only want HTTP triggers

**Never set it in web service** - it's ignored.

---

## Your Current Configuration

Based on your setup:
- `JOB_TRIGGER_MODE=http` in worker
- You want jobs to be processed

**Option 1: Enable Polling (Recommended)**
```
Worker Service:
  WORKER_POLLING_ENABLED=true
```

**Option 2: Switch to Database Polling**
```
Worker Service:
  JOB_TRIGGER_MODE=db
  # Remove WORKER_POLLING_ENABLED (not needed)
```

**Web Service:**
- Don't set `WORKER_POLLING_ENABLED` - it's not used

