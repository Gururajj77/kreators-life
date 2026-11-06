import { releaseDeadOrders } from './discounts';
import type { Env } from './env';
import { getUser, inBatches, nowIso, shiftDate } from './db';
import { runSequences } from './routes/growth';
import { runRecurring } from './routes/finance';
import { matchDueCircles, rollWeeklyCircles } from './routes/circles';
import { fetchMetrics } from './social';
import { closeSeason, sendEventReminders } from './engage';
import { DEFAULT_ZONE, money, parseFocusSettings, RETENTION_DAYS, nextOccurrence, nextOnOrAfter, parseRepeat, pastWaterNote, PERIOD_META, reviewPeriodFor, zonedToUtc, type PeriodKind } from '@kreators/shared';
import { flaggedFor } from './routes/reviews';
import { securityAlerts } from './alerts';
import { runAgencyCycles } from './agencyCycles';
import { syncStageFromAgreements } from './lifecycle';
import { pruneExpiredPortalSessions, pruneRetiredPortalLinks } from './portalAccess';
import { pruneExpiredTeamLinkSessions } from './teamLinkAccess';
import { resolveAccess } from './access';

/** The cron runs every fifteen minutes, so 23:45 is the last tick of a day: a reminder set for 23:46 to 23:59 goes out then and not at 00:00, when its day has already turned over. */
const LAST_TICK = 23 * 60 + 45;

/** Every fifteen minutes: sequence messages, then fresh numbers for posts and reward submissions where a platform lets us read them. */
/** Water reminders have their own trigger, every two hours. The other trigger runs every fifteen minutes and leaves water alone. */
export const WATER_CRON = '0 */2 * * *';
export const MAIN_CRON = '*/15 * * * *';

export async function runScheduled(env: Env, cron: string = ''): Promise<{ sequences: number; recurring: number; circles: number; weekly: number; content: number; submissions: number; reminders: number; events: number; season: number; agency: number }> {
  const db = env.DB;
  // The two-hour trigger only sends water; the fifteen-minute one does everything else. Anything else (a test run by hand) does both.
  if (cron === WATER_CRON) {
    const water = await sendWaterAndCustom(db, { water: true, custom: false });
    return { sequences: 0, recurring: 0, circles: 0, weekly: 0, content: 0, submissions: 0, reminders: water, events: 0, season: 0, agency: 0 };
  }
  const reminders = (await sendReminders(db)) + (await sendWaterAndCustom(db, { water: cron !== MAIN_CRON, custom: true })) + (await sendTaskReminders(db)) + (await sendReviewReminders(db)) + (await sendInvoiceNotes(db).catch(() => 0)) + (await sendAgencyDueNotes(db).catch(() => 0)) + (await sendFocusReminders(db).catch(() => 0));
  await clearPastWaterNotes(db);
  await tidyOld(db);
  await securityAlerts(db).catch(() => 0);
  const events = await sendEventReminders(db);
  const season = await closeSeason(db);
  const sequences = await runSequences(db);
  const recurring = await runRecurring(db);
  // Agency: a retainer's months (each one's invoice and pieces, once), clients whose agreement moved, and client-link sessions past twelve hours.
  const agencyMade = await runAgencyCycles(db).catch(() => 0);
  await syncStageFromAgreements(db).catch(() => 0);
  await pruneExpiredPortalSessions(db).catch(() => undefined);
  await pruneExpiredTeamLinkSessions(db).catch(() => undefined);
  await pruneRetiredPortalLinks(db).catch(() => undefined);
  const circles = await matchDueCircles(db);
  const weekly = await rollWeeklyCircles(db);
  // Money orders nobody paid for within half an hour are closed so the product is buyable again.
  await db.prepare("UPDATE orders SET status = 'expired' WHERE status = 'pending' AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 minutes')").run();
  // A discount code's use is given back when the order it was taken for failed or expired.
  await releaseDeadOrders(db).catch(() => 0);
  let content = 0;
  const stale = await db.prepare("SELECT id, url FROM content_items WHERE platform = 'youtube' AND (synced_at IS NULL OR synced_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 hours')) LIMIT 20").all<{ id: string; url: string }>();
  for (const item of stale.results) {
    const r = await fetchMetrics(item.url, env);
    if (!r.reading) break;
    await db.prepare('UPDATE content_items SET views = ?, likes = ?, comments = ?, synced_at = ? WHERE id = ?').bind(r.reading.views, r.reading.likes, r.reading.comments, nowIso(), item.id).run();
    content += 1;
  }
  let submissions = 0;
  const subs = await db
    .prepare("SELECT s.id, s.url FROM bounty_submissions s WHERE s.platform = 'youtube' AND s.status IN ('submitted','verified') AND NOT EXISTS (SELECT 1 FROM social_metrics m WHERE m.submission_id = s.id AND m.source = 'auto' AND m.fetched_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 hours')) LIMIT 20")
    .all<{ id: string; url: string }>();
  for (const s of subs.results) {
    const r = await fetchMetrics(s.url, env);
    if (!r.reading) break;
    const now = nowIso();
    await db.batch([
      db.prepare('INSERT INTO social_metrics (id, submission_id, views, likes, comments, shares, source, note, recorded_by, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)').bind(crypto.randomUUID(), s.id, r.reading.views, r.reading.likes, r.reading.comments, 0, 'auto', r.why, now),
      db.prepare('UPDATE bounty_submissions SET latest_views = ?, latest_engagement = ?, updated_at = ? WHERE id = ?').bind(r.reading.views, r.reading.likes + r.reading.comments, now, s.id),
    ]);
    submissions += 1;
  }
  return { sequences, recurring, circles, weekly, content, submissions, reminders, events, season, agency: agencyMade };
}

