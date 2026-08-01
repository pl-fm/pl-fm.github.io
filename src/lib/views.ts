/**
 * Page composition.
 *
 * Each function returns the HTML for one page's regions. The Astro page calls
 * it at build time and the page's script calls it again whenever a filter or
 * month changes, so there is a single description of what each list contains.
 *
 * Client-safe.
 */

import { agenda, legend, monthGrid } from './calendar.ts';
import { dayKey, formatMonthYear, parseDate } from './dates.ts';
import {
  byJobDeadline,
  byStartDateDescending,
  combinedCalendarItems,
  deadlineIsTba,
  deadlineOccurrences,
  hasAnnouncedDeadline,
  isExpiredJob,
  isPastEvent,
  itemsInMonth,
  itemsShowing,
  jobDeadlineInstant,
  matchesArea,
  matchesFilter,
  matchesKind,
  matchesQuery,
  matchesType,
  nextDeadline,
  schoolDeadlineInstant,
  startInstant,
  type FilterState,
} from './filter.ts';
import {
  anyRow,
  deadlineRow,
  eventRow,
  jobRow,
  list,
  schoolRow,
} from './render.ts';
import type {
  CalendarItem,
  Entry,
  EventEntry,
  JobEntry,
  SchoolEntry,
} from './types.ts';

export interface ViewContext {
  entries: Entry[];
  state: FilterState;
  /** Reference moment for expiry, in epoch milliseconds. */
  now: number;
  /** `YYYY-MM-DD` used to highlight today in a calendar. */
  today: string;
}

export interface MonthContext extends ViewContext {
  year: number;
  month: number;
}

