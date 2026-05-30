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

  const { error } = await supabase
    .from('health_logs')
    .upsert({
      user_id: userId,
      log_date: date,
      steps: steps ?? null,
      sleep_duration_minutes: sleep_duration_minutes ?? null,
      resting_heart_rate: resting_heart_rate ?? null,
      activity_minutes: activity_minutes ?? null,
      active_calories: active_calories ?? null,
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