'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

interface HealthLog {
  id: string;
  user_id: string;
  date: string;
  steps: number | null;
  active_calories: number | null;
  exercise_minutes: number | null;
  stand_hours: number | null;
  sleep_hours: number | null;
  heart_rate_avg: number | null;
  created_at: string;
}

const TABS = ['Activity', 'Sleep', 'Vitals', 'Trends'];

export default function HealthPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealthData = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
        localStorage.setItem('health-module-data', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Error reading health telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('health-module-data');
    if (cached) {
      setLogs(JSON.parse(cached));
      setLoading(false);
    }
    fetchHealthData();
  }, []);

  const handleRefresh = async () => {
    await fetchHealthData();
  };

  // Safe client-side date evaluation matching New York timezone constraints
  const getTodayStr = () => {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
  };

  const todayStr = getTodayStr();
  const latestLog = logs.find((l) => l.date === todayStr) || logs[0] || null;

  // Compute 7-day rolling performance trends
  const last7Days = logs.slice(0, 7);
  const chronological7Days = [...last7Days].reverse(); // Left-to-right display matching time arrow
  
  const avgSteps = last7Days.length ? Math.round(last7Days.reduce((sum, l) => sum + (l.steps || 0), 0) / last7Days.length) : 0;
  const avgCalories = last7Days.length ? Math.round(last7Days.reduce((sum, l) => sum + (l.active_calories || 0), 0) / last7Days.length) : 0;
  const avgSleep = last7Days.length ? (last7Days.reduce((sum, l) => sum + (Number(l.sleep_hours) || 0), 0) / last7Days.length).toFixed(1) : '0.0';
  const avgHeartRate = last7Days.length ? Math.round(last7Days.reduce((sum, l) => sum + (l.heart_rate_avg || 0), 0) / last7Days.length) : 0;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-black text-white px-4 pt-14 pb-24 font-sans select-none">
        
        {/* Header Block */}
        <div className="flex justify-between items-baseline mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-display">Biometrics</h1>
            <p className="text-[10px] text-[#555] font-semibold uppercase tracking-wider mt-0.5">Apple Watch Sync</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono font-medium text-[#f0a050] bg-[#f0a050]/10 px-2.5 py-1 rounded-full border border-[#f0a050]/20">
              Automated Pipeline
            </span>
          </div>
        </div>

        {/* Clean Inline Tab Bar Framework */}
        <div className="flex border-b border-[#1a1a1a] mb-6 sticky top-0 bg-black z-10">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(i);
                if (navigator.vibrate) navigator.vibrate(8);
              }}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === i ? 'text-[#f0a050] border-b-2 border-[#f0a050]' : 'text-[#555]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading && logs.length === 0 ? (
          <div className="flex justify-center items-center py-20 text-[#555] text-xs font-mono">
            Ingesting diagnostic arrays...
          </div>
        ) : !latestLog ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center text-[#555] font-mono text-xs">
            No dataset logged for today ({todayStr}). Close rings to ingest.
          </div>
        ) : (
          <div>
            {/* ACTIVITY TAB VIEW */}
            {activeTab === 0 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Active Energy</p>
                    <p className="text-2xl font-mono font-bold text-[#ef4444] mt-2">
                      {latestLog.active_calories || 0} <span className="text-xs text-[#555] font-sans font-normal">kcal</span>
                    </p>
                    <div className="w-full bg-[#201111] h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-[#ef4444] h-full rounded-full" style={{ width: `${Math.min(((latestLog.active_calories || 0) / 850) * 100, 100)}%` }} />
                    </div>
                  </div>

                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Total Steps</p>
                    <p className="text-2xl font-mono font-bold text-[#f0a050] mt-2">
                      {latestLog.steps?.toLocaleString() || 0}
                    </p>
                    <div className="w-full bg-[#2a1e15] h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-[#f0a050] h-full rounded-full" style={{ width: `${Math.min(((latestLog.steps || 0) / 10000) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Exercise Ring</p>
                    <p className="text-2xl font-mono font-bold text-[#22c55e] mt-2">
                      {latestLog.exercise_minutes || 0} <span className="text-xs text-[#555] font-sans font-normal">min</span>
                    </p>
                    <div className="w-full bg-[#122418] h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-[#22c55e] h-full rounded-full" style={{ width: `${Math.min(((latestLog.exercise_minutes || 0) / 30) * 100, 100)}%` }} />
                    </div>
                  </div>

                  <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Stand Score</p>
                    <p className="text-2xl font-mono font-bold text-sky-400 mt-2">
                      {latestLog.stand_hours || 0} <span className="text-xs text-[#555] font-sans font-normal">hrs</span>
                    </p>
                    <div className="w-full bg-sky-950/30 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-sky-400 h-full rounded-full" style={{ width: `${Math.min(((latestLog.stand_hours || 0) / 12) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SLEEP TAB VIEW */}
            {activeTab === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-[#111] border border-[#1a1a1a] p-6 rounded-2xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Sleep Analysis</p>
                      <p className="text-4xl font-mono font-bold text-indigo-400 mt-2">
                        {latestLog.sleep_hours ? Number(latestLog.sleep_hours).toFixed(1) : '0.0'}{' '}
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
                      style={{ width: `${Math.min(((Number(latestLog.sleep_hours) || 0) / 7.5) * 100, 100)}%` }} 
                    />
                  </div>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">7-Day Rest Mean</p>
                    <p className="text-sm font-mono text-[#ccc] mt-1">{avgSleep} hrs / night</p>
                  </div>
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full ${
                    Number(avgSleep) >= 7.0 ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20' : 'bg-[#f0a050]/10 text-[#f0a050] border border-[#f0a050]/20'
                  }`}>
                    {Number(avgSleep) >= 7.0 ? 'Stable' : 'Deficit'}
                  </span>
                </div>
              </div>
            )}

            {/* VITALS TAB VIEW */}
            {activeTab === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-[#111] border border-[#1a1a1a] p-6 rounded-2xl">
                  <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Mean Heart Rate</p>
                  <div className="flex items-baseline space-x-1.5 mt-2">
                    <p className="text-4xl font-mono font-bold text-[#ef4444]">
                      {latestLog.heart_rate_avg || '--'}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-[#555] font-semibold">BPM</p>
                  </div>
                  <p className="text-[11px] text-[#555] mt-4 leading-relaxed">
                    Calculated automatically via wrist-based optical sensors across active and deep sleep metrics.
                  </p>
                </div>

                <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Rolling Historical Mean</p>
                    <p className="text-sm font-mono text-[#ccc] mt-1">{avgHeartRate || '--'} BPM</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#555] bg-[#1a1a1a] px-2.5 py-1 rounded-full border border-[#222]">
                    Calibrated
                  </span>
                </div>
              </div>
            )}

            {/* TRENDS TAB VIEW (Tailwind Sparklines) */}
            {activeTab === 3 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* 7-Day Context Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-xl">
                    <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Steps Baseline (7d)</p>
                    <p className="text-base font-mono font-bold text-[#f0a050] mt-1">{avgSteps.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#111] border border-[#1a1a1a] p-4 rounded-xl">
                    <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Burn Baseline (7d)</p>
                    <p className="text-base font-mono font-bold text-[#ef4444] mt-1">{avgCalories} kcal</p>
                  </div>
                </div>

                {/* Vertical Bar Sparkline — Step History */}
                <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                  <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-6">Historical Step Volatility</p>
                  <div className="flex justify-between items-end h-24 px-1">
                    {chronological7Days.map((log, index) => {
                      const percentage = Math.min(((log.steps || 0) / 15000) * 100, 100);
                      const isToday = log.date === todayStr;
                      return (
                        <div key={log.id || index} className="flex flex-col items-center flex-1 group">
                          <div className="w-3 bg-[#1a1a1a] h-20 rounded-full flex items-end overflow-hidden">
                            <div 
                              className={`w-full rounded-full transition-all duration-500 ${isToday ? 'bg-[#f0a050]' : 'bg-[#f0a050]/30 group-hover:bg-[#f0a050]'}`}
                              style={{ height: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-[9px] font-mono text-[#444] mt-2">
                            {new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vertical Bar Sparkline — Sleep History */}
                <div className="bg-[#111] border border-[#1a1a1a] p-5 rounded-2xl">
                  <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-6">Sleep Horizon Metrics</p>
                  <div className="flex justify-between items-end h-24 px-1">
                    {chronological7Days.map((log, index) => {
                      const percentage = Math.min(((Number(log.sleep_hours) || 0) / 10) * 100, 100);
                      const isToday = log.date === todayStr;
                      return (
                        <div key={log.id || index} className="flex flex-col items-center flex-1 group">
                          <div className="w-3 bg-[#1a1a1a] h-20 rounded-full flex items-end overflow-hidden">
                            <div 
                              className={`w-full rounded-full transition-all duration-500 ${isToday ? 'bg-indigo-400' : 'bg-indigo-400/30 group-hover:bg-indigo-400'}`}
                              style={{ height: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-[9px] font-mono text-[#444] mt-2">
                            {new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}
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
      <BottomNav active="health" />
    </PullToRefresh>
  );
}