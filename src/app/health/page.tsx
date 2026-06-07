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

  const formatFloat = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '--';
    return Number(val) % 1 === 0 ? Number(val).toLocaleString() : Number(val).toFixed(2);
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

  const handleRefresh = async () => {
    setRefreshCount((c) => c + 1);
  };

  // Safe client-side date presentation matching your profile structure
  const dateStr = log?.log_date
    ? new Date(log.log_date + 'T00:00:00').toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })
    : '';

  // Core metrics aggregations derived from the historical telemetry arrays
  const last7Days = history.slice(0, 7);
  const chronological7Days = [...last7Days].reverse();
  
  const avgSteps = last7Days.length ? Math.round(last7Days.reduce((sum, l) => sum + (l.steps || 0), 0) / last7Days.length) : 0;
  const avgCalories = last7Days.length ? Math.round(last7Days.reduce((sum, l) => sum + (l.active_calories || 0), 0) / last7Days.length) : 0;
  
  const getSleepTime = (item: HealthLog | null) => {
    if (!item) return 0;
    return item.sleep_total_hours ?? (item.sleep_duration_minutes ? item.sleep_duration_minutes / 60 : 0);
  };

  const todaySleep = getSleepTime(log);
  const avgSleep = last7Days.length 
    ? (last7Days.reduce((sum, l) => sum + getSleepTime(l), 0) / last7Days.length).toFixed(1) 
    : '0.0';
    
  const avgHeartRate = last7Days.length ? Math.round(last7Days.reduce((sum, l) => sum + (l.heart_rate_avg || 0), 0) / last7Days.length) : 0;

  return (
    <div className="min-h-screen bg-black text-white font-sans select-none relative">
      
      {/* LOCKED SYSTEM HEADER AREA */}
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

        {/* Crisp Tab Navigation Layout Component */}
        <div className="flex border-b border-[#111]">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(i);
                if (navigator.vibrate) navigator.vibrate(8);
              }}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#444]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* INDEPENDENT CONTENT SCROLL TRACK VIEW */}
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 py-4 pb-32 space-y-4">
          
          {!log && !loading ? (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center text-[#555] font-mono text-xs">
              No dataset mapped inside health_logs. Run Shortcut to transmit.
            </div>
          ) : (
            <div>
              {/* ACTIVITY TAB VIEW */}
              {activeTab === 0 && log && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Active Energy</p>
                      <p className="text-2xl font-mono font-bold text-[#ef4444] mt-2">
                        {formatFloat(log.active_calories)} <span className="text-xs text-[#555] font-sans font-normal">kcal</span>
                      </p>
                      <div className="w-full bg-[#201111] h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#ef4444] h-full rounded-full" style={{ width: `${Math.min(((Number(log.active_calories) || 0) / 750) * 100, 100)}%` }} />
                      </div>
                    </div>

                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Total Steps</p>
                      <p className="text-2xl font-mono font-bold text-[#60a5fa] mt-2">
                        {log.steps?.toLocaleString() || 0}
                      </p>
                      <div className="w-full bg-sky-950/40 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#60a5fa] h-full rounded-full" style={{ width: `${Math.min(((log.steps || 0) / 10000) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Exercise Minutes</p>
                      <p className="text-2xl font-mono font-bold text-[#22c55e] mt-2">
                        {formatFloat(log.activity_minutes)} <span className="text-xs text-[#555] font-sans font-normal">min</span>
                      </p>
                      <div className="w-full bg-[#122418] h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#22c55e] h-full rounded-full" style={{ width: `${Math.min(((Number(log.activity_minutes) || 0) / 30) * 100, 100)}%` }} />
                      </div>
                    </div>

                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Stand Score</p>
                      <p className="text-2xl font-mono font-bold text-[#fb923c] mt-2">
                        {formatFloat(log.stand_hours)} <span className="text-xs text-[#555] font-sans font-normal">hrs</span>
                      </p>
                      <div className="w-full bg-orange-950/30 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#fb923c] h-full rounded-full" style={{ width: `${Math.min(((Number(log.stand_hours) || 0) / 12) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SLEEP TAB VIEW */}
              {activeTab === 1 && log && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-[#111] border border-[#1a1a1a] p-6 rounded-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Sleep Analysis</p>
                        <p className="text-4xl font-mono font-bold text-indigo-400 mt-2">
                          {todaySleep > 0 ? todaySleep.toFixed(1) : '--'}{' '}
                          <span className="text-xs font-sans text-[#555] font-medium">hours</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Target Baseline</p>
                        <p className="text-xs font-mono text-white mt-1">7.5 hrs</p>
                      </div>
                    </div>
                    <div className="w-full bg-indigo-950/20 h-2 rounded-full mt-6 overflow-hidden">
                      <div 
                        className="bg-indigo-400 h-full rounded-full transition-all" 
                        style={{ width: `${Math.min((todaySleep / 7.5) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Sleep Stage Breakdown Grid */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl space-y-3">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Telemetry Breakdown</p>
                    {[
                      { label: 'Deep Sleep Cycle', val: log.sleep_deep_hours, color: '#6366f1' },
                      { label: 'REM Activity Window', val: log.sleep_rem_hours, color: '#a78bfa' },
                      { label: 'Core / Light Tracking', val: log.sleep_core_hours, color: '#818cf8' },
                      { label: 'Awake Interruptions', val: log.sleep_awake_hours, color: '#f0a050' },
                    ].map((stage) => (
                      <div key={stage.label} className="flex justify-between items-center border-b border-[#1a1a1a]/40 pb-2 last:border-none last:pb-0">
                        <span className="text-xs text-[#ccc]">{stage.label}</span>
                        <span className="text-xs font-mono font-semibold" style={{ color: stage.color }}>
                          {stage.val ? `${Number(stage.val).toFixed(1)} hrs` : '--'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">7-Day Rest Mean</p>
                      <p className="text-sm font-mono text-[#ccc] mt-1">{avgSleep} hrs / night</p>
                    </div>
                    <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full ${
                      Number(avgSleep) >= 7.0 ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20' : 'bg-[#f0a050]/10 text-[#f0a050] border border-[#f0a050]/20'
                    }`}>
                      {Number(avgSleep) >= 7.0 ? 'Optimal' : 'Deficit'}
                    </span>
                  </div>
                </div>
              )}

              {/* VITALS TAB VIEW */}
              {activeTab === 2 && log && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Resting HR</p>
                      <p className="text-3xl font-mono font-bold text-[#ef4444] mt-2">
                        {formatFloat(log.resting_heart_rate)}{' '}
                        <span className="text-xs uppercase tracking-wider text-[#555] font-sans font-semibold">BPM</span>
                      </p>
                    </div>

                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Heart Rate Avg</p>
                      <p className="text-3xl font-mono font-bold text-rose-400 mt-2">
                        {formatFloat(log.heart_rate_avg)}{' '}
                        <span className="text-xs uppercase tracking-wider text-[#555] font-sans font-semibold">BPM</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">HRV Baseline</p>
                      <p className="text-3xl font-mono font-bold text-purple-400 mt-2">
                        {formatFloat(log.hrv)}{' '}
                        <span className="text-xs uppercase tracking-wider text-[#555] font-sans font-semibold">ms</span>
                      </p>
                    </div>

                    <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Blood Oxygen</p>
                      <p className="text-3xl font-mono font-bold text-sky-400 mt-2">
                        {formatFloat(log.spo2)}{' '}
                        <span className="text-xs uppercase tracking-wider text-[#555] font-sans font-semibold">%</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TRENDS TAB VIEW */}
              {activeTab === 3 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* Summary Mean Values */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-xl">
                      <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Steps Baseline (7d)</p>
                      <p className="text-base font-mono font-bold text-[#60a5fa] mt-1">{avgSteps.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-xl">
                      <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Burn Baseline (7d)</p>
                      <p className="text-base font-mono font-bold text-[#ef4444] mt-1">{avgCalories} kcal</p>
                    </div>
                  </div>

                  {/* Step History Bar Chart */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-6">Historical Step Volumes</p>
                    <div className="flex justify-between items-end h-20 px-1">
                      {chronological7Days.map((h, index) => {
                        const percentage = Math.min(((h.steps || 0) / 12500) * 100, 100);
                        const isToday = h.log_date === log?.log_date;
                        return (
                          <div key={h.log_date || index} className="flex flex-col items-center flex-1 group">
                            <div className="w-2.5 bg-[#1a1a1a] h-16 rounded-full flex items-end overflow-hidden">
                              <div 
                                className={`w-full rounded-full transition-all duration-300 ${isToday ? 'bg-[#60a5fa]' : 'bg-[#60a5fa]/30 group-hover:bg-[#60a5fa]'}`}
                                style={{ height: `${percentage}%` }}
                              />
                            </div>
                            <p className="text-[8px] font-mono font-bold text-[#444] mt-1.5">
                              {h.log_date ? new Date(h.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1) : '-'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sleep History Bar Chart */}
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-6">Sleep Duration Horizon</p>
                    <div className="flex justify-between items-end h-20 px-1">
                      {chronological7Days.map((h, index) => {
                        const duration = getSleepTime(h);
                        const percentage = Math.min((duration / 10) * 100, 100);
                        const isToday = h.log_date === log?.log_date;
                        return (
                          <div key={h.log_date || index} className="flex flex-col items-center flex-1 group">
                            <div className="w-2.5 bg-[#1a1a1a] h-16 rounded-full flex items-end overflow-hidden">
                              <div 
                                className={`w-full rounded-full transition-all duration-300 ${isToday ? 'bg-indigo-400' : 'bg-indigo-400/30 group-hover:bg-indigo-400'}`}
                                style={{ height: `${percentage}%` }}
                              />
                            </div>
                            <p className="text-[8px] font-mono font-bold text-[#444] mt-1.5">
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

      {/* FIXED BOTTOM NAVIGATION BAR SAFE EXTRACTED LAYER */}
      <BottomNav active="health" />
    </div>
  );
}