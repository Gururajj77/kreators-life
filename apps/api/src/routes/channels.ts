import { Hono, type Context } from 'hono';
import {
  canModerate,
  CHANNEL_LINES,
  channelCursor,
  channelMessageProblem,
  channelNameProblem,
  channelSlug,
  cleanChannelMessage,
  MAX_CHANNEL_MEMBERS,
  MAX_CHANNEL_TOPIC,
  MAX_CHANNELS_JOINED,
  MAX_CHANNELS_OWNED,
  MAX_COMMUNITY_CHANNELS,
  mentionsIn,
  type Channel,
  type ChannelLine,
  type ChannelMember,
  type ChannelScope,
} from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { anonAlias, audit, blockedByName, blockedEither, hiddenByBlock, isGuide, isStaff, nameOf, newId, notify, notifyMany, nowIso, pageOf, paged, rankOf, seenBy, str } from '../db';
import { blockBehind } from './community';

/**
 * Chat channels, in two places with one set of rules. Community channels are public, opened by guides, and a line can be written
 * anonymously (a made-up name, the same all through one channel). Bond channels are private rooms a member opens for friends,
 * and nobody is anonymous in them. Both are polled tables: a screen asks for the lines after the last one it holds.
 *
 * They are mounted under /community/channels and /bond/channels, so the module gate in access.ts reads the right app for each
 * without a special case: a Community channel needs Community, a Bond channel needs Bond.
 */

interface ChRow {
  id: string;
  scope: ChannelScope;
  slug: string;
  name: string;
  topic: string;
  kind: 'public' | 'private';
  created_by: string;
  archived_at: string | null;
  created_at: string;
}
interface ListRow extends ChRow {
  members: number;
  my_status: 'member' | 'invited' | null;
  my_role: 'member' | 'mod' | null;
  unread: number;
  last_line_at: string | null;
}
interface MsgRow {
  seq: number;
  id: string;
  user_id: string;
  body: string;
  anonymous: number;
  reply_to: string | null;
  created_at: string;
  display_name: string;
  handle: string | null;
  role: UserRow['role'];
  permissions: string;
}


/** ?1 is always the person reading; `alias` is the table holding the line. */
const LINE_SHOWN = (alias: string) => `NOT ${hiddenByBlock('?1', `${alias}.user_id`, `${alias}.anonymous`)}`;

// ?1 is the viewer. The unread count stops at a hundred lines, which is all the dot can show.
const LIST_SQL = `SELECT c.*,
  (SELECT COUNT(*) FROM channel_members m WHERE m.channel_id = c.id AND m.status = 'member') AS members,
  cm.status AS my_status, cm.role AS my_role,
  (SELECT COUNT(*) FROM (SELECT 1 FROM channel_messages x WHERE x.channel_id = c.id AND cm.status = 'member' AND x.created_at > cm.last_read_at AND x.user_id != ?1 AND x.deleted_at IS NULL AND ${LINE_SHOWN('x')} LIMIT 100)) AS unread,
  (SELECT MAX(x.created_at) FROM channel_messages x WHERE x.channel_id = c.id AND x.deleted_at IS NULL) AS last_line_at
  FROM channels c LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?1`;

const manages = (r: Pick<ChRow, 'scope' | 'created_by'>, u: UserRow) => (r.scope === 'community' ? isGuide(u) : r.created_by === u.id);

function toChannel(r: ListRow, viewer: UserRow): Channel {
  const joined = r.my_status === 'member';
  return {
    id: r.id,
    scope: r.scope,
    slug: r.slug,
    name: r.name,
    topic: r.topic,
    kind: r.kind,
    members: r.members,
    joined,
    invited: r.my_status === 'invited',
    unread: joined ? r.unread : 0,
    lastLineAt: r.last_line_at,
    archived: Boolean(r.archived_at),
    owner: r.scope === 'bond' && r.created_by === viewer.id,
    canManage: manages(r, viewer),
    createdAt: r.created_at,
  };
}

/** The link a notice about a channel opens. */
const linkFor = (r: Pick<ChRow, 'id' | 'scope'>) => (r.scope === 'community' ? `/community?tab=channels&channel=${r.id}` : `/bond?channel=${r.id}#bond-channels`);

