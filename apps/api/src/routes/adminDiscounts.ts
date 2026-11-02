import { Hono } from 'hono';
import { DISCOUNT_AREAS, DISCOUNT_CODE_MAX, DISCOUNT_CODE_MIN, DISCOUNT_PER_PERSON_MAX, discountCodeKey, isDiscountArea, typedCents, typedPercentBps, type AdminDiscountCode, type DiscountArea } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { audit, can, newId, nowIso, pageOf, paged, randomCode, str } from '../db';
import { areasOf, toAdminCode, type AdminCodeRow, type CodeRow } from '../discounts';

/**
 * The team's discount codes. Mounted at /admin/discounts, so the admin check in admin.ts has already run. On top of that a signed-in
 * person needs the finance permission (an admin holds it). Every create, edit and switch-off is audited.
 */
export const adminDiscounts = new Hono<AppEnv>();

const actorOf = (c: { get: (k: 'user') => UserRow | undefined }) => c.get('user')?.id ?? null;
const mayManage = (c: { get: (k: 'user') => UserRow | undefined }): boolean => {
  const u = c.get('user');
  return !u || can(u, 'finance');
};

const SELECT = `SELECT d.*,
  (SELECT COUNT(*) FROM discount_redemptions r WHERE r.code_id = d.id AND r.released_at IS NULL) AS redeemed,
  (SELECT COALESCE(SUM(r.off_cents), 0) FROM discount_redemptions r WHERE r.code_id = d.id AND r.released_at IS NULL) AS given_cents,
  (SELECT COALESCE(SUM(r.off_points), 0) FROM discount_redemptions r WHERE r.code_id = d.id AND r.released_at IS NULL) AS given_points
  FROM discount_codes d`;

adminDiscounts.get('/', async (c) => {
  if (!mayManage(c)) return c.json({ error: 'the finance permission manages discount codes' }, 403);
  const db = c.env.DB;
  const q = (c.req.query('q') ?? '').trim().slice(0, 60);
  const active = c.req.query('active');
  const area = c.req.query('area') ?? '';
  const where: string[] = [];
  const binds: unknown[] = [];
  if (q) {
    where.push('(d.code LIKE ? OR d.note LIKE ?)');
    binds.push(`%${q.replace(/[%_]/g, '')}%`, `%${q.replace(/[%_]/g, '')}%`);
  }
  if (active === '1' || active === '0') {
    where.push('d.active = ?');
    binds.push(Number(active));
  }
  if (isDiscountArea(area)) {
    where.push('d.applies_to LIKE ?');
    binds.push(`%"${area}"%`);
  }
  const ask = pageOf(c);
  const [rows, totals, money] = await Promise.all([
    db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY d.created_at DESC, d.id DESC LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<AdminCodeRow>(),
    db.prepare('SELECT (SELECT COUNT(*) FROM discount_codes) AS codes, (SELECT COUNT(*) FROM discount_codes WHERE active = 1) AS live, (SELECT COUNT(*) FROM discount_redemptions WHERE released_at IS NULL) AS redemptions, (SELECT COALESCE(SUM(off_points), 0) FROM discount_redemptions WHERE released_at IS NULL) AS points').first<{ codes: number; live: number; redemptions: number; points: number }>(),
    db.prepare('SELECT currency, SUM(off_cents) AS cents FROM discount_redemptions WHERE released_at IS NULL AND off_cents > 0 GROUP BY currency ORDER BY currency').all<{ currency: string; cents: number }>(),
  ]);
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, codes: pg.items.map(toAdminCode), totals: { codes: totals?.codes ?? 0, live: totals?.live ?? 0, redemptions: totals?.redemptions ?? 0, givenPoints: totals?.points ?? 0, givenCents: money.results.map((m) => ({ currency: m.currency, cents: m.cents })) } });
});

