'use client';

export default function CashFlowCard() {
  const month = new Date().toLocaleDateString('en-US', { month: 'long' });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
        {month} Cash Flow
      </h2>

      <div className="space-y-2.5">
        <div>
          <p className="text-[11px] text-zinc-400">Income</p>
          <p className="text-lg font-semibold text-emerald-500">—</p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-400">Spent</p>
          <p className="text-lg font-semibold text-red-400">—</p>
        </div>
        <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[11px] text-zinc-400">Net</p>
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">—</p>
        </div>
      </div>

      <p className="text-[10px] text-zinc-400 mt-3">Connect Plaid to sync</p>
    </div>
  );
}