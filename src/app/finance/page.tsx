'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';
import SwipeTabs from '@/components/SwipeTabs';

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

type Tab = 'overview' | 'budget' | 'transactions' | 'bills' | 'networth';

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v3';
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

function Divider() { return <div className="h-px bg-[#1a1a1a]" />; }

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ onRefresh, onNavigate }: { onRefresh: number; onNavigate: (tab: Tab) => void }) {
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
    <div className="space-y-4">
      {/* Net Worth hero */}
      <button className="w-full text-left active:opacity-70 transition-opacity" onClick={() => onNavigate('networth')}>
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
      </button>

      {/* Cash Flow */}
      {cashFlow && (
        <button className="w-full text-left active:opacity-70 transition-opacity" onClick={() => onNavigate('budget')}>
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
        </button>
      )}

      {/* Bills due soon */}
      {dueSoon.length > 0 && (
        <button className="w-full text-left active:opacity-70 transition-opacity" onClick={() => onNavigate('bills')}>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Bills Due Soon</p>
              <p className="text-[9px] text-[#f0a050]">See all →</p>
            </div>
            <p className="text-xl font-bold text-[#f0a050] font-mono">{fmt(dueTotal)}</p>
            <p className="text-[10px] text-[#444]">{dueSoon.length} bill{dueSoon.length !== 1 ? 's' : ''} in next 7 days</p>
          </Card>
        </button>
      )}

      {/* Recent Transactions */}
      <Card className="overflow-hidden">
        <button className="w-full px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between active:bg-[#161616]" onClick={() => onNavigate('transactions')}>
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Recent Transactions</p>
          <p className="text-[9px] text-[#f0a050]">See all →</p>
        </button>
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
                <p className={`text-sm font-semibold flex-shrink-0 font-mono ${INCOME_CATEGORIES.includes(tx.category) ? 'text-[#22c55e]' : tx.category === 'Transfer' ? 'text-[#888]' : 'text-[#ef4444]`}>{fmt(tx.amount)}</p>
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  const incomeItems = items.filter(i => i.section === 'income');
  const essentialItems = items.filter(i => i.section === 'essentials');
  const discretionaryItems = items.filter(i => i.section === 'discretionary');

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
                <div className={`h-full rounded-full transition-all ${isIncome ? item.percent >= 100 ? 'bg-[#22c55e]' : 'bg-[#22c55e]/70' : item.percent >= 100 ? 'bg-[#ef4444]' : item.percent >= 80 ? 'bg-[#f59e0b]' : ''}`}
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
    <div className="space-y-4">
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
    try {
      const cached = localStorage.getItem(`finance_transactions_${CACHE_VERSION}`);
      if (cached) { setTransactions(JSON.parse(cached)); setLoading(false); }
    } catch {}
    try {
      const data = await fetch('/api/finance/transactions?limit=300').then(r => r.json());
      const txs = data.transactions || [];
      setTransactions(txs);
      try { localStorage.setItem(`finance_transactions_${CACHE_VERSION}`, JSON.stringify(txs)); } catch {}
    } finally { setLoading(false); }
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
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333] text-sm">🔍</span>
        <input type="text" placeholder="Search transactions…" value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#111] border border-[#1a1a1a] text-sm text-[#ccc] placeholder-[#333] outline-none focus:ring-1 focus:ring-[#f0a050]" />
      </div>

      {/* Category filter */}
      <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-[#111] border border-[#1a1a1a] text-sm text-[#ccc] outline-none focus:ring-1 focus:ring-[#f0a050]">
        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#333] text-sm">{transactions.length === 0 ? 'Pull down to sync data' : 'No results'}</div>
      ) : (
        <div className="space-y-4">
          {sortedMonths.map(monthKey => {
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
          })}
        </div>
      )}
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
      const bl = data.bills || [];
      setBills(bl);
      try { localStorage.setItem(`finance_bills_${CACHE_VERSION}`, JSON.stringify(bl)); } catch {}
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
    <div className="space-y-4">
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
  const [data, setData] = useState<{ accounts: NetWorthAccount[]; totalAssets: number; totalLiabilities: number; netWorth: number } | null>(null);
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

  return (
    <div className="space-y-4">
      {/* Hero card */}
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
      if (!res.ok) throw new Error('Failed to save');
      setShowAddTx(false);
      setTxForm({ date: new Date().toISOString().split('T')[0], merchant: '', account: '', amount: '', category: '' });
      await syncSheets();
      setRefreshCount(c => c + 1);
    } catch { setTxError('Something went wrong. Try again.'); }
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
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="px-4 pt-14 pb-0">
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
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        <SwipeTabs tabs={tabs} activeTab={activeTab} onTabChange={id => setActiveTab(id as Tab)}>
          {tabs.map(tab => (
            <div key={tab.id} className="px-4 py-4 pb-28">
              {tab.id === 'overview' && <OverviewTab onRefresh={refreshCount} onNavigate={id => setActiveTab(id as Tab)} />}
              {tab.id === 'budget' && <BudgetTab onRefresh={refreshCount} />}
              {tab.id === 'transactions' && <TransactionsTab onRefresh={refreshCount} />}
              {tab.id === 'bills' && <BillsTab onRefresh={refreshCount} />}
              {tab.id === 'networth' && <NetWorthTab onRefresh={refreshCount} />}
            </div>
          ))}
        </SwipeTabs>
      </PullToRefresh>

      {/* FAB */}
      {activeTab === 'transactions' && (
        <button onClick={() => setShowAddTx(true)}
          className="fixed z-40 w-14 h-14 rounded-full bg-[#f0a050] text-black text-3xl font-light shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)', right: '20px' }}>
          +
        </button>
      )}

      {/* Add Transaction Modal */}
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
              {/* Date + Merchant */}
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
              {/* Amount */}
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Amount</span>
                  <input type="number" placeholder="0.00" step="0.01" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              {/* Account + Category */}
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