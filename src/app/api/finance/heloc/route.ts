import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, merchant, amount, category')
    .eq('user_id', USER_ID)
    .eq('account', 'Members 1st HELOC')
    .order('date', { ascending: false })
    .order('id', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shape into the format HelocTab expects
  const transactions = (data || []).map(tx => ({
    id: tx.id,
    transaction_date: tx.date,
    transaction_type: tx.category === 'Income' ? 'deposit' : 'draw',
    amount: Math.abs(parseFloat(String(tx.amount))),
    running_balance: 0, // not tracked per-row from Sheets; balance shown from net-worth
    description: tx.merchant,
  }));

  return NextResponse.json(
    { transactions },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}