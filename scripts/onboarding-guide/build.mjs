#!/usr/bin/env node
// Builds the School migration for Onboarding into kreators.app from the lesson files beside this script.
//
//   node scripts/onboarding-guide/build.mjs                    # writes apps/api/migrations/0096_onboarding_guide.sql
//   node scripts/onboarding-guide/build.mjs <out.sql>          # writes there instead
//   node scripts/onboarding-guide/build.mjs --check            # Flesch and words per lesson, nothing written
//   node scripts/onboarding-guide/build.mjs --sync <out.sql>
//       UPDATE statements that bring a database where the migration already ran up to the current
//       lessons (titles and bodies), plus INSERT OR IGNORE for lessons added since. It never deletes a
//       row and never touches a lesson's place or the program's place in School, since admins move
//       them from School itself (migration 0095). It does put back the files' titles and words, so an
//       edit made in the app should be copied into its file first. Apply it with wrangler d1 execute --file.
//       --order also sets every lesson's place to the reading order below (AFTER); --only 04,18 limits the
//       titles and words to those lessons (0097 was made with --sync <file> --order --only 04,18).
//
// Onboarding into kreators.app (the founder, 2026-11-06) is the first course in School and open to
// all: how each part of the app works, why it is there, what emerges and what develops, from the
// person's own side. It is Public, free, with no creator and no manager, and one cohort open all year
// with room for everyone. It is placed first in School (sort_position 0, migration 0095); an admin can
// move it from School's program menu. Same approach as scripts/admin-guide/build.mjs: INSERT OR IGNORE,
// safe to run again.
//
// The lesson files: scripts/onboarding-guide/lessons/NN-<slug>.md, read in NN order (NN is two digits,
// 01 to 99, each used once, and becomes its id prog-onboarding-lNN; its sequence is its place in the reading
// order, which is the numbers' order unless AFTER puts a later lesson beside the one it belongs with; gaps are
// fine and never show, since a lesson's number on screen is its place in the list).
// The first line is "# <Lesson title>" (140 characters at most); everything after it is the lesson
// body in the small markdown Markdown.tsx renders (## ### - 1. > **bold**), with no links, in the
// School voice: it must contain "In this lesson you'll learn", "**Pro tip", "**Result:**" and
// "## The bottom line".
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const dir = join(here, 'lessons');
const DEFAULT_OUT = join(root, 'apps/api/migrations/0096_onboarding_guide.sql');
const CREATED = '2026-11-06T00:00:00.000Z';

const PROGRAM = {
  id: 'prog-onboarding',
  name: 'Onboarding into kreators.app',
  description:
    'Your first course here, free and open to everyone. How each part of kreators.app works, why it is there, and what grows as you use it, from the setup chat to your first month.',
  outcomes: 'You know where everything lives, what each part is for, and how to make the app work for you, a day, a week and a month at a time.',
  prerequisites: 'Nothing. Start whenever you like.',
  // First in School for everyone (migration 0095); an admin can move it later from School.
  sortPosition: 0,
};
const COHORT = {
  id: 'coh-onboarding',
  name: 'Open all year',
  start: '2026-01-01T00:00:00.000Z',
  end: '2099-12-31T00:00:00.000Z',
  // Room for everyone: School shows no seat count at this size (OPEN_TO_ALL_SEATS in School.tsx).
  capacity: 1000000,
};
const MUST = ["In this lesson you'll learn", '**Pro tip', '**Result:**', '## The bottom line'];
// A lesson written later keeps its own number, so its id and everyone's progress on the lessons around it never change, and is
// read right after the lesson named here (number: the lesson it follows). Every other lesson follows its number. A lesson's
// place in School (its `sequence`) is its position in this reading order, 1 up. Daily, part three (18) comes after part two (05) (2026-11-06, time blocks); Fitness (19) after the journal and trackers (07), and working with a life coach (20) after Connection (11) (2026-11-07, docs/content-placement.md).
const AFTER = { 18: 5, 19: 7, 20: 11 };

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const lessonId = (n) => `${PROGRAM.id}-l${String(n).padStart(2, '0')}`;

