import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch current live prices (Finnhub quote — already proven to work)
    // and all trades in parallel
    const [vooRes, tslaRes, tradesResult] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=VOO&token=${process.env.FINNHUB_API_KEY}`, { cache: 'no-store' }),
      fetch(`https://finnhub.io/api/v1/quote?symbol=TSLA&token=${process.env.FINNHUB_API_KEY}`, { cache: 'no-store' }),
      supabase
        .from('investment_transactions')
        .select('date, account, security, action, shares')
        .eq('user_id', USER_ID)
        .order('date', { ascending: true }),
    ]);

    const vooQuote = await vooRes.json();
    const tslaQuote = await tslaRes.json();

    const priceMap: Record<string, number> = {
      VOO: vooQuote.c || 0,
      TSLA: tslaQuote.c || 0,
    };

    const trades = (tradesResult.data || []) as {
      date: string; account: string; security: string; action: string; shares: string | number;
    }[];

    if (trades.length === 0 || (priceMap.VOO === 0 && priceMap.TSLA === 0)) {
      return NextResponse.json({ points: [] }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    // Build cumulative positions as of each trade date.
    // Apply today's prices to all past dates — shows position growth over time.
    const positions: Record<string, number> = {};
    const points: { date: string; value: number }[] = [];
    const seenDates = new Set<string>();

    for (const t of trades) {
      const key = `${t.account}:${t.security}`;
      const s = parseFloat(String(t.shares));
      if (t.action === 'BUY' || t.action === 'REINVEST') {
        positions[key] = (positions[key] || 0) + s;
      } else if (t.action === 'SELL') {
        positions[key] = Math.max(0, (positions[key] || 0) - s);
      }

      // One point per unique trade date (after applying this trade)
      if (!seenDates.has(t.date)) {
        seenDates.add(t.date);
        let value = 0;
        for (const [k, shares] of Object.entries(positions)) {
          const sec = k.split(':')[1];
          value += shares * (priceMap[sec] || 0);
        }
        if (value > 0) points.push({ date: t.date, value });
      }
    }

    // Final point = today with current portfolio value
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
    if (!seenDates.has(today)) {
      let finalValue = 0;
      for (const [k, shares] of Object.entries(positions)) {
        const sec = k.split(':')[1];
        finalValue += shares * (priceMap[sec] || 0);
      }
      if (finalValue > 0) points.push({ date: today, value: finalValue });
    }

    return NextResponse.json({ points }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (err: any) {
    console.error('History route error:', err.message);
    return NextResponse.json({ points: [] }, { status: 500 });
  }
}