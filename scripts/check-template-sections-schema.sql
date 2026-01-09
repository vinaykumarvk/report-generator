-- Check actual schema of template_sections table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'template_sections'
ORDER BY ordinal_position;
