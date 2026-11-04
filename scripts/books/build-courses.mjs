#!/usr/bin/env node
// Builds the School migration for the three book courses from the lesson sources beside this file.
//
//   node scripts/books/build-courses.mjs apps/api/migrations/0078_book_courses.sql
//   node scripts/books/build-courses.mjs --check      # Flesch per lesson, nothing written
//   node scripts/books/build-courses.mjs --sync <out.sql>
//       UPDATE statements that bring a database where the migration already ran up to the
//       current sources (titles, bodies, program and assignment text). It never deletes a row,
//       so enrolments and lesson progress stay. Apply it with wrangler d1 execute --file.
//
// Each source in scripts/books/courses/*.md is one School program, written by hand from the
// founder's own book (Shubham Aggarwal). The migration it writes is the same shape as
// 0016_school_programs.sql: programs, learning_items, course_assignments and one open cohort,
// all INSERT OR IGNORE so it is safe to run again. The source format:
//
//   @@ program <id>
//   name: ...            (one line each: name, description, outcomes, prerequisites, cohort)
//   @@ lesson <title>
//   <the lesson in the small markdown Markdown.tsx renders>
//   @@ assignment <title>
//   <instructions>
//   @@ rubric
//   <rubric>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'courses');
const CREATED = '2026-11-04T00:00:00.000Z';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function parse(file) {
  const text = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
  const blocks = text.split(/^@@ /m).filter((b) => b.trim());
  const course = { meta: {}, lessons: [], assignments: [] };
  for (const block of blocks) {
    const nl = block.indexOf('\n');
    const head = block.slice(0, nl).trim();
    const body = block.slice(nl + 1).trim();
    const [kind, ...rest] = head.split(' ');
    const arg = rest.join(' ').trim();
    if (kind === 'program') {
      course.id = arg;
      for (const line of body.split('\n')) {
        const m = /^(\w+):\s*(.*)$/.exec(line);
        if (m) course.meta[m[1]] = m[2].trim();
      }
    } else if (kind === 'lesson') course.lessons.push({ title: arg, body });
    else if (kind === 'assignment') course.assignments.push({ title: arg, instructions: body, rubric: '' });
    else if (kind === 'rubric') course.assignments[course.assignments.length - 1].rubric = body;
    else throw new Error(`${file}: unknown block ${kind}`);
  }
  for (const k of ['name', 'description', 'outcomes', 'prerequisites', 'cohort']) if (!course.meta[k]) throw new Error(`${file}: missing ${k}`);
  for (const l of course.lessons) {
    if (l.title.length > 140) throw new Error(`${file}: title too long: ${l.title}`);
    for (const must of ["In this lesson you'll learn", '**From the book:**', '**Pro tip', '**Result:**', '## The bottom line'])
      if (!l.body.includes(must)) throw new Error(`${file}: "${l.title}" has no ${must}`);
  }
  return course;
}

// The same Flesch reading ease as scripts/flesch.py, so --check agrees with it.
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

const courses = readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map(parse);

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const c of courses) {
    console.log(`${c.meta.name}: ${c.lessons.length} lessons`);
    c.lessons.forEach((l, i) => {
      const f = flesch(l.body);
      const words = (l.body.match(/[A-Za-z][A-Za-z']*/g) ?? []).length;
      if (f < 60) bad += 1;
      console.log(`  ${String(i + 1).padStart(2)} ${f < 60 ? 'LOW ' : '    '}${f.toFixed(1).padStart(5)}  ${String(words).padStart(4)}w  ${l.title}`);
    });
  }
  process.exit(bad ? 1 : 0);
}

const syncAt = process.argv.indexOf('--sync');
if (syncAt !== -1) {
  const target = process.argv[syncAt + 1];
  if (!target) throw new Error('give the sync file path');
  const sql = [];
  for (const c of courses) {
    sql.push(`UPDATE programs SET name = ${q(c.meta.name)}, description = ${q(c.meta.description)}, outcomes = ${q(c.meta.outcomes)}, prerequisites = ${q(c.meta.prerequisites)} WHERE id = ${q(c.id)};`);
    c.lessons.forEach((l, i) => {
      const id = `${c.id}-l${String(i + 1).padStart(2, '0')}`;
      sql.push(`UPDATE learning_items SET module_title = ${q(l.title)}, body = ${q(l.body)} WHERE id = ${q(id)} AND program_id = ${q(c.id)};`);
    });
    c.assignments.forEach((a, i) => {
      const id = `${c.id}-a${String(i + 1).padStart(2, '0')}`;
      sql.push(`UPDATE course_assignments SET title = ${q(a.title)}, instructions = ${q(a.instructions)}, rubric = ${q(a.rubric)} WHERE id = ${q(id)} AND program_id = ${q(c.id)};`);
    });
  }
  writeFileSync(target, sql.join('\n') + '\n');
  console.log(`wrote ${target}: ${sql.length} updates`);
  process.exit(0);
}

const out = process.argv[2];
if (!out) throw new Error('give the migration path');
const lines = [
  '-- Three School programs, one for each of the founder\'s books (Shubham Aggarwal), written in the',
  '-- School teaching voice from the books\' own text. Every lesson names the chapter it comes from;',
  '-- anything a lesson adds that the book does not say is labelled as the app\'s own.',
  '-- Generated by scripts/books/build-courses.mjs from scripts/books/courses/*.md. Idempotent: safe to re-run.',
  '',
];
for (const c of courses) {
  lines.push(`-- ${c.meta.name}`);
  lines.push(`INSERT OR IGNORE INTO programs (id, name, description, price_points, price_cents, currency, delivery_mode, published, outcomes, prerequisites, created_by, created_at) VALUES (${[q(c.id), q(c.meta.name), q(c.meta.description), 0, 0, q('INR'), q('online'), 1, q(c.meta.outcomes), q(c.meta.prerequisites), 'NULL', q(CREATED)].join(', ')});`);
  c.lessons.forEach((l, i) => {
    const id = `${c.id}-l${String(i + 1).padStart(2, '0')}`;
    lines.push(`INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES (${[q(id), q(c.id), q(l.title), q('lesson'), 'NULL', q(l.body), i + 1, 1].join(', ')});`);
  });
  c.assignments.forEach((a, i) => {
    const id = `${c.id}-a${String(i + 1).padStart(2, '0')}`;
    lines.push(`INSERT OR IGNORE INTO course_assignments (id, program_id, title, instructions, rubric, due_days, sequence) VALUES (${[q(id), q(c.id), q(a.title), q(a.instructions), q(a.rubric), 14, i + 1].join(', ')});`);
  });
  const coh = c.id.replace(/^prog-/, 'coh-') + '-open';
  lines.push(`INSERT OR IGNORE INTO cohorts (id, program_id, name, start_at, end_at, capacity, status, manager_user_id, created_at) VALUES (${[q(coh), q(c.id), q(c.meta.cohort), q(CREATED), q('2027-12-31T00:00:00.000Z'), 1000, q('running'), 'NULL', q(CREATED)].join(', ')});`);
  lines.push('');
}
writeFileSync(out, lines.join('\n'));
console.log(`wrote ${out}: ${courses.length} programs, ${courses.reduce((a, c) => a + c.lessons.length, 0)} lessons`);
