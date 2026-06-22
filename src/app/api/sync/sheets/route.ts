import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

// Maps category name → investment_cash account name
const INVESTMENT_CATEGORIES: Record<string, string> = {
  'Roth IRA': 'Roth IRA',
  'HSA': 'HSA',
};

// Converts M/D/YYYY (from Google Sheets) → YYYY-MM-DD (Postgres DATE format)
function sheetDateToISO(raw: string): string {
  if (!raw) return '';
  const parts = raw.toString().trim().split('/');
  if (parts.length !== 3) return raw;
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Sum all positive-amount transactions for Roth IRA and HSA from a given source
async function getContributionSums(
  supabase: ReturnType<typeof createClient>,
  source: string
): Promise<Record<string, number>> {
  const sums: Record<string, number> = { 'Roth IRA': 0, 'HSA': 0 };

  for (const category of Object.keys(INVESTMENT_CATEGORIES)) {
    const { data } = await supabase
      .from('transactions')
      .select('amount')
      .eq('category', category)
      .eq('source', source);

    if (data) {
      sums[category] = data.reduce((total, row) => {
        const val = parseFloat(String(row.amount));
        return total + (val > 0 ? val : 0);
      }, 0);
    }
  }

  return sums;
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session as any).accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'No access token — please sign out and back in' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // ─── TRANSACTIONS SYNC ────────────────────────────────────────────────────

    // 1. Fetch Transactions tab from Google Sheets (A:G covers all columns)
    const txRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Transactions!A:G`,
      { headers: authHeader }
    );
    if (!txRes.ok) {
      const body = await txRes.text();
      console.error(`[sync/sheets] tx_fetch_failed status=${txRes.status} body=${body}`);
      return NextResponse.json({ error: 'Failed to fetch Transactions sheet' }, { status: 500 });
    }

    const txJson = await txRes.json();
    const txRows: string[][] = txJson.values || [];
    const txDataRows = txRows.slice(1); // Skip header row

    // 2. Parse rows — skip manual- prefixed IDs and empty rows
    const parsedTransactions = txDataRows
      .map((row) => ({
        id: (row[0] || '').toString().trim(),
        rawDate: (row[1] || '').toString().trim(),
        merchant: (row[2] || '').toString().trim(),
        account: (row[3] || '').toString().trim(),
        amount: parseFloat((row[4] || '0').toString().replace(/[$,]/g, '')),
        category: (row[5] || '').toString().trim(),
        rawMonth: (row[6] || '').toString().trim(),
      }))
      .filter((r) => r.id && !r.id.startsWith('manual-') && r.rawDate)
      .map((r) => {
        const date = sheetDateToISO(r.rawDate);
        const month = r.rawMonth || date.substring(0, 7);
        return {
          id: r.id,
          date,
          merchant: r.merchant,
          account: r.account,
          amount: r.amount,
          category: r.category,
          month,
          source: 'google_sheets',
        };
      })
      .filter((r) => r.date); // Discard rows where date conversion failed

    // 3. Snapshot contribution sums BEFORE delete (for investment_cash delta)
    const beforeSums = await getContributionSums(supabase, 'google_sheets');
    console.error(`[sync/sheets] before_sums roth=${beforeSums['Roth IRA'].toFixed(2)} hsa=${beforeSums['HSA'].toFixed(2)}`);

    // 4. Delete all google_sheets transactions
    const { error: deleteErr } = await supabase
      .from('transactions')
      .delete()
      .eq('source', 'google_sheets');

    if (deleteErr) {
      console.error(`[sync/sheets] tx_delete_error=${deleteErr.message}`);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 5. Insert in batches of 10
    let txInserted = 0;
    for (let i = 0; i < parsedTransactions.length; i += 10) {
      const batch = parsedTransactions.slice(i, i + 10);
      const { error: insertErr } = await supabase.from('transactions').insert(batch);
      if (insertErr) {
        console.error(`[sync/sheets] tx_insert_error batch_start=${i} msg=${insertErr.message}`);
      } else {
        txInserted += batch.length;
      }
    }
    console.error(`[sync/sheets] tx_inserted=${txInserted}/${parsedTransactions.length}`);

    // 6. Snapshot contribution sums AFTER insert
    const afterSums = await getContributionSums(supabase, 'google_sheets');
    console.error(`[sync/sheets] after_sums roth=${afterSums['Roth IRA'].toFixed(2)} hsa=${afterSums['HSA'].toFixed(2)}`);

    // 7. Apply delta to investment_cash for each investment account
    for (const [category, investAccount] of Object.entries(INVESTMENT_CATEGORIES)) {
      const delta = (afterSums[category] || 0) - (beforeSums[category] || 0);
      if (Math.abs(delta) < 0.005) continue; // Skip if no meaningful change

      try {
        const { data: cashRow, error: fetchErr } = await supabase
          .from('investment_cash')
          .select('cash_balance')
          .eq('user_id', USER_ID)
          .eq('account', investAccount)
          .single();

        if (fetchErr || !cashRow) {
          console.error(`[sync/sheets] cash_fetch_error=${fetchErr?.message} account=${investAccount}`);
          continue;
        }

        const newBalance = parseFloat(String(cashRow.cash_balance)) + delta;
        const { error: updateErr } = await supabase
          .from('investment_cash')
          .update({ cash_balance: newBalance, updated_at: new Date().toISOString() })
          .eq('user_id', USER_ID)
          .eq('account', investAccount);

        if (updateErr) {
          console.error(`[sync/sheets] cash_update_error=${updateErr.message} account=${investAccount}`);
        } else {
          console.error(`[sync/sheets] cash_updated account=${investAccount} delta=${delta >= 0 ? '+' : ''}${delta.toFixed(2)} new_balance=${newBalance.toFixed(2)}`);
        }
      } catch (cashErr: any) {
        console.error(`[sync/sheets] cash_exception=${cashErr.message} account=${investAccount}`);
      }
    }

    // ─── BILLS SYNC ───────────────────────────────────────────────────────────

    const billsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recurring!A:G`,
      { headers: authHeader }
    );
    if (!billsRes.ok) {
      const body = await billsRes.text();
      console.error(`[sync/sheets] bills_fetch_failed status=${billsRes.status} body=${body}`);
      // Transactions synced OK — don't fail entirely, just note bills error
      return NextResponse.json(
        { success: true, transactionsInserted: txInserted, billsError: 'Recurring sheet fetch failed' },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const billsJson = await billsRes.json();
    const billRows: string[][] = billsJson.values || [];
    const billDataRows = billRows.slice(1); // Skip header

    // Parse — only include rows with status 'Upcoming'
    const parsedBills = billDataRows
      .filter((row) => {
        const name = (row[0] || '').toString().trim();
        const status = (row[6] || '').toString().trim();
        return name && status === 'Upcoming';
      })
      .map((row, idx) => {
        const name = (row[0] || '').toString().trim();
        const category = (row[1] || '').toString().trim();
        const amount = parseFloat((row[2] || '0').toString().replace(/[$,]/g, ''));
        const dueDay = parseInt((row[3] || '0').toString(), 10);
        const rawDueDate = (row[4] || '').toString().trim();
        const dueDate = rawDueDate ? sheetDateToISO(rawDueDate) : null;
        const paymentAccount = (row[5] || '').toString().trim();
        const status = (row[6] || 'Upcoming').toString().trim();
        const id = `sheet-bill-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        return {
          id,
          name,
          category,
          amount,
          due_day: isNaN(dueDay) ? null : dueDay,
          due_date: dueDate,
          payment_account: paymentAccount,
          status,
          source: 'google_sheets',
          user_id: USER_ID,
        };
      });

    // Delete all existing bills then reinsert
    const { error: billDeleteErr } = await supabase
      .from('bills')
      .delete()
      .not('id', 'is', null);

    if (billDeleteErr) {
      console.error(`[sync/sheets] bill_delete_error=${billDeleteErr.message}`);
    }

    let billsInserted = 0;
    for (let i = 0; i < parsedBills.length; i += 10) {
      const batch = parsedBills.slice(i, i + 10);
      const { error: billInsertErr } = await supabase.from('bills').insert(batch);
      if (billInsertErr) {
        console.error(`[sync/sheets] bill_insert_error batch=${i} msg=${billInsertErr.message}`);
      } else {
        billsInserted += batch.length;
      }
    }
    console.error(`[sync/sheets] bills_inserted=${billsInserted}`);

    return NextResponse.json(
      { success: true, transactionsInserted: txInserted, billsInserted },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    console.error(`[sync/sheets] caught=${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}