/**
 * Selecting, sorting, and expiring entries.
 *
 * Every function here is pure and runs in both places: at build time to
 * produce the static HTML, and again in the browser so that a page cached
 * for weeks still hides deadlines that have since passed.
 *
 * Client-safe: no imports beyond types, dates, and taxonomy.
 */

import {
  daysInMonth,
  instantOf,
  dayKey,
  parseDate,
  toDayKey,
} from './dates.ts';
import {
  areaLabels,
  kindOf,
  EVENT_TYPE_LABELS,
  POSITION_TYPE_LABELS,
  SCHOOL_TYPE_LABELS,
} from './taxonomy.ts';
import type {
  CalendarItem,
  Entry,
  EventEntry,
  JobEntry,
  SchoolEntry,
} from './types.ts';

/**
 * A job that is open until filled with no deadline stops being shown once its
 * listing is this old, so the board does not accumulate dead links.
 */
export const OPEN_LISTING_MONTHS = 12;

export interface DeadlineOccurrence {
  entry: EventEntry;
  label?: string;
  /** Wall-clock date as written in the data file. */
  date: string;
  timezone?: string;
  /** Absolute moment the deadline closes. */
  instant: number;
  note?: string;
}

/**
 * Every announced deadline on an entry, in date order.
 *
 * `deadline` names the main round and `deadlines` lists all of them, so a call
 * that spells out `Paper` in both places must not appear twice. Rounds are
 * keyed by their moment, and the labelled version of a moment wins.
 */
export function deadlineOccurrences(entry: EventEntry): DeadlineOccurrence[] {
  const found = new Map<string, DeadlineOccurrence>();

  const add = (occurrence: DeadlineOccurrence): void => {
    const key = String(occurrence.instant);
    const existing = found.get(key);
    if (!existing || (!existing.label && occurrence.label)) {
      found.set(key, occurrence);
    }
  };

  if (entry.deadline) {
    const instant = instantOf(entry.deadline, entry.deadline_timezone, true);
    if (instant !== null) {
      add({
        entry,
        date: entry.deadline,
        timezone: entry.deadline_timezone,
        instant,
      });
    }
  }

  for (const slot of entry.deadlines ?? []) {
    if (!slot.date) continue;
    const timezone = slot.timezone ?? entry.deadline_timezone;
    const instant = instantOf(slot.date, timezone, true);
    if (instant === null) continue;
    add({
      entry,
      label: slot.label,
      date: slot.date,
      timezone,
      instant,
      note: slot.note,
    });
  }

  return [...found.values()].sort((a, b) => a.instant - b.instant);
}

/** The deadline a reader still has time to meet, if any. */
export function nextDeadline(
  entry: EventEntry,
  now: number,
): DeadlineOccurrence | null {
  return deadlineOccurrences(entry).find((d) => d.instant >= now) ?? null;
}

export function hasAnnouncedDeadline(entry: EventEntry): boolean {
  return deadlineOccurrences(entry).length > 0;
}

/** True when a deadline is expected but the date has not been published. */
export function deadlineIsTba(entry: EventEntry): boolean {
  if (entry.deadline_tba) return true;
  return (entry.deadlines ?? []).some((slot) => slot.tba && !slot.date);
}

/** Moment an event or school stops being upcoming. */
export function endInstant(
  entry: EventEntry | SchoolEntry,
): number | null {
  const last = entry.end_date ?? entry.start_date;
  return instantOf(last, 'UTC', true);
}

export function startInstant(entry: EventEntry | SchoolEntry): number | null {
  return instantOf(entry.start_date, 'UTC');
}

export function isPastEvent(
  entry: EventEntry | SchoolEntry,
  now: number,
): boolean {
  const end = endInstant(entry);
  if (end === null) return false; // undated or TBA entries stay upcoming
  return end < now;
}

export function schoolDeadlineInstant(school: SchoolEntry): number | null {
  return instantOf(
    school.application_deadline,
    school.application_deadline_timezone,
    true,
  );
}

export function jobDeadlineInstant(job: JobEntry): number | null {
  return instantOf(job.deadline, job.deadline_timezone, true);
}

