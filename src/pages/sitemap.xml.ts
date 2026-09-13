import type { APIRoute } from 'astro';
import { SITE } from '../../site.config.mjs';
import { lastVerified } from '../lib/data.ts';
import { FEEDS } from '../lib/feeds.ts';
import { url } from '../lib/paths.ts';

const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/archive', priority: '0.3', changefreq: 'monthly' },
  ...FEEDS.map((feed) => ({
    path: `/feeds/${feed.slug}.ics`,
    priority: '0.5',
    changefreq: 'weekly',
  })),
];

export const GET: APIRoute = () => {
  const origin = SITE.url.replace(/\/$/, '');
  // The data changes only when an entry is verified, so that is the honest
  // modification date. A lastmod that moves with every nightly build is
  // ignored by crawlers.
  const lastmod = lastVerified();

  const entries = PAGES.map((page) =>
    [
      '  <url>',
      `    <loc>${origin}${url(page.path)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
      `    <changefreq>${page.changefreq}</changefreq>`,
      `    <priority>${page.priority}</priority>`,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n'),
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
