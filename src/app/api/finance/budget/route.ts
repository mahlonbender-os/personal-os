import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

function parseAmount(val: string): number {
  if (!val) return 0;
  return Math.abs(parseFloat(val.replace(/[$,\s()-]/g, '')) || 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // e.g. "2026-06"

  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Fetch Flow tab — projected in col B, months in row 1
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Flow!A1:Z32')}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Sheets error: ${res.status}`);
    const data = await res.json();
    const rows: string[][] = data.values || [];

    // Row 1 = headers: blank, Proj., 2026-04, 2026-05...
    const headerRow = rows[0] || [];

    // Build category → projected amount map from col B (index 1)
    // Categories are in rows 3-5 (income), 9-19 (essentials), 23-28 (discretionary)
    const categoryRows = [2, 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 22, 23, 24, 25, 26, 27];
    const projected: Record<string, number> = {};

    for (const i of categoryRows) {
      const row = rows[i];
      if (!row) continue;
      const name = row[0]?.trim();
      const val = parseAmount(row[1] || '0');
      if (name && val > 0 && !name.toLowerCase().includes('total') && !name.toLowerCase().includes('income') && !name.toLowerCase().includes('essential') && !name.toLowerCase().includes('discretionary')) {
        projected[name] = val;
      }
    }

    // Get available months from header row
    const availableMonths: string[] = [];
    for (let i = 2; i < headerRow.length; i++) {
      const h = headerRow[i]?.trim();
      if (h && /^\d{4}-\d{2}$/.test(h)) {
        availableMonths.push(h);
      }
    }

    // Determine target month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = month || currentMonth;

    // Get actual spending from Supabase transactions for that month
    const monthStart = `${targetMonth}-01`;
    const monthEnd = `${targetMonth}-31`;

    const { data: txData } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', USER_ID)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    // Sum actuals by category
    const actuals: Record<string, number> = {};
    for (const tx of txData || []) {
      const cat = tx.category;
      const amt = Math.abs(tx.amount);
      actuals[cat] = (actuals[cat] || 0) + amt;
    }

    // Build budget items
    const items = Object.entries(projected).map(([category, budget]) => ({
      category,
      budget,
      actual: actuals[category] || 0,
      remaining: Math.max(0, budget - (actuals[category] || 0)),
      over: Math.max(0, (actuals[category] || 0) - budget),
      percent: budget > 0 ? Math.min(Math.round(((actuals[category] || 0) / budget) * 100), 999) : 0,
    }));

    // Totals
    const totalBudget = items.reduce((s, i) => s + i.budget, 0);
    const totalActual = items.reduce((s, i) => s + i.actual, 0);

    return NextResponse.json({
      month: targetMonth,
      currentMonth,
      availableMonths,
      items,
      totalBudget,
      totalActual,
      totalRemaining: Math.max(0, totalBudget - totalActual),
      totalOver: Math.max(0, totalActual - totalBudget),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}