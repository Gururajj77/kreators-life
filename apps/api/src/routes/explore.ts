import { Hono } from 'hono';
import { DEFAULT_ZONE, EVENT_TYPE_META, LISTING_TYPES, LOCALE, fact, money as moneyOf, type Listing, type ListingType, type PublicStats } from '@kreators/shared';
import type { AppEnv } from '../env';
import { liveUser, nameOf, pageOf, paged } from '../db';
import { mediaForListings } from './media';
import { cache } from '../cachecontrol';

// A program's delivery mode as the app's School screen names it ("Online", not the stored key).
const DELIVERY_NAME: Record<string, string> = Object.assign(Object.create(null), { online: 'Online', in_person: 'In person', hybrid: 'Hybrid' });

/** The public side of every module: what is on offer, with no account needed. */
export const explore = new Hono<AppEnv>();

// Nothing here depends on who asks (no viewer is read), so every answer is the same for everyone: kept a minute in the
// browser, five at a shared cache, and a minute in this data centre's Workers cache for readers without a session.
explore.use('*', cache('public', { edgeSeconds: 60 }));

interface Opts {
  q?: string;
  type?: ListingType;
  id?: string;
  includeHidden?: boolean;
  featuredOnly?: boolean;
  limit?: number;
}

// A public card is read by anyone, so a moment is written in India's time, the Indian way.
const when = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', timeZone: DEFAULT_ZONE });
const whenAt = (iso: string) => new Date(iso).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: DEFAULT_ZONE });
// A gig's pay is kept in whole units (like a pitch's budget), so it is shown through money() from its cents: "₹2,000 to ₹5,000", not "INR 2000 to 5000".
const units = (n: number, cur: string) => moneyOf(Math.round(n) * 100, cur);
const money = (min: number | null, max: number | null, cur: string) =>
  min === null && max === null ? null : min !== null && max !== null ? `${units(min, cur)} to ${units(max, cur)}` : units((min ?? max) as number, cur);

/**
 * Why each kind reads up to 200 rows and the page is cut after the merge, not in SQL (decided 2026-11-03, P6):
 * the public list is seven kinds merged into one order (featured first, then newest), and the search `q` matches the
 * words the cards are built from (facts such as "closes 4 Nov" or "tables of 6"), which exist only after a row is read.
 * A LIMIT/OFFSET per kind would page each kind on its own and the merged pages would skip and repeat cards. Only live
 * things are read (open rewards, upcoming events and circles, published programs), so 200 of one kind is far past what
 * is ever open at once; the person still sees the list ten to a hundred at a time through `pageOf` on the route.
 */
