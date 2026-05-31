import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

// GET — fetch goals with milestones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('goals')
      .select(`*, goal_milestones(*)`)
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ goals: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create goal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { milestones, ...goalData } = body;

    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .insert({ ...goalData, user_id: USER_ID })
      .select()
      .single();
    if (goalError) throw goalError;

    if (milestones && milestones.length > 0) {
      const milestoneRows = milestones.map((m: { title: string; due_date?: string }, i: number) => ({
        goal_id: goal.id,
        title: m.title,
        due_date: m.due_date || null,
        sort_order: i,
      }));
      await supabase.from('goal_milestones').insert(milestoneRows);
    }

    return NextResponse.json({ goal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — update goal
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (updates.status === 'completed' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
      updates.progress = 100;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', USER_ID)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ goal: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — delete goal
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', USER_ID);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}