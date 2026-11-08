// The cron on Workers Free, at scale, with no server: every migration on a scratch SQLite file, a thousand people, and ticks held to the platform's 50 queries by the stand-in
// binding (d1-shim.mjs). Three checks:
//   1. 100 reminders of each kind due at once: over a few ticks everyone gets theirs, exactly once, and no tick passes its budget.
//   2. More than a tick can do, for hours: the ticks fall behind, the window grows, and still everyone gets theirs once.
//   3. A tick stopped dead at every point (the platform's limit, a crash): the next tick finishes, nothing is lost and nothing is sent twice. This is the check on season close
//      and monthly entries, whose claim and work must be one batch.
//   4. A failed read fails only its own caller (d1Batch.ts sends each alone again).
//   node --experimental-strip-types scripts/smoke/cron-stress.mjs
// A Mac is not a Worker: the JavaScript time here is a guide, never a promise.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeD1 } from './d1-shim.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-stress-'));
// esbuild comes with wrangler; pnpm keeps it beside wrangler's real folder.
const require = createRequire(fs.realpathSync(path.join(ROOT, 'apps/api/node_modules/wrangler/package.json')));
const esbuild = require('esbuild');
await esbuild.build({
  absWorkingDir: path.join(ROOT, 'apps/api'),
  entryPoints: { cron: path.join(ROOT, 'apps/api/src/cron.ts'), batch: path.join(ROOT, 'apps/api/src/d1Batch.ts') },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outdir: WORK,
  splitting: true,
  outExtension: { '.js': '.mjs' },
  external: ['cloudflare:*'],
  logLevel: 'error',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
const { runScheduled } = await import(path.join(WORK, 'cron.mjs'));
const { batchedReads } = await import(path.join(WORK, 'batch.mjs'));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === '' ? '' : `  (${detail})`}`);
  if (!ok) failed += 1;
};

// ---- the base database: every migration, then a thousand people with nothing due.
const BASE = path.join(WORK, 'base.db');
{
  const d = makeD1(BASE);
  const mig = path.join(ROOT, 'apps/api/migrations');
  d.raw.exec('BEGIN');
  for (const f of fs.readdirSync(mig).filter((x) => x.endsWith('.sql')).sort()) d.raw.exec(fs.readFileSync(path.join(mig, f), 'utf8'));
  d.raw.exec('COMMIT');
  const iso = new Date(Date.now() - 300 * 86_400_000).toISOString();
  d.raw.exec('BEGIN');
  const user = d.raw.prepare("INSERT INTO users (id, display_name, created_at, email, handle, friend_code, timezone, onboarded_at) VALUES (?, ?, ?, ?, ?, ?, 'Asia/Kolkata', ?)");
  const project = d.raw.prepare("INSERT INTO nodes (id, user_id, kind, relationship, title, status, created_at, updated_at, xp) VALUES (?, ?, 'project', 'self', 'Project', 'active', ?, ?, 0)");
  for (let i = 0; i < 1000; i++) {
    user.run(`u${i}`, `Person ${i}`, iso, `u${i}@x.test`, `h${i}`, `F${i}`, iso);
    project.run(`u${i}-p`, `u${i}`, iso, iso);
  }
  d.raw.exec('COMMIT');
  d.raw.close();
}

/** N of each kind due five minutes ago, in India. Person sets overlap on purpose: someone can have several. `people` picks who. */
function seed(R, N, now) {
  const local = new Date(now.getTime() + 330 * 60_000);
  const today = local.toISOString().slice(0, 10);
  const hhmm = new Date(local.getTime() - 5 * 60_000).toISOString().slice(11, 16);
  const at = now.toISOString();
  const who = (i, off) => `u${(i + off * 113) % 1000}`;
  // The month before is closed, so a tick does not close it on its own unless asked (`closeSeason`).
  for (let i = 0; i < N; i++) {
    R.prepare('UPDATE users SET reminder_time = ? WHERE id = ?').run(hhmm, who(i, 0));
    R.prepare("INSERT INTO custom_reminders (id, user_id, title, time, days_json, enabled, created_at) VALUES (?, ?, 'Stretch', ?, '[1,2,3,4,5,6,7]', 1, ?)").run(`st${i}`, who(i, 1), hhmm, at);
    R.prepare("INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, status, do_date, due_time, remind, created_at, updated_at, xp) VALUES (?, ?, 'task', ?, 'self', 'Call home', 'active', ?, ?, 1, ?, ?, 5)").run(`rem${i}`, who(i, 2), `${who(i, 2)}-p`, today, hhmm, at, at);
    R.prepare("INSERT INTO review_schedules (id, user_id, kind, anchor, time, repeat_json, next_on, created_at) VALUES (?, ?, 'week', ?, ?, '{\"freq\":\"weekly\",\"every\":1}', ?, ?)").run(`rv${i}`, who(i, 3), today, hhmm, today, at);
    R.prepare("INSERT INTO agency_clients (id, user_id, name, created_at, updated_at) VALUES (?, ?, 'C', ?, ?)").run(`ac${i}`, who(i, 4), at, at);
    R.prepare("INSERT INTO invoices (id, user_id, number, client_name, status, issue_date, due_date, token, created_at, agency_client_id) VALUES (?, ?, 'KR-1', 'C', 'sent', ?, ?, ?, ?, ?)").run(`inv${i}`, who(i, 4), today, today, `tok${i}`, at, `ac${i}`);
    R.prepare("INSERT INTO agency_clients (id, user_id, name, created_at, updated_at) VALUES (?, ?, 'C', ?, ?)").run(`bc${i}`, who(i, 5), at, at);
    R.prepare("INSERT INTO agency_items (id, user_id, client_id, title, stage, due_date, created_at, updated_at) VALUES (?, ?, ?, 'Video', 'making', ?, ?, ?)").run(`ai${i}`, who(i, 5), `bc${i}`, today, at, at);
    R.prepare('INSERT OR REPLACE INTO focus_prefs (user_id, settings_json, updated_at) VALUES (?, ?, ?)').run(who(i, 6), JSON.stringify({ reminderTime: hhmm, reminderDays: [1, 2, 3, 4, 5, 6, 7] }), at);
    R.prepare('INSERT OR REPLACE INTO fitness_prefs (user_id, supplements_on, remind_json, updated_at) VALUES (?, 1, ?, ?)').run(who(i, 7), JSON.stringify({ morning: hhmm }), at);
    R.prepare("INSERT INTO supplements (id, user_id, name, kind, time_of_day, days_json, created_at, updated_at) VALUES (?, ?, 'Vitamin D', 'vitamin', 'morning', '[1,2,3,4,5,6,7]', ?, ?)").run(`su${i}`, who(i, 7), at, at);
    R.prepare("INSERT INTO finance_recurring (id, user_id, kind, amount_cents, currency, category, counterparty, note, day_of_month, next_date, active, created_at) VALUES (?, ?, 'expense', 1000, 'INR', 'rent', '', 'Monthly', 7, ?, 1, ?)").run(`fr${i}`, who(i, 9), today, at);
  }
  // Modules last, so nobody's switches are overwritten: Agency for everyone with a client, Fitness for everyone with a supplement.
  const on = new Map();
  const flag = (id, key) => on.set(id, { ...(on.get(id) ?? {}), [key]: true });
  for (let i = 0; i < N; i++) {
    flag(who(i, 4), 'agency');
    flag(who(i, 5), 'agency');
    flag(who(i, 7), 'fitness');
  }
  for (const [id, m] of on) R.prepare('UPDATE users SET modules = ? WHERE id = ?').run(JSON.stringify(m), id);
  const starts = new Date(now.getTime() + 20 * 3_600_000).toISOString();
  R.prepare("INSERT INTO events (id, host_user_id, title, starts_at, ends_at, status, created_at) VALUES ('ev1', 'u999', 'Meetup', ?, ?, 'published', ?)").run(starts, starts, at);
  for (let i = 0; i < N; i++) R.prepare("INSERT INTO event_registrations (id, event_id, user_id, status, registered_at) VALUES (?, 'ev1', ?, 'registered', ?)").run(`er${i}`, who(i, 8), at);
  return today;
}
const copyOf = (name) => {
  const p = path.join(WORK, `${name}.db`);
  fs.copyFileSync(BASE, p);
  return makeD1(p);
};
const count = (R, sql, ...args) => R.prepare(sql).get(...args).c;
const NOTES = { checkin: 'checkin-', custom: 'custom-', task: 'task-', review: 'review-', invoice: 'invoice-', agency: 'agency-due-', focus: 'focus-', supp: 'supp-', event: 'event-' };
const notes = (R) => Object.fromEntries(Object.entries(NOTES).map(([k, p]) => [k, count(R, 'SELECT COUNT(*) c FROM notifications WHERE id LIKE ?', `${p}%`)]));
const closeLastMonth = (R, now) => R.prepare('INSERT OR IGNORE INTO seasons (season, closed_at) VALUES (?, ?)').run(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString().slice(0, 7), now.toISOString());
const CRON = '*/15 * * * *';
/** Half past nine in India today, so every kind is due and no run crosses a person's midnight. */
function morning() {
  const d = new Date();
  d.setUTCHours(4, 0, 0, 0);
  return d;
}
// The tick's own trips, the platform's limit on them, and the line in the report.
async function ticks(D1, start, max, { limit = 50, log = false, atLeast = 1 } = {}) {
  const peak = { trips: 0, js: 0 };
  let t = start.getTime();
  let n = 0;
  for (; n < max; n++) {
    D1.stats.trips = 0;
    D1.stats.statements = 0;
    D1.stats.sqlMs = 0;
    D1.stats.limit = limit;
    const c0 = process.cpuUsage();
    let threw = '';
    await runScheduled({ DB: D1 }, CRON, new Date(t)).catch((e) => {
      threw = e.message;
    });
    const c = process.cpuUsage(c0);
    const js = (c.user + c.system) / 1000 - D1.stats.sqlMs;
    if (threw) check(`tick ${n} never throws`, false, threw);
    peak.trips = Math.max(peak.trips, D1.stats.trips);
    peak.js = Math.max(peak.js, js);
    const behind = count(D1.raw, 'SELECT COUNT(*) c FROM cron_state');
    if (log) console.log(`  tick ${String(n).padStart(2)}: ${String(D1.stats.trips).padStart(2)} trips, ${String(D1.stats.statements).padStart(3)} statements, ${js.toFixed(1).padStart(5)} ms of JavaScript${behind ? ', behind' : ''}  ${JSON.stringify(notes(D1.raw))} monthly ${count(D1.raw, "SELECT COUNT(*) c FROM finance_transactions WHERE source = 'recurring'")}`);
    t += 15 * 60_000;
    if (!behind && n >= atLeast && JSON.stringify(notes(D1.raw)) === JSON.stringify(ticks.last)) break;
    ticks.last = notes(D1.raw);
  }
  return { ...peak, n: n + 1 };
}
const noTwice = (R) => count(R, 'SELECT COUNT(*) c FROM (SELECT user_id, title, COUNT(*) n FROM notifications GROUP BY id HAVING n > 1)');

// ---- 1. 100 of each kind, on the hour
{
  console.log('\n1. A thousand people, 100 reminders of each kind due at once');
  const D1 = copyOf('one');
  const now = morning();
  now.setUTCMinutes(0, 0, 0);
  closeLastMonth(D1.raw, now);
  const today = seed(D1.raw, 100, now);
  const r = await ticks(D1, now, 12, { log: true });
  const got = notes(D1.raw);
  check('everyone got theirs, of every kind', Object.values(got).every((n) => n === 100), JSON.stringify(got));
  check('every month\'s entry was posted once', count(D1.raw, "SELECT COUNT(*) c FROM finance_transactions WHERE source = 'recurring' AND date = ?", today) === 100);
  check('nobody was told twice', noTwice(D1.raw) === 0);
  check(`no tick passed 45 round trips (the most was ${r.trips})`, r.trips <= 45);
  check(`it finished within the hour's window (${r.n} ticks)`, r.n <= 6, r.n);
  console.log(`  the most JavaScript in one tick: ${r.js.toFixed(1)} ms on this machine`);
  D1.raw.close();
}

