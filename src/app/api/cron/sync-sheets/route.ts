import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { performSheetsSync } from '@/lib/syncSheets';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

async function getAccessTokenFromRefreshToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${data.error || res.status}`);
  }
  return data.access_token as string;
}

export async function GET(request: NextRequest) {
  // Verify this is really Vercel's cron scheduler, not a random public hit.
  // Vercel automatically sends CRON_SECRET as this header on every cron invocation.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: tokenRow, error: tokenErr } = await supabase
      .from('google_oauth_tokens')
      .select('refresh_token')
      .eq('user_id', USER_ID)
      .single();

    if (tokenErr || !tokenRow?.refresh_token) {
      console.error(`[cron/sync-sheets] no_refresh_token_stored err=${tokenErr?.message}`);
      return NextResponse.json(
        { error: 'No stored Google refresh token — sign in to the app once to establish it' },
        { status: 500 }
      );
    }

    const accessToken = await getAccessTokenFromRefreshToken(tokenRow.refresh_token);
    const result = await performSheetsSync(accessToken);

    console.error(`[cron/sync-sheets] result=${JSON.stringify(result)}`);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err: any) {
    console.error(`[cron/sync-sheets] caught=${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}