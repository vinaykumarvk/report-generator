require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('📊 Template Section Counts\n');
  console.log('='.repeat(70));
  
  // Get all templates
  const { data: templates, error } = await supabase
    .from('templates')
    .select('id, name, workspace_id, status, created_at')
    .order('updated_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (!templates || templates.length === 0) {
    console.log('No templates found');
    return;
  }
  
  // Get all sections
  const { data: allSections } = await supabase
    .from('template_sections')
    .select('template_id, id, title, order');
  
  // Create a map of template_id -> sections
  const sectionsMap = {};
  if (allSections) {
    allSections.forEach(section => {
      if (!sectionsMap[section.template_id]) {
        sectionsMap[section.template_id] = [];
      }
      sectionsMap[section.template_id].push(section);
    });
  }
  
  // Display results
  console.log(`\nTotal Templates: ${templates.length}`);
  console.log(`Total Sections: ${allSections?.length || 0}\n`);
  console.log('Template Details:\n');
  
  templates.forEach((template, index) => {
    const sections = sectionsMap[template.id] || [];
    const sectionsCount = sections.length;
    const statusIcon = sectionsCount > 0 ? '✅' : '⚠️';
    
    console.log(`${index + 1}. ${statusIcon} ${template.name}`);
    console.log(`   ID: ${template.id}`);
    console.log(`   Status: ${template.status || 'N/A'}`);
    console.log(`   Sections: ${sectionsCount}`);
    
    if (sectionsCount > 0) {
      sections.sort((a, b) => (a.order || 0) - (b.order || 0));
      sections.forEach((section, idx) => {
        console.log(`      ${idx + 1}. ${section.title || 'Untitled'} (order: ${section.order || 'N/A'})`);
      });
    } else {
      console.log(`      (No sections)`);
    }
    console.log('');
  });
  
  // Summary
  const templatesWithSections = templates.filter(t => (sectionsMap[t.id] || []).length > 0).length;
  const templatesWithoutSections = templates.length - templatesWithSections;
  
  console.log('='.repeat(70));
  console.log('\n📈 Summary:');
  console.log(`   Templates with sections: ${templatesWithSections}`);
  console.log(`   Templates without sections: ${templatesWithoutSections}`);
  console.log(`   Total sections across all templates: ${allSections?.length || 0}`);
})();
