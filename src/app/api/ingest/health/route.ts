import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────
  // Shortcut sends:  Authorization: Bearer <secret>
  // Also accepts:    x-ingest-secret: <secret>   (fallback)
  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const customSecret = request.headers.get('x-ingest-secret');
  const provided = bearerSecret || customSecret;

  if (provided !== process.env.HEALTH_INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log('[HAE payload]', JSON.stringify(body));
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Resolve the date ──────────────────────────────────────
  // Shortcut "Current Date" arrives as a long string — take the date part.
  // Falls back to today if anything is off.
  const rawDate = body.date ?? body.log_date ?? '';
  let logDate: string;
  const parsed = new Date(rawDate);
  if (rawDate && !isNaN(parsed.getTime())) {
    logDate = parsed.toISOString().split('T')[0];
  } else {
    logDate = new Date().toISOString().split('T')[0];
  }

  // ── Safe number parser ────────────────────────────────────
  const num = (...vals: any[]): number | null => {
    for (const v of vals) {
      const n = parseFloat(v);
      if (!isNaN(n)) return n;
    }
    return null;
  };

  // Same as num() but rounds to a whole number — for INTEGER columns.
  // Apple sums (e.g. calories) often come back as decimals like 787.122.
  const int = (...vals: any[]): number | null => {
    const n = num(...vals);
    return n === null ? null : Math.round(n);
  };

  // ── Build record ──────────────────────────────────────────
  // Each line reads the FLAT field name your Shortcut sends FIRST,
  // then falls back to other common formats for robustness.
  const record = {
    user_id:     USER_ID,
    log_date:    logDate,
    source:      'apple_watch_shortcut',
    raw_payload: body,

    // ── Activity ─────────────────────────────────────────────
    steps: int(body.steps, body.stepCount),
    active_calories: int(body.active_calories, body.activeCalories),
    total_calories: int(body.total_calories, body.totalCalories),
    bmr: num(body.bmr, body.basalMetabolicRate, body.resting_calories, body.restingCalories),
    distance_km: num(body.distance_km, body.distanceKm, body.distance),
    flights_climbed: int(body.flights_climbed, body.flightsClimbed),
    activity_minutes: int(body.activity_minutes, body.exercise_minutes, body.exerciseTime),
    stand_hours: int(body.stand_hours, body.standHours),

    // ── Sleep ─────────────────────────────────────────────────
    sleep_duration_minutes: (() => {
      const mins = num(body.sleep_duration_minutes, body.sleepMinutes);
      if (mins !== null) return mins;
      const hrs = num(body.sleep_total_hours, body.sleepTotal);
      return hrs !== null ? Math.round(hrs * 60) : null;
    })(),
    sleep_total_hours: num(body.sleep_total_hours, body.sleepTotal),
    sleep_core_hours:  num(body.sleep_core_hours, body.sleepCore),
    sleep_deep_hours:  num(body.sleep_deep_hours, body.sleepDeep),
    sleep_rem_hours:   num(body.sleep_rem_hours, body.sleepRem),
    sleep_awake_hours: num(body.sleep_awake_hours, body.sleepAwake),
    sleep_in_bed_hours: num(body.sleep_in_bed_hours, body.sleepInBed),

    // ── Heart ─────────────────────────────────────────────────
    resting_heart_rate: int(body.resting_heart_rate, body.restingHeartRate),
    heart_rate_avg: num(body.heart_rate_avg, body.heartRateAvg, body.heart_rate),
    heart_rate_min: num(body.heart_rate_min, body.heartRateMin),
    heart_rate_max: num(body.heart_rate_max, body.heartRateMax),
    hrv: num(body.hrv, body.heartRateVariability, body.HRV),

    // ── Body ──────────────────────────────────────────────────
    weight_lbs: num(body.weight_lbs, body.weightLbs, body.weight),
    bmi: num(body.bmi, body.BMI),
    body_fat_pct: num(body.body_fat_pct, body.bodyFat),
    lean_body_mass_lbs: num(body.lean_body_mass_lbs, body.leanBodyMass),
    vo2_max: num(body.vo2_max, body.vo2Max, body.VO2Max),

    // ── Vitals ────────────────────────────────────────────────
    spo2: num(body.spo2, body.blood_oxygen, body.oxygenSaturation, body.bloodOxygen),
    respiratory_rate: num(body.respiratory_rate, body.respiratoryRate),
    blood_pressure_systolic: num(body.blood_pressure_systolic, body.bloodPressureSystolic),
    blood_pressure_diastolic: num(body.blood_pressure_diastolic, body.bloodPressureDiastolic),
    blood_glucose: num(body.blood_glucose, body.bloodGlucose),
    body_temperature: num(body.body_temperature, body.bodyTemperature),

    // ── Nutrition ─────────────────────────────────────────────
    water_ml: num(body.water_ml, body.hydration, body.water),
    calories_dietary: num(body.calories_dietary, body.dietaryCalories),
    protein_g: num(body.protein_g, body.dietaryProtein),
    carbs_g: num(body.carbs_g, body.dietaryCarbohydrates),
    fat_g: num(body.fat_g, body.dietaryFatTotal),
  };

  // ── Upsert — one row per user per day ─────────────────────
  const { error } = await supabase
    .from('health_logs')
    .upsert(record, { onConflict: 'user_id,log_date' });

  if (error) {
    console.error('[health ingest] Supabase error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    log_date: logDate,
    fields_received: Object.keys(body),
  });
}