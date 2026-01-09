# Section Connection Issue - Root Cause Analysis

## ✅ Discovery: Data EXISTS, Connection is Broken

### The Problem

**Data Status:**
- ✅ **20 sections exist** in `template_sections` table
- ❌ **Connection broken**: Sections have `template_id = 2` (integer)
- ❌ **Templates use UUIDs**: All 9 templates have UUID IDs
- ❌ **Query fails**: `.in('template_id', [UUIDs])` doesn't match integer `2`

### Root Cause

1. **Schema Mismatch:**
   - `template_sections.template_id` is **integer** type
   - `templates.id` is **UUID** type
   - Foreign key relationship is broken

2. **Data Orphaned:**
   - Sections point to `template_id = 2` (integer)
   - No template with integer ID `2` exists
   - Template `2` may have been deleted or migrated to UUID

3. **API Query Issue:**
   ```typescript
   // This query fails because it compares UUIDs to integer 2
   .in('template_id', templateIds) // templateIds are UUIDs
   // Won't match sections with template_id = 2 (integer)
   ```

### Current State

**Sections in Database:**
- 20 sections with `template_id = 2`
- Using old schema: `order_index`, `section_type`, `content`, `is_editable`
- Missing new columns: `purpose`, `output_format`, `evidence_policy`, etc.

**Templates:**
- 9 templates, all with UUID IDs
- None match integer `template_id = 2`

### Solutions

#### Option 1: Migrate Sections to UUID Template (Recommended)

If we can identify which UUID template these sections belong to:

1. **Identify the correct template UUID** (by matching section titles with snapshots)
2. **Update sections** to use the UUID:
   ```sql
   UPDATE template_sections 
   SET template_id = '<correct-uuid>' 
   WHERE template_id = 2;
   ```

3. **Migrate schema** to add missing columns and convert `order_index` → `order`

#### Option 2: Recreate Sections from Snapshots

Use the 44 sections from report run snapshots (already identified):
- These are from the current UUID-based templates
- They use the new schema
- They're more recent than the orphaned sections

#### Option 3: Delete Orphaned Sections

If template `2` no longer exists and these sections are obsolete:
```sql
DELETE FROM template_sections WHERE template_id = 2;
```

### Recommended Action

**Use Option 2** (recover from snapshots) because:
1. ✅ Snapshots have 44 sections (vs 20 orphaned)
2. ✅ Snapshots match current UUID templates
3. ✅ Snapshots use new schema
4. ✅ Snapshots are from recent report runs (Jan 2026)

### Next Steps

1. ✅ **Schema Migration**: Run `scripts/add-missing-section-columns.sql` to add missing columns
2. ✅ **Recover from Snapshots**: Run `scripts/recover-sections-from-snapshots.js --execute`
3. ⚠️ **Cleanup Orphaned**: After recovery, decide whether to delete the 20 orphaned sections

---

**Status**: Data exists but connection is broken. Recovery from snapshots is the best path forward.
