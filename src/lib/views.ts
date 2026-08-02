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
  byStartDateDescending,
  combinedCalendarItems,
  deadlineIsTba,
  deadlineOccurrences,
  hasAnnouncedDeadline,
  inCategories,
  isPastEvent,
  itemsInCategories,
  itemsInMonth,
  itemsShowing,
  matchesQuery,
  nextDeadline,
  schoolDeadlineInstant,
  startInstant,
  type FilterState,
} from './filter.ts';
import { categoryOf } from './taxonomy.ts';
import { anyRow, deadlineRow, eventRow, list, schoolRow } from './render.ts';
import type { CalendarItem, Category, Entry } from './types.ts';

export interface MonthContext {
  entries: Entry[];
  state: FilterState;
  /** Reference moment for expiry, in epoch milliseconds. */
  now: number;
  /** `YYYY-MM-DD` used to highlight today in a calendar. */
  today: string;
  year: number;
  month: number;
}

/** Which slice of the calendar the page is showing. */
export type ShowMode = 'all' | 'deadlines' | 'events' | 'schools';

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
function calendarRegions(context: MonthContext, matching: Entry[]): CalendarRegions {
  const { year, month, today, state } = context;

  // Every date the search and the tab allow, across all time. The legend is a
  // control as much as a key, and a row of buttons that comes and goes as you
  // page through the calendar reads as broken — quite apart from stranding you
  // with no way to switch category in a month that happens to hold one of them.
  const available = itemsShowing(combinedCalendarItems(matching), state.show);
  const items = itemsInMonth(
    itemsInCategories(available, state.categories),
    year,
    month,
  );
  const view = { year, month, items, today };

  return {
    monthTitle: formatMonthYear(year, month),
    grid: monthGrid(view),
    agenda: agenda(view),
    legend: legend({
      present: available,
      // Counted before the legend's own filter, so a category that is switched
      // off still says how much it is hiding.
      month: itemsInMonth(available, year, month),
      selected: state.categories,
    }),
    items,
  };
}

/* -------------------------------------------------------------------------- */
/*  Home                                                                       */
/* -------------------------------------------------------------------------- */

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
    const instant = schoolDeadlineInstant(entry);
    return instant !== null && instant >= now ? instant : null;
  }
  return nextDeadline(entry, now)?.instant ?? null;
}

/** An announced-but-undated deadline, which still belongs in a list. */
function awaitingDeadline(entry: Entry): boolean {
  return entry.collection === 'schools'
    ? entry.application_deadline_tba === true
    : deadlineIsTba(entry);
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
  const deadline = openDeadline(entry, now);
  const start = startInstant(entry);
  const running = start !== null && !isPastEvent(entry, now) ? start : null;

  if (deadline !== null && (running === null || deadline <= running)) {
    return { instant: deadline, moment: 'deadline' };
  }
  if (running !== null) {
    return {
      instant: running,
      moment: entry.collection === 'schools' ? 'school' : 'event',
    };
  }
  return null;
}

/** Whether an entry belongs in the list under the calendar, for one tab. */
function isUpcoming(entry: Entry, show: ShowMode, now: number): boolean {
  if (show === 'deadlines') {
    return openDeadline(entry, now) !== null || awaitingDeadline(entry);
  }
  if (show === 'events') {
    return entry.collection === 'events' && !isPastEvent(entry, now);
  }
  if (show === 'schools') {
    return entry.collection === 'schools' && !isPastEvent(entry, now);
  }
  return (
    nextMoment(entry, now) !== null ||
    awaitingDeadline(entry) ||
    entry.dates_tba === true
  );
}

/** The date a list is ordered by. Undated entries sort last. */
function upcomingKey(entry: Entry, show: ShowMode, now: number): number {
  const instant =
    show === 'deadlines'
      ? openDeadline(entry, now)
      : show === 'all'
        ? (nextMoment(entry, now)?.instant ?? null)
        : startInstant(entry);
  return instant ?? Number.POSITIVE_INFINITY;
}

/**
 * Whether a row leads with a closing date or with the dates something runs.
 * The tab decides where it can, and on `All` the entry decides for itself, so
 * a call closing next week reads as a deadline and a conference whose call has
 * closed reads as an event.
 */
function leadsWithDeadline(entry: Entry, show: ShowMode, now: number): boolean {
  if (show === 'deadlines') return true;
  if (show === 'events' || show === 'schools') return false;

  const moment = nextMoment(entry, now)?.moment;
  if (moment !== undefined) return moment === 'deadline';
  // Nothing dated is left, so the row falls back to whatever it is waiting on.
  return awaitingDeadline(entry);
}

