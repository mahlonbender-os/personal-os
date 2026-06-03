import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { date, merchant, account, amount, category } = body;

  if (!date || !merchant || !account || !amount || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Format date for Google Sheets column B: M/D/YYYY
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;

  // Month for Sheets column G: e.g. "June 2026"
  const sheetMonth = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Month for Supabase: YYYY-MM
  const supabaseMonth = date.substring(0, 7);

  const id = `manual-${Date.now()}`;
  const row = [id, formattedDate, merchant, account, amount, category, sheetMonth];

  const sheetId = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
  const range = 'Transactions!A:G';

  // 1. Write to Google Sheets
  const sheetsResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );

  if (!sheetsResponse.ok) {
    const err = await sheetsResponse.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  // 2. Write to Supabase immediately so the UI can show it without waiting for a sync
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from('transactions').insert({
    id,
    date,
    merchant,
    account,
    amount: parseFloat(amount),
    category,
    month: supabaseMonth,
    source: 'google_sheets',
    user_id: USER_ID,
  });

  return NextResponse.json({ success: true });
}