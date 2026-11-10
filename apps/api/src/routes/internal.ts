import { tripsOf } from '../d1Batch';
import { CONNECT_KINDS } from '@kreators/shared/connect';
import { LESSON_RESOURCE_KINDS } from '@kreators/shared/lessonResources';
import { WAITLIST_STATUSES } from '@kreators/shared/invites';
import { CARD_GAMES, isRole, MODULES, OPEN_KINDS, PROGRAM_VISIBILITIES, roleRank, ROLES, type LogEntry, type LogsResponse, type ObservabilityResponse, type ObservedAdditions, type ObservedUser, type Role } from '@kreators/shared';
import { Hono } from 'hono';
import { accessFor, loadAccessContext } from '../access';
import { audit, getUser, likeFit, pageOf, paged } from '../db';
import { revokeIfCannotInvite } from '../invites';
import type { AppEnv, UserRow } from '../env';
import { vitalsSummary } from './vitals';

/**
 * Dev Tools for the team (the key and the path keep the old word, observability): who is here, which apps they have on, who holds which role,
 * and counts for the apps, aggregated and nameless. Staff can look. Only an admin changes a role, and never their own, so someone is always
 * left who can. The journal, gratitude, wellbeing (mood, sleep, stress, mindful minutes), Fitness (movement, eating, protein), supplements,
 * Discover's answers, the Companion and the assistant's words never appear here, not even as a count.
 */
export const internal = new Hono<AppEnv>();

const DELETED = 'Deleted member';

internal.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user || roleRank(user.role) < roleRank('sub_admin')) return c.json({ error: 'you do not have access to that' }, 403);
  await next();
});

type LightRow = Pick<UserRow, 'id' | 'display_name' | 'handle' | 'role' | 'modules' | 'created_at' | 'onboarded_at' | 'attendee_event' | 'time_blocks_seeded_at'>;

/** The audit actions that are the team connecting people: a coach and a student from Admin's Life coaches tab (`coach.link`, `coach.ask`), and each
 * connection Connect people makes (`connect.<kind>`; its `.end` and a person's `.answer` are not a connection made). */
const COACH_ACTIONS = ['coach.link', 'coach.ask'] as const;
const kindOfAction = (action: string): string | null => ((COACH_ACTIONS as readonly string[]).includes(action) ? 'coach' : /^connect\.[a-z]+$/.test(action) ? action.slice(8) : null);

// How fast the app is for real visitors: the 75th percentile of each page's loading, responsiveness and stability, by device. No names, no addresses.
internal.get('/vitals', async (c) => c.json(await vitalsSummary(c.env.DB, Math.min(90, Math.max(1, Number(c.req.query('days')) || 7)))));

