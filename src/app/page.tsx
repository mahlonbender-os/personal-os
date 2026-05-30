import WeatherHeader from '@/components/command-center/WeatherHeader';
import HealthCard from '@/components/command-center/HealthCard';
import CashFlowCard from '@/components/command-center/CashFlowCard';
import TasksCard from '@/components/command-center/TasksCard';
import BillsCard from '@/components/command-center/BillsCard';
import KnoxCard from '@/components/command-center/KnoxCard';
import NestRingCard from '@/components/command-center/NestRingCard';
import SpotifyCard from '@/components/command-center/SpotifyCard';
import CalendarCard from '@/components/command-center/CalendarCard';

export default function CommandCenter() {
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="px-4 pt-14 space-y-3">

      {/* Top Header: Greeting + Weather */}
      <WeatherHeader greeting={greeting} />

      {/* Health Stats — full width */}
      <HealthCard />

      {/* Cash Flow + Bills — 2 column */}
      <div className="grid grid-cols-2 gap-3">
        <CashFlowCard />
        <BillsCard />
      </div>

      {/* Today's Schedule — full width */}
      <CalendarCard />

      {/* Priority Tasks — full width */}
      <TasksCard />

      {/* Knox + Nest/Ring — 2 column */}
      <div className="grid grid-cols-2 gap-3">
        <KnoxCard />
        <NestRingCard />
      </div>

      {/* Spotify — full width */}
      <SpotifyCard />

    </div>
  );
}