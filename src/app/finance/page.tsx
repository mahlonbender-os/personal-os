'use client';

import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';
import SwipeTabs from '@/components/SwipeTabs';
import { useState, useEffect, useCallback, Suspense, useRef } from 'react';

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

// ─── Category Config ──────────────────────────────────────────────────────────

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
  Income: '#10b981',
  Bree: '#f43f5e',
  HSA: '#06b6d4',
  'Roth IRA': '#8b5cf6',
  '401K': '#6366f1',
  'Other Exp.': '#94a3b8',
  'Other Inc.': '#34d399',
};

const INCOME_CATEGORIES = ['Income', 'Other Inc.', 'Roth IRA', '401K', 'HSA'];

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || '#94a3b8';
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate2(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function monthLabel(key: string): string {
  if (!key) return '';
  const [y, m] = key.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// ─── Sync function ────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v3';

async function syncSheets(): Promise<void> {
  await fetch('/api/sync/sheets', { method: 'POST' });
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('finance_'));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

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
        fetch('/api/finance/cash-flow'),
        fetch('/api/finance/net-worth'),
        fetch('/api/finance/transactions?limit=5'),
        fetch('/api/finance/bills'),
      ]);
      const [cfData, nwData, txData, blData] = await Promise.all([
        cfRes.json(), nwRes.json(), txRes.json(), blRes.json(),
      ]);

      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long' });
      const currentMonthData = cfData.months?.find((m: { month: string }) =>
        m.month.toLowerCase().includes(monthName.toLowerCase())
      );
      const cf = currentMonthData ? {
        income: currentMonthData.income,
        expenses: currentMonthData.essentials + currentMonthData.discretionary,
        net: currentMonthData.net,
      } : null;
      if (cf) setCashFlow(cf);
      setNetWorth(nwData);
      setRecentTx(txData.transactions || []);
      setBills(blData.bills || []);

      try {
        localStorage.setItem(`finance_overview_${CACHE_VERSION}`, JSON.stringify({
          cf, nw: nwData, tx: txData.transactions || [], bl: blData.bills || [],
        }));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  // Bills due within 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);
  const upcomingBills = bills.filter((b) => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date + 'T00:00:00');
    return d <= in7Days;
  });
  const upcomingTotal = upcomingBills.reduce((s, b) => s + Math.abs(b.amount), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Net Worth Card */}
      <button
        className="w-full text-left active:scale-[0.98] transition-transform"
        onClick={() => onNavigate('networth')}
      >
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 p-5 text-white shadow-lg">
          <p className="text-blue-200 text-sm font-medium mb-1">Net Worth</p>
          <p className="text-3xl font-bold tracking-tight">
            {netWorth ? formatCurrency(netWorth.netWorth) : '—'}
          </p>
          {netWorth && (
            <div className="flex gap-4 mt-3 text-sm text-blue-100">
              <span>Assets {formatCurrency(netWorth.totalAssets)}</span>
              <span>·</span>
              <span>Liabilities {formatCurrency(netWorth.totalLiabilities)}</span>
            </div>
          )}
        </div>
      </button>

      {/* Cash Flow Card */}
      {cashFlow && (
        <button
          className="w-full text-left active:scale-[0.98] transition-transform"
          onClick={() => onNavigate('budget')}
        >
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              This Month
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Income</p>
                <p className="text-base font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(cashFlow.income)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Expenses</p>
                <p className="text-base font-bold text-red-500 dark:text-red-400">
                  {formatCurrency(cashFlow.expenses)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Net</p>
                <p className={`text-base font-bold ${cashFlow.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {formatCurrency(Math.abs(cashFlow.net))}
                </p>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Upcoming Bills */}
      {upcomingBills.length > 0 && (
        <button
          className="w-full text-left active:scale-[0.98] transition-transform"
          onClick={() => onNavigate('bills')}
        >
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Bills Due Soon
              </p>
              <p className="text-xs text-blue-500">See all →</p>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(upcomingTotal)}</p>
            <p className="text-xs text-gray-400">{upcomingBills.length} bill{upcomingBills.length !== 1 ? 's' : ''} in next 7 days</p>
          </div>
        </button>
      )}

      {/* Recent Transactions */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <button
          className="w-full px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-700/50"
          onClick={() => onNavigate('transactions')}
        >
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Recent Transactions
          </p>
          <p className="text-xs text-blue-500">See all →</p>
        </button>
        {recentTx.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Pull down to sync latest data</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center px-4 py-3 gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(tx.category) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.merchant}</p>
                  <p className="text-xs text-gray-400">{tx.category} · {formatDate(tx.date)}</p>
                </div>
                <p className={`text-sm font-semibold flex-shrink-0 ${INCOME_CATEGORIES.includes(tx.category) ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}`}>
                  {formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Budget Tab ────────────────────────────────────────────────────────────────

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
    setLoading(true);
    setError(null);
    try {
      const url = month ? `/api/finance/budget?month=${month}` : '/api/finance/budget';
      const res = await fetch(url);
      const data = await res.json();
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  const incomeItems = items.filter((i) => i.section === 'income');
  const expenseItems = items.filter((i) => i.section !== 'income');

  function Section({
    title,
    rows,
    totalBudget,
    totalActual,
  }: {
    title: string;
    rows: BudgetItem[];
    totalBudget: number;
    totalActual: number;
  }) {
    const percent = totalBudget > 0 ? Math.min(Math.round((totalActual / totalBudget) * 100), 100) : 0;
    const isIncome = title === 'Income';

    return (
      <div>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="text-xs text-gray-400">
            {formatCurrency(totalActual)} / {formatCurrency(totalBudget)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
          {rows.map((item, idx) => (
            <div
              key={item.category}
              className={`px-4 py-3 ${idx !== rows.length - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: categoryColor(item.category) }}
                  />
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.category}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {formatCurrency(item.actual)}
                    <span className="text-xs text-gray-400 font-normal"> / {formatCurrency(item.budget)}</span>
                  </p>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isIncome
                      ? item.percent >= 100 ? 'bg-green-500' : 'bg-green-400'
                      : item.percent >= 100 ? 'bg-red-500'
                      : item.percent >= 80 ? 'bg-orange-400'
                      : ''
                  }`}
                  style={{
                    width: `${Math.min(item.percent, 100)}%`,
                    backgroundColor: (!isIncome && item.percent < 80) ? categoryColor(item.category) : undefined,
                  }}
                />
              </div>
              {!isIncome && item.over > 0 && (
                <p className="text-xs text-red-500 mt-0.5">{formatCurrency(item.over)} over</p>
              )}
            </div>
          ))}
          {/* Section total bar */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  isIncome
                    ? 'bg-green-500'
                    : percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-orange-400' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-400">{percent}% used</p>
              <p className={`text-xs font-medium ${
                isIncome
                  ? totalActual >= totalBudget ? 'text-green-600' : 'text-gray-400'
                  : totalActual > totalBudget ? 'text-red-500' : 'text-green-600'
              }`}>
                {isIncome
                  ? totalActual >= totalBudget
                    ? `${formatCurrency(totalActual - totalBudget)} extra`
                    : `${formatCurrency(totalBudget - totalActual)} remaining`
                  : totalActual > totalBudget
                    ? `${formatCurrency(totalActual - totalBudget)} over`
                    : `${formatCurrency(totalBudget - totalActual)} left`
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month selector + Cash Flow summary */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {selectedMonth === currentMonth ? 'This Month' : monthLabel(selectedMonth)}
          </p>
          <select
            value={selectedMonth}
            onChange={(e) => load(e.target.value)}
            className="text-xs text-blue-500 bg-transparent border-none outline-none cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">Income</p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalIncomeActual)}
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-500">/ {formatCurrency(totalIncomeBudget)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">Expenses</p>
            <p className="text-sm font-bold text-red-500 dark:text-red-400">
              {formatCurrency(totalExpenseActual)}
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-500">/ {formatCurrency(totalExpenseBudget)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">Cash Flow</p>
            <p className={`text-sm font-bold ${actualCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {formatCurrency(Math.abs(actualCashFlow))}
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-500">/ {formatCurrency(Math.abs(projectedCashFlow))}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 p-4 text-sm text-red-600">
          {error} — pull down to refresh
        </div>
      ) : (
        <>
          <Section
            title="Income"
            rows={incomeItems}
            totalBudget={totalIncomeBudget}
            totalActual={totalIncomeActual}
          />
          <Section
            title="Essentials"
            rows={expenseItems.filter((i) => i.section === 'essentials')}
            totalBudget={expenseItems.filter((i) => i.section === 'essentials').reduce((s, i) => s + i.budget, 0)}
            totalActual={expenseItems.filter((i) => i.section === 'essentials').reduce((s, i) => s + i.actual, 0)}
          />
          <Section
            title="Discretionary"
            rows={expenseItems.filter((i) => i.section === 'discretionary')}
            totalBudget={expenseItems.filter((i) => i.section === 'discretionary').reduce((s, i) => s + i.budget, 0)}
            totalActual={expenseItems.filter((i) => i.section === 'discretionary').reduce((s, i) => s + i.actual, 0)}
          />
        </>
      )}
    </div>
  );
}

