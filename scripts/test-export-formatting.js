const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExportFormatting() {
  const runId = '75f5435b-df23-4ade-808a-1d2988e8ecae';
  
  console.log('🔍 Testing export formatting...\n');
  
  // Create a new export
  console.log('1. Creating new export...');
  const response = await fetch(`http://localhost:3000/api/report-runs/${runId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'MARKDOWN' })
  });
  
  if (!response.ok) {
    console.error('   ❌ Failed:', await response.text());
    return;
  }
  
  const result = await response.json();
  console.log('   ✅ Export job created:', result.jobId);
  
  // Wait for processing
  console.log('\n2. Waiting for worker to process (12 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 12000));
  
  // Get the latest export
  const { data: exports } = await supabase
    .from('exports')
    .select('*')
    .eq('report_run_id', runId)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (!exports || exports.length === 0) {
    console.log('   ❌ No exports found');
    return;
  }
  
  const latestExport = exports[0];
  console.log('\n3. Latest export:');
  console.log('   File:', latestExport.file_path);
  
  // Read the file and check formatting
  const fs = require('fs');
  if (fs.existsSync(latestExport.file_path)) {
    const content = fs.readFileSync(latestExport.file_path, 'utf8');
    
    console.log('\n4. Checking formatting...');
    
    // Check for proper markdown features
    const hasHeaders = content.includes('# ') || content.includes('## ');
    const hasTables = content.includes('|') && content.includes('---');
    const hasBold = content.includes('**');
    const hasLinks = content.includes('[') && content.includes('](');
    const hasLists = content.includes('- ') || content.includes('* ');
    
    console.log('   Headers:', hasHeaders ? '✅' : '❌');
    console.log('   Tables:', hasTables ? '✅' : '❌');
    console.log('   Bold text:', hasBold ? '✅' : '❌');
    console.log('   Links:', hasLinks ? '✅' : '❌');
    console.log('   Lists:', hasLists ? '✅' : '❌');
    
    // Show first 1000 chars
    console.log('\n5. First 1000 characters:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(content.substring(0, 1000));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Check for JSON artifacts (bad)
    const hasJsonArtifacts = content.includes('"markdown":') || content.includes('{"content"');
    if (hasJsonArtifacts) {
      console.log('\n   ⚠️  WARNING: Export contains JSON artifacts!');
    } else {
      console.log('\n   ✅ Export is clean markdown (no JSON artifacts)');
    }
  } else {
    console.log('   ❌ File not found:', latestExport.file_path);
  }
}

testExportFormatting().catch(err => {
  console.error('❌ Error:', err.message);
});
