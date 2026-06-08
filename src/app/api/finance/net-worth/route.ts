import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';

function parseAmount(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,\s()]/g, '')) || 0;
}

function cleanName(val: string): string {
  if (!val) return '';
  return val.trim().replace(/â€"/g, '–').replace(/â€™/g, "'");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Accounts!A1:F30')}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Sheets error: ${res.status}`);
    const data = await res.json();
    const rows: string[][] = data.values || [];

    const totalAssets = parseAmount(rows[2]?.[2]);
    const totalLiabilities = parseAmount(rows[3]?.[2]);
    const netWorth = parseAmount(rows[4]?.[2]);

    const assets = [];
    for (let i = 8; i <= 14; i++) {
      const row = rows[i];
      if (!row) continue;
      const name = cleanName(row[1]);
      const value = parseAmount(row[4]);
      if (name && value > 0 && !name.toLowerCase().includes('total')) {
        assets.push({ name, value, type: 'asset' as const });
      }
    }

    const liabilities = [];
    for (let i = 17; i <= 26; i++) {
      const row = rows[i];
      if (!row) continue;
      const name = cleanName(row[1]);
      const value = parseAmount(row[4]);
      if (name && value > 0 && !name.toLowerCase().includes('total')) {
        liabilities.push({ name, value, type: 'liability' as const });
      }
    }

    // Query historical timeline metrics sorted ascending
    const { data: history } = await supabase
      .from('net_worth_snapshots')
      .select('date, net_worth, assets, liabilities')
      .order('date', { ascending: true })
      .limit(12);

    return NextResponse.json({
      totalAssets,
      totalLiabilities,
      netWorth,
      accounts: [...assets, ...liabilities],
      history: history || []
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}