import { anonAliasFrom, pageSizeOf, parseIdentities, parseRepeat, parsePriority, parseIntake, parseLinkBlocks, type LinkBlock, type Page, type PageSize } from '@kreators/shared';
import { BADGES, EMPTY_SOCIALS, parsePublicSettings, HONORS, isStaffFor, levelFromXp, PERMISSIONS, RELATIONSHIPS, roleRank, RUN_BADGES, taskReadyAt, timeHonors, WAIT, type Node, type NodeKind, type Permission, type RelationshipKey, type Role, type Socials, type User } from '@kreators/shared';
import type { Context, Next } from 'hono';
import type { AppEnv } from './env';
import type { UserRow } from './env';

export interface NodeRow {
  id: string;
  user_id: string;
  kind: NodeKind;
  parent_id: string | null;
  relationship: RelationshipKey;
  title: string;
  note: string;
  status: 'active' | 'done' | 'archived';
  xp: number;
  due_date: string | null;
  due_time: string | null;
  priority?: number | null;
  origin?: string | null;
  remind?: number;
  do_date?: string | null;
  repeat_json?: string | null;
  spawned_from?: string | null;
  estimate_min: number | null;
  completed_at: string | null;
  ready_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** The life coach who added this task, when one did. */
  added_by?: string | null;
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** When a task written now can first be ticked. */
export const readyFromNow = () => new Date(Date.now() + WAIT.taskMinAgeMinutes * 60_000).toISOString();

/** The page a list was asked for: ?page=N&size=S, with a prefix when one screen pages two lists. */
export interface PageAsk {
  page: number;
  size: PageSize;
  /** One more than the size, so the extra row says whether there is a next page. */
  limit: number;
  offset: number;
}
export function pageOf(c: Context<AppEnv>, prefix = ''): PageAsk {
  const size = pageSizeOf(c.req.query(`${prefix}size`) ?? c.req.query('size'));
  const page = Math.max(1, Math.min(100_000, Math.floor(Number(c.req.query(`${prefix}page`)) || 1)));
  return { page, size, limit: size + 1, offset: (page - 1) * size };
}
/** Trim the extra row off and say where the list is. */
export function paged<T>(rows: readonly T[], ask: PageAsk): { items: T[]; page: Page } {
  return { items: rows.slice(0, ask.size), page: { page: ask.page, size: ask.size, more: rows.length > ask.size } };
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** An approved Club membership that has not run out. */
export async function isClubMember(db: D1Database, userId: string): Promise<boolean> {
  return Boolean(await db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND status IN ('approved','active') AND (ends_at IS NULL OR ends_at > ?)").bind(userId, nowIso()).first());
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True when a client-supplied calendar date is today, give or take the allowed window. Stops future check-ins. */
export function dateNearToday(date: string, now: Date = new Date()): boolean {
  if (!DATE_RE.test(date)) return false;
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(t - n) <= WAIT.dateWindowDays * 86_400_000;
}

export function toUser(r: UserRow): User {
  return {
    id: r.id,
    displayName: r.display_name,
    focus: r.creator_type,
    xp: r.xp,
    points: r.points,
    isPro: r.is_pro === 1,
    leaderboardOptIn: r.leaderboard_opt_in === 1,
    role: r.role,
    email: r.email,
    phone: r.phone ?? '',
    birthDate: r.birth_date ?? '',
    handle: r.handle,
    friendCode: r.friend_code,
    bio: r.bio,
    reminderTime: r.reminder_time,
    referralCode: r.referral_code,
    modules: parseModules(r.modules),
    permissions: parseList(r.permissions).filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p)),
    skills: parseList(r.skills),
    categories: parseList(r.categories),
    goals: parseList(r.goals),
    experienceLevel: r.experience_level,
    availability: r.availability,
    location: r.location,
    openToIntros: r.open_to_intros === 1,
    interests: parseList(r.interests),
    identities: parseIdentities(parseList(r.identities)),
    intake: parseIntake(r.intake_json),
    city: r.city ?? '',
    area: r.area ?? '',
    hasLocation: r.lat !== null && r.lat !== undefined && r.lng !== null && r.lng !== undefined,
    timezone: r.timezone || 'Asia/Kolkata',
    avatarUrl: r.avatar_url ?? '',
    socials: parseSocials(r.socials_json),
    links: linksOf(r),
    publicSettings: publicOf(r),
    streak: r.streak,
    bestStreak: r.best_streak,
    lastCheckin: r.last_checkin,
    onboardedAt: r.onboarded_at,
    createdAt: r.created_at,
  };
}

export function parseModules(raw: string): Record<string, boolean> {
  try {
    const v = JSON.parse(raw || '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function parseSocials(raw: string | null | undefined): Socials {
  try {
    const v = (JSON.parse(raw || '{}') ?? {}) as Record<string, unknown>;
    const pick = (k: keyof Socials) => (typeof v[k] === 'string' ? (v[k] as string).slice(0, 200) : '');
    return { instagram: pick('instagram'), youtube: pick('youtube'), x: pick('x'), website: pick('website') };
  } catch {
    return { ...EMPTY_SOCIALS };
  }
}

export function parseList(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const nameOf = (r: { display_name: string }) => r.display_name || 'Anonymous climber';

/** Does this person hold a staff permission? Admins hold all of them. */
export function can(user: UserRow, perm: Permission): boolean {
  return isStaffFor({ role: user.role, permissions: parseList(user.permissions) }, perm);
}

/** Middleware: requires a staff permission. */
export function requirePermission(perm: Permission) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user');
    if (!user || !can(user, perm)) return c.json({ error: 'you do not have access to that' }, 403);
    await next();
  };
}

export async function audit(db: D1Database, actorId: string | null, action: string, resourceType: string, resourceId: string | null, before: unknown = '', after: unknown = ''): Promise<void> {
  const str = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v ?? '')).slice(0, 2000);
  await db
    .prepare('INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, before_summary, after_summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId(), actorId, action, resourceType, resourceId, str(before), str(after), nowIso())
    .run();
}

export async function orgRole(db: D1Database, orgId: string, userId: string): Promise<'owner' | 'member' | null> {
  const row = await db.prepare("SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? AND status = 'active'").bind(orgId, userId).first<{ role: 'owner' | 'member' }>();
  return row?.role ?? null;
}

export async function orgIdsOf(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare("SELECT organization_id FROM organization_members WHERE user_id = ? AND status = 'active'").bind(userId).all<{ organization_id: string }>();
  return rows.results.map((r) => r.organization_id);
}

export const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
export const num = (v: unknown, fallback: number | null, lo = -1e12, hi = 1e12): number | null => {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
};
export const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(String(v)) ? (v as T) : fallback);

/** Resolve the bearer session on a request, or null. */
export async function sessionUser(c: Context<AppEnv>): Promise<UserRow | null> {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  return c.env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').bind(token).first<UserRow>();
}

/** Middleware: the signed-in person must hold at least this role. */
export function requireRole(min: Role) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user');
    if (!user || roleRank(user.role) < roleRank(min)) return c.json({ error: 'you do not have access to that' }, 403);
    await next();
  };
}