/**
 * The daily tidy-up, from the retention list in shared (`RETENTION`, `RETENTION_DAYS`): old outbox mail, spent password links, the raw text of
 * old payment messages, old tracked-link clicks, and the records of data requests and copyright notices once their time is up.
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
    db.prepare('DELETE FROM data_requests WHERE requested_at < ?').bind(ago(RETENTION_DAYS.requests)),
    db.prepare("DELETE FROM copyright_notices WHERE status != 'new' AND COALESCE(resolved_at, created_at) < ?").bind(ago(RETENTION_DAYS.notices)),
  ]);
}

/** Water reminders from a day that is over are deleted from the inbox, read or not: each person's own day decides, so nobody's note goes early or lingers. */
export async function clearPastWaterNotes(db: D1Database): Promise<number> {
  const rows = await db.prepare("SELECT n.id, u.timezone FROM notifications n JOIN users u ON u.id = n.user_id WHERE n.id >= 'water-' AND n.id < 'water.'").all<{ id: string; timezone: string | null }>();
  const days = new Map<string, string | null>();
  const dayIn = (zone: string) => {
    if (!days.has(zone)) {
      try {
        days.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
      } catch {
        days.set(zone, null);
      }
    }
    return days.get(zone) ?? null;
  };
  const gone = rows.results.filter((r) => {
    const today = dayIn(r.timezone || 'Asia/Kolkata');
    return today !== null && pastWaterNote(r.id, today);
  });
  await inBatches(db, gone.map((r) => db.prepare('DELETE FROM notifications WHERE id = ?').bind(r.id)));
  return gone.length;
}

/**
 * Water and the person's own reminders, as inbox notices at the right local time. Water goes every few minutes the person
 * chose, inside their day, and only while the day's goal is not met, as one inbox line a day that each reminder rewrites; a custom reminder goes once on each of its days, within
 * an hour after its time. Nothing is sent to someone who switched water off or turned a reminder off.
 */
