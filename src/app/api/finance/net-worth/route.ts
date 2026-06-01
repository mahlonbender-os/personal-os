import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';

function parseAmount(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,\s()]/g, '')) || 0;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Accounts!A1:D30')}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Sheets error: ${res.status}`);
    const data = await res.json();
    const rows: string[][] = data.values || [];

    // Totals from B3:C5 (index row 2, cols 1 and 2)
    const totalAssets = parseAmount(rows[2]?.[2]);
    const totalLiabilities = parseAmount(rows[3]?.[2]);
    const netWorth = parseAmount(rows[4]?.[2]);

    // Assets: rows 9–14 (0-based: 8–13), name in col A, current value in col D (index 3)
    const assetNames = ['401K', 'Fidelity', 'Home – Zestimate', 'HSA', 'Members 1st Checking', 'Roth IRA'];
    const assets = [];
    for (let i = 8; i <= 13; i++) {
      const row = rows[i];
      if (!row) continue;
      const name = row[0]?.trim() || assetNames[i - 8];
      const value = parseAmount(row[3]);
      if (name && value > 0) {
        assets.push({ name, value, type: 'asset' as const });
      }
    }

    // Liabilities: rows 19–26 (0-based: 18–25), name in col A, current value in col D (index 3)
    const liabilities = [];
    for (let i = 18; i <= 25; i++) {
      const row = rows[i];
      if (!row) continue;
      const name = row[0]?.trim();
      const value = parseAmount(row[3]);
      if (name && value > 0) {
        liabilities.push({ name, value, type: 'liability' as const });
      }
    }

    return NextResponse.json({
      totalAssets,
      totalLiabilities,
      netWorth,
      accounts: [...assets, ...liabilities],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
