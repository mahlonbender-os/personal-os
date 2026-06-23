'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/BottomNav';
import PullToRefresh from '@/components/PullToRefresh';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Snapshot {
  id: string;
  snapshot_date: string;
  balance: number;
  notes: string | null;
}

interface Contribution {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  month: string;
}

interface MonthlyContribution {
  month: string;
  total: number;
}

interface RetirementData {
  snapshots: Snapshot[];
  contributions: Contribution[];
  monthlyContributions: MonthlyContribution[];
  totalContributions: number;
  currentBalance: number;
  impliedGrowth: number;
  growthPct: number;
  latestSnapshot: Snapshot | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function fmtDate(s: string) {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function monthLabel(ym: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' });
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-[#111] border border-[#1a1a1a] ${className}`}>{children}</div>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RetirementPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<RetirementData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    snapshot_date: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }),
    balance: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Expanded contribution month
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/retirement');
      const d = await res.json();
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setFormError('');
    if (!form.snapshot_date || !form.balance) { setFormError('Date and balance are required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/retirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, balance: parseFloat(form.balance) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setShowAdd(false);
      setForm({ snapshot_date: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }), balance: '', notes: '' });
      load();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/retirement?id=${deleteId}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteId(null);
    load();
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-[#555]">Please sign in</p></div>;
  }

  const snapshots = data?.snapshots || [];
  const contributions = data?.contributions || [];
  const monthlyContributions = data?.monthlyContributions || [];
  const currentBalance = data?.currentBalance ?? 0;
  const totalContributions = data?.totalContributions ?? 0;
  const impliedGrowth = data?.impliedGrowth ?? 0;
  const growthPct = data?.growthPct ?? 0;
  const latestSnapshot = data?.latestSnapshot ?? null;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });

  // Sparkline from snapshots
  function BalanceSparkline() {
    if (snapshots.length < 2) return null;
    const values = snapshots.map(s => parseFloat(String(s.balance)));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min === 0 ? 1 : max - min;
    const width = 340; const height = 80; const pad = 12;
    const pts = snapshots.map((s, i) => {
      const x = pad + (i / (snapshots.length - 1)) * (width - pad * 2);
      const y = (height - pad) - ((parseFloat(String(s.balance)) - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <Card className="p-4">
        <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Balance History</p>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          <polyline fill="none" stroke="#f0a050" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
          {snapshots.map((s, i) => {
            if (i !== 0 && i !== snapshots.length - 1) return null;
            const x = pad + (i / (snapshots.length - 1)) * (width - pad * 2);
            const y = (height - pad) - ((parseFloat(String(s.balance)) - min) / range) * (height - pad * 2);
            return <circle key={i} cx={x} cy={y} r="4" fill="#111" stroke="#f0a050" strokeWidth="2" />;
          })}
        </svg>
        <div className="flex justify-between text-[9px] text-[#444] font-semibold mt-1 px-1">
          <span>{fmtDate(snapshots[0].snapshot_date)}</span>
          <span>{fmtDate(snapshots[snapshots.length - 1].snapshot_date)}</span>
        </div>
      </Card>
    );
  }

  // Contribution bar chart (monthly)
  function ContributionBars() {
    if (monthlyContributions.length === 0) return null;
    const maxVal = Math.max(...monthlyContributions.map(m => m.total));
    return (
      <Card className="p-4">
        <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Monthly Contributions</p>
        <div className="flex items-end justify-between gap-1.5 h-20">
          {monthlyContributions.map((m, i) => {
            const pct = maxVal > 0 ? (m.total / maxVal) * 100 : 0;
            const label = monthLabel(m.month).split(' ')[0].substring(0, 3);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className="w-full rounded-t-sm bg-[#f0a050]/80"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <span className="text-[8px] text-[#444] font-semibold uppercase">{label}</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black flex flex-col overflow-hidden select-none">
        {/* Header */}
        <div className="flex-shrink-0 bg-black border-b border-[#1a1a1a] pt-14 px-4 pb-3 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">401(k)</h1>
              <p className="text-[11px] text-[#444] mt-0.5">ACME Markets · 1st Financial</p>
            </div>
            <button
              onClick={() => { setForm(f => ({ ...f, snapshot_date: today })); setShowAdd(true); }}
              className="text-sm font-semibold text-[#f0a050] active:opacity-70 px-2 py-1"
            >
              Log Balance
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          <PullToRefresh onRefresh={load}>
            <div className="px-4 pt-4 space-y-4">

              {/* Hero balance card */}
              <div className="rounded-2xl bg-gradient-to-br from-[#1a1000] to-[#111] border border-[#f0a050]/20 p-5">
                <p className="text-[#f0a050]/60 text-sm mb-1">Current Balance</p>
                {latestSnapshot ? (
                  <>
                    <p className="text-4xl font-bold text-white font-mono tracking-tight">{fmt(currentBalance)}</p>
                    <p className="text-[10px] text-[#444] mt-1">as of {fmtDate(latestSnapshot.snapshot_date)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-[#333] font-mono">No balance logged yet</p>
                    <p className="text-[10px] text-[#444] mt-1">Tap Log Balance to add your first snapshot</p>
                  </>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-[#555] text-[9px] mb-0.5">Contributed</p>
                    <p className="text-white text-sm font-bold font-mono">{fmt(totalContributions)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-[#555] text-[9px] mb-0.5">Growth</p>
                    <p className={`text-sm font-bold font-mono ${impliedGrowth >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {impliedGrowth >= 0 ? '+' : '-'}{fmt(Math.abs(impliedGrowth))}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-[#555] text-[9px] mb-0.5">Return</p>
                    <p className={`text-sm font-bold font-mono ${growthPct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <BalanceSparkline />
              <ContributionBars />

              {/* Balance snapshots */}
              {snapshots.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Balance Log</p>
                  <Card className="overflow-hidden">
                    {[...snapshots].reverse().map((snap, idx) => (
                      <div key={snap.id}
                        className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== snapshots.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                        onClick={() => setDeleteId(snap.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#ccc]">{fmtDate(snap.snapshot_date)}</p>
                          {snap.notes && <p className="text-[10px] text-[#444] truncate">{snap.notes}</p>}
                        </div>
                        <p className="text-sm font-semibold text-[#f0a050] font-mono">{fmt(parseFloat(String(snap.balance)))}</p>
                      </div>
                    ))}
                  </Card>
                  <p className="text-[10px] text-[#333] px-1 mt-1.5">Tap a snapshot to delete it</p>
                </div>
              )}

              {/* Monthly contribution breakdown */}
              {monthlyContributions.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-2 px-1">Contributions by Month</p>
                  <Card className="overflow-hidden">
                    {[...monthlyContributions].reverse().map((m, idx) => {
                      const isExpanded = expandedMonth === m.month;
                      const monthTxs = contributions.filter(tx => tx.date.startsWith(m.month));
                      return (
                        <div key={m.month}>
                          <div
                            className={`flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-[#161616] transition-colors ${idx !== monthlyContributions.length - 1 || isExpanded ? 'border-b border-[#1a1a1a]' : ''}`}
                            onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                          >
                            <div className="flex-1">
                              <p className="text-sm text-[#ccc]">{monthLabel(m.month)}</p>
                              <p className="text-[10px] text-[#444]">{monthTxs.length} contribution{monthTxs.length !== 1 ? 's' : ''}</p>
                            </div>
                            <span className={`text-[10px] text-[#555] mr-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                            <p className="text-sm font-semibold text-[#22c55e] font-mono">{fmt(m.total)}</p>
                          </div>
                          {isExpanded && (
                            <div className={`bg-[#0d0d0d] ${idx !== monthlyContributions.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                              {monthTxs.map((tx, ti) => (
                                <div key={tx.id} className={`flex items-center px-6 py-2.5 gap-3 ${ti !== monthTxs.length - 1 ? 'border-b border-[#141414]' : ''}`}>
                                  <div className="flex-1">
                                    <p className="text-[11px] text-[#888]">{fmtDate(tx.date)}</p>
                                    <p className="text-[10px] text-[#444]">{tx.merchant}</p>
                                  </div>
                                  <p className="text-[11px] font-semibold text-[#22c55e] font-mono">{fmt(parseFloat(String(tx.amount)))}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Card>
                </div>
              )}

              {/* Empty state */}
              {contributions.length === 0 && snapshots.length === 0 && (
                <div className="text-center py-12 text-[#333] text-sm">
                  <p>No 401(k) data yet.</p>
                  <p className="text-[11px] mt-1">Tap Log Balance above to add your first snapshot.</p>
                  <p className="text-[11px] mt-0.5">Contributions sync automatically from your paycheck transactions.</p>
                </div>
              )}

            </div>
          </PullToRefresh>
        </div>

        <BottomNav active="more" />
      </div>

      {/* Log Balance Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl pb-6 border border-[#1a1a1a]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
              <button onClick={() => setShowAdd(false)} className="text-[#f0a050] text-sm">Cancel</button>
              <h2 className="text-base font-semibold text-white">Log Balance</h2>
              <button onClick={handleAdd} disabled={saving} className="text-[#f0a050] text-sm font-semibold disabled:opacity-40">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className="px-4 pt-4 space-y-3">
              <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Date</span>
                  <input type="date" value={form.snapshot_date}
                    onChange={e => setForm(f => ({ ...f, snapshot_date: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none" />
                </div>
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Balance</span>
                  <input type="number" placeholder="0.00" step="0.01" value={form.balance}
                    onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
                <div className="flex items-center px-4 py-3">
                  <span className="text-sm text-[#888] w-24 flex-shrink-0">Notes</span>
                  <input type="text" placeholder="Optional" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="flex-1 bg-transparent text-sm text-white text-right outline-none placeholder-[#444]" />
                </div>
              </div>
              <p className="text-[10px] text-[#444] px-1">Check your 1st Financial account for the current balance, then log it here monthly to track growth.</p>
              {formError && <p className="text-[#ef4444] text-xs px-1 font-mono">{formError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-lg p-5 border border-[#1a1a1a]">
            <p className="text-base font-semibold text-white text-center mb-1">Delete this snapshot?</p>
            <p className="text-[11px] text-[#555] text-center mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 rounded-xl bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-40">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}