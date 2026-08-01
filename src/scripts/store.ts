/**
 * The entries for the current page, read once from the JSON block the page
 * embeds. Keeping this in one place means the filter, calendar, and detail
 * code all agree on what is on the page.
 */

import type { Entry } from '../lib/types.ts';
import { todayKey } from '../lib/dates.ts';

let cache: Entry[] | null = null;
let index: Map<string, Entry> | null = null;

export function entries(): Entry[] {
  if (cache) return cache;
  const node = document.getElementById('plfm-entries');
  try {
    cache = node?.textContent ? (JSON.parse(node.textContent) as Entry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function entryById(id: string): Entry | undefined {
  if (!index) {
    index = new Map(entries().map((entry) => [entry.id, entry]));
  }
  return index.get(id);
}

/** Read fresh each time, so a tab left open overnight still behaves. */
export function now(): number {
  return Date.now();
}

export function today(): string {
  return todayKey();
}

/**
 * True when the static HTML was generated on a different day from the one the
 * reader is having, which is the only case where re-rendering is needed.
 */
export function isStale(root: HTMLElement | null): boolean {
  if (!root) return false;
  return root.dataset.builtDay !== today();
}
