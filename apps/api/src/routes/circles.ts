import { Hono } from 'hono';
import { ALIAS_WORDS, attendeeXpLocked, CIRCLE_MINUTES, codeWindow, isCircleStatus, matchCircles, nextWeek, RELATIONSHIPS, RUN_CODE_WINDOW, type CircleEvent, type CircleGroup, type CircleMember, type CircleMessage, type CircleStatus, type MatchCandidate, type RelationshipKey } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, newId, notify, nowIso, num, pageOf, paged, parseList, randomCode, str } from '../db';
import { claimEventCode, codeOf, guestView, hostView, setEventCode } from '../attendee';

/**
 * Circles: small anonymous groups near you. Staff open an event in a city; people sign up;
 * two days before, tables are matched by interests that fit together and by distance.
 * Each person gets an alias. The group chat opens twenty-four hours before the meeting
 * and stays open two days after. Names only appear for people who choose to reveal.
 */
export const circles = new Hono<AppEnv>();

const HOUR = 3600_000;

interface EventRow { id: string; title: string; city: string; area: string; starts_at: string; venue_hint: string; group_size: number; status: CircleEvent['status']; repeat: 'none' | 'weekly'; series_id: string | null; created_by: string | null; created_at: string; signups: number; joined: number; my_status: string | null; my_group_id: string | null; attendee_xp: number | null; attendee_code: string | null; attendee_claims: number; seated: number }
const EVENT_SELECT = (userId: string) => `SELECT e.*,
  (SELECT COUNT(*) FROM circle_signups s WHERE s.event_id = e.id) AS signups,
  (SELECT COUNT(*) FROM circle_signups s WHERE s.event_id = e.id AND s.user_id = '${userId.replace(/'/g, '')}') AS joined,
  (SELECT s.status FROM circle_signups s WHERE s.event_id = e.id AND s.user_id = '${userId.replace(/'/g, '')}') AS my_status,
  (SELECT g.id FROM circle_groups g JOIN circle_members m ON m.group_id = g.id WHERE g.event_id = e.id AND m.user_id = '${userId.replace(/'/g, '')}' LIMIT 1) AS my_group_id,
  (SELECT a.xp FROM attendee_codes a WHERE a.app = 'circles' AND a.thing_id = e.id) AS attendee_xp,
  (SELECT a.code FROM attendee_codes a WHERE a.app = 'circles' AND a.thing_id = e.id) AS attendee_code,
  (SELECT COUNT(*) FROM attendee_claims x WHERE x.app = 'circles' AND x.thing_id = e.id) AS attendee_claims,
  (SELECT COUNT(*) FROM circle_members m JOIN circle_groups g ON g.id = m.group_id WHERE g.event_id = e.id) AS seated
  FROM circle_events e`;
/** A circle has a start and no end; its code window counts it as CIRCLE_MINUTES long. */
const circleEnd = (startsAt: string) => new Date(Date.parse(startsAt) + CIRCLE_MINUTES * 60_000).toISOString();
/**
 * Circles are opened by events staff, and any of them can run one: see and set its code, set its tables. A person
 * who opened circles and has since lost the permission no longer can.
 */
const hostsCircle = (user: Parameters<typeof can>[0]) => can(user, 'events');

/** `showCode` is for events staff: the code and how many of the seated claimed it. Never names: circles are aliases. */
const toEvent = (r: EventRow, showCode: boolean): CircleEvent => ({
  id: r.id,
  title: r.title,
  city: r.city,
  area: r.area,
  startsAt: r.starts_at,
  venueHint: r.venue_hint,
  groupSize: r.group_size,
  status: r.status,
  repeat: r.repeat === 'weekly' ? 'weekly' : 'none',
  seriesId: r.series_id,
  signups: r.signups,
  joined: r.joined > 0,
  myStatus: isCircleStatus(r.my_status) ? r.my_status : null,
  myGroupId: r.my_group_id,
  attendeeXp: r.attendee_xp ?? null,
  hostCode: showCode && r.attendee_code ? { code: r.attendee_code, xp: r.attendee_xp ?? 0, locked: attendeeXpLocked(r.starts_at), claims: r.attendee_claims, guests: r.seated, ...codeWindow(r.starts_at, circleEnd(r.starts_at)) } : null,
  createdAt: r.created_at,
});

