import {
  daysInMonth,
  formatDate,
  mondayFirstWeekday,
  monthName,
  toDayKey,
  WEEKDAYS_LONG,
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
  today: string;
}

const MAX_PER_CELL = 3;

function entryButton(item: CalendarItem): string {
  const description = `${CATEGORY_LABELS[item.category]}, ${item.what}`;
  return [
    '<li class="cal-item">',
    `<button type="button" class="cal-entry" data-cat="${item.category}"`,
    ` data-detail="${escapeHtml(item.id)}"`,
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
): string {
  const isToday = key === today;
  const classes = ['cal-cell'];
  if (isToday) classes.push('is-today');
  if (key < today) classes.push('is-past');
  if (items.length > 0) classes.push('has-items');

  const shown = items.slice(0, MAX_PER_CELL);
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

export function monthGrid(view: MonthView): string {
  const { year, month, today } = view;
  const byDay = itemsByDay(view.items);

  const total = daysInMonth(year, month);
  const leading = mondayFirstWeekday(year, month, 1);
  const cells: string[] = [];

  for (let i = 0; i < leading; i += 1) {
    cells.push('<td class="cal-cell is-blank"></td>');
  }
  for (let day = 1; day <= total; day += 1) {
    const key = toDayKey(year, month, day);
    cells.push(cell(key, day, byDay.get(key) ?? [], today));
  }
  while (cells.length % 7 !== 0) {
    cells.push('<td class="cal-cell is-blank"></td>');
  }

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  }

  const head = WEEKDAYS_SHORT.map(
    (day, i) =>
      `<th scope="col"><abbr title="${escapeHtml(WEEKDAYS_LONG[i] ?? day)}">${escapeHtml(
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
  present: CalendarItem[];
  month: CalendarItem[];
  selected: readonly Category[];
}

export function legend(view: LegendView): string {
  const { selected } = view;
  const present = new Set<Category>(view.present.map((item) => item.category));
  const categories = CATEGORIES.filter(
    (category) => present.has(category) || selected.includes(category),
  );

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