/** The channel as this person may see it, or null. A Community channel is open to read; a Bond one only to those in it or asked in. */
async function visible(db: D1Database, viewer: UserRow, scope: ChannelScope, id: string): Promise<ListRow | null> {
  const row = await db.prepare(`${LIST_SQL} WHERE c.id = ?2 AND c.scope = ?3`).bind(viewer.id, id, scope).first<ListRow>();
  if (!row) return null;
  if (scope === 'bond') return row.my_status ? row : null;
  return row.archived_at && !isGuide(viewer) ? null : row;
}

/** A slug nobody else in the scope has, or null when the name is taken and the caller wants to say so. */
async function freeSlug(db: D1Database, scope: ChannelScope, name: string, exceptId: string, suffix: boolean): Promise<string | null> {
  const base = channelSlug(name);
  for (let n = 1; n <= 20; n += 1) {
    const slug = n === 1 ? base : `${base.slice(0, 28)}-${n}`;
    const taken = await db.prepare('SELECT id FROM channels WHERE scope = ? AND slug = ? AND id != ?').bind(scope, slug, exceptId).first();
    if (!taken) return slug;
    if (!suffix) return null;
  }
  return null;
}

/** Tell the people a line mentions, once each, never the writer and never across a block. A private channel tells only its members. */
async function tellMentioned(db: D1Database, writer: UserRow, text: string, ch: ChRow, label: string, anonymous: boolean): Promise<Set<string>> {
  const told = new Set<string>();
  const handles = mentionsIn(text);
  if (handles.length === 0) return told;
  const rows = await db
    .prepare(
      `SELECT u.id FROM users u WHERE u.handle IN (${handles.map((_, i) => `?${i + 5}`).join(',')}) AND u.id != ?1
        AND NOT ${hiddenByBlock('u.id', '?1', '?2')}
        AND (?3 = 'public' OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = ?4 AND m.user_id = u.id AND m.status = 'member'))`,
    )
    .bind(writer.id, anonymous ? 1 : 0, ch.kind, ch.id, ...handles)
    .all<{ id: string }>();
  await notifyMany(db, rows.results.map((r) => r.id), 'mention', `${label} mentioned you in ${ch.name}`, text.slice(0, 120), linkFor(ch));
  for (const r of rows.results) told.add(r.id);
  return told;
}

/** Lines as they leave the server. An anonymous line carries the channel's made-up name for its writer and no id, handle or rank; staff keep the id for reports, and the writer's own `mine` flag finds their line. */
async function presentLines(c: Context<AppEnv>, ch: ChRow, rows: MsgRow[]): Promise<ChannelLine[]> {
  const viewer = c.get('user');
  const staff = isStaff(viewer);
  const db = c.env.DB;
  const aliasOf = (userId: string) => anonAlias(c.env, userId, `channel:${ch.id}`);
  // The line each one answers, as a short preview. A taken-down line or one by someone blocked either way is not previewed.
  const parentIds = [...new Set(rows.map((r) => r.reply_to).filter((x): x is string => Boolean(x)))];
  const parents = new Map<string, { name: string; body: string }>();
  if (parentIds.length > 0) {
    const ps = await db
      .prepare(`SELECT m.id, m.user_id, m.body, m.anonymous, u.display_name FROM channel_messages m JOIN users u ON u.id = m.user_id WHERE m.channel_id = ?2 AND m.deleted_at IS NULL AND m.id IN (${parentIds.map((_, i) => `?${i + 3}`).join(',')}) AND ${LINE_SHOWN('m')}`)
      .bind(viewer.id, ch.id, ...parentIds)
      .all<{ id: string; user_id: string; body: string; anonymous: number; display_name: string }>();
    for (const p of ps.results) parents.set(p.id, { name: p.anonymous === 1 ? await aliasOf(p.user_id) : nameOf(p), body: p.body.slice(0, 100) });
  }
  return Promise.all(
    rows.map(async (r): Promise<ChannelLine> => {
      const mine = r.user_id === viewer.id;
      const anon = r.anonymous === 1;
      const reply = r.reply_to ? parents.get(r.reply_to) : undefined;
      return {
        seq: r.seq,
        id: r.id,
        userId: anon && !staff && !mine ? '' : r.user_id,
        name: anon ? await aliasOf(r.user_id) : nameOf({ display_name: r.display_name }),
        handle: anon ? null : r.handle,
        anonymous: anon,
        mine,
        rank: ch.scope === 'bond' ? null : anon && !staff ? null : rankOf(r),
        body: r.body,
        createdAt: r.created_at,
        replyTo: r.reply_to && reply ? { id: r.reply_to, ...reply } : null,
      };
    }),
  );
}

