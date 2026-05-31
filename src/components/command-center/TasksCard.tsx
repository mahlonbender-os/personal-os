'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Check, Clock, ChevronRight } from 'lucide-react';

interface GoogleTask {
  id: string;
  title: string;
  status: string;
  due?: string;
}

function formatDue(iso: string): { label: string; urgent: boolean } {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { label: 'Today', urgent: true };
  if (diff === 1) return { label: 'Tomorrow', urgent: false };
  return { label: `${diff}d`, urgent: false };
}

export default function TasksCard() {
  const router = useRouter();
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch first list, show its pending tasks
    fetch('/api/tasks/lists')
      .then(r => r.json())
      .then(async d => {
        const lists = d.lists || [];
        if (lists.length === 0) return;
        const firstListId = lists[0].id;
        const res = await fetch(`/api/tasks/items?listId=${firstListId}&showCompleted=false`);
        const data = await res.json();
        setTasks((data.tasks || []).slice(0, 4));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleComplete = async (e: React.MouseEvent, task: GoogleTask, listId: string) => {
    e.stopPropagation();
    setTasks(prev => prev.filter(t => t.id !== task.id));
    await fetch('/api/tasks/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId, taskId: task.id, status: 'completed' }),
    });
  };

  return (
    <div
      className="bg-card border border-border rounded-2xl p-4 cursor-pointer"
      onClick={() => router.push('/tasks')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Tasks</span>
        </div>
        <div className="flex items-center gap-1">
          {tasks.length > 0 && (
            <span className="text-xs text-muted-foreground">{tasks.length} pending</span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-7 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-3">
          <Check className="w-5 h-5 mx-auto text-green-500 mb-1" />
          <p className="text-xs text-muted-foreground">All clear!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const due = task.due ? formatDue(task.due) : null;
            return (
              <div key={task.id} className="flex items-center gap-2.5">
                <button
                  onClick={(e) => toggleComplete(e, task, '')}
                  className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 hover:border-primary shrink-0"
                />
                <span className="text-sm flex-1 truncate">{task.title}</span>
                {due && (
                  <span className={`text-xs shrink-0 ${due.urgent ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    {due.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}