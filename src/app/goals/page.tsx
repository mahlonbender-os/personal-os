'use client';

import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

const TABS = ['Goals', 'Habits'];
const CATEGORIES = ['personal', 'work', 'health', 'finance', 'home', 'fitness', 'learning', 'other'];
const ICONS = ['🎯', '💪', '💰', '🏠', '📚', '🏋️', '✈️', '🎸', '🌱', '⭐', '🚀', '❤️'];
const COLORS = ['#f0a050', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// ─── Goal Detail Modal ────────────────────────────────────────────────────────
function GoalDetailModal({ goal, onClose, onDelete, onProgressChange, onToggleMilestone }: {
  goal: any;
  onClose: () => void;
  onDelete: () => void;
  onProgressChange: (p: number) => void;
  onToggleMilestone: (m: any) => void;
}) {
  const [localProgress, setLocalProgress] = useState(goal.progress);
  const [saving, setSaving] = useState(false);

  async function saveProgress() {
    setSaving(true);
    await onProgressChange(localProgress);
    setSaving(false);
  }

  const sortedMilestones = [...(goal.goal_milestones || [])].sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[#1c1c1e] w-full rounded-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: goal.color + '20' }}>
                {goal.icon}
              </div>
              <div>
                <h2 className="font-semibold text-base text-white">{goal.title}</h2>
                <p className="text-xs text-[#555] capitalize">{goal.category}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onDelete} className="p-2 text-[#ef4444]">🗑</button>
              <button onClick={onClose} className="p-2 text-[#555]">✕</button>
            </div>
          </div>

          {/* Description */}
          {goal.description && (
            <p className="text-sm text-[#666] mb-4">{goal.description}</p>
          )}

          {/* Progress */}
          <div className="bg-[#2c2c2e] rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white">Progress</span>
              <span className="text-sm font-bold font-mono" style={{ color: goal.color }}>{localProgress}%</span>
            </div>
            <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full transition-all" style={{ width: `${localProgress}%`, backgroundColor: goal.color }} />
            </div>
            <input
              type="range" min={0} max={100} value={localProgress}
              onChange={e => setLocalProgress(Number(e.target.value))}
              className="w-full accent-[#f0a050]"
            />
            {localProgress !== goal.progress && (
              <button
                onClick={saveProgress}
                disabled={saving}
                className="mt-3 w-full bg-[#f0a050] text-black rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Progress'}
              </button>
            )}
          </div>

          {/* Milestones */}
          {sortedMilestones.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-[#444] uppercase tracking-widest mb-3">Milestones</h3>
              <div className="space-y-2">
                {sortedMilestones.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => onToggleMilestone(m)}
                    className="w-full flex items-center gap-3 bg-[#2c2c2e] rounded-xl px-3 py-2.5 text-left active:opacity-70"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${m.is_completed ? 'border-[#f0a050] bg-[#f0a050]' : 'border-[#444]'}`}>
                      {m.is_completed && <span className="text-black text-[10px]">✓</span>}
                    </div>
                    <span className={`text-sm ${m.is_completed ? 'line-through text-[#444]' : 'text-[#ccc]'}`}>{m.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Target date */}
          {goal.target_date && (
            <div className="flex items-center gap-2 text-xs text-[#555]">
              <span>🎯</span>
              Target: {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Goal Modal ───────────────────────────────────────────────────────────
function AddGoalModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('personal');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#f0a050');
  const [targetDate, setTargetDate] = useState('');
  const [milestones, setMilestones] = useState(['']);
  const [saving, setSaving] = useState(false);

  async function saveGoal() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const milestoneList = milestones.filter(m => m.trim()).map(m => ({ title: m.trim() }));
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          icon,
          color,
          target_date: targetDate || null,
          milestones: milestoneList,
        }),
      });
      onSave();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-[#1c1c1e] w-full rounded-2xl"
        style={{ maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}
      >
        {/* iOS-style top bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <button onClick={onClose} className="text-[#f0a050] text-sm">Cancel</button>
          <h2 className="text-base font-semibold text-white">New Goal</h2>
          <button onClick={saveGoal} disabled={!title.trim() || saving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-30">
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 pb-12">
          {/* Title */}
          <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What do you want to achieve?"
              className="w-full px-4 py-3.5 bg-transparent text-white text-sm placeholder-[#555] outline-none"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Why does this matter?"
              rows={2}
              className="w-full px-4 py-3.5 bg-transparent text-white text-sm placeholder-[#555] outline-none resize-none"
            />
          </div>

          {/* Icon */}
          <div>
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">Icon</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center ${icon === i ? 'bg-[#f0a050]/20 ring-2 ring-[#f0a050]' : 'bg-[#2c2c2e]'}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">Color</p>
            <div className="flex gap-3">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-[#1c1c1e] scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${category === cat ? 'bg-[#f0a050] text-black' : 'bg-[#2c2c2e] text-[#555]'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Target date */}
          <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm text-white">Target Date</span>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="text-sm text-[#f0a050] bg-transparent outline-none text-right"
              />
            </div>
          </div>

          {/* Milestones */}
          <div>
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">Milestones</p>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={m}
                    onChange={e => { const next = [...milestones]; next[i] = e.target.value; setMilestones(next); }}
                    placeholder={`Milestone ${i + 1}`}
                    className="flex-1 bg-[#2c2c2e] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#555] outline-none"
                  />
                  {milestones.length > 1 && (
                    <button onClick={() => setMilestones(milestones.filter((_, j) => j !== i))} className="px-3 text-[#ef4444] text-sm">✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setMilestones([...milestones, ''])} className="text-xs text-[#f0a050] flex items-center gap-1 pl-1">
                + Add milestone
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GoalsPage() {
  const [activeTab, setActiveTab] = useState(0);

  // Goals state
  const [goals, setGoals] = useState<any[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);

  // Habits state
  const [habits, setHabits] = useState<any[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [habitDesc, setHabitDesc] = useState('');
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setGoalsLoading(true);
    try {
      const suffix = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`/api/goals${suffix}`);
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (err) { console.error(err); }
    finally { setGoalsLoading(false); }
  }, [filter]);

  async function fetchHabits() {
    setHabitsLoading(true);
    try {
      const res = await fetch('/api/habits');
      if (res.ok) {
        const data = await res.json();
        setHabits(data);
        localStorage.setItem('habits-cache', JSON.stringify(data));
      }
    } catch (err) { console.error(err); }
    finally { setHabitsLoading(false); }
  }

  async function refreshAll() {
    await Promise.all([fetchGoals(), fetchHabits()]);
  }

  useEffect(() => { fetchGoals(); }, [fetchGoals]);
  useEffect(() => {
    const cached = localStorage.getItem('habits-cache');
    if (cached) { try { setHabits(JSON.parse(cached)); setHabitsLoading(false); } catch {} }
    fetchHabits();
  }, []);

  async function deleteGoal(id: string) {
    await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
    fetchGoals();
    setSelectedGoal(null);
  }

  async function updateGoalProgress(id: string, progress: number) {
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, progress }),
    });
    fetchGoals();
  }

  async function toggleMilestone(milestone: any) {
    await fetch('/api/goals/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: milestone.id, is_completed: !milestone.is_completed }),
    });
    fetchGoals();
    if (selectedGoal) {
      const res = await fetch('/api/goals');
      const updated = (await res.json()).goals?.find((g: any) => g.id === selectedGoal.id);
      if (updated) setSelectedGoal(updated);
    }
  }

  async function toggleHabit(habitId: string) {
    navigator.vibrate && navigator.vibrate(12);
    setHabits(h => h.map(hab => {
      if (hab.id !== habitId) return hab;
      const done = !hab.isCompletedToday;
      return { ...hab, isCompletedToday: done, currentStreak: done ? hab.currentStreak + 1 : Math.max(0, hab.currentStreak - 1) };
    }));
    try {
      await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', habit_id: habitId }),
      });
      const res = await fetch('/api/habits');
      if (res.ok) setHabits(await res.json());
    } catch (err) { console.error(err); }
  }

  async function saveHabit() {
    if (!habitName.trim()) return;
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: habitName.trim(), description: habitDesc.trim() || null }),
      });
      if (res.ok) { setShowAddHabit(false); setHabitName(''); setHabitDesc(''); fetchHabits(); }
    } catch (err) { console.error(err); }
  }

  async function deleteHabit(id: string) {
    try {
      const res = await fetch(`/api/habits?id=${id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteHabitId(null); fetchHabits(); }
    } catch (err) { console.error(err); }
  }

  const activeGoalsCount = goals.filter(g => g.status === 'active').length;
  const habitsCompletedToday = habits.filter(h => h.isCompletedToday).length;

  return (
    <div className="min-h-screen bg-black">
      <PullToRefresh onRefresh={refreshAll}>
        <div className="pb-24">

          {/* ── Sticky header with + button for both tabs ── */}
          <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white">{activeTab === 0 ? 'Goals' : 'Habits'}</h1>
                {activeTab === 0 && activeGoalsCount > 0 && (
                  <p className="text-[10px] text-[#555] mt-0.5">{activeGoalsCount} active</p>
                )}
                {activeTab === 1 && habits.length > 0 && (
                  <p className="text-[10px] text-[#555] mt-0.5">{habitsCompletedToday}/{habits.length} done today</p>
                )}
              </div>
              {/* Context-aware + button — Goals tab opens Goals modal, Habits tab opens Habits modal */}
              <button
                onClick={() => {
                  navigator.vibrate && navigator.vibrate(8);
                  activeTab === 0 ? setShowAddGoal(true) : setShowAddHabit(true);
                }}
                className="w-9 h-9 rounded-full bg-[#f0a050] text-black flex items-center justify-center text-xl font-light"
              >
                +
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex border-t border-[#1a1a1a]">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(i); window.scrollTo(0, 0); navigator.vibrate && navigator.vibrate(8); }}
                  className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Filter chips — Goals tab only */}
            {activeTab === 0 && (
              <div className="flex gap-2 px-4 py-2.5">
                {['active', 'all', 'completed'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-[#f0a050] text-black' : 'bg-[#111] text-[#555] border border-[#1a1a1a]'}`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Goals tab ── */}
          {activeTab === 0 && (
            <div className="px-4 py-3 space-y-3">
              {goalsLoading ? (
                [0, 1, 2].map(i => <div key={i} className="h-24 bg-[#111] rounded-2xl animate-pulse" />)
              ) : goals.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🎯</div>
                  <p className="text-[#555] text-sm">No goals yet</p>
                  <p className="text-[#333] text-xs mt-1">Tap + to set a goal</p>
                </div>
              ) : (
                goals.map(goal => {
                  const completed = goal.goal_milestones?.filter((m: any) => m.is_completed).length || 0;
                  const total = goal.goal_milestones?.length || 0;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => setSelectedGoal(goal)}
                      className="w-full bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 text-left active:opacity-70 transition-opacity"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: goal.color + '20' }}>
                          {goal.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-medium text-white leading-snug">{goal.title}</p>
                            <span className="text-xs font-bold flex-shrink-0 font-mono" style={{ color: goal.color }}>{goal.progress}%</span>
                          </div>
                          <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, backgroundColor: goal.color }} />
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-[#555] capitalize">{goal.category}</span>
                            {total > 0 && <span className="text-[10px] text-[#444]">{completed}/{total} milestones</span>}
                            {goal.target_date && (
                              <span className="text-[10px] text-[#444]">
                                Due {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* ── Habits tab ── */}
          {activeTab === 1 && (
            <div className="px-4 pt-4 space-y-3">
              {habitsLoading && habits.length === 0 ? (
                [0, 1, 2].map(i => <div key={i} className="h-20 bg-[#111] rounded-2xl animate-pulse" />)
              ) : habits.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🔥</div>
                  <p className="text-[#555] text-sm">No habits yet</p>
                  <p className="text-[#333] text-xs mt-1">Tap + to add a habit</p>
                </div>
              ) : (
                habits.map(habit => (
                  <div key={habit.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex-1 pr-4">
                      <h3 className="font-semibold text-sm text-white">{habit.name}</h3>
                      {habit.description && <p className="text-xs text-[#555] mt-0.5">{habit.description}</p>}
                      <div className="flex items-center gap-1 mt-2 text-xs font-mono text-[#f0a050] font-bold">
                        <span>🔥</span>
                        <span>{habit.currentStreak} day streak</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleHabit(habit.id)}
                      onTouchStart={e => {
                        const timer = setTimeout(() => {
                          navigator.vibrate && navigator.vibrate([30, 30]);
                          setDeleteHabitId(habit.id);
                        }, 600);
                        e.currentTarget.addEventListener('touchend', () => clearTimeout(timer), { once: true });
                      }}
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all focus:outline-none select-none ${
                        habit.isCompletedToday
                          ? 'bg-[#f0a050] border-[#f0a050] text-black'
                          : 'bg-black border-[#222] text-transparent hover:border-[#f0a050]/40'
                      }`}
                    >
                      ✓
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </PullToRefresh>

      {/* ── No FAB for Habits — button is in the sticky header above ── */}

      <BottomNav active="goals" />

      {/* Goal detail modal */}
      {selectedGoal && (
        <GoalDetailModal
          goal={selectedGoal}
          onClose={() => { setSelectedGoal(null); fetchGoals(); }}
          onDelete={() => deleteGoal(selectedGoal.id)}
          onProgressChange={(p: number) => updateGoalProgress(selectedGoal.id, p)}
          onToggleMilestone={toggleMilestone}
        />
      )}

      {/* Add Goal modal */}
      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onSave={() => { setShowAddGoal(false); fetchGoals(); }}
        />
      )}

      {/* Add Habit modal */}
      {showAddHabit && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 border border-[#1a1a1a]">
            <h2 className="text-lg font-bold text-white mb-4">New Habit</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Name *</label>
                <input
                  type="text"
                  value={habitName}
                  onChange={e => setHabitName(e.target.value)}
                  placeholder="e.g., Read 20 minutes, Walk Knox"
                  autoFocus
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Description</label>
                <input
                  type="text"
                  value={habitDesc}
                  onChange={e => setHabitDesc(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowAddHabit(false); setHabitName(''); setHabitDesc(''); }}
                  className="flex-1 bg-black border border-[#1a1a1a] text-[#555] py-3 rounded-xl font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveHabit}
                  className="flex-1 bg-[#f0a050] text-black py-3 rounded-xl font-semibold text-sm"
                >
                  Add Habit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Habit confirm */}
      {deleteHabitId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a]">
            <h3 className="text-base font-bold text-white text-center">Delete this habit?</h3>
            <p className="text-xs text-[#555] text-center mt-1">All check-in history will be lost.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteHabitId(null)} className="flex-1 bg-black border border-[#1a1a1a] text-white py-3 rounded-xl text-sm font-semibold">Keep</button>
              <button onClick={() => deleteHabit(deleteHabitId)} className="flex-1 bg-[#ef4444] text-white py-3 rounded-xl text-sm font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}