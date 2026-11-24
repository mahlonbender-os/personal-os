'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import TrendLine from '@/components/TrendLine';
import { easternToday, formatLongDate } from '@/lib/dates';
import {
  BALANCE_RANGES,
  filterSnapshots,
  isRetirementPayload,
  type BalanceRange,
  type RetirementChange,
  type RetirementPayload,
} from '@/lib/retirement';

const CACHE_KEY = 'retirement-401k-v1';

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function signedMoney(value: number): string {
  const body = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function signedPct(value: number): string {
  const body = `${Math.abs(value).toFixed(1)}%`;
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function readCache(): RetirementPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; data?: unknown };
    if (parsed.v !== 1 || !isRetirementPayload(parsed.data)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: RetirementPayload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, data }));
  } catch {
    // Ignore a full cache.
  }
}

function ChangeCell({ label, change }: { label: string; change: RetirementChange | null }) {
  const tone = !change || change.delta === 0 ? '#555' : change.delta > 0 ? '#22c55e' : '#ef4444';
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-3 text-center">
      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">{label}</p>
      {change ? (
        <>
          <p className="text-sm font-mono font-bold mt-1" style={{ color: tone }}>{signedMoney(change.delta)}</p>
          {change.pct != null && (
            <p className="text-[10px] font-mono mt-0.5" style={{ color: tone }}>{signedPct(change.pct)}</p>
          )}
        </>
      ) : (
        <p className="text-sm font-mono font-bold text-[#444] mt-1">—</p>
      )}
    </div>
  );
}

export default function RetirementPage() {
  const [data, setData] = useState<RetirementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<'unauthorized' | 'error' | null>(null);
  const [range, setRange] = useState<BalanceRange>('1Y');
  const today = easternToday();
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const cached = readCache();
    try {
      const res = await fetch('/api/retirement');
      if (id !== requestId.current) return;
      if (res.status === 401) {
        setData(null);
        setProblem('unauthorized');
        try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
        return;
      }
      if (!res.ok) {
        if (!cached) setProblem('error');
        return;
      }
      const json: unknown = await res.json();
      if (id !== requestId.current) return;
      if (!isRetirementPayload(json)) {
        if (!cached) setProblem('error');
        return;
      }
      setData(json);
      setProblem(null);
      writeCache(json);
    } catch {
      if (id !== requestId.current) return;
      if (!cached) setProblem('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setData(cached);
      setLoading(false);
      setProblem(null);
    }
    load();
  }, [load]);

  const latest = data?.latest ?? null;
  const shown = data ? filterSnapshots(data.snapshots, range, today) : [];
  const withYear = range === '1Y' || range === 'All';

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-30 bg-black border-b border-[#1a1a1a]">
        <div className="px-4 pt-14 pb-3">
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            401(k)
          </h1>
          <p className="text-[10px] text-[#555] mt-0.5">Fidelity</p>
        </div>
      </div>

      <PullToRefresh onRefresh={load}>
        <div className="px-4 pt-4 space-y-3">
          {loading && !data ? (
            <div className="flex justify-center pt-16">
              <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : problem === 'unauthorized' ? (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 text-center text-sm text-[#555]">
              Sign in to see your 401(k).
            </div>
          ) : problem === 'error' && !data ? (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 text-center text-sm text-[#555]">
              Couldn&apos;t load the 401(k).
            </div>
          ) : !latest ? (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 text-center">
              <p className="text-sm text-[#888]">Updates daily from Fidelity</p>
            </div>
          ) : (
            <>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 text-center">
                <div className="text-[#888] text-xs font-semibold uppercase tracking-wider mb-1">Current Balance</div>
                <div className="text-3xl font-mono font-bold text-white">{money(latest.balance)}</div>
                <div className="text-[#555] text-[11px] font-mono mt-1">as of {formatLongDate(latest.date)}</div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <ChangeCell label="1M" change={data?.changes['1M'] ?? null} />
                <ChangeCell label="3M" change={data?.changes['3M'] ?? null} />
                <ChangeCell label="1Y" change={data?.changes['1Y'] ?? null} />
              </div>
              {!data?.changes['1M'] && !data?.changes['3M'] && !data?.changes['1Y'] && (
                <p className="text-[10px] text-[#555] text-center">Change shows once an older balance is on file.</p>
              )}

              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                <div className="flex justify-between items-center mb-3 gap-2">
                  <span className="text-xs font-semibold text-white">Balance</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {BALANCE_RANGES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setRange(item)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors ${
                          range === item ? 'bg-[#f0a050] text-black' : 'bg-[#1a1a1a] text-[#555]'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                {shown.length === 0 ? (
                  <p className="text-[11px] text-[#555] py-6 text-center">No balance in this range</p>
                ) : (
                  <TrendLine
                    points={shown.map((snapshot) => ({ date: snapshot.date, value: snapshot.balance }))}
                    color="#f0a050"
                    label="401(k) balance"
                    withYear={withYear}
                    formatValue={(value) => {
                      const abs = Math.abs(value);
                      if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`;
                      return money(value);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
