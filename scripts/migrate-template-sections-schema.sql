-- Migration script to ensure template_sections table matches expected schema
-- This adds missing columns if they don't exist

-- Add missing columns one by one (IF NOT EXISTS prevents errors if column already exists)

-- Order column (quoted because it's a reserved word)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'template_sections' AND column_name = 'order'
  ) THEN
    ALTER TABLE template_sections ADD COLUMN "order" int NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Purpose column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS purpose text;

-- Output format column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS output_format text NOT NULL DEFAULT 'NARRATIVE';

-- Target length columns
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS target_length_min int;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS target_length_max int;

-- Dependencies column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS dependencies text[] NOT NULL DEFAULT '{}';

-- Evidence policy column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS evidence_policy text;

-- Vector policy JSON
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS vector_policy_json jsonb;

-- Web policy JSON
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS web_policy_json jsonb;

-- Quality gates JSON
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS quality_gates_json jsonb;

-- Status column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'DRAFT';

-- Prompt column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS prompt text;

-- Source mode column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS source_mode text DEFAULT 'inherit';

-- Writing style column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS writing_style text;

-- Ensure template_id and id are UUIDs (if they're currently integers, this will need manual migration)
-- Note: This is a complex migration that may require data transformation
-- For now, we'll work with whatever type exists

COMMENT ON TABLE template_sections IS 'Sections for report templates - stores section configuration and metadata';
