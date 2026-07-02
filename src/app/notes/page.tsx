'use client';

import { useState, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';
import { useHaptics } from '@/context/HapticContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  entry_date: string;
  title: string | null;
  content: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_TAGS = ['Work', 'Personal', 'Home', 'Health', 'Finance', 'Knox'];

const TAG_COLORS: Record<string, string> = {
  Work:     '#f0a050',
  Personal: '#ec4899',
  Home:     '#6366f1',
  Health:   '#22c55e',
  Finance:  '#3b82f6',
  Knox:     '#f59e0b',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tagColor(tag: string) {
  return TAG_COLORS[tag] || '#94a3b8';
}

function preview(content: string, max = 90) {
  const stripped = content.replace(/\n+/g, ' ').trim();
  return stripped.length > max ? stripped.substring(0, max) + '…' : stripped;
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const { triggerHaptic } = useHaptics();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState('All');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (tag: string = 'All') => {
    setLoading(true);
    try {
      const url = tag === 'All' ? '/api/notes' : `/api/notes?tag=${encodeURIComponent(tag)}`;
      const res = await fetch(url);
      const json = await res.json();
      setNotes(json.notes || []);
    } catch (e) {
      console.error('Notes load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load('All'); }, []); // eslint-disable-line

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openNew() {
    triggerHaptic('light');
    setEditNote(null);
    setFormTitle('');
    setFormContent('');
    setFormDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }));
    setFormTags([]);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(note: Note) {
    triggerHaptic('light');
    setEditNote(note);
    setFormTitle(note.title || '');
    setFormContent(note.content || '');
    setFormDate(note.entry_date || '');
    setFormTags(note.tags || []);
    setFormError('');
    setShowModal(true);
  }

  function toggleFormTag(tag: string) {
    triggerHaptic('light');
    setFormTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function handleTagFilter(tag: string) {
    triggerHaptic('light');
    setActiveTag(tag);
    load(tag);
  }

  async function handleSave() {
    setFormError('');
    if (!formContent.trim()) { setFormError('Content is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        id: editNote?.id,
        title: formTitle.trim() || null,
        content: formContent.trim(),
        tags: formTags,
        entry_date: formDate,
      };
      const res = await fetch('/api/notes', {
        method: editNote ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      triggerHaptic('success');
      setShowModal(false);
      load(activeTag);
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/notes?id=${deleteId}`, { method: 'DELETE' });
      triggerHaptic('heavy');
      setDeleteId(null);
      load(activeTag);
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PullToRefresh onRefresh={() => load(activeTag)}>
        <div className="pb-24 bg-black text-white min-h-screen">

          {/* Header */}
          <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Notes</h1>
                <p className="text-[10px] text-[#555] mt-0.5">
                  {notes.length} {notes.length === 1 ? 'note' : 'notes'}{activeTag !== 'All' ? ` · ${activeTag}` : ''}
                </p>
              </div>
              <button
                onClick={openNew}
                className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
              >
                + New
              </button>
            </div>

            {/* Tag filter chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3">
              {['All', ...PRESET_TAGS].map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagFilter(tag)}
                  className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    activeTag === tag
                      ? 'bg-[#f0a050]/15 border-[#f0a050]/40 text-[#f0a050]'
                      : 'border-[#2a2a2a] text-[#555]'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Notes list */}
          <div className="px-4 pt-4 space-y-3">
            {loading ? (
              <Spinner />
            ) : notes.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#444] text-sm">No notes{activeTag !== 'All' ? ` tagged ${activeTag}` : ''}</p>
                <p className="text-[#333] text-xs mt-1">Tap + New to write your first note</p>
              </div>
            ) : (
              notes.map(note => (
                <div
                  key={note.id}
                  onClick={() => openEdit(note)}
                  className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 cursor-pointer active:bg-[#161616] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      {note.title ? (
                        <p className="text-sm font-semibold text-white truncate">{note.title}</p>
                      ) : (
                        <p className="text-sm text-[#ccc] line-clamp-1">{preview(note.content, 60)}</p>
                      )}
                    </div>
                    <p className="text-[10px] text-[#444] flex-shrink-0 font-mono mt-0.5">
                      {new Date(note.entry_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>

                  {note.title && note.content && (
                    <p className="text-[12px] text-[#555] leading-relaxed line-clamp-2 mb-2">
                      {preview(note.content, 110)}
                    </p>
                  )}

                  {(note.tags || []).length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {(note.tags || []).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: tagColor(tag) + '20', color: tagColor(tag) }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </PullToRefresh>

      <BottomNav active="more" />

      {/* ── Note Modal ──────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
          <div className="bg-[#1c1c1e] w-full rounded-t-2xl max-h-[92vh] flex flex-col border-t border-[#2a2a2a]">

            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1a1a1a] flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="text-[#555] text-sm font-semibold">Cancel</button>
              <span className="text-sm font-bold text-white">{editNote ? 'Edit Note' : 'New Note'}</span>
              <div className="flex items-center gap-4">
                {editNote && (
                  <button
                    onClick={() => { setShowModal(false); setDeleteId(editNote.id); }}
                    className="text-[#ef4444] text-sm font-semibold"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-[#f0a050] text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8 space-y-4">

              {/* Date */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[#555] uppercase tracking-wider font-semibold w-12">Date</span>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="flex-1 bg-[#2c2c2e] text-white text-sm px-3 py-2 rounded-xl outline-none border border-[#3a3a3a] focus:border-[#f0a050]"
                />
              </div>

              {/* Title */}
              <input
                type="text"
                placeholder="Title (optional)"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="w-full bg-[#2c2c2e] text-white text-base font-semibold px-4 py-3 rounded-xl outline-none border border-[#2a2a2a] focus:border-[#f0a050] placeholder-[#333]"
              />

              {/* Content */}
              <textarea
                placeholder="Write your note…"
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                rows={12}
                className="w-full bg-[#2c2c2e] text-white text-sm px-4 py-3 rounded-xl outline-none border border-[#2a2a2a] focus:border-[#f0a050] placeholder-[#333] resize-none leading-relaxed"
              />

              {/* Tags */}
              <div>
                <p className="text-[10px] text-[#444] uppercase tracking-wider font-semibold mb-2.5">Tags</p>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_TAGS.map(tag => {
                    const active = formTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleFormTag(tag)}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all"
                        style={active
                          ? { backgroundColor: tagColor(tag) + '25', borderColor: tagColor(tag) + '70', color: tagColor(tag) }
                          : { borderColor: '#2a2a2a', color: '#555' }
                        }
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError && <p className="text-[#ef4444] text-xs font-mono">{formError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ──────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a]">
            <p className="text-base font-bold text-white text-center mb-1">Delete this note?</p>
            <p className="text-[11px] text-[#555] text-center mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Keep</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-40">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}