// ---- 2. Far more than a tick can do: the window grows until they are done
{
  console.log('\n2. 900 of each: hours of work, and still once each');
  const D1 = copyOf('two');
  const now = morning();
  now.setUTCMinutes(15, 0, 0);
  closeLastMonth(D1.raw, now);
  seed(D1.raw, 900, now);
  const r = await ticks(D1, now, 80);
  const got = notes(D1.raw);
  check('everyone got theirs, of every kind', Object.values(got).every((n) => n === 900), JSON.stringify(got));
  check('nobody was told twice', noTwice(D1.raw) === 0);
  check(`no tick passed 45 round trips (the most was ${r.trips}), over ${r.n} ticks`, r.trips <= 45);
  check('the tick knows it caught up', count(D1.raw, 'SELECT COUNT(*) c FROM cron_state') === 0);
  D1.raw.close();
}

// ---- 3. A stop at every point: the next tick finishes it
{
  console.log('\n3. A tick stopped dead after N round trips, for N from 1 to 40');
  let bad = 0;
  for (let stop = 1; stop <= 40; stop++) {
    const D1 = copyOf(`stop${stop}`);
    const now = morning();
    now.setUTCMinutes(5, 0, 0);
    seed(D1.raw, 30, now);
    // Last month has someone in its top three, and it is not closed yet.
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString();
    D1.raw.exec("UPDATE users SET leaderboard_opt_in = 1 WHERE id IN ('u1','u2','u3')");
    for (const id of ['u1', 'u2', 'u3']) D1.raw.prepare("INSERT INTO xp_events (user_id, amount, source, source_id, relationship, created_at) VALUES (?, 50, 'task', ?, 'self', ?)").run(id, `x-${id}`, lastMonth);
    // Cut off: the shim throws from the Nth call on, as D1 does past its limit.
    D1.stats.trips = 0;
    D1.stats.limit = stop;
    await runScheduled({ DB: D1 }, CRON, now).catch(() => undefined);
    // Then ordinary ticks.
    // Through the next hour's first tick, when the hourly jobs run again.
    await ticks(D1, new Date(now.getTime() + 15 * 60_000), 8, { atLeast: 5 });
    const got = notes(D1.raw);
    const season = new Date(lastMonth).toISOString().slice(0, 7);
    const facts = {
      notes: Object.values(got).every((n) => n === 30),
      once: noTwice(D1.raw) === 0,
      monthly: count(D1.raw, "SELECT COUNT(*) c FROM finance_transactions WHERE source = 'recurring'") === 30,
      seasonClosed: count(D1.raw, 'SELECT COUNT(*) c FROM seasons WHERE season = ?', season) === 1,
      seasonTop: count(D1.raw, 'SELECT COUNT(*) c FROM season_results WHERE season = ?', season) === 3,
      seasonNotes: count(D1.raw, "SELECT COUNT(*) c FROM notifications WHERE id LIKE 'season-%'") === 3,
      honors: count(D1.raw, "SELECT COUNT(*) c FROM honors WHERE honor_key = 'season_top'") === 3,
    };
    if (!Object.values(facts).every(Boolean)) {
      bad += 1;
      console.log(`  stop after ${stop}: ${JSON.stringify(facts)} ${JSON.stringify(got)}`);
    }
    D1.raw.close();
    fs.rmSync(path.join(WORK, `stop${stop}.db`));
  }
  check('a stop at any of the 40 points lost nothing and sent nothing twice', bad === 0, `${bad} of 40`);
}

