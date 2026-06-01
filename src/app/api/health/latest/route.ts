import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'mahlon.bender@gmail.com')
      .single();

    if (!user) return NextResponse.json({ log: null });

    const { data } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ log: data });
  } catch (error) {
    return NextResponse.json({ log: null });
  }
}