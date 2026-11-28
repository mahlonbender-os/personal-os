import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Transactions are read from the Finance sheet. The app does not change that sheet
// or the snapshot copied from it.
export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(
    { error: 'This transaction is read from the Finance sheet. Personal OS does not change that sheet.' },
    { status: 409 }
  );
}
