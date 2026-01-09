require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔧 Fixing Template ID Connection: Mapping integer template_id to UUID\n');
  console.log('='.repeat(70));
  
  // Step 1: Get all sections with integer template_id
  const { data: sections } = await supabase
    .from('template_sections')
    .select('*')
    .eq('template_id', 2); // This should work even though it's an integer
  
  if (!sections || sections.length === 0) {
    console.log('No sections found with template_id = 2');
    return;
  }
  
  console.log(`\n✅ Found ${sections.length} sections with template_id = 2\n`);
  
  // Step 2: Get unique section titles to identify the template
  const uniqueTitles = [...new Set(sections.map(s => s.title))];
  console.log('Section titles:');
  uniqueTitles.slice(0, 10).forEach((title, i) => {
    console.log(`   ${i+1}. ${title}`);
  });
  
  // Step 3: Try to match with templates by checking snapshots
  console.log('\n🔍 Searching for matching template in snapshots...');
  
  const { data: runs } = await supabase
    .from('report_runs')
    .select('template_id, template_version_snapshot_json')
    .not('template_version_snapshot_json', 'is', null);
  
  let bestMatch = null;
  let bestMatchScore = 0;
  
  if (runs) {
    for (const run of runs) {
      const snapshot = run.template_version_snapshot_json;
      if (snapshot && snapshot.sections) {
        const snapshotTitles = snapshot.sections.map(s => (s.title || '').toLowerCase());
        const sectionTitles = uniqueTitles.map(t => t.toLowerCase());
        const matches = sectionTitles.filter(t => snapshotTitles.includes(t));
        const matchScore = matches.length / Math.max(sectionTitles.length, snapshotTitles.length);
        
        if (matchScore > bestMatchScore && matches.length >= 3) {
          bestMatchScore = matchScore;
          bestMatch = {
            templateId: run.template_id,
            matchScore: matchScore,
            matches: matches.length,
            totalSections: snapshot.sections.length
          };
        }
      }
    }
  }
  
  if (bestMatch) {
    console.log(`\n✅ Best match found!`);
    console.log(`   Template UUID: ${bestMatch.templateId}`);
    console.log(`   Match score: ${(bestMatch.matchScore * 100).toFixed(1)}%`);
    console.log(`   Matching sections: ${bestMatch.matches}`);
    
    // Get template name
    const { data: template } = await supabase
      .from('templates')
      .select('name')
      .eq('id', bestMatch.templateId)
      .single();
    
    if (template) {
      console.log(`   Template name: ${template.name}`);
    }
    
    // Ask for confirmation
    const args = process.argv.slice(2);
    const shouldExecute = args.includes('--execute');
    
    if (!shouldExecute) {
      console.log(`\n💡 To update sections to use this template UUID, run:`);
      console.log(`   node scripts/fix-template-id-connection.js --execute`);
      return;
    }
    
    console.log(`\n⚠️  UPDATING SECTIONS: Changing template_id from 2 to ${bestMatch.templateId}`);
    
    // Update sections
    // Note: We need to handle the type conversion - template_id column might need to be updated
    // First, let's check if we can directly update
    
    // Since template_id is likely a foreign key, we might need to:
    // 1. Delete old sections
    // 2. Insert new sections with correct UUID
    // OR
    // 3. Update the column type and values
    
    // Let's try a direct update first
    const { error: updateError } = await supabase
      .from('template_sections')
      .update({ template_id: bestMatch.templateId })
      .eq('template_id', 2);
    
    if (updateError) {
      console.error(`\n❌ Update error: ${updateError.message}`);
      console.log(`\n💡 This might be because:`);
      console.log(`   1. template_id column type mismatch (integer vs UUID)`);
      console.log(`   2. Foreign key constraint`);
      console.log(`\n   Alternative: We may need to recreate sections with correct UUIDs`);
    } else {
      console.log(`\n✅ Successfully updated ${sections.length} sections!`);
    }
  } else {
    console.log(`\n❌ No matching template found in snapshots`);
    console.log(`\n💡 Options:`);
    console.log(`   1. Manually identify which template these sections belong to`);
    console.log(`   2. Create a new template for these sections`);
    console.log(`   3. Delete these orphaned sections`);
  }
  
  console.log('\n' + '='.repeat(70));
})();
