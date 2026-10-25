import { Hono } from 'hono';
import {
  FEATURE_DAYS,
  FEATURE_FEE_POINTS,
  isFeatured,
  LISTING_STATUSES,
  MAX_KIT_ITEMS,
  MAX_OPEN_LISTINGS,
  parseImageUrls,
  PREOWNED_CONDITIONS,
  STORE_CATEGORIES,
  STORE_STAGES,
  type ListingDetail,
  type MarketCard,
  type MarketResponse,
  type PreownedListing,
  type PreownedMessage,
  type PreownedOffer,
  type StoreItem,
  type StoreKit,
  type StoreKitItem,
  type StoreStage,
} from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { nameOf, newId, notify, nowIso, num, oneOf, str } from '../db';
import { trustForMany } from '../rewards';
import { badgesNow, honorKeys } from '../db';
import { isBadgeKey, unlockFor } from '@kreators/shared';
import { trustScore, type TrustScore } from '@kreators/shared';

/** The Store: staff add new gear with partner links, anyone sells pre-owned gear, kits group both by budget. */
export const market = new Hono<AppEnv>();

const isStaff = (u: UserRow) => u.role === 'admin' || u.role === 'sub_admin';
export const featureUntil = () => new Date(Date.now() + FEATURE_DAYS * 86_400_000).toISOString();
const https = (v: unknown) => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim()) ? v.trim().slice(0, 500) : '');

interface ItemRow { id: string; title: string; category: string; description: string; price_cents: number; currency: string; url: string; image_url: string; stage: StoreStage; featured_until: string | null; status: 'live' | 'hidden'; created_at: string; clicks: number; min_points: number; badge: string }
type Have = { points: number; badges: readonly string[] } | null;
interface KitRow { id: string; title: string; description: string; stage: StoreStage; budget_cents: number; currency: string; items_json: string; featured_until: string | null; status: 'live' | 'hidden'; created_at: string }
interface ListingRow { id: string; seller_id: string; seller_name: string; seller_handle: string | null; title: string; category: string; description: string; condition: PreownedListing['condition']; price_cents: number; original_cents: number | null; currency: string; purchase_year: number | null; includes: string; images_json: string; is_kit: number; city: string; status: PreownedListing['status']; sold_cents: number | null; buyer_id: string | null; featured_until: string | null; created_at: string; open_offers: number }
interface OfferRow { id: string; listing_id: string; listing_title: string; buyer_id: string; buyer_name: string; cents: number; note: string; status: PreownedOffer['status']; created_at: string; decided_at: string | null }
interface MessageRow { id: string; listing_id: string; buyer_id: string; sender_id: string; sender_name: string; body: string; created_at: string }

const ITEM_SELECT = "SELECT i.*, (SELECT COUNT(*) FROM outbound_clicks c WHERE c.kind = 'item' AND c.target_id = i.id) AS clicks FROM store_items i";
const LISTING_SELECT = "SELECT l.*, u.display_name AS seller_name, u.handle AS seller_handle, (SELECT COUNT(*) FROM preowned_offers o WHERE o.listing_id = l.id AND o.status = 'open') AS open_offers FROM preowned_listings l JOIN users u ON u.id = l.seller_id";
const OFFER_SELECT = 'SELECT o.*, u.display_name AS buyer_name, l.title AS listing_title FROM preowned_offers o JOIN users u ON u.id = o.buyer_id JOIN preowned_listings l ON l.id = o.listing_id';

