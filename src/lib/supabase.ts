import { createClient, SupabaseClient } from '@supabase/supabase-js';

type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericUpdatableView = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericNonUpdatableView = {
  Row: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericView = GenericUpdatableView | GenericNonUpdatableView;

type GenericFunction = {
  Args: Record<string, unknown> | never;
  Returns: unknown;
  SetofOptions?: {
    isSetofReturn?: boolean;
    isOneToOne?: boolean;
    isNotNullable?: boolean;
    to: string;
    from: string;
  };
};

type GenericSchema = {
  Tables: Record<string, GenericTable>;
  Views: Record<string, GenericView>;
  Functions: Record<string, GenericFunction>;
};

type Database = {
  public: GenericSchema;
};

let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get Supabase client instance for SERVER-SIDE operations (singleton)
 * Uses service role key - NEVER expose this to the client!
 * 
 * ⚠️  SECURITY: This client bypasses Row Level Security (RLS)
 * Only use in API routes and server components
 */
export function getSupabaseClient() {
  // Ensure we're on the server
  if (typeof window !== 'undefined') {
    throw new Error(
      'getSupabaseClient() can only be called on the server. Use getSupabaseClientPublic() for client-side operations.'
    );
  }
  
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file'
    );
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
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

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
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
