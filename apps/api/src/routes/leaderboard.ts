import { Hono } from 'hono';
import { daysSince, evolutionFor, IDENTITY_STAGES, levelFromXp, seasonLabel, seasonOf, seasonStart, timeHonors, type LeaderboardEntry, type LeaderboardResponse, type LeaderboardSort, type SeasonResult } from '@kreators/shared';
import { nameOf } from '../db';
import type { AppEnv } from '../env';
import { computeBadges } from '../db';

export const leaderboard = new Hono<AppEnv>();

interface Row {
  id: string;
  display_name: string;
  xp: number;
  streak: number;
  best_streak: number;
  is_pro: number;
  created_at: string;
  tasks_done: number;
  projects_cleared: number;
  rels_with_pillars: number;
  sparks_done: number;
  admin_honors: number;
  season_xp: number;
}

const SORTS: LeaderboardSort[] = ['xp', 'season', 'streak', 'badges'];

leaderboard.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const q = c.req.query('by');
  const by: LeaderboardSort = SORTS.includes(q as LeaderboardSort) ? (q as LeaderboardSort) : 'xp';

  // The pool is the top 200 climbers who opted in: by all-time xp, or for the season by the xp earned this month.
  // Badge counts need the same stats the profile uses, so they are computed here rather than stored.
  const season = seasonOf(new Date().toISOString());
  const rows = await db
    .prepare(
      `SELECT u.id, u.display_name, u.xp, u.streak, u.best_streak, u.is_pro, u.created_at,
        (SELECT COUNT(*) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'task' AND n.status = 'done') AS tasks_done,
        (SELECT COUNT(*) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'project' AND n.status = 'done') AS projects_cleared,
        (SELECT COUNT(DISTINCT relationship) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'pillar' AND n.status != 'archived') AS rels_with_pillars,
        (SELECT COUNT(*) FROM spark_completions s WHERE s.user_id = u.id) AS sparks_done,
        (SELECT COUNT(*) FROM honors h WHERE h.user_id = u.id) AS admin_honors,
        (SELECT COALESCE(SUM(x.amount), 0) FROM xp_events x WHERE x.user_id = u.id AND x.created_at >= ?1) AS season_xp
       FROM users u
       WHERE u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL
       ORDER BY ${by === 'season' ? 'season_xp DESC,' : ''} u.xp DESC, u.created_at ASC
       LIMIT 200`,
    )
    .bind(seasonStart(season))
    .all<Row>();

  const entries: LeaderboardEntry[] = rows.results.map((r) => {
    const badges = computeBadges(r, {
      tasksDone: r.tasks_done,
      projectsCleared: r.projects_cleared,
      relationshipsWithPillars: r.rels_with_pillars,
      clubMember: false, // the board does not look up Club rows; the badge shows on the person's own page
      sparksDone: r.sparks_done,
      runsLogged: 0, // run badges likewise show on the person's own page, not the board
      runMetres: 0,
    }).length;
    return {
      rank: 0,
      userId: r.id,
      name: r.display_name || 'Anonymous climber',
      xp: r.xp,
      level: levelFromXp(r.xp),
      streak: r.streak,
      badgeCount: badges + r.admin_honors + timeHonors(r.created_at).length,
      isPro: r.is_pro === 1,
      stage: evolutionFor(IDENTITY_STAGES, r.xp, daysSince(r.created_at)).stage.stage,
      isMe: r.id === user.id,
      seasonXp: Math.max(0, r.season_xp),
    };
  });

  const key = by === 'badges' ? 'badgeCount' : by === 'season' ? 'seasonXp' : by;
  entries.sort((a, b) => b[key] - a[key] || b.xp - a.xp);
  entries.forEach((e, i) => (e.rank = i + 1));

  // The last three closed seasons and their top three.
  const closed = await db
    .prepare('SELECT r.season, r.place, r.xp, r.user_id, u.display_name FROM season_results r JOIN users u ON u.id = r.user_id WHERE r.season IN (SELECT season FROM seasons ORDER BY season DESC LIMIT 3) ORDER BY r.season DESC, r.place ASC')
    .all<{ season: string; place: number; xp: number; user_id: string; display_name: string }>();
  const past: SeasonResult[] = [];
  for (const r of closed.results) {
    let s = past.find((p) => p.season === r.season);
    if (!s) past.push((s = { season: r.season, label: seasonLabel(r.season), top: [] }));
    s.top.push({ place: r.place, name: nameOf(r), xp: r.xp, isMe: r.user_id === user.id });
  }
  const [y, m] = season.split('-').map(Number);
  const res: LeaderboardResponse = {
    by,
    entries: entries.slice(0, 20),
    me: entries.find((e) => e.isMe) ?? null,
    optedIn: user.leaderboard_opt_in === 1,
    season: { season, label: seasonLabel(season), endsAt: new Date(Date.UTC(y ?? 2026, m ?? 1, 1)).toISOString() },
    past,
  };
  return c.json(res);
});
