#!/usr/bin/env node
/**
 * The build map on Dev Tools tells the truth about the repo (2026-11-09, the founder: "update dev tools fully with all updates"). Run by
 * scripts/scan.sh with `node --experimental-strip-types`; prints one line per problem on stdout and exits 1 when there is any.
 *
 * It reads apps/web/src/lib/buildMap.ts (which imports nothing) and checks that:
 * - every file a card lists (`files`), every place in "Where things live" (`BUILD_FILES`) and every repo path written in a label or a
 *   note (apps/…, packages/…, scripts/…, docs/…, design/…, .github/…) exists;
 * - every check a card names exists: `smoke: <name>` is a `section('<name>')` in scripts/smoke/smoke.mjs, anything else a file;
 * - every card with a built-and-checked item (`ok`) names at least one check, so `ok` always has a script behind it;
 * - every route a card or an item names (a part that starts with a slash) is a route in apps/web/src/App.tsx.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const { BUILD_SECTIONS, BUILD_FILES } = await import(pathToFileURL(join(ROOT, 'apps/web/src/lib/buildMap.ts')).href);

const problems = [];
const say = (where, what) => problems.push(`scripts/check-buildmap.mjs: ${where}: ${what}`);

// Routes the app draws, from App.tsx (redirects count: an old path still answers).
const routes = [];
for (const m of readFileSync(join(ROOT, 'apps/web/src/App.tsx'), 'utf8').matchAll(/\{\s*path:\s*'([^']+)'/g)) {
  if (m[1] === '*') continue;
  // An optional segment (`/manage/:page?`) may be there or not; every other segment reads as before.
  const seg = (x) => (/^:[A-Za-z]+\?$/.test(x) ? '(?:/[^/]+)?' : `/${x.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '[^/]+').replace(/\*/g, '.*')}`);
  routes.push({ path: m[1], re: new RegExp(`^${m[1].split('/').slice(1).map(seg).join('')}$`) });
}
const isRoute = (r) => routes.some((x) => x.path === r || x.re.test(r));

// Sections of the smoke test.
const sections = new Set([...readFileSync(join(ROOT, 'scripts/smoke/smoke.mjs'), 'utf8').matchAll(/section\((['"`])(.*?)\1\)/g)].map((m) => m[2]));

const exists = (p) => existsSync(join(ROOT, p.replace(/\/$/, '')));
const PATH_RE = /(?:^|[\s,(])((?:apps|packages|scripts|docs|design|plannerdocs|\.github)\/[\w./-]*)/g;
const pathsIn = (text) => [...` ${text}`.matchAll(PATH_RE)].map((m) => m[1].replace(/[.,;:]+$/, ''));

for (const s of BUILD_SECTIONS) {
  for (const card of s.cards) {
    const where = `${s.name}, ${card.title}`;
    for (const f of card.files ?? []) if (!exists(f)) say(where, `file ${f} does not exist`);
    for (const c of card.checks ?? []) {
      if (c.startsWith('smoke: ')) {
        if (!sections.has(c.slice(7))) say(where, `no smoke section called "${c.slice(7)}"`);
      } else if (!exists(c)) say(where, `check ${c} does not exist`);
    }
    const items = [...card.items, ...(card.extra ?? [])];
    if (items.some((i) => i[1] === 'ok') && !(card.checks ?? []).length) say(where, 'built and checked, but names no check');
    for (const part of (card.route ?? '').split(', ')) {
      if (part.startsWith('/') && !isRoute(part)) say(where, `route ${part} is not in App.tsx`);
      for (const p of pathsIn(part)) if (!exists(p)) say(where, `path ${p} does not exist`);
    }
    for (const [label, state, note] of items) {
      if (!['ok', 'key', 'test', 'off'].includes(state)) say(where, `"${label}" has no known state`);
      for (const p of [...pathsIn(label), ...pathsIn(note ?? '')]) if (!exists(p)) say(where, `"${label}" names ${p}, which does not exist`);
      if (note && /^\/[\w/:-]*$/.test(note) && !isRoute(note)) say(where, `"${label}" names route ${note}, which is not in App.tsx`);
    }
  }
}
for (const f of BUILD_FILES) if (!exists(f.where)) say('Where things live', `${f.where} does not exist`);

if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
