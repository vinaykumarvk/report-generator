-- Fix id column to be UUID type
-- This should have been done in the migration, but if it wasn't, run this

-- Step 1: Drop primary key constraint
ALTER TABLE template_sections DROP CONSTRAINT IF EXISTS template_sections_pkey;

-- Step 2: Change id column type from integer to UUID
-- Generate new UUIDs for existing rows
ALTER TABLE template_sections 
  ALTER COLUMN id TYPE uuid USING gen_random_uuid();

-- Step 3: Recreate primary key
ALTER TABLE template_sections 
  ADD PRIMARY KEY (id);

-- Step 4: Set default for future inserts
ALTER TABLE template_sections 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
