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
  muscle_group: string | null;
  set_number: number | null;
  reps: number | null;
  weight_lbs: number | null;
  notes: string | null;
  workout_sessions?: { session_date: string; name: string | null };
}

// ─── Exercise Data ────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body'];

const GROUP_EMOJI: Record<string, string> = {
  Chest: '🫀', Back: '🔙', Legs: '🦵', Shoulders: '💪',
  Arms: '💪', Core: '🏋', 'Full Body': '⚡',
};

const EXERCISES_BY_GROUP: Record<string, string[]> = {
  Chest: ['Dumbbell Bench Press', 'Barbell Bench Press', 'Incline Dumbbell Press', 'Incline Barbell Press', 'Pec Deck', 'Cable Fly', 'Push-Up', 'Dips'],
  Back: ['Low Row', 'Seated Cable Row', 'Lat Pulldown', 'Bent Over Row', 'T-Bar Row', 'Pull-Up', 'Chin-Up', 'Single Arm Row'],
  Legs: ['Leg Press', 'Squat', 'Leg Extension', 'Leg Curl', 'Romanian Deadlift', 'Calf Raise', 'Hack Squat', 'Bulgarian Split Squat', 'Leg Press (Narrow)', 'Leg Press (Wide)'],
  Shoulders: ['Overhead Press', 'Dumbbell Shoulder Press', 'Lateral Raise', 'Front Raise', 'Face Pull', 'Arnold Press', 'Rear Delt Fly'],
  Arms: ['Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl', 'Tricep Pushdown', 'Skull Crusher', 'Overhead Tricep Extension', 'Close Grip Bench'],
  Core: ['Plank', 'Crunches', 'Cable Crunch', 'Hanging Leg Raise', 'Ab Wheel', 'Russian Twist', 'Decline Sit-Up'],
  'Full Body': ['Deadlift', 'Power Clean', 'Kettlebell Swing', 'Burpees', 'Thruster'],
};

const CARDIO_TYPES = ['Run', 'Walk', 'Bike', 'Elliptical', 'Swim', 'Rowing', 'HIIT', 'Other'];
const CARDIO_EMOJI: Record<string, string> = {
  Run: '🏃', Walk: '🚶', Bike: '🚴', Elliptical: '🔄',
  Swim: '🏊', Rowing: '🚣', HIIT: '⚡', Other: '💪',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtShortDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">{children}</p>;
}

