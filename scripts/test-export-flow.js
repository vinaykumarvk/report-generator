#!/usr/bin/env node
/**
 * Interactive test script for the export feature
 * Tests the complete flow: request → worker processing → download
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_URL = process.env.TEST_API_URL || 'http://localhost:3002';
const RUN_ID = process.argv[2] || '03c98021-8c70-4bbe-87b8-3020cc046c17';
const FORMAT = process.argv[3] || 'MARKDOWN';

function formatBytes(bytes) {
  if (!bytes) return 'N/A';
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function formatStatus(status) {
  const icons = {
    QUEUED: '⏳',
    RUNNING: '🏃',
    READY: '✅',
    FAILED: '❌'
  };
  return `${icons[status] || '❓'} ${status}`;
}

async function testExportFlow() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Export Feature - Local Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Run ID: ${RUN_ID}`);
  console.log(`📄 Format: ${FORMAT}`);
  console.log(`🌐 API URL: ${API_URL}`);
  console.log('');

  try {
    // Step 1: Create export request
    console.log('━━━ Step 1: Create Export Request ━━━');
    const response = await fetch(`${API_URL}/api/report-runs/${RUN_ID}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: FORMAT })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Export request failed:', error);
      return;
    }

    const result = await response.json();
    console.log(`✅ Export requested (${response.status})`);
    console.log(`   Export ID: ${result.exportId}`);
    console.log(`   Job ID: ${result.jobId}`);
    console.log('');

    const exportId = result.exportId;

    // Step 2: Monitor export status
    console.log('━━━ Step 2: Monitor Export Status ━━━');
    let attempt = 0;
    let exportRecord = null;

    while (attempt < 30) { // Max 30 seconds
      const { data } = await supabase
        .from('exports')
        .select('*')
        .eq('id', exportId)
        .single();

      exportRecord = data;

      if (!exportRecord) {
        console.log('⚠️  Export record not found yet...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempt++;
        continue;
      }

      const status = exportRecord.status;
      process.stdout.write(`\r   Status: ${formatStatus(status)}  `);

      if (status === 'READY' || status === 'FAILED') {
        console.log(''); // New line
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempt++;
    }

    if (attempt >= 30) {
      console.log('\n⚠️  Timeout waiting for export to complete');
      return;
    }

    console.log('');

    // Step 3: Show export details
    console.log('━━━ Step 3: Export Details ━━━');
    console.log(`   Status: ${formatStatus(exportRecord.status)}`);
    console.log(`   File: ${exportRecord.file_path?.split('/').pop() || 'N/A'}`);
    console.log(`   Size: ${formatBytes(exportRecord.file_size)}`);
    console.log(`   Checksum: ${exportRecord.checksum?.substring(0, 16) || 'N/A'}...`);
    
    if (exportRecord.storage_url) {
      console.log(`   Storage: ✅ Uploaded to Supabase Storage`);
      console.log(`   URL: ${exportRecord.storage_url.substring(0, 80)}...`);
    } else {
      console.log(`   Storage: ⚠️  Local file only`);
    }

    if (exportRecord.error_message) {
      console.log(`   Error: ❌ ${exportRecord.error_message}`);
    }
    console.log('');

    // Step 4: Test download endpoint
    console.log('━━━ Step 4: Test Download Endpoint ━━━');
    const downloadResponse = await fetch(
      `${API_URL}/api/report-runs/${RUN_ID}/exports/${exportId}`,
      { redirect: 'manual' }
    );

    console.log(`   HTTP Status: ${downloadResponse.status}`);

    if (downloadResponse.status === 302) {
      const location = downloadResponse.headers.get('location');
      console.log(`   ✅ Redirect to storage URL`);
      console.log(`   Location: ${location?.substring(0, 80)}...`);
    } else if (downloadResponse.status === 409) {
      const errorData = await downloadResponse.json();
      console.log(`   ⏳ Not ready: ${JSON.stringify(errorData)}`);
    } else if (downloadResponse.status === 200) {
      const contentType = downloadResponse.headers.get('content-type');
      const contentLength = downloadResponse.headers.get('content-length');
      console.log(`   ✅ File served directly`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Content-Length: ${formatBytes(parseInt(contentLength || '0'))}`);
    } else {
      console.log(`   ❌ Unexpected status: ${downloadResponse.status}`);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testExportFlow();




