import { Hono } from 'hono';
import { ALIAS_WORDS, matchCircles, RELATIONSHIPS, type CircleEvent, type CircleGroup, type CircleMember, type CircleMessage, type MatchCandidate, type RelationshipKey } from '@kreators/shared';
import type { AppEnv } from '../env';
import { can, nameOf, newId, notify, nowIso, num, parseList, str } from '../db';

/**
 * Circles: small anonymous groups near you. Staff open an event in a city; people sign up;
 * two days before, tables are matched by interests that fit together and by distance.
 * Each person gets an alias. The group chat opens twenty-four hours before the meeting
 * and stays open two days after. Names only appear for people who choose to reveal.
 */
export const circles = new Hono<AppEnv>();

const HOUR = 3600_000;

interface EventRow { id: string; title: string; city: string; area: string; starts_at: string; venue_hint: string; group_size: number; status: CircleEvent['status']; created_at: string; signups: number; joined: number; my_group_id: string | null }
const EVENT_SELECT = (userId: string) => `SELECT e.*,
  (SELECT COUNT(*) FROM circle_signups s WHERE s.event_id = e.id) AS signups,
  (SELECT COUNT(*) FROM circle_signups s WHERE s.event_id = e.id AND s.user_id = '${userId.replace(/'/g, '')}') AS joined,
  (SELECT g.id FROM circle_groups g JOIN circle_members m ON m.group_id = g.id WHERE g.event_id = e.id AND m.user_id = '${userId.replace(/'/g, '')}' LIMIT 1) AS my_group_id
  FROM circle_events e`;
const toEvent = (r: EventRow): CircleEvent => ({ id: r.id, title: r.title, city: r.city, area: r.area, startsAt: r.starts_at, venueHint: r.venue_hint, groupSize: r.group_size, status: r.status, signups: r.signups, joined: r.joined > 0, myGroupId: r.my_group_id, createdAt: r.created_at });

interface GroupRow { id: string; event_id: string; event_title: string; city: string; area: string; starts_at: string; name: string; venue: string; plan: string; chat_opens_at: string }
const GROUP_SELECT = 'SELECT g.*, e.title AS event_title, e.city, e.area, e.starts_at FROM circle_groups g JOIN circle_events e ON e.id = g.event_id';
interface MemberRow { user_id: string; alias: string; character: RelationshipKey; revealed: number; interests: string; display_name: string; handle: string | null }

async function groupFor(db: D1Database, row: GroupRow, userId: string, withMessages: boolean): Promise<CircleGroup> {
  const members = await db.prepare('SELECT m.*, u.interests, u.display_name, u.handle FROM circle_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.alias').bind(row.id).all<MemberRow>();
  const opens = new Date(row.chat_opens_at).getTime();
  const closes = new Date(row.starts_at).getTime() + 48 * HOUR;
  const now = Date.now();
  const chatOpen = now >= opens && now <= closes;
  const list: CircleMember[] = members.results.map((m) => ({
    alias: m.alias,
    character: m.character,
    interests: parseList(m.interests).slice(0, 4),
    revealed: m.revealed === 1,
    name: m.revealed === 1 ? nameOf(m) : null,
    handle: m.revealed === 1 ? m.handle : null,
    userId: m.revealed === 1 ? m.user_id : null,
    isMe: m.user_id === userId,
  }));
  let messages: CircleMessage[] = [];
  if (withMessages && chatOpen) {
    const rows = await db.prepare('SELECT c.id, c.user_id, c.body, c.created_at, m.alias FROM circle_messages c JOIN circle_members m ON m.group_id = c.group_id AND m.user_id = c.user_id WHERE c.group_id = ? ORDER BY c.created_at LIMIT 300').bind(row.id).all<{ id: string; user_id: string; body: string; created_at: string; alias: string }>();
    messages = rows.results.map((r) => ({ id: r.id, alias: r.alias, body: r.body, createdAt: r.created_at, mine: r.user_id === userId }));
  }
  return {
    id: row.id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    city: row.city,
    area: row.area,
    startsAt: row.starts_at,
    name: row.name,
    venue: row.venue,
    plan: row.plan,
    chatOpensAt: row.chat_opens_at,
    chatOpen,
    chatClosesAt: new Date(closes).toISOString(),
    members: list,
    messages,
    myAlias: list.find((m) => m.isMe)?.alias ?? '',
  };
}

