import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

// GET — fetch tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = searchParams.get('limit');

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', USER_ID)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (limit) query = query.limit(parseInt(limit));

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tasks: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...body, user_id: USER_ID })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — update task
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (updates.status === 'completed' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', USER_ID)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — delete task
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase
      .from('tasks')
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