function isoOrNull(v: unknown): string | null | undefined {
  if (v === null || v === '' || v === undefined) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

const wholeOrNull = (v: unknown, lo: number, hi: number): number | null | undefined => {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : undefined;
};

adminDiscounts.post('/', async (c) => {
  if (!mayManage(c)) return c.json({ error: 'the finance permission manages discount codes' }, 403);
  const db = c.env.DB;
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const typedCode = str(b.code, 60);
  const random = !typedCode;
  const key = random ? randomCode(8) : discountCodeKey(typedCode);
  if (!key) return c.json({ error: `A code is ${DISCOUNT_CODE_MIN} to ${DISCOUNT_CODE_MAX} letters, numbers or dashes.` }, 400);
  const kind = b.kind === 'fixed' ? 'fixed' : b.kind === 'percent' ? 'percent' : null;
  if (!kind) return c.json({ error: 'Pick a percent or a fixed amount.' }, 400);
  let percentBps = 0;
  let amountCents = 0;
  if (kind === 'percent') {
    percentBps = typedPercentBps(b.percent as string | number);
    if (Number.isNaN(percentBps)) return c.json({ error: 'A percent is from 0.01 to 100.' }, 400);
  } else {
    amountCents = typedCents(b.amount as string | number);
    if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > 1_000_000_000) return c.json({ error: 'Type an amount above zero.' }, 400);
  }
  const currency = /^[A-Za-z]{3}$/.test(String(b.currency ?? '')) ? String(b.currency).toUpperCase() : 'INR';
  const areas = DISCOUNT_AREAS.filter((a) => Array.isArray(b.areas) && (b.areas as unknown[]).includes(a));
  if (areas.length === 0) return c.json({ error: 'Pick at least one place the code works.' }, 400);
  if (kind === 'fixed' && areas.every((a) => a === 'event')) return c.json({ error: 'Party tickets cost points, so a fixed amount of money cannot be taken off them. Use a percent.' }, 400);
  const itemId = str(b.itemId, 80) || null;
  if (itemId && areas.length !== 1) return c.json({ error: 'Pick one place when the code is for one item.' }, 400);
  const minCents = b.minAmount === undefined || b.minAmount === '' ? 0 : typedCents(b.minAmount as string | number);
  if (!Number.isInteger(minCents) || minCents < 0 || minCents > 1_000_000_000) return c.json({ error: 'The least price is an amount, or empty.' }, 400);
  const maxUses = wholeOrNull(b.maxUses, 1, 1_000_000);
  if (maxUses === undefined) return c.json({ error: 'Uses is a whole number from 1, or empty for no limit.' }, 400);
  const perPerson = wholeOrNull(b.perPersonLimit, 1, DISCOUNT_PER_PERSON_MAX);
  if (perPerson === undefined) return c.json({ error: `Uses per person is from 1 to ${DISCOUNT_PER_PERSON_MAX}.` }, 400);
  const startsAt = isoOrNull(b.startsAt);
  const endsAt = isoOrNull(b.endsAt);
  if (startsAt === undefined || endsAt === undefined) return c.json({ error: 'A start or end is a date and time.' }, 400);
  if (startsAt && endsAt && endsAt <= startsAt) return c.json({ error: 'The end must come after the start.' }, 400);
  const id = newId();
  const now = nowIso();
  try {
    await db
      .prepare('INSERT INTO discount_codes (id, code, kind, percent_bps, amount_cents, currency, applies_to, item_id, min_cents, max_uses, used_count, per_person_limit, starts_at, ends_at, active, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?, ?, ?, ?)')
      .bind(id, key, kind, percentBps, amountCents, currency, JSON.stringify(areas), itemId, minCents, maxUses, perPerson ?? 1, startsAt, endsAt, str(b.note, 200), actorOf(c), now, now)
      .run();
  } catch {
    return c.json({ error: random ? 'Could not make a code just now. Try again.' : 'A code with that word already exists.' }, 409);
  }
  await audit(db, actorOf(c), 'discount.create', 'discount_code', id, '', { code: key, kind, percentBps, amountCents, areas, itemId });
  const row = await db.prepare(`${SELECT} WHERE d.id = ?`).bind(id).first<AdminCodeRow>();
  return c.json({ code: row ? toAdminCode(row) : null }, 201);
});

