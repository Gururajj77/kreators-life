import { Hono } from 'hono';
import { AFFILIATE_SHARE, PRODUCT_KIND_META, PRODUCT_KINDS, type Availability, type AvailabilityOverride, type Booking, type Coupon, type Lead, type Lesson, type Order, type Product, type ProductKind, type QuizQuestion, type StudioAnalytics, type Testimonial } from '@kreators/shared';
import { isBadgeKey } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf, newId, notify, nowIso, parseList } from '../db';
import { logEvent, sendEmail, track } from '../ops';
import { parseQuiz } from './buyer';

export const studio = new Hono<AppEnv>();

export interface ProductRow {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_handle: string | null;
  kind: ProductKind;
  title: string;
  description: string;
  price_points: number;
  price_cents: number;
  currency: string;
  url: string | null;
  starts_at: string | null;
  duration_min: number | null;
  capacity: number | null;
  meeting_url: string | null;
  status: 'draft' | 'live' | 'archived';
  cover: string;
  sort_order: number;
  created_at: string;
  sold: number;
  rating: number | null;
  pwyw: number;
  intake_json: string;
  replay_url: string | null;
  replay_points: number;
  bundle_json: string;
  locked_body: string;
  response_days: number | null;
  lead_magnet: number;
  min_points: number;
  badge: string;
  certificate: number;
  buffer_min: number;
  notice_hours: number;
  max_days_ahead: number;
  period_months: number | null;
}

export const PRODUCT_SELECT = `SELECT p.*, u.display_name AS owner_name, u.handle AS owner_handle,
  (SELECT COUNT(*) FROM orders o WHERE o.product_id = p.id AND o.status IN ('paid','test')) AS sold,
  (SELECT AVG(rating) FROM testimonials t WHERE t.product_id = p.id AND t.approved = 1) AS rating
  FROM products p JOIN users u ON u.id = p.owner_id`;

/** The locked body and replay link only leave the server for people entitled to them. */
export const toProduct = (r: ProductRow, reveal = false): Product => ({
  pwyw: r.pwyw === 1,
  intake: parseList(r.intake_json),
  replayUrl: reveal ? r.replay_url : null,
  replayPoints: r.replay_points,
  bundleIds: parseList(r.bundle_json),
  lockedBody: reveal ? r.locked_body : '',
  responseDays: r.response_days,
  leadMagnet: r.lead_magnet === 1,
  minPoints: r.min_points,
  badge: r.badge,
  certificate: r.certificate === 1,
  bufferMin: r.buffer_min ?? 0,
  noticeHours: r.notice_hours ?? 2,
  maxDaysAhead: r.max_days_ahead ?? 30,
  periodMonths: r.period_months ?? null,
  id: r.id,
  ownerId: r.owner_id,
  ownerName: nameOf({ display_name: r.owner_name }),
  ownerHandle: r.owner_handle,
  kind: r.kind,
  title: r.title,
  description: r.description,
  pricePoints: r.price_points,
  priceCents: r.price_cents,
  currency: r.currency,
  url: r.url,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  capacity: r.capacity,
  meetingUrl: r.meeting_url,
  status: r.status,
  cover: r.cover,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  sold: r.sold,
  rating: r.rating === null ? null : Math.round(r.rating * 10) / 10,
});

export interface LessonRow {
  id: string;
  product_id: string;
  title: string;
  body: string;
  video_url: string | null;
  sort_order: number;
  drip_days: number;
  quiz_json: string;
  pass_score: number;
}
export const toLesson = (r: LessonRow, reveal = true): Lesson => ({ id: r.id, productId: r.product_id, title: r.title, body: r.body, videoUrl: r.video_url, sortOrder: r.sort_order, dripDays: r.drip_days, quiz: reveal ? parseQuiz(r.quiz_json) : parseQuiz(r.quiz_json).map((q) => ({ ...q, answer: -1 })), passScore: r.pass_score });

