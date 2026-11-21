import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normName } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const book = await readWorkbook(session.accessToken);
  if (!book) {
    return NextResponse.json({ error: 'Finance sheet is unavailable' }, { status: 502 });
  }

  const accounts = book.debts
    .filter((debt) => {
      const name = normName(debt.name);
      if (name.includes('heloc') || name.includes('mortgage') || name.includes('student') || name.includes('aidvantage')) {
        return false;
      }
      return (debt.creditLimit || 0) > 0;
    })
    .map((debt) => ({
      name: debt.name,
      balance: Math.abs(debt.balance),
      limit: debt.creditLimit,
      utilization: debt.utilization,
      apr: debt.apr,
      notes: debt.notes,
    }));

  return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
