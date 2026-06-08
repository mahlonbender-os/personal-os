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

type Tab = 'overview' | 'budget' | 'transactions' | 'bills' | 'networth';

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v6'; // Increment to bust localized stale caches
const AMBER = '#f0a050';
const GREEN = '#22c55e';
const RED = '#ef4444';

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

const INCOME_CATEGORIES = ['Income', 'Other Inc.', 'Roth IRA', '401K', 'HSA'];

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
      {/* Net Worth hero layout block */}
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

      {/* Cash Flow */}
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

      {/* Bills due soon */}
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

      {/* Recent Transactions */}
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
                <p className={`text-sm font-semibold flex-shrink-0 font-mono ${INCOME_CATEGORIES.includes(tx.category) ? 'text-[#22c55e]' : tx.category === 'Transfer' ? 'text-[#888]' : 'text-[#ef4444]'}`}>{fmt(tx.amount)}</p>
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
        // Build chronological historical graph tracking backward from selected month point
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
        <SectionLabel>Historical Cash Flow Trends</SectionLabel>
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
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span>Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
              <span>Expenses</span>
            </div>
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
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setLoading(false);
    }
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
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {/* Local scroll containment framework */}
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
                            {tx.category}
                          </span>
                          <span className="text-[10px] text-[#444] flex-shrink-0">{fmtDate(tx.date)}</span>
                          {tx.account && <span className="text-[10px] text-[#333] truncate min-w-0">{tx.account}</span>}
                        </div>
                      </div>
                      <p className={`text-sm font-semibold flex-shrink-0 ml-2 font-mono ${INCOME_CATEGORIES.includes(tx.category) ? 'text-[#22c55e]' : tx.category === 'Transfer' ? 'text-[#888]' : 'text-[#ef4444]'}`}>{fmt(tx.amount)}</p>
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

