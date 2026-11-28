import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { activeMonths } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';
import { freshRequested, NO_STORE_HEADERS } from '@/lib/noStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const book = await readWorkbook(session.accessToken, freshRequested(request));
  if (!book) {
    return NextResponse.json({ months: [] }, { headers: NO_STORE_HEADERS });
  }

  const months = activeMonths(book).map((row) => ({
    month: row.month,
    income: row.income,
    expenses: row.spending,
    interestFees: row.interestFees,
    net: row.net,
    savingsRate: row.savingsRate,
  }));

  return NextResponse.json({ months }, { headers: NO_STORE_HEADERS });
}
