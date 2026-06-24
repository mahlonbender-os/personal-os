import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

async function getFinnhubQuote(symbol: string): Promise<{ c: number; d: number; dp: number } | null> {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [{ data: positions }, { data: cash }] = await Promise.all([
    supabase.from('investment_positions').select('*').eq('user_id', USER_ID),
    supabase.from('investment_cash').select('*').eq('user_id', USER_ID),
  ]);

  // Fetch live prices for all unique securities
  const securities = [...new Set((positions || []).map((p: any) => p.security))];
  const prices: Record<string, { price: number; change: number; changePct: number }> = {};
  await Promise.all(securities.map(async (sym: string) => {
    const q = await getFinnhubQuote(sym);
    if (q && q.c > 0) prices[sym] = { price: q.c, change: q.d, changePct: q.dp };
  }));

  // Compute account totals and daily change
  const accountTotals: Record<string, { value: number; dailyChange: number }> = {};
  let totalValue = 0;
  let totalDailyChange = 0;
  let totalCost = 0;

  for (const pos of (positions || [])) {
    const shares = parseFloat(String(pos.shares));
    const avgCost = parseFloat(String(pos.avg_cost));
    const price = prices[pos.security]?.price ?? avgCost;
    const change = prices[pos.security]?.change ?? 0;
    const mv = shares * price;
    const dailyChange = shares * change;

    if (!accountTotals[pos.account]) accountTotals[pos.account] = { value: 0, dailyChange: 0 };
    accountTotals[pos.account].value += mv;
    accountTotals[pos.account].dailyChange += dailyChange;
    totalValue += mv;
    totalDailyChange += dailyChange;
    totalCost += shares * avgCost;
  }

  for (const c of (cash || [])) {
    const bal = parseFloat(String(c.cash_balance));
    if (!accountTotals[c.account]) accountTotals[c.account] = { value: 0, dailyChange: 0 };
    accountTotals[c.account].value += bal;
    totalValue += bal;
  }

  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const dailyChangePct = totalValue > 0 ? (totalDailyChange / (totalValue - totalDailyChange)) * 100 : 0;

  const accounts = Object.entries(accountTotals).map(([name, data]) => ({
    name,
    value: Math.round(data.value * 100) / 100,
    dailyChange: Math.round(data.dailyChange * 100) / 100,
  })).sort((a, b) => b.value - a.value);

  return NextResponse.json({
    totalValue: Math.round(totalValue * 100) / 100,
    dailyChange: Math.round(totalDailyChange * 100) / 100,
    dailyChangePct: Math.round(dailyChangePct * 100) / 100,
    totalGain: Math.round(totalGain * 100) / 100,
    totalGainPct: Math.round(totalGainPct * 100) / 100,
    accounts,
    hasPrices: Object.keys(prices).length > 0,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}