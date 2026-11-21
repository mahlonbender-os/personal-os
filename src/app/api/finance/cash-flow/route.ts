import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { activeMonths, easternYearMonth } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const book = await readWorkbook(session.accessToken);
  if (!book) {
    return NextResponse.json({ error: 'Finance sheet is unavailable' }, { status: 502 });
  }

  const months = activeMonths(book).map((row) => ({
    month: row.label,
    rawHeader: row.month,
    income: row.income,
    essentials: row.spending,
    discretionary: 0,
    interestFees: row.interestFees,
    net: row.net,
    savingsRate: row.savingsRate,
  }));

  const current = months.find((row) => row.rawHeader === easternYearMonth()) || months[months.length - 1];
  return NextResponse.json({
    months,
    projected: current
      ? {
          income: current.income,
          essentials: current.essentials,
          discretionary: 0,
          net: current.net,
        }
      : { income: 0, essentials: 0, discretionary: 0, net: 0 },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
