/**
 * Wires the filter bars and the search box to a render callback.
 *
 * The markup owns the initial state: whichever button carries
 * `aria-pressed="true"` when the page loads is the one the static HTML was
 * rendered with.
 */

import { EMPTY_FILTER, type FilterState } from '../lib/filter.ts';

export interface FilterUi {
  state: FilterState;
  /** Re-runs the callback without changing the state. */
  refresh(): void;
}

function pressed(group: HTMLElement): string {
  const active = group.querySelector<HTMLElement>('[aria-pressed="true"]');
  return active?.dataset.value ?? 'all';
}

export function bindFilters(
  onChange: (state: FilterState) => void,
  root: ParentNode = document,
): FilterUi {
  const state: FilterState = { ...EMPTY_FILTER };
  const groups = root.querySelectorAll<HTMLElement>('[data-filter-group]');

  for (const group of groups) {
    const name = group.dataset.filterGroup;
    if (name === 'area') state.area = pressed(group);
    if (name === 'type') state.type = pressed(group);
    if (name === 'kind') state.kind = pressed(group);
    if (name === 'show') state.show = pressed(group);

    group.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        'button[data-value]',
      );
      if (!button || !group.contains(button)) return;

      for (const other of group.querySelectorAll<HTMLElement>('button[data-value]')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      const value = button.dataset.value ?? 'all';
      if (name === 'area') state.area = value;
      if (name === 'type') state.type = value;
      if (name === 'kind') state.kind = value;
      if (name === 'show') state.show = value;
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

  return {
    state,
    refresh: () => onChange(state),
  };
}

