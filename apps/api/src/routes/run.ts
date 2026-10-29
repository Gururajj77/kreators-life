import { Hono } from 'hono';
import { MAX_RUN_METRES, MAX_RUN_MINUTES, normalizeCode, RUN_CODE_WINDOW, RUN_PACES, RUN_REWARD, runEntryState, weekStreak, type Run, type RunClub, type RunClubDetail, type RunCollab, type RunCollabApplication, type RunCollabsResponse, type RunEntry, type RunResponse, type RunTracking } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { newRunCode, setRunCode } from '../attendee';
import { audit, badgesNow, can, diffBadges, nameOf, newId, notify, nowIso, num, oneOf, orgIdsOf, orgRole, str, pageOf, paged } from '../db';

/**
 * Kreators Run: run clubs like meetups, with one difference that makes the points honest. Every run has a start code
 * the host shows at the line. Entering it inside the run's window logs the entry once, pays xp and points, and adds
 * the minutes to the Life movement score. Nobody is paid for a run they only claim.
 */
export const run = new Hono<AppEnv>();

interface ClubRow { id: string; name: string; city: string; description: string; pace: RunClub['pace']; meets: string; host_user_id: string; host_name: string; visibility: RunClub['visibility']; status: RunClub['status']; created_at: string; members: number; next_run_at: string | null; mine: number }
// ?1 is the viewer, ?2 is now. The rest of each query's binds follow.
const CLUB = `SELECT k.*, u.display_name AS host_name,
  (SELECT COUNT(*) FROM run_members m WHERE m.club_id = k.id AND m.status = 'member') AS members,
  (SELECT MIN(r.starts_at) FROM runs r WHERE r.club_id = k.id AND r.status = 'published' AND r.ends_at >= ?2) AS next_run_at,
  (SELECT COUNT(*) FROM run_members m WHERE m.club_id = k.id AND m.user_id = ?1 AND m.status = 'member') AS mine
  FROM run_clubs k JOIN users u ON u.id = k.host_user_id`;
const toClub = (r: ClubRow, viewer: string): RunClub => ({ id: r.id, name: r.name, city: r.city, description: r.description, pace: r.pace, meets: r.meets, hostId: r.host_user_id, hostName: nameOf({ display_name: r.host_name }), visibility: r.visibility, status: r.status, members: r.members, nextRunAt: r.next_run_at, mine: r.mine > 0 || r.host_user_id === viewer, host: r.host_user_id === viewer, createdAt: r.created_at });

interface RunRow { id: string; club_id: string; title: string; meeting_point: string; starts_at: string; ends_at: string; metres: number; code: string; xp: number; collab_id: string | null; collab_title: string | null; collab_brand: string | null; collab_giveaway: string | null; status: Run['status']; created_at: string; entries: number }
const RUN = `SELECT r.*, c.title AS collab_title, c.brand_name AS collab_brand, c.giveaway AS collab_giveaway,
  (SELECT COUNT(*) FROM run_entries e WHERE e.run_id = r.id AND e.status = 'logged') AS entries
  FROM runs r LEFT JOIN run_collabs c ON c.id = r.collab_id`;
const toRun = (r: RunRow, mine: RunEntry | null, showCode: boolean): Run => ({
  id: r.id,
  clubId: r.club_id,
  title: r.title,
  meetingPoint: r.meeting_point,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  metres: r.metres,
  code: showCode ? r.code : null,
  xp: r.xp,
  entryState: runEntryState(r.starts_at, r.ends_at),
  collab: r.collab_id ? { id: r.collab_id, title: r.collab_title ?? '', brand: r.collab_brand ?? '', giveaway: r.collab_giveaway ?? '' } : null,
  status: r.status,
  entries: r.entries,
  mine,
  createdAt: r.created_at,
});

interface EntryRow { id: string; run_id: string; club_id: string; user_id: string; name: string; metres: number; minutes: number; xp: number; points: number; status: RunEntry['status']; logged_at: string }
const ENTRY = 'SELECT e.*, u.display_name AS name FROM run_entries e JOIN users u ON u.id = e.user_id';
const toEntry = (r: EntryRow): RunEntry => ({ id: r.id, runId: r.run_id, userId: r.user_id, name: nameOf({ display_name: r.name }), metres: r.metres, minutes: r.minutes, status: r.status, loggedAt: r.logged_at });

