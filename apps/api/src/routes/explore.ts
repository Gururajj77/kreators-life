import { Hono } from 'hono';
import { EVENT_TYPE_META, LISTING_TYPES, type Listing, type ListingType, type PublicStats } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf } from '../db';

/** The public side of every module: what is on offer, with no account needed. */
export const explore = new Hono<AppEnv>();

interface Opts {
  q?: string;
  type?: ListingType;
  id?: string;
  includeHidden?: boolean;
  featuredOnly?: boolean;
  limit?: number;
}

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const money = (min: number | null, max: number | null, cur: string) => (min === null && max === null ? null : `${cur} ${min ?? ''}${min !== null && max !== null ? ' to ' : ''}${max ?? ''}`.trim());

export async function listingsFor(db: D1Database, o: Opts): Promise<Listing[]> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const q = (o.q ?? '').trim().toLowerCase();
  const types = o.type ? [o.type] : LISTING_TYPES;
  const out: Listing[] = [];
  const idClause = (col: string) => (o.id ? ` AND ${col} = '${o.id.replace(/'/g, '')}'` : '');

  if (types.includes('reward')) {
    const rows = await db
      .prepare(`SELECT b.*, o.name AS organization_name, (SELECT COUNT(*) FROM bounty_submissions s WHERE s.bounty_id = b.id) AS submissions FROM bounties b LEFT JOIN organizations o ON o.id = b.organization_id WHERE 1=1 ${o.includeHidden ? '' : `AND b.status = 'open' AND b.ends_at >= '${now}'`}${idClause('b.id')} ORDER BY b.featured DESC, b.ends_at LIMIT 200`)
      .all<{ id: string; title: string; brief: string; brand_name: string; organization_name: string | null; deliverable: string; rate_per_thousand: number; max_payout_points: number; min_views: number; platform: string; ends_at: string; status: string; featured: number; created_at: string; submissions: number }>();
    for (const r of rows.results) {
      out.push({
        type: 'reward',
        id: r.id,
        title: r.title,
        by: r.brand_name || r.organization_name || 'Kreators',
        blurb: r.brief,
        facts: [r.deliverable, r.platform || 'Any platform', r.rate_per_thousand > 0 ? `${r.rate_per_thousand} pts per 1k views` : 'Fixed reward', r.max_payout_points > 0 ? `up to ${r.max_payout_points} pts` : '', `closes ${when(r.ends_at)}`].filter(Boolean),
        path: `/win/${r.id}`,
        featured: r.featured === 1,
        live: r.status === 'open' && r.ends_at >= now,
        endsAt: r.ends_at,
        createdAt: r.created_at,
      });
    }
  }
  if (types.includes('opportunity')) {
    const rows = await db
      .prepare(`SELECT o.*, org.name AS organization_name FROM opportunities o LEFT JOIN organizations org ON org.id = o.organization_id WHERE 1=1 ${o.includeHidden ? '' : `AND o.status = 'published' AND (o.deadline IS NULL OR o.deadline >= '${today}')`}${idClause('o.id')} ORDER BY o.featured DESC, o.published_at DESC LIMIT 200`)
      .all<{ id: string; title: string; description: string; organization_name: string | null; opportunity_type: string; location_mode: string; location_text: string; compensation_min: number | null; compensation_max: number | null; currency: string; deadline: string | null; status: string; featured: number; created_at: string }>();
    for (const r of rows.results) {
      const pay = money(r.compensation_min, r.compensation_max, r.currency);
      out.push({
        type: 'opportunity',
        id: r.id,
        title: r.title,
        by: r.organization_name ?? 'Kreators',
        blurb: r.description,
        facts: [r.opportunity_type.replace('_', ' '), r.location_mode === 'remote' ? 'Remote' : r.location_text || r.location_mode.replace('_', ' '), pay ?? '', r.deadline ? `apply by ${when(r.deadline)}` : ''].filter(Boolean),
        path: `/work/${r.id}`,
        featured: r.featured === 1,
        live: r.status === 'published' && (!r.deadline || r.deadline >= today),
        endsAt: r.deadline,
        createdAt: r.created_at,
      });
    }
  }
  if (types.includes('event')) {
    const rows = await db
      .prepare(`SELECT e.*, u.display_name AS host_name FROM events e JOIN users u ON u.id = e.host_user_id WHERE e.visibility = 'public' ${o.includeHidden ? '' : `AND e.status = 'published' AND e.ends_at >= '${now}'`}${idClause('e.id')} ORDER BY e.featured DESC, e.starts_at LIMIT 200`)
      .all<{ id: string; title: string; description: string; host_name: string; event_type: keyof typeof EVENT_TYPE_META; venue: string; online_url: string | null; starts_at: string; ends_at: string; price_points: number; status: string; featured: number; created_at: string }>();
    for (const r of rows.results) {
      out.push({
        type: 'event',
        id: r.id,
        title: r.title,
        by: nameOf({ display_name: r.host_name }),
        blurb: r.description,
        facts: [EVENT_TYPE_META[r.event_type]?.name ?? r.event_type, new Date(r.starts_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), r.online_url ? 'Online' : r.venue || '', r.price_points > 0 ? `${r.price_points} pts` : 'Free'].filter(Boolean),
        path: `/party/${r.id}`,
        featured: r.featured === 1,
        live: r.status === 'published' && r.ends_at >= now,
        endsAt: r.ends_at,
        createdAt: r.created_at,
      });
    }
  }
  if (types.includes('program')) {
    const rows = await db
      .prepare(`SELECT p.*, (SELECT COUNT(*) FROM cohorts k WHERE k.program_id = p.id AND k.status IN ('upcoming','running')) AS cohorts FROM programs p WHERE 1=1 ${o.includeHidden ? '' : 'AND p.published = 1'}${idClause('p.id')} ORDER BY p.featured DESC, p.created_at DESC LIMIT 200`)
      .all<{ id: string; name: string; description: string; price_points: number; price_cents: number; currency: string; delivery_mode: string; published: number; featured: number; created_at: string; cohorts: number }>();
    for (const r of rows.results) {
      out.push({
        type: 'program',
        id: r.id,
        title: r.name,
        by: 'Kreators School',
        blurb: r.description,
        facts: [r.delivery_mode.replace('_', ' '), r.price_points > 0 ? `${r.price_points} pts` : r.price_cents > 0 ? `${r.currency} ${(r.price_cents / 100).toFixed(0)}` : 'Free', r.cohorts > 0 ? `${r.cohorts} cohort${r.cohorts === 1 ? '' : 's'} open` : 'cohort dates soon'].filter(Boolean),
        path: `/school`,
        featured: r.featured === 1,
        live: r.published === 1,
        endsAt: null,
        createdAt: r.created_at,
      });
    }
  }
  if (types.includes('tool')) {
    const rows = await db.prepare(`SELECT * FROM tools WHERE 1=1 ${o.includeHidden ? '' : 'AND verified = 1'}${idClause('id')} ORDER BY name LIMIT 200`).all<{ id: string; name: string; category: string; url: string; description: string; affiliate: number; verified: number; created_at: string }>();
    for (const r of rows.results) {
      out.push({ type: 'tool', id: r.id, title: r.name, by: r.category, blurb: r.description, facts: [r.category, r.affiliate === 1 ? 'partner link' : 'verified'].filter(Boolean), path: '/tools', featured: false, live: r.verified === 1, endsAt: null, createdAt: r.created_at });
    }
  }
  if (types.includes('campaign')) {
    const rows = await db
      .prepare(`SELECT c.*, o.name AS organization_name FROM campaigns c JOIN organizations o ON o.id = c.organization_id WHERE 1=1 ${o.includeHidden ? '' : "AND c.public = 1 AND c.status IN ('brief','shortlist','approved')"}${idClause('c.id')} ORDER BY c.updated_at DESC LIMIT 100`)
      .all<{ id: string; name: string; brief: string; organization_name: string; status: string; due_date: string | null; public: number; created_at: string }>();
    for (const r of rows.results) {
      out.push({ type: 'campaign', id: r.id, title: r.name, by: r.organization_name, blurb: r.brief, facts: [r.status, r.due_date ? `due ${when(r.due_date)}` : ''].filter(Boolean), path: `/army/${r.id}`, featured: false, live: r.public === 1 && ['brief', 'shortlist', 'approved'].includes(r.status), endsAt: r.due_date, createdAt: r.created_at });
    }
  }
  if (types.includes('circle')) {
    const rows = await db
      .prepare(`SELECT e.*, (SELECT COUNT(*) FROM circle_signups s WHERE s.event_id = e.id) AS signups FROM circle_events e WHERE 1=1 ${o.includeHidden ? '' : `AND e.status = 'open' AND e.starts_at >= '${now}'`}${idClause('e.id')} ORDER BY e.starts_at LIMIT 200`)
      .all<{ id: string; title: string; city: string; area: string; starts_at: string; venue_hint: string; group_size: number; status: string; created_at: string; signups: number }>();
    for (const r of rows.results) {
      out.push({
        type: 'circle',
        id: r.id,
        title: r.title,
        by: [r.area, r.city].filter(Boolean).join(', '),
        blurb: `Anonymous group of ${r.group_size}, matched by interests that fit. Names stay hidden; the chat opens a day before.${r.venue_hint ? ` ${r.venue_hint}` : ''}`,
        facts: [new Date(r.starts_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), `${r.signups} signed up`, `tables of ${r.group_size}`],
        path: '/circles',
        featured: false,
        live: r.status === 'open' && r.starts_at >= now,
        endsAt: r.starts_at,
        createdAt: r.created_at,
      });
    }
  }
  let list = out;
  if (q) list = list.filter((l) => [l.title, l.by, l.blurb, ...l.facts].join(' ').toLowerCase().includes(q));
  if (o.featuredOnly) list = list.filter((l) => l.featured);
  list.sort((a, b) => Number(b.featured) - Number(a.featured) || (b.createdAt < a.createdAt ? -1 : 1));
  return list.slice(0, o.limit ?? 100);
}

explore.get('/', async (c) => {
  const type = c.req.query('type');
  const listings = await listingsFor(c.env.DB, {
    q: c.req.query('q') ?? '',
    type: (LISTING_TYPES as readonly string[]).includes(type ?? '') ? (type as ListingType) : undefined,
    featuredOnly: c.req.query('featured') === '1',
    limit: Math.min(100, Number(c.req.query('limit')) || 60),
  });
  return c.json({ listings });
});

explore.get('/stats', async (c) => {
  const now = new Date().toISOString();
  const row = await c.env.DB
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE onboarded_at IS NOT NULL) AS members,
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
