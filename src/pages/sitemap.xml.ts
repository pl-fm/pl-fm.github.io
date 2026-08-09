import type { APIRoute } from 'astro';
import { SITE } from '../../site.config.mjs';
import { todayKey } from '../lib/dates.ts';
import { url } from '../lib/paths.ts';

const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/archive', priority: '0.3', changefreq: 'monthly' },
];

export const GET: APIRoute = () => {
  const origin = SITE.url.replace(/\/$/, '');
  const lastmod = todayKey();

  const entries = PAGES.map(
    (page) => `  <url>
    <loc>${origin}${url(page.path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  ).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
