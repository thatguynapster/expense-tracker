/**
 * Restyle-spec §7.1 / §8 guard: no raw hex colors, raw font sizes, or banned
 * Inter weights (600/700) anywhere in src/ outside src/theme/theme.ts.
 *
 * Run: npm run check:theme — exits 1 and lists offenders while the migration
 * is incomplete, so it doubles as a progress tracker.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(process.cwd(), 'src');
const ALLOWED = new Set(['src/theme/theme.ts']);

const RULES: { name: string; pattern: RegExp }[] = [
  { name: 'raw hex color', pattern: /['"`]#[0-9a-fA-F]{3,8}\b/ },
  { name: 'raw font size', pattern: /fontSize:\s*\d/ },
  { name: 'banned font weight', pattern: /Inter_600SemiBold|Inter_700Bold|fontWeight:\s*['"]?[67]00/ },
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

let violations = 0;

for (const file of walk(SRC)) {
  const rel = relative(process.cwd(), file).split(sep).join('/');
  if (ALLOWED.has(rel)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations++;
        console.log(`${rel}:${i + 1}  [${rule.name}]  ${line.trim()}`);
      }
    }
  });
}

if (violations > 0) {
  console.log(`\n${violations} violation(s). All colors, font sizes, and weights must come from src/theme/theme.ts.`);
  process.exit(1);
}

console.log('check:theme passed — no raw hex, font sizes, or banned weights outside src/theme/theme.ts.');
