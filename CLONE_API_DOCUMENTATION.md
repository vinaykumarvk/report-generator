# 📋 Clone Template API Documentation

## Endpoint

```
POST /api/templates/:templateId/clone
```

## Description

Creates a complete copy of an existing template, including all sections, configurations, and source assignments. The cloned template is created with `DRAFT` status and a new version number.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateId` | UUID | Yes | ID of the template to clone |

### Body Parameters

```json
{
  "name": "Q1 2025 Financial Report"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Name for the new cloned template |

## Response

### Success (200 OK)

```json
{
  "template": {
    "id": "new-uuid-generated",
    "workspace_id": "workspace-uuid",
    "name": "Q1 2025 Financial Report",
    "description": "...",
    "audience": "...",
    "tone": "...",
    "domain": "...",
    "jurisdiction": "...",
    "formats": ["PDF", "DOCX"],
    "status": "DRAFT",
    "version_number": 1,
    "default_vector_store_ids": ["source-1", "source-2"],
    "history_json": {
      "clonedFrom": {
        "templateId": "original-template-id",
        "templateName": "Q4 2024 Financial Report",
        "clonedAt": "2025-01-15T10:30:00Z"
      }
    },
    "sections": [
      {
        "id": "new-section-uuid-1",
        "template_id": "new-uuid-generated",
        "title": "Executive Summary",
        "order": 1,
        "vector_policy_json": {
          "mode": "INHERIT"
        },
        "status": "DRAFT",
        ...
      },
      {
        "id": "new-section-uuid-2",
        "template_id": "new-uuid-generated",
        "title": "Financial Position",
        "order": 2,
        "vector_policy_json": {
          "mode": "OVERRIDE",
          "connectorIds": ["custom-source-1"]
        },
        "status": "DRAFT",
        ...
      }
    ]
  },
  "message": "Template \"Q4 2024 Financial Report\" successfully cloned as \"Q1 2025 Financial Report\"",
  "clonedSectionCount": 5
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": "New template name is required"
}
```

#### 404 Not Found
```json
{
  "error": "Template not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to clone template"
}
```

## What Gets Cloned

### ✅ Copied (with new IDs)

- **Template fields**: name (modified), description, audience, tone, domain, jurisdiction, formats
- **Default sources**: `default_vector_store_ids` array
- **All sections**: Every section from the original template
- **Section configuration**: Title, purpose, order, prompts, length constraints
- **Source inheritance**: `vector_policy_json` with INHERIT/OVERRIDE mode preserved
- **Dependencies**: Section dependency references (note: these reference section IDs that will be new)
- **Web policies**: `web_policy_json` configuration
- **Quality gates**: `quality_gates_json` configuration

### 🔄 Reset

- **Status**: Always set to `DRAFT`
- **Version**: Reset to `1`
- **IDs**: All new UUIDs generated
- **Timestamps**: New `created_at` and `updated_at`

### 📝 Added

- **History tracking**: `history_json` records the clone source

## Use Cases

### 1. Quarterly Report Templates
```bash
# Clone Q4 2024 report for Q1 2025
POST /api/templates/q4-2024-id/clone
{ "name": "Q1 2025 Financial Report" }
```

### 2. Regional Variations
```bash
# Clone US report for EU region
POST /api/templates/us-report-id/clone
{ "name": "EU Regulatory Report 2025" }
```

### 3. Template Versioning
```bash
# Create a new version for testing changes
POST /api/templates/prod-template-id/clone
{ "name": "Production Template v2 (Testing)" }
```

## Frontend Integration

### React Example

```typescript
async function cloneTemplate(templateId: string, newName: string) {
  try {
    const response = await fetch(`/api/templates/${templateId}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    const data = await response.json();
    console.log(`✅ Cloned ${data.clonedSectionCount} sections`);
    return data.template;
  } catch (error) {
    console.error('Failed to clone template:', error);
    throw error;
  }
}
```

### UI Dialog Example

```jsx
function CloneTemplateDialog({ template, onClose, onSuccess }) {
  const [newName, setNewName] = useState(`${template.name} (Copy)`);
  const [loading, setLoading] = useState(false);

  async function handleClone() {
    setLoading(true);
    try {
      const cloned = await cloneTemplate(template.id, newName);
      onSuccess(cloned);
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog>
      <h2>Clone Template</h2>
      <p>Original: {template.name}</p>
      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="New template name"
      />
      <button onClick={handleClone} disabled={loading}>
        {loading ? 'Cloning...' : 'Clone Template'}
      </button>
    </Dialog>
  );
}
```

## Testing

### Manual Test
```bash
node scripts/test-clone-template.js <templateId> "New Template Name"
```

### cURL Test
```bash
curl -X POST http://localhost:3000/api/templates/<template-id>/clone \
  -H "Content-Type: application/json" \
  -d '{"name": "Cloned Template"}'
```

## Notes

- ⚠️ **Dependencies**: Section dependencies reference section IDs. After cloning, these IDs will be different. The dependency array is preserved but may need manual review.
- ✅ **Sources**: Default sources at template level are preserved. Section-level INHERIT/OVERRIDE configurations are maintained.
- ✅ **Audit Trail**: Clone operations are logged in `audit_logs` table (if it exists).
- ✅ **Idempotent**: You can clone the same template multiple times with different names.

## Related Endpoints

- `GET /api/templates/:id` - Get template details
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates` - Create new template

