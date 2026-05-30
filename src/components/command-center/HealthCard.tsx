import { createClient } from '@supabase/supabase-js';

async function getLatestHealthLog() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'mahlon.bender@gmail.com')
    .single();

  if (!user) return null;

  const { data } = await supabase
    .from('health_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .limit(1)
    .single();

  return data;
}

function formatSleep(minutes: number | null) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default async function HealthCard() {
  const log = await getLatestHealthLog();

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
      label: 'Sleep',
      value: formatSleep(log?.sleep_duration_minutes),
      unit: '',
      icon: '🌙',
      color: 'text-indigo-500',
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
          {log?.log_date
            ? new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'No data yet'}
        </span>
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