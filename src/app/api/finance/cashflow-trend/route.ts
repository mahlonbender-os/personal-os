import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { activeMonths } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const book = await readWorkbook(session.accessToken);
  if (!book) {
    return NextResponse.json({ months: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const months = activeMonths(book).map((row) => ({
    month: row.month,
    income: row.income,
    expenses: row.spending,
    interestFees: row.interestFees,
    net: row.net,
    savingsRate: row.savingsRate,
  }));

  return NextResponse.json({ months }, { headers: { 'Cache-Control': 'no-store' } });
}
