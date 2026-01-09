require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔧 Section Recovery from Report Run Snapshots\n');
  console.log('='.repeat(70));
  
  // Get all report runs with template snapshots
  const { data: runs, error } = await supabase
    .from('report_runs')
    .select('id, template_id, template_version_snapshot_json, created_at')
    .not('template_version_snapshot_json', 'is', null)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (!runs || runs.length === 0) {
    console.log('No report runs with snapshots found');
    return;
  }
  
  console.log(`\nFound ${runs.length} report runs with template snapshots\n`);
  
  // Group by template_id and get the most recent snapshot for each template
  const templateSnapshots = {};
  runs.forEach(run => {
    if (run.template_id && run.template_version_snapshot_json) {
      const snapshot = run.template_version_snapshot_json;
      if (snapshot.sections && Array.isArray(snapshot.sections) && snapshot.sections.length > 0) {
        // Use the most recent snapshot for each template
        if (!templateSnapshots[run.template_id] || 
            new Date(run.created_at) > new Date(templateSnapshots[run.template_id].created_at)) {
          templateSnapshots[run.template_id] = {
            template_id: run.template_id,
            sections: snapshot.sections,
            created_at: run.created_at,
            run_id: run.id
          };
        }
      }
    }
  });
  
  console.log(`Found sections for ${Object.keys(templateSnapshots).length} templates:\n`);
  
  // Get template names
  const templateIds = Object.keys(templateSnapshots);
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name')
    .in('id', templateIds);
  
  const templateMap = {};
  if (templates) {
    templates.forEach(t => templateMap[t.id] = t.name);
  }
  
  // Display what we found
  let totalSectionsToRecover = 0;
  Object.entries(templateSnapshots).forEach(([templateId, data]) => {
    const templateName = templateMap[templateId] || 'Unknown';
    console.log(`📄 ${templateName} (${templateId})`);
    console.log(`   Sections found: ${data.sections.length}`);
    console.log(`   From run: ${data.run_id}`);
    console.log(`   Snapshot date: ${data.created_at}`);
    data.sections.forEach((s, i) => {
      console.log(`      ${i+1}. ${s.title || 'Untitled'} (order: ${s.order || i+1})`);
    });
    console.log('');
    totalSectionsToRecover += data.sections.length;
  });
  
  console.log('='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   Templates with recoverable sections: ${Object.keys(templateSnapshots).length}`);
  console.log(`   Total sections to recover: ${totalSectionsToRecover}`);
  
  // Ask for confirmation before recovery
  console.log('\n⚠️  RECOVERY SCRIPT READY');
  console.log('   This script will restore sections from report run snapshots.');
  console.log('   Run with --dry-run to see what would be restored without making changes.');
  console.log('   Run with --execute to actually restore the sections.\n');
  
  // Check if we should execute
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const shouldExecute = args.includes('--execute');
  
  if (!isDryRun && !shouldExecute) {
    console.log('💡 To see what would be restored: node scripts/recover-sections-from-snapshots.js --dry-run');
    console.log('💡 To actually restore: node scripts/recover-sections-from-snapshots.js --execute');
    return;
  }
  
  if (isDryRun) {
    console.log('\n🔍 DRY RUN - No changes will be made\n');
  } else {
    console.log('\n⚠️  EXECUTING RECOVERY - This will restore sections to the database\n');
  }
  
  // Restore sections
  let restored = 0;
  let errors = 0;
  
  for (const [templateId, data] of Object.entries(templateSnapshots)) {
    const templateName = templateMap[templateId] || templateId;
    
    // Check if sections already exist for this template
    const { data: existingSections } = await supabase
      .from('template_sections')
      .select('id')
      .eq('template_id', templateId);
    
    if (existingSections && existingSections.length > 0) {
      console.log(`⏭️  Skipping ${templateName} - already has ${existingSections.length} sections`);
      continue;
    }
    
    console.log(`\n📝 Restoring sections for: ${templateName}`);
    
    // Prepare sections for insertion
    const sectionsToInsert = data.sections.map((section, idx) => {
      const baseSection = {
        template_id: templateId,
        title: section.title || `Section ${idx + 1}`,
        purpose: section.purpose || null,
        order: section.order || idx + 1,
        output_format: section.outputFormat || section.output_format || 'NARRATIVE',
        evidence_policy: section.evidencePolicy || section.evidence_policy || null,
        writing_style: section.writingStyle || section.writing_style || null,
        source_mode: section.sourceMode || section.source_mode || 'inherit',
        target_length_min: section.targetLengthMin || section.target_length_min || null,
        target_length_max: section.targetLengthMax || section.target_length_max || null,
        vector_policy_json: section.vectorPolicyJson || section.vector_policy_json || 
                            (section.customConnectorIds ? { connectorIds: section.customConnectorIds } : null),
        web_policy_json: section.webPolicyJson || section.web_policy_json || null,
        quality_gates_json: section.qualityGatesJson || section.quality_gates_json || null,
        prompt: section.prompt || null,
        status: section.status || 'DRAFT'
      };
      
      // Only include dependencies if the column exists (check via try-catch in insert)
      if (Array.isArray(section.dependencies) && section.dependencies.length > 0) {
        baseSection.dependencies = section.dependencies;
      }
      
      return baseSection;
    });
    
    if (!isDryRun) {
      const { error: insertError } = await supabase
        .from('template_sections')
        .insert(sectionsToInsert);
      
      if (insertError) {
        console.error(`   ❌ Error: ${insertError.message}`);
        errors++;
      } else {
        console.log(`   ✅ Restored ${sectionsToInsert.length} sections`);
        restored += sectionsToInsert.length;
      }
    } else {
      console.log(`   [DRY RUN] Would restore ${sectionsToInsert.length} sections`);
      sectionsToInsert.forEach((s, i) => {
        console.log(`      ${i+1}. ${s.title} (order: ${s.order})`);
      });
      restored += sectionsToInsert.length;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  if (isDryRun) {
    console.log(`\n✅ DRY RUN Complete`);
    console.log(`   Sections that would be restored: ${restored}`);
  } else {
    console.log(`\n✅ Recovery Complete`);
    console.log(`   Sections restored: ${restored}`);
    console.log(`   Errors: ${errors}`);
  }
})();
