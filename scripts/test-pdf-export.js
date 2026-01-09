require('dotenv').config({ path: '.env.local' });
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
});
require("tsconfig-paths/register");

const { createClient } = require('@supabase/supabase-js');
const { writePdfExport } = require('../src/lib/pdfExport');
const { getRunById } = require('../src/lib/workerStore');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🧪 Testing PDF Export End-to-End\n');
  console.log('='.repeat(70));
  
  // Get a completed run
  const { data: completedRun } = await supabase
    .from('report_runs')
    .select('id, status, final_report_json, template_version_snapshot_json, input_json')
    .eq('status', 'COMPLETED')
    .not('final_report_json', 'is', null)
    .limit(1)
    .single();
  
  if (!completedRun) {
    console.log('❌ No completed run found');
    return;
  }
  
  console.log(`✅ Using run: ${completedRun.id}\n`);
  
  // Get run using workerStore (same way worker does)
  const run = await getRunById(completedRun.id);
  if (!run) {
    console.log('❌ Could not load run via workerStore');
    return;
  }
  
  console.log('📊 Run loaded via workerStore');
  console.log(`   Template: ${run.templateSnapshot?.name || 'Unknown'}`);
  
  // Extract final report content (same way worker does)
  const finalReportContent = 
    (run.finalReport && typeof run.finalReport === 'object' && run.finalReport.content) ||
    (typeof run.finalReport === 'string' ? run.finalReport : '') ||
    '';
  
  console.log(`   Final report length: ${finalReportContent.length}`);
  
  if (!finalReportContent) {
    console.log('❌ No final report content available');
    return;
  }
  
  // Test PDF generation
  console.log('\n📄 Generating PDF...\n');
  
  try {
    const exportId = 'test-pdf-' + Date.now();
    
    const exportRecord = await writePdfExport(
      {
        id: run.id,
        templateSnapshot: run.templateSnapshot,
        finalReport: finalReportContent,
        inputJson: run.inputJson,
      },
      { sourcesAppendix: [], exportId }
    );
    
    console.log('✅ PDF generated successfully!');
    console.log(`   File path: ${exportRecord.filePath}`);
    
    const fs = require('fs');
    if (fs.existsSync(exportRecord.filePath)) {
      const stats = fs.statSync(exportRecord.filePath);
      console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   ✅ File exists and is readable`);
      
      // Clean up test file
      fs.unlinkSync(exportRecord.filePath);
      console.log(`   🗑️  Test file cleaned up`);
    } else {
      console.log(`   ❌ File was not created at expected path`);
    }
  } catch (error) {
    console.error(`\n❌ PDF generation failed:`);
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 15);
      console.error(`   Stack:`);
      stackLines.forEach(line => console.error(`      ${line}`));
    }
    
    // Check if it's the NaN error
    if (error.message.includes('NaN') || error.message.includes('options.x')) {
      console.error(`\n   🔍 This is the NaN coordinate error - checking markdown content...`);
      const lines = finalReportContent.split('\n');
      const tableLines = lines.filter(l => l.includes('|'));
      if (tableLines.length > 0) {
        console.error(`   Found ${tableLines.length} table lines`);
        console.error(`   Sample table line: ${tableLines[0]}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
})();