const toItem = (r: ItemRow, have: Have = null): StoreItem => {
  const unlock = unlockFor({ minPoints: r.min_points, badge: r.badge }, have);
  return { id: r.id, title: r.title, category: r.category, description: r.description, priceCents: r.price_cents, currency: r.currency, url: unlock.ok ? r.url : '', imageUrl: r.image_url, stage: r.stage, featuredUntil: r.featured_until, status: r.status, clicks: r.clicks, createdAt: r.created_at, minPoints: r.min_points, badge: r.badge, unlock };
};
async function haveFor(db: D1Database, user: UserRow): Promise<Have> {
  return { points: user.points, badges: [...(await badgesNow(db, user.id)), ...(await honorKeys(db, user))] };
}
const NO_TRUST: TrustScore = trustScore({ xp: 0, pointsEarned: 0, bestStreak: 0, daysHere: 0, sold: 0, rating: null, honors: 0 });
const toListing = (r: ListingRow, me: string, trust: Map<string, TrustScore> = new Map()): PreownedListing => ({
  id: r.id,
  sellerId: r.seller_id,
  sellerName: nameOf({ display_name: r.seller_name }),
  sellerHandle: r.seller_handle,
  title: r.title,
  category: r.category,
  description: r.description,
  condition: r.condition,
  priceCents: r.price_cents,
  originalCents: r.original_cents,
  currency: r.currency,
  purchaseYear: r.purchase_year,
  includes: r.includes,
  images: parseImageUrls(JSON.parse(r.images_json || '[]')),
  isKit: r.is_kit === 1,
  city: r.city,
  status: r.status,
  soldCents: r.sold_cents,
  offers: r.open_offers,
  featuredUntil: r.featured_until,
  createdAt: r.created_at,
  mine: r.seller_id === me,
  sellerTrust: trust.get(r.seller_id) ?? NO_TRUST,
});
const toOffer = (r: OfferRow): PreownedOffer => ({ id: r.id, listingId: r.listing_id, listingTitle: r.listing_title, buyerId: r.buyer_id, buyerName: nameOf({ display_name: r.buyer_name }), cents: r.cents, note: r.note, status: r.status, createdAt: r.created_at, decidedAt: r.decided_at });
const toMessage = (r: MessageRow, me: string): PreownedMessage => ({ id: r.id, listingId: r.listing_id, buyerId: r.buyer_id, senderName: nameOf({ display_name: r.sender_name }), mine: r.sender_id === me, body: r.body, createdAt: r.created_at });

