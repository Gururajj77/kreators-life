import { Hono, type Context } from 'hono';
import {
  COHORT_TALK_DEFAULT_VISIBILITY,
  COHORT_TALK_MAX_DEPTH,
  COHORT_TALK_REPLIES_MAX,
  MAX_COHORT_TALK_LINE,
  cohortTalkOrder,
  cohortTalkPlace,
  cohortTalkPrivateLabel,
  isCohortTalkVisibility,
  maskCode,
  pruneEmptyLines,
  type CohortTalkAuthor,
  type CohortTalkLine,
  type CohortTalkMe,
  type CohortTalkResponse,
  type CohortTalkVisibility,
} from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { audit, nameOf, newId, notify, nowIso, pageOf, paged, str } from '../db';
import { blockBehind } from './community';
import { cohortRole } from './school';

/**
 * Discussions under a School cohort, mounted at /school/cohorts so the module gate reads School. Its people are everyone enrolled
 * (enrolled or completed) and its moderators, read by the cohort page's own rule (`cohortRole`); anyone else gets 404. Threads nest
 * three levels; a reply past that sits beside the line it answers and names it. How a member shows is their own pick per cohort,
 * private by default, and a private member's real handle, id and friend code are masked here, on the server, for everyone but
 * themself and the cohort's moderators. Lines by someone blocked either way are hidden both ways, a line comes down at its writer's or
 * a moderator's ask (the words are wiped, the place stays), and a report becomes a help ticket with the line's words.
 */
export const cohortTalk = new Hono<AppEnv>();

interface CohortRow { id: string; name: string; manager_user_id: string | null; program_id: string }
interface TalkRoom { cohort: CohortRow; moderator: boolean }
interface LineRow {
  id: string;
  thread_id: string;
  parent_id: string | null;
  reply_to_id: string | null;
  depth: number;
  user_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  display_name: string;
  handle: string | null;
  friend_code: string | null;
  visibility: string | null;
  blocked: number;
}

const talkLink = (cohortId: string) => `/school/${cohortId}#discussion`;

/** The cohort's discussion as this person may see it, or null when they are not one of its people (the caller answers 404). */
async function roomFor(db: D1Database, user: UserRow, cohortId: string): Promise<TalkRoom | null> {
  const cohort = await db.prepare('SELECT id, name, manager_user_id, program_id FROM cohorts WHERE id = ?').bind(cohortId).first<CohortRow>();
  if (!cohort) return null;
  // The same rule as the cohort's own page (`cohortRole` in school.ts): whoever runs the program, its cohort's manager, or a mentor on a
  // program they can see. Staff who do not run a draft, private or archived program are not its moderators.
  const moderator = (await cohortRole(db, user, cohort.id))?.mentor ?? false;
  if (moderator) return { cohort, moderator };
  const enrolled = await db.prepare("SELECT 1 FROM enrollments WHERE cohort_id = ? AND learner_user_id = ? AND status IN ('enrolled', 'completed')").bind(cohort.id, user.id).first();
  return enrolled ? { cohort, moderator: false } : null;
}

/** Whether ?1 (the reader) and `col` have blocked each other either way. */
const BLOCKED = (col: string) => `EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = ${col}) OR (b.blocker_id = ${col} AND b.blocked_id = ?1))`;
// ?1 reader, ?2 cohort.
const LINE_SQL = `SELECT t.id, t.thread_id, t.parent_id, t.reply_to_id, t.depth, t.user_id, t.body, t.created_at, t.deleted_at,
  u.display_name, u.handle, u.friend_code, p.visibility, CASE WHEN ${BLOCKED('t.user_id')} THEN 1 ELSE 0 END AS blocked
  FROM cohort_talk t JOIN users u ON u.id = t.user_id
  LEFT JOIN cohort_talk_prefs p ON p.cohort_id = t.cohort_id AND p.user_id = t.user_id`;

const visibilityOf = (v: string | null): CohortTalkVisibility => (isCohortTalkVisibility(v) ? v : COHORT_TALK_DEFAULT_VISIBILITY);