export interface OrderRow {
  id: string;
  owner_id: string;
  buyer_id: string;
  buyer_name: string;
  product_id: string;
  product_title: string;
  product_kind: ProductKind;
  points: number;
  cents: number;
  currency: string;
  status: Order['status'];
  coupon_code: string | null;
  affiliate_code: string | null;
  provider: string;
  provider_order_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  source_link_id: string | null;
  source_label: string | null;
  click_id: string | null;
  platform_fee_points: number;
  intake_json: string;
  variant: string;
  refunded_at: string | null;
  created_at: string;
}
export const ORDER_SELECT = `SELECT o.*, b.display_name AS buyer_name, p.title AS product_title, p.kind AS product_kind, COALESCE(NULLIF(l.label, ''), l.code) AS source_label FROM orders o JOIN users b ON b.id = o.buyer_id JOIN products p ON p.id = o.product_id LEFT JOIN tracked_links l ON l.id = o.source_link_id`;
export const toOrder = (r: OrderRow): Order => ({
  id: r.id, buyerId: r.buyer_id, buyerName: nameOf({ display_name: r.buyer_name }), productId: r.product_id, productTitle: r.product_title, productKind: r.product_kind, points: r.points, cents: r.cents, currency: r.currency, status: r.status, couponCode: r.coupon_code, affiliateCode: r.affiliate_code,
  provider: r.provider ?? 'points', providerOrderId: r.provider_order_id ?? null, paidAt: r.paid_at ?? null, expiresAt: r.expires_at ?? null,
  sourceLinkId: r.source_link_id, sourceLabel: r.source_label, clickId: r.click_id, platformFeePoints: r.platform_fee_points ?? 0, intake: parseList(r.intake_json), variant: r.variant ?? '', refundedAt: r.refunded_at, createdAt: r.created_at,
});

export interface BookingRow {
  id: string;
  product_id: string;
  product_title: string;
  owner_id: string;
  owner_name: string;
  buyer_id: string;
  buyer_name: string;
  starts_at: string;
  ends_at: string;
  status: Booking['status'];
  meeting_url: string | null;
  note: string;
  intake_json: string;
  created_at: string;
}
export const BOOKING_SELECT = `SELECT k.*, p.title AS product_title, ow.display_name AS owner_name, b.display_name AS buyer_name FROM bookings k JOIN products p ON p.id = k.product_id JOIN users ow ON ow.id = k.owner_id JOIN users b ON b.id = k.buyer_id`;
export const toBooking = (r: BookingRow): Booking => ({ id: r.id, productId: r.product_id, productTitle: r.product_title, ownerId: r.owner_id, ownerName: nameOf({ display_name: r.owner_name }), buyerId: r.buyer_id, buyerName: nameOf({ display_name: r.buyer_name }), startsAt: r.starts_at, endsAt: r.ends_at, status: r.status, meetingUrl: r.meeting_url, note: r.note, intake: parseList(r.intake_json), createdAt: r.created_at });

interface TestimonialRow {
  id: string;
  product_id: string;
  product_title: string;
  author_name: string;
  rating: number;
  body: string;
  approved: number;
  created_at: string;
}
export const TESTIMONIAL_SELECT = `SELECT t.*, p.title AS product_title, a.display_name AS author_name FROM testimonials t JOIN products p ON p.id = t.product_id JOIN users a ON a.id = t.author_id`;
export const toTestimonial = (r: TestimonialRow): Testimonial => ({ id: r.id, productId: r.product_id, productTitle: r.product_title, authorName: nameOf({ display_name: r.author_name }), rating: r.rating, body: r.body, approved: r.approved === 1, createdAt: r.created_at });

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
const int = (v: unknown, fallback: number | null, lo = 0, hi = 1_000_000): number | null => {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
};

const list = (v: unknown, max: number, len: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, len)).filter(Boolean).slice(0, max) : []);

/** Up to twenty multiple-choice questions, each with two to six options and one right answer. */
function cleanQuiz(v: unknown): QuizQuestion[] {
  if (!Array.isArray(v)) return [];
  const out: QuizQuestion[] = [];
  for (const q of v.slice(0, 20)) {
    if (!q || typeof q !== 'object') continue;
    const o = q as Record<string, unknown>;
    const options = list(o.options, 6, 200);
    const answer = Number(o.answer);
    const text = str(o.q, 300);
    if (text && options.length >= 2 && Number.isInteger(answer) && answer >= 0 && answer < options.length) out.push({ q: text, options, answer });
  }
  return out;
}

