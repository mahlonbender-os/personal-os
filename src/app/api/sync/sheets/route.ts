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
  const session = await getServerSession(authOptions);
  
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'No session or access token' }, { status: 401 });
  }

  // Step 1: Try fetching the sheet
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Transactions!A1:G5')}`;
  
  const sheetRes = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  const sheetText = await sheetRes.text();

  if (!sheetRes.ok) {
    return NextResponse.json({
      error: 'Sheet fetch failed',
      status: sheetRes.status,
      body: sheetText,
    });
  }

  const sheetData = JSON.parse(sheetText);
  const rows: string[][] = sheetData.values || [];

  // Step 2: Try a test upsert with one row
  if (rows.length < 2) {
    return NextResponse.json({ error: 'Sheet returned no data rows', rows });
  }

  const testRow = rows[1]; // first data row (row 2, after header)
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

  const { error: upsertError } = await supabase
    .from('transactions')
    .upsert(testRecord, { onConflict: 'id' });

  return NextResponse.json({
    success: !upsertError,
    headers: rows[0],
    firstDataRow: testRow,
    parsedRecord: testRecord,
    upsertError: upsertError?.message || null,
  });
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to sync' });
}