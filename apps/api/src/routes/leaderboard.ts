import { Hono } from 'hono';
import { daysSince, isPrivateBadge, EXPERIENCE_LEVELS, evolutionFor, IDENTITY_STAGES, isLeaderboardScope, LEADERBOARD_POOL, levelFromXp, RELATIONSHIPS, SETUP_GOALS, seasonLabel, seasonOf, seasonStart, timeHonors, type IconName, type LeaderboardBlock, type LeaderboardEntry, type LeaderboardOption, type LeaderboardOptions, type LeaderboardResponse, type LeaderboardScope, type LeaderboardSort, type SeasonResult } from '@kreators/shared';
import { blockedByName, nameOf, pageOf, paged } from '../db';
import type { AppEnv } from '../env';
import { computeBadges, emptyFacts } from '../db';

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
  /** Badges already written down for this person (a comma list); the board never counts the private families. */
  awarded: string | null;
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
const NOT_BLOCKED = `AND (u.id = ?3 OR NOT ${blockedByName('?3', 'u.id')})`;

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

function entryOf(r: Row, viewerId: string): LeaderboardEntry {
  // The board counts the badges its cheap counts can show, plus the ones already written down for the person, and never a private family.
  // The rest (Club, runs and the like) show on the person's own page.
  const earned = new Set([
    ...computeBadges(r, { facts: { ...emptyFacts(), tasks_done: r.tasks_done, projects_cleared: r.projects_cleared, pillars_set: r.rels_with_pillars, sparks_done: r.sparks_done } }),
    ...(r.awarded ?? '').split(',').filter(Boolean),
  ]);
  const badges = [...earned].filter((k) => !isPrivateBadge(k)).length;
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
    isMe: r.id === viewerId,
    seasonXp: Math.max(0, r.season_xp),
  };
}

/** The numbers behind a board entry for these people. ?2 is the board's value. Visits every task each one has, so only for who is shown. */
async function statRows(db: D1Database, sc: ReturnType<typeof scopeSql>, scope: LeaderboardScope, value: string, start: string, ids: readonly string[]): Promise<Row[]> {
  const rows = await db
    .prepare(
      `SELECT u.id, u.display_name, ${sc.xp} AS xp, u.streak, u.best_streak, u.is_pro, u.created_at,
        (SELECT COUNT(*) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'task' AND n.status = 'done') AS tasks_done,
        (SELECT COUNT(*) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'project' AND n.status = 'done') AS projects_cleared,
        (SELECT COUNT(DISTINCT relationship) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'pillar' AND n.status != 'archived') AS rels_with_pillars,
        (SELECT COUNT(*) FROM spark_completions s WHERE s.user_id = u.id) AS sparks_done,
        (SELECT COUNT(*) FROM honors h WHERE h.user_id = u.id) AS admin_honors,
        (SELECT COUNT(*) FROM badge_grants b WHERE b.user_id = u.id) AS admin_badges,
        (SELECT GROUP_CONCAT(a.badge_key) FROM badge_awards a WHERE a.user_id = u.id) AS awarded,
        (SELECT COALESCE(SUM(x.amount), 0) FROM xp_events x WHERE x.user_id = u.id AND x.created_at >= ?1 ${scope === 'pillar' ? 'AND x.relationship = ?2' : ''}) AS season_xp
       FROM users u ${sc.join}
       WHERE u.id IN (${ids.map((_, i) => `?${i + 3}`).join(', ')}) ${scope === 'pillar' ? '' : 'AND ?2 IS NOT NULL'}`,
    )
    .bind(start, value, ...ids)
    .all<Row>();
  return rows.results;
}

/** How long the kept answers below last. Ranks a few hours old are fine for an overview; who is on the board and their name are always read fresh. */
const BOARD_KEEP_MS = 3 * 3_600_000;
/** The two sorts that visit every task and xp line of everyone in the pool. */
const POOL_KEEP_MS = 6 * 3_600_000;

async function keptAnswer<T>(db: D1Database, key: string, keepMs: number, work: () => Promise<T>): Promise<T> {
  const row = await db.prepare('SELECT json, at FROM board_cache WHERE key = ?').bind(key).first<{ json: string; at: string }>();
  if (row && Date.now() - Date.parse(row.at) < keepMs) {
    try {
      return JSON.parse(row.json) as T;
    } catch {
      // work it out again
    }
  }
  const value = await work();
  await db.prepare('INSERT INTO board_cache (key, json, at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, at = excluded.at').bind(key, JSON.stringify(value), new Date().toISOString()).run();
  return value;
}

