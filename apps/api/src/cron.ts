import type { Env } from './env';
import { nowIso } from './db';
import { runSequences } from './routes/growth';
import { runRecurring } from './routes/finance';
import { matchDueCircles, rollWeeklyCircles } from './routes/circles';
import { fetchMetrics } from './social';
import { closeSeason, sendEventReminders } from './engage';
import { zonedToUtc } from '@kreators/shared';

/** Every fifteen minutes: sequence messages, then fresh numbers for posts and reward submissions where a platform lets us read them. */
export async function runScheduled(env: Env): Promise<{ sequences: number; recurring: number; circles: number; weekly: number; content: number; submissions: number; reminders: number; events: number; season: number }> {
  const db = env.DB;
  const reminders = (await sendReminders(db)) + (await sendWaterAndCustom(db));
  const events = await sendEventReminders(db);
  const season = await closeSeason(db);
  const sequences = await runSequences(db);
  const recurring = await runRecurring(db);
  const circles = await matchDueCircles(db);
  const weekly = await rollWeeklyCircles(db);
  // Money orders nobody paid for within half an hour are closed so the product is buyable again.
  await db.prepare("UPDATE orders SET status = 'expired' WHERE status = 'pending' AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 minutes')").run();
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
  return { sequences, recurring, circles, weekly, content, submissions, reminders, events, season };
}

/**
 * The daily reminder: a person sets a time under Inbox, in their own zone. Each run looks at everyone with a
 * time, works out today's instant for it in their zone, and drops one reminder into the inbox when that
 * instant has passed in the last hour and they have not checked in today. One a day, never more.
 */
/**
 * Water and the person's own reminders, as inbox notices at the right local time. Water goes every few minutes the person
 * chose, inside their day, and only while the day's goal is not met, as one inbox line a day that each reminder rewrites; a custom reminder goes once on each of its days, within
 * an hour after its time. Nothing is sent to someone who switched water off or turned a reminder off.
 */
export async function sendWaterAndCustom(db: D1Database): Promise<number> {
  const now = new Date();
  let sent = 0;
  const notice = (userId: string, title: string, body: string) =>
    db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', ?, ?, '/today', NULL, ?)").bind(crypto.randomUUID(), userId, title, body, nowIso()).run();
  const local = (zone: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1 };
  };
  const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

  const water = await db
    .prepare('SELECT p.user_id, p.water_goal_ml, p.water_glass_ml, p.water_every_min, p.water_from, p.water_to, p.last_water_at, u.timezone FROM reminder_prefs p JOIN users u ON u.id = p.user_id WHERE p.water_on = 1')
    .all<{ user_id: string; water_goal_ml: number; water_glass_ml: number; water_every_min: number; water_from: string; water_to: string; last_water_at: string | null; timezone: string }>();
  for (const w of water.results) {
    let at;
    try {
      at = local(w.timezone || 'Asia/Kolkata');
    } catch {
      continue;
    }
    if (at.minutes < mins(w.water_from) || at.minutes > mins(w.water_to)) continue;
    if (w.last_water_at && now.getTime() - Date.parse(w.last_water_at) < w.water_every_min * 60_000) continue;
    const so = await db.prepare('SELECT COALESCE(SUM(ml), 0) AS ml FROM water_logs WHERE user_id = ? AND day = ?').bind(w.user_id, at.day).first<{ ml: number }>();
    const drunk = so?.ml ?? 0;
    if (drunk >= w.water_goal_ml) continue;
    // One water line per person per day: later reminders rewrite it (new count, back to unread, newest first) instead of piling up.
    await db
      .prepare(
        "INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', 'Time for some water', ?, '/today', NULL, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body, created_at = excluded.created_at, read_at = NULL",
      )
      .bind(`water-${w.user_id}-${at.day}`, w.user_id, `${Math.floor(drunk / w.water_glass_ml)} of ${Math.ceil(w.water_goal_ml / w.water_glass_ml)} glasses so far today. Tap to log one.`, nowIso())
      .run();
    await db.prepare('UPDATE reminder_prefs SET last_water_at = ? WHERE user_id = ?').bind(nowIso(), w.user_id).run();
    sent += 1;
  }

  const custom = await db
    .prepare('SELECT r.id, r.user_id, r.title, r.time, r.days_json, r.last_sent_day, u.timezone FROM custom_reminders r JOIN users u ON u.id = r.user_id WHERE r.enabled = 1')
    .all<{ id: string; user_id: string; title: string; time: string; days_json: string; last_sent_day: string | null; timezone: string }>();
  for (const r of custom.results) {
    let at;
    try {
      at = local(r.timezone || 'Asia/Kolkata');
    } catch {
      continue;
    }
    if (r.last_sent_day === at.day) continue;
    let days: number[] = [];
    try {
      days = JSON.parse(r.days_json) as number[];
    } catch {
      continue;
    }
    const since = at.minutes - mins(r.time);
    if (!days.includes(at.weekday) || since < 0 || since > 60) continue;
    await notice(r.user_id, r.title, 'Your own reminder.');
    await db.prepare('UPDATE custom_reminders SET last_sent_day = ? WHERE id = ?').bind(at.day, r.id).run();
    sent += 1;
  }
  return sent;
}

export async function sendReminders(db: D1Database): Promise<number> {
  const now = new Date();
  const rows = await db.prepare("SELECT id, reminder_time, timezone, last_checkin FROM users WHERE reminder_time IS NOT NULL AND reminder_time != ''").all<{ id: string; reminder_time: string; timezone: string; last_checkin: string | null }>();
  let sent = 0;
  for (const u of rows.results) {
    const zone = u.timezone || 'Asia/Kolkata';
    const [h, m] = u.reminder_time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    let localDay: string;
    try {
      localDay = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    } catch {
      continue;
    }
    if (u.last_checkin === localDay) continue;
    const due = zonedToUtc(localDay, (h ?? 0) * 60 + (m ?? 0), zone);
    const since = now.getTime() - due.getTime();
    if (since < 0 || since > 60 * 60_000) continue;
    const already = await db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'reminder' AND created_at >= ?").bind(u.id, due.toISOString()).first();
    if (already) continue;
    await db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'reminder', ?, ?, '/today', NULL, ?)").bind(crypto.randomUUID(), u.id, 'Time to check in', 'Three boxes on Daily. The first one keeps your streak.', nowIso()).run();
    sent += 1;
  }
  return sent;
}
