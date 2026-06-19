import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

// Categories that represent investment account contributions
const INVESTMENT_CONTRIBUTION_CATEGORIES: Record<string, string> = {
  'Roth IRA': 'Roth IRA',
  'HSA': 'HSA',
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const { merchant, date, account, amount, category } = body;

    const id = `manual-${Date.now()}`;
    const month = date.substring(0, 7); // YYYY-MM from YYYY-MM-DD
    const numericAmount = parseFloat(String(amount));

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        id,
        date,
        merchant,
        account,
        amount: numericAmount,
        category,
        month,
        source: 'manual',
        user_id: USER_ID,
      }])
      .select()
      .single();

    if (error) {
      console.error(`[transactions/add] insert_error=${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-update investment_cash when a Roth IRA or HSA contribution is logged
    const investmentAccount = INVESTMENT_CONTRIBUTION_CATEGORIES[category];
    if (investmentAccount && numericAmount > 0) {
      try {
        const { data: cashRow, error: fetchErr } = await supabase
          .from('investment_cash')
          .select('cash_balance')
          .eq('user_id', USER_ID)
          .eq('account', investmentAccount)
          .single();

        if (fetchErr) {
          console.error(`[transactions/add] cash_fetch_error=${fetchErr.message} account=${investmentAccount}`);
        } else if (cashRow) {
          const newBalance = parseFloat(String(cashRow.cash_balance)) + numericAmount;
          const { error: updateErr } = await supabase
            .from('investment_cash')
            .update({ cash_balance: newBalance, updated_at: new Date().toISOString() })
            .eq('user_id', USER_ID)
            .eq('account', investmentAccount);

          if (updateErr) {
            console.error(`[transactions/add] cash_update_error=${updateErr.message} account=${investmentAccount}`);
          } else {
            console.error(`[transactions/add] cash_updated account=${investmentAccount} delta=+${numericAmount} new=${newBalance}`);
          }
        }
      } catch (cashErr: any) {
        // Don't fail the request — transaction was saved successfully
        console.error(`[transactions/add] cash_exception=${cashErr.message}`);
      }
    }

    return NextResponse.json(
      { success: true, transaction: data },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    console.error(`[transactions/add] caught=${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}