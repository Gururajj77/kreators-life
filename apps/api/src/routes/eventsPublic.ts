import { Hono } from 'hono';
import type { PublicEvent } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf, nowIso, pageOf, paged } from '../db';
import { mediaForListings } from './media';
import { seatsTaken } from './party';

/**
 * The public side of Party (2026-11-07, the event attendee's way in): the upcoming public events a visitor can see, a page at a time, and one
 * event's story for its landing page (/events/:id). No account is needed. Only public, published events are ever read: a private or Club-only
 * event answers the same 404 as one that does not exist, so a stranger cannot learn it is there. Who is coming is never sent, only how many
 * seats are left, which the event's own page already shows. The room's online link stays in the app for its guests.
 */
export const eventsPublic = new Hono<AppEnv>();

/** One event row as the public side reads it. Exported for the Worker's own pages (/events, /events/:id, the sitemap in routes/go.ts). */
export interface PublicEventRow {
  id: string;
  title: string;
  description: string;
  event_type: string;
  host_name: string;
  venue: string;
  online_url: string | null;
  timezone: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  price_points: number;
  status: string;
  featured: number;
  taken: number;
}

/** The one public read of an event, shared with routes/go.ts so the landing page's head says what this answer says. */
export const PUBLIC_EVENT_SELECT = `SELECT e.id, e.title, e.description, e.event_type, e.venue, e.online_url, e.timezone, e.starts_at, e.ends_at, e.capacity, e.price_points, e.status, e.featured,
  u.display_name AS host_name, ${seatsTaken('e.id')} AS taken
  FROM events e JOIN users u ON u.id = e.host_user_id`;

/** What a visitor may see of an event: never a guest, the host's id or the room link. */
export const toPublicEvent = (r: PublicEventRow): PublicEvent => ({
  id: r.id,
  title: r.title,
  description: r.description,
  eventType: r.event_type,
  hostName: nameOf({ display_name: r.host_name }),
  venue: r.online_url ? '' : r.venue,
  online: Boolean(r.online_url),
  timezone: r.timezone,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  capacity: r.capacity,
  seatsLeft: r.capacity === null ? null : Math.max(0, r.capacity - r.taken),
  pricePoints: r.price_points,
  status: r.status,
  featured: r.featured === 1,
});

/** A public, published event that has not ended yet; binds one value, the instant now. */
export const UPCOMING_PUBLIC_WHERE = "e.visibility = 'public' AND e.status = 'published' AND e.ends_at >= ?";
/** The list's own order: featured first, then the soonest. */
export const UPCOMING_PUBLIC_ORDER = 'e.featured DESC, e.starts_at, e.id';
/** One event a visitor may open: any public one, a cancelled or finished one too, so an old link says what happened. Binds the id. */
export const PUBLIC_EVENT_BY_ID = "e.id = ? AND e.visibility = 'public'";

// Every public event still to come, featured first, then the soonest. One read and the covers, a page at a time.
eventsPublic.get('/', async (c) => {
  const db = c.env.DB;
  const ask = pageOf(c);
  const rows = await db
    .prepare(`${PUBLIC_EVENT_SELECT} WHERE ${UPCOMING_PUBLIC_WHERE} ORDER BY ${UPCOMING_PUBLIC_ORDER} LIMIT ? OFFSET ?`)
    .bind(nowIso(), ask.limit, ask.offset)
    .all<PublicEventRow>();
  const pg = paged(rows.results, ask);
  const events = pg.items.map(toPublicEvent);
  const media = await mediaForListings(db, events.map((e) => ({ type: 'event' as const, id: e.id })));
  for (const e of events) {
    const m = media.get(`event:${e.id}`);
    if (m) e.media = m;
  }
  return c.json({ page: pg.page, events });
});

// One public event's story for its landing page. A cancelled or finished one still answers, so an old link says what happened; a private or
// Club-only one answers like a missing one.
eventsPublic.get('/:id', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(`${PUBLIC_EVENT_SELECT} WHERE ${PUBLIC_EVENT_BY_ID}`).bind(c.req.param('id')).first<PublicEventRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const event = toPublicEvent(row);
  const media = await mediaForListings(db, [{ type: 'event', id: event.id }]);
  const m = media.get(`event:${event.id}`);
  if (m) event.media = m;
  return c.json({ event });
});