interface CollabRow { id: string; title: string; brand_name: string; organization_id: string | null; created_by: string; brief: string; asks: string; giveaway: string; giveaway_count: number; city: string; starts_at: string; ends_at: string; status: RunCollab['status']; created_at: string; applications: number; accepted: number }
const COLLAB = `SELECT c.*,
  (SELECT COUNT(*) FROM run_collab_applications a WHERE a.collab_id = c.id) AS applications,
  (SELECT COUNT(*) FROM run_collab_applications a WHERE a.collab_id = c.id AND a.status = 'accepted') AS accepted
  FROM run_collabs c`;
interface AppRow { id: string; collab_id: string; club_id: string; club_name: string; host_name: string; user_id: string; note: string; status: RunCollabApplication['status']; created_at: string; collab_title?: string }
const APP = 'SELECT a.*, k.name AS club_name, u.display_name AS host_name FROM run_collab_applications a JOIN run_clubs k ON k.id = a.club_id JOIN users u ON u.id = a.user_id';
const toApp = (r: AppRow): RunCollabApplication => ({ id: r.id, collabId: r.collab_id, clubId: r.club_id, clubName: r.club_name, hostName: nameOf({ display_name: r.host_name }), note: r.note, status: r.status, createdAt: r.created_at });
const toCollab = (r: CollabRow, mine: RunCollabApplication[], poster: boolean): RunCollab => ({ id: r.id, title: r.title, brand: r.brand_name, organizationId: r.organization_id, posterId: r.created_by, brief: r.brief, asks: r.asks, giveaway: r.giveaway, giveawayCount: r.giveaway_count, city: r.city, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status, applications: r.applications, accepted: r.accepted, mine, poster, createdAt: r.created_at });

const isMember = async (db: D1Database, clubId: string, userId: string) => Boolean(await db.prepare("SELECT 1 FROM run_members WHERE club_id = ? AND user_id = ? AND status = 'member'").bind(clubId, userId).first());
const hostOf = (club: { host_user_id: string }, user: UserRow) => club.host_user_id === user.id || can(user, 'events');
const canPostCollab = async (db: D1Database, user: UserRow) => can(user, 'events') || (await orgIdsOf(db, user.id)).length > 0;

