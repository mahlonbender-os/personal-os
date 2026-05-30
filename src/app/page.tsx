import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import WeatherHeader from '@/components/command-center/WeatherHeader';
import HealthCard from '@/components/command-center/HealthCard';
import CashFlowCard from '@/components/command-center/CashFlowCard';
import TasksCard from '@/components/command-center/TasksCard';
import BillsCard from '@/components/command-center/BillsCard';
import KnoxCard from '@/components/command-center/KnoxCard';
import NestRingCard from '@/components/command-center/NestRingCard';
import SpotifyCard from '@/components/command-center/SpotifyCard';
import CalendarCard from '@/components/command-center/CalendarCard';
import SignInPage from '@/components/SignInPage';

export default async function CommandCenter() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return <SignInPage />;
  }

  // Create user record if it doesn't exist yet
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from('users')
      .upsert(
        {
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
  } catch (err) {
    console.error('User upsert failed silently:', err);
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="px-4 pt-14 space-y-3">
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
  );
}