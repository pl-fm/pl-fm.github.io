/**
 * Internal link helper.
 *
 * The site can be served from a sub-path (a GitHub Pages project page), so
 * every internal href is built here rather than written as a bare `/events`.
 * Client-safe: Vite inlines `BASE_URL` at build time.
 */

const BASE = import.meta.env.BASE_URL ?? '/';

export function url(path = '/'): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const joined = `${base}${suffix}`;
  return joined === '' ? '/' : joined;
}

/** Absolute URL, for metadata and calendar subscriptions. */
export function absolute(origin: string, path = '/'): string {
  return `${origin.replace(/\/$/, '')}${url(path)}`;
}
