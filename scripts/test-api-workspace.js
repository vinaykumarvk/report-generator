const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWorkspace() {
  // Simulate what getDefaultWorkspaceId() does
  const DEFAULT_WORKSPACE_NAME = process.env.DEFAULT_WORKSPACE_NAME || "Default Workspace";
  
  console.log(`🔍 Looking for workspace named: "${DEFAULT_WORKSPACE_NAME}"\n`);
  
  const { data: existing, error } = await supabase
    .from("workspaces")
    .select("id, name, created_at")
    .eq("name", DEFAULT_WORKSPACE_NAME)
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('📋 Found workspace:');
  console.log(`   Name: ${existing.name}`);
  console.log(`   ID: ${existing.id}`);
  console.log(`   Created: ${existing.created_at}\n`);
  
  // Check what templates belong to this workspace
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name')
    .eq('workspace_id', existing.id);
  
  console.log(`📊 Templates in this workspace: ${templates?.length || 0}`);
  templates?.forEach(t => console.log(`   • ${t.name}`));
}

testWorkspace();
