-- Add transitions_json column to report_runs table
-- This column stores the generated transitions between sections

ALTER TABLE report_runs 
ADD COLUMN IF NOT EXISTS transitions_json jsonb;

-- Add comment for documentation
COMMENT ON COLUMN report_runs.transitions_json IS 'Stores generated transitions between sections as JSON array';

