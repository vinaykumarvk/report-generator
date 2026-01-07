# Production Download Fix

## 🐛 Issue
Downloads are not working in production. Users click download buttons but nothing happens.

## 🔍 Root Cause Analysis

### Problem 1: Storage Bucket Missing or Not Public
The download route redirects to `storage_url`, but if:
- The Supabase Storage bucket `exports` doesn't exist
- The bucket exists but isn't set to public
- The storage upload failed silently

Then the redirect will fail and downloads won't work.

### Problem 2: Silent Storage Upload Failures
The worker's `handleExport` function calls `uploadExportFile()`, but if it fails, the export is still marked as `READY` without a valid `storage_url`. The download route then tries to redirect to a non-existent URL.

### Problem 3: No Fallback Mechanism
The download route checks for `storage_url` first and redirects, but if that fails, there's no graceful fallback. The route should:
1. Try `storage_url` redirect (preferred)
2. Fall back to `file_path` if storage_url is missing or invalid
3. Generate markdown on-the-fly for MARKDOWN format if file_path is also missing

## ✅ Solution Applied

### 1. Enhanced Error Handling in Worker
**File**: `workers/worker-core.js`

- Storage upload is now wrapped in try-catch
- If storage upload fails, export still completes with `file_path`
- Export is marked as `READY` even if storage upload fails
- Logs warning instead of failing the entire export

### 2. Improved Download Route
**File**: `app/api/report-runs/[runId]/exports/[exportId]/route.ts`

- Validates `storage_url` before redirecting
- Falls through to `file_path` if `storage_url` is invalid
- Better error messages

## 🚀 Production Setup Required

### Step 1: Create Supabase Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "Create new bucket"
3. Name: `exports`
4. **Important**: Set as **Public** (for public downloads)
5. Click "Create bucket"

### Step 2: Verify Environment Variables

Ensure both **Web** and **Worker** services have:
```bash
SUPABASE_EXPORTS_BUCKET=exports  # Optional, defaults to "exports"
```

### Step 3: Test Storage Upload

After creating the bucket, test an export:
1. Create a new report run
2. Wait for it to complete
3. Click "Download .md" or "Download .pdf"
4. Check worker logs for storage upload success/failure
5. Check browser network tab for redirect URL

## 🔧 Troubleshooting

### Downloads Still Not Working?

1. **Check Storage Bucket**:
   - Go to Supabase Dashboard → Storage → `exports` bucket
   - Verify bucket exists and is **Public**
   - Check if files are being uploaded (look for `report-runs/` folder)

2. **Check Worker Logs**:
   ```bash
   gcloud run services logs read report-generator-worker \
     --region=europe-west1 \
     --limit=50
   ```
   Look for:
   - `📦 Uploaded to storage:` (success)
   - `⚠️  Storage upload failed` (failure)

3. **Check Export Records**:
   ```sql
   SELECT id, format, status, storage_url, file_path 
   FROM exports 
   WHERE report_run_id = 'YOUR_RUN_ID'
   ORDER BY created_at DESC;
   ```
   
   - If `storage_url` is NULL → Storage upload failed
   - If `file_path` is NULL → File generation failed
   - If both are NULL → Export failed completely

4. **Test Storage URL Directly**:
   - Copy `storage_url` from database
   - Paste in browser
   - If 404 → Bucket doesn't exist or file wasn't uploaded
   - If 403 → Bucket is not public

### Storage Upload Failing?

Common causes:
1. **Bucket doesn't exist**: Create it in Supabase Dashboard
2. **Bucket not public**: Set bucket to public in Supabase Dashboard
3. **Service role key missing**: Check `SUPABASE_SERVICE_ROLE_KEY` env var
4. **Storage quota exceeded**: Check Supabase usage limits

## 📋 Verification Checklist

- [ ] `exports` bucket exists in Supabase Storage
- [ ] Bucket is set to **Public**
- [ ] `SUPABASE_EXPORTS_BUCKET` env var is set (or using default "exports")
- [ ] Worker logs show successful storage uploads
- [ ] Export records have `storage_url` populated
- [ ] Download buttons trigger redirects
- [ ] Files are accessible via `storage_url`

## 🎯 Expected Behavior

### Successful Flow
1. User clicks "Download .md" or "Download .pdf"
2. Frontend calls `/api/report-runs/{runId}/exports/{exportId}`
3. API checks export status → `READY`
4. API redirects (302) to `storage_url`
5. Browser downloads file from Supabase Storage

### Fallback Flow (if storage fails)
1. User clicks download
2. API checks export status → `READY`
3. API checks `storage_url` → NULL or invalid
4. API falls back to `file_path`
5. API reads file from disk and streams it
6. Browser downloads file

## 🔄 Next Steps

1. **Immediate**: Create the `exports` bucket in Supabase Storage
2. **Short-term**: Monitor worker logs for storage upload errors
3. **Long-term**: Consider using signed URLs instead of public URLs for better security

---

**Status**: ✅ **FIXED** (requires Supabase Storage bucket setup)
**Date**: January 7, 2026