export async function sendWaterAndCustom(db: D1Database, parts: { water: boolean; custom: boolean } = { water: true, custom: true }): Promise<number> {
  const now = new Date();
  let sent = 0;
  const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

  if (parts.water) {
    const water = await db
      .prepare('SELECT p.user_id, p.water_goal_ml, p.water_glass_ml, p.water_every_min, p.water_from, p.water_to, p.last_water_at, u.timezone FROM reminder_prefs p JOIN users u ON u.id = p.user_id WHERE p.water_on = 1')
      .all<{ user_id: string; water_goal_ml: number; water_glass_ml: number; water_every_min: number; water_from: string; water_to: string; last_water_at: string | null; timezone: string }>();
    const due: { w: (typeof water.results)[number]; day: string }[] = [];
    for (const w of water.results) {
      const at = localNow(w.timezone || 'Asia/Kolkata', now);
      if (!at) continue;
      if (at.minutes < mins(w.water_from) || at.minutes > mins(w.water_to)) continue;
      // A few minutes of slack: the tick two hours after the last one lands a few seconds before the two hours are up.
      if (w.last_water_at && now.getTime() - Date.parse(w.last_water_at) < (w.water_every_min - 5) * 60_000) continue;
      due.push({ w, day: at.day });
    }
    // What each of them drank today in one round trip, then every note and its time in another.
    const drunkRows = await inBatches<{ ml: number }>(db, due.map(({ w, day }) => db.prepare('SELECT COALESCE(SUM(ml), 0) AS ml FROM water_logs WHERE user_id = ? AND day = ?').bind(w.user_id, day)));
    const writes: D1PreparedStatement[] = [];
    due.forEach(({ w, day }, i) => {
      const drunk = drunkRows[i]?.results[0]?.ml ?? 0;
      if (drunk >= w.water_goal_ml) return;
      // One water line per person per day: later reminders rewrite it (new count, back to unread, newest first) instead of piling up.
      writes.push(
        db
          .prepare(
            "INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', 'Time for some water', ?, '/today', NULL, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body, created_at = excluded.created_at, read_at = NULL, archived_at = NULL",
          )
          .bind(`water-${w.user_id}-${day}`, w.user_id, `${Math.floor(drunk / w.water_glass_ml)} of ${Math.ceil(w.water_goal_ml / w.water_glass_ml)} glasses so far today. Tap to log one.`, nowIso()),
        db.prepare('UPDATE reminder_prefs SET last_water_at = ? WHERE user_id = ?').bind(nowIso(), w.user_id),
      );
      sent += 1;
    });
    await inBatches(db, writes);
  }

  if (parts.custom) {
    const custom = await db
      .prepare('SELECT r.id, r.user_id, r.title, r.time, r.days_json, r.last_sent_day, u.timezone FROM custom_reminders r JOIN users u ON u.id = r.user_id WHERE r.enabled = 1')
      .all<{ id: string; user_id: string; title: string; time: string; days_json: string; last_sent_day: string | null; timezone: string }>();
    const writes: D1PreparedStatement[] = [];
    for (const r of custom.results) {
      const at = localNow(r.timezone || 'Asia/Kolkata', now);
      if (!at) continue;
      if (r.last_sent_day === at.day) continue;
      let days: number[] = [];
      try {
        days = JSON.parse(r.days_json) as number[];
      } catch {
        continue;
      }
      const since = at.minutes - Math.min(mins(r.time), LAST_TICK);
      if (!days.includes(at.weekday) || since < 0 || since > 60) continue;
      writes.push(
        db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', ?, ?, '/today', NULL, ?)").bind(crypto.randomUUID(), r.user_id, r.title, 'Your own reminder.', nowIso()),
        db.prepare('UPDATE custom_reminders SET last_sent_day = ? WHERE id = ?').bind(at.day, r.id),
      );
      sent += 1;
    }
    await inBatches(db, writes);
  }
  return sent;
}

/**
 * Tasks tagged Remember: one inbox line on the task's day (its do date, or its due date when it has none), at the task's time
 * (09:00 when it has none), within the hour after, in the person's zone. One per task per day (the id says so), never for a task
 * that is done or put away. The line names the task and its priority; nothing else leaves the pyramid.
 */