/** Only your own live products can go in a bundle. */
async function ownedIds(db: D1Database, ownerId: string, v: unknown): Promise<string[]> {
  const ids = list(v, 12, 64);
  if (ids.length === 0) return [];
  const rows = await db.prepare(`SELECT id FROM products WHERE owner_id = ? AND kind != 'bundle' AND id IN (${ids.map(() => '?').join(',')})`).bind(ownerId, ...ids).all<{ id: string }>();
  return rows.results.map((r) => r.id);
}

async function ownProduct(db: D1Database, ownerId: string, id: string): Promise<ProductRow | null> {
  return db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.owner_id = ?`).bind(id, ownerId).first<ProductRow>();
}

// ---- overview
studio.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const days: string[] = [];
  for (let i = 13; i >= 0; i -= 1) days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  const [products, orders, counts, byProduct, orderDays] = await Promise.all([
    db.prepare(`${PRODUCT_SELECT} WHERE p.owner_id = ? ORDER BY p.sort_order ASC, p.created_at DESC`).bind(user.id).all<ProductRow>(),
    db.prepare(`${ORDER_SELECT} WHERE o.owner_id = ? ORDER BY o.created_at DESC LIMIT 20`).bind(user.id).all<OrderRow>(),
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM page_events WHERE owner_id = ?1 AND kind = 'view') AS views,
          (SELECT COUNT(*) FROM page_events WHERE owner_id = ?1 AND kind = 'click') AS clicks,
          (SELECT COUNT(*) FROM follows WHERE owner_id = ?1) AS followers,
          (SELECT COUNT(*) FROM leads WHERE owner_id = ?1) AS leads,
          (SELECT COUNT(*) FROM orders WHERE owner_id = ?1 AND status IN ('paid','test')) AS orders,
          (SELECT COALESCE(SUM(points),0) FROM orders WHERE owner_id = ?1 AND status IN ('paid','test')) AS points,
          (SELECT COALESCE(SUM(cents),0) FROM orders WHERE owner_id = ?1 AND status IN ('paid','test')) AS cents,
          (SELECT COALESCE(SUM(amount),0) FROM points_ledger WHERE user_id = ?1 AND reason = 'affiliate') AS affiliate,
          (SELECT COUNT(*) FROM orders WHERE owner_id = ?1 AND status IN ('paid','test') AND source_link_id IS NOT NULL) AS attributed`,
      )
      .bind(user.id)
      .first<{ views: number; clicks: number; followers: number; leads: number; orders: number; points: number; cents: number; affiliate: number; attributed: number }>(),
    db
      .prepare(`SELECT p.id, p.title, COUNT(o.id) AS orders, COALESCE(SUM(o.points),0) AS points FROM products p LEFT JOIN orders o ON o.product_id = p.id AND o.status IN ('paid','test') WHERE p.owner_id = ? GROUP BY p.id ORDER BY orders DESC LIMIT 10`)
      .bind(user.id)
      .all<{ id: string; title: string; orders: number; points: number }>(),
    db.prepare("SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM orders WHERE owner_id = ? AND status IN ('paid','test') AND created_at >= ? GROUP BY d").bind(user.id, `${days[0]}T00:00:00`).all<{ d: string; n: number }>(),
  ]);
  const ordersByDay = new Map(orderDays.results.map((r) => [r.d, r.n]));
  const analytics: StudioAnalytics = {
    views: counts?.views ?? 0,
    clicks: counts?.clicks ?? 0,
    followers: counts?.followers ?? 0,
    leads: counts?.leads ?? 0,
    orders: counts?.orders ?? 0,
    pointsEarned: counts?.points ?? 0,
    centsEarned: counts?.cents ?? 0,
    affiliatePoints: counts?.affiliate ?? 0,
    attributed: counts?.attributed ?? 0,
    direct: (counts?.orders ?? 0) - (counts?.attributed ?? 0),
    byProduct: byProduct.results.map((r) => ({ productId: r.id, title: r.title, orders: r.orders, points: r.points })),
    days: days.map((d) => ({ date: d, orders: ordersByDay.get(d) ?? 0 })),
  };
  return c.json({ products: products.results.map((r) => toProduct(r)), orders: orders.results.map(toOrder), analytics, handle: user.handle, referralCode: user.referral_code });
});

