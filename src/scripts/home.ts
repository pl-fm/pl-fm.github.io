/**
 * The single page: the tabs, the calendar, and the two lists under it, all
 * driven by one filter state.
 */

import type { FilterState } from '../lib/filter.ts';
import { homeView, type ShowMode } from '../lib/views.ts';
import { bindMonthControls, goToToday, monthState, paintCalendar } from './calendar.ts';
import { bindFilters, selectShow } from './filters.ts';
import { entries, isStale, now, today } from './store.ts';

const MODES: readonly string[] = ['all', 'deadlines', 'events', 'schools'];

/** `#events` and friends open the page with that tab already selected. */
function modeFromHash(): ShowMode | null {
  const hash = decodeURIComponent(window.location.hash).replace(/^#/, '');
  return MODES.includes(hash) ? (hash as ShowMode) : null;
}

function press(group: HTMLElement, value: string): void {
  for (const button of group.querySelectorAll<HTMLElement>('button[data-value]')) {
    button.setAttribute('aria-pressed', String(button.dataset.value === value));
  }
}

export function initHome(): void {
  const root = document.querySelector<HTMLElement>('[data-page="home"]');
  if (!root) return;

  const tabs = root.querySelector<HTMLElement>('[data-filter-group="show"]');
  const calendar = root.querySelector<HTMLElement>('[data-calendar]');
  const monthHeading = root.querySelector<HTMLElement>('#month-heading');
  const monthList = root.querySelector<HTMLElement>('#month-list');
  const upcomingHeading = root.querySelector<HTMLElement>('#upcoming-heading');
  const upcomingList = root.querySelector<HTMLElement>('#upcoming-list');
  const count = root.querySelector<HTMLElement>('#upcoming-count');

  const month = monthState(root);

  // Applied before the filters read the markup, so a linked tab is the state
  // the page starts in rather than a correction made after the first render.
  const linked = modeFromHash();
  if (linked && tabs) press(tabs, linked);

  function render(state: FilterState): void {
    const view = homeView({
      entries: entries(),
      state,
      now: now(),
      today: today(),
      year: month.year,
      month: month.month,
    });

    paintCalendar(root!, view);
    // What a `+n` cell should open with.
    if (calendar) {
      calendar.dataset.calendar = state.show;
      calendar.dataset.query = state.query;
      calendar.dataset.categories = state.categories.join(',');
    }
    if (monthHeading) monthHeading.textContent = view.monthHeading;
    if (monthList) monthList.innerHTML = view.monthList;
    if (upcomingHeading) upcomingHeading.textContent = view.upcomingHeading;
    if (upcomingList) upcomingList.innerHTML = view.upcomingList;
    if (count) count.textContent = view.count;
  }

  const ui = bindFilters(render, root);
  bindMonthControls(root, month, () => render(ui.state));

  // Keeps the address bar on the selected tab, so a view can be linked to and
  // survives a reload. `All` is the bare page.
  tabs?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      'button[data-value]',
    );
    if (!button || !tabs.contains(button)) return;
    const value = button.dataset.value ?? 'all';
    const { pathname, search } = window.location;
    history.replaceState(null, '', value === 'all' ? pathname + search : `#${value}`);
  });

  window.addEventListener('hashchange', () => {
    const wanted = modeFromHash() ?? 'all';
    if (wanted === ui.state.show || !tabs) return;
    press(tabs, wanted);
    selectShow(ui.state, wanted);
    ui.refresh();
  });

  // The page may have been generated days ago and served from a cache. Move to
  // the reader's own month and drop anything that has closed since the build.
  const stale = isStale(root);
  if (stale) goToToday(month);
  if (stale || linked) ui.refresh();
}
