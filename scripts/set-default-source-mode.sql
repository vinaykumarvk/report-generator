-- Set default value for source_mode column in template_sections
-- This ensures all sections default to "Same as Report" (inherit)

-- First, add the column if it doesn't exist
ALTER TABLE template_sections 
ADD COLUMN IF NOT EXISTS source_mode text;

-- Set default value for the column
ALTER TABLE template_sections 
ALTER COLUMN source_mode SET DEFAULT 'inherit';

-- Update existing NULL values to 'inherit'
UPDATE template_sections 
SET source_mode = 'inherit' 
WHERE source_mode IS NULL;