export async function notify(db: D1Database, userId: string, kind: string, title: string, body = '', link: string | null = null): Promise<void> {
  await db
    .prepare('INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)')
    .bind(newId(), userId, kind, title, body, link, nowIso())
    .run();
}

/** The made-up name someone writes under in one conversation (`scope`): the same all through it, different in the next, and not reversible without the salt. */
export async function anonAlias(env: { CLICK_SALT?: string }, userId: string, scope: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.CLICK_SALT ?? 'kreators-local'}:anon:${scope}:${userId}`)));
  return anonAliasFrom(bytes);
}

/** A username every account starts with; the person can change it under Profile. */
export function newHandle(): string {
  return `user_${randomCode(6).toLowerCase()}`;
}

/** The code a person shares so others can send them a friend request in Bond. */
export function newFriendCode(): string {
  return randomCode(8);
}

export function randomCode(len = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Puts the size of each task's checklist on the tasks in a list, in one query. */
export async function withSubtasks(db: D1Database, userId: string, list: Node[]): Promise<Node[]> {
  const ids = list.filter((n) => n.kind === 'task').map((n) => n.id);
  if (ids.length === 0) return list;
  const counts = new Map<string, { total: number; done: number }>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const rows = await db
      .prepare(`SELECT task_id, COUNT(*) AS total, SUM(CASE WHEN done_at IS NULL THEN 0 ELSE 1 END) AS done FROM subtasks WHERE user_id = ? AND task_id IN (${part.map(() => '?').join(',')}) GROUP BY task_id`)
      .bind(userId, ...part)
      .all<{ task_id: string; total: number; done: number }>();
    for (const r of rows.results) counts.set(r.task_id, { total: r.total, done: r.done ?? 0 });
  }
  return list.map((n) => (n.kind === 'task' ? { ...n, subtaskTotal: counts.get(n.id)?.total ?? 0, subtaskDone: counts.get(n.id)?.done ?? 0 } : n));
}

export function toNode(r: NodeRow, gate?: TaskGate): Node {
  return {
    id: r.id,
    kind: r.kind,
    parentId: r.parent_id,
    relationship: r.relationship,
    title: r.title,
    note: r.note,
    status: r.status,
    xp: r.xp,
    dueDate: r.due_date,
    doDate: r.do_date ?? null,
    repeat: parseRepeat(r.repeat_json),
    priority: parsePriority(r.priority),
    fromPillar: r.origin === 'build',
    remind: (r.remind ?? 0) === 1,
    dueTime: r.due_time ?? null,
    estimateMin: r.estimate_min ?? null,
    completedAt: r.completed_at,
    readyAt: r.kind === 'task' ? (gate ? readyAtFor(r, gate) : taskReadyAt(r.created_at, r.ready_at)) : null,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    fromCoach: Boolean(r.added_by),
  };
}

export async function getUser(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function getNode(db: D1Database, userId: string, id: string): Promise<NodeRow | null> {
  return db.prepare('SELECT * FROM nodes WHERE id = ? AND user_id = ?').bind(id, userId).first<NodeRow>();
}

export async function ancestorsOf(db: D1Database, userId: string, node: NodeRow): Promise<NodeRow[]> {
  const out: NodeRow[] = [];
  let pid = node.parent_id;
  // The ladder is at most six deep, so a short loop is simpler than a recursive CTE.
  while (pid && out.length < 8) {
    const p = await getNode(db, userId, pid);
    if (!p) break;
    out.push(p);
    pid = p.parent_id;
  }
  return out;
}

export interface Stats {
  tasksDone: number;
  sparksDone: number;
  projectsCleared: number;
  relationshipsWithPillars: number;
  clubMember: boolean;
  /** Runs logged with a start code, and their metres, for the run badges. */
  runsLogged: number;
  runMetres: number;
}

/** What a task tick is gated on: how many the person has ever ticked, and when the last one was. */
export interface TaskGate {
  doneCount: number;
  lastDoneAt: string | null;
}

export async function taskGate(db: D1Database, userId: string): Promise<TaskGate> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n, MAX(completed_at) AS last FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done'")
    .bind(userId)
    .first<{ n: number; last: string | null }>();
  return { doneCount: row?.n ?? 0, lastDoneAt: row?.last ?? null };
}

/**
 * When a task can be ticked. The first few ticks ever are free; after that a task needs its minimum age
 * and a gap since the previous tick, so ticks are never back to back.
 */
export function readyAtFor(r: { created_at: string; ready_at: string | null }, gate: TaskGate): string {
  if (gate.doneCount < WAIT.freeFirstTasks) return r.created_at;
  const age = new Date(taskReadyAt(r.created_at, r.ready_at)).getTime();
  const gap = gate.lastDoneAt ? new Date(gate.lastDoneAt).getTime() + WAIT.gapMinutes * 60_000 : 0;
  return new Date(Math.max(age, gap)).toISOString();
}

export async function getStats(db: D1Database, userId: string): Promise<Stats> {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done') AS tasks_done,
        (SELECT COUNT(*) FROM spark_completions WHERE user_id = ?1) AS sparks_done,
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'project' AND status = 'done') AS projects_cleared,
        (SELECT COUNT(DISTINCT relationship) FROM nodes WHERE user_id = ?1 AND kind = 'pillar' AND status != 'archived') AS rels_with_pillars,
        (SELECT COUNT(*) FROM memberships WHERE user_id = ?1 AND status IN ('accepted', 'member', 'active')) AS club,
        (SELECT COUNT(*) FROM run_entries WHERE user_id = ?1 AND status = 'logged') AS runs_logged,
        (SELECT COALESCE(SUM(metres), 0) FROM run_entries WHERE user_id = ?1 AND status = 'logged') AS run_metres`,
    )
    .bind(userId)
    .first<{ tasks_done: number; sparks_done: number; projects_cleared: number; rels_with_pillars: number; club: number; runs_logged: number; run_metres: number }>();
  return {
    tasksDone: row?.tasks_done ?? 0,
    sparksDone: row?.sparks_done ?? 0,
    projectsCleared: row?.projects_cleared ?? 0,
    relationshipsWithPillars: row?.rels_with_pillars ?? 0,
    clubMember: (row?.club ?? 0) > 0,
    runsLogged: row?.runs_logged ?? 0,
    runMetres: row?.run_metres ?? 0,
  };
}

