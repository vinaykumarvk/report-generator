# Local Testing Guide - Export Feature

## 🚀 Quick Start

### Prerequisites
- ✅ Next.js dev server running (`npm run dev`)
- ✅ Worker process running (`SERVICE_MODE=worker node workers/worker.js`)
- ✅ Supabase Storage bucket "exports" created and set to public

---

## 🧪 Test Methods

### **Method 1: Browser UI (Recommended for UX Testing)**

1. Open the runs page:
   ```bash
   open http://localhost:3002/runs/03c98021-8c70-4bbe-87b8-3020cc046c17
   ```

2. Scroll to the **"Exports"** section (collapsible box at the bottom)

3. Click **"Download .md"** (or .pdf / .docx)

4. Watch for:
   - Status indicator shows: `⏳ QUEUED` → `🏃 RUNNING` → `✅ READY`
   - Download starts automatically when ready
   - Filename: `{topic}_{template}_{short-id}_{date}.md`

5. Check your Downloads folder for the file

---

### **Method 2: Interactive Test Script (Recommended for API Testing)**

Run the automated test script:

```bash
cd /Users/n15318/report-generator

# Test MARKDOWN export (default)
node scripts/test-export-flow.js

# Test PDF export
node scripts/test-export-flow.js 03c98021-8c70-4bbe-87b8-3020cc046c17 PDF

# Test DOCX export
node scripts/test-export-flow.js 03c98021-8c70-4bbe-87b8-3020cc046c17 DOCX
```

**What it tests**:
- ✅ Export request (POST `/api/report-runs/{runId}/export`)
- ✅ Status monitoring (polling the database)
- ✅ Export details (file size, checksum, storage URL)
- ✅ Download endpoint (GET `/api/report-runs/{runId}/exports/{exportId}`)

**Example output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Export Feature - Local Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ Step 1: Create Export Request ━━━
✅ Export requested (202)
   Export ID: 3dca0bad-8b53-4879-9da4-3f150a088d89
   Job ID: f46372b9-5626-4702-8cdb-95a5789467f6

━━━ Step 2: Monitor Export Status ━━━
   Status: ✅ READY

━━━ Step 3: Export Details ━━━
   Status: ✅ READY
   File: CRR-PRR-validation_Business-Requirement-Document_03c98021_2026-01-03.md
   Size: 51.96 KB
   Checksum: 2c705868e0f83a65...
   Storage: ✅ Uploaded to Supabase Storage

━━━ Step 4: Test Download Endpoint ━━━
   HTTP Status: 302
   ✅ Redirect to storage URL

✅ Test Complete!
```

---

### **Method 3: Manual API Testing (cURL)**

```bash
# Step 1: Request export
curl -X POST http://localhost:3002/api/report-runs/03c98021-8c70-4bbe-87b8-3020cc046c17/export \
  -H "Content-Type: application/json" \
  -d '{"format":"MARKDOWN"}' \
  | jq .

# Output: {"jobId":"...","exportId":"..."}

# Step 2: Check export status
EXPORT_ID="paste-export-id-here"
RUN_ID="03c98021-8c70-4bbe-87b8-3020cc046c17"

curl -I http://localhost:3002/api/report-runs/$RUN_ID/exports/$EXPORT_ID

# If ready, you'll see: HTTP/1.1 302 Found
# Location: https://yihuqlzbhaptqjcgcpmh.supabase.co/storage/...

# Step 3: Download file
curl -L http://localhost:3002/api/report-runs/$RUN_ID/exports/$EXPORT_ID \
  -o downloaded-report.md
```

---

### **Method 4: Database Inspection**

Check the exports table directly:

```bash
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data } = await supabase
    .from('exports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('Recent exports:');
  console.table(data);
})();
"
```

---

## 🔍 What to Test

### **1. Happy Path**
- ✅ Export request returns 202 with `exportId`
- ✅ Export record created with `QUEUED` status
- ✅ Worker processes job → status changes to `RUNNING`
- ✅ File generated and uploaded to Supabase Storage
- ✅ Status changes to `READY`
- ✅ Download endpoint returns 302 redirect
- ✅ File has correct naming format

### **2. Status Tracking**
- ✅ Initial status: `QUEUED`
- ✅ During processing: `RUNNING`
- ✅ On success: `READY`
- ✅ On failure: `FAILED` (with error message)

### **3. Error Handling**
Test by temporarily breaking something:

```bash
# Test 1: Invalid format
curl -X POST http://localhost:3002/api/report-runs/03c98021-8c70-4bbe-87b8-3020cc046c17/export \
  -H "Content-Type: application/json" \
  -d '{"format":"INVALID"}'
# Expected: 400 Bad Request