export async function sendTaskReminders(db: D1Database): Promise<number> {
  const now = new Date();
  const rows = await db
    .prepare(
      `SELECT n.id, n.user_id, n.title, n.priority, n.do_date, n.due_date, n.due_time, u.timezone
       FROM nodes n JOIN users u ON u.id = n.user_id
       WHERE n.kind = 'task' AND n.status = 'active' AND n.remind = 1 AND COALESCE(n.do_date, n.due_date) BETWEEN ? AND ?
       LIMIT 2000`,
    )
    .bind(new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10), new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10))
    .all<{ id: string; user_id: string; title: string; priority: number | null; do_date: string | null; due_date: string | null; due_time: string | null; timezone: string }>();
  const writes: D1PreparedStatement[] = [];
  for (const t of rows.results) {
    const clock = localNow(t.timezone || 'Asia/Kolkata', now);
    if (!clock) continue;
    const { day } = clock;
    if ((t.do_date ?? t.due_date) !== day) continue;
    const at = t.due_time ?? '09:00';
    const since = clock.minutes - Math.min(Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5)), LAST_TICK);
    if (since < 0 || since > 60) continue;
    const tag = t.priority === null ? '' : `P${t.priority} `;
    writes.push(
      db
        .prepare("INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', ?, ?, ?, NULL, ?)")
        // The note opens Daily on this task, with its plan open, so the inbox line and the Remember tag are one thing.
        .bind(`task-${t.id}-${day}`, t.user_id, `Remember: ${t.title}`.slice(0, 160), `${tag}Planned for today${t.due_date && t.do_date ? `, due ${t.due_date}` : ''}. Tap to open it.`.trim(), `/today?task=${t.id}`, nowIso()),
    );
  }
  return changed(await inBatches(db, writes));
}

/** How many of a batch's writes changed a row: an `INSERT OR IGNORE` that met its id counts nothing. */
const changed = (results: readonly D1Result[]) => results.filter((r) => r.meta.changes).length;

/**
 * The optional daily focus nudge (FocusSettings.reminderTime and reminderDays, off until set under Timer settings): one inbox note a day
 * (id `focus-<user>-<day>`, so it goes once), on the chosen days, within an hour after the time in the person's zone (a time after the last
 * tick goes out at it), linking to Mindfulness, and never on a day that already has a focus session.
 */
export async function sendFocusReminders(db: D1Database): Promise<number> {
  const now = new Date();
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
    if (since < 0 || since > 60 * 60_000) continue;
    due.push({ userId: r.user_id, localDay, goalMinutes: s.goalMinutes });
  }
  // Who already focused today, in one round trip, then the notes for the rest in another.
  const focused = await inBatches(db, due.map((d) => db.prepare('SELECT 1 FROM focus_rounds WHERE user_id = ? AND day = ? LIMIT 1').bind(d.userId, d.localDay)));
  const writes = due
    .filter((_, i) => !focused[i]?.results[0])
    .map((d) =>
      db
        .prepare("INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', ?, ?, '/mindful', NULL, ?)")
        .bind(`focus-${d.userId}-${d.localDay}`, d.userId, 'Time to focus', d.goalMinutes ? `Your goal is ${d.goalMinutes} minutes today. One session gets you started.` : 'One focus session today. Pick a task and press Start.', nowIso()),
    );
  return changed(await inBatches(db, writes));
}

/**
 * The daily reminder: a person sets a time under Inbox, in their own zone. Each run looks at everyone with a
 * time, works out today's instant for it in their zone, and drops one reminder into the inbox when that
 * instant has passed in the last hour and they have not checked in today. One a day, never more.
 */
