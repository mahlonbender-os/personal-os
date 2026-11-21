import {
  FINANCE_SHEET_SOURCE,
  FINANCE_USER_ID,
  SheetBill,
  SheetTransaction,
  clearFinanceSheetCache,
  easternToday,
  loadFinanceWorkbook,
  nextDueDate,
} from '@/lib/financeSheet';
import { serviceClient } from '@/lib/financeRead';

export interface SyncResult {
  success: boolean;
  transactionsInserted?: number;
  billsInserted?: number;
  billsError?: string;
  error?: string;
}

// Re-reads the Finance sheet and replaces only the rows this sync owns.
// Never writes to Google. Never deletes the abandoned google_sheets rows or
// anything logged by hand. Those stay put until the archive migration runs.
export async function performSheetsSync(accessToken: string): Promise<SyncResult> {
  const supabase = serviceClient();
  clearFinanceSheetCache();

  let book;
  try {
    book = await loadFinanceWorkbook(accessToken, { fresh: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Finance sheet read failed';
    console.error(`[sync/sheets] read_failed ${message}`);
    return { success: false, error: message };
  }

  const today = easternToday();
  const txResult = await replaceTransactions(supabase, book.transactions);
  if (!txResult.ok) return { success: false, error: txResult.error };

  const billResult = await replaceBills(supabase, book.bills.filter((bill) => bill.active), today);
  console.error(
    `[sync/sheets] finance_sheet tx=${txResult.count} bills=${billResult.count} as_of=${book.latestBalance?.date || 'none'}`
  );

  return {
    success: true,
    transactionsInserted: txResult.count,
    billsInserted: billResult.count,
    billsError: billResult.error,
  };
}

async function replaceTransactions(
  supabase: ReturnType<typeof serviceClient>,
  rows: SheetTransaction[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const { error: deleteErr } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', FINANCE_USER_ID)
    .eq('source', FINANCE_SHEET_SOURCE);
  if (deleteErr) {
    console.error(`[sync/sheets] tx_delete_error=${deleteErr.message}`);
    return { ok: false, count: 0, error: deleteErr.message };
  }

  const payload = rows.map((row) => ({
    id: row.id,
    date: row.date,
    merchant: row.merchant,
    account: row.account,
    amount: row.amount,
    category: row.category,
    month: row.month,
    source: FINANCE_SHEET_SOURCE,
    user_id: FINANCE_USER_ID,
  }));

  let inserted = 0;
  for (let i = 0; i < payload.length; i += 200) {
    const batch = payload.slice(i, i + 200);
    const { error } = await supabase.from('transactions').insert(batch);
    if (error) {
      console.error(`[sync/sheets] tx_insert_error batch=${i} msg=${error.message}`);
      return { ok: false, count: inserted, error: error.message };
    }
    inserted += batch.length;
  }
  return { ok: true, count: inserted };
}

async function replaceBills(
  supabase: ReturnType<typeof serviceClient>,
  rows: SheetBill[],
  today: string
): Promise<{ count: number; error?: string }> {
  const { error: deleteErr } = await supabase
    .from('bills')
    .delete()
    .eq('user_id', FINANCE_USER_ID)
    .eq('source', FINANCE_SHEET_SOURCE);
  if (deleteErr) {
    console.error(`[sync/sheets] bill_delete_error=${deleteErr.message}`);
    return { count: 0, error: deleteErr.message };
  }

  const payload = rows.map((bill) => ({
    id: bill.id,
    name: bill.name,
    category: bill.category,
    amount: bill.amount,
    due_day: bill.dueDay,
    due_date: bill.dueDay ? nextDueDate(bill.dueDay, today) : null,
    payment_account: bill.paidFrom,
    status: 'Upcoming',
    source: FINANCE_SHEET_SOURCE,
    user_id: FINANCE_USER_ID,
  }));

  let inserted = 0;
  for (let i = 0; i < payload.length; i += 200) {
    const batch = payload.slice(i, i + 200);
    const { error } = await supabase.from('bills').insert(batch);
    if (error) {
      console.error(`[sync/sheets] bill_insert_error batch=${i} msg=${error.message}`);
      return { count: inserted, error: error.message };
    }
    inserted += batch.length;
  }
  return { count: inserted };
}
