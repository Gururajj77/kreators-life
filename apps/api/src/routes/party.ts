import { quoteCode, redeem, release, type Quoted } from '../discounts';
import { Hono } from 'hono';
import { DEFAULT_ZONE, EVENT_TYPE_META, EVENT_TYPES, type EventRegistration, type PartyEvent } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, liveUser, nameOf, newId, notify, notifyMany, nowIso, num, oneOf, str, isClubMember, pageOf, paged, httpUrl } from '../db';
import { claimEventCode, codeOf, guestView, hostView, setEventCode } from '../attendee';

export const party = new Hono<AppEnv>();

interface EventRow { id: string; title: string; description: string; event_type: PartyEvent['eventType']; host_user_id: string; host_name: string; venue: string; online_url: string | null; timezone: string; starts_at: string; ends_at: string; capacity: number | null; price_points: number; visibility: PartyEvent['visibility']; status: PartyEvent['status']; created_at: string; registered: number; waitlisted: number; attendee_xp: number | null }
/** Seats taken on an event, counting only live accounts: a deleted member holds no seat and is in no count. `ev` is the SQL for the event id. */
const seatsTaken = (ev: string) => `(SELECT COUNT(*) FROM event_registrations sr JOIN users su ON su.id = sr.user_id WHERE sr.event_id = ${ev} AND sr.status IN ('registered','attended') AND ${liveUser('su')})`;
const SELECT = `SELECT e.*, u.display_name AS host_name,
  ${seatsTaken('e.id')} AS registered,
  (SELECT COUNT(*) FROM event_registrations r JOIN users ru ON ru.id = r.user_id WHERE r.event_id = e.id AND r.status = 'waitlisted' AND ${liveUser('ru')}) AS waitlisted,
  (SELECT a.xp FROM attendee_codes a WHERE a.app = 'party' AND a.thing_id = e.id) AS attendee_xp
  FROM events e JOIN users u ON u.id = e.host_user_id`;
