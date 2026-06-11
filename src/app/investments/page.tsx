'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';

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
  dailyGainLoss: number;
  dailyGainLossPct: number;
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
  vooDailyChange: number;
  vooDailyChangePct: number;
  tslaPrice: number;
  tslaDailyChange: number;
  tslaDailyChangePct: number;
  accounts: Account[];
  trades: Trade[];
  totalPortfolioValue: number;
  totalDailyGainLoss: number;
  lastUpdated: string;
}

interface HistoryPoint {
  date: string;
  value: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'investments-data-v2';
const HISTORY_CACHE_KEY = 'investments-history-v1';
const TABS = ['Overview', 'Trade Log'];
const RANGES = ['1M', '3M', '6M', '1Y'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShares = (n: number) => n.toFixed(3);

function gainColor(v: number) {
  return v >= 0 ? '#22c55e' : '#ef4444';
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

// ─── Portfolio Chart ──────────────────────────────────────────────────────────

function PortfolioChart({ points, range }: { points: HistoryPoint[]; range: string }) {
  if (!points || points.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-[#333] text-xs font-mono">
        No history available
      </div>
    );
  }

  // Filter by selected range
  const now = new Date();
  const cutoff = new Date(now);
  if (range === '1M') cutoff.setMonth(cutoff.getMonth() - 1);
  else if (range === '3M') cutoff.setMonth(cutoff.getMonth() - 3);
  else if (range === '6M') cutoff.setMonth(cutoff.getMonth() - 6);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const filtered = range === '1Y' ? points : points.filter(p => p.date >= cutoffStr);

  if (filtered.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-[#333] text-xs font-mono">
        Not enough data for {range}
      </div>
    );
  }

  const W = 340, H = 110;
  const PL = 46, PR = 8, PT = 6, PB = 18;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  const vals = filtered.map(p => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const pad = (maxV - minV) * 0.1 || 500;
  const minVP = minV - pad;
  const maxVP = maxV + pad;
  const rangeV = maxVP - minVP;

  const xS = (i: number) => PL + (i / (filtered.length - 1)) * plotW;
  const yS = (v: number) => PT + plotH - ((v - minVP) / rangeV) * plotH;

  const pts = filtered.map((p, i) => `${xS(i).toFixed(1)},${yS(p.value).toFixed(1)}`).join(' ');
  const lastX = xS(filtered.length - 1);
  const lastY = yS(filtered[filtered.length - 1].value);
  const area = `${PL},${PT + plotH} ${pts} ${lastX},${PT + plotH}`;

  const first = filtered[0].value;
  const last = filtered[filtered.length - 1].value;
  const isUp = last >= first;
  const tc = isUp ? '#22c55e' : '#ef4444';
  const changePct = ((last - first) / first) * 100;
  const changeAbs = last - first;

  // Y ticks (3 levels)
  const yTicks = [
    minVP + rangeV * 0.15,
    minVP + rangeV * 0.5,
    minVP + rangeV * 0.85,
  ];

  // X labels
  const fmtXDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    if (range === '1M') return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div>
      {/* Change summary for range */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-mono text-sm font-bold" style={{ color: tc }}>
          {isUp ? '+' : ''}{fmt(changeAbs)}
        </span>
        <span className="font-mono text-xs" style={{ color: tc }}>
          ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
        </span>
        <span className="text-[#444] text-[10px]">this {range}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: `${H}px` }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tc} stopOpacity="0.18" />
            <stop offset="100%" stopColor={tc} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={PL} y1={yS(v).toFixed(1)}
            x2={W - PR} y2={yS(v).toFixed(1)}
            stroke="#1a1a1a" strokeWidth="1"
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={PL - 3}
            y={(yS(v) + 4).toFixed(1)}
            textAnchor="end"
            fill="#444"
            fontSize="7"
            fontFamily="monospace"
          >
            {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
          </text>
        ))}

        {/* Area fill */}
        <polygon points={area} fill="url(#areaGrad)" />

        {/* Line */}
        <polyline
          points={pts}
          fill="none"
          stroke={tc}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current value dot */}
        <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="2.5" fill={tc} />

