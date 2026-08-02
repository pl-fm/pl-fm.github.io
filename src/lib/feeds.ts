/**
 * The calendar feed registry.
 *
 * Adding a filtered feed means adding one entry to `FEEDS`. The endpoint at
 * `src/pages/feeds/[feed].ics.ts` reads from this list, so nothing else needs
 * touching.
 *
 * Build-time only.
 */

import { formatDeadline, formatDateRange } from './dates.ts';
import { deadlineOccurrences } from './filter.ts';
import {
  AREA_LABELS,
  EVENT_TYPE_LABELS,
  SCHOOL_TYPE_LABELS,
} from './taxonomy.ts';
import type { IcsEvent } from './ics.ts';
import type { Area, Entry, EventEntry, SchoolEntry } from './types.ts';

/** Host part of every UID. Kept constant so subscriptions stay stable. */
const UID_DOMAIN = 'plfm';

function uid(id: string, suffix: string): string {
  return `${id}-${suffix}@${UID_DOMAIN}`;
}

function areaNames(entry: Entry): string[] {
  return entry.areas.map((a) => AREA_LABELS[a] ?? a);
}

function place(entry: Entry): string | undefined {
  const { location, country } = entry;
  if (location && country && !location.includes(country)) {
    return `${location}, ${country}`;
  }
  return location ?? country;
}

/** One all-day event per announced submission round. */
function deadlineEvents(entry: EventEntry): IcsEvent[] {
  return deadlineOccurrences(entry).map((occurrence, index) => {
    const label = occurrence.label ? `${occurrence.label} deadline` : 'Deadline';
    const short = entry.acronym ?? entry.name;
    return {
      uid: uid(entry.id, `deadline-${index}`),
      summary: `${short} ${label.toLowerCase()}`,
      description: [
        entry.name,
        `${label}: ${formatDeadline(occurrence.date, occurrence.timezone)}`,
        entry.start_date
          ? `Event: ${formatDateRange(entry.start_date, entry.end_date)}`
          : '',
        occurrence.note ?? '',
        `Source: ${entry.source}`,
      ]
        .filter(Boolean)
        .join('\n'),
      location: place(entry),
      url: entry.url ?? entry.source,
      categories: [EVENT_TYPE_LABELS[entry.type], ...areaNames(entry), 'Deadline'],
      start: occurrence.date,
    };
  });
}

/** The event itself, spanning its dates. */
function eventEvents(entry: EventEntry): IcsEvent[] {
  if (!entry.start_date) return [];
  return [
    {
      uid: uid(entry.id, 'event'),
      summary: entry.acronym ?? entry.name,
      description: [
        entry.name,
        entry.description ?? '',
        entry.colocated_with ? `Colocated with ${entry.colocated_with}` : '',
        `Source: ${entry.source}`,
      ]
        .filter(Boolean)
        .join('\n'),
      location: place(entry),
      url: entry.url ?? entry.source,
      categories: [EVENT_TYPE_LABELS[entry.type], ...areaNames(entry)],
      start: entry.start_date,
      end: entry.end_date ?? entry.start_date,
    },
  ];
}

function schoolEvents(entry: SchoolEntry): IcsEvent[] {
  const short = entry.acronym ?? entry.name;
  const out: IcsEvent[] = [];

  if (entry.application_deadline) {
    out.push({
      uid: uid(entry.id, 'application'),
      summary: `${short} application deadline`,
      description: [
        entry.name,
        `Applications close: ${formatDeadline(
          entry.application_deadline,
          entry.application_deadline_timezone,
        )}`,
        entry.start_date
          ? `School: ${formatDateRange(entry.start_date, entry.end_date)}`
          : '',
        entry.funding ? `Funding: ${entry.funding}` : '',
        `Source: ${entry.source}`,
      ]
        .filter(Boolean)
        .join('\n'),
      location: place(entry),
      url: entry.url ?? entry.source,
      categories: [SCHOOL_TYPE_LABELS[entry.type], ...areaNames(entry), 'Deadline'],
      start: entry.application_deadline,
    });
  }

  if (entry.start_date) {
    out.push({
      uid: uid(entry.id, 'school'),
      summary: short,
      description: [entry.name, entry.description ?? '', `Source: ${entry.source}`]
        .filter(Boolean)
        .join('\n'),
      location: place(entry),
      url: entry.url ?? entry.source,
      categories: [SCHOOL_TYPE_LABELS[entry.type], ...areaNames(entry)],
      start: entry.start_date,
      end: entry.end_date ?? entry.start_date,
    });
  }

  return out;
}

/** Every dated moment an entry contributes to a calendar. */
function icsEventsFor(entry: Entry): IcsEvent[] {
  return entry.collection === 'schools'
    ? schoolEvents(entry)
    : [...deadlineEvents(entry), ...eventEvents(entry)];
}

export interface FeedDefinition {
  slug: string;
  title: string;
  description: string;
  /** Which entries belong in the feed. */
  select: (entry: Entry) => boolean;
  /** Which of an entry's moments belong in the feed. */
  moments?: (entry: Entry) => IcsEvent[];
}

const isEvent = (entry: Entry): entry is EventEntry => entry.collection === 'events';

/** Only the deadline moments, dropping the event itself. */
function deadlinesOnly(entry: Entry): IcsEvent[] {
  return isEvent(entry) ? deadlineEvents(entry) : icsEventsFor(entry);
}

/** A per-area deadline feed, which is most of the registry below. */
function areaFeed(slug: string, area: Area, label: string): FeedDefinition {
  return {
    slug,
    title: `PLFM: ${label} deadlines`,
    description: `Submission deadlines for venues tagged ${label}.`,
    select: (entry) => isEvent(entry) && entry.areas.includes(area),
    moments: deadlinesOnly,
  };
}

export const FEEDS: FeedDefinition[] = [
  {
    slug: 'all',
    title: 'PLFM: everything',
    description: 'Every deadline, event, and school tracked by PLFM.',
    select: () => true,
  },
  {
    slug: 'deadlines',
    title: 'PLFM: submission deadlines',
    description: 'Conference and workshop submission deadlines.',
    select: isEvent,
    moments: deadlinesOnly,
  },
  {
    slug: 'events',
    title: 'PLFM: events',
    description: 'Conferences, workshops, seminars, and community events.',
    select: isEvent,
    moments: (entry) => (isEvent(entry) ? eventEvents(entry) : []),
  },
  {
    slug: 'schools',
    title: 'PLFM: schools',
    description:
      'Summer and winter schools, doctoral schools, and mentoring workshops, with their application deadlines.',
    select: (entry) => entry.collection === 'schools',
  },
  areaFeed('pl', 'programming-languages', 'programming languages'),
  areaFeed('formal-methods', 'formal-methods', 'formal methods'),
  areaFeed('verification', 'verification', 'verification'),
  areaFeed('compilers', 'compilers', 'compilers'),
  areaFeed('types', 'types', 'types'),
  areaFeed('logic', 'logic', 'logic'),
  areaFeed('synthesis', 'synthesis', 'synthesis'),
];

export function feedBySlug(slug: string): FeedDefinition | undefined {
  return FEEDS.find((feed) => feed.slug === slug);
}

/** Collects the moments for a feed, sorted so diffs between builds stay small. */
export function collectFeedEvents(
  feed: FeedDefinition,
  entries: Entry[],
): IcsEvent[] {
  const build = feed.moments ?? icsEventsFor;
  return entries
    .filter(feed.select)
    .flatMap((entry) => build(entry))
    .sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid));
}
