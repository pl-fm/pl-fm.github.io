/**
 * The controlled vocabularies used across the site.
 *
 * Adding a value here is all it takes to make it usable in a data file: the
 * validator, the filter bars, and the labels below all read from these lists.
 * Client-safe, so no imports beyond types.
 */

import type {
  Area,
  Audience,
  Category,
  EventType,
  Kind,
  Moment,
  PositionType,
  SchoolType,
} from './types.ts';

export const AREAS: readonly Area[] = [
  'programming-languages',
  'formal-methods',
  'verification',
  'compilers',
  'types',
  'logic',
  'synthesis',
  'program-analysis',
  'semantics',
  'functional-programming',
  'concurrency',
  'security',
  'theorem-proving',
  'model-checking',
  'probabilistic-programming',
  'quantum',
];

export const AREA_LABELS: Record<Area, string> = {
  'programming-languages': 'PL',
  'formal-methods': 'Formal Methods',
  verification: 'Verification',
  compilers: 'Compilers',
  types: 'Types',
  logic: 'Logic',
  synthesis: 'Synthesis',
  'program-analysis': 'Program Analysis',
  semantics: 'Semantics',
  'functional-programming': 'Functional Programming',
  concurrency: 'Concurrency',
  security: 'Security',
  'theorem-proving': 'Theorem Proving',
  'model-checking': 'Model Checking',
  'probabilistic-programming': 'Probabilistic Programming',
  quantum: 'Quantum',
};

export const EVENT_TYPES: readonly EventType[] = [
  'conference',
  'workshop',
  'seminar',
  'symposium',
  'community-meeting',
  'colocated',
];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  conference: 'Conference',
  workshop: 'Workshop',
  seminar: 'Seminar',
  symposium: 'Symposium',
  'community-meeting': 'Community meeting',
  colocated: 'Colocated event',
};

export const SCHOOL_TYPES: readonly SchoolType[] = [
  'summer-school',
  'winter-school',
  'doctoral-school',
  'mentoring',
];

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  'summer-school': 'Summer School',
  'winter-school': 'Winter School',
  'doctoral-school': 'Doctoral School',
  mentoring: 'Mentoring',
};

export const POSITION_TYPES: readonly PositionType[] = [
  'phd',
  'postdoc',
  'faculty',
  'research',
  'internship',
];

export const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  phd: 'PhD',
  postdoc: 'Postdoc',
  faculty: 'Faculty',
  research: 'Research',
  internship: 'Internship',
};

export const AUDIENCES: readonly Audience[] = [
  'students',
  'phd',
  'postdocs',
  'everyone',
];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  students: 'Students',
  phd: 'PhD',
  postdocs: 'Postdocs',
  everyone: 'Everyone',
};

export const KIND_LABELS: Record<Kind, string> = {
  conference: 'Conference',
  workshop: 'Workshop',
  school: 'School',
  job: 'Job',
};

/**
 * The legend below the calendar, in the order it reads.
 *
 * Deadlines lead because they are the only dates a reader can miss. `job` is
 * last and only ever appears on a calendar that carries jobs, which the home
 * page does not.
 */
export const CATEGORIES: readonly Category[] = [
  'deadline',
  'conference',
  'workshop',
  'school',
  'job',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  deadline: 'Deadline',
  conference: 'Conference',
  workshop: 'Workshop',
  school: 'School',
  job: 'Job',
};

/** What each legend entry means, for the button's tooltip. */
export const CATEGORY_HINTS: Record<Category, string> = {
  deadline: 'Submission and application deadlines',
  conference: 'Conferences and symposia, on the days they run',
  workshop: 'Workshops and colocated events, on the days they run',
  school: 'Summer, winter, and doctoral schools, on the days they run',
  job: 'Position closing dates',
};

/**
 * The tabs above the calendar. They select on dates rather than on entries, so
 * `Deadlines` keeps a conference on the page at its deadline but not at its
 * start date.
 */
export const SHOW_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deadlines', label: 'Deadlines' },
  { value: 'events', label: 'Events' },
  { value: 'schools', label: 'Schools' },
];

/** Timezone spellings a deadline may use. */
export const TIMEZONE_PATTERN = /^(AoE|UTC|UTC[+-]\d{1,2}(:\d{2})?|local)$/;

export function areaLabel(area: string): string {
  return AREA_LABELS[area as Area] ?? area;
}

export function areaLabels(areas: readonly string[]): string[] {
  return areas.map(areaLabel);
}

/**
 * Collapses an entry's specific type onto the four buckets used for calendar
 * colours. Keeping this small is deliberate: the calendar should read as a
 * calendar, not as a legend.
 */
export function kindOf(entry: {
  collection: string;
  type?: string;
}): Kind {
  if (entry.collection === 'schools') return 'school';
  if (entry.collection === 'jobs') return 'job';
  if (entry.type === 'workshop' || entry.type === 'colocated') return 'workshop';
  return 'conference';
}

/**
 * The legend bucket for one dated moment. A deadline is a deadline whatever it
 * belongs to, so the conference that owns it only decides the colour of the
 * date the conference itself begins.
 */
export function categoryOf(
  entry: { collection: string; type?: string },
  moment: Moment,
): Category {
  return moment === 'deadline' ? 'deadline' : kindOf(entry);
}
