# Environment Variables: Required vs Optional

## Quick Answer

| Variable | Required? | What Happens If Missing? |
|----------|-----------|-------------------------|
| `NODE_ENV` | ⚠️ **Recommended** (not strictly required) | App works but may not have production optimizations |
| `DEFAULT_WORKSPACE_ID` | ⚠️ **Recommended** (has fallback) | App will query/create workspace automatically (slower, less reliable) |

---

## Detailed Analysis

### 1. NODE_ENV = production

**Status:** ⚠️ **Recommended but not strictly required**

**What it does:**
- Enables production optimizations in Next.js
- Affects logging behavior
- May affect error handling

**What happens if missing:**
- App will still run
- May use development mode optimizations (slower, more verbose)
- Some features might behave differently

**Recommendation:** 
- ✅ **Set it to `production`** for production deployments
- The app will work without it, but it's best practice

**Code evidence:**
- Next.js automatically detects production vs development
- Some code paths check `process.env.NODE_ENV` but have defaults

---

### 2. DEFAULT_WORKSPACE_ID = c8e2bd7a-abe8-4ae2-9d77-720fabab07e4

**Status:** ⚠️ **Recommended but has fallback**

**What it does:**
- Tells the app which workspace to use by default
- Used for workspace filtering and isolation

**What happens if missing:**
Looking at `src/lib/workspace.ts`:

```typescript
export async function getDefaultWorkspaceId(): Promise<string> {
  // If explicit workspace ID is set, use it
  if (DEFAULT_WORKSPACE_ID) {
    return DEFAULT_WORKSPACE_ID;  // ✅ Fast path
  }
  
  // Fallback: Query database for workspace named "Default Workspace"
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("name", "Default Workspace")
    .limit(1)
    .maybeSingle();
  
  if (existing?.id) {
    return String(existing.id);  // ✅ Found it
  }
  
  // Last resort: Create a new workspace
  const { data: created } = await supabase
    .from("workspaces")
    .insert({ name: "Default Workspace" })
    .select("id")
    .single();
  
  return String(created.id);  // ✅ Created new one
}
```

**Fallback behavior:**
1. ✅ If not set → queries database for workspace named "Default Workspace"
2. ✅ If not found → creates a new workspace
3. ⚠️ **Problem:** This is slower (extra database query)
4. ⚠️ **Problem:** Might create duplicate workspaces if multiple services do this
5. ⚠️ **Problem:** Different services might get different workspace IDs

**Recommendation:**
- ✅ **Set it explicitly** to avoid:
  - Extra database queries on every request
  - Potential workspace ID mismatches between services
  - Race conditions when creating workspaces

---

## Summary

### For Production Deployment

**Best Practice (Set Both):**
```
NODE_ENV=production
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4
```

**Why:**
- `NODE_ENV=production` → Production optimizations, proper logging
- `DEFAULT_WORKSPACE_ID` → Fast, reliable, consistent across services

### Minimum Required

**Technically, both have fallbacks:**
- `NODE_ENV` → App works, but may not be optimized
- `DEFAULT_WORKSPACE_ID` → App works, but queries/creates workspace dynamically

**But for production, you should set both** to ensure:
- ✅ Consistent behavior
- ✅ Better performance
- ✅ No race conditions
- ✅ Proper workspace isolation

---

## For Your Current Situation

Since you're fixing the worker deployment, **set both**:

```
SERVICE_MODE=worker          ← CRITICAL (required)
NODE_ENV=production         ← Recommended (best practice)
DEFAULT_WORKSPACE_ID=c8e2bd7a-abe8-4ae2-9d77-720fabab07e4  ← Recommended (avoids issues)
```

**Priority:**
1. 🔴 `SERVICE_MODE=worker` - **MUST HAVE** (worker won't work without it)
2. 🟡 `NODE_ENV=production` - **SHOULD HAVE** (app works but not optimal)
3. 🟡 `DEFAULT_WORKSPACE_ID` - **SHOULD HAVE** (app works but may have issues)

