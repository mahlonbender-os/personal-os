'use client';

import { useState, useEffect, useRef } from 'react';

interface Task {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: string;
}

interface Props {
  task: Task;
  taskListId: string;
  onClose: () => void;
  onSaved: (updated: Task) => void;
}

export default function EditTaskModal({ task, taskListId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(task.title || '');
  const [notes, setNotes] = useState(task.notes || '');
  const [due, setDue] = useState(task.due ? task.due.split('T')[0] : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body: Record<string, string> = {
        listId: taskListId,
        taskId: task.id,
        title: title.trim(),
        notes: notes.trim(),
        due: due ? `${due}T00:00:00.000Z` : '',
      };
      const res = await fetch('/api/tasks/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      const updated = await res.json();
      navigator.vibrate?.(8);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      onClick={handleBackdrop}
    >
      <div
        ref={scrollRef}
        className="bg-[#1c1c1e] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pb-6"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <h2 className="text-base font-semibold text-white text-center">Edit Task</h2>
        </div>

        {/* Fields */}
        <div className="px-5 pt-4 space-y-4">
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#f0a050]"
            />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes…"
              rows={3}
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#f0a050] resize-none"
            />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Due Date</label>
            <input
              type="date"
              value={due}
              onChange={e => setDue(e.target.value)}
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#f0a050] [color-scheme:dark]"
            />
            {due && (
              <button onClick={() => setDue('')} className="text-[#ef4444] text-xs mt-1">
                Clear due date
              </button>
            )}
          </div>

          {error && <p className="text-[#ef4444] text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 py-3 rounded-xl bg-[#f0a050] text-black text-sm font-semibold disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}