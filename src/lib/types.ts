export type Collection = 'events' | 'schools';

export type Area =
  | 'programming-languages'
  | 'formal-methods'
  | 'verification'
  | 'compilers'
  | 'types'
  | 'logic'
  | 'synthesis'
  | 'program-analysis'
  | 'semantics'
  | 'functional-programming'
  | 'concurrency'
  | 'security'
  | 'theorem-proving'
  | 'model-checking'
  | 'probabilistic-programming'
  | 'quantum';

export type EventType =
  | 'conference'
  | 'workshop'
  | 'seminar'
  | 'symposium'
  | 'community-meeting'
  | 'colocated';

export type SchoolType =
  | 'summer-school'
  | 'winter-school'
  | 'doctoral-school'
  | 'mentoring';

export type Audience = 'students' | 'phd' | 'postdocs' | 'everyone';

export type DeadlineTimezone = string;

export interface DeadlineSlot {
  label?: string;
  date?: string;
  timezone?: DeadlineTimezone;
  tba?: boolean;
  note?: string;
}

interface BaseEntry {
  id: string;
  name: string;
  acronym?: string;
  areas: Area[];
  url?: string;
  description?: string;
  source: string;
  last_verified: string;
  notes?: string;
}

export interface EventEntry extends BaseEntry {
  collection: 'events';
  type: EventType;
  deadline?: string;
  deadline_timezone?: DeadlineTimezone;
  deadlines?: DeadlineSlot[];
  deadline_tba?: boolean;
  start_date?: string;
  end_date?: string;
  dates_tba?: boolean;
  location?: string;
  country?: string;
  colocated_with?: string;
}

export interface SchoolEntry extends BaseEntry {
  collection: 'schools';
  type: SchoolType;
  start_date?: string;
  end_date?: string;
  dates_tba?: boolean;
  location?: string;
  country?: string;
  application_deadline?: string;
  application_deadline_timezone?: DeadlineTimezone;
  application_deadline_tba?: boolean;
  eligibility?: Audience[];
  funding?: string;
  recurring?: string;
}

export type Entry = EventEntry | SchoolEntry;

export type Kind = 'conference' | 'workshop' | 'school';

export type Moment = 'deadline' | 'event' | 'school';

export type Category = 'deadline' | 'conference' | 'workshop' | 'school';

export interface CalendarItem {
  id: string;
  date: string;
  label: string;
  short: string;
  title: string;
  kind: Kind;
  moment: Moment;
  category: Category;
  what: string;
  areas: Area[];
  collection: Collection;
}
