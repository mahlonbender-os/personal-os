import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET all habits with active dynamic streak calculations
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabase();

    // Fetch habits
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: true });

    if (habitsError) throw habitsError;

    // Fetch completion logs
    const { data: logs, error: logsError } = await supabase
      .from('habit_logs')
      .select('habit_id, date')
      .eq('user_id', USER_ID);

    if (logsError) throw logsError;

    // Format local system date comparison parameters (YYYY-MM-DD)
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }); // Yields clean YYYY-MM-DD
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });

    const processedHabits = habits.map((habit) => {
      const habitLogs = logs
        .filter((l) => l.habit_id === habit.id)
        .map((l) => l.date)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const isCompletedToday = habitLogs.includes(todayStr);
      
      // Calculate active consecutive day tracking streaks
      let currentStreak = 0;
      let checkDate = isCompletedToday ? new Date() : yesterday;

      while (true) {
        const checkStr = checkDate.toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
        if (habitLogs.includes(checkStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      return {
        ...habit,
        isCompletedToday,
        currentStreak,
        history: habitLogs
      };
    });

    return NextResponse.json(processedHabits, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST toggles habit completions or logs fresh habits
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, name, description, habit_id } = body;
    const supabase = getSupabase();

    if (action === 'create') {
      if (!name) return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
      const { data, error } = await supabase
        .from('habits')
        .insert([{ user_id: USER_ID, name, description }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (action === 'toggle') {
      if (!habit_id) return NextResponse.json({ error: 'Missing habit_id parameter' }, { status: 400 });
      const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });

      // Check if entry exists for today
      const { data: existingLog } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('habit_id', habit_id)
        .eq('date', todayStr)
        .single();

      if (existingLog) {
        // Untoggle: delete log entry
        await supabase.from('habit_logs').delete().eq('id', existingLog.id);
        return NextResponse.json({ completed: false });
      } else {
        // Toggle: write completion log entry
        await supabase.from('habit_logs').insert([{ user_id: USER_ID, habit_id, date: todayStr }]);
        return NextResponse.json({ completed: true });
      }
    }

    return NextResponse.json({ error: 'Invalid operation action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE deletes a habit definition profile entirely
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const supabase = getSupabase();
    await supabase.from('habits').delete().eq('id', id).eq('user_id', USER_ID);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}