internal.get('/observability', async (c) => {
  const db = c.env.DB;
  const q = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 60);
  const ask = pageOf(c);
  const [rows, members, ctx] = await Promise.all([
    db.prepare('SELECT id, display_name, handle, role, modules, created_at, onboarded_at, attendee_event, time_blocks_seeded_at FROM users WHERE display_name != ? ORDER BY created_at DESC').bind(DELETED).all<LightRow>(),
    db.prepare("SELECT user_id, organization_id FROM organization_members WHERE status = 'active'").all<{ user_id: string; organization_id: string }>(),
    loadAccessContext(db),
  ]);
  const orgsOf = new Map<string, string[]>();
  for (const m of members.results) orgsOf.set(m.user_id, [...(orgsOf.get(m.user_id) ?? []), m.organization_id]);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const on = new Map<string, number>();
  const roles: Record<Role, number> = { user: 0, sub_admin: 0, admin: 0 };
  const totals = { users: 0, onboarded: 0, staff: 0, admins: 0, newThisWeek: 0 };
  // Read from the same rows, so they cost nothing more: people who came through an event and are not set up yet, and people who changed their starting time blocks.
  let eventArrivals = 0;
  let ownTimeBlocks = 0;
  const people: ObservedUser[] = [];
  for (const r of rows.results) {
    const access = accessFor(r, ctx, orgsOf.get(r.id) ?? []);
    const apps = MODULES.filter((m) => access[m.key]?.on).map((m) => m.key);
    for (const k of apps) on.set(k, (on.get(k) ?? 0) + 1);
    const role: Role = isRole(r.role) ? r.role : 'user';
    roles[role] += 1;
    totals.users += 1;
    if (r.onboarded_at) totals.onboarded += 1;
    if (role === 'sub_admin') totals.staff += 1;
    if (role === 'admin') totals.admins += 1;
    if (r.created_at >= weekAgo) totals.newThisWeek += 1;
    if (r.attendee_event && !r.onboarded_at) eventArrivals += 1;
    if (r.time_blocks_seeded_at) ownTimeBlocks += 1;
    people.push({ id: r.id, name: r.display_name, handle: r.handle, role, createdAt: r.created_at, onboarded: Boolean(r.onboarded_at), apps });
  }
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  // All of these go out in one event-loop turn, so batchedReads sends them as one round trip.
  const [unlocks, dz, dset, grantRows, logRows, extraRows, ag, coachRows, programRows, resourceRows, newer, openRows, inv, waitRows] = await Promise.all([
    db.prepare('SELECT game_key, COUNT(*) AS n FROM card_unlocks GROUP BY game_key').all<{ game_key: string; n: number }>(),
    db.prepare("SELECT COUNT(*) AS results, COUNT(DISTINCT user_id) AS people, COALESCE(SUM(CASE WHEN result_json LIKE '%\"eq\":{%' THEN 1 ELSE 0 END), 0) AS with_eq FROM discover_results").first<{ results: number; people: number; with_eq: number }>(),
    db.prepare('SELECT COALESCE(SUM(assistant), 0) AS assistant_on, COALESCE(SUM(CASE WHEN steps = 0 THEN 1 ELSE 0 END), 0) AS steps_off, COALESCE(SUM(mind), 0) AS mind_on FROM discover_settings').first<{ assistant_on: number; steps_off: number; mind_on: number }>(),
    // Hand-given xp, badges, points and honors, and the connections the team made, from one read of the month's audit lines (idx_audit_created).
    db
      .prepare(`SELECT action, COUNT(*) AS n FROM audit_logs WHERE created_at >= ? AND (action IN ('user.xp', 'user.badge', 'user.points', 'user.honor', ${COACH_ACTIONS.map(() => '?').join(', ')}) OR action LIKE 'connect.%') GROUP BY action`)
      .bind(since30, ...COACH_ACTIONS)
      .all<{ action: string; n: number }>(),
    // The day's log lines by level, and in the same read how many friend codes were made new (POST /me/friend-code leaves a change line).
    db.prepare("SELECT level, COUNT(*) AS n, COALESCE(SUM(CASE WHEN method = 'POST' AND path = '/me/friend-code' THEN 1 ELSE 0 END), 0) AS qr FROM app_logs WHERE at >= ? GROUP BY level").bind(since24).all<{ level: string; n: number; qr: number }>(),
    // How many people finished each Discover add-on: counts only, never an answer or a result.
    db.prepare('SELECT kind, COUNT(*) AS n FROM discover_extras WHERE result_json IS NOT NULL GROUP BY kind').all<{ kind: string; n: number }>(),
    // Agency: how much it is used, as counts. Never a client, a name or an amount.
    db
      .prepare(
        `SELECT (SELECT COUNT(DISTINCT user_id) FROM agency_clients) AS people,
          (SELECT COUNT(*) FROM agency_clients) AS clients,
          (SELECT COUNT(*) FROM agency_items) AS deliverables,
          (SELECT COUNT(*) FROM agency_items WHERE stage = 'published') AS published,
          (SELECT COUNT(*) FROM invoices WHERE agency_client_id IS NOT NULL) AS invoices,
          (SELECT COUNT(*) FROM agency_contracts WHERE status = 'signed') AS signed,
          (SELECT COUNT(*) FROM agency_clients WHERE portal_token IS NOT NULL) AS links,
          (SELECT COUNT(*) FROM kpi_prefs WHERE enabled = 1) AS metrics,
          (SELECT COUNT(*) FROM agency_team WHERE status = 'active') AS team,
          (SELECT COUNT(*) FROM agency_clients WHERE team_link_token IS NOT NULL) AS team_links`,
      )
      .first<{ people: number; clients: number; deliverables: number; published: number; invoices: number; signed: number; links: number; metrics: number; team: number; team_links: number }>(),
    // Life coaches: links by state and who started them. Never a coach or a student.
    db.prepare("SELECT status, COUNT(*) AS n, COALESCE(SUM(CASE WHEN asked_by = 'admin' THEN 1 ELSE 0 END), 0) AS by_team FROM coach_links GROUP BY status").all<{ status: string; n: number; by_team: number }>(),
    db.prepare('SELECT visibility, COUNT(*) AS n FROM programs GROUP BY visibility').all<{ visibility: string; n: number }>(),
    db.prepare('SELECT kind, COUNT(*) AS n FROM lesson_resources GROUP BY kind').all<{ kind: string; n: number }>(),
    // Coach invite links switched on (a row is a live link), and cohort discussion lines in the last thirty days (idx_cohort_talk_created).
    db
      .prepare('SELECT (SELECT COUNT(*) FROM coach_invites) AS invites, (SELECT COUNT(*) FROM cohort_talk WHERE created_at >= ? AND deleted_at IS NULL) AS talk')
      .bind(since30)
      .first<{ invites: number; talk: number }>(),
    // Open bottleneck tasks by kind: only the rows the partial index idx_nodes_user_open holds (most tasks carry none). Counts, never a title.
    db.prepare("SELECT open_kind, COUNT(*) AS n FROM nodes WHERE open_kind IS NOT NULL AND kind = 'task' AND status = 'active' GROUP BY open_kind").all<{ open_kind: string; n: number }>(),
    // Joining by invite (2026-11-10): the switch, codes by state, and joins through a code this week. Counts only, never a code, a maker or a name.
    db
      .prepare(
        `SELECT (SELECT value FROM signup_settings WHERE key = 'invite_only') AS gate, COUNT(*) AS made,
          COALESCE(SUM(CASE WHEN used_by IS NOT NULL THEN 1 ELSE 0 END), 0) AS used,
          COALESCE(SUM(CASE WHEN used_by IS NULL AND revoked_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS revoked,
          COALESCE(SUM(CASE WHEN used_by IS NULL AND revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?1 THEN 1 ELSE 0 END), 0) AS expired,
          COALESCE(SUM(CASE WHEN used_at >= ?2 THEN 1 ELSE 0 END), 0) AS week,
          COALESCE(SUM(CASE WHEN setup_done_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS set_up
         FROM invite_codes`,
      )
      .bind(new Date().toISOString(), weekAgo)
      .first<{ gate: string | null; made: number; used: number; revoked: number; expired: number; week: number; set_up: number }>(),
    db.prepare('SELECT status, COUNT(*) AS n FROM waitlist GROUP BY status').all<{ status: string; n: number }>(),
  ]);
  /** One count per known key, 0 for a key with no rows; a value outside the keys is left out. */
  const tally = <K extends string>(rows: Record<string, unknown>[], field: string, keys: readonly K[]): Record<K, number> =>
    Object.fromEntries(keys.map((k) => [k, Number(rows.find((r) => r[field] === k)?.n ?? 0)])) as Record<K, number>;
  const coachN = (s: string) => coachRows.results.find((r) => r.status === s)?.n ?? 0;
  const connections = Object.fromEntries(CONNECT_KINDS.map((k) => [k, 0])) as Record<string, number>;
  for (const r of grantRows.results) {
    const kind = kindOfAction(r.action);
    if (kind !== null && kind in connections) connections[kind] = (connections[kind] ?? 0) + r.n;
  }
  const connections30 = Object.values(connections).reduce((s, n) => s + n, 0);
  const grant = (a: string) => grantRows.results.find((r) => r.action === a)?.n ?? 0;
  const extra = (k: string) => extraRows.results.find((r) => r.kind === k)?.n ?? 0;
  const lg = (l: string) => logRows.results.find((r) => r.level === l)?.n ?? 0;
  const additions: ObservedAdditions = {
    games: CARD_GAMES.map((g) => ({ key: g.key, name: g.name, unlocked: unlocks.results.find((r) => r.game_key === g.key)?.n ?? 0 })),
    discover: { results: dz?.results ?? 0, people: dz?.people ?? 0, withEq: dz?.with_eq ?? 0, assistantOn: dset?.assistant_on ?? 0, stepsOff: dset?.steps_off ?? 0, addons: { type: extra('type'), love: extra('love'), mind: extra('mind'), design: extra('design') }, mindOn: dset?.mind_on ?? 0 },
    agency: { people: ag?.people ?? 0, clients: ag?.clients ?? 0, deliverables: ag?.deliverables ?? 0, published: ag?.published ?? 0, invoices: ag?.invoices ?? 0, agreementsSigned: ag?.signed ?? 0, clientLinksOn: ag?.links ?? 0, metricsOn: ag?.metrics ?? 0, teamMembers: ag?.team ?? 0, teamLinksOn: ag?.team_links ?? 0 },
    coaching: { pending: coachN('pending'), active: coachN('active'), ended: coachN('ended'), declined: coachN('declined'), invitesOn: newer?.invites ?? 0, byTeam: coachRows.results.reduce((s, r) => s + r.by_team, 0) },
    school: { programs: tally(programRows.results, 'visibility', PROGRAM_VISIBILITIES), resources: tally(resourceRows.results, 'kind', LESSON_RESOURCE_KINDS), talkLines30: newer?.talk ?? 0 },
    daily: { bottlenecks: tally(openRows.results, 'open_kind', OPEN_KINDS), ownTimeBlocks, eventArrivals, qrRenewed24h: logRows.results.reduce((s, r) => s + r.qr, 0) },
    team: { connections30, byKind: connections },
    grants: { xp: grant('user.xp'), badges: grant('user.badge'), points: grant('user.points'), honors: grant('user.honor') },
    logs: { errors: lg('error'), warnings: lg('warn'), changes: lg('info') },
    invites: {
      inviteOnly: (inv?.gate ?? '1') === '1',
      codes: { made: inv?.made ?? 0, used: inv?.used ?? 0, open: Math.max(0, (inv?.made ?? 0) - (inv?.used ?? 0) - (inv?.revoked ?? 0) - (inv?.expired ?? 0)), revoked: inv?.revoked ?? 0, expired: inv?.expired ?? 0 },
      joinedThisWeek: inv?.week ?? 0,
      setUp: inv?.set_up ?? 0,
      waitlist: tally(waitRows.results, 'status', WAITLIST_STATUSES),
    },
  };
  const matched = q ? people.filter((p) => p.name.toLowerCase().includes(q) || (p.handle ?? '').toLowerCase().includes(q)) : people;
  const res: ObservabilityResponse = {
    totals,
    additions,
    roles,
    apps: MODULES.map((m) => ({ key: m.key, name: m.name, icon: m.icon, group: m.group, on: on.get(m.key) ?? 0 })),
    users: matched.slice(ask.offset, ask.offset + ask.size),
    total: matched.length,
    page: { page: ask.page, size: ask.size, more: matched.length > ask.offset + ask.size },
  };
  return c.json(res);
});

