import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { valuePortfolio } from '@/lib/portfolioValue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const portfolio = await valuePortfolio();
    return NextResponse.json({
      totalValue: portfolio.totalPortfolioValue,
      dailyChange: portfolio.totalDailyGainLoss,
      dailyChangePct: portfolio.dailyChangePct,
      totalGain: portfolio.totalGain,
      totalGainPct: portfolio.totalGainPct,
      hasPrices: portfolio.hasLiveQuotes,
      accounts: portfolio.accounts.map((account) => ({
        name: account.name,
        value: Math.round(account.totalValue * 100) / 100,
        dailyChange: Math.round(account.dailyGainLoss * 100) / 100,
      })),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
