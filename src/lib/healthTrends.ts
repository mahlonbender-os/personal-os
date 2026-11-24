import { addCalendarDays, easternToday, weekStart } from '@/lib/dates';

export const HEALTH_RANGES = ['30D', '90D', '1Y'] as const;
export type HealthRange = (typeof HEALTH_RANGES)[number];

export const TREND_METRICS = [
  { key: 'steps', label: 'Steps', unit: '', decimals: 0, color: '#60a5fa' },
  { key: 'active_calories', label: 'Active Energy', unit: 'kcal', decimals: 0, color: '#ef4444' },
  { key: 'activity_minutes', label: 'Exercise', unit: 'min', decimals: 0, color: '#22c55e' },
  { key: 'distance_mi', label: 'Distance', unit: 'mi', decimals: 2, color: '#34d399' },
  { key: 'flights_climbed', label: 'Flights', unit: 'floors', decimals: 0, color: '#f472b6' },
  { key: 'stand_hours', label: 'Stand', unit: 'hrs', decimals: 1, color: '#fb923c' },
  { key: 'sleep_hours', label: 'Sleep', unit: 'hrs', decimals: 1, color: '#818cf8' },
  { key: 'resting_heart_rate', label: 'Resting Heart Rate', unit: 'bpm', decimals: 0, color: '#ef4444' },
  { key: 'hrv', label: 'HRV', unit: 'ms', decimals: 0, color: '#c084fc' },
  { key: 'heart_rate_avg', label: 'Avg Heart Rate', unit: 'bpm', decimals: 0, color: '#f87171' },
  { key: 'spo2', label: 'Blood Oxygen', unit: '%', decimals: 1, color: '#38bdf8' },
  { key: 'respiratory_rate', label: 'Respiratory Rate', unit: '/min', decimals: 1, color: '#2dd4bf' },
  { key: 'vo2_max', label: 'VO₂ Max', unit: 'ml/kg/min', decimals: 1, color: '#34d399' },
] as const;

export type TrendMetric = (typeof TREND_METRICS)[number];
export type TrendMetricKey = TrendMetric['key'];

export interface HealthTrendRow {
  date: string;
  steps: number | null;
  active_calories: number | null;
  activity_minutes: number | null;
  distance_mi: number | null;
  flights_climbed: number | null;
  stand_hours: number | null;
  sleep_hours: number | null;
  resting_heart_rate: number | null;
  hrv: number | null;
  heart_rate_avg: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  vo2_max: number | null;
}

export interface MetricComparison {
  current: number | null;
  previous: number | null;
  samples: number;
  previousSamples: number;
}

export interface HealthTrendsPayload {
  range: HealthRange;
  grain: 'day' | 'week';
  from: string;
  to: string;
  rows: HealthTrendRow[];
  comparison: Record<TrendMetricKey, MetricComparison>;
}

export interface HealthLogInput {
  log_date: string;
  steps: unknown;
  active_calories: unknown;
  activity_minutes: unknown;
  distance_km: unknown;
  flights_climbed: unknown;
  stand_hours: unknown;
  sleep_total_hours: unknown;
  sleep_duration_minutes: unknown;
  resting_heart_rate: unknown;
  hrv: unknown;
  heart_rate_avg: unknown;
  spo2: unknown;
  respiratory_rate: unknown;
  vo2_max: unknown;
}

const MILES_PER_KM = 0.621371;

export function parseHealthRange(value: string | null): HealthRange | null {
  if (value === '30D' || value === '90D' || value === '1Y') return value;
  return null;
}

