import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';

async function getAccessToken() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) throw new Error('No access token');
  return session.accessToken;
}

// GET — fetch all task lists
export async function GET() {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${TASKS_BASE}/users/@me/lists?maxResults=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    const data = await res.json();
    return NextResponse.json({ lists: data.items || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create a new task list
export async function POST(request: NextRequest) {
  try {
    const token = await getAccessToken();
    const { title } = await request.json();
    const res = await fetch(`${TASKS_BASE}/users/@me/lists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return NextResponse.json({ list: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}