/** A kit's pieces, looked up live so prices and whether a pre-owned piece is still for sale stay true. */
async function kitItems(db: D1Database, raw: string): Promise<StoreKitItem[]> {
  let refs: { type: string; id: string }[] = [];
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    refs = Array.isArray(v) ? v.filter((x): x is { type: string; id: string } => Boolean(x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')) : [];
  } catch {
    refs = [];
  }
  const out: StoreKitItem[] = [];
  for (const ref of refs.slice(0, MAX_KIT_ITEMS)) {
    if (ref.type === 'item') {
      const r = await db.prepare('SELECT id, title, price_cents FROM store_items WHERE id = ?').bind(ref.id).first<{ id: string; title: string; price_cents: number }>();
      if (r) out.push({ type: 'item', id: r.id, title: r.title, priceCents: r.price_cents, status: null });
    } else {
      const r = await db.prepare('SELECT id, title, price_cents, status FROM preowned_listings WHERE id = ?').bind(ref.id).first<{ id: string; title: string; price_cents: number; status: string }>();
      if (r) out.push({ type: 'listing', id: r.id, title: r.title, priceCents: r.price_cents, status: r.status });
    }
  }
  return out;
}
async function toKit(db: D1Database, r: KitRow): Promise<StoreKit> {
  const items = await kitItems(db, r.items_json);
  return { id: r.id, title: r.title, description: r.description, stage: r.stage, budgetCents: r.budget_cents, currency: r.currency, items, totalCents: items.reduce((s, i) => s + i.priceCents, 0), featuredUntil: r.featured_until, status: r.status, createdAt: r.created_at };
}

market.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const now = nowIso();
  const [items, kits, listings, mineListings, mineOffers] = await Promise.all([
    db.prepare(`${ITEM_SELECT} WHERE i.status = 'live' ORDER BY CASE WHEN i.featured_until > ? THEN 0 ELSE 1 END, i.created_at DESC LIMIT 200`).bind(now).all<ItemRow>(),
    db.prepare("SELECT * FROM store_kits WHERE status = 'live' ORDER BY CASE WHEN featured_until > ? THEN 0 ELSE 1 END, budget_cents ASC LIMIT 50").bind(now).all<KitRow>(),
    db.prepare(`${LISTING_SELECT} WHERE l.status IN ('live', 'agreed') OR (l.status = 'sold' AND l.updated_at >= ?) ORDER BY CASE WHEN l.featured_until > ? THEN 0 ELSE 1 END, CASE l.status WHEN 'live' THEN 0 WHEN 'agreed' THEN 1 ELSE 2 END, l.created_at DESC LIMIT 200`).bind(new Date(Date.now() - 14 * 86_400_000).toISOString(), now).all<ListingRow>(),
    db.prepare(`${LISTING_SELECT} WHERE l.seller_id = ? ORDER BY l.created_at DESC LIMIT 50`).bind(user.id).all<ListingRow>(),
    db.prepare(`${OFFER_SELECT} WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 50`).bind(user.id).all<OfferRow>(),
  ]);
  const kitList = await Promise.all(kits.results.map((k) => toKit(db, k)));
  const have = await haveFor(db, user);
  const itemList = items.results.map((i) => toItem(i, have));
  const trust = await trustForMany(db, [...listings.results, ...mineListings.results].map((l) => l.seller_id));
  const listingList = listings.results.map((l) => toListing(l, user.id, trust));
  const featured: MarketCard[] = [
    ...itemList.filter((i) => isFeatured(i.featuredUntil, now)).map((item): MarketCard => ({ type: 'item', item })),
    ...kitList.filter((k) => isFeatured(k.featuredUntil, now)).map((kit): MarketCard => ({ type: 'kit', kit })),
    ...listingList.filter((l) => l.status === 'live' && isFeatured(l.featuredUntil, now)).map((listing): MarketCard => ({ type: 'listing', listing })),
  ];
  const res: MarketResponse = {
    featured,
    kits: kitList,
    items: itemList,
    listings: listingList,
    mine: { listings: mineListings.results.map((l) => toListing(l, user.id, trust)), offers: mineOffers.results.map(toOffer) },
    admin: isStaff(user),
    feature: { feePoints: FEATURE_FEE_POINTS, days: FEATURE_DAYS, points: user.points },
  };
  return c.json(res);
});

// ---- the direct store: staff only
market.post('/items', async (c) => {
  const user = c.get('user');
  if (!isStaff(user)) return c.json({ error: 'only the team adds to the store' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const url = https(body.url);
  if (!title || !url) return c.json({ error: 'a title and a link' }, 400);
  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare('INSERT INTO store_items (id, title, category, description, price_cents, currency, url, image_url, stage, featured_until, status, created_by, created_at, updated_at, min_points, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)')
    .bind(id, title, oneOf(body.category, STORE_CATEGORIES, 'Other'), str(body.description, 2000), num(body.priceCents, 0, 0) ?? 0, str(body.currency, 3, 'INR').toUpperCase(), url, https(body.imageUrl), oneOf(body.stage, STORE_STAGES, 'any'), body.hidden === true ? 'hidden' : 'live', user.id, now, now, num(body.minPoints, 0, 0) ?? 0, isBadgeKey(str(body.badge, 40)) ? str(body.badge, 40) : '')
    .run();
  const row = await c.env.DB.prepare(`${ITEM_SELECT} WHERE i.id = ?`).bind(id).first<ItemRow>();
  return c.json({ item: row ? toItem(row, await haveFor(c.env.DB, user)) : null }, 201);
});

market.patch('/items/:id', async (c) => {
  const user = c.get('user');
  if (!isStaff(user)) return c.json({ error: 'only the team changes the store' }, 403);
  const db = c.env.DB;
  const row = await db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).bind(c.req.param('id')).first<ItemRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120, row.title) || row.title;
  const url = https(body.url) || row.url;
  await db
    .prepare('UPDATE store_items SET title = ?, category = ?, description = ?, price_cents = ?, url = ?, image_url = ?, stage = ?, status = ?, updated_at = ?, min_points = ?, badge = ? WHERE id = ?')
    .bind(title, oneOf(body.category, STORE_CATEGORIES, row.category as (typeof STORE_CATEGORIES)[number]), body.description === undefined ? row.description : str(body.description, 2000), body.priceCents === undefined ? row.price_cents : (num(body.priceCents, row.price_cents, 0) ?? row.price_cents), url, body.imageUrl === undefined ? row.image_url : https(body.imageUrl), oneOf(body.stage, STORE_STAGES, row.stage), body.hidden === undefined ? row.status : body.hidden ? 'hidden' : 'live', nowIso(), body.minPoints === undefined ? row.min_points : (num(body.minPoints, row.min_points, 0) ?? row.min_points), body.badge === undefined ? row.badge : isBadgeKey(str(body.badge, 40)) ? str(body.badge, 40) : '', row.id)
    .run();
  const fresh = await db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).bind(row.id).first<ItemRow>();
  return c.json({ item: fresh ? toItem(fresh, await haveFor(db, user)) : null });
});

