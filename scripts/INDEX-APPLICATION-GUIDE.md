# How to Apply Database Indexes

## Problem

You got this error:
```
ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

This happens because `CREATE INDEX CONCURRENTLY` can't be run in a transaction, but Supabase SQL Editor wraps queries in transactions by default.

## Solutions

### Option 1: Simple (Recommended for Development/Small Databases)

**Use:** `scripts/add-indexes-simple.sql`

This version:
- ✅ Runs all at once
- ✅ Can be copy-pasted into SQL Editor
- ⚠️  Will lock tables briefly (~1-2 seconds)
- ✅ Safe for small databases (<10,000 rows)

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `scripts/add-indexes-simple.sql`
3. Paste and click "Run"
4. Done! ✅

---

### Option 2: Step-by-Step (Recommended for Production)

**Use:** `scripts/add-indexes-step1.sql` through `step5.sql`

This version:
- ✅ No table locks (uses CONCURRENTLY)
- ✅ Safe for production with active traffic
- ⚠️  Must run each file separately

**Steps:**
1. Open Supabase Dashboard → SQL Editor

2. Run Step 1 (most critical - jobs table):
   ```sql
   -- Copy from: scripts/add-indexes-step1.sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_created 
     ON jobs(status, created_at) 
     WHERE status IN ('PENDING', 'CLAIMED');
   ```
   Wait for completion ✅

3. Run Step 2 (report runs):
   ```sql
   -- Copy from: scripts/add-indexes-step2.sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_runs_workspace_status_created
     ON report_runs(workspace_id, status, created_at DESC);
   ```
   Wait for completion ✅

4. Run Step 3 (section runs):
   ```sql
   -- Copy from: scripts/add-indexes-step3.sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_section_runs_report_run
     ON section_runs(report_run_id, created_at);
   ```
   Wait for completion ✅

5. Run Step 4 (exports):
   ```sql
   -- Copy from: scripts/add-indexes-step4.sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exports_run_created
     ON exports(report_run_id, created_at DESC);
   ```
   Wait for completion ✅

6. Run Step 5 (templates):
   ```sql
   -- Copy from: scripts/add-indexes-step5.sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_workspace
     ON templates(workspace_id, created_at DESC);
   ```
   Wait for completion ✅

---

## Verification

After applying indexes, verify they exist:

```sql
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename;
```

**Expected output (at least 8 indexes):**
```
tablename       | indexname
----------------+----------------------------------------
exports         | idx_exports_run_created
jobs            | idx_jobs_status_created
report_runs     | idx_report_runs_workspace_status_created
section_runs    | idx_section_runs_report_run
templates       | idx_templates_workspace
```

---

## Which Option Should I Use?

### Use Option 1 (Simple) if:
- ✅ Development environment
- ✅ Database has < 10,000 rows
- ✅ No active users right now
- ✅ You want it done quickly

### Use Option 2 (Step-by-Step) if:
- ✅ Production environment
- ✅ Active users/workers running
- ✅ Database has > 10,000 rows
- ✅ Can't afford table locks

---

## Troubleshooting

### "Index already exists"
This is fine! It means the index is already there. Skip to the next one.

### "Relation does not exist"
The table doesn't exist yet. This is normal if you haven't run migrations. Skip that index.

### "Out of memory"
Your database is very large. Contact support or:
1. Run indexes one at a time
2. Use CONCURRENTLY version
3. Increase database resources temporarily

### Still getting transaction error?
Make sure you're running each statement separately (one at a time) in the SQL Editor, not selecting all and clicking "Run".

---

## Quick Start

**For most users (development):**

```bash
# 1. Open Supabase Dashboard
# 2. Go to SQL Editor
# 3. Copy entire contents of scripts/add-indexes-simple.sql
# 4. Paste and click "Run"
# 5. Verify with query above
```

Done! Your database now has performance indexes. 🎉

---

**Need help?** See `CRITICAL-FIXES-SUMMARY.md` for full details.

