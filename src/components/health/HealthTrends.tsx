'use client';

import { useEffect, useState } from 'react';
import TrendLine from '@/components/TrendLine';
import {
  formatMetricValue,
  HEALTH_RANGES,
  isHealthTrendsPayload,
  priorPeriodLabel,
  TREND_METRICS,
  type HealthRange,
  type HealthTrendsPayload,
  type TrendMetric,
} from '@/lib/healthTrends';

const CACHE_KEY = 'health-trends-v1';

type TrendPoint = { date: string; value: number };

function readCache(range: HealthRange): HealthTrendsPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; byRange?: Partial<Record<HealthRange, unknown>> };
    if (parsed.v !== 1 || !parsed.byRange) return null;
    const payload = parsed.byRange[range];
    return isHealthTrendsPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

function writeCache(range: HealthRange, payload: HealthTrendsPayload) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) as { v?: number; byRange?: Partial<Record<HealthRange, HealthTrendsPayload>> } : null;
    const byRange = parsed?.v === 1 && parsed.byRange ? parsed.byRange : {};
    byRange[range] = payload;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, byRange }));
  } catch {
    // A full cache is not worth blocking the charts.
  }
}

function pointsFor(rows: HealthTrendsPayload['rows'], key: TrendMetric['key']): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const row of rows) {
    const value = row[key];
    if (value == null || !Number.isFinite(value)) continue;
    points.push({ date: row.date, value });
  }
  return points;
}

function MetricCard({
  metric,
  payload,
}: {
  metric: TrendMetric;
  payload: HealthTrendsPayload;
}) {
  const comparison = payload.comparison[metric.key];
  if (comparison.current == null) return null;
  const points = pointsFor(payload.rows, metric.key);
  const delta = comparison.previous == null ? null : comparison.current - comparison.previous;
  const pct = comparison.previous != null && comparison.previous !== 0 && delta != null
    ? (delta / comparison.previous) * 100
    : null;
  const tone = delta == null || delta === 0 ? '#555' : delta > 0 ? '#22c55e' : '#ef4444';
  const signed = delta == null
    ? ''
    : `${delta > 0 ? '+' : delta < 0 ? '-' : ''}${formatMetricValue(Math.abs(delta), metric.decimals)}`;
  const signedPct = pct == null
    ? ''
    : `${pct > 0 ? '+' : pct < 0 ? '-' : ''}${Math.abs(pct).toFixed(1)}%`;

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">{metric.label}</p>
      <p className="text-xl font-mono font-bold mt-1" style={{ color: metric.color }}>
        {formatMetricValue(comparison.current, metric.decimals)}
        {metric.unit ? <span className="text-xs text-[#555] font-sans font-normal"> {metric.unit}</span> : null}
      </p>
      <p className="text-[10px] text-[#444] mt-0.5">Daily average</p>
      <p className="text-[11px] font-mono mt-1" style={{ color: tone }}>
        {delta == null
          ? 'No earlier period'
          : `${signed}${signedPct ? ` (${signedPct})` : ''} vs ${priorPeriodLabel(payload.range)}`}
      </p>
      <div className="mt-3">
        <TrendLine
          points={points}
          color={metric.color}
          label={`${metric.label} trend`}
          withYear={payload.range === '1Y'}
          formatValue={(value) => formatMetricValue(value, metric.decimals)}
        />
      </div>
      {comparison.samples > 0 && (payload.range === '1Y' ? comparison.samples < 40 : comparison.samples < 15) && (
        <p className="text-[10px] text-[#444] mt-2">{comparison.samples} readings in this range</p>
      )}
    </div>
  );
}

export default function HealthTrends({ refreshKey }: { refreshKey: number }) {
  const [range, setRange] = useState<HealthRange>('30D');
  const [payload, setPayload] = useState<HealthTrendsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<'unauthorized' | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache(range);
    if (cached) {
      setPayload(cached);
      setLoading(false);
      setProblem(null);
    } else {
      setPayload(null);
      setLoading(true);
    }

    (async () => {
      try {
        const res = await fetch(`/api/health/trends?range=${range}`);
        if (cancelled) return;
        if (res.status === 401) {
          setPayload(null);
          setProblem('unauthorized');
          try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
          return;
        }
        if (!res.ok) {
          if (!cached) setProblem('error');
          return;
        }
        const json: unknown = await res.json();
        if (!isHealthTrendsPayload(json) || json.range !== range) {
          if (!cached) setProblem('error');
          return;
        }
        setPayload(json);
        setProblem(null);
        writeCache(range, json);
      } catch {
        if (!cancelled && !cached) setProblem('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range, refreshKey]);

  const visible = payload
    ? TREND_METRICS.filter((metric) => payload.comparison[metric.key]?.current != null)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Range</p>
        <div className="flex gap-1">
          {HEALTH_RANGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors ${
                range === item ? 'bg-[#f0a050] text-black' : 'bg-[#1a1a1a] text-[#555]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {payload?.grain === 'week' && (
        <p className="text-[10px] text-[#555]">Each point is a weekly average.</p>
      )}

      {loading && !payload ? (
        <div className="flex justify-center pt-10">
          <div className="w-5 h-5 border-2 border-[#f0a050] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : problem === 'unauthorized' ? (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center text-[#555] text-sm">
          Sign in to see trends.
        </div>
      ) : problem === 'error' && !payload ? (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center text-[#555] text-sm">
          Couldn&apos;t load trends.
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center text-[#555] text-sm">
          No health history in this range.
        </div>
      ) : (
        visible.map((metric) => (
          <MetricCard key={metric.key} metric={metric} payload={payload as HealthTrendsPayload} />
        ))
      )}
    </div>
  );
}
