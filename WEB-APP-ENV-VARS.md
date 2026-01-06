# Web App Environment Variables

## Quick Answer

**Yes, both should be set for the web app as well:**

- `NODE_ENV=production` - **Recommended** (same reasons as worker)
- `DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4` - **Recommended** (same fallback, same issues)

---

## Detailed Analysis

### 1. NODE_ENV = production

**Status for Web App:** ⚠️ **Recommended** (same as worker)

**Why:**
- Next.js web app benefits from production optimizations
- Better performance, smaller bundles
- Proper error handling in production

**What happens if missing:**
- App runs but may be slower
- Development mode optimizations (not ideal for production)
- More verbose logging

**Recommendation:** ✅ **Set it** for production web app

---

### 2. DEFAULT_WORKSPACE_ID = c8e2bd7a-abe8-4ae2-9d77-720fabab07e4

**Status for Web App:** ⚠️ **Recommended** (same fallback as worker)

**How it's used in web app:**

Looking at the API routes, they use `getWorkspaceIdFromRequest()` which eventually calls `getDefaultWorkspaceId()`:

```typescript
// app/api/templates/route.ts
const workspaceId = await getWorkspaceIdFromRequest(request);
// ... queries templates with workspace_id filter
```

The `getDefaultWorkspaceId()` function has the same fallback:
1. If `DEFAULT_WORKSPACE_ID` is set → uses it (fast)
2. If not set → queries database for "Default Workspace" (slow)
3. If not found → creates new workspace (problematic)

**What happens if missing:**
- Every API request that needs workspace ID will query the database
- Slower response times
- Potential workspace ID mismatches between requests
- Same race condition risks as worker

**Recommendation:** ✅ **Set it** for production web app

---

## Comparison: Web vs Worker

| Variable | Web App | Worker | Notes |
|----------|---------|--------|-------|
| `NODE_ENV=production` | ✅ Recommended | ✅ Recommended | Same for both |
| `DEFAULT_WORKSPACE_ID` | ✅ Recommended | ✅ Recommended | Same fallback, same issues |

**Key Point:** Both services use the same code (`src/lib/workspace.ts`) for workspace resolution, so they have the same fallback behavior and the same issues if not set.

---

## Why Both Services Should Match

### Consistency

If web and worker have different workspace IDs:
- ❌ Web might create jobs for workspace A
- ❌ Worker might look for jobs in workspace B
- ❌ Jobs won't be found/processed
- ❌ Templates might not be visible

### Performance

Without `DEFAULT_WORKSPACE_ID`:
- ❌ Every API request queries database
- ❌ Slower response times
- ❌ Unnecessary database load

---

## Recommended Configuration

### Web Service (`report-generator`)

```
SERVICE_MODE=web                    (optional, defaults to "web")
NODE_ENV=production                 ✅ Recommended
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4  ✅ Recommended
```

### Worker Service (`report-generator-worker`)

```
SERVICE_MODE=worker                 ✅ REQUIRED
NODE_ENV=production                 ✅ Recommended
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4  ✅ Recommended
```

**Important:** Both services should use the **same** `DEFAULT_WORKSPACE_ID` value!

---

## Summary

**For Web App:**
- `NODE_ENV=production` - ✅ **Set it** (recommended for production)
- `DEFAULT_WORKSPACE_ID` - ✅ **Set it** (recommended to avoid fallback issues)

**For Worker:**
- `NODE_ENV=production` - ✅ **Set it** (recommended for production)
- `DEFAULT_WORKSPACE_ID` - ✅ **Set it** (recommended to avoid fallback issues)

**Both services should have the same values** to ensure consistency and performance.

