# PLFM

Conferences, workshops, schools, events, and opportunities for the programming
languages and formal methods community, collected in one place instead of being
reassembled from mailing lists every few months.

Everything sits on one page: a month calendar carrying submission deadlines, the
events themselves, schools, and school application deadlines, with the month's
dates and the full upcoming list below it. The tabs above the calendar are the
filter — they narrow the grid and both lists together, and they compose with the
search box:

- **All**: every date, each entry listed once at whichever moment comes first
- **Deadlines**: submission deadlines and school application deadlines
- **Events**: conferences, workshops, seminars, symposiums, and community
  meetings
- **Schools**: summer schools, winter schools, doctoral schools, and mentoring
  workshops

A tab is linkable as `/#deadlines`, `/#events`, or `/#schools`, and the old
`/deadlines`, `/events`, and `/schools` URLs redirect to them.

Jobs are supported end to end in the data model and the code, but they are not
surfaced for now. Re-enabling them means restoring `src/pages/jobs.astro` and
`src/scripts/jobs.ts`; `jobsView` and the `data/jobs/` folder are still in
place.

It is an open source repository maintained by
[Bhumika Mittal](https://bhumikamittal.in/). Every page is generated
from YAML files in [`data/`](data), so there is no database and no backend, and
one entry is one file.

To suggest a conference, workshop, event, or school, email
<bhumikamittal@gatech.edu> with a link to the official page. To add or correct
an entry directly, see [CONTRIBUTING.md](CONTRIBUTING.md) for the field
reference.

## Repository layout

```
data/
  deadlines/     calls whose event dates are not announced yet
  events/        conferences, workshops, seminars, community events
  schools/       summer, winter, and doctoral schools, mentoring workshops
  jobs/          PhD, postdoc, faculty, research, internship positions
src/
  lib/           data loading, validation, dates, filtering, rendering, feeds
  components/    header, footer, calendar, detail panel
  pages/         the calendar page, plus archive, ics feeds, sitemap, robots
  scripts/       the small amount of browser code the pages need
  styles/        one stylesheet
scripts/
  validate.ts    the data checker that CI runs
site.config.mjs  URL, maintainer, and title, in one place
```

`src/lib` is split so that the browser only ever loads what it needs.
`types.ts`, `dates.ts`, `taxonomy.ts`, `filter.ts`, `calendar.ts`, `render.ts`,
and `views.ts` are dependency-free and run in both places. `data.ts`,
`schema.ts`, `ics.ts`, and `feeds.ts` read the file system or pull in the
validator, and stay on the build side.

The pages are rendered as static HTML at build time and re-rendered in the
browser only when a filter changes or when the page turns out to be older than
the reader's current day. That way a copy served from a cache weeks later still
hides deadlines that have since passed, and the site works with JavaScript
turned off.

## Local development

Requires Node 22.18 or newer.

```sh
npm install
npm run dev        # http://localhost:4321
```

Other commands:

```sh
npm run validate            # check every file in data/, reporting all problems
npm run validate -- --strict  # treat warnings as errors too
npm run check               # TypeScript and Astro diagnostics
npm run build               # static site into dist/
npm run preview             # serve dist/ locally
npm test                    # validate, check, and build
```

`npm run validate` is worth running before opening a pull request. It reports
every problem in one pass rather than stopping at the first.

## Adding an entry

See [CONTRIBUTING.md](CONTRIBUTING.md) for the templates and the field
reference. In short: copy a template, put it in the right folder under `data/`,
and name the file after its `id`.

Two rules carry most of the weight:

- `source` must be an official page, and `last_verified` must be the day
  someone checked it.
- Deadlines are never inferred. A venue that has not announced its next edition
  gets `deadline_tba: true`, not last year's date.

## Calendar feeds

The site still generates iCalendar files under `/feeds/`, including `all.ics`,
`deadlines.ics`, `events.ics`, `schools.ics`, and one per research area. They
are not linked from anywhere in the interface at the moment, so they are only
reachable if you know the URL.

Feeds are declared in [`src/lib/feeds.ts`](src/lib/feeds.ts). Each is a title,
a description, and a predicate over entries, so a new filtered feed is one
entry in that list and nothing else. Delete `src/pages/feeds/[feed].ics.ts` and
that file to drop the feature entirely.

## Deployment

The site is static, so anything that serves files will host it.

### GitHub Pages

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and
deploys on every push to `main`, and again once a day so that date-based
filtering in the static HTML stays current. Enable it under
**Settings, Pages, Build and deployment, Source: GitHub Actions**.

For a project page served from `https://user.github.io/plfm/`, set both values
in `site.config.mjs`:

```js
url: 'https://user.github.io',
base: '/plfm',
```

For a user or organisation page, or a custom domain, leave `base` as `'/'`.

### Cloudflare Pages or Vercel

Build command `npm run build`, output directory `dist`, Node 22.18 or newer.
Set `url` in `site.config.mjs` to the domain you are serving from, so that
absolute links, the sitemap, and the calendar subscription URLs are right.

## Checks

[`.github/workflows/validate.yml`](.github/workflows/validate.yml) runs the
data checker, the type checker, and a build on every pull request. A malformed
entry fails the pull request rather than reaching the site.

The data schema is strict: an unrecognised field is an error, not something
quietly dropped, so a misspelled `deadline_timzone` cannot silently remove a
deadline from the calendar.

## Sample data

The repository ships a small set of clearly marked placeholder entries so the
interface has something to show. They live in files named `sample-*.yml`, carry
`sample: true`, and use `example.org` addresses. The site labels them and says
so at the top of each page.

None of them are real announcements. Remove them all once real entries exist:

```sh
rm data/*/sample-*.yml
```

## Design

The site is meant to read as a maintained reference, not as a product. Plain
type, hairline separators, no cards, no illustrations, and no motion beyond a
few state transitions. Both themes are first class, follow the operating system
by default, and remember a manual choice. Content sits in a single column about
1060px wide, and the calendar becomes an agenda list on narrow screens rather
than squeezing seven columns onto a phone.

## Licence

Site code: MIT. See [LICENSE](LICENSE).

The contents of `data/` are facts about public announcements, offered under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/). Reuse them freely.
Inclusion here is not an endorsement, and dates should always be confirmed
against the official page before you rely on them.
