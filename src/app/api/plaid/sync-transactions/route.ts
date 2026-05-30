import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all connected Plaid items for this user
    const { data: items, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('status', 'active');

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No connected accounts', synced: 0 });
    }

    let totalSynced = 0;

    for (const item of items) {
      let cursor = item.transactions_cursor || undefined;
      let hasMore = true;
      const addedTransactions: any[] = [];

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor,
        });

        const data = response.data;
        addedTransactions.push(...data.added);
        cursor = data.next_cursor;
        hasMore = data.has_more;
      }

      // Save transactions to Supabase
      if (addedTransactions.length > 0) {
        const transactionsToInsert = addedTransactions.map((txn) => ({
          user_id: USER_ID,
          plaid_transaction_id: txn.transaction_id,
          plaid_account_id: txn.account_id,
          item_id: item.item_id,
          amount: txn.amount,
          date: txn.date,
          name: txn.name,
          merchant_name: txn.merchant_name || txn.name,
          category: txn.personal_finance_category?.primary || 
                    (txn.category ? txn.category[0] : 'OTHER'),
          subcategory: txn.personal_finance_category?.detailed || 
                       (txn.category ? txn.category[1] : null),
          pending: txn.pending,
          payment_channel: txn.payment_channel,
          logo_url: txn.logo_url || null,
          ownership: 'personal', // default, user can change
          currency: txn.iso_currency_code || 'USD',
        }));

        const { error: insertError } = await supabase
          .from('transactions')
          .upsert(transactionsToInsert, {
            onConflict: 'plaid_transaction_id',
            ignoreDuplicates: true,
          });

        if (insertError) console.error('Insert error:', insertError);
        totalSynced += addedTransactions.length;
      }

      // Update cursor
      await supabase
        .from('plaid_items')
        .update({ 
          transactions_cursor: cursor,
          last_synced: new Date().toISOString(),
        })
        .eq('item_id', item.item_id);
    }

    return NextResponse.json({ success: true, synced: totalSynced });
  } catch (error) {
    console.error('Sync transactions error:', error);
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  }
}