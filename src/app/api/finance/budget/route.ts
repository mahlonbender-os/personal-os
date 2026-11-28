import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MonthlyRow, activeMonths, easternYearMonth } from '@/lib/financeSheet';
import { readWorkbook } from '@/lib/financeRead';
import { freshRequested, NO_STORE_HEADERS } from '@/lib/noStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type BudgetItem = {
  category: string;
  section: 'income' | 'essentials' | 'discretionary';
  budget: number;
  actual: number;
  remaining: number;
  over: number;
  percent: number;
};

const ESSENTIALS = new Set([
  'Groceries',
  'Knox',
  'Housing',
  'Utilities',
  'Insurance',
  'Transportation',
  'Health/Gym',
  'Debt Interest',
  'Subscriptions',
]);

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const book = await readWorkbook(session.accessToken, freshRequested(request));
  if (!book) {
    return NextResponse.json({ error: 'Finance sheet is unavailable' }, { status: 502 });
  }

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('month');
  const currentMonth = easternYearMonth();
  const months = activeMonths(book);
  const availableMonths = months.map((row) => row.month);
  const target = months.find((row) => row.month === requested)
    || months.find((row) => row.month === currentMonth)
    || months[months.length - 1];

  const items: BudgetItem[] = target ? budgetItems(target, book.categoryBudgets) : [];
  const incomeItems = items.filter((item) => item.section === 'income');
  const expenseItems = items.filter((item) => item.section !== 'income');

  return NextResponse.json({
    month: target?.month || currentMonth,
    currentMonth,
    availableMonths,
    items,
    totalIncomeBudget: incomeItems.reduce((s, i) => s + i.budget, 0),
    totalIncomeActual: target?.income || 0,
    totalExpenseBudget: target?.totalBudget || expenseItems.reduce((s, i) => s + i.budget, 0),
    totalExpenseActual: target?.spending || 0,
    projectedCashFlow: (target?.income || 0) - (target?.totalBudget || 0),
    actualCashFlow: target?.net || 0,
    savingsRate: target?.savingsRate ?? null,
    breeSpending: target?.breeSpending || 0,
    interestFees: target?.interestFees || 0,
    extraIncomeCategories: [],
  }, { headers: NO_STORE_HEADERS });
}

function budgetItems(month: MonthlyRow, budgets: Record<string, number>): BudgetItem[] {
  const items: BudgetItem[] = Object.keys({ ...budgets, ...month.categories }).map((category) => {
    const budget = budgets[category] || 0;
    const actual = month.categories[category] || 0;
    const section = ESSENTIALS.has(category) ? 'essentials' as const : 'discretionary' as const;
    return {
      category,
      section,
      budget,
      actual,
      remaining: Math.max(0, budget - actual),
      over: Math.max(0, actual - budget),
      percent: budget > 0 ? Math.min(Math.round((actual / budget) * 100), 999) : (actual > 0 ? 100 : 0),
    };
  }).filter((item) => item.budget > 0 || item.actual > 0);

  if (month.income > 0) {
    items.unshift({
      category: 'Income',
      section: 'income',
      budget: 0,
      actual: month.income,
      remaining: 0,
      over: 0,
      percent: 100,
    });
  }
  if (month.interestFees > 0 && !items.some((item) => item.category === 'Interest & Fees')) {
    items.push({
      category: 'Interest & Fees',
      section: 'essentials',
      budget: 0,
      actual: month.interestFees,
      remaining: 0,
      over: month.interestFees,
      percent: 100,
    });
  }
  return items;
}
