import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET() {
  const { data, error } = await supabase
    .from('bills')
    .select('id, name, category, amount, due_day, due_date, payment_account, status')
    .eq('user_id', USER_ID)
    .order('due_day', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bills: data || [] });
}