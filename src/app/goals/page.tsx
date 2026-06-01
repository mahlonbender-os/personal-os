'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Target, Check, Trash2, ChevronRight, X, TrendingUp } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';

interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  is_completed: boolean;
  completed_at?: string;
  due_date?: string;
  sort_order: number;
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  progress: number;
  target_date?: string;
  color: string;
  icon: string;
  goal_milestones: Milestone[];
  created_at: string;
}

const CATEGORIES = ['personal', 'work', 'health', 'finance', 'home', 'fitness', 'learning', 'other'];
const GOAL_ICONS = ['🎯', '💪', '💰', '🏠', '📚', '🏋️', '✈️', '🎸', '🌱', '⭐', '🚀', '❤️'];
const GOAL_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`/api/goals${params}`);
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const deleteGoal = async (id: string) => {
    await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
    fetchGoals();
    setSelectedGoal(null);
  };

  const updateProgress = async (id: string, progress: number) => {
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, progress }),
    });
    fetchGoals();
  };

  const toggleMilestone = async (milestone: Milestone) => {
    await fetch('/api/goals/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: milestone.id, is_completed: !milestone.is_completed }),
    });
    fetchGoals();
    // Refresh selected goal
    if (selectedGoal) {
      const res = await fetch('/api/goals');
      const data = await res.json();
      const updated = data.goals?.find((g: Goal) => g.id === selectedGoal.id);
      if (updated) setSelectedGoal(updated);
    }
  };

  const activeCount = goals.filter(g => g.status === 'active').length;

  return (
    <div className="min-h-screen bg-background">
      <PullToRefresh onRefresh={async () => { await fetchGoals(); }}>
        <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 pt-14 pb-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Goals</h1>
            {activeCount > 0 && (
              <p className="text-xs text-muted-foreground">{activeCount} active</p>
            )}
          </div>
          <button
            onClick={() => { setShowAddModal(true); }}
            className="bg-primary text-primary-foreground rounded-full p-2"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 pb-3">
          {(['active', 'all', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Goals list */}
      <div className="px-4 py-3 space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))
        ) : goals.length === 0 ? (
          <div className="text-center py-16">
            <Target className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No goals yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Tap + to set a goal</p>
          </div>
        ) : (
          goals.map(goal => {
            const milestonesDone = goal.goal_milestones?.filter(m => m.is_completed).length || 0;
            const milestonesTotal = goal.goal_milestones?.length || 0;

            return (
              <button
                key={goal.id}
                onClick={() => setSelectedGoal(goal)}
                className="w-full bg-card border border-border rounded-2xl p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  {/* Icon with color background */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: goal.color + '20' }}
                  >
                    {goal.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-snug">{goal.title}</p>
                      <span className="text-xs font-bold shrink-0" style={{ color: goal.color }}>
                        {goal.progress}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${goal.progress}%`, backgroundColor: goal.color }}
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground capitalize">{goal.category}</span>
                      {milestonesTotal > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {milestonesDone}/{milestonesTotal} milestones
                        </span>
                      )}
                      {goal.target_date && (
                        <span className="text-xs text-muted-foreground">
                          Due {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Add Goal Modal */}
      {showAddModal && (
        <GoalModal
          onClose={() => setShowAddModal(false)}
          onSave={() => { setShowAddModal(false); fetchGoals(); }}
        />
      )}

       {/* Goal Detail Sheet */}
      {selectedGoal && (
        <GoalDetailSheet
          goal={selectedGoal}
          onClose={() => { setSelectedGoal(null); fetchGoals(); }}
          onDelete={() => deleteGoal(selectedGoal.id)}
          onProgressChange={(p) => updateProgress(selectedGoal.id, p)}
          onToggleMilestone={toggleMilestone}
        />
      )}
        </div>
      </PullToRefresh>
    </div>
  );
}

// ─── Goal Detail Sheet ────────────────────────────────────────────────────────

function GoalDetailSheet({ goal, onClose, onDelete, onProgressChange, onToggleMilestone }: {
  goal: Goal;
  onClose: () => void;
  onDelete: () => void;
  onProgressChange: (p: number) => void;
  onToggleMilestone: (m: Milestone) => void;
}) {
  const [localProgress, setLocalProgress] = useState(goal.progress);
  const [saving, setSaving] = useState(false);

  const handleProgressSave = async () => {
    setSaving(true);
    await onProgressChange(localProgress);
    setSaving(false);
  };

  const sortedMilestones = [...(goal.goal_milestones || [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      <div className="w-full bg-background rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mt-3" />

        <div className="px-4 pt-4 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: goal.color + '20' }}
              >
                {goal.icon}
              </div>
              <div>
                <h2 className="font-semibold text-base">{goal.title}</h2>
                <p className="text-xs text-muted-foreground capitalize">{goal.category}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Description */}
          {goal.description && (
            <p className="text-sm text-muted-foreground mb-4">{goal.description}</p>
          )}

          {/* Progress */}
          <div className="bg-muted rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm font-bold" style={{ color: goal.color }}>{localProgress}%</span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${localProgress}%`, backgroundColor: goal.color }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={localProgress}
              onChange={e => setLocalProgress(Number(e.target.value))}
              className="w-full"
            />
            {localProgress !== goal.progress && (
              <button
                onClick={handleProgressSave}
                disabled={saving}
                className="mt-3 w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-medium"
              >
                {saving ? 'Saving…' : 'Save Progress'}
              </button>
            )}
          </div>

          {/* Milestones */}
          {sortedMilestones.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Milestones</h3>
              <div className="space-y-2">
                {sortedMilestones.map(milestone => (
                  <button
                    key={milestone.id}
                    onClick={() => onToggleMilestone(milestone)}
                    className="w-full flex items-center gap-3 bg-muted rounded-xl px-3 py-2.5 text-left"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      milestone.is_completed ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`}>
                      {milestone.is_completed && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <span className={`text-sm ${milestone.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                      {milestone.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Target date */}
          {goal.target_date && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              Target: {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Goal Add Modal ───────────────────────────────────────────────────────────

function GoalModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('personal');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#3b82f6');
  const [targetDate, setTargetDate] = useState('');
  const [milestoneInputs, setMilestoneInputs] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const addMilestoneField = () => setMilestoneInputs([...milestoneInputs, '']);
  const updateMilestone = (i: number, val: string) => {
    const updated = [...milestoneInputs];
    updated[i] = val;
    setMilestoneInputs(updated);
  };
  const removeMilestone = (i: number) => setMilestoneInputs(milestoneInputs.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const milestones = milestoneInputs.filter(m => m.trim()).map(m => ({ title: m.trim() }));
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
          milestones,
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
            <h2 className="text-lg font-semibold">New Goal</h2>
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
                placeholder="What do you want to achieve?"
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
                placeholder="Why does this matter?"
                rows={2}
                className="w-full mt-1.5 bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Icon */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Icon</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {GOAL_ICONS.map(i => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-colors ${
                      icon === i ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Color</label>
              <div className="flex gap-2 mt-1.5">
                {GOAL_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-offset-background scale-110' : ''
                    }`}
                    style={{ backgroundColor: c, ringColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${
                      category === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Date */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full mt-1.5 bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Milestones */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Milestones</label>
              <div className="space-y-2 mt-1.5">
                {milestoneInputs.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={m}
                      onChange={e => updateMilestone(i, e.target.value)}
                      placeholder={`Milestone ${i + 1}`}
                      className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    {milestoneInputs.length > 1 && (
                      <button
                        onClick={() => removeMilestone(i)}
                        className="p-2 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addMilestoneField}
                  className="text-xs text-primary flex items-center gap-1 pl-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add milestone
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 mt-2"
            >
              {saving ? 'Creating…' : 'Create Goal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}