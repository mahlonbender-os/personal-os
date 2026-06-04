'use client';

import { useState, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';
import SwipeTabs from '@/components/SwipeTabs';

interface HealthLog {
  log_date: string;
  steps: number | null;
  active_calories: number | null;
  total_calories: number | null;
  bmr: number | null;
  distance_km: number | null;
  flights_climbed: number | null;
  activity_minutes: number | null;
  stand_hours: number | null;
  sleep_duration_minutes: number | null;
  sleep_total_hours: number | null;
  sleep_core_hours: number | null;
  sleep_deep_hours: number | null;
  sleep_rem_hours: number | null;
  sleep_awake_hours: number | null;
  sleep_in_bed_hours: number | null;
  heart_rate_avg: number | null;
  heart_rate_min: number | null;
  heart_rate_max: number | null;
  resting_heart_rate: number | null;
  hrv: number | null;
  weight_lbs: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  lean_body_mass_lbs: number | null;
  vo2_max: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  blood_glucose: number | null;
  body_temperature: number | null;
  water_ml: number | null;
  calories_dietary: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

type Tab = 'activity' | 'sleep' | 'vitals' | 'trends' | 'habits';

const tabs: { id: Tab; label: string }[] = [
  { id: 'activity', label: 'Activity' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'trends', label: 'Trends' },
  { id: 'habits', label: 'Habits' },
];

const KM_TO_MI = 0.621371;

// has data? treat null / undefined / 0 as "no data" for display purposes
const has = (v: number | null | undefined) => v !== null && v !== undefined && v !== 0;

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

// Small stat card used across tabs
function StatCard({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
      <div className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">{label}</div>
      <div className="text-3xl font-extrabold leading-none" style={{ fontFamily: 'system-ui', color }}>{value}</div>
      {unit && <div className="text-[10px] text-[#444] mt-1">{unit}</div>}
    </div>
  );
}

// Inline 7-day bar chart, no external library
function MiniBars({
  series, color, label, fmt,
}: {
  series: { date: string; value: number | null }[];
  color: string;
  label: string;
  fmt: (n: number) => string;
}) {
  const values = series.map(s => (s.value ?? 0));
  const max = Math.max(...values, 1);
  const latest = series.length ? series[series.length - 1].value : null;
  const dayLabel = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });

  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">{label}</p>
        {has(latest) && <span className="text-[11px] font-mono font-semibold" style={{ color }}>{fmt(latest as number)}</span>}
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {series.map((s, i) => {
          const h = max > 0 ? ((s.value ?? 0) / max) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full rounded-t-md transition-all"
                style={{
                  height: `${h}%`,
                  background: color,
                  opacity: i === series.length - 1 ? 1 : 0.5,
                  minHeight: has(s.value) ? '3px' : '0px',
                }} />
              <span className="text-[8px] text-[#444]">{dayLabel(s.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HealthPage() {
  const [log, setLog] = useState<HealthLog | null>(null);
  const [history, setHistory] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [refreshCount, setRefreshCount] = useState(0);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/latest');
      const data = await res.json();
      setLog(data.log || data.latest || null);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth, refreshCount]);

  // Activity values
  const steps = log?.steps ?? 0;
  const restHr = log?.resting_heart_rate ?? 0;
  const active = log?.activity_minutes ?? 0;
  const cal = log?.active_calories ?? 0;
  const distMi = has(log?.distance_km) ? (log!.distance_km as number) * KM_TO_MI : 0;
  const flights = log?.flights_climbed ?? 0;

  const stepGoal = 10000;
  const activeGoal = 30;
  const calGoal = 600;

  // Vitals values
  const avgHr = log?.heart_rate_avg ?? 0;
  const hrv = log?.hrv ?? 0;
  const spo2 = log?.spo2 ?? 0;
  const resp = log?.respiratory_rate ?? 0;
  const vo2 = log?.vo2_max ?? 0;
  const bmr = log?.bmr ?? 0;
  const weight = log?.weight_lbs ?? 0;

  // Sleep values
  const sleepMins = log?.sleep_duration_minutes ?? 0;
  const sleepTotal = log?.sleep_total_hours ?? (sleepMins ? sleepMins / 60 : 0);
  const hasSleep = has(sleepTotal) || has(sleepMins);

  const dateStr = log?.log_date
    ? new Date(log.log_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  const anyVitals = has(avgHr) || has(restHr) || has(hrv) || has(spo2) || has(resp) || has(vo2) || has(bmr) || has(weight);

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

          {/* ============ Activity Tab ============ */}
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
                    { val: restHr > 0 ? `${restHr}` : '—', label: 'BPM', color: '#f87171', pct: restHr > 0 ? 70 : 0 },
                    { val: active > 0 ? `${active}m` : '—', label: 'Active', color: '#f0a050', pct: (active / activeGoal) * 100 },
                    { val: cal > 0 ? cal.toLocaleString() : '—', label: 'Cal', color: '#fb923c', pct: (cal / calGoal) * 100 },
                  ].map(({ val, label, color, pct }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className="relative"><Ring pct={pct} color={color} size={52} /></div>
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

            {/* HR + Calories */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Heart Rate" value={restHr > 0 ? `${restHr}` : '—'} unit={restHr > 0 ? 'bpm resting' : 'No data'} color="#f87171" />
              <StatCard label="Calories" value={cal > 0 ? cal.toLocaleString() : '—'} unit={cal > 0 ? 'active cal' : 'No data'} color="#fb923c" />
            </div>

            {/* Distance + Flights */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Distance" value={has(distMi) ? distMi.toFixed(2) : '—'} unit={has(distMi) ? 'miles' : 'No data'} color="#34d399" />
              <StatCard label="Flights" value={has(flights) ? `${flights}` : '—'} unit={has(flights) ? 'climbed' : 'No data'} color="#a78bfa" />
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

          {/* ============ Sleep Tab ============ */}
          <div className="px-4 py-4 pb-28 space-y-3">
            {hasSleep ? (
              <>
                <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-5 text-center">
                  <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Last Night</p>
                  <div className="text-5xl font-extrabold text-[#a78bfa]" style={{ fontFamily: 'system-ui' }}>
                    {Math.floor(sleepTotal)}<span className="text-2xl">h</span> {Math.round((sleepTotal % 1) * 60)}<span className="text-2xl">m</span>
                  </div>
                  <div className="text-[10px] text-[#444] mt-2">total sleep</div>
                </div>

                {/* Stage breakdown */}
                {(has(log?.sleep_deep_hours) || has(log?.sleep_rem_hours) || has(log?.sleep_core_hours) || has(log?.sleep_awake_hours)) && (
                  <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
                    <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Stages</p>
                    {[
                      { label: 'Deep', val: log?.sleep_deep_hours, color: '#6366f1' },
                      { label: 'Core', val: log?.sleep_core_hours, color: '#818cf8' },
                      { label: 'REM', val: log?.sleep_rem_hours, color: '#a78bfa' },
                      { label: 'Awake', val: log?.sleep_awake_hours, color: '#f0a050' },
                    ].filter(s => has(s.val)).map(({ label, val, color }) => {
                      const pct = sleepTotal > 0 ? ((val as number) / sleepTotal) * 100 : 0;
                      return (
                        <div key={label} className="mb-3 last:mb-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-[#666]">{label}</span>
                            <span className="text-xs font-mono" style={{ color }}>{(val as number).toFixed(1)}h</span>
                          </div>
                          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <PlaceholderTab icon="😴" title="No sleep data yet" desc="Add a Sleep Analysis block to your iOS Shortcut and sleep stages will appear here automatically" />
            )}
          </div>

          {/* ============ Vitals Tab ============ */}
          <div className="px-4 py-4 pb-28 space-y-3">
            {anyVitals ? (
              <div className="grid grid-cols-2 gap-3">
                {has(restHr) && <StatCard label="Resting HR" value={`${restHr}`} unit="bpm" color="#f87171" />}
                {has(avgHr) && <StatCard label="Avg Heart Rate" value={`${Math.round(avgHr)}`} unit="bpm" color="#fb7185" />}
                {has(hrv) && <StatCard label="HRV" value={`${Math.round(hrv)}`} unit="ms" color="#a78bfa" />}
                {has(spo2) && <StatCard label="Blood Oxygen" value={`${Math.round(spo2)}`} unit="%" color="#60a5fa" />}
                {has(resp) && <StatCard label="Respiratory" value={resp.toFixed(1)} unit="br/min" color="#22d3ee" />}
                {has(vo2) && <StatCard label="VO₂ Max" value={vo2.toFixed(1)} unit="ml/kg·min" color="#34d399" />}
                {has(bmr) && <StatCard label="Resting Energy" value={Math.round(bmr).toLocaleString()} unit="cal/day" color="#fbbf24" />}
                {has(weight) && <StatCard label="Weight" value={weight.toFixed(1)} unit="lbs" color="#f0a050" />}
              </div>
            ) : (
              <PlaceholderTab icon="❤️" title="No vitals yet" desc="Sync Apple Health to see heart rate, HRV, SpO₂, respiratory rate and more" />
            )}
          </div>

          {/* ============ Trends Tab ============ */}
          <div className="px-4 py-4 pb-28 space-y-3">
            {history.length > 0 ? (
              <>
                <MiniBars label="Steps · 7 days" color="#60a5fa"
                  series={history.map(h => ({ date: h.log_date, value: h.steps }))}
                  fmt={(n) => n.toLocaleString()} />
                <MiniBars label="Active Calories · 7 days" color="#fb923c"
                  series={history.map(h => ({ date: h.log_date, value: h.active_calories }))}
                  fmt={(n) => `${n.toLocaleString()} cal`} />
                <MiniBars label="Resting Heart Rate · 7 days" color="#f87171"
                  series={history.map(h => ({ date: h.log_date, value: h.resting_heart_rate }))}
                  fmt={(n) => `${n} bpm`} />
                {history.some(h => has(h.distance_km)) && (
                  <MiniBars label="Distance · 7 days" color="#34d399"
                    series={history.map(h => ({ date: h.log_date, value: has(h.distance_km) ? (h.distance_km as number) * KM_TO_MI : 0 }))}
                    fmt={(n) => `${n.toFixed(2)} mi`} />
                )}
              </>
            ) : (
              <PlaceholderTab icon="📈" title="Building your trends" desc="Charts appear once you have a few days of synced data" />
            )}
          </div>

          {/* ============ Habits Tab ============ */}
          <div className="px-4 py-4 pb-28">
            <PlaceholderTab icon="🔁" title="Habits coming soon" desc="Daily habit tracking integrated with your Goals module" />
          </div>

        </SwipeTabs>
      </PullToRefresh>

      <BottomNav active="health" />
    </div>
  );
}