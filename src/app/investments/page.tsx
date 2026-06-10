'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPct: number;
}

interface Account {
  name: string;
  sheetTotal: number;
  uninvestedCash: number;
  stockValue: number;
  totalValue: number;
  holdings: Holding[];
}

interface Trade {
  id: string;
  date: string;
  account: string;
  security: string;
  action: string;
  amount: number;
  shares: number;
}

interface InvestmentData {
  vooPrice: number;
  tslaPrice: number;
  accounts: Account[];
  trades: Trade[];
  totalPortfolioValue: number;
  lastUpdated: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'investments-v1';
const TABS = ['Overview', 'Trade Log'];
const ACTIONS = ['BUY', 'SELL', 'REINVEST'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShares(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function gainColor(n: number) {
  return n >= 0 ? '#22c55e' : '#ef4444';
}

function actionColor(action: string) {
  if (action === 'BUY') return { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]' };
  if (action === 'REINVEST') return { bg: 'bg-[#f0a050]/10', text: 'text-[#f0a050]' };
  return { bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]' };
}

function actionBtnClass(action: string, selected: string) {
  const active = action === selected;
  if (!active) return 'bg-black border-[#2a2a2a] text-[#555]';
  if (action === 'BUY') return 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]';
  if (action === 'SELL') return 'bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444]';
  return 'bg-[#f0a050]/20 border-[#f0a050] text-[#f0a050]';
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center pt-20">
      <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<InvestmentData | null>(null);
  const [loading, setLoading] = useState(true);

  // Add modal state
  const [showModal, setShowModal] = useState(false);
  const [formDate, setFormDate] = useState(
    new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' })
  );
  const [formAccount, setFormAccount] = useState('Roth IRA');
  const [formSecurity, setFormSecurity] = useState('VOO');
  const [formAction, setFormAction] = useState('BUY');
  const [formAmount, setFormAmount] = useState('');
  const [formShares, setFormShares] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function fetchData() {
    try {
      const res = await fetch('/api/finance/investments');
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
      localStorage.setItem(CACHE_KEY, JSON.stringify(json));
    } catch (e) {
      console.error('Investments fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try { setData(JSON.parse(cached)); } catch {}
      setLoading(false);
    }
    fetchData();
  }, []);

  // Auto-calculate shares from dollar amount
  useEffect(() => {
    if (!formAmount || !data) return;
    const price = formSecurity === 'VOO' ? data.vooPrice : data.tslaPrice;
    if (price > 0) {
      setFormShares((parseFloat(formAmount) / price).toFixed(6));
    }
  }, [formAmount, formSecurity, data]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openModal() {
    setFormDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }));
    setFormAmount('');
    setFormShares('');
    setFormAction('BUY');
    setShowModal(true);
  }

  async function handleSaveTrade() {
    if (!formDate || !formAmount || !formShares) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          account: formAccount,
          security: formSecurity,
          action: formAction,
          amount: formAmount,
          shares: formShares,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowModal(false);
      localStorage.removeItem(CACHE_KEY);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch('/api/finance/investments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId }),
      });
      setDeleteId(null);
      localStorage.removeItem(CACHE_KEY);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PullToRefresh onRefresh={fetchData}>
        <div className="min-h-screen bg-black text-white pb-24">

