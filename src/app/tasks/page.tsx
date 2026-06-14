'use client';

import PullToRefresh from '@/components/PullToRefresh';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EditTaskModal from '@/components/EditTaskModal';
import BottomNav from '@/components/BottomNav';
import {
  ArrowLeft, Check, ChevronDown,
  X, Clock, Eye, EyeOff, List, CheckSquare, Plus
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
    <>
      <PullToRefresh onRefresh={async () => { await fetchTasks(); }}>
        <div className="pb-24 min-h-screen bg-black text-white">

          {/* Sticky Header Row */}
          <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2 px-4 pt-14 pb-3">
              <button onClick={() => router.push('/more')} className="p-2 -ml-2 rounded-full text-[#555] active:text-[#f0a050]">
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowListPicker(!showListPicker)}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left outline-none"
              >
                <h1 className="text-xl font-bold truncate text-white" style={{ fontFamily: 'Syne, system-ui, sans-serif' }}>
                  {loadingLists ? 'Tasks' : (activeList?.title || 'Tasks')}
                </h1>
                <ChevronDown className={`w-4 h-4 text-[#555] shrink-0 transition-transform ${showListPicker ? 'rotate-180' : ''}`} />
              </button>
              
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className={`p-2 rounded-full transition-colors ${showCompleted ? 'text-[#f0a050]' : 'text-[#444]'}`}
              >
                {showCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>

              {/* Premium inline amber header button */}
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(8);
                  setShowAddTask(true);
                }}
                className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1 ml-1"
              >
                Add Task
              </button>
            </div>
            
            {!loadingLists && activeList && (
              <div className="flex items-center gap-3 px-4 pb-3 text-[11px] font-mono text-[#555] uppercase tracking-wider">
                <span>{pendingCount} pending</span>
                {completedCount > 0 && (
                  <span>· {completedCount} completed</span>
                )}
              </div>
            )}
          </div>

          {/* Slide Down List Picker Registry Overlay Deck */}
          {showListPicker && (
            <div className="mx-4 mt-2 bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl z-40 relative">
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => { setActiveListId(list.id); setShowListPicker(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-[#1a1a1a]/40 last:border-0 active:bg-black/40 ${
                    list.id === activeListId ? 'bg-black/30' : ''
                  }`}
                >
                  <List className="w-4 h-4 text-[#555] shrink-0" />
                  <span className={`text-sm font-medium flex-1 ${list.id === activeListId ? 'text-[#f0a050]' : 'text-[#ccc]'}`}>{list.title}</span>
                  {list.id === activeListId && <Check className="w-4 h-4 text-[#f0a050]" />}
                </button>
              ))}
              {showNewList ? (
                <div className="px-4 py-3 flex gap-2 border-t border-[#1a1a1a] bg-black/50">
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={e => setNewListTitle(e.target.value)}
                    placeholder="List name..."
                    className="flex-1 bg-black border border-[#1a1a1a] rounded-xl px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#f0a050]"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && createList()}
                  />
                  <button
                    onClick={createList}
                    disabled={!newListTitle.trim() || creatingList}
                    className="bg-[#f0a050] text-black rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 font-mono uppercase tracking-wide"
                  >
                    {creatingList ? '…' : 'Add'}
                  </button>
                  <button onClick={() => setShowNewList(false)} className="p-2 text-[#555] active:text-[#ef4444]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewList(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-[#f0a050] border-t border-[#1a1a1a] active:bg-black/20 font-semibold text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New List Deck</span>
                </button>
              )}
            </div>
          )}

          {/* Tasks Accordion Rendering Layout Loops */}
          <div className="px-4 py-3 space-y-2">
            {loadingTasks ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-[#111] border border-[#1a1a1a] rounded-xl animate-pulse mb-2" />
              ))
            ) : displayedTasks.length === 0 ? (
              <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-2xl">
                <CheckSquare className="w-10 h-10 mx-auto text-[#222] mb-3" />
                <p className="text-[#555] font-medium text-sm">
                  {showCompleted ? 'No tasks logged' : 'Execution space clear'}
                </p>
                <p className="text-[11px] text-[#333] font-mono uppercase mt-1">Tap Add Task above to record logs</p>
              </div>
            ) : (
              displayedTasks.map(task => {
                const due = task.due ? formatDue(task.due) : null;
                const completed = task.status === 'completed';
                const expanded = expandedTaskId === task.id;

                return (
                  <div key={task.id} className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden transition-all">
                    {/* Main operational row container */}
                    <div className={`flex items-center gap-3 p-3.5 ${completed ? 'opacity-40' : ''}`}>
                      {/* Checkbox Trigger Toggle Box */}
                      <button
                        onClick={() => toggleComplete(task)}
                        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          completed ? 'bg-[#f0a050] border-[#f0a050]' : 'border-[#333] hover:border-[#f0a050]/50'
                        }`}
                      >
                        {completed && <Check className="w-3 h-3 text-black stroke-[3]" />}
                      </button>

                      {/* Text Context Node */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => !completed && setExpandedTaskId(expanded ? null : task.id)}
                      >
                        <p className={`text-sm font-medium leading-snug ${completed ? 'line-through text-[#555]' : 'text-white'}`}>
                          {task.title}
                        </p>
                        {due && !expanded && (
                          <span className={`text-[11px] font-mono flex items-center gap-1 mt-1 ${
                            due.overdue ? 'text-[#ef4444]' : due.urgent ? 'text-[#f0a050]' : 'text-[#444]'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {due.label}
                          </span>
                        )}
                      </div>

                      {/* Indicator Chevron Vector icon */}
                      {!completed && (
                        <svg
                          width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="#555" strokeWidth="2"
                          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                          onClick={() => setExpandedTaskId(expanded ? null : task.id)}
                          className="cursor-pointer p-0.5"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      )}
                    </div>

                    {/* Uniform Expanded Details Sub Panel Layout Structure */}
                    {expanded && (
                      <div className="border-t border-[#1a1a1a] bg-black/20">
                        {(task.notes || due) && (
                          <div className="px-4 py-3 border-b border-[#1a1a1a]/60 space-y-2">
                            {due && (
                              <div>
                                <span className="text-[9px] uppercase font-mono tracking-wider text-[#444] block">Deadline Limit</span>
                                <p className={`text-xs flex items-center gap-1 font-mono font-bold mt-0.5 ${
                                  due.overdue ? 'text-[#ef4444]' : due.urgent ? 'text-[#f0a050]' : 'text-[#888]'
                                }`}>
                                  <Clock className="w-3 h-3" />
                                  {due.overdue ? 'Overdue · ' : ''}{due.label}
                                </p>
                              </div>
                            )}
                            {task.notes && (
                              <div>
                                <span className="text-[9px] uppercase font-mono tracking-wider text-[#444] block mb-0.5">Task Description</span>
                                <p className="text-xs text-[#ccc] font-sans whitespace-pre-wrap bg-black/40 p-2 rounded-xl leading-relaxed">{task.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex text-xs font-semibold uppercase tracking-wider font-mono">
                          <button
                            onClick={() => { setEditingTask(task); setExpandedTaskId(null); }}
                            className="flex-1 py-3 text-[#f0a050] border-r border-[#1a1a1a] active:bg-black/30"
                          >
                            Edit Task
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="flex-1 py-3 text-[#ef4444] active:bg-black/30"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Subtasks loops nested underneath panel blocks */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="ml-9 border-l border-[#1a1a1a] pl-4 space-y-1 pb-3 pt-1">
                        {task.subtasks
                          .filter(s => showCompleted || s.status === 'needsAction')
                          .map(sub => (
                            <div key={sub.id} className={`flex items-center gap-2.5 py-1 ${sub.status === 'completed' ? 'opacity-40' : ''}`}>
                              <button
                                onClick={() => toggleComplete(sub)}
                                className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  sub.status === 'completed' ? 'bg-[#f0a050] border-[#f0a050]' : 'border-[#222] hover:border-primary'
                                }`}
                              >
                                {sub.status === 'completed' && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                              </button>
                              <span className={`text-xs ${sub.status === 'completed' ? 'line-through text-[#555]' : 'text-[#ccc]'}`}>
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

        </div>
      </PullToRefresh>

      <BottomNav activeTab="more" />

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Add Task Slider Sheet Panel */}
      {showAddTask && activeListId && (
        <AddTaskSheet
          listId={activeListId}
          onClose={() => setShowAddTask(false)}
          onSave={() => { setShowAddTask(false); fetchTasks(); }}
        />
      )}

      {/* Edit Task Modal Dialog Wrapper */}
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
    </>
  );
}

// ─── Add Task Sheet Component ───────────────────────────────────────────────────

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
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
      <div className="w-full max-w-md bg-[#1c1c1e] border-t border-[#1a1a1a] rounded-t-2xl max-h-[90vh] overflow-y-auto pb-4">
        <div className="w-10 h-1 bg-[#333] rounded-full mx-auto mt-3" />
        <div className="px-5 pt-4 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold font-mono text-white uppercase tracking-wide">Log Task Entry</h2>
            <button onClick={onClose} className="p-2 rounded-full text-[#555] active:text-[#ef4444]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase text-[#555] font-mono mb-1">Task Heading Statement *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What operational log needs tracking?"
                className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#333] outline-none focus:border-[#f0a050]"
                autoFocus
              />
            </div>
            
            <div>
              <label className="text-xs font-mono text-[#555] uppercase tracking-wide">Task Context Details</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add structural description notations..."
                rows={3}
                className="w-full mt-1 bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#333] outline-none focus:border-[#f0a050] resize-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 font-mono text-xs text-[#555]">
              <div>
                <label className="uppercase tracking-wide">Target Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full mt-1 bg-black border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-[#f0a050] outline-none"
                />
              </div>
              <div>
                <label className="uppercase tracking-wide">Time Frame</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  className="w-full mt-1 bg-black border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-[#f0a050] outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="text-xs font-mono text-[#555] uppercase tracking-wide">Subtask Parameters Checkpoints</label>
              <div className="space-y-2 mt-1">
                {subtasks.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="w-4 h-4 rounded-full border-2 border-[#222] shrink-0" />
                    <input
                      type="text"
                      value={s}
                      onChange={e => updateSubtask(i, e.target.value)}
                      placeholder={`Checkpoint node ${i + 1}`}
                      className="flex-1 bg-black border border-[#1a1a1a] rounded-xl px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#f0a050]"
                    />
                    <button onClick={() => removeSubtask(i)} className="p-1 text-[#555] active:text-[#ef4444]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addSubtask}
                  className="text-xs text-[#f0a050] flex items-center gap-1 pl-1 mt-1 font-semibold font-mono uppercase tracking-wider"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Subtask Node</span>
                </button>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="w-full bg-[#f0a050] text-black rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide font-mono disabled:opacity-40"
            >
              {saving ? 'Adding…' : 'Commit Task Entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}