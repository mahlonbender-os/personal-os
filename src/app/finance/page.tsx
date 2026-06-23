'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  account: string;
  amount: number;
  category: string;
  month: string;
}

interface Bill {
  id: string;
  name: string;
  category: string;
  amount: number;
  due_day: number | null;
  due_date: string | null;
  payment_account: string;
  status: string;
}

interface NetWorthAccount {
  name: string;
  value: number;
  type: 'asset' | 'liability';
  limit?: number;
}

interface BudgetItem {
  category: string;
  section: 'income' | 'essentials' | 'discretionary';
  budget: number;
  actual: number;
  remaining: number;
  over: number;
  percent: number;
}

interface CashFlowMonth {
  month: string;
  rawHeader: string;
  income: number;
  essentials: number;
  discretionary: number;
  net: number;
}

interface NetWorthSnapshot {
  date: string;
  net_worth: number;
  assets: number;
  liabilities: number;
}

interface CreditScore {
  id: string;
  score: number;
  score_date: string;
  bureau: string;
  source: string;
  notes: string;
}

interface HelocTransaction {
  id: string;
  transaction_date: string;
  transaction_type: 'deposit' | 'draw' | 'payment';
  amount: number;
  running_balance: number;
  description: string;
}

interface Subscription {
  id: string;
  name: string;
  amount: number;
  billing_cycle: string;
  next_charge_date: string | null;
  category: string;
  is_active: boolean;
  notes: string;
}

type Tab = 'overview' | 'budget' | 'transactions' | 'bills' | 'networth' | 'credit' | 'heloc' | 'subscriptions';
type TxType = 'expense' | 'transfer' | 'income';

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v7';

const CATEGORY_COLORS: Record<string, string> = {
  'Knox 🐾': '#f59e0b',
  Housing: '#6366f1',
  'Dining Out': '#ef4444',
  Transportation: '#3b82f6',
  Groceries: '#22c55e',
  Electric: '#eab308',
  Internet: '#8b5cf6',
  Phone: '#06b6d4',
  Gym: '#f97316',
  'Student Loan': '#64748b',
  'UGI Gas': '#f59e0b',
  Water: '#0ea5e9',
  'Car Insurance': '#84cc16',
  Subscriptions: '#a855f7',
  Personal: '#ec4899',
  Entertainment: '#14b8a6',
  Income: '#22c55e',
  Bree: '#f43f5e',
  HSA: '#06b6d4',
  'Roth IRA': '#8b5cf6',
  '401K': '#6366f1',
  'Other Exp.': '#94a3b8',
  'Other Inc.': '#34d399',
  Transfer: '#94a3b8',
};

const INCOME_CATEGORIES = ['Income', 'Other Inc.', 'Roth IRA', '401K', 'HSA', 'Bree'];

const ACCOUNTS = [
  '1stFinancial', '401K', 'AidVantage', 'American Express Blue Cash Preferred',
  'Apple', "Capital One BJ's", 'Capital One Savor', 'Chase Sapphire Preferred',
  'Fidelity', 'Home — Zestimate', 'HSA', 'Members 1st Checking',
  'Members 1st HELOC', 'Roth IRA', 'Wells Fargo',
];

