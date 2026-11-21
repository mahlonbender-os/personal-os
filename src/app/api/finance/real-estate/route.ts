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
  const latest = book?.latestBalance;
  if (!latest) {
    return NextResponse.json({ error: 'Finance sheet is unavailable' }, { status: 502 });
  }

  const find = (needle: string) => {
    const hit = latest.accounts.find((account) => normName(account.name).includes(needle));
    return hit ? hit.value : 0;
  };

  return NextResponse.json({
    homeValue: find('home'),
    helocBalance: find('heloc'),
    primaryMortgage: find('mortgage'),
    lastUpdated: latest.date,
  });
}
