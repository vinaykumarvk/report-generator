import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Get Supabase client instance (singleton)
 * Uses service role key for server-side operations
 */
export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Get Supabase client for client-side operations (uses anon key)
 */
export function getSupabaseClientPublic() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase public credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection() {
  try {
    const supabase = getSupabaseClient();
    
    // Test connection by checking auth (this always works if Supabase is reachable)
    const { error: authError } = await supabase.auth.getSession();
    
    // If we get any response (even an error), we're connected
    // Network errors would be different from auth errors
    if (authError && (authError.message.includes('network') || authError.message.includes('fetch') || authError.message.includes('Failed to fetch'))) {
      return {
        success: false,
        message: 'Network error: Could not reach Supabase',
        error: authError,
      };
    }

    // Try to query a table to verify database access
    const { error: queryError } = await supabase
      .from('risk_options')
      .select('*')
      .limit(1);

    // PGRST205 means table not found, but we're connected
    if (queryError && queryError.code === 'PGRST205') {
      return { 
        success: true, 
        message: 'Connected to Supabase (migrations may not be run yet)' 
      };
    } else if (!queryError) {
      return { 
        success: true, 
        message: 'Connected to Supabase and can query tables' 
      };
    } else {
      // Other errors might indicate connection issues
      return {
        success: false,
        message: queryError.message || 'Failed to connect to Supabase',
        error: queryError,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to Supabase',
      error,
    };
  }
}