export async function listingsFor(db: D1Database, o: Opts): Promise<Listing[]> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const q = (o.q ?? '').trim().toLowerCase();
  const types = o.type ? [o.type] : LISTING_TYPES;
  const idClause = (col: string) => (o.id ? ` AND ${col} = '${o.id.replace(/'/g, '')}'` : '');

  // Each kind is its own query and none waits on another: they run together, then join in this order.
  const kind_reward = types.includes('reward')
    ? (async () => {
        const out: Listing[] = [];
        const rows = await db
          .prepare(`SELECT b.id, b.title, b.brief, b.brand_name, b.deliverable, b.rate_per_thousand, b.max_payout_points, b.min_views, b.platform, b.ends_at, b.status, b.featured, b.created_at, o.name AS organization_name, (SELECT COUNT(*) FROM bounty_submissions s WHERE s.bounty_id = b.id) AS submissions FROM bounties b LEFT JOIN organizations o ON o.id = b.organization_id WHERE 1=1 ${o.includeHidden ? '' : `AND b.status = 'open' AND b.ends_at >= '${now}'`}${idClause('b.id')} ORDER BY b.featured DESC, b.ends_at LIMIT 200`)
          .all<{ id: string; title: string; brief: string; brand_name: string; organization_name: string | null; deliverable: string; rate_per_thousand: number; max_payout_points: number; min_views: number; platform: string; ends_at: string; status: string; featured: number; created_at: string; submissions: number }>();
        for (const r of rows.results) {
          out.push({
            type: 'reward',
            id: r.id,
            title: r.title,
            by: r.brand_name || r.organization_name || 'Kreators',
            blurb: r.brief,
            facts: [...fact('category', r.deliverable), ...fact(r.platform ? 'place' : 'online', r.platform || 'Any platform'), ...fact('price', r.rate_per_thousand > 0 ? `${r.rate_per_thousand} pts per 1k views` : 'Fixed reward'), ...fact('price', r.max_payout_points > 0 ? `up to ${r.max_payout_points} pts` : ''), ...fact('when', `closes ${when(r.ends_at)}`)],
            path: `/win/${r.id}`,
            featured: r.featured === 1,
            live: r.status === 'open' && r.ends_at >= now,
            endsAt: r.ends_at,
            createdAt: r.created_at,
          });
        }
        return out;
      })()
    : Promise.resolve<Listing[]>([]);
  // Each kind is its own query and none waits on another: they run together, then join in this order.
  const kind_opportunity = types.includes('opportunity')
    ? (async () => {
        const out: Listing[] = [];
        const rows = await db
          .prepare(`SELECT o.id, o.title, o.description, o.opportunity_type, o.location_mode, o.location_text, o.compensation_min, o.compensation_max, o.currency, o.deadline, o.status, o.featured, o.created_at, org.name AS organization_name FROM opportunities o LEFT JOIN organizations org ON org.id = o.organization_id WHERE 1=1 ${o.includeHidden ? '' : `AND o.status = 'published' AND o.club_only = 0 AND (o.deadline IS NULL OR o.deadline >= '${today}')`}${idClause('o.id')} ORDER BY o.featured DESC, o.published_at DESC LIMIT 200`)
          .all<{ id: string; title: string; description: string; organization_name: string | null; opportunity_type: string; location_mode: string; location_text: string; compensation_min: number | null; compensation_max: number | null; currency: string; deadline: string | null; status: string; featured: number; created_at: string }>();
        for (const r of rows.results) {
          const pay = money(r.compensation_min, r.compensation_max, r.currency);
          out.push({
            type: 'opportunity',
            id: r.id,
            title: r.title,
            by: r.organization_name ?? 'Kreators',
            blurb: r.description,
            facts: [...fact('category', r.opportunity_type.replace('_', ' ')), ...(r.location_mode === 'remote' ? fact('online', 'Remote') : fact('place', r.location_text || r.location_mode.replace('_', ' '))), ...fact('price', pay), ...fact('when', r.deadline ? `apply by ${when(r.deadline)}` : '')],
            path: `/work/${r.id}`,
            featured: r.featured === 1,
            live: r.status === 'published' && (!r.deadline || r.deadline >= today),
            endsAt: r.deadline,
            createdAt: r.created_at,
          });
        }
        return out;
      })()
    : Promise.resolve<Listing[]>([]);
  // Each kind is its own query and none waits on another: they run together, then join in this order.
  const kind_event = types.includes('event')
    ? (async () => {
        const out: Listing[] = [];
        const rows = await db
          .prepare(`SELECT e.id, e.title, e.description, e.event_type, e.venue, e.online_url, e.starts_at, e.ends_at, e.price_points, e.status, e.featured, e.created_at, u.display_name AS host_name FROM events e JOIN users u ON u.id = e.host_user_id WHERE e.visibility = 'public' ${o.includeHidden ? '' : `AND e.status = 'published' AND e.ends_at >= '${now}'`}${idClause('e.id')} ORDER BY e.featured DESC, e.starts_at LIMIT 200`)
          .all<{ id: string; title: string; description: string; host_name: string; event_type: keyof typeof EVENT_TYPE_META; venue: string; online_url: string | null; starts_at: string; ends_at: string; price_points: number; status: string; featured: number; created_at: string }>();
        for (const r of rows.results) {
          out.push({
            type: 'event',
            id: r.id,
            title: r.title,
            by: nameOf({ display_name: r.host_name }),
            blurb: r.description,
            facts: [...fact('category', EVENT_TYPE_META[r.event_type]?.name ?? r.event_type), ...fact('when', whenAt(r.starts_at)), ...(r.online_url ? fact('online', 'Online') : fact('place', r.venue)), ...(r.price_points > 0 ? fact('price', `${r.price_points} pts`) : fact('free', 'Free'))],
            path: `/party/${r.id}`,
            featured: r.featured === 1,
            live: r.status === 'published' && r.ends_at >= now,
            endsAt: r.ends_at,
            createdAt: r.created_at,
          });
        }
        return out;
      })()
    : Promise.resolve<Listing[]>([]);
  // Each kind is its own query and none waits on another: they run together, then join in this order.
  // Only public programs: `published` is 1 exactly when a program is public (migration 0086), so a draft, a private (invite only) or
  // an archived program never reaches Explore.
  const kind_program = types.includes('program')
    ? (async () => {
        const out: Listing[] = [];
        const rows = await db
          .prepare(`SELECT p.id, p.name, p.description, p.price_points, p.price_cents, p.currency, p.delivery_mode, p.published, p.featured, p.created_at, (SELECT COUNT(*) FROM cohorts k WHERE k.program_id = p.id AND k.status IN ('upcoming','running')) AS cohorts FROM programs p WHERE 1=1 ${o.includeHidden ? '' : 'AND p.published = 1'}${idClause('p.id')} ORDER BY p.featured DESC, p.created_at DESC LIMIT 200`)
          .all<{ id: string; name: string; description: string; price_points: number; price_cents: number; currency: string; delivery_mode: string; published: number; featured: number; created_at: string; cohorts: number }>();
        for (const r of rows.results) {
          out.push({
            type: 'program',
            id: r.id,
            title: r.name,
            by: 'Kreators School',
            blurb: r.description,
            facts: [...fact(r.delivery_mode === 'online' ? 'online' : 'place', DELIVERY_NAME[r.delivery_mode] ?? r.delivery_mode.replace('_', ' ')), ...(r.price_points > 0 ? fact('price', `${r.price_points} pts`) : r.price_cents > 0 ? fact('price', moneyOf(r.price_cents, r.currency)) : fact('free', 'Free')), ...fact('availability', r.cohorts > 0 ? `${r.cohorts} cohort${r.cohorts === 1 ? '' : 's'} open` : 'cohort dates soon')],
            path: `/school`,
            featured: r.featured === 1,
            live: r.published === 1,
            endsAt: null,
            createdAt: r.created_at,
          });
        }
        return out;
      })()
    : Promise.resolve<Listing[]>([]);
  // Each kind is its own query and none waits on another: they run together, then join in this order.
  const kind_tool = types.includes('tool')
    ? (async () => {
        const out: Listing[] = [];
        const rows = await db.prepare(`SELECT id, name, category, url, description, affiliate, verified, created_at FROM tools WHERE 1=1 ${o.includeHidden ? '' : 'AND verified = 1'}${idClause('id')} ORDER BY name LIMIT 200`).all<{ id: string; name: string; category: string; url: string; description: string; affiliate: number; verified: number; created_at: string }>();
        for (const r of rows.results) {
          out.push({ type: 'tool', id: r.id, title: r.name, by: r.category, blurb: r.description, facts: [...fact('category', r.category), ...(r.affiliate === 1 ? fact('status', 'partner link') : fact('verified', 'Verified'))], path: '/tools', featured: false, live: r.verified === 1, endsAt: null, createdAt: r.created_at });
        }
        return out;
      })()
    : Promise.resolve<Listing[]>([]);
  // Each kind is its own query and none waits on another: they run together, then join in this order.
  const kind_campaign = types.includes('campaign')
    ? (async () => {
        const out: Listing[] = [];
        const rows = await db
          .prepare(`SELECT c.id, c.name, c.brief, c.status, c.due_date, c.public, c.created_at, o.name AS organization_name FROM campaigns c JOIN organizations o ON o.id = c.organization_id WHERE 1=1 ${o.includeHidden ? '' : "AND c.public = 1 AND c.status IN ('brief','shortlist','approved')"}${idClause('c.id')} ORDER BY c.updated_at DESC LIMIT 100`)
          .all<{ id: string; name: string; brief: string; organization_name: string; status: string; due_date: string | null; public: number; created_at: string }>();
        for (const r of rows.results) {
          out.push({ type: 'campaign', id: r.id, title: r.name, by: r.organization_name, blurb: r.brief, facts: [...fact('status', r.status), ...fact('when', r.due_date ? `due ${when(r.due_date)}` : '')], path: `/army/${r.id}`, featured: false, live: r.public === 1 && ['brief', 'shortlist', 'approved'].includes(r.status), endsAt: r.due_date, createdAt: r.created_at });
        }
        return out;
      })()
    : Promise.resolve<Listing[]>([]);
  // Each kind is its own query and none waits on another: they run together, then join in this order.
  const kind_circle = types.includes('circle')
    ? (async () => {
        const out: Listing[] = [];
        const rows = await db
          .prepare(`SELECT e.id, e.title, e.city, e.area, e.starts_at, e.venue_hint, e.group_size, e.status, e.repeat, e.created_at, (SELECT COUNT(*) FROM circle_signups s WHERE s.event_id = e.id) AS signups FROM circle_events e WHERE 1=1 ${o.includeHidden ? '' : `AND e.status = 'open' AND e.starts_at >= '${now}'`}${idClause('e.id')} ORDER BY e.starts_at LIMIT 200`)
          .all<{ id: string; title: string; city: string; area: string; starts_at: string; venue_hint: string; group_size: number; status: string; repeat: string; created_at: string; signups: number }>();
        for (const r of rows.results) {
          out.push({
            type: 'circle',
            id: r.id,
            title: r.title,
            by: [r.area, r.city].filter(Boolean).join(', '),
            blurb: `Anonymous group of ${r.group_size}, matched by interests that fit. Red if single, white if committed. Names stay hidden; the chat opens a day before.${r.venue_hint ? ` ${r.venue_hint}` : ''}`,
            facts: [...fact('when', whenAt(r.starts_at)), ...fact('when', r.repeat === 'weekly' ? 'every week' : ''), ...fact('availability', `${r.signups} signed up`), ...fact('category', `tables of ${r.group_size}`)],
            path: '/circles',
            featured: false,
            live: r.status === 'open' && r.starts_at >= now,
            endsAt: r.starts_at,
            createdAt: r.created_at,
          });
        }
        return out;
      })()
    : Promise.resolve<Listing[]>([]);
  const out = (await Promise.all([kind_reward, kind_opportunity, kind_event, kind_program, kind_tool, kind_campaign, kind_circle])).flat();
  let list = out;
  if (q) list = list.filter((l) => [l.title, l.by, l.blurb, ...l.facts.map((f) => f.text)].join(' ').toLowerCase().includes(q));
  if (o.featuredOnly) list = list.filter((l) => l.featured);
  list.sort((a, b) => Number(b.featured) - Number(a.featured) || (b.createdAt < a.createdAt ? -1 : 1));
  const shown = list.slice(0, o.limit ?? 100);
  // Pictures, GIFs and videos the owners added: the card shows the first picture as its cover.
  const media = await mediaForListings(db, shown.map((l) => ({ type: l.type, id: l.id })));
  for (const l of shown) {
    const m = media.get(`${l.type}:${l.id}`);
    if (m) l.media = m;
  }
  return shown;
}

