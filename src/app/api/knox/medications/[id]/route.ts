import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { medication_name, medication_type, dosage, frequency, cost_per_dose, next_due_date, last_given_date, is_active, notes } = body;

  const { data, error } = await supabase
    .from('knox_medications')
    .update({
      medication_name,
      medication_type: medication_type || null,
      dosage: dosage || null,
      frequency: frequency || null,
      cost_per_dose: cost_per_dose ? parseFloat(cost_per_dose) : null,
      next_due_date: next_due_date || null,
      last_given_date: last_given_date || null,
      is_active: is_active !== undefined ? is_active : true,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', USER_ID)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from('knox_medications')
    .delete()
    .eq('id', params.id)
    .eq('user_id', USER_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}