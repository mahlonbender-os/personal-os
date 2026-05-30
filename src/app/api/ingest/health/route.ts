import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  // Check the secret key
  const authHeader = req.headers.get('authorization');
  const secret = process.env.HEALTH_INGEST_SECRET;

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse the incoming data
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    date,
    steps,
    sleep_duration_minutes,
    resting_heart_rate,
    activity_minutes,
    active_calories,
  } = body;

  if (!date) {
    return NextResponse.json({ error: 'Missing date field' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Hardcoded user ID -- skip the lookup
  const userId = 'b0572935-26c9-44b5-8645-229bf5b78743';

  // Helper to convert empty strings to null
const clean = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? null : Math.round(num);
};

const { error } = await supabase
    .from('health_logs')
    .upsert({
      user_id: userId,
      log_date: date,
      steps: clean(steps),
      sleep_duration_minutes: clean(sleep_duration_minutes),
      resting_heart_rate: clean(resting_heart_rate),
      activity_minutes: clean(activity_minutes),
      active_calories: clean(active_calories),
      source: 'apple_health',
    }, {
      onConflict: 'user_id,log_date',
    });

  if (error) {
    console.error('Supabase error:', JSON.stringify(error));
    return NextResponse.json({ error: 'Database error', details: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, date });
}