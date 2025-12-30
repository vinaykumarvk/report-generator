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

async function fixOrphanedData() {
  console.log('🔍 Step 1: Checking workspaces...\n');

  // Check if default workspace exists
  const { data: existingWorkspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', DEFAULT_WORKSPACE_ID)
    .single();

  if (existingWorkspace) {
    console.log(`✅ Default workspace exists: "${existingWorkspace.name}"\n`);
  } else {
    console.log('🔧 Creating default workspace...\n');
    
    const { data: newWorkspace, error: createError } = await supabase
      .from('workspaces')
      .insert({
        id: DEFAULT_WORKSPACE_ID,
        name: 'Default Workspace'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating workspace:', createError);
      process.exit(1);
    }

    console.log(`✅ Created: "${newWorkspace.name}"\n`);
  }

  // Fix templates
  console.log('🔍 Step 2: Finding orphaned templates...\n');

  const { data: orphanedTemplates } = await supabase
    .from('templates')
    .select('id, name')
    .is('workspace_id', null);

  if (!orphanedTemplates || orphanedTemplates.length === 0) {
    console.log('✅ No orphaned templates found\n');
  } else {
    console.log(`📋 Found ${orphanedTemplates.length} orphaned templates:\n`);
    orphanedTemplates.forEach((t, i) => console.log(`   ${i + 1}. ${t.name}`));

    console.log(`\n🔧 Assigning to workspace ${DEFAULT_WORKSPACE_ID}...\n`);

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
    console.log(`\n✅ Fixed ${fixed} templates\n`);
  }

  // Fix connectors
  console.log('🔍 Step 3: Fixing connectors...\n');
  const { data: orphanedConnectors } = await supabase
    .from('connectors')
    .select('id')
    .is('workspace_id', null);

  if (orphanedConnectors && orphanedConnectors.length > 0) {
    await supabase
      .from('connectors')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    console.log(`   ✓ Fixed ${orphanedConnectors.length} connectors\n`);
  } else {
    console.log('   ✓ No orphaned connectors\n');
  }

  // Fix report_runs
  console.log('🔍 Step 4: Fixing report runs...\n');
  const { data: orphanedRuns } = await supabase
    .from('report_runs')
    .select('id')
    .is('workspace_id', null);

  if (orphanedRuns && orphanedRuns.length > 0) {
    await supabase
      .from('report_runs')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    console.log(`   ✓ Fixed ${orphanedRuns.length} report runs\n`);
  } else {
    console.log('   ✓ No orphaned report runs\n');
  }

  // Fix model_configs
  console.log('🔍 Step 5: Fixing model configs...\n');
  const { data: orphanedConfigs } = await supabase
    .from('model_configs')
    .select('id')
    .is('workspace_id', null);

  if (orphanedConfigs && orphanedConfigs.length > 0) {
    await supabase
      .from('model_configs')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    console.log(`   ✓ Fixed ${orphanedConfigs.length} model configs\n`);
  } else {
    console.log('   ✓ No orphaned model configs\n');
  }

  // Fix prompt_sets
  console.log('🔍 Step 6: Fixing prompt sets...\n');
  const { data: orphanedPrompts } = await supabase
    .from('prompt_sets')
    .select('id')
    .is('workspace_id', null);

  if (orphanedPrompts && orphanedPrompts.length > 0) {
    await supabase
      .from('prompt_sets')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    console.log(`   ✓ Fixed ${orphanedPrompts.length} prompt sets\n`);
  } else {
    console.log('   ✓ No orphaned prompt sets\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('✅ ALL DONE!\n');
  console.log('📊 Summary:');
  console.log(`   • Templates: ${orphanedTemplates?.length || 0} fixed`);
  console.log(`   • Connectors: ${orphanedConnectors?.length || 0} fixed`);
  console.log(`   • Report Runs: ${orphanedRuns?.length || 0} fixed`);
  console.log(`   • Model Configs: ${orphanedConfigs?.length || 0} fixed`);
  console.log(`   • Prompt Sets: ${orphanedPrompts?.length || 0} fixed`);
  console.log(`\n🎯 Workspace: ${DEFAULT_WORKSPACE_ID}`);
  console.log('\n🚀 Refresh your browser - all templates should now be visible!\n');
}

fixOrphanedData().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
