import { addCalendarDays } from '@/lib/dates';

/** A bill_amounts row is fresh when as_of is this many calendar days from today, inclusive. */
export const AUTO_AMOUNT_MAX_AGE_DAYS = 40;

export type BillAmountRow = {
  bill_name?: string | null;
  amount: unknown;
  due_date?: string | null;
  source?: string | null;
  as_of?: string | null;
};

export type AutoBill = {
  name: string;
  amount: number;
  amount_type?: string | null;
  due_date?: string | null;
  auto_amount?: boolean;
  auto_updated?: string;
};

type FreshAmount = {
  amount: number;
  asOf: string;
  due: string;
};

/** YYYY-MM-DD, or '' when the value is missing or not that calendar day. */
function isoDay(value: unknown): string {
  if (value == null || value === '') return '';
  const day = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== date) return '';
  return day;
}

function dayNumber(iso: string): number | null {
  const day = isoDay(iso);
  if (!day) return null;
  const [year, month, date] = day.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / 86_400_000);
}

function withinDays(iso: string, today: string, days: number): boolean {
  const left = dayNumber(iso);
  const right = dayNumber(today);
  if (left == null || right == null) return false;
  return Math.abs(left - right) <= days;
}

/** Row qualifies for a Varies bill, or null when it must stay "Varies". */
function freshAutoAmount(row: BillAmountRow, today: string): FreshAmount | null {
  if (!isoDay(today)) return null;
  const source = String(row.source ?? '');
  if (source.endsWith(':paid')) return null;
  const asOf = isoDay(row.as_of);
  if (!asOf || !withinDays(asOf, today, AUTO_AMOUNT_MAX_AGE_DAYS)) return null;
  const dueRaw = row.due_date;
  const due = isoDay(dueRaw);
  if (dueRaw != null && dueRaw !== '' && !due) return null;
  if (due && due < addCalendarDays(today, -1)) return null;
  const amount = parseFloat(String(row.amount ?? ''));
  if (!Number.isFinite(amount) || !(amount > 0)) return null;
  return { amount, asOf, due };
}

function indexRows(rows: BillAmountRow[]): Map<string, BillAmountRow> {
  const byName = new Map<string, BillAmountRow>();
  for (const row of rows) {
    if (typeof row.bill_name !== 'string' || row.bill_name.length === 0) continue;
    byName.set(row.bill_name, row);
  }
  return byName;
}

function overlay<T extends AutoBill>(bill: T, row: BillAmountRow | undefined, today: string): T {
  if (!row) return bill;
  if (!String(bill.amount_type || '').toLowerCase().startsWith('var')) return bill;
  const fresh = freshAutoAmount(row, today);
  if (!fresh) return bill;
  return {
    ...bill,
    amount: fresh.amount,
    auto_amount: true,
    auto_updated: fresh.asOf,
    ...(fresh.due ? { due_date: fresh.due } : {}),
  };
}

/**
 * Fill Varies bills from bill_amounts. Pass null when the read failed so the
 * list is returned unchanged. Fixed and Payroll bills are never modified.
 */
export function applyAutoAmounts<T extends AutoBill>(bills: T[], rows: BillAmountRow[] | null, today: string): T[] {
  if (rows == null) return bills;
  const byName = indexRows(rows);
  let dueChanged = false;
  const next = bills.map((bill) => {
    const updated = overlay(bill, byName.get(bill.name), today);
    if ((updated.due_date || '') !== (bill.due_date || '')) dueChanged = true;
    return updated;
  });
  if (!dueChanged) return next;
  return next.slice().sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
}
