import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

async function fetchSheet(accessToken: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error for range "${range}": ${err}`);
  }
  const data = await res.json();
  return data.values as string[][];
}

function parseAmount(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,\s]/g, '').replace(/[()]/g, (m) => m === '(' ? '-' : '');
  return parseFloat(cleaned) || 0;
}

function parseDate(val: string): string | null {
  if (!val) return null;
  // Try MM/DD/YYYY
  const parts = val.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  return null;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const accessToken = session.accessToken;
  const results: Record<string, unknown> = {};

  // ── 1. Sync Transactions ──────────────────────────────────────────────
  try {
    const rows = await fetchSheet(accessToken, 'Transactions!A2:G1000');
    const transactions = rows
      .filter((r) => r[0] && r[1] && r[4]) // need ID, Date, Amount
      .map((r) => ({
        id: r[0]?.trim(),
        user_id: USER_ID,
        date: parseDate(r[1]),
        merchant: r[2]?.trim() || '',
        account: r[3]?.trim() || '',
        amount: parseAmount(r[4]),
        category: r[5]?.trim() || 'Other Exp.',
        month: r[6]?.trim() || '',
        source: 'google_sheets',
      }))
      .filter((t) => t.date !== null);

    if (transactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .upsert(transactions, { onConflict: 'id' });
      if (error) throw error;
    }
    results.transactions = { synced: transactions.length };
  } catch (e: unknown) {
    results.transactions = { error: e instanceof Error ? e.message : String(e) };
  }

  // ── 2. Sync Bills (Recurring tab) ─────────────────────────────────────
  try {
    const rows = await fetchSheet(accessToken, 'Recurring!A2:G100');
    const bills = rows
      .filter((r) => r[0] && r[2]) // need name and amount
      .map((r, idx) => ({
        id: `sheets-bill-${idx}`,
        user_id: USER_ID,
        name: r[0]?.trim(),
        category: r[1]?.trim() || 'Bills',
        amount: parseAmount(r[2]),
        due_day: parseInt(r[3]) || null,
        due_date: parseDate(r[4]),
        payment_account: r[5]?.trim() || '',
        status: r[6]?.trim() || 'active',
        source: 'google_sheets',
      }));

    if (bills.length > 0) {
      // Delete old sheets bills then insert fresh
      await supabase.from('bills').delete().eq('user_id', USER_ID).eq('source', 'google_sheets');
      const { error } = await supabase.from('bills').insert(bills);
      if (error) throw error;
    }
    results.bills = { synced: bills.length };
  } catch (e: unknown) {
    results.bills = { error: e instanceof Error ? e.message : String(e) };
  }

  // ── 3. Sync Net Worth (Accounts tab) ─────────────────────────────────
  try {
    const rows = await fetchSheet(accessToken, 'Accounts!A1:D100');
    // Store the raw snapshot as JSON in a simple key-value table
    const snapshot = {
      user_id: USER_ID,
      synced_at: new Date().toISOString(),
      raw: rows,
    };
    await supabase
      .from('net_worth_snapshots')
      .upsert({ user_id: USER_ID, data: snapshot, updated_at: new Date().toISOString() });
    results.netWorth = { synced: true, rows: rows.length };
  } catch (e: unknown) {
    results.netWorth = { error: e instanceof Error ? e.message : String(e) };
  }

  // ── 4. Sync Cash Flow (Flow tab) ─────────────────────────────────────
  try {
    const rows = await fetchSheet(accessToken, 'Flow!A1:Z100');
    await supabase
      .from('cash_flow_snapshots')
      .upsert({ user_id: USER_ID, data: rows, updated_at: new Date().toISOString() });
    results.cashFlow = { synced: true, rows: rows.length };
  } catch (e: unknown) {
    results.cashFlow = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ success: true, results });
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to sync' });
}