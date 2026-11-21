import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readNetWorthHistory, readWorkbook } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const book = await readWorkbook(session.accessToken);
  const latest = book?.latestBalance;
  if (!latest) {
    const historyOnly = await readNetWorthHistory(null);
    if (!historyOnly.history.length) {
      return NextResponse.json({ error: 'Finance sheet is unavailable' }, { status: 502 });
    }
    const last = historyOnly.history[historyOnly.history.length - 1];
    return NextResponse.json({
      totalAssets: last.assets,
      totalLiabilities: last.liabilities,
      netWorth: last.net_worth,
      mahlonNetWorth: last.mahlon_net_worth,
      breeHelocShare: 0,
      mahlonHelocShare: 0,
      capitalOneBjs: 0,
      asOf: last.date,
      accounts: [],
      history: historyOnly.history,
      historySource: historyOnly.source,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  const history = await readNetWorthHistory(book);
  return NextResponse.json({
    totalAssets: latest.totalAssets,
    totalLiabilities: latest.totalLiabilities,
    netWorth: latest.netWorth,
    mahlonNetWorth: latest.mahlonNetWorth,
    breeHelocShare: latest.breeHelocShare,
    mahlonHelocShare: latest.mahlonHelocShare,
    capitalOneBjs: latest.capitalOneBjs,
    asOf: latest.date,
    accounts: latest.accounts,
    history: history.history,
    historySource: history.source,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
