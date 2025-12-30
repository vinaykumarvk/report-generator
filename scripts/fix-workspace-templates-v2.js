#!/usr/bin/env node
/**
 * Fix existing templates by assigning them to default workspace
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000'; // Default UUID

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

  console.log(`\n🔧 Assigning them to workspace: ${DEFAULT_WORKSPACE_ID}...\n`);

  // Update templates one by one to handle any errors
  let successCount = 0;
  let errorCount = 0;

  for (const template of orphanedTemplates) {
    const { error } = await supabase
      .from('templates')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .eq('id', template.id);

    if (error) {
      console.log(`   ❌ Failed: ${template.name} - ${error.message}`);
      errorCount++;
    } else {
      console.log(`   ✓ ${template.name}`);
      successCount++;
    }
  }

  console.log(`\n✅ Successfully updated ${successCount} templates!`);
  if (errorCount > 0) {
    console.log(`⚠️  Failed to update ${errorCount} templates`);
  }

  // Also fix related tables
  console.log('\n🔧 Fixing related records...\n');

  // Fix connectors
  const { data: orphanedConnectors, error: connError } = await supabase
    .from('connectors')
    .select('id, name')
    .is('workspace_id', null);

  if (!connError && orphanedConnectors && orphanedConnectors.length > 0) {
    const { error: updateConnError } = await supabase
      .from('connectors')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    
    if (!updateConnError) {
      console.log(`   ✓ Fixed ${orphanedConnectors.length} connectors`);
    }
  }

  // Fix report_runs
  const { data: orphanedRuns, error: runsError } = await supabase
    .from('report_runs')
    .select('id')
    .is('workspace_id', null);

  if (!runsError && orphanedRuns && orphanedRuns.length > 0) {
    const { error: updateRunsError } = await supabase
      .from('report_runs')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    
    if (!updateRunsError) {
      console.log(`   ✓ Fixed ${orphanedRuns.length} report runs`);
    }
  }

  // Fix model_configs
  const { data: orphanedConfigs, error: configsError } = await supabase
    .from('model_configs')
    .select('id')
    .is('workspace_id', null);

  if (!configsError && orphanedConfigs && orphanedConfigs.length > 0) {
    const { error: updateConfigsError } = await supabase
      .from('model_configs')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    
    if (!updateConfigsError) {
      console.log(`   ✓ Fixed ${orphanedConfigs.length} model configs`);
    }
  }

  // Fix prompt_sets
  const { data: orphanedPrompts, error: promptsError } = await supabase
    .from('prompt_sets')
    .select('id')
    .is('workspace_id', null);

  if (!promptsError && orphanedPrompts && orphanedPrompts.length > 0) {
    const { error: updatePromptsError } = await supabase
      .from('prompt_sets')
      .update({ workspace_id: DEFAULT_WORKSPACE_ID })
      .is('workspace_id', null);
    
    if (!updatePromptsError) {
      console.log(`   ✓ Fixed ${orphanedPrompts.length} prompt sets`);
    }
  }

  console.log('\n✅ ALL DONE!\n');
  console.log('📊 Summary:');
  console.log(`   • Templates: ${successCount} fixed`);
  console.log(`   • Connectors: ${orphanedConnectors?.length || 0} fixed`);
  console.log(`   • Report Runs: ${orphanedRuns?.length || 0} fixed`);
  console.log(`   • Model Configs: ${orphanedConfigs?.length || 0} fixed`);
  console.log(`   • Prompt Sets: ${orphanedPrompts?.length || 0} fixed`);
  console.log(`\n🎯 All records now assigned to workspace: ${DEFAULT_WORKSPACE_ID}`);
  console.log('   Refresh your browser to see all your templates!\n');
}

fixTemplates().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