export async function sendReminders(db: D1Database): Promise<number> {
  const now = new Date();
  const rows = await db.prepare("SELECT id, reminder_time, timezone, last_checkin FROM users WHERE reminder_time IS NOT NULL AND reminder_time != ''").all<{ id: string; reminder_time: string; timezone: string; last_checkin: string | null }>();
  const due: { userId: string; at: Date }[] = [];
  for (const u of rows.results) {
    const zone = u.timezone || 'Asia/Kolkata';
    const [h, m] = u.reminder_time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    const clock = localNow(zone, now);
    if (!clock) continue;
    const localDay = clock.day;
    if (u.last_checkin === localDay) continue;
    const at = zonedToUtc(localDay, Math.min((h ?? 0) * 60 + (m ?? 0), LAST_TICK), zone);
    const since = now.getTime() - at.getTime();
    if (since < 0 || since > 60 * 60_000) continue;
    due.push({ userId: u.id, at });
  }
  // Who already had a reminder since their time, in one round trip, then the notes for the rest in another.
  const already = await inBatches(db, due.map((d) => db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'reminder' AND created_at >= ?").bind(d.userId, d.at.toISOString())));
  const writes = due
    .filter((_, i) => !already[i]?.results[0])
    .map((d) => db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', ?, ?, '/today', NULL, ?)").bind(crypto.randomUUID(), d.userId, 'Time to check in', 'Three boxes on Daily. The first one keeps your streak.', nowIso()));
  await inBatches(db, writes);
  return writes.length;
}

/**
 * Scheduled reviews: on the day and at the time a person chose, in their own zone, one inbox note says it is time, links to the period it
 * covers (the one that just ended on the first day of a period) and says how many tasks they brought to it. `next_on` is moved on to the next
 * day the rule falls on, so each day is sent once. A day that was missed while nothing ran is skipped, never sent late.
 */
export async function sendReviewReminders(db: D1Database): Promise<number> {
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .prepare(
      `SELECT s.id, s.user_id, s.kind, s.name, s.anchor, s.time, s.repeat_json, s.next_on, u.timezone
       FROM review_schedules s JOIN users u ON u.id = s.user_id
       WHERE s.enabled = 1 AND s.next_on IS NOT NULL AND s.next_on <= ? LIMIT 500`,
    )
    .bind(soon)
    .all<{ id: string; user_id: string; kind: PeriodKind; name: string; anchor: string; time: string; repeat_json: string | null; next_on: string; timezone: string }>();
  let sent = 0;
  for (const r of rows.results) {
    const clock = localNow(r.timezone || 'Asia/Kolkata', now);
    if (!clock) continue;
    const { day } = clock;
    const repeat = parseRepeat(r.repeat_json);
    const advance = async (from: string) => {
      const next = repeat ? nextOccurrence(repeat, r.anchor, from) : null;
      await db.prepare('UPDATE review_schedules SET next_on = ? WHERE id = ?').bind(next, r.id).run();
    };
    if (r.next_on < day) {
      // Missed while nothing ran: move on to the next one without sending it late.
      await db.prepare('UPDATE review_schedules SET next_on = ? WHERE id = ?').bind(nextOnOrAfter(r.anchor, repeat, day), r.id).run();
      continue;
    }
    if (r.next_on !== day) continue;
    const since = clock.minutes - Math.min(Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3, 5)), LAST_TICK);
    if (since < 0) continue;
    if (since <= 60) {
      const period = reviewPeriodFor(r.kind, day);
      const waiting = (await flaggedFor(db, r.user_id, period)).length;
      const name = PERIOD_META[r.kind].name;
      const res = await db
        .prepare("INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', ?, ?, ?, NULL, ?)")
        .bind(`review-${r.id}-${day}`, r.user_id, `${r.name || name} is due`.slice(0, 160), `${waiting > 0 ? `${waiting} ${waiting === 1 ? 'task is' : 'tasks are'} waiting in it. ` : ''}Tap to look back and write it.`, `/reviews?kind=${r.kind}&date=${period.start}`, nowIso())
        .run();
      if (res.meta.changes) sent += 1;
    }
    await advance(day);
  }
  return sent;
}

/**
 * The person's own day, minute of the day and weekday (1 for Monday to 7 for Sunday) in their zone, or null when the zone is not one
 * the runtime knows. The one clock every reminder in this file reads.
 */
function localNow(zone: string, now: Date): { day: string; minutes: number; weekday: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
    const day = `${get('year')}-${get('month')}-${get('day')}`;
    return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1 };
  } catch {
    return null;
  }
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
export async function sendInvoiceNotes(db: D1Database, now: Date = new Date()): Promise<number> {
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
  const isAgencyOn = agencyOnFor(db);
  const writes: D1PreparedStatement[] = [];
  for (const r of rows.results) {
    const at = localNow(r.timezone || 'Asia/Kolkata', now);
    if (!at || at.minutes < INVOICE_NOTE_TIME) continue;
    const late = r.due_date < at.day;
    if (!late && r.due_date !== at.day) continue;
    if (late && r.due_date < shiftDate(at.day, -INVOICE_LATE_REACH)) continue;
    const isAgency = r.agency_client_id !== null;
    if (isAgency && !(await isAgencyOn(r.user_id))) continue;
    const title = late ? `Invoice ${r.number} is past due` : `Invoice ${r.number} is due today`;
    const body = `${money(r.total_cents, r.currency)} from ${r.client || 'your client'}, due ${r.due_date}. ${late ? 'Send a reminder, or mark it paid if it came in.' : 'Mark it paid when it comes in.'}`;
    writes.push(
      db
        .prepare('INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)')
        .bind(`invoice-${r.id}-${late ? 'late' : 'due'}`, r.user_id, isAgency ? 'agency' : 'invoice', title.slice(0, 160), body.slice(0, 300), isAgency ? `/agency/invoices/${r.id}` : '/finance', nowIso()),
    );
  }
  return changed(await inBatches(db, writes));
}

