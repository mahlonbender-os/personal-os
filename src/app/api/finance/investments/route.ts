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

async function fetchPrice(symbol: string): Promise<number> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
    );
    const data = await res.json();
    return data.c || 0;
  } catch {
    return 0;
  }
}

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

    // 1. Live prices
    const [vooPrice, tslaPrice] = await Promise.all([
      fetchPrice('VOO'),
      fetchPrice('TSLA'),
    ]);

    const priceMap: Record<string, number> = { VOO: vooPrice, TSLA: tslaPrice };

    // 2. Sheet totals — non-fatal if fails
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
      // non-fatal — sheet totals are display context only
    }

    // 3. Cash balances
    const { data: cashRows } = await supabase
      .from('investment_cash')
      .select('account, cash_balance')
      .eq('user_id', USER_ID);

    const cashMap: Record<string, number> = {};
    (cashRows || []).forEach(r => {
      cashMap[r.account] = parseFloat(String(r.cash_balance));
    });

    // 4. Positions — source of truth for shares + avg cost
    const { data: positionRows } = await supabase
      .from('investment_positions')
      .select('account, security, shares, avg_cost')
      .eq('user_id', USER_ID);

    // 5. Trade log — for history tab only
    const { data: trades } = await supabase
      .from('investment_transactions')
      .select('*')
      .eq('user_id', USER_ID)
      .order('date', { ascending: false });

    // 6. Build account summaries from positions
    const accountNames = ['Roth IRA', 'HSA'];
    const sheetMap: Record<string, number> = { 'Roth IRA': sheetRoth, 'HSA': sheetHsa };

    const accountList = accountNames.map(accountName => {
      const accountPositions = (positionRows || []).filter(p => p.account === accountName);
      const cash = cashMap[accountName] ?? 0;

      const holdings = accountPositions
        .map(p => {
          const shares = parseFloat(String(p.shares));
          const avgCost = parseFloat(String(p.avg_cost));
          const price = priceMap[p.security] || 0;
          const marketValue = shares * price;
          const costBasis = shares * avgCost;
          const gainLoss = marketValue - costBasis;
          return {
            symbol: p.security,
            shares,
            avgCost,
            currentPrice: price,
            marketValue,
            costBasis,
            gainLoss,
            gainLossPct: costBasis > 0 ? (gainLoss / costBasis) * 100 : 0,
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
      vooPrice,
      tslaPrice,
      accounts: accountList,
      trades: trades || [],
      totalPortfolioValue,
      lastUpdated: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (err: any) {
    console.error('Investments GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

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

    // Insert trade log record
    const { data, error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: USER_ID,
        date,
        account,
        security,
        action,
        amount: dollarAmount,
        shares: shareCount,
      })
      .select()
      .single();

    if (error) throw error;

    // Update position: shares and avg cost
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
          .eq('user_id', USER_ID)
          .eq('account', account)
          .eq('security', security);
      } else {
        await supabase
          .from('investment_positions')
          .insert({ user_id: USER_ID, account, security, shares: shareCount, avg_cost: pricePerShare });
      }
    } else if (action === 'SELL' && existing) {
      const existingShares = parseFloat(String(existing.shares));
      const newShares = Math.max(0, existingShares - shareCount);
      await supabase
        .from('investment_positions')
        .update({ shares: newShares, updated_at: new Date().toISOString() })
        .eq('user_id', USER_ID)
        .eq('account', account)
        .eq('security', security);
    }

    // Update cash balance
    const delta = (action === 'BUY' || action === 'REINVEST') ? -dollarAmount : dollarAmount;
    const { data: cashRow } = await supabase
      .from('investment_cash')
      .select('cash_balance')
      .eq('account', account)
      .eq('user_id', USER_ID)
      .single();

    if (cashRow) {
      const newBalance = parseFloat(String(cashRow.cash_balance)) + delta;
      await supabase
        .from('investment_cash')
        .update({ cash_balance: Math.max(0, newBalance), updated_at: new Date().toISOString() })
        .eq('account', account)
        .eq('user_id', USER_ID);
    }

    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get trade before deleting to reverse its effects
    const { data: trade } = await supabase
      .from('investment_transactions')
      .select('account, action, amount, shares, security')
      .eq('id', id)
      .eq('user_id', USER_ID)
      .single();

    const { error } = await supabase
      .from('investment_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', USER_ID);

    if (error) throw error;

    if (trade) {
      const tradeShares = parseFloat(String(trade.shares));
      const tradeAmount = parseFloat(String(trade.amount));

      // Reverse position
      const { data: pos } = await supabase
        .from('investment_positions')
        .select('shares, avg_cost')
        .eq('user_id', USER_ID)
        .eq('account', trade.account)
        .eq('security', trade.security)
        .single();

      if (pos) {
        const currentShares = parseFloat(String(pos.shares));
        const newShares = (trade.action === 'BUY' || trade.action === 'REINVEST')
          ? Math.max(0, currentShares - tradeShares)
          : currentShares + tradeShares;
        await supabase
          .from('investment_positions')
          .update({ shares: newShares, updated_at: new Date().toISOString() })
          .eq('user_id', USER_ID)
          .eq('account', trade.account)
          .eq('security', trade.security);
      }

      // Reverse cash
      const cashDelta = (trade.action === 'BUY' || trade.action === 'REINVEST')
        ? tradeAmount
        : -tradeAmount;

      const { data: cashRow } = await supabase
        .from('investment_cash')
        .select('cash_balance')
        .eq('account', trade.account)
        .eq('user_id', USER_ID)
        .single();

      if (cashRow) {
        const newBalance = parseFloat(String(cashRow.cash_balance)) + cashDelta;
        await supabase
          .from('investment_cash')
          .update({ cash_balance: Math.max(0, newBalance), updated_at: new Date().toISOString() })
          .eq('account', trade.account)
          .eq('user_id', USER_ID);
      }
    }

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}