import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { mahlonTransactions } from '@/lib/financeSheet';
import { readTransactions } from '@/lib/financeRead';
import { freshRequested, NO_STORE_HEADERS } from '@/lib/noStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function monthKey(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7);
  return null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = monthKey(searchParams.get('month'));
  const category = searchParams.get('category');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 5000);
  const includeBree = searchParams.get('owner') === 'all';

  let transactions = await readTransactions(session.accessToken, freshRequested(request));
  const bree = transactions.filter((row) => row.owner.trim().toLowerCase() === 'bree');
  if (!includeBree) transactions = mahlonTransactions(transactions);
  if (month) transactions = transactions.filter((row) => row.month === month);
  if (category) transactions = transactions.filter((row) => row.category === category);

  return NextResponse.json(
    {
      transactions: transactions.slice(0, limit),
      breeCount: bree.length,
    },
    { headers: NO_STORE_HEADERS }
  );
}