const cachedPool = (db: D1Database, key: string, work: () => Promise<LeaderboardEntry[]>) => keptAnswer(db, key, POOL_KEEP_MS, work);

/** A kept pool as this viewer may see it: nobody blocked either way, and nobody who has since left the board. */
async function stillOnTheBoard(db: D1Database, entries: readonly LeaderboardEntry[], viewerId: string): Promise<LeaderboardEntry[]> {
  const ids = entries.map((e) => e.userId);
  const live = new Set<string>();
  const parts: string[][] = [];
  for (let i = 0; i < ids.length; i += 90) parts.push(ids.slice(i, i + 90));
  const [, blockedRows] = await Promise.all([
    Promise.all(
      parts.map(async (part) => {
        const rows = await db.prepare(`SELECT id FROM users WHERE id IN (${part.map(() => '?').join(', ')}) AND leaderboard_opt_in = 1 AND onboarded_at IS NOT NULL AND display_name != 'Deleted member'`).bind(...part).all<{ id: string }>();
        for (const r of rows.results) live.add(r.id);
      }),
    ),
    db.prepare('SELECT blocker_id, blocked_id FROM blocks WHERE by_name = 1 AND (blocker_id = ?1 OR blocked_id = ?1)').bind(viewerId).all<{ blocker_id: string; blocked_id: string }>(),
  ]);
  const blocked = new Set(blockedRows.results.map((r) => (r.blocker_id === viewerId ? r.blocked_id : r.blocker_id)));
  return entries.filter((e) => live.has(e.userId) && !blocked.has(e.userId));
}

interface Overview {
  /** Each goal's and pillar's board, best first, as [id, xp], up to the pool. */
  goal: Record<string, [string, number][]>;
  pillar: Record<string, [string, number][]>;
  counts: { goal: Record<string, number>; pillar: Record<string, number>; level: Record<string, number>; city: [string, number][]; identity: [string, number][] };
}

