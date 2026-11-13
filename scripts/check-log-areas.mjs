#!/usr/bin/env node
/**
 * Every route file has its area in the app's log, and the private ones stay private (2026-11-09, Dev Tools brought up to date). Run by
 * scripts/scan.sh; prints one line per problem on stdout and exits 1 when there is any. `--table` prints every mount with its area.
 *
 * apps/api/src/logs.ts names a line's area by the first part of its path (`areaOf`), so the area of a route file is the first part of the
 * prefix it is mounted at. This reads the mounts in apps/api/src/index.ts (`app.route('/x', name)`) and inside route files
 * (`fitness.route('/supplements', supplements)`), and checks that:
 * - every Hono app a route file exports is mounted, so none of its lines is logged under an area nobody expects;
 * - the person's own files (journal and gratitude, wellbeing, Fitness and supplements, the Companion, Discover, the assistant and its
 *   feelings reader) are mounted under an area logs.ts keeps private (`PRIVATE_AREAS`), so they leave only a bare server-error line;
 * - Kreators Run's own movement tool (/run/move) is still named as private in logs.ts.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const API = join(ROOT, 'apps/api/src');
const PRIVATE_FILES = ['journal', 'wellbeing', 'fitness', 'supplements', 'companion', 'discover', 'feelings', 'assistant', 'tables'];

const logsSrc = readFileSync(join(API, 'logs.ts'), 'utf8');
const privateAreas = new Set([...(/PRIVATE_AREAS = new Set\(\[([^\]]*)\]/.exec(logsSrc)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]));

const problems = [];
const say = (what) => problems.push(`scripts/check-log-areas.mjs: ${what}`);
if (!privateAreas.size) say('could not read PRIVATE_AREAS in apps/api/src/logs.ts');
if (!/'\/run\/move'/.test(logsSrc)) say('logs.ts no longer keeps /run/move private');

/** Imported names of a file, mapped to the route file they come from. */
const importsOf = (src) => {
  const map = new Map();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/(?:routes\/)?([\w]+)'/g))
    for (const name of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean)) map.set(name, m[2]);
  for (const m of src.matchAll(/import\s+(\w+)\s+from\s*'\.\/(?:routes\/)?([\w]+)'/g)) map.set(m[1], m[2]);
  return map;
};

// Mounts: [prefix, name, file]. The index first, then each route file's own mounts under the prefix its parent has.
const mounts = [];
const indexSrc = readFileSync(join(API, 'index.ts'), 'utf8');
const indexImports = importsOf(indexSrc);
for (const m of indexSrc.matchAll(/\b(?:app|root)\.route\('([^']+)',\s*([A-Za-z_]\w*)/g)) mounts.push({ prefix: m[1], name: m[2], file: indexImports.get(m[2]) });

const routeFiles = readdirSync(join(API, 'routes')).filter((f) => f.endsWith('.ts') && !/\.test\.ts$/.test(f));
const exportsOf = new Map();
for (const f of routeFiles) {
  const src = readFileSync(join(API, 'routes', f), 'utf8');
  const file = basename(f, '.ts');
  exportsOf.set(file, [...src.matchAll(/export const (\w+) = new Hono\b/g), ...src.matchAll(/export function (\w+Routes)\b/g), ...src.matchAll(/export default (\w+);/g)].map((m) => m[1]));
  const imports = importsOf(src);
  for (const m of src.matchAll(/\b(\w+)\.route\('([^']+)',\s*([A-Za-z_]\w*)/g)) {
    const parents = mounts.filter((x) => x.name === m[1]);
    for (const p of parents.length ? parents : [{ prefix: '?' }]) mounts.push({ prefix: `${p.prefix}${m[2]}`, name: m[3], file: imports.get(m[3]) ?? file });
  }
}
for (const x of mounts) if (x.prefix.startsWith('?')) say(`${x.name} is mounted inside a route file that is itself mounted nowhere`);

const areaOf = (prefix) => prefix.split('/')[1] || 'core';
for (const [file, names] of exportsOf) {
  for (const name of names) {
    const at = mounts.filter((x) => x.name === name);
    if (!at.length) say(`routes/${file}.ts exports ${name}, which is mounted nowhere`);
    if (PRIVATE_FILES.includes(file)) for (const x of at) if (!privateAreas.has(areaOf(x.prefix))) say(`routes/${file}.ts is mounted at ${x.prefix}, whose area "${areaOf(x.prefix)}" is not private in logs.ts`);
  }
}

if (process.argv.includes('--table')) for (const x of mounts) console.log(`${areaOf(x.prefix).padEnd(14)} ${x.prefix.padEnd(28)} ${x.name} (${x.file ?? '?'})${privateAreas.has(areaOf(x.prefix)) ? '  private' : ''}`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