market.delete('/items/:id', async (c) => {
  if (!isStaff(c.get('user'))) return c.json({ error: 'only the team changes the store' }, 403);
  const r = await c.env.DB.prepare('DELETE FROM store_items WHERE id = ?').bind(c.req.param('id')).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- kits: staff only
function kitRefs(v: unknown): { type: 'item' | 'listing'; id: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is { type: unknown; id: unknown } => Boolean(x && typeof x === 'object'))
    .map((x) => ({ type: x.type === 'listing' ? ('listing' as const) : ('item' as const), id: typeof x.id === 'string' ? x.id : '' }))
    .filter((x) => x.id)
    .slice(0, MAX_KIT_ITEMS);
}

market.post('/kits', async (c) => {
  const user = c.get('user');
  if (!isStaff(user)) return c.json({ error: 'only the team makes kits' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const refs = kitRefs(body.items);
  if (!title) return c.json({ error: 'give the kit a name' }, 400);
  if (refs.length === 0) return c.json({ error: 'put at least one thing in the kit' }, 400);
  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare('INSERT INTO store_kits (id, title, description, stage, budget_cents, currency, items_json, featured_until, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)')
    .bind(id, title, str(body.description, 2000), oneOf(body.stage, STORE_STAGES, 'any'), num(body.budgetCents, 0, 0) ?? 0, str(body.currency, 3, 'INR').toUpperCase(), JSON.stringify(refs), body.hidden === true ? 'hidden' : 'live', user.id, now, now)
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM store_kits WHERE id = ?').bind(id).first<KitRow>();
  return c.json({ kit: row ? await toKit(c.env.DB, row) : null }, 201);
});

market.patch('/kits/:id', async (c) => {
  const user = c.get('user');
  if (!isStaff(user)) return c.json({ error: 'only the team makes kits' }, 403);
  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM store_kits WHERE id = ?').bind(c.req.param('id')).first<KitRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const refs = body.items === undefined ? null : kitRefs(body.items);
  if (refs && refs.length === 0) return c.json({ error: 'put at least one thing in the kit' }, 400);
  await db
    .prepare('UPDATE store_kits SET title = ?, description = ?, stage = ?, budget_cents = ?, items_json = ?, status = ?, updated_at = ? WHERE id = ?')
    .bind(str(body.title, 120, row.title) || row.title, body.description === undefined ? row.description : str(body.description, 2000), oneOf(body.stage, STORE_STAGES, row.stage), body.budgetCents === undefined ? row.budget_cents : (num(body.budgetCents, row.budget_cents, 0) ?? row.budget_cents), refs ? JSON.stringify(refs) : row.items_json, body.hidden === undefined ? row.status : body.hidden ? 'hidden' : 'live', nowIso(), row.id)
    .run();
  const fresh = await db.prepare('SELECT * FROM store_kits WHERE id = ?').bind(row.id).first<KitRow>();
  return c.json({ kit: fresh ? await toKit(db, fresh) : null });
});

market.delete('/kits/:id', async (c) => {
  if (!isStaff(c.get('user'))) return c.json({ error: 'only the team makes kits' }, 403);
  const r = await c.env.DB.prepare('DELETE FROM store_kits WHERE id = ?').bind(c.req.param('id')).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- pre-owned: anyone sells, offers and a chat per buyer, the seller decides
async function listingFor(db: D1Database, id: string): Promise<ListingRow | null> {
  return db.prepare(`${LISTING_SELECT} WHERE l.id = ?`).bind(id).first<ListingRow>();
}

market.post('/listings', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const price = num(body.priceCents, null, 0);
  if (!title || price === null || price <= 0) return c.json({ error: 'a title and a price' }, 400);
  if (!(PREOWNED_CONDITIONS as readonly string[]).includes(String(body.condition))) return c.json({ error: 'say the condition' }, 400);
  const open = await db.prepare("SELECT COUNT(*) AS n FROM preowned_listings WHERE seller_id = ? AND status IN ('live', 'agreed')").bind(user.id).first<{ n: number }>();
  if ((open?.n ?? 0) >= MAX_OPEN_LISTINGS) return c.json({ error: `${MAX_OPEN_LISTINGS} listings at once is plenty. Mark some sold first.` }, 400);
  const id = newId();
  const now = nowIso();
  await db
    .prepare('INSERT INTO preowned_listings (id, seller_id, title, category, description, condition, price_cents, original_cents, currency, purchase_year, includes, images_json, is_kit, city, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, title, oneOf(body.category, STORE_CATEGORIES, 'Other'), str(body.description, 3000), String(body.condition), Math.round(price), num(body.originalCents, null, 0), str(body.currency, 3, 'INR').toUpperCase(), num(body.purchaseYear, null, 1990, 2100), str(body.includes, 300), JSON.stringify(parseImageUrls(body.images)), body.isKit === true ? 1 : 0, str(body.city, 80, user.city) || user.city, 'live', now, now)
    .run();
  const row = await listingFor(db, id);
  return c.json({ listing: row ? toListing(row, user.id) : null }, 201);
});

market.get('/listings/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await listingFor(db, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const mine = row.seller_id === user.id;
  const [offers, messages, threads] = await Promise.all([
    mine ? db.prepare(`${OFFER_SELECT} WHERE o.listing_id = ? ORDER BY o.created_at DESC`).bind(row.id).all<OfferRow>() : db.prepare(`${OFFER_SELECT} WHERE o.listing_id = ? AND o.buyer_id = ? ORDER BY o.created_at DESC`).bind(row.id, user.id).all<OfferRow>(),
    mine ? null : db.prepare('SELECT m.*, u.display_name AS sender_name FROM preowned_messages m JOIN users u ON u.id = m.sender_id WHERE m.listing_id = ? AND m.buyer_id = ? ORDER BY m.created_at ASC LIMIT 200').bind(row.id, user.id).all<MessageRow>(),
    mine ? db.prepare('SELECT m.buyer_id, u.display_name AS buyer_name, COUNT(*) AS n, MAX(m.created_at) AS last FROM preowned_messages m JOIN users u ON u.id = m.buyer_id WHERE m.listing_id = ? GROUP BY m.buyer_id ORDER BY last DESC').bind(row.id).all<{ buyer_id: string; buyer_name: string; n: number; last: string }>() : null,
  ]);
  const res: ListingDetail = {
    listing: toListing(row, user.id, await trustForMany(db, [row.seller_id])),
    offers: offers.results.map(toOffer),
    myOffer: mine ? null : (offers.results.map(toOffer).find((o) => o.status === 'open' || o.status === 'accepted') ?? null),
    messages: messages ? messages.results.map((m) => toMessage(m, user.id)) : [],
    threads: threads ? threads.results.map((t) => ({ buyerId: t.buyer_id, buyerName: nameOf({ display_name: t.buyer_name }), count: t.n, last: t.last })) : [],
  };
  return c.json(res);
});

market.patch('/listings/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM preowned_listings WHERE id = ? AND seller_id = ?').bind(c.req.param('id'), user.id).first<ListingRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const status = body.status === undefined ? row.status : oneOf(body.status, LISTING_STATUSES, row.status);
  if (status === 'sold' || status === 'agreed') return c.json({ error: 'mark it sold with the sold price' }, 400);
  await db
    .prepare('UPDATE preowned_listings SET title = ?, category = ?, description = ?, condition = ?, price_cents = ?, original_cents = ?, purchase_year = ?, includes = ?, images_json = ?, is_kit = ?, city = ?, status = ?, updated_at = ? WHERE id = ?')
    .bind(
      str(body.title, 120, row.title) || row.title,
      oneOf(body.category, STORE_CATEGORIES, row.category as (typeof STORE_CATEGORIES)[number]),
      body.description === undefined ? row.description : str(body.description, 3000),
      oneOf(body.condition, PREOWNED_CONDITIONS, row.condition),
      body.priceCents === undefined ? row.price_cents : Math.max(1, Math.round(num(body.priceCents, row.price_cents, 1) ?? row.price_cents)),
      body.originalCents === undefined ? row.original_cents : num(body.originalCents, null, 0),
      body.purchaseYear === undefined ? row.purchase_year : num(body.purchaseYear, null, 1990, 2100),
      body.includes === undefined ? row.includes : str(body.includes, 300),
      body.images === undefined ? row.images_json : JSON.stringify(parseImageUrls(body.images)),
      body.isKit === undefined ? row.is_kit : body.isKit ? 1 : 0,
      body.city === undefined ? row.city : str(body.city, 80),
      status,
      nowIso(),
      row.id,
    )
    .run();
  const fresh = await listingFor(db, row.id);
  return c.json({ listing: fresh ? toListing(fresh, user.id) : null });
});

// Sold: the seller says for how much. Open offers close.
market.post('/listings/:id/sold', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM preowned_listings WHERE id = ? AND seller_id = ?').bind(c.req.param('id'), user.id).first<ListingRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ cents?: unknown }>().catch(() => ({}) as { cents?: unknown });
  const accepted = await db.prepare("SELECT cents FROM preowned_offers WHERE listing_id = ? AND status = 'accepted' ORDER BY decided_at DESC LIMIT 1").bind(row.id).first<{ cents: number }>();
  const cents = Math.round(num(body.cents, accepted?.cents ?? row.price_cents, 0) ?? row.price_cents);
  const now = nowIso();
  await db.batch([
    db.prepare("UPDATE preowned_listings SET status = 'sold', sold_cents = ?, updated_at = ? WHERE id = ?").bind(cents, now, row.id),
    db.prepare("UPDATE preowned_offers SET status = 'declined', decided_at = ? WHERE listing_id = ? AND status = 'open'").bind(now, row.id),
  ]);
  const fresh = await listingFor(db, row.id);
  return c.json({ listing: fresh ? toListing(fresh, user.id) : null });
});

market.delete('/listings/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM preowned_listings WHERE id = ? AND seller_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// Offers: one open offer per buyer; a new one replaces it. Not on the direct store.
market.post('/listings/:id/offers', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM preowned_listings WHERE id = ?').bind(c.req.param('id')).first<ListingRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.seller_id === user.id) return c.json({ error: 'That one is yours.' }, 400);
  if (row.status !== 'live') return c.json({ error: 'This one is no longer open to offers.' }, 400);
  const body = await c.req.json<{ cents?: unknown; note?: unknown }>().catch(() => ({}) as { cents?: unknown; note?: unknown });
  const cents = num(body.cents, null, 1);
  if (cents === null) return c.json({ error: 'say how much' }, 400);
  const id = newId();
  const now = nowIso();
  await db.batch([
    db.prepare("UPDATE preowned_offers SET status = 'withdrawn', decided_at = ? WHERE listing_id = ? AND buyer_id = ? AND status = 'open'").bind(now, row.id, user.id),
    db.prepare('INSERT INTO preowned_offers (id, listing_id, buyer_id, cents, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, row.id, user.id, Math.round(cents), str(body.note, 300), 'open', now),
  ]);
  await notify(db, row.seller_id, 'store', `An offer on ${row.title}`, `${nameOf(user)} offers ${row.currency} ${(Math.round(cents) / 100).toLocaleString()}.`, '/store');
  const fresh = await db.prepare(`${OFFER_SELECT} WHERE o.id = ?`).bind(id).first<OfferRow>();
  return c.json({ offer: fresh ? toOffer(fresh) : null }, 201);
});

market.post('/offers/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const offer = await db.prepare(`${OFFER_SELECT} WHERE o.id = ?`).bind(c.req.param('id')).first<OfferRow & { seller_id?: string }>();
  if (!offer) return c.json({ error: 'not found' }, 404);
  const listing = await db.prepare('SELECT * FROM preowned_listings WHERE id = ?').bind(offer.listing_id).first<ListingRow>();
  if (!listing) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ action?: string }>().catch(() => ({}) as { action?: string });
  const action = oneOf(body.action, ['accept', 'decline', 'withdraw'] as const, 'decline');
  const now = nowIso();
  if (action === 'withdraw') {
    if (offer.buyer_id !== user.id) return c.json({ error: 'not found' }, 404);
    if (offer.status !== 'open') return c.json({ error: 'That offer is already decided.' }, 400);
    await db.prepare("UPDATE preowned_offers SET status = 'withdrawn', decided_at = ? WHERE id = ?").bind(now, offer.id).run();
  } else {
    if (listing.seller_id !== user.id) return c.json({ error: 'not found' }, 404);
    if (offer.status !== 'open') return c.json({ error: 'That offer is already decided.' }, 400);
    if (action === 'accept') {
      await db.batch([
        db.prepare("UPDATE preowned_offers SET status = 'accepted', decided_at = ? WHERE id = ?").bind(now, offer.id),
        db.prepare("UPDATE preowned_offers SET status = 'declined', decided_at = ? WHERE listing_id = ? AND id != ? AND status = 'open'").bind(now, listing.id, offer.id),
        db.prepare("UPDATE preowned_listings SET status = 'agreed', buyer_id = ?, updated_at = ? WHERE id = ?").bind(offer.buyer_id, now, listing.id),
      ]);
      await notify(db, offer.buyer_id, 'store', `Your offer on ${listing.title} was accepted`, 'Sort out the handover in the chat.', '/store');
    } else {
      await db.prepare("UPDATE preowned_offers SET status = 'declined', decided_at = ? WHERE id = ?").bind(now, offer.id).run();
      await notify(db, offer.buyer_id, 'store', `Your offer on ${listing.title} was declined`, 'You can make another.', '/store');
    }
  }
  const [fresh, freshListing] = await Promise.all([db.prepare(`${OFFER_SELECT} WHERE o.id = ?`).bind(offer.id).first<OfferRow>(), listingFor(db, listing.id)]);
  return c.json({ offer: fresh ? toOffer(fresh) : null, listing: freshListing ? toListing(freshListing, user.id) : null });
});

