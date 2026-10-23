import { BADGES, HONORS, levelFromXp, RELATIONSHIPS, timeHonors, WAIT, type Node, type NodeKind, type RelationshipKey, type User } from '@kreators/shared';
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
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

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
    creatorType: r.creator_type,
    xp: r.xp,
    points: r.points,
    isPro: r.is_pro === 1,
    leaderboardOptIn: r.leaderboard_opt_in === 1,
    streak: r.streak,
    bestStreak: r.best_streak,
    lastCheckin: r.last_checkin,
    onboardedAt: r.onboarded_at,
    createdAt: r.created_at,
  };
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
    completedAt: r.completed_at,
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