/** How a writer shows to this reader. The masking happens here: a private member's real handle, name, id and code stay on the server. */
function authorFor(r: Pick<LineRow, 'user_id' | 'display_name' | 'handle' | 'friend_code' | 'visibility'>, reader: UserRow, room: TalkRoom): CohortTalkAuthor {
  const isPublic = visibilityOf(r.visibility) === 'public' && Boolean(r.handle);
  const mine = r.user_id === reader.id;
  const seesReal = isPublic || mine || room.moderator;
  return {
    label: isPublic ? `@${r.handle}` : cohortTalkPrivateLabel(r.handle, r.friend_code),
    handle: seesReal ? r.handle : null,
    name: seesReal ? nameOf(r) : null,
    code: isPublic ? null : maskCode(r.friend_code),
    public: isPublic,
    userId: seesReal ? r.user_id : '',
    manager: r.user_id === room.cohort.manager_user_id,
  };
}

const EMPTY_AUTHOR: CohortTalkAuthor = { label: '', handle: null, name: null, code: null, public: false, userId: '', manager: false };

function present(rows: LineRow[], reader: UserRow, room: TalkRoom): CohortTalkLine[] {
  const labels = new Map<string, string>();
  // A line of the reader's own is named "you", never their own masked name.
  for (const r of rows) labels.set(r.id, r.blocked === 1 ? 'someone' : r.deleted_at !== null ? 'a line taken down' : r.user_id === reader.id ? 'you' : authorFor(r, reader, room).label);
  return rows.map((r): CohortTalkLine => {
    const hidden = r.blocked === 1;
    const takenDown = r.deleted_at !== null;
    const empty = hidden || takenDown;
    const mine = r.user_id === reader.id;
    return {
      id: r.id,
      threadId: r.thread_id,
      parentId: r.parent_id,
      depth: Math.min(r.depth, COHORT_TALK_MAX_DEPTH),
      // Only a reply kept beside the line it answers names it; a nested reply already sits under it.
      replyTo: r.reply_to_id && r.reply_to_id !== r.parent_id ? { id: r.reply_to_id, label: labels.get(r.reply_to_id) ?? 'a line' } : null,
      body: empty ? '' : r.body,
      createdAt: r.created_at,
      takenDown,
      hidden,
      mine: mine && !empty,
      author: empty ? EMPTY_AUTHOR : authorFor(r, reader, room),
    };
  });
}

async function meFor(db: D1Database, user: UserRow, cohortId: string): Promise<CohortTalkMe> {
  const row = await db.prepare('SELECT visibility FROM cohort_talk_prefs WHERE cohort_id = ? AND user_id = ?').bind(cohortId, user.id).first<{ visibility: string }>();
  const visibility = visibilityOf(row?.visibility ?? null);
  const isPublic = visibility === 'public' && Boolean(user.handle);
  return { visibility, label: isPublic ? `@${user.handle}` : cohortTalkPrivateLabel(user.handle, user.friend_code), code: isPublic ? null : maskCode(user.friend_code), handle: user.handle };
}

function cleanLine(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_COHORT_TALK_LINE);
}
function lineProblem(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return 'Write something first.';
  if (raw.trim().length > MAX_COHORT_TALK_LINE) return `Keep a line under ${MAX_COHORT_TALK_LINE} letters.`;
  return null;
}

async function withRoom(c: Context<AppEnv>): Promise<TalkRoom | null> {
  return roomFor(c.env.DB, c.get('user'), c.req.param('id') ?? '');
}

// A page of posts, newest first, each with all its replies in reading order.
cohortTalk.get('/:id/talk', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const room = await withRoom(c);
  if (!room) return c.json({ error: 'not found' }, 404);
  const ask = pageOf(c, 'ct');
  const posts = await db.prepare(`${LINE_SQL} WHERE t.cohort_id = ?2 AND t.depth = 0 ORDER BY t.created_at DESC, t.id DESC LIMIT ?3 OFFSET ?4`).bind(user.id, room.cohort.id, ask.limit, ask.offset).all<LineRow>();
  const pg = paged(posts.results, ask);
  const ids = pg.items.map((p) => p.id);
  let replies: LineRow[] = [];
  if (ids.length > 0) {
    const r = await db
      .prepare(`${LINE_SQL} WHERE t.cohort_id = ?2 AND t.depth > 0 AND t.thread_id IN (${ids.map((_, i) => `?${i + 4}`).join(',')}) ORDER BY t.created_at, t.id LIMIT ?3`)
      .bind(user.id, room.cohort.id, COHORT_TALK_REPLIES_MAX, ...ids)
      .all<LineRow>();
    replies = r.results;
  }
  const lines = present([...pg.items, ...replies], user, room).map((l) => ({ ...l, empty: l.hidden || l.takenDown }));
  const ordered = pruneEmptyLines(cohortTalkOrder(lines)).map(({ empty: _e, ...l }) => l);
  const body: CohortTalkResponse = { page: pg.page, lines: ordered, me: await meFor(db, user, room.cohort.id), moderator: room.moderator };
  return c.json(body);
});

