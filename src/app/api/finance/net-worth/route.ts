import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';

function parseAmount(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,\s%]/g, '')) || 0;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Accounts!B3:C5')}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Sheets error: ${res.status}`);
    const data = await res.json();
    const rows: string[][] = data.values || [];

    // rows[0] = B3:C3 = Total Assets
    // rows[1] = B4:C4 = Total Liabilities
    // rows[2] = B5:C5 = Net Worth
    const totalAssets = parseAmount(rows[0]?.[1]);
    const totalLiabilities = parseAmount(rows[1]?.[1]);
    const netWorth = parseAmount(rows[2]?.[1]);

    return NextResponse.json({ totalAssets, totalLiabilities, netWorth, accounts: [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}