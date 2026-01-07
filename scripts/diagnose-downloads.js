/**
 * Diagnostic script to check why downloads aren't working in production
 * 
 * Usage: node scripts/diagnose-downloads.js [runId]
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const exportsBucket = process.env.SUPABASE_EXPORTS_BUCKET || 'exports';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBucketExists() {
  console.log('\n🔍 Step 1: Checking if exports bucket exists...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('❌ Error listing buckets:', error.message);
      return false;
    }
    
    const exportsBucketExists = buckets.some(b => b.name === exportsBucket);
    if (exportsBucketExists) {
      const bucket = buckets.find(b => b.name === exportsBucket);
      console.log(`✅ Bucket "${exportsBucket}" exists`);
      console.log(`   Public: ${bucket.public ? '✅ Yes' : '❌ No (THIS IS THE PROBLEM!)'}`);
      console.log(`   Created: ${bucket.created_at}`);
      return bucket.public;
    } else {
      console.log(`❌ Bucket "${exportsBucket}" does NOT exist`);
      console.log(`   Available buckets: ${buckets.map(b => b.name).join(', ') || 'none'}`);
      return false;
    }
  } catch (err) {
    console.error('❌ Error checking bucket:', err.message);
    return false;
  }
}

async function checkRecentExports(runId) {
  console.log('\n🔍 Step 2: Checking recent exports...');
  
  let query = supabase
    .from('exports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (runId) {
    query = query.eq('report_run_id', runId);
  }
  
  const { data: exports, error } = await query;
  
  if (error) {
    console.error('❌ Error fetching exports:', error.message);
    return;
  }
  
  if (!exports || exports.length === 0) {
    console.log('⚠️  No exports found');
    return;
  }
  
  console.log(`\n📊 Found ${exports.length} export(s):\n`);
  
  for (const exp of exports) {
    console.log(`Export ID: ${exp.id}`);
    console.log(`  Format: ${exp.format}`);
    console.log(`  Status: ${exp.status || 'NULL'}`);
    console.log(`  Storage URL: ${exp.storage_url ? '✅ Set' : '❌ NULL'}`);
    if (exp.storage_url) {
      console.log(`    URL: ${exp.storage_url}`);
    }
    console.log(`  File Path: ${exp.file_path ? '✅ Set' : '❌ NULL'}`);
    console.log(`  File Size: ${exp.file_size || 'NULL'}`);
    console.log(`  Error: ${exp.error_message || 'None'}`);
    console.log(`  Created: ${exp.created_at}`);
    console.log('');
  }
  
  // Check if any have storage_url
  const withStorage = exports.filter(e => e.storage_url);
  const withoutStorage = exports.filter(e => !e.storage_url);
  
  console.log(`\n📈 Summary:`);
  console.log(`  ✅ With storage_url: ${withStorage.length}`);
  console.log(`  ❌ Without storage_url: ${withoutStorage.length}`);
  
  if (withoutStorage.length > 0) {
    console.log(`\n⚠️  ${withoutStorage.length} export(s) missing storage_url - storage upload likely failed`);
  }
  
  return exports;
}

async function testStorageUrl(exports) {
  console.log('\n🔍 Step 3: Testing storage URLs...');
  
  const withStorage = exports.filter(e => e.storage_url && e.status === 'READY');
  
  if (withStorage.length === 0) {
    console.log('⚠️  No exports with storage_url to test');
    return;
  }
  
  for (const exp of withStorage.slice(0, 3)) {
    console.log(`\nTesting: ${exp.id} (${exp.format})`);
    console.log(`  URL: ${exp.storage_url}`);
    
    try {
      const url = new URL(exp.storage_url);
      console.log(`  ✅ Valid URL format`);
      console.log(`  Domain: ${url.hostname}`);
      
      // Try to fetch (head request)
      const response = await fetch(exp.storage_url, { method: 'HEAD' });
      if (response.ok) {
        console.log(`  ✅ File is accessible (${response.status})`);
        console.log(`  Content-Type: ${response.headers.get('content-type')}`);
        console.log(`  Content-Length: ${response.headers.get('content-length')} bytes`);
      } else {
        console.log(`  ❌ File NOT accessible (${response.status} ${response.statusText})`);
        if (response.status === 404) {
          console.log(`     → File doesn't exist in storage`);
        } else if (response.status === 403) {
          console.log(`     → Bucket is not public or file is not accessible`);
        }
      }
    } catch (err) {
      console.log(`  ❌ Error testing URL: ${err.message}`);
    }
  }
}

async function checkStorageFiles() {
  console.log('\n🔍 Step 4: Checking files in storage bucket...');
  
  try {
    const { data: files, error } = await supabase.storage
      .from(exportsBucket)
      .list('report-runs', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (error) {
      console.error('❌ Error listing files:', error.message);
      if (error.message.includes('not found')) {
        console.error('   → Bucket might not exist or you don\'t have access');
      }
      return;
    }
    
    if (!files || files.length === 0) {
      console.log('⚠️  No files found in storage bucket');
      console.log('   → This means exports are not being uploaded to storage');
      return;
    }
    
    console.log(`✅ Found ${files.length} file(s) in storage:\n`);
    for (const file of files.slice(0, 5)) {
      console.log(`  ${file.name}`);
      console.log(`    Size: ${file.metadata?.size || 'unknown'} bytes`);
      console.log(`    Created: ${file.created_at || 'unknown'}`);
    }
  } catch (err) {
    console.error('❌ Error checking storage files:', err.message);
  }
}

async function main() {
  const runId = process.argv[2];
  
  console.log('🔧 Download Diagnostics\n');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Exports Bucket: ${exportsBucket}`);
  if (runId) {
    console.log(`Run ID: ${runId}`);
  }
  
  const isPublic = await checkBucketExists();
  
  if (!isPublic) {
    console.log('\n⚠️  CRITICAL: Bucket is not public!');
    console.log('   → Go to Supabase Dashboard → Storage → exports');
    console.log('   → Click on the bucket → Settings → Make it public');
    console.log('   → This is required for downloads to work\n');
  }
  
  const exports = await checkRecentExports(runId);
  
  if (exports && exports.length > 0) {
    await testStorageUrl(exports);
  }
  
  await checkStorageFiles();
  
  console.log('\n✅ Diagnostics complete!\n');
}

main().catch(console.error);