export function computeBadges(user: { xp: number; best_streak: number }, stats: Stats): string[] {
  const earned = new Set<string>();
  if (stats.tasksDone >= 1) earned.add('first_task');
  if (user.best_streak >= 3) earned.add('streak_3');
  if (user.best_streak >= 7) earned.add('streak_7');
  if (stats.relationshipsWithPillars >= RELATIONSHIPS.length) earned.add('all_seven');
  if (stats.tasksDone >= 10) earned.add('ten_tasks');
  if (stats.projectsCleared >= 1) earned.add('project_clear');
  if (levelFromXp(user.xp) >= 5) earned.add('level_5');
  if (stats.sparksDone >= 5) earned.add('spark_5');
  if (stats.clubMember) earned.add('club_member');
  if (stats.runsLogged >= RUN_BADGES.run_1.runs) earned.add('run_1');
  if (stats.runsLogged >= RUN_BADGES.run_10.runs) earned.add('run_10');
  if (stats.runMetres >= RUN_BADGES.run_100k.metres) earned.add('run_100k');
  return BADGES.map((b) => b.key).filter((k) => earned.has(k));
}

/** Badges a super admin gave by hand. */
export async function grantedBadges(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT badge_key FROM badge_grants WHERE user_id = ?').bind(userId).all<{ badge_key: string }>();
  return rows.results.map((r) => r.badge_key);
}
/** The badges the app counts plus the ones given by hand, in catalog order. */
export const withGranted = (earned: readonly string[], granted: readonly string[]): string[] => {
  const have = new Set([...earned, ...granted]);
  return BADGES.map((b) => b.key).filter((k) => have.has(k));
};

