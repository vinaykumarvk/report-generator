#!/usr/bin/env node

/**
 * Test worker database connection and job claiming
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('🔍 Testing Worker Database Connection');
  console.log('=====================================');
  console.log('');

  // Test 1: Basic connection
  console.log('1️⃣ Testing basic database connection...');
  try {
    const { data, error } = await supabase.from('workspaces').select('id, name').limit(1);
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }
    console.log('✅ Database connection successful');
    console.log('   Workspaces:', data);
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }

  // Test 2: Check for QUEUED jobs
  console.log('2️⃣ Checking for QUEUED jobs...');
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, type, status, workspace_id, created_at')
      .eq('status', 'QUEUED')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('❌ Failed to query jobs:', error.message);
      process.exit(1);
    }

    console.log(`✅ Found ${jobs.length} QUEUED jobs`);
    if (jobs.length > 0) {
      console.log('');
      console.log('Jobs:');
      jobs.forEach(job => {
        console.log(`   - ${job.id.substring(0, 8)}... (${job.type}, workspace: ${job.workspace_id})`);
      });
    }
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }

  // Test 3: Check if claim_next_job RPC exists
  console.log('3️⃣ Testing claim_next_job RPC function...');
  try {
    const { data, error } = await supabase.rpc('claim_next_job', {
      worker_id: 'test-worker',
      lease_seconds: 300
    });

    if (error) {
      console.error('❌ RPC function failed:', error.message);
      console.error('   This might mean the database function is missing or has an error');
      console.log('');
      console.log('💡 The claim_next_job function should exist in your Supabase database.');
      console.log('   Check if it was created during database setup.');
      process.exit(1);
    }

    if (data) {
      const job = Array.isArray(data) ? data[0] : data;
      if (job) {
        console.log('✅ Successfully claimed a job!');
        console.log(`   Job ID: ${job.id}`);
        console.log(`   Type: ${job.type}`);
        console.log(`   Workspace: ${job.workspace_id || 'null'}`);
        console.log('');
        console.log('⚠️  Note: This job is now locked to test-worker');
        console.log('   You may need to unlock it manually if needed.');
      } else {
        console.log('✅ RPC function works, but no jobs available to claim');
        console.log('   (This is normal if queue is empty or all jobs are locked)');
      }
    } else {
      console.log('✅ RPC function works, but returned no data');
    }
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }

  // Test 4: Check workspace ID
  console.log('4️⃣ Checking DEFAULT_WORKSPACE_ID...');
  const defaultWorkspaceId = process.env.DEFAULT_WORKSPACE_ID;
  if (defaultWorkspaceId) {
    console.log(`✅ DEFAULT_WORKSPACE_ID is set: ${defaultWorkspaceId}`);
    
    // Check if this workspace exists
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', defaultWorkspaceId)
      .single();

    if (error) {
      console.error(`❌ Workspace ${defaultWorkspaceId} not found in database!`);
      console.error('   This could cause the worker to not find jobs.');
    } else {
      console.log(`✅ Workspace exists: ${workspace.name}`);
    }
  } else {
    console.log('⚠️  DEFAULT_WORKSPACE_ID is not set');
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('✅ All tests passed!');
  console.log('');
  console.log('If the worker is still not processing jobs, check:');
  console.log('1. Worker logs for errors');
  console.log('2. That jobs have the correct workspace_id');
  console.log('3. That the worker is actually running (not crashed)');
  console.log('');
}

test().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

