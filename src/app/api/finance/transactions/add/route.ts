import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';
const INCOME_CATEGORIES = ['Income', 'Other Inc.', 'Roth IRA', '401K', 'HSA', 'Transfer'];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { date, merchant, account, amount, category } = body;

    if (!date || !merchant || !account || !amount || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
    const sheetMonth = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const supabaseMonth = date.substring(0, 7);
    const id = `manual-${Date.now()}`;

    // Expenses are negative, income/transfers are positive
    const rawAmount = parseFloat(amount);
    const signedAmount = INCOME_CATEGORIES.includes(category) ? rawAmount : -Math.abs(rawAmount);

    const row = [id, formattedDate, merchant, account, signedAmount, category, sheetMonth];

    const sheetId = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
    const range = 'Transactions!A:G';

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
      return NextResponse.json({ error: `Sheets error: ${err}` }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: dbError } = await supabase.from('transactions').insert({
      id,
      date,
      merchant,
      account,
      amount: signedAmount,
      category,
      month: supabaseMonth,
      source: 'manual',
      user_id: USER_ID,
    });

    if (dbError) {
      return NextResponse.json({ error: `DB error: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Exception: ${message}` }, { status: 500 });
  }
}