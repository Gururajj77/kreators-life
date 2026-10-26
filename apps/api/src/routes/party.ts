import { Hono } from 'hono';
import { EVENT_TYPE_META, EVENT_TYPES, type EventRegistration, type PartyEvent } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, nameOf, newId, notify, nowIso, num, oneOf, str, isClubMember, pageOf, paged } from '../db';

export const party = new Hono<AppEnv>();

interface EventRow { id: string; title: string; description: string; event_type: PartyEvent['eventType']; host_user_id: string; host_name: string; venue: string; online_url: string | null; timezone: string; starts_at: string; ends_at: string; capacity: number | null; price_points: number; visibility: PartyEvent['visibility']; status: PartyEvent['status']; created_at: string; registered: number; waitlisted: number }
const SELECT = `SELECT e.*, u.display_name AS host_name,
  (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status IN ('registered','attended')) AS registered,
  (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'waitlisted') AS waitlisted
  FROM events e JOIN users u ON u.id = e.host_user_id`;
interface RegRow { id: string; event_id: string; user_id: string; name: string; status: EventRegistration['status']; registered_at: string; checked_in_at: string | null; networking_opt_in: number }
const toReg = (r: RegRow): EventRegistration => ({ id: r.id, eventId: r.event_id, userId: r.user_id, name: nameOf({ display_name: r.name }), status: r.status, registeredAt: r.registered_at, checkedInAt: r.checked_in_at, networkingOptIn: r.networking_opt_in === 1 });
const toEvent = (r: EventRow, mine: EventRegistration | null): PartyEvent => ({ id: r.id, title: r.title, description: r.description, eventType: r.event_type, hostId: r.host_user_id, hostName: nameOf({ display_name: r.host_name }), venue: r.venue, onlineUrl: r.online_url, timezone: r.timezone, startsAt: r.starts_at, endsAt: r.ends_at, capacity: r.capacity, pricePoints: r.price_points, visibility: r.visibility, status: r.status, registered: r.registered, waitlisted: r.waitlisted, mine, createdAt: r.created_at });

const clubMember = isClubMember;

party.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const club = await clubMember(db, user.id);
  const ask = pageOf(c);
  const rows = await db.prepare(`${SELECT} WHERE e.status = 'published' AND e.ends_at >= ? AND (e.visibility = 'public' OR (e.visibility = 'club' AND ?) OR e.host_user_id = ? OR e.id IN (SELECT event_id FROM event_registrations WHERE user_id = ?)) ORDER BY e.starts_at LIMIT ? OFFSET ?`).bind(nowIso(), club ? 1 : 0, user.id, user.id, ask.limit, ask.offset).all<EventRow>();
  const regs = await db.prepare('SELECT r.*, u.display_name AS name FROM event_registrations r JOIN users u ON u.id = r.user_id WHERE r.user_id = ?').bind(user.id).all<RegRow>();
  const mine = new Map(regs.results.map((r) => [r.event_id, toReg(r)]));
  const hosting = await db.prepare(`${SELECT} WHERE e.host_user_id = ? ORDER BY e.starts_at DESC LIMIT 50`).bind(user.id).all<EventRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, events: pg.items.map((e) => toEvent(e, mine.get(e.id) ?? null)), hosting: hosting.results.map((e) => toEvent(e, null)), canHostAll: can(user, 'events'), club });
});

// Anyone can host a meetup; parties, workshops, camps and days are staff events.
party.post('/events', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const type = oneOf(body.eventType, EVENT_TYPES, 'meetup');
  if (EVENT_TYPE_META[type].staffOnly && !can(user, 'events')) return c.json({ error: `only event hosts on staff can create a ${EVENT_TYPE_META[type].name.toLowerCase()}` }, 403);
  const title = str(body.title, 120);
  const startsAt = str(body.startsAt, 40);
  if (!title || !startsAt || Number.isNaN(new Date(startsAt).getTime())) return c.json({ error: 'title and a start time' }, 400);
  const start = new Date(startsAt);
  const minutes = num(body.minutes, 120, 15, 24 * 60 * 7) ?? 120;
  const id = newId();
  await db
    .prepare("INSERT INTO events (id, title, description, event_type, host_user_id, venue, online_url, timezone, starts_at, ends_at, capacity, price_points, visibility, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)")
    .bind(id, title, str(body.description, 3000), type, user.id, str(body.venue, 200), str(body.onlineUrl, 500) || null, str(body.timezone, 60, 'UTC') || 'UTC', start.toISOString(), new Date(start.getTime() + minutes * 60_000).toISOString(), num(body.capacity, null, 1, 100000), num(body.pricePoints, 0, 0) ?? 0, oneOf(body.visibility, ['public', 'private', 'club'] as const, 'public'), nowIso())
    .run();
  await audit(db, user.id, 'event.create', 'event', id, '', title);
  const row = await db.prepare(`${SELECT} WHERE e.id = ?`).bind(id).first<EventRow>();
  return c.json({ event: row ? toEvent(row, null) : null }, 201);
});

