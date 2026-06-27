import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Establish strict structural defaults
    let helocRate = 8.25;
    let currentBalance = 45000.00;
    let creditLimit = 100000.00;
    let totalIncomeDeposited = 0;
    let interestShieldedThisMonth = 0; 
    let dataSource = 'live_database_calendar';

    // Establish hard calendar-month boundaries based on local Eastern Time
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
    const currentYear = todayStr.substring(0, 4);
    const currentMonth = todayStr.substring(5, 7);
    const monthStart = `${currentYear}-${currentMonth}-01`;
    
    const lastDayObj = new Date(parseInt(currentYear), parseInt(currentMonth), 0);
    const monthEnd = `${currentYear}-${currentMonth}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Fetch active home profile metrics
    const { data: home } = await supabase
      .from('home_profile')
      .select('heloc_interest_rate, heloc_current_balance, heloc_credit_limit')
      .eq('user_id', USER_ID)
      .maybeSingle();

    if (home) {
      if (home.heloc_current_balance) currentBalance = Math.abs(parseFloat(String(home.heloc_current_balance)));
      if (home.heloc_credit_limit) creditLimit = parseFloat(String(home.heloc_credit_limit));
      if (home.heloc_interest_rate) helocRate = parseFloat(String(home.heloc_interest_rate));
    }

    const annualRate = helocRate > 1 ? helocRate / 100 : helocRate;
    const dailyRate = annualRate / 365;

    // 3. Query transactions strictly within this calendar month boundaries
    const { data: txs, error: txError } = await supabase
      .from('transactions')
      .select('date, amount, category')
      .eq('user_id', USER_ID)
      .eq('account', 'Members 1st HELOC')
      .gte('date', monthStart)
      .lte('date', monthEnd);

    // 4. Calculate absolute interest shield metrics
    if (!txError && txs && txs.length > 0) {
      let calculatedShield = 0;
      let calculatedInjections = 0;
      const incomeCategories = ['income', 'other inc.', 'roth ira', '401k', 'hsa', 'bree'];
      
      const [ey, em, ed] = monthEnd.split('-');
      const targetEnd = new Date(parseInt(ey), parseInt(em) - 1, parseInt(ed));

      txs.forEach((tx) => {
        const amountVal = parseFloat(String(tx.amount || 0));
        const catNormalized = String(tx.category || '').toLowerCase().trim();
        
        // Income categories or manual positive injections counted as debt paydown acceleration
        const isIncome = incomeCategories.includes(catNormalized) || amountVal > 0;
        
        if (isIncome && tx.date) {
          const absAmount = Math.abs(amountVal);
          calculatedInjections += absAmount;

          const [ty, tm, td] = tx.date.split('-');
          const txDate = new Date(parseInt(ty), parseInt(tm) - 1, parseInt(td));
          
          const diffTime = targetEnd.getTime() - txDate.getTime();
          const daysInHELOC = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

          calculatedShield += absAmount * dailyRate * daysInHELOC;
        }
      });

      totalIncomeDeposited = calculatedInjections;
      interestShieldedThisMonth = calculatedShield;
    }

    return NextResponse.json(
      {
        helocRate: helocRate > 1 ? helocRate : helocRate * 100,
        currentBalance,
        creditLimit,
        totalIncomeDeposited,
        interestShieldedThisMonth,
        estimatedDailyAccrual: currentBalance * (annualRate / 365),
        cycleDateRange: { start: monthStart, end: monthEnd },
        dataSource
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Critical velocity metric loop crash handler:', error);
    return NextResponse.json({ error: 'Internal system calculation failure' }, { status: 500 });
  }
}