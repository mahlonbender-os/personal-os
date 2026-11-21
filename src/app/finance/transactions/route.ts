import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { mahlonTransactions } from '@/lib/financeSheet';
import { readTransactions } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const transactions = mahlonTransactions(await readTransactions(session.accessToken)).slice(0, 500);
  return NextResponse.json(
    { transactions },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
