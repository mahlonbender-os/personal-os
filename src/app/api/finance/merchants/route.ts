import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { easternYearMonth, isTransfer, mahlonTransactions } from '@/lib/financeSheet';
import { readTransactions } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || easternYearMonth();
  const rows = mahlonTransactions(await readTransactions(session.accessToken))
    .filter((row) => row.month === month && !isTransfer(row) && row.amount < 0);

  const merchantMap: Record<string, number> = {};
  for (const row of rows) {
    const name = row.merchant.trim() || 'Unknown';
    merchantMap[name] = (merchantMap[name] || 0) + Math.abs(row.amount);
  }

  const merchants = Object.entries(merchantMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([merchant, total]) => ({ merchant, total: Math.round(total * 100) / 100 }));
  const grandTotal = merchants.reduce((sum, row) => sum + row.total, 0);

  return NextResponse.json(
    { month, merchants, grandTotal: Math.round(grandTotal * 100) / 100 },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