// ---- 4. Gathered reads
{
  console.log('\n4. Reads gathered into one trip');
  const D1 = copyOf('reads');
  const db = batchedReads(D1);
  D1.stats.trips = 0;
  const [a, b, c] = await Promise.all([db.prepare('SELECT 1 AS x').first(), db.prepare('SELECT ? AS y').bind(2).first('y'), db.prepare('SELECT 3 AS z').all()]);
  check('three independent reads are one trip', D1.stats.trips === 1, D1.stats.trips);
  check('and each gets its own answer, in the shape it asked for', a?.x === 1 && b === 2 && c.results[0]?.z === 3, JSON.stringify([a, b, c]));
  D1.stats.trips = 0;
  const results = await Promise.allSettled([db.prepare('SELECT 1 AS x').first(), db.prepare('SELECT nope FROM nowhere').first(), db.prepare('SELECT 3 AS z').first()]);
  check('a read that fails fails only its own caller', results[0].status === 'fulfilled' && results[0].value?.x === 1 && results[1].status === 'rejected' && results[2].status === 'fulfilled' && results[2].value?.z === 3, JSON.stringify(results.map((r) => r.status)));
  D1.stats.trips = 0;
  const order = [];
  const read = db.prepare("SELECT COUNT(*) AS n FROM cron_state WHERE key = 'gathered'").first().then((r) => order.push(`read saw ${r.n}`));
  const write = db.prepare("INSERT INTO cron_state (key, value) VALUES ('gathered', 'x')").run().then(() => order.push('written'));
  await Promise.all([read, write]);
  check('a write never overtakes a read made before it', order.includes('read saw 0'), order.join(', '));
  D1.raw.exec("DELETE FROM cron_state WHERE key = 'gathered'");
  D1.stats.trips = 0;
  await Promise.all(Array.from({ length: 120 }, (_, i) => db.prepare('SELECT ? AS i').bind(i).first()));
  check('a hundred and twenty reads are three trips', D1.stats.trips === 3, D1.stats.trips);
  const insert = await db.prepare("INSERT INTO cron_state (key, value) VALUES ('r', 'v') RETURNING value").first();
  check('a write with RETURNING goes at once and answers', insert?.value === 'v', JSON.stringify(insert));
  D1.raw.close();
}

