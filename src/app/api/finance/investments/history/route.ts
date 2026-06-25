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
    .from('portfolio_snapshots')
    .select('snapshot_date, total_value, roth_ira_value, hsa_value, notes, id')
    .eq('user_id', USER_ID)
    .order('snapshot_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const points = (data || []).map(s => ({
    date: s.snapshot_date,
    value: parseFloat(String(s.total_value)),
  }));

  return NextResponse.json(
    { points, snapshots: data || [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { snapshot_date, total_value, roth_ira_value, hsa_value, notes } = await req.json();

  if (!snapshot_date || total_value == null) {
    return NextResponse.json({ error: 'Date and total value are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .insert([{
      user_id: USER_ID,
      snapshot_date,
      total_value: parseFloat(String(total_value)),
      roth_ira_value: roth_ira_value ? parseFloat(String(roth_ira_value)) : null,
      hsa_value: hsa_value ? parseFloat(String(hsa_value)) : null,
      notes: notes || null,
    }])
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

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('portfolio_snapshots')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}