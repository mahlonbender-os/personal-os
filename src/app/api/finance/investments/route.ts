import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';
const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';

function parseDollar(val: any): number {
  if (!val) return 0;
  return Math.abs(parseFloat(val.toString().replace(/[$,()]/g, '')) || 0);
}

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

// ─── Source-of-truth cash recalculation ──────────────────────────────────────
// contributions (transactions table, category = account name)
// minus BUY/REINVEST trade amounts + SELL trade amounts
async function recalculateCash(supabase: any, account: string): Promise<void> {
  const { data: contribRows } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', USER_ID)
    .eq('category', account);

  const contributions = (contribRows || []).reduce(
    (sum: number, r: any) => sum + parseFloat(String(r.amount)), 0
  );

  const { data: tradeRows } = await supabase
    .from('investment_transactions')
    .select('action, amount')
    .eq('user_id', USER_ID)
    .eq('account', account);

  let tradeNet = 0;
  for (const t of (tradeRows || [])) {
    const amt = parseFloat(String(t.amount));
    if (t.action === 'BUY' || t.action === 'REINVEST') tradeNet -= amt;
    else if (t.action === 'SELL') tradeNet += amt;
  }

  const newBalance = contributions + tradeNet;

  await supabase
    .from('investment_cash')
    .upsert(
      { user_id: USER_ID, account, cash_balance: newBalance, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,account' }
    );
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
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Accounts!B9:E15')}`;
      const sheetsRes = await fetch(sheetsUrl, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: 'no-store',
      });
      if (sheetsRes.ok) {
        const sheetsData = await sheetsRes.json();
        const rows: string[][] = sheetsData.values || [];
        rows.forEach(row => {
          const name = (row[0] || '').toLowerCase().trim();
          const val = parseDollar(row[3]);
          if (name.includes('roth ira')) sheetRoth = val;
          if (name.includes('hsa')) sheetHsa = val;
        });
      }
    } catch {
      // non-fatal
    }

    const { data: cashRows } = await supabase
      .from('investment_cash')
      .select('account, cash_balance')
      .eq('user_id', USER_ID);

    const cashMap: Record<string, number> = {};
    (cashRows || []).forEach(r => {
      cashMap[r.account] = parseFloat(String(r.cash_balance));
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

      const holdings = accountPositions
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
        })
        .filter(h => h.shares > 0);

      const stockValue = holdings.reduce((s, h) => s + h.marketValue, 0);

      return {
        name: accountName,
        sheetTotal: sheetMap[accountName] || 0,
        uninvestedCash: cash,
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
      lastUpdated: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });

  } catch (err: any) {
    console.error('Investments GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { date, account, security, action, amount, shares } = await req.json();
    if (!date || !account || !security || !action || !amount || !shares) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const dollarAmount = parseFloat(amount);
    const shareCount = parseFloat(shares);
    const pricePerShare = dollarAmount / shareCount;

    const { data, error } = await supabase
      .from('investment_transactions')
      .insert({ user_id: USER_ID, date, account, security, action, amount: dollarAmount, shares: shareCount })
      .select()
      .single();

    if (error) throw error;

    const { data: existing } = await supabase
      .from('investment_positions')
      .select('shares, avg_cost')
      .eq('user_id', USER_ID)
      .eq('account', account)
      .eq('security', security)
      .single();

    if (action === 'BUY' || action === 'REINVEST') {
      if (existing) {
        const existingShares = parseFloat(String(existing.shares));
        const existingAvgCost = parseFloat(String(existing.avg_cost));
        const newShares = existingShares + shareCount;
        const newAvgCost = ((existingShares * existingAvgCost) + (shareCount * pricePerShare)) / newShares;
        await supabase
          .from('investment_positions')
          .update({ shares: newShares, avg_cost: newAvgCost, updated_at: new Date().toISOString() })
          .eq('user_id', USER_ID).eq('account', account).eq('security', security);
      } else {
        await supabase
          .from('investment_positions')
          .insert({ user_id: USER_ID, account, security, shares: shareCount, avg_cost: pricePerShare });
      }
    } else if (action === 'SELL' && existing) {
      const newShares = Math.max(0, parseFloat(String(existing.shares)) - shareCount);
      await supabase
        .from('investment_positions')
        .update({ shares: newShares, updated_at: new Date().toISOString() })
        .eq('user_id', USER_ID).eq('account', account).eq('security', security);
    }

    // Recalculate cash from source of truth
    await recalculateCash(supabase, account);

    return NextResponse.json({ success: true, trade: data }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (err: any) {
    console.error('Investments POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: trade } = await supabase
      .from('investment_transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', USER_ID)
      .single();

    if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });

    const { error } = await supabase
      .from('investment_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', USER_ID);

    if (error) throw error;

    // Rebuild position from remaining trades
    const { data: remaining } = await supabase
      .from('investment_transactions')
      .select('action, shares, amount')
      .eq('user_id', USER_ID)
      .eq('account', trade.account)
      .eq('security', trade.security)
      .order('date', { ascending: true });

    let totalShares = 0;
    let totalCost = 0;
    for (const t of (remaining || [])) {
      const s = parseFloat(String(t.shares));
      const a = parseFloat(String(t.amount));
      if (t.action === 'BUY' || t.action === 'REINVEST') {
        totalCost += a;
        totalShares += s;
      } else if (t.action === 'SELL') {
        const pps = totalShares > 0 ? totalCost / totalShares : 0;
        totalCost -= pps * s;
        totalShares = Math.max(0, totalShares - s);
      }
    }

    await supabase
      .from('investment_positions')
      .update({
        shares: totalShares,
        avg_cost: totalShares > 0 ? totalCost / totalShares : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', USER_ID)
      .eq('account', trade.account)
      .eq('security', trade.security);

    // Recalculate cash from source of truth
    await recalculateCash(supabase, trade.account);

    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (err: any) {
    console.error('Investments DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}