/** NUMERIC columns arrive as strings. parseFloat keeps the real value. */
export function parseHealthNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function toHealthTrendRow(input: HealthLogInput): HealthTrendRow {
  const sleepHours = parseHealthNumber(input.sleep_total_hours);
  const sleepMinutes = parseHealthNumber(input.sleep_duration_minutes);
  const kilometers = parseHealthNumber(input.distance_km);
  return {
    date: String(input.log_date).slice(0, 10),
    steps: parseHealthNumber(input.steps),
    active_calories: parseHealthNumber(input.active_calories),
    activity_minutes: parseHealthNumber(input.activity_minutes),
    distance_mi: kilometers == null ? null : kilometers * MILES_PER_KM,
    flights_climbed: parseHealthNumber(input.flights_climbed),
    stand_hours: parseHealthNumber(input.stand_hours),
    sleep_hours: sleepHours != null ? sleepHours : sleepMinutes == null ? null : sleepMinutes / 60,
    resting_heart_rate: parseHealthNumber(input.resting_heart_rate),
    hrv: parseHealthNumber(input.hrv),
    heart_rate_avg: parseHealthNumber(input.heart_rate_avg),
    spo2: parseHealthNumber(input.spo2),
    respiratory_rate: parseHealthNumber(input.respiratory_rate),
    vo2_max: parseHealthNumber(input.vo2_max),
  };
}

export function rangeSpan(range: HealthRange): number {
  if (range === '30D') return 30;
  if (range === '90D') return 90;
  return 365;
}

/** First day of the previous period, so one query covers both windows. */
export function trendQueryStart(range: HealthRange, today: string): string {
  return addCalendarDays(today, -(rangeSpan(range) * 2 - 1));
}

function uniqueDays(rows: HealthTrendRow[]): HealthTrendRow[] {
  const byDate = new Map<string, HealthTrendRow>();
  for (const row of rows) byDate.set(row.date, row);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function summarize(rows: HealthTrendRow[], key: TrendMetricKey): { avg: number | null; samples: number } {
  let sum = 0;
  let samples = 0;
  for (const row of rows) {
    const value = row[key];
    if (value == null || !Number.isFinite(value)) continue;
    sum += value;
    samples += 1;
  }
  return { avg: samples ? sum / samples : null, samples };
}

export function downsampleWeekly(rows: HealthTrendRow[]): HealthTrendRow[] {
  const groups = new Map<string, HealthTrendRow[]>();
  for (const row of rows) {
    const key = weekStart(row.date);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, days]) => {
      const point = { date: days[days.length - 1].date } as HealthTrendRow;
      for (const metric of TREND_METRICS) {
        point[metric.key] = summarize(days, metric.key).avg;
      }
      return point;
    });
}

export function buildHealthTrends(
  rows: HealthTrendRow[],
  range: HealthRange,
  today = easternToday(),
): HealthTrendsPayload {
  const days = rangeSpan(range);
  const from = addCalendarDays(today, -(days - 1));
  const previousTo = addCalendarDays(from, -1);
  const previousFrom = addCalendarDays(previousTo, -(days - 1));
  const daily = uniqueDays(rows);
  const currentRows = daily.filter((row) => row.date >= from && row.date <= today);
  const previousRows = daily.filter((row) => row.date >= previousFrom && row.date <= previousTo);
  const comparison = {} as Record<TrendMetricKey, MetricComparison>;
  for (const metric of TREND_METRICS) {
    const current = summarize(currentRows, metric.key);
    const previous = summarize(previousRows, metric.key);
    comparison[metric.key] = {
      current: current.avg,
      previous: previous.avg,
      samples: current.samples,
      previousSamples: previous.samples,
    };
  }
  return {
    range,
    grain: range === '1Y' ? 'week' : 'day',
    from,
    to: today,
    rows: range === '1Y' ? downsampleWeekly(currentRows) : currentRows,
    comparison,
  };
}

export function isHealthTrendsPayload(value: unknown): value is HealthTrendsPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as HealthTrendsPayload;
  if (payload.range !== '30D' && payload.range !== '90D' && payload.range !== '1Y') return false;
  if (payload.grain !== 'day' && payload.grain !== 'week') return false;
  if (!Array.isArray(payload.rows) || !payload.comparison) return false;
  return TREND_METRICS.every((metric) => {
    const comparison = payload.comparison[metric.key];
    return !!comparison && ('current' in comparison) && ('previous' in comparison);
  });
}

export function formatMetricValue(value: number, decimals: number): string {
  if (decimals === 0) return Math.round(value).toLocaleString('en-US');
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function priorPeriodLabel(range: HealthRange): string {
  if (range === '30D') return 'prior 30 days';
  if (range === '90D') return 'prior 90 days';
  return 'prior year';
}
