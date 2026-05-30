'use client';

export default function CalendarCard() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Today</h2>
        <span className="text-[11px] text-zinc-400">{today}</span>
      </div>

      {/* Placeholder events */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 py-1">
          <div className="w-1 h-8 rounded-full bg-blue-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-zinc-300 italic">No events yet</p>
            <p className="text-[11px] text-zinc-400">Connect Google Calendar</p>
          </div>
        </div>
      </div>
    </div>
  );
}