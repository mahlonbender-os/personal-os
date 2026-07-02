import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(req.url);
  const tag = searchParams.get('tag');

  let query = supabase
    .from('journal_entries')
    .select('id, entry_date, title, content, tags, created_at, updated_at')
    .eq('user_id', USER_ID)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (tag && tag !== 'All') {
    query = query.contains('tags', [tag]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notes: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { title, content, tags, entry_date } = await req.json();
  if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: USER_ID,
      title: title || null,
      content,
      tags: tags || [],
      entry_date: entry_date || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }),
      mood_score: null,
      is_weekly_review: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { id, title, content, tags, entry_date } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('journal_entries')
    .update({ title: title || null, content, tags, entry_date, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', USER_ID)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}