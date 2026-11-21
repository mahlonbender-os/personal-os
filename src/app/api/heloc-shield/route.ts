import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  easternToday,
  easternYearMonth,
  firstApr,
  helocBalance,
  helocDebt,
  normName,
} from '@/lib/financeSheet';
import { num, readTransactions, readWorkbook, serviceClient } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(dim).padStart(2, '0')}`;
}

function daysBetween(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86400000));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = easternToday();
    const month = easternYearMonth();
    const monthStart = `${month}-01`;
    const end = monthEnd(month);

    let helocRate = 8.5;
    let currentBalance = 0;
    let creditLimit = 0;
    let breeHelocShare = 0;
    let mahlonHelocShare = 0;
    let dataSource = 'finance_sheet';

    const book = await readWorkbook(session.accessToken);
    if (book) {
      currentBalance = helocBalance(book);
      const debt = helocDebt(book);
      const apr = firstApr(debt?.apr);
      if (apr != null) helocRate = apr;
      if (debt?.creditLimit) creditLimit = debt.creditLimit;
      breeHelocShare = book.latestBalance?.breeHelocShare || 0;
      mahlonHelocShare = book.latestBalance?.mahlonHelocShare || 0;
    } else {
      dataSource = 'home_profile';
      const supabase = serviceClient();
      const { data: home } = await supabase
        .from('home_profile')
        .select('heloc_interest_rate, heloc_current_balance, heloc_credit_limit')
        .eq('user_id', USER_ID)
        .maybeSingle();
      if (home?.heloc_credit_limit) creditLimit = num(home.heloc_credit_limit);
      if (home?.heloc_interest_rate) helocRate = num(home.heloc_interest_rate);
      if (home?.heloc_current_balance) currentBalance = Math.abs(num(home.heloc_current_balance));
    }

    const txs = (await readTransactions(session.accessToken))
      .filter((row) => normName(row.account).includes('heloc'))
      .filter((row) => row.date >= monthStart && row.date <= end);

    let totalIncomeDeposited = 0;
    let interestShieldedThisMonth = 0;
    const annualRate = helocRate > 1 ? helocRate / 100 : helocRate;
    const dailyRate = annualRate / 365;

    for (const tx of txs) {
      if (tx.amount <= 0) continue;
      totalIncomeDeposited += tx.amount;
      interestShieldedThisMonth += tx.amount * dailyRate * daysBetween(tx.date, end);
    }

    return NextResponse.json({
      helocRate: helocRate > 1 ? helocRate : helocRate * 100,
      currentBalance,
      creditLimit,
      breeHelocShare,
      mahlonHelocShare,
      totalIncomeDeposited,
      interestShieldedThisMonth,
      estimatedDailyAccrual: currentBalance * dailyRate,
      cycleDateRange: { start: monthStart, end },
      dataSource,
      asOf: book?.latestBalance?.date || today,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('[heloc-shield]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal system calculation failure' }, { status: 500 });
  }
}
