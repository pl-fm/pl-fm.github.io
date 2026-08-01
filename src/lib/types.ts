/**
 * Shape of every record in `data/`.
 *
 * This module has no imports on purpose: it is bundled into the browser
 * alongside the filtering and rendering helpers, so it must stay free of any
 * Node or validation dependencies. The runtime schema lives in `schema.ts`.
 */

export type Collection = 'deadlines' | 'events' | 'schools' | 'jobs';

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

export type PositionType =
  | 'phd'
  | 'postdoc'
  | 'faculty'
  | 'research'
  | 'internship';

export type Audience = 'students' | 'phd' | 'postdocs' | 'everyone';

/**
 * Timezones a deadline may be expressed in. `AoE` (Anywhere on Earth, UTC-12)
 * is the convention across most PL and formal methods venues. Fixed offsets
 * such as `UTC+2` are accepted; named zones are deliberately not, because
 * resolving them correctly would need a timezone database.
 */
export type DeadlineTimezone = string;

/** A deadline that has been announced, or one that explicitly has not. */
export interface DeadlineSlot {
  /** Short label, for example `Abstract`, `Paper`, `Artifact`. */
  label?: string;
  /**
   * Local wall-clock time as written on the call for papers, for example
   * `2026-07-09T23:59:00`. Absent when the venue has not announced one.
   */
  date?: string;
  timezone?: DeadlineTimezone;
  /** Set when the deadline is known to exist but has not been announced. */
  tba?: boolean;
  note?: string;
}

/** Fields shared by every collection. */
interface BaseEntry {
  id: string;
  name: string;
  acronym?: string;
  areas: Area[];
  url?: string;
  description?: string;
  /** Official page the entry was taken from. Required. */
  source: string;
  /** ISO date on which a human last checked `source`. Required. */
  last_verified: string;
  /** Marks demonstration data that is not a real announcement. */
  sample?: boolean;
  notes?: string;
}

export interface EventEntry extends BaseEntry {
  collection: 'events' | 'deadlines';
  type: EventType;
  /** Primary submission deadline, when one has been announced. */
  deadline?: string;
  deadline_timezone?: DeadlineTimezone;
  /** Additional rounds: abstract, paper, artifact, and so on. */
  deadlines?: DeadlineSlot[];
  /** Set when a deadline exists but the date is not yet public. */
  deadline_tba?: boolean;
  start_date?: string;
  end_date?: string;
  dates_tba?: boolean;
  location?: string;
  country?: string;
  /** Parent venue for workshops and colocated events, for example `POPL 2027`. */
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
  /** Set for schools that run on a regular cycle, for example `annual`. */
  recurring?: string;
}

export interface JobEntry extends BaseEntry {
  collection: 'jobs';
  position_type: PositionType;
  institution: string;
  location?: string;
  country?: string;
  deadline?: string;
  deadline_timezone?: DeadlineTimezone;
  open_until_filled?: boolean;
  /** Date after which the listing should leave the archive view ordering. */
  posted?: string;
}

export type Entry = EventEntry | SchoolEntry | JobEntry;

/** Coarse grouping used for calendar colours and legends. */
export type Kind = 'conference' | 'workshop' | 'school' | 'job';

/**
 * What a date on the calendar represents. Every dated moment falls into
 * exactly one of these, which is what the calendar filter selects on.
 */
export type Moment = 'deadline' | 'event' | 'school';

/** One dated thing to place on a calendar grid. */
export interface CalendarItem {
  /** Entry id, so the detail panel can look the record back up. */
  id: string;
  /** `YYYY-MM-DD` in the entry's own wall-clock terms. */
  date: string;
  /** Acronym as written, for example `POPL 2027`. */
  label: string;
  /** Acronym with the year dropped, for the narrow calendar cells. */
  short: string;
  /** Full name, used for the tooltip and the accessible name. */
  title: string;
  kind: Kind;
  /** Which calendar-filter bucket this date belongs to. */
  moment: Moment;
  /** Human-readable reason this date is on the calendar. */
  what: string;
  areas: Area[];
  collection: Collection;
  sample?: boolean;
}
