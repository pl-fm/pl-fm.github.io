/**
 * Wires the calendar tabs, the legend, and the search box to a render callback.
 *
 * The markup owns the initial state: whichever button carries
 * `aria-pressed="true"` when the page loads is the one the static HTML was
 * rendered with.
 *
 * The `show` group behaves as tabs — one value at a time. The `category` group
 * is a set of independent toggles instead: turning `Deadline` off should not
 * turn `School` on.
 */

import { EMPTY_FILTER, type FilterState } from '../lib/filter.ts';
import type { Category } from '../lib/types.ts';

export interface FilterUi {
  state: FilterState;
  /** Re-runs the callback without changing the state. */
  refresh(): void;
}

/**
 * Moves to a tab, which starts the calendar fresh.
 *
 * The legend only offers the categories its tab can produce, so a selection
 * made under one tab may mean nothing under the next: picking `Conference` and
 * then switching to `Schools` would otherwise leave an empty calendar with no
 * obvious cause.
 *
 * Shared with the address bar, which can switch tabs without a click.
 */
export function selectShow(state: FilterState, value: string): void {
  state.show = value;
  state.categories = [];
}

function pressed(group: HTMLElement): string {
  const active = group.querySelector<HTMLElement>('[aria-pressed="true"]');
  return active?.dataset.value ?? 'all';
}

/** Every toggle a multi-select group offers, in the group's own order. */
function values(group: HTMLElement): string[] {
  return [...group.querySelectorAll<HTMLElement>('button[data-value]')]
    .map((button) => button.dataset.value ?? '')
    .filter((value) => value && value !== 'all');
}

/**
 * Which toggles in a multi-select group are on.
 *
 * Everything on is reported as nothing selected, matching what the filter
 * state means by an empty list: no restriction. That keeps a fresh page and a
 * page whose toggles have each been switched back on in the same state.
 */
function pressedAll(group: HTMLElement): string[] {
  const on = [...group.querySelectorAll<HTMLElement>('button[data-value]')].filter(
    (button) =>
      button.dataset.value !== 'all' &&
      button.getAttribute('aria-pressed') === 'true',
  );
  return on.length === values(group).length ? [] : on.map((b) => b.dataset.value!);
}

/**
 * Switches one toggle, given what is currently on. Turning the last one off
 * would leave nothing to look at, so it comes back round to everything, which
 * is also where `Show all` goes.
 */
function toggle(
  current: readonly string[],
  value: string,
  group: HTMLElement,
): string[] {
  const present = values(group);
  const on = new Set(current.length === 0 ? present : current);
  if (on.has(value)) on.delete(value);
  else on.add(value);

  // Everything on and nothing on both mean the same thing to the filter.
  if (on.size === 0 || on.size === present.length) return [];
  return present.filter((v) => on.has(v));
}

export function bindFilters(
  onChange: (state: FilterState) => void,
  root: ParentNode = document,
): FilterUi {
  const state: FilterState = { ...EMPTY_FILTER, categories: [] };

  for (const group of root.querySelectorAll<HTMLElement>('[data-filter-group]')) {
    const name = group.dataset.filterGroup;
    if (name === 'show') state.show = pressed(group);
    if (name === 'category') state.categories = pressedAll(group) as Category[];

    group.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        'button[data-value]',
      );
      if (!button || !group.contains(button)) return;
      const value = button.dataset.value ?? 'all';

      if (name === 'category') {
        // The legend is repainted on every change, so the state is the thing to
        // update here; the buttons are redrawn from it rather than toggled in
        // place.
        state.categories =
          value === 'all' ? [] : (toggle(state.categories, value, group) as Category[]);
        onChange(state);
        return;
      }

      for (const other of group.querySelectorAll<HTMLElement>('button[data-value]')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      // Runs before the callback, so the tab and the legend it clears are drawn
      // in the same pass rather than one repaint apart.
      if (name === 'show') selectShow(state, value);
      onChange(state);
    });
  }

  const search = root.querySelector<HTMLInputElement>('[data-search]');
  if (search) {
    state.query = search.value;
    let timer: number | undefined;
    search.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        state.query = search.value;
        onChange(state);
      }, 90);
    });
    // A search box inside a form should filter rather than navigate.
    search.form?.addEventListener('submit', (event) => event.preventDefault());
  }

  return { state, refresh: () => onChange(state) };
}
