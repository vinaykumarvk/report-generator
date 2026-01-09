# Section Recovery Guide

## Problem Identified

All template sections were lost during a migration. The `template_sections` table currently has **0 sections** for all 9 templates.

## Root Cause

The `template_sections` table has a **schema mismatch**:
- **Current database schema**: Uses integer IDs, `order_index`, old column structure
- **Application code expects**: UUID IDs, `order` column, new column structure with `purpose`, `output_format`, `evidence_policy`, etc.

## Recovery Solution

### Good News: Sections Are Preserved!

Sections are preserved in **report run snapshots** (`report_runs.template_version_snapshot_json`). We found:
- **6 templates** with recoverable sections
- **44 total sections** that can be restored

### Templates with Recoverable Sections:

1. **sol doc test 2 (Copy)** - 8 sections
2. **Solutions Document** - 8 sections  
3. **Company Research Report** - 7 sections
4. **Test Case Generator** - 7 sections
5. **Business Requirement Document** - 7 sections
6. **RFP Response** - 7 sections

## Recovery Steps

### Step 1: Fix Database Schema

Run the migration script in Supabase SQL Editor:

**File:** `scripts/add-missing-section-columns.sql`

This adds all missing columns:
- `purpose`
- `order` (quoted, replaces `order_index`)
- `output_format`
- `target_length_min` / `target_length_max`
- `dependencies`
- `evidence_policy`
- `vector_policy_json`
- `web_policy_json`
- `quality_gates_json`
- `status`
- `prompt`
- `source_mode`
- `writing_style`
- `created_at` / `updated_at`

### Step 2: Recover Sections

After running the migration, execute:

```bash
node scripts/recover-sections-from-snapshots.js --execute
```

This will:
1. Extract sections from report run snapshots
2. Restore them to the `template_sections` table
3. Match sections to their templates by `template_id`

### Step 3: Verify Recovery

```bash
node scripts/get-template-section-counts.js
```

This should show sections restored for the 6 templates.

## Alternative: Manual Recovery

If the automated recovery doesn't work, you can manually extract sections from snapshots:

```sql
-- View sections in snapshots
SELECT 
  r.id as run_id,
  r.template_id,
  t.name as template_name,
  jsonb_array_length(r.template_version_snapshot_json->'sections') as section_count,
  r.template_version_snapshot_json->'sections' as sections_json
FROM report_runs r
JOIN templates t ON t.id = r.template_id
WHERE r.template_version_snapshot_json->'sections' IS NOT NULL
ORDER BY r.created_at DESC;
```

Then manually insert sections using the API endpoint:
```
POST /api/templates/{templateId}/sections
```

## Prevention

To prevent future data loss:
1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Keep template snapshots in report_runs** (already working ✅)
4. **Add database migration versioning**

## Files Created

- `scripts/recover-sections-from-snapshots.js` - Recovery script
- `scripts/recover-sections-simple.js` - Simplified recovery via API
- `scripts/add-missing-section-columns.sql` - Schema migration
- `scripts/get-template-section-counts.js` - Verification script

---

**Status**: ⚠️ **AWAITING SCHEMA MIGRATION**

The recovery is ready, but the database schema must be updated first.
