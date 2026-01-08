# Export Download Fix

## 🐛 Issue
Exports were showing as "PENDING" in the UI instead of "READY", and downloads were not working.

## 🔍 Root Cause
Two issues were identified:

### 1. Missing API Route
The frontend was calling `/api/report-runs/[runId]/exports` to list exports, but this route didn't exist.

**Location**: `app/api/report-runs/[runId]/exports/route.ts`

**Fix**: Created the missing API route to list all exports for a run.

### 2. Next.js Schema Cache
The Supabase client was caching the old database schema without the new `status`, `storage_url`, and other columns.

**Fix**: 
- Cleared `.next` cache folder
- Restarted Next.js dev server

## ✅ Solution Applied

### Created Missing API Route
**File**: `app/api/report-runs/[runId]/exports/route.ts`

```typescript
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET /api/report-runs/[runId]/exports
 * List all exports for a run
 */
export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: exports, error } = await supabase
    .from("exports")
    .select("*")
    .eq("report_run_id", params.runId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(exports || []);
}
```

### Restarted Next.js Server
```bash
rm -rf .next
npm run dev
```

## 🧪 Test Results

### Before Fix
```
API Response:
{
  "id": "...",
  "format": "MARKDOWN",
  "file_path": "...",
  "created_at": "..."
  // Missing: status, storage_url, file_size, checksum, etc.
}

UI Display: "PENDING" (because status was undefined)
Download: Not working (button not shown)
```

### After Fix
```
API Response:
{
  "id": "2d4e5da2-e4e6-4a3c-811b-4bb059886b0e",
  "format": "PDF",
  "file_path": "...",
  "created_at": "...",
  "status": "READY",  ✅
  "storage_url": "https://...",  ✅
  "file_size": 40170,  ✅
  "checksum": "141ead2b...",  ✅
  "error_message": null,
  "updated_at": "..."
}

UI Display: "READY" with Download button ✅
Download: Working (302 redirect to storage URL) ✅
```

## 🎯 What Now Works

✅ Export list API returns all fields including `status`  
✅ UI shows "READY" instead of "PENDING"  
✅ Download buttons appear for READY exports  
✅ Downloads redirect to Supabase Storage URLs  
✅ File metadata (size, checksum) is displayed  
✅ Error messages shown for FAILED exports  

## 📋 Testing Steps

1. **Open the runs page**:
   ```
   http://localhost:3002/runs/03c98021-8c70-4bbe-87b8-3020cc046c17
   ```

2. **Scroll to "Exports" section**

3. **Verify**:
   - Existing exports show "Download" button
   - Status shows "READY" (not "PENDING")
   - Clicking "Download .md" or "Download .pdf" triggers immediate download

4. **Test new export**:
   - Click "Export Markdown" button
   - Watch status change: QUEUED → RUNNING → READY
   - Download button appears when READY
   - Click to download

## 🚀 Deployment Note

When deploying to production, ensure:
1. The new API route is deployed: `app/api/report-runs/[runId]/exports/route.ts`
2. Clear any server-side caches
3. Restart the web service to pick up the new schema

---

**Fixed**: January 3, 2026  
**Status**: ✅ **RESOLVED**




