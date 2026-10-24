import { SITE } from '../../site.config.mjs';
import { dayKey } from './dates.ts';
import { isPastEvent, nextDeadline, schoolDeadlineInstant } from './filter.ts';
import { url } from './paths.ts';
import { AREA_LABELS, EVENT_TYPE_LABELS, SCHOOL_TYPE_LABELS } from './taxonomy.ts';
import type { Entry } from './types.ts';

/**
 * schema.org structured data for search engines. Nothing here is rendered;
 * it lets Google and friends read the calendar as a list of events rather
 * than as a wall of text.
 */

type JsonLd = Record<string, unknown>;

function place(entry: Entry): JsonLd | undefined {
  const { location, country } = entry;
  if (!location && !country) return undefined;
  const address: JsonLd = { '@type': 'PostalAddress' };
  if (location) address.addressLocality = location;
  if (country) address.addressCountry = country;
  return {
    '@type': 'Place',
    name: [location, country].filter(Boolean).join(', '),
    address,
  };
}

function kindLabel(entry: Entry): string {
  return entry.collection === 'schools'
    ? SCHOOL_TYPE_LABELS[entry.type]
    : EVENT_TYPE_LABELS[entry.type];
}

function deadlineDate(entry: Entry, now: number): string | undefined {
  if (entry.collection === 'schools') {
    const instant = schoolDeadlineInstant(entry);
    return instant !== null && instant >= now ? entry.application_deadline : undefined;
  }
  return nextDeadline(entry, now)?.date;
}

function eventJsonLd(entry: Entry, now: number): JsonLd | null {
  // Google wants a day-precise start date; month-only entries are skipped.
  const start = dayKey(entry.start_date);
  if (!start) return null;
  const end = dayKey(entry.end_date) ?? start;

  const name = entry.acronym ? `${entry.acronym}: ${entry.name}` : entry.name;
  const areas = entry.areas.map((a) => AREA_LABELS[a] ?? a);
  // Submission and application deadlines are the dates most readers come
  // for. schema.org has no field for them, so they go in the description.
  const deadline = deadlineDate(entry, now);
  const deadlineLabel =
    entry.collection === 'schools' ? 'Application deadline' : 'Submission deadline';
  const description = [
    `${kindLabel(entry)} on ${areas.join(', ')}.`,
    deadline ? `${deadlineLabel}: ${dayKey(deadline) ?? deadline}.` : '',
    entry.description ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const officialUrl = entry.url ?? entry.source;

  const item: JsonLd = {
    '@type': entry.collection === 'schools' ? 'EducationEvent' : 'Event',
    name,
    startDate: start,
    endDate: end,
    description,
    url: officialUrl,
    image: [new URL(url('/og.png'), SITE.url).href],
    // We do not track organising bodies, so the event's own organisers stand
    // in, pointed at the official page.
    organizer: {
      '@type': 'Organization',
      name: `${entry.acronym ?? entry.name} organisers`,
      url: officialUrl,
    },
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    keywords: [kindLabel(entry), ...areas].join(', '),
  };

  const location = place(entry);
  if (location) item.location = location;

  return item;
}

export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.title,
    alternateName: 'Programming Languages & Formal Methods Calendar',
    url: new URL(url('/'), SITE.url).href,
    description: SITE.description,
    inLanguage: 'en',
  };
}

/**
 * One standalone Event per upcoming entry. Google reads several top-level
 * events on a page; wrapping them in an ItemList would instead invoke the
 * carousel rules, which do not admit events at all.
 */
export function calendarJsonLd(entries: Entry[], now: number): JsonLd[] {
  return entries
    .filter((entry) => !isPastEvent(entry, now))
    .map((entry) => eventJsonLd(entry, now))
    .filter((item): item is JsonLd => item !== null)
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
    .map((item) => ({ '@context': 'https://schema.org', ...item }));
}

export function jsonLdPayload(value: JsonLd | JsonLd[]): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