export function isExpiredJob(job: JobEntry, now: number): boolean {
  const deadline = jobDeadlineInstant(job);
  if (deadline !== null) return deadline < now;
  if (!job.open_until_filled) return false;

  const listed = parseDate(job.posted ?? job.last_verified);
  if (!listed) return false;
  const cutoff = Date.UTC(
    listed.year,
    listed.month - 1 + OPEN_LISTING_MONTHS,
    Math.min(listed.day, daysInMonth(listed.year, listed.month + OPEN_LISTING_MONTHS)),
  );
  return cutoff < now;
}

/* ------------------------------------------------------------------------ */
/*  Calendar                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The calendar cell already says which year it is, so a trailing year on the
 * acronym is dropped there. It stays in the agenda and the detail panel.
 */
function shortLabel(label: string): string {
  return label.replace(/\s+(19|20)\d{2}$/, '');
}

/** Turns deadline-bearing entries into one calendar item per announced round. */
export function deadlineCalendarItems(entries: EventEntry[]): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const entry of entries) {
    for (const occurrence of deadlineOccurrences(entry)) {
      const key = dayKey(occurrence.date);
      if (!key) continue;
      const label = entry.acronym ?? entry.name;
      items.push({
        id: entry.id,
        date: key,
        label,
        short: shortLabel(label),
        title: entry.name,
        kind: kindOf(entry),
        moment: 'deadline',
        what: occurrence.label
          ? `${occurrence.label} deadline`
          : 'Submission deadline',
        areas: entry.areas,
        collection: entry.collection,
        sample: entry.sample,
      });
    }
  }
  return items;
}

/** One item per event, placed on its start date. */
export function eventCalendarItems(entries: EventEntry[]): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.start_date);
    if (!key) continue;
    const label = entry.acronym ?? entry.name;
    items.push({
      id: entry.id,
      date: key,
      label,
      short: shortLabel(label),
      title: entry.name,
      kind: kindOf(entry),
      moment: 'event',
      what: EVENT_TYPE_LABELS[entry.type] ?? 'Event',
      areas: entry.areas,
      collection: entry.collection,
      sample: entry.sample,
    });
  }
  return items;
}

/** School application deadlines, plus the schools themselves. */
export function schoolCalendarItems(entries: SchoolEntry[]): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const entry of entries) {
    const label = entry.acronym ?? entry.name;
    const base = {
      id: entry.id,
      label,
      short: shortLabel(label),
      title: entry.name,
      kind: 'school' as const,
      areas: entry.areas,
      collection: entry.collection,
      sample: entry.sample,
    };

    const application = dayKey(entry.application_deadline);
    if (application) {
      items.push({
        ...base,
        date: application,
        moment: 'deadline',
        what: 'Application deadline',
      });
    }

    const start = dayKey(entry.start_date);
    if (start) {
      items.push({
        ...base,
        date: start,
        moment: 'school',
        what: SCHOOL_TYPE_LABELS[entry.type] ?? 'School',
      });
    }
  }
  return items;
}

/**
 * Everything dated, for the main calendar: submission deadlines, the events
 * they belong to, schools, and school application deadlines.
 */
export function combinedCalendarItems(entries: Entry[]): CalendarItem[] {
  const events = entries.filter(
    (entry): entry is EventEntry =>
      entry.collection === 'events' || entry.collection === 'deadlines',
  );
  const schools = entries.filter(
    (entry): entry is SchoolEntry => entry.collection === 'schools',
  );

  return [
    ...deadlineCalendarItems(events),
    ...eventCalendarItems(events),
    ...schoolCalendarItems(schools),
  ];
}

/**
 * Narrows the calendar to one kind of date. `deadlines` covers both submission
 * deadlines and school application deadlines, so every moment lands in exactly
 * one bucket.
 */
export function itemsShowing(
  items: CalendarItem[],
  show: string,
): CalendarItem[] {
  if (show === 'all') return items;
  const wanted =
    show === 'deadlines' ? 'deadline' : show === 'events' ? 'event' : 'school';
  return items.filter((item) => item.moment === wanted);
}

