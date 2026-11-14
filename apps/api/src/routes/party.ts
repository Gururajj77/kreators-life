import { quoteCode, redeem, release, type Quoted } from '../discounts';
import { Hono } from 'hono';
import { ATTENDEE_APPS, DEFAULT_ZONE, EVENT_TYPE_META, EVENT_TYPES, type EventRegistration, type PartyEvent } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, inBatches, liveUser, nameOf, newId, noteStmt, notify, nowIso, num, oneOf, str, isClubMember, pageOf, paged, TEN_A_PAGE, parseModules, httpUrl } from '../db';
import { openTurn, routeTurn, type Share, type Turn } from '../cronTick';
import { ROUTE_TRIPS, tripsOf } from '../d1Batch';
import { claimEventCode, codeOf, guestView, hostView, setEventCode } from '../attendee';

export const party = new Hono<AppEnv>();

interface EventRow { id: string; title: string; description: string; event_type: PartyEvent['eventType']; host_user_id: string; host_name: string; venue: string; online_url: string | null; timezone: string; starts_at: string; ends_at: string; capacity: number | null; price_points: number; visibility: PartyEvent['visibility']; status: PartyEvent['status']; created_at: string; registered: number; waitlisted: number; attendee_xp: number | null }
/** Seats taken on an event, counting only live accounts: a deleted member holds no seat and is in no count. `ev` is the SQL for the event id. */
export const seatsTaken = (ev: string) => `(SELECT COUNT(*) FROM event_registrations sr JOIN users su ON su.id = sr.user_id WHERE sr.event_id = ${ev} AND sr.status IN ('registered','attended') AND ${liveUser('su')})`;
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
  // What you host, newest first, a page at a time (prefix `h`, 10, 25 or 50, ten by default).
  const hAsk = pageOf(c, 'h', TEN_A_PAGE);
  const hostingRows = await db.prepare(`${SELECT} WHERE e.host_user_id = ? ORDER BY e.starts_at DESC, e.id LIMIT ? OFFSET ?`).bind(user.id, hAsk.limit, hAsk.offset).all<EventRow>();
  const pg = paged(rows.results, ask);
  const hosting = paged(hostingRows.results, hAsk);
  return c.json({ page: pg.page, events: pg.items.map((e) => toEvent(e, mine.get(e.id) ?? null)), hosting: hosting.items.map((e) => toEvent(e, null)), hostingPage: hosting.page, canHostAll: can(user, 'events'), club });
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

/**
 * Someone joining an event from its public page (/events/:id, 2026-11-07). An account that has not finished the setup chat is marked as having
 * come for this event (`users.attendee_event`, migration 0121), so the app lets it into what an attendee needs first, and Party, Community and
 * Bond are switched on through the ordinary per-person switch (`users.modules`); setup comes later. An account that finished setup only gets
 * Party switched on, where the event lives. Only a public, published event still to come; a private or Club-only one answers like a missing one.
 * It takes no seat and moves no points: the RSVP is the ordinary route after it, and a paid ticket is bought there, on the person's own yes.
 */
