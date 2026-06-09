'use client';

import PullToRefresh from '@/components/PullToRefresh';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EditTaskModal from '@/components/EditTaskModal';
import {
  ArrowLeft, Plus, Check, ChevronDown,
  X, Clock, Eye, EyeOff, List, CheckSquare,
} from 'lucide-react';

interface GoogleTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  notes?: string;
  due?: string;
  completed?: string;
  subtasks?: GoogleTask[];
}

interface TaskList {
  id: string;
  title: string;
}

function formatDue(iso: string): { label: string; urgent: boolean; overdue: boolean } {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true, overdue: true };
  if (diff === 0) return { label: 'Today', urgent: true, overdue: false };
  if (diff === 1) return { label: 'Tomorrow', urgent: false, overdue: false };
  return {
    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    urgent: false,
    overdue: false,
  };
}

export default function TasksPage() {
  const router = useRouter();
  const [lists, setLists] = useState<TaskList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [editingTask, setEditingTask] = useState<GoogleTask | null>(null);

  useEffect(() => {
    fetch('/api/tasks/lists')
      .then(r => r.json())
      .then(d => {
        const fetchedLists = d.lists || [];
        setLists(fetchedLists);
        if (fetchedLists.length > 0) {
          const preferred = fetchedLists.find((l: { id: string; title: string }) => l.title === 'Personal OS');
          setActiveListId((preferred || fetchedLists[0]).id);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingLists(false));
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!activeListId) return;
    setLoadingTasks(true);
    try {
      const res = await fetch(`/api/tasks/items?listId=${activeListId}&showCompleted=${showCompleted}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTasks(false);
    }
  }, [activeListId, showCompleted]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const activeList = lists.find(l => l.id === activeListId);
  const pendingCount = tasks.filter(t => t.status === 'needsAction').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  const toggleComplete = async (task: GoogleTask) => {
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    setTasks(prev =>
      prev.map(t => t.id === task.id ? { ...t, status: newStatus as GoogleTask['status'] } : t)
    );
    await fetch('/api/tasks/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: activeListId, taskId: task.id, status: newStatus }),
    });
    fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setExpandedTaskId(null);
    await fetch(`/api/tasks/items?listId=${activeListId}&taskId=${taskId}`, { method: 'DELETE' });
    fetchTasks();
  };

  const createList = async () => {
    if (!newListTitle.trim()) return;
    setCreatingList(true);
    try {
      const res = await fetch('/api/tasks/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newListTitle.trim() }),
      });
      const data = await res.json();
      if (data.list) {
        setLists(prev => [...prev, data.list]);
        setActiveListId(data.list.id);
      }
      setNewListTitle('');
      setShowNewList(false);
      setShowListPicker(false);
    } finally {
      setCreatingList(false);
    }
  };

  const displayedTasks = showCompleted ? tasks : tasks.filter(t => t.status === 'needsAction');

  return (
    <div className="min-h-screen bg-background">
      <PullToRefresh onRefresh={async () => { await fetchTasks(); }}>
        <div className="pb-24">

          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
            <div className="flex items-center gap-3 px-4 pt-14 pb-3">
              <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowListPicker(!showListPicker)}
                className="flex items-center gap-1.5 flex-1 min-w-0"
              >
                <h1 className="text-xl font-semibold truncate">
                  {loadingLists ? 'Tasks' : (activeList?.title || 'Tasks')}
                </h1>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${showListPicker ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className={`p-2 rounded-full transition-colors ${showCompleted ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
              >
                {showCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowAddTask(true)}
                className="bg-primary text-primary-foreground rounded-full p-2"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {!loadingLists && activeList && (
              <div className="flex items-center gap-3 px-4 pb-3">
                <span className="text-xs text-muted-foreground">{pendingCount} pending</span>
                {completedCount > 0 && (
                  <span className="text-xs text-muted-foreground">· {completedCount} completed</span>
                )}
              </div>
            )}
          </div>

          {/* List picker */}
          {showListPicker && (
            <div className="mx-4 mt-2 bg-card border border-border rounded-2xl overflow-hidden shadow-lg z-20 relative">
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => { setActiveListId(list.id); setShowListPicker(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/50 last:border-0 ${
                    list.id === activeListId ? 'bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <List className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium flex-1">{list.title}</span>
                  {list.id === activeListId && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
              {showNewList ? (
                <div className="px-4 py-3 flex gap-2 border-t border-border">
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={e => setNewListTitle(e.target.value)}
                    placeholder="List name"
                    className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && createList()}
                  />
                  <button
                    onClick={createList}
                    disabled={!newListTitle.trim() || creatingList}
                    className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {creatingList ? '…' : 'Add'}
                  </button>
                  <button onClick={() => setShowNewList(false)} className="p-2 text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewList(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-primary border-t border-border"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">New list</span>
                </button>
              )}
            </div>
          )}

          {/* Task list */}
          <div className="px-4 py-3 space-y-1">
            {loadingTasks ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-xl animate-pulse mb-2" />
              ))
            ) : displayedTasks.length === 0 ? (
              <div className="text-center py-16">
                <CheckSquare className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {showCompleted ? 'No tasks' : 'Nothing pending'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">Tap + to add a task</p>
              </div>
            ) : (
              displayedTasks.map(task => {
                const due = task.due ? formatDue(task.due) : null;
                const completed = task.status === 'completed';
                const expanded = expandedTaskId === task.id;

                return (
                  <div key={task.id}>
                    {/* Main task row */}
                    <div className={`flex items-center gap-3 rounded-xl px-1 py-2.5 ${completed ? 'opacity-50' : ''}`}>
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleComplete(task)}
                        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          completed ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary'
                        }`}
                      >
                        {completed && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>

                      {/* Content */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => !completed && setExpandedTaskId(expanded ? null : task.id)}
                      >
                        <p className={`text-sm leading-snug ${completed ? 'line-through text-muted-foreground' : 'text-white'}`}>
                          {task.title}
                        </p>
                        {due && !expanded && (
                          <span className={`text-xs flex items-center gap-0.5 mt-0.5 ${
                            due.overdue ? 'text-[#ef4444]' : due.urgent ? 'text-[#f0a050]' : 'text-[#555]'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {due.label}
                          </span>
                        )}
                      </div>

                      {/* Chevron */}
                      {!completed && (
                        <svg
                          width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                          onClick={() => setExpandedTaskId(expanded ? null : task.id)}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      )}
                    </div>

                    {/* Inline expanded panel */}
                    {expanded && (
                      <div className="ml-8 mb-2 bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
                        {(task.notes || due) && (
                          <div className="px-4 py-3 border-b border-[#1a1a1a] space-y-1">
                            {due && (
                              <p className={`text-xs flex items-center gap-1 ${
                                due.overdue ? 'text-[#ef4444]' : due.urgent ? 'text-[#f0a050]' : 'text-[#555]'
                              }`}>
                                <Clock className="w-3 h-3" />
                                {due.overdue ? 'Overdue · ' : ''}{due.label}
                              </p>
                            )}
                            {task.notes && (
                              <p className="text-[11px] text-[#555] whitespace-pre-wrap">{task.notes}</p>
                            )}
                          </div>
                        )}
                        <div className="flex">
                          <button
                            onClick={() => { setEditingTask(task); setExpandedTaskId(null); }}
                            className="flex-1 py-3 text-sm font-semibold text-[#f0a050] border-r border-[#1a1a1a] active:bg-[#1a1a1a]"
                          >
                            Edit Task
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="flex-1 py-3 text-sm font-semibold text-[#ef4444] active:bg-[#1a1a1a]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Subtasks (indented) */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="ml-8 space-y-0.5 mb-1">
                        {task.subtasks
                          .filter(s => showCompleted || s.status === 'needsAction')
                          .map(sub => (
                            <div key={sub.id} className={`flex items-center gap-2.5 py-1.5 ${sub.status === 'completed' ? 'opacity-50' : ''}`}>
                              <button
                                onClick={() => toggleComplete(sub)}
                                className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  sub.status === 'completed' ? 'bg-primary border-primary' : 'border-muted-foreground/30 hover:border-primary'
                                }`}
                              >
                                {sub.status === 'completed' && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </button>
                              <span className={`text-xs ${sub.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                {sub.title}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Task Sheet */}
          {showAddTask && activeListId && (
            <AddTaskSheet
              listId={activeListId}
              onClose={() => setShowAddTask(false)}
              onSave={() => { setShowAddTask(false); fetchTasks(); }}
            />
          )}

          {/* Edit Task Modal */}
          {editingTask && activeListId && (
            <EditTaskModal
              task={editingTask}
              taskListId={activeListId}
              onClose={() => setEditingTask(null)}
              onSaved={(updated) => {
                setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
                setEditingTask(null);
                fetchTasks();
              }}
            />
          )}

        </div>
      </PullToRefresh>
    </div>
  );
}

// ─── Add Task Sheet ───────────────────────────────────────────────────────────

function AddTaskSheet({ listId, onClose, onSave }: {
  listId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const addSubtask = () => setSubtasks([...subtasks, '']);
  const updateSubtask = (i: number, val: string) => {
    const updated = [...subtasks];
    updated[i] = val;
    setSubtasks(updated);
  };
  const removeSubtask = (i: number) => setSubtasks(subtasks.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let due: string | undefined;
      if (dueDate) {
        due = dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T00:00:00`;
      }
      await fetch('/api/tasks/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId,
          title: title.trim(),
          notes: notes.trim() || undefined,
          due,
          subtasks: subtasks.filter(s => s.trim()).map(s => ({ title: s.trim() })),
        }),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      <div className="w-full bg-background rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mt-3" />
        <div className="px-4 pt-4 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">New Task</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add details..."
                rows={3}
                className="w-full mt-1.5 bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  className="w-full mt-1.5 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subtasks</label>
              <div className="space-y-2 mt-1.5">
                {subtasks.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    <input
                      type="text"
                      value={s}
                      onChange={e => updateSubtask(i, e.target.value)}
                      placeholder={`Subtask ${i + 1}`}
                      className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button onClick={() => removeSubtask(i)} className="p-1 text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addSubtask}
                  className="text-xs text-primary flex items-center gap-1 pl-5 mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add subtask
                </button>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}