export async function badgesNow(db: D1Database, userId: string): Promise<string[]> {
  const user = await getUser(db, userId);
  if (!user) return [];
  return withGranted(computeBadges(user, await getStats(db, userId)), await grantedBadges(db, userId));
}

/** Honors stored by an admin plus the ones time has unlocked, in catalog order. */
export async function honorKeys(db: D1Database, user: UserRow): Promise<string[]> {
  const rows = await db.prepare('SELECT honor_key FROM honors WHERE user_id = ?').bind(user.id).all<{ honor_key: string }>();
  const have = new Set([...rows.results.map((r) => r.honor_key), ...timeHonors(user.created_at)]);
  return HONORS.map((h) => h.key).filter((k) => have.has(k));
}

export function diffBadges(before: string[], after: string[]): string[] {
  const prev = new Set(before);
  return after.filter((k) => !prev.has(k));
}

/** The person's public-page switches, with defaults for anything unset. */
/** The link blocks stored on a user row, already cleaned. */
export function linksOf(r: { links_json?: string | null }): LinkBlock[] {
  try {
    return parseLinkBlocks(JSON.parse(r.links_json || '[]'));
  } catch {
    return [];
  }
}

export function publicOf(r: { public_json?: string | null }): ReturnType<typeof parsePublicSettings> {
  try {
    return parsePublicSettings(JSON.parse(r.public_json || '{}'));
  } catch {
    return parsePublicSettings({});
  }
}
