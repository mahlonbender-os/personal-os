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
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch assets (B9:E15) and liabilities (B18:E26) in one batchGet call
    const ranges = [
      encodeURIComponent('Accounts!B9:E15'),
      encodeURIComponent('Accounts!B18:E26'),
    ].join('&ranges=');

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?ranges=${ranges}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Sheets fetch failed: ${text}` }, { status: 500 });
    }

    const data = await res.json();
    const [assetsRange, liabilitiesRange] = data.valueRanges ?? [];

    const assetRows: string[][] = assetsRange?.values ?? [];
    const liabilityRows: string[][] = liabilitiesRange?.values ?? [];

    // Column indices within B:E range:
    // 0=B(name), 1=C(starting), 2=D(transactions), 3=E(current balance)

    let home_value = 0;
    for (const row of assetRows) {
      if ((row[0] ?? '').toLowerCase().includes('zestimate')) {
        home_value = parseDollar(row[3]);
        break;
      }
    }

    let heloc_balance = 0;
    let mortgage_balance = 0;
    for (const row of liabilityRows) {
      const name = (row[0] ?? '').toLowerCase();
      if (name.includes('heloc')) {
        heloc_balance = parseDollar(row[3]);
      } else if (name.includes('wells fargo')) {
        mortgage_balance = parseDollar(row[3]);
      }
    }

    const equity = home_value - heloc_balance - mortgage_balance;

    return NextResponse.json(
      { home_value, heloc_balance, mortgage_balance, equity },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}