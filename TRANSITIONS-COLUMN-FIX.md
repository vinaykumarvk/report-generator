# Root Cause: Missing transitions_json Column

## Problem

The `GENERATE_TRANSITIONS` job is failing with:
```
Failed to update run: Supabase request failed
```

## Root Cause

**The `transitions_json` column does NOT exist in the `report_runs` table!**

### Evidence:
1. ✅ Code tries to update `transitions_json` (worker-core.js:271)
2. ✅ `updateRun` maps `transitionsJson` → `transitions_json` (workerStore.ts:152)
3. ❌ Database schema doesn't have `transitions_json` column
4. ❌ Query error: `column report_runs.transitions_json does not exist` (code: 42703)

### Database Schema Issue

Looking at `scripts/supabase_schema.sql`:
```sql
create table if not exists report_runs (
  ...
  blueprint_json jsonb,
  final_report_json jsonb,
  -- ❌ transitions_json is MISSING!
  ...
);
```

But the code expects it:
- `workerStore.ts` tries to update `transitions_json`
- Frontend expects `transitions_json` in run data
- Worker tries to store transitions there

---

## Solution

### Step 1: Add the Missing Column

Run this SQL in your Supabase SQL editor:

```sql
ALTER TABLE report_runs 
ADD COLUMN IF NOT EXISTS transitions_json jsonb;

COMMENT ON COLUMN report_runs.transitions_json IS 'Stores generated transitions between sections as JSON array';
```

### Step 2: Verify

After adding the column, verify it exists:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'report_runs' 
AND column_name = 'transitions_json';
```

Should return:
```
column_name        | data_type
-------------------|----------
transitions_json   | jsonb
```

### Step 3: Retry the Job

After adding the column:
1. The stuck `GENERATE_TRANSITIONS` job should complete on its next retry
2. Or manually retry the job if it's failed

---

## Why This Happened

The `transitions_json` column was:
- ✅ Added to the code
- ✅ Used in worker and frontend
- ❌ **Never added to the database schema**

This is a schema migration that was missed.

---

## Prevention

1. **Always update schema.sql** when adding new columns
2. **Run migrations** before deploying code that uses new columns
3. **Test database operations** in a staging environment first

---

## Files to Update

1. ✅ `scripts/add-transitions-json-column.sql` - Migration script (created)
2. ⏳ `scripts/supabase_schema.sql` - Add column to schema definition
3. ⏳ Run migration in production database

---

## Quick Fix

**Run this in Supabase SQL Editor:**

```sql
ALTER TABLE report_runs ADD COLUMN IF NOT EXISTS transitions_json jsonb;
```

Then the `GENERATE_TRANSITIONS` job should complete successfully on its next attempt.