explore.get('/', async (c) => {
  const type = c.req.query('type');
  const ask = pageOf(c);
  const all = await listingsFor(c.env.DB, {
    q: c.req.query('q') ?? '',
    type: (LISTING_TYPES as readonly string[]).includes(type ?? '') ? (type as ListingType) : undefined,
    featuredOnly: c.req.query('featured') === '1',
    limit: ask.offset + ask.limit,
  });
  const pg = paged(all.slice(ask.offset), ask);
  return c.json({ page: pg.page, listings: pg.items });
});

explore.get('/stats', async (c) => {
  const now = new Date().toISOString();
  const row = await c.env.DB
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users u WHERE u.onboarded_at IS NOT NULL AND ${liveUser()}) AS members,
        (SELECT COUNT(*) FROM bounties WHERE status = 'open' AND ends_at >= ?1) AS rewards_open,
        (SELECT COUNT(*) FROM opportunities WHERE status = 'published') AS opportunities_open,
        (SELECT COUNT(*) FROM events WHERE status = 'published' AND visibility = 'public' AND ends_at >= ?1) AS events_upcoming,
        (SELECT COUNT(*) FROM programs WHERE published = 1) AS programs,
        (SELECT COALESCE(SUM(amount), 0) FROM points_ledger WHERE amount > 0 AND reason IN ('bounty','admin','task','checkin','spark','affiliate','project_clear')) AS points_paid,
        (SELECT COUNT(*) FROM campaigns WHERE status NOT IN ('cancelled')) AS campaigns`,
    )
    .bind(now)
    .first<{ members: number; rewards_open: number; opportunities_open: number; events_upcoming: number; programs: number; points_paid: number; campaigns: number }>();
  const stats: PublicStats = { members: row?.members ?? 0, rewardsOpen: row?.rewards_open ?? 0, opportunitiesOpen: row?.opportunities_open ?? 0, eventsUpcoming: row?.events_upcoming ?? 0, programs: row?.programs ?? 0, pointsPaid: row?.points_paid ?? 0, campaigns: row?.campaigns ?? 0 };
  return c.json(stats);
});

explore.get('/:type/:id', async (c) => {
  const type = c.req.param('type');
  if (!(LISTING_TYPES as readonly string[]).includes(type)) return c.json({ error: 'not found' }, 404);
  const [listing] = await listingsFor(c.env.DB, { id: c.req.param('id'), type: type as ListingType, limit: 1 });
  if (!listing) return c.json({ error: 'not found' }, 404);
  return c.json({ listing });
});
