require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔧 Section Recovery - Minimal Schema Version\n');
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
  
  // Group by template_id and get the most recent snapshot for each template
  const templateSnapshots = {};
  runs.forEach(run => {
    if (run.template_id && run.template_version_snapshot_json) {
      const snapshot = run.template_version_snapshot_json;
      if (snapshot.sections && Array.isArray(snapshot.sections) && snapshot.sections.length > 0) {
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
  
  console.log(`\nFound ${Object.keys(templateSnapshots).length} templates with recoverable sections\n`);
  
  // Check what columns actually exist by trying a simple query
  const { data: sampleSection } = await supabase
    .from('template_sections')
    .select('*')
    .limit(1)
    .single();
  
  const existingColumns = sampleSection ? Object.keys(sampleSection) : [];
  console.log('Available columns:', existingColumns.join(', '));
  console.log('');
  
  // Restore sections using only existing columns
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
    
    // Prepare sections using only columns that exist
    const sectionsToInsert = data.sections.map((section, idx) => {
      const baseSection = {
        template_id: templateId,
        title: section.title || `Section ${idx + 1}`,
      };
      
      // Only add columns that exist in the schema
      if (existingColumns.includes('purpose')) {
        baseSection.purpose = section.purpose || null;
      }
      
      if (existingColumns.includes('order')) {
        baseSection.order = section.order || idx + 1;
      } else if (existingColumns.includes('order_index')) {
        baseSection.order_index = section.order || idx + 1;
      }
      
      if (existingColumns.includes('output_format')) {
        baseSection.output_format = section.outputFormat || section.output_format || 'NARRATIVE';
      }
      
      if (existingColumns.includes('target_length_min')) {
        baseSection.target_length_min = section.targetLengthMin || section.target_length_min || null;
      }
      
      if (existingColumns.includes('target_length_max')) {
        baseSection.target_length_max = section.targetLengthMax || section.target_length_max || null;
      }
      
      if (existingColumns.includes('vector_policy_json')) {
        baseSection.vector_policy_json = section.vectorPolicyJson || section.vector_policy_json || 
                                        (section.customConnectorIds ? { connectorIds: section.customConnectorIds } : null);
      }
      
      if (existingColumns.includes('web_policy_json')) {
        baseSection.web_policy_json = section.webPolicyJson || section.web_policy_json || null;
      }
      
      if (existingColumns.includes('quality_gates_json')) {
        baseSection.quality_gates_json = section.qualityGatesJson || section.quality_gates_json || null;
      }
      
      if (existingColumns.includes('status')) {
        baseSection.status = section.status || 'DRAFT';
      }
      
      if (existingColumns.includes('prompt')) {
        baseSection.prompt = section.prompt || null;
      }
      
      if (existingColumns.includes('source_mode')) {
        baseSection.source_mode = section.sourceMode || section.source_mode || 'inherit';
      }
      
      if (existingColumns.includes('writing_style')) {
        baseSection.writing_style = section.writingStyle || section.writing_style || null;
      }
      
      // Skip columns that don't exist: evidence_policy, dependencies
      
      return baseSection;
    });
    
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
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ Recovery Complete`);
  console.log(`   Sections restored: ${restored}`);
  console.log(`   Errors: ${errors}`);
  
  if (restored > 0) {
    console.log(`\n💡 Note: Some columns may be missing (evidence_policy, dependencies)`);
    console.log(`   Run schema migration to add all columns, then update sections if needed.`);
  }
})();