party.get('/events/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE e.id = ?`).bind(c.req.param('id')).first<EventRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const host = row.host_user_id === user.id || can(user, 'events');
  const mineRow = await db.prepare('SELECT r.*, u.display_name AS name FROM event_registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? AND r.user_id = ?').bind(row.id, user.id).first<RegRow>();
  if (!host && !mineRow && row.visibility === 'private') return c.json({ error: 'not found' }, 404);
  if (!host && !mineRow && row.visibility === 'club' && !(await clubMember(db, user.id))) return c.json({ error: 'club members only' }, 403);
  const regs = host ? await db.prepare('SELECT r.*, u.display_name AS name FROM event_registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? ORDER BY r.registered_at').bind(row.id).all<RegRow>() : { results: [] as RegRow[] };
  const fb = await db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM event_feedback WHERE event_id = ?').bind(row.id).first<{ avg: number | null; n: number }>();
  return c.json({ event: toEvent(row, mineRow ? toReg(mineRow) : null), registrations: regs.results.map(toReg), host, feedback: { average: fb?.avg ? Math.round(fb.avg * 10) / 10 : null, count: fb?.n ?? 0 } });
});

// RSVP: the seat is taken in a single statement so two people cannot both get the last one.
party.post('/events/:id/rsvp', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE e.id = ? AND e.status = 'published'`).bind(c.req.param('id')).first<EventRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.visibility === 'club' && !(await clubMember(db, user.id))) return c.json({ error: 'club members only' }, 403);
  if (new Date(row.ends_at).getTime() < Date.now()) return c.json({ error: 'this event is over' }, 400);
  const existing = await db.prepare("SELECT status FROM event_registrations WHERE event_id = ? AND user_id = ?").bind(row.id, user.id).first<{ status: string }>();
  if (existing && existing.status !== 'cancelled') return c.json({ error: `you are already ${existing.status}` }, 409);
  if (row.price_points > 0 && user.points < row.price_points) return c.json({ error: `you need ${row.price_points - user.points} more points` }, 400);
  const body = await c.req.json<{ networking?: boolean }>().catch(() => ({}) as { networking?: boolean });
  const id = newId();
  const now = nowIso();
  const cap = row.capacity ?? 1_000_000;
  // Try for a seat; if the seat count is already at capacity the insert does nothing and we waitlist.
  await db.prepare('DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?').bind(row.id, user.id).run();
  const seat = await db
    .prepare(`INSERT INTO event_registrations (id, event_id, user_id, status, registered_at, checked_in_at, networking_opt_in)
      SELECT ?1, ?2, ?3, 'registered', ?4, NULL, ?5 WHERE (SELECT COUNT(*) FROM event_registrations WHERE event_id = ?2 AND status IN ('registered','attended')) < ?6`)
    .bind(id, row.id, user.id, now, body.networking ? 1 : 0, cap)
    .run();
  let status: EventRegistration['status'] = 'registered';
  if (seat.meta.changes !== 1) {
    status = 'waitlisted';
    await db.prepare("INSERT INTO event_registrations (id, event_id, user_id, status, registered_at, checked_in_at, networking_opt_in) VALUES (?, ?, ?, 'waitlisted', ?, NULL, ?)").bind(id, row.id, user.id, now, body.networking ? 1 : 0).run();
  } else if (row.price_points > 0) {
    await db.batch([
      db.prepare('UPDATE users SET points = points - ? WHERE id = ?').bind(row.price_points, user.id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, -row.price_points, 'ticket', id, now),
    ]);
  }
  await notify(db, user.id, 'party', status === 'registered' ? `You are in: ${row.title}` : `Waitlisted for ${row.title}`, new Date(row.starts_at).toUTCString(), `/party/${row.id}`);
  return c.json({ status }, 201);
});

party.post('/events/:id/cancel-rsvp', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE e.id = ?`).bind(c.req.param('id')).first<EventRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const mine = await db.prepare('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?').bind(row.id, user.id).first<RegRow>();
  if (!mine || mine.status === 'cancelled') return c.json({ error: 'you are not registered' }, 400);
  const wasSeated = mine.status === 'registered';
  await db.prepare("UPDATE event_registrations SET status = 'cancelled' WHERE id = ?").bind(mine.id).run();
  if (wasSeated && row.price_points > 0) {
    await db.batch([
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(row.price_points, user.id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, row.price_points, 'refund', mine.id, nowIso()),
    ]);
  }
  // Promote the first person on the waitlist into the freed seat.
  if (wasSeated) {
    const next = await db.prepare("SELECT id, user_id FROM event_registrations WHERE event_id = ? AND status = 'waitlisted' ORDER BY registered_at LIMIT 1").bind(row.id).first<{ id: string; user_id: string }>();
    if (next) {
      await db.prepare("UPDATE event_registrations SET status = 'registered' WHERE id = ?").bind(next.id).run();
      await notify(db, next.user_id, 'party', `A seat opened up: ${row.title}`, 'You are off the waitlist.', `/party/${row.id}`);
    }
  }
  return c.json({ ok: true });
});

