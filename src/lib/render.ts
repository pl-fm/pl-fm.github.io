import {
  formatDate,
  formatDateRange,
  formatDeadline,
  relativeDeadline,
} from './dates.ts';
import {
  deadlineIsTba,
  deadlineOccurrences,
  nextDeadline,
  schoolDeadlineInstant,
  type DeadlineOccurrence,
} from './filter.ts';
import {
  AREA_LABELS,
  AUDIENCE_LABELS,
  EVENT_TYPE_LABELS,
  KIND_LABELS,
  SCHOOL_TYPE_LABELS,
  kindOf,
} from './taxonomy.ts';
import type { Category, Entry, EventEntry, SchoolEntry } from './types.ts';

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

export function safeUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

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
  const { location, country } = entry;
  if (location && country && !location.includes(country)) {
    return `${location}, ${country}`;
  }
  return location ?? country ?? null;
}

function websiteLink(entry: Entry): string {
  const href = safeUrl(entry.url) ?? safeUrl(entry.source);
  if (!href) return '';
  return `<a class="row-link" href="${escapeHtml(href)}">Website <span aria-hidden="true">&rarr;</span></a>`;
}

interface RowParts {
  entry: Entry;
  category: Category;
  title: string;
  subtitle?: string | null;
  date?: string | null;
  dateClass?: string;
  hint?: string | null;
  meta: string;
  note?: string | null;
}

function row(parts: RowParts): string {
  const { entry, category, title, subtitle, date, hint, meta, note } = parts;
  const dateClass = parts.dateClass ? ` ${parts.dateClass}` : '';

  return [
    `<article class="row" data-id="${escapeHtml(entry.id)}">`,
    '<div class="row-head">',
    `<h3 class="row-title">${escapeHtml(title)}</h3>`,
    date
      ? `<p class="row-date${dateClass}">${escapeHtml(date)}${
          hint ? `<span class="row-hint">${escapeHtml(hint)}</span>` : ''
        }</p>`
      : '',
    '</div>',
    subtitle ? `<p class="row-sub">${escapeHtml(subtitle)}</p>` : '',
    '<div class="row-foot">',
    `<p class="row-meta"><span class="mark" data-cat="${category}" aria-hidden="true"></span>${escapeHtml(meta)}</p>`,
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
    category: 'deadline',
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

  return row({
    entry,
    category: kindOf(entry),
    title: entry.acronym ?? entry.name,
    subtitle: entry.acronym ? entry.name : null,
    date: dates || null,
    dateClass: entry.dates_tba ? 'is-tba' : '',
    meta: join([
      EVENT_TYPE_LABELS[entry.type],
      ...areaNames(entry),
      locationOf(entry),
    ]),
    note:
      join([
        submission,
        entry.colocated_with ? `Colocated with ${entry.colocated_with}` : null,
      ]) || null,
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
  const application = entry.application_deadline
    ? formatDeadline(entry.application_deadline, entry.application_deadline_timezone)
    : entry.application_deadline_tba
      ? 'Applications TBA'
      : null;

  const showApplication = mode === 'application';
  const date = showApplication ? application : dates || null;
  const instant = schoolDeadlineInstant(entry);
  const eligibility = (entry.eligibility ?? []).map((a) => AUDIENCE_LABELS[a] ?? a);

  return row({
    entry,
    category: showApplication ? 'deadline' : 'school',
    title: entry.acronym ?? entry.name,
    subtitle: entry.acronym ? entry.name : null,
    date,
    dateClass: date?.endsWith('TBA') ? 'is-tba' : '',
    hint:
      showApplication && instant !== null ? relativeDeadline(instant, now) : null,
    meta: join([
      SCHOOL_TYPE_LABELS[entry.type],
      ...areaNames(entry),
      locationOf(entry),
    ]),
    note:
      join([
        showApplication
          ? dates && `Runs ${dates}`
          : application && `Application deadline: ${application}`,
        eligibility.length ? `Open to: ${eligibility.join(', ')}` : null,
        entry.funding ? `Funding: ${entry.funding}` : null,
      ]) || null,
  });
}

export function anyRow(entry: Entry, now: number): string {
  return entry.collection === 'schools'
    ? schoolRow(entry, now)
    : eventRow(entry, now);
}

export function list(rows: string[], emptyMessage: string): string {
  if (rows.length === 0) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  }
  return `<div class="rows">${rows.join('')}</div>`;
}

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

export function typeLabel(entry: Entry): string {
  return entry.collection === 'schools'
    ? (SCHOOL_TYPE_LABELS[entry.type] ?? KIND_LABELS.school)
    : (EVENT_TYPE_LABELS[entry.type] ?? KIND_LABELS.conference);
}

export function detail(entry: Entry, now: number): string {
  const parts: string[] = [
    `<p class="detail-kind"><span class="mark" data-cat="${kindOf(entry)}" aria-hidden="true"></span>${escapeHtml(typeLabel(entry))}</p>`,
    `<h2 class="detail-title">${escapeHtml(entry.name)}</h2>`,
  ];
  if (entry.acronym) {
    parts.push(`<p class="detail-acronym">${escapeHtml(entry.acronym)}</p>`);
  }
  if (entry.description) {
    parts.push(`<p class="detail-desc">${escapeHtml(entry.description)}</p>`);
  }

  const rows: string[] = [
    textField(
      'Dates',
      entry.dates_tba
        ? 'TBA'
        : formatDateRange(entry.start_date, entry.end_date) || null,
    ),
    textField('Location', locationOf(entry)),
  ];

  if (entry.collection === 'schools') {
    rows.push(
      textField(
        'Applications close',
        entry.application_deadline
          ? formatDeadline(
              entry.application_deadline,
              entry.application_deadline_timezone,
            )
          : entry.application_deadline_tba
            ? 'TBA'
            : null,
      ),
      textField(
        'Open to',
        (entry.eligibility ?? []).map((a) => AUDIENCE_LABELS[a] ?? a).join(', ') ||
          null,
      ),
      textField('Funding', entry.funding),
      textField('Runs', entry.recurring),
    );
  } else {
    rows.push(textField('Colocated with', entry.colocated_with));

    const occurrences = deadlineOccurrences(entry);
    if (occurrences.length > 0) {
      const items = occurrences
        .map((occurrence) => {
          const label = occurrence.label ?? 'Submission';
          const passed =
            occurrence.instant < now
              ? ' <span class="detail-passed">passed</span>'
              : '';
          return `<li><span class="detail-round">${escapeHtml(label)}</span> ${escapeHtml(
            formatDeadline(occurrence.date, occurrence.timezone),
          )}${passed}</li>`;
        })
        .join('');
      rows.push(field('Deadlines', `<ul class="detail-rounds">${items}</ul>`));
    } else if (deadlineIsTba(entry)) {
      rows.push(textField('Deadlines', 'TBA'));
    }
  }

  rows.push(
    textField('Areas', areaNames(entry).join(', ')),
    linkField('Website', entry.url),
    linkField('Source', entry.source),
    textField('Last verified', formatDate(entry.last_verified)),
    textField('Notes', entry.notes),
  );

  parts.push(`<dl class="detail-fields">${rows.filter(Boolean).join('')}</dl>`);

  return parts.join('');
}
