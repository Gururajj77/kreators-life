import { Hono } from 'hono';
import { daysSince, EXPERIENCE_LEVELS, evolutionFor, IDENTITY_STAGES, isLeaderboardScope, LEADERBOARD_POOL, levelFromXp, RELATIONSHIPS, SETUP_GOALS, seasonLabel, seasonOf, seasonStart, timeHonors, type LeaderboardBlock, type LeaderboardEntry, type LeaderboardOption, type LeaderboardOptions, type LeaderboardResponse, type LeaderboardScope, type LeaderboardSort, type SeasonResult } from '@kreators/shared';
import { nameOf, pageOf, paged } from '../db';
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
  admin_badges: number;
  season_xp: number;
}

const SORTS: LeaderboardSort[] = ['xp', 'season', 'streak', 'badges'];

/**
 * Who is on a board, as SQL. ?2 is the value chosen (always bound) and ?3 the viewer. Everyone listed opted in and
 * finished setup, and nobody blocked either way with the viewer appears. A pillar board ranks by that pillar's own xp.
 */
function scopeSql(scope: LeaderboardScope): { join: string; where: string; xp: string } {
  const base = '';
  switch (scope) {
    case 'pillar':
      return { join: 'JOIN relationship_scores rs ON rs.user_id = u.id AND rs.relationship = ?2', where: 'AND rs.xp > 0', xp: 'rs.xp' };
    case 'goal':
      return { join: base, where: "AND EXISTS (SELECT 1 FROM json_each(u.intake_json, '$.goals') j WHERE j.value = ?2)", xp: 'u.xp' };
    case 'city':
      return { join: base, where: "AND u.city != '' AND LOWER(u.city) = LOWER(?2)", xp: 'u.xp' };
    case 'identity':
      return { join: base, where: 'AND EXISTS (SELECT 1 FROM json_each(u.identities) j WHERE j.value = ?2)', xp: 'u.xp' };
    case 'level':
      return { join: base, where: 'AND u.experience_level = ?2', xp: 'u.xp' };
    default:
      return { join: base, where: 'AND ?2 IS NOT NULL', xp: 'u.xp' };
  }
}
const NOT_BLOCKED = "AND (u.id = ?3 OR NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?3 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?3)))";

const GOAL_BY = Object.fromEntries(SETUP_GOALS.map((g) => [g.key, g]));
const PILLAR_BY = Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, r]));

function labelOf(scope: LeaderboardScope, value: string): string {
  if (scope === 'goal') return GOAL_BY[value]?.label ?? value;
  if (scope === 'pillar') return PILLAR_BY[value]?.name ?? value;
  if (scope === 'city') return value;
  if (scope === 'identity') return value;
  if (scope === 'level') return value;
  return 'Everyone';
}

leaderboard.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const q = c.req.query('by');
  const by: LeaderboardSort = SORTS.includes(q as LeaderboardSort) ? (q as LeaderboardSort) : 'xp';
  const rawScope = c.req.query('scope');
  const scope: LeaderboardScope = isLeaderboardScope(rawScope) ? rawScope : 'all';
  const value = scope === 'all' ? '' : (c.req.query('value') ?? '').trim().slice(0, 80);
  if (scope !== 'all' && !value) return c.json({ error: 'choose which one' }, 400);
  const sc = scopeSql(scope);

  // The pool is the top LEADERBOARD_POOL climbers who opted in, by all-time xp (or this pillar's xp), then ranked by the sort chosen.
  // Badge counts need the same stats the profile uses, so they are computed here rather than stored.
  const season = seasonOf(new Date().toISOString());
  const rows = await db
    .prepare(
      `SELECT u.id, u.display_name, ${sc.xp} AS xp, u.streak, u.best_streak, u.is_pro, u.created_at,
        (SELECT COUNT(*) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'task' AND n.status = 'done') AS tasks_done,
        (SELECT COUNT(*) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'project' AND n.status = 'done') AS projects_cleared,
        (SELECT COUNT(DISTINCT relationship) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'pillar' AND n.status != 'archived') AS rels_with_pillars,
        (SELECT COUNT(*) FROM spark_completions s WHERE s.user_id = u.id) AS sparks_done,
        (SELECT COUNT(*) FROM honors h WHERE h.user_id = u.id) AS admin_honors,
        (SELECT COUNT(*) FROM badge_grants b WHERE b.user_id = u.id) AS admin_badges,
        (SELECT COALESCE(SUM(x.amount), 0) FROM xp_events x WHERE x.user_id = u.id AND x.created_at >= ?1 ${scope === 'pillar' ? 'AND x.relationship = ?2' : ''}) AS season_xp
       FROM users u ${sc.join}
       WHERE u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL AND u.display_name != 'Deleted member' ${sc.where} ${NOT_BLOCKED}
       ORDER BY ${by === 'season' ? 'season_xp DESC,' : ''} ${sc.xp} DESC, u.created_at ASC
       LIMIT ${LEADERBOARD_POOL}`,
    )
    .bind(seasonStart(season), value, user.id)
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
      badgeCount: badges + r.admin_honors + r.admin_badges + timeHonors(r.created_at).length,
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
  const ask = pageOf(c);
  const pg = paged(entries.slice(ask.offset, ask.offset + ask.limit), ask);
  const res: LeaderboardResponse = {
    by,
    scope,
    value,
    label: labelOf(scope, value),
    page: pg.page,
    people: entries.length,
    entries: pg.items,
    me: entries.find((e) => e.isMe) ?? null,
    optedIn: user.leaderboard_opt_in === 1,
    season: { season, label: seasonLabel(season), endsAt: new Date(Date.UTC(y ?? 2026, m ?? 1, 1)).toISOString() },
    past,
  };
  return c.json(res);
});


