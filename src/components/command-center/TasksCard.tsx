'use client';

export default function TasksCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Priority Tasks</h2>
        <button className="text-[11px] text-blue-500 font-medium">+ Add</button>
      </div>

      <div className="flex flex-col items-center justify-center py-4 gap-1">
        <span className="text-2xl">✅</span>
        <p className="text-sm text-zinc-400">No tasks right now</p>
        <p className="text-[11px] text-zinc-400">Tap + Add to create one</p>
      </div>
    </div>
  );
}