// ---- products
studio.post('/products', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = (PRODUCT_KINDS as readonly string[]).includes(String(body.kind)) ? (body.kind as ProductKind) : 'digital';
  const title = str(body.title, 120);
  if (!title) return c.json({ error: 'title required' }, 400);
  const id = newId();
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO products (id, owner_id, kind, title, description, price_points, price_cents, currency, url, starts_at, duration_min, capacity, meeting_url, status, cover, sort_order, created_at, updated_at, pwyw, intake_json, replay_url, replay_points, bundle_json, locked_body, response_days, lead_magnet, certificate, buffer_min, notice_hours, max_days_ahead, period_months, min_points, badge)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, user.id, kind, title, str(body.description, 2000), int(body.pricePoints, 0) ?? 0, int(body.priceCents, 0) ?? 0, str(body.currency, 3, 'INR').toUpperCase() || 'INR',
      str(body.url, 500) || null, str(body.startsAt, 40) || null, int(body.durationMin, kind === 'session' ? 30 : null, 5, 600), int(body.capacity, null, 1),
      str(body.meetingUrl, 500) || null, body.status === 'live' ? 'live' : 'draft', str(body.cover, 8, PRODUCT_KIND_META[kind].emoji), 0, now, now,
      body.pwyw === true ? 1 : 0, JSON.stringify(list(body.intake, 8, 200)), str(body.replayUrl, 500) || null, int(body.replayPoints, 0) ?? 0, JSON.stringify(await ownedIds(db, user.id, body.bundleIds)), str(body.lockedBody, 20000), int(body.responseDays, kind === 'dm' ? 3 : null, 1, 30), body.leadMagnet === true ? 1 : 0, body.certificate === true ? 1 : 0,
      int(body.bufferMin, 0, 0, 120) ?? 0, int(body.noticeHours, 2, 0, 720) ?? 2, int(body.maxDaysAhead, 30, 1, 365) ?? 30, kind === 'membership' ? int(body.periodMonths, null, 1, 36) : null,
      int(body.minPoints, 0, 0) ?? 0, isBadgeKey(str(body.badge, 40)) ? str(body.badge, 40) : '',
    )
    .run();
  await track(db, user.id, 'product_created', { kind, pricePoints: int(body.pricePoints, 0) ?? 0 });
  const row = await ownProduct(db, user.id, id);
  return c.json({ product: row ? toProduct(row) : null }, 201);
});

studio.get('/products/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await ownProduct(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const [lessons, orders, bookings, testimonials] = await Promise.all([
    db.prepare('SELECT * FROM lessons WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC').bind(row.id).all<LessonRow>(),
    db.prepare(`${ORDER_SELECT} WHERE o.product_id = ? ORDER BY o.created_at DESC LIMIT 100`).bind(row.id).all<OrderRow>(),
    db.prepare(`${BOOKING_SELECT} WHERE k.product_id = ? ORDER BY k.starts_at DESC LIMIT 100`).bind(row.id).all<BookingRow>(),
    db.prepare(`${TESTIMONIAL_SELECT} WHERE t.product_id = ? ORDER BY t.created_at DESC`).bind(row.id).all<TestimonialRow>(),
  ]);
  return c.json({ product: toProduct(row, true), lessons: lessons.results.map((l) => toLesson(l)), orders: orders.results.map(toOrder), bookings: bookings.results.map(toBooking), testimonials: testimonials.results.map(toTestimonial) });
});

