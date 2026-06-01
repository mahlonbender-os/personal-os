'use client';

import PullToRefresh from '@/components/PullToRefresh';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePlaidLink } from 'react-plaid-link';

type SubPage = 'overview' | 'transactions' | 'bills' | 'budget' | 'networth' | 'subscriptions' | 'cashback' | 'goals';

export default function FinancePage() {
  const { data: session } = useSession();
  const [activePage, setActivePage] = useState<SubPage>('overview');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [oauthRedirectUri, setOauthRedirectUri] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const tabs: { key: SubPage; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'bills', label: 'Bills' },
    { key: 'budget', label: 'Budget' },
    { key: 'networth', label: 'Net Worth' },
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'cashback', label: 'Cash Back' },
    { key: 'goals', label: 'Goals' },
  ];

  const fetchLinkToken = useCallback(async () => {
    try {
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
      const data = await res.json();
      if (data.link_token) setLinkToken(data.link_token);
    } catch (err) {
      console.error('Failed to fetch link token:', err);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/plaid/accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/transactions');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  }, []);

  const fetchBills = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/bills');
      const data = await res.json();
      setBills(data.bills || []);
    } catch (err) {
      console.error('Failed to fetch bills:', err);
    }
  }, []);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/goals');
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    }
  }, []);

  const syncTransactions = async () => {
    setSyncing(true);
    try {
      await fetch('/api/plaid/sync-transactions', { method: 'POST' });
      setLastSynced(new Date().toLocaleTimeString());
      await fetchTransactions();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (session) {
      if (typeof window !== 'undefined' && window.location.href.includes('oauth_state_id')) {
        setOauthRedirectUri(window.location.href);
      } else if (typeof window !== 'undefined' && document.referrer.includes('wellsfargo')) {
        // Wells Fargo sometimes strips the oauth_state_id — force reopen
        setOauthRedirectUri(window.location.href);
      }
      fetchLinkToken();
      fetchAccounts();
      fetchTransactions();
      fetchBills();
      fetchGoals();
    }
  }, [session, fetchLinkToken, fetchAccounts, fetchTransactions, fetchBills, fetchGoals]);

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: oauthRedirectUri || undefined,
    onSuccess: async (public_token, metadata) => {
      try {
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_token,
            institution_name: metadata.institution?.name,
            institution_id: metadata.institution?.institution_id,
          }),
        });
        await syncTransactions();
        fetchAccounts();
        fetchLinkToken();
      } catch (err) {
        console.error('Error exchanging token:', err);
      }
    },
  });

  useEffect(() => {
    if (oauthRedirectUri && plaidReady) {
      openPlaidLink();
    }
  }, [oauthRedirectUri, plaidReady, openPlaidLink]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const totalBalance = accounts
    .filter(a => a.type === 'depository')
    .reduce((sum, a) => sum + (a.balance_current || 0), 0);

  const totalCredit = accounts
    .filter(a => a.type === 'credit')
    .reduce((sum, a) => sum + (a.balance_current || 0), 0);

  const thisMonthSpend = transactions
    .filter(t => {
      const txDate = new Date(t.date);
      const now = new Date();
      return txDate.getMonth() === now.getMonth() &&
             txDate.getFullYear() === now.getFullYear() &&
             t.amount > 0 &&
             !t.pending;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const upcomingBills = bills.filter(b => {
    const today = new Date();
    const due = b.due_day || 0;
    const daysUntil = due - today.getDate();
    return daysUntil >= 0 && daysUntil <= 7;
  });

  return (
    <div className="min-h-screen bg-background">
      <PullToRefresh onRefresh={async () => {
        await Promise.all([fetchAccounts(), fetchTransactions(), fetchBills(), fetchGoals()]);
      }}>
        <div className="pb-24">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-bold">Finance</h1>
                <div className="flex gap-2">
                  <button
                    onClick={syncTransactions}
                    disabled={syncing}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground active:bg-accent"
                  >
                    {syncing ? '⟳ Syncing…' : '⟳ Sync'}
                  </button>
                  <button
                    onClick={() => plaidReady && openPlaidLink()}
                    disabled={!plaidReady}
                    className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground"
                  >
                    + Account
                  </button>
                </div>
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActivePage(tab.key)}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                      activePage === tab.key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 pt-4">
            {activePage === 'overview' && (
              <OverviewPage
                accounts={accounts}
                totalBalance={totalBalance}
                totalCredit={totalCredit}
                thisMonthSpend={thisMonthSpend}
                upcomingBills={upcomingBills}
                transactions={transactions.slice(0, 5)}
                goals={goals}
                formatCurrency={formatCurrency}
                lastSynced={lastSynced}
                onConnectBank={() => plaidReady && openPlaidLink()}
                plaidReady={plaidReady}
              />
            )}
            {activePage === 'transactions' && (
              <TransactionsPage
                transactions={transactions}
                formatCurrency={formatCurrency}
                onRefresh={fetchTransactions}
              />
            )}
            {activePage === 'bills' && (
              <BillsPage
                bills={bills}
                formatCurrency={formatCurrency}
                onRefresh={fetchBills}
              />
            )}
            {activePage === 'budget' && (
              <BudgetPage
                transactions={transactions}
                budgets={budgets}
                formatCurrency={formatCurrency}
              />
            )}
            {activePage === 'networth' && (
              <NetWorthPage
                accounts={accounts}
                formatCurrency={formatCurrency}
              />
            )}
            {activePage === 'subscriptions' && (
              <SubscriptionsPage
                transactions={transactions}
                formatCurrency={formatCurrency}
              />
            )}
            {activePage === 'cashback' && (
              <CashBackPage
                transactions={transactions}
                formatCurrency={formatCurrency}
              />
            )}
            {activePage === 'goals' && (
              <GoalsPage
                goals={goals}
                formatCurrency={formatCurrency}
                onRefresh={fetchGoals}
              />
            )}
          </div>
        </div>
      </PullToRefresh>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OVERVIEW PAGE
// ═══════════════════════════════════════════════════════════
function OverviewPage({ accounts, totalBalance, totalCredit, thisMonthSpend, upcomingBills, transactions, goals, formatCurrency, lastSynced, onConnectBank, plaidReady }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Cash & Checking</p>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">{accounts.filter((a: any) => a.type === 'depository').length} accounts</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Credit Card Debt</p>
          <p className="text-2xl font-bold tabular-nums text-amber-500">{formatCurrency(totalCredit)}</p>
          <p className="text-xs text-muted-foreground mt-1">{accounts.filter((a: any) => a.type === 'credit').length} cards</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-xs text-muted-foreground mb-1">Spent This Month</p>
        <p className="text-3xl font-bold tabular-nums">{formatCurrency(thisMonthSpend)}</p>
        {lastSynced && <p className="text-xs text-muted-foreground mt-1">Last synced {lastSynced}</p>}
      </div>

      {accounts.length === 0 ? (
        <div className="bg-card rounded-2xl p-6 border border-border text-center">
          <p className="text-3xl mb-2">🏦</p>
          <p className="font-semibold mb-1">No accounts connected</p>
          <p className="text-sm text-muted-foreground mb-4">Connect your bank to see transactions, bills, and spending insights</p>
          <button
            onClick={onConnectBank}
            disabled={!plaidReady}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
          >
            Connect a Bank Account
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Connected Accounts</p>
          </div>
          {accounts.map((acct: any, i: number) => (
            <div key={acct.account_id} className={`px-4 py-3 flex items-center justify-between ${i < accounts.length - 1 ? 'border-b border-border' : ''}`}>
              <div>
                <p className="text-sm font-medium">{acct.name}</p>
                <p className="text-xs text-muted-foreground">{acct.institution_name} •••{acct.mask}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatCurrency(acct.balance_current || 0)}</p>
                <p className="text-xs text-muted-foreground capitalize">{acct.subtype}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcomingBills.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Due in 7 Days</p>
          </div>
          {upcomingBills.map((bill: any) => (
            <div key={bill.id} className="px-4 py-3 flex items-center justify-between border-b border-border last:border-0">
              <p className="text-sm">{bill.name}</p>
              <p className="text-sm font-semibold text-amber-500">{formatCurrency(bill.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Recent Transactions</p>
          </div>
          {transactions.map((txn: any) => (
            <div key={txn.id} className="px-4 py-3 flex items-center justify-between border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{txn.merchant_name || txn.name}</p>
                <p className="text-xs text-muted-foreground">{txn.date}</p>
              </div>
              <p className={`text-sm font-semibold tabular-nums ml-3 ${txn.amount < 0 ? 'text-emerald-500' : ''}`}>
                {txn.amount < 0 ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
              </p>
            </div>
          ))}
        </div>
      )}

      {goals.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Savings Goals</p>
          </div>
          {goals.slice(0, 3).map((goal: any) => {
            const pct = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
            return (
              <div key={goal.id} className="px-4 py-3 border-b border-border last:border-0">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium">{goal.name}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}</p>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TRANSACTIONS PAGE
// ═══════════════════════════════════════════════════════════
function TransactionsPage({ transactions, formatCurrency, onRefresh }: any) {
  const [filter, setFilter] = useState<'all' | 'personal' | 'shared'>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = ['all', ...new Set(transactions.map((t: any) => t.category).filter(Boolean))];

  const filtered = transactions.filter((t: any) => {
    if (filter !== 'all' && t.ownership !== filter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (search && !t.merchant_name?.toLowerCase().includes(search.toLowerCase()) &&
        !t.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const updateOwnership = async (txnId: string, ownership: string) => {
    await fetch('/api/finance/transactions/ownership', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: txnId, ownership }),
    });
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search transactions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(['all', 'personal', 'shared'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full capitalize ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="w-px bg-border" />
        {(categories as string[]).slice(0, 6).map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full capitalize ${
              categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {cat === 'all' ? 'All Categories' : cat.replace(/_/g, ' ').toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">💳</p>
          <p className="text-muted-foreground text-sm">No transactions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Connect a bank account and sync to see your transactions</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {filtered.map((txn: any, i: number) => (
            <div key={txn.id} className={`px-4 py-3 ${i < filtered.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{txn.merchant_name || txn.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{txn.date}</p>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {txn.category?.replace(/_/g, ' ').toLowerCase() || 'uncategorized'}
                    </span>
                    {txn.pending && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">pending</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold tabular-nums ${txn.amount < 0 ? 'text-emerald-500' : ''}`}>
                    {txn.amount < 0 ? '+' : ''}{formatCurrency(Math.abs(txn.amount))}
                  </p>
                  <select
                    value={txn.ownership || 'personal'}
                    onChange={e => updateOwnership(txn.id, e.target.value)}
                    className="text-xs mt-1 bg-transparent border border-border rounded px-1 py-0.5 text-muted-foreground"
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="personal">mine</option>
                    <option value="shared">shared</option>
                    <option value="bree">Bree</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BILLS PAGE
// ═══════════════════════════════════════════════════════════
function BillsPage({ bills, formatCurrency, onRefresh }: any) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    name: '', amount: '', due_day: '', frequency: 'monthly',
    category: '', auto_pay: false, is_shared: false, shared_split: '100',
  });

  const today = new Date().getDate();
  const overdue = bills.filter((b: any) => b.due_day && b.due_day < today);
  const upcoming = bills.filter((b: any) => b.due_day && b.due_day >= today && b.due_day <= today + 7);
  const rest = bills.filter((b: any) => !b.due_day || b.due_day > today + 7);

  const totalMonthly = bills
    .filter((b: any) => b.frequency === 'monthly' || !b.frequency)
    .reduce((sum: number, b: any) => sum + (b.amount * (b.shared_split / 100)), 0);

  const submitBill = async () => {
    await fetch('/api/finance/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        due_day: parseInt(form.due_day),
        shared_split: parseFloat(form.shared_split),
      }),
    });
    setForm({ name: '', amount: '', due_day: '', frequency: 'monthly', category: '', auto_pay: false, is_shared: false, shared_split: '100' });
    setShowAddForm(false);
    onRefresh();
  };

  const BillSection = ({ title, items, color }: { title: string; items: any[]; color: string }) => (
    items.length > 0 ? (
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-2 border-b border-border">
          <p className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</p>
        </div>
        {items.map((bill: any, i: number) => (
          <div key={bill.id} className={`px-4 py-3 flex items-center justify-between ${i < items.length - 1 ? 'border-b border-border' : ''}`}>
            <div>
              <p className="text-sm font-medium">{bill.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">
                  {bill.due_day ? `Due the ${bill.due_day}${['st','nd','rd','th'][Math.min((bill.due_day % 10) - 1, 3)] || 'th'}` : 'Due date not set'}
                </p>
                {bill.auto_pay && <span className="text-xs text-emerald-500">autopay</span>}
                {bill.is_shared && <span className="text-xs text-blue-500">shared</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{formatCurrency(bill.amount)}</p>
              {bill.is_shared && bill.shared_split < 100 && (
                <p className="text-xs text-muted-foreground">your share: {formatCurrency(bill.amount * bill.shared_split / 100)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    ) : null
  );

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-xs text-muted-foreground mb-1">Monthly Bills Total</p>
        <p className="text-3xl font-bold tabular-nums">{formatCurrency(totalMonthly)}</p>
        <p className="text-xs text-muted-foreground mt-1">{bills.length} bills tracked</p>
      </div>

      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-medium"
      >
        {showAddForm ? '✕ Cancel' : '+ Add Bill'}
      </button>

      {showAddForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="font-semibold text-sm">New Bill</p>
          <input placeholder="Name (e.g. Netflix)" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Amount" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input placeholder="Due day (1-31)" type="number" value={form.due_day} onChange={e => setForm({...form, due_day: e.target.value})}
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none">
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="quarterly">Quarterly</option>
            <option value="weekly">Weekly</option>
          </select>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.auto_pay} onChange={e => setForm({...form, auto_pay: e.target.checked})} />
              Auto-pay
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_shared} onChange={e => setForm({...form, is_shared: e.target.checked})} />
              Shared with Bree
            </label>
          </div>
          {form.is_shared && (
            <input placeholder="Your split %" type="number" value={form.shared_split}
              onChange={e => setForm({...form, shared_split: e.target.value})}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          )}
          <button onClick={submitBill} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
            Save Bill
          </button>
        </div>
      )}

      <BillSection title="Overdue" items={overdue} color="text-red-500" />
      <BillSection title="Due Soon (7 days)" items={upcoming} color="text-amber-500" />
      <BillSection title="Upcoming" items={rest} color="text-muted-foreground" />

      {bills.length === 0 && !showAddForm && (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-muted-foreground text-sm">No bills added yet</p>
          <p className="text-xs text-muted-foreground mt-1">Tap "Add Bill" to track your recurring expenses</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BUDGET PAGE
// ═══════════════════════════════════════════════════════════
function BudgetPage({ transactions, budgets, formatCurrency }: any) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  const spendByCategory: Record<string, number> = {};
  transactions
    .filter((t: any) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.amount > 0;
    })
    .forEach((t: any) => {
      const cat = t.category || 'OTHER';
      spendByCategory[cat] = (spendByCategory[cat] || 0) + t.amount;
    });

  const defaultCategories = [
    { name: 'Groceries', key: 'FOOD_AND_DRINK', limit: 600, color: '#10b981' },
    { name: 'Dining Out', key: 'FOOD_AND_DRINK_RESTAURANTS', limit: 300, color: '#f59e0b' },
    { name: 'Gas', key: 'TRANSPORTATION_GAS', limit: 200, color: '#6366f1' },
    { name: 'Shopping', key: 'GENERAL_MERCHANDISE', limit: 300, color: '#ec4899' },
    { name: 'Entertainment', key: 'ENTERTAINMENT', limit: 100, color: '#8b5cf6' },
    { name: 'Health', key: 'MEDICAL', limit: 100, color: '#ef4444' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-xs text-muted-foreground mb-1">{now.toLocaleString('default', { month: 'long' })} Budget</p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Day {dayOfMonth} of {daysInMonth}</p>
          <p className="text-sm text-muted-foreground">{Math.round(monthProgress * 100)}% through month</p>
        </div>
        <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${monthProgress * 100}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {defaultCategories.map(cat => {
          const spent = Object.entries(spendByCategory)
            .filter(([key]) => key.startsWith(cat.key.split('_')[0]))
            .reduce((sum, [, val]) => sum + val, 0);
          const pct = Math.min(100, (spent / cat.limit) * 100);
          const overBudget = spent > cat.limit;
          const onTrack = spent <= cat.limit * monthProgress;

          return (
            <div key={cat.key} className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{cat.name}</p>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${overBudget ? 'text-red-500' : ''}`}>
                    {formatCurrency(spent)}
                  </p>
                  <p className="text-xs text-muted-foreground">of {formatCurrency(cat.limit)}</p>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: overBudget ? '#ef4444' : cat.color }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <p className="text-xs text-muted-foreground">
                  {overBudget ? '⚠️ Over budget' : onTrack ? '✓ On track' : '⚡ Ahead of pace'}
                </p>
                <p className="text-xs text-muted-foreground">{Math.round(pct)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NET WORTH PAGE
// ═══════════════════════════════════════════════════════════
function NetWorthPage({ accounts, formatCurrency }: any) {
  const [manualAssets] = useState([
    { name: 'Home Value (est.)', amount: 285000, type: 'asset' },
    { name: 'HELOC Balance', amount: -15000, type: 'liability' },
  ]);

  const liquidAssets = accounts
    .filter((a: any) => a.type === 'depository')
    .reduce((sum: number, a: any) => sum + (a.balance_current || 0), 0);

  const creditDebt = accounts
    .filter((a: any) => a.type === 'credit')
    .reduce((sum: number, a: any) => sum + (a.balance_current || 0), 0);

  const manualAssetsTotal = manualAssets
    .filter(a => a.type === 'asset')
    .reduce((sum, a) => sum + a.amount, 0);

  const manualLiabilitiesTotal = Math.abs(manualAssets
    .filter(a => a.type === 'liability')
    .reduce((sum, a) => sum + a.amount, 0));

  const totalAssets = liquidAssets + manualAssetsTotal;
  const totalLiabilities = creditDebt + manualLiabilitiesTotal;
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-6 border border-border text-center">
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Net Worth</p>
        <p className={`text-4xl font-bold tabular-nums ${netWorth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {formatCurrency(netWorth)}
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between">
          <p className="font-semibold text-sm text-emerald-500">Assets</p>
          <p className="font-semibold text-sm text-emerald-500">{formatCurrency(totalAssets)}</p>
        </div>
        {accounts.filter((a: any) => a.type === 'depository').map((acct: any) => (
          <div key={acct.account_id} className="px-4 py-3 border-b border-border flex justify-between">
            <p className="text-sm">{acct.name} <span className="text-muted-foreground text-xs">•••{acct.mask}</span></p>
            <p className="text-sm font-medium">{formatCurrency(acct.balance_current)}</p>
          </div>
        ))}
        {manualAssets.filter(a => a.type === 'asset').map((asset, i) => (
          <div key={i} className="px-4 py-3 border-b border-border last:border-0 flex justify-between">
            <p className="text-sm">{asset.name}</p>
            <p className="text-sm font-medium">{formatCurrency(asset.amount)}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between">
          <p className="font-semibold text-sm text-red-500">Liabilities</p>
          <p className="font-semibold text-sm text-red-500">{formatCurrency(totalLiabilities)}</p>
        </div>
        {accounts.filter((a: any) => a.type === 'credit').map((acct: any) => (
          <div key={acct.account_id} className="px-4 py-3 border-b border-border flex justify-between">
            <p className="text-sm">{acct.name} <span className="text-muted-foreground text-xs">•••{acct.mask}</span></p>
            <p className="text-sm font-medium text-red-500">{formatCurrency(acct.balance_current)}</p>
          </div>
        ))}
        {manualAssets.filter(a => a.type === 'liability').map((asset, i) => (
          <div key={i} className="px-4 py-3 border-b border-border last:border-0 flex justify-between">
            <p className="text-sm">{asset.name}</p>
            <p className="text-sm font-medium text-red-500">{formatCurrency(Math.abs(asset.amount))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTIONS PAGE
// ═══════════════════════════════════════════════════════════
function SubscriptionsPage({ transactions, formatCurrency }: any) {
  const merchantCounts: Record<string, { count: number; amount: number; dates: string[]; last: string }> = {};

  transactions.forEach((t: any) => {
    if (t.amount <= 0) return;
    const key = (t.merchant_name || t.name).toLowerCase();
    if (!merchantCounts[key]) {
      merchantCounts[key] = { count: 0, amount: t.amount, dates: [], last: t.date };
    }
    merchantCounts[key].count++;
    merchantCounts[key].dates.push(t.date);
    if (t.date > merchantCounts[key].last) {
      merchantCounts[key].last = t.date;
      merchantCounts[key].amount = t.amount;
    }
  });

  const likelySubscriptions = Object.entries(merchantCounts)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].amount - a[1].amount);

  const totalMonthly = likelySubscriptions.reduce((sum, [, v]) => sum + v.amount, 0);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-xs text-muted-foreground mb-1">Estimated Monthly Subscriptions</p>
        <p className="text-3xl font-bold tabular-nums">{formatCurrency(totalMonthly)}</p>
        <p className="text-xs text-muted-foreground mt-1">{likelySubscriptions.length} recurring charges detected</p>
      </div>

      {likelySubscriptions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">🔄</p>
          <p className="text-muted-foreground text-sm">No recurring charges detected yet</p>
          <p className="text-xs text-muted-foreground mt-1">Connect accounts and sync a few months of transactions</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {likelySubscriptions.map(([name, data], i) => (
            <div key={name} className={`px-4 py-3 flex items-center justify-between ${i < likelySubscriptions.length - 1 ? 'border-b border-border' : ''}`}>
              <div>
                <p className="text-sm font-medium capitalize">{name}</p>
                <p className="text-xs text-muted-foreground">{data.count}x charged · last {data.last}</p>
              </div>
              <p className="text-sm font-semibold">{formatCurrency(data.amount)}/mo</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CASH BACK PAGE
// ═══════════════════════════════════════════════════════════
function CashBackPage({ transactions, formatCurrency }: any) {
  const thisMonth = new Date();
  const monthlySpend = transactions
    .filter((t: any) => {
      const d = new Date(t.date);
      return d.getMonth() === thisMonth.getMonth() && t.amount > 0;
    })
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const estimatedCashBack = monthlySpend * 0.015;
  const yearlyEstimate = estimatedCashBack * 12;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-1">This Month</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-500">{formatCurrency(estimatedCashBack)}</p>
          <p className="text-xs text-muted-foreground mt-1">estimated earned</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Yearly Estimate</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-500">{formatCurrency(yearlyEstimate)}</p>
          <p className="text-xs text-muted-foreground mt-1">at current pace</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="font-semibold text-sm mb-3">Setup Card Reward Rates</p>
        <p className="text-xs text-muted-foreground mb-3">
          Go to Finance → Settings to enter your exact reward rates per card and category for accurate tracking.
        </p>
        <p className="text-xs text-muted-foreground">
          Currently showing estimate at 1.5% flat rate on all spending.
        </p>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="font-semibold text-sm mb-2">Monthly Spend by Category</p>
        <div className="space-y-2">
          {Object.entries(
            transactions
              .filter((t: any) => {
                const d = new Date(t.date);
                return d.getMonth() === thisMonth.getMonth() && t.amount > 0;
              })
              .reduce((acc: Record<string, number>, t: any) => {
                const cat = t.category || 'OTHER';
                acc[cat] = (acc[cat] || 0) + t.amount;
                return acc;
              }, {})
          )
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 8)
            .map(([cat, amount]) => (
              <div key={cat} className="flex justify-between items-center">
                <p className="text-sm capitalize">{(cat as string).replace(/_/g, ' ').toLowerCase()}</p>
                <p className="text-sm font-medium">{formatCurrency(amount as number)}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// GOALS PAGE
// ═══════════════════════════════════════════════════════════
function GoalsPage({ goals, formatCurrency, onRefresh }: any) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '', target_date: '', notes: '' });

  const submitGoal = async () => {
    await fetch('/api/finance/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
      }),
    });
    setForm({ name: '', target_amount: '', current_amount: '', target_date: '', notes: '' });
    setShowAddForm(false);
    onRefresh();
  };

  const updateGoalAmount = async (goalId: string, newAmount: number) => {
    await fetch(`/api/finance/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_amount: newAmount }),
    });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-medium"
      >
        {showAddForm ? '✕ Cancel' : '+ New Goal'}
      </button>

      {showAddForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="font-semibold text-sm">New Savings Goal</p>
          <input placeholder="Goal name (e.g. Emergency Fund)" value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Target $" type="number" value={form.target_amount}
              onChange={e => setForm({...form, target_amount: e.target.value})}
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input placeholder="Current $" type="number" value={form.current_amount}
              onChange={e => setForm({...form, current_amount: e.target.value})}
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <input type="date" value={form.target_date} onChange={e => setForm({...form, target_date: e.target.value})}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={submitGoal} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
            Save Goal
          </button>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">🎯</p>
          <p className="text-muted-foreground text-sm">No savings goals yet</p>
          <p className="text-xs text-muted-foreground mt-1">Tap "New Goal" to start tracking</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal: any) => {
            const pct = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
            const remaining = goal.target_amount - goal.current_amount;
            const daysLeft = goal.target_date
              ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div key={goal.id} className="bg-card rounded-2xl p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{goal.name}</p>
                    {daysLeft !== null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {daysLeft > 0 ? `${daysLeft} days remaining` : 'Past target date'}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-emerald-500">{Math.round(pct)}%</p>
                  </div>
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saved: <span className="text-foreground font-medium">{formatCurrency(goal.current_amount)}</span></span>
                  <span className="text-muted-foreground">Remaining: <span className="text-foreground font-medium">{formatCurrency(remaining)}</span></span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Target: {formatCurrency(goal.target_amount)}</span>
                </div>

                <div className="flex gap-2 mt-3">
                  {[50, 100, 250, 500].map(amt => (
                    <button
                      key={amt}
                      onClick={() => updateGoalAmount(goal.id, goal.current_amount + amt)}
                      className="flex-1 py-1.5 text-xs bg-muted rounded-lg text-muted-foreground active:bg-accent"
                    >
                      +{formatCurrency(amt)}
                    </button>
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