function jobs(entries: Entry[]): JobEntry[] {
  return entries.filter((e): e is JobEntry => e.collection === 'jobs');
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/* -------------------------------------------------------------------------- */
/*  Calendar                                                                   */
/* -------------------------------------------------------------------------- */

export interface CalendarRegions {
  monthTitle: string;
  grid: string;
  agenda: string;
  legend: string;
  /** The items behind the grid, so a caller can mirror them in a list. */
  items: CalendarItem[];
}

/**
 * The month grid. Entries are narrowed by the search box first, then the dates
 * they contribute are narrowed by the selected tab, so a search for `types`
 * with `Schools` selected leaves only school dates for matching schools.
 */
export function calendarRegions(context: MonthContext): CalendarRegions {
  const { year, month, today, state } = context;

  // The legend is built before the category filter is applied, so choosing
  // `Schools` does not remove the button that leads back to `Workshops`.
  const beforeKind = context.entries
    .filter((entry) => entry.collection !== 'jobs')
    .filter(
      (entry) =>
        matchesArea(entry, state.area) &&
        matchesType(entry, state.type) &&
        matchesQuery(entry, state.query),
    );
  const matching = beforeKind.filter((entry) => matchesKind(entry, state.kind));

  const monthItems = (list: Entry[]): CalendarItem[] =>
    itemsInMonth(itemsShowing(combinedCalendarItems(list), state.show), year, month);

  const items = monthItems(matching);
  const view = { year, month, items, today };

  return {
    monthTitle: formatMonthYear(year, month),
    grid: monthGrid(view),
    agenda: agenda(view),
    // Deliberately not limited to the month on screen. The legend is a
    // control, and a row of buttons that comes and goes as you page through
    // the calendar reads as broken, quite apart from stranding you with no
    // way to change category in a month that happens to hold one kind.
    legend: legend(
      itemsShowing(combinedCalendarItems(beforeKind), state.show),
      state.kind,
    ),
    items,
  };
}

/* -------------------------------------------------------------------------- */
/*  Home                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Which slice of the calendar the page is showing. The tabs above the calendar
 * set this, and it narrows the grid and the lists below it together.
 */
export type ShowMode = 'all' | 'deadlines' | 'events' | 'schools';

export interface HomeView extends CalendarRegions {
  monthHeading: string;
  monthList: string;
  upcomingHeading: string;
  upcomingList: string;
  count: string;
}

/** A deadline a reader could still meet: a call for papers or an application. */
function openDeadline(entry: Entry, now: number): number | null {
  if (entry.collection === 'schools') {
    const instant = schoolDeadlineInstant(entry as SchoolEntry);
    return instant !== null && instant >= now ? instant : null;
  }
  return nextDeadline(entry as EventEntry, now)?.instant ?? null;
}

/** An announced-but-undated deadline, which still belongs in a list. */
function awaitingDeadline(entry: Entry): boolean {
  return entry.collection === 'schools'
    ? (entry as SchoolEntry).application_deadline_tba === true
    : deadlineIsTba(entry as EventEntry);
}

/**
 * The soonest thing still ahead for an entry: a deadline it is still taking, or
 * the date it starts. Used by the `All` tab, which lists each entry once at
 * whichever of its moments comes first.
 */
function nextMoment(
  entry: Entry,
  now: number,
): { instant: number; moment: 'deadline' | 'event' | 'school' } | null {
  const dated = entry as EventEntry | SchoolEntry;
  const deadline = openDeadline(entry, now);
  const start = startInstant(dated);
  const running = start !== null && !isPastEvent(dated, now);

  if (deadline !== null && (!running || deadline <= start!)) {
    return { instant: deadline, moment: 'deadline' };
  }
  if (running) {
    return {
      instant: start!,
      moment: entry.collection === 'schools' ? 'school' : 'event',
    };
  }
  return null;
}

/** Whether an entry belongs in the list under the calendar, for one tab. */
function isUpcoming(entry: Entry, show: ShowMode, now: number): boolean {
  const dated = entry as EventEntry | SchoolEntry;
  if (show === 'deadlines') {
    return openDeadline(entry, now) !== null || awaitingDeadline(entry);
  }
  if (show === 'events') {
    return entry.collection !== 'schools' && !isPastEvent(dated, now);
  }
  if (show === 'schools') {
    return entry.collection === 'schools' && !isPastEvent(dated, now);
  }
  return (
    nextMoment(entry, now) !== null ||
    awaitingDeadline(entry) ||
    dated.dates_tba === true
  );
}

/** The date a list is ordered by. Undated entries sort last. */
function upcomingKey(entry: Entry, show: ShowMode, now: number): number {
  const instant =
    show === 'deadlines'
      ? openDeadline(entry, now)
      : show === 'all'
        ? (nextMoment(entry, now)?.instant ?? null)
        : startInstant(entry as EventEntry | SchoolEntry);
  return instant ?? Number.POSITIVE_INFINITY;
}

/**
 * A row reads as whatever the tab is about: the `Deadlines` tab leads with the
 * closing date, `Events` and `Schools` with the dates they run. `All` picks per
 * entry, so a call closing next week reads as a deadline and a conference whose
 * call has closed reads as an event.
 */
function upcomingRow(entry: Entry, show: ShowMode, now: number): string {
  if (show === 'deadlines') {
    return entry.collection === 'schools'
      ? schoolRow(entry as SchoolEntry, now, 'application')
      : deadlineRow(entry as EventEntry, now);
  }
  if (show === 'events') return eventRow(entry as EventEntry, now);
  if (show === 'schools') return schoolRow(entry as SchoolEntry, now, 'dates');

  const moment = nextMoment(entry, now)?.moment;
  if (entry.collection === 'schools') {
    const school = entry as SchoolEntry;
    const application =
      moment === 'deadline' ||
      (moment === undefined && school.application_deadline_tba === true);
    return schoolRow(school, now, application ? 'application' : 'dates');
  }

  const event = entry as EventEntry;
  const submission =
    moment === 'deadline' || (moment === undefined && deadlineIsTba(event));
  return submission ? deadlineRow(event, now) : eventRow(event, now);
}

const UPCOMING: Record<
  ShowMode,
  { heading: string; one: string; many: string; empty: string }
> = {
  all: {
    heading: 'Everything upcoming',
    one: 'entry',
    many: 'entries',
    empty: 'Nothing upcoming matches this search.',
  },
  deadlines: {
    heading: 'All upcoming deadlines',
    one: 'open deadline',
    many: 'open deadlines',
    empty: 'No upcoming deadlines match this search.',
  },
  events: {
    heading: 'Upcoming events',
    one: 'event',
    many: 'events',
    empty: 'No upcoming events match this search.',
  },
  schools: {
    heading: 'Upcoming schools',
    one: 'school',
    many: 'schools',
    empty: 'No upcoming schools match this search.',
  },
};

/** One row per date the calendar is showing, in order: a mirror of the grid. */
function monthMirror(matching: Entry[], items: CalendarItem[], now: number): string[] {
  const wanted = new Set(items.map((item) => `${item.id}|${item.moment}|${item.date}`));
  const rows: { key: string; html: string }[] = [];
  const take = (id: string, moment: string, date: string): boolean =>
    wanted.has(`${id}|${moment}|${dayKey(date) ?? date}`);

  for (const entry of matching) {
    if (entry.collection === 'schools') {
      const school = entry as SchoolEntry;
      if (
        school.application_deadline &&
        take(school.id, 'deadline', school.application_deadline)
      ) {
        rows.push({
          key: school.application_deadline,
          html: schoolRow(school, now, 'application'),
        });
      }
      if (school.start_date && take(school.id, 'school', school.start_date)) {
        rows.push({ key: school.start_date, html: schoolRow(school, now, 'dates') });
      }
      continue;
    }

    const event = entry as EventEntry;
    for (const occurrence of deadlineOccurrences(event)) {
      if (take(event.id, 'deadline', occurrence.date)) {
        rows.push({
          key: occurrence.date,
          html: deadlineRow(event, now, occurrence),
        });
      }
    }
    if (event.start_date && take(event.id, 'event', event.start_date)) {
      rows.push({ key: event.start_date, html: eventRow(event, now) });
    }
  }

  rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows.map((row) => row.html);
}

/**
 * The single page: one calendar carrying everything dated — submission
 * deadlines, the events themselves, schools, and school application deadlines —
 * with the tab narrowing the grid and both lists below it in step. Jobs keep to
 * their own data folder.
 */
export function homeView(context: MonthContext): HomeView {
  const { year, month, now, state } = context;
  const show = (state.show || 'all') as ShowMode;

  const all = context.entries.filter((entry) => entry.collection !== 'jobs');
  const matching = all.filter((entry) => matchesFilter(entry, state));

  const calendar = calendarRegions(context);
  const words = UPCOMING[show] ?? UPCOMING.all;

  const upcoming = matching
    .filter((entry) => isUpcoming(entry, show, now))
    .sort(
      (a, b) =>
        upcomingKey(a, show, now) - upcomingKey(b, show, now) ||
        a.name.localeCompare(b.name),
    )
    .map((entry) => upcomingRow(entry, show, now));

  const total = all.filter((entry) => isUpcoming(entry, show, now)).length;
  const monthTitle = formatMonthYear(year, month);

  return {
    ...calendar,
    monthHeading: `In ${monthTitle}`,
    monthList: list(
      monthMirror(matching, calendar.items, now),
      `Nothing scheduled in ${monthTitle}.`,
    ),
    upcomingHeading: words.heading,
    upcomingList: list(upcoming, words.empty),
    count:
      upcoming.length === total
        ? plural(total, words.one, words.many)
        : `${upcoming.length} of ${plural(total, words.one, words.many)}`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export interface JobsView {
  openList: string;
  untilFilledList: string;
  count: string;
}

export function jobsView(context: ViewContext): JobsView {
  const { now, state } = context;
  const all = jobs(context.entries).filter((entry) => !isExpiredJob(entry, now));
  const matching = all.filter((entry) => matchesFilter(entry, state));

  const dated = matching
    .filter((entry) => jobDeadlineInstant(entry) !== null)
    .sort(byJobDeadline)
    .map((entry) => jobRow(entry, now));

  const rolling = matching
    .filter((entry) => jobDeadlineInstant(entry) === null)
    .sort((a, b) => a.institution.localeCompare(b.institution))
    .map((entry) => jobRow(entry, now));

  return {
    openList: list(dated, 'No positions with a closing date match these filters.'),
    untilFilledList: list(rolling, 'No open-ended positions match these filters.'),
    count:
      matching.length === all.length
        ? plural(all.length, 'position')
        : `${matching.length} of ${plural(all.length, 'position')}`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Archive                                                                    */
/* -------------------------------------------------------------------------- */

export interface ArchiveSection {
  title: string;
  html: string;
}

export interface ArchiveView {
  sections: ArchiveSection[];
  count: string;
  years: number[];
}

/** Year an archived entry is filed under: when it happened, not when it was added. */
export function archivedYear(entry: Entry): number | null {
  if (entry.collection === 'jobs') {
    const job = entry as JobEntry;
    return parseDate(job.deadline ?? job.posted ?? job.last_verified)?.year ?? null;
  }
  const dated = entry as EventEntry | SchoolEntry;
  if (dated.end_date ?? dated.start_date) {
    return parseDate(dated.end_date ?? dated.start_date)?.year ?? null;
  }
  if (dated.collection !== 'schools') {
    const last = deadlineOccurrences(dated as EventEntry).at(-1);
    if (last) return parseDate(last.date)?.year ?? null;
  }
  return parseDate(entry.last_verified)?.year ?? null;
}

/** Everything that has passed, newest first. */
export function archivedEntries(entries: Entry[], now: number): Entry[] {
  return entries.filter((entry) => {
    if (entry.collection === 'jobs') return isExpiredJob(entry as JobEntry, now);
    const dated = entry as EventEntry | SchoolEntry;
    if (isPastEvent(dated, now)) return true;
    // A call whose every round has closed, with no event dates to fall back on.
    if (
      (entry.collection === 'deadlines' || entry.collection === 'events') &&
      !dated.start_date &&
      hasAnnouncedDeadline(dated as EventEntry)
    ) {
      return nextDeadline(dated as EventEntry, now) === null;
    }
    return false;
  });
}

export function archiveView(
  entries: Entry[],
  now: number,
  year: number | 'all',
): ArchiveView {
  const archived = archivedEntries(entries, now);
  const years = [...new Set(archived.map(archivedYear).filter((y): y is number => y !== null))]
    .sort((a, b) => b - a);

  const selected =
    year === 'all' ? archived : archived.filter((entry) => archivedYear(entry) === year);

  const events = selected
    .filter((e) => e.collection === 'events' || e.collection === 'deadlines')
    .sort((a, b) => byStartDateDescending(a as EventEntry, b as EventEntry));
  const pastSchools = selected
    .filter((e) => e.collection === 'schools')
    .sort((a, b) => byStartDateDescending(a as SchoolEntry, b as SchoolEntry));
  const pastJobs = selected
    .filter((e) => e.collection === 'jobs')
    .sort((a, b) => (jobDeadlineInstant(b as JobEntry) ?? 0) - (jobDeadlineInstant(a as JobEntry) ?? 0));

  const sections: ArchiveSection[] = [
    {
      title: 'Events and calls',
      html: list(
        events.map((entry) => anyRow(entry, now)),
        'Nothing archived here yet.',
      ),
    },
    {
      title: 'Schools',
      html: list(
        pastSchools.map((entry) => anyRow(entry, now)),
        'Nothing archived here yet.',
      ),
    },
  ];

  // Only shown while the site is tracking jobs at all.
  if (entries.some((entry) => entry.collection === 'jobs')) {
    sections.push({
      title: 'Jobs',
      html: list(
        pastJobs.map((entry) => anyRow(entry, now)),
        'Nothing archived here yet.',
      ),
    });
  }

  return {
    sections,
    years,
    count:
      selected.length === archived.length
        ? plural(archived.length, 'archived entry', 'archived entries')
        : `${selected.length} of ${plural(archived.length, 'archived entry', 'archived entries')}`,
  };
}
