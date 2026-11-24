import { addCalendarMonths, easternToday } from '@/lib/dates';

export const BALANCE_RANGES = ['1M', '3M', '6M', '1Y', 'All'] as const;
export type BalanceRange = (typeof BALANCE_RANGES)[number];

export interface RetirementSnapshot {
  date: string;
  balance: number;
}

export interface RetirementChange {
  delta: number;
  pct: number | null;
  baselineDate: string;
  baseline: number;
}

export interface RetirementPayload {
  snapshots: RetirementSnapshot[];
  latest: RetirementSnapshot | null;
  changes: {
    '1M': RetirementChange | null;
    '3M': RetirementChange | null;
    '1Y': RetirementChange | null;
  };
}

export function parseRetirementBalance(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function changeOver(snapshots: RetirementSnapshot[], today: string, months: number): RetirementChange | null {
  if (!snapshots.length) return null;
  const latest = snapshots[snapshots.length - 1];
  const cutoff = addCalendarMonths(today, -months);
  let baseline: RetirementSnapshot | null = null;
  for (const snapshot of snapshots) {
    if (snapshot.date <= cutoff) baseline = snapshot;
  }
  if (!baseline || baseline.date === latest.date) return null;
  const delta = latest.balance - baseline.balance;
  const pct = baseline.balance !== 0 ? (delta / baseline.balance) * 100 : null;
  return { delta, pct, baselineDate: baseline.date, baseline: baseline.balance };
}

export function buildRetirementPayload(
  snapshots: RetirementSnapshot[],
  today = easternToday(),
): RetirementPayload {
  const byDate = new Map<string, number>();
  for (const snapshot of snapshots) byDate.set(snapshot.date, snapshot.balance);
  const sorted = Array.from(byDate.entries())
    .map(([date, balance]) => ({ date, balance }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    snapshots: sorted,
    latest: sorted.length ? sorted[sorted.length - 1] : null,
    changes: {
      '1M': changeOver(sorted, today, 1),
      '3M': changeOver(sorted, today, 3),
      '1Y': changeOver(sorted, today, 12),
    },
  };
}

export function filterSnapshots(
  snapshots: RetirementSnapshot[],
  range: BalanceRange,
  today: string,
): RetirementSnapshot[] {
  if (range === 'All') return snapshots;
  const months = range === '1M' ? 1 : range === '3M' ? 3 : range === '6M' ? 6 : 12;
  const cutoff = addCalendarMonths(today, -months);
  return snapshots.filter((snapshot) => snapshot.date >= cutoff);
}

export function isRetirementPayload(value: unknown): value is RetirementPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as RetirementPayload;
  if (!Array.isArray(payload.snapshots) || !payload.changes) return false;
  if (payload.latest !== null) {
    if (!payload.latest || typeof payload.latest.date !== 'string' || typeof payload.latest.balance !== 'number') {
      return false;
    }
  }
  return payload.snapshots.every((snapshot) => (
    snapshot
    && typeof snapshot.date === 'string'
    && typeof snapshot.balance === 'number'
    && Number.isFinite(snapshot.balance)
  ));
}
