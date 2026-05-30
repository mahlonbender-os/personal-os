import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: items } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', 'b0572935-26c9-44b5-8645-229bf5b78743')
      .eq('status', 'active');

    if (!items || items.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    const allAccounts: any[] = [];

    for (const item of items) {
      const response = await plaidClient.accountsGet({
        access_token: item.access_token,
      });

      const accounts = response.data.accounts.map((acct) => ({
        account_id: acct.account_id,
        item_id: item.item_id,
        institution_name: item.institution_name,
        name: acct.name,
        official_name: acct.official_name,
        type: acct.type,
        subtype: acct.subtype,
        balance_current: acct.balances.current,
        balance_available: acct.balances.available,
        balance_limit: acct.balances.limit,
        currency: acct.balances.iso_currency_code || 'USD',
        mask: acct.mask,
      }));

      allAccounts.push(...accounts);
    }

    return NextResponse.json({ accounts: allAccounts });
  } catch (error) {
    console.error('Accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}