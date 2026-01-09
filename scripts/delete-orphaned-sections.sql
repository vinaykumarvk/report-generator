-- Delete orphaned sections (sections whose template_id doesn't exist in templates table)
-- This is safe because these sections can't be accessed anyway (no parent template)

DELETE FROM template_sections 
WHERE template_id NOT IN (
  SELECT id FROM templates
);

-- Verify deletion
SELECT COUNT(*) as remaining_orphaned_sections
FROM template_sections 
WHERE template_id NOT IN (
  SELECT id FROM templates
);
