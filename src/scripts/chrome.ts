import { detail, escapeHtml } from '../lib/render.ts';
import {
  combinedCalendarItems,
  itemsInCategories,
  itemsShowing,
  matchesQuery,
} from '../lib/filter.ts';
import { formatDate } from '../lib/dates.ts';
import { CATEGORY_LABELS } from '../lib/taxonomy.ts';
import type { CalendarItem, Category } from '../lib/types.ts';
import { entries, entryById, now } from './store.ts';

const THEME_KEY = 'plfm-theme';

function initTheme(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const root = document.documentElement;
    const current =
      root.dataset.theme ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
    }
  });
}

let lastTrigger: HTMLElement | null = null;

function dialog(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>('#detail-panel');
}

function show(html: string, trigger: HTMLElement | null): void {
  const panel = dialog();
  const body = document.querySelector<HTMLElement>('#detail-body');
  if (!panel || !body) return;

  body.innerHTML = html;
  lastTrigger = trigger;
  if (typeof panel.showModal === 'function') {
    panel.showModal();
  } else {
    panel.setAttribute('open', '');
  }
  panel.scrollTop = 0;
  body.focus();
}

export function openEntry(id: string, trigger: HTMLElement | null = null): void {
  const entry = entryById(id);
  if (!entry) return;
  show(detail(entry, now()), trigger);
}

function openDay(day: string, trigger: HTMLElement | null): void {
  const container = trigger?.closest<HTMLElement>('[data-calendar]');
  const categories = (container?.dataset.categories ?? '')
    .split(',')
    .filter(Boolean) as Category[];
  const query = container?.dataset.query ?? '';

  const items: CalendarItem[] = itemsInCategories(
    itemsShowing(
      combinedCalendarItems(entries().filter((entry) => matchesQuery(entry, query))),
      container?.dataset.calendar ?? 'all',
    ),
    categories,
  ).filter((item) => item.date === day);

  if (items.length === 0) return;

  const list = items
    .map(
      (item) =>
        `<li><button type="button" class="agenda-entry" data-cat="${item.category}" data-detail="${escapeHtml(
          item.id,
        )}"><span class="mark" data-cat="${item.category}" aria-hidden="true"></span><span class="agenda-label">${escapeHtml(
          item.label,
        )}</span><span class="agenda-what">${escapeHtml(
          `${CATEGORY_LABELS[item.category]}, ${item.what}`,
        )}</span></button></li>`,
    )
    .join('');

  show(
    `<h2 class="detail-title">${escapeHtml(formatDate(day))}</h2>` +
      `<ul class="agenda-items" style="margin-top:var(--sp-3)">${list}</ul>`,
    trigger,
  );
}

function initDetail(): void {
  const panel = dialog();

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const close = target.closest<HTMLElement>('[data-detail-close]');
    if (close) {
      panel?.close();
      return;
    }

    const entryTrigger = target.closest<HTMLElement>('[data-detail]');
    if (entryTrigger?.dataset.detail) {
      openEntry(entryTrigger.dataset.detail, entryTrigger);
      return;
    }

    const dayTrigger = target.closest<HTMLElement>('[data-day]');
    if (dayTrigger?.dataset.day) {
      openDay(dayTrigger.dataset.day, dayTrigger);
    }
  });

  if (!panel) return;

  panel.addEventListener('click', (event) => {
    if (event.target === panel) panel.close();
  });

  panel.addEventListener('close', () => {
    lastTrigger?.focus();
    lastTrigger = null;
  });
}

export function initChrome(): void {
  initTheme();
  initDetail();
}
