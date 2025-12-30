#!/usr/bin/env node
/**
 * Fix existing templates by assigning them to default workspace
 * Run this after implementing workspace isolation
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DEFAULT_WORKSPACE_ID = 'default-workspace';

async function fixTemplates() {
  console.log('🔍 Finding templates without workspace_id...\n');

  // Find templates with null workspace_id
  const { data: orphanedTemplates, error: fetchError } = await supabase
    .from('templates')
    .select('id, name, created_at')
    .is('workspace_id', null);

  if (fetchError) {
    console.error('❌ Error fetching templates:', fetchError);
    process.exit(1);
  }

  if (!orphanedTemplates || orphanedTemplates.length === 0) {
    console.log('✅ All templates already have workspace_id assigned!');
    console.log('   No action needed.\n');
    return;
  }

  console.log(`📋 Found ${orphanedTemplates.length} templates without workspace_id:\n`);
  orphanedTemplates.forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.name} (${t.id})`);
  });

  console.log(`\n🔧 Assigning them to workspace: "${DEFAULT_WORKSPACE_ID}"...\n`);

  // Update templates
  const { data: updated, error: updateError } = await supabase
    .from('templates')
    .update({ workspace_id: DEFAULT_WORKSPACE_ID })
    .is('workspace_id', null)
    .select('id, name');

  if (updateError) {
    console.error('❌ Error updating templates:', updateError);
    process.exit(1);
  }

  console.log(`✅ Successfully updated ${updated.length} templates!\n`);
  updated.forEach((t, i) => {
    console.log(`   ${i + 1}. ✓ ${t.name}`);
  });

  // Also fix related tables
  console.log('\n🔧 Fixing related records...\n');

  // Fix connectors
  const { data: orphanedConnectors } = await supabase
    .from('connectors')
    .select('id, name')
    .is('workspace_id', null);

  if (orphanedConnectors && orphanedConnectors.length > 0) {
    await supabase
      .from('connectors')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    console.log(`   ✓ Fixed ${orphanedConnectors.length} connectors`);
  }

  // Fix report_runs
  const { data: orphanedRuns } = await supabase
    .from('report_runs')
    .select('id')
    .is('workspace_id', null);

  if (orphanedRuns && orphanedRuns.length > 0) {
    await supabase
      .from('report_runs')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    console.log(`   ✓ Fixed ${orphanedRuns.length} report runs`);
  }

  // Fix model_configs
  const { data: orphanedConfigs } = await supabase
    .from('model_configs')
    .select('id')
    .is('workspace_id', null);

  if (orphanedConfigs && orphanedConfigs.length > 0) {
    await supabase
      .from('model_configs')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    console.log(`   ✓ Fixed ${orphanedConfigs.length} model configs`);
  }

  // Fix prompt_sets
  const { data: orphanedPrompts } = await supabase
    .from('prompt_sets')
    .select('id')
    .is('workspace_id', null);

  if (orphanedPrompts && orphanedPrompts.length > 0) {
    await supabase
      .from('prompt_sets')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    console.log(`   ✓ Fixed ${orphanedPrompts.length} prompt sets`);
  }

  console.log('\n✅ ALL DONE!\n');
  console.log('📊 Summary:');
  console.log(`   • Templates: ${updated.length} fixed`);
  console.log(`   • Connectors: ${orphanedConnectors?.length || 0} fixed`);
  console.log(`   • Report Runs: ${orphanedRuns?.length || 0} fixed`);
  console.log(`   • Model Configs: ${orphanedConfigs?.length || 0} fixed`);
  console.log(`   • Prompt Sets: ${orphanedPrompts?.length || 0} fixed`);
  console.log(`\n🎯 All records now assigned to workspace: "${DEFAULT_WORKSPACE_ID}"`);
  console.log('   You should now be able to see all your templates!\n');
}

fixTemplates().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