/**
 * The legend bucket a row falls in, which is the same question the row already
 * answers when it chooses which date to lead with. Deriving it here rather
 * than from the entry alone is what keeps the list and the calendar agreeing:
 * a conference is coloured as a deadline for exactly as long as its row is
 * showing a deadline.
 */
function rowCategory(entry: Entry, show: ShowMode, now: number): Category {
  return leadsWithDeadline(entry, show, now)
    ? 'deadline'
    : categoryOf(entry, entry.collection === 'schools' ? 'school' : 'event');
}

function upcomingRow(entry: Entry, show: ShowMode, now: number): string {
  const deadline = leadsWithDeadline(entry, show, now);
  if (entry.collection === 'schools') {
    return schoolRow(entry, now, deadline ? 'application' : 'dates');
  }
  return deadline ? deadlineRow(entry, now) : eventRow(entry, now);
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
      if (
        entry.application_deadline &&
        take(entry.id, 'deadline', entry.application_deadline)
      ) {
        rows.push({
          key: entry.application_deadline,
          html: schoolRow(entry, now, 'application'),
        });
      }
      if (entry.start_date && take(entry.id, 'school', entry.start_date)) {
        rows.push({ key: entry.start_date, html: schoolRow(entry, now, 'dates') });
      }
      continue;
    }

    for (const occurrence of deadlineOccurrences(entry)) {
      if (take(entry.id, 'deadline', occurrence.date)) {
        rows.push({
          key: occurrence.date,
          html: deadlineRow(entry, now, occurrence),
        });
      }
    }
    if (entry.start_date && take(entry.id, 'event', entry.start_date)) {
      rows.push({ key: entry.start_date, html: eventRow(entry, now) });
    }
  }

  rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows.map((row) => row.html);
}

/**
 * The single page: one calendar carrying everything dated — submission
 * deadlines, the events themselves, schools, and school application deadlines —
 * with the tab narrowing the grid and both lists below it in step.
 */
export function homeView(context: MonthContext): HomeView {
  const { year, month, now, state, entries } = context;
  const show = (state.show || 'all') as ShowMode;

  const matching = entries.filter((entry) => matchesQuery(entry, state.query));
  const calendar = calendarRegions(context, matching);
  const words = UPCOMING[show] ?? UPCOMING.all;

  const upcoming = matching
    .filter((entry) => isUpcoming(entry, show, now))
    // The legend narrows this list too. It reads as one page, so switching a
    // colour off on the calendar and leaving the same entries listed under it
    // would look like the control had failed.
    .filter((entry) => inCategories(rowCategory(entry, show, now), state.categories))
    .sort(
      (a, b) =>
        upcomingKey(a, show, now) - upcomingKey(b, show, now) ||
        a.name.localeCompare(b.name),
    )
    .map((entry) => upcomingRow(entry, show, now));

  const total = entries.filter((entry) => isUpcoming(entry, show, now)).length;
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
function archivedYear(entry: Entry): number | null {
  if (entry.end_date ?? entry.start_date) {
    return parseDate(entry.end_date ?? entry.start_date)?.year ?? null;
  }
  if (entry.collection === 'events') {
    const last = deadlineOccurrences(entry).at(-1);
    if (last) return parseDate(last.date)?.year ?? null;
  }
  return parseDate(entry.last_verified)?.year ?? null;
}

/** Everything that has passed, newest first. */
function archivedEntries(entries: Entry[], now: number): Entry[] {
  return entries.filter((entry) => {
    if (isPastEvent(entry, now)) return true;
    // A call whose every round has closed, with no event dates to fall back on.
    if (
      entry.collection === 'events' &&
      !entry.start_date &&
      hasAnnouncedDeadline(entry)
    ) {
      return nextDeadline(entry, now) === null;
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
  const years = [
    ...new Set(archived.map(archivedYear).filter((y): y is number => y !== null)),
  ].sort((a, b) => b - a);

  const selected =
    year === 'all' ? archived : archived.filter((entry) => archivedYear(entry) === year);

  const section = (title: string, of: (entry: Entry) => boolean): ArchiveSection => ({
    title,
    html: list(
      selected
        .filter(of)
        .sort(byStartDateDescending)
        .map((entry) => anyRow(entry, now)),
      'Nothing archived here yet.',
    ),
  });

  return {
    sections: [
      section('Events and calls', (entry) => entry.collection === 'events'),
      section('Schools', (entry) => entry.collection === 'schools'),
    ],
    years,
    count:
      selected.length === archived.length
        ? plural(archived.length, 'archived entry', 'archived entries')
        : `${selected.length} of ${plural(archived.length, 'archived entry', 'archived entries')}`,
  };
}