# Test 2: Non-existent run
curl -X POST http://localhost:3002/api/report-runs/00000000-0000-0000-0000-000000000000/export \
  -H "Content-Type: application/json" \
  -d '{"format":"MARKDOWN"}'
# Expected: 404 Not Found

# Test 3: Download not-ready export
# (Use an export that's still QUEUED)
curl http://localhost:3002/api/report-runs/$RUN_ID/exports/$EXPORT_ID
# Expected: 409 Conflict
```

### **4. File Format**
Check the downloaded file:

```bash
# Markdown
file downloaded-report.md
# Expected: ASCII text, with very long lines (338)

# PDF
file downloaded-report.pdf
# Expected: PDF document, version 1.7

# DOCX
file downloaded-report.docx
# Expected: Microsoft Word 2007+
```

### **5. Storage Integration**
- ✅ File uploaded to Supabase Storage bucket "exports"
- ✅ Storage path: `report-runs/{runId}/{exportId}.{ext}`
- ✅ Public URL accessible
- ✅ Checksum calculated correctly
- ✅ File size recorded

---

## 🐛 Troubleshooting

### **Export stuck in QUEUED**
```bash
# Check if worker is running
ps aux | grep "node workers/worker.js"

# Check worker logs
tail -50 /tmp/worker-debug.log

# Restart worker if needed
pkill -9 -f "node workers/worker.js" && \
  cd /Users/n15318/report-generator && \
  SERVICE_MODE=worker node workers/worker.js 2>&1 | tee /tmp/worker-debug.log &
```

### **Export stuck in RUNNING**
```bash
# Check worker logs for errors
tail -100 /tmp/worker-debug.log | grep -i error

# Check database for error message
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
(async () => {
  const { data } = await supabase
    .from('exports')
    .select('id, status, error_message')
    .eq('id', 'PASTE_EXPORT_ID_HERE')
    .single();
  console.log(data);
})();
"
```

### **Storage upload fails**
```bash
# Check if bucket exists
# Visit: https://app.supabase.com/project/{project-id}/storage/buckets

# Check bucket is public
# Visit: https://app.supabase.com/project/{project-id}/storage/buckets/exports

# Check environment variables
echo $SUPABASE_EXPORTS_BUCKET  # Should be "exports" or your custom name
```

### **Download returns 404**
```bash
# Check if export record exists
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
(async () => {
  const { data, error } = await supabase
    .from('exports')
    .select('*')
    .eq('id', 'PASTE_EXPORT_ID_HERE')
    .single();
  console.log('Export:', data);
  console.log('Error:', error);
})();
"
```

---

## 📊 Monitoring

### **View all exports for a run**
```bash
RUN_ID="03c98021-8c70-4bbe-87b8-3020cc046c17"

node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
(async () => {
  const { data } = await supabase
    .from('exports')
    .select('id, format, status, file_size, created_at')
    .eq('report_run_id', '$RUN_ID')
    .order('created_at', { ascending: false });
  console.table(data);
})();
"
```

### **View recent jobs**
```bash
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
(async () => {
  const { data } = await supabase
    .from('jobs')
    .select('id, type, status, payload_json')
    .eq('type', 'EXPORT')
    .order('created_at', { ascending: false })
    .limit(10);
  console.table(data);
})();
"
```

---

## ✅ Test Checklist

Before deploying to production, verify:

- [ ] Export request returns 202 with `exportId` and `jobId`
- [ ] Export record created in database with `QUEUED` status
- [ ] Worker claims and processes EXPORT job
- [ ] Status transitions: QUEUED → RUNNING → READY
- [ ] File generated with correct naming format
- [ ] File uploaded to Supabase Storage
- [ ] Metadata captured (file size, checksum, storage URL)
- [ ] Download endpoint returns 302 redirect to storage URL
- [ ] Downloaded file is complete and valid
- [ ] Error handling works (FAILED status with error message)
- [ ] Frontend UI updates correctly (status polling, auto-download)
- [ ] Legacy exports still work (local file fallback)

---

## 📝 Next Steps

1. **Test all formats**: MARKDOWN, PDF, DOCX
2. **Test error scenarios**: Invalid format, non-existent run, worker down
3. **Test UI**: Create export from browser, watch status updates
4. **Verify storage**: Check Supabase Storage bucket for uploaded files
5. **Monitor logs**: Watch worker logs during export processing
6. **Performance test**: Create multiple exports simultaneously

---

**Happy Testing!** 🎉

If you encounter any issues, check:
1. Worker logs: `tail -f /tmp/worker-debug.log`
2. Next.js logs: Check terminal where `npm run dev` is running
3. Database: Use Supabase dashboard to inspect `exports` and `jobs` tables




