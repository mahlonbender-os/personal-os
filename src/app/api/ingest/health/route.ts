import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const num = (...vals: any[]): number | null => {
    for (const v of vals) {
      const n = parseFloat(v);
      if (!isNaN(n)) return n;
    }
    return null;
  };

  const int = (...vals: any[]): number | null => {
    const n = num(...vals);
    return n === null ? null : Math.round(n);
  };

  // ── Health Auto Export format (nested metrics array) ──────
  if (body?.data?.metrics) {
    const metrics: any[] = body.data.metrics;

    // Build lookup: metric name → data array
    const metricMap: Record<string, any[]> = {};
    for (const m of metrics) {
      metricMap[m.name] = m.data || [];
    }

    // Sum qty across all data points for a metric (steps, calories, etc.)
    const qtySum = (name: string): number | null => {
      const data = metricMap[name];
      if (!data || data.length === 0) return null;
      const vals = data.map((d: any) => parseFloat(d.qty)).filter((n: number) => !isNaN(n));
      if (vals.length === 0) return null;
      return vals.reduce((a: number, b: number) => a + b, 0);
    };

    // Average qty across all data points (heart rate variability, SpO2, etc.)
    const qtyAvg = (name: string): number | null => {
      const data = metricMap[name];
      if (!data || data.length === 0) return null;
      const vals = data.map((d: any) => parseFloat(d.qty)).filter((n: number) => !isNaN(n));
      if (vals.length === 0) return null;
      return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
    };

    // Latest single qty value (vo2_max, resting_heart_rate)
    const qtyLatest = (name: string): number | null => {
      const data = metricMap[name];
      if (!data || data.length === 0) return null;
      const last = data[data.length - 1];
      const n = parseFloat(last.qty);
      return isNaN(n) ? null : n;
    };

    // Extract date from first metric entry — format: "2026-06-01 00:00:00 -0400"
    let logDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
    for (const m of metrics) {
      if (m.data && m.data.length > 0 && m.data[0].date) {
        logDate = m.data[0].date.substring(0, 10);
        break;
      }
    }

    // Sleep analysis — sum all sessions for the day
    const sleepData = metricMap['sleep_analysis'] || [];
    const sleep = sleepData.reduce(
      (acc: any, s: any) => ({
        asleep: acc.asleep + (parseFloat(s.asleep) || 0),
        core:   acc.core   + (parseFloat(s.core)   || 0),
        deep:   acc.deep   + (parseFloat(s.deep)   || 0),
        rem:    acc.rem    + (parseFloat(s.rem)     || 0),
        awake:  acc.awake  + (parseFloat(s.awake)  || 0),
        inBed:  acc.inBed  + (parseFloat(s.inBed)  || 0),
      }),
      { asleep: 0, core: 0, deep: 0, rem: 0, awake: 0, inBed: 0 }
    );
    const hasSleep = sleepData.length > 0;

    // Heart rate — uses Avg/Min/Max keys instead of qty
    const hrData = metricMap['heart_rate'] || [];
    const hrAvg = hrData.length > 0
      ? hrData.map((d: any) => parseFloat(d.Avg)).filter((n: number) => !isNaN(n))
          .reduce((a: number, b: number, _: any, arr: number[]) => a + b / arr.length, 0)
      : null;
    const hrMins = hrData.map((d: any) => parseFloat(d.Min)).filter((n: number) => !isNaN(n));
    const hrMaxs = hrData.map((d: any) => parseFloat(d.Max)).filter((n: number) => !isNaN(n));
    const hrMin = hrMins.length > 0 ? Math.min(...hrMins) : null;
    const hrMax = hrMaxs.length > 0 ? Math.max(...hrMaxs) : null;

    // Total calories = active + basal
    const activeCals = qtySum('active_energy');
    const basalCals  = qtySum('basal_energy_burned');
    const totalCals  = activeCals !== null && basalCals !== null
      ? activeCals + basalCals
      : activeCals ?? basalCals;

    const record = {
      user_id:  USER_ID,
      log_date: logDate,
      source:   'health_auto_export',
      raw_payload: body,

      // Activity
      steps:            int(qtySum('step_count')),
      active_calories:  int(activeCals),
      total_calories:   int(totalCals),
      bmr:              num(basalCals),
      distance_km:      num(qtySum('walking_running_distance')),
      flights_climbed:  int(qtySum('flights_climbed')),
      activity_minutes: int(qtySum('apple_exercise_time')),
      stand_hours:      int(qtySum('apple_stand_hour')),

      // Sleep
      sleep_total_hours:    hasSleep ? sleep.asleep || null : null,
      sleep_core_hours:     hasSleep ? sleep.core   || null : null,
      sleep_deep_hours:     hasSleep ? sleep.deep   || null : null,
      sleep_rem_hours:      hasSleep ? sleep.rem    || null : null,
      sleep_awake_hours:    hasSleep ? sleep.awake  || null : null,
      sleep_in_bed_hours:   hasSleep ? sleep.inBed  || null : null,
      sleep_duration_minutes: hasSleep ? Math.round(sleep.asleep * 60) || null : null,

      // Heart
      heart_rate_avg:     hrAvg,
      heart_rate_min:     hrMin,
      heart_rate_max:     hrMax,
      resting_heart_rate: int(qtyLatest('resting_heart_rate')),
      hrv:                num(qtyAvg('heart_rate_variability')),

      // Vitals
      spo2:             num(qtyAvg('blood_oxygen_saturation')),
      respiratory_rate: num(qtyAvg('respiratory_rate')),
      vo2_max:          num(qtyLatest('vo2_max')),
    };

    const { error } = await supabase
      .from('health_logs')
      .upsert(record, { onConflict: 'user_id,log_date' });

    if (error) {
      console.error('[health ingest] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, log_date: logDate, source: 'health_auto_export' });
  }

  // ── Legacy flat format (old iOS Shortcut) ─────────────────
  const rawDate = body.date ?? body.log_date ?? '';
  let logDate: string;
  const parsed = new Date(rawDate);
  if (rawDate && !isNaN(parsed.getTime())) {
    logDate = parsed.toISOString().split('T')[0];
  } else {
    logDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
  }

  const record = {
    user_id:     USER_ID,
    log_date:    logDate,
    source:      'apple_watch_shortcut',
    raw_payload: body,

    steps:            int(body.steps, body.stepCount),
    active_calories:  int(body.active_calories, body.activeCalories),
    total_calories:   int(body.total_calories, body.totalCalories),
    bmr:              num(body.bmr, body.basalMetabolicRate),
    distance_km:      num(body.distance_km, body.distanceKm),
    flights_climbed:  int(body.flights_climbed, body.flightsClimbed),
    activity_minutes: int(body.activity_minutes, body.exercise_minutes, body.exerciseTime),
    stand_hours:      int(body.stand_hours, body.standHours),

    sleep_duration_minutes: (() => {
      const mins = num(body.sleep_duration_minutes, body.sleepMinutes);
      if (mins !== null) return mins;
      const hrs = num(body.sleep_total_hours, body.sleepTotal);
      return hrs !== null ? Math.round(hrs * 60) : null;
    })(),
    sleep_total_hours:  num(body.sleep_total_hours, body.sleepTotal),
    sleep_core_hours:   num(body.sleep_core_hours,  body.sleepCore),
    sleep_deep_hours:   num(body.sleep_deep_hours,  body.sleepDeep),
    sleep_rem_hours:    num(body.sleep_rem_hours,   body.sleepRem),
    sleep_awake_hours:  num(body.sleep_awake_hours, body.sleepAwake),
    sleep_in_bed_hours: num(body.sleep_in_bed_hours, body.sleepInBed),

    resting_heart_rate: int(body.resting_heart_rate, body.restingHeartRate),
    heart_rate_avg:     num(body.heart_rate_avg, body.heartRateAvg, body.heart_rate),
    heart_rate_min:     num(body.heart_rate_min, body.heartRateMin),
    heart_rate_max:     num(body.heart_rate_max, body.heartRateMax),
    hrv:                num(body.hrv, body.heartRateVariability, body.HRV),

    spo2:             num(body.spo2, body.blood_oxygen, body.oxygenSaturation, body.bloodOxygen),
    respiratory_rate: num(body.respiratory_rate, body.respiratoryRate),
    vo2_max:          num(body.vo2_max, body.vo2Max, body.VO2Max),

    weight_lbs:          num(body.weight_lbs, body.weightLbs),
    bmi:                 num(body.bmi, body.BMI),
    body_fat_pct:        num(body.body_fat_pct, body.bodyFat),
    lean_body_mass_lbs:  num(body.lean_body_mass_lbs, body.leanBodyMass),
    blood_pressure_systolic:  num(body.blood_pressure_systolic,  body.bloodPressureSystolic),
    blood_pressure_diastolic: num(body.blood_pressure_diastolic, body.bloodPressureDiastolic),
    blood_glucose:    num(body.blood_glucose,    body.bloodGlucose),
    body_temperature: num(body.body_temperature, body.bodyTemperature),
    water_ml:         num(body.water_ml, body.hydration),
    calories_dietary: num(body.calories_dietary, body.dietaryCalories),
    protein_g:        num(body.protein_g,  body.dietaryProtein),
    carbs_g:          num(body.carbs_g,    body.dietaryCarbohydrates),
    fat_g:            num(body.fat_g,      body.dietaryFatTotal),
  };

  const { error } = await supabase
    .from('health_logs')
    .upsert(record, { onConflict: 'user_id,log_date' });

  if (error) {
    console.error('[health ingest] Supabase error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, log_date: logDate, source: 'apple_watch_shortcut' });
}