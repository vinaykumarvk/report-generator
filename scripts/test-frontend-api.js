require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testFrontendAPI() {
  console.log('🧪 Testing Frontend API Endpoints\n');
  console.log('='.repeat(50));
  
  // Test templates endpoint
  try {
    console.log('\n📋 Testing GET /api/templates...');
    const templatesRes = await fetch(`${BASE_URL}/api/templates`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!templatesRes.ok) {
      console.error(`❌ Templates API failed: ${templatesRes.status} ${templatesRes.statusText}`);
      const errorText = await templatesRes.text();
      console.error('   Error:', errorText.substring(0, 200));
    } else {
      const templates = await templatesRes.json();
      console.log(`✅ Templates API: ${Array.isArray(templates) ? templates.length : 0} templates`);
      if (templates.length > 0) {
        console.log(`   Sample: ${templates[0].name || 'Unnamed'}`);
      }
    }
  } catch (err) {
    console.error('❌ Templates API error:', err.message);
    console.log('   💡 Make sure the dev server is running: npm run dev');
  }
  
  // Test report-runs endpoint
  try {
    console.log('\n📊 Testing GET /api/report-runs...');
    const runsRes = await fetch(`${BASE_URL}/api/report-runs`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!runsRes.ok) {
      console.error(`❌ Report Runs API failed: ${runsRes.status} ${runsRes.statusText}`);
      const errorText = await runsRes.text();
      console.error('   Error:', errorText.substring(0, 200));
    } else {
      const runs = await runsRes.json();
      console.log(`✅ Report Runs API: ${Array.isArray(runs) ? runs.length : 0} runs`);
      if (runs.length > 0) {
        console.log(`   Sample: ${runs[0].status || 'N/A'} - ${runs[0].id?.substring(0, 8) || 'N/A'}`);
      }
    }
  } catch (err) {
    console.error('❌ Report Runs API error:', err.message);
    console.log('   💡 Make sure the dev server is running: npm run dev');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n💡 To test the frontend UI:');
  console.log('   1. Ensure dev server is running: npm run dev');
  console.log('   2. Open http://localhost:3000 in your browser');
  console.log('   3. Check browser console (F12) for errors');
  console.log('   4. Check Network tab to see API calls');
  console.log('   5. Verify templates appear in Reports Studio');
  console.log('   6. Verify runs appear in Run Dashboard');
}

testFrontendAPI().catch(console.error);
