import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@supabase/supabase-js';

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      // Use anon key here — users table policies allow this
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase
        .from('users')
        .upsert(
          {
            email: user.email,
            name: user.name,
            image: user.image,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );

      if (error) {
        console.error('Error upserting user:', JSON.stringify(error));
        return false;
      }

      return true;
    },
  },
};