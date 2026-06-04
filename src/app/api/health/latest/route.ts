import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Fetch last 30 days ────────────────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('health_logs')
    .select(`
      log_date,
      steps,
      active_calories,
      total_calories,
      bmr,
      distance_km,
      flights_climbed,
      activity_minutes,
      stand_hours,
      sleep_duration_minutes,
      sleep_total_hours,
      sleep_core_hours,
      sleep_deep_hours,
      sleep_rem_hours,
      sleep_awake_hours,
      sleep_in_bed_hours,
      heart_rate_avg,
      heart_rate_min,
      heart_rate_max,
      resting_heart_rate,
      hrv,
      weight_lbs,
      bmi,
      body_fat_pct,
      lean_body_mass_lbs,
      vo2_max,
      spo2,
      respiratory_rate,
      blood_pressure_systolic,
      blood_pressure_diastolic,
      blood_glucose,
      body_temperature,
      water_ml,
      calories_dietary,
      protein_g,
      carbs_g,
      fat_g
    `)
    .eq('user_id', USER_ID)
    .gte('log_date', since)
    .order('log_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const latest  = data?.[0] ?? null;               // most recent day
  const history = (data ?? []).slice(0, 7).reverse(); // 7 days oldest-first for charts

  return NextResponse.json({
    latest,
    history,  // 7 days for sparklines
    all: data, // 30 days for Trends tab
  });
}