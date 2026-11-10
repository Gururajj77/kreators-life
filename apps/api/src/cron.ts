import { releaseDeadOrders } from './discounts';
import type { Env, UserRow } from './env';
import { noteStmt, nowIso, shiftDate } from './db';
import { runSequences } from './routes/growth';
import { runRecurring } from './routes/finance';
import { finishCancelledEvents } from './routes/party';
import { matchDueCircles, rollWeeklyCircles } from './routes/circles';
import { fetchMetrics } from './social';
import { closeSeason, sendEventReminders } from './engage';
import { DEFAULT_ZONE, money, parseFocusSettings, RETENTION_DAYS, nextOccurrence, nextOnOrAfter, parseRepeat, reviewNameFor, reviewPeriodFor, zonedToUtc, type PeriodKind } from '@kreators/shared';
import { flaggedFor } from './routes/reviews';
import { securityAlerts } from './alerts';
import { sendEmail } from './ops';
import { runAgencyCycles } from './agencyCycles';
import { syncStageFromAgreements } from './lifecycle';
import { accessFor, loadAccessContext } from './access';
import { isSupplementTime, parseSupplementSettings, pastSupplementNote, SUPPLEMENT_TIME_META, supplementDue, supplementNoteId, type SupplementTime } from '@kreators/shared/fitness';
import { VITALS_KEEP_DAYS } from './routes/vitals';
import { LOG_KEEP_DAYS, writeLog } from './logs';
import { countingD1, newTally } from './d1Guard';
import { batchedReads } from './d1Batch';
import { Tick, TICK_TRIPS, type Job, type Turn } from './cronTick';

/** The cron runs every fifteen minutes, so 23:45 is the last tick of a day: a reminder set for 23:46 to 23:59 goes out then and not at 00:00, when its day has already turned over. */
const LAST_TICK = 23 * 60 + 45;

/** Every fifteen minutes: sequence messages, then fresh numbers for posts and reward submissions where a platform lets us read them. The one trigger in wrangler.jsonc. */
const MAIN_CRON = '*/15 * * * *';
/** What a run by hand passes (the README, the smoke test): everything runs, the hourly jobs too. */
const BY_HAND_CRON = '* * * * *';

/** A reminder goes within this long after its time. While the ticks are behind (a job had to leave work), this grows, so nobody's reminder is lost: see `behindSince`. */
const REMINDER_WINDOW_MIN = 60;
/** The fewest minutes in the first tick of an hour: the jobs that need no more than that (tidying, a retainer's month, sequences) run only then, so a quiet day reads a quarter of the rows. One that left work runs again on the next tick, not in an hour. */
const HOURLY_MINUTES = 15;
/** The most posts or reward submissions a tick reads from YouTube: each is a call out and a write, and a tick has about forty round trips for everything. */
const METRICS_A_TICK = 5;
/** Ids in one `IN (...)`: D1 takes a hundred bound values in a statement. */
const IDS_A_STATEMENT = 90;
/** The most-used zone (two names for one clock, Chrome in India says the old one). Reminders there are found by their time; anyone elsewhere is read every tick, and there are few. */
const INDIA = "('Asia/Kolkata', 'Asia/Calcutta')";

type Result = { sequences: number; recurring: number; circles: number; weekly: number; content: number; submissions: number; reminders: number; events: number; season: number; agency: number };
const NOTHING: Result = { sequences: 0, recurring: 0, circles: 0, weekly: 0, content: 0, submissions: 0, reminders: 0, events: 0, season: 0, agency: 0 };

/** What every reminder job reads from: the tick's connection, its clock and how long a reminder may still go after its time. */
interface When {
  db: D1Database;
  now: Date;
  windowMin: number;
}

/**
 * One tick. On Workers Free it has 50 D1 queries and 10 ms of CPU, so it stays inside `TICK_TRIPS` (cronTick.ts says how the jobs share them) and stops cleanly; the
 * rest goes on the next tick. Reminders and anything a person is waiting on run every tick; the jobs that can wait an hour run on the first tick of the hour.
 */
