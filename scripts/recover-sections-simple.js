require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔧 Simple Section Recovery\n');
  console.log('='.repeat(70));
  
  // Get report runs with sections in snapshots
  const { data: runs } = await supabase
    .from('report_runs')
    .select('id, template_id, template_version_snapshot_json, created_at')
    .not('template_version_snapshot_json', 'is', null)
    .order('created_at', { ascending: false });
  
  if (!runs || runs.length === 0) {
    console.log('No report runs found');
    return;
  }
  
  // Group by template_id
  const templateSnapshots = {};
  runs.forEach(run => {
    if (run.template_id && run.template_version_snapshot_json?.sections) {
      const sections = run.template_version_snapshot_json.sections;
      if (Array.isArray(sections) && sections.length > 0) {
        if (!templateSnapshots[run.template_id] || 
            new Date(run.created_at) > new Date(templateSnapshots[run.template_id].created_at)) {
          templateSnapshots[run.template_id] = {
            template_id: run.template_id,
            sections: sections,
            created_at: run.created_at
          };
        }
      }
    }
  });
  
  console.log(`\nFound sections for ${Object.keys(templateSnapshots).length} templates\n`);
  
  // Get template names
  const templateIds = Object.keys(templateSnapshots);
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name')
    .in('id', templateIds);
  
  const templateMap = {};
  templates?.forEach(t => templateMap[t.id] = t.name);
  
  // Try to restore using the API endpoint (which handles schema correctly)
  const args = process.argv.slice(2);
  const shouldExecute = args.includes('--execute');
  
  if (!shouldExecute) {
    console.log('DRY RUN - Showing what would be restored:\n');
  } else {
    console.log('EXECUTING - Restoring sections via API...\n');
  }
  
  let restored = 0;
  let errors = 0;
  
  for (const [templateId, data] of Object.entries(templateSnapshots)) {
    const templateName = templateMap[templateId] || templateId;
    console.log(`\n📄 ${templateName}`);
    console.log(`   Sections: ${data.sections.length}`);
    
    if (shouldExecute) {
      // Use the API endpoint which handles the schema correctly
      for (const section of data.sections) {
        try {
          const response = await fetch(`http://localhost:3000/api/templates/${templateId}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: section.title || 'Untitled Section',
              purpose: section.purpose || null,
              order: section.order || 1,
              outputFormat: section.outputFormat || section.output_format || 'NARRATIVE',
              evidencePolicy: section.evidencePolicy || section.evidence_policy || null,
              writingStyle: section.writingStyle || section.writing_style || null,
              sourceMode: section.sourceMode || section.source_mode || 'inherit',
              targetLengthMin: section.targetLengthMin || section.target_length_min || null,
              targetLengthMax: section.targetLengthMax || section.target_length_max || null,
              customConnectorIds: section.customConnectorIds || section.vector_policy_json?.connectorIds || [],
              dependencies: section.dependencies || []
            })
          });
          
          if (response.ok) {
            restored++;
            console.log(`   ✅ Restored: ${section.title || 'Untitled'}`);
          } else {
            const errorText = await response.text();
            console.log(`   ❌ Failed: ${section.title} - ${errorText.substring(0, 100)}`);
            errors++;
          }
        } catch (err) {
          console.log(`   ❌ Error: ${section.title} - ${err.message}`);
          errors++;
        }
      }
    } else {
      data.sections.forEach((s, i) => {
        console.log(`   ${i+1}. ${s.title || 'Untitled'} (order: ${s.order || i+1})`);
      });
      restored += data.sections.length;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  if (shouldExecute) {
    console.log(`\n✅ Recovery Complete`);
    console.log(`   Sections restored: ${restored}`);
    console.log(`   Errors: ${errors}`);
  } else {
    console.log(`\n✅ DRY RUN Complete`);
    console.log(`   Sections that would be restored: ${restored}`);
    console.log(`\n💡 Run with --execute to actually restore sections`);
  }
})();
