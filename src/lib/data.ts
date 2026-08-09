import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { SCHEMAS } from './schema.ts';
import { instantOf } from './dates.ts';
import type { Collection, Entry } from './types.ts';

export interface DataIssue {
  file: string;
  field?: string;
  message: string;
  level: 'error' | 'warning';
}

export interface LoadResult {
  entries: Entry[];
  issues: DataIssue[];
}

const COLLECTIONS: readonly Collection[] = ['events', 'schools'];

function dataRoot(): string {
  return resolve(process.env.PLFM_DATA_DIR ?? join(process.cwd(), 'data'));
}

function listYaml(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => /\.(ya?ml)$/i.test(n))
    .filter((n) => !n.startsWith('.') && !n.startsWith('_'))
    .filter((n) => statSync(join(dir, n)).isFile())
    .sort();
}

export function loadAll(): LoadResult {
  const root = dataRoot();
  const entries: Entry[] = [];
  const issues: DataIssue[] = [];
  const seenIds = new Map<string, string>();

  for (const collection of COLLECTIONS) {
    const dir = join(root, collection);
    for (const fileName of listYaml(dir)) {
      const relative = `data/${collection}/${fileName}`;
      const raw = readFileSync(join(dir, fileName), 'utf8');

      let doc: unknown;
      try {
        doc = parseYaml(raw);
      } catch (error) {
        issues.push({
          file: relative,
          message: `YAML could not be parsed: ${(error as Error).message}`,
          level: 'error',
        });
        continue;
      }

      if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
        issues.push({
          file: relative,
          message:
            'expected a single entry per file, written as top-level `key: value` pairs',
          level: 'error',
        });
        continue;
      }

      const parsed = SCHEMAS[collection].safeParse(doc);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push({
            file: relative,
            field: issue.path.join('.') || undefined,
            message:
              issue.code === 'unrecognized_keys'
                ? `unknown field(s): ${(issue as { keys?: string[] }).keys?.join(', ')}`
                : issue.message,
            level: 'error',
          });
        }
        continue;
      }

      const entry = { ...parsed.data, collection } as Entry;

      const expectedStem = fileName.replace(/\.(ya?ml)$/i, '');
      if (expectedStem !== entry.id) {
        issues.push({
          file: relative,
          field: 'id',
          message: `id "${entry.id}" should match the file name "${expectedStem}"`,
          level: 'error',
        });
      }

      const firstSeenIn = seenIds.get(entry.id);
      if (firstSeenIn) {
        issues.push({
          file: relative,
          field: 'id',
          message: `id "${entry.id}" is already used by ${firstSeenIn}`,
          level: 'error',
        });
      } else {
        seenIds.set(entry.id, relative);
      }

      issues.push(...checkSemantics(entry, relative));
      entries.push(entry);
    }
  }

  return { entries, issues: issues.sort((a, b) => a.file.localeCompare(b.file)) };
}

function checkSemantics(entry: Entry, file: string): DataIssue[] {
  const found: DataIssue[] = [];
  const error = (message: string, field?: string) =>
    found.push({ file, field, message, level: 'error' });
  const warn = (message: string, field?: string) =>
    found.push({ file, field, message, level: 'warning' });

  const verified = instantOf(entry.last_verified, 'UTC');
  if (verified !== null && verified > Date.now() + 86_400_000) {
    error('last_verified is in the future', 'last_verified');
  }

  if (entry.start_date && entry.end_date) {
    const start = instantOf(entry.start_date, 'UTC');
    const end = instantOf(entry.end_date, 'UTC', true);
    if (start !== null && end !== null && end < start) {
      error('end_date falls before start_date', 'end_date');
    }
  }

  if (entry.collection === 'events') {
    if (entry.deadline && !entry.deadline_timezone) {
      warn(
        'deadline has no deadline_timezone; most calls use AoE',
        'deadline_timezone',
      );
    }
    if (entry.deadline && entry.start_date) {
      const deadline = instantOf(entry.deadline, entry.deadline_timezone, true);
      const start = instantOf(entry.start_date, 'UTC', true);
      if (deadline !== null && start !== null && deadline > start) {
        warn('deadline falls after the event starts', 'deadline');
      }
    }
    if (entry.type === 'colocated' && !entry.colocated_with) {
      warn('a colocated event should name its parent venue', 'colocated_with');
    }
  }

  if (entry.collection === 'schools') {
    if (entry.application_deadline && entry.start_date) {
      const deadline = instantOf(
        entry.application_deadline,
        entry.application_deadline_timezone,
        true,
      );
      const start = instantOf(entry.start_date, 'UTC', true);
      if (deadline !== null && start !== null && deadline > start) {
        warn(
          'application_deadline falls after the school starts',
          'application_deadline',
        );
      }
    }
  }

  return found;
}

let cached: Entry[] | null = null;

export function loadEntries(): Entry[] {
  if (cached) return cached;

  const { entries, issues } = loadAll();
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    const detail = errors
      .map((e) => `  ${e.file}${e.field ? ` (${e.field})` : ''}: ${e.message}`)
      .join('\n');
    throw new Error(
      `${errors.length} invalid data ${errors.length === 1 ? 'entry' : 'entries'}. Run \`npm run validate\` for the full report.\n${detail}`,
    );
  }

  cached = entries;
  return entries;
}

export function lastVerified(): string | null {
  const dates = loadEntries()
    .map((entry) => entry.last_verified)
    .filter(Boolean)
    .sort();
  return dates.at(-1) ?? null;
}