// What can be picked on each filter, with how many opted-in people each has. Cheap to compute and the same for everyone but the block rule.
leaderboard.get('/options', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const on = "u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL AND u.display_name != 'Deleted member' AND (u.id = ?1 OR NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?1)))";
  const [goals, pillars, cities, tags, levels] = await Promise.all([
    db.prepare(`SELECT j.value AS v, COUNT(*) AS n FROM users u, json_each(u.intake_json, '$.goals') j WHERE ${on} GROUP BY j.value`).bind(user.id).all<{ v: string; n: number }>(),
    db.prepare(`SELECT rs.relationship AS v, COUNT(*) AS n FROM users u JOIN relationship_scores rs ON rs.user_id = u.id WHERE rs.xp > 0 AND ${on} GROUP BY rs.relationship`).bind(user.id).all<{ v: string; n: number }>(),
    db.prepare(`SELECT u.city AS v, COUNT(*) AS n FROM users u WHERE u.city != '' AND ${on} GROUP BY LOWER(u.city) ORDER BY n DESC, v LIMIT 30`).bind(user.id).all<{ v: string; n: number }>(),
    db.prepare(`SELECT j.value AS v, COUNT(*) AS n FROM users u, json_each(u.identities) j WHERE ${on} GROUP BY j.value ORDER BY n DESC, v LIMIT 30`).bind(user.id).all<{ v: string; n: number }>(),
    db.prepare(`SELECT u.experience_level AS v, COUNT(*) AS n FROM users u WHERE u.experience_level != '' AND ${on} GROUP BY u.experience_level`).bind(user.id).all<{ v: string; n: number }>(),
  ]);
  const count = (r: { results: { v: string; n: number }[] }) => new Map(r.results.map((x) => [x.v, x.n]));
  const g = count(goals);
  const p = count(pillars);
  const lv = count(levels);
  // Every goal, pillar and level is always listed, so a person sees what exists even before anyone is on it.
  const out: LeaderboardOptions = {
    goal: SETUP_GOALS.map((x): LeaderboardOption => ({ value: x.key, label: x.label, emoji: x.emoji, count: g.get(x.key) ?? 0 })),
    pillar: RELATIONSHIPS.map((x): LeaderboardOption => ({ value: x.key, label: x.name, count: p.get(x.key) ?? 0 })),
    city: cities.results.map((x) => ({ value: x.v, label: x.v, count: x.n })),
    identity: tags.results.map((x) => ({ value: x.v, label: x.v, count: x.n })),
    level: EXPERIENCE_LEVELS.map((x): LeaderboardOption => ({ value: x, label: x, count: lv.get(x) ?? 0 })),
  };
  return c.json(out);
});

// The overview: a small board for every goal and every pillar, with its top three and where the viewer stands.
leaderboard.get('/blocks', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const targets: { scope: LeaderboardScope; value: string; label: string; emoji: string }[] = [
    ...SETUP_GOALS.map((g) => ({ scope: 'goal' as const, value: g.key, label: g.label, emoji: g.emoji })),
    ...RELATIONSHIPS.map((r) => ({ scope: 'pillar' as const, value: r.key, label: r.name, emoji: '' })),
  ];
  const results = await db.batch<{ id: string; display_name: string; xp: number }>(
    targets.map((t) => {
      const sc = scopeSql(t.scope);
      return db
        .prepare(`SELECT u.id, u.display_name, ${sc.xp} AS xp FROM users u ${sc.join} WHERE u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL AND u.display_name != 'Deleted member' ${sc.where} ${NOT_BLOCKED} ORDER BY ${sc.xp} DESC, u.created_at ASC LIMIT ${LEADERBOARD_POOL}`)
        .bind(null, t.value, user.id);
    }),
  );
  const blocks: LeaderboardBlock[] = targets.map((t, i) => {
    const rows = results[i]?.results ?? [];
    const at = rows.findIndex((r) => r.id === user.id);
    return {
      scope: t.scope,
      value: t.value,
      label: t.label,
      emoji: t.emoji,
      people: rows.length,
      top: rows.slice(0, 3).map((r, k) => ({ rank: k + 1, name: nameOf(r), xp: r.xp, isMe: r.id === user.id })),
      myRank: at >= 0 ? at + 1 : null,
    };
  });
  return c.json({ blocks });
});
