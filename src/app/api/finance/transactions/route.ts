import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // e.g. "April 2026"
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '200');

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', USER_ID)
    .order('date', { ascending: false })
    .limit(limit);

  if (month) query = query.eq('month', month);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: data || [] });
}