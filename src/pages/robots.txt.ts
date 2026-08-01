import type { APIRoute } from 'astro';
import { SITE } from '../../site.config.mjs';
import { url } from '../lib/paths.ts';

export const GET: APIRoute = () => {
  const origin = SITE.url.replace(/\/$/, '');
  const body = `User-agent: *
Allow: /

Sitemap: ${origin}${url('/sitemap.xml')}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
