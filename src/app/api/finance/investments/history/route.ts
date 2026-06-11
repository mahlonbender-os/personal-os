import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

// Fetch 1-year daily price history from Yahoo Finance (no API key needed)
async function fetchYahooHistory(symbol: string): Promise<Record<string, number>> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      console.error(`Yahoo Finance ${symbol}: HTTP ${res.status}`);
      return {};
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      console.error(`Yahoo Finance ${symbol}: no result in response`);
      return {};
    }

    const timestamps: number[] = result.timestamp || [];
    // Prefer adjusted close for accuracy (accounts for splits/dividends)
    const closes: (number | null)[] =
      result.indicators?.adjclose?.[0]?.adjclose ||
      result.indicators?.quote?.[0]?.close ||
      [];

    const map: Record<string, number> = {};
    timestamps.forEach((ts, i) => {
      const price = closes[i];
      if (price != null && price > 0) {
        const date = new Date(ts * 1000).toISOString().split('T')[0];
        map[date] = price;
      }
    });

    console.log(`Yahoo Finance ${symbol}: ${Object.keys(map).length} trading days`);
    return map;
  } catch (err) {
    console.error(`Yahoo Finance fetch error for ${symbol}:`, err);
    return {};
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch price history + all trades in parallel
    const [vooMap, tslaMap, tradesResult] = await Promise.all([
      fetchYahooHistory('VOO'),
      fetchYahooHistory('TSLA'),
      supabase
        .from('investment_transactions')
        .select('date, account, security, action, shares')
        .eq('user_id', USER_ID)
        .order('date', { ascending: true }),
    ]);

    if (Object.keys(vooMap).length === 0 && Object.keys(tslaMap).length === 0) {
      console.error('No price history data returned from Yahoo Finance');
      return NextResponse.json({ points: [] }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    // All trading days — union of both tickers, sorted ascending
    const allDates = Array.from(
      new Set([...Object.keys(vooMap), ...Object.keys(tslaMap)])
    ).sort();

    const trades = (tradesResult.data || []) as {
      date: string;
      account: string;
      security: string;
      action: string;
      shares: string | number;
    }[];

    console.log(`Processing ${trades.length} trades across ${allDates.length} trading days`);

    // Running positions: "account:security" → shares held
    const positions: Record<string, number> = {};
    let tradeIdx = 0;
    const points: { date: string; value: number }[] = [];

    for (const date of allDates) {
      // Apply every trade whose date is on or before this trading day
      while (tradeIdx < trades.length && trades[tradeIdx].date <= date) {
        const t = trades[tradeIdx];
        const key = `${t.account}:${t.security}`;
        const s = parseFloat(String(t.shares));
        if (t.action === 'BUY' || t.action === 'REINVEST') {
          positions[key] = (positions[key] || 0) + s;
        } else if (t.action === 'SELL') {
          positions[key] = Math.max(0, (positions[key] || 0) - s);
        }
        tradeIdx++;
      }

      // Sum portfolio stock value for this date
      let value = 0;
      for (const [key, shares] of Object.entries(positions)) {
        if (shares <= 0) continue;
        const security = key.split(':')[1];
        const price =
          security === 'VOO' ? (vooMap[date] || 0) :
          security === 'TSLA' ? (tslaMap[date] || 0) : 0;
        value += shares * price;
      }

      if (value > 0) {
        points.push({ date, value });
      }
    }

    console.log(`History route: returning ${points.length} points`);

    return NextResponse.json({ points }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (err: any) {
    console.error('Investments history error:', err);
    return NextResponse.json({ points: [] }, { status: 500 });
  }
}