function channelRouter(scope: ChannelScope) {
  const r = new Hono<AppEnv>();
  const open = (c: Context<AppEnv>) => visible(c.env.DB, c.get('user'), scope, c.req.param('id') ?? '');

  // The channels this person can see, a page at a time. Community: every open channel (guides can add ?all=1 for closed ones). Bond: the ones they are in or were asked into.
  r.get('/', async (c) => {
    const user = c.get('user');
    // The list pages on `cl` like the screen (2026-11-07: it read `page`, so Next never moved, and Bond's chats hold `ch`); a bare `size` still works.
    const ask = pageOf(c, 'cl');
    const closed = c.req.query('all') === '1' && scope === 'community' && isGuide(user);
    const where = scope === 'bond' ? "cm.status IN ('member', 'invited') AND c.archived_at IS NULL" : closed ? '1 = 1' : 'c.archived_at IS NULL';
    const rows = await c.env.DB.prepare(`${LIST_SQL} WHERE c.scope = ?2 AND ${where} ORDER BY (cm.status IS NOT NULL) DESC, COALESCE((SELECT MAX(x.created_at) FROM channel_messages x WHERE x.channel_id = c.id AND x.deleted_at IS NULL), c.created_at) DESC LIMIT ?3 OFFSET ?4`)
      .bind(user.id, scope, ask.limit, ask.offset)
      .all<ListRow>();
    const pg = paged(rows.results, ask);
    return c.json({ page: pg.page, channels: pg.items.map((x) => toChannel(x, user)), canCreate: scope === 'bond' || isGuide(user) });
  });

  // How many of my channels have lines I have not read: the dot on the Channels tab.
  r.get('/unread', async (c) => {
    const user = c.get('user');
    const n = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM channel_members cm JOIN channels c ON c.id = cm.channel_id
       WHERE cm.user_id = ?1 AND cm.status = 'member' AND c.scope = ?2 AND c.archived_at IS NULL
         AND EXISTS (SELECT 1 FROM channel_messages x WHERE x.channel_id = c.id AND x.created_at > cm.last_read_at AND x.user_id != ?1 AND x.deleted_at IS NULL AND ${LINE_SHOWN('x')})`,
    )
      .bind(user.id, scope)
      .first<{ n: number }>();
    const invites = scope === 'bond' ? ((await c.env.DB.prepare("SELECT COUNT(*) AS n FROM channel_members cm JOIN channels c ON c.id = cm.channel_id WHERE cm.user_id = ? AND cm.status = 'invited' AND c.scope = 'bond' AND c.archived_at IS NULL").bind(user.id).first<{ n: number }>())?.n ?? 0) : 0;
    return c.json({ unread: (n?.n ?? 0) + invites });
  });

  r.post('/', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    if (scope === 'community' && !isGuide(user)) return c.json({ error: 'Guides open the channels in Community.' }, 403);
    const body = await c.req.json<{ name?: unknown; topic?: unknown }>().catch(() => ({}) as { name?: unknown; topic?: unknown });
    const problem = channelNameProblem(body.name);
    if (problem) return c.json({ error: problem }, 400);
    const name = str(body.name, 200);
    const topic = str(body.topic, MAX_CHANNEL_TOPIC);
    const slug = await freeSlug(db, scope, name, '', scope === 'bond');
    if (!slug) return c.json({ error: `There is already a channel called ${name}.` }, 409);
    const id = newId();
    const now = nowIso();
    const kind = scope === 'bond' ? 'private' : 'public';
    // The cap is checked inside the insert, so two taps at once cannot both slip under it.
    const cap = scope === 'bond' ? MAX_CHANNELS_OWNED : MAX_COMMUNITY_CHANNELS;
    const made = await db
      .prepare(
        `INSERT INTO channels (id, scope, slug, name, topic, kind, created_by, archived_at, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8
         WHERE (SELECT COUNT(*) FROM channels WHERE scope = ?2 AND archived_at IS NULL AND (?2 = 'community' OR created_by = ?7)) < ?9`,
      )
      .bind(id, scope, slug, name, topic, kind, user.id, now, cap)
      .run()
      .catch(() => null);
    if (!made) return c.json({ error: `There is already a channel called ${name}.` }, 409);
    if (made.meta.changes === 0) return c.json({ error: scope === 'bond' ? `You can own ${MAX_CHANNELS_OWNED} channels at a time. Close one first.` : `Community can hold ${MAX_COMMUNITY_CHANNELS} open channels. Close one first.` }, 409);
    await db.prepare("INSERT INTO channel_members (channel_id, user_id, role, status, last_read_at, joined_at) VALUES (?, ?, 'mod', 'member', ?, ?)").bind(id, user.id, now, now).run();
    if (scope === 'community') await audit(db, user.id, 'channel.create', 'channel', id, '', { name });
    const row = await visible(db, user, scope, id);
    return c.json({ channel: row ? toChannel(row, user) : null }, 201);
  });

  r.get('/:id', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const row = await open(c);
    if (!row) return c.json({ error: 'not found' }, 404);
    let members: ChannelMember[] = [];
    // Who is in a private room is for those in it. A public channel shows a count only, since lines there can be anonymous.
    if (scope === 'bond' && row.my_status === 'member') {
      const ms = await db
        .prepare(`SELECT m.user_id, m.role, u.display_name, u.handle FROM channel_members m JOIN users u ON u.id = m.user_id WHERE m.channel_id = ?2 AND m.status = 'member' AND NOT ${blockedByName('?1', 'm.user_id')} ORDER BY m.joined_at LIMIT ${MAX_CHANNEL_MEMBERS}`)
        .bind(user.id, row.id)
        .all<{ user_id: string; role: 'member' | 'mod'; display_name: string; handle: string | null }>();
      members = ms.results.map((m) => ({ userId: m.user_id, name: nameOf(m), handle: m.handle, role: m.role, owner: m.user_id === row.created_by }));
    }
    return c.json({ channel: toChannel(row, user), members });
  });

  r.patch('/:id', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const row = await open(c);
    if (!row) return c.json({ error: 'not found' }, 404);
    if (!manages(row, user)) return c.json({ error: scope === 'community' ? 'Only guides can change a channel.' : 'Only the person who made it can change it.' }, 403);
    const body = await c.req.json<{ name?: unknown; topic?: unknown }>().catch(() => ({}) as { name?: unknown; topic?: unknown });
    let name = row.name;
    let slug = row.slug;
    if (body.name !== undefined) {
      const problem = channelNameProblem(body.name);
      if (problem) return c.json({ error: problem }, 400);
      name = str(body.name, 200);
      const free = await freeSlug(db, scope, name, row.id, scope === 'bond');
      if (!free) return c.json({ error: `There is already a channel called ${name}.` }, 409);
      slug = free;
    }
    const topic = body.topic === undefined ? row.topic : str(body.topic, MAX_CHANNEL_TOPIC);
    await db.prepare('UPDATE channels SET name = ?, slug = ?, topic = ? WHERE id = ?').bind(name, slug, topic, row.id).run();
    if (scope === 'community') await audit(db, user.id, 'channel.update', 'channel', row.id, { name: row.name, topic: row.topic }, { name, topic });
    const next = await visible(db, user, scope, row.id);
    return c.json({ channel: next ? toChannel(next, user) : null });
  });

  // Close a channel (it leaves the list and nobody can write in it) or open it again. In Bond that is how an owner ends a room.
  r.post('/:id/archive', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const row = await open(c);
    if (!row) return c.json({ error: 'not found' }, 404);
    if (!manages(row, user)) return c.json({ error: scope === 'community' ? 'Only guides can close a channel.' : 'Only the person who made it can close it.' }, 403);
    const body = await c.req.json<{ archived?: unknown }>().catch(() => ({}) as { archived?: unknown });
    const archive = body.archived !== false;
    if (!archive) {
      const cap = scope === 'bond' ? MAX_CHANNELS_OWNED : MAX_COMMUNITY_CHANNELS;
      const n = await db.prepare("SELECT COUNT(*) AS n FROM channels WHERE scope = ? AND archived_at IS NULL AND (? = 'community' OR created_by = ?)").bind(scope, scope, user.id).first<{ n: number }>();
      if ((n?.n ?? 0) >= cap) return c.json({ error: 'Close another channel before opening this one again.' }, 409);
    }
    await db.prepare('UPDATE channels SET archived_at = ? WHERE id = ?').bind(archive ? nowIso() : null, row.id).run();
    if (scope === 'community') await audit(db, user.id, archive ? 'channel.close' : 'channel.open', 'channel', row.id, '', { name: row.name });
    const next = await visible(db, user, scope, row.id);
    return c.json({ channel: next ? toChannel(next, user) : null });
  });

  // Join a public channel, or say yes to a private one's invitation.
  r.post('/:id/join', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const row = await open(c);
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.archived_at) return c.json({ error: 'This channel is closed.' }, 409);
    const now = nowIso();
    if (row.my_status === 'member') return c.json({ channel: toChannel(row, user) });
    if (scope === 'bond') {
      if (row.my_status !== 'invited') return c.json({ error: 'not found' }, 404);
      const done = await db
        .prepare("UPDATE channel_members SET status = 'member', last_read_at = ?, joined_at = ? WHERE channel_id = ? AND user_id = ? AND status = 'invited' AND (SELECT COUNT(*) FROM channel_members WHERE user_id = ? AND status = 'member') < ?")
        .bind(now, now, row.id, user.id, user.id, MAX_CHANNELS_JOINED)
        .run();
      if (done.meta.changes === 0) return c.json({ error: `You can be in ${MAX_CHANNELS_JOINED} channels at a time. Leave one first.` }, 409);
      if (row.created_by !== user.id) await notify(db, row.created_by, 'bond', `${nameOf(user)} joined ${row.name}`, '', linkFor(row));
    } else {
      const done = await db
        .prepare("INSERT INTO channel_members (channel_id, user_id, role, status, last_read_at, joined_at) SELECT ?1, ?2, 'member', 'member', ?3, ?3 WHERE (SELECT COUNT(*) FROM channel_members WHERE user_id = ?2 AND status = 'member') < ?4")
        .bind(row.id, user.id, now, MAX_CHANNELS_JOINED)
        .run()
        .catch(() => null);
      if (!done || done.meta.changes === 0) return c.json({ error: `You can be in ${MAX_CHANNELS_JOINED} channels at a time. Leave one first.` }, 409);
    }
    const next = await visible(db, user, scope, row.id);
    return c.json({ channel: next ? toChannel(next, user) : null });
  });

  /**
   * The channel when this person holds a seat or an invitation in it, open or closed (2026-11-14, All tables): leaving a closed Community channel,
   * or taking down a line in one, is the person's own business, though only a guide can open a closed one.
   */
  const seatedIn = (c: Context<AppEnv>) =>
    c.env.DB.prepare('SELECT ch.* FROM channels ch JOIN channel_members cm ON cm.channel_id = ch.id AND cm.user_id = ?1 WHERE ch.id = ?2 AND ch.scope = ?3')
      .bind(c.get('user').id, c.req.param('id') ?? '', scope)
      .first<ChRow>();

  // Leave a channel, or turn down an invitation. The lines you wrote stay; delete them one by one if you like.
  r.post('/:id/leave', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const row = (await open(c)) ?? (await seatedIn(c));
    if (!row) return c.json({ error: 'not found' }, 404);
    if (scope === 'bond' && row.created_by === user.id) return c.json({ error: 'You made this channel. Close it instead.' }, 400);
    const left = await db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').bind(row.id, user.id).run();
    // Out already (another tab, or a second send): said, never a quiet yes, so All tables counts it once.
    if (!left.meta.changes) return c.json({ error: 'You left it a moment ago.' }, 409);
    return c.json({ ok: true });
  });

  if (scope === 'bond') {
    // Ask a friend in. They see it under Bond and say yes or no; nothing opens to them before that.
    r.post('/:id/members', async (c) => {
      const db = c.env.DB;
      const user = c.get('user');
      const row = await open(c);
      if (!row || row.my_status !== 'member') return c.json({ error: 'not found' }, 404);
      if (row.created_by !== user.id) return c.json({ error: 'Only the person who made the channel can ask people in.' }, 403);
      if (row.archived_at) return c.json({ error: 'This channel is closed.' }, 409);
      const body = await c.req.json<{ userId?: unknown }>().catch(() => ({}) as { userId?: unknown });
      const target = str(body.userId, 64);
      if (!target || target === user.id) return c.json({ error: 'Who do you want to ask?' }, 400);
      const friends = await db.prepare("SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1))").bind(user.id, target).first();
      if (!friends) return c.json({ error: 'You can only ask friends. Add them as a friend first.' }, 403);
      if (await blockedEither(db, user.id, target)) return c.json({ error: 'not possible' }, 400);
      const seat = await db.prepare('SELECT status FROM channel_members WHERE channel_id = ? AND user_id = ?').bind(row.id, target).first<{ status: string }>();
      if (seat) return c.json({ error: seat.status === 'member' ? 'They are already in.' : 'You already asked them.' }, 409);
      const now = nowIso();
      // Seats (in and asked) are counted inside the insert, so two asks at once cannot pass the limit.
      const done = await db
        .prepare("INSERT INTO channel_members (channel_id, user_id, role, status, last_read_at, joined_at) SELECT ?1, ?2, 'member', 'invited', ?3, ?3 WHERE (SELECT COUNT(*) FROM channel_members WHERE channel_id = ?1) < ?4")
        .bind(row.id, target, now, MAX_CHANNEL_MEMBERS)
        .run();
      if (done.meta.changes === 0) return c.json({ error: `A channel holds up to ${MAX_CHANNEL_MEMBERS} people, counting the ones you asked.` }, 409);
      await notify(db, target, 'bond', `${nameOf(user)} asked you into ${row.name}`, 'A private channel for friends. Say yes or no under Bond.', linkFor(row));
      return c.json({ ok: true }, 201);
    });

    // The owner takes someone out, or withdraws an invitation.
    r.delete('/:id/members/:userId', async (c) => {
      const db = c.env.DB;
      const user = c.get('user');
      const row = await open(c);
      if (!row || row.my_status !== 'member') return c.json({ error: 'not found' }, 404);
      if (row.created_by !== user.id) return c.json({ error: 'Only the person who made the channel can remove people.' }, 403);
      const target = c.req.param('userId') ?? '';
      if (target === user.id) return c.json({ error: 'You made this channel. Close it instead.' }, 400);
      await db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').bind(row.id, target).run();
      return c.json({ ok: true });
    });
  }

  // The lines. No `after`/`before`: the latest block. `after=<seq>`: only newer lines (the poll). `before=<seq>`: the block before that line (load earlier).
  // `from=<seq>` with `after` lists the held lines that were taken down since, so an open screen drops them. `read=1` marks the channel read for a member.
  r.get('/:id/messages', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const row = await open(c);
    if (!row || (scope === 'bond' && row.my_status !== 'member')) return c.json({ error: 'not found' }, 404);
    const after = channelCursor(c.req.query('after'));
    const before = after ? null : channelCursor(c.req.query('before'));
    const forward = after !== null;
    const cursor = after ?? before ?? 0;
    const sql = `SELECT m.seq, m.id, m.user_id, m.body, m.anonymous, m.reply_to, m.created_at, u.display_name, u.handle, u.role, u.permissions
      FROM channel_messages m JOIN users u ON u.id = m.user_id
      WHERE m.channel_id = ?2 AND m.deleted_at IS NULL AND m.seq ${before ? '<' : '>'} ?3 AND ${LINE_SHOWN('m')}
      ORDER BY m.seq ${forward ? 'ASC' : 'DESC'} LIMIT ?4`;
    const rows = await db.prepare(sql).bind(user.id, row.id, cursor, CHANNEL_LINES + 1).all<MsgRow>();
    const more = rows.results.length > CHANNEL_LINES;
    const got = rows.results.slice(0, CHANNEL_LINES);
    if (!forward) got.reverse();
    let gone: number[] = [];
    const from = channelCursor(c.req.query('from'));
    if (forward && from) {
      const lo = Math.max(from, (after ?? 0) - 400);
      const g = await db.prepare('SELECT seq FROM channel_messages WHERE channel_id = ? AND deleted_at IS NOT NULL AND seq >= ? AND seq <= ? LIMIT 200').bind(row.id, lo, after).all<{ seq: number }>();
      gone = g.results.map((x) => x.seq);
    }
    // A member who is looking at the channel has read it up to now. Nothing is written for a poll that found nothing new.
    if (c.req.query('read') === '1' && row.my_status === 'member' && (got.length > 0 || !forward)) {
      await db.prepare('UPDATE channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?').bind(nowIso(), row.id, user.id).run();
    }
    return c.json({ lines: await presentLines(c, row, got), more, gone });
  });

  r.post('/:id/messages', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const row = await open(c);
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.my_status !== 'member') return c.json({ error: 'Join the channel to write in it.' }, 403);
    if (row.archived_at) return c.json({ error: 'This channel is closed.' }, 409);
    if (scope === 'community' && (await db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first())) return c.json({ error: 'You are muted in Community for now. A guide or admin can lift it.' }, 403);
    const body = await c.req.json<{ body?: unknown; anonymous?: unknown; replyTo?: unknown }>().catch(() => ({}) as { body?: unknown; anonymous?: unknown; replyTo?: unknown });
    const problem = channelMessageProblem(body.body);
    if (problem) return c.json({ error: problem }, 400);
    const text = cleanChannelMessage(body.body);
    const anonymous = scope === 'community' && body.anonymous === true;
    let parent: { id: string; user_id: string } | null = null;
    if (typeof body.replyTo === 'string' && body.replyTo) {
      parent = await db
        .prepare(`SELECT m.id, m.user_id FROM channel_messages m WHERE m.id = ?2 AND m.channel_id = ?3 AND m.deleted_at IS NULL AND ${LINE_SHOWN('m')}`)
        .bind(user.id, body.replyTo, row.id)
        .first<{ id: string; user_id: string }>();
      if (!parent) return c.json({ error: 'That line is gone.' }, 404);
    }
    const now = nowIso();
    const id = newId();
    const res = await db.prepare('INSERT INTO channel_messages (id, channel_id, user_id, body, anonymous, reply_to, created_at, deleted_at, deleted_by) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)').bind(id, row.id, user.id, text, anonymous ? 1 : 0, parent?.id ?? null, now).run();
    // The writer has read their own line.
    await db.prepare('UPDATE channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?').bind(now, row.id, user.id).run();
    // Whoever is named in a notice is the made-up name when the writer chose one, never the real name.
    const label = anonymous ? await anonAlias(c.env, user.id, `channel:${row.id}`) : nameOf(user);
    const told = await tellMentioned(db, user, text, row, label, anonymous);
    if (parent && !told.has(parent.user_id) && (await seenBy(db, user.id, anonymous, [parent.user_id])).has(parent.user_id)) await notify(db, parent.user_id, 'reply', `${label} replied to you in ${row.name}`, text.slice(0, 120), linkFor(row));
    const saved = await db
      .prepare('SELECT m.seq, m.id, m.user_id, m.body, m.anonymous, m.reply_to, m.created_at, u.display_name, u.handle, u.role, u.permissions FROM channel_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?')
      .bind(id)
      .first<MsgRow>();
    return c.json({ line: saved ? ((await presentLines(c, row, [saved]))[0] ?? null) : null, seq: res.meta.last_row_id }, 201);
  });

  // A line comes down when its writer asks, or when a guide (Community) or the channel's owner (Bond) does. The words are wiped; the place stays.
  r.delete('/:id/messages/:mid', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const seen = await open(c);
    // Its writer may always take their own line down, after leaving or once it closed (2026-11-14, All tables; Leave says lines can go one by one).
    const own = seen ? null : await db.prepare("SELECT ch.* FROM channels ch JOIN channel_messages m ON m.channel_id = ch.id AND m.id = ?1 AND m.user_id = ?2 AND m.deleted_at IS NULL WHERE ch.id = ?3 AND ch.scope = ?4").bind(c.req.param('mid'), user.id, c.req.param('id') ?? '', scope).first<ChRow>();
    const row = seen ?? own;
    if (!row) return c.json({ error: 'not found' }, 404);
    const line = await db.prepare('SELECT id, user_id FROM channel_messages WHERE id = ? AND channel_id = ? AND deleted_at IS NULL').bind(c.req.param('mid'), row.id).first<{ id: string; user_id: string }>();
    if (!line) return c.json({ error: 'not found' }, 404);
    const mine = line.user_id === user.id;
    const mod = manages(row, user);
    if (!mine && !mod) return c.json({ error: 'Only its writer or a moderator can take a line down.' }, 403);
    // In Community the rank ladder holds (`canModerate`): a guide never takes down a line by staff or an admin. A Bond channel is its owner's.
    if (!mine && scope === 'community') {
      const writer = await db.prepare('SELECT role, permissions FROM users WHERE id = ?').bind(line.user_id).first<Pick<UserRow, 'role' | 'permissions'>>();
      if (writer && !canModerate(rankOf(user), rankOf(writer))) return c.json({ error: 'You cannot take this line down. Report it and the team will look.' }, 403);
    }
    const down = await db.prepare("UPDATE channel_messages SET body = '', deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL").bind(nowIso(), user.id, line.id).run();
    // Taken down already (another tab, or a second send): said, never a quiet yes, and never a second note or audit line.
    if (!down.meta.changes) return c.json({ error: 'That line was taken down a moment ago.' }, 409);
    if (!mine) {
      await audit(db, user.id, 'channel.line.delete', 'channel_message', line.id, '', { channel: row.id, scope });
      await notify(db, line.user_id, 'moderation', 'A line of yours was taken down', `In ${row.name}.`, linkFor(row));
    }
    return c.json({ ok: true });
  });

  // Tell the team about a line. It goes to the same help queue as any request, with the words of the line, since they are wiped if it is taken down.
  r.post('/:id/messages/:mid/report', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const row = await open(c);
    if (!row || (scope === 'bond' && row.my_status !== 'member')) return c.json({ error: 'not found' }, 404);
    const line = await db
      .prepare(`SELECT m.id, m.seq, m.user_id, m.body FROM channel_messages m WHERE m.id = ?2 AND m.channel_id = ?3 AND m.deleted_at IS NULL AND ${LINE_SHOWN('m')}`)
      .bind(user.id, c.req.param('mid'), row.id)
      .first<{ id: string; seq: number; user_id: string; body: string }>();
    if (!line) return c.json({ error: 'not found' }, 404);
    if (line.user_id === user.id) return c.json({ error: 'That is your own line. You can take it down instead.' }, 400);
    const note = await c.req.json<{ note?: unknown }>().then((b) => str(b.note, 300)).catch(() => '');
    const now = nowIso();
    await db
      .prepare("INSERT INTO support_tickets (id, user_id, subject, body, status, reply, replied_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', '', NULL, ?, ?)")
      .bind(newId(), user.id, `Report: a line in the ${scope} channel ${row.name}`.slice(0, 120), `Channel ${row.id}, line ${line.id} (number ${line.seq}).\nIt says: ${line.body.slice(0, 500)}${note ? `\nWhy: ${note}` : ''}`, now, now)
      .run();
    return c.json({ ok: true }, 201);
  });

  // Block the person behind a line without learning who it is, which is how an anonymous writer is blocked.
  r.post('/:id/messages/:mid/block-author', async (c) => {
    const row = await open(c);
    if (!row || (scope === 'bond' && row.my_status !== 'member')) return c.json({ error: 'not found' }, 404);
    const line = await c.env.DB.prepare('SELECT user_id, anonymous FROM channel_messages WHERE id = ? AND channel_id = ?').bind(c.req.param('mid'), row.id).first<{ user_id: string; anonymous: number }>();
    // An anonymous writer is blocked under the channel's made-up name for them, so Bond never names them.
    return blockBehind(c, line?.user_id, line?.anonymous === 1 ? await anonAlias(c.env, line.user_id, `channel:${row.id}`) : null);
  });

  return r;
}

export const communityChannels = channelRouter('community');
export const bondChannels = channelRouter('bond');