/** Every board in the overview and every filter's count, from one pass over the opted-in people and one over the pillars' scores: about eight rows a person. Kept for a few hours. */
function overview(db: D1Database): Promise<Overview> {
  return keptAnswer(db, 'overview', BOARD_KEEP_MS, async () => {
    const [people, scores] = await Promise.all([
      db
        .prepare("SELECT u.id, u.xp, u.created_at, u.city, u.experience_level, u.intake_json, u.identities FROM users u WHERE u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL AND u.display_name != 'Deleted member' ORDER BY u.xp DESC, u.created_at ASC")
        .all<{ id: string; xp: number; created_at: string; city: string; experience_level: string; intake_json: string; identities: string }>(),
      db.prepare('SELECT user_id, relationship, xp FROM relationship_scores WHERE xp > 0').all<{ user_id: string; relationship: string; xp: number }>(),
    ]);
    const add = (o: Record<string, number>, k: string) => {
      o[k] = (o[k] ?? 0) + 1;
    };
    const blank = () => Object.create(null) as Record<string, number>;
    const out: Overview = { goal: Object.create(null), pillar: Object.create(null), counts: { goal: blank(), pillar: blank(), level: blank(), city: [], identity: [] } };
    const cities = new Map<string, { v: string; n: number }>();
    const tags = blank();
    const born = new Map<string, string>();
    for (const u of people.results) {
      born.set(u.id, u.created_at);
      let goals: unknown = [];
      try {
        goals = (JSON.parse(u.intake_json || '{}') as { goals?: unknown }).goals;
      } catch {
        goals = [];
      }
      for (const g of Array.isArray(goals) ? goals : []) {
        if (typeof g !== 'string') continue;
        add(out.counts.goal, g);
        const list = (out.goal[g] ??= []);
        if (list.length < LEADERBOARD_POOL) list.push([u.id, u.xp]);
      }
      if (u.city) {
        const key = u.city.toLowerCase();
        const c = cities.get(key);
        if (c) c.n += 1;
        else cities.set(key, { v: u.city, n: 1 });
      }
      if (u.experience_level) add(out.counts.level, u.experience_level);
      try {
        const list = JSON.parse(u.identities || '[]') as unknown;
        if (Array.isArray(list)) for (const t of list) if (typeof t === 'string') add(tags, t);
      } catch {
        // an unreadable list counts for nothing
      }
    }
    for (const s of scores.results) {
      if (!born.has(s.user_id)) continue;
      add(out.counts.pillar, s.relationship);
      (out.pillar[s.relationship] ??= []).push([s.user_id, s.xp]);
    }
    for (const key of Object.keys(out.pillar)) {
      out.pillar[key] = out.pillar[key]!.sort((a, b) => b[1] - a[1] || (born.get(a[0])! < born.get(b[0])! ? -1 : 1)).slice(0, LEADERBOARD_POOL);
    }
    const byCount = (a: [string, number], b: [string, number]) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1);
    out.counts.city = [...cities.values()].map((c): [string, number] => [c.v, c.n]).sort(byCount).slice(0, 30);
    out.counts.identity = Object.entries(tags).sort(byCount).slice(0, 30);
    return out;
  });
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

  // The pool is the top LEADERBOARD_POOL climbers who opted in, by all-time xp (or this pillar's xp), then ranked by the sort chosen. Badge counts need the same stats the
  // profile uses, and they visit every task the person has, so they are read only for who is on the page (xp and streak rank from the person's row). The season and badge
  // sorts need them for the whole pool, so those are kept for a few hours (`cachedPool`) and read through the viewer's blocks here.
  const season = seasonOf(new Date().toISOString());
  const start = seasonStart(season);
  const ask = pageOf(c);
  const statsOf = async (ids: string[]): Promise<Map<string, Row>> => {
    const parts: string[][] = [];
    for (let i = 0; i < ids.length; i += 90) parts.push(ids.slice(i, i + 90));
    const read = await Promise.all(parts.map((part) => statRows(db, sc, scope, value, start, part)));
    return new Map(read.flat().map((r) => [r.id, r]));
  };
  const [closed, entries] = await Promise.all([
    // The last three closed seasons and their top three: independent of the board above, so read together.
    db
      .prepare('SELECT r.season, r.place, r.xp, r.user_id, u.display_name FROM season_results r JOIN users u ON u.id = r.user_id WHERE r.season IN (SELECT season FROM seasons ORDER BY season DESC LIMIT 3) ORDER BY r.season DESC, r.place ASC')
      .all<{ season: string; place: number; xp: number; user_id: string; display_name: string }>(),
    (async (): Promise<LeaderboardEntry[]> => {
      if (by === 'season' || by === 'badges') {
        const kept = await cachedPool(db, `pool:${scope}:${value}:${by}`, async () => {
          const rows = await db
            .prepare(`SELECT u.id FROM users u ${sc.join} WHERE u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL AND u.display_name != 'Deleted member' ${sc.where} ORDER BY ${by === 'season' ? `(SELECT COALESCE(SUM(x.amount), 0) FROM xp_events x WHERE x.user_id = u.id AND x.created_at >= ?1 ${scope === 'pillar' ? 'AND x.relationship = ?2' : ''}) DESC,` : ''} ${sc.xp} DESC, u.created_at ASC LIMIT ${LEADERBOARD_POOL}`)
            .bind(start, value)
            .all<{ id: string }>();
          const stats = await statsOf(rows.results.map((r) => r.id));
          return rows.results.flatMap((r) => {
            const row = stats.get(r.id);
            return row ? [entryOf(row, '')] : [];
          });
        });
        return (await stillOnTheBoard(db, kept, user.id)).map((e) => ({ ...e, isMe: e.userId === user.id }));
      }
      const pool = await db
        .prepare(
          `SELECT u.id, u.display_name, ${sc.xp} AS xp, u.streak, u.best_streak, u.is_pro, u.created_at FROM users u ${sc.join}
           WHERE u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL AND u.display_name != 'Deleted member' ${sc.where} ${NOT_BLOCKED}
           ORDER BY ${sc.xp} DESC, u.created_at ASC LIMIT ${LEADERBOARD_POOL}`,
        )
        .bind(start, value, user.id)
        .all<Row>();
      const ranked = [...pool.results].sort((a, b) => (by === 'streak' ? b.streak - a.streak : 0) || b.xp - a.xp);
      const shownIds = ranked.slice(ask.offset, ask.offset + ask.limit + 1).map((r) => r.id);
      const stats = await statsOf([...new Set([...shownIds, ...(ranked.some((r) => r.id === user.id) ? [user.id] : [])])]);
      // Whoever is off this page needs only what ranks them: their row's xp and streak. What they would show is never sent.
      return ranked.map((r) => {
        const row = stats.get(r.id);
        return row ? entryOf(row, user.id) : { rank: 0, userId: r.id, name: '', xp: r.xp, level: 0, streak: r.streak, badgeCount: 0, isPro: false, stage: 0 as LeaderboardEntry["stage"], isMe: false, seasonXp: 0 };
      });
    })(),
  ]);

  const key = by === 'badges' ? 'badgeCount' : by === 'season' ? 'seasonXp' : by;
  entries.sort((a, b) => b[key] - a[key] || b.xp - a.xp);
  entries.forEach((e, i) => (e.rank = i + 1));

  const past: SeasonResult[] = [];
  for (const r of closed.results) {
    let s = past.find((p) => p.season === r.season);
    if (!s) past.push((s = { season: r.season, label: seasonLabel(r.season), top: [] }));
    s.top.push({ place: r.place, name: nameOf(r), xp: r.xp, isMe: r.user_id === user.id });
  }
  const [y, m] = season.split('-').map(Number);
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