studio.patch('/products/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await ownProduct(db, user.id, c.req.param('id'));
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const status = body.status === 'live' || body.status === 'draft' || body.status === 'archived' ? body.status : prev.status;
  await db
    .prepare(
      `UPDATE products SET title = ?, description = ?, price_points = ?, price_cents = ?, currency = ?, url = ?, starts_at = ?, duration_min = ?, capacity = ?, meeting_url = ?, status = ?, cover = ?, sort_order = ?, updated_at = ?,
         pwyw = ?, intake_json = ?, replay_url = ?, replay_points = ?, bundle_json = ?, locked_body = ?, response_days = ?, lead_magnet = ?, certificate = ?, buffer_min = ?, notice_hours = ?, max_days_ahead = ?, period_months = ?, min_points = ?, badge = ? WHERE id = ?`,
    )
    .bind(
      str(body.title, 120, prev.title) || prev.title, str(body.description, 2000, prev.description), int(body.pricePoints, prev.price_points) ?? prev.price_points, int(body.priceCents, prev.price_cents) ?? prev.price_cents,
      str(body.currency, 3, prev.currency).toUpperCase() || prev.currency, 'url' in body ? str(body.url, 500) || null : prev.url, 'startsAt' in body ? str(body.startsAt, 40) || null : prev.starts_at,
      'durationMin' in body ? int(body.durationMin, prev.duration_min, 5, 600) : prev.duration_min, 'capacity' in body ? int(body.capacity, prev.capacity, 1) : prev.capacity,
      'meetingUrl' in body ? str(body.meetingUrl, 500) || null : prev.meeting_url, status, str(body.cover, 8, prev.cover) || prev.cover, int(body.sortOrder, prev.sort_order) ?? prev.sort_order, nowIso(),
      typeof body.pwyw === 'boolean' ? (body.pwyw ? 1 : 0) : prev.pwyw, 'intake' in body ? JSON.stringify(list(body.intake, 8, 200)) : prev.intake_json, 'replayUrl' in body ? str(body.replayUrl, 500) || null : prev.replay_url, int(body.replayPoints, prev.replay_points) ?? prev.replay_points,
      'bundleIds' in body ? JSON.stringify(await ownedIds(db, user.id, body.bundleIds)) : prev.bundle_json, 'lockedBody' in body ? str(body.lockedBody, 20000) : prev.locked_body, 'responseDays' in body ? int(body.responseDays, prev.response_days, 1, 30) : prev.response_days,
      typeof body.leadMagnet === 'boolean' ? (body.leadMagnet ? 1 : 0) : prev.lead_magnet, typeof body.certificate === 'boolean' ? (body.certificate ? 1 : 0) : prev.certificate,
      int(body.bufferMin, prev.buffer_min, 0, 120) ?? prev.buffer_min, int(body.noticeHours, prev.notice_hours, 0, 720) ?? prev.notice_hours, int(body.maxDaysAhead, prev.max_days_ahead, 1, 365) ?? prev.max_days_ahead, 'periodMonths' in body ? int(body.periodMonths, prev.period_months, 1, 36) : prev.period_months,
      'minPoints' in body ? (int(body.minPoints, prev.min_points, 0) ?? prev.min_points) : prev.min_points, 'badge' in body ? (isBadgeKey(str(body.badge, 40)) ? str(body.badge, 40) : '') : prev.badge, prev.id,
    )
    .run();
  const row = await ownProduct(db, user.id, prev.id);
  return c.json({ product: row ? toProduct(row, true) : null });
});

studio.delete('/products/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM products WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (res.meta.changes === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- lessons
studio.post('/products/:id/lessons', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const product = await ownProduct(db, user.id, c.req.param('id'));
  if (!product) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 140);
  if (!title) return c.json({ error: 'title required' }, 400);
  const next = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM lessons WHERE product_id = ?').bind(product.id).first<{ n: number }>();
  const id = newId();
  await db.prepare('INSERT INTO lessons (id, product_id, title, body, video_url, sort_order, drip_days, created_at, quiz_json, pass_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, product.id, title, str(body.body, 20000), str(body.videoUrl, 500) || null, next?.n ?? 0, int(body.dripDays, 0, 0, 365) ?? 0, nowIso(), JSON.stringify(cleanQuiz(body.quiz)), int(body.passScore, 0, 0, 100) ?? 0)
    .run();
  const row = await db.prepare('SELECT * FROM lessons WHERE id = ?').bind(id).first<LessonRow>();
  return c.json({ lesson: row ? toLesson(row) : null }, 201);
});