interface GroupRow { id: string; event_id: string; event_title: string; city: string; area: string; starts_at: string; repeat: 'none' | 'weekly'; event_status: string; name: string; venue: string; plan: string; chat_opens_at: string }
const GROUP_SELECT = 'SELECT g.*, e.title AS event_title, e.city, e.area, e.starts_at, e.repeat, e.status AS event_status FROM circle_groups g JOIN circle_events e ON e.id = g.event_id';
interface MemberRow { user_id: string; alias: string; character: RelationshipKey; revealed: number; status: string; interests: string; display_name: string; handle: string | null }

async function groupFor(db: D1Database, row: GroupRow, userId: string, withMessages: boolean): Promise<CircleGroup> {
  const members = await db.prepare('SELECT m.*, u.interests, u.display_name, u.handle FROM circle_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.alias').bind(row.id).all<MemberRow>();
  const opens = new Date(row.chat_opens_at).getTime();
  const closes = new Date(row.starts_at).getTime() + 48 * HOUR;
  const now = Date.now();
  const chatOpen = now >= opens && now <= closes;
  // Everyone stays under their alias for good. Names, handles and ids never leave the server.
  const list: CircleMember[] = members.results.map((m) => ({
    alias: m.alias,
    character: m.character,
    interests: parseList(m.interests).slice(0, 4),
    revealed: false,
    name: null,
    handle: null,
    userId: null,
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
    myStatus: ((): CircleStatus | null => {
      const mine = members.results.find((m) => m.user_id === userId)?.status;
      return isCircleStatus(mine) ? mine : null;
    })(),
    repeat: row.repeat === 'weekly' ? 'weekly' : 'none',
  };
}

circles.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const city = user.city.trim();
  // Show circles you can still join, plus any you are already in. Closed ones you never joined are noise.
  const joinable = `(e.status = 'open' AND e.starts_at > '${new Date(Date.now() + 36 * HOUR).toISOString()}')`;
  const signedUp = `e.id IN (SELECT event_id FROM circle_signups WHERE user_id = '${user.id.replace(/'/g, '')}')`;
  const events = city
    ? await db.prepare(`${EVENT_SELECT(user.id)} WHERE e.status IN ('open','matched') AND e.starts_at >= ? AND ((${joinable} AND LOWER(e.city) = LOWER(?)) OR ${signedUp}) ORDER BY e.starts_at LIMIT 50`).bind(new Date(Date.now() - 48 * HOUR).toISOString(), city).all<EventRow>()
    : await db.prepare(`${EVENT_SELECT(user.id)} WHERE e.status IN ('open','matched') AND e.starts_at >= ? AND (${joinable} OR ${signedUp}) ORDER BY e.starts_at LIMIT 50`).bind(new Date(Date.now() - 48 * HOUR).toISOString()).all<EventRow>();
  const groups = await db.prepare(`${GROUP_SELECT} WHERE g.id IN (SELECT group_id FROM circle_members WHERE user_id = ?) ORDER BY e.starts_at DESC LIMIT 20`).bind(user.id).all<GroupRow>();
  const mine = await Promise.all(groups.results.map((g) => groupFor(db, g, user.id, false)));
  // Events staff run every circle, in every city, until its code closes: the code, the tables and the counts.
  const host = hostsCircle(user);
  const ask = pageOf(c, 'host');
  const running = host
    ? await db.prepare(`${EVENT_SELECT(user.id)} WHERE e.status IN ('open','matched') AND e.starts_at >= ? ORDER BY e.starts_at LIMIT ? OFFSET ?`).bind(new Date(Date.now() - (CIRCLE_MINUTES + RUN_CODE_WINDOW.after) * 60_000).toISOString(), ask.limit, ask.offset).all<EventRow>()
    : { results: [] as EventRow[] };
  const hosting = paged(running.results, ask);
  return c.json({ events: events.results.map((e) => toEvent(e, false)), hosting: hosting.items.map((e) => toEvent(e, true)), hostingPage: hosting.page, groups: mine, city: user.city, area: user.area, interests: parseList(user.interests), hasLocation: user.lat !== null && user.lng !== null, canCreate: host });
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
    .prepare("INSERT INTO circle_events (id, title, city, area, starts_at, venue_hint, group_size, status, repeat, series_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)")
    .bind(id, title, city, str(body.area, 80), start.toISOString(), str(body.venueHint, 200), num(body.groupSize, 5, 3, 8) ?? 5, body.repeat === 'weekly' ? 'weekly' : 'none', id, user.id, nowIso())
    .run();
  // An attendee code from the start, when the host set xp for the seated guests.
  let codeError: string | null = null;
  if (body.attendeeXp !== undefined && body.attendeeXp !== null && body.attendeeXp !== '' && Number(body.attendeeXp) > 0) {
    const set = await setEventCode(db, 'circles', id, start.toISOString(), user.id, { xp: body.attendeeXp, code: body.attendeeCode }, true);
    if ('error' in set) codeError = set.error;
    else await audit(db, user.id, 'attendee_code.set', 'circle', id, '', { xp: set.row.xp });
  }
  const row = await db.prepare(`${EVENT_SELECT(user.id)} WHERE e.id = ?`).bind(id).first<EventRow>();
  return c.json({ event: row ? toEvent(row, true) : null, codeError }, 201);
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
  const body = await c.req.json<{ note?: string; status?: string }>().catch(() => ({}) as { note?: string; status?: string });
  // How they will show up: the only thing the table needs to know, and only they see it.
  if (!isCircleStatus(body.status)) return c.json({ error: 'say how you will show up: single, committed, or rather not say' }, 400);
  await db
    .prepare('INSERT INTO circle_signups (event_id, user_id, note, status, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id, user_id) DO UPDATE SET note = excluded.note, status = excluded.status')
    .bind(ev.id, user.id, str(body.note, 200), body.status, nowIso())
    .run();
  return c.json({ ok: true, status: body.status }, 201);
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
  const rows = await db.prepare('SELECT s.user_id, s.created_at, s.status, u.interests, u.area, u.lat, u.lng FROM circle_signups s JOIN users u ON u.id = s.user_id WHERE s.event_id = ? ORDER BY s.created_at').bind(ev.id).all<{ user_id: string; created_at: string; status: string; interests: string; area: string; lat: number | null; lng: number | null }>();
  const statusOf = new Map(rows.results.map((r) => [r.user_id, r.status]));
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
      stmts.push(db.prepare('INSERT INTO circle_members (group_id, user_id, alias, character, revealed, status) VALUES (?, ?, ?, ?, 0, ?)').bind(gid, uid, alias, character.key, statusOf.get(uid) ?? ''));
    });
    await db.batch(stmts);
    for (const uid of ids) await notify(db, uid, 'circle', `Your table for ${ev.title} is set`, `You are at a table of ${ids.length}. The chat opens a day before.`, `/circles/${gid}`);
  }
  for (const uid of result.unmatched) await notify(db, uid, 'circle', `No table this time for ${ev.title}`, 'Too few people nearby signed up. You are first in line next time.', '/circles');
  await db.prepare("UPDATE circle_events SET status = 'matched' WHERE id = ?").bind(ev.id).run();
  return { groups: result.groups.length, unmatched: result.unmatched.length };
}