// What can be picked on each filter, with how many opted-in people each has. From the kept overview, so a count can be a few hours old and does not leave out someone the viewer blocked.
leaderboard.get('/options', async (c) => {
  const { counts } = await overview(c.env.DB);
  const asResults = (o: Record<string, number>) => ({ results: Object.entries(o).map(([v, n]) => ({ v, n })) });
  const goals = asResults(counts.goal);
  const pillars = asResults(counts.pillar);
  const levels = asResults(counts.level);
  const cities = { results: counts.city.map(([v, n]) => ({ v, n })) };
  const tags = { results: counts.identity.map(([v, n]) => ({ v, n })) };
  const count = (r: { results: { v: string; n: number }[] }) => new Map(r.results.map((x) => [x.v, x.n]));
  const g = count(goals);
  const p = count(pillars);
  const lv = count(levels);
  // Every goal, pillar and level is always listed, so a person sees what exists even before anyone is on it.
  const out: LeaderboardOptions = {
    goal: SETUP_GOALS.map((x): LeaderboardOption => ({ value: x.key, label: x.label, icon: x.icon, count: g.get(x.key) ?? 0 })),
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
  const targets: { scope: LeaderboardScope; value: string; label: string; icon?: IconName }[] = [
    ...SETUP_GOALS.map((g) => ({ scope: 'goal' as const, value: g.key, label: g.label, icon: g.icon })),
    ...RELATIONSHIPS.map((r) => ({ scope: 'pillar' as const, value: r.key, label: r.name })),
  ];
  // The ranks are the kept overview's. Who shows is read fresh: the viewer's blocks, and whether each person near the top is still on the board, with their name as it is now.
  const [o, blockedRows] = await Promise.all([
    overview(db),
    db.prepare('SELECT blocker_id, blocked_id FROM blocks WHERE by_name = 1 AND (blocker_id = ?1 OR blocked_id = ?1)').bind(user.id).all<{ blocker_id: string; blocked_id: string }>(),
  ]);
  const blocked = new Set(blockedRows.results.map((r) => (r.blocker_id === user.id ? r.blocked_id : r.blocker_id)));
  const lists = targets.map((t) => (t.scope === 'goal' ? o.goal[t.value] : o.pillar[t.value])?.filter(([id]) => !blocked.has(id)) ?? []);
  // Six from each board, so one who left is replaced by the next.
  const near = [...new Set(lists.flatMap((l) => l.slice(0, 6).map(([id]) => id)))];
  const live = new Map<string, string>();
  const parts: string[][] = [];
  for (let i = 0; i < near.length; i += 90) parts.push(near.slice(i, i + 90));
  await Promise.all(
    parts.map(async (part) => {
      const rows = await db.prepare(`SELECT u.id, u.display_name FROM users u WHERE u.id IN (${part.map(() => '?').join(', ')}) AND u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL AND u.display_name != 'Deleted member'`).bind(...part).all<{ id: string; display_name: string }>();
      for (const r of rows.results) live.set(r.id, r.display_name);
    }),
  );
  const blocks: LeaderboardBlock[] = targets.map((t, i) => {
    const list = lists[i] ?? [];
    const at = list.findIndex(([id]) => id === user.id);
    return {
      scope: t.scope,
      value: t.value,
      label: t.label,
      icon: t.icon,
      people: list.length,
      top: list.slice(0, 6).filter(([id]) => live.has(id)).slice(0, 3).map(([id, xp], k) => ({ rank: k + 1, name: nameOf({ display_name: live.get(id) ?? '' }), xp, isMe: id === user.id })),
      myRank: at >= 0 ? at + 1 : null,
    };
  });
  return c.json({ blocks });
});