studio.patch('/lessons/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare('SELECT l.* FROM lessons l JOIN products p ON p.id = l.product_id WHERE l.id = ? AND p.owner_id = ?').bind(c.req.param('id'), user.id).first<LessonRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  await db.prepare('UPDATE lessons SET title = ?, body = ?, video_url = ?, sort_order = ?, drip_days = ?, quiz_json = ?, pass_score = ? WHERE id = ?')
    .bind(str(body.title, 140, prev.title) || prev.title, str(body.body, 20000, prev.body), 'videoUrl' in body ? str(body.videoUrl, 500) || null : prev.video_url, int(body.sortOrder, prev.sort_order) ?? prev.sort_order, int(body.dripDays, prev.drip_days, 0, 365) ?? prev.drip_days, 'quiz' in body ? JSON.stringify(cleanQuiz(body.quiz)) : prev.quiz_json, int(body.passScore, prev.pass_score, 0, 100) ?? prev.pass_score, prev.id)
    .run();
  const row = await db.prepare('SELECT * FROM lessons WHERE id = ?').bind(prev.id).first<LessonRow>();
  return c.json({ lesson: row ? toLesson(row) : null });
});

studio.delete('/lessons/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM lessons WHERE id = ? AND product_id IN (SELECT id FROM products WHERE owner_id = ?)').bind(c.req.param('id'), c.get('user').id).run();
  if (res.meta.changes === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- coupons
interface CouponRow { id: string; code: string; percent_off: number; product_id: string | null; max_uses: number | null; uses: number; expires_at: string | null }
const toCoupon = (r: CouponRow): Coupon => ({ id: r.id, code: r.code, percentOff: r.percent_off, productId: r.product_id, maxUses: r.max_uses, uses: r.uses, expiresAt: r.expires_at });

studio.get('/coupons', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM coupons WHERE owner_id = ? ORDER BY created_at DESC').bind(c.get('user').id).all<CouponRow>();
  return c.json({ coupons: rows.results.map(toCoupon) });
});

studio.post('/coupons', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const code = str(body.code, 24).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const percent = int(body.percentOff, 10, 1, 100) ?? 10;
  if (!code) return c.json({ error: 'code required' }, 400);
  const id = newId();
  try {
    await db.prepare('INSERT INTO coupons (id, owner_id, code, percent_off, product_id, max_uses, uses, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .bind(id, user.id, code, percent, str(body.productId, 64) || null, int(body.maxUses, null, 1), str(body.expiresAt, 40) || null, nowIso())
      .run();
  } catch {
    return c.json({ error: 'you already have a coupon with that code' }, 409);
  }
  const row = await db.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first<CouponRow>();
  return c.json({ coupon: row ? toCoupon(row) : null }, 201);
});

studio.delete('/coupons/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM coupons WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// ---- availability (for session products)
interface AvailRow { id: string; weekday: number; start_min: number; end_min: number }
const toAvail = (r: AvailRow): Availability => ({ id: r.id, weekday: r.weekday, startMin: r.start_min, endMin: r.end_min });

studio.get('/availability', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM availability WHERE owner_id = ? ORDER BY weekday, start_min').bind(c.get('user').id).all<AvailRow>();
  return c.json({ availability: rows.results.map(toAvail) });
});

studio.post('/availability', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const weekday = int(body.weekday, null, 0, 6);
  const startMin = int(body.startMin, null, 0, 1439);
  const endMin = int(body.endMin, null, 1, 1440);
  if (weekday === null || startMin === null || endMin === null || endMin <= startMin) return c.json({ error: 'give a weekday and a start before the end' }, 400);
  const id = newId();
  await c.env.DB.prepare('INSERT INTO availability (id, owner_id, weekday, start_min, end_min) VALUES (?, ?, ?, ?, ?)').bind(id, c.get('user').id, weekday, startMin, endMin).run();
  return c.json({ availability: { id, weekday, startMin, endMin } satisfies Availability }, 201);
});

// Date overrides: block a day, or give it its own hours. An empty list of ranges blocks the whole day.
interface OverrideRow { id: string; date: string; ranges_json: string }
const toOverride = (r: OverrideRow): AvailabilityOverride => {
  let ranges: { startMin: number; endMin: number }[] = [];
  try {
    const v = JSON.parse(r.ranges_json || '[]') as unknown;
    if (Array.isArray(v)) ranges = v.filter((x): x is { startMin: number; endMin: number } => Boolean(x && typeof x === 'object' && 'startMin' in x && 'endMin' in x));
  } catch {
    ranges = [];
  }
  return { id: r.id, date: r.date, ranges };
};

studio.get('/availability/overrides', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM availability_overrides WHERE owner_id = ? AND date >= ? ORDER BY date').bind(c.get('user').id, new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)).all<OverrideRow>();
  return c.json({ overrides: rows.results.map(toOverride) });
});