circles.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const city = user.city.trim();
  const events = city
    ? await db.prepare(`${EVENT_SELECT(user.id)} WHERE e.status IN ('open','matched') AND e.starts_at >= ? AND (LOWER(e.city) = LOWER(?) OR e.id IN (SELECT event_id FROM circle_signups WHERE user_id = ?)) ORDER BY e.starts_at LIMIT 50`).bind(new Date(Date.now() - 48 * HOUR).toISOString(), city, user.id).all<EventRow>()
    : await db.prepare(`${EVENT_SELECT(user.id)} WHERE e.status IN ('open','matched') AND e.starts_at >= ? ORDER BY e.starts_at LIMIT 50`).bind(new Date(Date.now() - 48 * HOUR).toISOString()).all<EventRow>();
  const groups = await db.prepare(`${GROUP_SELECT} WHERE g.id IN (SELECT group_id FROM circle_members WHERE user_id = ?) ORDER BY e.starts_at DESC LIMIT 20`).bind(user.id).all<GroupRow>();
  const mine = await Promise.all(groups.results.map((g) => groupFor(db, g, user.id, false)));
  return c.json({ events: events.results.map(toEvent), groups: mine, city: user.city, area: user.area, interests: parseList(user.interests), hasLocation: user.lat !== null && user.lng !== null, canCreate: can(user, 'events') });
});

circles.post('/events', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'events')) return c.json({ error: 'event hosts on staff open circles' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const city = str(body.city, 80);
  const start = new Date(str(body.startsAt, 40));
  if (!title || !city || Number.isNaN(start.getTime())) return c.json({ error: 'a title, a city and a start time' }, 400);
  const id = newId();
  await db
    .prepare("INSERT INTO circle_events (id, title, city, area, starts_at, venue_hint, group_size, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)")
    .bind(id, title, city, str(body.area, 80), start.toISOString(), str(body.venueHint, 200), num(body.groupSize, 5, 3, 8) ?? 5, user.id, nowIso())
    .run();
  const row = await db.prepare(`${EVENT_SELECT(user.id)} WHERE e.id = ?`).bind(id).first<EventRow>();
  return c.json({ event: row ? toEvent(row) : null }, 201);
});

// Signing up needs interests and a city, otherwise there is nothing to match on.
circles.post('/events/:id/join', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ev = await db.prepare('SELECT * FROM circle_events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; status: string; starts_at: string; city: string }>();
  if (!ev || ev.status !== 'open') return c.json({ error: 'this circle is not open' }, 404);
  if (new Date(ev.starts_at).getTime() - Date.now() < 36 * HOUR) return c.json({ error: 'signups close thirty-six hours before' }, 400);
  if (parseList(user.interests).length < 2) return c.json({ error: 'pick at least two interests first, under Profile' }, 400);
  if (!user.city.trim()) return c.json({ error: 'add your city first, under Profile' }, 400);
  const body = await c.req.json<{ note?: string }>().catch(() => ({}) as { note?: string });
  await db.prepare('INSERT OR IGNORE INTO circle_signups (event_id, user_id, note, created_at) VALUES (?, ?, ?, ?)').bind(ev.id, user.id, str(body.note, 200), nowIso()).run();
  return c.json({ ok: true }, 201);
});

circles.delete('/events/:id/join', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ev = await db.prepare('SELECT status FROM circle_events WHERE id = ?').bind(c.req.param('id')).first<{ status: string }>();
  if (!ev) return c.json({ error: 'not found' }, 404);
  if (ev.status !== 'open') return c.json({ error: 'tables are already set' }, 400);
  await db.prepare('DELETE FROM circle_signups WHERE event_id = ? AND user_id = ?').bind(c.req.param('id'), user.id).run();
  return c.json({ ok: true });
});

