#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

async function createWorkspaceAndFixTemplates() {
  console.log('🔍 Checking if default workspace exists...\n');

  // Check if workspace exists
  const { data: existingWorkspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', DEFAULT_WORKSPACE_ID)
    .single();

  if (existingWorkspace) {
    console.log(`✅ Default workspace already exists: "${existingWorkspace.name}"\n`);
  } else {
    console.log('🔧 Creating default workspace...\n');
    
    const { data: newWorkspace, error: createError } = await supabase
      .from('workspaces')
      .insert({
        id: DEFAULT_WORKSPACE_ID,
        name: 'Default Workspace',
        slug: 'default',
        settings_json: {}
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating workspace:', createError);
      process.exit(1);
    }

    console.log(`✅ Created workspace: "${newWorkspace.name}" (${newWorkspace.id})\n`);
  }

  // Now fix templates
  console.log('🔍 Finding orphaned templates...\n');

  const { data: orphanedTemplates } = await supabase
    .from('templates')
    .select('id, name')
    .is('workspace_id', null);

  if (!orphanedTemplates || orphanedTemplates.length === 0) {
    console.log('✅ All templates already have workspace_id!\n');
    return;
  }

  console.log(`📋 Found ${orphanedTemplates.length} templates:\n`);
  orphanedTemplates.forEach((t, i) => console.log(`   ${i + 1}. ${t.name}`));

  console.log(`\n🔧 Assigning to default workspace...\n`);

  let fixed = 0;
  for (const template of orphanedTemplates) {
    const { error } = await supabase
      .from('templates')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .eq('id', template.id);

    if (!error) {
      console.log(`   ✓ ${template.name}`);
      fixed++;
    } else {
      console.log(`   ❌ ${template.name}: ${error.message}`);
    }
  }

  // Fix other tables
  console.log('\n🔧 Fixing related records...\n');

  const tables = ['connectors', 'report_runs', 'model_configs', 'prompt_sets'];
  const fixed_counts = {};

  for (const table of tables) {
    const { data: orphaned } = await supabase
      .from(table)
      .select('id')
      .is('workspace_id', null);

    if (orphaned && orphaned.length > 0) {
      await supabase
        .from(table)
        .update({ workspace_id: DEFAULT_WORKSPACE_ID })
        .is('workspace_id', null);
      
      fixed_counts[table] = orphaned.length;
      console.log(`   ✓ Fixed ${orphaned.length} ${table}`);
    }
  }

  console.log('\n✅ ALL DONE!\n');
  console.log('📊 Summary:');
  console.log(`   • Templates: ${fixed} fixed`);
  Object.entries(fixed_counts).forEach(([table, count]) => {
    console.log(`   • ${table}: ${count} fixed`);
  });
  console.log('\n🎯 Refresh your browser to see all templates!\n');
}

createWorkspaceAndFixTemplates().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
