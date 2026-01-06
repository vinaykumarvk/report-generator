# Root Cause Analysis: Section Sources Display Issue

## Problem
- **Local:** Section sources correctly show "Vector: WealthProduct"
- **Cloud:** Section sources show "LLM_ONLY" instead

## Root Cause

### Code Flow

1. **API Response** (`app/api/templates/route.ts:48`)
   ```typescript
   connectors: Array.isArray(template.sources_json) ? template.sources_json : []
   ```
   Maps `sources_json` from database to `connectors` for frontend

2. **Display Logic** (`app/runs/run-dashboard-client.tsx:70-86`)
   ```typescript
   function formatTemplateSources(template?: Template) {
     const connectors = template?.connectors || [];
     if (connectors.length === 0) return "None";
     const vectorNames = connectors
       .filter((connector) => connector.type === "VECTOR")
       .map((connector) => connector.name)
       .filter(Boolean);
     // ...
     return parts.join(" • ");
   }
   ```

3. **Section Display** (`app/runs/run-dashboard-client.tsx:99-110`)
   ```typescript
   function formatSectionSources(section, vectorStores, template) {
     if (section.sourceMode === "custom") {
       // Uses customConnectorIds
     }
     return `Inherited: ${formatTemplateSources(template)}`;
   }
   ```

### Expected Data Structure

The `sources_json` column in the `templates` table should contain:
```json
[
  {
    "id": "connector-uuid",
    "type": "VECTOR",
    "name": "WealthProduct",
    "metadata": {
      "vectorStoreId": "vs_xxx"
    }
  }
]
```

### The Issue

**In Cloud:**
- `sources_json` is likely:
  - Empty array `[]`
  - `null`
  - Missing the connector objects
  - Has different structure

**In Local:**
- `sources_json` has proper connector objects with `type: "VECTOR"` and `name: "WealthProduct"`

### Why This Happens

1. **Template Creation/Update Difference:**
   - Local templates may have been created/updated with proper `sources_json`
   - Cloud templates may have been created before `sources_json` was properly populated
   - Or cloud templates were updated without including connector data

2. **Migration Issue:**
   - The `sources_json` column may have been added but not backfilled
   - Old templates don't have connector data in `sources_json`

3. **Data Sync Issue:**
   - Local and cloud databases are out of sync
   - Template was edited locally but not synced to cloud

## Verification Steps

1. **Check Cloud Database:**
   ```sql
   SELECT id, name, sources_json 
   FROM templates 
   WHERE name = 'Solutions Document';
   ```

2. **Check Local Database:**
   ```sql
   SELECT id, name, sources_json 
   FROM templates 
   WHERE name = 'Solutions Document';
   ```

3. **Compare Structures:**
   - Cloud: `sources_json` should be `[]` or `null` or missing VECTOR connectors
   - Local: `sources_json` should have `[{"type": "VECTOR", "name": "WealthProduct", ...}]`

## Solution Options

### Option 1: Fix Data (Recommended)
Update cloud templates to have proper `sources_json`:
- Query connectors table for VECTOR connectors
- Populate `sources_json` with connector objects
- Ensure structure matches: `[{id, type, name, metadata}]`

### Option 2: Fix Code (Fallback)
If `sources_json` is empty, fall back to:
- Query `connectors` table directly
- Use `default_vector_store_ids` if available
- Map vector store IDs to connector names

### Option 3: Hybrid Approach
- Check `sources_json` first (current behavior)
- If empty, query connectors table
- Populate `sources_json` on-the-fly or cache result

## Next Steps

1. ✅ **Verify root cause** - Check cloud database `sources_json` values
2. ⏳ **Fix data** - Populate `sources_json` for cloud templates
3. ⏳ **Add fallback** - Code should handle empty `sources_json` gracefully
4. ⏳ **Test** - Verify both local and cloud show correct sources

