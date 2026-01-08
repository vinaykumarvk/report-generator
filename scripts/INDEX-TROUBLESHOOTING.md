# 🔧 Index Creation - Troubleshooting

## Common Errors and Fixes

### ❌ Error 1: "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"

**Fix:** Use `scripts/add-indexes-simple.sql` instead of `add-critical-indexes.sql`

---

### ❌ Error 2: "column 'order_index' does not exist"

**Fix:** Already fixed in latest version! Just re-copy `scripts/add-indexes-simple.sql`

The new version only indexes `template_id` (which exists) and comments out `order_index` (which may not exist).

---

### ❌ Error 3: "relation 'table_name' does not exist"

**Cause:** That table hasn't been created yet in your database.

**Fix:** This is normal! Just skip that part. The critical indexes (jobs, report_runs) are what matter most.

**Option:** Use `scripts/add-indexes-minimal.sql` - only the essential indexes

---

### ❌ Error 4: "index already exists"

**Cause:** You already ran this before.

**Fix:** Nothing! This is good. The index is already there. ✅

---

## 🎯 Recommended Approach (Most Reliable)

### Use the MINIMAL version:

**File:** `scripts/add-indexes-minimal.sql`

**Why:** 
- ✅ No partial indexes (no WHERE clauses)
- ✅ No multi-column composite indexes
- ✅ Only single columns we know exist
- ✅ Most compatible with any schema

**Steps:**
1. Open `scripts/add-indexes-minimal.sql`
2. Copy all contents
3. Paste in Supabase SQL Editor
4. Click "Run"
5. Should complete with no errors ✅

---

## 📊 What Each Index Does

### Critical (Must Have)
```sql
-- Worker polling - without this, workers are SLOW
idx_jobs_status_created ON jobs(status, created_at)
```

### High Priority (Recommended)
```sql
-- Dashboard performance
idx_report_runs_workspace_created ON report_runs(workspace_id, created_at)

-- Run details page
idx_section_runs_report_run ON section_runs(report_run_id)

-- Export listing
idx_exports_report_run ON exports(report_run_id)
```

### Nice to Have (Optional)
```sql
-- Template listing
idx_templates_workspace ON templates(workspace_id)

-- Section lookup
idx_template_sections_template ON template_sections(template_id)
```

---

## 🧪 Test After Creating Indexes

### Test 1: Verify indexes exist
```sql
SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_%';
```
**Expected:** At least 6-8 indexes

### Test 2: Check specific critical index
```sql
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_jobs_status_created';
```
**Expected:** Should return 1 row

### Test 3: Verify index is being used
```sql
EXPLAIN SELECT * FROM jobs WHERE status = 'PENDING' ORDER BY created_at LIMIT 1;
```
**Expected:** Should show "Index Scan" (not "Seq Scan")

---

## 🆘 Still Having Issues?

### Option 1: Create indexes one at a time

Instead of running the whole script, create just the critical one:

```sql
CREATE INDEX idx_jobs_status_created ON jobs(status, created_at);
```

Then add more one by one:

```sql
CREATE INDEX idx_report_runs_workspace_created ON report_runs(workspace_id, created_at);
CREATE INDEX idx_section_runs_report_run ON section_runs(report_run_id);
CREATE INDEX idx_exports_report_run ON exports(report_run_id);
```

### Option 2: Check your schema first

See what columns exist:

```sql
-- Check jobs table
SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs';

-- Check report_runs table
SELECT column_name FROM information_schema.columns WHERE table_name = 'report_runs';

-- Check template_sections table
SELECT column_name FROM information_schema.columns WHERE table_name = 'template_sections';
```

Then only create indexes on columns that exist.

---

## ✅ Success Checklist

After running the index script:

- [ ] No error messages (or only "already exists" messages)
- [ ] At least 6 indexes created (check with verification query)
- [ ] `idx_jobs_status_created` exists (most critical)
- [ ] Worker polling is faster (test by creating a job)

---

## 🚀 Quick Fix Summary

**If you just want it to work:**

1. Use this file: `scripts/add-indexes-minimal.sql`
2. Copy entire contents
3. Paste in Supabase SQL Editor
4. Click "Run"
5. Ignore any "already exists" or "table not found" errors
6. Done! ✅

**The critical index (jobs table) will be created and that's 80% of the performance benefit.**

---

**Still stuck?** Share the exact error message and I'll create a custom fix for your schema.




