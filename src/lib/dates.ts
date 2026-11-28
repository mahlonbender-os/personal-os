const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calendar date in America/New_York, as YYYY-MM-DD. */
export function easternToday(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
}

/** Shift a YYYY-MM-DD calendar date by whole days, without a timezone hop. */
export function addCalendarDays(iso: string, days: number): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD calendar date by whole months, clamping the day. */
export function addCalendarMonths(iso: string, delta: number): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = ((total % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const nextDay = Math.min(day || 1, daysInMonth);
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

/** Monday on or before this calendar date. */
export function weekStart(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function formatAxisDate(iso: string, withYear: boolean): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1] || '';
  if (withYear) return `${month} '${match[1].slice(2)}`;
  return `${month} ${Number(match[3])}`;
}

export function formatLongDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1] || '';
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

/** "Nov 27" from YYYY-MM-DD. 17:00 UTC matches formatEasternDate so the Eastern day does not shift. */
export function formatEasternMonthDay(value: string): string {
  const day = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return value;
  const stamp = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 17, 0, 0));
  return stamp.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
}
