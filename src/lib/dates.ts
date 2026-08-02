/**
 * Date handling for the whole site.
 *
 * Two rules keep this predictable:
 *
 * 1. Dates are formatted from their own digits, never through `Date`
 *    formatting. The build machine and the reader's browser sit in different
 *    timezones, and a deadline written `2026-07-09` must read as 9 July in
 *    both.
 * 2. Comparisons go through `instantOf`, which converts a wall-clock time plus
 *    a timezone into an absolute moment. That is the only place an offset is
 *    applied.
 *
 * Client-safe: no imports beyond types.
 */

export type Precision = 'month' | 'day' | 'minute';

export interface ParsedDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31, set to 1 when precision is 'month'
  hour: number;
  minute: number;
  precision: Precision;
}

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const WEEKDAYS_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DATE_PATTERN =
  /^(\d{4})-(\d{2})(?:-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?)?$/;

/** Accepts `YYYY-MM`, `YYYY-MM-DD`, and `YYYY-MM-DDTHH:MM[:SS]`. */
export function parseDate(value: string | undefined | null): ParsedDate | null {
  if (!value) return null;
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, y, mo, d, h, mi] = match;
  const year = Number(y);
  const month = Number(mo);
  if (month < 1 || month > 12) return null;

  if (d === undefined) {
    return { year, month, day: 1, hour: 0, minute: 0, precision: 'month' };
  }

  const day = Number(d);
  if (day < 1 || day > daysInMonth(year, month)) return null;

  if (h === undefined || mi === undefined) {
    return { year, month, day, hour: 0, minute: 0, precision: 'day' };
  }

  const hour = Number(h);
  const minute = Number(mi);
  if (hour > 23 || minute > 59) return null;

  return { year, month, day, hour, minute, precision: 'minute' };
}

export function isValidDate(value: string | undefined | null): boolean {
  return parseDate(value) !== null;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Minutes to add to a wall-clock time to reach UTC. */
export function offsetMinutes(timezone: string | undefined): number {
  if (!timezone) return 0;
  const tz = timezone.trim();
  // Anywhere on Earth: the deadline has not passed until it has passed
  // everywhere, which is UTC-12.
  if (tz === 'AoE' || tz === 'AOE') return 12 * 60;
  if (tz === 'UTC' || tz === 'GMT' || tz === 'local') return 0;
  const match = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
  if (!match) return 0;
  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes ?? 0);
  return sign === '+' ? total : -total;
}

/**
 * Absolute moment, in epoch milliseconds, that a wall-clock date in the given
 * timezone refers to. `endOfDay` fills in 23:59 for dates written without a
 * time, which is what a bare deadline date means in practice.
 */
export function instantOf(
  value: string | undefined | null,
  timezone?: string,
  endOfDay = false,
): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;

  let { hour, minute } = parsed;
  let { day } = parsed;

  if (parsed.precision === 'month') {
    day = endOfDay ? daysInMonth(parsed.year, parsed.month) : 1;
  }
  if (parsed.precision !== 'minute' && endOfDay) {
    hour = 23;
    minute = 59;
  }

  const utc = Date.UTC(parsed.year, parsed.month - 1, day, hour, minute);
  return utc + offsetMinutes(timezone) * 60_000;
}

/** `YYYY-MM-DD` for calendar bucketing. Null for month-precision dates. */
export function dayKey(value: string | undefined | null): string | null {
  const parsed = parseDate(value);
  if (!parsed || parsed.precision === 'month') return null;
  return toDayKey(parsed.year, parsed.month, parsed.day);
}

export function toDayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `Aug 14, 2026`, or `August 2026` when only the month is known. */
export function formatDate(value: string | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '';
  if (parsed.precision === 'month') {
    return `${MONTHS_LONG[parsed.month - 1]} ${parsed.year}`;
  }
  return `${MONTHS_SHORT[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
}

/** `23:59` when the entry carries a time, empty otherwise. */
function formatTime(value: string | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed || parsed.precision !== 'minute') return '';
  return `${pad(parsed.hour)}:${pad(parsed.minute)}`;
}

/** `Aug 14, 2026 · 23:59 AoE`. */
export function formatDeadline(
  value: string | undefined | null,
  timezone?: string,
): string {
  const date = formatDate(value);
  if (!date) return '';
  const time = formatTime(value);
  if (!time) return date;
  return `${date} · ${time}${timezone ? ` ${timezone}` : ''}`;
}

/** `June 15 to 26, 2027`, collapsing whatever the two dates share. */
export function formatDateRange(
  start: string | undefined | null,
  end: string | undefined | null,
): string {
  const a = parseDate(start);
  const b = parseDate(end);

  if (!a) return b ? formatDate(end) : '';

  const startMonth = MONTHS_LONG[a.month - 1];

  if (!b) {
    if (a.precision === 'month') return `${startMonth} ${a.year}`;
    return `${startMonth} ${a.day}, ${a.year}`;
  }

  const endMonth = MONTHS_LONG[b.month - 1];

  if (a.precision === 'month' || b.precision === 'month') {
    if (a.year === b.year && a.month === b.month) return `${startMonth} ${a.year}`;
    if (a.year === b.year) return `${startMonth} to ${endMonth} ${a.year}`;
    return `${startMonth} ${a.year} to ${endMonth} ${b.year}`;
  }

  if (a.year === b.year && a.month === b.month) {
    if (a.day === b.day) return `${startMonth} ${a.day}, ${a.year}`;
    return `${startMonth} ${a.day} to ${b.day}, ${a.year}`;
  }
  if (a.year === b.year) {
    return `${startMonth} ${a.day} to ${endMonth} ${b.day}, ${a.year}`;
  }
  return `${MONTHS_SHORT[a.month - 1]} ${a.day}, ${a.year} to ${MONTHS_SHORT[b.month - 1]} ${b.day}, ${b.year}`;
}

export function monthName(month: number): string {
  return MONTHS_LONG[month - 1] ?? '';
}

export function formatMonthYear(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

/** The short `in 12 days` hint beside an imminent deadline. */
export function relativeDeadline(instant: number, now: number): string {
  const days = Math.floor((instant - now) / 86_400_000);
  if (days < 0) return 'closed';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 45) return `in ${days} days`;
  return '';
}

/** Weekday index with Monday as 0, matching `WEEKDAYS_SHORT`. */
export function mondayFirstWeekday(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsDay + 6) % 7;
}

/** Steps a year/month pair by whole months. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

/** Today in the reader's own timezone, as a `YYYY-MM-DD` key. */
export function todayKey(now: Date = new Date()): string {
  return toDayKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
