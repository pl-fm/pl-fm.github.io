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
  now: number;
  today: string;
  year: number;
  month: number;
}

export type ShowMode = 'all' | 'deadlines' | 'events' | 'schools';

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export interface CalendarRegions {
  monthTitle: string;
  grid: string;
  agenda: string;
  legend: string;
  items: CalendarItem[];
}

function calendarRegions(context: MonthContext, matching: Entry[]): CalendarRegions {
  const { year, month, today, state } = context;

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
      month: itemsInMonth(available, year, month),
      selected: state.categories,
    }),
    items,
  };
}

export interface HomeView extends CalendarRegions {
  monthHeading: string;
  monthList: string;
  upcomingHeading: string;
  upcomingList: string;
  count: string;
}

function openDeadline(entry: Entry, now: number): number | null {
  if (entry.collection === 'schools') {
    const instant = schoolDeadlineInstant(entry);
    return instant !== null && instant >= now ? instant : null;
  }
  return nextDeadline(entry, now)?.instant ?? null;
}

function awaitingDeadline(entry: Entry): boolean {
  return entry.collection === 'schools'
    ? entry.application_deadline_tba === true
    : deadlineIsTba(entry);
}

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

function upcomingKey(entry: Entry, show: ShowMode, now: number): number {
  const instant =
    show === 'deadlines'
      ? openDeadline(entry, now)
      : show === 'all'
        ? (nextMoment(entry, now)?.instant ?? null)
        : startInstant(entry);
  return instant ?? Number.POSITIVE_INFINITY;
}

function leadsWithDeadline(entry: Entry, show: ShowMode, now: number): boolean {
  if (show === 'deadlines') return true;
  if (show === 'events' || show === 'schools') return false;

  const moment = nextMoment(entry, now)?.moment;
  if (moment !== undefined) return moment === 'deadline';
  return awaitingDeadline(entry);
}

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

export function homeView(context: MonthContext): HomeView {
  const { year, month, now, state, entries } = context;
  const show = (state.show || 'all') as ShowMode;

  const matching = entries.filter((entry) => matchesQuery(entry, state.query));
  const calendar = calendarRegions(context, matching);
  const words = UPCOMING[show] ?? UPCOMING.all;

  const upcoming = matching
    .filter((entry) => isUpcoming(entry, show, now))
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

export interface ArchiveSection {
  title: string;
  html: string;
}

export interface ArchiveView {
  sections: ArchiveSection[];
  count: string;
  years: number[];
}

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

function archivedEntries(entries: Entry[], now: number): Entry[] {
  return entries.filter((entry) => {
    if (isPastEvent(entry, now)) return true;
    if (
      entry.collection === 'events' &&
      !entry.start_date &&
      entry.dates_tba !== true &&
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
