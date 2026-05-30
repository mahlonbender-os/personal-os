import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint receives nightly Apple Health data from your iOS Shortcut
export async function POST(req: NextRequest) {
  // Step 1: Check the secret key matches
  const authHeader = req.headers.get('authorization');
  const secret = process.env.HEALTH_INGEST_SECRET;

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Parse the incoming data
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

  // Step 3: Connect to Supabase using service role (bypasses RLS for server writes)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 4: Find your user ID from the database
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'mahlon.bender@gmail.com')
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Step 5: Upsert the health log (insert or update if date already exists)
  const { error } = await supabase
    .from('health_logs')
    .upsert({
      user_id: user.id,
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
    console.error('Supabase error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, date });
}