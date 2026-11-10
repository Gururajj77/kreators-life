import { anonAliasFrom, normalizeCode, DEFAULT_ZONE, isCurrency, parseAppPrefs, parseDatePrefs, isRealDay, pageSizeOf, parseIdentities, parseRepeat, parsePriority, parseIntake, parseLifeArea, parseLinkBlocks, parseOpenKind, type InboxKind, type LinkBlock, type Page, type PageSize } from '@kreators/shared';
import { BADGE_STATS, BADGES, badgesFrom, canInvite as canInviteRule, communityRankOf, type CommunityRank, EMPTY_SOCIALS, isPrivateBadge, parsePublicSettings, HONORS, isStaffFor, levelFromXp, PERMISSIONS, roleRank, taskReadyAt, timeHonors, type BadgeFacts, type BadgesResponse, WAIT, type Node, type NodeKind, type Permission, type RelationshipKey, type Role, type Socials, type User } from '@kreators/shared';
import type { Context, Next } from 'hono';
import type { AppEnv } from './env';
import type { UserRow } from './env';
import { noteStmt } from './notes.ts';
import { CONNECT_PAY_KEY, CONNECT_PAYS } from './connectPay.ts';

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
  for_review?: number;
  habit?: number | null;
  /** The area of life it carries (migration 0085), or null for none. */
  life_area?: string | null;
  /** The time block the person picked for it (migration 0089), or null: it falls in the block its time sits in, or none. */
  time_block_id?: string | null;
  /** The kind of open business it carries (migration 0120), read through `parseOpenKind`, or null. */
  open_kind?: string | null;
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
/** Today's date in UTC, YYYY-MM-DD: a fallback only, since a person's day comes from their device (`dayFromDevice`). */
export const utcToday = () => new Date().toISOString().slice(0, 10);

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
export function pageOf(c: Context<AppEnv>, prefix = '', only?: { sizes: readonly PageSize[]; fallback: PageSize }): PageAsk {
  // A list with its own sizes (done tasks: 10, 25 or 50, ten by default) reads only its own prefix, never another list's `size`.
  const asked = only ? Number(c.req.query(`${prefix}size`)) : null;
  const size = only ? (only.sizes.includes(asked as PageSize) ? (asked as PageSize) : only.fallback) : pageSizeOf(c.req.query(`${prefix}size`) ?? c.req.query('size'));
  const page = Math.max(1, Math.min(100_000, Math.floor(Number(c.req.query(`${prefix}page`)) || 1)));
  return { page, size, limit: size + 1, offset: (page - 1) * size };
}
/** Trim the extra row off and say where the list is. */
export function paged<T>(rows: readonly T[], ask: PageAsk): { items: T[]; page: Page } {
  // A page past the first with nothing on it says so, so the screen steps back instead of showing an empty list with only Previous.
  return { items: rows.slice(0, ask.size), page: { page: ask.page, size: ask.size, more: rows.length > ask.size, ...(rows.length === 0 && ask.page > 1 ? { empty: true } : {}) } };
}
/** A list paged from 2026-11-07 on (the founder: "pagination for all lists"): 10, 25 or 50, ten by default, like the done tasks. Pass it to `pageOf`. */
export const TEN_A_PAGE: { sizes: readonly PageSize[]; fallback: PageSize } = { sizes: [10, 25, 50], fallback: 10 };

/** A day as YYYY-MM-DD that is on the calendar: 2026-11-31 and 2026-00-00 have the shape but are refused, so nothing downstream does arithmetic on an Invalid Date. */
export const DATE_RE = {
  /** The one calendar-day rule, `isRealDay` in shared. */
  test: (v: string): boolean => isRealDay(v),
};

/** The person's own day, sent by their device as `?day=`. A day more than one day ahead of UTC is not a real "today", so it falls back to the UTC date. */
export function dayFromDevice(v: string | undefined | null): string {
  const utc = new Date().toISOString().slice(0, 10);
  return v && DATE_RE.test(v) && v <= shiftDate(utc, 1) ? v : utc;
}

