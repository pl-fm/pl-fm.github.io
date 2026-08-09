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

export function now(): number {
  return Date.now();
}

export function today(): string {
  return todayKey();
}

export function isStale(root: HTMLElement | null): boolean {
  if (!root) return false;
  return root.dataset.builtDay !== today();
}
