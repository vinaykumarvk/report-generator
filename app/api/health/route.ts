import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { testSupabaseConnection } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const config = getConfig();
  logger.debug({ service: 'healthcheck' }, 'health endpoint invoked');

  // Test Supabase connection (optional, don't fail if it errors)
  let supabaseStatus = { success: false, message: 'Not tested' };
  try {
    supabaseStatus = await testSupabaseConnection();
  } catch (error: any) {
    supabaseStatus = {
      success: false,
      message: error.message || 'Connection test failed',
    };
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    supabase: {
      connected: supabaseStatus.success,
      message: supabaseStatus.message,
    },
  });
}