/**
 * Weekly circles roll on their own: once the latest occurrence in a series has its tables set or has passed,
 * the next one opens a week later at the same time, so there is always one to join. Cancelling the latest
 * occurrence ends the series. Past circles are marked done two days after they met.
 */
export async function rollWeeklyCircles(db: D1Database): Promise<number> {
  const now = Date.now();
  await db.prepare("UPDATE circle_events SET status = 'done' WHERE status IN ('open','matched') AND starts_at < ?").bind(new Date(now - 48 * HOUR).toISOString()).run();
  const latest = await db
    .prepare("SELECT e.* FROM circle_events e WHERE e.repeat = 'weekly' AND e.starts_at = (SELECT MAX(x.starts_at) FROM circle_events x WHERE x.series_id = e.series_id)")
    .all<{ id: string; title: string; city: string; area: string; starts_at: string; venue_hint: string; group_size: number; status: string; series_id: string | null; created_by: string | null }>();
  let n = 0;
  for (const e of latest.results) {
    if (e.status === 'cancelled') continue;
    if (e.status === 'open' && new Date(e.starts_at).getTime() > now) continue;
    let next = nextWeek(e.starts_at);
    while (new Date(next).getTime() < now + 36 * HOUR) next = nextWeek(next);
    const id = newId();
    const at = nowIso();
    const stmts = [
      db
        .prepare("INSERT INTO circle_events (id, title, city, area, starts_at, venue_hint, group_size, status, repeat, series_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 'weekly', ?, ?, ?)")
        .bind(id, e.title, e.city, e.area, next, e.venue_hint, e.group_size, e.series_id ?? e.id, e.created_by, at),
    ];
    // Next week's circle keeps this week's xp, with a new random code: last week's guests know the old one.
    const code = await codeOf(db, 'circles', e.id);
    if (code) stmts.push(db.prepare("INSERT INTO attendee_codes (app, thing_id, code, xp, created_by, created_at, updated_at) VALUES ('circles', ?, ?, ?, ?, ?, ?)").bind(id, randomCode(6), code.xp, code.created_by, at, at));
    await db.batch(stmts);
    n += 1;
  }
  return n;
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

// Events staff set the xp until the code opens, and the code any time.
circles.put('/events/:id/attendee-code', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT id, created_by, starts_at, status FROM circle_events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; created_by: string | null; starts_at: string; status: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (!hostsCircle(user)) return c.json({ error: 'the host sets the code' }, 403);
  if (row.status === 'cancelled') return c.json({ error: 'This circle was cancelled.' }, 400);
  const body = await c.req.json<{ xp?: unknown; code?: unknown; fresh?: unknown }>().catch(() => ({}) as Record<string, never>);
  const prev = await codeOf(db, 'circles', row.id);
  const set = await setEventCode(db, 'circles', row.id, row.starts_at, user.id, body);
  if ('error' in set) return c.json({ error: set.error }, set.status);
  await audit(db, user.id, 'attendee_code.set', 'circle', row.id, prev ? { xp: prev.xp } : '', { xp: set.row.xp, newCode: set.row.code !== prev?.code });
  const seated = await db.prepare('SELECT COUNT(*) AS n FROM circle_members m JOIN circle_groups g ON g.id = m.group_id WHERE g.event_id = ?').bind(row.id).first<{ n: number }>();
  return c.json({ hostCode: await hostView(db, set.row, row.starts_at, circleEnd(row.starts_at), seated?.n ?? 0) });
});