// ---- 5. A retainer's month stopped at any point: one invoice, sent, and the owner told once. The half-hour sweep finishes what a stop left.
{
  console.log('\n5. A month of a retainer, stopped dead after N round trips');
  let bad = 0;
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  for (let stop = 1; stop <= 24; stop++) {
    const D1 = copyOf(`month${stop}`);
    const R = D1.raw;
    const at = new Date().toISOString();
    R.prepare("INSERT INTO agency_clients (id, user_id, name, created_at, updated_at, retainer_cents) VALUES ('rc', 'u5', 'R', ?, ?, 100000)").run(at, at);
    R.prepare("INSERT INTO agency_retainers (id, user_id, client_id, status, months, fee_cents, pieces_per_month, start_day, auto_send, created_at, updated_at) VALUES ('ret', 'u5', 'rc', 'active', 3, 100000, 4, ?, 1, ?, ?)").run(today, at, at);
    R.exec(`UPDATE users SET modules = '{"agency":true}' WHERE id = 'u5'`);
    const hour = morning();
    closeLastMonth(R, hour);
    D1.stats.trips = 0;
    D1.stats.limit = stop;
    await runScheduled({ DB: D1 }, CRON, hour).catch(() => undefined);
    D1.stats.limit = Infinity;
    // The half-hour has passed for the sweep. Then the next hour's first tick, twice.
    R.exec("UPDATE agency_cycles SET created_at = '2020-01-01T00:00:00.000Z'");
    for (let i = 0; i < 2; i++) await runScheduled({ DB: D1 }, CRON, new Date(hour.getTime() + (i + 1) * 3_600_000)).catch(() => undefined);
    const facts = {
      months: count(R, 'SELECT COUNT(*) c FROM agency_cycles') === 1,
      oneInvoice: count(R, "SELECT COUNT(*) c FROM invoices WHERE user_id = 'u5'") === 1,
      sent: count(R, "SELECT COUNT(*) c FROM invoices WHERE user_id = 'u5' AND status = 'sent'") === 1,
      linked: count(R, 'SELECT COUNT(*) c FROM agency_cycles y JOIN invoices i ON i.id = y.invoice_id AND i.agency_cycle_id = y.id') === 1,
      told: count(R, "SELECT COUNT(*) c FROM notifications WHERE id LIKE 'month-ready-%'") === 1,
      pieces: count(R, 'SELECT COUNT(*) c FROM agency_items') === 4,
    };
    if (!Object.values(facts).every(Boolean)) {
      bad += 1;
      console.log(`  stop after ${stop}: ${JSON.stringify(facts)}`);
    }
    R.close();
    fs.rmSync(path.join(WORK, `month${stop}.db`));
  }
  check('a stop at any of 24 points made one invoice, sent, and told the owner once', bad === 0, `${bad} of 24`);
}

