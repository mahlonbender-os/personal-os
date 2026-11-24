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
  priceSource?: 'quote' | 'avg_cost';
}

interface Account {
  name: string;
  uninvestedCash: number;
  cashUpdatedAt: string | null;
  stockValue: number;
  totalValue: number;
  holdings: Holding[];
}

interface QuoteTile {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  source: 'quote' | 'avg_cost';
}

interface InvestmentData {
  quotes?: QuoteTile[];
  accounts: Account[];
  totalPortfolioValue: number;
  totalDailyGainLoss: number;
  lastUpdated: string;
}

interface HistoryPoint {
  date: string;
  value: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'investments-data-v4';
const PREVIOUS_CACHE_KEYS = ['investments-data-v2', 'investments-data-v3'];
const HISTORY_CACHE_KEY = 'investments-history-v5';
const RANGES = ['1M', '3M', '6M', '1Y'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShares = (n: number) => n.toFixed(3);

function gainColor(v: number) {
  return v >= 0 ? '#22c55e' : '#ef4444';
}

function formatEasternDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
}

function isCachedInvestmentData(value: unknown): value is InvestmentData {
  if (!value || typeof value !== 'object') return false;
  const data = value as InvestmentData;
  if (!Array.isArray(data.accounts)) return false;
  if (typeof data.totalPortfolioValue !== 'number') return false;
  return data.accounts.every((account) => {
    if (!account || typeof account !== 'object') return false;
    return typeof account.name === 'string'
      && typeof account.uninvestedCash === 'number'
      && (account.cashUpdatedAt === null || typeof account.cashUpdatedAt === 'string')
      && typeof account.totalValue === 'number'
      && Array.isArray(account.holdings);
  });
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
          <line key={i} x1={PL} y1={yS(v).toFixed(1)} x2={W - PR} y2={yS(v).toFixed(1)} stroke="#222" strokeWidth="1" />
        ))}
        {yTicks.map((v, i) => (
          <text key={i} x={PL - 3} y={(yS(v) + 4).toFixed(1)} textAnchor="end" fill="#555" fontSize="7" fontFamily="monospace">
            {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
          </text>
        ))}
        <polygon points={area} fill="url(#areaGrad)" />
        <polyline points={pts} fill="none" stroke={tc} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
  const [data, setData] = useState<InvestmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDaily, setShowDaily] = useState(true);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [historyRange, setHistoryRange] = useState('1Y');

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function fetchData() {
    try {
      const res = await fetch('/api/finance/investments');
      if (!res.ok) return;
      const json = await res.json();
      if (!isCachedInvestmentData(json)) return;
      setData(json);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(json)); } catch {}
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
        if (parsed.ts && Date.now() - parsed.ts < 6 * 60 * 60 * 1000 && parsed.data?.length > 0) {
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
    try { PREVIOUS_CACHE_KEYS.forEach((key) => localStorage.removeItem(key)); } catch {}
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (isCachedInvestmentData(parsed)) {
          setData(parsed);
          setLoading(false);
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      } catch {
        try { localStorage.removeItem(CACHE_KEY); } catch {}
      }
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

  const hasHoldings = (data?.accounts || []).some(a => a.holdings.some(h => parseFloat(String(h.shares)) > 0));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-30 bg-black border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-4 pt-14 pb-3">
          <div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Investments
            </h1>
            <p className="text-[10px] text-[#555] mt-0.5">Live Portfolio Tracker</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(8);
              triggerRefresh();
            }}
            className="text-sm font-semibold text-[#f0a050] active:opacity-70 transition-opacity px-2 py-1"
          >
            Refresh
          </button>
        </div>
      </div>
      <PullToRefresh onRefresh={triggerRefresh}>
        <div>

          {loading && !data ? <Spinner /> : (
            <div className="px-4 pt-4 space-y-3">
                <>
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 text-center">
                    <div className="text-[#888] text-xs font-semibold uppercase tracking-wider mb-1">Total Portfolio</div>
                    <div className="text-3xl font-mono font-bold text-[#22c55e]">{fmt(data?.totalPortfolioValue || 0)}</div>
                    {data?.totalDailyGainLoss !== undefined && data.totalDailyGainLoss !== 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span className="font-mono text-xs" style={{ color: gainColor(data.totalDailyGainLoss) }}>
                          {data.totalDailyGainLoss >= 0 ? '+' : ''}{fmt(data.totalDailyGainLoss)} today
                        </span>
                      </div>
                    )}
                    {data?.lastUpdated && (
                      <div className="text-[#444] text-[10px] font-mono mt-1">
                        Updated {new Date(data.lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold text-white">Position Growth</span>
                      <div className="flex gap-1">
                        {RANGES.map(r => (
                          <button key={r} onClick={() => setHistoryRange(r)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors ${historyRange === r ? 'bg-[#f0a050] text-black' : 'bg-[#1a1a1a] text-[#555]'}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <PortfolioChart points={historyData} range={historyRange} />
                  </div>

                  {(data?.quotes || []).length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {(data?.quotes || []).map(t => (
                        <div key={t.symbol} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                          <div className="text-[#f0a050] text-xs font-mono font-bold">{t.symbol}</div>
                          <div className="text-[#555] text-[10px] mb-1.5">{t.source === 'avg_cost' ? 'Avg cost' : 'Live quote'}</div>
                          <div className="text-white font-mono font-bold text-sm">{fmt(t.price || 0)}</div>
                          {t.source === 'quote' && t.change !== 0 && (
                            <div className="font-mono text-[10px] mt-0.5" style={{ color: gainColor(t.change) }}>
                              {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)} ({t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {hasHoldings && (
                    <div className="flex items-center justify-between px-1 pt-1">
                      <span className="text-[#555] text-xs font-semibold uppercase tracking-wider">Holdings</span>
                      <div className="flex bg-[#1a1a1a] rounded-full p-0.5">
                        {['Overall', 'Today'].map(label => (
                          <button key={label} onClick={() => setShowDaily(label === 'Today')}
                            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${(label === 'Today') === showDaily ? 'bg-[#f0a050] text-black' : 'text-[#555]'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(data?.accounts || []).map((acc, i) => (
                    <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-[#1a1a1a]">
                        <span className="text-sm font-bold">{acc.name}</span>
                        <span className="font-mono font-bold text-[#22c55e]">{fmt(acc.totalValue)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/40 border border-[#1a1a1a] rounded-xl p-3">
                          <div className="text-[#555] text-[10px] uppercase mb-1">Uninvested Cash</div>
                          <div className="font-mono text-white text-sm font-bold">{acc.uninvestedCash < 0 ? '-' : ''}{fmt(acc.uninvestedCash)}</div>
                          <div className="text-[#444] text-[10px] font-mono mt-1">as of {formatEasternDate(acc.cashUpdatedAt)}</div>
                        </div>
                        <div className="bg-black/40 border border-[#1a1a1a] rounded-xl p-3">
                          <div className="text-[#555] text-[10px] uppercase mb-1">Market Value</div>
                          <div className="font-mono text-white text-sm font-bold">{fmt(acc.stockValue)}</div>
                        </div>
                      </div>
                      {acc.holdings.some(h => parseFloat(String(h.shares)) > 0) ? (
                        <div className="space-y-2">
                          {acc.holdings.filter(h => parseFloat(String(h.shares)) > 0).map((h, j) => {
                            const gl = showDaily ? h.dailyGainLoss : h.gainLoss;
                            const glPct = showDaily ? h.dailyGainLossPct : h.gainLossPct;
                            return (
                              <div key={j} className="flex justify-between items-center bg-black/20 border border-[#151515] rounded-xl p-3">
                                <div>
                                  <div className="text-[#f0a050] text-xs font-mono font-bold">{h.symbol}</div>
                                  <div className="text-[#555] text-[10px] font-mono">{fmtShares(h.shares)} shares</div>
                                  <div className="text-[#555] text-[10px] font-mono">avg {fmt(h.avgCost)}{h.priceSource === 'avg_cost' ? ' · price unavailable' : ''}</div>
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
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
