import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normName } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

function valueOf(bookAccounts: { name: string; value: number }[], needle: string): number {
  const hit = bookAccounts.find((account) => normName(account.name).includes(needle));
  return hit ? hit.value : 0;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const book = await readWorkbook(session.accessToken);
  const latest = book?.latestBalance;
  if (!latest) {
    return NextResponse.json({ error: 'Finance sheet is unavailable' }, { status: 502 });
  }

  const home_value = valueOf(latest.accounts, 'home');
  const heloc_balance = valueOf(latest.accounts, 'heloc');
  const mortgage_balance = valueOf(latest.accounts, 'mortgage');
  const equity = home_value - heloc_balance - mortgage_balance;

  return NextResponse.json(
    { home_value, heloc_balance, mortgage_balance, equity, asOf: latest.date },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