function NetWorthTab({ onRefresh }: { onRefresh: number }) {
  const [data, setData] = useState<{ accounts: NetWorthAccount[]; totalAssets: number; totalLiabilities: number; netWorth: number; history?: NetWorthSnapshot[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await fetch('/api/finance/net-worth').then(r => r.json());
      if (d.error) throw new Error(d.error);
      setData(d);
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

  function NetWorthSparkline() {
    if (historyList.length < 2) return null;
    
    const values = historyList.map(h => h.net_worth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min === 0 ? 1 : max - min;

    const width = 340;
    const height = 80;
    const padding = 10;
    
    const points = historyList.map((h, i) => {
      const x = padding + (i / (historyList.length - 1)) * (width - padding * 2);
      const y = (height - padding) - ((h.net_worth - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');

    return (
      <div>
        <SectionLabel>Net Worth Trajectory Baseline</SectionLabel>
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
              <div key={idx} className={`flex items-center px-4 py-3 gap-3 ${idx !== assets.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                <div className="w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0" />
                <p className="flex-1 text-sm text-[#ccc]">{acct.name}</p>
                <p className="text-sm font-semibold text-[#22c55e] font-mono">{fmt(acct.value)}</p>
              </div>
            ))}
          </Card>
        </div>
      )}

      {liabilities.length > 0 && (
        <div>
          <SectionLabel>Liabilities</SectionLabel>
          <Card className="overflow-hidden">
            {liabilities.map((acct, idx) => (
              <div key={idx} className={`flex items-center px-4 py-3 gap-3 ${idx !== liabilities.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                <div className="w-2 h-2 rounded-full bg-[#ef4444] flex-shrink-0" />
                <p className="flex-1 text-sm text-[#ccc]">{acct.name}</p>
                <p className="text-sm font-semibold text-[#ef4444] font-mono">{fmt(acct.value)}</p>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
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
  const [showAddTx, setShowAddTx] = useState(false);
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().split('T')[0],
    merchant: '', account: '', amount: '', category: '',
  });
  const [txSaving, setTxSaving] = useState(false);
  const [txError, setTxError] = useState('');

  async function handleAddTransaction() {
    setTxError('');
    if (!txForm.date || !txForm.merchant || !txForm.account || !txForm.amount || !txForm.category) {
      setTxError('All fields are required.'); return;
    }
    setTxSaving(true);
    try {
      const res = await fetch('/api/finance/transactions/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txForm),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(errData.error || 'Failed to save');
      }

      setShowAddTx(false);
      setTxForm({ date: new Date().toISOString().split('T')[0], merchant: '', account: '', amount: '', category: '' });

      try { Object.keys(localStorage).filter(k => k.startsWith('finance_')).forEach(k => localStorage.removeItem(k)); } catch {}
      setRefreshCount(c => c + 1);

      syncSheets().then(() => setRefreshCount(c => c + 1));

    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
    finally { setTxSaving(false); }
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
  ];

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden select-none">
      {/* Header element - locked to top */}
      <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 z-30">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">Finance</h1>
          {syncing && (
            <div className="flex items-center gap-1.5 text-[10px] text-[#f0a050]">
              <div className="w-3 h-3 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
              Syncing…
            </div>
          )}
        </div>
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id ? 'border-[#f0a050] text-[#f0a050]' : 'border-transparent text-[#555]'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Structured tab rendering block preventing endless scrolling loops */}
      <div className="flex-1 overflow-hidden relative bg-black">
        {activeTab === 'transactions' ? (
          // Transactions logs run separate full-viewport scroll metrics
          <div className="h-full px-4 pt-4">
            <TransactionsTab onRefresh={refreshCount} />
          </div>
        ) : (
          // Static layout blocks remain fully encapsulated inside pull-to-refresh
          <div className="h-full overflow-y-auto px-4 pt-4 pb-24 scrollbar-hide">
            <PullToRefresh onRefresh={handleRefresh}>
              {activeTab === 'overview' && <OverviewTab onRefresh={refreshCount} onNavigateRow={id => setActiveTab(id)} />}
              {activeTab === 'budget' && <BudgetTab onRefresh={refreshCount} />}
              {activeTab === 'bills' && <BillsTab onRefresh={refreshCount} />}
              {activeTab === 'networth' && <NetWorthTab onRefresh={refreshCount} />}
            </PullToRefresh>
          </div>
        )}
      </div>

      {/* FAB */}
      {activeTab === 'transactions' && (
        <button onClick={() => setShowAddTx(true)}
          className="fixed z-40 w-14 h-14 rounded-full bg-[#f0a050] text-black text-3xl font-light shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)', right: '20px' }}>
          +
        </button>
      )}

      {/* Add Transaction Modal wrapper */}
      {showAddTx && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAddTx(false)}>
          <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto pb-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
              <button onClick={() => setShowAddTx(false)} className="text-[#f0a050] text-sm">Cancel</button>
              <h2 className="text-base font-semibold text-white">New Transaction</h2>
              <button onClick={handleAddTransaction} disabled={txSaving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-40">
                {txSaving ? 'Saving…' : 'Add'}
              </button>
            </div>
            <div className="px-4 pt-4 space-y-3">
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Date</span>
                  <input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none" />
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Merchant</span>
                  <input type="text" placeholder="Name" value={txForm.merchant} onChange={e => setTxForm(f => ({ ...f, merchant: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Amount</span>
                  <input type="number" placeholder="0.00" step="0.01" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Account</span>
                  <select value={txForm.account} onChange={e => setTxForm(f => ({ ...f, account: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none">
                    <option value="" className="bg-[#2c2c2e]">Select…</option>
                    {ACCOUNTS.map(a => <option key={a} className="bg-[#2c2c2e]">{a}</option>)}
                  </select>
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Category</span>
                  <select value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none appearance-none">
                    <option value="" className="bg-[#2c2c2e]">Select…</option>
                    {CATEGORIES_LIST.map(c => <option key={c} className="bg-[#2c2c2e]">{c}</option>)}
                  </select>
                </div>
              </div>
              {txError && <p className="text-[#ef4444] text-xs px-1">{txError}</p>}
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