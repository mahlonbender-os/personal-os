import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [
    { data: weights },
    { data: profile },
    { data: vaccines },
    { data: medications },
  ] = await Promise.all([
    supabase.from('knox_weight_log').select('weight_lbs,log_date').eq('user_id', USER_ID).order('log_date', { ascending: false }).limit(1),
    supabase.from('knox_profile').select('next_vet_date,next_vet_notes').eq('user_id', USER_ID).single(),
    supabase.from('knox_vaccinations').select('vaccine_name,next_due_date').eq('user_id', USER_ID).not('next_due_date', 'is', null).order('next_due_date', { ascending: true }).limit(1),
    supabase.from('knox_medications').select('medication_name,next_due_date').eq('user_id', USER_ID).eq('is_active', true).not('next_due_date', 'is', null).order('next_due_date', { ascending: true }).limit(1),
  ]);

  return NextResponse.json({
    latestWeight: weights?.[0] ?? null,
    nextVetDate: profile?.next_vet_date ?? null,
    nextVetNotes: profile?.next_vet_notes ?? null,
    nextVaccine: vaccines?.[0] ?? null,
    nextMedication: medications?.[0] ?? null,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { next_vet_date, next_vet_notes } = await req.json();

  // Upsert profile row
  const { error } = await supabase.from('knox_profile').upsert({
    user_id: USER_ID,
    next_vet_date: next_vet_date || null,
    next_vet_notes: next_vet_notes || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}