// How I appear in this cohort: public (my @handle) or private (my handle in stars).
cohortTalk.put('/:id/talk/me', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const room = await withRoom(c);
  if (!room) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ visibility?: unknown }>().catch(() => ({}) as { visibility?: unknown });
  if (!isCohortTalkVisibility(body.visibility)) return c.json({ error: 'Pick public or private.' }, 400);
  await db
    .prepare('INSERT INTO cohort_talk_prefs (cohort_id, user_id, visibility, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (cohort_id, user_id) DO UPDATE SET visibility = excluded.visibility, updated_at = excluded.updated_at')
    .bind(room.cohort.id, user.id, body.visibility, nowIso())
    .run();
  return c.json({ me: await meFor(db, user, room.cohort.id) });
});

// A post, or a reply to a line (`parentId`). A reply to a line at the deepest level is kept beside it and names it.
cohortTalk.post('/:id/talk', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const room = await withRoom(c);
  if (!room) return c.json({ error: 'not found' }, 404);
  if (await db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first()) return c.json({ error: 'You are muted from conversations for now.' }, 403);
  const body = await c.req.json<{ body?: unknown; parentId?: unknown }>().catch(() => ({}) as { body?: unknown; parentId?: unknown });
  const problem = lineProblem(body.body);
  if (problem) return c.json({ error: problem }, 400);
  const text = cleanLine(body.body);
  const id = newId();
  let place = { threadId: id, parentId: null as string | null, replyToId: null as string | null, depth: 0 };
  let answered: { user_id: string } | null = null;
  if (typeof body.parentId === 'string' && body.parentId) {
    const parent = await db
      .prepare(`SELECT t.id, t.user_id, t.thread_id, t.parent_id, t.depth FROM cohort_talk t WHERE t.id = ?2 AND t.cohort_id = ?3 AND t.deleted_at IS NULL AND NOT ${BLOCKED('t.user_id')}`)
      .bind(user.id, body.parentId, room.cohort.id)
      .first<{ id: string; user_id: string; thread_id: string; parent_id: string | null; depth: number }>();
    if (!parent) return c.json({ error: 'That line is gone.' }, 404);
    const p = cohortTalkPlace({ id: parent.id, parentId: parent.parent_id, depth: parent.depth });
    place = { threadId: parent.thread_id, parentId: p.parentId, replyToId: p.replyToId, depth: p.depth };
    answered = parent;
  }
  const now = nowIso();
  await db
    .prepare('INSERT INTO cohort_talk (id, cohort_id, user_id, thread_id, parent_id, reply_to_id, depth, body, created_at, deleted_at, deleted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)')
    .bind(id, room.cohort.id, user.id, place.threadId, place.parentId, place.replyToId, place.depth, text, now)
    .run();
  // The one they answered hears about it, by the name the writer shows in this cohort, never their real one when they are private.
  if (answered && answered.user_id !== user.id) {
    const me = await meFor(db, user, room.cohort.id);
    await notify(db, answered.user_id, 'reply', `${me.label} replied to you in ${room.cohort.name}`, text.slice(0, 120), talkLink(room.cohort.id));
  }
  // A reply kept beside the line it answers names that line, so the answered row goes to present() with it.
  const besides = place.replyToId && place.replyToId !== place.parentId ? place.replyToId : null;
  const rows = await db
    .prepare(`${LINE_SQL} WHERE t.cohort_id = ?2 AND t.id IN (?3, ?4)`)
    .bind(user.id, room.cohort.id, id, besides ?? id)
    .all<LineRow>();
  const shown = present(rows.results, user, room).find((l) => l.id === id) ?? null;
  return c.json({ line: shown }, 201);
});

