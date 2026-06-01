'use client';

import PullToRefresh from '@/components/PullToRefresh';

export default function HealthPage() {
  return (
    <div className="min-h-screen bg-background">
      <PullToRefresh onRefresh={async () => { window.location.reload(); }}>
        <div className="px-4 pt-14 pb-24">
          <h1 className="text-2xl font-semibold mb-1">Health</h1>
          <p className="text-sm text-zinc-400">Coming in Step 4 — Apple Health sync</p>
        </div>
      </PullToRefresh>
    </div>
  );
}