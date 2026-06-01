import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import SignInPage from '@/components/SignInPage';
import CommandCenterCards from '@/components/command-center/CommandCenterCards';

export default async function CommandCenter() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return <SignInPage />;
  }

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

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return <CommandCenterCards greeting={greeting} />;
}