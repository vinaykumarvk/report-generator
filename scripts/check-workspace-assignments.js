const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspaceAssignments() {
  console.log('🔍 Checking workspace assignments...\n');
  
  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at');
  
  console.log(`📊 Found ${workspaces?.length || 0} workspace(s):\n`);
  workspaces?.forEach((ws, i) => {
    console.log(`${i + 1}. ${ws.name}`);
    console.log(`   ID: ${ws.id}`);
    console.log(`   Created: ${ws.created_at}\n`);
  });
  
  // Get template counts by workspace
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, workspace_id');
  
  console.log(`\n📝 Template Distribution:\n`);
  const byWorkspace = {};
  templates?.forEach(t => {
    const wsId = t.workspace_id || 'NULL';
    if (!byWorkspace[wsId]) byWorkspace[wsId] = [];
    byWorkspace[wsId].push(t);
  });
  
  Object.entries(byWorkspace).forEach(([wsId, temps]) => {
    const workspace = workspaces?.find(w => w.id === wsId);
    console.log(`Workspace: ${workspace?.name || 'NULL'} (${wsId})`);
    console.log(`Templates: ${temps.length}`);
    temps.forEach(t => console.log(`  - ${t.name}`));
    console.log('');
  });
  
  // Check for the "Default Workspace"
  const defaultWs = workspaces?.find(w => w.name === 'Default Workspace');
  if (defaultWs) {
    console.log(`✅ Default Workspace exists: ${defaultWs.id}`);
    console.log(`   Templates in this workspace: ${byWorkspace[defaultWs.id]?.length || 0}\n`);
  } else {
    console.log(`⚠️  No "Default Workspace" found!\n`);
  }
}

checkWorkspaceAssignments().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
