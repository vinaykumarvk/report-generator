-- Fix template_sections table schema to match application code
-- This migration updates the table structure to support the current application

-- Step 1: Check if we need to migrate from old schema to new schema
-- The old schema has: id (int), template_id (int), order_index, section_type, content, is_editable
-- The new schema needs: id (uuid), template_id (uuid), order, purpose, output_format, etc.

-- IMPORTANT: This is a destructive migration if old data exists
-- Backup first if you have important data in the old schema

-- Step 2: Add new columns that don't exist
DO $$ 
BEGIN
  -- Add purpose column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'purpose') THEN
    ALTER TABLE template_sections ADD COLUMN purpose text;
  END IF;
  
  -- Add order column (quoted because it's a reserved word)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'order') THEN
    -- If order_index exists, copy data and drop it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'order_index') THEN
      ALTER TABLE template_sections ADD COLUMN "order" int;
      UPDATE template_sections SET "order" = order_index WHERE "order" IS NULL;
      ALTER TABLE template_sections ALTER COLUMN "order" SET NOT NULL;
      ALTER TABLE template_sections ALTER COLUMN "order" SET DEFAULT 1;
      -- Don't drop order_index yet - keep for safety
    ELSE
      ALTER TABLE template_sections ADD COLUMN "order" int NOT NULL DEFAULT 1;
    END IF;
  END IF;
  
  -- Add output_format
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'output_format') THEN
    ALTER TABLE template_sections ADD COLUMN output_format text NOT NULL DEFAULT 'NARRATIVE';
  END IF;
  
  -- Add target_length_min
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'target_length_min') THEN
    ALTER TABLE template_sections ADD COLUMN target_length_min int;
  END IF;
  
  -- Add target_length_max
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'target_length_max') THEN
    ALTER TABLE template_sections ADD COLUMN target_length_max int;
  END IF;
  
  -- Add dependencies
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'dependencies') THEN
    ALTER TABLE template_sections ADD COLUMN dependencies text[] NOT NULL DEFAULT '{}';
  END IF;
  
  -- Add evidence_policy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'evidence_policy') THEN
    ALTER TABLE template_sections ADD COLUMN evidence_policy text;
  END IF;
  
  -- Add vector_policy_json
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'vector_policy_json') THEN
    ALTER TABLE template_sections ADD COLUMN vector_policy_json jsonb;
  END IF;
  
  -- Add web_policy_json
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'web_policy_json') THEN
    ALTER TABLE template_sections ADD COLUMN web_policy_json jsonb;
  END IF;
  
  -- Add quality_gates_json
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'quality_gates_json') THEN
    ALTER TABLE template_sections ADD COLUMN quality_gates_json jsonb;
  END IF;
  
  -- Add status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'status') THEN
    ALTER TABLE template_sections ADD COLUMN status text NOT NULL DEFAULT 'DRAFT';
  END IF;
  
  -- Add prompt
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'prompt') THEN
    ALTER TABLE template_sections ADD COLUMN prompt text;
  END IF;
  
  -- Add source_mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'source_mode') THEN
    ALTER TABLE template_sections ADD COLUMN source_mode text DEFAULT 'inherit';
  END IF;
  
  -- Add writing_style
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'writing_style') THEN
    ALTER TABLE template_sections ADD COLUMN writing_style text;
  END IF;
  
  -- Add created_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'created_at') THEN
    ALTER TABLE template_sections ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
  
  -- Add updated_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_sections' AND column_name = 'updated_at') THEN
    ALTER TABLE template_sections ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Note: Converting id and template_id from integer to UUID requires more complex migration
-- For now, the application should work if we ensure all new columns exist
