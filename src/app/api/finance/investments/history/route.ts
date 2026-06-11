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

async function fetchStooq(symbol: string): Promise<Record<string, number>> {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const url = `https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}.us&d1=${fmtDate(oneYearAgo)}&d2=${fmtDate(now)}&i=d`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://stooq.com/' },
    });
    if (!res.ok) { console.error(`[history] Stooq ${symbol} HTTP ${res.status}`); return {}; }
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) { console.error(`[history] Stooq ${symbol} no lines`); return {}; }
    // Check if it's an HTML error page instead of CSV
    if (lines[0].startsWith('<') || lines[0].startsWith('!')) {
      console.error(`[history] Stooq ${symbol} non-CSV response: ${lines[0].slice(0, 60)}`);
      return {};
    }
    const map: Record<string, number> = {};
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 5) continue;
      const date = parts[0].trim();
      const close = parseFloat(parts[4]);
      if (date && !isNaN(close) && close > 0) map[date] = close;
    }
    console.error(`[history] Stooq ${symbol} OK: ${Object.keys(map).length} days, first=${Object.keys(map).sort()[0]}`);
    return map;
  } catch (err: any) {
    console.error(`[history] Stooq ${symbol} exception: ${err.message}`);
    return {};
  }
}

async function fetchFinnhubCandles(symbol: string): Promise<Record<string, number>> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 366 * 24 * 60 * 60;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${process.env.FINNHUB_API_KEY}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) { console.error(`[history] Finnhub ${symbol} HTTP ${res.status}`); return {}; }
    const data = await res.json();
    if (!data || data.s !== 'ok' || !data.t?.length) {
      console.error(`[history] Finnhub ${symbol} bad response: s=${data?.s}, t_len=${data?.t?.length ?? 'none'}`);
      return {};
    }
    const map: Record<string, number> = {};
    (data.t as number[]).forEach((ts: number, i: number) => {
      const date = new Date(ts * 1000).toISOString().split('T')[0];
      const price = (data.c as number[])[i];
      if (price > 0) map[date] = price;
    });
    console.error(`[history] Finnhub ${symbol} OK: ${Object.keys(map).length} days`);
    return map;
  } catch (err: any) {
    console.error(`[history] Finnhub ${symbol} exception: ${err.message}`);
    return {};
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      console.error('[history] No session - returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('[history] Session OK, fetching prices + trades');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [vooMap, tslaMap, tradesResult] = await Promise.all([
      fetchStooq('VOO'),
      fetchFinnhubCandles('TSLA'),
      supabase
        .from('investment_transactions')
        .select('date, account, security, action, shares')
        .eq('user_id', USER_ID)
        .order('date', { ascending: true }),
    ]);

    const finalTslaMap = Object.keys(tslaMap).length > 0 ? tslaMap : await fetchStooq('TSLA');

    const tradeCount = (tradesResult.data || []).length;
    console.error(`[history] voo=${Object.keys(vooMap).length} tsla=${Object.keys(finalTslaMap).length} trades=${tradeCount}`);

    if (Object.keys(vooMap).length === 0 && Object.keys(finalTslaMap).length === 0) {
      console.error('[history] No price data from any source - returning empty');
      return NextResponse.json({ points: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const allDates = Array.from(
      new Set([...Object.keys(vooMap), ...Object.keys(finalTslaMap)])
    ).sort();

    const trades = (tradesResult.data || []) as {
      date: string; account: string; security: string; action: string; shares: string | number;
    }[];

    const positions: Record<string, number> = {};
    let tradeIdx = 0;
    const points: { date: string; value: number }[] = [];

    for (const date of allDates) {
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
      let value = 0;
      for (const [key, shares] of Object.entries(positions)) {
        if (shares <= 0) continue;
        const security = key.split(':')[1];
        const price = security === 'VOO' ? (vooMap[date] || 0) :
                      security === 'TSLA' ? (finalTslaMap[date] || 0) : 0;
        value += shares * price;
      }
      if (value > 0) points.push({ date, value });
    }

    console.error(`[history] Returning ${points.length} points`);

    return NextResponse.json({ points }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });

  } catch (err: any) {
    console.error(`[history] Caught exception: ${err.message}`);
    return NextResponse.json({ points: [] }, { status: 500 });
  }
}