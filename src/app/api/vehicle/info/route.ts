import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('vehicle_info')
      .select('*')
      .eq('user_id', USER_ID)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if a record already exists for this user
    const { data: existing } = await supabase
      .from('vehicle_info')
      .select('id')
      .eq('user_id', USER_ID)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('vehicle_info')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('user_id', USER_ID)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase
        .from('vehicle_info')
        .insert({ ...body, user_id: USER_ID })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}