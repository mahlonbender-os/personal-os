'use client';

import { useMemo, useState } from 'react';

export interface NetWorthPoint {
  date: string;
  net_worth: number;
  mahlon_net_worth?: number;
}

export interface FlowMonth {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number | null;
}

const RANGES = ['1M', '3M', '6M', '1Y', 'All'] as const;
type Range = (typeof RANGES)[number];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(Number(n) || 0));
}

function addMonths(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d || 1, dim);
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = names[Number(m) - 1] || '';
  if (!d) return `${month} ${y}`;
  return `${month} ${Number(d)}`;
}

function shortMonth(ym: string): string {
  return shortDate(`${ym}-01`).split(' ')[0];
}

export function NetWorthTrend({
  points,
  source,
}: {
  points: NetWorthPoint[];
  source?: 'daily' | 'balances';
}) {
  const [range, setRange] = useState<Range>('All');
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });

  const shown = useMemo(() => {
    const sorted = [...points]
      .filter((p) => p && /^\d{4}-\d{2}-\d{2}/.test(p.date) && Number.isFinite(Number(p.net_worth)))
      .map((p) => ({ ...p, net_worth: Number(p.net_worth), mahlon_net_worth: Number(p.mahlon_net_worth) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (range === 'All') return sorted;
    const months = range === '1M' ? 1 : range === '3M' ? 3 : range === '6M' ? 6 : 12;
    const cutoff = addMonths(today, -months);
    const filtered = sorted.filter((p) => p.date >= cutoff);
    return filtered.length ? filtered : sorted.slice(-1);
  }, [points, range, today]);

  const hasMahlon = shown.some((p) => Number.isFinite(p.mahlon_net_worth));
  const values = shown.flatMap((p) => hasMahlon ? [p.net_worth, p.mahlon_net_worth || 0] : [p.net_worth]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min || 1;
  const width = 320;
  const height = 120;
  const pad = 12;

  function xy(index: number, value: number) {
    const x = shown.length === 1
      ? width / 2
      : pad + (index / (shown.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return { x, y };
  }

  const line = (key: 'net_worth' | 'mahlon_net_worth') => shown.map((p, i) => {
    const point = xy(i, key === 'net_worth' ? p.net_worth : (p.mahlon_net_worth || 0));
    return `${point.x},${point.y}`;
  }).join(' ');

  const first = shown[0];
  const last = shown[shown.length - 1];
  const delta = first && last ? last.net_worth - first.net_worth : 0;

  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">Net Worth Trend</p>
        <div className="flex gap-1">
          {RANGES.map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
                range === item
                  ? 'bg-[#f0a050]/15 border-[#f0a050]/40 text-[#f0a050]'
                  : 'border-[#2a2a2a] text-[#555]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-[11px] text-[#555] py-6 text-center">No snapshots yet</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
            <polyline fill="none" stroke="#f0a050" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={line('net_worth')} />
            {hasMahlon && (
              <polyline fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={line('mahlon_net_worth')} />
            )}
            {shown.map((p, i) => {
              const point = xy(i, p.net_worth);
              const mark = shown.length < 24 || i === 0 || i === shown.length - 1;
              if (!mark) return null;
              return <circle key={p.date} cx={point.x} cy={point.y} r="3.5" fill="#111" stroke="#f0a050" strokeWidth="2" />;
            })}
          </svg>
          <div className="flex justify-between text-[10px] text-[#555] font-mono mt-1">
            <span>{fmt(min)}</span>
            <span>{fmt(max)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-[#444] mt-1">
            <span>{shortDate(first.date)}</span>
            {shown.length > 1 && (
              <span className={`font-mono ${delta >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{fmt(delta)}</span>
            )}
            <span>{shortDate(last.date)}</span>
          </div>
        </>
      )}

      <div className="flex items-center gap-4 text-[10px] text-[#555] mt-3">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#f0a050]" /><span>Sheet net worth</span></div>
        {hasMahlon && (
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /><span>Mahlon only</span></div>
        )}
      </div>
      <p className="text-[10px] text-[#444] mt-2">
        {source === 'daily'
          ? 'Daily snapshots'
          : 'Month-end history from the Finance sheet, until daily snapshots arrive'}
      </p>
    </div>
  );
}

export function MonthlyFlowTrend({ months }: { months: FlowMonth[] }) {
  if (!months.length) return null;
  const maxVal = Math.max(...months.map((m) => Math.max(m.income, m.expenses, 1)));
  return (
    <div className="rounded-2xl bg-[#111] border border-[#1a1a1a] p-4">
      <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Income, Spending, Savings Rate</p>
      <div className="flex items-end gap-2 h-28 mb-3">
        {months.map((m) => {
          const incH = Math.max((m.income / maxVal) * 100, 2);
          const expH = Math.max((m.expenses / maxVal) * 100, 2);
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
              <div className="w-full flex items-end justify-center gap-1 flex-1">
                <div className="w-2 rounded-t-sm bg-[#22c55e]" style={{ height: `${incH}%` }} />
                <div className="w-2 rounded-t-sm bg-[#ef4444]" style={{ height: `${expH}%` }} />
              </div>
              <span className="text-[9px] text-[#444] font-semibold uppercase mt-1">{shortMonth(m.month)}</span>
            </div>
          );
        })}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {months.map((m) => {
          const rate = m.savingsRate;
          const rateColor = rate == null ? 'text-[#555]' : rate >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';
          return (
            <div key={`${m.month}-n`} className="min-w-0 text-center">
              <p className="text-[9px] font-mono text-[#22c55e] leading-tight truncate">{fmt(m.income)}</p>
              <p className="text-[9px] font-mono text-[#ef4444] leading-tight truncate">{fmt(m.expenses)}</p>
              <p className={`text-[9px] font-mono leading-tight ${rateColor}`}>
                {rate == null ? '—' : `${Math.abs(rate).toFixed(1)}%`}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-[#555] mt-3">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /><span>Income</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /><span>Spending</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#888]" /><span>Savings rate</span></div>
      </div>
    </div>
  );
}