// A line comes down when its writer asks, or the cohort's manager, a mentor or the team does. The words are wiped; the place stays.
cohortTalk.delete('/:id/talk/:lineId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const room = await withRoom(c);
  if (!room) return c.json({ error: 'not found' }, 404);
  const line = await db.prepare('SELECT id, user_id FROM cohort_talk WHERE id = ? AND cohort_id = ? AND deleted_at IS NULL').bind(c.req.param('lineId'), room.cohort.id).first<{ id: string; user_id: string }>();
  if (!line) return c.json({ error: 'not found' }, 404);
  const mine = line.user_id === user.id;
  if (!mine && !room.moderator) return c.json({ error: 'Only its writer or the cohort manager can take a line down.' }, 403);
  const res = await db.prepare("UPDATE cohort_talk SET body = '', deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL").bind(nowIso(), user.id, line.id).run();
  if (res.meta.changes > 0 && !mine) {
    await audit(db, user.id, 'cohort.line.delete', 'cohort_talk', line.id, '', { cohort: room.cohort.id });
    await notify(db, line.user_id, 'moderation', 'A line of yours was taken down', `In the discussion for ${room.cohort.name}.`, talkLink(room.cohort.id));
  }
  return c.json({ ok: true });
});

// Tell the team about a line: a help ticket with the line's words, since they are wiped if it is taken down.
cohortTalk.post('/:id/talk/:lineId/report', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const room = await withRoom(c);
  if (!room) return c.json({ error: 'not found' }, 404);
  const line = await db
    .prepare(`SELECT t.id, t.user_id, t.body FROM cohort_talk t WHERE t.id = ?2 AND t.cohort_id = ?3 AND t.deleted_at IS NULL AND NOT ${BLOCKED('t.user_id')}`)
    .bind(user.id, c.req.param('lineId'), room.cohort.id)
    .first<{ id: string; user_id: string; body: string }>();
  if (!line) return c.json({ error: 'not found' }, 404);
  if (line.user_id === user.id) return c.json({ error: 'That is your own line. You can take it down instead.' }, 400);
  const note = await c.req.json<{ note?: unknown }>().then((b) => str(b.note, 300)).catch(() => '');
  const now = nowIso();
  await db
    .prepare("INSERT INTO support_tickets (id, user_id, subject, body, status, reply, replied_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', '', NULL, ?, ?)")
    .bind(newId(), user.id, `Report: a line in the cohort discussion ${room.cohort.name}`.slice(0, 120), `Cohort ${room.cohort.id}, line ${line.id}.\nIt says: ${line.body.slice(0, 500)}${note ? `\nWhy: ${note}` : ''}`, now, now)
    .run();
  return c.json({ ok: true }, 201);
});

// Block the person behind a line. Only a writer this reader may already know: a public member, or anyone for the cohort's moderators.
// A block is listed by name under Bond, so blocking a private member would unmask them; their lines are reported instead, and the
// cohort's manager, a mentor or the team takes them down.
cohortTalk.post('/:id/talk/:lineId/block-author', async (c) => {
  const user = c.get('user');
  const room = await withRoom(c);
  if (!room) return c.json({ error: 'not found' }, 404);
  const line = await c.env.DB.prepare(
    'SELECT t.user_id, u.handle, p.visibility FROM cohort_talk t JOIN users u ON u.id = t.user_id LEFT JOIN cohort_talk_prefs p ON p.cohort_id = t.cohort_id AND p.user_id = t.user_id WHERE t.id = ? AND t.cohort_id = ?',
  )
    .bind(c.req.param('lineId'), room.cohort.id)
    .first<{ user_id: string; handle: string | null; visibility: string | null }>();
  if (!line) return c.json({ error: 'not found' }, 404);
  const known = (visibilityOf(line.visibility) === 'public' && Boolean(line.handle)) || room.moderator || line.user_id === user.id;
  if (!known) return c.json({ error: 'This member is private here. Report the line instead, and the cohort manager or the team will act on it.' }, 403);
  return blockBehind(c, line.user_id);
});
