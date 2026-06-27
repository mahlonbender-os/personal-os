import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572835-26c9-44b5-8645-229bf5b78743';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch live HELOC metrics from home profile matrix
    const { data: home, error: homeError } = await supabase
      .from('home_profile')
      .select('heloc_interest_rate, heloc_current_balance, heloc_credit_limit')
      .eq('user_id', USER_ID)
      .maybeSingle();

    if (homeError || !home) {
      return NextResponse.json({ error: 'Failed to read operational home profile parameters' }, { status: 500 });
    }

    // Safely parse interest rate (handle both 8.25 format and 0.0825 format)
    const rawRate = parseFloat(String(home.heloc_interest_rate || 0));
    const annualRate = rawRate > 1 ? rawRate / 100 : rawRate;
    const dailyRate = annualRate / 365;

    // 2. Determine current eastern billing cycle boundaries
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
    const currentYear = todayStr.substring(0, 4);
    const currentMonth = todayStr.substring(5, 7);
    const monthStart = `${currentYear}-${currentMonth}-01`;
    
    // Find last day of the current month
    const lastDayObj = new Date(parseInt(currentYear), parseInt(currentMonth), 0);
    const monthEnd = `${currentYear}-${currentMonth}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

    // 3. Pull all transactions hitting the HELOC this month
    const { data: txs, error: txError } = await supabase
      .from('transactions')
      .select('date, amount, category, merchant')
      .eq('user_id', USER_ID)
      .eq('account', 'Members 1st HELOC')
      .gte('date', monthStart)
      .lte('date', monthEnd);

    if (txError) {
      return NextResponse.json({ error: 'Failed to access transactional ledger arrays' }, { status: 500 });
    }

    let totalShieldedInterest = 0;
    let totalIncomeDeposited = 0;
    const targetEnd = new Date(monthEnd);

    // Income categories defined in your project parameters
    const incomeCategories = ['Income', 'Other Inc.', 'Roth IRA', '401K', 'HSA', 'Bree'];

    // 4. Run velocity banking reduction math loop
    txs?.forEach((tx) => {
      const amountVal = parseFloat(String(tx.amount || 0));
      
      // Look for explicit income classifications or positive manual balance offsets
      const isIncome = incomeCategories.includes(tx.category) || amountVal > 0;
      
      if (isIncome) {
        const absAmount = Math.abs(amountVal);
        totalIncomeDeposited += absAmount;

        // Calculate exact days this cash sat in the line before statement close
        const txDate = new Date(tx.date);
        const diffTime = targetEnd.getTime() - txDate.getTime();
        const daysInHELOC = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        // Interest Saved = Principal Saved * Daily Rate * Days
        const savedOnThisDeposit = absAmount * dailyRate * daysInHELOC;
        totalShieldedInterest += savedOnThisDeposit;
      }
    });

    // Calculate baseline cost if money sat in normal checking accounts instead
    const currentBalance = parseFloat(String(home.heloc_current_balance || 0));
    const creditLimit = parseFloat(String(home.heloc_credit_limit || 0));
    const rawDailyAccrual = currentBalance * dailyRate;

    return NextResponse.json(
      {
        helocRate: annualRate * 100,
        currentBalance,
        creditLimit,
        totalIncomeDeposited,
        interestShieldedThisMonth: totalShieldedInterest,
        estimatedDailyAccrual: rawDailyAccrual,
        cycleDateRange: { start: monthStart, end: monthEnd }
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('HELOC Calculation Engine Crash Handler:', error);
    return NextResponse.json({ error: 'Internal server mathematical processing variance' }, { status: 500 });
  }
}