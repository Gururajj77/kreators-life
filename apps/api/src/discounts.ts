import { discountCodeKey, discountLabel, discountProblem, DISCOUNT_AREAS, isPaidPlan, PLAN_CURRENCY, PLANS, priceWithDiscount, TOPUP_PACKS, type DiscountArea, type DiscountCheck, type DiscountQuote, type DiscountRule, type AdminDiscountCode } from '@kreators/shared';
import { inBatches, newId, nowIso } from './db';
import { openTurn, type Turn } from './cronTick';

/**
 * Discount codes the team makes. This file is the one rule for every checkout: it finds a typed code, works out the price on the
 * SERVER from the item's own price (a price a browser sends is never read), redeems with guarded statements, and gives a use back
 * when a payment fails or never finishes. A refund does not give the use back: the person got the thing and has it refunded.
 *
 * Who pays: the platform. The buyer is charged less; the seller is still credited, and refunded, on the list price.
 */

export interface CodeRow {
  id: string;
  code: string;
  kind: 'percent' | 'fixed';
  percent_bps: number;
  amount_cents: number;
  currency: string;
  applies_to: string;
  item_id: string | null;
  min_cents: number;
  max_uses: number | null;
  used_count: number;
  per_person_limit: number;
  starts_at: string | null;
  ends_at: string | null;
  active: number;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** The areas stored on a code, cleaned against the list we know. */
export function areasOf(raw: string): DiscountArea[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? DISCOUNT_AREAS.filter((a) => v.includes(a)) : [];
  } catch {
    return [];
  }
}

export const ruleOf = (r: CodeRow): DiscountRule => ({
  kind: r.kind,
  percentBps: r.percent_bps,
  amountCents: r.amount_cents,
  currency: r.currency,
  areas: areasOf(r.applies_to),
  itemId: r.item_id,
  minCents: r.min_cents,
  maxUses: r.max_uses,
  usedCount: r.used_count,
  perPersonLimit: r.per_person_limit,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  active: r.active === 1,
});

export interface AdminCodeRow extends CodeRow {
  redeemed: number;
  given_cents: number;
  given_points: number;
}
export const toAdminCode = (r: AdminCodeRow): AdminDiscountCode => ({ ...ruleOf(r), id: r.id, code: r.code, note: r.note, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at, redeemed: r.redeemed, givenCents: r.given_cents, givenPoints: r.given_points });

/** The code a person typed, or null when the text is not a usable code or no code has that word. */
export async function findCode(db: D1Database, typed: unknown): Promise<CodeRow | null> {
  const key = discountCodeKey(typed);
  if (!key) return null;
  return db.prepare('SELECT * FROM discount_codes WHERE code = ?').bind(key).first<CodeRow>();
}

/** What an item costs before any code, read from the item itself. null when there is no such item to buy. */
export interface ListPrice {
  cents: number;
  points: number;
  currency: string;
  /**
   * Pay what you want: the product's own minimum in points. A code takes its percent off this, never off what the buyer typed,
   * so the platform pays at most the real price and a big offer with a 100% code cannot make points out of nothing.
   */
  basePoints?: number;
}
export async function listPriceFor(db: D1Database, area: DiscountArea, itemId: string, offeredPoints?: number): Promise<ListPrice | null> {
  if (area === 'plan') return isPaidPlan(itemId) ? { cents: PLANS[itemId].priceCents, points: 0, currency: PLAN_CURRENCY } : null;
  if (area === 'topup') {
    const pack = TOPUP_PACKS.find((t) => t.key === itemId);
    return pack ? { cents: pack.priceCents, points: 0, currency: PLAN_CURRENCY } : null;
  }
  if (area === 'product') {
    const p = await db.prepare("SELECT price_points, price_cents, currency, pwyw FROM products WHERE id = ? AND status = 'live'").bind(itemId).first<{ price_points: number; price_cents: number; currency: string; pwyw: number }>();
    if (!p) return null;
    if (p.pwyw !== 1) return { cents: p.price_cents, points: p.price_points, currency: p.currency };
    const points = Math.min(1_000_000, Math.max(p.price_points, Math.round(Number(offeredPoints)) || 0));
    return { cents: p.price_cents, points, currency: p.currency, basePoints: p.price_points };
  }
  if (area === 'program') {
    const p = await db.prepare('SELECT price_points, price_cents, currency FROM programs WHERE id = ? AND published = 1').bind(itemId).first<{ price_points: number; price_cents: number; currency: string }>();
    return p ? { cents: p.price_cents, points: p.price_points, currency: p.currency } : null;
  }
  const e = await db.prepare("SELECT price_points FROM events WHERE id = ? AND status = 'published'").bind(itemId).first<{ price_points: number }>();
  return e ? { cents: 0, points: e.price_points, currency: 'INR' } : null;
}

export type Quoted = { ok: true; row: CodeRow; list: ListPrice; quote: DiscountQuote; area: DiscountArea; itemId: string } | { ok: false; why: string };

/** What a code comes to on a list price. On pay what you want the amount off is worked out on the minimum, and the buyer pays their offer less that. */
export function quoteFor(list: ListPrice, rule: DiscountRule): DiscountQuote {
  if (list.basePoints === undefined) return priceWithDiscount(list, rule);
  const base = Math.min(list.points, Math.max(0, list.basePoints));
  const q = priceWithDiscount({ cents: list.cents, points: base }, rule);
  return { ...q, payPoints: Math.max(0, list.points - q.offPoints) };
}

