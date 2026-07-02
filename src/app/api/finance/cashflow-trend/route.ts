import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

const INCOME_CATEGORIES = ['Income', 'Other Inc.', 'Roth IRA', 'HSA', '401K', 'Bree', 'Bonus'];

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') ||
      new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }).substring(0, 7);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rows } = await supabase
      .from('transactions')
      .select('merchant, amount, category')
      .eq('user_id', USER_ID)
      .eq('month', month)
      .neq('category', 'Transfer');

    // Sum spending by merchant (exclude income categories, only positive amounts)
    const merchantMap: Record<string, number> = {};
    for (const r of (rows || [])) {
      if (INCOME_CATEGORIES.includes(r.category)) continue;
      const amt = parseFloat(String(r.amount));
      if (amt <= 0) continue;
      const name = (r.merchant || 'Unknown').trim();
      merchantMap[name] = (merchantMap[name] || 0) + amt;
    }

    const top10 = Object.entries(merchantMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([merchant, total]) => ({ merchant, total: Math.round(total * 100) / 100 }));

    const grandTotal = top10.reduce((s, m) => s + m.total, 0);

    return NextResponse.json({ month, merchants: top10, grandTotal }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}