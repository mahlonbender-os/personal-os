import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

function parseSheetDate(raw: string): string | null {
  if (!raw) return null;
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseAmount(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,\s()]/g, '')) || 0;
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
    // ── 1. Sync Transactions ─────────────────────────────────────────────────
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Transactions!A2:G`,
      { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: 'no-store' }
    );

    if (!sheetRes.ok) {
      const err = await sheetRes.text();
      return NextResponse.json({ error: `Sheets fetch failed: ${err}` }, { status: 500 });
    }

    const sheetData = await sheetRes.json();
    const rows: string[][] = sheetData.values || [];

    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('source', 'google_sheets');

    if (deleteError) {
      return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 });
    }

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

        let finalCategory = category;
        if (account === '401K') finalCategory = '401K';
        else if (account === 'HSA') finalCategory = 'HSA';
        else if (account === 'Roth IRA') finalCategory = 'Roth IRA';
        else if (!category) finalCategory = 'Transfer';

        return {
          id,
          date,
          merchant,
          account,
          amount: isNaN(rawAmount) ? 0 : rawAmount,
          category: finalCategory,
          month,
          user_id: USER_ID,
          source: 'google_sheets',
        };
      })
      .filter(row => row.date !== null);

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

    // ── 2. Sync Recurring Bills ──────────────────────────────────────────────
    const recurringRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Recurring!A2:G`,
      { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: 'no-store' }
    );

    let billsSynced = 0;

    if (recurringRes.ok) {
      const recurringData = await recurringRes.json();
      const recurringRows: string[][] = recurringData.values || [];

      await supabase
        .from('bills')
        .delete()
        .eq('source', 'google_sheets');

      const billsToInsert = recurringRows
        .filter(row => (row[0] || '').trim())
        .map((row, index) => {
          const rawAmount = parseFloat((row[2] || '0').replace(/[$,]/g, ''));
          const status = (row[6] || 'Upcoming').trim();

          return {
            id: `sheets-bill-${index + 1}`,
            name: (row[0] || '').trim(),
            category: (row[1] || '').trim(),
            amount: isNaN(rawAmount) ? 0 : rawAmount,
            due_day: parseInt(row[3] || '0', 10) || null,
            due_date: (row[4] || '').trim() || null,
            payment_account: (row[5] || '').trim(),
            status,
            user_id: USER_ID,
            source: 'google_sheets',
          };
        });

      if (billsToInsert.length > 0) {
        const { error: billsInsertError } = await supabase
          .from('bills')
          .insert(billsToInsert);

        if (!billsInsertError) {
          billsSynced = billsToInsert.length;
        }
      }
    }

    // ── 3. Snapshot Net Worth Chronology ─────────────────────────────────────
    try {
      const nwUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Accounts!A1:F30')}`;
      const nwRes = await fetch(nwUrl, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: 'no-store',
      });
      if (nwRes.ok) {
        const nwData = await nwRes.json();
        const nwRows: string[][] = nwData.values || [];
        const totalAssets = parseAmount(nwRows[2]?.[2]);
        const totalLiabilities = parseAmount(nwRows[3]?.[2]);
        const netWorth = parseAmount(nwRows[4]?.[2]);

        const todayNY = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const currentMonthDateStr = `${todayNY.getFullYear()}-${String(todayNY.getMonth() + 1).padStart(2, '0')}-01`;

        if (totalAssets > 0) {
          await supabase.from('net_worth_snapshots').upsert({
            date: currentMonthDateStr,
            assets: totalAssets,
            liabilities: totalLiabilities,
            net_worth: netWorth,
            user_id: USER_ID
          }, { onConflict: 'date' });
        }
      }
    } catch (e) {
      console.error('Failed to preserve net worth chronology stamp:', e);
    }

    return NextResponse.json({
      success: true,
      synced: inserted,
      bills_synced: billsSynced,
      skipped_manual: rows.filter(r => (r[0] || '').startsWith('manual-')).length,
      message: `Synced ${inserted} transactions, ${billsSynced} bills, and preserved financial chronology snapshots.`,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}