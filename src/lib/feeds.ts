/**
 * The calendar feed registry.
 *
 * Adding a filtered feed means adding one entry to `FEEDS`. The endpoint at
 * `src/pages/feeds/[feed].ics.ts` and the feed listing page both read from this
 * list, so nothing else needs touching.
 *
 * Build-time only.
 */

import { formatDeadline, formatDateRange } from './dates.ts';
import {
  deadlineOccurrences,
  jobDeadlineInstant,
} from './filter.ts';
import {
  AREA_LABELS,
  EVENT_TYPE_LABELS,
  POSITION_TYPE_LABELS,
  SCHOOL_TYPE_LABELS,
} from './taxonomy.ts';
import type { IcsEvent } from './ics.ts';
import type { Area, Entry, EventEntry, JobEntry, SchoolEntry } from './types.ts';

/** Host part of every UID. Kept constant so subscriptions stay stable. */
const UID_DOMAIN = 'plfm';

function uid(id: string, suffix: string): string {
  return `${id}-${suffix}@${UID_DOMAIN}`;
}

function areaNames(entry: Entry): string[] {
  return entry.areas.map((a) => AREA_LABELS[a] ?? a);
}

function place(entry: Entry): string | undefined {
  const value = entry as { location?: string; country?: string };
  if (value.location && value.country && !value.location.includes(value.country)) {
    return `${value.location}, ${value.country}`;
  }
  return value.location ?? value.country;
}

function sampleNote(entry: Entry): string {
  return entry.sample ? '\nSample entry: this is demonstration data, not a real announcement.' : '';
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
        .join('\n') + sampleNote(entry),
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
  const short = entry.acronym ?? entry.name;
  return [
    {
      uid: uid(entry.id, 'event'),
      summary: short,
      description: [
        entry.name,
        entry.description ?? '',
        entry.colocated_with ? `Colocated with ${entry.colocated_with}` : '',
        `Source: ${entry.source}`,
      ]
        .filter(Boolean)
        .join('\n') + sampleNote(entry),
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
        .join('\n') + sampleNote(entry),
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
        .join('\n') + sampleNote(entry),
      location: place(entry),
      url: entry.url ?? entry.source,
      categories: [SCHOOL_TYPE_LABELS[entry.type], ...areaNames(entry)],
      start: entry.start_date,
      end: entry.end_date ?? entry.start_date,
    });
  }

  return out;
}

function jobEvents(entry: JobEntry): IcsEvent[] {
  if (!entry.deadline || jobDeadlineInstant(entry) === null) return [];
  return [
    {
      uid: uid(entry.id, 'job'),
      summary: `${entry.name} closes (${entry.institution})`,
      description: [
        `${entry.name}, ${entry.institution}`,
        `Deadline: ${formatDeadline(entry.deadline, entry.deadline_timezone)}`,
        `Source: ${entry.source}`,
      ].join('\n') + sampleNote(entry),
      location: place(entry),
      url: entry.url ?? entry.source,
      categories: [
        POSITION_TYPE_LABELS[entry.position_type],
        ...areaNames(entry),
        'Deadline',
      ],
      start: entry.deadline,
    },
  ];
}

/** Every dated moment an entry contributes to a calendar. */
export function icsEventsFor(entry: Entry): IcsEvent[] {
  if (entry.collection === 'jobs') return jobEvents(entry as JobEntry);
  if (entry.collection === 'schools') return schoolEvents(entry as SchoolEntry);
  const event = entry as EventEntry;
  return [...deadlineEvents(event), ...eventEvents(event)];
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

function inArea(area: Area) {
  return (entry: Entry): boolean => entry.areas.includes(area);
}

const isEventLike = (entry: Entry): boolean =>
  entry.collection === 'events' || entry.collection === 'deadlines';

/** Only the deadline moments, dropping the event itself. */
function deadlinesOnly(entry: Entry): IcsEvent[] {
  if (!isEventLike(entry)) return icsEventsFor(entry);
  return deadlineEvents(entry as EventEntry);
}

export const FEEDS: FeedDefinition[] = [
  {
    slug: 'all',
    title: 'PLFM: everything',
    description: 'Every deadline, event, school, and job tracked by PLFM.',
    select: () => true,
  },
  {
    slug: 'deadlines',
    title: 'PLFM: submission deadlines',
    description: 'Conference and workshop submission deadlines.',
    select: isEventLike,
    moments: deadlinesOnly,
  },
  {
    slug: 'events',
    title: 'PLFM: events',
    description: 'Conferences, workshops, seminars, and community events.',
    select: isEventLike,
    moments: (entry) => eventEvents(entry as EventEntry),
  },
  {
    slug: 'schools',
    title: 'PLFM: schools',
    description:
      'Summer and winter schools, doctoral schools, and mentoring workshops, with their application deadlines.',
    select: (entry) => entry.collection === 'schools',
  },
  {
    slug: 'jobs',
    title: 'PLFM: job deadlines',
    description: 'Closing dates for PhD, postdoc, faculty, research, and internship positions.',
    select: (entry) => entry.collection === 'jobs',
  },
  {
    slug: 'pl',
    title: 'PLFM: programming languages deadlines',
    description: 'Submission deadlines for venues tagged programming languages.',
    select: (entry) => isEventLike(entry) && inArea('programming-languages')(entry),
    moments: deadlinesOnly,
  },
  {
    slug: 'formal-methods',
    title: 'PLFM: formal methods deadlines',
    description: 'Submission deadlines for venues tagged formal methods.',
    select: (entry) => isEventLike(entry) && inArea('formal-methods')(entry),
    moments: deadlinesOnly,
  },
  {
    slug: 'verification',
    title: 'PLFM: verification deadlines',
    description: 'Submission deadlines for venues tagged verification.',
    select: (entry) => isEventLike(entry) && inArea('verification')(entry),
    moments: deadlinesOnly,
  },
  {
    slug: 'compilers',
    title: 'PLFM: compilers deadlines',
    description: 'Submission deadlines for venues tagged compilers.',
    select: (entry) => isEventLike(entry) && inArea('compilers')(entry),
    moments: deadlinesOnly,
  },
  {
    slug: 'types',
    title: 'PLFM: types deadlines',
    description: 'Submission deadlines for venues tagged types.',
    select: (entry) => isEventLike(entry) && inArea('types')(entry),
    moments: deadlinesOnly,
  },
  {
    slug: 'logic',
    title: 'PLFM: logic deadlines',
    description: 'Submission deadlines for venues tagged logic.',
    select: (entry) => isEventLike(entry) && inArea('logic')(entry),
    moments: deadlinesOnly,
  },
  {
    slug: 'synthesis',
    title: 'PLFM: synthesis deadlines',
    description: 'Submission deadlines for venues tagged synthesis.',
    select: (entry) => isEventLike(entry) && inArea('synthesis')(entry),
    moments: deadlinesOnly,
  },
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
