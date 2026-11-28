import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normName } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';
import { freshRequested, NO_STORE_HEADERS } from '@/lib/noStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function valueOf(bookAccounts: { name: string; value: number }[], needle: string): number {
  const hit = bookAccounts.find((account) => normName(account.name).includes(needle));
  return hit ? hit.value : 0;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const book = await readWorkbook(session.accessToken, freshRequested(request));
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
    { headers: NO_STORE_HEADERS }
  );
}
