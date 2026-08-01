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
import { KIND_LABELS } from './taxonomy.ts';
import { itemsByDay } from './filter.ts';
import { escapeHtml } from './render.ts';
import type { CalendarItem, Kind } from './types.ts';

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
  const description = `${KIND_LABELS[item.kind]}, ${item.what}`;
  return [
    '<li class="cal-item">',
    `<button type="button" class="cal-entry" data-kind="${item.kind}"`,
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
          `<li><button type="button" class="agenda-entry" data-kind="${item.kind}" data-detail="${escapeHtml(
            item.id,
          )}"><span class="mark" data-kind="${item.kind}" aria-hidden="true"></span><span class="agenda-label">${escapeHtml(
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

/**
 * The colour key, which doubles as a category filter.
 *
 * `items` should be everything the current filters allow rather than only the
 * month on screen, so that the buttons stay put while you page through the
 * calendar. `active` is the selected category, and it is always offered even
 * when nothing matches it, so a filter can always be cleared.
 *
 * The row is dropped entirely when there is only one category in the whole
 * view and nothing selected: a single button is not a choice.
 */
export function legend(items: CalendarItem[], active: string = 'all'): string {
  const present = new Set<Kind>(items.map((item) => item.kind));
  const order: Kind[] = ['conference', 'workshop', 'school', 'job'];
  const kinds = order.filter((kind) => present.has(kind) || kind === active);

  // One category is a key, not a choice. It only earns a row once there is
  // something to switch between, or something to switch off.
  if (kinds.length < 2 && active === 'all') return '';

  const button = (value: string, label: string, mark: boolean): string =>
    [
      `<button class="legend-item" type="button" data-value="${value}"`,
      ` aria-pressed="${value === active}">`,
      mark ? `<span class="mark" data-kind="${value}" aria-hidden="true"></span>` : '',
      escapeHtml(label),
      '</button>',
    ].join('');

  const parts = [
    button('all', 'All', false),
    ...kinds.map((kind) => button(kind, KIND_LABELS[kind], true)),
  ];

  return `<div class="legend">${parts.join('')}</div>`;
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
