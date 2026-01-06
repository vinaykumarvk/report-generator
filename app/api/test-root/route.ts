import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ 
    message: 'Test route from root app/ directory',
    timestamp: new Date().toISOString()
  });
}




