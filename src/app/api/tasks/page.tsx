'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Check, Trash2, Circle, Clock, Flag, Tag, ChevronDown, X, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  due_date?: string;
  due_time?: string;
  completed_at?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' },
  high:   { label: 'High',   color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  low:    { label: 'Low',    color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30', dot: 'bg-blue-400' },
};

const CATEGORIES = ['personal', 'work', 'home', 'health', 'finance', 'knox', 'shopping', 'other'];

function formatDueDate(dateStr: string): { label: string; urgent: boolean; overdue: boolean } {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true, overdue: true };
  if (diff === 0) return { label: 'Today', urgent: true, overdue: false };
  if (diff === 1) return { label: 'Tomorrow', urgent: true, overdue: false };
  if (diff <= 7) return { label: `${diff}d`, urgent: false, overdue: false };
  return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), urgent: false, overdue: false };
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('pending');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter, categoryFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const toggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    });
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 pt-14 pb-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Tasks</h1>
            {pendingCount > 0 && (
              <p className="text-xs text-muted-foreground">{pendingCount} remaining</p>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full hover:bg-muted ${showFilters ? 'bg-muted' : ''}`}
          >
            <Tag className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditingTask(null); setShowAddModal(true); }}
            className="bg-primary text-primary-foreground rounded-full p-2"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Status filters */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {(['pending', 'in_progress', 'all', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Category filters */}
        {showFilters && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide border-t border-border pt-3">
            {['all', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  categoryFilter === cat
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <Check className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No tasks here</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Tap + to add one</p>
          </div>
        ) : (
          tasks.map(task => {
            const p = PRIORITY_CONFIG[task.priority];
            const due = task.due_date ? formatDueDate(task.due_date) : null;
            const completed = task.status === 'completed';

            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 bg-card rounded-xl p-3.5 border transition-opacity ${
                  completed ? 'opacity-50 border-border/50' : 'border-border'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete(task)}
                  className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    completed
                      ? 'bg-primary border-primary'
                      : `border-muted-foreground/40 hover:border-primary`
                  }`}
                >
                  {completed && <Check className="w-3 h-3 text-primary-foreground" />}
                </button>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => { setEditingTask(task); setShowAddModal(true); }}
                >
                  <p className={`text-sm font-medium leading-snug ${completed ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Priority dot */}
                    <span className={`inline-flex items-center gap-1 text-xs ${p.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                      {p.label}
                    </span>
                    {/* Category */}
                    <span className="text-xs text-muted-foreground capitalize">{task.category}</span>
                    {/* Due date */}
                    {due && (
                      <span className={`text-xs flex items-center gap-0.5 ${
                        due.overdue ? 'text-red-500' : due.urgent ? 'text-orange-500' : 'text-muted-foreground'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {due.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1.5 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <TaskModal
          task={editingTask}
          onClose={() => { setShowAddModal(false); setEditingTask(null); }}
          onSave={() => { setShowAddModal(false); setEditingTask(null); fetchTasks(); }}
        />
      )}
    </div>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({ task, onClose, onSave }: {
  task: Task | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<Task['priority']>(task?.priority || 'medium');
  const [category, setCategory] = useState(task?.category || 'personal');
  const [dueDate, setDueDate] = useState(task?.due_date || '');
  const [notes, setNotes] = useState(task?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body = {
        ...(task ? { id: task.id } : {}),
        title: title.trim(),
        description: description.trim() || null,
        priority,
        category,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      };
      await fetch('/api/tasks', {
        method: task ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      <div className="w-full bg-background rounded-t-2xl max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mt-3" />

        <div className="px-4 pt-4 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">{task ? 'Edit Task' : 'New Task'}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full mt-1.5 bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional details..."
                rows={2}
                className="w-full mt-1.5 bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {(Object.keys(PRIORITY_CONFIG) as Array<keyof typeof PRIORITY_CONFIG>).map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                      priority === p
                        ? `${PRIORITY_CONFIG[p].bg} ${PRIORITY_CONFIG[p].border} ${PRIORITY_CONFIG[p].color}`
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                      category === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full mt-1.5 bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full mt-1.5 bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 mt-2"
            >
              {saving ? 'Saving…' : task ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}