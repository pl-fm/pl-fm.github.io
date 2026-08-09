import { EMPTY_FILTER, type FilterState } from '../lib/filter.ts';
import type { Category } from '../lib/types.ts';

export interface FilterUi {
  state: FilterState;
  refresh(): void;
}

export function selectShow(state: FilterState, value: string): void {
  state.show = value;
  state.categories = [];
}

function pressed(group: HTMLElement): string {
  const active = group.querySelector<HTMLElement>('[aria-pressed="true"]');
  return active?.dataset.value ?? 'all';
}

function values(group: HTMLElement): string[] {
  return [...group.querySelectorAll<HTMLElement>('button[data-value]')]
    .map((button) => button.dataset.value ?? '')
    .filter((value) => value && value !== 'all');
}

function pressedAll(group: HTMLElement): string[] {
  const on = [...group.querySelectorAll<HTMLElement>('button[data-value]')].filter(
    (button) =>
      button.dataset.value !== 'all' &&
      button.getAttribute('aria-pressed') === 'true',
  );
  return on.length === values(group).length ? [] : on.map((b) => b.dataset.value!);
}

function toggle(
  current: readonly string[],
  value: string,
  group: HTMLElement,
): string[] {
  const present = values(group);
  const on = new Set(current.length === 0 ? present : current);
  if (on.has(value)) on.delete(value);
  else on.add(value);

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
        state.categories =
          value === 'all' ? [] : (toggle(state.categories, value, group) as Category[]);
        onChange(state);
        return;
      }

      for (const other of group.querySelectorAll<HTMLElement>('button[data-value]')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
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
    search.form?.addEventListener('submit', (event) => event.preventDefault());
  }

  return { state, refresh: () => onChange(state) };
}