function parse(file) {
  const m = /^(\d{2})-[a-z0-9-]+\.md$/.exec(file);
  if (!m) throw new Error(`${file}: name it NN-some-words.md (two digits, a dash, lowercase words)`);
  const seq = Number(m[1]);
  if (seq < 1) throw new Error(`${file}: NN starts at 01`);
  const text = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').replace(/^﻿/, '');
  const nl = text.indexOf('\n');
  const first = (nl === -1 ? text : text.slice(0, nl)).trim();
  const head = /^# (.+)$/.exec(first);
  if (!head) throw new Error(`${file}: the first line must be "# <Lesson title>"`);
  const title = head[1].trim();
  const body = (nl === -1 ? '' : text.slice(nl + 1)).trim();
  if (title.length > 140) throw new Error(`${file}: title too long (${title.length} > 140)`);
  if (!body) throw new Error(`${file}: the lesson has no body`);
  for (const must of MUST) if (!body.includes(must)) throw new Error(`${file}: "${title}" has no ${must}`);
  if (/\]\(|https?:\/\//.test(body)) throw new Error(`${file}: lessons carry no links (the School markdown has none)`);
  return { file, seq, title, body };
}

// The same Flesch reading ease as scripts/flesch.py and the book builder, so --check agrees with them.
function flesch(text) {
  const syl = (w) => {
    const x = w.toLowerCase().replace(/^'+|'+$/g, '');
    if (!x) return 0;
    let n = (x.match(/[aeiouy]+/g) ?? []).length;
    if (x.endsWith('e') && !/(le|ee|ye)$/.test(x) && n > 1) n -= 1;
    return Math.max(1, n);
  };
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => /[A-Za-z]/.test(s));
  const words = text.match(/[A-Za-z][A-Za-z']*/g) ?? [];
  if (!words.length || !sentences.length) return 0;
  const s = words.reduce((a, w) => a + syl(w), 0);
  return Math.round((206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (s / words.length)) * 10) / 10;
}

const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
const lessons = files.map(parse).sort((a, b) => a.seq - b.seq);
const seen = new Map();
for (const l of lessons) {
  if (seen.has(l.seq)) throw new Error(`${l.file} and ${seen.get(l.seq)} share the number ${String(l.seq).padStart(2, '0')}`);
  seen.set(l.seq, l.file);
}
if (!lessons.length) throw new Error(`no lessons in ${dir}`);
for (const [n, after] of Object.entries(AFTER)) {
  if (!seen.has(Number(n))) throw new Error(`AFTER names lesson ${n}, which has no file`);
  if (!seen.has(after)) throw new Error(`AFTER puts lesson ${n} after ${after}, which has no file`);
}
// The reading order: every lesson by its number, each one in AFTER lifted out and put back right after the lesson it follows.
const order = lessons.filter((l) => !(l.seq in AFTER));
for (const l of lessons.filter((x) => x.seq in AFTER)) {
  const at = order.findIndex((x) => x.seq === AFTER[l.seq]);
  if (at === -1) throw new Error(`lesson ${l.seq} follows ${AFTER[l.seq]}, which is itself placed after a later lesson`);
  let i = at + 1;
  while (i < order.length && order[i].seq in AFTER && AFTER[order[i].seq] === AFTER[l.seq]) i += 1;
  order.splice(i, 0, l);
}
order.forEach((l, i) => (l.place = i + 1));

const lessonInsert = (l) =>
  `INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES (${[q(lessonId(l.seq)), q(PROGRAM.id), q(l.title), q('lesson'), 'NULL', q(l.body), l.place, 1].join(', ')});`;

if (process.argv.includes('--check')) {
  let bad = 0;
  console.log(`${PROGRAM.name}: ${lessons.length} lessons`);
  for (const l of order) {
    const f = flesch(l.body);
    const words = (l.body.match(/[A-Za-z][A-Za-z']*/g) ?? []).length;
    if (f < 60) bad += 1;
    console.log(`  ${String(l.place).padStart(2, ' ')}. ${String(l.seq).padStart(2, '0')} ${f < 60 ? 'LOW ' : '    '}${f.toFixed(1).padStart(5)}  ${String(words).padStart(5)}w  ${l.title}`);
  }
  process.exit(bad ? 1 : 0);
}

const syncAt = process.argv.indexOf('--sync');
if (syncAt !== -1) {
  const target = process.argv[syncAt + 1];
  if (!target || target.startsWith('--')) throw new Error('give the sync file path');
  // A sync never touches a lesson's resources (lesson_resources), which an admin adds in School: it changes titles, words and order, and
  // its INSERT OR IGNORE does nothing to a lesson that exists.
  // --only 04,18: bring only these lessons' titles and words up to date (adding any that are new); the rest keep theirs, and the
  // program's own line is left out.
  const onlyAt = process.argv.indexOf('--only');
  const only = onlyAt === -1 ? null : new Set(String(process.argv[onlyAt + 1] ?? '').split(',').map(Number).filter((n) => seen.has(n)));
  if (only && !only.size) throw new Error('--only takes lesson numbers that have files, like 04,18');
  // The reading order goes in only when asked (--order): admins move lessons from School itself, and a plain sync leaves that alone.
  const withOrder = process.argv.includes('--order');
  const sql = only
    ? []
    : [`UPDATE programs SET name = ${q(PROGRAM.name)}, description = ${q(PROGRAM.description)}, outcomes = ${q(PROGRAM.outcomes)}, prerequisites = ${q(PROGRAM.prerequisites)} WHERE id = ${q(PROGRAM.id)};`];
  for (const l of order) {
    const where = `WHERE id = ${q(lessonId(l.seq))} AND program_id = ${q(PROGRAM.id)};`;
    if (!only || only.has(l.seq)) {
      sql.push(`UPDATE learning_items SET module_title = ${q(l.title)}, body = ${q(l.body)}${withOrder ? `, sequence = ${l.place}` : ''} ${where}`);
      sql.push(lessonInsert(l));
    } else if (withOrder) sql.push(`UPDATE learning_items SET sequence = ${l.place} ${where}`);
  }
  writeFileSync(target, sql.join('\n') + '\n');
  console.log(`wrote ${target}: ${only ? only.size : lessons.length} of ${lessons.length} lessons${withOrder ? ', in reading order' : ''}`);
  process.exit(0);
}

const out = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? DEFAULT_OUT;
const lines = [
  '-- 0096: Onboarding into kreators.app, the first course in School and open to all (the founder, 2026-11-06).',
  '-- How each part of the app works, why it is there, what emerges and what develops, from the person\'s own side. Public,',
  '-- free, online, no creator and no manager; first in School (sort_position 0, migration 0095); one cohort open all year',
  '-- with room for everyone, so School shows "Always open" and no seat count.',
  '-- Generated by scripts/onboarding-guide/build.mjs from scripts/onboarding-guide/lessons/NN-*.md. Idempotent: safe to re-run.',
  '',
  `INSERT OR IGNORE INTO programs (id, name, description, price_points, price_cents, currency, delivery_mode, published, visibility, outcomes, prerequisites, created_by, created_at, sort_position) VALUES (${[q(PROGRAM.id), q(PROGRAM.name), q(PROGRAM.description), 0, 0, q('INR'), q('online'), 1, q('public'), q(PROGRAM.outcomes), q(PROGRAM.prerequisites), 'NULL', q(CREATED), PROGRAM.sortPosition].join(', ')});`,
  `INSERT OR IGNORE INTO cohorts (id, program_id, name, start_at, end_at, capacity, status, manager_user_id, created_at) VALUES (${[q(COHORT.id), q(PROGRAM.id), q(COHORT.name), q(COHORT.start), q(COHORT.end), COHORT.capacity, q('running'), 'NULL', q(CREATED)].join(', ')});`,
  '',
  ...order.map(lessonInsert),
  '',
];
writeFileSync(out, lines.join('\n'));
console.log(`wrote ${out}: ${lessons.length} lessons`);
