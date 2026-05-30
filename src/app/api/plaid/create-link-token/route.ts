import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { CountryCode, Products } from 'plaid';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'b0572935-26c9-44b5-8645-229bf5b78743' },
      client_name: 'Personal OS',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid create link token error:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}