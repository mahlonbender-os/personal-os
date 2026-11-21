import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';
const ACCOUNTS = ['Roth IRA', 'HSA'] as const;

function isAccount(value: unknown): value is (typeof ACCOUNTS)[number] {
  return value === 'Roth IRA' || value === 'HSA';
}

// Cash is the balance Fidelity shows, entered by hand.
// investment_cash columns: account (primary key), user_id, cash_balance, updated_at.
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { account?: unknown; cash_balance?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { account, cash_balance } = body;
    if (!isAccount(account)) {
      return NextResponse.json({ error: 'account must be Roth IRA or HSA' }, { status: 400 });
    }
    if (typeof cash_balance !== 'number' && typeof cash_balance !== 'string') {
      return NextResponse.json({ error: 'cash_balance must be a number' }, { status: 400 });
    }

    const parsed = typeof cash_balance === 'number' ? cash_balance : parseFloat(cash_balance);
    if (!Number.isFinite(parsed)) {
      return NextResponse.json({ error: 'cash_balance must be a number' }, { status: 400 });
    }

    const balance = Math.round(parsed * 100) / 100;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('investment_cash')
      .upsert(
        {
          user_id: USER_ID,
          account,
          cash_balance: balance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account' }
      )
      .select('account, user_id, cash_balance, updated_at')
      .single();

    if (error) {
      console.error('investment_cash upsert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stored = parseFloat(String(data?.cash_balance));

    return NextResponse.json({
      success: true,
      cash: {
        account: data?.account ?? account,
        cash_balance: Number.isFinite(stored) ? stored : balance,
        updated_at: data?.updated_at ?? null,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('Investments cash PATCH error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
