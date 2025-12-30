const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTemplates() {
  console.log('🔍 Checking templates in database...\n');
  
  const { data: allTemplates, error } = await supabase
    .from('templates')
    .select('id, name, workspace_id');
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Total templates: ${allTemplates.length}\n`);
  
  allTemplates.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name}`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Workspace: ${t.workspace_id || 'NULL'}\n`);
  });
  
  // Check workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*');
  
  console.log('\n🏢 Workspaces:');
  workspaces?.forEach(w => {
    console.log(`   • ${w.name} (${w.id})`);
  });
}

checkTemplates();
