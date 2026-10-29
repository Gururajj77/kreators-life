import { EVENT_REMINDERS, previousSeason, SEASON_TOP, seasonLabel, seasonOf, seasonStart } from '@kreators/shared';
import { nowIso } from './db';

/**
 * Jobs the cron runs every fifteen minutes to keep people coming back for the right reasons: a reminder before an
 * event they signed up for, and the close of last month's leaderboard season.
 */

/** "Sat 18:30", in the person's own zone. */
function clockIn(iso: string, zone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: zone || 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString().slice(0, 22);
  }
}

interface Due {
  app: 'party' | 'circles' | 'run';
  thing_id: string;
  user_id: string;
  title: string;
  starts_at: string;
  timezone: string;
  link: string;
}

/**
 * Reminders before events: a day before and an hour before, each once per person and event (event_reminders keeps
 * them from doubling). Party: the people registered. Circles: the people seated at a table. Runs: the club's members,
 * never its host. Someone who signs up inside the last day gets only what is still ahead.
 */
export async function sendEventReminders(db: D1Database): Promise<number> {
  const now = Date.now();
  const until = new Date(now + EVENT_REMINDERS[0].before * 60_000).toISOString();
  const from = new Date(now).toISOString();
  const rows = await db
    .prepare(
      `SELECT 'party' AS app, e.id AS thing_id, r.user_id, e.title, e.starts_at, u.timezone, '/party/' || e.id AS link
         FROM events e JOIN event_registrations r ON r.event_id = e.id AND r.status = 'registered' JOIN users u ON u.id = r.user_id
         WHERE e.status = 'published' AND e.starts_at > ?1 AND e.starts_at <= ?2
       UNION ALL
       SELECT 'circles', e.id, m.user_id, e.title, e.starts_at, u.timezone, '/circles/' || g.id
         FROM circle_events e JOIN circle_groups g ON g.event_id = e.id JOIN circle_members m ON m.group_id = g.id JOIN users u ON u.id = m.user_id
         WHERE e.status IN ('open','matched') AND e.starts_at > ?1 AND e.starts_at <= ?2
       UNION ALL
       SELECT 'run', r.id, m.user_id, r.title, r.starts_at, u.timezone, '/run/clubs/' || r.club_id
         FROM runs r JOIN run_clubs k ON k.id = r.club_id JOIN run_members m ON m.club_id = r.club_id AND m.status = 'member' AND m.user_id != k.host_user_id JOIN users u ON u.id = m.user_id
         WHERE r.status = 'published' AND r.starts_at > ?1 AND r.starts_at <= ?2
       LIMIT 1000`,
    )
    .bind(from, until)
    .all<Due>();
  let sent = 0;
  for (const d of rows.results) {
    const minutesLeft = (Date.parse(d.starts_at) - now) / 60_000;
    // The nearest reminder that is due: the hour one inside the last hour, the day one before that.
    const due = minutesLeft <= EVENT_REMINDERS[1].before ? EVENT_REMINDERS[1] : EVENT_REMINDERS[0];
    const fresh = await db.prepare('INSERT OR IGNORE INTO event_reminders (app, thing_id, user_id, kind, sent_at) VALUES (?, ?, ?, ?, ?)').bind(d.app, d.thing_id, d.user_id, due.kind, nowIso()).run();
    if ((fresh.meta.changes ?? 0) === 0) continue;
    const kind = d.app === 'circles' ? 'circle' : d.app;
    const title = due.kind === 'hour' ? `In under an hour: ${d.title}` : `Coming up: ${d.title}`;
    await db.prepare('INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)').bind(crypto.randomUUID(), d.user_id, kind, title, `Starts ${clockIn(d.starts_at, d.timezone)}. You signed up.`, d.link, nowIso()).run();
    sent += 1;
  }
  return sent;
}

/**
 * Close last month's season once: keep its top three (xp earned in that month, among people on the leaderboard), give
 * each the Season top three honor, and tell them. A month nobody earned in closes with no results.
 */
export async function closeSeason(db: D1Database): Promise<number> {
  const season = previousSeason(seasonOf(nowIso()));
  const done = await db.prepare('INSERT OR IGNORE INTO seasons (season, closed_at) VALUES (?, ?)').bind(season, nowIso()).run();
  if ((done.meta.changes ?? 0) === 0) return 0;
  const top = await db
    .prepare(
      `SELECT u.id, SUM(x.amount) AS xp FROM xp_events x JOIN users u ON u.id = x.user_id
       WHERE x.created_at >= ? AND x.created_at < ? AND u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL
       GROUP BY u.id HAVING SUM(x.amount) > 0 ORDER BY xp DESC, u.created_at ASC LIMIT ?`,
    )
    .bind(seasonStart(season), seasonStart(seasonOf(nowIso())), SEASON_TOP)
    .all<{ id: string; xp: number }>();
  const now = nowIso();
  let place = 0;
  for (const r of top.results) {
    place += 1;
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO season_results (season, place, user_id, xp) VALUES (?, ?, ?, ?)').bind(season, place, r.id, r.xp),
      db.prepare("INSERT OR IGNORE INTO honors (user_id, honor_key, note, awarded_at) VALUES (?, 'season_top', ?, ?)").bind(r.id, `Top three in ${seasonLabel(season)}`, now),
      db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'season', ?, ?, '/leaderboard?by=season', NULL, ?)").bind(crypto.randomUUID(), r.id, `Number ${place} in ${seasonLabel(season)}`, 'You finished the season in the top three. The Season top three honor is on your page.', now),
    ]);
  }
  return place;
}
