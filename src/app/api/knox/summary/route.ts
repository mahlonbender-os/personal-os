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

  try {
    const { data: weightData } = await supabase
      .from('knox_weight_log')
      .select('log_date, weight_lbs')
      .eq('user_id', USER_ID)
      .order('log_date', { ascending: false })
      .limit(1);

    const { data: vetData } = await supabase
      .from('knox_vet_visits')
      .select('next_visit_date, next_visit_time')
      .eq('user_id', USER_ID)
      .not('next_visit_date', 'is', null)
      .order('date', { ascending: false })
      .limit(1);

    const { data: medsData } = await supabase
      .from('knox_medications')
      .select('medication_name, next_due_date, medication_type')
      .eq('user_id', USER_ID)
      .eq('is_active', true)
      .not('next_due_date', 'is', null)
      .order('next_due_date', { ascending: true })
      .limit(3);

    return NextResponse.json(
      {
        latestWeight: weightData?.[0] || null,
        nextVet: vetData?.[0] || null,
        medications: medsData || [],
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}