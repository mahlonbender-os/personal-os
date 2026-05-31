import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';

async function getAccessToken() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) throw new Error('No access token');
  return session.accessToken;
}

// GET — fetch tasks in a list
export async function GET(request: NextRequest) {
  try {
    const token = await getAccessToken();
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('listId');
    const showCompleted = searchParams.get('showCompleted') === 'true';

    if (!listId) return NextResponse.json({ error: 'Missing listId' }, { status: 400 });

    const params = new URLSearchParams({
      maxResults: '100',
      showCompleted: showCompleted ? 'true' : 'false',
      showHidden: showCompleted ? 'true' : 'false',
    });

    const res = await fetch(`${TASKS_BASE}/lists/${listId}/tasks?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    // Google Tasks returns a flat list — build subtask tree
    const items = data.items || [];
    const topLevel = items.filter((t: GoogleTask) => !t.parent);
    const withSubs = topLevel.map((task: GoogleTask) => ({
      ...task,
      subtasks: items.filter((t: GoogleTask) => t.parent === task.id),
    }));

    return NextResponse.json({ tasks: withSubs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create a task
export async function POST(request: NextRequest) {
  try {
    const token = await getAccessToken();
    const { listId, title, notes, due, subtasks } = await request.json();

    if (!listId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Create the parent task
    const taskBody: Record<string, string> = { title };
    if (notes) taskBody.notes = notes;
    if (due) taskBody.due = new Date(due).toISOString();

    const res = await fetch(`${TASKS_BASE}/lists/${listId}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskBody),
    });
    if (!res.ok) throw new Error(await res.text());
    const task = await res.json();

    // Create subtasks if any
    if (subtasks && subtasks.length > 0) {
      for (const sub of subtasks) {
        if (!sub.title?.trim()) continue;
        await fetch(`${TASKS_BASE}/lists/${listId}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: sub.title, parent: task.id }),
        });
      }
    }

    return NextResponse.json({ task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — update a task (complete, edit, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const token = await getAccessToken();
    const { listId, taskId, ...updates } = await request.json();

    if (!listId || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Fetch current task first (Google requires full object for PATCH)
    const currentRes = await fetch(`${TASKS_BASE}/lists/${listId}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!currentRes.ok) throw new Error(await currentRes.text());
    const current = await currentRes.json();

    const updated = { ...current, ...updates };
    if (updates.status === 'completed') {
      updated.completed = new Date().toISOString();
    } else if (updates.status === 'needsAction') {
      updated.completed = null;
    }

    const res = await fetch(`${TASKS_BASE}/lists/${listId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updated),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return NextResponse.json({ task: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — delete a task
export async function DELETE(request: NextRequest) {
  try {
    const token = await getAccessToken();
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('listId');
    const taskId = searchParams.get('taskId');

    if (!listId || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const res = await fetch(`${TASKS_BASE}/lists/${listId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 204) throw new Error(await res.text());
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Type used above
interface GoogleTask {
  id: string;
  title: string;
  status: string;
  notes?: string;
  due?: string;
  completed?: string;
  parent?: string;
  position?: string;
}