/**
 * iCalendar output (RFC 5545).
 *
 * Everything is published as an all-day event on the date written in the data
 * file, with the exact time and timezone in the description. A deadline of
 * `23:59 AoE` on 9 July should read as 9 July in every calendar client, and
 * all-day entries are the only representation that survives a reader in
 * Auckland and a reader in Vancouver looking at the same feed.
 *
 * Build-time only.
 */

import { daysInMonth, parseDate } from './dates.ts';

export interface IcsEvent {
  /** Stable identifier. Must not change between builds. */
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  categories?: string[];
  /** First day, `YYYY-MM-DD`. */
  start: string;
  /** Last day, inclusive. Defaults to `start`. */
  end?: string;
}

export interface IcsCalendar {
  name: string;
  description: string;
  events: IcsEvent[];
  /** Build time, used for DTSTAMP. */
  stamp?: Date;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `YYYYMMDD` from a `YYYY-MM-DD` or `YYYY-MM` string. */
function icsDate(value: string, endOfMonth = false): string | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const day =
    parsed.precision === 'month'
      ? endOfMonth
        ? daysInMonth(parsed.year, parsed.month)
        : 1
      : parsed.day;
  return `${parsed.year}${pad(parsed.month)}${pad(day)}`;
}

/** DTEND on an all-day event is exclusive, so it points at the following day. */
function dayAfter(value: string): string | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const day =
    parsed.precision === 'month' ? daysInMonth(parsed.year, parsed.month) : parsed.day;
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, day + 1));
  return `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`;
}

function icsStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Escapes the characters RFC 5545 gives meaning to inside a TEXT value. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Folds a content line to 75 octets. Counting is done in bytes rather than
 * characters so that non-ASCII venue names fold at a legal boundary.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      out.push(current);
      current = char;
      bytes = size;
      limit = 74; // continuation lines carry a leading space
    } else {
      current += char;
      bytes += size;
    }
  }
  out.push(current);

  return out.join('\r\n ');
}

export function buildCalendar(calendar: IcsCalendar): string {
  const stamp = icsStamp(calendar.stamp ?? new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PLFM//Programming Languages and Formal Methods Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-CALDESC:${escapeText(calendar.description)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
  ];

  for (const event of calendar.events) {
    const start = icsDate(event.start);
    if (!start) continue;
    const end = dayAfter(event.end ?? event.start);
    if (!end) continue;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.categories?.length) {
      lines.push(`CATEGORIES:${event.categories.map(escapeText).join(',')}`);
    }
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return `${lines.map(fold).join('\r\n')}\r\n`;
}
