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
    .from('knox_vet_visits')
    .select('*')
    .eq('user_id', USER_ID)
    .order('date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { date, visit_type, vet_name, cost, notes, next_visit_date, next_visit_time } = body;

  const { data, error } = await supabase
    .from('knox_vet_visits')
    .insert({
      user_id: USER_ID,
      date,
      visit_type,
      vet_name: vet_name || null,
      cost: cost != null ? cost : null,
      notes: notes || null,
      next_visit_date: next_visit_date || null,
      next_visit_time: next_visit_time || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}