party.post('/events/:id/arrive', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare("SELECT id, ends_at FROM events WHERE id = ? AND visibility = 'public' AND status = 'published'").bind(c.req.param('id')).first<{ id: string; ends_at: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (new Date(row.ends_at).getTime() < Date.now()) return c.json({ error: 'this event is over' }, 400);
  const attendee = !user.onboarded_at;
  const mine = parseModules(user.modules);
  for (const k of attendee ? ATTENDEE_APPS : (['party'] as const)) mine[k] = true;
  await db
    .prepare('UPDATE users SET modules = ?, attendee_event = CASE WHEN onboarded_at IS NULL THEN ? ELSE attendee_event END WHERE id = ?')
    .bind(JSON.stringify(mine), row.id, user.id)
    .run();
  return c.json({ ok: true, attendee, modules: mine });
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
  const price = Math.max(0, ev.price_points);
  const wait = await db.prepare(`SELECT r.id, r.user_id, u.points FROM event_registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? AND r.status = 'waitlisted' AND ${liveUser('u')} ORDER BY r.registered_at LIMIT 20`).bind(ev.id).all<{ id: string; user_id: string; points: number }>();
  // Who cannot pay is known from that read, so a guarded update is tried only on someone who can, and those told go together: a long waitlist of people short of points is one trip, not two each.
  const short: string[] = [];
  const tellShort = () => inBatches(db, short.map((userId) => noteStmt(db, { userId, kind: 'party', title: `A seat opened up: ${ev.title}`, body: `You need ${price} points to take it, so you are still on the waitlist.`, link: `/party/${ev.id}` })));
  for (const next of wait.results) {
    if (price > 0) {
      const debit = next.points >= price ? await db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').bind(price, next.user_id, price).run() : null;
      if (debit?.meta.changes !== 1) {
        short.push(next.user_id);
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
      await tellShort();
      return;
    }
    if (price > 0) await db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(next.user_id, -price, 'ticket', next.id, nowIso()).run();
    await notify(db, next.user_id, 'party', `A seat opened up: ${ev.title}`, price > 0 ? `You are off the waitlist. ${price} points were taken for the ticket.` : 'You are off the waitlist.', `/party/${ev.id}`);
    await tellShort();
    return;
  }
  await tellShort();
}

party.post('/events/:id/cancel-rsvp', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE e.id = ?`).bind(c.req.param('id')).first<EventRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const mine = await db.prepare('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?').bind(row.id, user.id).first<RegRow>();
  if (!mine || mine.status === 'cancelled') return c.json({ error: 'you are not registered' }, 400);
  // Once the event has ended the seat stays as it was: a ticket is never refunded after the event (2026-11-14, a gap All tables would have shown).
  if (Date.parse(row.ends_at) <= Date.now()) return c.json({ error: 'This event is over, so your seat stays as it was.' }, 400);
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

/**
 * A guest's score and words after an event. Each part not sent keeps what was saved (2026-11-14, All tables' Edit, which changes one at a time):
 * the score, the words, and the list-to-meet switch, which moves only when `networking` is sent as yes or no. The screen sends all three, as
 * before. The row keeps its id when it changes.
 */
party.post('/events/:id/feedback', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const reg = await db.prepare("SELECT status FROM event_registrations WHERE event_id = ? AND user_id = ? AND status IN ('registered','attended')").bind(c.req.param('id'), user.id).first();
  if (!reg) return c.json({ error: 'only people who registered can leave feedback' }, 403);
  const body = await c.req.json<{ rating?: number; comment?: string; networking?: boolean }>().catch(() => ({}) as Record<string, never>);
  const had = await db.prepare('SELECT rating, comment FROM event_feedback WHERE event_id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<{ rating: number; comment: string }>();
  const rating = body.rating === undefined && had ? had.rating : num(body.rating, null, 1, 5);
  if (rating === null) return c.json({ error: 'a rating from one to five' }, 400);
  const comment = body.comment === undefined && had ? had.comment : str(body.comment, 1000);
  await db.batch([
    db
      .prepare('INSERT INTO event_feedback (id, event_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (event_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = excluded.created_at')
      .bind(newId(), c.req.param('id'), user.id, rating, comment, nowIso()),
    ...(typeof body.networking === 'boolean' ? [db.prepare('UPDATE event_registrations SET networking_opt_in = ? WHERE event_id = ? AND user_id = ?').bind(body.networking ? 1 : 0, c.req.param('id'), user.id)] : []),
  ]);
  return c.json({ ok: true }, 201);
});

// Take your feedback back (2026-11-14, All tables). Leave it again on the event's page while you hold a seat.
party.delete('/events/:id/feedback', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM event_feedback WHERE event_id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

/**
 * The host changes an event: its status (the screen's Mark done and Cancel), and since 2026-11-14 (All tables' Edit) its title, words and place.
 * Each part changes only when it is sent. Events staff keep the status moves they always had; the words are the host's own, so staff never
 * rewrite a host's event (the review of 2026-11-14). A cancelled event stays as it is: never live or done again, its seats already refunded. A
 * new place is told to everyone holding a seat or waiting for one, in one note per guest and event rewritten in place (`venue-<event>-<guest>`),
 * so changing the place again and again never piles up notes.
 */
party.patch('/events/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; host_user_id: string; title: string; description: string; venue: string; status: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.host_user_id !== user.id && !can(user, 'events')) return c.json({ error: 'the host changes an event' }, 403);
  const body = await c.req.json<{ status?: unknown; title?: unknown; description?: unknown; venue?: unknown }>().catch(() => ({}) as Record<string, never>);
  const words = body.title !== undefined || body.description !== undefined || body.venue !== undefined;
  if (body.status === undefined && !words) return c.json({ error: 'Say what to change.' }, 400);
  if (words && row.host_user_id !== user.id) return c.json({ error: 'Only the host changes an event’s title, words and place.' }, 403);
  if (row.status === 'cancelled' && (words || body.status !== 'cancelled')) return c.json({ error: 'A cancelled event stays as it is.' }, 400);
  if (words) {
    const title = body.title === undefined ? row.title : str(body.title, 120);
    if (body.title !== undefined && !title) return c.json({ error: 'Give it a title.' }, 400);
    const description = body.description === undefined ? row.description : str(body.description, 3000);
    const venue = body.venue === undefined ? row.venue : str(body.venue, 200);
    // Guarded on the event not being cancelled meanwhile.
    const res = await db.prepare("UPDATE events SET title = ?, description = ?, venue = ? WHERE id = ? AND status != 'cancelled'").bind(title, description, venue, row.id).run();
    if (!res.meta.changes) return c.json({ error: 'A cancelled event stays as it is.' }, 400);
    await audit(db, user.id, 'event.edit', 'event', row.id, { title: row.title, venue: row.venue }, { title, venue });
    if (venue !== row.venue) {
      const guests = await db.prepare("SELECT user_id FROM event_registrations WHERE event_id = ? AND status IN ('registered','attended','waitlisted') AND user_id != ? LIMIT 500").bind(row.id, row.host_user_id).all<{ user_id: string }>();
      const at = nowIso();
      await inBatches(
        db,
        guests.results.map((g) => noteStmt(db, { id: `venue-${row.id}-${g.user_id}`, userId: g.user_id, kind: 'party', title: `New place for ${title}`, body: venue || 'The host took the place off. Open the event to see more.', link: `/party/${row.id}`, at }, 'renew')),
      );
    }
  }
  if (body.status !== undefined) {
    const status = oneOf(body.status, ['published', 'cancelled', 'done'] as const, 'published');
    // The event's status moves first and only when it changes. A cancel always goes on to the seats, moved or not: each guest moves once, so two taps at
    // once refund once, and a second tap after a stop finishes what the first one left (the cron does too, `finishCancelledEvents`). A cancelled one
    // never moves back (the guard in the statement holds it even when a cancel lands between the read and here).
    const moved = await db.prepare("UPDATE events SET status = ? WHERE id = ? AND status != ? AND (status != 'cancelled' OR ? = 'cancelled')").bind(status, row.id, status, status).run();
    if (moved.meta.changes === 1) await audit(db, user.id, 'event.status', 'event', row.id, row.status, status);
    // A big event's seats may take more trips than one tap has: what is left is finished by the next ticks (`finishCancelledEvents`), each guest once.
    if (status === 'cancelled') await cancelEventSeats(db, row, await routeTurn(db, () => tripsOf(db), ROUTE_TRIPS)());
  }
  return c.json({ ok: true });
});

/** Guests to one transaction when an event is cancelled: four statements each, so a batch stays under fifty. */
const SEATS_A_BATCH = 12;

/**
 * An event was cancelled (the status has already moved): every guest's seat goes, what they paid comes back, and they are told, all three together.
 * The host's own cancel, a host closing their account (`deleteAccount`) and the cron's sweep (`finishCancelledEvents`) all come here, and it can run
 * any number of times: each guest's batch is one transaction, the refund is guarded on the seat still being open, and the seat moves last, so a stop
 * part way leaves the rest open for the next run and never strands anyone. A guest who registers again gets a new row id, so their note is a new one.
 */
export async function cancelEventSeats(db: D1Database, ev: { id: string; title: string }, share?: Share): Promise<boolean> {
  // What came back is what was paid, never the list price: a seat that cost nothing, or a waitlist row, refunds nothing (`paidFor`, in one read).
  const regs = await db
    .prepare(
      `SELECT r.id, r.user_id, r.status,
        CASE WHEN r.status = 'waitlisted' THEN 0 ELSE COALESCE(r.paid_points, (SELECT -SUM(l.amount) FROM points_ledger l WHERE l.user_id = r.user_id AND l.reason = 'ticket' AND l.ref = r.id), 0) END AS paid
       FROM event_registrations r WHERE r.event_id = ? AND r.status IN ('registered','attended','waitlisted')`,
    )
    .bind(ev.id)
    .all<{ id: string; user_id: string; status: string; paid: number }>();
  const open = 'EXISTS (SELECT 1 FROM event_registrations WHERE id = ? AND status = ?)';
  const now = nowIso();
  for (let i = 0; i < regs.results.length; i += SEATS_A_BATCH) {
    // A cron tick stops here when its share is spent, and the next tick goes on with the seats still open.
    if (share && share.left() <= 0) {
      share.more();
      return false;
    }
    await db.batch(
      regs.results.slice(i, i + SEATS_A_BATCH).flatMap((r) => {
        const back = Math.max(0, r.paid);
        return [
          ...(back > 0
            ? [
                db.prepare(`UPDATE users SET points = points + ? WHERE id = ? AND ${open}`).bind(back, r.user_id, r.id, r.status),
                db.prepare(`INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) SELECT ?, ?, 'refund', ?, ? WHERE ${open}`).bind(r.user_id, back, r.id, now, r.id, r.status),
              ]
            : []),
          noteStmt(db, { id: `cancelled-${r.id}`, userId: r.user_id, kind: 'party', title: `Cancelled: ${ev.title}`, body: back > 0 ? 'The points you paid for the ticket are back in your balance.' : 'The host cancelled this event.', link: '/party', at: now }, 'once'),
          db.prepare("UPDATE event_registrations SET status = 'cancelled' WHERE id = ? AND status = ?").bind(r.id, r.status),
        ];
      }),
    );
  }
  return true;
}

/** Events still in the last month that were cancelled with seats left open: a run that stopped part way. The cron finishes them, a few each tick. */
export async function finishCancelledEvents(db: D1Database, turn: Turn = openTurn(db)): Promise<number> {
  const stuck = await db
    .prepare("SELECT e.id, e.title FROM events e WHERE e.starts_at >= ? AND e.status = 'cancelled' AND EXISTS (SELECT 1 FROM event_registrations r WHERE r.event_id = e.id AND r.status IN ('registered','attended','waitlisted')) LIMIT 5")
    .bind(new Date(Date.now() - 30 * 86_400_000).toISOString())
    .all<{ id: string; title: string }>();
  if (!stuck.results.length) return 0;
  const share = await turn();
  for (const ev of stuck.results) {
    if (share.left() < 2) {
      share.more();
      break;
    }
    await cancelEventSeats(db, ev, share);
  }
  return stuck.results.length;
}
