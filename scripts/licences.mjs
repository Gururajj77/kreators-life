#!/usr/bin/env node
// Lists the open-source packages that ship with the web app and writes apps/web/public/licences.json for the /licences page.
// Plain Node, no network, no dependencies. It walks the production dependency closure of apps/web (its `dependencies`, then each
// package's own `dependencies`), reads every package from node_modules the way Node would, skips devDependencies and our own
// workspace packages, and keeps the licence text when the package carries one.
// Run: node scripts/licences.mjs
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps', 'web');
const OUT = join(WEB, 'public', 'licences.json');
const TEXT_CAP = 20000;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Find `name` the way Node does, starting from a real directory and walking up through node_modules folders. */
function resolveFrom(dir, name) {
  let d = dir;
  for (;;) {
    const candidate = join(d, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function licenceOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license === 'object' && pkg.license.type) return String(pkg.license.type);
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => (typeof l === 'string' ? l : l.type)).filter(Boolean).join(' OR ');
  return '';
}

function repoOf(pkg) {
  const r = pkg.repository;
  const url = typeof r === 'string' ? r : r && r.url ? r.url : pkg.homepage || '';
  return String(url).replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/');
}

function licenceText(dir) {
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return '';
  }
  const hit = names.find((n) => /^(licen[cs]e|copying)(\.(md|txt|markdown))?$/i.test(n)) ?? names.find((n) => /^(licen[cs]e|copying)/i.test(n));
  if (!hit) return '';
  try {
    return readFileSync(join(dir, hit), 'utf8').replace(/\r\n/g, '\n').trim().slice(0, TEXT_CAP);
  } catch {
    return '';
  }
}

const webPkg = readJson(join(WEB, 'package.json'));
const found = new Map(); // name@version -> record
const seen = new Set(); // real paths already walked

function walk(dir) {
  if (seen.has(dir)) return;
  seen.add(dir);
  const pkg = readJson(join(dir, 'package.json'));
  const key = `${pkg.name}@${pkg.version}`;
  if (!found.has(key)) {
    found.set(key, { name: pkg.name, version: pkg.version, license: licenceOf(pkg), repository: repoOf(pkg), text: licenceText(dir) });
  }
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    const at = resolveFrom(dir, dep);
    if (at) walk(at);
  }
}

for (const dep of Object.keys(webPkg.dependencies ?? {})) {
  if (dep.startsWith('@kreators/')) continue; // our own packages
  const at = resolveFrom(WEB, dep);
  if (at) walk(at);
  else console.warn(`not installed, skipped: ${dep}`);
}

// The pictures on Home's app tiles are no npm package, so the walk above never meets them: their licence is the file beside them.
found.set('fluentui-emoji', { name: 'fluentui-emoji', version: '3D pictures on Home', license: 'MIT', repository: 'https://github.com/microsoft/fluentui-emoji', text: readFileSync(join(WEB, 'public', 'apps', 'LICENSE.txt'), 'utf8').trim() });

const packages = [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), packages }, null, 1) + '\n');

const copyleft = packages.filter((p) => /\b(A?GPL|LGPL)/i.test(p.license));
const missing = packages.filter((p) => !p.license);
console.log(`${packages.length} packages written to ${OUT}`);
console.log(`licences: ${[...new Set(packages.map((p) => p.license || '(none)'))].sort().join(', ')}`);
console.log(`without licence text: ${packages.filter((p) => !p.text).map((p) => `${p.name}@${p.version}`).join(', ') || 'none'}`);
if (copyleft.length) console.log(`COPYLEFT: ${copyleft.map((p) => `${p.name}@${p.version} (${p.license})`).join(', ')}`);
if (missing.length) console.log(`NO LICENCE FIELD: ${missing.map((p) => `${p.name}@${p.version}`).join(', ')}`);
