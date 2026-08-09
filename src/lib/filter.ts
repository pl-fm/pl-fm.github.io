import { daysInMonth, instantOf, dayKey, toDayKey } from './dates.ts';
import {
  areaLabels,
  categoryOf,
  kindOf,
  EVENT_TYPE_LABELS,
  SCHOOL_TYPE_LABELS,
} from './taxonomy.ts';
import type {
  CalendarItem,
  Category,
  Entry,
  EventEntry,
  SchoolEntry,
} from './types.ts';

export interface DeadlineOccurrence {
  entry: EventEntry;
  label?: string;
  date: string;
  timezone?: string;
  instant: number;
  note?: string;
}

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

export function nextDeadline(
  entry: EventEntry,
  now: number,
): DeadlineOccurrence | null {
  return deadlineOccurrences(entry).find((d) => d.instant >= now) ?? null;
}

export function hasAnnouncedDeadline(entry: EventEntry): boolean {
  return deadlineOccurrences(entry).length > 0;
}

export function deadlineIsTba(entry: EventEntry): boolean {
  if (entry.deadline_tba) return true;
  return (entry.deadlines ?? []).some((slot) => slot.tba && !slot.date);
}

export function startInstant(entry: Entry): number | null {
  return instantOf(entry.start_date, 'UTC');
}

export function isPastEvent(entry: Entry, now: number): boolean {
  const end = instantOf(entry.end_date ?? entry.start_date, 'UTC', true);
  return end !== null && end < now;
}

export function schoolDeadlineInstant(school: SchoolEntry): number | null {
  return instantOf(
    school.application_deadline,
    school.application_deadline_timezone,
    true,
  );
}

function shortLabel(label: string): string {
  return label.replace(/\s+(19|20)\d{2}$/, '');
}

function deadlineItems(entries: EventEntry[]): CalendarItem[] {
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
        category: 'deadline',
        what: occurrence.label
          ? `${occurrence.label} deadline`
          : 'Submission deadline',
        areas: entry.areas,
        collection: entry.collection,
      });
    }
  }
  return items;
}

function eventItems(entries: EventEntry[]): CalendarItem[] {
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
      category: categoryOf(entry, 'event'),
      what: EVENT_TYPE_LABELS[entry.type] ?? 'Event',
      areas: entry.areas,
      collection: entry.collection,
    });
  }
  return items;
}

function schoolItems(entries: SchoolEntry[]): CalendarItem[] {
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
    };

    const application = dayKey(entry.application_deadline);
    if (application) {
      items.push({
        ...base,
        date: application,
        moment: 'deadline',
        category: 'deadline',
        what: 'Application deadline',
      });
    }

    const start = dayKey(entry.start_date);
    if (start) {
      items.push({
        ...base,
        date: start,
        moment: 'school',
        category: 'school',
        what: SCHOOL_TYPE_LABELS[entry.type] ?? 'School',
      });
    }
  }
  return items;
}

export function combinedCalendarItems(entries: Entry[]): CalendarItem[] {
  const events = entries.filter(
    (entry): entry is EventEntry => entry.collection === 'events',
  );
  const schools = entries.filter(
    (entry): entry is SchoolEntry => entry.collection === 'schools',
  );

  return [
    ...deadlineItems(events),
    ...eventItems(events),
    ...schoolItems(schools),
  ];
}

export function itemsShowing(items: CalendarItem[], show: string): CalendarItem[] {
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

export interface FilterState {
  categories: Category[];
  show: string;
  query: string;
}

export const EMPTY_FILTER: FilterState = {
  categories: [],
  show: 'all',
  query: '',
};

export function inCategories(
  category: Category,
  selected: readonly Category[],
): boolean {
  return selected.length === 0 || selected.includes(category);
}

export function itemsInCategories(
  items: CalendarItem[],
  selected: readonly Category[],
): CalendarItem[] {
  if (selected.length === 0) return items;
  return items.filter((item) => selected.includes(item.category));
}

export function countByCategory(items: CalendarItem[]): Record<Category, number> {
  const counts: Record<Category, number> = {
    deadline: 0,
    conference: 0,
    workshop: 0,
    school: 0,
  };
  for (const item of items) counts[item.category] += 1;
  return counts;
}

function haystack(entry: Entry): string {
  const parts: string[] = [
    entry.name,
    entry.acronym ?? '',
    entry.description ?? '',
    entry.location ?? '',
    entry.country ?? '',
    ...areaLabels(entry.areas),
    ...entry.areas,
  ];

  if (entry.collection === 'schools') {
    parts.push(SCHOOL_TYPE_LABELS[entry.type] ?? '');
  } else {
    parts.push(entry.colocated_with ?? '', EVENT_TYPE_LABELS[entry.type] ?? '');
  }

  return parts.join(' ').toLowerCase();
}

export function matchesQuery(entry: Entry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = haystack(entry);
  return q.split(/\s+/).every((token) => text.includes(token));
}

export function byStartDateDescending(a: Entry, b: Entry): number {
  const left = startInstant(a) ?? Number.NEGATIVE_INFINITY;
  const right = startInstant(b) ?? Number.NEGATIVE_INFINITY;
  return right - left || a.name.localeCompare(b.name);
}