        {/* X labels */}
        <text x={PL} y={H - 3} textAnchor="start" fill="#444" fontSize="7" fontFamily="monospace">
          {fmtXDate(filtered[0].date)}
        </text>
        <text x={W - PR} y={H - 3} textAnchor="end" fill="#444" fontSize="7" fontFamily="monospace">
          {fmtXDate(filtered[filtered.length - 1].date)}
        </text>
      </svg>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<InvestmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDaily, setShowDaily] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [historyRange, setHistoryRange] = useState('1Y');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formAccount, setFormAccount] = useState('Roth IRA');
  const [formSecurity, setFormSecurity] = useState('VOO');
  const [formAction, setFormAction] = useState('BUY');
  const [formShares, setFormShares] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formAmount, setFormAmount] = useState('');
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

  async function fetchHistory() {
    try {
      // Check cache first — valid for 6 hours
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.ts && Date.now() - parsed.ts < 6 * 60 * 60 * 1000) {
          setHistoryData(parsed.data || []);
          return;
        }
      }
      const res = await fetch('/api/finance/investments/history');
      if (!res.ok) return;
      const json = await res.json();
      const pts = json.points || [];
      setHistoryData(pts);
      localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify({ data: pts, ts: Date.now() }));
    } catch (e) {
      console.error('History fetch error:', e);
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try { setData(JSON.parse(cached)); } catch {}
      setLoading(false);
    }
    // Try history from cache immediately
    try {
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.data) setHistoryData(parsed.data);
      }
    } catch {}
    fetchData();
    fetchHistory();
  }, []);

  // Auto-calculate total amount from shares × price
  useEffect(() => {
    if (!formShares || !formPrice) return;
    const total = parseFloat(formShares) * parseFloat(formPrice);
    if (!isNaN(total)) setFormAmount(total.toFixed(2));
  }, [formShares, formPrice]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openModal() {
    setFormDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }));
    setFormShares('');
    setFormPrice('');
    setFormAmount('');
    setFormAction('BUY');
    setShowModal(true);
  }

  async function handleSaveTrade() {
    if (!formDate || !formAmount || !formShares || !formPrice) return;
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
          amount: parseFloat(formAmount),
          shares: parseFloat(formShares),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowModal(false);
      await fetchData();
    } catch (e) {
      console.error('Save trade error:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/finance/investments?id=${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteId(null);
      await fetchData();
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasHoldings = (data?.accounts || []).some(a => a.holdings.length > 0);

  return (
    <PullToRefresh onRefresh={async () => {
      // Bust history cache on manual refresh
      localStorage.removeItem(HISTORY_CACHE_KEY);
      await Promise.all([fetchData(), fetchHistory()]);
    }}>
      <div className="pb-24">

        {/* Header */}
        <div className="px-4 pt-5 pb-2">
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
            Investments
          </h1>
        </div>

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

            {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
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
                  {/* Today's change */}
                  {data?.totalDailyGainLoss !== undefined && data.totalDailyGainLoss !== 0 && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span
                        className="font-mono text-xs"
                        style={{ color: gainColor(data.totalDailyGainLoss) }}
                      >
                        {data.totalDailyGainLoss >= 0 ? '+' : ''}{fmt(Math.abs(data.totalDailyGainLoss))} today
                      </span>
                    </div>
                  )}
                  {data?.lastUpdated && (
                    <div className="text-[#444] text-[10px] font-mono mt-1">
                      Updated {new Date(data.lastUpdated).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>

                {/* Historical chart */}
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-semibold text-white">Portfolio History</span>
                    <div className="flex gap-1">
                      {RANGES.map(r => (
                        <button
                          key={r}
                          onClick={() => setHistoryRange(r)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors ${
                            historyRange === r
                              ? 'bg-[#f0a050] text-black'
                              : 'bg-[#1a1a1a] text-[#555]'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PortfolioChart points={historyData} range={historyRange} />
                </div>

                {/* Live prices */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      symbol: 'VOO',
                      label: 'S&P 500 ETF',
                      price: data?.vooPrice,
                      d: data?.vooDailyChange,
                      dp: data?.vooDailyChangePct,
                    },
                    {
                      symbol: 'TSLA',
                      label: 'Tesla',
                      price: data?.tslaPrice,
                      d: data?.tslaDailyChange,
                      dp: data?.tslaDailyChangePct,
                    },
                  ].map(t => (
                    <div key={t.symbol} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                      <div className="text-[#f0a050] text-xs font-mono font-bold">{t.symbol}</div>
                      <div className="text-[#555] text-[10px] mb-1.5">{t.label}</div>
                      <div className="text-white font-mono font-bold text-sm">{fmt(t.price || 0)}</div>
                      {t.d !== undefined && t.d !== 0 && (
                        <div
                          className="font-mono text-[10px] mt-0.5"
                          style={{ color: gainColor(t.d) }}
                        >
                          {t.d >= 0 ? '+' : ''}{t.d?.toFixed(2)} ({t.dp >= 0 ? '+' : ''}{t.dp?.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Holdings header with Overall / Today toggle */}
                {hasHoldings && (
                  <div className="flex items-center justify-between px-1 pt-1">
                    <span className="text-[#555] text-xs font-semibold uppercase tracking-wider">
                      Holdings
                    </span>
                    <div className="flex bg-[#1a1a1a] rounded-full p-0.5">
                      {['Overall', 'Today'].map(label => (
                        <button
                          key={label}
                          onClick={() => setShowDaily(label === 'Today')}
                          className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
                            (label === 'Today') === showDaily
                              ? 'bg-[#f0a050] text-black'
                              : 'text-[#555]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                        {acc.holdings.map((h, j) => {
                          const gl = showDaily ? h.dailyGainLoss : h.gainLoss;
                          const glPct = showDaily ? h.dailyGainLossPct : h.gainLossPct;
                          return (
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
                                  style={{ color: gainColor(gl) }}
                                >
                                  {gl >= 0 ? '+' : '-'}{fmt(Math.abs(gl))}
                                </div>
                                <div
                                  className="font-mono text-[10px]"
                                  style={{ color: gainColor(glPct) }}
                                >
                                  {glPct >= 0 ? '+' : ''}{(glPct ?? 0).toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
                  <div className="text-center text-[#333] text-sm font-mono pt-12">
                    No trades logged yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.trades.map((t) => {
                      const ac = actionColor(t.action);
                      return (
                        <div key={t.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${ac.bg} ${ac.text}`}>
                                  {t.action}
                                </span>
                                <span className="text-[#f0a050] text-xs font-mono font-bold">
                                  {t.security}
                                </span>
                                <span className="text-[#555] text-[10px]">{t.account}</span>
                              </div>
                              <div className="text-white font-mono font-bold text-sm">
                                {fmt(t.amount)}
                              </div>
                              <div className="text-[#555] text-[10px] font-mono">
                                {fmtShares(parseFloat(String(t.shares)))} shares
                              </div>
                              <div className="text-[#444] text-[10px] font-mono mt-1">
                                {new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })}
                              </div>
                            </div>
                            <button
                              onClick={() => setDeleteId(t.id)}
                              className="text-[#333] hover:text-[#ef4444] transition-colors p-1 ml-2 flex-shrink-0"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
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

        {/* ── FAB ────────────────────────────────────────────────────────── */}
        <button
          onClick={openModal}
          className="fixed bottom-24 right-5 w-14 h-14 bg-[#f0a050] rounded-full z-40 flex items-center justify-center shadow-lg"
        >
          <svg className="w-7 h-7 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* ── Log Trade Modal ─────────────────────────────────────────────── */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-[#1c1c1e] rounded-2xl w-full max-h-[85vh] overflow-y-auto pb-6">
              <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
                <span className="font-bold text-base">Log Trade</span>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-[#555] text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="px-5 pt-4 space-y-4">

                {/* Date */}
                <div>
                  <div className="text-[#888] text-xs mb-1.5">Date</div>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-black border border-[#2a2a2a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#f0a050]"
                  />
                </div>

                {/* Account */}
                <div>
                  <div className="text-[#888] text-xs mb-1.5">Account</div>
                  <div className="flex gap-2">
                    {['Roth IRA', 'HSA'].map(a => (
                      <button
                        key={a}
                        onClick={() => setFormAccount(a)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                          formAccount === a
                            ? 'bg-[#f0a050]/20 border-[#f0a050] text-[#f0a050]'
                            : 'bg-black border-[#2a2a2a] text-[#555]'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Security */}
                <div>
                  <div className="text-[#888] text-xs mb-1.5">Security</div>
                  <div className="flex gap-2">
                    {['VOO', 'TSLA'].map(s => (
                      <button
                        key={s}
                        onClick={() => setFormSecurity(s)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-semibold border transition-colors ${
                          formSecurity === s
                            ? 'bg-[#f0a050]/20 border-[#f0a050] text-[#f0a050]'
                            : 'bg-black border-[#2a2a2a] text-[#555]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action */}
                <div>
                  <div className="text-[#888] text-xs mb-1.5">Action</div>
                  <div className="flex gap-2">
                    {['BUY', 'SELL', 'REINVEST'].map(a => (
                      <button
                        key={a}
                        onClick={() => setFormAction(a)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${actionBtnClass(a, formAction)}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shares */}
                <div>
                  <div className="text-[#888] text-xs mb-1.5">Shares</div>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.000"
                    value={formShares}
                    onChange={e => setFormShares(e.target.value)}
                    className="w-full bg-black border border-[#2a2a2a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#f0a050]"
                  />
                </div>

                {/* Price Per Share */}
                <div>
                  <div className="text-[#888] text-xs mb-1.5">Price Per Share</div>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    className="w-full bg-black border border-[#2a2a2a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#f0a050]"
                  />
                </div>

                {/* Total Amount */}
                <div>
                  <div className="text-[#888] text-xs mb-1.5">Total Amount (auto-calculated)</div>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    className="w-full bg-black border border-[#2a2a2a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#f0a050]"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-5 pt-5">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-[#2a2a2a] rounded-xl text-sm font-semibold text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTrade}
                  disabled={saving}
                  className="flex-1 py-3 bg-[#f0a050] rounded-xl text-sm font-semibold text-black disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirm Sheet ─────────────────────────────────────────── */}
        {deleteId && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
            <div className="bg-[#1c1c1e] rounded-2xl w-full p-5">
              <div className="text-center mb-5">
                <div className="text-base font-bold mb-1">Delete Trade</div>
                <div className="text-[#888] text-sm">
                  This will remove the trade and recalculate your position.
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-3 bg-[#2a2a2a] rounded-xl text-sm font-semibold text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-3 bg-[#ef4444] rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PullToRefresh>
  );
}