internal.post('/users/:id/role', async (c) => {
  const db = c.env.DB;
  const me = c.get('user');
  if (me.role !== 'admin') return c.json({ error: 'only an admin changes roles' }, 403);
  const body = await c.req.json<{ role?: unknown }>().catch(() => ({}) as { role?: unknown });
  if (!isRole(body.role)) return c.json({ error: `role must be one of ${ROLES.join(', ')}` }, 400);
  const target = await getUser(db, c.req.param('id'));
  if (!target) return c.json({ error: 'not found' }, 404);
  if (target.id === me.id) return c.json({ error: 'you cannot change your own role' }, 400);
  // A role that can no longer make codes takes back the unused ones (invites.ts), in the same batch.
  await db.batch([db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, target.id), revokeIfCannotInvite(db, target.id, me.id)]);
  await audit(db, me.id, 'user.role', 'user', target.id, target.role, body.role);
  return c.json({ user: { id: target.id, name: target.display_name, handle: target.handle, role: body.role } });
});

interface LogRow { id: number; at: string; level: LogEntry['level']; area: string; method: string; path: string; status: number; ms: number; actor_id: string | null; actor_name: string | null; message: string }

// The app's own log: what happened, where and by whom. Super admins only, because it names people. No bodies, and nothing from the
// private areas (journal, wellbeing, Companion, Discover, assistant) beyond a bare server-error line.
// How many D1 queries one invocation may really make on this account (Cloudflare's own pages say 50 on Workers Free in one place and 1,000 to its services in another). It only asks
// `SELECT 1`, so it changes nothing and reads no rows, and it stops at the first refusal. A super admin opens it once after a deploy (docs/performance.md, the Free plan section).
// Never under the guard: the test server has no such limit, and the smoke suite's own ceiling would see a thousand trips.
internal.get('/platform-limit', async (c) => {
  if (roleRank(c.get('user').role) < roleRank('admin')) return c.json({ error: 'only a super admin runs this' }, 403);
  const db = c.env.DB;
  const before = tripsOf(db);
  let queries = 0;
  let refused = '';
  const most = c.env.D1_GUARD ? 2 : 1100;
  while (queries < most) {
    try {
      await db.prepare('SELECT 1 AS x').first();
      queries += 1;
    } catch (e) {
      refused = e instanceof Error ? e.message.slice(0, 120) : 'refused';
      break;
    }
  }
  return c.json({ queries: queries + before, refused, plan: refused ? `This invocation stopped at ${queries + before} queries.` : `No limit met in ${queries + before} queries.` });
});

