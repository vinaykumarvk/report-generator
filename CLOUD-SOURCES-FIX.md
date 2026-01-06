# Cloud Sources Display Fix

## Problem
Cloud app shows "LLM_ONLY" for section sources, while local shows "Vector: WealthProduct" correctly.

## Root Cause Found
✅ **API returns correct data** - Verified that cloud API has proper `connectors` array
❌ **Frontend display issue** - Likely code version mismatch or caching

## Fixes Applied

### 1. Added Cache Control to API Route
```typescript
export const dynamic = "force-dynamic";
```
Prevents Next.js from caching API responses.

### 2. Enhanced formatTemplateSources with Fallback
```typescript
function formatTemplateSources(template?: Template) {
  // Check both connectors and sources_json
  const connectors = template?.connectors || [];
  const sourcesJson = (template as any)?.sources_json;
  
  // Fallback to sources_json if connectors is empty
  let effectiveConnectors = connectors;
  if (connectors.length === 0 && Array.isArray(sourcesJson) && sourcesJson.length > 0) {
    effectiveConnectors = sourcesJson;
  }
  // ... rest of logic
}
```

### 3. Enhanced formatSectionSources
Added null check and better error handling.

### 4. Added Debug Logging
Logs template data when loaded to help diagnose issues.

## Next Steps

### Immediate Action Required: Redeploy Cloud

The cloud deployment needs to be updated with the latest code:

```bash
# Deploy web service with latest code
gcloud run deploy report-generator \
  --source . \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated
```

### After Deployment

1. **Hard refresh browser** (Cmd+Shift+R)
2. **Check browser console** for debug logs
3. **Verify Network tab** shows correct API response
4. **Check React DevTools** for template state

## Verification

After redeploy, the cloud should show:
- ✅ "Inherited: Vector: WealthProduct" instead of "LLM_ONLY"
- ✅ Debug logs in console showing connectors count = 1

## Files Modified

1. `app/api/templates/route.ts` - Added `export const dynamic = "force-dynamic"`
2. `app/runs/run-dashboard-client.tsx` - Enhanced formatTemplateSources with fallback
3. `app/runs/run-dashboard-client.tsx` - Added debug logging

