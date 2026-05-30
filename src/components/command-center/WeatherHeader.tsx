'use client';

export default function WeatherHeader({ greeting }: { greeting: string }) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex items-start justify-between pt-1">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{dateStr}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}, Eric</h1>
      </div>

      {/* Weather pill — placeholder until API connected */}
      <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-3 py-1.5 mt-1 shadow-sm">
        <span className="text-lg">⛅</span>
        <span className="text-sm font-medium">72°</span>
      </div>
    </div>
  );
}