          {/* Tab bar */}
          <div className="flex border-b border-[#1a1a1a] sticky top-0 bg-black z-10">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(i);
                  window.scrollTo(0, 0);
                  if (navigator.vibrate) navigator.vibrate(8);
                }}
                className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                  activeTab === i
                    ? 'text-[#f0a050] border-b-2 border-[#f0a050]'
                    : 'text-[#555]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading && !data ? <Spinner /> : (
            <div className="px-4 pt-4 space-y-3">

              {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
              {activeTab === 0 && (
                <>
                  {/* Total portfolio value */}
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 text-center">
                    <div className="text-[#888] text-xs font-semibold uppercase tracking-wider mb-1">
                      Total Portfolio
                    </div>
                    <div className="text-3xl font-mono font-bold text-[#22c55e]">
                      {fmt(data?.totalPortfolioValue || 0)}
                    </div>
                    {data?.lastUpdated && (
                      <div className="text-[#444] text-[10px] font-mono mt-1">
                        Updated {new Date(data.lastUpdated).toLocaleTimeString('en-US', {
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>

                  {/* Live prices */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { symbol: 'VOO', label: 'S&P 500 ETF', price: data?.vooPrice },
                      { symbol: 'TSLA', label: 'Tesla', price: data?.tslaPrice },
                    ].map(t => (
                      <div key={t.symbol} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                        <div className="text-[#f0a050] text-xs font-mono font-bold">{t.symbol}</div>
                        <div className="text-[#555] text-[10px] mb-2">{t.label}</div>
                        <div className="text-white font-mono font-bold text-sm">
                          {fmt(t.price || 0)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Account cards */}
                  {(data?.accounts || []).map((acc, i) => (
                    <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-3">

                      {/* Header */}
                      <div className="flex justify-between items-center pb-2 border-b border-[#1a1a1a]">
                        <span className="text-sm font-bold">{acc.name}</span>
                        <span className="font-mono font-bold text-[#22c55e]">
                          {fmt(acc.totalValue)}
                        </span>
                      </div>

                      {/* Cash vs invested */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/40 border border-[#1a1a1a] rounded-xl p-3">
                          <div className="text-[#555] text-[10px] uppercase mb-1">Uninvested Cash</div>
                          <div className="font-mono text-white text-sm font-bold">
                            {fmt(acc.uninvestedCash)}
                          </div>
                        </div>
                        <div className="bg-black/40 border border-[#1a1a1a] rounded-xl p-3">
                          <div className="text-[#555] text-[10px] uppercase mb-1">Market Value</div>
                          <div className="font-mono text-white text-sm font-bold">
                            {fmt(acc.stockValue)}
                          </div>
                        </div>
                      </div>

                      {/* Holdings */}
                      {acc.holdings.length > 0 ? (
                        <div className="space-y-2">
                          {acc.holdings.map((h, j) => (
                            <div
                              key={j}
                              className="flex justify-between items-center bg-black/20 border border-[#151515] rounded-xl p-3"
                            >
                              <div>
                                <div className="text-[#f0a050] text-xs font-mono font-bold">
                                  {h.symbol}
                                </div>
                                <div className="text-[#555] text-[10px] font-mono">
                                  {fmtShares(h.shares)} shares
                                </div>
                                <div className="text-[#555] text-[10px] font-mono">
                                  avg {fmt(h.avgCost)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-bold text-sm">
                                  {fmt(h.marketValue)}
                                </div>
                                <div
                                  className="font-mono text-xs"
                                  style={{ color: gainColor(h.gainLoss) }}
                                >
                                  {h.gainLoss >= 0 ? '+' : '-'}{fmt(Math.abs(h.gainLoss))}
                                </div>
                                <div
                                  className="font-mono text-[10px]"
                                  style={{ color: gainColor(h.gainLoss) }}
                                >
                                  {h.gainLossPct >= 0 ? '+' : ''}
                                  {h.gainLossPct.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[#333] text-xs font-mono text-center py-2">
                          No positions
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* ── TRADE LOG TAB ─────────────────────────────────────────── */}
              {activeTab === 1 && (
                <>
                  {(!data?.trades || data.trades.length === 0) ? (
                    <div className="text-center py-16 text-[#333] text-sm">
                      No trades logged yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.trades.map(trade => {
                        const { bg, text } = actionColor(trade.action);
                        return (
                          <div
                            key={trade.id}
                            className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 flex justify-between items-center"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${bg} ${text}`}>
                                  {trade.action}
                                </span>
                                <span className="text-[#f0a050] text-xs font-mono font-bold">
                                  {trade.security}
                                </span>
                                <span className="text-[#555] text-[10px]">{trade.account}</span>
                              </div>
                              <div className="text-[#888] text-[10px] font-mono">
                                {fmtDate(trade.date)}
                              </div>
                              <div className="text-[#555] text-[10px] font-mono">
                                {fmtShares(trade.shares)} shares
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-sm">
                                {fmt(trade.amount)}
                              </span>
                              <button
                                onClick={() => setDeleteId(trade.id)}
                                className="text-[#333] hover:text-[#ef4444] transition-colors text-xl leading-none"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      </PullToRefresh>

      {/* FAB */}
      <div className="fixed bottom-24 right-5 z-40">
        <button
          onClick={openModal}
          className="w-14 h-14 bg-[#f0a050] text-black rounded-full flex items-center justify-center font-bold text-2xl shadow-xl active:scale-95 transition-transform"
        >
          +
        </button>
      </div>

      {/* ── Log Trade Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-6">

            <div className="px-5 py-4 border-b border-[#2a2a2a]">
              <h3 className="text-sm font-bold text-white">Log Trade</h3>
            </div>

            <div className="px-5 pt-4 space-y-4 text-xs">

              {/* Date */}
              <div>
                <div className="text-[#888] mb-1.5 uppercase tracking-wider">Date</div>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full bg-black border border-[#2a2a2a] p-3 rounded-xl text-white outline-none focus:border-[#f0a050]"
                />
              </div>

              {/* Account + Security */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[#888] mb-1.5 uppercase tracking-wider">Account</div>
                  <select
                    value={formAccount}
                    onChange={e => setFormAccount(e.target.value)}
                    className="w-full bg-black border border-[#2a2a2a] p-3 rounded-xl text-white outline-none focus:border-[#f0a050]"
                  >
                    <option value="Roth IRA">Roth IRA</option>
                    <option value="HSA">HSA</option>
                  </select>
                </div>
                <div>
                  <div className="text-[#888] mb-1.5 uppercase tracking-wider">Security</div>
                  <select
                    value={formSecurity}
                    onChange={e => setFormSecurity(e.target.value)}
                    className="w-full bg-black border border-[#2a2a2a] p-3 rounded-xl text-white outline-none focus:border-[#f0a050]"
                  >
                    <option value="VOO">VOO</option>
                    <option value="TSLA">TSLA</option>
                  </select>
                </div>
              </div>

              {/* Action */}
              <div>
                <div className="text-[#888] mb-1.5 uppercase tracking-wider">Action</div>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIONS.map(a => (
                    <button
                      key={a}
                      onClick={() => setFormAction(a)}
                      className={`py-3 rounded-xl text-xs font-bold border transition-colors ${actionBtnClass(a, formAction)}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dollar Amount */}
              <div>
                <div className="text-[#888] mb-1.5 uppercase tracking-wider">Dollar Amount</div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  className="w-full bg-black border border-[#2a2a2a] p-3 rounded-xl text-white font-mono outline-none focus:border-[#f0a050] text-right"
                />
              </div>

              {/* Shares — auto-calculated, overridable */}
              <div>
                <div className="text-[#888] mb-1.5 uppercase tracking-wider">
                  Shares
                  <span className="text-[#444] normal-case ml-1">(auto-calculated)</span>
                </div>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="0.000000"
                  value={formShares}
                  onChange={e => setFormShares(e.target.value)}
                  className="w-full bg-black border border-[#2a2a2a] p-3 rounded-xl text-[#888] font-mono outline-none text-right"
                />
              </div>

              {/* Footer buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="py-3 rounded-xl bg-[#2a2a2a] text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTrade}
                  disabled={saving || !formAmount || !formShares}
                  className="py-3 rounded-xl bg-[#f0a050] text-black text-xs font-bold disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Log Trade'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Sheet ──────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="text-white text-sm font-bold text-center">Delete this trade?</div>
            <div className="text-[#888] text-xs text-center">
              This cannot be undone. Share count and cash balance will update automatically.
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setDeleteId(null)}
                className="py-3 rounded-xl bg-[#2a2a2a] text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="py-3 rounded-xl bg-[#ef4444] text-white text-xs font-bold disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="more" />
    </>
  );
}