export async function runScheduled(env: Env, cron: string = '', now: Date = new Date()): Promise<Result> {
  // Any other trigger does nothing. The old two-hour one (it sent only water, gone 2026-11-07) can still fire once around a deploy, on the same
  // minute as the fifteen-minute one, and must not start a second full run beside it.
  if (cron && cron !== MAIN_CRON && cron !== BY_HAND_CRON) return { ...NOTHING };
  const tally = newTally();
  // The tick counts its own trips (under the guard they are counted once more, for the header). Independent reads go out together.
  const db = batchedReads(countingD1(env.DB, tally));
  const firstOfHour = cron !== MAIN_CRON || now.getUTCMinutes() < HOURLY_MINUTES;
  const tick = new Tick(db, tally, TICK_TRIPS, Math.floor(now.getTime() / (15 * 60_000)));

  // Money orders nobody paid for within half an hour are closed so the product is buyable again. In one trip with the one thing every tick must know.
  const [, stateRows] = await db.batch<{ key: string; value: string }>([
    db.prepare("UPDATE orders SET status = 'expired' WHERE status = 'pending' AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 minutes')"),
    db.prepare('SELECT key, value FROM cron_state'),
  ]);
  const state = (key: string) => stateRows?.results.find((r) => r.key === key)?.value ?? null;
  const behindSince = state('behind_since');
  const hourlyWaiting = state('hourly_left') !== null;
  // While the ticks are behind, the window reaches back to when they fell behind, so what was left is still caught. Ids and `last_sent_day` keep it once. A day at most.
  const windowMin = behindSince ? Math.min(24 * 60, REMINDER_WINDOW_MIN + Math.max(0, Math.round((now.getTime() - Date.parse(behindSince)) / 60_000))) : REMINDER_WINDOW_MIN;
  const when: When = { db, now, windowMin };

  // `timed`: a reminder with an hour to go in, which is what a late tick must reach back for. The notes on a due day go any time after nine, so they need no wider window.
  const reminders = (name: string, run: (w: When, turn: Turn) => Promise<number>, timed = true): Job => ({ name, timed, run: (turn) => run(when, turn) });
  const jobs: Job[] = [
    // Security first in line: an alert is the one thing that must not wait for a tick that is busy with reminders.
    { name: 'alerts', first: true, run: (turn) => securityAlerts(db, { ready: Boolean(env.RESEND_API_KEY), site: env.PUBLIC_URL, send: async (msg) => { await sendEmail(db, env, msg); } }, now, turn) },
    reminders('checkins', sendReminders),
    reminders('custom', sendCustomReminders),
    reminders('tasks', sendTaskReminders),
    reminders('reviews', sendReviewReminders),
    reminders('invoices', sendInvoiceNotes, false),
    reminders('agencyDue', sendAgencyDueNotes, false),
    reminders('focus', sendFocusReminders),
    reminders('supplements', sendSupplementReminders),
    // Worth nothing once the event starts, so up front: a rush of notes at nine must not use up the hour before a ten o'clock event.
    { name: 'events', first: true, run: (turn) => sendEventReminders(db, turn) },
    { name: 'circles', run: (turn) => matchDueCircles(db, turn) },
    // An event cancelled by a tap or a delete that stopped in time: the seats left open get their refund and their note, every tick, since a guest is waiting on it.
    { name: 'cancelled', run: (turn) => finishCancelledEvents(db, turn) },
    { name: 'content', run: (turn) => readContentMetrics(env, db, turn) },
    { name: 'submissions', run: (turn) => readSubmissionMetrics(env, db, turn) },
  ];
  if (firstOfHour || hourlyWaiting) {
    const hourlyJob = (name: string, run: Job['run']): Job => ({ name, hourly: true, spare: !firstOfHour, run });
    jobs.push(
      hourlyJob('season', (turn) => closeSeason(db, turn)),
      hourlyJob('sequences', (turn) => runSequences(db, turn)),
      hourlyJob('recurring', (turn) => runRecurring(db, undefined, turn)),
      // Agency: a retainer's months (each one's invoice and pieces, once), and clients whose agreement moved.
      hourlyJob('agency', (turn) => runAgencyCycles(db, undefined, turn)),
      hourlyJob('stages', (turn) => syncStageFromAgreements(db, undefined, turn)),
      hourlyJob('weekly', (turn) => rollWeeklyCircles(db, turn)),
      // A discount code's use is given back when the order it was taken for failed or expired.
      hourlyJob('orders', (turn) => releaseDeadOrders(db, turn)),
      hourlyJob('suppNotes', (turn) => clearPastSupplementNotes(db, turn)),
    );
  }
  const done = await tick.run(jobs);
  if (firstOfHour) await tidyOld(db).catch((e: unknown) => tick.errors.push(`tidy: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120)));
  // The window grows only while a reminder was left, and goes back to an hour on the first tick that finishes them. The hourly jobs come back each tick only while one of them left work.
  if (tick.behind !== (behindSince !== null) || tick.hourlyLeft !== hourlyWaiting) {
    await db.batch([
      ...(tick.behind && !behindSince ? [db.prepare("INSERT OR IGNORE INTO cron_state (key, value) VALUES ('behind_since', ?)").bind(now.toISOString())] : []),
      ...(!tick.behind && behindSince ? [db.prepare("DELETE FROM cron_state WHERE key = 'behind_since'")] : []),
      ...(tick.hourlyLeft && !hourlyWaiting ? [db.prepare("INSERT OR IGNORE INTO cron_state (key, value) VALUES ('hourly_left', ?)").bind(now.toISOString())] : []),
      ...(!tick.hourlyLeft && hourlyWaiting ? [db.prepare("DELETE FROM cron_state WHERE key = 'hourly_left'")] : []),
    ]);
  }
  if (tick.errors.length) await writeLog(db, { level: 'error', area: 'cron', message: tick.errors.join('; ') });
  const n = (k: string) => done[k] ?? 0;
  return {
    sequences: n('sequences'),
    recurring: n('recurring'),
    circles: n('circles'),
    weekly: n('weekly'),
    content: n('content'),
    submissions: n('submissions'),
    reminders: n('checkins') + n('custom') + n('tasks') + n('reviews') + n('invoices') + n('agencyDue') + n('focus') + n('supplements'),
    events: n('events'),
    season: n('season'),
    agency: n('agency'),
  };
}

/** Fresh view and comment numbers for posts: a few a tick, and nothing at all while there is no key to read them with. */
async function readContentMetrics(env: Env, db: D1Database, turn: Turn): Promise<number> {
  if (!env.YOUTUBE_API_KEY) return 0;
  const stale = await db.prepare("SELECT id, url FROM content_items WHERE platform = 'youtube' AND (synced_at IS NULL OR synced_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 hours')) LIMIT ?").bind(METRICS_A_TICK).all<{ id: string; url: string }>();
  if (!stale.results.length) return 0;
  const share = await turn();
  let content = 0;
  for (const item of stale.results) {
    if (share.left() < 2) {
      share.more();
      break;
    }
    share.outbound();
    const r = await fetchMetrics(item.url, env);
    if (!r.reading) break;
    await db.prepare('UPDATE content_items SET views = ?, likes = ?, comments = ?, synced_at = ? WHERE id = ?').bind(r.reading.views, r.reading.likes, r.reading.comments, nowIso(), item.id).run();
    content += 1;
  }
  return content;
}

/** The same for reward submissions, where the numbers can pay. */
async function readSubmissionMetrics(env: Env, db: D1Database, turn: Turn): Promise<number> {
  if (!env.YOUTUBE_API_KEY) return 0;
  const subs = await db
    .prepare("SELECT s.id, s.url FROM bounty_submissions s WHERE s.platform = 'youtube' AND s.status IN ('submitted','verified') AND NOT EXISTS (SELECT 1 FROM social_metrics m WHERE m.submission_id = s.id AND m.source = 'auto' AND m.fetched_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 hours')) LIMIT ?")
    .bind(METRICS_A_TICK)
    .all<{ id: string; url: string }>();
  if (!subs.results.length) return 0;
  const share = await turn();
  let submissions = 0;
  for (const s of subs.results) {
    if (share.left() < 2) {
      share.more();
      break;
    }
    share.outbound();
    const r = await fetchMetrics(s.url, env);
    if (!r.reading) break;
    const at = nowIso();
    await db.batch([
      db.prepare('INSERT INTO social_metrics (id, submission_id, views, likes, comments, shares, source, note, recorded_by, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)').bind(crypto.randomUUID(), s.id, r.reading.views, r.reading.likes, r.reading.comments, 0, 'auto', r.why, at),
      db.prepare('UPDATE bounty_submissions SET latest_views = ?, latest_engagement = ?, updated_at = ? WHERE id = ?').bind(r.reading.views, r.reading.likes + r.reading.comments, at, s.id),
    ]);
    submissions += 1;
  }
  return submissions;
}

/** Split for `IN (...)`. */
function inGroups<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IDS_A_STATEMENT) out.push(items.slice(i, i + IDS_A_STATEMENT));
  return out;
}
const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Which of these inbox notes exist, with when each was written. A note with a fixed id goes once, and asking first means a job's budget goes on people who still need theirs. */
async function notesThere(db: D1Database, ids: readonly string[]): Promise<Map<string, string>> {
  const parts = await Promise.all(inGroups(ids).map((part) => db.prepare(`SELECT id, created_at FROM notifications WHERE id IN (${marks(part.length)})`).bind(...part).all<{ id: string; created_at: string }>()));
  return new Map(parts.flatMap((p) => p.results.map((r) => [r.id, r.created_at] as const)));
}

/** Who has an app on (their switch, the team's flags): read together for everyone who needs it, never one person at a time. */
async function appOnFor(db: D1Database, key: string, userIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Set();
  const [ctx, users, orgs] = await Promise.all([
    loadAccessContext(db),
    Promise.all(inGroups(ids).map((part) => db.prepare(`SELECT id, role, modules FROM users WHERE id IN (${marks(part.length)})`).bind(...part).all<Pick<UserRow, 'id' | 'role' | 'modules'>>())),
    Promise.all(inGroups(ids).map((part) => db.prepare(`SELECT user_id, organization_id FROM organization_members WHERE status = 'active' AND user_id IN (${marks(part.length)})`).bind(...part).all<{ user_id: string; organization_id: string }>())),
  ]);
  const orgsOf = new Map<string, string[]>();
  for (const r of orgs.flatMap((p) => p.results)) orgsOf.set(r.user_id, [...(orgsOf.get(r.user_id) ?? []), r.organization_id]);
  const on = new Set<string>();
  for (const u of users.flatMap((p) => p.results)) if (accessFor(u, ctx, orgsOf.get(u.id) ?? [])[key]?.on === true) on.add(u.id);
  return on;
}

/** The times of day that can be due in India now: anyone there whose time falls outside this is not read at all. */
function indiaTimes({ now, windowMin }: When): [string, string] {
  const clock = localNow(DEFAULT_ZONE, now);
  if (!clock || windowMin >= 24 * 60) return ['00:00', '23:59'];
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // A time after the last tick goes out at it.
  return [hhmm(Math.max(0, clock.minutes - windowMin)), clock.minutes >= LAST_TICK ? '23:59' : hhmm(clock.minutes)];
}

/**
 * The tidy-up, on the first tick of each hour (24 a day, no retention here is finer than a day), from the retention list in shared (`RETENTION`, `RETENTION_DAYS`): old outbox mail, spent password links, the raw text
 * of old payment messages, old tracked-link clicks, and the records of data requests and copyright notices once their time is up. Every statement here must
 * find its rows through an index, or a quiet tick reads whole tables (migration 0114). One batch, so one round trip.
 */
export async function tidyOld(db: D1Database): Promise<void> {
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  await db.batch([
    db.prepare('DELETE FROM email_outbox WHERE created_at < ?').bind(ago(RETENTION_DAYS.outbox)),
    db.prepare('DELETE FROM password_resets WHERE (used_at IS NOT NULL AND used_at < ?) OR expires_at < ?').bind(ago(RETENTION_DAYS.resets), ago(RETENTION_DAYS.resets)),
    db.prepare("UPDATE webhook_events SET payload = '' WHERE received_at < ? AND payload != ''").bind(ago(RETENTION_DAYS.webhooks)),
    db.prepare('DELETE FROM link_clicks WHERE created_at < ?').bind(ago(RETENTION_DAYS.clicks)),
    db.prepare('DELETE FROM channel_messages WHERE created_at < ?').bind(ago(RETENTION_DAYS.channelLines)),
    // A run's discussion is a channel for that run: its lines are kept as long as a channel's.
    db.prepare('DELETE FROM run_messages WHERE created_at < ?').bind(ago(RETENTION_DAYS.channelLines)),
    // A cohort's discussion is kept as long as a channel's lines, a whole thread at a time once its newest line is that old, so a
    // newer reply is never left without the post or the line it hangs from.
    db.prepare('DELETE FROM cohort_talk WHERE thread_id IN (SELECT thread_id FROM cohort_talk GROUP BY thread_id HAVING MAX(created_at) < ?)').bind(ago(RETENTION_DAYS.channelLines)),
    db.prepare('DELETE FROM agency_password_requests WHERE closed_at IS NOT NULL AND closed_at < ?').bind(ago(RETENTION_DAYS.passwordRequests)),
    // The waitlist (2026-11-10), each through idx_waitlist_decided or idx_waitlist_status: a no after 180 days, an unanswered row after a
    // year, and an invited or joined row thirty days after its code was used, ran out or was taken back (the code is read by its key).
    db.prepare("DELETE FROM waitlist WHERE status = 'declined' AND decided_at < ?").bind(ago(RETENTION_DAYS.waitlistDeclined)),
    db.prepare("DELETE FROM waitlist WHERE status = 'waiting' AND created_at < ?").bind(ago(RETENTION_DAYS.waitlistWaiting)),
    db
      .prepare("DELETE FROM waitlist WHERE status IN ('invited', 'joined') AND (EXISTS (SELECT 1 FROM invite_codes i WHERE i.id = waitlist.invite_id AND (i.used_at < ?1 OR i.expires_at < ?1 OR i.revoked_at < ?1)) OR (invite_id IS NULL AND decided_at < ?1))")
      .bind(ago(RETENTION_DAYS.waitlistSettled)),
    db.prepare('DELETE FROM data_requests WHERE requested_at < ?').bind(ago(RETENTION_DAYS.requests)),
    db.prepare("DELETE FROM copyright_notices WHERE status != 'new' AND COALESCE(resolved_at, created_at) < ?").bind(ago(RETENTION_DAYS.notices)),
    // A limit's count only matters inside its window (a day at most). Sign-in counts are keyed by the email typed, so they do not stay.
    db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(Math.floor(Date.now() / 1000) - RETENTION_DAYS.rateLimits * 86_400),
    // A water note from the Worker before 2026-11-07: if an even hour falls between `pnpm db:migrate` and `pnpm deploy`, it writes one back after 0112 ran. A range on the primary key, so no rows are read unless there is one.
    db.prepare("DELETE FROM notifications WHERE id >= 'water-' AND id < 'water.'"),
    // A note written to an account after it was deleted (a sale, a reply, a sequence) has nobody to read it, and names other people.
    db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE display_name = 'Deleted member' AND handle IS NULL)"),
    // Lines, visitor timings and sign-out notices past their time.
    db.prepare('DELETE FROM app_logs WHERE at < ?').bind(ago(LOG_KEEP_DAYS)),
    db.prepare('DELETE FROM web_vitals WHERE created_at < ?').bind(ago(VITALS_KEEP_DAYS)),
    db.prepare('DELETE FROM session_evictions WHERE created_at < ?').bind(ago(30)),
    // Sessions past their twelve hours and links retired a year ago. The session checks read the expiry themselves; this only clears the rows.
    db.prepare('DELETE FROM portal_sessions WHERE expires_at <= ?').bind(nowIso()),
    db.prepare('DELETE FROM team_link_sessions WHERE expires_at <= ?').bind(nowIso()),
    db.prepare('DELETE FROM retired_portal_links WHERE retired_at < ?').bind(ago(365)),
    db.prepare('DELETE FROM retired_coach_invites WHERE retired_at < ?').bind(ago(365)),
    // Circles are marked done two days after they met.
    db.prepare("UPDATE circle_events SET status = 'done' WHERE status IN ('open','matched') AND starts_at < ?").bind(ago(2)),
  ]);
}

/** Supplement reminders (`supp-<user>-<time>-<day>`) from a day that is over are deleted from the inbox, read or not: each person's own day decides, so nobody's note goes early or lingers. */
export async function clearPastSupplementNotes(db: D1Database, turn: Turn): Promise<number> {
  const rows = await db.prepare("SELECT n.id, u.timezone FROM notifications n JOIN users u ON u.id = n.user_id WHERE n.id >= 'supp-' AND n.id < 'supp.'").all<{ id: string; timezone: string | null }>();
  const now = new Date();
  const gone = rows.results.filter((r) => {
    const today = localNow(r.timezone || DEFAULT_ZONE, now)?.day;
    return today !== undefined && pastSupplementNote(r.id, today);
  });
  if (!gone.length) return 0;
  const share = await turn();
  await share.send(share.fit(gone, 1).map((r) => db.prepare('DELETE FROM notifications WHERE id = ?').bind(r.id)));
  return gone.length;
}

/**
 * The person's own reminders, as inbox notices at the right local time: each goes once on each of its days, within an hour after its
 * time. Nothing is sent for a reminder turned off. Water sends no note (the founder, 2026-11-07: "remove notifications for water from inbox").
 * In India only the reminders whose time can be due now are read; a person elsewhere is read every tick and held to their own clock here.
 */
async function sendCustomReminders(when: When, turn: Turn): Promise<number> {
  const { db, now, windowMin } = when;
  const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const [from, to] = indiaTimes(when);
  const custom = await db
    .prepare(
      `SELECT r.id, r.user_id, r.title, r.time, r.days_json, r.last_sent_day, u.timezone FROM custom_reminders r JOIN users u ON u.id = r.user_id
       WHERE r.enabled = 1 AND r.time >= ? AND r.time <= ? AND u.timezone IN ${INDIA}
       UNION ALL
       SELECT r.id, r.user_id, r.title, r.time, r.days_json, r.last_sent_day, u.timezone FROM users u CROSS JOIN custom_reminders r ON r.user_id = u.id
       WHERE u.timezone NOT IN ${INDIA} AND r.enabled = 1`,
    )
    .bind(from, to)
    .all<{ id: string; user_id: string; title: string; time: string; days_json: string; last_sent_day: string | null; timezone: string }>();
  const due: { id: string; userId: string; title: string; day: string }[] = [];
  for (const r of custom.results) {
    const at = localNow(r.timezone || DEFAULT_ZONE, now);
    if (!at) continue;
    if (r.last_sent_day === at.day) continue;
    let days: number[] = [];
    try {
      days = JSON.parse(r.days_json) as number[];
    } catch {
      continue;
    }
    const since = at.minutes - Math.min(mins(r.time), LAST_TICK);
    if (!days.includes(at.weekday) || since < 0 || since > windowMin) continue;
    due.push({ id: r.id, userId: r.user_id, title: r.title, day: at.day });
  }
  if (!due.length) return 0;
  const share = await turn();
  const fits = share.fit(due, 2);
  // The note and the mark go together, and the note's id holds the day, so a stop between batches can never send one twice.
  await share.send(
    fits.flatMap((r) => [
      // It opens Home's Water and reminders card on its Reminders panel, where the reminder is changed or paused.
      noteStmt(db, { id: `custom-${r.id}-${r.day}`, userId: r.userId, kind: 'reminder', title: r.title, body: 'Your own reminder.', link: '/home#reminders' }, 'once'),
      db.prepare('UPDATE custom_reminders SET last_sent_day = ? WHERE id = ?').bind(r.day, r.id),
    ]),
  );
  return fits.length;
}

/**
 * Tasks tagged Remember: one inbox line on the task's day (its do date, or its due date when it has none), at the task's time
 * (09:00 when it has none), within the hour after, in the person's zone. One per task per day (the id says so), never for a task
 * that is done or put away. The line names the task and its priority; nothing else leaves the pyramid.
 */
async function sendTaskReminders({ db, now, windowMin }: When, turn: Turn): Promise<number> {
  const rows = await db
    .prepare(
      `SELECT n.id, n.user_id, n.title, n.priority, n.do_date, n.due_date, n.due_time, u.timezone
       FROM nodes n JOIN users u ON u.id = n.user_id
       WHERE n.kind = 'task' AND n.status = 'active' AND n.remind = 1 AND COALESCE(n.do_date, n.due_date) BETWEEN ? AND ?
         AND NOT EXISTS (SELECT 1 FROM notifications x WHERE x.id = 'task-' || n.id || '-' || COALESCE(n.do_date, n.due_date))
       LIMIT 2000`,
    )
    .bind(new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10), new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10))
    .all<{ id: string; user_id: string; title: string; priority: number | null; do_date: string | null; due_date: string | null; due_time: string | null; timezone: string }>();
  const due = rows.results.flatMap((t) => {
    const clock = localNow(t.timezone || DEFAULT_ZONE, now);
    if (!clock || (t.do_date ?? t.due_date) !== clock.day) return [];
    const at = t.due_time ?? '09:00';
    const since = clock.minutes - Math.min(Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5)), LAST_TICK);
    return since < 0 || since > windowMin ? [] : [{ t, day: clock.day }];
  });
  if (!due.length) return 0;
  const share = await turn();
  const sent = await share.send(
    share.fit(due, 1).map(({ t, day }) => {
      const tag = t.priority === null ? '' : `P${t.priority} `;
      // The note opens Daily on this task, with its plan open, so the inbox line and the Remember tag are one thing.
      return noteStmt(
        db,
        { id: `task-${t.id}-${day}`, userId: t.user_id, kind: 'reminder', title: `Remember: ${t.title}`.slice(0, 160), body: `${tag}Planned for today${t.due_date && t.do_date ? `, due ${t.due_date}` : ''}. Tap to open it.`.trim(), link: `/today?task=${t.id}` },
        'once',
      );
    }),
  );
  return changed(sent);
}

/** How many of a batch's writes changed a row: an `INSERT OR IGNORE` that met its id counts nothing. */
const changed = (results: readonly D1Result[]) => results.filter((r) => r.meta.changes).length;

/**
 * The optional daily focus nudge (FocusSettings.reminderTime and reminderDays, off until set under Timer settings): one inbox note a day
 * (id `focus-<user>-<day>`, so it goes once), on the chosen days, within an hour after the time in the person's zone (a time after the last
 * tick goes out at it), linking to Mindfulness, and never on a day that already has a focus session.
 */
async function sendFocusReminders({ db, now, windowMin }: When, turn: Turn): Promise<number> {
  const rows = await db
    .prepare("SELECT p.user_id, p.settings_json, u.timezone FROM focus_prefs p JOIN users u ON u.id = p.user_id WHERE json_extract(p.settings_json, '$.reminderTime') IS NOT NULL LIMIT 5000")
    .all<{ user_id: string; settings_json: string; timezone: string | null }>();
  const due: { userId: string; localDay: string; goalMinutes: number | null | undefined }[] = [];
  for (const r of rows.results) {
    const s = parseFocusSettings(r.settings_json);
    if (!s.reminderTime || s.reminderDays.length === 0) continue;
    const zone = r.timezone || DEFAULT_ZONE;
    const clock = localNow(zone, now);
    if (!clock) continue;
    const localDay = clock.day;
    // 1 for Monday to 7 for Sunday, from the person's own day.
    if (!s.reminderDays.includes(clock.weekday)) continue;
    const at = zonedToUtc(localDay, Math.min(Number(s.reminderTime.slice(0, 2)) * 60 + Number(s.reminderTime.slice(3, 5)), LAST_TICK), zone);
    const since = now.getTime() - at.getTime();
    if (since < 0 || since > windowMin * 60_000) continue;
    due.push({ userId: r.user_id, localDay, goalMinutes: s.goalMinutes });
  }
  if (!due.length) return 0;
  const noteId = (d: { userId: string; localDay: string }) => `focus-${d.userId}-${d.localDay}`;
  const there = await notesThere(db, due.map(noteId));
  const fresh = due.filter((d) => !there.has(noteId(d)));
  if (!fresh.length) return 0;
  // Who already focused today, a day at a time (a zone or two), then the notes for the rest. Asked before anything is held to the budget, so someone who
  // needs no note never takes a place from someone who does.
  const focused = new Set<string>();
  const days = [...new Set(fresh.map((d) => d.localDay))];
  await Promise.all(
    days.flatMap((day) =>
      inGroups(fresh.filter((d) => d.localDay === day).map((d) => d.userId)).map(async (ids) => {
        const res = await db.prepare(`SELECT DISTINCT user_id, day FROM focus_rounds WHERE day = ? AND user_id IN (${marks(ids.length)})`).bind(day, ...ids).all<{ user_id: string; day: string }>();
        for (const r of res.results) focused.add(`${r.user_id}|${r.day}`);
      }),
    ),
  );
  const need = fresh.filter((d) => !focused.has(`${d.userId}|${d.localDay}`));
  if (!need.length) return 0;
  const share = await turn();
  const writes = share
    .fit(need, 1)
    .map((d) =>
      noteStmt(
        db,
        { id: noteId(d), userId: d.userId, kind: 'reminder', title: 'Time to focus', body: d.goalMinutes ? `Your goal is ${d.goalMinutes} minutes today. One session gets you started.` : 'One focus session today. Pick a task and press Start.', link: '/mindful' },
        'once',
      ),
    );
  return changed(await share.send(writes));
}

/**
 * Supplement reminders (Fitness, migration 0104), off until the person sets a time for a part of the day: one inbox line per person, part
 * of the day and day (id `supp-<user>-<time>-<day>`, so once), within an hour after that time in the person's zone, only while Track
 * supplements and Fitness are on, and only when something of that part is on the list that day and not all of it is ticked. It names how
 * many, never what; no follow-up, and a past day's line is cleared (`clearPastSupplementNotes`).
 */
async function sendSupplementReminders({ db, now, windowMin }: When, turn: Turn): Promise<number> {
  const rows = await db
    .prepare("SELECT p.user_id, p.remind_json, p.supplements_daily, u.timezone FROM fitness_prefs p JOIN users u ON u.id = p.user_id WHERE p.supplements_on = 1 AND p.remind_json != '{}' LIMIT 5000")
    .all<{ user_id: string; remind_json: string; supplements_daily: number; timezone: string | null }>();
  const due: { userId: string; day: string; time: SupplementTime; daily: boolean }[] = [];
  for (const r of rows.results) {
    let raw: unknown = {};
    try {
      raw = JSON.parse(r.remind_json);
    } catch {
      continue;
    }
    const s = parseSupplementSettings({ on: true, remind: raw });
    if (typeof s === 'string') continue;
    const clock = localNow(r.timezone || DEFAULT_ZONE, now);
    if (!clock) continue;
    for (const [time, at] of Object.entries(s.remind)) {
      if (!isSupplementTime(time) || !at) continue;
      const since = clock.minutes - Math.min(Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5)), LAST_TICK);
      if (since < 0 || since > windowMin) continue;
      due.push({ userId: r.user_id, day: clock.day, time, daily: r.supplements_daily === 1 });
    }
  }
  if (!due.length) return 0;
  const noteId = (d: { userId: string; day: string; time: SupplementTime }) => supplementNoteId(d.userId, d.time, d.day);
  const there = await notesThere(db, due.map(noteId));
  const fresh = due.filter((d) => !there.has(noteId(d)));
  if (!fresh.length) return 0;
  // Each one's list for that part of the day and what is ticked, a day and a part of the day at a time, and who has Fitness on. Asked before anything is held to
  // the budget, so someone who needs no note never takes a place from someone who does.
  const lists = new Map<string, { id: string; days_json: string; paused_at: string | null; taken: number }[]>();
  const groups = [...new Set(fresh.map((d) => `${d.day}|${d.time}`))];
  const [fitnessOn] = await Promise.all([
    appOnFor(db, 'fitness', fresh.map((d) => d.userId)),
    ...groups.flatMap((g) => {
      const [day, time] = g.split('|') as [string, SupplementTime];
      return inGroups(fresh.filter((d) => d.day === day && d.time === time).map((d) => d.userId)).map(async (ids) => {
        const res = await db
          .prepare(`SELECT s.user_id, s.id, s.days_json, s.paused_at, (SELECT COUNT(*) FROM supplement_days t WHERE t.supplement_id = s.id AND t.day = ?) AS taken FROM supplements s WHERE s.time_of_day = ? AND s.user_id IN (${marks(ids.length)})`)
          .bind(day, time, ...ids)
          .all<{ user_id: string; id: string; days_json: string; paused_at: string | null; taken: number }>();
        for (const r of res.results) {
          const key = `${r.user_id}|${g}`;
          lists.set(key, [...(lists.get(key) ?? []), r]);
        }
      });
    }),
  ]);
  const need: { d: (typeof fresh)[number]; total: number; left: number }[] = [];
  for (const d of fresh) {
    const items = (lists.get(`${d.userId}|${d.day}|${d.time}`) ?? []).filter((x) => {
      let days: number[] = [];
      try {
        days = JSON.parse(x.days_json) as number[];
      } catch {
        days = [];
      }
      return supplementDue({ days: Array.isArray(days) ? days : [], paused: x.paused_at !== null }, d.day);
    });
    const left = items.filter((x) => !x.taken).length;
    if (!items.length || left === 0) continue;
    if (!fitnessOn.has(d.userId)) continue;
    need.push({ d, total: items.length, left });
  }
  if (!need.length) return 0;
  const share = await turn();
  const writes = share.fit(need, 1).map(({ d, total, left }) => {
    const name = SUPPLEMENT_TIME_META[d.time].name;
    return noteStmt(
      db,
      { id: noteId(d), userId: d.userId, kind: 'reminder', title: `${name === 'With a meal' ? 'Supplements with a meal' : `${name} supplements`}: ${total} on your list`, body: left === total ? 'Tap to mark them taken.' : `${left} not marked yet. Tap to mark them.`, link: d.daily ? '/today#supplements' : '/fitness#supplements' },
      'once',
    );
  });
  return changed(await share.send(writes));
}

/**
 * The daily reminder: a person sets a time under Inbox, in their own zone. Each run looks at everyone with a
 * time that can be due, works out today's instant for it in their zone, and drops one reminder into the inbox when that
 * instant has passed in the last hour and they have not checked in today. One a day, never more: the note's id is
 * `checkin-<user>-<day>`, and Daily's own nudge (`daily-<user>-<day>`, routes/today.ts) written since the time counts as sent.
 * Both are looked up by id, never by kind, since your own reminders, tasks, focus and reviews are reminders too.
 */
async function sendReminders(when: When, turn: Turn): Promise<number> {
  const { db, now, windowMin } = when;
  const [from, to] = indiaTimes(when);
  const rows = await db
    .prepare(
      `SELECT id, reminder_time, timezone, last_checkin FROM users WHERE reminder_time IS NOT NULL AND timezone IN ${INDIA} AND reminder_time >= ? AND reminder_time <= ?
       UNION ALL
       SELECT id, reminder_time, timezone, last_checkin FROM users WHERE timezone NOT IN ${INDIA} AND reminder_time IS NOT NULL AND reminder_time != ''`,
    )
    .bind(from, to)
    .all<{ id: string; reminder_time: string; timezone: string; last_checkin: string | null }>();
  const due: { userId: string; at: Date; day: string }[] = [];
  for (const u of rows.results) {
    const zone = u.timezone || DEFAULT_ZONE;
    const [h, m] = u.reminder_time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    const clock = localNow(zone, now);
    if (!clock) continue;
    const localDay = clock.day;
    if (u.last_checkin === localDay) continue;
    const at = zonedToUtc(localDay, Math.min((h ?? 0) * 60 + (m ?? 0), LAST_TICK), zone);
    const since = now.getTime() - at.getTime();
    if (since < 0 || since > windowMin * 60_000) continue;
    due.push({ userId: u.id, at, day: localDay });
  }
  if (!due.length) return 0;
  // Who already had today's check-in note (or Daily's nudge since their time), then the notes for the rest.
  const there = await notesThere(db, due.flatMap((d) => [`checkin-${d.userId}-${d.day}`, `daily-${d.userId}-${d.day}`]));
  const fresh = due.filter((d) => {
    const nudged = there.get(`daily-${d.userId}-${d.day}`);
    return !there.has(`checkin-${d.userId}-${d.day}`) && !(nudged && nudged >= d.at.toISOString());
  });
  if (!fresh.length) return 0;
  const share = await turn();
  const writes = share
    .fit(fresh, 1)
    .map((d) => noteStmt(db, { id: `checkin-${d.userId}-${d.day}`, userId: d.userId, kind: 'reminder', title: 'Time to check in', body: 'Three boxes on Daily. The first one keeps your streak.', link: '/today' }, 'once'));
  return (await share.send(writes)).length;
}

/**
 * Scheduled reviews: on the day and at the time a person chose, in their own zone, one inbox note says it is time, links to the period it
 * covers (the one that just ended on the first day of a period) and says how many tasks they brought to it. `next_on` is moved on to the next
 * day the rule falls on, in the same batch as the note, so each day is sent once. A day that was missed while nothing ran is skipped, never sent late.
 */
async function sendReviewReminders({ db, now, windowMin }: When, turn: Turn): Promise<number> {
  const soon = new Date(now.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .prepare(
      `SELECT s.id, s.user_id, s.kind, s.name, s.anchor, s.time, s.repeat_json, s.next_on, u.timezone
       FROM review_schedules s JOIN users u ON u.id = s.user_id
       WHERE s.enabled = 1 AND s.next_on IS NOT NULL AND s.next_on <= ? LIMIT 500`,
    )
    .bind(soon)
    .all<{ id: string; user_id: string; kind: PeriodKind; name: string; anchor: string; time: string; repeat_json: string | null; next_on: string; timezone: string }>();
  const notes: { r: (typeof rows.results)[number]; day: string; zone: string }[] = [];
  const moves: D1PreparedStatement[] = [];
  const nextOn = (next: string | null, id: string) => db.prepare('UPDATE review_schedules SET next_on = ? WHERE id = ?').bind(next, id);
  for (const r of rows.results) {
    const zone = r.timezone || DEFAULT_ZONE;
    const clock = localNow(zone, now);
    if (!clock) continue;
    const { day } = clock;
    const repeat = parseRepeat(r.repeat_json);
    if (r.next_on < day) {
      // Missed while nothing ran: move on to the next one without sending it late.
      moves.push(nextOn(nextOnOrAfter(r.anchor, repeat, day), r.id));
      continue;
    }
    if (r.next_on !== day) continue;
    const since = clock.minutes - Math.min(Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3, 5)), LAST_TICK);
    if (since < 0) continue;
    if (since <= windowMin) notes.push({ r, day, zone });
    else moves.push(nextOn(repeat ? nextOccurrence(repeat, r.anchor, day) : null, r.id));
  }
  if (!notes.length && !moves.length) return 0;
  const share = await turn();
  await share.send(moves);
  // One read and two writes each: how many tasks wait in it, the note, and the move to the next day.
  const fits = share.fit(notes, 3);
  const periods = fits.map(({ r, day }) => reviewPeriodFor(r.kind, day, r.time));
  const waiting = await Promise.all(fits.map(({ r, day, zone }, i) => flaggedFor(db, r.user_id, periods[i]!, { zone, localToday: day })));
  const results = await share.send(
    fits.flatMap(({ r, day }, i) => {
      // A daily review's reminder opens the day before when it is set before noon, else that day (`reviewPeriodFor` with its time).
      const period = periods[i]!;
      const count = waiting[i]!.length;
      // The review's own name: a half's says which part it is (the mid-year check-in in July, the start-of-year setting in January).
      const name = reviewNameFor(period);
      const repeat = parseRepeat(r.repeat_json);
      return [
        noteStmt(
          db,
          { id: `review-${r.id}-${day}`, userId: r.user_id, kind: 'reminder', title: `${r.name || name} is due`.slice(0, 160), body: `${count > 0 ? `${count} ${count === 1 ? 'task is' : 'tasks are'} waiting in it. ` : ''}Tap to look back and write it.`, link: `/reviews?kind=${r.kind}&date=${period.start}#review-heading` },
          'once',
        ),
        nextOn(repeat ? nextOccurrence(repeat, r.anchor, day) : null, r.id),
      ];
    }),
  );
  return results.filter((res, i) => i % 2 === 0 && res.meta.changes).length;
}

