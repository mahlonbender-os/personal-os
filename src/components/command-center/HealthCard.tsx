'use client';

const stats = [
  { label: 'Steps', value: '—', unit: '', icon: '👟', color: 'text-blue-500' },
  { label: 'Sleep', value: '—', unit: 'hr', icon: '🌙', color: 'text-indigo-500' },
  { label: 'Heart Rate', value: '—', unit: 'bpm', icon: '❤️', color: 'text-red-500' },
  { label: 'Active', value: '—', unit: 'min', icon: '⚡', color: 'text-orange-500' },
  { label: 'Calories', value: '—', unit: 'cal', icon: '🔥', color: 'text-amber-500' },
];

export default function HealthCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Today's Health</h2>
        <span className="text-[11px] text-zinc-400">via Apple Health</span>
      </div>

      <div className="grid grid-cols-5 gap-1">
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

      {/* Progress bar for steps goal */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
          <span>Steps goal</span>
          <span>0 / 10,000</span>
        </div>
        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: '0%' }} />
        </div>
      </div>
    </div>
  );
}