/** What may change after a code is made. Its word, its kind and its worth are fixed: a different deal is a new code. */
adminDiscounts.patch('/:id', async (c) => {
  if (!mayManage(c)) return c.json({ error: 'the finance permission manages discount codes' }, 403);
  const db = c.env.DB;
  const prev = await db.prepare('SELECT * FROM discount_codes WHERE id = ?').bind(c.req.param('id')).first<CodeRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const sets: string[] = [];
  const binds: unknown[] = [];
  const changed: Record<string, unknown> = {};
  if ('note' in b) {
    sets.push('note = ?');
    binds.push(str(b.note, 200));
    changed.note = str(b.note, 200);
  }
  if ('active' in b) {
    sets.push('active = ?');
    binds.push(b.active === true || b.active === 1 ? 1 : 0);
    changed.active = b.active === true || b.active === 1;
  }
  if ('startsAt' in b) {
    const v = isoOrNull(b.startsAt);
    if (v === undefined) return c.json({ error: 'A start is a date and time.' }, 400);
    sets.push('starts_at = ?');
    binds.push(v);
    changed.startsAt = v;
  }
  if ('endsAt' in b) {
    const v = isoOrNull(b.endsAt);
    if (v === undefined) return c.json({ error: 'An end is a date and time.' }, 400);
    sets.push('ends_at = ?');
    binds.push(v);
    changed.endsAt = v;
  }
  if ('maxUses' in b) {
    const v = wholeOrNull(b.maxUses, 1, 1_000_000);
    if (v === undefined) return c.json({ error: 'Uses is a whole number from 1, or empty for no limit.' }, 400);
    sets.push('max_uses = ?');
    binds.push(v);
    changed.maxUses = v;
  }
  if ('perPersonLimit' in b) {
    const v = wholeOrNull(b.perPersonLimit, 1, DISCOUNT_PER_PERSON_MAX);
    if (v === undefined || v === null) return c.json({ error: `Uses per person is from 1 to ${DISCOUNT_PER_PERSON_MAX}.` }, 400);
    sets.push('per_person_limit = ?');
    binds.push(v);
    changed.perPersonLimit = v;
  }
  if ('minAmount' in b) {
    const v = b.minAmount === '' || b.minAmount === null ? 0 : typedCents(b.minAmount as string | number);
    if (!Number.isInteger(v) || v < 0 || v > 1_000_000_000) return c.json({ error: 'The least price is an amount, or empty.' }, 400);
    sets.push('min_cents = ?');
    binds.push(v);
    changed.minCents = v;
  }
  if ('areas' in b) {
    const list: DiscountArea[] = DISCOUNT_AREAS.filter((a) => Array.isArray(b.areas) && (b.areas as unknown[]).includes(a));
    if (list.length === 0) return c.json({ error: 'Pick at least one place the code works.' }, 400);
    if (prev.kind === 'fixed' && list.every((a) => a === 'event')) return c.json({ error: 'A fixed amount of money cannot be taken off Party tickets, which cost points.' }, 400);
    const item = 'itemId' in b ? str(b.itemId, 80) || null : prev.item_id;
    if (item && list.length !== 1) return c.json({ error: 'Pick one place when the code is for one item.' }, 400);
    sets.push('applies_to = ?');
    binds.push(JSON.stringify(list));
    changed.areas = list;
  }
  if ('itemId' in b) {
    const item = str(b.itemId, 80) || null;
    const list = 'areas' in b ? (changed.areas as DiscountArea[]) : areasOf(prev.applies_to);
    if (item && list.length !== 1) return c.json({ error: 'Pick one place when the code is for one item.' }, 400);
    sets.push('item_id = ?');
    binds.push(item);
    changed.itemId = item;
  }
  if (sets.length === 0) return c.json({ error: 'nothing to change' }, 400);
  const startsAfter = 'startsAt' in changed ? (changed.startsAt as string | null) : prev.starts_at;
  const endsAfter = 'endsAt' in changed ? (changed.endsAt as string | null) : prev.ends_at;
  if (startsAfter && endsAfter && endsAfter <= startsAfter) return c.json({ error: 'The end must come after the start.' }, 400);
  sets.push('updated_at = ?');
  binds.push(nowIso());
  await db.prepare(`UPDATE discount_codes SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, prev.id).run();
  const switchedOff = 'active' in changed && changed.active === false && prev.active === 1;
  await audit(db, actorOf(c), switchedOff ? 'discount.off' : 'discount.update', 'discount_code', prev.id, { code: prev.code, active: prev.active === 1, note: prev.note, endsAt: prev.ends_at }, changed);
  const row = await db.prepare(`${SELECT} WHERE d.id = ?`).bind(prev.id).first<AdminCodeRow>();
  return c.json({ code: row ? toAdminCode(row) : null });
});

/** Switch several codes on or off at once (the table's bulk action). */
adminDiscounts.post('/bulk', async (c) => {
  if (!mayManage(c)) return c.json({ error: 'the finance permission manages discount codes' }, 403);
  const db = c.env.DB;
  const b = await c.req.json<{ ids?: unknown; active?: unknown }>().catch(() => ({}) as { ids?: unknown; active?: unknown });
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === 'string').slice(0, 100) : [];
  if (ids.length === 0) return c.json({ error: 'Tick some codes first.' }, 400);
  const active = b.active === true ? 1 : 0;
  let n = 0;
  for (const id of ids) {
    const res = await db.prepare('UPDATE discount_codes SET active = ?, updated_at = ? WHERE id = ? AND active != ?').bind(active, nowIso(), id, active).run();
    if (res.meta.changes === 1) {
      n += 1;
      await audit(db, actorOf(c), active ? 'discount.update' : 'discount.off', 'discount_code', id, { active: !active }, { active: Boolean(active), bulk: true });
    }
  }
  return c.json({ changed: n });
});

export type { AdminDiscountCode };
