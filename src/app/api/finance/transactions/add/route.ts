import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

  // Format: match existing sheet columns A(ID), B(Date M/D/YYYY), C(Merchant), D(Account), E(Amount), F(Budget Category), G(Month)
  const dateObj = new Date(date);
  const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
  const month = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // e.g. "June 2026"
  const id = `manual-${Date.now()}`;

  const row = [id, formattedDate, merchant, account, amount, category, month];

  const sheetId = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
  const range = 'Transactions!A:G';

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}