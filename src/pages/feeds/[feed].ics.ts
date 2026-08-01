import type { APIRoute, GetStaticPaths } from 'astro';
import { loadEntries } from '../../lib/data.ts';
import { FEEDS, collectFeedEvents, feedBySlug } from '../../lib/feeds.ts';
import { buildCalendar } from '../../lib/ics.ts';

/** One static `.ics` file per entry in the feed registry. */
export const getStaticPaths = (() =>
  FEEDS.map((feed) => ({ params: { feed: feed.slug } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const feed = params.feed ? feedBySlug(params.feed) : undefined;
  if (!feed) return new Response('Not found', { status: 404 });

  const body = buildCalendar({
    name: feed.title,
    description: feed.description,
    events: collectFeedEvents(feed, loadEntries()),
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="plfm-${feed.slug}.ics"`,
    },
  });
};
