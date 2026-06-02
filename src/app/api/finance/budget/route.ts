import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SHEET_ID = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';

function parseAmount(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,\s()-]/g, '')) || 0;
}

function parseAmountSigned(val: string): number {
  if (!val) return 0;
  const negative = val.includes('(') || val.trim().startsWith('-');
  const abs = parseFloat(val.replace(/[$,\s()-]/g, '')) || 0;
  return negative ? -abs : abs;
}

const CATEGORY_ROWS: { index: number; name: string; section: 'income' | 'essentials' | 'discretionary' }[] = [
  { index: 2, name: 'Bonus', section: 'income' },
  { index: 3, name: 'Income', section: 'income' },
  { index: 4, name: 'Other Inc.', section: 'income' },
  { index: 8, name: 'Car Insurance', section: 'essentials' },
  { index: 9, name: 'Electric', section: 'essentials' },
  { index: 10, name: 'Groceries', section: 'essentials' },
  { index: 11, name: 'Housing', section: 'essentials' },
  { index: 12, name: 'Internet', section: 'essentials' },
  { index: 13, name: 'Knox 🐾', section: 'essentials' },
  { index: 14, name: 'Phone', section: 'essentials' },
  { index: 15, name: 'Student Loan', section: 'essentials' },
  { index: 16, name: 'Transportation', section: 'essentials' },
  { index: 17, name: 'UGI Gas', section: 'essentials' },
  { index: 18, name: 'Water', section: 'essentials' },
  { index: 22, name: 'Dining Out', section: 'discretionary' },
  { index: 23, name: 'Entertainment', section: 'discretionary' },
  { index: 24, name: 'Gym', section: 'discretionary' },
  { index: 25, name: 'Other Exp.', section: 'discretionary' },
  { index: 26, name: 'Personal', section: 'discretionary' },
  { index: 27, name: 'Subscriptions', section: 'discretionary' },
];

// These categories exist in transactions but not in Flow tab
// They show as income categories on transactions page only
const EXTRA_INCOME_CATEGORIES = ['Roth IRA', 'HSA', '401K', 'Bree'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Flow!A1:Z32')}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Sheets error: ${res.status}`);
    const data = await res.json();
    const rows: string[][] = data.values || [];

    const headerRow = rows[0] || [];

    const availableMonths: string[] = [];
    const monthColMap: Record<string, number> = {};
    for (let i = 2; i < headerRow.length; i++) {
      const h = headerRow[i]?.trim();
      if (h && /^\d{4}-\d{2}$/.test(h)) {
        availableMonths.push(h);
        monthColMap[h] = i;
      }
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = month || currentMonth;
    const targetColIndex = monthColMap[targetMonth];
    const projColIndex = 1;

    const items = CATEGORY_ROWS.map(({ index, name, section }) => {
      const row = rows[index] || [];
      const budget = parseAmount(row[projColIndex] || '0');
      const actual = targetColIndex !== undefined ? parseAmount(row[targetColIndex] || '0') : 0;

      return {
        category: name,
        section,
        budget,
        actual,
        remaining: Math.max(0, budget - actual),
        over: Math.max(0, actual - budget),
        percent: budget > 0 ? Math.min(Math.round((actual / budget) * 100), 999) : 0,
      };
    }).filter((item) => item.budget > 0 || item.actual > 0);

    const incomeItems = items.filter((i) => i.section === 'income');
    const expenseItems = items.filter((i) => i.section !== 'income');

    const totalIncomeBudget = incomeItems.reduce((s, i) => s + i.budget, 0);
    const totalIncomeActual = incomeItems.reduce((s, i) => s + i.actual, 0);
    const totalExpenseBudget = expenseItems.reduce((s, i) => s + i.budget, 0);
    const totalExpenseActual = expenseItems.reduce((s, i) => s + i.actual, 0);

    // Cash flow row 32 = index 31 — preserve sign
    const cashFlowRow = rows[31] || [];
    const projectedCashFlow = parseAmountSigned(cashFlowRow[projColIndex] || '0');
    const actualCashFlow = targetColIndex !== undefined
      ? parseAmountSigned(cashFlowRow[targetColIndex] || '0')
      : 0;

    return NextResponse.json({
      month: targetMonth,
      currentMonth,
      availableMonths,
      items,
      totalIncomeBudget,
      totalIncomeActual,
      totalExpenseBudget,
      totalExpenseActual,
      projectedCashFlow,
      actualCashFlow,
      extraIncomeCategories: EXTRA_INCOME_CATEGORIES,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}