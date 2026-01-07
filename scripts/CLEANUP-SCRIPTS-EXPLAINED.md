# Cleanup Scripts Explained

## 📋 Two Different Scripts for Two Different Purposes

### 1. `cleanup-failed-jobs.sql` - Deletes FAILED JOBS Only
**Purpose**: Clean up failed job records that clutter the database

**What it deletes**:
- ✅ Failed jobs for COMPLETED runs (runs are done, jobs are just clutter)
- ✅ Failed GENERATE_TRANSITIONS jobs (feature removed)
- ✅ Old failed jobs (optional, configurable age)

**What it does NOT delete**:
- ❌ Failed runs (report_runs table)
- ❌ Section runs
- ❌ Exports
- ❌ Any other data

**When to use**: When you want to clean up job history but keep the runs

---

### 2. `delete-stuck-and-failed-reports.sql` - Deletes FAILED RUNS
**Purpose**: Delete entire failed or stuck report runs

**What it deletes**:
- ✅ Report runs with status = 'FAILED'
- ✅ Report runs with 0 sections (stuck reports)
- ✅ Related data (via CASCADE):
  - Section runs
  - Evidence bundles
  - Section artifacts
  - Section scores
  - Exports
  - Run events
  - Dependency snapshots
- ✅ Orphaned jobs (jobs referencing deleted runs)

**What it does NOT delete**:
- ❌ Jobs for runs that still exist
- ❌ Other runs

**When to use**: When you want to remove failed/stuck runs entirely

---

## 🎯 Which Script to Use?

### Scenario 1: Clean up job clutter, keep runs
**Use**: `cleanup-failed-jobs.sql`
- You have COMPLETED runs with failed EXPORT jobs
- You want to keep the runs but remove the failed job records
- Example: Run completed successfully, but one EXPORT job failed

### Scenario 2: Remove failed runs entirely
**Use**: `delete-stuck-and-failed-reports.sql`
- You have FAILED runs you don't need
- You have stuck runs (0 sections) that never started
- You want to completely remove these runs and all their data

### Scenario 3: Both
**Use both scripts** (in order):
1. First: `delete-stuck-and-failed-reports.sql` (removes failed runs + their jobs)
2. Then: `cleanup-failed-jobs.sql` (removes remaining failed jobs for completed runs)

---

## 📊 Current Situation

Based on the analysis:
- **21 failed jobs** exist
  - 16 for COMPLETED runs (use `cleanup-failed-jobs.sql`)
  - 5 GENERATE_TRANSITIONS jobs (use `cleanup-failed-jobs.sql`)
  - 5 for FAILED runs (will be deleted by `delete-stuck-and-failed-reports.sql`)

---

## ⚠️ Important Notes

1. **Jobs table has no CASCADE**: The `jobs` table doesn't have foreign key constraints with `ON DELETE CASCADE`, so deleting runs doesn't automatically delete jobs. That's why we need both scripts.

2. **Preview before deleting**: Both scripts include preview queries. Always run the preview first to see what will be deleted.

3. **Use transactions**: Both scripts use `BEGIN;` and require `COMMIT;` or `ROLLBACK;` to finalize.

4. **Backup first**: Consider backing up your database before running deletion scripts.

---

## 🔄 Recommended Cleanup Workflow

```sql
-- Step 1: Preview what will be deleted
-- (Run preview queries from delete-stuck-and-failed-reports.sql)

-- Step 2: Delete failed/stuck runs
BEGIN;
DELETE FROM report_runs WHERE ...;
DELETE FROM jobs WHERE ...; -- orphaned jobs
COMMIT;

-- Step 3: Preview remaining failed jobs
-- (Run preview queries from cleanup-failed-jobs.sql)

-- Step 4: Clean up remaining failed jobs
BEGIN;
DELETE FROM jobs WHERE status = 'FAILED' AND ...;
COMMIT;
```

---

**Summary**: 
- `cleanup-failed-jobs.sql` = Delete failed JOB records only
- `delete-stuck-and-failed-reports.sql` = Delete failed RUN records and all their data

