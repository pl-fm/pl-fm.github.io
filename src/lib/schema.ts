/**
 * Runtime validation for everything in `data/`.
 *
 * Schemas are strict: an unrecognised key is an error rather than a silently
 * ignored field, so a misspelled `deadline_timzone` fails CI instead of
 * quietly dropping a deadline off the calendar.
 *
 * Build-time only. Do not import from browser code.
 */

import { z } from 'zod';
import {
  AREAS,
  AUDIENCES,
  EVENT_TYPES,
  SCHOOL_TYPES,
  TIMEZONE_PATTERN,
} from './taxonomy.ts';
import { isValidDate } from './dates.ts';

function enumOf<T extends string>(values: readonly T[]) {
  return z.enum(values as unknown as [T, ...T[]]);
}

const dateString = z.string().refine(isValidDate, {
  message:
    'expected YYYY-MM, YYYY-MM-DD, or YYYY-MM-DDTHH:MM (and a date that exists)',
});

const timezone = z.string().regex(TIMEZONE_PATTERN, {
  message: 'expected AoE, UTC, local, or a fixed offset such as UTC+2',
});

const url = z
  .string()
  .url({ message: 'expected an absolute URL' })
  .regex(/^https?:\/\//i, { message: 'expected an http:// or https:// URL' });

const id = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'expected lowercase words separated by single hyphens',
  })
  .min(3)
  .max(80);

const areas = z
  .array(enumOf(AREAS))
  .min(1, { message: 'list at least one research area' });

const deadlineSlot = z
  .object({
    label: z.string().min(1).max(60).optional(),
    date: dateString.optional(),
    timezone: timezone.optional(),
    tba: z.boolean().optional(),
    note: z.string().max(300).optional(),
  })
  .strict()
  .refine((slot) => Boolean(slot.date) || slot.tba === true, {
    message: 'a deadline needs either a date or `tba: true`',
  });

/** Fields every collection shares. */
const base = {
  id,
  name: z.string().min(2).max(200),
  acronym: z.string().min(1).max(60).optional(),
  areas,
  url: url.optional(),
  description: z.string().max(400).optional(),
  source: url,
  last_verified: dateString,
  notes: z.string().max(400).optional(),
};

export const eventSchema = z
  .object({
    ...base,
    type: enumOf(EVENT_TYPES),
    deadline: dateString.optional(),
    deadline_timezone: timezone.optional(),
    deadlines: z.array(deadlineSlot).max(8).optional(),
    deadline_tba: z.boolean().optional(),
    start_date: dateString.optional(),
    end_date: dateString.optional(),
    dates_tba: z.boolean().optional(),
    location: z.string().max(120).optional(),
    country: z.string().max(80).optional(),
    colocated_with: z.string().max(120).optional(),
  })
  .strict()
  .refine((e) => !(e.deadline && e.deadline_tba), {
    message: 'an entry cannot have both `deadline` and `deadline_tba: true`',
    path: ['deadline_tba'],
  })
  .refine((e) => !(e.start_date && e.dates_tba), {
    message: 'an entry cannot have both `start_date` and `dates_tba: true`',
    path: ['dates_tba'],
  });

export const schoolSchema = z
  .object({
    ...base,
    type: enumOf(SCHOOL_TYPES),
    start_date: dateString.optional(),
    end_date: dateString.optional(),
    dates_tba: z.boolean().optional(),
    location: z.string().max(120).optional(),
    country: z.string().max(80).optional(),
    application_deadline: dateString.optional(),
    application_deadline_timezone: timezone.optional(),
    application_deadline_tba: z.boolean().optional(),
    eligibility: z.array(enumOf(AUDIENCES)).min(1).optional(),
    funding: z.string().max(200).optional(),
    recurring: z.string().max(60).optional(),
  })
  .strict()
  .refine((s) => !(s.application_deadline && s.application_deadline_tba), {
    message:
      'an entry cannot have both `application_deadline` and `application_deadline_tba: true`',
    path: ['application_deadline_tba'],
  });

export const SCHEMAS = {
  events: eventSchema,
  schools: schoolSchema,
} as const;
