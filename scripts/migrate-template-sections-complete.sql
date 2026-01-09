-- Complete migration for template_sections table
-- This migrates from old schema (integer IDs) to new schema (UUID IDs)

-- Step 1: Add missing columns (if they don't exist)
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS output_format text NOT NULL DEFAULT 'NARRATIVE';
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS target_length_min int;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS target_length_max int;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS vector_policy_json jsonb;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS web_policy_json jsonb;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS quality_gates_json jsonb;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'DRAFT';
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS prompt text;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS source_mode text DEFAULT 'inherit';
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS writing_style text;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS dependencies text[] NOT NULL DEFAULT '{}';
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS evidence_policy text;

-- Step 2: Add 'order' column (migrate from order_index if it exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'template_sections' AND column_name = 'order'
  ) THEN
    ALTER TABLE template_sections ADD COLUMN "order" int;
    
    -- Copy data from order_index if it exists
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

-- Step 3: Migrate template_id from integer to UUID
-- This is the critical step - we need to:
-- 1. Drop the foreign key constraint
-- 2. Change the column type
-- 3. Recreate the foreign key constraint

-- First, drop the foreign key constraint if it exists
ALTER TABLE template_sections 
  DROP CONSTRAINT IF EXISTS template_sections_template_id_fkey;

-- Change template_id column type from integer to UUID
-- Note: This will fail if there are existing integer values that can't be converted
-- We'll need to handle orphaned sections (template_id = 2) separately
ALTER TABLE template_sections 
  ALTER COLUMN template_id TYPE uuid USING template_id::text::uuid;

-- Recreate the foreign key constraint
ALTER TABLE template_sections 
  ADD CONSTRAINT template_sections_template_id_fkey 
  FOREIGN KEY (template_id) 
  REFERENCES templates(id) 
  ON DELETE CASCADE;

-- Step 4: Ensure created_at and updated_at exist
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Step 5: Create index on template_id for performance
CREATE INDEX IF NOT EXISTS idx_template_sections_template_id 
  ON template_sections(template_id);

-- Note: Orphaned sections (template_id = 2 as integer) will need to be deleted
-- or manually mapped to a UUID template before this migration can succeed.
-- Run this query first to check for orphaned sections:
-- SELECT COUNT(*) FROM template_sections WHERE template_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
