import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';
const INCOME_CATEGORIES = ['Income', 'Other Inc.', 'Roth IRA', 'HSA', '401K', 'Bree', 'Bonus'];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build last 6 months in Eastern time
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }).substring(0, 7);
      months.push(m);
    }

    const { data: rows } = await supabase
      .from('transactions')
      .select('month, amount, category')
      .eq('user_id', USER_ID)
      .in('month', months)
      .neq('category', 'Transfer');

    const result = months.map(month => {
      const monthRows = (rows || []).filter(r => r.month === month);

      // Income: positive amounts in income categories
      const income = monthRows
        .filter(r => INCOME_CATEGORIES.includes(r.category))
        .reduce((s, r) => s + parseFloat(String(r.amount)), 0);

      // Expenses: negative amounts NOT in income categories
      const expenses = monthRows
        .filter(r => !INCOME_CATEGORIES.includes(r.category) && parseFloat(String(r.amount)) < 0)
        .reduce((s, r) => s + Math.abs(parseFloat(String(r.amount))), 0);

      return {
        month,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        net: Math.round((income - expenses) * 100) / 100,
      };
    });

    return NextResponse.json({ months: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}