import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

export async function GET() {
  const config = getConfig();
  logger.debug({ service: 'healthcheck' }, 'health endpoint invoked');

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv
  });
}
