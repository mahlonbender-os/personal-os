import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normName } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';
import { freshRequested, NO_STORE_HEADERS } from '@/lib/noStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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

  const find = (needle: string) => {
    const hit = latest.accounts.find((account) => normName(account.name).includes(needle));
    return hit ? hit.value : 0;
  };

  return NextResponse.json({
    homeValue: find('home'),
    helocBalance: find('heloc'),
    primaryMortgage: find('mortgage'),
    lastUpdated: latest.date,
  }, { headers: NO_STORE_HEADERS });
}