async function tracking(db: D1Database, userId: string): Promise<RunTracking> {
  const now = nowIso();
  const month = `${now.slice(0, 7)}-01T00:00:00`;
  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const [totals, days, badges] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS runs, COALESCE(SUM(metres), 0) AS metres, COALESCE(SUM(minutes), 0) AS minutes,
          COALESCE(SUM(CASE WHEN logged_at >= ?2 THEN 1 ELSE 0 END), 0) AS month_runs,
          COALESCE(SUM(CASE WHEN logged_at >= ?2 THEN metres ELSE 0 END), 0) AS month_metres
         FROM run_entries WHERE user_id = ?1 AND status = 'logged'`,
      )
      .bind(userId, month)
      .first<{ runs: number; metres: number; minutes: number; month_runs: number; month_metres: number }>(),
    db.prepare("SELECT substr(logged_at, 1, 10) AS date, SUM(metres) AS metres FROM run_entries WHERE user_id = ? AND status = 'logged' GROUP BY date ORDER BY date").bind(userId).all<{ date: string; metres: number }>(),
    badgesNow(db, userId),
  ]);
  const byDay = new Map(days.results.map((d) => [d.date, d.metres]));
  const list: { date: string; metres: number }[] = [];
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(new Date(`${since}T00:00:00Z`).getTime() + i * 86_400_000).toISOString().slice(0, 10);
    list.push({ date: d, metres: byDay.get(d) ?? 0 });
  }
  return {
    runs: totals?.runs ?? 0,
    metres: totals?.metres ?? 0,
    minutes: totals?.minutes ?? 0,
    monthRuns: totals?.month_runs ?? 0,
    monthMetres: totals?.month_metres ?? 0,
    weekStreak: weekStreak(days.results.map((d) => d.date), now.slice(0, 10)),
    days: list,
    badges: badges.filter((b) => b.startsWith('run_')),
  };
}

run.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const now = nowIso();
  const ask = pageOf(c);
  const [clubs, upcoming, mine, collabs, track] = await Promise.all([
    db.prepare(`${CLUB} WHERE k.status = 'active' AND (k.visibility = 'public' OR k.host_user_id = ?1 OR k.id IN (SELECT club_id FROM run_members WHERE user_id = ?1 AND status = 'member')) ORDER BY (next_run_at IS NULL), next_run_at, members DESC, k.created_at DESC LIMIT ? OFFSET ?`).bind(user.id, now, ask.limit, ask.offset).all<ClubRow>(),
    // Runs whose start code still works, done or not: people log a run on the way home.
    db.prepare(`${RUN} WHERE r.status IN ('published','done') AND r.ends_at >= ?2 AND r.club_id IN (SELECT club_id FROM run_members WHERE user_id = ?1 AND status = 'member') ORDER BY r.starts_at LIMIT 20`).bind(user.id, new Date(Date.now() - RUN_CODE_WINDOW.after * 60_000).toISOString()).all<RunRow>(),
    db.prepare(`${ENTRY} WHERE e.user_id = ? AND e.status = 'logged'`).bind(user.id).all<EntryRow>(),
    db.prepare("SELECT COUNT(*) AS n FROM run_collabs WHERE status = 'open' AND ends_at >= ?").bind(now).first<{ n: number }>(),
    tracking(db, user.id),
  ]);
  const myEntries = new Map(mine.results.map((e) => [e.run_id, toEntry(e)]));
  const hosted = new Set(clubs.results.filter((k) => k.host_user_id === user.id).map((k) => k.id));
  const pg = paged(clubs.results, ask);
  const res: RunResponse = {
    page: pg.page,
    clubs: pg.items.map((k) => toClub(k, user.id)),
    mine: clubs.results.filter((k) => k.mine > 0 || k.host_user_id === user.id).map((k) => toClub(k, user.id)),
    upcoming: upcoming.results.map((r) => toRun(r, myEntries.get(r.id) ?? null, hosted.has(r.club_id) || can(user, 'events'))),
    tracking: track,
    collabsOpen: collabs?.n ?? 0,
    canPostCollab: await canPostCollab(db, user),
  };
  return c.json(res);
});

// Anyone can start a club. The host is its first member.
run.post('/clubs', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 80);
  const city = str(body.city, 80);
  if (!name || !city) return c.json({ error: 'a name and a city' }, 400);
  const id = newId();
  const now = nowIso();
  await db.batch([
    db.prepare("INSERT INTO run_clubs (id, name, city, description, pace, meets, host_user_id, visibility, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)").bind(id, name, city, str(body.description, 2000), oneOf(body.pace, RUN_PACES, 'all'), str(body.meets, 200), user.id, oneOf(body.visibility, ['public', 'private'] as const, 'public'), now),
    db.prepare("INSERT INTO run_members (club_id, user_id, status, joined_at) VALUES (?, ?, 'member', ?)").bind(id, user.id, now),
  ]);
  await audit(db, user.id, 'run.club.create', 'run_club', id, '', name);
  const row = await db.prepare(`${CLUB} WHERE k.id = ?3`).bind(user.id, now, id).first<ClubRow>();
  return c.json({ club: row ? toClub(row, user.id) : null }, 201);
});

run.get('/clubs/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const now = nowIso();
  const row = await db.prepare(`${CLUB} WHERE k.id = ?3`).bind(user.id, now, c.req.param('id')).first<ClubRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const club = toClub(row, user.id);
  const host = hostOf(row, user);
  const month = `${now.slice(0, 7)}-01T00:00:00`;
  const [runs, mine, board, collabs, entries] = await Promise.all([
    db.prepare(`${RUN} WHERE r.club_id = ? ORDER BY r.starts_at DESC LIMIT 60`).bind(row.id).all<RunRow>(),
    db.prepare(`${ENTRY} WHERE e.club_id = ? AND e.user_id = ?`).bind(row.id, user.id).all<EntryRow>(),
    db.prepare("SELECT e.user_id, u.display_name AS name, SUM(e.metres) AS metres, COUNT(*) AS runs FROM run_entries e JOIN users u ON u.id = e.user_id WHERE e.club_id = ? AND e.status = 'logged' AND e.logged_at >= ? GROUP BY e.user_id ORDER BY metres DESC LIMIT 20").bind(row.id, month).all<{ user_id: string; name: string; metres: number; runs: number }>(),
    db.prepare(`${COLLAB} WHERE c.id IN (SELECT collab_id FROM run_collab_applications WHERE club_id = ? AND status = 'accepted') ORDER BY c.ends_at DESC LIMIT 20`).bind(row.id).all<CollabRow>(),
    host ? db.prepare(`${ENTRY} WHERE e.club_id = ? ORDER BY e.logged_at DESC LIMIT 100`).bind(row.id).all<EntryRow>() : Promise.resolve({ results: [] as EntryRow[] }),
  ]);
  const myEntries = new Map(mine.results.map((e) => [e.run_id, toEntry(e)]));
  const all = runs.results.map((r) => toRun(r, myEntries.get(r.id) ?? null, host));
  const detail: RunClubDetail = {
    club,
    // A run stays on the list while its start code works, done or not; after that, or cancelled, it is past.
    runs: all.filter((r) => r.status !== 'cancelled' && r.entryState !== 'closed').sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    past: all.filter((r) => r.status === 'cancelled' || r.entryState === 'closed'),
    board: board.results.map((b) => ({ userId: b.user_id, name: nameOf({ display_name: b.name }), metres: b.metres, runs: b.runs })),
    collabs: collabs.results.map((k) => toCollab(k, [], false)),
    entries: entries.results.map(toEntry),
  };
  return c.json(detail);
});

run.patch('/clubs/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM run_clubs WHERE id = ?').bind(c.req.param('id')).first<{ id: string; host_user_id: string; name: string; status: string; description: string; meets: string; pace: string; visibility: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (!hostOf(row, user)) return c.json({ error: 'the host changes a club' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const status = oneOf(body.status, ['active', 'closed'] as const, row.status as 'active' | 'closed');
  await db
    .prepare('UPDATE run_clubs SET status = ?, description = ?, meets = ?, pace = ?, visibility = ? WHERE id = ?')
    .bind(status, str(body.description, 2000, row.description), str(body.meets, 200, row.meets), oneOf(body.pace, RUN_PACES, row.pace as RunClub['pace']), oneOf(body.visibility, ['public', 'private'] as const, row.visibility as RunClub['visibility']), row.id)
    .run();
  if (status !== row.status) await audit(db, user.id, 'run.club.status', 'run_club', row.id, row.status, status);
  return c.json({ ok: true });
});

run.post('/clubs/:id/join', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare("SELECT id, name, host_user_id FROM run_clubs WHERE id = ? AND status = 'active'").bind(c.req.param('id')).first<{ id: string; name: string; host_user_id: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  await db.prepare("INSERT INTO run_members (club_id, user_id, status, joined_at) VALUES (?, ?, 'member', ?) ON CONFLICT (club_id, user_id) DO UPDATE SET status = 'member', joined_at = excluded.joined_at").bind(row.id, user.id, nowIso()).run();
  if (row.host_user_id !== user.id) await notify(db, row.host_user_id, 'run', `${nameOf(user)} joined ${row.name}`, 'Say hello at the next run.', `/run/clubs/${row.id}`);
  return c.json({ ok: true }, 201);
});

run.post('/clubs/:id/leave', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT id, host_user_id FROM run_clubs WHERE id = ?').bind(c.req.param('id')).first<{ id: string; host_user_id: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.host_user_id === user.id) return c.json({ error: 'the host cannot leave; close the club instead' }, 400);
  await db.prepare("UPDATE run_members SET status = 'left' WHERE club_id = ? AND user_id = ?").bind(row.id, user.id).run();
  return c.json({ ok: true });
});

// The host adds a run and gets its start code back. Nobody else ever receives the code from the server.
run.post('/clubs/:id/runs', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const club = await db.prepare("SELECT id, name, host_user_id FROM run_clubs WHERE id = ? AND status = 'active'").bind(c.req.param('id')).first<{ id: string; name: string; host_user_id: string }>();
  if (!club) return c.json({ error: 'not found' }, 404);
  if (!hostOf(club, user)) return c.json({ error: 'the host adds runs' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120) || `${club.name} run`;
  const startsAt = str(body.startsAt, 40);
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return c.json({ error: 'a start time' }, 400);
  const start = new Date(startsAt);
  const minutes = num(body.minutes, 60, 10, 24 * 60) ?? 60;
  let collabId: string | null = null;
  if (typeof body.collabId === 'string' && body.collabId) {
    const ok = await db.prepare("SELECT 1 FROM run_collab_applications WHERE collab_id = ? AND club_id = ? AND status = 'accepted'").bind(body.collabId, club.id).first();
    if (!ok) return c.json({ error: 'that collab has not accepted this club' }, 400);
    collabId = body.collabId;
  }
  // The xp the run pays, set now by the host (shared caps it), and the start code: their own word or six random letters.
  const set = newRunCode({ xp: body.xp, code: body.code }, start.toISOString());
  if ('error' in set) return c.json({ error: set.error }, set.status);
  const id = newId();
  await db
    .prepare("INSERT INTO runs (id, club_id, title, meeting_point, starts_at, ends_at, metres, code, xp, collab_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)")
    .bind(id, club.id, title, str(body.meetingPoint, 200), start.toISOString(), new Date(start.getTime() + minutes * 60_000).toISOString(), num(body.metres, 5000, 100, MAX_RUN_METRES) ?? 5000, set.code, set.xp, collabId, nowIso())
    .run();
  await audit(db, user.id, 'attendee_code.set', 'run', id, '', { xp: set.xp });
  const members = await db.prepare("SELECT user_id FROM run_members WHERE club_id = ? AND status = 'member' AND user_id != ?").bind(club.id, user.id).all<{ user_id: string }>();
  for (const m of members.results) await notify(db, m.user_id, 'run', `New run: ${title}`, `${club.name}, ${new Date(start).toUTCString()}`, `/run/clubs/${club.id}`);
  const row = await db.prepare(`${RUN} WHERE r.id = ?`).bind(id).first<RunRow>();
  return c.json({ run: row ? toRun(row, null, true) : null, codeError: set.note }, 201);
});

async function runWithClub(db: D1Database, id: string) {
  return db.prepare(`${RUN} WHERE r.id = ?`).bind(id).first<RunRow>().then(async (r) => {
    if (!r) return null;
    const club = await db.prepare('SELECT id, name, host_user_id FROM run_clubs WHERE id = ?').bind(r.club_id).first<{ id: string; name: string; host_user_id: string }>();
    return club ? { r, club } : null;
  });
}

// A leaked code gets replaced, by six random letters or the host's own word, and the xp can change until the run
// starts. Entries already logged stay. With nothing asked, it is a fresh random code, as it always was.
run.post('/runs/:id/recode', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await runWithClub(db, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!hostOf(found.club, user)) return c.json({ error: 'the host changes the code' }, 403);
  const body = await c.req.json<{ xp?: unknown; code?: unknown; fresh?: unknown }>().catch(() => ({}) as Record<string, never>);
  const asked = body.xp !== undefined || (typeof body.code === 'string' && body.code.trim() !== '');
  const set = await setRunCode(db, found.r, asked ? body : { fresh: true });
  if ('error' in set) return c.json({ error: set.error }, set.status);
  await audit(db, user.id, 'attendee_code.set', 'run', found.r.id, { xp: found.r.xp }, { xp: set.xp, newCode: set.code !== found.r.code });
  return c.json({ code: set.code, xp: set.xp });
});

run.patch('/runs/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await runWithClub(db, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!hostOf(found.club, user)) return c.json({ error: 'the host changes a run' }, 403);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const status = oneOf(body.status, ['published', 'cancelled', 'done'] as const, found.r.status);
  await db.prepare('UPDATE runs SET status = ? WHERE id = ?').bind(status, found.r.id).run();
  if (status === 'cancelled') {
    const members = await db.prepare("SELECT user_id FROM run_members WHERE club_id = ? AND status = 'member'").bind(found.club.id).all<{ user_id: string }>();
    for (const m of members.results) await notify(db, m.user_id, 'run', `Cancelled: ${found.r.title}`, found.club.name, `/run/clubs/${found.club.id}`);
  }
  return c.json({ ok: true });
});

/**
 * Pay one logged run: once per run, at most RUN_REWARD.perDay paid runs a day. Capped runs still log, they just do
 * not pay. The cap is checked inside the batch that pays: the entry takes its pay only while the day has room, and
 * everything after it pays only when it did, so two entries at once cannot both slip under the cap.
 */
async function payRun(db: D1Database, userId: string, runId: string, entryId: string, xp: number): Promise<{ xp: number; points: number; capped: boolean }> {
  const now = nowIso();
  const dayStart = `${now.slice(0, 10)}T00:00:00`;
  const today = await db.prepare("SELECT COUNT(*) AS n FROM xp_events WHERE user_id = ? AND source = 'run' AND created_at >= ?").bind(userId, dayStart).first<{ n: number }>();
  if ((today?.n ?? 0) >= RUN_REWARD.perDay) return { xp: 0, points: 0, capped: true };
  // ?1 person, ?2 entry, ?3 xp, ?4 points.
  const paid = 'EXISTS (SELECT 1 FROM run_entries WHERE id = ?2 AND points > 0)';
  const done = await db.batch([
    db.prepare("UPDATE run_entries SET xp = ?3, points = ?4 WHERE id = ?2 AND (SELECT COUNT(*) FROM xp_events WHERE user_id = ?1 AND source = 'run' AND created_at >= ?5) < ?6").bind(userId, entryId, xp, RUN_REWARD.points, dayStart, RUN_REWARD.perDay),
    db.prepare(`UPDATE users SET xp = xp + ?3, points = points + ?4 WHERE id = ?1 AND ${paid}`).bind(userId, entryId, xp, RUN_REWARD.points),
    db.prepare(`UPDATE relationship_scores SET xp = xp + ?3 WHERE user_id = ?1 AND relationship = 'friendship' AND ${paid}`).bind(userId, entryId, xp),
    db.prepare(`INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) SELECT ?1, 'friendship', 'run', ?4, ?3, ?5 WHERE ${paid}`).bind(userId, entryId, xp, runId, now),
    db.prepare(`INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) SELECT ?1, ?3, 'run', ?2, ?4 WHERE ${paid}`).bind(userId, entryId, RUN_REWARD.points, now),
  ]);
  if ((done[0]?.meta.changes ?? 0) === 0) return { xp: 0, points: 0, capped: true };
  return { xp, points: RUN_REWARD.points, capped: false };
}

// The entry: a member types the start code during the run. One per person per run, and the window is the only clock.
run.post('/runs/:id/entry', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await runWithClub(db, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  const { r, club } = found;
  // A run marked done still takes entries inside its window: people log it on the way home.
  if (r.status === 'cancelled') return c.json({ error: 'this run is cancelled' }, 400);
  if (!(await isMember(db, club.id, user.id))) return c.json({ error: 'join the club first' }, 403);
  // Whoever can see the code (the club's host, events staff, admins) shows it; the xp is for the people who came.
  if (hostOf(club, user)) return c.json({ error: 'Hosts and the team show the start code; they do not log the run.' }, 403);
  const state = runEntryState(r.starts_at, r.ends_at);
  if (state === 'early') return c.json({ error: 'The start code works from thirty minutes before the start. Come back then.' }, 400);
  if (state === 'closed') return c.json({ error: 'This run closed three hours after its end. Ask the host if you were there.' }, 400);
  const body = await c.req.json<{ code?: string; metres?: number; minutes?: number }>().catch(() => ({}) as Record<string, never>);
  const code = normalizeCode(body.code);
  if (code !== r.code) return c.json({ error: 'That is not the start code for this run. The host shows it at the line.' }, 400);
  const existing = await db.prepare('SELECT status FROM run_entries WHERE run_id = ? AND user_id = ?').bind(r.id, user.id).first<{ status: string }>();
  if (existing?.status === 'logged') return c.json({ error: 'You already logged this run.' }, 409);
  if (existing?.status === 'void') return c.json({ error: 'The host voided your entry for this run.' }, 409);
  const metres = num(body.metres, r.metres, 0, MAX_RUN_METRES) ?? r.metres;
  const minutes = num(body.minutes, 0, 0, MAX_RUN_MINUTES) ?? 0;
  const id = newId();
  const now = nowIso();
  const before = await badgesNow(db, user.id);
  await db.prepare("INSERT INTO run_entries (id, run_id, club_id, user_id, metres, minutes, xp, points, status, logged_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'logged', ?)").bind(id, r.id, club.id, user.id, metres, minutes, now).run();
  const paid = await payRun(db, user.id, r.id, id, r.xp);
  // The minutes count as movement for the Life physical score, the same as a run logged by hand.
  if (minutes > 0) {
    await db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, 'move', ?, ?, ?, ?, ?)").bind(newId(), user.id, now.slice(0, 10), minutes, JSON.stringify({ source: 'run', runId: r.id, metres }), r.title, now).run();
  }
  const after = await badgesNow(db, user.id);
  const row = await db.prepare(`${ENTRY} WHERE e.id = ?`).bind(id).first<EntryRow>();
  return c.json({ entry: row ? toEntry(row) : null, xp: paid.xp, points: paid.points, capped: paid.capped, newBadges: diffBadges(before, after) }, 201);
});

// The host voids an entry that should not be there. The pay comes back out.
run.post('/entries/:id/void', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const e = await db.prepare('SELECT * FROM run_entries WHERE id = ?').bind(c.req.param('id')).first<{ id: string; run_id: string; club_id: string; user_id: string; xp: number; points: number; status: string }>();
  if (!e) return c.json({ error: 'not found' }, 404);
  const club = await db.prepare('SELECT id, host_user_id FROM run_clubs WHERE id = ?').bind(e.club_id).first<{ id: string; host_user_id: string }>();
  if (!club || !hostOf(club, user)) return c.json({ error: 'the host voids an entry' }, 403);
  if (e.status === 'void') return c.json({ ok: true });
  const now = nowIso();
  const stmts = [db.prepare("UPDATE run_entries SET status = 'void' WHERE id = ?").bind(e.id)];
  if (e.xp > 0 || e.points > 0) {
    stmts.push(
      db.prepare('UPDATE users SET xp = MAX(0, xp - ?), points = MAX(0, points - ?) WHERE id = ?').bind(e.xp, e.points, e.user_id),
      db.prepare("UPDATE relationship_scores SET xp = MAX(0, xp - ?) WHERE user_id = ? AND relationship = 'friendship'").bind(e.xp, e.user_id),
      db.prepare("INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, 'friendship', 'run:void', ?, ?, ?)").bind(e.user_id, e.run_id, -e.xp, now),
      db.prepare("INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, 'run:void', ?, ?)").bind(e.user_id, -e.points, e.id, now),
    );
  }
  await db.batch(stmts);
  await audit(db, user.id, 'run.entry.void', 'run_entry', e.id, 'logged', 'void');
  await notify(db, e.user_id, 'run', 'A run entry was voided', 'The host took back an entry and its points. Ask them if that is wrong.', `/run/clubs/${e.club_id}`);
  return c.json({ ok: true });
});

// Brand collabs: what a brand gives, what it asks, and the giveaway. Staff with the events permission or a brand's own team post them.
run.get('/collabs', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const now = nowIso();
  const staff = can(user, 'events');
  const ask = pageOf(c);
  const [collabs, myClubs, mineApps, posterApps] = await Promise.all([
    db.prepare(`${COLLAB} WHERE (c.status = 'open' AND c.ends_at >= ?) OR c.created_by = ? ORDER BY c.status = 'open' DESC, c.ends_at LIMIT ? OFFSET ?`).bind(now, user.id, ask.limit, ask.offset).all<CollabRow>(),
    db.prepare(`${CLUB} WHERE k.status = 'active' AND k.host_user_id = ?1 ORDER BY k.created_at`).bind(user.id, now).all<ClubRow>(),
    db.prepare(`${APP} WHERE k.host_user_id = ? ORDER BY a.created_at DESC LIMIT 100`).bind(user.id).all<AppRow>(),
    db.prepare(`${APP} JOIN run_collabs c ON c.id = a.collab_id WHERE c.created_by = ? ${staff ? 'OR 1 = 1' : ''} ORDER BY a.created_at DESC LIMIT 100`).bind(user.id).all<AppRow>(),
  ]);
  const titles = new Map(collabs.results.map((k) => [k.id, k.title]));
  const pg = paged(collabs.results, ask);
  const res: RunCollabsResponse = {
    page: pg.page,
    collabs: pg.items.map((k) => toCollab(k, mineApps.results.filter((a) => a.collab_id === k.id).map(toApp), k.created_by === user.id || staff)),
    myClubs: myClubs.results.map((k) => toClub(k, user.id)),
    canPost: await canPostCollab(db, user),
    applications: posterApps.results.map((a) => ({ ...toApp(a), collabTitle: titles.get(a.collab_id) ?? '' })),
  };
  return c.json(res);
});

run.post('/collabs', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const orgId = typeof body.organizationId === 'string' && body.organizationId ? body.organizationId : null;
  let brand = str(body.brandName, 80);
  if (orgId) {
    const org = await db.prepare('SELECT name FROM organizations WHERE id = ?').bind(orgId).first<{ name: string }>();
    if (!org) return c.json({ error: 'no such brand' }, 404);
    if (!can(user, 'events') && !(await orgRole(db, orgId, user.id))) return c.json({ error: 'only that brand’s team posts for it' }, 403);
    brand = brand || org.name;
  } else if (!can(user, 'events')) return c.json({ error: 'pick the brand you belong to' }, 403);
  const title = str(body.title, 120);
  const giveaway = str(body.giveaway, 300);
  const startsAt = str(body.startsAt, 40);
  const endsAt = str(body.endsAt, 40);
  if (!title || !giveaway) return c.json({ error: 'a title and what runners can win' }, 400);
  if (!startsAt || !endsAt || Number.isNaN(new Date(startsAt).getTime()) || Number.isNaN(new Date(endsAt).getTime()) || endsAt < startsAt) return c.json({ error: 'a start and an end' }, 400);
  const id = newId();
  await db
    .prepare("INSERT INTO run_collabs (id, title, brand_name, organization_id, created_by, brief, asks, giveaway, giveaway_count, city, starts_at, ends_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)")
    .bind(id, title, brand || 'A brand', orgId, user.id, str(body.brief, 3000), str(body.asks, 1000), giveaway, num(body.giveawayCount, 0, 0, 100000) ?? 0, str(body.city, 80), new Date(startsAt).toISOString(), new Date(endsAt).toISOString(), nowIso())
    .run();
  await audit(db, user.id, 'run.collab.create', 'run_collab', id, '', title);
  const row = await db.prepare(`${COLLAB} WHERE c.id = ?`).bind(id).first<CollabRow>();
  return c.json({ collab: row ? toCollab(row, [], true) : null }, 201);
});

run.patch('/collabs/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT id, created_by, status FROM run_collabs WHERE id = ?').bind(c.req.param('id')).first<{ id: string; created_by: string; status: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.created_by !== user.id && !can(user, 'events')) return c.json({ error: 'whoever posted it changes it' }, 403);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const status = oneOf(body.status, ['open', 'closed'] as const, row.status as 'open' | 'closed');
  await db.prepare('UPDATE run_collabs SET status = ? WHERE id = ?').bind(status, row.id).run();
  return c.json({ ok: true });
});

// A host applies with a club. One application per club per collab.
run.post('/collabs/:id/apply', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const now = nowIso();
  const collab = await db.prepare("SELECT id, title, created_by FROM run_collabs WHERE id = ? AND status = 'open' AND ends_at >= ?").bind(c.req.param('id'), now).first<{ id: string; title: string; created_by: string }>();
  if (!collab) return c.json({ error: 'that collab is closed' }, 404);
  const body = await c.req.json<{ clubId?: string; note?: string }>().catch(() => ({}) as { clubId?: string; note?: string });
  const club = await db.prepare("SELECT id, name, host_user_id FROM run_clubs WHERE id = ? AND status = 'active'").bind(str(body.clubId, 64)).first<{ id: string; name: string; host_user_id: string }>();
  if (!club) return c.json({ error: 'pick one of your clubs' }, 400);
  if (club.host_user_id !== user.id) return c.json({ error: 'only the host applies for a club' }, 403);
  if (await db.prepare('SELECT 1 FROM run_collab_applications WHERE collab_id = ? AND club_id = ?').bind(collab.id, club.id).first()) return c.json({ error: 'this club already applied' }, 409);
  const id = newId();
  await db.prepare("INSERT INTO run_collab_applications (id, collab_id, club_id, user_id, note, status, created_at, decided_at) VALUES (?, ?, ?, ?, ?, 'applied', ?, NULL)").bind(id, collab.id, club.id, user.id, str(body.note, 1000), now).run();
  await notify(db, collab.created_by, 'run', `${club.name} applied: ${collab.title}`, 'Accept or decline under Kreators Run, Brand collabs.', '/run?tab=collabs');
  return c.json({ application: { id, status: 'applied' } }, 201);
});

run.post('/collabs/:id/applications/:appId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const collab = await db.prepare('SELECT id, title, created_by, giveaway FROM run_collabs WHERE id = ?').bind(c.req.param('id')).first<{ id: string; title: string; created_by: string; giveaway: string }>();
  if (!collab) return c.json({ error: 'not found' }, 404);
  if (collab.created_by !== user.id && !can(user, 'events')) return c.json({ error: 'whoever posted the collab decides' }, 403);
  const app = await db.prepare('SELECT * FROM run_collab_applications WHERE id = ? AND collab_id = ?').bind(c.req.param('appId'), collab.id).first<{ id: string; club_id: string; user_id: string; status: string }>();
  if (!app) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const status = oneOf(body.status, ['accepted', 'declined'] as const, 'declined');
  await db.prepare('UPDATE run_collab_applications SET status = ?, decided_at = ? WHERE id = ?').bind(status, nowIso(), app.id).run();
  await audit(db, user.id, 'run.collab.decide', 'run_collab_application', app.id, app.status, status);
  await notify(db, app.user_id, 'run', status === 'accepted' ? `Accepted: ${collab.title}` : `Not this time: ${collab.title}`, status === 'accepted' ? `Giveaway for your runners: ${collab.giveaway}. Add a run and pick the collab.` : 'Thanks for applying.', `/run/clubs/${app.club_id}`);
  return c.json({ ok: true });
});