// Someone seated at one of the circle's tables types the code at the meetup. Events staff and whoever opened it never claim.
circles.post('/events/:id/claim', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT id, created_by, starts_at, status FROM circle_events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; created_by: string | null; starts_at: string; status: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const seat = await db.prepare('SELECT 1 FROM circle_members m JOIN circle_groups g ON g.id = m.group_id WHERE g.event_id = ? AND m.user_id = ?').bind(row.id, user.id).first();
  const body = await c.req.json<{ code?: unknown }>().catch(() => ({}) as { code?: unknown });
  const got = await claimEventCode(db, { app: 'circles', thingId: row.id, userId: user.id, host: hostsCircle(user) || row.created_by === user.id, guest: Boolean(seat), cancelled: row.status === 'cancelled', startsAt: row.starts_at, endsAt: circleEnd(row.starts_at), code: body.code });
  if ('error' in got) return c.json({ error: got.error }, got.status);
  return c.json(got, 201);
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
  const attendee = row.event_status === 'cancelled' ? null : await guestView(db, await codeOf(db, 'circles', row.event_id), user.id, row.starts_at, circleEnd(row.starts_at));
  return c.json({ group, opensInMinutes: Math.max(0, Math.ceil((new Date(row.chat_opens_at).getTime() - Date.now()) / 60_000)), attendee });
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

/** Who sits behind an alias at one of this person's tables. Used by Bond to open an anonymous chat; the id stays on the server. */
export async function memberBehindAlias(db: D1Database, groupId: string, viewerId: string, alias: string): Promise<string | null> {
  const row = await myGroup(db, groupId, viewerId);
  if (!row) return null;
  const m = await db.prepare('SELECT user_id FROM circle_members WHERE group_id = ? AND alias = ?').bind(row.id, alias).first<{ user_id: string }>();
  return m?.user_id ?? null;
}
