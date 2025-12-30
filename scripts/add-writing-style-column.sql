-- Add writing_style column to template_sections table
ALTER TABLE template_sections 
ADD COLUMN IF NOT EXISTS writing_style text;

-- Add comment
COMMENT ON COLUMN template_sections.writing_style IS 'Writing style ID from writing-styles.json (e.g., executive_briefing, analytical_research)';


