require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('SUPABASE_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTemplatesEndpoint() {
  console.log('\n📋 Testing /api/templates endpoint...\n');
  
  try {
    // First try with the relationship query
    let { data, error } = await supabase
      .from('templates')
      .select('*, template_sections(*)')
      .order('updated_at', { ascending: false });
    
    // If relationship query fails, try separate queries
    if (error && error.message.includes('relationship')) {
      console.log('⚠️  Relationship query failed, trying separate queries...');
      const { data: templatesData, error: templatesError } = await supabase
        .from('templates')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (templatesError) {
        console.error('❌ Error fetching templates:', templatesError.message);
        return false;
      }
      
      // Fetch sections separately
      const templateIds = templatesData.map(t => t.id);
      const { data: sectionsData } = await supabase
        .from('template_sections')
        .select('*')
        .in('template_id', templateIds)
        .order('order', { ascending: true });
      
      // Combine data
      data = templatesData.map(template => ({
        ...template,
        template_sections: sectionsData?.filter(s => s.template_id === template.id) || []
      }));
      error = null;
    }
    
    if (error) {
      console.error('❌ Error fetching templates:', error.message);
      return false;
    }
    
    console.log(`✅ Found ${data?.length || 0} templates`);
    
    if (data && data.length > 0) {
      console.log('\n📄 Sample templates:');
      data.slice(0, 3).forEach((template, idx) => {
        console.log(`\n${idx + 1}. ${template.name || 'Unnamed'}`);
        console.log(`   ID: ${template.id}`);
        console.log(`   Status: ${template.status || 'N/A'}`);
        console.log(`   Sections: ${template.template_sections?.length || 0}`);
        console.log(`   Workspace: ${template.workspace_id || 'NULL'}`);
      });
    } else {
      console.log('⚠️  No templates found in database');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return false;
  }
}

async function testReportRunsEndpoint() {
  console.log('\n📊 Testing /api/report-runs endpoint...\n');
  
  try {
    const { data, error } = await supabase
      .from('report_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching report runs:', error.message);
      return false;
    }
    
    console.log(`✅ Found ${data?.length || 0} report runs`);
    
    if (data && data.length > 0) {
      console.log('\n📄 Sample runs:');
      data.slice(0, 3).forEach((run, idx) => {
        console.log(`\n${idx + 1}. Run ID: ${run.id}`);
        console.log(`   Status: ${run.status || 'N/A'}`);
        console.log(`   Created: ${run.created_at || 'N/A'}`);
        console.log(`   Template ID: ${run.template_id || 'N/A'}`);
      });
    } else {
      console.log('⚠️  No report runs found in database');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return false;
  }
}

async function testWorkspace() {
  console.log('\n🏢 Testing workspace setup...\n');
  
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching workspaces:', error.message);
      return false;
    }
    
    console.log(`✅ Found ${data?.length || 0} workspaces`);
    
    if (data && data.length > 0) {
      data.forEach((ws, idx) => {
        console.log(`   ${idx + 1}. ${ws.name || 'Unnamed'} (${ws.id})`);
      });
    } else {
      console.log('⚠️  No workspaces found - this might cause issues');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing Frontend Data Population\n');
  console.log('=' .repeat(50));
  
  const results = {
    templates: await testTemplatesEndpoint(),
    runs: await testReportRunsEndpoint(),
    workspace: await testWorkspace(),
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Results:');
  console.log(`   Templates API: ${results.templates ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Report Runs API: ${results.runs ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Workspace Setup: ${results.workspace ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'All tests passed' : 'Some tests failed'}`);
  
  if (allPassed) {
    console.log('\n💡 Next steps:');
    console.log('   1. Start the dev server: npm run dev');
    console.log('   2. Open http://localhost:3000');
    console.log('   3. Check browser console for any errors');
    console.log('   4. Check Network tab to see API calls');
  } else {
    console.log('\n⚠️  Fix the failing tests before testing the frontend');
  }
}

runTests().catch(console.error);