type LocalClock = { day: string; minutes: number; weekday: number };
/** One formatter per zone: building an Intl.DateTimeFormat is the slow part (ten times the rest), and these scans read every person. Null for a zone the runtime does not know. */
const CLOCK_FORMATS = new Map<string, Intl.DateTimeFormat | null>();
function clockFormat(zone: string): Intl.DateTimeFormat | null {
  let fmt = CLOCK_FORMATS.get(zone);
  if (fmt === undefined) {
    try {
      fmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    } catch {
      fmt = null;
    }
    CLOCK_FORMATS.set(zone, fmt);
  }
  return fmt;
}
/** Each scan asks about one instant, for most people in one zone, so the answer is kept for that instant. */
let clocksAt = -1;
const CLOCKS = new Map<string, LocalClock | null>();

/**
 * The person's own day, minute of the day and weekday (1 for Monday to 7 for Sunday) in their zone, or null when the zone is not one
 * the runtime knows. The one clock every reminder in this file reads.
 */
function localNow(zone: string, now: Date): LocalClock | null {
  if (now.getTime() !== clocksAt) {
    clocksAt = now.getTime();
    CLOCKS.clear();
  }
  const kept = CLOCKS.get(zone);
  if (kept !== undefined) return kept;
  let clock: LocalClock | null = null;
  const parts = clockFormat(zone)?.formatToParts(now);
  if (parts) {
    const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
    const day = `${get('year')}-${get('month')}-${get('day')}`;
    clock = { day, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1 };
  }
  CLOCKS.set(zone, clock);
  return clock;
}