// ---- 6. Nine o'clock's rush must not use up the hour before a ten o'clock event; a backlog of hourly work goes on the next ticks, behind the reminders; and it never widens their window.
{
  console.log('\n6. A rush of notes in the hour before an event');
  const D1 = copyOf('rush');
  const R = D1.raw;
  const now = morning();
  now.setUTCMinutes(0, 0, 0);
  closeLastMonth(R, now);
  seed(R, 200, now);
  R.exec("DELETE FROM event_registrations; DELETE FROM events");
  const at = now.toISOString();
  // sendEventReminders reads the real clock, so these two are set from it.
  const starts = new Date(Date.now() + 55 * 60_000).toISOString();
  R.prepare("INSERT INTO events (id, host_user_id, title, starts_at, ends_at, status, created_at) VALUES ('soon', 'u999', 'Soon', ?, ?, 'published', ?)").run(starts, starts, at);
  for (let i = 0; i < 300; i++) R.prepare("INSERT INTO event_registrations (id, event_id, user_id, status, registered_at) VALUES (?, 'soon', ?, 'registered', ?)").run(`s${i}`, `u${i}`, at);
  // A tomorrow event comes after it in line, however many guests it has.
  const later = new Date(Date.now() + 20 * 3_600_000).toISOString();
  R.prepare("INSERT INTO events (id, host_user_id, title, starts_at, ends_at, status, created_at) VALUES ('later', 'u999', 'Later', ?, ?, 'published', ?)").run(later, later, at);
  for (let i = 0; i < 400; i++) R.prepare("INSERT INTO event_registrations (id, event_id, user_id, status, registered_at) VALUES (?, 'later', ?, 'registered', ?)").run(`l${i}`, `u${i + 300}`, at);
  // Hourly work a first tick cannot finish.
  for (let i = 0; i < 300; i++) {
    R.prepare("INSERT INTO agency_clients (id, user_id, name, created_at, updated_at, stage, stage_since) VALUES (?, 'u900', 'S', ?, ?, 'enquiry', '2020-01-01T00:00:00.000Z')").run(`st-${i}`, at, at);
    R.prepare("INSERT INTO agency_contracts (id, user_id, client_id, title, doc_json, status, token, created_at, updated_at, sent_at) VALUES (?, 'u900', ?, 'A', '{}', 'sent', ?, ?, ?, ?)").run(`stk-${i}`, `st-${i}`, `stt-${i}`, at, at, at);
  }
  let told = 0;
  let wide = 0;
  // Four ticks is what an hour's reminder has before the event starts.
  for (let n = 0; n < 4; n += 1) {
    await runScheduled({ DB: D1 }, CRON, new Date(now.getTime() + n * 15 * 60_000)).catch(() => undefined);
    told = count(R, "SELECT COUNT(*) c FROM notifications WHERE id LIKE 'event-party-soon-%-hour'");
  }
  check('every guest of the event an hour away is told in its four ticks, in the middle of a rush', told === 300, `${told} of 300`);
  let ticks = 4;
  const left = () => 300 - count(R, "SELECT COUNT(*) c FROM agency_clients WHERE id LIKE 'st-%' AND stage != 'enquiry'");
  for (; ticks < 16 && left() > 0; ticks += 1) {
    await runScheduled({ DB: D1 }, CRON, new Date(now.getTime() + ticks * 15 * 60_000)).catch(() => undefined);
    if (count(R, "SELECT COUNT(*) c FROM cron_state WHERE key = 'hourly_left'") && !count(R, "SELECT COUNT(*) c FROM cron_state WHERE key = 'behind_since'")) wide += 1;
  }
  check('hourly work a first tick could not finish goes on through the next ticks, not an hour later', left() === 0, `${left()} left after ${ticks} ticks`);
  check('and every move kept its log line', count(R, "SELECT COUNT(*) c FROM agency_log WHERE client_id LIKE 'st-%'") === 300);
  check('hourly work waiting does not widen the reminders\' hour by itself', wide > 0, wide);
  R.close();
}

fs.rmSync(WORK, { recursive: true, force: true });
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
