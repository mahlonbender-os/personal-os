import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase
    .from('heloc_transactions')
    .select('*')
    .eq('user_id', USER_ID)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data || [] }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { transaction_date, transaction_type, amount, description, balance_override } = body;
  if (!transaction_date || !transaction_type || !amount) {
    return NextResponse.json({ error: 'Date, type, and amount required' }, { status: 400 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const amt = parseFloat(amount);

  // Compute running balance from last entry unless user overrides
  let newBalance: number;
  if (balance_override !== undefined && balance_override !== null && balance_override !== '') {
    newBalance = parseFloat(balance_override);
  } else {
    const { data: lastTx } = await supabase
      .from('heloc_transactions')
      .select('running_balance')
      .eq('user_id', USER_ID)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevBalance = lastTx ? parseFloat(String(lastTx.running_balance)) : 0;
    // Draw increases balance owed; deposit and payment reduce it
    newBalance = transaction_type === 'draw' ? prevBalance + amt : Math.max(0, prevBalance - amt);
  }

  const { data: helocData, error: helocError } = await supabase
    .from('heloc_transactions')
    .insert({
      user_id: USER_ID,
      transaction_date,
      transaction_type,
      amount: amt,
      running_balance: newBalance,
      description: description || '',
    })
    .select()
    .single();

  if (helocError) return NextResponse.json({ error: helocError.message }, { status: 500 });

  // Mirror to transactions table
  const txCategory = transaction_type === 'deposit' ? 'Income' : 'Transfer';
  const txMerchant = description || (
    transaction_type === 'deposit' ? 'Paycheck Deposit' :
    transaction_type === 'draw' ? 'HELOC Draw' : 'HELOC Payment'
  );
  const month = transaction_date.substring(0, 7);

  const { error: txError } = await supabase.from('transactions').insert({
    id: `heloc-${helocData.id}`,
    user_id: USER_ID,
    date: transaction_date,
    merchant: txMerchant,
    account: 'Members 1st HELOC',
    amount: amt,
    category: txCategory,
    month,
    source: 'heloc',
  });
  if (txError) console.error('HELOC tx mirror failed:', txError.message);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supabase.from('heloc_transactions').delete().eq('id', id).eq('user_id', USER_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Also delete mirrored transaction record
  await supabase.from('transactions').delete().eq('id', `heloc-${id}`);
  return NextResponse.json({ success: true });
}