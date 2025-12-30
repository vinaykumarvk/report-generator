/**
 * Update existing template sections with appropriate writing styles
 * 
 * NOTE: Run this SQL in Supabase SQL Editor FIRST:
 * ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS writing_style text;
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Style mappings based on section title patterns
const styleMappings = {
  // Executive Summary → Executive Briefing
  'Executive Summary': 'executive_briefing',
  
  // Strategic/Narrative sections
  'Business Overview': 'strategic_narrative',
  'Future Outlook': 'strategic_narrative',
  'Understanding of Requirements': 'strategic_narrative',
  'Proposed Solution': 'solution_proposal',
  
  // Analytical sections
  'Industry Positioning': 'analytical_research',
  'Financial Performance': 'analytical_research',
  'Competitive Landscape': 'analytical_research',
  'Business Context': 'analytical_research',
  
  // Compliance/Risk
  'Risks and Challenges': 'compliance_risk',
  'Risk Mitigation': 'compliance_risk',
  'Compliance and Risk': 'compliance_risk',
  'Compliance': 'compliance_risk',
  
  // Specifications
  'Functional Requirements': 'structured_specification',
  'Non-Functional Requirements': 'structured_specification',
  'Functional Test Cases': 'structured_specification',
  'Edge Case Scenarios': 'structured_specification',
  'Negative Test Cases': 'structured_specification',
  'Test Data Requirements': 'structured_specification',
  
  // Technical
  'Integration Test Cases': 'technical_systems_design',
  'Performance Test Scenarios': 'technical_systems_design',
  
  // Operational Reporting
  'Portfolio Overview': 'operational_reporting',
  'Revenue Performance': 'operational_reporting',
  'Client Acquisition': 'operational_reporting',
  'Client Engagement': 'operational_reporting',
  'Performance Metrics': 'operational_reporting',
  'Period Overview': 'operational_reporting',
  
  // Instructional
  'Test Plan Overview': 'instructional_playbook',
  'Development Areas': 'instructional_playbook',
  'Company Qualifications': 'solution_proposal',
  'Project Timeline': 'structured_specification',
  'Pricing and Commercial Terms': 'structured_specification',
  
  // Narrative/Documentation
  'Document Overview': 'strategic_narrative',
  'User Stories and Use Cases': 'structured_specification',
  'Assumptions and Constraints': 'structured_specification',
  'Success Criteria': 'structured_specification',
  'Key Achievements': 'operational_reporting',
  'Challenges and Issues': 'operational_reporting',
  'Upcoming Activities': 'instructional_playbook',
  'Recommendations': 'strategic_narrative',
  'Product Penetration': 'operational_reporting',
};

async function updateSections() {
  console.log('🔄 Updating sections with writing styles...\n');

  try {
    // Fetch all sections
    const { data: sections, error } = await supabase
      .from('template_sections')
      .select('id, title, template_id');

    if (error) {
      console.error('❌ Failed to fetch sections:', error.message);
      return;
    }

    console.log(`📊 Found ${sections.length} sections to update\n`);

    let updated = 0;
    let skipped = 0;

    for (const section of sections) {
      const style = styleMappings[section.title];
      
      if (style) {
        const { error: updateError } = await supabase
          .from('template_sections')
          .update({ writing_style: style })
          .eq('id', section.id);

        if (updateError) {
          console.error(`  ❌ Failed to update "${section.title}":`, updateError.message);
        } else {
          console.log(`  ✅ ${section.title} → ${style}`);
          updated++;
        }
      } else {
        console.log(`  ⚠️  No mapping for: ${section.title}`);
        skipped++;
      }
    }

    console.log(`\n✅ Updated ${updated} sections`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} sections (no mapping found)`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

console.log('📝 IMPORTANT: Run this SQL in Supabase SQL Editor first:');
console.log('─'.repeat(60));
console.log('ALTER TABLE template_sections');
console.log('ADD COLUMN IF NOT EXISTS writing_style text;');
console.log('─'.repeat(60));
console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to proceed...\n');

setTimeout(() => {
  updateSections()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}, 3000);

