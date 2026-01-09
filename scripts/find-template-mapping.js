require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 Finding which UUID template corresponds to old template_id 2\n');
  console.log('='.repeat(70));
  
  // Get sections to see their titles
  const { data: sections } = await supabase
    .from('template_sections')
    .select('title, order_index, section_type')
    .order('order_index');
  
  if (sections && sections.length > 0) {
    console.log('\nSections from template_id 2:');
    sections.slice(0, 10).forEach((s, i) => {
      console.log(`   ${i+1}. ${s.title} (order: ${s.order_index}, type: ${s.section_type})`);
    });
    
    // Try to match by section titles with templates that have similar sections in snapshots
    console.log('\n🔍 Checking report run snapshots for matching sections...');
    
    const { data: runs } = await supabase
      .from('report_runs')
      .select('template_id, template_version_snapshot_json')
      .not('template_version_snapshot_json', 'is', null)
      .limit(50);
    
    if (runs) {
      // Look for templates with sections that match
      const sectionTitles = sections.map(s => s.title.toLowerCase());
      
      for (const run of runs) {
        const snapshot = run.template_version_snapshot_json;
        if (snapshot && snapshot.sections) {
          const snapshotTitles = snapshot.sections.map(s => (s.title || '').toLowerCase());
          const matches = sectionTitles.filter(t => snapshotTitles.includes(t));
          
          if (matches.length >= 3) { // At least 3 matching section titles
            console.log(`\n   ✅ Potential match found!`);
            console.log(`   Template UUID: ${run.template_id}`);
            console.log(`   Matching sections: ${matches.length}/${sectionTitles.length}`);
            console.log(`   Matches: ${matches.slice(0, 5).join(', ')}`);
            
            // Get template name
            const { data: template } = await supabase
              .from('templates')
              .select('name')
              .eq('id', run.template_id)
              .single();
            
            if (template) {
              console.log(`   Template name: ${template.name}`);
            }
          }
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
})();
