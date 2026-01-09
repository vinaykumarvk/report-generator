-- Add missing columns to template_sections table
-- This allows the application to work with the current schema

-- Add purpose column
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS purpose text;

-- Add order column (quoted because it's a reserved word)
-- If order_index exists, we'll keep both for now
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'template_sections' AND column_name = 'order'
  ) THEN
    ALTER TABLE template_sections ADD COLUMN "order" int;
    -- Copy from order_index if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'template_sections' AND column_name = 'order_index'
    ) THEN
      UPDATE template_sections SET "order" = order_index WHERE "order" IS NULL;
    END IF;
    ALTER TABLE template_sections ALTER COLUMN "order" SET NOT NULL;
    ALTER TABLE template_sections ALTER COLUMN "order" SET DEFAULT 1;
  END IF;
END $$;

-- Add output_format
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS output_format text NOT NULL DEFAULT 'NARRATIVE';

-- Add target_length columns
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS target_length_min int;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS target_length_max int;

-- Add dependencies (as text array)
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS dependencies text[] NOT NULL DEFAULT '{}';

-- Add evidence_policy
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS evidence_policy text;

-- Add vector_policy_json
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS vector_policy_json jsonb;

-- Add web_policy_json
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS web_policy_json jsonb;

-- Add quality_gates_json
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS quality_gates_json jsonb;

-- Add status
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'DRAFT';

-- Add prompt
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS prompt text;

-- Add source_mode
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS source_mode text DEFAULT 'inherit';

-- Add writing_style
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS writing_style text;

-- Ensure created_at and updated_at exist
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
