#!/usr/bin/env node
// The front-end size budget. Run after `pnpm build`:  pnpm perf:budget
//
// It reads apps/web/dist/assets/*.js and fails (exit 1) when
//   1. the entry chunk (the index-*.js that index.html loads) is over ENTRY_MAX,
//   2. the first download (the entry plus every file index.html preloads) is over INITIAL_MAX, or
//   3. any other single chunk is over CHUNK_MAX (the vendor-* files are exempt: they are libraries, split out on purpose).
// The numbers are the post-split build (2026-11-01: entry 415 kB, first download 1,301 kB) plus about 15 percent.
// Raise one only on purpose, in the same change that explains why.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'apps/web/dist');
const dir = join(dist, 'assets');

const ENTRY_MAX = 480_000; // bytes, raw
const INITIAL_MAX = 1_500_000; // bytes, raw
const CHUNK_MAX = 400_000; // bytes, raw

let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.js'));
} catch {
  console.error('No build found. Run `pnpm build` first.');
  process.exit(2);
}

const rows = files.map((f) => {
  const buf = readFileSync(join(dir, f));
  return { file: f, raw: statSync(join(dir, f)).size, gzip: gzipSync(buf).length };
});

// What index.html loads at once: the entry script and its modulepreload links.
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const initial = new Set([...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]));
const entry = [...initial].find((f) => /^index-/.test(f));

const kb = (n) => `${(n / 1000).toFixed(1)} kB`.padStart(11);
console.log('\nchunk'.padEnd(34) + 'raw'.padStart(11) + 'gzip'.padStart(11) + '  first download');
for (const r of rows.sort((a, b) => b.raw - a.raw).slice(0, 14)) {
  console.log(`${r.file}`.padEnd(33) + kb(r.raw) + kb(r.gzip) + (initial.has(r.file) ? '  yes' : ''));
}
if (rows.length > 14) console.log(`... and ${rows.length - 14} smaller chunks`);

const sum = (list, key) => list.reduce((n, r) => n + r[key], 0);
const first = rows.filter((r) => initial.has(r.file));
const failures = [];

const entryRow = rows.find((r) => r.file === entry);
if (!entryRow) failures.push('Could not find the entry chunk in dist/index.html.');
else if (entryRow.raw > ENTRY_MAX) failures.push(`Entry chunk ${entry} is ${kb(entryRow.raw).trim()} (budget ${kb(ENTRY_MAX).trim()}).`);

console.log(`\nentry      ${kb(entryRow?.raw ?? 0)} raw, ${kb(entryRow?.gzip ?? 0)} gzip   (budget ${kb(ENTRY_MAX).trim()})`);
console.log(`first load ${kb(sum(first, 'raw'))} raw, ${kb(sum(first, 'gzip'))} gzip   (budget ${kb(INITIAL_MAX).trim()}, ${first.length} files)`);
console.log(`all chunks ${kb(sum(rows, 'raw'))} raw, ${kb(sum(rows, 'gzip'))} gzip   (${rows.length} files, downloaded as they are opened and kept for offline)`);

if (sum(first, 'raw') > INITIAL_MAX) failures.push(`First download is ${kb(sum(first, 'raw')).trim()} (budget ${kb(INITIAL_MAX).trim()}).`);
for (const r of rows) {
  if (r.file === entry || r.file.startsWith('vendor-')) continue;
  if (r.raw > CHUNK_MAX) failures.push(`${r.file} is ${kb(r.raw).trim()} (one chunk may be at most ${kb(CHUNK_MAX).trim()}).`);
}

if (failures.length) {
  console.error('\nOver budget:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nWithin budget.');
