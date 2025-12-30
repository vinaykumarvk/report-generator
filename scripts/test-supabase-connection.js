#!/usr/bin/env node

/**
 * Test Supabase connection using SDK
 * This script helps diagnose connection issues
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  console.log('Testing Supabase connection using SDK...\n');
  
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL not found in .env file');
    process.exit(1);
  }

  if (!supabaseKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env file');
    process.exit(1);
  }

  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Using: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role Key' : 'Anon Key'}\n`);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('Attempting to connect via Supabase SDK...');
    
    // Test connection by checking auth (this always works if Supabase is reachable)
    const { error: authError } = await supabase.auth.getSession();
    
    // If we get any response (even an error), we're connected
    // Network errors would be different from auth errors
    if (authError && (authError.message.includes('network') || authError.message.includes('fetch') || authError.message.includes('Failed to fetch'))) {
      throw new Error('Network error: Could not reach Supabase');
    }
    
    // Try to query a table to verify database access
    // The error message from previous attempt suggested 'risk_options' might exist
    const { data, error: queryError } = await supabase
      .from('risk_options')
      .select('*')
      .limit(1);

    // If we get a response (even if table doesn't exist), we're connected
    // PGRST205 means table not found, but we're connected
    if (queryError && queryError.code === 'PGRST205') {
      console.log('✅ Connected to Supabase (table not found is expected if migrations not run)');
    } else if (!queryError) {
      console.log('✅ Connected to Supabase and can query tables');
    } else {
      // Other errors might indicate connection issues
      throw queryError;
    }

    console.log('✅ Successfully connected to Supabase via SDK!\n');

    // Test database version using a direct query
    try {
      const { data: versionData, error: versionError } = await supabase
        .rpc('exec_sql', { 
          query: "SELECT version(), current_database()" 
        });

      if (!versionError && versionData) {
        console.log('Database info:', versionData);
      }
    } catch (err) {
      // RPC might not be available, that's okay
      console.log('Note: Could not fetch database version (RPC may not be configured)');
    }

    console.log('\n✅ Connection test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Apply the Supabase schema in the dashboard');
    console.log('   2. Seed database (optional) if you have seed scripts');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.error('Error details:', error);
    
    if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. Check if your Supabase project is paused and unpause it');
      console.log('   2. Verify SUPABASE_URL is correct');
      console.log('   3. Check your network connection');
      console.log('   4. Verify the API keys are correct in Supabase Dashboard');
    } else if (error.message.includes('JWT') || error.message.includes('invalid')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. Verify SUPABASE_SERVICE_ROLE_KEY is correct');
      console.log('   2. Get the correct key from Supabase Dashboard > Settings > API');
      console.log('   3. Make sure you\'re using the Service Role key (not anon key) for server-side operations');
    }
    
    process.exit(1);
  }
}

testConnection();
