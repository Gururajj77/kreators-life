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
  const reminders = await sendReminders(db);
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