// A chat per listing and buyer. The seller picks the buyer; a buyer only has their own thread.
async function threadFor(c: { env: { DB: D1Database } }, user: UserRow, listingId: string, buyerParam: string | undefined): Promise<{ listing: ListingRow; buyerId: string } | null> {
  const listing = await c.env.DB.prepare('SELECT * FROM preowned_listings WHERE id = ?').bind(listingId).first<ListingRow>();
  if (!listing) return null;
  const buyerId = listing.seller_id === user.id ? (buyerParam ?? '') : user.id;
  if (!buyerId || buyerId === listing.seller_id) return null;
  return { listing, buyerId };
}

market.get('/listings/:id/messages', async (c) => {
  const user = c.get('user');
  const t = await threadFor(c, user, c.req.param('id'), c.req.query('buyerId'));
  if (!t) return c.json({ error: 'not found' }, 404);
  const rows = await c.env.DB.prepare('SELECT m.*, u.display_name AS sender_name FROM preowned_messages m JOIN users u ON u.id = m.sender_id WHERE m.listing_id = ? AND m.buyer_id = ? ORDER BY m.created_at ASC LIMIT 200').bind(t.listing.id, t.buyerId).all<MessageRow>();
  return c.json({ messages: rows.results.map((m) => toMessage(m, user.id)) });
});

