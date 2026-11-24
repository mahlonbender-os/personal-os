import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { easternToday } from '@/lib/dates';
import {
  buildHealthTrends,
  toHealthTrendRow,
  trendQueryStart,
  parseHealthRange,
  type HealthLogInput,
} from '@/lib/healthTrends';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

const COLUMNS = [
  'log_date',
  'steps',
  'active_calories',
  'activity_minutes',
  'distance_km',
  'flights_climbed',
  'stand_hours',
  'sleep_total_hours',
  'sleep_duration_minutes',
  'resting_heart_rate',
  'hrv',
  'heart_rate_avg',
  'spo2',
  'respiratory_rate',
  'vo2_max',
].join(', ');

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requested = new URL(req.url).searchParams.get('range');
  const range = requested == null || requested === '' ? '30D' : parseHealthRange(requested);
  if (!range) {
    return NextResponse.json({ error: 'Range must be 30D, 90D, or 1Y' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = easternToday();
  const since = trendQueryStart(range, today);

  const { data, error } = await supabase
    .from('health_logs')
    .select(COLUMNS)
    .eq('user_id', USER_ID)
    .gte('log_date', since)
    .lte('log_date', today)
    .order('log_date', { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Weight, body composition, and nutrition columns are empty, so they are not selected.
  const rows = ((data || []) as unknown as HealthLogInput[]).map(toHealthTrendRow);
  return NextResponse.json(buildHealthTrends(rows, range, today), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
