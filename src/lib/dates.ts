export type Precision = 'month' | 'day' | 'minute';

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
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

export function offsetMinutes(timezone: string | undefined): number {
  if (!timezone) return 0;
  const tz = timezone.trim();
  if (tz === 'AoE' || tz === 'AOE') return 12 * 60;
  if (tz === 'UTC' || tz === 'GMT' || tz === 'local') return 0;
  const match = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
  if (!match) return 0;
  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes ?? 0);
  return sign === '+' ? total : -total;
}

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

export function formatDate(value: string | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '';
  if (parsed.precision === 'month') {
    return `${MONTHS_LONG[parsed.month - 1]} ${parsed.year}`;
  }
  return `${MONTHS_SHORT[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
}

function formatTime(value: string | undefined | null): string {
  const parsed = parseDate(value);
  if (!parsed || parsed.precision !== 'minute') return '';
  return `${pad(parsed.hour)}:${pad(parsed.minute)}`;
}

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

export function relativeDeadline(instant: number, now: number): string {
  const days = Math.floor((instant - now) / 86_400_000);
  if (days < 0) return 'closed';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 45) return `in ${days} days`;
  return '';
}

export function mondayFirstWeekday(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsDay + 6) % 7;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

export function todayKey(now: Date = new Date()): string {
  return toDayKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