interface RegRow { id: string; event_id: string; user_id: string; name: string; status: EventRegistration['status']; registered_at: string; checked_in_at: string | null; networking_opt_in: number; /** What the ticket cost this person; null is the full price. */ paid_points?: number | null }
const toReg = (r: RegRow): EventRegistration => ({ id: r.id, eventId: r.event_id, userId: r.user_id, name: nameOf({ display_name: r.name }), status: r.status, registeredAt: r.registered_at, checkedInAt: r.checked_in_at, networkingOptIn: r.networking_opt_in === 1 });
const toEvent = (r: EventRow, mine: EventRegistration | null): PartyEvent => ({ id: r.id, title: r.title, description: r.description, eventType: r.event_type, hostId: r.host_user_id, hostName: nameOf({ display_name: r.host_name }), venue: r.venue, onlineUrl: r.online_url, timezone: r.timezone, startsAt: r.starts_at, endsAt: r.ends_at, capacity: r.capacity, pricePoints: r.price_points, visibility: r.visibility, status: r.status, registered: r.registered, waitlisted: r.waitlisted, mine, attendeeXp: r.attendee_xp ?? null, createdAt: r.created_at });

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
    .bind(id, title, str(body.description, 3000), type, user.id, str(body.venue, 200), httpUrl(body.onlineUrl, 500) || null, str(body.timezone, 60) || user.timezone || DEFAULT_ZONE, start.toISOString(), new Date(start.getTime() + minutes * 60_000).toISOString(), num(body.capacity, null, 1, 100000), num(body.pricePoints, 0, 0) ?? 0, oneOf(body.visibility, ['public', 'private', 'club'] as const, 'public'), nowIso())
    .run();
  await audit(db, user.id, 'event.create', 'event', id, '', title);
  // An attendee code from the start, when the host set xp for the guests. A bad xp or code is said, and the event stays.
  let codeError: string | null = null;
  if (body.attendeeXp !== undefined && body.attendeeXp !== null && body.attendeeXp !== '' && Number(body.attendeeXp) > 0) {
    const set = await setEventCode(db, 'party', id, start.toISOString(), user.id, { xp: body.attendeeXp, code: body.attendeeCode }, true);
    if ('error' in set) codeError = set.error;
    else await audit(db, user.id, 'attendee_code.set', 'event', id, '', { xp: set.row.xp });
  }
  const row = await db.prepare(`${SELECT} WHERE e.id = ?`).bind(id).first<EventRow>();
  return c.json({ event: row ? toEvent(row, null) : null, codeError }, 201);
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
  // The host's guest list, a page at a time (prefix `g`), never a deleted member.
  // With no size asked for, a page is the largest size (100), so a host checking guests in at the door sees the whole room.
  const gBase = pageOf(c, 'g');
  const gAsk = c.req.query('gsize') || c.req.query('size') ? gBase : { page: gBase.page, size: 100 as const, limit: 101, offset: (gBase.page - 1) * 100 };
  const regs = host ? await db.prepare(`SELECT r.*, u.display_name AS name FROM event_registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? AND ${liveUser('u')} ORDER BY r.registered_at, r.rowid LIMIT ? OFFSET ?`).bind(row.id, gAsk.limit, gAsk.offset).all<RegRow>() : { results: [] as RegRow[] };
  const guests = paged(regs.results, gAsk);
  const fb = await db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM event_feedback WHERE event_id = ?').bind(row.id).first<{ avg: number | null; n: number }>();
  // The code goes to the host and events staff only; a guest sees the xp, whether they claimed it, and when it works.
  const code = await codeOf(db, 'party', row.id);
  const guest = Boolean(mineRow && (mineRow.status === 'registered' || mineRow.status === 'attended'));
  return c.json({
    event: toEvent(row, mineRow ? toReg(mineRow) : null),
    registrations: guests.items.map(toReg),
    registrationsPage: host ? guests.page : null,
    host,
    feedback: { average: fb?.avg ? Math.round(fb.avg * 10) / 10 : null, count: fb?.n ?? 0 },
    hostCode: host ? await hostView(db, code, row.starts_at, row.ends_at, row.registered) : null,
    attendee: !host && guest && row.status !== 'cancelled' ? await guestView(db, code, user.id, row.starts_at, row.ends_at) : null,
  });
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
  const body = await c.req.json<{ networking?: boolean; discountCode?: string }>().catch(() => ({}) as { networking?: boolean; discountCode?: string });
  // A code from the team takes a percent off a ticket that costs points. The price is worked out here, from the event's own price.
  let discount: Extract<Quoted, { ok: true }> | null = null;
  let owe = row.price_points;
  if (typeof body.discountCode === 'string' && body.discountCode.trim()) {
    if (row.price_points <= 0) return c.json({ error: 'This ticket costs nothing, so there is nothing to take off.' }, 400);
    const q = await quoteCode(db, user.id, body.discountCode, 'event', row.id, { cents: 0, points: row.price_points, currency: 'INR' });
    if (!q.ok) return c.json({ error: q.why }, 400);
    discount = q;
    owe = q.quote.payPoints;
  }
  if (owe > 0 && user.points < owe) return c.json({ error: `you need ${owe - user.points} more points` }, 400);
  const id = newId();
  const now = nowIso();
  if (discount) {
    const why = await redeem(db, { row: discount.row, userId: user.id, area: 'event', itemId: row.id, ref: id, offCents: 0, offPoints: discount.quote.offPoints, currency: 'INR' });
    if (why) return c.json({ error: why }, 409);
  }
  const cap = row.capacity ?? 1_000_000;
  // Try for a seat, never by deleting a row first: a cancelled row of this person's is reused, else a new one is written, and
  // only the request whose own statement changed a row goes on to pay. Two taps at once take one seat and one charge.
  const reuse = existing?.status === 'cancelled';
  const seatCount = `${seatsTaken('?2')} < ?6`;
  const take = (want: 'registered' | 'waitlisted', paid: number, guardSeat: boolean) =>
    reuse
      ? db
          .prepare(`UPDATE event_registrations SET id = ?1, status = '${want}', registered_at = ?4, checked_in_at = NULL, networking_opt_in = ?5, paid_points = ?7
            WHERE event_id = ?2 AND user_id = ?3 AND status = 'cancelled'${guardSeat ? ` AND ${seatCount}` : ' AND ?6 = ?6'}`)
          .bind(id, row.id, user.id, now, body.networking ? 1 : 0, cap, paid)
          .run()
      : db
          .prepare(`INSERT INTO event_registrations (id, event_id, user_id, status, registered_at, checked_in_at, networking_opt_in, paid_points)
            SELECT ?1, ?2, ?3, '${want}', ?4, NULL, ?5, ?7 WHERE ${guardSeat ? seatCount : '?6 = ?6'}
            ON CONFLICT(event_id, user_id) DO NOTHING`)
          .bind(id, row.id, user.id, now, body.networking ? 1 : 0, cap, paid)
          .run();
  const seat = await take('registered', row.price_points > 0 ? owe : 0, true);
  let status: EventRegistration['status'] = 'registered';
  if (seat.meta.changes !== 1) {
    // Nothing is charged on a waitlist (paid_points 0, so a cancel can never refund a price nobody paid).
    const wait = await take('waitlisted', 0, false);
    if (discount) await release(db, id);
    if (wait.meta.changes !== 1) return c.json({ error: 'you are already registered' }, 409);
    status = 'waitlisted';
  } else if (owe > 0) {
    // The points leave with a guarded update; if two taps at once left too few, the seat is given up.
    const debit = await db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').bind(owe, user.id, owe).run();
    if (debit.meta.changes !== 1) {
      await db.prepare("UPDATE event_registrations SET status = 'cancelled' WHERE id = ?").bind(id).run();
      if (discount) await release(db, id);
      return c.json({ error: 'you need more points' }, 400);
    }
    await db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, -owe, 'ticket', id, now).run();
  }
  await notify(db, user.id, 'party', status === 'registered' ? `You are in: ${row.title}` : `Waitlisted for ${row.title}`, new Date(row.starts_at).toUTCString(), `/party/${row.id}`);
  return c.json({ status }, 201);
});

