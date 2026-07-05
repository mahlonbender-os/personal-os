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

// ─── Bill auto-advance helpers ────────────────────────────────────────────────
function normalizeName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function billNameMatches(billName: string, merchant: string): boolean {
  const a = normalizeName(billName);
  const b = normalizeName(merchant);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// Rolls a YYYY-MM-DD due date forward exactly one month, landing on due_day if known
function advanceDueDate(currentDueDateISO: string, dueDay: number | null): string {
  const [y, m, d] = currentDueDateISO.split('-').map((n) => parseInt(n, 10));
  let newMonth = m + 1;
  let newYear = y;
  if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }
  const targetDay = dueDay && dueDay > 0 ? dueDay : d;
  const daysInNewMonth = new Date(newYear, newMonth, 0).getDate();
  const clampedDay = Math.min(targetDay, daysInNewMonth);
  return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
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
        console.error(`[transactions/add] single_sheets_append_failed status=${appendRes.status} body=${errBody}`);
      } else {
        console.error(`[transactions/add] single_sheets_append_ok id=${id}`);
      }
    } catch (sheetsErr: any) {
      console.error(`[transactions/add] single_sheets_exception=${sheetsErr.message}`);
    }

    // ── Bill auto-advance — instant, independent of the daily sync ─────────
    // Only expenses can be a bill payment. Requires ALL THREE to match:
    // same category, same payment account, AND a fuzzy name match against
    // the bill name — reduces the odds of advancing the wrong bill.
    if (numericAmount < 0) {
      try {
        const { data: candidateBills } = await supabase
          .from('bills')
          .select('id, name, category, due_date, due_day, payment_account')
          .eq('user_id', USER_ID)
          .eq('status', 'Upcoming')
          .eq('category', category)
          .eq('payment_account', account);

        const match = (candidateBills || []).find((b: any) => billNameMatches(b.name, merchant));

        if (match && match.due_date) {
          const newDueDate = advanceDueDate(match.due_date, match.due_day);

          const { error: billUpdateErr } = await supabase
            .from('bills')
            .update({ due_date: newDueDate })
            .eq('id', match.id)
            .eq('user_id', USER_ID);

          if (billUpdateErr) {
            console.error(`[transactions/add] bill_update_error=${billUpdateErr.message}`);
          } else {
            console.error(`[transactions/add] bill_advanced name=${match.name} old_due=${match.due_date} new_due=${newDueDate}`);
          }

          // Write the new due date back to the Recurring tab too, so the
          // next automatic daily sync doesn't overwrite this with the old value.
          try {
            const recurRes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recurring!A:A`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (recurRes.ok) {
              const recurData = await recurRes.json();
              const recurRows: string[][] = recurData.values || [];
              const rowIndex = recurRows.findIndex(
                (r) => (r[0] || '').toString().trim().toLowerCase() === match.name.trim().toLowerCase()
              );
              if (rowIndex !== -1) {
                const sheetRow = rowIndex + 1;
                await fetch(
                  `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recurring!E${sheetRow}?valueInputOption=USER_ENTERED`,
                  {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: [[isoToSheetDate(newDueDate)]] }),
                  }
                );
                console.error(`[transactions/add] recurring_sheet_updated row=${sheetRow} new_due=${newDueDate}`);
              } else {
                console.error(`[transactions/add] recurring_row_not_found name=${match.name}`);
              }
            }
          } catch (sheetsErr: any) {
            console.error(`[transactions/add] bill_sheets_writeback_exception=${sheetsErr.message}`);
          }
        }
      } catch (billErr: any) {
        console.error(`[transactions/add] bill_match_exception=${billErr.message}`);
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