/** The morning time an invoice note goes out, in the owner's zone. */
export const INVOICE_NOTE_TIME = 9 * 60;
/** A late note that was missed while nothing ran still goes within this many days of the due day, never for an invoice long past. */
const INVOICE_LATE_REACH = 7;

/**
 * Invoices the person sent and nobody has paid: one inbox note on the due day and one on the first day after it ("past due"), from 09:00 in
 * the owner's zone. The ids `invoice-<id>-due` and `invoice-<id>-late` make each one once, however often the cron runs. An agency invoice
 * is noted only while Agency is on for its owner and lands in the Agency tab; the note names the number, the client and the amount, and
 * goes to the owner only. A paid, void or draft invoice is never noted.
 */
async function sendInvoiceNotes({ db, now }: When, turn: Turn): Promise<number> {
  const back = new Date(now.getTime() - (INVOICE_LATE_REACH + 2) * 86_400_000).toISOString().slice(0, 10);
  const ahead = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .prepare(
      `SELECT i.id, i.user_id, i.number, i.due_date, i.total_cents, i.currency, i.agency_client_id, COALESCE(k.name, i.client_name) AS client, u.timezone
       FROM invoices i JOIN users u ON u.id = i.user_id LEFT JOIN agency_clients k ON k.id = i.agency_client_id AND k.user_id = i.user_id
       WHERE i.status = 'sent' AND i.due_date IS NOT NULL AND i.due_date >= ? AND i.due_date <= ? LIMIT 2000`,
    )
    .bind(back, ahead)
    .all<{ id: string; user_id: string; number: string; due_date: string; total_cents: number; currency: string; agency_client_id: string | null; client: string; timezone: string | null }>();
  const due = rows.results.flatMap((r) => {
    const at = localNow(r.timezone || DEFAULT_ZONE, now);
    if (!at || at.minutes < INVOICE_NOTE_TIME) return [];
    const late = r.due_date < at.day;
    if (!late && r.due_date !== at.day) return [];
    if (late && r.due_date < shiftDate(at.day, -INVOICE_LATE_REACH)) return [];
    return [{ r, late, noteId: `invoice-${r.id}-${late ? 'late' : 'due'}` }];
  });
  if (!due.length) return 0;
  const there = await notesThere(db, due.map((d) => d.noteId));
  const notSent = due.filter((d) => !there.has(d.noteId));
  const isAgencyOn = await appOnFor(db, 'agency', notSent.filter((d) => d.r.agency_client_id !== null).map((d) => d.r.user_id));
  const fresh = notSent.filter((d) => d.r.agency_client_id === null || isAgencyOn.has(d.r.user_id));
  if (!fresh.length) return 0;
  const share = await turn();
  const writes = share
    .fit(fresh, 1)
    .map(({ r, late, noteId }) => {
      const isAgency = r.agency_client_id !== null;
      const title = late ? `Invoice ${r.number} is past due` : `Invoice ${r.number} is due today`;
      const body = `${money(r.total_cents, r.currency)} from ${r.client || 'your client'}, due ${r.due_date}. ${late ? 'Send a reminder, or mark it paid if it came in.' : 'Mark it paid when it comes in.'}`;
      return noteStmt(db, { id: noteId, userId: r.user_id, kind: isAgency ? 'agency' : 'invoice', title: title.slice(0, 160), body: body.slice(0, 300), link: isAgency ? `/agency/invoices/${r.id}` : '/finance#owed-heading' }, 'once');
    });
  return changed(await share.send(writes));
}

