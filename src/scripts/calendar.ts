/**
 * Month navigation and repainting, shared by every tab that shows a calendar.
 */

import { shiftMonth } from '../lib/dates.ts';
import type { CalendarRegions } from '../lib/views.ts';
import { today } from './store.ts';

export interface MonthState {
  year: number;
  month: number;
}

/** Reads the month the page was generated with, and keeps it in the DOM. */
export function monthState(root: HTMLElement): MonthState {
  return { year: Number(root.dataset.year), month: Number(root.dataset.month) };
}

export function goToToday(state: MonthState): void {
  const [year, month] = today().split('-');
  state.year = Number(year);
  state.month = Number(month);
}

/** Writes the four regions the calendar owns. */
export function paintCalendar(root: HTMLElement, regions: CalendarRegions): void {
  const title = root.querySelector<HTMLElement>('#cal-title');
  const grid = root.querySelector<HTMLElement>('#cal-grid');
  const agenda = root.querySelector<HTMLElement>('#cal-agenda');
  const legend = root.querySelector<HTMLElement>('#cal-legend');

  if (title) title.textContent = regions.monthTitle;
  if (grid) grid.innerHTML = regions.grid;
  if (agenda) agenda.innerHTML = regions.agenda;
  if (legend) legend.innerHTML = regions.legend;
}

export function bindMonthControls(
  root: HTMLElement,
  state: MonthState,
  rerender: () => void,
): void {
  const step = (delta: number): void => {
    const next = shiftMonth(state.year, state.month, delta);
    state.year = next.year;
    state.month = next.month;
    root.dataset.year = String(state.year);
    root.dataset.month = String(state.month);
    rerender();
  };

  root.querySelector('[data-cal-prev]')?.addEventListener('click', () => step(-1));
  root.querySelector('[data-cal-next]')?.addEventListener('click', () => step(1));
  root.querySelector('[data-cal-today]')?.addEventListener('click', () => {
    goToToday(state);
    root.dataset.year = String(state.year);
    root.dataset.month = String(state.month);
    rerender();
  });
}
