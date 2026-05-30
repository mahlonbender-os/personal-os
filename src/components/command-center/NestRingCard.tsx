'use client';

export default function NestRingCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Home</h2>

      {/* Nest */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-base">🌡️</span>
          <span className="text-xs font-medium text-zinc-500">Nest</span>
        </div>
        <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">—°</p>
        <p className="text-[10px] text-zinc-400">Not connected</p>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 my-2" />

      {/* Ring */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-base">🔔</span>
          <span className="text-xs font-medium text-zinc-500">Ring</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <p className="text-[11px] text-zinc-400">Not connected</p>
        </div>
      </div>
    </div>
  );
}