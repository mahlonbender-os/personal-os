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

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) return NextResponse.json({ success: false, message: 'ERROR: No session found' });
    if (!session.accessToken) return NextResponse.json({ success: false, message: 'ERROR: No access token in session' });

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Transactions!A1:G5')}`;

    const sheetRes = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!sheetRes.ok) {
      const body = await sheetRes.text();
      return NextResponse.json({ success: false, message: `ERROR ${sheetRes.status}: ${body.slice(0, 200)}` });
    }

    const sheetData = await sheetRes.json();
    const rows: string[][] = sheetData.values || [];

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'ERROR: Sheet returned 0 rows — check tab name is exactly "Transactions"' });
    }

    const testRow = rows[1];
    if (!testRow) {
      return NextResponse.json({ success: false, message: `ERROR: Only header row found. Headers: ${rows[0]?.join(', ')}` });
    }

    const testRecord = {
      id: testRow[0]?.trim(),
      user_id: USER_ID,
      date: testRow[1]?.trim(),
      merchant: testRow[2]?.trim() || '',
      account: testRow[3]?.trim() || '',
      amount: parseFloat((testRow[4] || '0').replace(/[$,\s]/g, '')) || 0,
      category: testRow[5]?.trim() || '',
      month: testRow[6]?.trim() || '',
      source: 'google_sheets',
    };

    if (!testRecord.id) {
      return NextResponse.json({ success: false, message: `ERROR: First data row has no ID. Row data: ${testRow.join(' | ')}` });
    }

    const { error: upsertError } = await supabase
      .from('transactions')
      .upsert(testRecord, { onConflict: 'id' });

    if (upsertError) {
      return NextResponse.json({ success: false, message: `SUPABASE ERROR: ${upsertError.message}` });
    }

    return NextResponse.json({ success: true, message: `OK: Test row inserted — ID: ${testRecord.id}, Merchant: ${testRecord.merchant}, Amount: ${testRecord.amount}` });

  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: `EXCEPTION: ${e instanceof Error ? e.message : String(e)}` });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to sync' });
}