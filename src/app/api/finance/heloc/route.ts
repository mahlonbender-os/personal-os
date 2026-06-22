import { NextRequest, NextResponse } from 'next/server';
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
    .from('heloc_transactions')
    .select('*')
    .eq('user_id', USER_ID)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { transactions: data || [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { date, transaction_type, amount, description, balance_override } = body;

  if (!date || !amount)
    return NextResponse.json({ error: 'Date and amount are required' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const amt = parseFloat(String(amount));
  let runningBalance: number;

  if (balance_override && String(balance_override).trim() !== '') {
    // Caller provided an explicit balance — use it (first entry or manual correction)
    runningBalance = parseFloat(String(balance_override));
  } else {
    // Auto-compute from the most recent entry
    const { data: latest } = await supabase
      .from('heloc_transactions')
      .select('running_balance')
      .eq('user_id', USER_ID)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    const prev = latest && latest.length > 0
      ? parseFloat(String(latest[0].running_balance))
      : 0;

    // draw = take money out  → balance owed INCREASES
    // deposit = paycheck in  → balance owed DECREASES
    // payment = pay down     → balance owed DECREASES
    runningBalance = transaction_type === 'draw' ? prev + amt : prev - amt;
  }

  // Insert HELOC record
  const { data: inserted, error } = await supabase
    .from('heloc_transactions')
    .insert({
      user_id: USER_ID,
      transaction_date: date,
      transaction_type: transaction_type || 'deposit',
      amount: amt,
      running_balance: runningBalance,
      description: description || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror to transactions table
  const mirrorId = `heloc-${inserted.id}`;
  const category = transaction_type === 'deposit' ? 'Income' : 'Transfer';
  const merchant = description || (
    transaction_type === 'deposit' ? 'HELOC Deposit' :
    transaction_type === 'draw'    ? 'HELOC Draw'    : 'HELOC Payment'
  );

  await supabase.from('transactions').insert({
    id: mirrorId,
    user_id: USER_ID,
    date,
    merchant,
    account: 'Members 1st HELOC',
    amount: amt,
    category,
    month: date.substring(0, 7),
    source: 'heloc',
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from('heloc_transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remove the mirrored transaction (ignore error — may not exist)
  await supabase.from('transactions').delete().eq('id', `heloc-${id}`);

  return NextResponse.json({ ok: true });
}