const BASE = import.meta.env.BASE_URL ?? '/';

export function url(path = '/'): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const joined = `${base}${suffix}`;
  return joined === '' ? '/' : joined;
}