// ── Transactions Tab ──────────────────────────────────────────────────────────

function TransactionsTab({ onRefresh }: { onRefresh: number }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const cached = localStorage.getItem(`finance_transactions_${CACHE_VERSION}`);
      if (cached) {
        setTransactions(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}

    try {
      const res = await fetch('/api/finance/transactions?limit=300');
      const data = await res.json();
      const txs = data.transactions || [];
      setTransactions(txs);
      try { localStorage.setItem(`finance_transactions_${CACHE_VERSION}`, JSON.stringify(txs)); } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSearchQuery('');
    setSelectedCategory('All');
    load();
  }, [load, onRefresh]);

  const categories = ['All', ...Array.from(new Set(transactions.map((t) => t.category))).sort()];

  const filtered = transactions.filter((tx) => {
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

  function monthTotal(txs: Transaction[]): number {
    return txs.reduce((sum, tx) =>
      INCOME_CATEGORIES.includes(tx.category) ? sum + tx.amount : sum - tx.amount, 0);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search transactions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {categories.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {transactions.length === 0 ? 'Pull down to sync data' : 'No results'}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMonths.map((monthKey) => {
            const monthTxs = grouped[monthKey];
            const total = monthTotal(monthTxs);
            return (
              <div key={monthKey}>
                <div className="flex justify-between items-baseline mb-2 px-1">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {monthLabel(monthKey)}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400">{monthTxs.length} tx</p>
                    <p className={`text-xs font-semibold ${total >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatCurrency(Math.abs(total))}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                  {monthTxs.map((tx, idx) => (
                    <div
                      key={tx.id}
                      className={`flex items-center px-4 py-3 gap-3 ${idx !== monthTxs.length - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''}`}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(tx.category) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.merchant}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: categoryColor(tx.category) + '20', color: categoryColor(tx.category) }}
                          >
                            {tx.category}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(tx.date)}</span>
                          {tx.account && (
                            <span className="text-xs text-gray-300 dark:text-gray-500 truncate min-w-0">
                              {tx.account}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={`text-sm font-semibold flex-shrink-0 ml-2 ${INCOME_CATEGORIES.includes(tx.category) ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}`}>
                        {formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Bills Tab ─────────────────────────────────────────────────────────────────

function BillsTab({ onRefresh }: { onRefresh: number }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const cached = localStorage.getItem(`finance_bills_${CACHE_VERSION}`);
      if (cached) {
        setBills(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}

    try {
      const res = await fetch('/api/finance/bills');
      const data = await res.json();
      const bills = data.bills || [];
      setBills(bills);
      try { localStorage.setItem(`finance_bills_${CACHE_VERSION}`, JSON.stringify(bills)); } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  const totalMonthly = bills.reduce((s, b) => s + Math.abs(b.amount || 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const dueSoon = bills.filter((b) => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date + 'T00:00:00');
    return d <= in7Days;
  });

  const dueLater = bills.filter((b) => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date + 'T00:00:00');
    return d > in7Days;
  });

  function BillRow({ bill, idx, total }: { bill: Bill; idx: number; total: number }) {
    return (
      <div className={`flex items-center px-4 py-3 gap-3 ${idx !== total - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''}`}>
        <div className="w-12 flex-shrink-0 text-center">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {bill.due_date ? formatDate(bill.due_date) : ''}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{bill.name}</p>
          <p className="text-xs text-gray-400">{bill.payment_account || bill.category}</p>
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0">
          {formatCurrency(Math.abs(bill.amount))}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Upcoming Bills Total</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalMonthly)}</p>
        <p className="text-xs text-gray-400 mt-0.5">{bills.length} unpaid bills</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No upcoming bills — pull down to sync</div>
      ) : (
        <>
          {dueSoon.length > 0 && (
            <div>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 px-1">Due Within 7 Days</p>
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-900/50 overflow-hidden shadow-sm">
                {dueSoon.map((bill, idx) => <BillRow key={bill.id} bill={bill} idx={idx} total={dueSoon.length} />)}
              </div>
            </div>
          )}
          {dueLater.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Coming Up</p>
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                {dueLater.map((bill, idx) => <BillRow key={bill.id} bill={bill} idx={idx} total={dueLater.length} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Net Worth Tab ─────────────────────────────────────────────────────────────

function NetWorthTab({ onRefresh }: { onRefresh: number }) {
  const [data, setData] = useState<{
    accounts: NetWorthAccount[];
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/net-worth');
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
      Unable to load — pull down to refresh
    </div>
  );

  if (!data) return null;

  const assets = data.accounts.filter((a) => a.type === 'asset');
  const liabilities = data.accounts.filter((a) => a.type === 'liability');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg">
        <p className="text-blue-200 text-sm mb-1">Net Worth</p>
        <p className="text-4xl font-bold tracking-tight">{formatCurrency(data.netWorth)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-blue-200 text-xs">Total Assets</p>
            <p className="text-white font-bold">{formatCurrency(data.totalAssets)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-blue-200 text-xs">Total Liabilities</p>
            <p className="text-white font-bold">{formatCurrency(data.totalLiabilities)}</p>
          </div>
        </div>
      </div>

      {assets.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Assets</p>
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
            {assets.map((acct, idx) => (
              <div key={idx} className={`flex items-center px-4 py-3 gap-3 ${idx !== assets.length - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''}`}>
                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <p className="flex-1 text-sm text-gray-700 dark:text-gray-200">{acct.name}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(acct.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {liabilities.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Liabilities</p>
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
            {liabilities.map((acct, idx) => (
              <div key={idx} className={`flex items-center px-4 py-3 gap-3 ${idx !== liabilities.length - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''}`}>
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <p className="flex-1 text-sm text-gray-700 dark:text-gray-200">{acct.name}</p>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(acct.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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
    merchant: '',
    account: '',
    amount: '',
    category: '',
  });
  const [txSaving, setTxSaving] = useState(false);
  const [txError, setTxError] = useState('');

  async function handleAddTransaction() {
    setTxError('');
    if (!txForm.date || !txForm.merchant || !txForm.account || !txForm.amount || !txForm.category) {
      setTxError('All fields are required.');
      return;
    }
    setTxSaving(true);
    try {
      const res = await fetch('/api/finance/transactions/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txForm),
      });
      if (!res.ok) throw new Error('Failed to save');
      setShowAddTx(false);
      setTxForm({
        date: new Date().toISOString().split('T')[0],
        merchant: '',
        account: '',
        amount: '',
        category: '',
      });
      await syncSheets();
      setRefreshCount((c) => c + 1);
    } catch {
      setTxError('Something went wrong. Try again.');
    } finally {
      setTxSaving(false);
    }
  }

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    await syncSheets();
    setSyncing(false);
    setRefreshCount((c) => c + 1);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500">Please sign in</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'budget', label: 'Budget' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'bills', label: 'Bills' },
    { id: 'networth', label: 'Net Worth' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 z-30 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Finance</h1>
            {syncing && (
              <div className="flex items-center gap-1.5 text-xs text-blue-500">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Syncing…
              </div>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        <SwipeTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as Tab)}
        >
          {tabs.map((tab) => (
            <div key={tab.id} className="px-4 py-4 pb-28">
              {tab.id === 'overview' && <OverviewTab onRefresh={refreshCount} onNavigate={(id) => setActiveTab(id as Tab)} />}
              {tab.id === 'budget' && <BudgetTab onRefresh={refreshCount} />}
              {tab.id === 'transactions' && <TransactionsTab onRefresh={refreshCount} />}
              {tab.id === 'bills' && <BillsTab onRefresh={refreshCount} />}
              {tab.id === 'networth' && <NetWorthTab onRefresh={refreshCount} />}
            </div>
          ))}
        </SwipeTabs>
      </PullToRefresh>

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