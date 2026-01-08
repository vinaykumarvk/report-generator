-- Step 5: Templates Index

-- RUN THIS FIFTH (separately)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_workspace
  ON templates(workspace_id, created_at DESC);

-- Verify:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_templates_workspace';