studio.put('/availability/overrides/:date', async (c) => {
  const date = c.req.param('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'date as YYYY-MM-DD' }, 400);
  const body = await c.req.json<{ ranges?: unknown }>().catch(() => ({}) as { ranges?: unknown });
  const ranges = (Array.isArray(body.ranges) ? body.ranges : [])
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ startMin: int(x.startMin, 0, 0, 1439) ?? 0, endMin: int(x.endMin, 0, 1, 1440) ?? 0 }))
    .filter((x) => x.endMin > x.startMin)
    .slice(0, 6);
  await c.env.DB.prepare('INSERT OR REPLACE INTO availability_overrides (id, owner_id, date, ranges_json) VALUES (COALESCE((SELECT id FROM availability_overrides WHERE owner_id = ?1 AND date = ?2), ?3), ?1, ?2, ?4)').bind(c.get('user').id, date, newId(), JSON.stringify(ranges)).run();
  return c.json({ override: { id: date, date, ranges } satisfies AvailabilityOverride });
});

studio.delete('/availability/overrides/:date', async (c) => {
  await c.env.DB.prepare('DELETE FROM availability_overrides WHERE owner_id = ? AND date = ?').bind(c.get('user').id, c.req.param('date')).run();
  return c.json({ ok: true });
});

// Sales: every order, filterable, as JSON or a CSV file.
studio.get('/orders', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const status = c.req.query('status') ?? '';
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  const where = [`o.owner_id = ?`];
  const binds: unknown[] = [user.id];
  if (status) {
    where.push('o.status = ?');
    binds.push(status);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push('o.created_at >= ?');
    binds.push(`${from}T00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push('o.created_at <= ?');
    binds.push(`${to}T23:59:59`);
  }
  const rows = await db.prepare(`${ORDER_SELECT} WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT 1000`).bind(...binds).all<OrderRow>();
  const orders = rows.results.map(toOrder);
  if (c.req.query('format') === 'csv') {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['order_id,date,product,kind,buyer,status,points,cents,currency,provider,coupon,affiliate,source,fee_points', ...orders.map((o) => [o.id, o.createdAt, o.productTitle, o.productKind, o.buyerName, o.status, o.points, o.cents, o.currency, o.provider, o.couponCode, o.affiliateCode, o.sourceLabel, o.platformFeePoints].map(esc).join(','))].join('\n');
    return c.body(csv, 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="sales.csv"' });
  }
  return c.json({ orders });
});

studio.delete('/availability/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM availability WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// ---- bookings (owner side)
studio.get('/bookings', async (c) => {
  const rows = await c.env.DB.prepare(`${BOOKING_SELECT} WHERE k.owner_id = ? ORDER BY k.starts_at DESC LIMIT 200`).bind(c.get('user').id).all<BookingRow>();
  return c.json({ bookings: rows.results.map(toBooking) });
});

studio.post('/bookings/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare(`${BOOKING_SELECT} WHERE k.id = ? AND k.owner_id = ?`).bind(c.req.param('id'), user.id).first<BookingRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string; meetingUrl?: string }>().catch(() => ({}) as { status?: string; meetingUrl?: string });
  const status = body.status === 'confirmed' || body.status === 'cancelled' || body.status === 'done' ? body.status : prev.status;
  const meetingUrl = typeof body.meetingUrl === 'string' ? body.meetingUrl.trim().slice(0, 500) || null : prev.meeting_url;
  await db.prepare('UPDATE bookings SET status = ?, meeting_url = ? WHERE id = ?').bind(status, meetingUrl, prev.id).run();
  if (status !== prev.status) {
    const when = new Date(prev.starts_at).toUTCString();
    await notify(db, prev.buyer_id, 'booking', status === 'confirmed' ? `Your session with ${nameOf(user)} is confirmed` : status === 'cancelled' ? `Your session with ${nameOf(user)} was cancelled` : `Session marked done`, when, '/library');
    await logEvent(db, 'booking', prev.id, `booking.${status}`);
    if (status === 'confirmed') {
      await track(db, user.id, 'booking_confirmed', { leadTimeHours: Math.round((new Date(prev.starts_at).getTime() - Date.now()) / 3600_000) });
      const buyer = await db.prepare('SELECT email FROM users WHERE id = ?').bind(prev.buyer_id).first<{ email: string | null }>();
      await sendEmail(db, c.env, { userId: prev.buyer_id, to: buyer?.email, subject: `Confirmed: ${prev.product_title} with ${nameOf(user)}`, body: `${when}${meetingUrl ? `\nJoin: ${meetingUrl}` : ''}\n\nManage it under My purchases.` });
    }
  }
  const row = await db.prepare(`${BOOKING_SELECT} WHERE k.id = ?`).bind(prev.id).first<BookingRow>();
  return c.json({ booking: row ? toBooking(row) : null });
});

// ---- leads, testimonials, broadcasts, audience
interface LeadRow { id: string; name: string; email: string; message: string; source: string; created_at: string }
studio.get('/leads', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM leads WHERE owner_id = ? ORDER BY created_at DESC LIMIT 300').bind(c.get('user').id).all<LeadRow>();
  const leads: Lead[] = rows.results.map((r) => ({ id: r.id, name: r.name, email: r.email, message: r.message, source: r.source, createdAt: r.created_at }));
  return c.json({ leads });
});

studio.get('/testimonials', async (c) => {
  const rows = await c.env.DB.prepare(`${TESTIMONIAL_SELECT} WHERE t.owner_id = ? ORDER BY t.created_at DESC LIMIT 200`).bind(c.get('user').id).all<TestimonialRow>();
  return c.json({ testimonials: rows.results.map(toTestimonial) });
});

studio.post('/testimonials/:id', async (c) => {
  const body = await c.req.json<{ approved?: boolean }>().catch(() => ({}) as { approved?: boolean });
  await c.env.DB.prepare('UPDATE testimonials SET approved = ? WHERE id = ? AND owner_id = ?').bind(body.approved ? 1 : 0, c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

studio.post('/broadcasts', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ title?: string; body?: string; audience?: string }>().catch(() => ({}) as Record<string, never>);
  const title = str(body.title, 120);
  const text = str(body.body, 2000);
  if (!title || !text) return c.json({ error: 'title and message required' }, 400);
  const audience = body.audience === 'buyers' ? 'buyers' : 'followers';
  const people = audience === 'buyers'
    ? await db.prepare("SELECT DISTINCT buyer_id AS id FROM orders WHERE owner_id = ? AND status IN ('paid','test')").bind(user.id).all<{ id: string }>()
    : await db.prepare('SELECT follower_id AS id FROM follows WHERE owner_id = ?').bind(user.id).all<{ id: string }>();
  const id = newId();
  const now = nowIso();
  const link = user.handle ? `/u/${user.handle}` : null;
  await db.batch([
    db.prepare('INSERT INTO broadcasts (id, owner_id, title, body, audience, sent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, title, text, audience, people.results.length, now),
    ...people.results.map((p) =>
      db.prepare('INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)').bind(newId(), p.id, 'broadcast', `${nameOf(user)}: ${title}`, text.slice(0, 300), link, now),
    ),
  ]);
  return c.json({ sent: people.results.length }, 201);
});

studio.get('/audience', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const [followers, broadcasts, affiliates] = await Promise.all([
    db.prepare('SELECT u.display_name AS name, u.handle, f.created_at FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.owner_id = ? ORDER BY f.created_at DESC LIMIT 200').bind(user.id).all<{ name: string; handle: string | null; created_at: string }>(),
    db.prepare('SELECT id, title, body, audience, sent, created_at FROM broadcasts WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all<{ id: string; title: string; body: string; audience: string; sent: number; created_at: string }>(),
    db.prepare("SELECT COUNT(*) AS referred FROM users WHERE referred_by = ?").bind(user.referral_code ?? '').first<{ referred: number }>(),
  ]);
  return c.json({
    followers: followers.results.map((f) => ({ name: nameOf({ display_name: f.name }), handle: f.handle, since: f.created_at })),
    broadcasts: broadcasts.results.map((b) => ({ id: b.id, title: b.title, body: b.body, audience: b.audience, sent: b.sent, createdAt: b.created_at })),
    referralCode: user.referral_code,
    referred: affiliates?.referred ?? 0,
    affiliateShare: AFFILIATE_SHARE,
  });
});