internal.get('/logs', async (c) => {
  const user = c.get('user');
  if (roleRank(user.role) < roleRank('admin')) return c.json({ error: 'only a super admin reads the logs' }, 403);
  const db = c.env.DB;
  const ask = pageOf(c);
  const level = c.req.query('level');
  const area = (c.req.query('area') ?? '').slice(0, 40);
  const actor = (c.req.query('actor') ?? '').slice(0, 60);
  const q = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 60);
  const where: string[] = [];
  const binds: unknown[] = [];
  if (level === 'info' || level === 'warn' || level === 'error') {
    where.push('level = ?');
    binds.push(level);
  }
  if (area) {
    where.push('area = ?');
    binds.push(area);
  }
  if (actor) {
    where.push('actor_id = ?');
    binds.push(actor);
  }
  if (q) {
    where.push("(LOWER(path) LIKE ? OR LOWER(message) LIKE ? OR LOWER(COALESCE(actor_name, '')) LIKE ? OR actor_id = ?)");
    binds.push(`%${likeFit(q)}%`, `%${likeFit(q)}%`, `%${likeFit(q)}%`, q);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  // The counts and the filters list the last day, not the last week, and come from one read of its lines: each filter tap asks again, on the free plan's 5 million rows a day.
  const [rows, lines] = await Promise.all([
    db.prepare(`SELECT * FROM app_logs ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<LogRow>(),
    db.prepare('SELECT level, area, actor_id, MAX(actor_name) AS actor_name, COUNT(*) AS n FROM app_logs WHERE at >= ? GROUP BY level, area, actor_id').bind(since24).all<{ level: string; area: string; actor_id: string | null; actor_name: string | null; n: number }>(),
  ]);
  const pg = paged(rows.results, ask);
  const n = (l: string) => lines.results.reduce((sum, r) => (r.level === l ? sum + r.n : sum), 0);
  const byActor = new Map<string, { actor_id: string; actor_name: string | null; n: number }>();
  for (const r of lines.results) {
    if (r.actor_id === null) continue;
    const one = byActor.get(r.actor_id);
    if (one) {
      one.n += r.n;
      if (r.actor_name !== null && (one.actor_name === null || r.actor_name > one.actor_name)) one.actor_name = r.actor_name;
    } else byActor.set(r.actor_id, { actor_id: r.actor_id, actor_name: r.actor_name, n: r.n });
  }
  const areas = { results: [...new Set(lines.results.map((r) => r.area))].sort().map((area) => ({ area })) };
  const actors = { results: [...byActor.values()].sort((a, b) => b.n - a.n).slice(0, 60) };
  const res: LogsResponse = {
    logs: pg.items.map((r) => ({ id: r.id, at: r.at, level: r.level, area: r.area, method: r.method, path: r.path, status: r.status, ms: r.ms, actorId: r.actor_id, actorName: r.actor_name, message: r.message })),
    page: pg.page,
    last24h: { info: n('info'), warn: n('warn'), error: n('error') },
    areas: areas.results.map((r) => r.area),
    actors: actors.results.map((r) => ({ id: r.actor_id, name: r.actor_name ?? 'Unnamed', count: r.n })),
  };
  return c.json(res);
});
