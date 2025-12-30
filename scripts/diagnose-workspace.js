const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('🔍 WORKSPACE DIAGNOSIS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   DEFAULT_WORKSPACE_NAME: ${process.env.DEFAULT_WORKSPACE_NAME || '❌ NOT SET (will use "Default Workspace")'}`);
  console.log(`   DEFAULT_WORKSPACE_ID: ${process.env.DEFAULT_WORKSPACE_ID || '❌ NOT SET'}`);
  console.log(`   SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL}`);
  console.log('');
  
  // Query all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at');
  
  console.log('🏢 Workspaces in Database:');
  if (!workspaces || workspaces.length === 0) {
    console.log('   ⚠️  NO WORKSPACES FOUND!\n');
  } else {
    workspaces.forEach((ws, i) => {
      console.log(`\n   ${i + 1}. Name: "${ws.name}"`);
      console.log(`      ID: ${ws.id}`);
      console.log(`      Created: ${ws.created_at}`);
    });
    console.log('');
  }
  
  // Check what getDefaultWorkspaceId() would return
  const DEFAULT_WORKSPACE_NAME = process.env.DEFAULT_WORKSPACE_NAME || "Default Workspace";
  const { data: defaultWs } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', DEFAULT_WORKSPACE_NAME)
    .limit(1)
    .maybeSingle();
  
  console.log('\n🎯 What getDefaultWorkspaceId() Would Return:');
  console.log(`   Looking for workspace named: "${DEFAULT_WORKSPACE_NAME}"`);
  if (defaultWs) {
    console.log(`   ✅ Found: ${defaultWs.id}`);
  } else {
    console.log(`   ❌ NOT FOUND - Would create a new one!`);
  }
  
  // Check templates
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, workspace_id');
  
  console.log('\n📝 Templates:');
  if (!templates || templates.length === 0) {
    console.log('   ⚠️  NO TEMPLATES FOUND!\n');
  } else {
    console.log(`   Total: ${templates.length}\n`);
    const byWorkspace = {};
    templates.forEach(t => {
      const wsId = t.workspace_id || 'NULL';
      if (!byWorkspace[wsId]) byWorkspace[wsId] = [];
      byWorkspace[wsId].push(t.name);
    });
    
    Object.entries(byWorkspace).forEach(([wsId, names]) => {
      const ws = workspaces?.find(w => w.id === wsId);
      console.log(`   Workspace: ${ws?.name || 'NULL'} (${wsId})`);
      console.log(`   Count: ${names.length}`);
      names.forEach(name => console.log(`      - ${name}`));
      console.log('');
    });
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Recommendations
  console.log('💡 RECOMMENDATIONS:\n');
  
  if (defaultWs && templates && templates.length > 0) {
    const templatesInDefaultWs = templates.filter(t => t.workspace_id === defaultWs.id);
    if (templatesInDefaultWs.length === templates.length) {
      console.log('   ✅ All templates are in the default workspace');
      console.log('   ✅ Everything looks good!\n');
      console.log('   📝 Add to .env for deployment:');
      console.log(`      DEFAULT_WORKSPACE_ID=${defaultWs.id}\n`);
    } else {
      console.log('   ⚠️  Some templates are NOT in the default workspace');
      console.log('   🔧 Run: node scripts/fix-orphaned-templates.js\n');
    }
  } else if (!defaultWs) {
    console.log('   ⚠️  No "Default Workspace" found');
    console.log('   🔧 A new one will be created on first API call\n');
  }
}

diagnose().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
