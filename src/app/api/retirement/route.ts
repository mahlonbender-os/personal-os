import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { easternToday } from '@/lib/dates';
import { buildRetirementPayload, parseRetirementBalance } from '@/lib/retirement';

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
    .from('retirement_snapshots')
    .select('snapshot_date, balance')
    .eq('user_id', USER_ID)
    .order('snapshot_date', { ascending: true })
    .limit(10000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const snapshots = (data || []).flatMap((row) => {
    const balance = parseRetirementBalance(row.balance);
    if (balance == null) return [];
    return [{ date: String(row.snapshot_date).slice(0, 10), balance }];
  });

  return NextResponse.json(buildRetirementPayload(snapshots, easternToday()), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
