/**
 * HTML for list rows and the detail panel.
 *
 * These builders return strings so that the same code renders the static page
 * at build time and re-renders it in the browser when a filter changes. That
 * keeps one description of a row rather than two that drift apart.
 *
 * Client-safe. Every interpolated value goes through `escapeHtml`.
 */

import {
  formatDate,
  formatDateRange,
  formatDeadline,
  relativeDeadline,
} from './dates.ts';
import {
  deadlineIsTba,
  deadlineOccurrences,
  jobDeadlineInstant,
  nextDeadline,
  schoolDeadlineInstant,
  type DeadlineOccurrence,
} from './filter.ts';
import {
  AREA_LABELS,
  AUDIENCE_LABELS,
  EVENT_TYPE_LABELS,
  KIND_LABELS,
  POSITION_TYPE_LABELS,
  SCHOOL_TYPE_LABELS,
  kindOf,
} from './taxonomy.ts';
import type { Entry, EventEntry, JobEntry, SchoolEntry } from './types.ts';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** Blocks `javascript:` and similar, in case a data file ever carries one. */
export function safeUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

/** Serialises data for a `<script type="application/json">` block. */
export function jsonPayload(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function join(parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(' · ');
}

function areaNames(entry: Entry): string[] {
  return entry.areas.map((a) => AREA_LABELS[a] ?? a);
}

function locationOf(entry: Entry): string | null {
  const value = entry as { location?: string; country?: string };
  if (value.location && value.country && !value.location.includes(value.country)) {
    return `${value.location}, ${value.country}`;
  }
  return value.location ?? value.country ?? null;
}

function websiteLink(entry: Entry, label = 'Website'): string {
  const href = safeUrl(entry.url) ?? safeUrl(entry.source);
  if (!href) return '';
  return `<a class="row-link" href="${escapeHtml(href)}">${escapeHtml(label)} <span aria-hidden="true">&rarr;</span></a>`;
}

function sampleTag(entry: Entry): string {
  return entry.sample
    ? '<span class="tag tag-sample" title="Demonstration entry, not a real announcement">sample</span>'
    : '';
}

function kindMark(entry: Entry): string {
  const kind = kindOf(entry);
  return `<span class="mark" data-kind="${kind}" aria-hidden="true"></span>`;
}

interface RowParts {
  entry: Entry;
  /** Headline text, usually the acronym. */
  title: string;
  /** Second line, usually the full name. */
  subtitle?: string | null;
  /** Right-hand column. */
  date?: string | null;
  dateClass?: string;
  /** Short hint under the date, for example `in 12 days`. */
  hint?: string | null;
  /** Type, areas, and location. */
  meta: string;
  /** Optional extra line for funding, colocation, and similar. */
  note?: string | null;
}

function row(parts: RowParts): string {
  const { entry, title, subtitle, date, hint, meta, note } = parts;
  const dateClass = parts.dateClass ? ` ${parts.dateClass}` : '';

  return [
    `<article class="row" data-id="${escapeHtml(entry.id)}">`,
    '<div class="row-head">',
    `<h3 class="row-title">${escapeHtml(title)}${sampleTag(entry)}</h3>`,
    date
      ? `<p class="row-date${dateClass}">${escapeHtml(date)}${
          hint ? `<span class="row-hint">${escapeHtml(hint)}</span>` : ''
        }</p>`
      : '',
    '</div>',
    subtitle ? `<p class="row-sub">${escapeHtml(subtitle)}</p>` : '',
    '<div class="row-foot">',
    `<p class="row-meta">${kindMark(entry)}${escapeHtml(meta)}</p>`,
    '<span class="row-actions">',
    `<button class="row-more" type="button" data-detail="${escapeHtml(entry.id)}">Details</button>`,
    websiteLink(entry),
    '</span>',
    '</div>',
    note ? `<p class="row-note">${escapeHtml(note)}</p>` : '',
    '</article>',
  ]
    .filter(Boolean)
    .join('');
}

/* ------------------------------------------------------------------------ */
/*  Rows                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * `occurrence` pins the row to a particular round, which the month list uses
 * so that August shows August's deadline rather than the next one overall.
 */
export function deadlineRow(
  entry: EventEntry,
  now: number,
  occurrence?: DeadlineOccurrence | null,
): string {
  const next = occurrence ?? nextDeadline(entry, now);
  const hint = next ? relativeDeadline(next.instant, now) : '';
  const label = next?.label ? `${next.label}: ` : '';

  return row({
    entry,
    title: entry.acronym ?? entry.name,
    subtitle: entry.acronym ? entry.name : null,
    date: next
      ? `${label}${formatDeadline(next.date, next.timezone)}`
      : deadlineIsTba(entry)
        ? 'Deadline TBA'
        : null,
    dateClass: next ? '' : 'is-tba',
    hint: hint || null,
    meta: join([
      EVENT_TYPE_LABELS[entry.type],
      ...areaNames(entry),
      locationOf(entry),
    ]),
    note: entry.colocated_with ? `Colocated with ${entry.colocated_with}` : null,
  });
}

export function eventRow(entry: EventEntry, now: number): string {
  const next = nextDeadline(entry, now);
  const dates = entry.dates_tba
    ? 'Dates TBA'
    : formatDateRange(entry.start_date, entry.end_date);

  const submission = next
    ? `Submission deadline: ${formatDeadline(next.date, next.timezone)}`
    : deadlineIsTba(entry)
      ? 'Submission deadline: TBA'
      : null;

  const colocated = entry.colocated_with
    ? `Colocated with ${entry.colocated_with}`
    : null;

  return row({
    entry,
    title: entry.acronym ?? entry.name,
    subtitle: entry.acronym ? entry.name : null,
    date: dates || null,
    dateClass: entry.dates_tba ? 'is-tba' : '',
    meta: join([
      EVENT_TYPE_LABELS[entry.type],
      ...areaNames(entry),
      locationOf(entry),
    ]),
    note: join([submission, colocated]) || null,
  });
}

export function schoolRow(
  entry: SchoolEntry,
  now: number,
  mode: 'dates' | 'application' = 'dates',
): string {
  const dates = entry.dates_tba
    ? 'Dates TBA'
    : formatDateRange(entry.start_date, entry.end_date);
  const deadlineInstant = schoolDeadlineInstant(entry);
  const application = entry.application_deadline
    ? formatDeadline(entry.application_deadline, entry.application_deadline_timezone)
    : entry.application_deadline_tba
      ? 'Applications TBA'
      : null;

  const showApplication = mode === 'application';
  const date = showApplication ? application : dates || null;
  const hint =
    showApplication && deadlineInstant !== null
      ? relativeDeadline(deadlineInstant, now)
      : null;

  const eligibility = (entry.eligibility ?? []).map((a) => AUDIENCE_LABELS[a] ?? a);

  return row({
    entry,
    title: entry.acronym ?? entry.name,
    subtitle: entry.acronym ? entry.name : null,
    date,
    dateClass: date && date.endsWith('TBA') ? 'is-tba' : '',
    hint,
    meta: join([
      SCHOOL_TYPE_LABELS[entry.type],
      ...areaNames(entry),
      locationOf(entry),
    ]),
    note:
      join([
        showApplication ? (dates ? `Runs ${dates}` : null) : application ? `Application deadline: ${application}` : null,
        eligibility.length ? `Open to: ${eligibility.join(', ')}` : null,
        entry.funding ? `Funding: ${entry.funding}` : null,
      ]) || null,
  });
}

export function jobRow(entry: JobEntry, now: number): string {
  const instant = jobDeadlineInstant(entry);
  const date = entry.deadline
    ? formatDeadline(entry.deadline, entry.deadline_timezone)
    : entry.open_until_filled
      ? 'Open until filled'
      : null;

  return row({
    entry,
    title: entry.name,
    subtitle: entry.institution,
    date,
    dateClass: entry.deadline ? '' : 'is-open',
    hint: instant !== null ? relativeDeadline(instant, now) : null,
    meta: join([
      POSITION_TYPE_LABELS[entry.position_type],
      ...areaNames(entry),
      locationOf(entry),
    ]),
  });
}

/** Dispatches to the right row builder. Used by the archive. */
export function anyRow(entry: Entry, now: number): string {
  if (entry.collection === 'jobs') return jobRow(entry as JobEntry, now);
  if (entry.collection === 'schools') return schoolRow(entry as SchoolEntry, now);
  return eventRow(entry as EventEntry, now);
}

export function list(rows: string[], emptyMessage: string): string {
  if (rows.length === 0) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  }
  return `<div class="rows">${rows.join('')}</div>`;
}

