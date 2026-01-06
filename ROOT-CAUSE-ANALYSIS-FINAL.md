# Root Cause Analysis: Section Sources Display Issue (Final)

## Problem Statement
- **Local:** Section sources correctly show "Vector: WealthProduct"  
- **Cloud:** Section sources show "LLM_ONLY" instead
- **Both use same Supabase database** - so data is identical

## Investigation Findings

### Database Check ✅
- Template exists: `cfb77b44-976b-49b4-9d2e-35410f0bf066`
- `sources_json` is correct: `[{"name": "WealthProduct", "type": "VECTOR", ...}]`
- Sections have `source_mode: "inherit"` (correct)
- Sections have `evidence_policy: null` (shows as "LLM_ONLY" due to fallback)

### Code Flow Analysis

1. **API Route** (`app/api/templates/route.ts:48`)
   ```typescript
   connectors: Array.isArray(template.sources_json) ? template.sources_json : []
   ```
   ✅ Correctly maps `sources_json` → `connectors`

2. **Frontend Display** (`app/runs/run-dashboard-client.tsx:70-86`)
   ```typescript
   function formatTemplateSources(template?: Template) {
     const connectors = template?.connectors || [];
     if (connectors.length === 0) return "None";
     const vectorNames = connectors
       .filter((connector) => connector.type === "VECTOR")
       .map((connector) => connector.name);
     return `Vector: ${vectorNames.join(", ")}`;
   }
   ```
   ✅ Should work if `template.connectors` has data

3. **Section Display** (line 99-110)
   ```typescript
   function formatSectionSources(section, vectorStores, template) {
     if (section.sourceMode === "custom") {
       // Uses customConnectorIds
     }
     return `Inherited: ${formatTemplateSources(template)}`;
   }
   ```
   ✅ Should show "Inherited: Vector: WealthProduct"

## Root Cause Hypothesis

Since both use the same database, the issue must be in **how the data flows through the application**:

### Most Likely Causes:

1. **Browser Caching (High Probability)**
   - Cloud browser has cached old API response
   - Old response had empty `sources_json` or different structure
   - Local browser has fresh data
   - **Fix:** Hard refresh (Cmd+Shift+R) or clear cache

2. **Code Version Mismatch (Medium Probability)**
   - Cloud deployment has older code version
   - Older code might not map `sources_json` correctly
   - Local has latest code with fixes
   - **Fix:** Redeploy cloud with latest code

3. **Template State Issue (Low Probability)**
   - Frontend state has stale template object
   - `selectedTemplate` doesn't have `connectors` populated
   - React state not updating correctly
   - **Fix:** Check React DevTools for template state

4. **API Response Transformation (Low Probability)**
   - Some middleware/proxy modifying response
   - Different Next.js build configuration
   - **Fix:** Check network tab in browser DevTools

## Verification Steps

### Step 1: Check Browser Network Tab
1. Open cloud app in browser
2. Open DevTools → Network tab
3. Filter for `/api/templates`
4. Check the actual response:
   - Does it have `connectors` array?
   - Does `connectors[0]` have `type: "VECTOR"` and `name: "WealthProduct"`?

### Step 2: Check React State
1. Open React DevTools
2. Find `RunDashboardClient` component
3. Check `templates` state
4. Find the "Solutions Document" template
5. Verify `template.connectors` array exists and has data

### Step 3: Check Code Version
1. Compare deployed code hash/version
2. Verify cloud has latest code with `sources_json` mapping
3. Check if there are any build-time differences

## Recommended Fixes

### Immediate (Test First):
1. **Hard refresh cloud browser** (Cmd+Shift+R / Ctrl+Shift+R)
2. **Clear browser cache** for the cloud domain
3. **Check Network tab** to see actual API response

### If Still Broken:
1. **Verify code deployment** - ensure cloud has latest code
2. **Add logging** to see what `template.connectors` contains
3. **Check for middleware** that might modify responses

### Code-Level Fix (Defensive):
Add fallback logic to handle empty `connectors`:
```typescript
function formatTemplateSources(template?: Template) {
  const connectors = template?.connectors || [];
  if (connectors.length === 0) {
    // Fallback: try to get from sources_json directly
    const sources = (template as any)?.sources_json;
    if (Array.isArray(sources) && sources.length > 0) {
      const vectorNames = sources
        .filter((s: any) => s.type === "VECTOR")
        .map((s: any) => s.name)
        .filter(Boolean);
      if (vectorNames.length > 0) {
        return `Vector: ${vectorNames.join(", ")}`;
      }
    }
    return "None";
  }
  // ... existing logic
}
```

## Next Steps

1. ✅ **Verify root cause** - Check browser Network tab in cloud
2. ⏳ **Test fix** - Hard refresh and verify
3. ⏳ **Add defensive code** - Fallback logic if needed
4. ⏳ **Add logging** - Debug what's actually in template object

