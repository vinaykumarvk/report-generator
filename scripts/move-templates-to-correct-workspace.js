const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixWorkspace() {
  // Get the REAL default workspace (created by system)
  const { data: realWorkspace } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .eq('name', 'Default Workspace')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  
  console.log('✅ Using workspace:', realWorkspace.name);
  console.log('   ID:', realWorkspace.id);
  console.log('   Created:', realWorkspace.created_at, '\n');
  
  // Move all templates to this workspace
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, workspace_id');
  
  console.log(`📊 Found ${templates.length} templates\n`);
  
  let moved = 0;
  for (const template of templates) {
    if (template.workspace_id !== realWorkspace.id) {
      const { error } = await supabase
        .from('templates')
        .update({ workspace_id: realWorkspace.id })
        .eq('id', template.id);
      
      if (!error) {
        console.log(`   ✓ Moved: ${template.name}`);
        moved++;
      }
    }
  }
  
  console.log(`\n✅ Moved ${moved} templates to correct workspace`);
  
  // Delete the duplicate workspace
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .eq('name', 'Default Workspace')
    .order('created_at');
  
  if (allWorkspaces.length > 1) {
    console.log('\n🗑️  Cleaning up duplicate workspace...');
    for (let i = 1; i < allWorkspaces.length; i++) {
      await supabase
        .from('workspaces')
        .delete()
        .eq('id', allWorkspaces[i].id);
      console.log(`   ✓ Deleted: ${allWorkspaces[i].id}`);
    }
  }
  
  console.log('\n✅ ALL DONE! Refresh your browser.');
}

fixWorkspace();
