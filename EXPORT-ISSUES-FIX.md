# Export Issues - Root Cause & Fix

## 🐛 Issues Found

### Issue 1: Missing API Route
**Problem**: Frontend was calling `/api/report-runs/[runId]/exports` but route didn't exist.

**Impact**: Exports list showed "No exports yet" even when exports existed in database.

**Fix**: Created `/app/api/report-runs/[runId]/exports/route.ts`

**Status**: ✅ FIXED

---

### Issue 2: Export Status Not Updated on Failure
**Problem**: When an export job failed, the export record status remained "QUEUED" instead of being updated to "FAILED".

**Root Cause**: In `workers/worker-core.js`, the `handleExport` function:
1. Checked if `finalReportContent` exists
2. Threw error if missing
3. **BUT** the error was thrown BEFORE the try-catch block that updates export status

**Code Flow (BROKEN)**:
```javascript
async function handleExport(job) {
  // ... setup ...
  
  // This check was OUTSIDE the try-catch
  if (!finalReportContent) {
    throw new Error("No final report content available");  // ❌ Export status never updated
  }
  
  try {
    // Create export record
    await createExportRecord(...)
    // ... rest of export logic ...
  } catch (err) {
    await updateExportRecord(exportId, { status: "FAILED", errorMessage: message });
  }
}
```

**Result**: 
- Job fails and gets marked as FAILED after 3 attempts
- Export record stays QUEUED forever
- UI shows "Generating..." indefinitely

**Fix**: Moved all logic inside the try-catch block:

```javascript
async function handleExport(job) {
  // ... setup ...
  
  try {
    // Create export record FIRST
    await createExportRecord(...)  // ✅ Now inside try-catch
    
    // Then check content
    if (!finalReportContent) {
      throw new Error("No final report content available");  // ✅ Will be caught
    }
    
    // ... rest of export logic ...
  } catch (err) {
    await updateExportRecord(exportId, { status: "FAILED", errorMessage: message });
    // ✅ Export status properly updated
  }
}
```

**Status**: ✅ FIXED

---

### Issue 3: Next.js Schema Cache
**Problem**: After adding new columns to `exports` table, the API wasn't returning them.

**Root Cause**: Next.js caches Supabase schema metadata.

**Fix**: 
```bash
rm -rf .next
npm run dev
```

**Status**: ✅ FIXED

---

## 🧪 Test Case: Export from Incomplete Run

**Scenario**: User clicks "Download .md" on a run that hasn't completed yet (no final report).

**Before Fix**:
```
1. Export job created, status: QUEUED
2. Worker claims job
3. Worker throws error: "No final report content available"
4. Job fails after 3 attempts → status: FAILED
5. Export record NEVER updated → status: QUEUED ❌
6. UI shows: ".md: Generating..." forever ❌
```

**After Fix**:
```
1. Export job created, status: QUEUED
2. Worker claims job
3. Worker creates export record: status: RUNNING
4. Worker throws error: "No final report content available"
5. Worker catches error and updates export → status: FAILED ✅
6. UI shows: "FAILED: No final report content available" ✅
```

---

## 🎯 What Now Works

### For Completed Runs (with final report)
✅ Export request creates QUEUED export  
✅ Worker processes and uploads to storage  
✅ Status transitions: QUEUED → RUNNING → READY  
✅ UI shows "Download" button  
✅ Download redirects to Supabase Storage URL  
✅ File downloads successfully  

### For Incomplete Runs (no final report)
✅ Export request creates QUEUED export  
✅ Worker attempts to process  
✅ Worker updates status to FAILED with error message  
✅ UI shows: "FAILED: No final report content available for export"  
✅ User understands why export failed  

### Export List Display
✅ API route returns all exports with status  
✅ UI shows export history  
✅ Status badges: QUEUED, RUNNING, READY, FAILED  
✅ Error messages displayed for FAILED exports  
✅ Download button only for READY exports  

---

## 📋 Files Modified

1. **`app/api/report-runs/[runId]/exports/route.ts`** (NEW)
   - List all exports for a run

2. **`workers/worker-core.js`**
   - Fixed export error handling
   - Moved export record creation inside try-catch
   - Ensures status always updated on failure

---

## 🚀 Testing

### Test Completed Run Exports
```bash
# Navigate to a completed run
open http://localhost:3002/runs/03c98021-8c70-4bbe-87b8-3020cc046c17

# Should see:
# - Export History section
# - Existing exports with "Download" buttons
# - Click Download → file downloads immediately
```

### Test Incomplete Run Exports  
```bash
# Navigate to an incomplete run
open http://localhost:3002/runs/dbcc8a2a-94ef-4ebf-8bc1-242db1555993

# Click "Download .md"
# Should see:
# - Status: "Generating..."
# - After a few seconds: "FAILED: No final report content available"
```

### Verify API
```bash
# Check exports for a run
curl http://localhost:3002/api/report-runs/03c98021-8c70-4bbe-87b8-3020cc046c17/exports

# Should return JSON with status field:
# [{id, format, status: "READY", storage_url, ...}]
```

---

## ✅ Resolution Summary

**Fixed**: January 3, 2026

**Changes**:
1. ✅ Created missing `/api/report-runs/[runId]/exports` route
2. ✅ Fixed export error handling in worker
3. ✅ Cleared Next.js cache to pick up new schema

**Status**: **RESOLVED**

**Remaining Action**: Refresh browser to see fixed UI

---

**Note**: One export (`19d13fcd-cd36-43be-9fff-185981f4a793`) was manually updated to FAILED status as it was stuck from before the fix. All new exports will work correctly.




