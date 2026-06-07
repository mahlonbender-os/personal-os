'use client';

import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

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
  heart_rate_avg: number | null;
  heart_rate_min: number | null;
  heart_rate_max: number | null;
  resting_heart_rate: number | null;
  hrv: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  vo2_max: number | null;
  weight_lbs: number | null;
}

const TABS = ['Activity', 'Sleep', 'Vitals', 'Trends'];

export default function HealthPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [log, setLog] = useState<HealthLog | null>(null);
  const [history, setHistory] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  const fmt = (val: number | null | undefined, decimals = 1): string => {
    if (val === null || val === undefined) return '--';
    const n = Number(val);
    return isNaN(n) ? '--' : (decimals === 0 ? Math.round(n).toLocaleString() : n.toFixed(decimals));
  };

  const fetchHealthData = useCallback(async () => {
    try {
      const res = await fetch('/api/health/latest');
      if (res.ok) {
        const data = await res.json();
        const latestLog = data.log || data.latest || null;
        const historicalData = Array.isArray(data.history) ? data.history : [];
        setLog(latestLog);
        setHistory(historicalData);
        localStorage.setItem('health-module-latest', JSON.stringify(latestLog));
        localStorage.setItem('health-module-history', JSON.stringify(historicalData));
      }
    } catch (err) {
      console.error('Error reading health telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedLatest = localStorage.getItem('health-module-latest');
    const cachedHistory = localStorage.getItem('health-module-history');
    if (cachedLatest && cachedHistory) {
      setLog(JSON.parse(cachedLatest));
      setHistory(JSON.parse(cachedHistory));
      setLoading(false);
    }
    fetchHealthData();
  }, [fetchHealthData, refreshCount]);

  const handleRefresh = async () => setRefreshCount((c) => c + 1);

  const dateStr = log?.log_date
    ? new Date(log.log_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : '';

  const last7Days = history.slice(0, 7);
  const chronological7Days = [...last7Days].reverse();

  const avgSteps = last7Days.length
    ? Math.round(last7Days.reduce((s, l) => s + (l.steps || 0), 0) / last7Days.length) : 0;
  const avgCalories = last7Days.length
    ? Math.round(last7Days.reduce((s, l) => s + (l.active_calories || 0), 0) / last7Days.length) : 0;
  const avgHRV = last7Days.length
    ? (last7Days.reduce((s, l) => s + (Number(l.hrv) || 0), 0) / last7Days.filter(l => l.hrv).length) : 0;
  const avgRHR = last7Days.length
    ? Math.round(last7Days.reduce((s, l) => s + (l.resting_heart_rate || 0), 0) / last7Days.filter(l => l.resting_heart_rate).length) : 0;

  const getSleepTime = (item: HealthLog | null) => {
    if (!item) return 0;
    return Number(item.sleep_total_hours) || (item.sleep_duration_minutes ? item.sleep_duration_minutes / 60 : 0);
  };

  const todaySleep = getSleepTime(log);
  const avgSleep = last7Days.length
    ? (last7Days.reduce((s, l) => s + getSleepTime(l), 0) / last7Days.length).toFixed(1) : '0.0';

  // Sleep stage proportions for stacked bar
  const sleepStages = log ? [
    { label: 'Deep', val: Number(log.sleep_deep_hours) || 0, color: '#6366f1' },
    { label: 'REM',  val: Number(log.sleep_rem_hours)  || 0, color: '#a78bfa' },
    { label: 'Core', val: Number(log.sleep_core_hours) || 0, color: '#818cf8' },
    { label: 'Awake',val: Number(log.sleep_awake_hours)|| 0, color: '#f0a050' },
  ] : [];
  const sleepTotal = sleepStages.reduce((s, st) => s + st.val, 0);

  // Simple sleep score: 0–100 based on total hours and deep sleep %
  const sleepScore = sleepTotal > 0
    ? Math.min(100, Math.round(
        (Math.min(sleepTotal / 8, 1) * 60) +
        (Math.min((Number(log?.sleep_deep_hours) || 0) / sleepTotal / 0.20, 1) * 25) +
        (Math.min((Number(log?.sleep_rem_hours)  || 0) / sleepTotal / 0.25, 1) * 15)
      ))
    : null;

  const scoreColor = sleepScore === null ? '#555'
    : sleepScore >= 80 ? '#22c55e'
    : sleepScore >= 60 ? '#f0a050'
    : '#ef4444';

  return (
    <div className="min-h-screen bg-black text-white font-sans select-none relative">

      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a] pt-14 px-4 pb-0">
        <div className="flex justify-between items-baseline mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-display">Biometrics</h1>
            <p className="text-[10px] text-[#555] font-semibold uppercase tracking-wider mt-0.5">
              {dateStr || 'Apple Watch Diagnostic Link'}
            </p>
          </div>
          <div className="text-right">
            {loading ? (
              <div className="w-4 h-4 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-[9px] font-mono font-medium text-[#22c55e] bg-[#22c55e]/10 px-2.5 py-1 rounded-full border border-[#22c55e]/20">
                Live Data Link
              </span>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-[#111]">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(i); if (navigator.vibrate) navigator.vibrate(8); }}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#444]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 py-4 pb-32 space-y-4">

          {!log && !loading ? (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center text-[#555] font-mono text-xs">
              No dataset mapped inside health_logs. Run export to transmit.
            </div>
          ) : (

            <div>

              {/* ── ACTIVITY TAB ── */}
              {activeTab === 0 && log && (
                <div className="space-y-4 animate-in fade-in duration-200">

                  {/* Row 1: Steps + Active Calories */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Steps</p>
                      <p className="text-2xl font-mono font-bold text-[#60a5fa] mt-2">
                        {fmt(log.steps, 0)}
                      </p>
                      <div className="w-full bg-sky-950/40 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#60a5fa] h-full rounded-full" style={{ width: `${Math.min(((log.steps || 0) / 10000) * 100, 100)}%` }} />
                      </div>
                      <p className="text-[9px] text-[#555] mt-1">Goal: 10,000</p>
                    </div>

                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Active Cal</p>
                      <p className="text-2xl font-mono font-bold text-[#ef4444] mt-2">
                        {fmt(log.active_calories, 0)} <span className="text-xs text-[#555] font-sans font-normal">kcal</span>
                      </p>
                      <div className="w-full bg-[#201111] h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#ef4444] h-full rounded-full" style={{ width: `${Math.min(((Number(log.active_calories) || 0) / 750) * 100, 100)}%` }} />
                      </div>
                      <p className="text-[9px] text-[#555] mt-1">Goal: 750 kcal</p>
                    </div>
                  </div>

                  {/* Row 2: Exercise + Stand */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Exercise</p>
                      <p className="text-2xl font-mono font-bold text-[#22c55e] mt-2">
                        {fmt(log.activity_minutes, 0)} <span className="text-xs text-[#555] font-sans font-normal">min</span>
                      </p>
                      <div className="w-full bg-[#122418] h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#22c55e] h-full rounded-full" style={{ width: `${Math.min(((Number(log.activity_minutes) || 0) / 30) * 100, 100)}%` }} />
                      </div>
                      <p className="text-[9px] text-[#555] mt-1">Goal: 30 min</p>
                    </div>

                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Stand Hours</p>
                      <p className="text-2xl font-mono font-bold text-[#fb923c] mt-2">
                        {fmt(log.stand_hours, 0)} <span className="text-xs text-[#555] font-sans font-normal">hrs</span>
                      </p>
                      <div className="w-full bg-orange-950/30 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#fb923c] h-full rounded-full" style={{ width: `${Math.min(((Number(log.stand_hours) || 0) / 12) * 100, 100)}%` }} />
                      </div>
                      <p className="text-[9px] text-[#555] mt-1">Goal: 12 hrs</p>
                    </div>
                  </div>

                  {/* Row 3: Distance + Flights */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Distance</p>
                      <p className="text-2xl font-mono font-bold text-[#34d399] mt-2">
                        {log.distance_km ? (Number(log.distance_km) * 0.621371).toFixed(2) : '--'}
                        <span className="text-xs text-[#555] font-sans font-normal"> mi</span>
                      </p>
                    </div>

                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Flights</p>
                      <p className="text-2xl font-mono font-bold text-[#f472b6] mt-2">
                        {fmt(log.flights_climbed, 0)}
                        <span className="text-xs text-[#555] font-sans font-normal"> floors</span>
                      </p>
                    </div>
                  </div>

                  {/* Total Calories row */}
                  {log.total_calories && (
                    <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Total Burn</p>
                        <p className="text-sm text-[#ccc] mt-0.5">Active + BMR</p>
                      </div>
                      <p className="text-xl font-mono font-bold text-white">
                        {fmt(log.total_calories, 0)} <span className="text-xs text-[#555]">kcal</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── SLEEP TAB ── */}
              {activeTab === 1 && log && (
                <div className="space-y-4 animate-in fade-in duration-200">

                  {/* Total + Score */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-6 rounded-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Total Sleep</p>
                        <p className="text-4xl font-mono font-bold text-indigo-400 mt-2">
                          {todaySleep > 0 ? todaySleep.toFixed(1) : '--'}
                          <span className="text-xs font-sans text-[#555] font-medium"> hrs</span>
                        </p>
                      </div>
                      {sleepScore !== null && (
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Sleep Score</p>
                          <p className="text-3xl font-mono font-bold mt-1" style={{ color: scoreColor }}>
                            {sleepScore}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-indigo-950/20 h-2 rounded-full mt-5 overflow-hidden">
                      <div
                        className="bg-indigo-400 h-full rounded-full transition-all"
                        style={{ width: `${Math.min((todaySleep / 8) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-[9px] text-[#555]">0h</p>
                      <p className="text-[9px] text-[#555]">Goal: 8h</p>
                    </div>
                  </div>

                  {/* Stacked stage proportion bar */}
                  {sleepTotal > 0 && (
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-3">Stage Breakdown</p>
                      <div className="flex h-4 rounded-full overflow-hidden w-full">
                        {sleepStages.filter(s => s.val > 0).map((stage) => (
                          <div
                            key={stage.label}
                            style={{
                              width: `${(stage.val / sleepTotal) * 100}%`,
                              backgroundColor: stage.color,
                            }}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {sleepStages.map((stage) => (
                          <div key={stage.label} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                            <span className="text-[10px] text-[#888]">{stage.label}</span>
                            <span className="text-[10px] font-mono ml-auto" style={{ color: stage.color }}>
                              {stage.val > 0 ? `${stage.val.toFixed(1)}h` : '--'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 7-day average */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">7-Day Average</p>
                      <p className="text-sm font-mono text-[#ccc] mt-1">{avgSleep} hrs / night</p>
                    </div>
                    <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full ${
                      Number(avgSleep) >= 7.0
                        ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20'
                        : 'bg-[#f0a050]/10 text-[#f0a050] border border-[#f0a050]/20'
                    }`}>
                      {Number(avgSleep) >= 7.0 ? 'Optimal' : 'Deficit'}
                    </span>
                  </div>
                </div>
              )}

              {/* ── VITALS TAB ── */}
              {activeTab === 2 && log && (
                <div className="space-y-4 animate-in fade-in duration-200">

                  {/* Heart Rate — full card with min/avg/max */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-4">Heart Rate</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[9px] text-[#555] uppercase tracking-wider">Min</p>
                        <p className="text-xl font-mono font-bold text-[#60a5fa] mt-1">{fmt(log.heart_rate_min, 0)}</p>
                        <p className="text-[9px] text-[#555]">bpm</p>
                      </div>
                      <div className="border-x border-[#1a1a1a]">
                        <p className="text-[9px] text-[#555] uppercase tracking-wider">Avg</p>
                        <p className="text-xl font-mono font-bold text-[#ef4444] mt-1">{fmt(log.heart_rate_avg, 0)}</p>
                        <p className="text-[9px] text-[#555]">bpm</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#555] uppercase tracking-wider">Max</p>
                        <p className="text-xl font-mono font-bold text-rose-400 mt-1">{fmt(log.heart_rate_max, 0)}</p>
                        <p className="text-[9px] text-[#555]">bpm</p>
                      </div>
                    </div>
                  </div>

                  {/* Resting HR + HRV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Resting HR</p>
                      <p className="text-3xl font-mono font-bold text-[#ef4444] mt-2">
                        {fmt(log.resting_heart_rate, 0)}
                        <span className="text-xs uppercase tracking-wider text-[#555] font-sans font-semibold"> bpm</span>
                      </p>
                    </div>
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">HRV</p>
                      <p className="text-3xl font-mono font-bold text-purple-400 mt-2">
                        {fmt(log.hrv, 0)}
                        <span className="text-xs uppercase tracking-wider text-[#555] font-sans font-semibold"> ms</span>
                      </p>
                    </div>
                  </div>

                  {/* SpO2 + Respiratory Rate */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Blood O₂</p>
                      <p className="text-3xl font-mono font-bold text-sky-400 mt-2">
                        {fmt(log.spo2, 1)}
                        <span className="text-xs uppercase tracking-wider text-[#555] font-sans font-semibold"> %</span>
                      </p>
                    </div>
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Resp. Rate</p>
                      <p className="text-3xl font-mono font-bold text-teal-400 mt-2">
                        {fmt(log.respiratory_rate, 1)}
                        <span className="text-xs uppercase tracking-wider text-[#555] font-sans font-semibold"> /min</span>
                      </p>
                    </div>
                  </div>

                  {/* VO2 Max */}
                  {log.vo2_max && (
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">VO₂ Max</p>
                        <p className="text-[10px] text-[#555] mt-0.5">Cardio fitness</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-mono font-bold text-emerald-400">
                          {fmt(log.vo2_max, 1)}
                          <span className="text-xs text-[#555] font-sans font-normal"> ml/kg/min</span>
                        </p>
                        <p className="text-[9px] text-[#555] mt-0.5">
                          {Number(log.vo2_max) >= 42 ? 'Above Average' : Number(log.vo2_max) >= 35 ? 'Average' : 'Below Average'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TRENDS TAB ── */}
              {activeTab === 3 && (
                <div className="space-y-6 animate-in fade-in duration-200">

                  {/* Summary row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-xl">
                      <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Avg Steps (7d)</p>
                      <p className="text-base font-mono font-bold text-[#60a5fa] mt-1">{avgSteps.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-xl">
                      <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Avg Burn (7d)</p>
                      <p className="text-base font-mono font-bold text-[#ef4444] mt-1">{avgCalories} kcal</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-xl">
                      <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Avg HRV (7d)</p>
                      <p className="text-base font-mono font-bold text-purple-400 mt-1">
                        {isNaN(avgHRV) || avgHRV === 0 ? '--' : `${Math.round(avgHRV)} ms`}
                      </p>
                    </div>
                    <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-xl">
                      <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Avg RHR (7d)</p>
                      <p className="text-base font-mono font-bold text-[#ef4444] mt-1">
                        {isNaN(avgRHR) || avgRHR === 0 ? '--' : `${avgRHR} bpm`}
                      </p>
                    </div>
                  </div>

                  {/* Steps bar chart */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-6">Steps</p>
                    <div className="flex justify-between items-end h-20 px-1">
                      {chronological7Days.map((h, index) => {
                        const pct = Math.min(((h.steps || 0) / 12500) * 100, 100);
                        const isLatest = h.log_date === log?.log_date;
                        return (
                          <div key={h.log_date || index} className="flex flex-col items-center flex-1">
                            <div className="w-2.5 bg-[#1a1a1a] h-16 rounded-full flex items-end overflow-hidden">
                              <div className={`w-full rounded-full ${isLatest ? 'bg-[#60a5fa]' : 'bg-[#60a5fa]/30'}`} style={{ height: `${pct}%` }} />
                            </div>
                            <p className="text-[8px] font-mono text-[#444] mt-1.5">
                              {h.log_date ? new Date(h.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1) : '-'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sleep bar chart */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-6">Sleep Duration</p>
                    <div className="flex justify-between items-end h-20 px-1">
                      {chronological7Days.map((h, index) => {
                        const duration = getSleepTime(h);
                        const pct = Math.min((duration / 10) * 100, 100);
                        const isLatest = h.log_date === log?.log_date;
                        return (
                          <div key={h.log_date || index} className="flex flex-col items-center flex-1">
                            <div className="w-2.5 bg-[#1a1a1a] h-16 rounded-full flex items-end overflow-hidden">
                              <div className={`w-full rounded-full ${isLatest ? 'bg-indigo-400' : 'bg-indigo-400/30'}`} style={{ height: `${pct}%` }} />
                            </div>
                            <p className="text-[8px] font-mono text-[#444] mt-1.5">
                              {h.log_date ? new Date(h.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1) : '-'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* HRV bar chart */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-6">HRV</p>
                    <div className="flex justify-between items-end h-20 px-1">
                      {chronological7Days.map((h, index) => {
                        const val = Number(h.hrv) || 0;
                        const pct = Math.min((val / 100) * 100, 100);
                        const isLatest = h.log_date === log?.log_date;
                        return (
                          <div key={h.log_date || index} className="flex flex-col items-center flex-1">
                            <div className="w-2.5 bg-[#1a1a1a] h-16 rounded-full flex items-end overflow-hidden">
                              <div className={`w-full rounded-full ${isLatest ? 'bg-purple-400' : 'bg-purple-400/30'}`} style={{ height: `${pct}%` }} />
                            </div>
                            <p className="text-[8px] font-mono text-[#444] mt-1.5">
                              {h.log_date ? new Date(h.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1) : '-'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resting HR bar chart */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-6">Resting Heart Rate</p>
                    <div className="flex justify-between items-end h-20 px-1">
                      {chronological7Days.map((h, index) => {
                        const val = Number(h.resting_heart_rate) || 0;
                        const pct = Math.min((val / 100) * 100, 100);
                        const isLatest = h.log_date === log?.log_date;
                        return (
                          <div key={h.log_date || index} className="flex flex-col items-center flex-1">
                            <div className="w-2.5 bg-[#1a1a1a] h-16 rounded-full flex items-end overflow-hidden">
                              <div className={`w-full rounded-full ${isLatest ? 'bg-[#ef4444]' : 'bg-[#ef4444]/30'}`} style={{ height: `${pct}%` }} />
                            </div>
                            <p className="text-[8px] font-mono text-[#444] mt-1.5">
                              {h.log_date ? new Date(h.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1) : '-'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}
        </div>
      </PullToRefresh>

      <BottomNav active="health" />
    </div>
  );
}