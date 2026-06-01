import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';

function parseAmount(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,\s]/g, '')) || 0;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Fetch row 1 (headers) + rows 6, 20, 29, 32 (totals)
    // We'll grab the whole block A1:Z32 and pick the rows we need
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Flow!A1:Z32')}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Sheets error: ${res.status}`);
    const data = await res.json();
    const rows: string[][] = data.values || [];

    // Row indices (0-based, so row 1 = index 0)
    const headerRow = rows[0] || [];   // row 1: blank, Proj., 2026-04, 2026-05...
    const incomeRow = rows[5] || [];   // row 6: Total Income
    const essentialsRow = rows[19] || []; // row 20: Total Essentials
    const discretionaryRow = rows[28] || []; // row 29: Total Discretionary
    const cashFlowRow = rows[31] || []; // row 32: CASH FLOW

    // Build a month entry for each column (C onward = index 2+)
    const months = [];
    for (let i = 2; i < headerRow.length; i++) {
      const header = headerRow[i]?.trim();
      if (!header || header === 'Proj.') continue;

      // header is like "2026-04" — convert to "April 2026"
      const [year, month] = header.split('-');
      if (!year || !month) continue;
      const monthName = new Date(`${year}-${month}-01`).toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });

      const income = parseAmount(incomeRow[i] || '0');
      const essentials = Math.abs(parseAmount(essentialsRow[i] || '0'));
      const discretionary = Math.abs(parseAmount(discretionaryRow[i] || '0'));
      const cashFlow = parseAmount(cashFlowRow[i] || '0');

      months.push({
        month: monthName,
        rawHeader: header,
        income,
        essentials,
        discretionary,
        net: cashFlow,
      });
    }

    // Also include Proj. column (index 1) as a fallback
    const projIncome = parseAmount(incomeRow[1] || '0');
    const projEssentials = Math.abs(parseAmount(essentialsRow[1] || '0'));
    const projDiscretionary = Math.abs(parseAmount(discretionaryRow[1] || '0'));
    const projCashFlow = parseAmount(cashFlowRow[1] || '0');

    return NextResponse.json({
      months,
      projected: {
        income: projIncome,
        essentials: projEssentials,
        discretionary: projDiscretionary,
        net: projCashFlow,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}