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

  const [{ data: snapshots }, { data: contributions }] = await Promise.all([
    supabase
      .from('retirement_snapshots')
      .select('*')
      .eq('user_id', USER_ID)
      .order('snapshot_date', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, date, merchant, amount, month')
      .eq('user_id', USER_ID)
      .eq('category', '401K')
      .order('date', { ascending: false }),
  ]);

  const totalContributions = (contributions || []).reduce(
    (sum, tx) => sum + parseFloat(String(tx.amount)), 0
  );

  const latestSnapshot = snapshots && snapshots.length > 0
    ? snapshots[snapshots.length - 1]
    : null;

  const currentBalance = latestSnapshot ? parseFloat(String(latestSnapshot.balance)) : 0;
  const impliedGrowth = currentBalance - totalContributions;
  const growthPct = totalContributions > 0 ? (impliedGrowth / totalContributions) * 100 : 0;

  // Group contributions by year-month for chart
  const byMonth: Record<string, number> = {};
  (contributions || []).forEach(tx => {
    const ym = tx.date.substring(0, 7);
    byMonth[ym] = (byMonth[ym] || 0) + parseFloat(String(tx.amount));
  });
  const monthlyContributions = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  return NextResponse.json({
    snapshots: snapshots || [],
    contributions: contributions || [],
    monthlyContributions,
    totalContributions,
    currentBalance,
    impliedGrowth,
    growthPct,
    latestSnapshot,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { snapshot_date, balance, notes } = await req.json();
  if (!snapshot_date || balance == null) {
    return NextResponse.json({ error: 'Date and balance are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('retirement_snapshots')
    .insert([{ user_id: USER_ID, snapshot_date, balance: parseFloat(String(balance)), notes: notes || null }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshot: data }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('retirement_snapshots')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}