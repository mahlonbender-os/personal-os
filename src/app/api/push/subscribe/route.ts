import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { subscription } = await request.json();

    if (!subscription) {
      return NextResponse.json({ error: 'Missing subscription parameter payload' }, { status: 400 });
    }

    // Direct initialization of server client matching your other fleet and warranty endpoints
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Save the device configuration token right to Postgres
    const { error } = await supabase
      .from('push_subscriptions')
      .insert([
        {
          subscription_json: subscription,
          user_id: 'b0572935-26c9-44b5-8645-229bf5b78743', // Fixed matching master profile criteria
        }
      ]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Subscription sync failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}