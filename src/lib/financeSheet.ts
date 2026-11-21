// Read-only client for Mahlon's Finance Google Sheet.
// The app never writes to this spreadsheet. Another person maintains it.
// Columns are matched by header name so new columns on the right are safe.

export const FINANCE_USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

/** Documented default. Override with FINANCE_SHEET_ID. The id is not a secret. */
export const DEFAULT_FINANCE_SHEET_ID = '15-z64RuJalRJvbKH93wvhsRIdB7buPnmoQX9vp52Q44';

export const FINANCE_SHEET_SOURCE = 'finance_sheet';

const CACHE_MS = 45_000;

export function financeSheetId(): string {
  return process.env.FINANCE_SHEET_ID || DEFAULT_FINANCE_SHEET_ID;
}

export function easternToday(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
}

export function easternYearMonth(now = new Date()): string {
  return easternToday(now).slice(0, 7);
}

export function easternStamp(now = new Date()): string {
  return now.toLocaleString('sv-SE', { timeZone: 'America/New_York' });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthTitle(ym: string): string {
  const [y, m] = ym.split('-');
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return ym;
  return `${MONTH_NAMES[idx]} ${y}`;
}

export function parseMoney(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val == null) return 0;
  let s = String(val).trim().replace(/\u2212/g, '-');
  if (!s || s === '—' || s === '-' || s === '–') return 0;
  const neg = s.startsWith('-') || (s.includes('(') && s.includes(')'));
  s = s.replace(/[$,\s()%]/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.abs(n) : Math.abs(n);
}

export function parsePercentOrNull(val: unknown): number | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  return parseMoney(s);
}

export function normalizeSheetDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  return '';
}

export function nextDueDate(dueDay: number, today = easternToday()): string | null {
  if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) return null;
  const [y, m, d] = today.split('-').map(Number);
  const thisMonth = clampDay(y, m, dueDay);
  if (thisMonth >= today && d) return thisMonth;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return clampDay(ny, nm, dueDay);
}