/**
 * What this registration actually paid: its paid_points, or for a row written before that column, the ticket line in the
 * ledger. Never the list price, so a seat that cost nothing (a waitlist row, a free promotion) refunds nothing.
 */
async function paidFor(db: D1Database, reg: { id: string; user_id: string; paid_points?: number | null }): Promise<number> {
  if (reg.paid_points !== null && reg.paid_points !== undefined) return Math.max(0, reg.paid_points);
  const t = await db.prepare("SELECT COALESCE(-SUM(amount), 0) AS n FROM points_ledger WHERE user_id = ? AND reason = 'ticket' AND ref = ?").bind(reg.user_id, reg.id).first<{ n: number }>();
  return Math.max(0, t?.n ?? 0);
}

/**
 * A seat opened: the first waitlisted person who can pay takes it. The points leave first with a guarded update, then the row
 * moves with a guarded status change that also checks the seat count, so two cancels at once never seat two people for one
 * seat; if the move loses, the points go back. Someone who cannot pay stays on the waitlist and is told.
 */
async function promoteNext(db: D1Database, ev: { id: string; title: string; price_points: number; capacity: number | null }): Promise<void> {
  const cap = ev.capacity ?? 1_000_000;
  const wait = await db.prepare(`SELECT r.id, r.user_id FROM event_registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? AND r.status = 'waitlisted' AND ${liveUser('u')} ORDER BY r.registered_at LIMIT 20`).bind(ev.id).all<{ id: string; user_id: string }>();
  for (const next of wait.results) {
    const price = Math.max(0, ev.price_points);
    if (price > 0) {
      const debit = await db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').bind(price, next.user_id, price).run();
      if (debit.meta.changes !== 1) {
        await notify(db, next.user_id, 'party', `A seat opened up: ${ev.title}`, `You need ${price} points to take it, so you are still on the waitlist.`, `/party/${ev.id}`);
        continue;
      }
    }
    const moved = await db
      .prepare(`UPDATE event_registrations SET status = 'registered', paid_points = ?1 WHERE id = ?2 AND status = 'waitlisted'
        AND ${seatsTaken('?3')} < ?4`)
      .bind(price, next.id, ev.id, cap)
      .run();
    if (moved.meta.changes !== 1) {
      if (price > 0) await db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(price, next.user_id).run();
      return;
    }
    if (price > 0) await db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(next.user_id, -price, 'ticket', next.id, nowIso()).run();
    await notify(db, next.user_id, 'party', `A seat opened up: ${ev.title}`, price > 0 ? `You are off the waitlist. ${price} points were taken for the ticket.` : 'You are off the waitlist.', `/party/${ev.id}`);
    return;
  }
}

