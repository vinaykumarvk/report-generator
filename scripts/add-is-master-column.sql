-- Add is_master column to templates table
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN templates.is_master IS 'Indicates if this is a master template that should be grouped separately';

