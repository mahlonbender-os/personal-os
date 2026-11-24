import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { easternStamp } from '@/lib/financeSheet';
import { valuePortfolio } from '@/lib/portfolioValue';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const portfolio = await valuePortfolio();
    return NextResponse.json({
      quotes: portfolio.quotes,
      accounts: portfolio.accounts,
      totalPortfolioValue: portfolio.totalPortfolioValue,
      totalDailyGainLoss: portfolio.totalDailyGainLoss,
      totalGain: portfolio.totalGain,
      totalGainPct: portfolio.totalGainPct,
      hasLiveQuotes: portfolio.hasLiveQuotes,
      lastUpdated: easternStamp(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('Investments GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