/** Whether Agency is on for a person (their switch, the team's flags), asked once per person per run. */
function agencyOnFor(db: D1Database): (userId: string) => Promise<boolean> {
  const seen = new Map<string, boolean>();
  return async (userId) => {
    if (!seen.has(userId)) {
      const u = await getUser(db, userId);
      seen.set(userId, u ? (await resolveAccess(db, u)).access.agency?.on === true : false);
    }
    return seen.get(userId) ?? false;
  };
}

/**
 * Agency pieces due today: one inbox line a person a day (id `agency-due-<user>-<day>`, so once however often the cron runs), from 09:00 in
 * the owner's zone, only while Agency is on for them, naming the piece and its client when there is one and the count when there are more.
 * A piece already approved or published, or a client that ended, is never counted. It links to that client's page, or the pipeline.
 * The same pieces sit on Daily (`agencyToday` in routes/today.ts) and in the calendar link, so it is one thing in three places.
 */
export async function sendAgencyDueNotes(db: D1Database, now: Date = new Date()): Promise<number> {
  const from = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .prepare(
      `SELECT i.user_id, i.title, i.client_id, i.due_date, k.name AS client, u.timezone FROM agency_items i
       JOIN agency_clients k ON k.id = i.client_id AND k.user_id = i.user_id JOIN users u ON u.id = i.user_id
       WHERE i.stage NOT IN ('approved', 'published') AND i.due_date >= ? AND i.due_date <= ? AND k.status != 'ended'
       ORDER BY i.user_id, i.created_at LIMIT 3000`,
    )
    .bind(from, to)
    .all<{ user_id: string; title: string; client_id: string; due_date: string; client: string; timezone: string | null }>();
  const byUser = new Map<string, { day: string; items: { title: string; client_id: string; client: string }[] }>();
  for (const r of rows.results) {
    const at = localNow(r.timezone || 'Asia/Kolkata', now);
    if (!at || at.minutes < INVOICE_NOTE_TIME || r.due_date !== at.day) continue;
    const one = byUser.get(r.user_id) ?? { day: at.day, items: [] };
    one.items.push({ title: r.title, client_id: r.client_id, client: r.client });
    byUser.set(r.user_id, one);
  }
  const isAgencyOn = agencyOnFor(db);
  const writes: D1PreparedStatement[] = [];
  for (const [userId, { day, items }] of byUser) {
    if (!(await isAgencyOn(userId))) continue;
    const first = items[0]!;
    const oneClient = items.every((x) => x.client_id === first.client_id);
    const title = items.length === 1 ? `${first.title} is due today` : `${items.length} pieces are due today`;
    const body = items.length === 1 ? `For ${first.client}. Move it on in Agency, or change its due day.` : `${items.slice(0, 3).map((x) => `${x.title} (${x.client})`).join(', ')}${items.length > 3 ? ` and ${items.length - 3} more` : ''}.`;
    writes.push(
      db
        .prepare("INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'agency', ?, ?, ?, NULL, ?)")
        .bind(`agency-due-${userId}-${day}`, userId, title.slice(0, 160), body.slice(0, 300), oneClient ? `/agency/${first.client_id}` : '/agency?tab=pipeline', nowIso()),
    );
  }
  return changed(await inBatches(db, writes));
}