party.post('/events/:id/checkin', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; host_user_id: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.host_user_id !== user.id && !can(user, 'events')) return c.json({ error: 'the host checks people in' }, 403);
  const body = await c.req.json<{ userId?: string }>().catch(() => ({}) as { userId?: string });
  const res = await db.prepare("UPDATE event_registrations SET status = 'attended', checked_in_at = ? WHERE event_id = ? AND user_id = ? AND status IN ('registered','attended')").bind(nowIso(), row.id, str(body.userId, 64)).run();
  if (res.meta.changes === 0) return c.json({ error: 'that person is not registered' }, 400);
  return c.json({ ok: true });
});

party.post('/events/:id/feedback', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const reg = await db.prepare("SELECT status FROM event_registrations WHERE event_id = ? AND user_id = ? AND status IN ('registered','attended')").bind(c.req.param('id'), user.id).first();
  if (!reg) return c.json({ error: 'only people who registered can leave feedback' }, 403);
  const body = await c.req.json<{ rating?: number; comment?: string; networking?: boolean }>().catch(() => ({}) as Record<string, never>);
  const rating = num(body.rating, null, 1, 5);
  if (rating === null) return c.json({ error: 'a rating from one to five' }, 400);
  await db.batch([
    db.prepare('INSERT OR REPLACE INTO event_feedback (id, event_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId(), c.req.param('id'), user.id, rating, str(body.comment, 1000), nowIso()),
    db.prepare('UPDATE event_registrations SET networking_opt_in = ? WHERE event_id = ? AND user_id = ?').bind(body.networking ? 1 : 0, c.req.param('id'), user.id),
  ]);
  return c.json({ ok: true }, 201);
});

party.patch('/events/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; host_user_id: string; title: string; status: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.host_user_id !== user.id && !can(user, 'events')) return c.json({ error: 'the host changes an event' }, 403);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const status = oneOf(body.status, ['published', 'cancelled', 'done'] as const, 'published');
  await db.prepare('UPDATE events SET status = ? WHERE id = ?').bind(status, row.id).run();
  await audit(db, user.id, 'event.status', 'event', row.id, row.status, status);
  if (status === 'cancelled') {
    const regs = await db.prepare("SELECT user_id FROM event_registrations WHERE event_id = ? AND status IN ('registered','waitlisted')").bind(row.id).all<{ user_id: string }>();
    for (const r of regs.results) await notify(db, r.user_id, 'party', `Cancelled: ${row.title}`, 'Any points you paid are back in your balance.', '/party');
    await db.prepare("UPDATE event_registrations SET status = 'cancelled' WHERE event_id = ?").bind(row.id).run();
  }
  return c.json({ ok: true });
});
