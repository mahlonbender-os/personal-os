'use client';

import { useState, useEffect, useCallback } from 'react';
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

type Tab = 'overview' | 'transactions' | 'bills' | 'networth';

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

function formatCurrency(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatBillDate(bill: Bill): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  if (bill.due_day) {
    const d = new Date(year, month, bill.due_day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (bill.due_date) return formatDate(bill.due_date);
  return '';
}

// ─── Sync function ────────────────────────────────────────────────────────────

async function syncSheets(): Promise<void> {
  await fetch('/api/sync/sheets', { method: 'POST' });
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ onRefresh }: { onRefresh: number }) {
  const [cashFlow, setCashFlow] = useState<{ income: number; expenses: number; net: number } | null>(null);
  const [netWorth, setNetWorth] = useState<{ netWorth: number; totalAssets: number; totalLiabilities: number } | null>(null);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfRes, nwRes, txRes] = await Promise.all([
        fetch('/api/finance/cash-flow'),
        fetch('/api/finance/net-worth'),
        fetch('/api/finance/transactions?limit=5'),
      ]);
      const [cfData, nwData, txData] = await Promise.all([cfRes.json(), nwRes.json(), txRes.json()]);

      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long' });
      const currentMonthData = cfData.months?.find((m: { month: string }) =>
        m.month.toLowerCase().includes(monthName.toLowerCase())
      );
      if (currentMonthData) {
        setCashFlow({
          income: currentMonthData.income,
          expenses: currentMonthData.essentials + currentMonthData.discretionary,
          net: currentMonthData.net,
        });
      }

      setNetWorth(nwData);
      setRecentTx(txData.transactions || []);
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

  return (
    <div className="space-y-4">
      {/* Net Worth Card */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 p-5 text-white shadow-lg">
        <p className="text-blue-200 text-sm font-medium mb-1">Net Worth</p>
        <p className="text-3xl font-bold tracking-tight">
          {netWorth ? formatCurrency(netWorth.netWorth) : '—'}
        </p>
        {netWorth && (
          <div className="flex gap-4 mt-3 text-sm text-blue-100">
            <span>Assets {formatCurrency(netWorth.totalAssets, true)}</span>
            <span>·</span>
            <span>Liabilities {formatCurrency(netWorth.totalLiabilities, true)}</span>
          </div>
        )}
      </div>

      {/* Cash Flow Card */}
      {cashFlow && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            This Month
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Income</p>
              <p className="text-base font-bold text-green-600 dark:text-green-400">
                {formatCurrency(cashFlow.income, true)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Spent</p>
              <p className="text-base font-bold text-red-500 dark:text-red-400">
                {formatCurrency(cashFlow.expenses, true)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Net</p>
              <p className={`text-base font-bold ${cashFlow.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {formatCurrency(Math.abs(cashFlow.net), true)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Recent Transactions
          </p>
        </div>
        {recentTx.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            Pull down to sync latest data
          </p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center px-4 py-3 gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: categoryColor(tx.category) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.merchant}</p>
                  <p className="text-xs text-gray-400">{tx.category} · {formatDate(tx.date)}</p>
                </div>
                <p className={`text-sm font-semibold flex-shrink-0 ${
                  INCOME_CATEGORIES.includes(tx.category) ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'
                }`}>
                  {INCOME_CATEGORIES.includes(tx.category) ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
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
    setLoading(true);
    try {
      const res = await fetch('/api/finance/transactions?limit=300');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

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

  function monthLabel(key: string): string {
    if (key === 'Unknown') return 'Unknown';
    const [y, m] = key.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  const totalFiltered = filtered.reduce((sum, tx) =>
    INCOME_CATEGORIES.includes(tx.category) ? sum + tx.amount : sum - tx.amount, 0);

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

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedCategory === cat
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="flex justify-between items-center px-1">
          <span className="text-xs text-gray-400">{filtered.length} transactions</span>
          <span className={`text-sm font-semibold ${totalFiltered >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totalFiltered >= 0 ? '+' : ''}{formatCurrency(totalFiltered)}
          </span>
        </div>
      )}

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
          {sortedMonths.map((monthKey) => (
            <div key={monthKey}>
              <div className="flex justify-between items-baseline mb-2">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {monthLabel(monthKey)}
                </p>
                <p className="text-xs text-gray-400">{grouped[monthKey].length} tx</p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                {grouped[monthKey].map((tx, idx) => (
                  <div
                    key={tx.id}
                    className={`flex items-center px-4 py-3 gap-3 ${
                      idx !== grouped[monthKey].length - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''
                    }`}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: categoryColor(tx.category) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.merchant}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: categoryColor(tx.category) + '20',
                            color: categoryColor(tx.category),
                          }}
                        >
                          {tx.category}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(tx.date)}</span>
                        {tx.account && <span className="text-xs text-gray-300 dark:text-gray-500 truncate">{tx.account}</span>}
                      </div>
                    </div>
                    <p className={`text-sm font-semibold flex-shrink-0 ${
                      INCOME_CATEGORIES.includes(tx.category) ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'
                    }`}>
                      {INCOME_CATEGORIES.includes(tx.category) ? '+' : ''}
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
    setLoading(true);
    try {
      const res = await fetch('/api/finance/bills');
      const data = await res.json();
      setBills(data.bills || []);
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
    const dateLabel = bill.due_date ? formatDate(bill.due_date) : '';
    return (
      <div
        className={`flex items-center px-4 py-3 gap-3 ${idx !== total - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''}`}
      >
        <div className="w-12 flex-shrink-0 text-center">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{dateLabel}</span>
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
      {/* Monthly Total */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
          Upcoming Bills Total
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalMonthly)}</p>
        <p className="text-xs text-gray-400 mt-0.5">{bills.length} unpaid bills</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          No upcoming bills — pull down to sync
        </div>
      ) : (
        <>
          {/* Due within 7 days */}
          {dueSoon.length > 0 && (
            <div>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 px-1">
                Due Within 7 Days
              </p>
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-900/50 overflow-hidden shadow-sm">
                {dueSoon.map((bill, idx) => (
                  <BillRow key={bill.id} bill={bill} idx={idx} total={dueSoon.length} />
                ))}
              </div>
            </div>
          )}

          {/* Coming up */}
          {dueLater.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                Coming Up
              </p>
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                {dueLater.map((bill, idx) => (
                  <BillRow key={bill.id} bill={bill} idx={idx} total={dueLater.length} />
                ))}
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
      {error}
      <br /><span className="text-xs text-gray-400">Pull down to refresh — token may have expired</span>
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
            <p className="text-white font-bold">{formatCurrency(data.totalAssets, true)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-blue-200 text-xs">Total Liabilities</p>
            <p className="text-white font-bold">{formatCurrency(data.totalLiabilities, true)}</p>
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

export default function FinancePage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshCount, setRefreshCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

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
    { id: 'transactions', label: 'Transactions' },
    { id: 'bills', label: 'Bills' },
    { id: 'networth', label: 'Net Worth' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
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

      {/* Content */}
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 py-4 pb-28 min-h-screen">
          {activeTab === 'overview' && <OverviewTab onRefresh={refreshCount} />}
          {activeTab === 'transactions' && <TransactionsTab onRefresh={refreshCount} />}
          {activeTab === 'bills' && <BillsTab onRefresh={refreshCount} />}
          {activeTab === 'networth' && <NetWorthTab onRefresh={refreshCount} />}
        </div>
      </PullToRefresh>

      <BottomNav active="finance" />
    </div>
  );
}