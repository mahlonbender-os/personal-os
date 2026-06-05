import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

// Convert M/D/YYYY → YYYY-MM-DD for Postgres date column
function parseSheetDate(raw: string): string | null {
  if (!raw) return null;
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Fetch Transactions tab from Google Sheets
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Transactions!A2:G`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (!sheetRes.ok) {
      const err = await sheetRes.text();
      return NextResponse.json({ error: `Sheets fetch failed: ${err}` }, { status: 500 });
    }

    const sheetData = await sheetRes.json();
    const rows: string[][] = sheetData.values || [];

    // 2. Delete all previously synced sheet rows
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('source', 'google_sheets');

    if (deleteError) {
      return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 });
    }

    // 3. Build insert rows
    //    - Skip rows with no ID
    //    - Skip manual- rows (those already live in Supabase as source='manual')
    //    - Parse M/D/YYYY dates to YYYY-MM-DD
    const toInsert = rows
      .filter(row => {
        const id = (row[0] || '').trim();
        return id && !id.startsWith('manual-');
      })
      .map(row => {
        const id = row[0].trim();
        const date = parseSheetDate(row[1] || '');
        const merchant = (row[2] || '').trim();
        const account = (row[3] || '').trim();
        const rawAmount = parseFloat((row[4] || '0').replace(/[$,]/g, ''));
        const category = (row[5] || '').trim();
        const month = (row[6] || '').trim();

        // Force category from account for investment accounts
        let finalCategory = category;
        if (account === '401K') finalCategory = '401K';
        else if (account === 'HSA') finalCategory = 'HSA';
        else if (account === 'Roth IRA') finalCategory = 'Roth IRA';
        else if (!category) finalCategory = 'Transfer';

        return {
          id,
          date,         // YYYY-MM-DD — matches Postgres date column type
          merchant,
          account,
          amount: isNaN(rawAmount) ? 0 : rawAmount,
          category: finalCategory,
          month,
          user_id: USER_ID,
          source: 'google_sheets',
        };
      })
      .filter(row => row.date !== null); // drop any rows with unparseable dates

    // 4. Insert in batches of 500
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(batch);

      if (insertError) {
        return NextResponse.json(
          { error: `Insert failed at batch ${i}: ${insertError.message}` },
          { status: 500 }
        );
      }
      inserted += batch.length;
    }

    return NextResponse.json({
      success: true,
      synced: inserted,
      skipped_manual: rows.filter(r => (r[0] || '').startsWith('manual-')).length,
      message: `Synced ${inserted} transactions from Google Sheets`,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}