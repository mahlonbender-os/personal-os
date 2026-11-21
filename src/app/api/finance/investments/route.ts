import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { easternStamp, normName } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

async function fetchQuote(symbol: string): Promise<{ price: number; d: number; dp: number }> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
    );
    const data = await res.json();
    return { price: data.c || 0, d: data.d || 0, dp: data.dp || 0 };
  } catch {
    return { price: 0, d: 0, dp: 0 };
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [vooQuote, tslaQuote] = await Promise.all([
      fetchQuote('VOO'),
      fetchQuote('TSLA'),
    ]);

    const priceMap: Record<string, number> = {
      VOO: vooQuote.price,
      TSLA: tslaQuote.price,
    };
    const dailyChangeMap: Record<string, { d: number; dp: number }> = {
      VOO: { d: vooQuote.d, dp: vooQuote.dp },
      TSLA: { d: tslaQuote.d, dp: tslaQuote.dp },
    };

    let sheetRoth = 0;
    let sheetHsa = 0;
    try {
      const book = await readWorkbook(session.accessToken);
      const accounts = book?.latestBalance?.accounts || [];
      for (const account of accounts) {
        const name = normName(account.name);
        if (name.includes('roth')) sheetRoth = account.value;
        if (name.includes('hsa')) sheetHsa = account.value;
      }
    } catch {
      // non-fatal
    }

    const { data: cashRows, error: cashError } = await supabase
      .from('investment_cash')
      .select('account, cash_balance, updated_at')
      .eq('user_id', USER_ID);

    if (cashError) {
      console.error('investment_cash read error:', cashError.message);
      return NextResponse.json({ error: cashError.message }, { status: 500 });
    }

    const cashMap: Record<string, number> = {};
    const cashUpdatedAt: Record<string, string | null> = {};
    (cashRows || []).forEach(r => {
      const balance = parseFloat(String(r.cash_balance));
      cashMap[r.account] = Number.isFinite(balance) ? balance : 0;
      cashUpdatedAt[r.account] = r.updated_at ?? null;
    });

    const { data: positionRows } = await supabase
      .from('investment_positions')
      .select('account, security, shares, avg_cost')
      .eq('user_id', USER_ID);

    const { data: trades } = await supabase
      .from('investment_transactions')
      .select('*')
      .eq('user_id', USER_ID)
      .order('date', { ascending: false });

    const accountNames = ['Roth IRA', 'HSA'];
    const sheetMap: Record<string, number> = { 'Roth IRA': sheetRoth, 'HSA': sheetHsa };

    let totalDailyGainLoss = 0;

    const accountList = accountNames.map(accountName => {
      const accountPositions = (positionRows || []).filter(p => p.account === accountName);
      const cash = cashMap[accountName] ?? 0;
      const cashAsOf = cashUpdatedAt[accountName] ?? null;

      const holdings = accountPositions
        .filter(p => parseFloat(String(p.shares)) > 0)
        .map(p => {
          const shares = parseFloat(String(p.shares));
          const avgCost = parseFloat(String(p.avg_cost));
          const price = priceMap[p.security] || 0;
          const dc = dailyChangeMap[p.security] || { d: 0, dp: 0 };
          const marketValue = shares * price;
          const costBasis = shares * avgCost;
          const gainLoss = marketValue - costBasis;
          const dailyGainLoss = shares * dc.d;
          totalDailyGainLoss += dailyGainLoss;
          return {
            symbol: p.security,
            shares,
            avgCost,
            currentPrice: price,
            marketValue,
            costBasis,
            gainLoss,
            gainLossPct: costBasis > 0 ? (gainLoss / costBasis) * 100 : 0,
            dailyGainLoss,
            dailyGainLossPct: dc.dp,
          };
        });

      const stockValue = holdings.reduce((s, h) => s + h.marketValue, 0);

      return {
        name: accountName,
        sheetTotal: sheetMap[accountName] || 0,
        uninvestedCash: cash,
        cashUpdatedAt: cashAsOf,
        stockValue,
        totalValue: cash + stockValue,
        holdings,
      };
    });

    const totalPortfolioValue = accountList.reduce((s, a) => s + a.totalValue, 0);

    return NextResponse.json({
      vooPrice: vooQuote.price,
      vooDailyChange: vooQuote.d,
      vooDailyChangePct: vooQuote.dp,
      tslaPrice: tslaQuote.price,
      tslaDailyChange: tslaQuote.d,
      tslaDailyChangePct: tslaQuote.dp,
      accounts: accountList,
      trades: trades || [],
      totalPortfolioValue,
      totalDailyGainLoss,
      lastUpdated: easternStamp(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });

  } catch (err: any) {
    console.error('Investments GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}