/** The same line for a word no code has and for text that cannot be a code. */
export const NO_SUCH_CODE = 'That code does not work.';

/** Does this code work on this item for this person, and what does it come to? Reads only; nothing is used up. */
export async function quoteCode(db: D1Database, userId: string, typed: unknown, area: DiscountArea, itemId: string, list: ListPrice): Promise<Quoted> {
  const row = await findCode(db, typed);
  if (!row) return { ok: false, why: NO_SUCH_CODE };
  const used = await db.prepare('SELECT COUNT(*) AS n FROM discount_redemptions WHERE code_id = ? AND user_id = ? AND released_at IS NULL').bind(row.id, userId).first<{ n: number }>();
  const why = discountProblem(ruleOf(row), { area, itemId, cents: list.cents, points: list.points, currency: list.currency, now: nowIso(), usedByPerson: used?.n ?? 0 });
  if (why) return { ok: false, why };
  return { ok: true, row, list, quote: quoteFor(list, ruleOf(row)), area, itemId };
}

/** The quote as the browser reads it. */
export function checkOf(q: Extract<Quoted, { ok: true }>): DiscountCheck {
  return {
    ok: true,
    code: q.row.code,
    label: discountLabel(ruleOf(q.row)),
    area: q.area,
    itemId: q.itemId,
    currency: q.list.currency,
    listCents: q.list.cents,
    listPoints: q.list.points,
    offCents: q.quote.offCents,
    offPoints: q.quote.offPoints,
    payCents: q.quote.payCents,
    payPoints: q.quote.payPoints,
  };
}

/**
 * Takes one use of a code for one order, enrolment or registration. Two guarded statements, so two taps cannot both take the last
 * use or a second use by the same person:
 *   1. used_count goes up only while the code is on, inside its dates, and under max_uses;
 *   2. the redemption row is written only while this person is under the per-person limit, and (code, ref) is unique, so a retry of
 *      the same order cannot redeem twice.
 * If the second fails the first is undone. Returns a plain reason, or null when the use is taken.
 */
export async function redeem(db: D1Database, r: { row: CodeRow; userId: string; area: DiscountArea; itemId: string; ref: string; offCents: number; offPoints: number; currency: string }): Promise<string | null> {
  const now = nowIso();
  const taken = await db
    .prepare('UPDATE discount_codes SET used_count = used_count + 1 WHERE id = ? AND active = 1 AND (max_uses IS NULL OR used_count < max_uses) AND (starts_at IS NULL OR starts_at <= ?2) AND (ends_at IS NULL OR ends_at > ?2)')
    .bind(r.row.id, now)
    .run();
  if (taken.meta.changes !== 1) return 'That code has just been used up or has ended.';
  const undo = () => db.prepare('UPDATE discount_codes SET used_count = MAX(0, used_count - 1) WHERE id = ?').bind(r.row.id).run();
  try {
    const wrote = await db
      .prepare(
        `INSERT INTO discount_redemptions (id, code_id, user_id, area, ref, item_id, off_cents, off_points, currency, released_at, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL, ?10
         WHERE (SELECT COUNT(*) FROM discount_redemptions WHERE code_id = ?2 AND user_id = ?3 AND released_at IS NULL) < ?11`,
      )
      .bind(newId(), r.row.id, r.userId, r.area, r.ref, r.itemId, r.offCents, r.offPoints, r.currency, now, Math.max(1, r.row.per_person_limit))
      .run();
    if (wrote.meta.changes !== 1) {
      await undo();
      return r.row.per_person_limit <= 1 ? 'You already used that code.' : 'You used that code as many times as it allows.';
    }
  } catch {
    // The same code on the same order twice (a retry): the first one stands.
    await undo();
    return 'That code is already on this order.';
  }
  return null;
}

/** The two go in one batch: the flip, then the count, which moves only when that flip changed a row. So two calls give back one use, and a stop between them cannot lose it. */
const releaseStmts = (db: D1Database, r: { id: string; code_id: string }): D1PreparedStatement[] => [
  db.prepare('UPDATE discount_redemptions SET released_at = ? WHERE id = ? AND released_at IS NULL').bind(nowIso(), r.id),
  db.prepare('UPDATE discount_codes SET used_count = MAX(0, used_count - 1) WHERE id = ? AND changes() = 1').bind(r.code_id),
];

/** Gives back the use a payment that failed, expired or could not start had taken. Safe to call twice. */
export async function release(db: D1Database, ref: string): Promise<void> {
  const open = await db.prepare('SELECT id, code_id FROM discount_redemptions WHERE ref = ? AND released_at IS NULL').bind(ref).all<{ id: string; code_id: string }>();
  await inBatches(db, open.results.flatMap((r) => releaseStmts(db, r)));
}

/** The cron's sweep: every use held by an order that failed or expired is given back. */
export async function releaseDeadOrders(db: D1Database, turn: Turn = openTurn(db)): Promise<number> {
  const dead = await db.prepare("SELECT r.id, r.code_id FROM discount_redemptions r JOIN orders o ON o.id = r.ref WHERE r.released_at IS NULL AND o.status IN ('failed', 'expired') LIMIT 200").all<{ id: string; code_id: string }>();
  if (!dead.results.length) return 0;
  const share = await turn();
  return (await share.send(share.fit(dead.results, 2).flatMap((r) => releaseStmts(db, r)))).filter((res, i) => i % 2 === 0 && res.meta.changes === 1).length;
}
