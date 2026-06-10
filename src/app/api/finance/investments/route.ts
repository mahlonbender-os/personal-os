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
    return data.c || 0; // 'c' = current price in Finnhub
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

    // 1. Live prices from Finnhub
    const [vooPrice, tslaPrice] = await Promise.all([
      fetchPrice('VOO'),
      fetchPrice('TSLA'),
    ]);

    // 2. Account totals from Google Sheets (assets rows B9:E15)
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Accounts!B9:E15')}`;
    const sheetsRes = await fetch(sheetsUrl, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (!sheetsRes.ok) throw new Error('Sheets fetch failed');
    const sheetsData = await sheetsRes.json();
    const rows: string[][] = sheetsData.values || [];

    let sheetRoth = 0;
    let sheetHsa = 0;
    rows.forEach(row => {
      const name = (row[0] || '').toLowerCase().trim();
      const val = parseDollar(row[3]);
      if (name.includes('roth ira')) sheetRoth = val;
      if (name.includes('hsa')) sheetHsa = val;
    });

    // 3. Contributions from transactions table (money that flowed INTO these accounts)
    const { data: contributions } = await supabase
      .from('transactions')
      .select('category, amount')
      .in('category', ['Roth IRA', 'HSA']);

    let contribRoth = 0;
    let contribHsa = 0;
    (contributions || []).forEach(tx => {
      const amt = Math.abs(parseFloat(String(tx.amount)));
      if (tx.category === 'Roth IRA') contribRoth += amt;
      if (tx.category === 'HSA') contribHsa += amt;
    });

    // 4. Logged trades from investment_transactions
    const { data: trades } = await supabase
      .from('investment_transactions')
      .select('*')
      .eq('user_id', USER_ID)
      .order('date', { ascending: false });

    // 5. Build account summaries
    const accounts: Record<string, {
      name: string;
      sheetTotal: number;
      contribTotal: number;
      uninvestedCash: number;
      shares: Record<string, number>;
      spent: Record<string, number>;
    }> = {
      'Roth IRA': { name: 'Roth IRA', sheetTotal: sheetRoth, contribTotal: contribRoth, uninvestedCash: contribRoth, shares: { VOO: 0, TSLA: 0 }, spent: { VOO: 0, TSLA: 0 } },
      'HSA':      { name: 'HSA',      sheetTotal: sheetHsa,  contribTotal: contribHsa,  uninvestedCash: contribHsa,  shares: { VOO: 0, TSLA: 0 }, spent: { VOO: 0, TSLA: 0 } },
    };

    (trades || []).forEach(tx => {
      const acc = accounts[tx.account];
      if (!acc) return;
      const shares = parseFloat(String(tx.shares));
      const amount = parseFloat(String(tx.amount));
      if (tx.action === 'BUY') {
        acc.shares[tx.security] = (acc.shares[tx.security] || 0) + shares;
        acc.spent[tx.security] = (acc.spent[tx.security] || 0) + amount;
        acc.uninvestedCash -= amount;
      } else if (tx.action === 'SELL') {
        acc.shares[tx.security] = (acc.shares[tx.security] || 0) - shares;
        acc.spent[tx.security] = (acc.spent[tx.security] || 0) - amount;
        acc.uninvestedCash += amount;
      }
    });

    const priceMap: Record<string, number> = { VOO: vooPrice, TSLA: tslaPrice };

    const accountList = Object.values(accounts).map(acc => {
      const holdings = Object.entries(acc.shares)
        .map(([symbol, shares]) => ({
          symbol,
          shares,
          currentPrice: priceMap[symbol] || 0,
          marketValue: shares * (priceMap[symbol] || 0),
          costBasis: acc.spent[symbol] || 0,
          gainLoss: (shares * (priceMap[symbol] || 0)) - (acc.spent[symbol] || 0),
        }))
        .filter(h => h.shares > 0);

      const stockValue = holdings.reduce((s, h) => s + h.marketValue, 0);
      const cash = Math.max(0, acc.uninvestedCash);

      return {
        name: acc.name,
        sheetTotal: acc.sheetTotal,
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

    const { data, error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: USER_ID,
        date,
        account,
        security,
        action,
        amount: parseFloat(amount),
        shares: parseFloat(shares),
      })
      .select()
      .single();

    if (error) throw error;
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

    const { error } = await supabase
      .from('investment_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', USER_ID);

    if (error) throw error;
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}