const CATEGORIES_LIST = [
  '401K', 'Bree', 'Car Insurance', 'Dining Out', 'Electric', 'Entertainment',
  'Groceries', 'Gym', 'Housing', 'HSA', 'Income', 'Internet', 'Knox 🐾',
  'Other Exp.', 'Other Inc.', 'Personal', 'Phone', 'Roth IRA', 'Student Loan',
  'Subscriptions', 'Transfer', 'Transportation', 'UGI Gas', 'Water',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function catColor(cat: string) { return CATEGORY_COLORS[cat] || '#94a3b8'; }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function fmtDate(s: string) {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function monthLabel(key: string) {
  if (!key) return '';
  if (!key.includes('-')) return key;
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function monthlyEquiv(amount: number, cycle: string): number {
  switch (cycle) {
    case 'annual': return amount / 12;
    case 'quarterly': return amount / 3;
    case 'weekly': return (amount * 52) / 12;
    default: return amount;
  }
}

function cycleLabel(cycle: string): string {
  switch (cycle) {
    case 'annual': return 'Annual';
    case 'quarterly': return 'Quarterly';
    case 'weekly': return 'Weekly';
    default: return 'Monthly';
  }
}

function txColor(category: string): string {
  if (INCOME_CATEGORIES.includes(category)) return 'text-[#22c55e]';
  if (category === 'Transfer' || !category) return 'text-[#888]';
  return 'text-[#ef4444]';
}

async function syncSheets() {
  await fetch('/api/sync/sheets', { method: 'POST' });
  try {
    Object.keys(localStorage).filter(k => k.startsWith('finance_')).forEach(k => localStorage.removeItem(k));
  } catch {}
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() {
  return <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-[#111] border border-[#1a1a1a] ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">{children}</p>;
}

function DeleteSheet({ onCancel, onConfirm, deleting, message }: { onCancel: () => void; onConfirm: () => void; deleting: boolean; message?: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
      <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5 border border-[#1a1a1a]">
        <p className="text-base font-semibold text-white text-center mb-1">Delete this entry?</p>
        {message && <p className="text-[11px] text-[#555] text-center mb-4">{message}</p>}
        {!message && <div className="mb-4" />}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-40">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ onRefresh, onNavigateRow }: { onRefresh: number; onNavigateRow: (tab: Tab) => void }) {
  const [cashFlow, setCashFlow] = useState<{ income: number; expenses: number; net: number } | null>(null);
  const [netWorth, setNetWorth] = useState<{ netWorth: number; totalAssets: number; totalLiabilities: number } | null>(null);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const cached = localStorage.getItem(`finance_overview_${CACHE_VERSION}`);
      if (cached) {
        const { cf, nw, tx, bl } = JSON.parse(cached);
        if (cf) setCashFlow(cf);
        if (nw) setNetWorth(nw);
        if (tx) setRecentTx(tx);
        if (bl) setBills(bl);
        setLoading(false);
      }
    } catch {}
    try {
      const [cfRes, nwRes, txRes, blRes] = await Promise.all([
        fetch('/api/finance/cash-flow'), fetch('/api/finance/net-worth'),
        fetch('/api/finance/transactions?limit=5'), fetch('/api/finance/bills'),
      ]);
      const [cfData, nwData, txData, blData] = await Promise.all([cfRes.json(), nwRes.json(), txRes.json(), blRes.json()]);
      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long' });
      const cur = cfData.months?.find((m: { month: string }) => m.month.toLowerCase().includes(monthName.toLowerCase()));
      const cf = cur ? { income: cur.income, expenses: cur.essentials + cur.discretionary, net: cur.net } : null;
      if (cf) setCashFlow(cf);
      setNetWorth(nwData);
      setRecentTx(txData.transactions || []);
      setBills(blData.bills || []);
      try { localStorage.setItem(`finance_overview_${CACHE_VERSION}`, JSON.stringify({ cf, nw: nwData, tx: txData.transactions || [], bl: blData.bills || [] })); } catch {}
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const dueSoon = bills.filter(b => { if (!b.due_date) return false; return new Date(b.due_date + 'T00:00:00') <= in7; });
  const dueTotal = dueSoon.reduce((s, b) => s + Math.abs(b.amount), 0);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="w-full text-left active:opacity-70 transition-opacity cursor-pointer" onClick={() => onNavigateRow('networth')}>
        <Card className="p-5">
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-1">Net Worth</p>
          <p className="text-[32px] font-extrabold text-white leading-none" style={{ fontFamily: 'system-ui' }}>
            {netWorth ? fmt(netWorth.netWorth) : '—'}
          </p>
          {netWorth && (
            <div className="flex gap-4 mt-2 text-[11px] text-[#555]">
              <span>Assets {fmt(netWorth.totalAssets)}</span>
              <span>·</span>
              <span>Liabilities {fmt(netWorth.totalLiabilities)}</span>
            </div>
          )}
        </Card>
      </div>

      {cashFlow && (
        <div className="w-full text-left active:opacity-70 transition-opacity cursor-pointer" onClick={() => onNavigateRow('budget')}>
          <Card className="p-4">
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">This Month</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-[#444] mb-0.5">Income</p>
                <p className="text-base font-bold text-[#22c55e] font-mono">{fmt(cashFlow.income)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#444] mb-0.5">Expenses</p>
                <p className="text-base font-bold text-[#ef4444] font-mono">{fmt(cashFlow.expenses)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#444] mb-0.5">Net</p>
                <p className={`text-base font-bold font-mono ${cashFlow.net >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{fmt(Math.abs(cashFlow.net))}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {dueSoon.length > 0 && (
        <div className="w-full text-left active:opacity-70 transition-opacity cursor-pointer" onClick={() => onNavigateRow('bills')}>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Bills Due Soon</p>
              <p className="text-[9px] text-[#f0a050]">See all →</p>
            </div>
            <p className="text-xl font-bold text-[#f0a050] font-mono">{fmt(dueTotal)}</p>
            <p className="text-[10px] text-[#444]">{dueSoon.length} bill{dueSoon.length !== 1 ? 's' : ''} in next 7 days</p>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="w-full px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between active:bg-[#161616] cursor-pointer" onClick={() => onNavigateRow('transactions')}>
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Recent Transactions</p>
          <p className="text-[9px] text-[#f0a050]">See all →</p>
        </div>
        {recentTx.length === 0 ? (
          <p className="px-4 py-6 text-center text-[11px] text-[#333]">Pull down to sync latest data</p>
        ) : (
          <div className="divide-y divide-[#141414]">
            {recentTx.map(tx => (
              <div key={tx.id} className="flex items-center px-4 py-3 gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(tx.category) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#e0e0e0] truncate">{tx.merchant}</p>
                  <p className="text-[10px] text-[#444]">{tx.category} · {fmtDate(tx.date)}</p>
                </div>
                <p className={`text-sm font-semibold flex-shrink-0 font-mono ${txColor(tx.category)}`}>{fmt(tx.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Budget Tab ───────────────────────────────────────────────────────────────

function BudgetTab({ onRefresh }: { onRefresh: number }) {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [totalIncomeBudget, setTotalIncomeBudget] = useState(0);
  const [totalIncomeActual, setTotalIncomeActual] = useState(0);
  const [totalExpenseBudget, setTotalExpenseBudget] = useState(0);
  const [totalExpenseActual, setTotalExpenseActual] = useState(0);
  const [projectedCashFlow, setProjectedCashFlow] = useState(0);
  const [actualCashFlow, setActualCashFlow] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [currentMonth, setCurrentMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [historicalMonths, setHistoricalMonths] = useState<CashFlowMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (month?: string) => {
    setLoading(true); setError(null);
    try {
      const url = month ? `/api/finance/budget?month=${month}` : '/api/finance/budget';
      const data = await fetch(url).then(r => r.json());
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
      setTotalIncomeBudget(data.totalIncomeBudget || 0);
      setTotalIncomeActual(data.totalIncomeActual || 0);
      setTotalExpenseBudget(data.totalExpenseBudget || 0);
      setTotalExpenseActual(data.totalExpenseActual || 0);
      setProjectedCashFlow(data.projectedCashFlow || 0);
      setActualCashFlow(data.actualCashFlow || 0);
      setSelectedMonth(data.month);
      setCurrentMonth(data.currentMonth);
      setAvailableMonths(data.availableMonths || []);
      const cfData = await fetch('/api/finance/cash-flow').then(r => r.json());
      if (cfData.months) {
        const targetMonthIndex = cfData.months.findIndex((m: CashFlowMonth) => m.rawHeader === (month || data.month));
        if (targetMonthIndex !== -1) {
          const sliceStart = Math.max(0, targetMonthIndex - 5);
          setHistoricalMonths(cfData.months.slice(sliceStart, targetMonthIndex + 1));
        } else {
          setHistoricalMonths(cfData.months.slice(-6));
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  const incomeItems = items.filter(i => i.section === 'income');
  const essentialItems = items.filter(i => i.section === 'essentials');
  const discretionaryItems = items.filter(i => i.section === 'discretionary');

  function CashFlowTrendChart() {
    if (historicalMonths.length < 2) return null;
    const maxVal = Math.max(...historicalMonths.map(m => Math.max(m.income, m.essentials + m.discretionary, 1)));
    return (
      <div>
        <SectionLabel>Historical Cash Flow</SectionLabel>
        <Card className="p-4 space-y-4">
          <div className="h-28 flex items-end justify-between gap-2 pt-2 px-1">
            {historicalMonths.map((m, i) => {
              const totalExp = m.essentials + m.discretionary;
              const incHeight = (m.income / maxVal) * 100;
              const expHeight = (totalExp / maxVal) * 100;
              const labelShort = m.month.split(' ')[0].substring(0, 3);
              return (
                <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="flex items-end justify-center gap-1.5 w-full h-full pb-1">
                    <div className="w-[7px] bg-[#22c55e] rounded-t-sm" style={{ height: `${Math.max(incHeight, 2)}%` }} />
                    <div className="w-[7px] bg-[#ef4444] rounded-t-sm" style={{ height: `${Math.max(expHeight, 2)}%` }} />
                  </div>
                  <span className="text-[9px] text-[#444] font-semibold uppercase mt-1">{labelShort}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-4 text-[10px] border-t border-[#1a1a1a] pt-2 text-[#555]">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /><span>Income</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /><span>Expenses</span></div>
          </div>
        </Card>
      </div>
    );
  }

  function BudgetSection({ title, rows, totalBudget, totalActual }: { title: string; rows: BudgetItem[]; totalBudget: number; totalActual: number }) {
    const isIncome = title === 'Income';
    const pct = totalBudget > 0 ? Math.min(Math.round((totalActual / totalBudget) * 100), 100) : 0;
    return (
      <div>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">{title}</p>
          <p className="text-[10px] text-[#444] font-mono">{fmt(totalActual)} / {fmt(totalBudget)}</p>
        </div>
        <Card className="overflow-hidden">
          {rows.map((item, idx) => (
            <div key={item.category} className={`px-4 py-3 ${idx !== rows.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(item.category) }} />
                  <p className="text-sm font-medium text-[#e0e0e0] truncate">{item.category}</p>
                </div>
                <p className="text-sm font-semibold text-[#ccc] font-mono flex-shrink-0 ml-2">
                  {fmt(item.actual)}<span className="text-[10px] text-[#444] font-normal"> / {fmt(item.budget)}</span>
                </p>
              </div>
              <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isIncome ? 'bg-[#22c55e]' : item.percent >= 100 ? 'bg-[#ef4444]' : item.percent >= 80 ? 'bg-[#f59e0b]' : ''}`}
                  style={{ width: `${Math.min(item.percent, 100)}%`, backgroundColor: (!isIncome && item.percent < 80) ? catColor(item.category) : undefined }} />
              </div>
              {!isIncome && item.over > 0 && <p className="text-[10px] text-[#ef4444] mt-0.5">{fmt(item.over)} over</p>}
            </div>
          ))}
          <div className="px-4 py-2 bg-[#161616] border-t border-[#1a1a1a]">
            <div className="h-[3px] bg-[#222] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${isIncome ? 'bg-[#22c55e]' : pct >= 100 ? 'bg-[#ef4444]' : pct >= 80 ? 'bg-[#f59e0b]' : 'bg-[#f0a050]'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-[9px] text-[#333]">{pct}% used</p>
              <p className={`text-[9px] font-medium ${isIncome ? totalActual >= totalBudget ? 'text-[#22c55e]' : 'text-[#444]' : totalActual > totalBudget ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {isIncome ? totalActual >= totalBudget ? `${fmt(totalActual - totalBudget)} extra` : `${fmt(totalBudget - totalActual)} remaining` : totalActual > totalBudget ? `${fmt(totalActual - totalBudget)} over` : `${fmt(totalBudget - totalActual)} left`}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">
            {selectedMonth === currentMonth ? 'This Month' : monthLabel(selectedMonth)}
          </p>
          <select value={selectedMonth} onChange={e => load(e.target.value)} className="text-[11px] text-[#f0a050] bg-transparent border-none outline-none cursor-pointer">
            {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-[#444] mb-0.5">Income</p>
            <p className="text-sm font-bold text-[#22c55e] font-mono">{fmt(totalIncomeActual)}</p>
            <p className="text-[9px] text-[#333] font-mono">/ {fmt(totalIncomeBudget)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#444] mb-0.5">Expenses</p>
            <p className="text-sm font-bold text-[#ef4444] font-mono">{fmt(totalExpenseActual)}</p>
            <p className="text-[9px] text-[#333] font-mono">/ {fmt(totalExpenseBudget)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#444] mb-0.5">Cash Flow</p>
            <p className={`text-sm font-bold font-mono ${actualCashFlow >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{fmt(Math.abs(actualCashFlow))}</p>
            <p className="text-[9px] text-[#333] font-mono">/ {fmt(Math.abs(projectedCashFlow))}</p>
          </div>
        </div>
      </Card>
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : error ? (
        <Card className="p-4 text-sm text-[#ef4444]">{error} — pull down to refresh</Card>
      ) : (
        <>
          <CashFlowTrendChart />
          <BudgetSection title="Income" rows={incomeItems} totalBudget={totalIncomeBudget} totalActual={totalIncomeActual} />
          <BudgetSection title="Essentials" rows={essentialItems} totalBudget={essentialItems.reduce((s, i) => s + i.budget, 0)} totalActual={essentialItems.reduce((s, i) => s + i.actual, 0)} />
          <BudgetSection title="Discretionary" rows={discretionaryItems} totalBudget={discretionaryItems.reduce((s, i) => s + i.budget, 0)} totalActual={discretionaryItems.reduce((s, i) => s + i.actual, 0)} />
        </>
      )}
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ onRefresh }: { onRefresh: number }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`/api/finance/transactions?limit=300&_=${Date.now()}`, { cache: 'no-store' }).then(r => r.json());
      setTransactions(data.transactions || []);
    } catch (e) { console.error('Failed to load transactions:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { setSearchQuery(''); setSelectedCategory('All'); load(); }, [load, onRefresh]);

  const categories = ['All', ...Array.from(new Set(transactions.map(t => t.category))).sort()];
  const filtered = transactions.filter(tx => {
    const matchCat = selectedCategory === 'All' || tx.category === selectedCategory;
    const matchSearch = !searchQuery || tx.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = tx.date ? tx.date.substring(0, 7) : 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function monthTotal(txs: Transaction[]) {
    return txs.reduce((sum, tx) => INCOME_CATEGORIES.includes(tx.category) ? sum + tx.amount : sum - tx.amount, 0);
  }

  return (
    <div className="space-y-3 h-full flex flex-col animate-fadeIn">
      <div className="space-y-2 flex-shrink-0">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333] text-sm">🔍</span>
          <input type="text" placeholder="Search transactions…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#111] border border-[#1a1a1a] text-sm text-[#ccc] placeholder-[#333] outline-none focus:ring-1 focus:ring-[#f0a050]" />
        </div>
        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-[#111] border border-[#1a1a1a] text-sm text-[#ccc] outline-none focus:ring-1 focus:ring-[#f0a050]">
          {categories.map(cat => <option key={cat} value={cat}>{cat || '(no category)'}</option>)}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto pb-16 space-y-4 pr-1 scrollbar-hide">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#333] text-sm">{transactions.length === 0 ? 'Pull down to sync data' : 'No results'}</div>
        ) : (
          sortedMonths.map(monthKey => {
            const monthTxs = grouped[monthKey];
            const total = monthTotal(monthTxs);
            return (
              <div key={monthKey}>
                <div className="flex justify-between items-baseline mb-2 px-1">
                  <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">{monthLabel(monthKey)}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-[#333]">{monthTxs.length} tx</p>
                    <p className={`text-[10px] font-semibold font-mono ${total >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{fmt(Math.abs(total))}</p>
                  </div>
                </div>
                <Card className="overflow-hidden">
                  {monthTxs.map((tx, idx) => (
                    <div key={tx.id} className={`flex items-center px-4 py-3 gap-3 ${idx !== monthTxs.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(tx.category) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#e0e0e0] truncate">{tx.merchant}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: catColor(tx.category) + '20', color: catColor(tx.category) }}>
                            {tx.category || 'Transfer'}
                          </span>
                          <span className="text-[10px] text-[#444] flex-shrink-0">{fmtDate(tx.date)}</span>
                          {tx.account && <span className="text-[10px] text-[#333] truncate min-w-0">{tx.account}</span>}
                        </div>
                      </div>
                      <p className={`text-sm font-semibold flex-shrink-0 ml-2 font-mono ${txColor(tx.category)}`}>{fmt(tx.amount)}</p>
                    </div>
                  ))}
                </Card>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Bills Tab ────────────────────────────────────────────────────────────────

function BillsTab({ onRefresh }: { onRefresh: number }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const cached = localStorage.getItem(`finance_bills_${CACHE_VERSION}`);
      if (cached) { setBills(JSON.parse(cached)); setLoading(false); }
    } catch {}
    try {
      const data = await fetch('/api/finance/bills').then(r => r.json());
      setBills(data.bills || []);
      try { localStorage.setItem(`finance_bills_${CACHE_VERSION}`, JSON.stringify(data.bills || [])); } catch {}
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  const totalMonthly = bills.reduce((s, b) => s + Math.abs(b.amount || 0), 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const dueSoon = bills.filter(b => b.due_date && new Date(b.due_date + 'T00:00:00') <= in7);
  const dueLater = bills.filter(b => b.due_date && new Date(b.due_date + 'T00:00:00') > in7);

  function BillRow({ bill, idx, total }: { bill: Bill; idx: number; total: number }) {
    return (
      <div className={`flex items-center px-4 py-3 gap-3 ${idx !== total - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
        <div className="w-12 flex-shrink-0 text-center">
          <span className="text-[11px] font-bold text-[#555]">{bill.due_date ? fmtDate(bill.due_date) : ''}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#e0e0e0]">{bill.name}</p>
          <p className="text-[10px] text-[#444]">{bill.payment_account || bill.category}</p>
        </div>
        <p className="text-sm font-semibold text-[#f0a050] flex-shrink-0 font-mono">{fmt(Math.abs(bill.amount))}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <Card className="p-4">
        <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-1">Upcoming Bills Total</p>
        <p className="text-2xl font-bold text-white font-mono">{fmt(totalMonthly)}</p>
        <p className="text-[10px] text-[#444] mt-0.5">{bills.length} unpaid bills</p>
      </Card>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : bills.length === 0 ? (
        <div className="text-center py-10 text-[#333] text-sm">No upcoming bills — pull down to sync</div>
      ) : (
        <>
          {dueSoon.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#f0a050] uppercase tracking-widest mb-2 px-1">Due Within 7 Days</p>
              <Card className="overflow-hidden border-[#f0a050]/20">
                {dueSoon.map((bill, idx) => <BillRow key={bill.id} bill={bill} idx={idx} total={dueSoon.length} />)}
              </Card>
            </div>
          )}
          {dueLater.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-2 px-1">Coming Up</p>
              <Card className="overflow-hidden">
                {dueLater.map((bill, idx) => <BillRow key={bill.id} bill={bill} idx={idx} total={dueLater.length} />)}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Net Worth Tab ────────────────────────────────────────────────────────────

// Cashback rates for credit cards — fuzzy-matched against sheet account names
const CARD_DETAILS: Record<string, {
  limit: number;
  baseRate: number;
  annualFee: number;
  categories: { label: string; rate: string }[];
}> = {
  '1stFinancial': {
    limit: 3150,
    baseRate: 1,
    annualFee: 0,
    categories: [],
  },
  'Apple': {
    limit: 8100,
    baseRate: 2,
    annualFee: 0,
    categories: [{ label: 'Apple purchases', rate: '3%' }],
  },
  'American Express Blue Cash Preferred': {
    limit: 35000,
    baseRate: 1,
    annualFee: 95,
    categories: [
      { label: 'Groceries', rate: '6%' },
      { label: 'Streaming', rate: '6%' },
      { label: 'Gas', rate: '3%' },
      { label: 'Transit', rate: '3%' },
    ],
  },
  "Capital One BJ's": {
    limit: 8000,
    baseRate: 1.5,
    annualFee: 0,
    categories: [
      { label: "BJ's", rate: '5%' },
      { label: 'Gas', rate: '15¢/gal' },
    ],
  },
  'Capital One Savor': {
    limit: 11150,
    baseRate: 1,
    annualFee: 0,
    categories: [
      { label: 'Dining', rate: '3%' },
      { label: 'Entertainment', rate: '3%' },
      { label: 'Groceries', rate: '3%' },
    ],
  },
  'Chase Sapphire Preferred': {
    limit: 12300,
    baseRate: 1,
    annualFee: 95,
    categories: [
      { label: 'Dining', rate: '3x' },
      { label: 'Travel', rate: '2x' },
    ],
  },
};

// Fuzzy match for cashback rates — handles curly apostrophes, minor name diffs
function getCardInfo(name: string) {
  if (!name) return null;
  if (CARD_DETAILS[name]) return CARD_DETAILS[name];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const normName = norm(name);
  const key = Object.keys(CARD_DETAILS).find(k => {
    const normKey = norm(k);
    return normKey === normName || normName.includes(normKey) || normKey.includes(normName);
  });
  return key ? CARD_DETAILS[key] : null;
}

// Determine account class from name — drives expanded detail layout
function getAcctMeta(name: string, isLiability: boolean, limit: number): {
  typeLabel: string; emoji: string;
  isRevolving: boolean; isInvestment: boolean; isLoan: boolean; isChecking: boolean; isHome: boolean;
} {
  const n = name.toLowerCase();
  if (n.includes('heloc'))     return { typeLabel: 'Home Equity Line of Credit', emoji: '🏠', isRevolving: true,  isInvestment: false, isLoan: false, isChecking: false, isHome: false };
  if (n.includes('hsa'))       return { typeLabel: 'Health Savings Account',     emoji: '🏥', isRevolving: false, isInvestment: true,  isLoan: false, isChecking: false, isHome: false };
  if (n.includes('roth'))      return { typeLabel: 'Roth IRA',                   emoji: '📈', isRevolving: false, isInvestment: true,  isLoan: false, isChecking: false, isHome: false };
  if (n.includes('401'))       return { typeLabel: '401(k) Retirement',          emoji: '💼', isRevolving: false, isInvestment: true,  isLoan: false, isChecking: false, isHome: false };
  if (n.includes('fidelity'))  return { typeLabel: 'Brokerage Account',          emoji: '📊', isRevolving: false, isInvestment: true,  isLoan: false, isChecking: false, isHome: false };
  if (n.includes('aidvantage'))return { typeLabel: 'Student Loan',               emoji: '🎓', isRevolving: false, isInvestment: false, isLoan: true,  isChecking: false, isHome: false };
  if (n.includes('wells'))     return { typeLabel: 'Mortgage / Loan',            emoji: '🏦', isRevolving: false, isInvestment: false, isLoan: true,  isChecking: false, isHome: false };
  if (n.includes('checking'))  return { typeLabel: 'Checking Account',           emoji: '🏦', isRevolving: false, isInvestment: false, isLoan: false, isChecking: true,  isHome: false };
  if (n.includes('zestimate') || (n.includes('home') && !isLiability))
                               return { typeLabel: 'Home Value (Zillow)',         emoji: '🏡', isRevolving: false, isInvestment: false, isLoan: false, isChecking: false, isHome: true  };
  // Liability with a credit limit = credit card
  if (isLiability && limit > 0) return { typeLabel: 'Credit Card',              emoji: '💳', isRevolving: true,  isInvestment: false, isLoan: false, isChecking: false, isHome: false };
  return { typeLabel: isLiability ? 'Liability' : 'Asset', emoji: '💰', isRevolving: false, isInvestment: false, isLoan: false, isChecking: false, isHome: false };
}

function NetWorthTab({ onRefresh }: { onRefresh: number }) {
  const [data, setData] = useState<{ accounts: NetWorthAccount[]; totalAssets: number; totalLiabilities: number; netWorth: number; history?: NetWorthSnapshot[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  // Monthly activity per account — fetched once when tab loads
  const [monthlyActivity, setMonthlyActivity] = useState<Record<string, { income: number; expenses: number; txCount: number }>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nwRes, txRes] = await Promise.all([
        fetch('/api/finance/net-worth'),
        fetch(`/api/finance/transactions?limit=400&_=${Date.now()}`, { cache: 'no-store' }),
      ]);
      const [d, txData] = await Promise.all([nwRes.json(), txRes.json()]);
      if (d.error) throw new Error(d.error);
      setData(d);

      // Build per-account activity for current month
      const currentMonth = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }).substring(0, 7);
      const activity: Record<string, { income: number; expenses: number; txCount: number }> = {};
      (txData.transactions || []).forEach((tx: Transaction) => {
        if (!tx.month?.startsWith(currentMonth)) return;
        if (!tx.account) return;
        if (!activity[tx.account]) activity[tx.account] = { income: 0, expenses: 0, txCount: 0 };
        const amt = parseFloat(String(tx.amount));
        if (amt > 0) activity[tx.account].income += amt;
        else activity[tx.account].expenses += Math.abs(amt);
        activity[tx.account].txCount += 1;
      });
      setMonthlyActivity(activity);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <Card className="p-4 text-sm text-[#ef4444]">Unable to load — pull down to refresh</Card>;
  if (!data) return null;

  const assets = data.accounts.filter(a => a.type === 'asset');
  const liabilities = data.accounts.filter(a => a.type === 'liability');
  const historyList = data.history || [];

  function toggle(name: string) {
    if (navigator.vibrate) navigator.vibrate(6);
    setExpandedAccount(prev => prev === name ? null : name);
  }

  function NetWorthSparkline() {
    if (historyList.length < 2) return null;
    const values = historyList.map(h => h.net_worth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min === 0 ? 1 : max - min;
    const width = 340; const height = 80; const padding = 10;
    const points = historyList.map((h, i) => {
      const x = padding + (i / (historyList.length - 1)) * (width - padding * 2);
      const y = (height - padding) - ((h.net_worth - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <div>
        <SectionLabel>Net Worth Trajectory</SectionLabel>
        <Card className="p-4 flex flex-col items-center">
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <polyline fill="none" stroke="#f0a050" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
            {historyList.map((h, i) => {
              if (i !== 0 && i !== historyList.length - 1) return null;
              const x = padding + (i / (historyList.length - 1)) * (width - padding * 2);
              const y = (height - padding) - ((h.net_worth - min) / range) * (height - padding * 2);
              return <circle key={i} cx={x} cy={y} r="4" fill="#111" stroke="#f0a050" strokeWidth="2" />;
            })}
          </svg>
          <div className="w-full flex justify-between text-[9px] text-[#444] font-semibold uppercase mt-2 px-1">
            <span>{monthLabel(historyList[0].date.substring(0, 7)).split(' ')[0]}</span>
            <span>{monthLabel(historyList[historyList.length - 1].date.substring(0, 7)).split(' ')[0]}</span>
          </div>
        </Card>
      </div>
    );
  }

  // Rich expanded detail panel — content varies by account type
  function AccountDetail({ acct, isLiability }: { acct: NetWorthAccount; isLiability: boolean }) {
    const balance = Math.abs(parseFloat(String(acct.value)));
    const limit = acct.limit ?? 0;
    const meta = getAcctMeta(acct.name, isLiability, limit);
    const activity = monthlyActivity[acct.name];
    const cardInfo = (meta.isRevolving && !meta.typeLabel.includes('Equity')) ? getCardInfo(acct.name) : null;
    const util = limit > 0 ? (balance / limit) * 100 : 0;
    const utilHigh = util > 30;
    const available = limit > 0 ? limit - balance : 0;

    return (
      <div className="bg-[#0d0d0d] border-t border-[#1a1a1a] divide-y divide-[#141414]">

        {/* Account type badge row */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-base">{meta.emoji}</span>
          <span className="text-[11px] font-semibold text-[#555] uppercase tracking-wide">{meta.typeLabel}</span>
        </div>

        {/* Revolving credit (cards + HELOC): utilization bar + available */}
        {meta.isRevolving && limit > 0 && (
          <div className="px-4 py-3 space-y-2">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#555]">{fmt(balance)} balance</span>
              <span className={`font-bold font-mono ${utilHigh ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>{util.toFixed(1)}%</span>
              <span className="text-[#555]">{fmt(limit)} limit</span>
            </div>
            <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${utilHigh ? 'bg-[#ef4444]' : 'bg-[#22c55e]'}`} style={{ width: `${Math.min(util, 100)}%` }} />
            </div>
            <p className="text-[10px] text-[#555]">
              <span className="text-[#22c55e] font-semibold font-mono">{fmt(available)}</span> available
            </p>
          </div>
        )}

        {/* Cashback rates — credit cards only */}
        {cardInfo && (
          <div className="px-4 py-3 flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#f0a050]/10 text-[#f0a050] font-semibold">Base {cardInfo.baseRate}%</span>
            {cardInfo.categories.map(cat => (
              <span key={cat.label} className="text-[10px] px-2 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] font-semibold">{cat.label} {cat.rate}</span>
            ))}
            {cardInfo.annualFee > 0 && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#2a2a2a] text-[#555]">${cardInfo.annualFee}/yr fee</span>
            )}
          </div>
        )}

        {/* Investment accounts: class hint */}
        {meta.isInvestment && (
          <div className="px-4 py-3">
            <p className="text-[10px] text-[#555]">
              {acct.name.toLowerCase().includes('hsa') && 'Tax-advantaged · Medical expenses or retirement'}
              {acct.name.toLowerCase().includes('roth') && 'Tax-free growth · Qualified withdrawals tax-free'}
              {acct.name.toLowerCase().includes('401') && 'Tax-deferred · Employer-sponsored retirement'}
              {acct.name.toLowerCase().includes('fidelity') && 'Taxable brokerage · See Investments for holdings'}
            </p>
          </div>
        )}

        {/* Loan accounts */}
        {meta.isLoan && (
          <div className="px-4 py-3">
            <p className="text-[10px] text-[#555]">Remaining balance <span className="text-[#ef4444] font-semibold font-mono">{fmt(balance)}</span></p>
          </div>
        )}

        {/* Home value note */}
        {meta.isHome && (
          <div className="px-4 py-3">
            <p className="text-[10px] text-[#555]">Estimated market value via Zillow · Updates on sync</p>
          </div>
        )}

        {/* Monthly activity — shown for all accounts that have transactions */}
        {activity && activity.txCount > 0 && (
          <div className="px-4 py-3">
            <p className="text-[10px] text-[#444] mb-2 uppercase tracking-wide font-semibold">This Month · {activity.txCount} transaction{activity.txCount !== 1 ? 's' : ''}</p>
            <div className="flex gap-6">
              {activity.income > 0 && (
                <div>
                  <p className="text-[9px] text-[#444] mb-0.5">In / Credits</p>
                  <p className="text-sm font-bold text-[#22c55e] font-mono">{fmt(activity.income)}</p>
                </div>
              )}
              {activity.expenses > 0 && (
                <div>
                  <p className="text-[9px] text-[#444] mb-0.5">Out / Charges</p>
                  <p className="text-sm font-bold text-[#ef4444] font-mono">{fmt(activity.expenses)}</p>
                </div>
              )}
              {activity.income > 0 && activity.expenses > 0 && (
                <div>
                  <p className="text-[9px] text-[#444] mb-0.5">Net</p>
                  <p className={`text-sm font-bold font-mono ${activity.income - activity.expenses >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {fmt(Math.abs(activity.income - activity.expenses))}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    );
  }

  function AccountRow({ acct, isLiability, isLast }: { acct: NetWorthAccount; isLiability: boolean; isLast: boolean }) {
    const isExpanded = expandedAccount === acct.name;
    const dotColor = isLiability ? 'bg-[#ef4444]' : 'bg-[#22c55e]';
    const valColor = isLiability ? 'text-[#ef4444]' : 'text-[#22c55e]';
    const meta = getAcctMeta(acct.name, isLiability, acct.limit ?? 0);

    return (
      <div>
        <div
          className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${!isLast || isExpanded ? 'border-b border-[#1a1a1a]' : ''}`}
          onClick={() => toggle(acct.name)}
        >
          <span className="text-sm flex-shrink-0">{meta.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#ccc] truncate">{acct.name}</p>
            <p className="text-[10px] text-[#444]">{meta.typeLabel}</p>
          </div>
          <span className={`text-[10px] text-[#555] mr-1 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
          <p className={`text-sm font-semibold font-mono flex-shrink-0 ${valColor}`}>{fmt(acct.value)}</p>
        </div>
        {isExpanded && (
          <div className={!isLast ? 'border-b border-[#1a1a1a]' : ''}>
            <AccountDetail acct={acct} isLiability={isLiability} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="rounded-2xl bg-gradient-to-br from-[#1a1000] to-[#111] border border-[#f0a050]/20 p-5">
        <p className="text-[#f0a050]/60 text-sm mb-1">Net Worth</p>
        <p className="text-4xl font-bold text-white font-mono tracking-tight">{fmt(data.netWorth)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[#555] text-[10px]">Total Assets</p>
            <p className="text-white font-bold font-mono">{fmt(data.totalAssets)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[#555] text-[10px]">Total Liabilities</p>
            <p className="text-white font-bold font-mono">{fmt(data.totalLiabilities)}</p>
          </div>
        </div>
      </div>

      <NetWorthSparkline />

      {assets.length > 0 && (
        <div>
          <SectionLabel>Assets</SectionLabel>
          <Card className="overflow-hidden">
            {assets.map((acct, idx) => (
              <AccountRow key={acct.name} acct={acct} isLiability={false} isLast={idx === assets.length - 1} />
            ))}
          </Card>
        </div>
      )}

      {liabilities.length > 0 && (
        <div>
          <SectionLabel>Liabilities</SectionLabel>
          <Card className="overflow-hidden">
            {liabilities.map((acct, idx) => (
              <AccountRow key={acct.name} acct={acct} isLiability={true} isLast={idx === liabilities.length - 1} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Credit Tab ───────────────────────────────────────────────────────────────

function CreditTab({ onRefresh }: { onRefresh: number }) {
  const [scores, setScores] = useState<CreditScore[]>([]);
  const [accounts, setAccounts] = useState<{ name: string; balance: number; limit: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [creditRes, acctRes] = await Promise.all([
        fetch('/api/finance/credit'),
        fetch('/api/finance/accounts'),
      ]);
      const [creditData, acctData] = await Promise.all([creditRes.json(), acctRes.json()]);
      setScores(creditData.scores || []);
      setAccounts((acctData.accounts || []).filter((a: { limit: number }) => parseFloat(String(a.limit)) > 0));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/finance/credit?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteId(null);
    setExpandedId(null);
    load();
  }

  function scoreColor(s: number) {
    if (s >= 750) return '#22c55e';
    if (s >= 700) return '#f0a050';
    if (s >= 650) return '#f59e0b';
    return '#ef4444';
  }
  function scoreLabel(s: number) {
    if (s >= 800) return 'Exceptional';
    if (s >= 750) return 'Very Good';
    if (s >= 700) return 'Good';
    if (s >= 650) return 'Fair';
    return 'Poor';
  }

  const latestScore = scores[0];
  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <>
      <div className="space-y-4 animate-fadeIn">
        <Card className="p-5 text-center">
          {latestScore ? (
            <>
              <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2">Credit Score</p>
              <p className="text-[56px] font-extrabold leading-none" style={{ color: scoreColor(latestScore.score), fontFamily: 'system-ui' }}>
                {latestScore.score}
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: scoreColor(latestScore.score) }}>{scoreLabel(latestScore.score)}</p>
              <div className="flex justify-center gap-2 mt-2 text-[10px] text-[#444]">
                <span>{latestScore.bureau}</span><span>·</span>
                <span>{fmtDate(latestScore.score_date)}</span>
                {latestScore.source && <><span>·</span><span>{latestScore.source}</span></>}
              </div>
            </>
          ) : (
            <p className="text-[#333] text-sm py-6">No scores logged yet — tap Log Score to start tracking</p>
          )}
        </Card>

        {latestScore && (
          <Card className="p-4">
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Score Range</p>
            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 25%, #f0a050 50%, #22c55e 80%)' }}>
              <div className="absolute top-0 w-3 h-3 rounded-full bg-white border-2 border-[#111] shadow-lg"
                style={{ left: `calc(${Math.min(Math.max((latestScore.score - 300) / 550, 0), 1) * 100}% - 6px)` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[9px] text-[#444]">
              <span>300 Poor</span><span>580</span><span>670</span><span>740</span><span>850 Exc.</span>
            </div>
          </Card>
        )}

        {accounts.length > 0 && (
          <div>
            <SectionLabel>Card Utilization</SectionLabel>
            <Card className="overflow-hidden">
              {accounts.map((acct, idx) => {
                const bal = parseFloat(String(acct.balance));
                const lim = parseFloat(String(acct.limit));
                const util = lim > 0 ? (bal / lim) * 100 : 0;
                const utilHigh = util > 30;
                return (
                  <div key={idx} className={`px-4 py-3 ${idx !== accounts.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm text-[#ccc] truncate flex-1 mr-2">{acct.name}</p>
                      <p className={`text-sm font-bold font-mono flex-shrink-0 ${utilHigh ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>{util.toFixed(1)}%</p>
                    </div>
                    <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${utilHigh ? 'bg-[#ef4444]' : 'bg-[#22c55e]'}`} style={{ width: `${Math.min(util, 100)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px] text-[#444]">
                      <span>{fmt(bal)} used</span><span>{fmt(lim)} limit</span>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {scores.length > 0 && (
          <div>
            <SectionLabel>Score History</SectionLabel>
            <Card className="overflow-hidden">
              {scores.map((score, idx) => (
                <div key={score.id}>
                  <div className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== scores.length - 1 || expandedId === score.id ? 'border-b border-[#1a1a1a]' : ''}`}
                    onClick={() => setExpandedId(expandedId === score.id ? null : score.id)}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: scoreColor(score.score) + '20' }}>
                      <span className="text-xs font-bold font-mono" style={{ color: scoreColor(score.score) }}>{score.score}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#ccc]">{score.bureau}</p>
                      <p className="text-[10px] text-[#444]">{fmtDate(score.score_date)}{score.source ? ` · ${score.source}` : ''}</p>
                    </div>
                    <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: scoreColor(score.score) }}>{scoreLabel(score.score)}</span>
                  </div>
                  {expandedId === score.id && (
                    <div className={`px-4 py-3 bg-[#0d0d0d] flex items-center gap-3 ${idx !== scores.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                      {score.notes ? <p className="flex-1 text-[11px] text-[#555] italic">{score.notes}</p> : <div className="flex-1" />}
                      <button onClick={() => setDeleteId(score.id)} className="text-xs font-semibold text-[#ef4444] active:opacity-70 px-3 py-2 rounded-lg bg-[#ef4444]/10">Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} message="This cannot be undone." />}
    </>
  );
}

// ─── HELOC Tab ────────────────────────────────────────────────────────────────

function HelocTab({ onRefresh }: { onRefresh: number }) {
  const [transactions, setTransactions] = useState<HelocTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/finance/heloc').then(r => r.json());
      setTransactions(data.transactions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4 animate-fadeIn">
      {transactions.length === 0 ? (
        <div className="text-center py-12 text-[#333] text-sm">
          <p>No HELOC transactions yet.</p>
          <p className="text-[11px] mt-1">Pull down to sync your latest data.</p>
        </div>
      ) : (
        <div>
          <SectionLabel>HELOC Transaction History</SectionLabel>
          <Card className="overflow-hidden">
            {transactions.map((tx, idx) => {
              const isIncome = tx.transaction_type === 'deposit';
              const color = isIncome ? '#22c55e' : '#888';
              return (
                <div key={tx.id} className={`flex items-center px-4 py-3 gap-3 ${idx !== transactions.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                  <div className="flex-shrink-0 w-16">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: color + '20', color }}>
                      {isIncome ? 'INCOME' : 'TRANSFER'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#ccc] truncate">{tx.description}</p>
                    <p className="text-[10px] text-[#444]">{fmtDate(tx.transaction_date)}</p>
                  </div>
                  <p className="text-sm font-semibold font-mono flex-shrink-0" style={{ color }}>{fmt(tx.amount)}</p>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────

function SubscriptionsTab({ onRefresh }: { onRefresh: number }) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/finance/subscriptions').then(r => r.json());
      setSubs(data.subscriptions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/finance/subscriptions?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false); setDeleteId(null); setExpandedId(null);
    load();
  }

  async function handleToggle(sub: Subscription) {
    setTogglingId(sub.id);
    await fetch(`/api/finance/subscriptions?id=${sub.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !sub.is_active }),
    });
    setTogglingId(null); load();
  }

  const activeSubs = subs.filter(s => s.is_active);
  const inactiveSubs = subs.filter(s => !s.is_active);
  const monthlyTotal = activeSubs.reduce((sum, s) => sum + monthlyEquiv(parseFloat(String(s.amount)), s.billing_cycle), 0);
  const annualTotal = monthlyTotal * 12;

  function SubRow({ sub }: { sub: Subscription }) {
    const monthly = monthlyEquiv(parseFloat(String(sub.amount)), sub.billing_cycle);
    const isExpanded = expandedId === sub.id;
    return (
      <div>
        <div className="flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors border-b border-[#1a1a1a]"
          onClick={() => setExpandedId(isExpanded ? null : sub.id)}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(sub.category) }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#ccc] truncate">{sub.name}</p>
            <p className="text-[10px] text-[#444]">{cycleLabel(sub.billing_cycle)}{sub.next_charge_date ? ` · next ${fmtDate(sub.next_charge_date)}` : ''}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold text-[#f0a050] font-mono">{fmt(parseFloat(String(sub.amount)))}</p>
            {sub.billing_cycle !== 'monthly' && <p className="text-[9px] text-[#444] font-mono">{fmt(monthly)}/mo</p>}
          </div>
        </div>
        {isExpanded && (
          <div className="px-4 py-3 bg-[#0d0d0d] flex items-center gap-3 border-b border-[#1a1a1a]">
            {sub.notes ? <p className="flex-1 text-[11px] text-[#555] italic truncate">{sub.notes}</p> : <div className="flex-1" />}
            <button onClick={() => handleToggle(sub)} disabled={togglingId === sub.id}
              className="text-xs font-semibold text-[#f0a050] active:opacity-70 px-3 py-2 rounded-lg bg-[#f0a050]/10 disabled:opacity-40">
              {togglingId === sub.id ? '…' : sub.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={() => setDeleteId(sub.id)} className="text-xs font-semibold text-[#ef4444] active:opacity-70 px-3 py-2 rounded-lg bg-[#ef4444]/10">Delete</button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <>
      <div className="space-y-4 animate-fadeIn">
        <Card className="p-4">
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Active Subscriptions</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[10px] text-[#444] mb-0.5">Monthly</p><p className="text-base font-bold text-[#f0a050] font-mono">{fmt(monthlyTotal)}</p></div>
            <div><p className="text-[10px] text-[#444] mb-0.5">Annual</p><p className="text-base font-bold text-white font-mono">{fmt(annualTotal)}</p></div>
            <div><p className="text-[10px] text-[#444] mb-0.5">Count</p><p className="text-base font-bold text-white">{activeSubs.length}</p></div>
          </div>
        </Card>
        {subs.length === 0 ? (
          <div className="text-center py-12 text-[#333] text-sm">No subscriptions logged — tap Add Sub to start</div>
        ) : (
          <>
            {activeSubs.length > 0 && <div><SectionLabel>Active</SectionLabel><Card className="overflow-hidden">{activeSubs.map(sub => <SubRow key={sub.id} sub={sub} />)}</Card></div>}
            {inactiveSubs.length > 0 && <div><SectionLabel>Inactive</SectionLabel><Card className="overflow-hidden">{inactiveSubs.map(sub => <SubRow key={sub.id} sub={sub} />)}</Card></div>}
          </>
        )}
      </div>
      {deleteId && <DeleteSheet onCancel={() => setDeleteId(null)} onConfirm={handleDelete} deleting={deleting} message="This cannot be undone." />}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function FinancePageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [refreshCount, setRefreshCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // ── Add Transaction modal ────────────────────────────────────────────────
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState<TxType>('expense');
  const [txForm, setTxForm] = useState({ date: '', merchant: '', account: '', amount: '', category: '' });
  const [txToAccount, setTxToAccount] = useState('');
  const [txSaving, setTxSaving] = useState(false);
  const [txError, setTxError] = useState('');

  // ── Log Score modal ──────────────────────────────────────────────────────
  const [showAddScore, setShowAddScore] = useState(false);
  const [scoreForm, setScoreForm] = useState({ date: '', score: '', bureau: 'Experian', source: 'Credit Karma', notes: '' });
  const [scoreSaving, setScoreSaving] = useState(false);
  const [scoreError, setScoreError] = useState('');

  // ── Add Subscription modal ───────────────────────────────────────────────
  const [showAddSub, setShowAddSub] = useState(false);
  const [subForm, setSubForm] = useState({ name: '', amount: '', billing_cycle: 'monthly', next_charge_date: '', category: 'Subscriptions', notes: '' });
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState('');

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });

  function resetTxModal() {
    setTxType('expense');
    setTxForm({ date: today, merchant: '', account: '', amount: '', category: '' });
    setTxToAccount('');
    setTxError('');
  }

  function cycleTxType() {
    setTxType(t => t === 'expense' ? 'transfer' : t === 'transfer' ? 'income' : 'expense');
  }

  async function handleAddTransaction() {
    setTxError('');
    if (!txForm.date || !txForm.account || !txForm.amount) {
      setTxError('Date, account, and amount are required.'); return;
    }
    if (!txForm.merchant && txType !== 'transfer') {
      setTxError('Merchant is required.'); return;
    }
    if (txType === 'transfer' && !txToAccount) {
      setTxError('To Account is required for transfers.'); return;
    }
    if (txType !== 'transfer' && !txForm.category) {
      setTxError('Category is required.'); return;
    }
    setTxSaving(true);
    try {
      const rawAmt = Math.abs(parseFloat(txForm.amount));
      let signedAmount: number;
      if (txType === 'transfer') {
        signedAmount = rawAmt;
      } else if (INCOME_CATEGORIES.includes(txForm.category)) {
        signedAmount = rawAmt;
      } else {
        signedAmount = txType === 'expense' ? -rawAmt : rawAmt;
      }

      const payload: Record<string, unknown> = { ...txForm, amount: signedAmount };
      if (txType === 'transfer') {
        payload.toAccount = txToAccount;
        payload.category = 'Transfer';
      }

      const res = await fetch('/api/finance/transactions/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({ error: 'Failed to save' })); throw new Error(d.error || 'Failed to save'); }
      setShowAddTx(false);
      resetTxModal();
      try { Object.keys(localStorage).filter(k => k.startsWith('finance_')).forEach(k => localStorage.removeItem(k)); } catch {}
      setRefreshCount(c => c + 1);
      syncSheets().then(() => setRefreshCount(c => c + 1));
    } catch (e: unknown) { setTxError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setTxSaving(false); }
  }

  async function handleAddScore() {
    setScoreError('');
    if (!scoreForm.score || !scoreForm.date) { setScoreError('Score and date are required.'); return; }
    setScoreSaving(true);
    try {
      const res = await fetch('/api/finance/credit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoreForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setShowAddScore(false);
      setScoreForm({ date: today, score: '', bureau: 'Experian', source: 'Credit Karma', notes: '' });
      setRefreshCount(c => c + 1);
    } catch (e: unknown) { setScoreError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setScoreSaving(false); }
  }

  async function handleAddSub() {
    setSubError('');
    if (!subForm.name || !subForm.amount || !subForm.billing_cycle) { setSubError('Name, amount, and billing cycle are required.'); return; }
    setSubSaving(true);
    try {
      const res = await fetch('/api/finance/subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setShowAddSub(false);
      setSubForm({ name: '', amount: '', billing_cycle: 'monthly', next_charge_date: '', category: 'Subscriptions', notes: '' });
      setRefreshCount(c => c + 1);
    } catch (e: unknown) { setSubError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setSubSaving(false); }
  }

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    await syncSheets();
    setSyncing(false);
    setRefreshCount(c => c + 1);
  }, []);

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center bg-black"><Spinner /></div>;
  if (!session) return <div className="min-h-screen flex items-center justify-center bg-black"><p className="text-[#555]">Please sign in</p></div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'budget', label: 'Budget' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'bills', label: 'Bills' },
    { id: 'networth', label: 'Net Worth' },
    { id: 'credit', label: 'Credit' },
    { id: 'heloc', label: 'HELOC' },
    { id: 'subscriptions', label: 'Subscriptions' },
  ];

  const headerButtonLabel =
    activeTab === 'transactions' ? 'Log Tx' :
    activeTab === 'credit' ? 'Log Score' :
    activeTab === 'subscriptions' ? 'Add Sub' : 'Sync';

  const txTypeMeta: Record<TxType, { label: string; bg: string; text: string }> = {
    expense:  { label: '− Expense',  bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]' },
    transfer: { label: '⇄ Transfer', bg: 'bg-[#888]/20',    text: 'text-[#888]'    },
    income:   { label: '+ Income',   bg: 'bg-[#22c55e]/20', text: 'text-[#22c55e]' },
  };
  const meta = txTypeMeta[txType];

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden select-none">

      {/* Header */}
      <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 z-30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white">Finance</h1>
            {syncing && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#f0a050] mt-0.5">
                <div className="w-2.5 h-2.5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
                Syncing…
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(8);
              if (activeTab === 'transactions') { resetTxModal(); setShowAddTx(true); }
              else if (activeTab === 'credit') { setScoreForm(f => ({ ...f, date: today })); setShowAddScore(true); }
              else if (activeTab === 'subscriptions') { setShowAddSub(true); }
              else { handleRefresh(); }
            }}
            className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
          >
            {headerButtonLabel}
          </button>
        </div>
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id ? 'border-[#f0a050] text-[#f0a050]' : 'border-transparent text-[#555]'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden relative bg-black">
        {activeTab === 'transactions' ? (
          <div className="h-full px-4 pt-4">
            <TransactionsTab onRefresh={refreshCount} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-4 pt-4 pb-24 scrollbar-hide">
            <PullToRefresh onRefresh={handleRefresh}>
              {activeTab === 'overview' && <OverviewTab onRefresh={refreshCount} onNavigateRow={id => setActiveTab(id)} />}
              {activeTab === 'budget' && <BudgetTab onRefresh={refreshCount} />}
              {activeTab === 'bills' && <BillsTab onRefresh={refreshCount} />}
              {activeTab === 'networth' && <NetWorthTab onRefresh={refreshCount} />}
              {activeTab === 'credit' && <CreditTab onRefresh={refreshCount} />}
              {activeTab === 'heloc' && <HelocTab onRefresh={refreshCount} />}
              {activeTab === 'subscriptions' && <SubscriptionsTab onRefresh={refreshCount} />}
            </PullToRefresh>
          </div>
        )}
      </div>

      {/* ── Add Transaction Modal ────────────────────────────────── */}
      {showAddTx && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddTx(false)}>
          <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
              <button onClick={() => setShowAddTx(false)} className="text-[#f0a050] text-sm">Cancel</button>
              <h2 className="text-base font-semibold text-white">New Transaction</h2>
              <button onClick={handleAddTransaction} disabled={txSaving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-40">
                {txSaving ? 'Saving…' : 'Add'}
              </button>
            </div>
            <div className="px-4 pt-4 space-y-3">

              {/* Date + Description/Merchant */}
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Date</span>
                  <input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none" />
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">{txType === 'transfer' ? 'Description' : 'Merchant'}</span>
                  <input type="text" placeholder={txType === 'transfer' ? 'Optional label' : 'Name'} value={txForm.merchant}
                    onChange={e => setTxForm(f => ({ ...f, merchant: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>

              {/* Amount + Type toggle */}
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Amount</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <button onClick={cycleTxType}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${meta.bg} ${meta.text}`}>
                      {meta.label}
                    </button>
                    <input type="number" placeholder="0.00" step="0.01" value={txForm.amount}
                      onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-28 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                  </div>
                </div>
              </div>

              {/* Accounts + Category */}
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">{txType === 'transfer' ? 'From' : 'Account'}</span>
                  <select value={txForm.account} onChange={e => setTxForm(f => ({ ...f, account: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e]">
                    <option value="" className="bg-[#2c2c2e]">Select…</option>
                    {ACCOUNTS.map(a => <option key={a} value={a} className="bg-[#2c2c2e]">{a}</option>)}
                  </select>
                </div>

                {txType === 'transfer' && (
                  <div className="flex items-center px-4 py-3 border-b border-white/10">
                    <span className="text-sm text-[#888] w-24 flex-shrink-0">To</span>
                    <select value={txToAccount} onChange={e => setTxToAccount(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e]">
                      <option value="" className="bg-[#2c2c2e]">Select…</option>
                      {ACCOUNTS.filter(a => a !== txForm.account).map(a => <option key={a} value={a} className="bg-[#2c2c2e]">{a}</option>)}
                    </select>
                  </div>
                )}

                {txType !== 'transfer' && (
                  <div className="flex items-center px-4 py-3">
                    <span className="text-sm text-[#888] w-24 flex-shrink-0">Category</span>
                    <select value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                      className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e]">
                      <option value="" className="bg-[#2c2c2e]">Select…</option>
                      {CATEGORIES_LIST.map(c => <option key={c} value={c} className="bg-[#2c2c2e]">{c}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {txType === 'transfer' && (
                <p className="text-[10px] text-[#444] px-1">Creates two entries — debit on From, credit on To. Both saved as Transfer.</p>
              )}
              {txError && <p className="text-[#ef4444] text-xs px-1 font-mono">{txError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Log Score Modal ──────────────────────────────────────── */}
      {showAddScore && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddScore(false)}>
          <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
              <button onClick={() => setShowAddScore(false)} className="text-[#f0a050] text-sm">Cancel</button>
              <h2 className="text-base font-semibold text-white">Log Credit Score</h2>
              <button onClick={handleAddScore} disabled={scoreSaving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-40">
                {scoreSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className="px-4 pt-4 space-y-3">
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Date</span>
                  <input type="date" value={scoreForm.date} onChange={e => setScoreForm(f => ({ ...f, date: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none" />
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Score</span>
                  <input type="number" placeholder="750" min="300" max="850" value={scoreForm.score}
                    onChange={e => setScoreForm(f => ({ ...f, score: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Bureau</span>
                  <select value={scoreForm.bureau} onChange={e => setScoreForm(f => ({ ...f, bureau: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e]">
                    <option value="Experian" className="bg-[#2c2c2e]">Experian</option>
                    <option value="Equifax" className="bg-[#2c2c2e]">Equifax</option>
                    <option value="TransUnion" className="bg-[#2c2c2e]">TransUnion</option>
                  </select>
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Source</span>
                  <input type="text" placeholder="Credit Karma, Experian app…" value={scoreForm.source}
                    onChange={e => setScoreForm(f => ({ ...f, source: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Notes</span>
                  <input type="text" placeholder="Optional" value={scoreForm.notes}
                    onChange={e => setScoreForm(f => ({ ...f, notes: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              {scoreError && <p className="text-[#ef4444] text-xs px-1 font-mono">{scoreError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Subscription Modal ───────────────────────────────── */}
      {showAddSub && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddSub(false)}>
          <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 bg-[#1c1c1e] z-10">
              <button onClick={() => setShowAddSub(false)} className="text-[#f0a050] text-sm">Cancel</button>
              <h2 className="text-base font-semibold text-white">New Subscription</h2>
              <button onClick={handleAddSub} disabled={subSaving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-40">
                {subSaving ? 'Saving…' : 'Add'}
              </button>
            </div>
            <div className="px-4 pt-4 space-y-3">
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Name</span>
                  <input type="text" placeholder="Netflix, Spotify…" value={subForm.name}
                    onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Amount</span>
                  <input type="number" placeholder="0.00" step="0.01" value={subForm.amount}
                    onChange={e => setSubForm(f => ({ ...f, amount: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Cycle</span>
                  <select value={subForm.billing_cycle} onChange={e => setSubForm(f => ({ ...f, billing_cycle: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e]">
                    <option value="monthly" className="bg-[#2c2c2e]">Monthly</option>
                    <option value="annual" className="bg-[#2c2c2e]">Annual</option>
                    <option value="quarterly" className="bg-[#2c2c2e]">Quarterly</option>
                    <option value="weekly" className="bg-[#2c2c2e]">Weekly</option>
                  </select>
                </div>
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Next Charge</span>
                  <input type="date" value={subForm.next_charge_date}
                    onChange={e => setSubForm(f => ({ ...f, next_charge_date: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none" />
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Category</span>
                  <select value={subForm.category} onChange={e => setSubForm(f => ({ ...f, category: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none bg-[#2c2c2e]">
                    {CATEGORIES_LIST.map(c => <option key={c} value={c} className="bg-[#2c2c2e]">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Notes</span>
                  <input type="text" placeholder="Optional" value={subForm.notes}
                    onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              {subError && <p className="text-[#ef4444] text-xs px-1 font-mono">{subError}</p>}
            </div>
          </div>
        </div>
      )}

      <BottomNav active="finance" />
    </div>
  );
}

export default function FinancePage() {
  return (
    <Suspense fallback={null}>
      <FinancePageInner />
    </Suspense>
  );
}