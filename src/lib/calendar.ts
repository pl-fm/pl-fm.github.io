/**
 * The month grid.
 *
 * A calendar is tabular data, so it is built as a real `<table>`: screen
 * readers announce the weekday and the row without any ARIA bookkeeping.
 * Narrow screens get the agenda list instead, because seven columns of
 * conference acronyms are unreadable on a phone.
 *
 * Client-safe. Both views are produced here and the stylesheet picks one, so
 * only one of them is ever in the accessibility tree.
 */

import {
  daysInMonth,
  formatDate,
  mondayFirstWeekday,
  monthName,
  toDayKey,
  WEEKDAYS_SHORT,
} from './dates.ts';
import {
  CATEGORIES,
  CATEGORY_HINTS,
  CATEGORY_LABELS,
} from './taxonomy.ts';
import { countByCategory, itemsByDay } from './filter.ts';
import { escapeHtml } from './render.ts';
import type { CalendarItem, Category } from './types.ts';

export interface MonthView {
  year: number;
  month: number;
  items: CalendarItem[];
  /** `YYYY-MM-DD` for the reader's today, so it can be highlighted. */
  today: string;
  /** Entries shown before a cell collapses into a `+n` control. */
  maxPerCell?: number;
}

const DEFAULT_MAX_PER_CELL = 3;

function entryButton(item: CalendarItem, index: number): string {
  // Colour is the only thing separating a deadline from the event it belongs
  // to in a cell this small, so the category is also spelled out for anyone
  // not reading the colour: a screen reader, or a printout.
  const description = `${CATEGORY_LABELS[item.category]}, ${item.what}`;
  return [
    '<li class="cal-item">',
    `<button type="button" class="cal-entry" data-cat="${item.category}"`,
    ` data-detail="${escapeHtml(item.id)}" data-index="${index}"`,
    ` title="${escapeHtml(`${item.title}: ${item.what}`)}">`,
    `<span class="cal-entry-label">${escapeHtml(item.short)}</span>`,
    `<span class="sr-only"> ${escapeHtml(item.label)} (${escapeHtml(description)})</span>`,
    '</button>',
    '</li>',
  ].join('');
}

function cell(
  key: string,
  day: number,
  items: CalendarItem[],
  today: string,
  maxPerCell: number,
): string {
  const isToday = key === today;
  const isPast = key < today;
  const classes = ['cal-cell'];
  if (isToday) classes.push('is-today');
  if (isPast) classes.push('is-past');
  if (items.length > 0) classes.push('has-items');

  const shown = items.slice(0, maxPerCell);
  const hidden = items.length - shown.length;

  const overflow =
    hidden > 0
      ? `<li class="cal-item"><button type="button" class="cal-more" data-day="${key}">+${hidden}<span class="sr-only"> more on ${escapeHtml(
          formatDate(key),
        )}</span></button></li>`
      : '';

  return [
    `<td class="${classes.join(' ')}"${isToday ? ' aria-current="date"' : ''}>`,
    `<span class="cal-num">${day}</span>`,
    items.length > 0
      ? `<ul class="cal-items">${shown.map(entryButton).join('')}${overflow}</ul>`
      : '',
    '</td>',
  ].join('');
}

/** The `<table>` for one month. */
export function monthGrid(view: MonthView): string {
  const { year, month, today } = view;
  const maxPerCell = view.maxPerCell ?? DEFAULT_MAX_PER_CELL;
  const byDay = itemsByDay(view.items);

  const total = daysInMonth(year, month);
  const leading = mondayFirstWeekday(year, month, 1);
  const cells: string[] = [];

  for (let i = 0; i < leading; i += 1) {
    cells.push('<td class="cal-cell is-blank"></td>');
  }
  for (let day = 1; day <= total; day += 1) {
    const key = toDayKey(year, month, day);
    cells.push(cell(key, day, byDay.get(key) ?? [], today, maxPerCell));
  }
  while (cells.length % 7 !== 0) {
    cells.push('<td class="cal-cell is-blank"></td>');
  }

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  }

  const head = WEEKDAYS_SHORT.map(
    (day) =>
      `<th scope="col"><abbr title="${escapeHtml(weekdayLong(day))}">${escapeHtml(
        day,
      )}</abbr></th>`,
  ).join('');

  return [
    '<table class="cal">',
    `<caption class="sr-only">${escapeHtml(
      `${monthName(month)} ${year}`,
    )}</caption>`,
    `<thead><tr>${head}</tr></thead>`,
    `<tbody>${rows.join('')}</tbody>`,
    '</table>',
  ].join('');
}