/** Today in an IANA zone, as YYYY-MM-DD (India's when the zone is missing or not one). */
export function dayInZone(zone: string | null | undefined, at = new Date()): string {
  return dayFormat(zone || DEFAULT_ZONE).format(at);
}
const DAY_FORMATS = new Map<string, Intl.DateTimeFormat>();
/** One formatter per zone, for the isolate's life: building one is the slow part (about 30 µs on a Mac, against 1 µs to use it), and a zone the runtime does not know reads as the default. */
function dayFormat(zone: string): Intl.DateTimeFormat {
  let fmt = DAY_FORMATS.get(zone);
  if (!fmt) {
    const opts = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    try {
      fmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: zone });
    } catch {
      fmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: DEFAULT_ZONE });
    }
    DAY_FORMATS.set(zone, fmt);
  }
  return fmt;
}

/**
 * The person's own day: the one their device sent (`?day=` or a body field), when it is a real day no further than one day from
 * their zone's today, else today in their zone (India's by default). Never the server's UTC date, which is still yesterday in
 * India until 05:30.
 */
export function personDay(device: string | undefined | null, zone: string | null | undefined): string {
  const own = dayInZone(zone);
  return device && DATE_RE.test(device) && device >= shiftDate(own, -1) && device <= shiftDate(own, 1) ? device : own;
}

/** The currency a person keeps their money in (migration 0070), rupees unless they changed it. */
export const currencyOf = (r: object): string => {
  const v = (r as { currency?: unknown }).currency;
  return isCurrency(v) ? v : 'INR';
};

