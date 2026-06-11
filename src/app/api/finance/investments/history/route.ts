import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

async function fetchCandles(symbol: string, from: number, to: number) {
  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (data.s !== 'ok') return null;
    return data as { c: number[]; t: number[]; s: string };
  } catch {
    return null;
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

    const now = Math.floor(Date.now() / 1000);
    const oneYearAgo = now - 366 * 24 * 60 * 60;

    // Fetch candle data + all trades in parallel
    const [vooCandles, tslaCandles, tradesResult] = await Promise.all([
      fetchCandles('VOO', oneYearAgo, now),
      fetchCandles('TSLA', oneYearAgo, now),
      supabase
        .from('investment_transactions')
        .select('date, account, security, action, shares')
        .eq('user_id', USER_ID)
        .order('date', { ascending: true }),
    ]);

    if (!vooCandles && !tslaCandles) {
      return NextResponse.json({ points: [] }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    // Build date → price lookup maps
    const vooMap: Record<string, number> = {};
    const tslaMap: Record<string, number> = {};

    if (vooCandles) {
      vooCandles.t.forEach((ts, i) => {
        const date = new Date(ts * 1000).toISOString().split('T')[0];
        vooMap[date] = vooCandles.c[i];
      });
    }
    if (tslaCandles) {
      tslaCandles.t.forEach((ts, i) => {
        const date = new Date(ts * 1000).toISOString().split('T')[0];
        tslaMap[date] = tslaCandles.c[i];
      });
    }

    // All trading days sorted (union of both symbols)
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

    // Running positions map: "account:security" → shares
    const positions: Record<string, number> = {};
    let tradeIdx = 0;

    const points: { date: string; value: number }[] = [];

    for (const date of allDates) {
      // Apply all trades on or before this date
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

      // Calculate portfolio stock value on this date
      let value = 0;
      for (const [key, shares] of Object.entries(positions)) {
        if (shares <= 0) continue;
        const security = key.split(':')[1];
        let price = 0;
        if (security === 'VOO') price = vooMap[date] || 0;
        else if (security === 'TSLA') price = tslaMap[date] || 0;
        value += shares * price;
      }

      // Only include points where we have both holdings and price data
      if (value > 0) {
        points.push({ date, value });
      }
    }

    return NextResponse.json({ points }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (err: any) {
    console.error('Investments history error:', err);
    return NextResponse.json({ points: [] }, { status: 500 });
  }
}