function DeleteSheet({ onCancel, onConfirm, deleting, msg = 'Delete this workout?' }: { onCancel: () => void; onConfirm: () => void; deleting: boolean; msg?: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
      <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5 border border-[#1a1a1a]">
        <p className="text-base font-semibold text-white text-center mb-4">{msg}</p>
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

function CardioTab({ refresh }: { refresh: number }) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
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

  const filtered = typeFilter === 'All' ? sessions : sessions.filter(s => s.name === typeFilter);

  // Stats for filtered view
  const totalMiles = filtered.reduce((s, w) => s + parseFloat(String(w.distance_miles || 0)), 0);
  const totalMinutes = filtered.reduce((s, w) => s + (w.duration_minutes || 0), 0);
  const totalCal = filtered.reduce((s, w) => s + (w.calories_burned || 0), 0);

  // PRs for filtered (when specific type selected)
  const withDist = filtered.filter(s => s.distance_miles && (s.distance_miles as any) > 0);
  const bestDist = withDist.length > 0 ? Math.max(...withDist.map(s => parseFloat(String(s.distance_miles)))) : null;
  const longestDuration = filtered.length > 0 ? Math.max(...filtered.map(s => s.duration_minutes || 0)) : null;

  // Pace calculation (min/mile)
  function pace(s: WorkoutSession): string | null {
    if (!s.distance_miles || !s.duration_minutes || parseFloat(String(s.distance_miles)) <= 0) return null;
    const minPerMile = s.duration_minutes / parseFloat(String(s.distance_miles));
    const min = Math.floor(minPerMile);
    const sec = Math.round((minPerMile - min) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}/mi`;
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <>
      <div className="space-y-4">
        {/* Type filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {['All', ...CARDIO_TYPES].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors ${typeFilter === t ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30' : 'border border-[#2a2a2a] text-[#555]'}`}>
              {t !== 'All' && CARDIO_EMOJI[t]} {t}
            </button>
          ))}
        </div>

        {/* Stats */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-[9px] text-[#444] mb-1">Sessions</p>
              <p className="text-xl font-bold text-white">{filtered.length}</p>
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

        {/* PRs when filtered to specific type */}
        {typeFilter !== 'All' && filtered.length > 0 && (
          <Card className="p-4">
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Personal Records</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {bestDist !== null && (
                <div>
                  <p className="text-base font-bold text-[#f0a050] font-mono">{bestDist.toFixed(2)}</p>
                  <p className="text-[9px] text-[#444]">Best miles</p>
                </div>
              )}
              {longestDuration !== null && longestDuration > 0 && (
                <div>
                  <p className="text-base font-bold text-[#f0a050] font-mono">{longestDuration}</p>
                  <p className="text-[9px] text-[#444]">Best mins</p>
                </div>
              )}
              {totalCal > 0 && (
                <div>
                  <p className="text-base font-bold text-[#f0a050] font-mono">{totalCal}</p>
                  <p className="text-[9px] text-[#444]">Total cal</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Session list */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#333] text-sm">
            {sessions.length === 0 ? 'No cardio sessions yet — tap Log Cardio' : `No ${typeFilter.toLowerCase()} sessions yet`}
          </div>
        ) : (
          <div>
            <SectionLabel>{typeFilter === 'All' ? 'All Sessions' : `${typeFilter} Sessions`}</SectionLabel>
            <Card className="overflow-hidden">
              {filtered.map((s, idx) => (
                <div key={s.id}
                  className={`flex items-start px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== filtered.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                  onClick={() => setDeleteId(s.id)}
                >
                  <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm">{CARDIO_EMOJI[s.name || ''] || '💪'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#ccc]">{s.name || 'Cardio'}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-[10px] text-[#444]">{fmtDate(s.session_date)}</span>
                      {s.duration_minutes != null && <span className="text-[10px] text-[#444]">· {s.duration_minutes}min</span>}
                      {s.distance_miles != null && <span className="text-[10px] text-[#22c55e] font-mono">{parseFloat(String(s.distance_miles)).toFixed(2)}mi</span>}
                      {pace(s) && <span className="text-[10px] text-[#444]">@ {pace(s)}</span>}
                      {s.avg_heart_rate != null && <span className="text-[10px] text-[#ef4444]">· {s.avg_heart_rate}bpm</span>}
                    </div>
                    {s.notes && <p className="text-[10px] text-[#333] mt-0.5">{s.notes}</p>}
                  </div>
                  {s.calories_burned != null && s.calories_burned > 0 && (
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
  const [subTab, setSubTab] = useState<'sessions' | 'exercises'>('sessions');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [allSets, setAllSets] = useState<WorkoutSet[]>([]);
  const [sessionSets, setSessionSets] = useState<Record<string, WorkoutSet[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddSet, setShowAddSet] = useState<string | null>(null);
  const [addSetMuscleGroup, setAddSetMuscleGroup] = useState('');
  const [addSetExercise, setAddSetExercise] = useState('');
  const [addSetCustom, setAddSetCustom] = useState(false);
  const [setForm, setSetForm] = useState({ set_number: '', reps: '', weight_lbs: '' });
  const [savingSet, setSavingSet] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, setsRes] = await Promise.all([
        fetch('/api/workout?type=strength').then(r => r.json()),
        fetch('/api/workout/sets?all=true').then(r => r.json()),
      ]);
      setSessions(sessRes.sessions || []);
      setAllSets(setsRes.sets || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  async function loadSessionSets(sessionId: string) {
    if (sessionSets[sessionId]) return;
    try {
      const d = await fetch(`/api/workout/sets?sessionId=${sessionId}`).then(r => r.json());
      setSessionSets(prev => ({ ...prev, [sessionId]: d.sets || [] }));
    } catch {}
  }

  useEffect(() => { load(); }, [load, refresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/workout?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null);
    if (expandedSessionId === deleteId) setExpandedSessionId(null);
    load();
  }

  async function handleAddSet(sessionId: string) {
    const exerciseName = addSetCustom ? addSetExercise : addSetExercise;
    if (!exerciseName || !addSetMuscleGroup) return;
    setSavingSet(true);
    try {
      await fetch('/api/workout/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          muscle_group: addSetMuscleGroup,
          exercise_name: exerciseName,
          set_number: setForm.set_number ? parseInt(setForm.set_number) : null,
          reps: setForm.reps ? parseInt(setForm.reps) : null,
          weight_lbs: setForm.weight_lbs ? parseFloat(setForm.weight_lbs) : null,
        }),
      });
      setSessionSets(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
      await loadSessionSets(sessionId);
      setSetForm({ set_number: '', reps: '', weight_lbs: '' });
      setAddSetMuscleGroup('');
      setAddSetExercise('');
      setAddSetCustom(false);
      setShowAddSet(null);
      load(); // refresh allSets for history
    } catch {}
    finally { setSavingSet(false); }
  }

  async function handleDeleteSet(setId: string, sessionId: string) {
    await fetch(`/api/workout/sets?id=${setId}`, { method: 'DELETE' });
    setSessionSets(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
    await loadSessionSets(sessionId);
    load();
  }

  function toggleSession(id: string) {
    if (expandedSessionId === id) { setExpandedSessionId(null); return; }
    setExpandedSessionId(id);
    loadSessionSets(id);
  }

  // Build exercise history from allSets
  const exerciseHistory = (() => {
    const map: Record<string, { muscle_group: string; sets: WorkoutSet[]; maxWeight: number; lastDate: string; totalSets: number }> = {};
    for (const s of allSets) {
      const key = s.exercise_name;
      if (!map[key]) map[key] = { muscle_group: s.muscle_group || 'Other', sets: [], maxWeight: 0, lastDate: '', totalSets: 0 };
      map[key].sets.push(s);
      map[key].totalSets += 1;
      const w = parseFloat(String(s.weight_lbs || 0));
      if (w > map[key].maxWeight) map[key].maxWeight = w;
      const d = s.workout_sessions?.session_date || '';
      if (!map[key].lastDate || d > map[key].lastDate) map[key].lastDate = d;
    }
    // Group by muscle group
    const grouped: Record<string, typeof map[string][]> = {};
    for (const [name, data] of Object.entries(map)) {
      const g = data.muscle_group;
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push({ ...data, sets: data.sets } );
    }
    return grouped;
  })();

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <>
      {/* Sub-tabs */}
      <div className="flex rounded-xl overflow-hidden border border-[#2a2a2a] mb-4">
        {(['sessions', 'exercises'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors ${subTab === t ? 'bg-[#f0a050]/10 text-[#f0a050]' : 'text-[#444]'}`}>
            {t === 'sessions' ? '📋 Sessions' : '📊 Exercises'}
          </button>
        ))}
      </div>

      {/* Sessions view */}
      {subTab === 'sessions' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-[#333] text-sm">No strength sessions yet — tap New Workout</div>
          ) : (
            <Card className="overflow-hidden">
              {sessions.map((s, idx) => {
                const isExp = expandedSessionId === s.id;
                const sets = sessionSets[s.id] || [];
                const groups = [...new Set(sets.map(set => set.muscle_group || 'Other'))];
                return (
                  <div key={s.id}>
                    <div
                      className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${!isExp && idx !== sessions.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                      onClick={() => toggleSession(s.id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#f0a050]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">🏋</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#ccc]">{s.name || 'Strength Session'}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-[#444]">
                          <span>{fmtDate(s.session_date)}</span>
                          {s.duration_minutes != null && <span>· {s.duration_minutes}min</span>}
                          {groups.length > 0 && <span>· {groups.join(', ')}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] text-[#555] flex-shrink-0 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`}>▾</span>
                    </div>

                    {isExp && (
                      <div className={`bg-[#0a0a0a] ${idx !== sessions.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                        {sets.length > 0 && (
                          <div className="px-4 py-3 space-y-4">
                            {/* Group sets by muscle_group > exercise_name */}
                            {[...new Set(sets.map(s => s.muscle_group || 'Other'))].map(group => {
                              const groupSets = sets.filter(s => (s.muscle_group || 'Other') === group);
                              const exercises = [...new Set(groupSets.map(s => s.exercise_name))];
                              return (
                                <div key={group}>
                                  <p className="text-[9px] font-bold text-[#f0a050] uppercase tracking-wider mb-2">
                                    {GROUP_EMOJI[group] || '💪'} {group}
                                  </p>
                                  {exercises.map(exName => {
                                    const exSets = groupSets.filter(s => s.exercise_name === exName);
                                    return (
                                      <div key={exName} className="mb-2 last:mb-0">
                                        <p className="text-[11px] font-semibold text-[#888] mb-1">{exName}</p>
                                        <div className="space-y-1">
                                          {exSets.map(set => (
                                            <div key={set.id} className="flex items-center gap-2">
                                              <span className="text-[10px] text-[#333] w-10">{set.set_number != null ? `Set ${set.set_number}` : '—'}</span>
                                              <span className="text-[11px] text-[#666] flex-1">
                                                {set.reps != null ? `${set.reps} reps` : '—'}
                                                {set.weight_lbs != null ? ` @ ${parseFloat(String(set.weight_lbs))}lbs` : ''}
                                              </span>
                                              <button onClick={() => handleDeleteSet(set.id, s.id)} className="text-[10px] text-[#2a2a2a] active:text-[#ef4444] px-1">✕</button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add Set form */}
                        {showAddSet === s.id ? (
                          <div className="px-4 py-3 border-t border-[#1a1a1a] space-y-3">
                            {/* Step 1: Pick muscle group */}
                            {!addSetMuscleGroup ? (
                              <>
                                <p className="text-[10px] text-[#444] uppercase font-semibold tracking-wider">Select Muscle Group</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {MUSCLE_GROUPS.map(g => (
                                    <button key={g} onClick={() => { setAddSetMuscleGroup(g); setAddSetExercise(''); setAddSetCustom(false); }}
                                      className="text-[11px] font-semibold text-[#888] py-2.5 rounded-xl bg-[#1a1a1a] active:bg-[#f0a050]/10 active:text-[#f0a050] text-left px-3">
                                      {GROUP_EMOJI[g]} {g}
                                    </button>
                                  ))}
                                </div>
                                <button onClick={() => setShowAddSet(null)} className="w-full py-2 text-[11px] text-[#555] rounded-xl bg-[#1a1a1a]">Cancel</button>
                              </>
                            ) : !addSetExercise && !addSetCustom ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] text-[#f0a050] font-semibold uppercase tracking-wider">{GROUP_EMOJI[addSetMuscleGroup]} {addSetMuscleGroup}</p>
                                  <button onClick={() => setAddSetMuscleGroup('')} className="text-[10px] text-[#555]">← Back</button>
                                </div>
                                <div className="space-y-1">
                                  {EXERCISES_BY_GROUP[addSetMuscleGroup]?.map(ex => (
                                    <button key={ex} onClick={() => setAddSetExercise(ex)}
                                      className="w-full text-left text-[12px] text-[#888] py-2.5 px-3 rounded-xl bg-[#1a1a1a] active:bg-[#f0a050]/10 active:text-[#f0a050]">
                                      {ex}
                                    </button>
                                  ))}
                                  <button onClick={() => { setAddSetCustom(true); setAddSetExercise(''); }}
                                    className="w-full text-left text-[12px] text-[#555] py-2.5 px-3 rounded-xl border border-dashed border-[#2a2a2a]">
                                    + Custom exercise…
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] text-[#f0a050] font-semibold">{GROUP_EMOJI[addSetMuscleGroup]} {addSetMuscleGroup}</p>
                                    {!addSetCustom && <p className="text-[12px] font-semibold text-[#ccc] mt-0.5">{addSetExercise}</p>}
                                  </div>
                                  <button onClick={() => { setAddSetExercise(''); setAddSetCustom(false); }} className="text-[10px] text-[#555]">← Back</button>
                                </div>
                                <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                                  {addSetCustom && (
                                    <div className="flex items-center px-3 py-2.5 border-b border-white/10">
                                      <span className="text-[11px] text-[#888] w-24 flex-shrink-0">Exercise</span>
                                      <input type="text" placeholder="Custom name" value={addSetExercise}
                                        onChange={e => setAddSetExercise(e.target.value)}
                                        className="flex-1 bg-transparent text-[11px] text-white text-right outline-none placeholder-[#444]" />
                                    </div>
                                  )}
                                  {[
                                    { label: 'Set #', field: 'set_number', placeholder: '1' },
                                    { label: 'Reps', field: 'reps', placeholder: '10' },
                                    { label: 'Weight (lbs)', field: 'weight_lbs', placeholder: '135' },
                                  ].map(({ label, field, placeholder }, i, arr) => (
                                    <div key={field} className={`flex items-center px-3 py-2.5 ${i !== arr.length - 1 ? 'border-b border-white/10' : ''}`}>
                                      <span className="text-[11px] text-[#888] w-24 flex-shrink-0">{label}</span>
                                      <input type="number" placeholder={placeholder} value={(setForm as any)[field]}
                                        onChange={e => setSetForm(f => ({ ...f, [field]: e.target.value }))}
                                        className="flex-1 bg-transparent text-[11px] text-white text-right outline-none placeholder-[#444]" />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => { setShowAddSet(null); setAddSetMuscleGroup(''); setAddSetExercise(''); setAddSetCustom(false); }}
                                    className="flex-1 py-2 rounded-xl bg-[#2a2a2a] text-[11px] text-[#555]">Cancel</button>
                                  <button onClick={() => handleAddSet(s.id)} disabled={savingSet || !addSetExercise}
                                    className="flex-1 py-2 rounded-xl bg-[#f0a050]/10 text-[11px] text-[#f0a050] font-semibold disabled:opacity-40">
                                    {savingSet ? '…' : 'Add Set'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="px-4 py-3 border-t border-[#1a1a1a] flex gap-2">
                            <button onClick={() => { setShowAddSet(s.id); setAddSetMuscleGroup(''); setAddSetExercise(''); setAddSetCustom(false); setSetForm({ set_number: '', reps: '', weight_lbs: '' }); }}
                              className="flex-1 py-2 rounded-xl bg-[#f0a050]/10 text-[11px] text-[#f0a050] font-semibold">+ Add Exercise / Set</button>
                            <button onClick={() => setDeleteId(s.id)} className="px-4 py-2 rounded-xl bg-[#ef4444]/10 text-[11px] text-[#ef4444] font-semibold">Delete</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* Exercises history view */}
      {subTab === 'exercises' && (
        <div className="space-y-4">
          {allSets.length === 0 ? (
            <div className="text-center py-12 text-[#333] text-sm">No exercises logged yet — start a strength session and add sets</div>
          ) : (
            Object.entries(exerciseHistory).sort(([a], [b]) => MUSCLE_GROUPS.indexOf(a) - MUSCLE_GROUPS.indexOf(b)).map(([group, exercises]) => (
              <div key={group}>
                <SectionLabel>{GROUP_EMOJI[group] || '💪'} {group}</SectionLabel>
                <Card className="overflow-hidden">
                  {exercises.sort((a, b) => a.sets[0]?.exercise_name.localeCompare(b.sets[0]?.exercise_name)).map((ex, idx) => {
                    const name = ex.sets[0]?.exercise_name || '';
                    const isExpanded = expandedExercise === `${group}:${name}`;
                    // Group sets by session date for history
                    const bySession: Record<string, WorkoutSet[]> = {};
                    for (const s of ex.sets) {
                      const d = s.workout_sessions?.session_date || 'Unknown';
                      if (!bySession[d]) bySession[d] = [];
                      bySession[d].push(s);
                    }
                    const sessionDates = Object.keys(bySession).sort((a, b) => b.localeCompare(a));
                    return (
                      <div key={name}>
                        <div
                          className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${!isExpanded && idx !== exercises.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                          onClick={() => setExpandedExercise(isExpanded ? null : `${group}:${name}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#ccc]">{name}</p>
                            <div className="flex gap-3 text-[10px] text-[#444] mt-0.5">
                              <span>{ex.totalSets} sets logged</span>
                              {ex.maxWeight > 0 && <span>· {ex.maxWeight}lbs max</span>}
                              {ex.lastDate && <span>· Last: {fmtShortDate(ex.lastDate)}</span>}
                            </div>
                          </div>
                          <span className={`text-[10px] text-[#555] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                        </div>
                        {isExpanded && (
                          <div className={`bg-[#0a0a0a] px-4 py-3 space-y-3 ${idx !== exercises.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                            {sessionDates.slice(0, 10).map(date => (
                              <div key={date}>
                                <p className="text-[10px] font-semibold text-[#555] mb-1.5">{date !== 'Unknown' ? fmtDate(date) : 'Unknown date'}</p>
                                {bySession[date].map(s => (
                                  <div key={s.id} className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] text-[#333] w-10">{s.set_number != null ? `S${s.set_number}` : '—'}</span>
                                    <span className="text-[11px] text-[#666]">
                                      {s.reps != null ? `${s.reps} reps` : '—'}
                                      {s.weight_lbs != null ? ` @ ${parseFloat(String(s.weight_lbs))}lbs` : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {sessionDates.length > 10 && <p className="text-[10px] text-[#333]">+{sessionDates.length - 10} more sessions</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))
          )}
        </div>
      )}

      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} />}
    </>
  );
}

// ─── Add Session Modal ────────────────────────────────────────────────────────

function AddModal({ type, onClose, onSaved }: { type: 'cardio' | 'strength'; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ session_date: today(), name: '', duration_minutes: '', calories_burned: '', distance_miles: '', avg_heart_rate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setError('');
    if (type === 'strength' && !form.name) { setError('Workout name is required'); return; }
    setSaving(true);
    try {
      const body: any = { session_date: form.session_date, workout_type: type, name: form.name || null, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null, notes: form.notes || null };
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

  function Field({ label, field, ft = 'text', placeholder = '' }: { label: string; field: string; ft?: string; placeholder?: string }) {
    return (
      <div className="flex items-center px-4 py-3 border-b border-white/10 last:border-0">
        <span className="text-sm text-[#888] w-28 flex-shrink-0">{label}</span>
        <input type={ft} value={(form as any)[field]} placeholder={placeholder} onChange={e => set(field, e.target.value)}
          className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e]">
          <button onClick={onClose} className="text-[#f0a050] text-sm">Cancel</button>
          <h2 className="text-base font-semibold text-white">{type === 'cardio' ? 'Log Cardio' : 'New Strength Workout'}</h2>
          <button onClick={handleSave} disabled={saving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-40">{saving ? '…' : 'Save'}</button>
        </div>
        <div className="px-4 pt-4">
          <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
            {type === 'cardio' ? (
              <>
                <Field label="Date" field="session_date" ft="date" />
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-28 flex-shrink-0">Type</span>
                  <select value={form.name} onChange={e => set('name', e.target.value)}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e]">
                    <option value="" className="bg-[#2c2c2e]">Select…</option>
                    {CARDIO_TYPES.map(t => <option key={t} value={t} className="bg-[#2c2c2e]">{CARDIO_EMOJI[t]} {t}</option>)}
                  </select>
                </div>
                <Field label="Duration (min)" field="duration_minutes" ft="number" placeholder="30" />
                <Field label="Distance (mi)" field="distance_miles" ft="number" placeholder="3.1" />
                <Field label="Avg HR" field="avg_heart_rate" ft="number" placeholder="145" />
                <Field label="Calories" field="calories_burned" ft="number" placeholder="300" />
                <Field label="Notes" field="notes" placeholder="Optional" />
              </>
            ) : (
              <>
                <Field label="Date" field="session_date" ft="date" />
                <Field label="Name" field="name" placeholder="Chest Day, Push Day, Legs…" />
                <Field label="Duration (min)" field="duration_minutes" ft="number" placeholder="60" />
                <Field label="Notes" field="notes" placeholder="Optional" />
              </>
            )}
          </div>
          {type === 'strength' && <p className="text-[10px] text-[#444] px-1 mt-3">After saving, tap the session to add exercises and sets.</p>}
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

  return (
    <>
      <div className="fixed inset-0 bg-black flex flex-col overflow-hidden select-none">
        <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 z-30">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-white">Workouts 💪</h1>
            <button onClick={() => { if (navigator.vibrate) navigator.vibrate(8); setShowAdd(true); }}
              className="text-sm font-semibold text-[#f0a050] active:opacity-70 px-2 py-1">
              {activeTab === 0 ? 'Log Cardio' : 'New Workout'}
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
        <AddModal type={activeTab === 0 ? 'cardio' : 'strength'} onClose={() => setShowAdd(false)} onSaved={() => setRefreshCount(c => c + 1)} />
      )}
    </>
  );
}