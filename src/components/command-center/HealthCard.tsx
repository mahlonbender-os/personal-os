'use client';

import { useState, useEffect } from 'react';

export default function HealthCard() {
  const [log, setLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health/latest')
      .then(r => r.json())
      .then(d => setLog(d.log))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const steps = log?.steps ?? null;
  const stepGoal = 10000;
  const stepPct = steps ? Math.min(Math.round((steps / stepGoal) * 100), 100) : 0;

  const stats = [
    {
      label: 'Steps',
      value: steps ? steps.toLocaleString() : '—',
      unit: '',
      icon: '👟',
      color: 'text-blue-500',
    },
    {
      label: 'Heart Rate',
      value: log?.resting_heart_rate ? `${log.resting_heart_rate}` : '—',
      unit: log?.resting_heart_rate ? 'bpm' : '',
      icon: '❤️',
      color: 'text-red-500',
    },
    {
      label: 'Active',
      value: log?.activity_minutes ? `${log.activity_minutes}` : '—',
      unit: log?.activity_minutes ? 'min' : '',
      icon: '⚡',
      color: 'text-orange-500',
    },
    {
      label: 'Calories',
      value: log?.active_calories ? log.active_calories.toLocaleString() : '—',
      unit: log?.active_calories ? 'cal' : '',
      icon: '🔥',
      color: 'text-amber-500',
    },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Today&apos;s Health
        </h2>
        <span className="text-[11px] text-zinc-400">
          {loading ? '…' : log?.log_date
            ? new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'No data yet'}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-8 h-3 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-0.5">
              <span className="text-base">{stat.icon}</span>
              <span className={`text-sm font-semibold ${stat.color}`}>
                {stat.value}
              </span>
              {stat.unit && (
                <span className="text-[10px] text-zinc-400">{stat.unit}</span>
              )}
              <span className="text-[10px] text-zinc-400 text-center leading-tight">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
          <span>Steps goal</span>
          <span>{steps ? steps.toLocaleString() : 0} / {stepGoal.toLocaleString()}</span>
        </div>
        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${stepPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}