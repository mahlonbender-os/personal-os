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
const HISTORY_CACHE_KEY = 'investments-history-v4';
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
      <div className="flex items-center justify-center h-20 text-[#666] text-xs font-mono">
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
      <div className="flex items-center justify-center h-20 text-[#666] text-xs font-mono">
        Not enough data for {range}
      </div>
    );
  }

  const W = 340, H = 110;
  const PL = 48, PR = 8, PT = 6, PB = 18;
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
  const area = `${PL},${(PT + plotH).toFixed(1)} ${pts} ${lastX.toFixed(1)},${(PT + plotH).toFixed(1)}`;

  const first = filtered[0].value;
  const last = filtered[filtered.length - 1].value;
  const isUp = last >= first;
  const tc = isUp ? '#22c55e' : '#ef4444';
  const changePct = ((last - first) / first) * 100;
  const changeAbs = last - first;

  const yTicks = [
    minVP + rangeV * 0.15,
    minVP + rangeV * 0.5,
    minVP + rangeV * 0.85,
  ];

  const fmtXDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    if (range === '1M') return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-mono text-sm font-bold" style={{ color: tc }}>
          {isUp ? '+' : ''}{fmt(changeAbs)}
        </span>
        <span className="font-mono text-xs" style={{ color: tc }}>
          ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
        </span>
        <span className="text-[#555] text-[10px]">this {range}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: `${H}px` }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tc} stopOpacity="0.18" />
            <stop offset="100%" stopColor={tc} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={PL} y1={yS(v).toFixed(1)}
            x2={W - PR} y2={yS(v).toFixed(1)}
            stroke="#222" strokeWidth="1"
          />
        ))}

        {yTicks.map((v, i) => (
          <text
            key={i}
            x={PL - 3}
            y={(yS(v) + 4).toFixed(1)}
            textAnchor="end"
            fill="#555"
            fontSize="7"
            fontFamily="monospace"
          >
            {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
          </text>
        ))}

        <polygon points={area} fill="url(#areaGrad)" />

        <polyline
          points={pts}
          fill="none"
          stroke={tc}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="2.5" fill={tc} />

        <text x={PL} y={H - 3} textAnchor="start" fill="#555" fontSize="7" fontFamily="monospace">
          {fmtXDate(filtered[0].date)}
        </text>
        <text x={W - PR} y={H - 3} textAnchor="end" fill="#555" fontSize="7" fontFamily="monospace">
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
  const [showDaily, setShowDaily] = useState(true);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [historyRange, setHistoryRange] = useState('1Y');
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set());

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
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed.ts &&
          Date.now() - parsed.ts < 6 * 60 * 60 * 1000 &&
          parsed.data?.length > 0
        ) {
          setHistoryData(parsed.data);
          return;
        }
      }
      const res = await fetch('/api/finance/investments/history');
      if (!res.ok) return;
      const json = await res.json();
      const pts: HistoryPoint[] = json.points || [];
      setHistoryData(pts);
      if (pts.length > 0) {
        localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify({ data: pts, ts: Date.now() }));
      }
    } catch (e) {
      console.error('History fetch error:', e);
    }
  }

  const triggerRefresh = async () => {
    localStorage.removeItem(HISTORY_CACHE_KEY);
    await Promise.all([fetchData(), fetchHistory()]);
  };

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try { setData(JSON.parse(cached)); } catch {}
      setLoading(false);
    }
    try {
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.data?.length > 0) setHistoryData(parsed.data);
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
      
      const next = new Set(expandedTrades);
      next.delete(deleteId);
      setExpandedTrades(next);
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
    <>
      <PullToRefresh onRefresh={triggerRefresh}>
        <div className="pb-24 bg-black text-white min-h-screen">

          {/* Locked sticky global header mimicking Knox and Finance modules */}
          <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-md border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Investments
                </h1>
                <p className="text-[10px] text-[#555] mt-0.5">
                  Live Portfolio Tracker Engine Basis
                </p>
              </div>

              {/* High utility text-link contextual action button */}
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(8);
                  activeTab === 0 ? triggerRefresh() : openModal();
                }}
                className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
              >
                {activeTab === 0 ? 'Sync' : 'Log Trade'}
              </button>
            </div>

            {/* Sub-tab view triggers switcher */}
            <div className="flex border-t border-[#1a1a1a]">
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
                    {data?.totalDailyGainLoss !== undefined && data.totalDailyGainLoss !== 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span className="font-mono text-xs" style={{ color: gainColor(data.totalDailyGainLoss) }}>
                          {data.totalDailyGainLoss >= 0 ? '+' : ''}{fmt(data.totalDailyGainLoss)} today
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
                      <span className="text-xs font-semibold text-white">Position Growth</span>
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
                          <div className="font-mono text-[10px] mt-0.5" style={{ color: gainColor(t.d) }}>
                            {t.d >= 0 ? '+' : ''}{t.d?.toFixed(2)} ({t.dp >= 0 ? '+' : ''}{t.dp?.toFixed(2)}%)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Holdings label + Overall / Today toggle */}
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

                      <div className="flex justify-between items-center pb-2 border-b border-[#1a1a1a]">
                        <span className="text-sm font-bold">{acc.name}</span>
                        <span className="font-mono font-bold text-[#22c55e]">{fmt(acc.totalValue)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/40 border border-[#1a1a1a] rounded-xl p-3">
                          <div className="text-[#555] text-[10px] uppercase mb-1">Uninvested Cash</div>
                          <div className="font-mono text-white text-sm font-bold">{fmt(acc.uninvestedCash)}</div>
                        </div>
                        <div className="bg-black/40 border border-[#1a1a1a] rounded-xl p-3">
                          <div className="text-[#555] text-[10px] uppercase mb-1">Market Value</div>
                          <div className="font-mono text-white text-sm font-bold">{fmt(acc.stockValue)}</div>
                        </div>
                      </div>

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
                                  <div className="text-[#f0a050] text-xs font-mono font-bold">{h.symbol}</div>
                                  <div className="text-[#555] text-[10px] font-mono">{fmtShares(h.shares)} shares</div>
                                  <div className="text-[#555] text-[10px] font-mono">avg {fmt(h.avgCost)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono font-bold text-sm">{fmt(h.marketValue)}</div>
                                  <div className="font-mono text-xs" style={{ color: gainColor(gl) }}>
                                    {gl >= 0 ? '+' : '-'}{fmt(Math.abs(gl))}
                                  </div>
                                  <div className="font-mono text-[10px]" style={{ color: gainColor(glPct) }}>
                                    {glPct >= 0 ? '+' : ''}{(glPct ?? 0).toFixed(2)}%
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[#555] text-xs font-mono text-center py-2">No positions</div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* ── TRADE LOG TAB (UNIVERSAL ACCORDION REFACTOR) ──────────────── */}
              {activeTab === 1 && (
                <>
                  <div className="px-1 pb-1">
                    <span className="text-[#555] text-xs font-semibold uppercase tracking-wider">
                      {data?.trades?.length ? `${data.trades.length} trades recorded` : 'Trade Index Log'}
                    </span>
                  </div>

                  {(!data?.trades || data.trades.length === 0) ? (
                    <div className="text-center text-[#555] text-sm font-mono pt-12">No trades logged yet</div>
                  ) : (
                    <div className="space-y-2">
                      {data.trades.map((t) => {
                        const ac = actionColor(t.action);
                        const expanded = expandedTrades.has(t.id);
                        return (
                          <div key={t.id} className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden transition-all">
                            {/* Expandable row layout head track */}
                            <div 
                              onClick={() => {
                                const next = new Set(expandedTrades);
                                expanded ? next.delete(t.id) : next.add(t.id);
                                setExpandedTrades(next);
                              }}
                              className="p-4 flex items-center justify-between cursor-pointer active:bg-[#161616]"
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${ac.bg} ${ac.text}`}>
                                    {t.action}
                                  </span>
                                  <span className="text-[#f0a050] text-xs font-mono font-bold">{t.security}</span>
                                  <span className="text-[#555] text-[10px] font-mono truncate max-w-[80px]">{t.account}</span>
                                </div>
                                <div className="text-white font-mono font-bold text-sm">{fmt(t.amount)}</div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                <span className="text-[#555] text-[10px] font-mono">
                                  {new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric'
                                  })}
                                </span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                                  style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </div>
                            </div>

                            {/* Dropdown context body scope expanded telemetry */}
                            {expanded && (
                              <div className="px-4 pb-4 pt-3 border-t border-[#1a1a1a] bg-black/20 space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#555]">
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider block text-[#444]">Shares Explayed</span>
                                    <span className="text-white font-bold">{fmtShares(parseFloat(String(t.shares)))} units</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider block text-[#444]">Operational Date</span>
                                    <span className="text-white font-bold">{t.date}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 pt-1.5 border-t border-[#1a1a1a]/40">
                                  <button
                                    onClick={() => setDeleteId(t.id)}
                                    className="text-[#ef4444] text-xs font-semibold uppercase tracking-wider"
                                  >
                                    Delete trade
                                  </button>
                                </div>
                              </div>
                            )}
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

      <BottomNav activeTab="more" />

      {/* ═══════════════════════════════════════════════════════════════
          VIEWPORT FIXED ELEMENT SPECIFICATION MODALS BOUNDED SIBLINGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Log Trade Modal sheet */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-h-[85vh] overflow-y-auto pb-6 border border-[#1a1a1a]">
            <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b border-[#1a1a1a] sticky top-0 bg-[#1c1c1e] z-10">
              <span className="font-bold text-base text-white font-mono uppercase tracking-wide">Log Trade Position</span>
              <button onClick={() => setShowModal(false)} className="text-[#555] text-lg p-1">✕</button>
            </div>
            <div className="px-5 pt-4 space-y-4">

              <div>
                <div className="text-[#555] text-xs mb-1.5 uppercase font-mono tracking-wider">Date</div>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div>
                <div className="text-[#555] text-xs mb-1.5 uppercase font-mono tracking-wider">Account</div>
                <div className="flex gap-2">
                  {['Roth IRA', 'HSA'].map(a => (
                    <button
                      key={a}
                      onClick={() => setFormAccount(a)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                        formAccount === a
                          ? 'bg-[#f0a050]/20 border-[#f0a050] text-[#f0a050]'
                          : 'bg-black border-[#1a1a1a] text-[#555]'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[#555] text-xs mb-1.5 uppercase font-mono tracking-wider">Security</div>
                <div className="flex gap-2">
                  {['VOO', 'TSLA'].map(s => (
                    <button
                      key={s}
                      onClick={() => setFormSecurity(s)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-semibold border transition-colors ${
                        formSecurity === s
                          ? 'bg-[#f0a050]/20 border-[#f0a050] text-[#f0a050]'
                          : 'bg-black border-[#1a1a1a] text-[#555]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[#555] text-xs mb-1.5 uppercase font-mono tracking-wider">Action</div>
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

              <div>
                <div className="text-[#555] text-xs mb-1.5 uppercase font-mono tracking-wider">Shares Volume</div>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.000"
                  value={formShares}
                  onChange={e => setFormShares(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div>
                <div className="text-[#555] text-xs mb-1.5 uppercase font-mono tracking-wider">Price Per Share ($)</div>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formPrice}
                  onChange={e => setFormPrice(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#f0a050]"
                />
              </div>

              <div>
                <div className="text-[#555] text-xs mb-1.5 uppercase font-mono tracking-wider">Total Amount Capitalized (auto-calc)</div>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  className="w-full bg-black border border-[#1a1a1a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#f0a050]"
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 pt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-black border border-[#1a1a1a] text-[#555] rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTrade}
                disabled={saving}
                className="flex-1 py-3 bg-[#f0a050] rounded-xl text-sm font-bold uppercase font-mono tracking-wide text-black disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Trade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation layer dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center px-4 pb-8">
          <div className="bg-[#1c1c1e] rounded-2xl w-full max-w-md p-5 border border-[#1a1a1a]">
            <div className="text-center mb-5">
              <div className="text-base font-bold mb-1 text-white font-mono uppercase tracking-wide">Delete Trade Entry?</div>
              <div className="text-[#555] text-xs leading-relaxed">
                This permanent deletion forces a total portfolio baseline replay position rebuild.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 rounded-xl bg-black border border-[#1a1a1a] text-white text-sm font-semibold"
              >
                Keep
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-[#ef4444] rounded-xl text-sm font-bold text-white font-mono uppercase tracking-wide disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}