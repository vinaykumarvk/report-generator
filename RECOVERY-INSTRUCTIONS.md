# Section Recovery Instructions

## Current Status

- ✅ **44 sections** found in report run snapshots (ready to recover)
- ❌ **Schema mismatch**: `template_id` is integer, needs to be UUID
- ❌ **Missing columns**: `purpose`, `order`, `output_format`, `evidence_policy`, etc.

## Recovery Steps

### Step 1: Delete Orphaned Sections (Optional but Recommended)

The 20 orphaned sections (template_id = 2, integer) will block the migration. Delete them first:

```sql
DELETE FROM template_sections WHERE template_id = 2;
```

### Step 2: Run Schema Migration

Run this SQL script in **Supabase SQL Editor**:

**File:** `scripts/migrate-template-sections-complete.sql`

This will:
1. Add all missing columns (`purpose`, `order`, `output_format`, etc.)
2. Convert `template_id` from integer to UUID
3. Recreate foreign key constraints
4. Add indexes

### Step 3: Recover Sections

After migration completes, run:

```bash
node scripts/recover-sections-with-migration.js
```

This will:
- Check schema is ready
- Recover 44 sections from snapshots
- Restore them to the correct UUID templates

## Expected Result

After recovery:
- ✅ **44 sections** restored and connected to templates
- ✅ All sections use UUID `template_id`
- ✅ All sections have required columns
- ✅ Sections visible in Reports Studio

## Verification

After recovery, verify with:

```bash
node scripts/get-template-section-counts.js
```

Should show sections for all 6 templates.

---

**Status**: ⚠️ **AWAITING SCHEMA MIGRATION**

The recovery script is ready, but the database schema must be migrated first.
