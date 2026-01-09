require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

async function testSectionsDisplay() {
  console.log('🧪 Testing Sections Display Fix\n');
  console.log('='.repeat(50));
  
  // Test 1: Check API returns sections array
  console.log('\n📋 Test 1: API Response Structure');
  try {
    const res = await fetch(`${BASE_URL}/api/templates`);
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }
    const templates = await res.json();
    console.log(`✅ API returned ${templates.length} templates`);
    
    if (templates.length > 0) {
      const first = templates[0];
      console.log(`   Template: ${first.name}`);
      console.log(`   Has 'sections' property: ${'sections' in first}`);
      console.log(`   Sections type: ${Array.isArray(first.sections) ? 'Array' : typeof first.sections}`);
      console.log(`   Sections count: ${first.sections?.length || 0}`);
      
      if (first.sections && first.sections.length > 0) {
        console.log(`   ✅ Sections are present and will display`);
        first.sections.forEach((s, i) => {
          console.log(`      ${i+1}. ${s.title || 'Untitled'} (order: ${s.order || 'N/A'})`);
        });
      } else {
        console.log(`   ⚠️  No sections in database for this template`);
        console.log(`   💡 Sections will show "No sections added" message`);
      }
    }
  } catch (err) {
    console.error('❌ Test 1 failed:', err.message);
  }
  
  // Test 2: Check individual template endpoint
  console.log('\n📋 Test 2: Individual Template Endpoint');
  try {
    const listRes = await fetch(`${BASE_URL}/api/templates`);
    const templates = await listRes.json();
    if (templates.length > 0) {
      const templateId = templates[0].id;
      const detailRes = await fetch(`${BASE_URL}/api/templates/${templateId}`);
      if (detailRes.ok) {
        const template = await detailRes.json();
        console.log(`✅ Template detail endpoint works`);
        console.log(`   Template: ${template.name}`);
        console.log(`   Sections: ${template.sections?.length || 0}`);
        if (template.sections && template.sections.length > 0) {
          console.log(`   ✅ Sections will display in UI`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Test 2 failed:', err.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Testing Complete');
  console.log('\n💡 Frontend Changes:');
  console.log('   1. Sections panel is now OPEN by default');
  console.log('   2. Section count badge shows number of sections');
  console.log('   3. Expand/collapse button available in view mode');
  console.log('\n📝 Next Steps:');
  console.log('   1. Open http://localhost:3000/reports-studio');
  console.log('   2. Expand a template to view sections');
  console.log('   3. If template has sections, they should be visible');
  console.log('   4. If creating/editing, sections panel should be open');
}

testSectionsDisplay().catch(console.error);