export function itemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const bucket = map.get(item.date);
    if (bucket) bucket.push(item);
    else map.set(item.date, [item]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.label.localeCompare(b.label));
  }
  return map;
}

export function itemsInMonth(
  items: CalendarItem[],
  year: number,
  month: number,
): CalendarItem[] {
  const first = toDayKey(year, month, 1);
  const last = toDayKey(year, month, daysInMonth(year, month));
  return items
    .filter((item) => item.date >= first && item.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

/* ------------------------------------------------------------------------ */
/*  Filtering and search                                                     */
/* ------------------------------------------------------------------------ */

export interface FilterState {
  /** Research area slug, or `all`. */
  area: string;
  /** Collection-specific type slug, or `all`. */
  type: string;
  /** Coarse category shared across collections, or `all`. */
  kind: string;
  /**
   * Which dates the calendar carries: `all`, or one of the moment types.
   * Unlike the others this selects on calendar items, not on entries.
   */
  show: string;
  /** Free-text query. */
  query: string;
}

export const EMPTY_FILTER: FilterState = {
  area: 'all',
  type: 'all',
  kind: 'all',
  show: 'all',
  query: '',
};

export function matchesArea(entry: Entry, area: string): boolean {
  if (area === 'all') return true;
  return entry.areas.includes(area as Entry['areas'][number]);
}

export function matchesType(entry: Entry, type: string): boolean {
  if (type === 'all') return true;
  if (entry.collection === 'jobs') {
    return (entry as JobEntry).position_type === type;
  }
  if (entry.collection === 'schools') {
    return (entry as SchoolEntry).type === type;
  }
  return (entry as EventEntry).type === type;
}

/**
 * The four buckets the calendar colours by. Lets one filter bar cover a page
 * that mixes deadlines, events, and schools.
 */
export function matchesKind(entry: Entry, kind: string): boolean {
  if (kind === 'all') return true;
  return kindOf(entry) === kind;
}

/** Words a query is matched against. Cheap to build, so it is not cached. */
function haystack(entry: Entry): string {
  const parts: string[] = [entry.name, entry.acronym ?? '', entry.description ?? ''];
  parts.push(...areaLabels(entry.areas), ...entry.areas);

  if (entry.collection === 'jobs') {
    const job = entry as JobEntry;
    parts.push(job.institution, job.location ?? '', job.country ?? '');
    parts.push(POSITION_TYPE_LABELS[job.position_type] ?? '');
  } else if (entry.collection === 'schools') {
    const school = entry as SchoolEntry;
    parts.push(school.location ?? '', school.country ?? '');
    parts.push(SCHOOL_TYPE_LABELS[school.type] ?? '');
  } else {
    const event = entry as EventEntry;
    parts.push(event.location ?? '', event.country ?? '', event.colocated_with ?? '');
    parts.push(EVENT_TYPE_LABELS[event.type] ?? '');
  }

  return parts.join(' ').toLowerCase();
}

export function matchesQuery(entry: Entry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = haystack(entry);
  return q.split(/\s+/).every((token) => text.includes(token));
}

export function matchesFilter(entry: Entry, state: FilterState): boolean {
  return (
    matchesArea(entry, state.area) &&
    matchesType(entry, state.type) &&
    matchesKind(entry, state.kind) &&
    matchesQuery(entry, state.query)
  );
}

/* ------------------------------------------------------------------------ */
/*  Sorting                                                                  */
/* ------------------------------------------------------------------------ */

/** Undated entries sort last rather than first. */
function orderKey(instant: number | null): number {
  return instant ?? Number.POSITIVE_INFINITY;
}

export function byStartDateDescending(
  a: EventEntry | SchoolEntry,
  b: EventEntry | SchoolEntry,
): number {
  const left = startInstant(a) ?? Number.NEGATIVE_INFINITY;
  const right = startInstant(b) ?? Number.NEGATIVE_INFINITY;
  return right - left || a.name.localeCompare(b.name);
}

export function byJobDeadline(a: JobEntry, b: JobEntry): number {
  return (
    orderKey(jobDeadlineInstant(a)) - orderKey(jobDeadlineInstant(b)) ||
    a.institution.localeCompare(b.institution)
  );
}

