import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  FINANCE_SHEET_SOURCE,
  FINANCE_USER_ID,
  FinanceWorkbook,
  SheetTransaction,
  easternToday,
  loadFinanceWorkbook,
  mahlonTransactions,
} from '@/lib/financeSheet';

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function num(value: unknown): number {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

export async function readWorkbook(accessToken?: string | null, fresh = false): Promise<FinanceWorkbook | null> {
  if (!accessToken) return null;
  try {
    return await loadFinanceWorkbook(accessToken, { fresh });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sheet read failed';
    console.error(`[finance] sheet_read_failed ${message}`);
    return null;
  }
}

function snapshotTxn(row: {
  id: string;
  date: string;
  merchant: string | null;
  account: string | null;
  amount: unknown;
  category: string | null;
  month: string | null;
}): SheetTransaction {
  const date = String(row.date || '').slice(0, 10);
  return {
    id: row.id,
    date,
    merchant: row.merchant || '',
    account: row.account || '',
    amount: num(row.amount),
    category: row.category || '',
    month: row.month || date.slice(0, 7),
    owner: '',
    type: '',
    origin: '',
    status: '',
    notes: '',
    source: FINANCE_SHEET_SOURCE,
  };
}

async function snapshotTransactions(): Promise<SheetTransaction[]> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, merchant, account, amount, category, month')
    .eq('user_id', FINANCE_USER_ID)
    .eq('source', FINANCE_SHEET_SOURCE)
    .order('date', { ascending: false });
  if (error) {
    console.error(`[finance] snapshot_tx_failed ${error.message}`);
    return [];
  }
  return (data || []).map(snapshotTxn);
}

/** Sheet rows when Google is reachable, otherwise the last finance_sheet snapshot. Never the abandoned sheet. */
export async function readTransactions(accessToken?: string | null, fresh = false): Promise<SheetTransaction[]> {
  const book = await readWorkbook(accessToken, fresh);
  if (book) return book.transactions;
  return snapshotTransactions();
}

export interface HistoryPoint {
  date: string;
  net_worth: number;
  assets: number;
  liabilities: number;
  mahlon_net_worth: number;
}

export async function readNetWorthHistory(book: FinanceWorkbook | null): Promise<{
  history: HistoryPoint[];
  source: 'daily' | 'balances';
}> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('net_worth_daily')
    .select('snapshot_date, total_assets, total_liabilities, net_worth, mahlon_net_worth, balances')
    .eq('user_id', FINANCE_USER_ID)
    .order('snapshot_date', { ascending: true });

  if (!error && data && data.length > 0) {
    const history = data.map((row) => {
      const balances = row.balances && typeof row.balances === 'object'
        ? row.balances as Record<string, unknown>
        : {};
      const netWorth = num(row.net_worth);
      const bjs = num(balances["Capital One BJ's"] ?? balances['Capital One BJ’s']);
      const bree = num(balances['Bree HELOC Share']);
      const mahlon = row.mahlon_net_worth == null || row.mahlon_net_worth === ''
        ? netWorth + bjs + bree
        : num(row.mahlon_net_worth);
      return {
        date: String(row.snapshot_date).slice(0, 10),
        net_worth: netWorth,
        assets: num(row.total_assets),
        liabilities: num(row.total_liabilities),
        mahlon_net_worth: mahlon,
      };
    }).filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date));
    if (history.length > 0) return { history, source: 'daily' };
  }

  const snaps = book?.balances || [];
  return {
    source: 'balances',
    history: snaps.map((snap) => ({
      date: snap.date,
      net_worth: snap.netWorth,
      assets: snap.totalAssets,
      liabilities: snap.totalLiabilities,
      mahlon_net_worth: snap.mahlonNetWorth,
    })),
  };
}

export function billPayload(bill: FinanceWorkbook['bills'][number]) {
  return {
    id: bill.id,
    name: bill.name,
    category: bill.category,
    amount: bill.amount,
    due_day: bill.dueDay,
    due_date: bill.dueDate,
    payment_account: bill.paidFrom,
    status: 'Upcoming',
    amount_type: bill.amountType,
    owner: bill.owner,
    notes: bill.notes,
    autopay: bill.autopay,
    fund_from_heloc: bill.fundFromHeloc,
  };
}

export function upcomingBills(book: FinanceWorkbook, today = easternToday()) {
  return book.bills
    .filter((bill) => bill.active && (!bill.dueDate || bill.dueDate >= addDays(today, -1)))
    .map((bill) => billPayload(bill))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export { mahlonTransactions };