/* ------------------------------------------------------------------------ */
/*  Detail panel                                                             */
/* ------------------------------------------------------------------------ */

function field(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<div class="detail-field"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function textField(label: string, value: string | null | undefined): string {
  return field(label, value ? escapeHtml(value) : null);
}

function linkField(label: string, href: string | null | undefined): string {
  const safe = safeUrl(href);
  if (!safe) return '';
  const shown = safe.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return field(label, `<a href="${escapeHtml(safe)}">${escapeHtml(shown)}</a>`);
}

/** Body of the small panel shown when a calendar entry or row is opened. */
export function detail(entry: Entry, now: number): string {
  const kind = kindOf(entry);
  const parts: string[] = [];

  parts.push(
    `<p class="detail-kind"><span class="mark" data-kind="${kind}" aria-hidden="true"></span>${escapeHtml(
      typeLabel(entry),
    )}${entry.sample ? sampleTag(entry) : ''}</p>`,
  );
  parts.push(`<h2 class="detail-title">${escapeHtml(entry.name)}</h2>`);
  if (entry.acronym) {
    parts.push(`<p class="detail-acronym">${escapeHtml(entry.acronym)}</p>`);
  }
  if (entry.description) {
    parts.push(`<p class="detail-desc">${escapeHtml(entry.description)}</p>`);
  }

  const rows: string[] = [];

  if (entry.collection === 'jobs') {
    const job = entry as JobEntry;
    rows.push(textField('Institution', job.institution));
    rows.push(textField('Location', locationOf(job)));
    rows.push(
      textField(
        'Deadline',
        job.deadline
          ? formatDeadline(job.deadline, job.deadline_timezone)
          : job.open_until_filled
            ? 'Open until filled'
            : null,
      ),
    );
  } else if (entry.collection === 'schools') {
    const school = entry as SchoolEntry;
    rows.push(
      textField(
        'Dates',
        school.dates_tba
          ? 'TBA'
          : formatDateRange(school.start_date, school.end_date) || null,
      ),
    );
    rows.push(textField('Location', locationOf(school)));
    rows.push(
      textField(
        'Applications close',
        school.application_deadline
          ? formatDeadline(
              school.application_deadline,
              school.application_deadline_timezone,
            )
          : school.application_deadline_tba
            ? 'TBA'
            : null,
      ),
    );
    rows.push(
      textField(
        'Open to',
        (school.eligibility ?? []).map((a) => AUDIENCE_LABELS[a] ?? a).join(', ') ||
          null,
      ),
    );
    rows.push(textField('Funding', school.funding));
    rows.push(textField('Runs', school.recurring));
  } else {
    const event = entry as EventEntry;
    rows.push(
      textField(
        'Dates',
        event.dates_tba
          ? 'TBA'
          : formatDateRange(event.start_date, event.end_date) || null,
      ),
    );
    rows.push(textField('Location', locationOf(event)));
    rows.push(textField('Colocated with', event.colocated_with));

    const occurrences = deadlineOccurrences(event);
    if (occurrences.length > 0) {
      const items = occurrences
        .map((occurrence) => {
          const label = occurrence.label ?? 'Submission';
          const passed = occurrence.instant < now ? ' <span class="detail-passed">passed</span>' : '';
          return `<li><span class="detail-round">${escapeHtml(label)}</span> ${escapeHtml(
            formatDeadline(occurrence.date, occurrence.timezone),
          )}${passed}</li>`;
        })
        .join('');
      rows.push(field('Deadlines', `<ul class="detail-rounds">${items}</ul>`));
    } else if (deadlineIsTba(event)) {
      rows.push(textField('Deadlines', 'TBA'));
    }
  }

  rows.push(textField('Areas', areaNames(entry).join(', ')));
  rows.push(linkField('Website', entry.url));
  rows.push(linkField('Source', entry.source));
  rows.push(textField('Last verified', formatDate(entry.last_verified)));
  if (entry.notes) rows.push(textField('Notes', entry.notes));

  parts.push(`<dl class="detail-fields">${rows.filter(Boolean).join('')}</dl>`);

  return parts.join('');
}

export function typeLabel(entry: Entry): string {
  if (entry.collection === 'jobs') {
    return POSITION_TYPE_LABELS[(entry as JobEntry).position_type] ?? KIND_LABELS.job;
  }
  if (entry.collection === 'schools') {
    return SCHOOL_TYPE_LABELS[(entry as SchoolEntry).type] ?? KIND_LABELS.school;
  }
  return EVENT_TYPE_LABELS[(entry as EventEntry).type] ?? KIND_LABELS.conference;
}