/** Set the tables for one event. Returns how many groups formed and who could not be seated. */
export async function matchEvent(db: D1Database, eventId: string): Promise<{ groups: number; unmatched: number }> {
  const ev = await db.prepare('SELECT * FROM circle_events WHERE id = ?').bind(eventId).first<{ id: string; title: string; starts_at: string; group_size: number; status: string; venue_hint: string }>();
  if (!ev || ev.status !== 'open') return { groups: 0, unmatched: 0 };
  const rows = await db.prepare('SELECT s.user_id, s.created_at, u.interests, u.area, u.lat, u.lng FROM circle_signups s JOIN users u ON u.id = s.user_id WHERE s.event_id = ? ORDER BY s.created_at').bind(ev.id).all<{ user_id: string; created_at: string; interests: string; area: string; lat: number | null; lng: number | null }>();
  const candidates: MatchCandidate[] = rows.results.map((r) => ({ id: r.user_id, interests: parseList(r.interests), area: r.area ?? '', lat: r.lat, lng: r.lng, joinedAt: r.created_at }));
  const result = matchCircles(candidates, ev.group_size);
  const chatOpensAt = new Date(new Date(ev.starts_at).getTime() - 24 * HOUR).toISOString();
  const now = nowIso();
  let n = 0;
  for (const ids of result.groups) {
    n += 1;
    const gid = newId();
    const stmts = [db.prepare('INSERT INTO circle_groups (id, event_id, name, venue, plan, chat_opens_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(gid, ev.id, `Table ${n}`, ev.venue_hint, '', chatOpensAt, now)];
    // Aliases: a word and a character, no two alike at one table.
    const used = new Set<string>();
    ids.forEach((uid, i) => {
      const character = RELATIONSHIPS[i % RELATIONSHIPS.length] as (typeof RELATIONSHIPS)[number];
      let alias = `${ALIAS_WORDS[(i * 5 + n) % ALIAS_WORDS.length]} ${character.character}`;
      let k = 0;
      while (used.has(alias)) alias = `${ALIAS_WORDS[(i * 5 + n + k) % ALIAS_WORDS.length]} ${character.character}`, (k += 1);
      used.add(alias);
      stmts.push(db.prepare('INSERT INTO circle_members (group_id, user_id, alias, character, revealed) VALUES (?, ?, ?, ?, 0)').bind(gid, uid, alias, character.key));
    });
    await db.batch(stmts);
    for (const uid of ids) await notify(db, uid, 'circle', `Your table for ${ev.title} is set`, `You are at a table of ${ids.length}. The chat opens a day before.`, `/circles/${gid}`);
  }
  for (const uid of result.unmatched) await notify(db, uid, 'circle', `No table this time for ${ev.title}`, 'Too few people nearby signed up. You are first in line next time.', '/circles');
  await db.prepare("UPDATE circle_events SET status = 'matched' WHERE id = ?").bind(ev.id).run();
  return { groups: result.groups.length, unmatched: result.unmatched.length };
}

/** Events starting within two days get their tables set. Called by the cron. */
export async function matchDueCircles(db: D1Database): Promise<number> {
  const due = await db.prepare("SELECT id FROM circle_events WHERE status = 'open' AND starts_at <= ? AND (SELECT COUNT(*) FROM circle_signups s WHERE s.event_id = circle_events.id) >= 3").bind(new Date(Date.now() + 48 * HOUR).toISOString()).all<{ id: string }>();
  let n = 0;
  for (const e of due.results) n += (await matchEvent(db, e.id)).groups;
  return n;
}

circles.post('/events/:id/match', async (c) => {
  const user = c.get('user');
  if (!can(user, 'events')) return c.json({ error: 'event hosts on staff set the tables' }, 403);
  return c.json(await matchEvent(c.env.DB, c.req.param('id')));
});

async function myGroup(db: D1Database, groupId: string, userId: string): Promise<GroupRow | null> {
  return db.prepare(`${GROUP_SELECT} WHERE g.id = ? AND g.id IN (SELECT group_id FROM circle_members WHERE user_id = ?)`).bind(groupId, userId).first<GroupRow>();
}

circles.get('/groups/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await myGroup(db, c.req.param('id'), user.id);
  if (!row) return c.json({ error: 'not your table' }, 404);
  const group = await groupFor(db, row, user.id, true);
  return c.json({ group, opensInMinutes: Math.max(0, Math.ceil((new Date(row.chat_opens_at).getTime() - Date.now()) / 60_000)) });
});

circles.post('/groups/:id/messages', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await myGroup(db, c.req.param('id'), user.id);
  if (!row) return c.json({ error: 'not your table' }, 404);
  const opens = new Date(row.chat_opens_at).getTime();
  if (Date.now() < opens) {
    const h = Math.ceil((opens - Date.now()) / HOUR);
    return c.json({ error: `the chat opens in ${h} ${h === 1 ? 'hour' : 'hours'}, a day before you meet` }, 403);
  }
  if (Date.now() > new Date(row.starts_at).getTime() + 48 * HOUR) return c.json({ error: 'this chat has closed' }, 403);
  const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = str(body.body, 1000);
  if (!text) return c.json({ error: 'say something' }, 400);
  const id = newId();
  await db.prepare('INSERT INTO circle_messages (id, group_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, row.id, user.id, text, nowIso()).run();
  return c.json({ ok: true, id }, 201);
});

// Anyone at the table can write the plan: where and when exactly.
circles.post('/groups/:id/plan', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await myGroup(db, c.req.param('id'), user.id);
  if (!row) return c.json({ error: 'not your table' }, 404);
  const body = await c.req.json<{ venue?: string; plan?: string }>().catch(() => ({}) as Record<string, never>);
  await db.prepare('UPDATE circle_groups SET venue = ?, plan = ? WHERE id = ?').bind(str(body.venue, 200, row.venue), str(body.plan, 500, row.plan), row.id).run();
  return c.json({ ok: true });
});

// Revealing is one-way and only possible once the chat is open, so nobody is exposed before the table is real.
circles.post('/groups/:id/reveal', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await myGroup(db, c.req.param('id'), user.id);
  if (!row) return c.json({ error: 'not your table' }, 404);
  if (Date.now() < new Date(row.chat_opens_at).getTime()) return c.json({ error: 'you can reveal once the chat opens' }, 403);
  await db.prepare('UPDATE circle_members SET revealed = 1 WHERE group_id = ? AND user_id = ?').bind(row.id, user.id).run();
  const alias = await db.prepare('SELECT alias FROM circle_members WHERE group_id = ? AND user_id = ?').bind(row.id, user.id).first<{ alias: string }>();
  await db.prepare('INSERT INTO circle_messages (id, group_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(newId(), row.id, user.id, `${alias?.alias ?? 'Someone'} is ${nameOf(user)}${user.handle ? ` (/u/${user.handle})` : ''}. Say hi properly.`, nowIso()).run();
  return c.json({ ok: true });
});
