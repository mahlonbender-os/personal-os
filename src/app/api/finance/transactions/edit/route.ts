import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

function isoToSheetDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const accessToken = (session as any).accessToken;
    if (!accessToken) return NextResponse.json({ error: 'No access token — sign out and back in' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { id, date, merchant, account, amount, category } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing transaction id' }, { status: 400 });

    const month = date.substring(0, 7);
    const numericAmount = parseFloat(String(amount));

    // ── Update Supabase ──────────────────────────────────────────────────────
    const { error } = await supabase
      .from('transactions')
      .update({ date, merchant, account, amount: numericAmount, category, month })
      .eq('id', id)
      .eq('user_id', USER_ID);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── Update Sheets — find row by ID in col A, then overwrite ──────────────
    try {
      const searchRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Transactions!A:A`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const rows: string[][] = searchData.values || [];
        const rowIndex = rows.findIndex(r => r[0] === id);
        if (rowIndex !== -1) {
          const sheetRow = rowIndex + 1;
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Transactions!A${sheetRow}:G${sheetRow}?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                values: [[id, isoToSheetDate(date), merchant, account, numericAmount, category, month]],
              }),
            }
          );
        } else {
          console.error(`[transactions/edit] sheets_row_not_found id=${id}`);
        }
      }
    } catch (sheetsErr: any) {
      console.error(`[transactions/edit] sheets_exception=${sheetsErr.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}