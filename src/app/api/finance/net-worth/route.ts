import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readNetWorthHistory, readWorkbook } from '@/lib/financeRead';
import { formatEasternDate } from '@/lib/financeSheet';

export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const book = await readWorkbook(session.accessToken);
  const history = await readNetWorthHistory(book);
  const latestSheet = book?.latestBalance ?? null;

  if (history.source === 'daily' && history.history.length > 0) {
    const last = history.history[history.history.length - 1];
    return NextResponse.json({
      totalAssets: last.assets,
      totalLiabilities: last.liabilities,
      netWorth: last.net_worth,
      mahlonNetWorth: last.mahlon_net_worth,
      breeHelocShare: latestSheet?.breeHelocShare ?? 0,
      mahlonHelocShare: latestSheet?.mahlonHelocShare ?? 0,
      capitalOneBjs: latestSheet?.capitalOneBjs ?? 0,
      asOf: formatEasternDate(last.date),
      asOfDate: last.date,
      source: 'daily',
      accounts: latestSheet?.accounts ?? [],
      history: history.history,
      historySource: 'daily',
    }, noStore);
  }

  if (!latestSheet) {
    return NextResponse.json({ error: 'Finance sheet is unavailable' }, { status: 502 });
  }

  return NextResponse.json({
    totalAssets: latestSheet.totalAssets,
    totalLiabilities: latestSheet.totalLiabilities,
    netWorth: latestSheet.netWorth,
    mahlonNetWorth: latestSheet.mahlonNetWorth,
    breeHelocShare: latestSheet.breeHelocShare,
    mahlonHelocShare: latestSheet.mahlonHelocShare,
    capitalOneBjs: latestSheet.capitalOneBjs,
    asOf: formatEasternDate(latestSheet.date),
    asOfDate: latestSheet.date,
    source: 'balances',
    accounts: latestSheet.accounts,
    history: history.history,
    historySource: history.source,
  }, noStore);
}