market.post('/listings/:id/messages', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ body?: unknown; buyerId?: string }>().catch(() => ({}) as { body?: unknown; buyerId?: string });
  const t = await threadFor(c, user, c.req.param('id'), body.buyerId);
  if (!t) return c.json({ error: 'not found' }, 404);
  const text = str(body.body, 1000);
  if (!text) return c.json({ error: 'say something' }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO preowned_messages (id, listing_id, buyer_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, t.listing.id, t.buyerId, user.id, text, now).run();
  const other = user.id === t.listing.seller_id ? t.buyerId : t.listing.seller_id;
  await notify(db, other, 'store', `About ${t.listing.title}`, text.slice(0, 120), '/store');
  const row = await db.prepare('SELECT m.*, u.display_name AS sender_name FROM preowned_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?').bind(id).first<MessageRow>();
  return c.json({ message: row ? toMessage(row, user.id) : null }, 201);
});

// A featured spot: staff give it for free; a seller pays points for their own listing.
market.post('/feature', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ type?: string; id?: string }>().catch(() => ({}) as { type?: string; id?: string });
  const type = oneOf(body.type, ['item', 'kit', 'listing', 'tool'] as const, 'listing');
  const id = str(body.id, 64);
  const table = type === 'item' ? 'store_items' : type === 'kit' ? 'store_kits' : type === 'tool' ? 'tools' : 'preowned_listings';
  const until = featureUntil();
  const now = nowIso();
  if (isStaff(user)) {
    const r = await db.prepare(`UPDATE ${table} SET featured_until = ? WHERE id = ?`).bind(until, id).run();
    if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
    return c.json({ featuredUntil: until, paid: 0 });
  }
  if (type !== 'listing') return c.json({ error: 'Only your own listing can be featured.' }, 403);
  const row = await db.prepare("SELECT id FROM preowned_listings WHERE id = ? AND seller_id = ? AND status = 'live'").bind(id, user.id).first();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (user.points < FEATURE_FEE_POINTS) return c.json({ error: `A featured week costs ${FEATURE_FEE_POINTS} points. You have ${user.points}.` }, 400);
  const paid = await db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').bind(FEATURE_FEE_POINTS, user.id, FEATURE_FEE_POINTS).run();
  if (!paid.meta.changes) return c.json({ error: 'Not enough points.' }, 400);
  await db.batch([
    db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, -FEATURE_FEE_POINTS, 'feature', id, now),
    db.prepare('UPDATE preowned_listings SET featured_until = ?, updated_at = ? WHERE id = ?').bind(until, now, id),
  ]);
  return c.json({ featuredUntil: until, paid: FEATURE_FEE_POINTS });
});
