'use client';

import { useState, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';
import SwipeTabs from '@/components/SwipeTabs';

interface HealthLog {
  steps: number;
  resting_heart_rate: number;
  activity_minutes: number;
  active_calories: number;
  log_date: string;
}

type Tab = 'activity' | 'sleep' | 'vitals' | 'trends' | 'habits';

const tabs: { id: Tab; label: string }[] = [
  { id: 'activity', label: 'Activity' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'trends', label: 'Trends' },
  { id: 'habits', label: 'Habits' },
];

function Ring({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a1a" strokeWidth="4"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
    </svg>
  );
}

function PlaceholderTab({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div className="text-4xl mb-4">{icon}</div>
      <div className="text-sm font-medium text-[#555] mb-1">{title}</div>
      <div className="text-xs text-[#333]">{desc}</div>
    </div>
  );
}

export default function HealthPage() {
  const [log, setLog] = useState<HealthLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [refreshCount, setRefreshCount] = useState(0);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/latest');
      const data = await res.json();
      setLog(data.log || null);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth, refreshCount]);

  const steps = log?.steps ?? 0;
  const hr = log?.resting_heart_rate ?? 0;
  const active = log?.activity_minutes ?? 0;
  const cal = log?.active_calories ?? 0;
  const stepGoal = 10000;
  const activeGoal = 30;
  const calGoal = 600;
  const dateStr = log?.log_date
    ? new Date(log.log_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-4 pt-14 pb-3">
          <div>
            <h1 className="text-xl font-bold text-white">Health</h1>
            {dateStr && <p className="text-[10px] text-[#555] mt-0.5">{dateStr}</p>}
          </div>
          {loading && (
            <div className="w-4 h-4 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <div className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-[#111]">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-[#f0a050] text-[#f0a050]'
                  : 'border-transparent text-[#444]'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <PullToRefresh onRefresh={async () => { setRefreshCount(c => c + 1); }}>
        <SwipeTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as Tab)}>

          {/* Activity Tab */}
          <div className="px-4 py-4 pb-28 space-y-3">
            {/* Rings row */}
            <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
              <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-4">Today's Activity</p>
              {loading ? (
                <div className="h-20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { val: steps > 0 ? steps.toLocaleString() : '—', label: 'Steps', color: '#60a5fa', pct: (steps / stepGoal) * 100 },
                    { val: hr > 0 ? `${hr}` : '—', label: 'BPM', color: '#f87171', pct: hr > 0 ? 70 : 0 },
                    { val: active > 0 ? `${active}m` : '—', label: 'Active', color: '#f0a050', pct: (active / activeGoal) * 100 },
                    { val: cal > 0 ? cal.toLocaleString() : '—', label: 'Cal', color: '#fb923c', pct: (cal / calGoal) * 100 },
                  ].map(({ val, label, color, pct }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <Ring pct={pct} color={color} size={52} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[8px] font-bold" style={{ color }}>{val === '—' ? '—' : ''}</span>
                        </div>
                      </div>
                      <div className="text-sm font-extrabold leading-none" style={{ color }}>{val}</div>
                      <div className="text-[9px] text-[#444]">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Steps detail */}
            {steps > 0 && (
              <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Steps</p>
                  <span className="text-[10px] text-[#555] font-mono">{steps.toLocaleString()} / {stepGoal.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-[#60a5fa] transition-all"
                    style={{ width: `${Math.min((steps / stepGoal) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-[#333]">0</span>
                  <span className="text-[9px] text-[#60a5fa] font-medium">
                    {steps >= stepGoal ? '🎉 Goal reached!' : `${(stepGoal - steps).toLocaleString()} to go`}
                  </span>
                  <span className="text-[9px] text-[#333]">10k</span>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
                <div className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">Heart Rate</div>
                <div className="text-3xl font-extrabold text-[#f87171]" style={{ fontFamily: 'system-ui' }}>
                  {hr > 0 ? hr : '—'}
                </div>
                <div className="text-[10px] text-[#444] mt-1">{hr > 0 ? 'bpm resting' : 'No data'}</div>
              </div>
              <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
                <div className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">Calories</div>
                <div className="text-3xl font-extrabold text-[#fb923c]" style={{ fontFamily: 'system-ui' }}>
                  {cal > 0 ? cal.toLocaleString() : '—'}
                </div>
                <div className="text-[10px] text-[#444] mt-1">{cal > 0 ? 'active cal' : 'No data'}</div>
              </div>
            </div>

            {/* Active minutes */}
            {active > 0 && (
              <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Active Minutes</p>
                  <span className="text-[10px] text-[#555] font-mono">{active} / {activeGoal} min</span>
                </div>
                <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#f0a050] transition-all"
                    style={{ width: `${Math.min((active / activeGoal) * 100, 100)}%` }} />
                </div>
              </div>
            )}

            {!log && !loading && (
              <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-6 text-center">
                <div className="text-3xl mb-2">⌚</div>
                <div className="text-sm text-[#555]">No health data yet</div>
                <div className="text-xs text-[#333] mt-1">Run the iOS Shortcut on your iPhone to sync Apple Health data</div>
              </div>
            )}
          </div>

          {/* Sleep Tab */}
          <div className="px-4 py-4 pb-28">
            <PlaceholderTab icon="😴" title="Sleep tracking coming soon" desc="Will show sleep stages, duration, and quality trends from Apple Health" />
          </div>

          {/* Vitals Tab */}
          <div className="px-4 py-4 pb-28 space-y-3">
            {hr > 0 ? (
              <>
                <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
                  <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Vitals</p>
                  {[
                    { label: 'Resting HR', val: `${hr} bpm`, color: '#f87171' },
                    { label: 'Active Calories', val: `${cal.toLocaleString()} cal`, color: '#fb923c' },
                    { label: 'Active Minutes', val: `${active} min`, color: '#f0a050' },
                  ].map(({ label, val, color }, i, arr) => (
                    <div key={label} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                      <span className="text-sm text-[#666]">{label}</span>
                      <span className="text-sm font-semibold font-mono" style={{ color }}>{val}</span>
                    </div>
                  ))}
                </div>
                <PlaceholderTab icon="📊" title="HRV & SpO₂ coming soon" desc="Will show additional vitals as Apple Health data expands" />
              </>
            ) : (
              <PlaceholderTab icon="❤️" title="Vitals coming soon" desc="Sync Apple Health to see heart rate, HRV, SpO₂, and more" />
            )}
          </div>

          {/* Trends Tab */}
          <div className="px-4 py-4 pb-28">
            <PlaceholderTab icon="📈" title="Trends coming soon" desc="Weekly and monthly charts for steps, heart rate, and calories" />
          </div>

          {/* Habits Tab */}
          <div className="px-4 py-4 pb-28">
            <PlaceholderTab icon="🔁" title="Habits coming soon" desc="Daily habit tracking integrated with your Goals module" />
          </div>

        </SwipeTabs>
      </PullToRefresh>

      <BottomNav active="health" />
    </div>
  );
}