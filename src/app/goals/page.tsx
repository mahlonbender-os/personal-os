'use client';

import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

const TABS = ['Goals', 'Habits'];
const CATEGORIES = ['personal', 'work', 'health', 'finance', 'home', 'fitness', 'learning', 'other'];
const ICONS = ['🎯', '💪', '💰', '🏠', '📚', '🏋️', '✈️', '🎸', '🌱', '⭐', '🚀', '❤️'];
const COLORS = ['#f0a050', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function GoalsPage() {
  const [activeTab, setActiveTab] = useState(0);

  // Universal Accordion Expand Trackers
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedHabits, setExpandedHabits] = useState<Set<string>>(new Set());

  // Goals State Vectors
  const [goals, setGoals] = useState<any[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState<any | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [goalProgressMap, setGoalProgressChangeMap] = useState<{ [key: string]: number }>({});
  const [isSavingGoalProgress, setIsSavingGoalProgress] = useState<{ [key: string]: boolean }>({});

  // Goal Form State Bindings
  const [gTitle, setGTitle] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gCategory, setGCategory] = useState('personal');
  const [gIcon, setGIcon] = useState('🎯');
  const [gColor, setGColor] = useState('#f0a050');
  const [gTargetDate, setGTargetDate] = useState('');
  const [gMilestones, setGMilestones] = useState(['']);
  const [isCommitSaving, setIsCommitSaving] = useState(false);

  // Habits State Vectors
  const [habits, setHabits] = useState<any[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showEditHabit, setShowEditHabit] = useState<any | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitDesc, setHabitDesc] = useState('');
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setGoalsLoading(true);
    try {
      const suffix = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`/api/goals${suffix}`);
      const data = await res.json();
      const fetchedGoals = data.goals || [];
      setGoals(fetchedGoals);
      
      // Seed local progress map trackers
      const initialProgressMap: { [key: string]: number } = {};
      fetchedGoals.forEach((g: any) => {
        initialProgressMap[g.id] = g.progress;
      });
      setGoalProgressChangeMap(prev => ({ ...initialProgressMap, ...prev }));
    } catch (err) { 
      console.error(err); 
    } finally { 
      setGoalsLoading(false); 
    }
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
    } catch (err) { 
      console.error(err); 
    } finally { 
      setHabitsLoading(false); 
    }
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

  // ─── Goal API Framework Actions ──────────────────────────────────────────
  async function saveNewGoal() {
    if (!gTitle.trim()) return;
    setIsCommitSaving(true);
    try {
      const milestoneList = gMilestones.filter(m => m.trim()).map(m => ({ title: m.trim() }));
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: gTitle.trim(),
          description: gDesc.trim() || null,
          category: gCategory,
          icon: gIcon,
          color: gColor,
          target_date: gTargetDate || null,
          milestones: milestoneList,
        }),
      });
      if (res.ok) {
        setShowAddGoal(false);
        setGTitle(''); setGDesc(''); setGTargetDate(''); setGMilestones(['']);
        await fetchGoals();
      }
    } finally { 
      setIsCommitSaving(false); 
    }
  }

  async function saveEditedGoalMetadata() {
    if (!showEditGoal || !gTitle.trim()) return;
    setIsCommitSaving(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: showEditGoal.id,
          title: gTitle.trim(),
          description: gDesc.trim() || null,
          category: gCategory,
          icon: gIcon,
          color: gColor,
          target_date: gTargetDate || null,
        }),
      });
      if (res.ok) {
        setShowEditGoal(null);
        setGTitle(''); setGDesc(''); setGTargetDate('');
        await fetchGoals();
      }
    } finally { 
      setIsCommitSaving(false); 
    }
  }

  async function deleteGoal(id: string) {
    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteGoalId(null);
        const next = new Set(expandedGoals);
        next.delete(id);
        setExpandedGoals(next);
        await fetchGoals();
      }
    } catch {}
  }

  async function updateGoalProgress(id: string) {
    const currentProgressValue = goalProgressMap[id];
    setIsSavingGoalProgress(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, progress: currentProgressValue }),
      });
      if (res.ok) {
        await fetchGoals();
      }
    } finally {
      setIsSavingGoalProgress(prev => ({ ...prev, [id]: false }));
    }
  }

  async function toggleMilestone(goalId: string, milestoneId: string, currentStatus: boolean) {
    try {
      const res = await fetch('/api/goals/milestones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: milestoneId, is_completed: !currentStatus }),
      });
      if (res.ok) {
        await fetchGoals();
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ─── Habits API Framework Actions ─────────────────────────────────────────
  async function toggleHabit(habitId: string) {
    if (navigator.vibrate) navigator.vibrate(12);
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
    setIsCommitSaving(true);
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: habitName.trim(), description: habitDesc.trim() || null }),
      });
      if (res.ok) { setShowAddHabit(false); setHabitName(''); setHabitDesc(''); await fetchHabits(); }
    } catch (err) { 
      console.error(err); 
    } finally {
      setIsCommitSaving(false);
    }
  }

  async function saveEditedHabitMetadata() {
    if (!showEditHabit || !habitName.trim()) return;
    setIsCommitSaving(true);
    try {
      const res = await fetch('/api/habits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: showEditHabit.id, name: habitName.trim(), description: habitDesc.trim() || null }),
      });
      if (res.ok) { setShowEditHabit(null); setHabitName(''); setHabitDesc(''); await fetchHabits(); }
    } catch (err) { 
      console.error(err); 
    } finally {
      setIsCommitSaving(false);
    }
  }

  async function deleteHabit(id: string) {
    try {
      const res = await fetch(`/api/habits?id=${id}`, { method: 'DELETE' });
      if (res.ok) { 
        setDeleteHabitId(null); 
        const next = new Set(expandedHabits);
        next.delete(id);
        setExpandedHabits(next);
        await fetchHabits(); 
      }
    } catch (err) { console.error(err); }
  }

  const activeGoalsCount = goals.filter(g => g.status === 'active').length;
  const habitsCompletedToday = habits.filter(h => h.isCompletedToday).length;

  return (
    <div className="min-h-screen bg-black">
      <PullToRefresh onRefresh={refreshAll}>
        <div className="pb-24">

          {/* ── Sticky header context controls bar component ── */}
          <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {activeTab === 0 ? 'Goals' : 'Habits'}
                </h1>
                {activeTab === 0 && activeGoalsCount > 0 && (
                  <p className="text-[10px] text-[#555] mt-0.5">{activeGoalsCount} Operational Goals Active</p>
                )}
                {activeTab === 1 && habits.length > 0 && (
                  <p className="text-[10px] text-[#555] mt-0.5">{habitsCompletedToday}/{habits.length} Compliance Check-Ins Done Today</p>
                )}
              </div>
              
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(8);
                  if (activeTab === 0) {
                    setGTitle(''); setGDesc(''); setGTargetDate(''); setGCategory('personal'); setGIcon('🎯'); setGColor('#f0a050'); setGMilestones(['']);
                    setShowAddGoal(true);
                  } else {
                    setHabitName(''); setHabitDesc('');
                    setShowAddHabit(true);
                  }
                }}
                className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
              >
                {activeTab === 0 ? 'Add Goal' : 'Add Habit'}
              </button>
            </div>

            {/* Tab layout switcher row */}
            <div className="flex border-t border-[#1a1a1a]">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(i); window.scrollTo(0, 0); if (navigator.vibrate) navigator.vibrate(8); }}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Filter chips parameters — Goals tab only */}
            {activeTab === 0 && (
              <div className="flex gap-2 px-4 py-2.5 bg-black/40">
                {['active', 'all', 'completed'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium font-mono uppercase tracking-wide transition-colors ${filter === f ? 'bg-[#f0a050] text-black font-bold' : 'bg-[#111] text-[#555] border border-[#1a1a1a]'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Goals Interactive Tab Section View ── */}
          {activeTab === 0 && (
            <div className="px-4 py-3 space-y-3">
              {goalsLoading ? (
                [0, 1, 2].map(i => <div key={i} className="h-24 bg-[#111] rounded-2xl border border-[#1a1a1a] animate-pulse" />)
              ) : goals.length === 0 ? (
                <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-2xl">
                  <div className="text-4xl mb-3">🎯</div>
                  <p className="text-[#555] text-sm">No trackable goals detected</p>
                  <p className="text-[#333] text-xs mt-1">Tap Add Goal above to map execution milestones</p>
                </div>
              ) : (
                goals.map(goal => {
                  const completedMilestones = goal.goal_milestones?.filter((m: any) => m.is_completed).length || 0;
                  const totalMilestones = goal.goal_milestones?.length || 0;
                  const expanded = expandedGoals.has(goal.id);
                  const sortedMilestones = [...(goal.goal_milestones || [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
                  const currentLocalProgress = goalProgressMap[goal.id] !== undefined ? goalProgressMap[goal.id] : goal.progress;
                  const isProgressModified = currentLocalProgress !== goal.progress;

                  return (
                    <div
                      key={goal.id}
                      className="w-full bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden transition-all"
                    >
                      {/* Accordion Trigger Header Box */}
                      <div
                        onClick={() => {
                          const next = new Set(expandedGoals);
                          expanded ? next.delete(goal.id) : next.add(goal.id);
                          setExpandedGoals(next);
                        }}
                        className="p-4 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: goal.color + '20' }}>
                            {goal.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-white leading-tight truncate">{goal.title}</p>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-[#555] font-mono uppercase tracking-wide">
                              <span>{goal.category}</span>
                              {totalMilestones > 0 && <span>· {completedMilestones}/{totalMilestones} Milestones</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-sm font-bold font-mono" style={{ color: goal.color }}>{goal.progress}%</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>

                      {/* Expandable Accordion Dropdown Content */}
                      {expanded && (
                        <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] bg-black/20 space-y-4">
                          
                          {/* Description */}
                          {goal.description && (
                            <p className="text-xs text-[#ccc] leading-relaxed bg-black/40 p-2.5 rounded-xl">{goal.description}</p>
                          )}

                          {/* Progress Range Engine Tracker Block */}
                          <div className="bg-black/30 border border-[#1a1a1a]/60 rounded-xl p-3.5">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-mono uppercase tracking-wider text-[#555]">Update Progress</span>
                              <span className="text-xs font-bold font-mono" style={{ color: goal.color }}>{currentLocalProgress}%</span>
                            </div>
                            <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
                              <div className="h-full rounded-full transition-all" style={{ width: `${currentLocalProgress}%`, backgroundColor: goal.color }} />
                            </div>
                            <input
                              type="range" min={0} max={100} value={currentLocalProgress}
                              onChange={e => setGoalProgressChangeMap(prev => ({ ...prev, [goal.id]: Number(e.target.value) }))}
                              className="w-full accent-[#f0a050]"
                            />
                            {isProgressModified && (
                              <button
                                onClick={() => updateGoalProgress(goal.id)}
                                disabled={isSavingGoalProgress[goal.id]}
                                className="mt-3 w-full bg-[#f0a050] text-black rounded-xl py-2 text-xs font-bold font-mono uppercase tracking-wide disabled:opacity-50"
                              >
                                {isSavingGoalProgress[goal.id] ? 'Saving…' : 'Commit New Progress Level'}
                              </button>
                            )}
                          </div>

                          {/* Milestones Check-In Lists */}
                          {sortedMilestones.length > 0 && (
                            <div>
                              <h3 className="text-[9px] font-bold text-[#555] uppercase tracking-widest mb-2 font-mono">Milestone Checklist</h3>
                              <div className="space-y-1.5">
                                {sortedMilestones.map((m: any) => (
                                  <button
                                    key={m.id}
                                    onClick={() => toggleMilestone(goal.id, m.id, m.is_completed)}
                                    className="w-full flex items-center gap-3 bg-black/40 border border-[#1a1a1a]/40 rounded-xl px-3 py-2.5 text-left active:opacity-70"
                                  >
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${m.is_completed ? 'border-[#f0a050] bg-[#f0a050]' : 'border-[#333]'}`}>
                                      {m.is_completed && <span className="text-black text-[9px] font-bold">✓</span>}
                                    </div>
                                    <span className={`text-xs font-medium ${m.is_completed ? 'line-through text-[#444]' : 'text-[#ccc]'}`}>{m.title}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Target Deadline Parameters */}
                          {goal.target_date && (
                            <div className="flex items-center gap-1.5 text-[11px] text-[#555] font-mono">
                              <span>🎯</span>
                              <span>Target Target: {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          )}

                          {/* Action Items Bar Footer */}
                          <div className="flex items-center gap-4 pt-1 border-t border-[#1a1a1a]/60">
                            <button
                              onClick={() => {
                                setGTitle(goal.title);
                                setGDesc(goal.description || '');
                                setGCategory(goal.category || 'personal');
                                setGIcon(goal.icon || '🎯');
                                setGColor(goal.color || '#f0a050');
                                setGTargetDate(goal.target_date || '');
                                setShowEditGoal(goal);
                              }}
                              className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider"
                            >
                              Edit details
                            </button>
                            <button
                              onClick={() => setDeleteGoalId(goal.id)}
                              className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider"
                            >
                              Delete goal
                            </button>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Habits Interactive Tab Section View ── */}
          {activeTab === 1 && (
            <div className="px-4 pt-4 space-y-3">
              {habitsLoading && habits.length === 0 ? (
                [0, 1, 2].map(i => <div key={i} className="h-20 bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />)
              ) : habits.length === 0 ? (
                <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-2xl">
                  <div className="text-4xl mb-3">🔥</div>
                  <p className="text-[#555] text-sm">No trackable habits configured</p>
                  <p className="text-[#333] text-xs mt-1">Tap Add Habit above to initiate consistency matrices</p>
                </div>
              ) : (
                habits.map(habit => {
                  const expanded = expandedHabits.has(habit.id);
                  return (
                    <div
                      key={habit.id}
                      className="w-full bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden transition-all"
                    >
                      {/* Habit Header Container Row */}
                      <div 
                        onClick={() => {
                          const next = new Set(expandedHabits);
                          expanded ? next.delete(habit.id) : next.add(habit.id);
                          setExpandedHabits(next);
                        }}
                        className="p-4 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                      >
                        <div className="flex-1 pr-4 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-white truncate">{habit.name}</h3>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"
                              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', shrink: '0' }}>
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs font-mono text-[#f0a050] font-bold">
                            <span>🔥</span>
                            <span>{habit.currentStreak} Day Streak</span>
                          </div>
                        </div>

                        {/* Interactive Checklist Quick Toggle Element Checkbox Box */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHabit(habit.id);
                          }}
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all focus:outline-none select-none shrink-0 ${
                            habit.isCompletedToday
                              ? 'bg-[#f0a050] border-[#f0a050] text-black font-black'
                              : 'bg-black border-[#222] text-transparent hover:border-[#f0a050]/40'
                          }`}
                        >
                          ✓
                        </button>
                      </div>

                      {/* Expandable Habit Sub-Panel Details Info */}
                      {expanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-[#1a1a1a] bg-black/20 space-y-3">
                          {habit.description ? (
                            <p className="text-xs text-[#ccc] leading-relaxed bg-black/40 p-2.5 rounded-xl">{habit.description}</p>
                          ) : (
                            <p className="text-[11px] font-sans text-[#444] italic px-0.5">No administrative habit descriptions mapped.</p>
                          )}

                          {/* Actions Row Bar Controls */}
                          <div className="flex items-center gap-4 pt-1 border-t border-[#1a1a1a]/50">
                            <button
                              onClick={() => {
                                setHabitName(habit.name);
                                setHabitDesc(habit.description || '');
                                setShowEditHabit(habit);
                              }}
                              className="text-[#f0a050] text-xs font-semibold uppercase tracking-wider"
                            >
                              Edit habit
                            </button>
                            <button
                              onClick={() => setDeleteHabitId(habit.id)}
                              className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider"
                            >
                              Delete habit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </PullToRefresh>

      <BottomNav activeTab="goals" />

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Add Goal Modal Layer Container Layout */}
      {showAddGoal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div
            className="bg-[#1c1c1e] w-full max-w-md rounded-2xl border border-[#1a1a1a]"
            style={{ maxHeight: '85vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1a1a1a] sticky top-0 bg-[#1c1c1e] z-10">
              <button onClick={() => setShowAddGoal(false)} className="text-[#555] text-sm font-semibold">Cancel</button>
              <h2 className="text-base font-bold font-mono text-white uppercase tracking-wide">New Goal</h2>
              <button onClick={saveNewGoal} disabled={!gTitle.trim() || isCommitSaving} className="text-[#f0a050] text-sm font-bold uppercase disabled:opacity-30">
                {isCommitSaving ? 'Saving…' : 'Add'}
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 pb-8">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Goal Heading Statement *</label>
                <input
                  type="text"
                  value={gTitle}
                  onChange={e => setGTitle(e.target.value)}
                  placeholder="What objective are you targeting?"
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Execution Rationale Description</label>
                <textarea
                  value={gDesc}
                  onChange={e => setGDesc(e.target.value)}
                  placeholder="Detail the metrics or boundaries why this matters..."
                  rows={2}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#f0a050] resize-none"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5 font-mono">Icon Asset Signature</p>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(i => (
                    <button
                      key={i}
                      onClick={() => setGIcon(i)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center ${gIcon === i ? 'bg-[#f0a050]/20 ring-1 ring-[#f0a050]' : 'bg-black border border-[#1a1a1a]'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5 font-mono">Color Token Hex Code</p>
                <div className="flex flex-wrap gap-2.5">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setGColor(c)}
                      className={`w-7 h-8 rounded-full transition-all ${gColor === c ? 'ring-2 ring-offset-2 ring-offset-[#1c1c1e] ring-[#f0a050] scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5 font-mono">Target Category Classification</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setGCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold font-mono uppercase tracking-wide ${gCategory === cat ? 'bg-[#f0a050] text-black font-bold' : 'bg-black border border-[#1a1a1a] text-[#555]'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Target Target Deadline Date</label>
                <input
                  type="date"
                  value={gTargetDate}
                  onChange={e => setGTargetDate(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5 font-mono">Milestones Construction Setup</p>
                <div className="space-y-2">
                  {gMilestones.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={m}
                        onChange={e => { const next = [...gMilestones]; next[i] = e.target.value; setGMilestones(next); }}
                        placeholder={`Milestone Layer Node ${i + 1}`}
                        className="flex-1 bg-black border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#f0a050]"
                      />
                      {gMilestones.length > 1 && (
                        <button onClick={() => setGMilestones(gMilestones.filter((_, j) => j !== i))} className="px-2 text-[#ef4444] text-sm">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setGMilestones([...gMilestones, ''])} className="text-xs text-[#f0a050] flex items-center gap-1 pl-0.5 font-semibold font-mono uppercase tracking-wider pt-0.5">
                    + Add milestone layer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goal Metadata Modal Container Layout */}
      {showEditGoal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div
            className="bg-[#1c1c1e] w-full max-w-md rounded-2xl border border-[#1a1a1a]"
            style={{ maxHeight: '85vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1a1a1a] sticky top-0 bg-[#1c1c1e] z-10">
              <button onClick={() => setShowEditGoal(null)} className="text-[#555] text-sm font-semibold">Cancel</button>
              <h2 className="text-base font-bold font-mono text-white uppercase tracking-wide">Modify Goal</h2>
              <button onClick={saveEditedGoalMetadata} disabled={!gTitle.trim() || isCommitSaving} className="text-[#f0a050] text-sm font-bold uppercase disabled:opacity-30">
                {isCommitSaving ? 'Updating…' : 'Save'}
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 pb-8">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Goal Heading Statement *</label>
                <input
                  type="text"
                  value={gTitle}
                  onChange={e => setGTitle(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Execution Rationale Description</label>
                <textarea
                  value={gDesc}
                  onChange={e => setGDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#f0a050] resize-none"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5 font-mono">Icon Asset Signature</p>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(i => (
                    <button
                      key={i}
                      onClick={() => setGIcon(i)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center ${gIcon === i ? 'bg-[#f0a050]/20 ring-1 ring-[#f0a050]' : 'bg-black border border-[#1a1a1a]'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5 font-mono">Color Token Hex Code</p>
                <div className="flex flex-wrap gap-2.5">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setGColor(c)}
                      className={`w-7 h-8 rounded-full transition-all ${gColor === c ? 'ring-2 ring-offset-2 ring-offset-[#1c1c1e] ring-[#f0a050] scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5 font-mono">Target Category Classification</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setGCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold font-mono uppercase tracking-wide ${gCategory === cat ? 'bg-[#f0a050] text-black font-bold' : 'bg-black border border-[#1a1a1a] text-[#555]'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Target Target Deadline Date</label>
                <input
                  type="date"
                  value={gTargetDate}
                  onChange={e => setGTargetDate(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0a050]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Habit Overlay Form Modal View */}
      {showAddHabit && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 border border-[#1a1a1a]">
            <h2 className="text-base font-bold font-mono text-[#f0a050] uppercase tracking-wide mb-4">Add Habit Sequence</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Habit Name *</label>
                <input
                  type="text"
                  value={habitName}
                  onChange={e => setHabitName(e.target.value)}
                  placeholder="e.g., Read 20 minutes, Walk Knox puppy"
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Administrative Details Description</label>
                <input
                  type="text"
                  value={habitDesc}
                  onChange={e => setHabitDesc(e.target.value)}
                  placeholder="Optional frequency parameters..."
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
                  disabled={!habitName.trim() || isCommitSaving}
                  className="flex-1 bg-[#f0a050] text-black py-3 rounded-xl font-bold text-sm uppercase tracking-wide"
                >
                  {isCommitSaving ? 'Saving…' : 'Add Habit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Habit Overlay Form Modal View */}
      {showEditHabit && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 border border-[#1a1a1a]">
            <h2 className="text-base font-bold font-mono text-[#f0a050] uppercase tracking-wide mb-4">Modify Habit Parameters</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Habit Name *</label>
                <input
                  type="text"
                  value={habitName}
                  onChange={e => setHabitName(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[#555] font-mono mb-1">Administrative Details Description</label>
                <input
                  type="text"
                  value={habitDesc}
                  onChange={e => setHabitDesc(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#f0a050]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowEditHabit(null); setHabitName(''); setHabitDesc(''); }}
                  className="flex-1 bg-black border border-[#1a1a1a] text-[#555] py-3 rounded-xl font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditedHabitMetadata}
                  disabled={!habitName.trim() || isCommitSaving}
                  className="flex-1 bg-[#f0a050] text-black py-3 rounded-xl font-bold text-sm uppercase tracking-wide"
                >
                  {isCommitSaving ? 'Updating…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Goal Confirmation Sheet Bottom Node Wrapper */}
      {deleteGoalId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a] space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">Drop Goal Path?</h3>
              <p className="text-xs text-[#555]">This action permanently breaks associated milestone checkpoints.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteGoalId(null)} className="flex-1 bg-black border border-[#1a1a1a] text-white py-3 rounded-xl text-sm font-medium">Keep</button>
              <button onClick={() => deleteGoal(deleteGoalId)} className="flex-1 bg-[#ef4444] text-white py-3 rounded-xl text-sm font-bold">Delete Goal</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Habit Confirmation Sheet Bottom Node Wrapper */}
      {deleteHabitId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a] space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">Drop Habit Chain?</h3>
              <p className="text-xs text-[#555]">All logging history logs and checked streak numbers will be dropped.</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteHabitId(null)} className="flex-1 bg-black border border-[#1a1a1a] text-white py-3 rounded-xl text-sm font-medium">Keep</button>
              <button onClick={() => deleteHabit(deleteHabitId)} className="flex-1 bg-[#ef4444] text-white py-3 rounded-xl text-sm font-bold">Delete Habit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}