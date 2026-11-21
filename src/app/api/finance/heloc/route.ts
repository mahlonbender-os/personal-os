import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { firstApr, helocBalance, helocDebt, normName } from '@/lib/financeSheet';
import { readTransactions, readWorkbook } from '@/lib/financeRead';

export const dynamic = 'force-dynamic';

function isHelocAccount(account: string): boolean {
  return normName(account).includes('heloc');
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [book, transactions] = await Promise.all([
    readWorkbook(session.accessToken),
    readTransactions(session.accessToken),
  ]);

  const rows = transactions
    .filter((row) => isHelocAccount(row.account))
    .map((row) => ({
      id: row.id,
      transaction_date: row.date,
      transaction_type: row.amount > 0 ? 'deposit' : 'draw',
      amount: Math.abs(row.amount),
      running_balance: 0,
      description: row.merchant,
      category: row.category,
      owner: row.owner,
      status: row.status,
    }));

  const debt = book ? helocDebt(book) : undefined;
  return NextResponse.json({
    transactions: rows,
    balance: book ? helocBalance(book) : 0,
    creditLimit: debt?.creditLimit || 0,
    apr: firstApr(debt?.apr),
    breeHelocShare: book?.latestBalance?.breeHelocShare || 0,
    mahlonHelocShare: book?.latestBalance?.mahlonHelocShare || 0,
    asOf: book?.latestBalance?.date || null,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
