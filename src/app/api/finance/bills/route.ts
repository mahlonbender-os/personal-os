import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { num, readWorkbook, serviceClient, upcomingBills } from '@/lib/financeRead';
import { FINANCE_SHEET_SOURCE, FINANCE_USER_ID, easternToday } from '@/lib/financeSheet';
import { freshRequested, NO_STORE_HEADERS } from '@/lib/noStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = easternToday();
  const book = await readWorkbook(session.accessToken, freshRequested(request));
  if (book) {
    const bills = upcomingBills(book, today);
    const mine = bills.filter((bill) => bill.owner.trim().toLowerCase() !== 'bree');
    const bree = bills.filter((bill) => bill.owner.trim().toLowerCase() === 'bree');
    return NextResponse.json(
      { bills: mine, breeBills: bree },
      { headers: NO_STORE_HEADERS }
    );
  }

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('bills')
    .select('id, name, category, amount, due_day, due_date, payment_account, status')
    .eq('user_id', FINANCE_USER_ID)
    .eq('source', FINANCE_SHEET_SOURCE)
    .eq('status', 'Upcoming')
    .order('due_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bills = (data || []).map((bill) => ({
    ...bill,
    amount: num(bill.amount),
    amount_type: num(bill.amount) > 0 ? 'Fixed' : 'Varies',
    owner: '',
  }));
  return NextResponse.json(
    { bills, breeBills: [] },
    { headers: NO_STORE_HEADERS }
  );
}
