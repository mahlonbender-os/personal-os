import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { public_token, institution_name, institution_id } = await request.json();

  try {
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = exchangeResponse.data;

    // Save the access token to Supabase
    const { error } = await supabase.from('plaid_items').upsert({
      user_id: 'b0572935-26c9-44b5-8645-229bf5b78743',
      item_id,
      access_token,
      institution_name: institution_name || 'Unknown Bank',
      institution_id: institution_id || '',
      status: 'active',
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Plaid exchange token error:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}