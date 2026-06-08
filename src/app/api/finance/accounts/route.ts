import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';

function parseDollar(val: string | undefined): number {
  if (!val) return 0;
  return Math.abs(parseFloat(val.replace(/[$,()]/g, '')) || 0);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Accounts!B18:H26 — liabilities rows (name, starting, transactions, current, payment, remaining, limit)
    const range = encodeURIComponent('Accounts!B18:H26');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Sheets fetch failed' }, { status: 500 });
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];

    // Column indices within B:H range:
    // 0=B(name), 1=C(starting), 2=D(transactions), 3=E(current), 4=F(payment), 5=G(remaining), 6=H(limit)
    const accounts = rows
      .map((row) => ({
        name: row[0] || '',
        balance: parseDollar(row[3]),
        limit: row[6] ? parseDollar(row[6]) : null,
      }))
      .filter((a) => a.limit !== null && a.limit > 0); // only credit cards (have a limit)

    return NextResponse.json({ accounts }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}