/** Day-by-day list used instead of the grid on narrow screens. */
export function agenda(view: MonthView): string {
  const byDay = itemsByDay(view.items);
  const days = [...byDay.keys()].sort();

  if (days.length === 0) {
    return '<p class="empty">Nothing scheduled this month.</p>';
  }

  const blocks = days.map((key) => {
    const items = byDay.get(key) ?? [];
    const parts = items
      .map(
        (item) =>
          `<li><button type="button" class="agenda-entry" data-cat="${item.category}" data-detail="${escapeHtml(
            item.id,
          )}"><span class="mark" data-cat="${item.category}" aria-hidden="true"></span><span class="agenda-label">${escapeHtml(
            item.label,
          )}</span><span class="agenda-what">${escapeHtml(item.what)}</span></button></li>`,
      )
      .join('');
    const isToday = key === view.today;
    return [
      `<div class="agenda-day${isToday ? ' is-today' : ''}">`,
      `<h4 class="agenda-date">${escapeHtml(formatDate(key))}${
        isToday ? '<span class="agenda-today">today</span>' : ''
      }</h4>`,
      `<ul class="agenda-items">${parts}</ul>`,
      '</div>',
    ].join('');
  });

  return `<div class="agenda">${blocks.join('')}</div>`;
}

export interface LegendView {
  /** Every category the current filters can produce, in reading order. */
  present: CalendarItem[];
  /** Just the month on screen, which is what the counts are drawn from. */
  month: CalendarItem[];
  /** The categories switched on. Empty means all of them. */
  selected: readonly Category[];
}

/**
 * The colour key below the calendar, which doubles as the category filter.
 *
 * It is a set of toggles rather than a row of tabs: the tabs above already ask
 * which single kind of date you want, and answering that question twice in two
 * places would be no use. What this adds is the combinations the tabs cannot
 * express — deadlines and schools but not conferences, say — so each button
 * turns its own colour on and off independently.
 *
 * `present` decides which buttons exist and should be everything the current
 * filters allow rather than only the month on screen, so the row does not
 * reshuffle under the pointer as you page through the calendar. `month` only
 * decides the counts, which are allowed to change with the month because a
 * count is what you came to the legend to read.
 */
export function legend(view: LegendView): string {
  const { selected } = view;
  const present = new Set<Category>(view.present.map((item) => item.category));
  // A selected category always keeps its button even once nothing matches it,
  // so a filter can never strand you with no way to undo it.
  const categories = CATEGORIES.filter(
    (category) => present.has(category) || selected.includes(category),
  );

  // One category is a key, not a choice. It only earns a row of controls once
  // there is something to switch between, or something to switch off.
  if (categories.length < 2 && selected.length === 0) return '';

  const counts = countByCategory(view.month);
  const all = selected.length === 0;

  const button = (category: Category): string => {
    const on = all || selected.includes(category);
    const count = counts[category] ?? 0;
    const label = CATEGORY_LABELS[category];
    const classes = ['legend-item'];
    if (!on) classes.push('is-off');
    if (count === 0) classes.push('is-empty');

    return [
      `<button class="${classes.join(' ')}" type="button" data-value="${category}"`,
      ` aria-pressed="${on}" title="${escapeHtml(CATEGORY_HINTS[category])}">`,
      `<span class="mark" data-cat="${category}" aria-hidden="true"></span>`,
      `<span class="legend-label">${escapeHtml(label)}</span>`,
      `<span class="legend-count" aria-hidden="true">${count}</span>`,
      `<span class="sr-only">, ${escapeHtml(
        `${count} this month`,
      )}. ${escapeHtml(on ? 'Showing' : 'Hidden')}.</span>`,
      '</button>',
    ].join('');
  };

  // Only offered once it would do something. Its job is to undo a narrowing,
  // and a button that is already the state you are in is noise.
  const reset = all
    ? ''
    : '<button class="legend-reset" type="button" data-value="all">Show all</button>';

  return [
    '<div class="legend">',
    `<div class="legend-items">${categories.map(button).join('')}</div>`,
    reset,
    '</div>',
  ].join('');
}

function weekdayLong(short: string): string {
  const table: Record<string, string> = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday',
  };
  return table[short] ?? short;
}