/**
 * Agency pieces due today: one inbox line a person a day (id `agency-due-<user>-<day>`, so once however often the cron runs), from 09:00 in
 * the owner's zone, only while Agency is on for them, naming the piece and its client when there is one and the count when there are more.
 * A piece already approved or published, or a client that ended, is never counted. It links to that client's page, or the pipeline.
 * The same pieces sit on Daily (`agencyToday` in routes/today.ts) and in the calendar link, so it is one thing in three places.
 */
async function sendAgencyDueNotes({ db, now }: When, turn: Turn): Promise<number> {
  const from = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .prepare(
      `SELECT i.user_id, i.title, i.client_id, i.due_date, i.created_at, k.name AS client, u.timezone FROM agency_items i
       JOIN agency_clients k ON k.id = i.client_id AND k.user_id = i.user_id JOIN users u ON u.id = i.user_id
       WHERE i.stage NOT IN ('approved', 'published') AND i.due_date IS NOT NULL AND i.due_date >= ? AND i.due_date <= ? AND k.status != 'ended'
       LIMIT 3000`,
    )
    .bind(from, to)
    .all<{ user_id: string; title: string; client_id: string; due_date: string; created_at: string; client: string; timezone: string | null }>();
  // Sorted here, oldest piece first: only the pieces due within a day are read (`idx_agency_items_due`), not every piece of every person.
  rows.results.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const byUser = new Map<string, { day: string; items: { title: string; client_id: string; client: string }[] }>();
  for (const r of rows.results) {
    const at = localNow(r.timezone || DEFAULT_ZONE, now);
    if (!at || at.minutes < INVOICE_NOTE_TIME || r.due_date !== at.day) continue;
    const one = byUser.get(r.user_id) ?? { day: at.day, items: [] };
    one.items.push({ title: r.title, client_id: r.client_id, client: r.client });
    byUser.set(r.user_id, one);
  }
  if (!byUser.size) return 0;
  const noteId = (userId: string, day: string) => `agency-due-${userId}-${day}`;
  const there = await notesThere(db, [...byUser].map(([userId, { day }]) => noteId(userId, day)));
  const notSent = [...byUser].filter(([userId, { day }]) => !there.has(noteId(userId, day)));
  const isAgencyOn = await appOnFor(db, 'agency', notSent.map(([userId]) => userId));
  const fresh = notSent.filter(([userId]) => isAgencyOn.has(userId));
  if (!fresh.length) return 0;
  const share = await turn();
  const writes = share
    .fit(fresh, 1)
    .map(([userId, { day, items }]) => {
      const first = items[0]!;
      const oneClient = items.every((x) => x.client_id === first.client_id);
      const title = items.length === 1 ? `${first.title} is due today` : `${items.length} pieces are due today`;
      const body = items.length === 1 ? `For ${first.client}. Move it on in Agency, or change its due day.` : `${items.slice(0, 3).map((x) => `${x.title} (${x.client})`).join(', ')}${items.length > 3 ? ` and ${items.length - 3} more` : ''}.`;
      return noteStmt(db, { id: noteId(userId, day), userId, kind: 'agency', title: title.slice(0, 160), body: body.slice(0, 300), link: oneClient ? `/agency/${first.client_id}` : '/agency?tab=pipeline' }, 'once');
    });
  return changed(await share.send(writes));
}
