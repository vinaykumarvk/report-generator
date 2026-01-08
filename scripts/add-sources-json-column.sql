-- Add sources_json column to templates table
-- This will store the full source configuration including vector stores and web search

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS sources_json jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN templates.sources_json IS 'Stores source configurations (vector stores, web search) as JSON array';





