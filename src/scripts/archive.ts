import { archiveView } from '../lib/views.ts';
import { entries, isStale, now } from './store.ts';

export function initArchive(): void {
  const root = document.querySelector<HTMLElement>('[data-page="archive"]');
  if (!root) return;

  const group = root.querySelector<HTMLElement>('[data-filter-group="year"]');
  const sections = root.querySelectorAll<HTMLElement>('[data-archive-section]');
  const count = root.querySelector<HTMLElement>('#archive-count');

  function render(year: number | 'all'): void {
    const view = archiveView(entries(), now(), year);
    sections.forEach((section, position) => {
      const built = view.sections[position];
      if (built) section.innerHTML = built.html;
    });
    if (count) count.textContent = view.count;
  }

  // The built page lists the years archived on the day it was built. Entries
  // move into the archive as their dates pass, so a stale page may be missing
  // a year.
  function rebuildYears(): void {
    if (!group) return;
    const { years } = archiveView(entries(), now(), 'all');
    const button = (value: string, label: string, pressed: boolean): string =>
      `<button class="filter" type="button" data-value="${value}" aria-pressed="${pressed}">${label}</button>`;
    group.innerHTML = [
      button('all', 'All', true),
      ...years.map((year) => button(String(year), String(year), false)),
    ].join('');
  }

  group?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      'button[data-value]',
    );
    if (!button) return;
    for (const other of group.querySelectorAll<HTMLElement>('button[data-value]')) {
      other.setAttribute('aria-pressed', String(other === button));
    }
    const value = button.dataset.value ?? 'all';
    render(value === 'all' ? 'all' : Number(value));
  });

  if (isStale(root)) {
    rebuildYears();
    render('all');
  }
}
