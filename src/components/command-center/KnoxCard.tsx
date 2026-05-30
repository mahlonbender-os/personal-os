'use client';

export default function KnoxCard() {
  // Calculate Knox's age
  const birthdate = new Date('2024-01-14');
  const now = new Date();
  const months =
    (now.getFullYear() - birthdate.getFullYear()) * 12 +
    (now.getMonth() - birthdate.getMonth());
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const ageStr =
    years > 0
      ? `${years}y ${remMonths}mo`
      : `${months} months old`;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🐺</span>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Knox</h2>
      </div>

      <p className="text-xs text-zinc-400 mb-3">Siberian Husky · {ageStr}</p>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">Next Vet</span>
          <span className="text-zinc-600 dark:text-zinc-300 font-medium">—</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">Meds Due</span>
          <span className="text-zinc-600 dark:text-zinc-300 font-medium">—</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">Weight</span>
          <span className="text-zinc-600 dark:text-zinc-300 font-medium">—</span>
        </div>
      </div>
    </div>
  );
}