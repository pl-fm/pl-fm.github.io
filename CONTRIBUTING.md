# Contributing to PLFM

Adding something to PLFM means adding **one YAML file**. No build step, no
JavaScript, no components to touch. Continuous integration checks the file for
you and the site regenerates itself from it.

If you would rather not open a pull request, [open an
issue](../../issues/new/choose) instead and someone will add the entry for you.

## The short version

1. Work out which folder the entry belongs in:

   | Folder            | What goes in it                                                        |
   | ----------------- | ---------------------------------------------------------------------- |
   | `data/events/`    | Conferences, workshops, seminars, symposiums, and community events, with their submission deadlines |
   | `data/deadlines/` | Calls whose event dates have not been announced yet                     |
   | `data/schools/`   | Summer schools, winter schools, doctoral schools, mentoring workshops   |
   | `data/jobs/`      | PhD, postdoc, faculty, research, and internship positions               |

   Most conference calls go in `data/events/`, because a call for papers almost
   always comes with the dates of the meeting. Use `data/deadlines/` only when
   the deadline is public and the event dates are not.

2. Create a file named after the entry, for example
   `data/events/popl-2027.yml`. The file name without its extension has to
   match the `id` field.

3. Copy the matching template below, fill it in, and delete the fields you do
   not need.

4. Check it locally if you can:

   ```sh
   npm install
   npm run validate
   ```

5. Open a pull request.

## Templates

### A conference or workshop

```yaml
id: popl-2027
name: Principles of Programming Languages
acronym: POPL 2027
type: conference # conference, workshop, seminar, symposium, community-meeting, colocated
areas:
  - programming-languages
  - formal-methods
deadline: 2026-07-09T23:59:00
deadline_timezone: AoE
start_date: 2027-01-17
end_date: 2027-01-23
location: Paris
country: France
url: https://example.org/popl-2027
source: https://example.org/popl-2027/call-for-papers
last_verified: 2026-08-01
```

Several submission rounds, which is normal for PL venues:

```yaml
deadlines:
  - label: Abstract
    date: 2026-07-02T23:59:00
    timezone: AoE
  - label: Paper
    date: 2026-07-09T23:59:00
    timezone: AoE
  - label: Artifact
    date: 2026-09-25T23:59:00
    timezone: AoE
```

Every round appears on the calendar and in the month list. Keep `deadline` for
the main one so that entries without rounds stay simple.

### A school

```yaml
id: oplss-2027
name: Oregon Programming Languages Summer School
acronym: OPLSS 2027
type: summer-school # summer-school, winter-school, doctoral-school, mentoring
areas:
  - programming-languages
  - logic
  - types
start_date: 2027-06-14
end_date: 2027-06-25
location: Eugene, Oregon
country: United States
application_deadline: 2027-03-15T23:59:00
application_deadline_timezone: AoE
eligibility: # students, phd, postdocs, everyone
  - students
  - phd
funding: Travel support available
recurring: annual
url: https://example.org/oplss
source: https://example.org/oplss/2027
last_verified: 2026-08-01
```

### A job

```yaml
id: postdoc-verification-example-university
name: Postdoctoral Researcher in Program Verification
position_type: postdoc # phd, postdoc, faculty, research, internship
institution: Example University
areas:
  - formal-methods
  - verification
location: Delft
country: Netherlands
deadline: 2026-10-15T23:59:00
deadline_timezone: UTC+1
posted: 2026-08-01
url: https://example.org/jobs/postdoc-verification
source: https://example.org/jobs/postdoc-verification
last_verified: 2026-08-01
```

A position with no closing date needs `open_until_filled: true` instead of
`deadline`. Those listings leave the board twelve months after `posted` unless
someone updates `posted` and `last_verified`, which keeps dead links from
accumulating.

`position_type: research` covers research engineers, research scientists, and
similar staff roles.

## The rules that matter

**Give a real source.** `source` has to be the official page: the venue, the
organiser, the institution, or the employer. Not an aggregator, not a mailing
list archive, not a social media post. If the only source you have is
second-hand, say so in the pull request and someone will look for the official
page.

**Never invent a deadline.** If the deadline has not been announced, write
`deadline_tba: true` rather than leaving the field out or guessing. The same
goes for dates:

```yaml
deadline_tba: true
dates_tba: true
```

**Do not carry a date forward from last year.** A venue that has not announced
its next edition does not have a date. Recurring events often move by weeks.
An entry that says TBA is more useful than one that is confidently wrong.

**Set `last_verified` to the day you checked the source**, in `YYYY-MM-DD`
form. This is what tells a later reader how much to trust the entry. Updating
an existing entry means updating this field too.

## Field reference

Fields marked required are required in every collection.

| Field           | Required | Notes                                                          |
| --------------- | -------- | -------------------------------------------------------------- |
| `id`            | yes      | Lowercase words joined by hyphens. Must match the file name.    |
| `name`          | yes      | Full name, written out.                                         |
| `acronym`       | no       | For example `POPL 2027`. This is what the calendar shows.       |
| `areas`         | yes      | One or more slugs from the list below.                          |
| `url`           | no       | The page a reader should visit.                                 |
| `description`   | no       | One sentence at most. Skip it if the name says enough.          |
| `source`        | yes      | Official page the entry was taken from.                         |
| `last_verified` | yes      | `YYYY-MM-DD`, the day someone checked `source`.                 |
| `notes`         | no       | Anything a reader needs to know that no other field covers.     |

Dates accept `YYYY-MM-DD`, `YYYY-MM-DDTHH:MM:00`, and `YYYY-MM` when only the
month is known.

Timezones accept `AoE` (Anywhere on Earth, which is UTC-12 and the usual
convention for calls for papers), `UTC`, a fixed offset such as `UTC+2` or
`UTC-5`, and `local`. Named zones such as `Europe/Paris` are not accepted,
because resolving them would need a timezone database that this site
deliberately does not carry.

### Research areas

```
programming-languages    formal-methods           verification
compilers                types                    logic
synthesis                program-analysis         semantics
functional-programming   concurrency              security
theorem-proving          model-checking           probabilistic-programming
quantum
```

To add an area, add it to `AREAS` and `AREA_LABELS` in
`src/lib/taxonomy.ts` in the same pull request. Keep the list short: an area
that fits only one entry is better expressed in `description`.

## Corrections

If a date here disagrees with the official page, the official page is right.
Open a [correction issue](../../issues/new?labels=correction) or send a pull
request that fixes the field and updates `last_verified`.

Past entries are never deleted for being past. They move to `/archive` and stay
there, so that a link to an entry keeps working.

## What the checks look for

`npm run validate` runs on every pull request. It fails when:

- the YAML does not parse, or the file holds more than one entry
- a required field is missing, or a field has the wrong type
- a field name is misspelled, since unknown fields are rejected rather than
  ignored
- `id` does not match the file name, or is already used by another entry
- a date is malformed or does not exist, such as `2026-02-30`
- `end_date` falls before `start_date`
- a job has neither `deadline` nor `open_until_filled`
- `source` or `url` is not an `http://` or `https://` address

It warns, without failing, when a deadline has no timezone, when a deadline
falls after the event it belongs to, and on a few similar mistakes that are
usually typos. Run `npm run validate -- --strict` to treat warnings as errors.

## Style

Keep entries factual. PLFM records what a venue or employer has announced; it
does not describe, rank, or recommend. Copy names as the organisers write them.
