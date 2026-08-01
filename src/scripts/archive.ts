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

  if (isStale(root)) render('all');
}
