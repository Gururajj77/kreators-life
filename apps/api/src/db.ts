import { BADGES, EMPTY_SOCIALS, HONORS, isStaffFor, levelFromXp, PERMISSIONS, RELATIONSHIPS, roleRank, taskReadyAt, timeHonors, WAIT, type Node, type NodeKind, type Permission, type RelationshipKey, type Role, type Socials, type User } from '@kreators/shared';
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
  estimate_min: number | null;
  completed_at: string | null;
  ready_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** When a task written now can first be ticked. */
export const readyFromNow = () => new Date(Date.now() + WAIT.taskMinAgeMinutes * 60_000).toISOString();

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    handle: r.handle,
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
    city: r.city ?? '',
    area: r.area ?? '',
    hasLocation: r.lat !== null && r.lat !== undefined && r.lng !== null && r.lng !== undefined,
    timezone: r.timezone || 'Asia/Kolkata',
    avatarUrl: r.avatar_url ?? '',
    socials: parseSocials(r.socials_json),
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

export function randomCode(len = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function toNode(r: NodeRow): Node {
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
    dueTime: r.due_time ?? null,
    estimateMin: r.estimate_min ?? null,
    completedAt: r.completed_at,
    readyAt: r.kind === 'task' ? taskReadyAt(r.created_at, r.ready_at) : null,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
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
}

export async function getStats(db: D1Database, userId: string): Promise<Stats> {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done') AS tasks_done,
        (SELECT COUNT(*) FROM spark_completions WHERE user_id = ?1) AS sparks_done,
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'project' AND status = 'done') AS projects_cleared,
        (SELECT COUNT(DISTINCT relationship) FROM nodes WHERE user_id = ?1 AND kind = 'pillar' AND status != 'archived') AS rels_with_pillars`,
    )
    .bind(userId)
    .first<{ tasks_done: number; sparks_done: number; projects_cleared: number; rels_with_pillars: number }>();
  return {
    tasksDone: row?.tasks_done ?? 0,
    sparksDone: row?.sparks_done ?? 0,
    projectsCleared: row?.projects_cleared ?? 0,
    relationshipsWithPillars: row?.rels_with_pillars ?? 0,
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
  return BADGES.map((b) => b.key).filter((k) => earned.has(k));
}

export async function badgesNow(db: D1Database, userId: string): Promise<string[]> {
  const user = await getUser(db, userId);
  if (!user) return [];
  return computeBadges(user, await getStats(db, userId));
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
