import { DEFAULT_ZONE, EVENT_REMINDERS, LOCALE, previousSeason, SEASON_TOP, seasonLabel, seasonOf, seasonStart } from '@kreators/shared';
import { noteStmt, nowIso } from './db';
import { openTurn, type Turn } from './cronTick';

/**
 * Jobs the cron runs every fifteen minutes to keep people coming back for the right reasons: a reminder before an
 * event they signed up for, and the close of last month's leaderboard season.
 */

const CLOCK_IN = new Map<string, Intl.DateTimeFormat>();
/** "Sat 18:30", in the person's own zone. One formatter per zone: building one is the slow part. */
function clockIn(iso: string, zone: string): string {
  try {
    const key = zone || DEFAULT_ZONE;
    let fmt = CLOCK_IN.get(key);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat(LOCALE, { timeZone: key, weekday: 'short', hour: '2-digit', minute: '2-digit' });
      CLOCK_IN.set(key, fmt);
    }
    return fmt.format(new Date(iso));
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
 * never its host. Someone who signs up inside the last day gets only what is still ahead. Only those not yet told of
 * the nearest reminder are read, so an event with a thousand guests costs nothing on the ticks after they were told.
 * The nearest event first: an hour's reminder is worth nothing once it starts, and a day's can wait for the next tick.
 */
export async function sendEventReminders(db: D1Database, turn: Turn = openTurn(db)): Promise<number> {
  const now = Date.now();
  const until = new Date(now + EVENT_REMINDERS[0].before * 60_000).toISOString();
  const from = new Date(now).toISOString();
  const hour = new Date(now + EVENT_REMINDERS[1].before * 60_000).toISOString();
  const told = (app: string, thing: string, user: string, starts: string) => `NOT EXISTS (SELECT 1 FROM event_reminders c WHERE c.app = '${app}' AND c.thing_id = ${thing} AND c.user_id = ${user} AND c.kind = CASE WHEN ${starts} <= ?3 THEN '${EVENT_REMINDERS[1].kind}' ELSE '${EVENT_REMINDERS[0].kind}' END)`;
  const rows = await db
    .prepare(
      `SELECT 'party' AS app, e.id AS thing_id, r.user_id, e.title, e.starts_at, u.timezone, '/party/' || e.id AS link
         FROM events e JOIN event_registrations r ON r.event_id = e.id AND r.status = 'registered' JOIN users u ON u.id = r.user_id
         WHERE e.status = 'published' AND e.starts_at > ?1 AND e.starts_at <= ?2 AND ${told('party', 'e.id', 'r.user_id', 'e.starts_at')}
       UNION ALL
       SELECT 'circles', e.id, m.user_id, e.title, e.starts_at, u.timezone, '/circles/' || g.id
         FROM circle_events e JOIN circle_groups g ON g.event_id = e.id JOIN circle_members m ON m.group_id = g.id JOIN users u ON u.id = m.user_id
         WHERE e.status IN ('open','matched') AND e.starts_at > ?1 AND e.starts_at <= ?2 AND ${told('circles', 'e.id', 'm.user_id', 'e.starts_at')}
       UNION ALL
       SELECT 'run', r.id, m.user_id, r.title, r.starts_at, u.timezone, '/run/clubs/' || r.club_id
         FROM runs r JOIN run_clubs k ON k.id = r.club_id JOIN run_members m ON m.club_id = r.club_id AND m.status = 'member' AND m.user_id != k.host_user_id JOIN users u ON u.id = m.user_id
         WHERE r.status = 'published' AND r.starts_at > ?1 AND r.starts_at <= ?2 AND ${told('run', 'r.id', 'm.user_id', 'r.starts_at')}
       ORDER BY starts_at LIMIT 1000`,
    )
    .bind(from, until, hour)
    .all<Due>();
  if (!rows.results.length) return 0;
  const share = await turn();
  // The nearest reminder that is due for each: the hour one inside the last hour, the day one before that.
  const due = rows.results.map((d) => ({ d, due: (Date.parse(d.starts_at) - now) / 60_000 <= EVENT_REMINDERS[1].before ? EVENT_REMINDERS[1] : EVENT_REMINDERS[0] }));
  // The claim and the note go together in one batch, and the note's id holds what the claim holds, so a stop part way can neither lose a note nor send one twice.
  const sent = await share.send(
    share.fit(due, 2).flatMap(({ d, due }) => {
      const title = due.kind === 'hour' ? `In under an hour: ${d.title}` : `Coming up: ${d.title}`;
      return [
        db.prepare('INSERT OR IGNORE INTO event_reminders (app, thing_id, user_id, kind, sent_at) VALUES (?, ?, ?, ?, ?)').bind(d.app, d.thing_id, d.user_id, due.kind, nowIso()),
        // The link is built in the query above. note-link: /party/:id, /circles/:id, /run/clubs/:id
        noteStmt(db, { id: `event-${d.app}-${d.thing_id}-${d.user_id}-${due.kind}`, userId: d.user_id, kind: d.app === 'circles' ? 'circle' : d.app, title, body: `Starts ${clockIn(d.starts_at, d.timezone)}. You signed up.`, link: d.link }, 'once'),
      ];
    }),
  );
  return sent.length / 2;
}

/**
 * Close last month's season once: keep its top three (xp earned in that month, among people on the leaderboard), give
 * each the Season top three honor, and tell them. A month nobody earned in closes with no results. The claim and the
 * work are one batch, so a stop can never leave a month closed with nobody told, and running it twice does nothing twice.
 */
export async function closeSeason(db: D1Database, turn: Turn = openTurn(db)): Promise<number> {
  const season = previousSeason(seasonOf(nowIso()));
  const closed = await db.prepare('SELECT 1 AS x FROM seasons WHERE season = ?').bind(season).first();
  if (closed) return 0;
  const top = await db
    .prepare(
      `SELECT u.id, SUM(x.amount) AS xp FROM xp_events x JOIN users u ON u.id = x.user_id
       WHERE x.created_at >= ? AND x.created_at < ? AND u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL
       GROUP BY u.id HAVING SUM(x.amount) > 0 ORDER BY xp DESC, u.created_at ASC LIMIT ?`,
    )
    .bind(seasonStart(season), seasonStart(seasonOf(nowIso())), SEASON_TOP)
    .all<{ id: string; xp: number }>();
  const share = await turn();
  if (share.left() < 1) {
    share.more();
    return 0;
  }
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO seasons (season, closed_at) VALUES (?, ?)').bind(season, now),
    ...top.results.flatMap((r, i) => {
      const place = i + 1;
      return [
        db.prepare('INSERT OR IGNORE INTO season_results (season, place, user_id, xp) VALUES (?, ?, ?, ?)').bind(season, place, r.id, r.xp),
        db.prepare("INSERT OR IGNORE INTO honors (user_id, honor_key, note, awarded_at) VALUES (?, 'season_top', ?, ?)").bind(r.id, `Top three in ${seasonLabel(season)}`, now),
        noteStmt(db, { id: `season-${season}-${r.id}`, userId: r.id, kind: 'season', title: `Number ${place} in ${seasonLabel(season)}`, body: 'You finished the season in the top three. The Season top three honor is on your page.', link: '/leaderboard?by=season', at: now }, 'once'),
      ];
    }),
  ]);
  return top.results.length;
}
