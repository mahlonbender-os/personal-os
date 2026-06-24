'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkoutSession {
  id: string;
  session_date: string;
  workout_type: 'cardio' | 'strength';
  name: string | null;
  duration_minutes: number | null;
  calories_burned: number | null;
  distance_miles: number | null;
  avg_heart_rate: number | null;
  notes: string | null;
}

interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_name: string;
  set_number: number | null;
  reps: number | null;
  weight_lbs: number | null;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-[#111] border border-[#1a1a1a] ${className}`}>{children}</div>;
}

function DeleteSheet({ onCancel, onConfirm, deleting }: { onCancel: () => void; onConfirm: () => void; deleting: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
      <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5 border border-[#1a1a1a]">
        <p className="text-base font-semibold text-white text-center mb-4">Delete this workout?</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-40">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cardio Tab ───────────────────────────────────────────────────────────────

const CARDIO_TYPES = ['Run', 'Walk', 'Bike', 'Swim', 'Rowing', 'Elliptical', 'HIIT', 'Other'];

function CardioTab({ refresh }: { refresh: number }) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/workout?type=cardio').then(r => r.json());
      setSessions(d.sessions || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/workout?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null); load();
  }

  const totalSessions = sessions.length;
  const totalMiles = sessions.reduce((s, w) => s + parseFloat(String(w.distance_miles || 0)), 0);
  const totalMinutes = sessions.reduce((s, w) => s + (w.duration_minutes || 0), 0);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <>
      <div className="space-y-4">
        {totalSessions > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-[9px] text-[#444] mb-1">Sessions</p>
              <p className="text-xl font-bold text-white">{totalSessions}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-[9px] text-[#444] mb-1">Miles</p>
              <p className="text-xl font-bold text-[#22c55e] font-mono">{totalMiles.toFixed(1)}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-[9px] text-[#444] mb-1">Hours</p>
              <p className="text-xl font-bold text-white font-mono">{(totalMinutes / 60).toFixed(1)}</p>
            </Card>
          </div>
        )}
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-[#333] text-sm">No cardio sessions yet — tap Log Cardio</div>
        ) : (
          <div>
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Sessions</p>
            <Card className="overflow-hidden">
              {sessions.map((s, idx) => (
                <div key={s.id}
                  className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== sessions.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                  onClick={() => setDeleteId(s.id)}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                    <span className="text-sm">{s.name === 'Run' ? '🏃' : s.name === 'Bike' ? '🚴' : s.name === 'Swim' ? '🏊' : '💪'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#ccc]">{s.name || 'Cardio'}</p>
                    <div className="flex gap-2 text-[10px] text-[#444] flex-wrap">
                      <span>{fmtDate(s.session_date)}</span>
                      {s.duration_minutes && <span>· {s.duration_minutes}min</span>}
                      {s.distance_miles && <span>· {parseFloat(String(s.distance_miles)).toFixed(2)}mi</span>}
                      {s.avg_heart_rate && <span>· {s.avg_heart_rate}bpm</span>}
                    </div>
                    {s.notes && <p className="text-[10px] text-[#333] mt-0.5">{s.notes}</p>}
                  </div>
                  {s.calories_burned && (
                    <p className="text-xs font-semibold text-[#f0a050] flex-shrink-0">{s.calories_burned}cal</p>
                  )}
                </div>
              ))}
            </Card>
            <p className="text-[10px] text-[#333] px-1 mt-1.5">Tap to delete</p>
          </div>
        )}
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

// ─── Strength Tab ─────────────────────────────────────────────────────────────

function StrengthTab({ refresh }: { refresh: number }) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [sets, setSets] = useState<Record<string, WorkoutSet[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddSet, setShowAddSet] = useState<string | null>(null); // session id
  const [setForm, setSetForm] = useState({ exercise_name: '', set_number: '', reps: '', weight_lbs: '' });
  const [savingSet, setSavingSet] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/workout?type=strength').then(r => r.json());
      setSessions(d.sessions || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  async function loadSets(sessionId: string) {
    if (sets[sessionId]) return;
    try {
      const d = await fetch(`/api/workout/sets?sessionId=${sessionId}`).then(r => r.json());
      setSets(prev => ({ ...prev, [sessionId]: d.sets || [] }));
    } catch {}
  }

  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/workout?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null);
    if (expandedId === deleteId) setExpandedId(null);
    load();
  }

  async function handleAddSet(sessionId: string) {
    if (!setForm.exercise_name) return;
    setSavingSet(true);
    try {
      await fetch('/api/workout/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          exercise_name: setForm.exercise_name,
          set_number: setForm.set_number ? parseInt(setForm.set_number) : null,
          reps: setForm.reps ? parseInt(setForm.reps) : null,
          weight_lbs: setForm.weight_lbs ? parseFloat(setForm.weight_lbs) : null,
        }),
      });
      // Refresh sets for this session
      setSets(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
      await loadSets(sessionId);
      setSetForm({ exercise_name: '', set_number: '', reps: '', weight_lbs: '' });
      setShowAddSet(null);
    } catch {}
    finally { setSavingSet(false); }
  }

  async function handleDeleteSet(setId: string, sessionId: string) {
    await fetch(`/api/workout/sets?id=${setId}`, { method: 'DELETE' });
    setSets(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
    await loadSets(sessionId);
  }

  function toggle(sessionId: string) {
    if (expandedId === sessionId) { setExpandedId(null); return; }
    setExpandedId(sessionId);
    loadSets(sessionId);
  }

  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((s, w) => s + (w.duration_minutes || 0), 0);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <>
      <div className="space-y-4">
        {totalSessions > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3 text-center">
              <p className="text-[9px] text-[#444] mb-1">Workouts</p>
              <p className="text-xl font-bold text-white">{totalSessions}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-[9px] text-[#444] mb-1">Hours</p>
              <p className="text-xl font-bold text-white font-mono">{(totalMinutes / 60).toFixed(1)}</p>
            </Card>
          </div>
        )}
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-[#333] text-sm">No strength sessions yet — tap New Workout</div>
        ) : (
          <div>
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Workouts</p>
            <Card className="overflow-hidden">
              {sessions.map((s, idx) => {
                const isExpanded = expandedId === s.id;
                const sessionSets = sets[s.id] || [];
                const exercises = [...new Set(sessionSets.map(set => set.exercise_name))];
                return (
                  <div key={s.id}>
                    <div
                      className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${!isExpanded && idx !== sessions.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                      onClick={() => toggle(s.id)}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f0a050]/10 flex items-center justify-center">
                        <span className="text-sm">🏋</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#ccc]">{s.name || 'Strength Session'}</p>
                        <div className="flex gap-2 text-[10px] text-[#444]">
                          <span>{fmtDate(s.session_date)}</span>
                          {s.duration_minutes && <span>· {s.duration_minutes}min</span>}
                          {exercises.length > 0 && <span>· {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] text-[#555] flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                    </div>

                    {isExpanded && (
                      <div className={`bg-[#0a0a0a] ${idx !== sessions.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                        {sessionSets.length > 0 && (
                          <div className="px-4 py-3 space-y-2">
                            {/* Group by exercise */}
                            {[...new Set(sessionSets.map(set => set.exercise_name))].map(exName => {
                              const exSets = sessionSets.filter(set => set.exercise_name === exName);
                              return (
                                <div key={exName}>
                                  <p className="text-[10px] font-semibold text-[#f0a050] mb-1.5">{exName}</p>
                                  <div className="space-y-1">
                                    {exSets.map(set => (
                                      <div key={set.id} className="flex items-center gap-3">
                                        <p className="text-[10px] text-[#444] w-8">{set.set_number ? `Set ${set.set_number}` : '—'}</p>
                                        <p className="text-[11px] text-[#888] flex-1">
                                          {set.reps ? `${set.reps} reps` : '—'}
                                          {set.weight_lbs ? ` @ ${parseFloat(String(set.weight_lbs))}lbs` : ''}
                                        </p>
                                        <button onClick={() => handleDeleteSet(set.id, s.id)} className="text-[10px] text-[#333] active:text-[#ef4444]">✕</button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {showAddSet === s.id ? (
                          <div className="px-4 py-3 border-t border-[#1a1a1a]">
                            <div className="rounded-xl bg-[#2c2c2e] overflow-hidden mb-2">
                              {[
                                { label: 'Exercise', field: 'exercise_name', placeholder: 'Bench Press, Squat…' },
                                { label: 'Set #', field: 'set_number', placeholder: '1', type: 'number' },
                                { label: 'Reps', field: 'reps', placeholder: '10', type: 'number' },
                                { label: 'Weight (lbs)', field: 'weight_lbs', placeholder: '135', type: 'number' },
                              ].map(({ label, field, placeholder, type = 'text' }, i, arr) => (
                                <div key={field} className={`flex items-center px-3 py-2.5 ${i !== arr.length - 1 ? 'border-b border-white/10' : ''}`}>
                                  <span className="text-[11px] text-[#888] w-24 flex-shrink-0">{label}</span>
                                  <input type={type} placeholder={placeholder} value={(setForm as any)[field]}
                                    onChange={e => setSetForm(f => ({ ...f, [field]: e.target.value }))}
                                    className="flex-1 bg-transparent text-[11px] text-white text-right outline-none placeholder-[#444]" />
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setShowAddSet(null)} className="flex-1 py-2 rounded-xl bg-[#2a2a2a] text-[11px] text-[#555]">Cancel</button>
                              <button onClick={() => handleAddSet(s.id)} disabled={savingSet || !setForm.exercise_name}
                                className="flex-1 py-2 rounded-xl bg-[#f0a050]/10 text-[11px] text-[#f0a050] font-semibold disabled:opacity-40">
                                {savingSet ? '…' : 'Add Set'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-3 border-t border-[#1a1a1a] flex gap-2">
                            <button onClick={() => setShowAddSet(s.id)} className="flex-1 py-2 rounded-xl bg-[#f0a050]/10 text-[11px] text-[#f0a050] font-semibold">+ Add Exercise</button>
                            <button onClick={() => setDeleteId(s.id)} className="px-4 py-2 rounded-xl bg-[#ef4444]/10 text-[11px] text-[#ef4444] font-semibold">Delete</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        )}
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddModal({ type, onClose, onSaved }: { type: 'cardio' | 'strength'; onClose: () => void; onSaved: () => void }) {
  const t = today();
  const [form, setForm] = useState({
    session_date: t, name: '', duration_minutes: '', calories_burned: '',
    distance_miles: '', avg_heart_rate: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setError('');
    if (!form.session_date) { setError('Date is required'); return; }
    if (type === 'strength' && !form.name) { setError('Workout name is required'); return; }
    setSaving(true);
    try {
      const body: any = {
        session_date: form.session_date,
        workout_type: type,
        name: form.name || null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        notes: form.notes || null,
      };
      if (type === 'cardio') {
        body.calories_burned = form.calories_burned ? parseInt(form.calories_burned) : null;
        body.distance_miles = form.distance_miles ? parseFloat(form.distance_miles) : null;
        body.avg_heart_rate = form.avg_heart_rate ? parseInt(form.avg_heart_rate) : null;
      }
      const res = await fetch('/api/workout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      onSaved(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  function Field({ label, field, type: ft = 'text', placeholder = '' }: { label: string; field: string; type?: string; placeholder?: string }) {
    return (
      <div className="flex items-center px-4 py-3 border-b border-white/10 last:border-0">
        <span className="text-sm text-[#888] w-28 flex-shrink-0">{label}</span>
        <input type={ft} value={(form as any)[field]} placeholder={placeholder}
          onChange={e => set(field, e.target.value)}
          className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
          <button onClick={onClose} className="text-[#f0a050] text-sm">Cancel</button>
          <h2 className="text-base font-semibold text-white">{type === 'cardio' ? 'Log Cardio' : 'New Strength Workout'}</h2>
          <button onClick={handleSave} disabled={saving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-40">{saving ? '…' : 'Save'}</button>
        </div>
        <div className="px-4 pt-4">
          <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
            {type === 'cardio' ? (
              <>
                <Field label="Date" field="session_date" type="date" />
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-28 flex-shrink-0">Type</span>
                  <select value={form.name} onChange={e => set('name', e.target.value)}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e]">
                    <option value="" className="bg-[#2c2c2e]">Select…</option>
                    {CARDIO_TYPES.map(t => <option key={t} value={t} className="bg-[#2c2c2e]">{t}</option>)}
                  </select>
                </div>
                <Field label="Duration (min)" field="duration_minutes" type="number" placeholder="30" />
                <Field label="Distance (mi)" field="distance_miles" type="number" placeholder="3.1" />
                <Field label="Avg Heart Rate" field="avg_heart_rate" type="number" placeholder="145" />
                <Field label="Calories" field="calories_burned" type="number" placeholder="300" />
                <Field label="Notes" field="notes" placeholder="Optional" />
              </>
            ) : (
              <>
                <Field label="Date" field="session_date" type="date" />
                <Field label="Name" field="name" placeholder="Chest Day, Push Day…" />
                <Field label="Duration (min)" field="duration_minutes" type="number" placeholder="60" />
                <Field label="Notes" field="notes" placeholder="Optional" />
              </>
            )}
          </div>
          {type === 'strength' && (
            <p className="text-[10px] text-[#444] px-1 mt-3">After saving, tap the session to add your exercises and sets.</p>
          )}
          {error && <p className="text-[#ef4444] text-xs px-1 mt-3 font-mono">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['Cardio', 'Strength'] as const;

export default function WorkoutPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  if (status === 'loading') return <div className="min-h-screen bg-black flex items-center justify-center"><Spinner /></div>;
  if (!session) return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-[#555]">Please sign in</p></div>;

  const addLabels = ['Log Cardio', 'New Workout'];

  return (
    <>
      <div className="fixed inset-0 bg-black flex flex-col overflow-hidden select-none">
        <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 z-30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">Workouts 💪</h1>
            </div>
            <button onClick={() => { if (navigator.vibrate) navigator.vibrate(8); setShowAdd(true); }}
              className="text-sm font-semibold text-[#f0a050] active:opacity-70 px-2 py-1">
              {addLabels[activeTab]}
            </button>
          </div>
          <div className="flex gap-0 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {TABS.map((tab, i) => (
              <button key={tab} onClick={() => { setActiveTab(i); if (navigator.vibrate) navigator.vibrate(8); }}
                className={`flex-shrink-0 px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === i ? 'border-[#f0a050] text-[#f0a050]' : 'border-transparent text-[#555]'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 scrollbar-hide">
          <PullToRefresh onRefresh={async () => setRefreshCount(c => c + 1)}>
            <div className="space-y-4">
              {activeTab === 0 && <CardioTab refresh={refreshCount} />}
              {activeTab === 1 && <StrengthTab refresh={refreshCount} />}
            </div>
          </PullToRefresh>
        </div>

        <BottomNav active="more" />
      </div>

      {showAdd && (
        <AddModal
          type={activeTab === 0 ? 'cardio' : 'strength'}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setRefreshCount(c => c + 1); }}
        />
      )}
    </>
  );
}