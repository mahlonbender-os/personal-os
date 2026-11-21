import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// The Finance sheet is maintained outside the app. This route used to append
// rows to Google Sheets. It no longer writes anywhere.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(
    { error: 'Personal OS only reads the Finance sheet. Add this transaction on the sheet instead.' },
    { status: 409, headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
