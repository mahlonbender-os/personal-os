'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Check, Clock, ChevronRight } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  due_date?: string;
  category: string;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
};

function formatDue(dateStr: string): { label: string; urgent: boolean } {
  const date = new Date(dateStr + 'T00:00:00');
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tasks?status=pending&limit=4')
      .then(r => r.json())
      .then(d => setTasks(d.tasks || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleComplete = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: 'completed' }),
    });
    setTasks(prev => prev.filter(t => t.id !== task.id));
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
            <div key={i} className="h-8 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-4">
          <Check className="w-6 h-6 mx-auto text-green-500 mb-1" />
          <p className="text-xs text-muted-foreground">All clear!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const due = task.due_date ? formatDue(task.due_date) : null;
            return (
              <div key={task.id} className="flex items-center gap-2.5">
                <button
                  onClick={(e) => toggleComplete(e, task)}
                  className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 hover:border-primary shrink-0 flex items-center justify-center"
                />
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                <span className="text-sm flex-1 truncate">{task.title}</span>
                {due && (
                  <span className={`text-xs shrink-0 ${due.urgent ? 'text-red-500' : 'text-muted-foreground'}`}>
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