function clampDay(year: number, month: number, day: number): string {
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(day, dim);
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

export function isYes(val: string): boolean {
  const s = val.trim().toLowerCase();
  return s === 'y' || s === 'yes' || s === 'true' || s === '1';
}

export function normName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface SheetTransaction {
  id: string;
  date: string;
  merchant: string;
  account: string;
  amount: number;
  category: string;
  month: string;
  owner: string;
  type: string;
  origin: string;
  status: string;
  notes: string;
  source: typeof FINANCE_SHEET_SOURCE;
}

export interface BalanceAccount {
  name: string;
  value: number;
  type: 'asset' | 'liability';
  limit?: number;
}

export interface BalanceSnapshot {
  date: string;
  accounts: BalanceAccount[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breeHelocShare: number;
  mahlonHelocShare: number;
  capitalOneBjs: number;
  mahlonNetWorth: number;
  columns: Record<string, number>;
}

export interface MonthlyRow {
  month: string;
  label: string;
  income: number;
  spending: number;
  interestFees: number;
  net: number;
  savingsRate: number | null;
  budgetedCatSpend: number;
  totalBudget: number;
  budgetRemaining: number;
  categories: Record<string, number>;
  breeSpending: number;
  hasData: boolean;
}

export interface DebtRow {
  name: string;
  lender: string;
  balance: number;
  creditLimit: number | null;
  utilization: number | null;
  apr: string;
  minPayment: number | null;
  dueDay: number | null;
  notes: string;
}

export interface SheetBill {
  id: string;
  name: string;
  category: string;
  dueDay: number | null;
  amountType: string;
  amount: number;
  paidFrom: string;
  owner: string;
  active: boolean;
  notes: string;
  autopay: boolean;
  fundFromHeloc: boolean;
  dueDate: string | null;
}

export interface FinanceWorkbook {
  transactions: SheetTransaction[];
  balances: BalanceSnapshot[];
  latestBalance: BalanceSnapshot | null;
  monthly: MonthlyRow[];
  categoryBudgets: Record<string, number>;
  debts: DebtRow[];
  bills: SheetBill[];
  fetchedAt: string;
}

export interface FinanceTables {
  txns: string[][];
  balances: string[][];
  monthly: string[][];
  debt: string[][];
  bills: string[][];
}

const SUMMARY_HEADERS = new Set([
  'month',
  'income',
  'spending (mahlon + shared)',
  'interest & fees',
  'net',
  'savings rate',
  'budgeted cat. spend',
  'total budget',
  'budget remaining',
]);

const BALANCE_SKIP = new Set([
  'month-end',
  'total assets',
  'total liabilities',
  'net worth',
  'bree heloc share',
  'mahlon heloc share',
  'heloc split check',
]);

function headerMap(row: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  row.forEach((cell, i) => {
    const key = String(cell || '').trim();
    if (key && map[key] == null) map[key] = i;
  });
  return map;
}

function lookup(headers: Record<string, number>, name: string): number | undefined {
  if (headers[name] != null) return headers[name];
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return key == null ? undefined : headers[key];
}

function cell(row: string[], headers: Record<string, number>, name: string): string {
  const idx = lookup(headers, name);
  if (idx == null || idx >= row.length || row[idx] == null) return '';
  return String(row[idx]).trim();
}

function findHeaderRow(rows: string[][], required: string): number {
  const want = required.toLowerCase();
  const limit = Math.min(rows.length, 8);
  for (let i = 0; i < limit; i++) {
    if ((rows[i] || []).some((c) => String(c || '').trim().toLowerCase() === want)) return i;
  }
  return -1;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
}

function isBreeOwner(owner: string): boolean {
  return owner.trim().toLowerCase() === 'bree';
}

export function isBreeSpendingHeader(name: string): boolean {
  return name.trim().toLowerCase().startsWith('bree spending');
}

function skipBalanceHeader(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (BALANCE_SKIP.has(n)) return true;
  if (n.includes('note')) return true;
  if (n.length > 48) return true;
  return false;
}

function isLiabilityName(name: string, debtNames: string[]): boolean {
  const n = normName(name);
  if (
    n.includes('mortgage') ||
    n.includes('heloc') ||
    n.includes('student') ||
    n.includes('aidvantage') ||
    n.includes('amex') ||
    n.includes('chase') ||
    n.includes('savor') ||
    n.includes('apple card') ||
    n.includes('bj')
  ) {
    return true;
  }
  return debtNames.some((debt) => {
    const d = normName(debt);
    return !!d && (d === n || d.includes(n) || n.includes(d));
  });
}

function columnNumber(row: string[], headers: Record<string, number>, name: string): number {
  const idx = lookup(headers, name);
  if (idx == null) return 0;
  return parseMoney(row[idx]);
}

export function parseTransactions(rows: string[][]): SheetTransaction[] {
  const headerIdx = findHeaderRow(rows, 'Date');
  if (headerIdx < 0) return [];
  const headers = headerMap(rows[headerIdx] || []);
  const out: SheetTransaction[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const date = normalizeSheetDate(cell(row, headers, 'Date'));
    if (!date) continue;
    const description = cell(row, headers, 'Description');
    const account = cell(row, headers, 'Account');
    const amount = parseMoney(row[lookup(headers, 'Amount') ?? -1]);
    if (!description && !account && amount === 0) continue;
    out.push({
      id: `fs-r${i + 1}`,
      date,
      merchant: description,
      account,
      amount,
      category: cell(row, headers, 'Category'),
      month: date.slice(0, 7),
      owner: cell(row, headers, 'Owner'),
      type: cell(row, headers, 'Type'),
      origin: cell(row, headers, 'Source'),
      status: cell(row, headers, 'Status'),
      notes: cell(row, headers, 'Notes'),
      source: FINANCE_SHEET_SOURCE,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function parseDebts(rows: string[][]): DebtRow[] {
  const headerIdx = findHeaderRow(rows, 'Debt');
  if (headerIdx < 0) return [];
  const headers = headerMap(rows[headerIdx] || []);
  const out: DebtRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = cell(row, headers, 'Debt');
    if (!name) break;
    if (name.toLowerCase() === 'total') break;
    const limitRaw = cell(row, headers, 'Credit Limit');
    const utilRaw = cell(row, headers, 'Utilization');
    const payRaw = cell(row, headers, 'Min / Payment');
    const dueRaw = cell(row, headers, 'Due Day');
    const dueDay = parseInt(dueRaw, 10);
    out.push({
      name,
      lender: cell(row, headers, 'Lender'),
      balance: parseMoney(row[lookup(headers, 'Balance') ?? -1]),
      creditLimit: limitRaw ? parseMoney(limitRaw) : null,
      utilization: utilRaw ? parsePercentOrNull(utilRaw) : null,
      apr: cell(row, headers, 'APR'),
      minPayment: payRaw ? parseMoney(payRaw) : null,
      dueDay: Number.isFinite(dueDay) && dueDay > 0 ? dueDay : null,
      notes: cell(row, headers, 'Notes'),
    });
  }
  return out;
}

export function parseBalances(rows: string[][], debts: DebtRow[]): BalanceSnapshot[] {
  const headerIdx = findHeaderRow(rows, 'Month-end');
  if (headerIdx < 0) return [];
  const headers = headerMap(rows[headerIdx] || []);
  const debtNames = debts.map((d) => d.name);
  const byDate = new Map<string, BalanceSnapshot>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const date = normalizeSheetDate(cell(row, headers, 'Month-end'));
    if (!date) continue;

    const columns: Record<string, number> = {};
    const accounts: BalanceAccount[] = [];
    for (const [name, idx] of Object.entries(headers)) {
      if (skipBalanceHeader(name)) continue;
      const value = parseMoney(row[idx]);
      columns[name] = value;
      const debt = debts.find((d) => {
        const a = normName(d.name);
        const b = normName(name);
        return a === b || a.includes(b) || b.includes(a);
      });
      const account: BalanceAccount = {
        name,
        value: Math.abs(value),
        type: isLiabilityName(name, debtNames) ? 'liability' : 'asset',
      };
      if (debt?.creditLimit && debt.creditLimit > 0) account.limit = debt.creditLimit;
      accounts.push(account);
    }

    const totalAssets = columnNumber(row, headers, 'Total Assets');
    const totalLiabilities = columnNumber(row, headers, 'Total Liabilities');
    const netWorth = columnNumber(row, headers, 'Net Worth');
    const breeHelocShare = columnNumber(row, headers, 'Bree HELOC Share');
    const mahlonHelocShare = columnNumber(row, headers, 'Mahlon HELOC Share');
    const bjsAccount = accounts.find((a) => normName(a.name).includes('bj'));
    const capitalOneBjs = bjsAccount ? bjsAccount.value : 0;
    const summedAssets = accounts.filter((a) => a.type === 'asset').reduce((s, a) => s + a.value, 0);
    const summedLiabilities = accounts.filter((a) => a.type === 'liability').reduce((s, a) => s + a.value, 0);
    const assets = totalAssets || summedAssets;
    const liabilities = totalLiabilities || summedLiabilities;
    const worth = netWorth || assets - liabilities;

    byDate.set(date, {
      date,
      accounts,
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth: worth,
      breeHelocShare,
      mahlonHelocShare,
      capitalOneBjs,
      // Sheet net worth still includes Bree's BJ's card and her HELOC share.
      mahlonNetWorth: worth + capitalOneBjs + breeHelocShare,
      columns,
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function monthHasData(row: Omit<MonthlyRow, 'hasData' | 'label'>): boolean {
  if (row.income !== 0 || row.spending !== 0 || row.interestFees !== 0 || row.net !== 0) return true;
  if (row.budgetedCatSpend !== 0 || row.breeSpending !== 0) return true;
  return Object.values(row.categories).some((v) => v !== 0);
}

export function parseMonthly(rows: string[][]): { months: MonthlyRow[]; categoryBudgets: Record<string, number> } {
  const headerIdx = findHeaderRow(rows, 'Month');
  if (headerIdx < 0) return { months: [], categoryBudgets: {} };
  const headerRow = (rows[headerIdx] || []).map((c) => String(c || '').trim());
  const headers = headerMap(headerRow);
  const budgetRow = headerIdx > 0 ? rows[headerIdx - 1] || [] : [];
  const categoryBudgets: Record<string, number> = {};
  const categoryNames = headerRow.filter((name) => {
    if (!name) return false;
    if (SUMMARY_HEADERS.has(name.toLowerCase())) return false;
    if (isBreeSpendingHeader(name)) return false;
    return true;
  });
  for (const name of categoryNames) {
    const idx = lookup(headers, name);
    if (idx == null) continue;
    const raw = budgetRow[idx];
    const text = raw == null ? '' : String(raw).trim();
    if (!text || /[a-z]/i.test(text)) continue;
    categoryBudgets[name] = parseMoney(text);
  }

  const months: MonthlyRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const month = cell(row, headers, 'Month').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const categories: Record<string, number> = {};
    for (const name of categoryNames) {
      const idx = lookup(headers, name);
      categories[name] = idx == null ? 0 : parseMoney(row[idx]);
    }
    const breeHeader = Object.keys(headers).find((h) => isBreeSpendingHeader(h));
    const base = {
      month,
      income: columnNumber(row, headers, 'Income'),
      spending: columnNumber(row, headers, 'Spending (Mahlon + Shared)'),
      interestFees: columnNumber(row, headers, 'Interest & Fees'),
      net: columnNumber(row, headers, 'Net'),
      savingsRate: parsePercentOrNull(cell(row, headers, 'Savings Rate')),
      budgetedCatSpend: columnNumber(row, headers, 'Budgeted Cat. Spend'),
      totalBudget: columnNumber(row, headers, 'Total Budget'),
      budgetRemaining: columnNumber(row, headers, 'Budget Remaining'),
      categories,
      breeSpending: breeHeader ? parseMoney(row[headers[breeHeader]]) : 0,
    };
    months.push({
      ...base,
      label: monthTitle(month),
      hasData: monthHasData(base),
    });
  }
  return { months, categoryBudgets };
}

export function parseBills(rows: string[][], today = easternToday()): SheetBill[] {
  const headerIdx = findHeaderRow(rows, 'Bill');
  if (headerIdx < 0) return [];
  const headers = headerMap(rows[headerIdx] || []);
  const out: SheetBill[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = cell(row, headers, 'Bill');
    if (!name || /^total\b/i.test(name)) continue;
    const dueRaw = cell(row, headers, 'Due Day');
    const dueDayNum = parseInt(dueRaw, 10);
    const dueDay = Number.isFinite(dueDayNum) && dueDayNum > 0 ? dueDayNum : null;
    const amountType = cell(row, headers, 'Amount Type') || 'Fixed';
    const fixed = cell(row, headers, 'Fixed Amount');
    const varies = amountType.toLowerCase().startsWith('var');
    out.push({
      id: `fs-bill-${slug(name) || i}`,
      name,
      category: cell(row, headers, 'Category'),
      dueDay,
      amountType,
      amount: varies || !fixed ? 0 : parseMoney(fixed),
      paidFrom: cell(row, headers, 'Paid From'),
      owner: cell(row, headers, 'Owner'),
      active: isYes(cell(row, headers, 'Active')),
      notes: cell(row, headers, 'Notes'),
      autopay: isYes(cell(row, headers, 'Autopay')),
      fundFromHeloc: isYes(cell(row, headers, 'Fund from HELOC first?')),
      dueDate: dueDay ? nextDueDate(dueDay, today) : null,
    });
  }
  return out;
}

export function parseFinanceTables(tables: FinanceTables, today = easternToday()): FinanceWorkbook {
  const debts = parseDebts(tables.debt);
  const balances = parseBalances(tables.balances, debts);
  const monthly = parseMonthly(tables.monthly);
  return {
    transactions: parseTransactions(tables.txns),
    balances,
    latestBalance: balances.length ? balances[balances.length - 1] : null,
    monthly: monthly.months,
    categoryBudgets: monthly.categoryBudgets,
    debts,
    bills: parseBills(tables.bills, today),
    fetchedAt: easternStamp(),
  };
}

export function activeMonths(book: FinanceWorkbook): MonthlyRow[] {
  return book.monthly.filter((m) => m.hasData);
}

export function mahlonTransactions(rows: SheetTransaction[]): SheetTransaction[] {
  return rows.filter((row) => !isBreeOwner(row.owner));
}

export function isTransfer(row: { type?: string; category?: string }): boolean {
  const type = (row.type || '').toLowerCase();
  const category = (row.category || '').toLowerCase();
  return type.includes('transfer') || category === 'transfer';
}

export function helocBalance(book: FinanceWorkbook): number {
  const latest = book.latestBalance;
  const fromColumn = latest?.accounts.find((a) => normName(a.name).includes('heloc'))?.value;
  if (fromColumn) return fromColumn;
  const debt = book.debts.find((d) => normName(d.name).includes('heloc'));
  return debt ? Math.abs(debt.balance) : 0;
}

export function helocDebt(book: FinanceWorkbook): DebtRow | undefined {
  return book.debts.find((d) => normName(d.name).includes('heloc'));
}

export function firstApr(apr: string | undefined): number | null {
  if (!apr) return null;
  const match = apr.replace(/\u2212/g, '-').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

let cache: { key: string; at: number; book: FinanceWorkbook } | null = null;

export function clearFinanceSheetCache(): void {
  cache = null;
}

function asGrid(values: unknown[][] | undefined): string[][] {
  return (values || []).map((row) => (row || []).map((cell) => (cell == null ? '' : String(cell))));
}

export async function loadFinanceWorkbook(accessToken: string, opts?: { fresh?: boolean }): Promise<FinanceWorkbook> {
  const key = accessToken.slice(-16);
  const now = Date.now();
  if (!opts?.fresh && cache && cache.key === key && now - cache.at < CACHE_MS) {
    return cache.book;
  }

  const sheetId = financeSheetId();
  const ranges = ['Txns!A:Z', 'Balances!A:AZ', 'Monthly!A:AZ', 'Debt!A:Z', 'Bills!A:Z'];
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchGet`);
  for (const range of ranges) url.searchParams.append('ranges', range);
  url.searchParams.set('valueRenderOption', 'FORMATTED_VALUE');
  url.searchParams.set('dateTimeRenderOption', 'FORMATTED_STRING');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Finance sheet read failed (${res.status}): ${body.slice(0, 280)}`);
  }
  const json = await res.json();
  const valueRanges: { range?: string; values?: unknown[][] }[] = json.valueRanges || [];
  const grid = (name: string) => {
    const hit = valueRanges.find((r) => (r.range || '').replace(/'/g, '').toLowerCase().startsWith(`${name.toLowerCase()}!`));
    return asGrid(hit?.values);
  };
  const book = parseFinanceTables({
    txns: grid('Txns'),
    balances: grid('Balances'),
    monthly: grid('Monthly'),
    debt: grid('Debt'),
    bills: grid('Bills'),
  });
  cache = { key, at: now, book };
  return book;
}