party.post('/events/:id/cancel-rsvp', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE e.id = ?`).bind(c.req.param('id')).first<EventRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const mine = await db.prepare('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?').bind(row.id, user.id).first<RegRow>();
  if (!mine || mine.status === 'cancelled') return c.json({ error: 'you are not registered' }, 400);
  // The status moves first, guarded on the status that was read, so two taps at once cancel, refund and free a seat once.
  const flip = await db.prepare("UPDATE event_registrations SET status = 'cancelled' WHERE id = ? AND status = ?").bind(mine.id, mine.status).run();
  if (flip.meta.changes !== 1) return c.json({ error: 'you are not registered' }, 400);
  const wasSeated = mine.status === 'registered';
  // What was paid comes back, never the list price. A code's use is not given back by a cancel.
  const back = wasSeated ? await paidFor(db, mine) : 0;
  if (back > 0) {
    await db.batch([
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(back, user.id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, back, 'refund', mine.id, nowIso()),
    ]);
  }
  if (wasSeated && row.status === 'published') await promoteNext(db, row);
  return c.json({ ok: true, refunded: back });
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

// A host makes the same event again on a new date: everything carries over but the guests, and the xp comes with a
// new random code. A week later when no date is given.
party.post('/events/:id/duplicate', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; title: string; description: string; event_type: string; host_user_id: string; venue: string; online_url: string | null; timezone: string; starts_at: string; ends_at: string; capacity: number | null; price_points: number; visibility: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.host_user_id !== user.id && !can(user, 'events')) return c.json({ error: 'the host copies an event' }, 403);
  const body = await c.req.json<{ startsAt?: unknown }>().catch(() => ({}) as { startsAt?: unknown });
  const asked = typeof body.startsAt === 'string' ? new Date(body.startsAt) : new Date(Date.parse(row.starts_at) + 7 * 86_400_000);
  if (Number.isNaN(asked.getTime())) return c.json({ error: 'a start time' }, 400);
  if (asked.getTime() <= Date.now()) return c.json({ error: 'Pick a start time that has not passed yet.' }, 400);
  const length = Date.parse(row.ends_at) - Date.parse(row.starts_at);
  const id = newId();
  await db
    .prepare("INSERT INTO events (id, title, description, event_type, host_user_id, venue, online_url, timezone, starts_at, ends_at, capacity, price_points, visibility, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)")
    .bind(id, row.title, row.description, row.event_type, row.host_user_id, row.venue, row.online_url, row.timezone, asked.toISOString(), new Date(asked.getTime() + length).toISOString(), row.capacity, row.price_points, row.visibility, nowIso())
    .run();
  await audit(db, user.id, 'event.create', 'event', id, row.id, row.title);
  const code = await codeOf(db, 'party', row.id);
  if (code) await setEventCode(db, 'party', id, asked.toISOString(), user.id, { xp: code.xp, fresh: true }, true);
  const fresh = await db.prepare(`${SELECT} WHERE e.id = ?`).bind(id).first<EventRow>();
  return c.json({ event: fresh ? toEvent(fresh, null) : null }, 201);
});

// The host sets the guests' xp before it starts, and the code: their own word, or a fresh random one.
party.put('/events/:id/attendee-code', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT id, host_user_id, starts_at, ends_at, status FROM events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; host_user_id: string; starts_at: string; ends_at: string; status: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.host_user_id !== user.id && !can(user, 'events')) return c.json({ error: 'the host sets the code' }, 403);
  if (row.status === 'cancelled') return c.json({ error: 'This event was cancelled.' }, 400);
  const body = await c.req.json<{ xp?: unknown; code?: unknown; fresh?: unknown }>().catch(() => ({}) as Record<string, never>);
  const prev = await codeOf(db, 'party', row.id);
  const set = await setEventCode(db, 'party', row.id, row.starts_at, user.id, body);
  if ('error' in set) return c.json({ error: set.error }, set.status);
  await audit(db, user.id, 'attendee_code.set', 'event', row.id, prev ? { xp: prev.xp } : '', { xp: set.row.xp, newCode: set.row.code !== prev?.code });
  const n = await db.prepare(`SELECT ${seatsTaken('?1')} AS n`).bind(row.id).first<{ n: number }>();
  return c.json({ hostCode: await hostView(db, set.row, row.starts_at, row.ends_at, n?.n ?? 0) });
});

// A guest types the code at the event: the xp the host set, once. It also checks them in. Whoever can see the code
// (the host, events staff, admins) cannot claim it, even when they registered.
party.post('/events/:id/claim', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT id, host_user_id, starts_at, ends_at, status FROM events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; host_user_id: string; starts_at: string; ends_at: string; status: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const reg = await db.prepare("SELECT id FROM event_registrations WHERE event_id = ? AND user_id = ? AND status IN ('registered','attended')").bind(row.id, user.id).first<{ id: string }>();
  const body = await c.req.json<{ code?: unknown }>().catch(() => ({}) as { code?: unknown });
  const got = await claimEventCode(db, { app: 'party', thingId: row.id, userId: user.id, host: row.host_user_id === user.id || can(user, 'events'), guest: Boolean(reg), cancelled: row.status === 'cancelled', startsAt: row.starts_at, endsAt: row.ends_at, code: body.code });
  if ('error' in got) return c.json({ error: got.error }, got.status);
  if (reg) await db.prepare("UPDATE event_registrations SET status = 'attended', checked_in_at = COALESCE(checked_in_at, ?) WHERE id = ?").bind(nowIso(), reg.id).run();
  return c.json(got, 201);
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
  // The event's status moves first and only when it changes, so two cancel taps at once notify and refund once.
  const moved = await db.prepare('UPDATE events SET status = ? WHERE id = ? AND status != ?').bind(status, row.id, status).run();
  if (moved.meta.changes !== 1) return c.json({ ok: true });
  await audit(db, user.id, 'event.status', 'event', row.id, row.status, status);
  if (status === 'cancelled') {
    const regs = await db.prepare("SELECT id, user_id, status, paid_points FROM event_registrations WHERE event_id = ? AND status IN ('registered','attended','waitlisted')").bind(row.id).all<{ id: string; user_id: string; status: string; paid_points: number | null }>();
    const refunded: string[] = [];
    const told: string[] = [];
    for (const r of regs.results) {
      // Each guest's row moves first, guarded, and only a row that moved is refunded what it paid.
      const flip = await db.prepare("UPDATE event_registrations SET status = 'cancelled' WHERE id = ? AND status = ?").bind(r.id, r.status).run();
      if (flip.meta.changes !== 1) continue;
      const back = r.status === 'waitlisted' ? 0 : await paidFor(db, r);
      if (back > 0) {
        await db.batch([
          db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(back, r.user_id),
          db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(r.user_id, back, 'refund', r.id, nowIso()),
        ]);
        refunded.push(r.user_id);
      } else told.push(r.user_id);
    }
    if (refunded.length) await notifyMany(db, refunded, 'party', `Cancelled: ${row.title}`, 'The points you paid for the ticket are back in your balance.', '/party');
    if (told.length) await notifyMany(db, told, 'party', `Cancelled: ${row.title}`, 'The host cancelled this event.', '/party');
  }
  return c.json({ ok: true });
});
