'use client';

export default function BillsCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
        Bills Due Soon
      </h2>

      <div className="flex flex-col items-center justify-center h-20 gap-1">
        <span className="text-2xl">📋</span>
        <p className="text-[11px] text-zinc-400 text-center">No bills in next 7 days</p>
      </div>

      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-[10px] text-zinc-400">Add bills to track</p>
      </div>
    </div>
  );
}