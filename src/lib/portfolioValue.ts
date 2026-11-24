import { num, serviceClient } from '@/lib/financeRead';
import { FINANCE_USER_ID } from '@/lib/financeSheet';

export type PriceSource = 'quote' | 'avg_cost';

export interface PortfolioQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  source: PriceSource;
}

export interface ValuedHolding {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  priceSource: PriceSource;
  marketValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPct: number;
  dailyGainLoss: number;
  dailyGainLossPct: number;
}

export interface ValuedAccount {
  name: string;
  uninvestedCash: number;
  cashUpdatedAt: string | null;
  stockValue: number;
  totalValue: number;
  dailyGainLoss: number;
  holdings: ValuedHolding[];
}

export interface PortfolioValuation {
  accounts: ValuedAccount[];
  quotes: PortfolioQuote[];
  totalPortfolioValue: number;
  totalDailyGainLoss: number;
  totalGain: number;
  totalGainPct: number;
  dailyChangePct: number;
  hasLiveQuotes: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function fetchQuote(symbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token || !symbol) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(String(data?.c ?? ''));
    if (!Number.isFinite(price) || price <= 0) return null;
    const change = parseFloat(String(data?.d ?? '0'));
    const changePct = parseFloat(String(data?.dp ?? '0'));
    return {
      price,
      change: Number.isFinite(change) ? change : 0,
      changePct: Number.isFinite(changePct) ? changePct : 0,
    };
  } catch {
    return null;
  }
}

export async function valuePortfolio(): Promise<PortfolioValuation> {
  const supabase = serviceClient();
  const [{ data: positionRows, error: positionError }, { data: cashRows, error: cashError }] = await Promise.all([
    supabase
      .from('investment_positions')
      .select('account, security, shares, avg_cost')
      .eq('user_id', FINANCE_USER_ID),
    supabase
      .from('investment_cash')
      .select('account, cash_balance, updated_at')
      .eq('user_id', FINANCE_USER_ID),
  ]);
  if (positionError) throw new Error(positionError.message);
  if (cashError) throw new Error(cashError.message);

  const open = (positionRows || []).filter((row) => num(row.shares) > 0);
  const symbols = Array.from(new Set(open.map((row) => String(row.security || '').trim()).filter(Boolean)));
  const live = new Map<string, { price: number; change: number; changePct: number }>();
  await Promise.all(symbols.map(async (symbol) => {
    const quote = await fetchQuote(symbol);
    if (quote) live.set(symbol, quote);
  }));

  const byAccount = new Map<string, typeof open>();
  for (const row of open) {
    const name = String(row.account || 'Account');
    const list = byAccount.get(name) || [];
    list.push(row);
    byAccount.set(name, list);
  }
  for (const row of cashRows || []) {
    const name = String(row.account || 'Account');
    if (!byAccount.has(name)) byAccount.set(name, []);
  }

  const quotes: PortfolioQuote[] = symbols.map((symbol) => {
    const quote = live.get(symbol);
    if (quote) {
      return { symbol, price: quote.price, change: quote.change, changePct: quote.changePct, source: 'quote' };
    }
    const lots = open.filter((row) => String(row.security) === symbol);
    const shares = lots.reduce((sum, row) => sum + num(row.shares), 0);
    const cost = lots.reduce((sum, row) => sum + num(row.shares) * num(row.avg_cost), 0);
    return {
      symbol,
      price: shares > 0 ? cost / shares : 0,
      change: 0,
      changePct: 0,
      source: 'avg_cost',
    };
  });

  let totalValue = 0;
  let totalDaily = 0;
  let totalCost = 0;

  const accounts: ValuedAccount[] = Array.from(byAccount.entries()).map(([name, rows]) => {
    const cashRow = (cashRows || []).find((row) => row.account === name);
    const cash = cashRow ? num(cashRow.cash_balance) : 0;
    const holdings: ValuedHolding[] = rows.map((row) => {
      const shares = num(row.shares);
      const avgCost = num(row.avg_cost);
      const symbol = String(row.security || '');
      const quote = live.get(symbol);
      const priceSource: PriceSource = quote ? 'quote' : 'avg_cost';
      const price = quote ? quote.price : avgCost;
      const marketValue = shares * price;
      const costBasis = shares * avgCost;
      const gainLoss = marketValue - costBasis;
      return {
        symbol,
        shares,
        avgCost,
        currentPrice: price,
        priceSource,
        marketValue,
        costBasis,
        gainLoss,
        gainLossPct: costBasis > 0 ? (gainLoss / costBasis) * 100 : 0,
        dailyGainLoss: quote ? shares * quote.change : 0,
        dailyGainLossPct: quote ? quote.changePct : 0,
      };
    });
    const stockValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
    const dailyGainLoss = holdings.reduce((sum, holding) => sum + holding.dailyGainLoss, 0);
    totalValue += cash + stockValue;
    totalDaily += dailyGainLoss;
    totalCost += holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
    return {
      name,
      uninvestedCash: cash,
      cashUpdatedAt: cashRow?.updated_at ?? null,
      stockValue,
      totalValue: cash + stockValue,
      dailyGainLoss,
      holdings,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  const stockValue = accounts.reduce((sum, account) => sum + account.stockValue, 0);
  const totalGain = stockValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const prior = totalValue - totalDaily;
  const dailyChangePct = prior > 0 ? (totalDaily / prior) * 100 : 0;

  return {
    accounts,
    quotes,
    totalPortfolioValue: round2(totalValue),
    totalDailyGainLoss: round2(totalDaily),
    totalGain: round2(totalGain),
    totalGainPct: round2(totalGainPct),
    dailyChangePct: round2(dailyChangePct),
    hasLiveQuotes: live.size > 0,
  };
}
