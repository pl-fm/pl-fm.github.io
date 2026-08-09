import { loadAll, type DataIssue } from '../src/lib/data.ts';

const STRICT = process.argv.includes('--strict');

const RESET = '[0m';
const DIM = '[2m';
const RED = '[31m';
const YELLOW = '[33m';
const GREEN = '[32m';

const colour = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(code: string, text: string): string {
  return colour ? `${code}${text}${RESET}` : text;
}

function group(issues: DataIssue[]): Map<string, DataIssue[]> {
  const map = new Map<string, DataIssue[]>();
  for (const issue of issues) {
    const bucket = map.get(issue.file);
    if (bucket) bucket.push(issue);
    else map.set(issue.file, [issue]);
  }
  return map;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

const { entries, issues } = loadAll();
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');

console.log('');
console.log(paint(DIM, 'PLFM data check'));
console.log('');

if (issues.length > 0) {
  for (const [file, fileIssues] of group(issues)) {
    console.log(`  ${file}`);
    for (const issue of fileIssues) {
      const marker =
        issue.level === 'error' ? paint(RED, 'error') : paint(YELLOW, 'warning');
      const field = issue.field ? paint(DIM, ` ${issue.field}:`) : '';
      console.log(`    ${marker}${field} ${issue.message}`);
    }
    console.log('');
  }
}

const summary = [
  plural(entries.length, 'entry', 'entries'),
  errors.length > 0
    ? paint(RED, plural(errors.length, 'error', 'errors'))
    : paint(GREEN, '0 errors'),
  plural(warnings.length, 'warning', 'warnings'),
].join(', ');

console.log(`  ${summary}`);
console.log('');

if (entries.length === 0 && errors.length === 0) {
  console.log(paint(YELLOW, '  No data files found. Is data/ in the right place?'));
  console.log('');
}

if (errors.length > 0 || (STRICT && warnings.length > 0)) {
  process.exit(1);
}
