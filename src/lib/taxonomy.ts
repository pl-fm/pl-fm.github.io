import type {
  Area,
  Audience,
  Category,
  EventType,
  Kind,
  Moment,
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
};

export const CATEGORIES: readonly Category[] = [
  'deadline',
  'conference',
  'workshop',
  'school',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  deadline: 'Deadline',
  conference: 'Conference',
  workshop: 'Workshop',
  school: 'School',
};

export const CATEGORY_HINTS: Record<Category, string> = {
  deadline: 'Submission and application deadlines',
  conference: 'Conferences and symposia, on the days they run',
  workshop: 'Workshops and colocated events, on the days they run',
  school: 'Summer, winter, and doctoral schools, on the days they run',
};

export const SHOW_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deadlines', label: 'Deadlines' },
  { value: 'events', label: 'Events' },
  { value: 'schools', label: 'Schools' },
];

export const TIMEZONE_PATTERN = /^(AoE|UTC|UTC[+-]\d{1,2}(:\d{2})?|local)$/;

export function areaLabel(area: string): string {
  return AREA_LABELS[area as Area] ?? area;
}

export function areaLabels(areas: readonly string[]): string[] {
  return areas.map(areaLabel);
}

export function kindOf(entry: { collection: string; type?: string }): Kind {
  if (entry.collection === 'schools') return 'school';
  if (entry.type === 'workshop' || entry.type === 'colocated') return 'workshop';
  return 'conference';
}

export function categoryOf(
  entry: { collection: string; type?: string },
  moment: Moment,
): Category {
  return moment === 'deadline' ? 'deadline' : kindOf(entry);
}
