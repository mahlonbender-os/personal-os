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
    throw new Error(`Sheets API error for "${range}": ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.values || []) as string[][];
}

function parseAmount(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,\s]/g, '')) || 0;
}

function parseDate(val: string): string | null {
  if (!val) return null;
  const parts = val.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  return null;
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ success: false, message: 'ERROR: Not authenticated — sign out and back in' });
    }

    const accessToken = session.accessToken;
    let txSynced = 0;
    let billsSynced = 0;
    const errors: string[] = [];

    // ── 1. Transactions ────────────────────────────────────────────────
    try {
      const rows = await fetchSheet(accessToken, 'Transactions!A2:G1000');
      const transactions = rows
        .filter((r) => r[0] && r[2] && r[4])
        .map((r) => {
          const account = r[3]?.trim() || '';
          const rawCategory = r[5]?.trim() || 'Transfer';
          const category = ['401K', 'HSA', 'Roth IRA'].includes(account) ? account : rawCategory;
          const date = parseDate(r[1]);
          const month = date ? date.substring(0, 7) : null; // ← THE FIX: derive YYYY-MM from date
          return {
            id: r[0].trim(),
            user_id: USER_ID,
            date,
            merchant: r[2]?.trim() || '',
            account,
            amount: parseAmount(r[4]),
            category,
            month,
            source: 'google_sheets',
          };
        })
        .filter((t) => t.date !== null);

      if (transactions.length > 0) {
        await supabase
          .from('transactions')
          .delete()
          .eq('user_id', USER_ID)
          .eq('source', 'google_sheets');
        const { error } = await supabase
          .from('transactions')
          .insert(transactions);
        if (error) throw new Error(error.message);
        txSynced = transactions.length;
      }
    } catch (e: unknown) {
      errors.push(`Transactions: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 2. Bills (Recurring tab) ───────────────────────────────────────
    try {
      const rows = await fetchSheet(accessToken, 'Recurring!A2:G100');
      const bills = rows
        .filter((r) => r[0] && r[2])
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
        await supabase.from('bills').delete().eq('user_id', USER_ID).eq('source', 'google_sheets');
        const { error } = await supabase.from('bills').insert(bills);
        if (error) throw new Error(error.message);
        billsSynced = bills.length;
      }
    } catch (e: unknown) {
      errors.push(`Bills: ${e instanceof Error ? e.message : String(e)}`);
    }

    const message = errors.length > 0
      ? `⚠ ${txSynced} transactions, ${billsSynced} bills synced. Errors: ${errors.join(' | ')}`
      : `✓ ${txSynced} transactions, ${billsSynced} bills synced`;

    return NextResponse.json({ success: errors.length === 0, message });

  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: `EXCEPTION: ${e instanceof Error ? e.message : String(e)}` });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to sync' });
}