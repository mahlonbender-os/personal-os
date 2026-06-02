'use client';

import { useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import WeatherHeader from '@/components/command-center/WeatherHeader';
import HealthCard from '@/components/command-center/HealthCard';
import CashFlowCard from '@/components/command-center/CashFlowCard';
import BillsCard from '@/components/command-center/BillsCard';
import CalendarCard from '@/components/command-center/CalendarCard';
import TasksCard from '@/components/command-center/TasksCard';
import KnoxCard from '@/components/command-center/KnoxCard';
import NestRingCard from '@/components/command-center/NestRingCard';
import SpotifyCard from '@/components/command-center/SpotifyCard';

export default function CommandCenterCards() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleRefresh = useCallback(async () => {
    // Sync sheets then reload all cards
    await fetch('/api/sync/sheets', { method: 'POST' });
    window.location.reload();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 pt-14 pb-24 space-y-3">
          <WeatherHeader greeting={greeting} />
          <HealthCard />
          <div className="grid grid-cols-2 gap-3">
            <CashFlowCard />
            <BillsCard />
          </div>
          <CalendarCard />
          <TasksCard />
          <div className="grid grid-cols-2 gap-3">
            <KnoxCard />
            <NestRingCard />
          </div>
          <SpotifyCard />
        </div>
      </PullToRefresh>
    </div>
  );
}