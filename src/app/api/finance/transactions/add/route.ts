import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

const INVESTMENT_CONTRIBUTION_CATEGORIES: Record<string, string> = {
  'Roth IRA': 'Roth IRA',
  'HSA': 'HSA',
};

// Converts YYYY-MM-DD → M/D/YYYY for Google Sheets
function isoToSheetDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

export async function POST(req: Request) {
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

    const body = await req.json();
    const { merchant, date, account, amount, category, toAccount } = body;

    const month = date.substring(0, 7);
    const sheetDate = isoToSheetDate(date);
    const ts = Date.now();

    // ── TRANSFER: two rows ─────────────────────────────────────────────────
    if (toAccount) {
      const amt = Math.abs(parseFloat(String(amount)));
      const fromId = `manual-${ts}-from`;
      const toId   = `manual-${ts}-to`;
      const label  = merchant || 'Transfer';

      // Insert both rows to Supabase
      const { error: insertErr } = await supabase.from('transactions').insert([
        {
          id: fromId,
          date,
          merchant: label,
          account,
          amount: -amt,
          category: 'Transfer',
          month,
          source: 'manual',
          user_id: USER_ID,
        },
        {
          id: toId,
          date,
          merchant: label,
          account: toAccount,
          amount: amt,
          category: 'Transfer',
          month,
          source: 'manual',
          user_id: USER_ID,
        },
      ]);

      if (insertErr) {
        console.error(`[transactions/add] transfer_insert_error=${insertErr.message}`);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      // Append both rows to Sheets
      try {
        const appendRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Transactions!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [
                [fromId, sheetDate, label, account,   -amt, 'Transfer', month],
                [toId,   sheetDate, label, toAccount,  amt, 'Transfer', month],
              ],
            }),
          }
        );
        if (!appendRes.ok) {
          const errBody = await appendRes.text();
          console.error(`[transactions/add] transfer_sheets_append_failed status=${appendRes.status} body=${errBody}`);
        } else {
          console.error(`[transactions/add] transfer_sheets_append_ok from=${account} to=${toAccount} amt=${amt}`);
        }
      } catch (sheetsErr: any) {
        console.error(`[transactions/add] transfer_sheets_exception=${sheetsErr.message}`);
      }

      return NextResponse.json(
        { success: true },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    // ── SINGLE ROW: expense or income ──────────────────────────────────────
    const id = `manual-${ts}`;
    const numericAmount = parseFloat(String(amount));

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        id,
        date,
        merchant,
        account,
        amount: numericAmount,
        category,
        month,
        source: 'manual',
        user_id: USER_ID,
      }])
      .select()
      .single();

    if (error) {
      console.error(`[transactions/add] insert_error=${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Append single row to Sheets
    try {
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Transactions!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [[id, sheetDate, merchant, account, numericAmount, category, month]],
          }),
        }
      );
      if (!appendRes.ok) {
        const errBody = await appendRes.text();
        console.error(`[transactions/add] sheets_append_failed status=${appendRes.status} body=${errBody}`);
      } else {
        console.error(`[transactions/add] sheets_append_ok id=${id} merchant=${merchant}`);
      }
    } catch (sheetsErr: any) {
      console.error(`[transactions/add] sheets_exception=${sheetsErr.message}`);
    }

    // Auto-update investment_cash for Roth IRA / HSA contributions
    const investmentAccount = INVESTMENT_CONTRIBUTION_CATEGORIES[category];
    if (investmentAccount && numericAmount > 0) {
      try {
        const { data: cashRow, error: fetchErr } = await supabase
          .from('investment_cash')
          .select('cash_balance')
          .eq('user_id', USER_ID)
          .eq('account', investmentAccount)
          .single();

        if (fetchErr) {
          console.error(`[transactions/add] cash_fetch_error=${fetchErr.message} account=${investmentAccount}`);
        } else if (cashRow) {
          const newBalance = parseFloat(String(cashRow.cash_balance)) + numericAmount;
          const { error: updateErr } = await supabase
            .from('investment_cash')
            .update({ cash_balance: newBalance, updated_at: new Date().toISOString() })
            .eq('user_id', USER_ID)
            .eq('account', investmentAccount);

          if (updateErr) {
            console.error(`[transactions/add] cash_update_error=${updateErr.message}`);
          } else {
            console.error(`[transactions/add] cash_updated account=${investmentAccount} delta=+${numericAmount} new=${newBalance}`);
          }
        }
      } catch (cashErr: any) {
        console.error(`[transactions/add] cash_exception=${cashErr.message}`);
      }
    }

    return NextResponse.json(
      { success: true, transaction: data },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    console.error(`[transactions/add] caught=${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}