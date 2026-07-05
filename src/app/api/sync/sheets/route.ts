import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performSheetsSync } from '@/lib/syncSheets';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session as any).accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'No access token — please sign out and back in' }, { status: 401 });
    }

    const result = await performSheetsSync(accessToken);
    const status = result.success ? 200 : 500;

    return NextResponse.json(result, {
      status,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err: any) {
    console.error(`[sync/sheets] caught=${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}