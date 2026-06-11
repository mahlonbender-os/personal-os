import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Fetch 1-year daily close prices from Stooq (free, no API key, no rate limits)
async function fetchStooqHistory(symbol: string): Promise<Record<string, number>> {
  try {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Stooq format: lowercase ticker + .us suffix
    const ticker = symbol.toLowerCase() + '.us';
    const url = `https://stooq.com/q/d/l/?s=${ticker}&d1=${fmtDate(oneYearAgo)}&d2=${fmtDate(now)}&i=d`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`Stooq ${symbol}: HTTP ${res.status}`);
      return {};
    }

    const text = await res.text();
    const lines = text.trim().split('\n');

    if (lines.length < 2) {
      console.error(`Stooq ${symbol}: no data returned`);
      return {};
    }

    // CSV format: Date,Open,High,Low,Close,Volume
    // Header is line 0, data starts at line 1
    const map: Record<string, number> = {};
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 5) continue;
      const date = parts[0].trim(); // YYYY-MM-DD
      const close = parseFloat(parts[4]);
      if (date && !isNaN(close) && close > 0) {
        map[date] = close;
      }
    }

    console.log(`Stooq ${symbol}: ${Object.keys(map).length} trading days loaded`);
    return map;
  } catch (err) {
    console.error(`Stooq fetch error for ${symbol}:`, err);
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
      fetchStooqHistory('VOO'),
      fetchStooqHistory('TSLA'),
      supabase
        .from('investment_transactions')
        .select('date, account, security, action, shares')
        .eq('user_id', USER_ID)
        .order('date', { ascending: true }),
    ]);

    if (Object.keys(vooMap).length === 0 && Object.keys(tslaMap).length === 0) {
      console.error('Stooq returned no price data for VOO or TSLA');
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
      // Apply every trade on or before this trading day
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

    console.log(`History: returning ${points.length} points`);

    return NextResponse.json({ points }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (err: any) {
    console.error('Investments history error:', err);
    return NextResponse.json({ points: [] }, { status: 500 });
  }
}