/** An approved Club membership that has not run out. */
export async function isClubMember(db: D1Database, userId: string): Promise<boolean> {
  return Boolean(await db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND status IN ('approved','active') AND (ends_at IS NULL OR ends_at > ?)").bind(userId, nowIso()).first());
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The streak as it stands on a person's own day. `users.streak` only moves at a check-in, so one that lapsed still holds its old number until the next one: it counts while the last check-in was today or yesterday. */
export const streakNow = (streak: number, lastCheckin: string | null | undefined, day: string): number => (lastCheckin && lastCheckin >= shiftDate(day, -1) ? streak : 0);

/** A day someone may log for: `dateNearToday`, or their own today or yesterday in their zone. Someone behind UTC in their evening is a day behind the UTC date, and their yesterday is still theirs. */
export function dateNearOwnDay(date: string, zone: string | null | undefined, now: Date = new Date()): boolean {
  if (!DATE_RE.test(date)) return false;
  if (dateNearToday(date, now)) return true;
  const own = dayInZone(zone, now);
  return date <= own && date >= shiftDate(own, -1);
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
    timezone: r.timezone || DEFAULT_ZONE,
    currency: currencyOf(r),
    appPrefs: parseAppPrefs(r.app_prefs_json ?? null),
    datePrefs: parseDatePrefs(r.date_prefs_json ?? null),
    avatarUrl: r.avatar_url ?? '',
    socials: parseSocials(r.socials_json),
    links: linksOf(r),
    publicSettings: publicOf(r),
    streak: r.streak,
    bestStreak: r.best_streak,
    lastCheckin: r.last_checkin,
    onboardedAt: r.onboarded_at,
    attendeeEvent: r.attendee_event ?? null,
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

/** Who may make invite codes (2026-11-10): an admin, anyone on staff, or anyone holding Inviter. `canInvite` in shared is the one rule. */
export const canInvite = (user: Pick<UserRow, 'role' | 'permissions'>): boolean => canInviteRule({ role: user.role, permissions: parseList(user.permissions) });

/** A guide in Community and its channels: anyone holding the moderation permission (every admin does). The one guide rule. */
export const isGuide = (user: UserRow): boolean => can(user, 'moderation');
/** The team: an admin or a sub admin, whatever permissions they hold. Staff see an anonymous writer's id so a report can be acted on. */
export const isStaff = (user: Pick<UserRow, 'role'>): boolean => roleRank(user.role) >= roleRank('sub_admin');
/** Where a person sits for muting in Community (member, guide, staff, admin), from their role and permissions. */
export const rankOf = (user: Pick<UserRow, 'role' | 'permissions'>): CommunityRank => communityRankOf({ role: user.role, permissions: parseList(user.permissions) });
/** The signed-in person behind an admin request, or null when the admin key made it. */
export const actorOf = (c: { get: (k: 'user') => UserRow | undefined }): string | null => c.get('user')?.id ?? null;

export function auditStmt(db: D1Database, actorId: string | null, action: string, resourceType: string, resourceId: string | null, before: unknown = '', after: unknown = ''): D1PreparedStatement {
  const str = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v ?? '')).slice(0, 2000);
  return db
    .prepare('INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, before_summary, after_summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId(), actorId, action, resourceType, resourceId, str(before), str(after), nowIso());
}
export async function audit(db: D1Database, actorId: string | null, action: string, resourceType: string, resourceId: string | null, before: unknown = '', after: unknown = ''): Promise<void> {
  await auditStmt(db, actorId, action, resourceType, resourceId, before, after).run();
}

export async function orgRole(db: D1Database, orgId: string, userId: string): Promise<'owner' | 'member' | null> {
  const row = await db.prepare("SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? AND status = 'active'").bind(orgId, userId).first<{ role: 'owner' | 'member' }>();
  return row?.role ?? null;
}

export async function orgIdsOf(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare("SELECT organization_id FROM organization_members WHERE user_id = ? AND status = 'active'").bind(userId).all<{ organization_id: string }>();
  return rows.results.map((r) => r.organization_id);
}

/** A request's JSON body as a plain object: a body that is not JSON, or is JSON but not an object (`null`, a list, a number), reads as `{}`, so a route answers 400 from its own checks and never a 500. */
export async function objectBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const v: unknown = await c.req.json().catch(() => null);
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
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

/**
 * Someone by their email, their @username or their friend code (the one Bond uses). The one finder: Coaching and the Agency team use it.
 * Every write of users.email stores it lower case (sign-up, a device account adding one), as sign-in reads it, so `email = ?` with the
 * typed words lowered finds them through the unique index; LOWER(email) read every account (3,896 rows on one Connect send, 2026-11-10).
 */
export async function personBy(db: D1Database, who: string): Promise<UserRow | null> {
  const q = who.trim().toLowerCase();
  if (!q) return null;
  if (q.includes('@') && !q.startsWith('@')) return db.prepare('SELECT * FROM users WHERE email = ?').bind(q).first<UserRow>();
  const byHandle = await db.prepare('SELECT * FROM users WHERE handle = ?').bind(q.replace(/^@/, '')).first<UserRow>();
  if (byHandle) return byHandle;
  const code = normalizeCode(q);
  return code.length >= 8 ? db.prepare('SELECT * FROM users WHERE friend_code = ?').bind(code).first<UserRow>() : null;
}

/** The one statement that writes an inbox note, its kind an `InboxKind` (notes.ts); every other write goes through it. */
export { noteStmt, type Note, type NoteMode } from './notes.ts';

export async function notify(db: D1Database, userId: string, kind: InboxKind, title: string, body = '', link: string | null = null): Promise<void> {
  await noteStmt(db, { userId, kind, title, body, link }).run();
}

/**
 * Statements fifty at a time: one round trip per fifty instead of one per statement, the results in the order given (a read's
 * rows are `results[i].results`, a write's count `results[i].meta.changes`). The cron and the list routes use it in place of a
 * query inside a loop over rows.
 */
export async function inBatches<T = unknown>(db: D1Database, stmts: readonly D1PreparedStatement[], size = 50): Promise<D1Result<T>[]> {
  const out: D1Result<T>[] = [];
  for (let i = 0; i < stmts.length; i += size) out.push(...(await db.batch<T>(stmts.slice(i, i + size))));
  return out;
}

/** Every super admin, however many: the people a note to the team goes to. A note to them goes through `notifyMany`, fifty to a round trip. */
export async function adminIds(db: D1Database): Promise<string[]> {
  const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all<{ id: string }>();
  return admins.results.map((a) => a.id);
}

/** The same note for many people: one round trip per fifty, not one per person. Same rows `notify` would write. */
export async function notifyMany(db: D1Database, userIds: readonly string[], kind: InboxKind, title: string, body = '', link: string | null = null): Promise<void> {
  const now = nowIso();
  await inBatches(
    db,
    [...new Set(userIds)].map((uid) => noteStmt(db, { userId: uid, kind, title, body, link, at: now })),
  );
}

/**
 * What a block does, the one rule (2026-11-07). A block by name (Bond's Block, or from a named line; `blocks.by_name = 1`) works both ways on everything
 * with a name on it. A block behind a made-up name (`block_aliases`) touches only anonymous writing. Neither crosses over, because each crossing tells who
 * an anonymous writer is: block a suspect by name and see an anonymous post vanish, or block a made-up name and see a named post vanish.
 * `blockedByName` is the check for anything named (a friend request, a chat, an ask, a row on a board), `hiddenByBlock` for a line that may be anonymous
 * (`anon` is an SQL expression that is 1 for an anonymous line). All arguments are SQL: a column or a numbered parameter.
 */
export const blockedByName = (a: string, b: string): string =>
  `EXISTS (SELECT 1 FROM blocks bn WHERE bn.by_name = 1 AND ((bn.blocker_id = ${a} AND bn.blocked_id = ${b}) OR (bn.blocker_id = ${b} AND bn.blocked_id = ${a})))`;
/**
 * Whether a block keeps a line from a viewer. The writer's own block, of any kind, always does: nobody reads someone who blocked them, and the viewer can test no suspect with it.
 * The viewer's own block reaches only its kind: a block by name their named lines, a block behind a made-up name their anonymous ones.
 */
export const hiddenByBlock = (viewer: string, writer: string, anon: string): string =>
  `(EXISTS (SELECT 1 FROM blocks bw WHERE bw.blocker_id = ${writer} AND bw.blocked_id = ${viewer}) OR CASE WHEN ${anon} = 1 THEN EXISTS (SELECT 1 FROM block_aliases ba WHERE ba.blocker_id = ${viewer} AND ba.blocked_id = ${writer}) ELSE EXISTS (SELECT 1 FROM blocks bv WHERE bv.by_name = 1 AND bv.blocker_id = ${viewer} AND bv.blocked_id = ${writer}) END)`;
/** Whether either of two people has blocked the other by name. A block reads like nobody, so callers answer as they would for no such person. */
export async function blockedEither(db: D1Database, a: string, b: string): Promise<boolean> {
  const row = await db.prepare(`SELECT ${blockedByName('?1', '?2')} AS x`).bind(a, b).first<{ x: number }>();
  return row?.x === 1;
}
/** Of these people, the ones who would see this writer's line, so a note about it goes only to them: a note never says more than the line does. */
export async function seenBy(db: D1Database, writerId: string, anonymous: boolean, ids: readonly (string | null | undefined)[]): Promise<Set<string>> {
  const asked = [...new Set(ids.filter((id): id is string => Boolean(id) && id !== writerId))];
  if (asked.length === 0) return new Set();
  const rows = await db.prepare(`SELECT j.value AS id FROM json_each(?1) j WHERE NOT ${hiddenByBlock('j.value', '?2', '?3')}`).bind(JSON.stringify(asked), writerId, anonymous ? 1 : 0).all<{ id: string }>();
  return new Set(rows.results.map((r) => r.id));
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
  // One batch for every chunk of 80: a single round trip however long the list is.
  const parts: string[][] = [];
  for (let i = 0; i < ids.length; i += 80) parts.push(ids.slice(i, i + 80));
  const found = await db.batch<{ task_id: string; total: number; done: number }>(
    parts.map((part) =>
      db
        .prepare(`SELECT task_id, COUNT(*) AS total, SUM(CASE WHEN done_at IS NULL THEN 0 ELSE 1 END) AS done FROM subtasks WHERE user_id = ? AND task_id IN (${part.map(() => '?').join(',')}) GROUP BY task_id`)
        .bind(userId, ...part),
    ),
  );
  for (const rows of found) for (const r of rows.results) counts.set(r.task_id, { total: r.total, done: r.done ?? 0 });
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
    forReview: (r.for_review ?? 0) === 1,
    habit: r.habit === null || r.habit === undefined ? null : r.habit === 1,
    lifeArea: parseLifeArea(r.life_area),
    timeBlockId: r.time_block_id ?? null,
    openKind: parseOpenKind(r.open_kind),
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

/** A person by id, email, @username or friend code; a deleted member reads as nobody. Connect people and the cohort page's manager field. */
export async function findPerson(db: D1Database, who: string): Promise<UserRow | null> {
  const q = who.trim();
  if (!q) return null;
  const byId = /^[\w-]{8,64}$/.test(q) ? await getUser(db, q) : null;
  const u = byId ?? (await personBy(db, q));
  return u && u.display_name !== DELETED_NAME ? u : null;
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
  /** Every count a badge rule reads, except the two that come from the user row (best streak and level). */
  facts: Omit<BadgeFacts, 'best_streak' | 'level'>;
}

/** What a task tick is gated on: how many the person has ever ticked, and when the last one was. */
export interface TaskGate {
  doneCount: number;
  lastDoneAt: string | null;
}

export async function taskGate(db: D1Database, userId: string): Promise<TaskGate> {
  // Only "under the free first few" is ever asked of the count, and the last tick is the end of an index, so a person with a thousand ticks reads a few rows, not a thousand.
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM (SELECT 1 FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' LIMIT ?2)) AS n,
        (SELECT completed_at FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' ORDER BY completed_at DESC LIMIT 1) AS last`,
    )
    .bind(userId, WAIT.freeFirstTasks)
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
  // One read for every count a badge rule uses. Each column is named after its stat in BADGE_STATS; each is an indexed count for this person
  // and nothing here reads a word anyone wrote (the journal and the trackers are counted, never opened).
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done') AS tasks_done,
        (SELECT COUNT(DISTINCT relationship) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done') AS tasks_pillars,
        (SELECT COUNT(*) FROM spark_completions WHERE user_id = ?1) AS sparks_done,
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'project' AND status = 'done') AS projects_cleared,
        (SELECT COUNT(DISTINCT relationship) FROM nodes WHERE user_id = ?1 AND kind = 'pillar' AND status != 'archived') AS pillars_set,
        (SELECT COUNT(*) FROM not_to_do_days WHERE user_id = ?1 AND status = 'kept') AS not_to_do_kept,
        (SELECT COUNT(*) FROM focus_rounds WHERE user_id = ?1) AS focus_rounds,
        (SELECT COALESCE(SUM(minutes), 0) FROM focus_rounds WHERE user_id = ?1) AS focus_minutes,
        (SELECT COUNT(*) FROM journal_entries WHERE user_id = ?1) AS journal_entries,
        (SELECT COUNT(*) FROM reviews WHERE user_id = ?1) AS reviews_written,
        (SELECT COUNT(DISTINCT date) FROM wellbeing_logs WHERE user_id = ?1 AND kind = 'mood') AS mood_days,
        (SELECT COUNT(*) FROM wellbeing_logs WHERE user_id = ?1 AND kind = 'mindful') AS mindful_logs,
        (SELECT COUNT(*) FROM discover_results WHERE user_id = ?1) AS discover_taken,
        (SELECT COUNT(*) FROM community_posts WHERE user_id = ?1 AND anonymous = 0 AND hidden_at IS NULL AND held_at IS NULL) AS posts,
        (SELECT COUNT(*) FROM community_replies WHERE user_id = ?1 AND anonymous = 0 AND hidden_at IS NULL) AS replies,
        (SELECT COUNT(*) FROM friendships WHERE requester_id = ?1 AND status = 'accepted') + (SELECT COUNT(*) FROM friendships WHERE recipient_id = ?1 AND status = 'accepted') AS friends,
        (SELECT COUNT(*) FROM follows WHERE owner_id = ?1) AS followers,
        (SELECT COUNT(*) FROM users WHERE referred_by = (SELECT referral_code FROM users WHERE id = ?1) AND email IS NOT NULL) AS referrals,
        (SELECT COUNT(*) FROM attendee_claims WHERE user_id = ?1) AS events_claimed,
        (SELECT COUNT(*) FROM products WHERE owner_id = ?1 AND status = 'live') AS products_live,
        (SELECT COUNT(*) FROM orders WHERE owner_id = ?1 AND status = 'paid' AND buyer_id != ?1) AS sales,
        (SELECT COUNT(*) FROM bounty_submissions WHERE user_id = ?1 AND status = 'paid') AS bounties_paid,
        (SELECT COUNT(*) FROM finance_transactions WHERE user_id = ?1 AND source = 'manual') AS finance_entries,
        (SELECT COUNT(*) FROM finance_goals WHERE user_id = ?1 AND target_cents > 0 AND saved_cents >= target_cents) AS finance_goals_done,
        (SELECT COUNT(*) FROM invoices WHERE user_id = ?1 AND status = 'paid') AS invoices_paid,
        (SELECT COUNT(*) FROM run_entries WHERE user_id = ?1 AND status = 'logged') AS runs_logged,
        (SELECT COALESCE(SUM(metres), 0) FROM run_entries WHERE user_id = ?1 AND status = 'logged') AS run_metres,
        (SELECT COUNT(*) FROM lesson_progress WHERE user_id = ?1) AS lessons_done,
        (SELECT COUNT(*) FROM certificates WHERE user_id = ?1) AS certificates,
        (SELECT COUNT(*) FROM memberships WHERE user_id = ?1 AND status IN ('accepted', 'member', 'active')) AS club,
        (SELECT COUNT(*) FROM invite_codes WHERE created_by = ?1 AND active_at IS NOT NULL) AS invites_joined,
        (SELECT COUNT(DISTINCT k) FROM (SELECT ${CONNECT_PAY_KEY('t')} AS k FROM team_connections t WHERE t.first_user_id = ?1 AND t.came_true_at IS NOT NULL AND ${CONNECT_PAYS('t', '?1')}
           UNION ALL SELECT ${CONNECT_PAY_KEY('t')} FROM team_connections t WHERE t.second_user_id = ?1 AND t.came_true_at IS NOT NULL AND ${CONNECT_PAYS('t', '?1')})) AS connections_made`,
    )
    .bind(userId)
    .first<Record<string, number>>();
  const facts = {} as Stats['facts'];
  for (const k of BADGE_STATS) if (k !== 'best_streak' && k !== 'level') facts[k] = row?.[k] ?? 0;
  return {
    tasksDone: facts.tasks_done,
    sparksDone: facts.sparks_done,
    projectsCleared: facts.projects_cleared,
    relationshipsWithPillars: facts.pillars_set,
    clubMember: facts.club > 0,
    runsLogged: facts.runs_logged,
    runMetres: facts.run_metres,
    facts,
  };
}

/** How long the counts behind the badges stay on the person's row (`users.stats_json`). A tick and the badge gallery always bring them up to date. */
const STATS_KEEP_MS = 3_600_000;

function statsFromFacts(facts: Stats['facts']): Stats {
  return { tasksDone: facts.tasks_done, sparksDone: facts.sparks_done, projectsCleared: facts.projects_cleared, relationshipsWithPillars: facts.pillars_set, clubMember: facts.club > 0, runsLogged: facts.runs_logged, runMetres: facts.run_metres, facts };
}

/** Keeps the counts on the person's row. One row written, no index touched. */
export async function storeStats(db: D1Database, userId: string, stats: Stats): Promise<void> {
  await db.prepare('UPDATE users SET stats_json = ?, stats_at = ? WHERE id = ?').bind(JSON.stringify(stats.facts), nowIso(), userId).run();
}

/**
 * The counts behind the badges, from the person's row when they are under an hour old. `getStats` visits every row it counts, about 2,400 for three months of use, and
 * /me is read after every write, which on the free plan's 5 million rows a day was a third of what an active person cost (2026-11-07). So a badge from something other than
 * a tick can show up to an hour late on Profile; the gallery reads fresh, and so does an unlock.
 */
export async function keptStats(db: D1Database, user: { id: string; stats_json?: string | null; stats_at?: string | null }): Promise<Stats> {
  if (user.stats_json && user.stats_at && Date.now() - Date.parse(user.stats_at) < STATS_KEEP_MS) {
    try {
      return statsFromFacts(JSON.parse(user.stats_json) as Stats['facts']);
    } catch {
      // read them again
    }
  }
  const stats = await getStats(db, user.id);
  await storeStats(db, user.id, stats);
  return stats;
}

/** The counts one tick moves, from the kept ones: a task done, maybe a project cleared, maybe a pillar's first tick. The rest of the counts did not change. */
export async function statsAfterTick(db: D1Database, kept: Stats, tick: { userId: string; taskId: string; relationship: string; projectCleared: boolean }): Promise<Stats> {
  const another = await db.prepare("SELECT 1 AS x FROM nodes WHERE user_id = ? AND relationship = ? AND kind = 'task' AND status = 'done' AND id != ? LIMIT 1").bind(tick.userId, tick.relationship, tick.taskId).first();
  const facts = { ...kept.facts, tasks_done: kept.facts.tasks_done + 1, projects_cleared: kept.facts.projects_cleared + (tick.projectCleared ? 1 : 0), tasks_pillars: kept.facts.tasks_pillars + (another ? 0 : 1) };
  return statsFromFacts(facts);
}

/** Every count at zero, for a place that knows only some of them (the leaderboard's pool). */
export const emptyFacts = (): Stats['facts'] => Object.fromEntries(BADGE_STATS.filter((k) => k !== 'best_streak' && k !== 'level').map((k) => [k, 0])) as Stats['facts'];

/** The counts the rules read for one person: the stats plus the two that sit on the user row. */
export function factsFor(user: { xp: number; best_streak: number }, stats: Pick<Stats, 'facts'>): BadgeFacts {
  return { ...stats.facts, best_streak: user.best_streak, level: levelFromXp(user.xp) };
}

/** The badges a person's counts earn right now, in catalogue order. */
export function computeBadges(user: { xp: number; best_streak: number }, stats: Pick<Stats, 'facts'>): string[] {
  return badgesFrom(factsFor(user, stats));
}

/** Badges a super admin gave by hand. */
export async function grantedBadges(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT badge_key FROM badge_grants WHERE user_id = ?').bind(userId).all<{ badge_key: string }>();
  return rows.results.map((r) => r.badge_key);
}
/** Earned dates were first kept on this day. An older account seen for the first time gets the badges it already had with no date. */
const BADGE_DATES_FROM = '2026-11-02';

/**
 * Everything about a person's badges in one go: what their counts earn now, what was earned before (a badge once earned is never taken back,
 * even when a count drops, like a deleted post), what the team gave by hand, and when each was earned. New ones are written to `badge_awards`
 * (INSERT OR IGNORE, so two taps at once earn once) unless `persist` is off, as on someone else's public page.
 */
export async function badgeState(
  db: D1Database,
  user: Pick<UserRow, 'id' | 'xp' | 'best_streak' | 'created_at'>,
  opts: { stats?: Stats; persist?: boolean } = {},
): Promise<{ keys: string[]; facts: BadgeFacts; at: Map<string, string | null>; given: Set<string> }> {
  const [stats, granted, stored] = await Promise.all([
    opts.stats ? Promise.resolve(opts.stats) : getStats(db, user.id),
    grantedBadges(db, user.id),
    db.prepare('SELECT badge_key, earned_at FROM badge_awards WHERE user_id = ?').bind(user.id).all<{ badge_key: string; earned_at: string | null }>(),
  ]);
  const facts = factsFor(user, stats);
  const at = new Map(stored.results.map((r) => [r.badge_key, r.earned_at]));
  const fresh = badgesFrom(facts).filter((k) => !at.has(k));
  if (fresh.length) {
    const when = stored.results.length === 0 && user.created_at < BADGE_DATES_FROM ? null : nowIso();
    if (opts.persist !== false) {
      await db.batch(fresh.map((k) => db.prepare('INSERT OR IGNORE INTO badge_awards (user_id, badge_key, earned_at) VALUES (?, ?, ?)').bind(user.id, k, when)));
    }
    for (const k of fresh) at.set(k, when);
  }
  const given = new Set(granted);
  const have = new Set([...at.keys(), ...given]);
  return { keys: BADGES.map((b) => b.key).filter((k) => have.has(k)), facts, at, given };
}

export async function badgesNow(db: D1Database, userId: string): Promise<string[]> {
  const user = await getUser(db, userId);
  if (!user) return [];
  return (await badgeState(db, user)).keys;
}

/** What the badge gallery reads: what is held, when it was earned, and the counts behind every rule. Owner only. */
export async function badgesFor(db: D1Database, user: UserRow): Promise<BadgesResponse> {
  const stats = await getStats(db, user.id);
  await storeStats(db, user.id, stats);
  const s = await badgeState(db, user, { stats });
  return { held: s.keys.map((key) => ({ key, at: s.at.get(key) ?? null, given: s.given.has(key) && !s.at.has(key) })), progress: s.facts };
}

/** The badges anyone may see on a person's page: the held ones, minus the private families (journal, money, focus). */
export const publicBadgeKeys = (keys: readonly string[]): string[] => keys.filter((k) => !isPrivateBadge(k));

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

/** A link a person types that other people then open (a meeting, a replay, a video, an event, a product's file, a portfolio piece, a hand-in, Army work): http or https only, up to `max` characters, else empty. javascript: and data: never get stored. */
export function httpUrl(v: unknown, max = 500): string {
  const t = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return /^https?:\/\/\S+$/i.test(t) ? t : '';
}
/** What an optional link field answers when something other than a link was typed, so a typed link is refused out loud and never quietly lost. */
export const LINK_PROBLEM = 'a link that starts with https://';
export const badLink = (v: unknown, max = 500): boolean => str(v, max) !== '' && !httpUrl(v, max);

/**
 * D1 refuses a LIKE or GLOB pattern over 50 bytes (a 500), and a Hindi letter takes three. Typed words go through this before they go into a pattern: cut on a whole
 * letter to what fits, which leaves room for a `%` at each end, so a long search still answers.
 */
export function likeFit(typed: string, room = 48): string {
  let bytes = 0;
  let out = '';
  for (const ch of typed) {
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (bytes > room) break;
    out += ch;
  }
  return out;
}

/** A deleted account keeps its row (orders and invoices stay true for the books) under this name, and appears in no list of people
 * and in no count of members. `liveUser('u')` is the condition for a query over users aliased `u`. */
export const DELETED_NAME = 'Deleted member';
export const liveUser = (alias = 'u'): string => `${alias}.display_name != '${DELETED_NAME}'`;
/** Nobody alive may take that name, in any spelling of its case or spaces, or they would vanish from every list `liveUser` guards. Every door that sets a name asks this. */
export const isDeletedName = (v: unknown): boolean => typeof v === 'string' && v.trim().replace(/\s+/g, ' ').toLowerCase() === DELETED_NAME.toLowerCase();
export const DELETED_NAME_PROBLEM = 'that name is kept for closed accounts. Pick another one.';
