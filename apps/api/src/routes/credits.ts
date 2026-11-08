import { Hono } from 'hono';
import { isPaidPlan, PAID_PLANS, PAYMENTS_LIVE, PLANS, TOPUP_PACKS, type CreditsResponse, type DiscountCheck } from '@kreators/shared';
import type { AppEnv } from '../env';
import { pageOf, paged } from '../db';
import { checkOf, listPriceFor, quoteCode } from '../discounts';
import { creditAccount, toEntry, usageByDay, type LedgerRow } from '../credits';

/**
 * The person's plan and credits: what is left, what was used each day, and the history. Plans and top-ups can be
 * picked, but until payments are live the checkout says so and charges nothing; the team switches plans on.
 */
export const credits = new Hono<AppEnv>();

credits.get('/', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const [account, usage] = await Promise.all([creditAccount(db, userId), usageByDay(db, userId)]);
  const res: CreditsResponse = { account, usage, plans: PAID_PLANS.map((k) => PLANS[k]), topUps: TOPUP_PACKS, paymentsLive: PAYMENTS_LIVE };
  return c.json(res);
});

credits.get('/ledger', async (c) => {
  // Plans' Usage list pages on `use` (2026-11-07: it read `page`, so Next never moved); a bare `size` still works.
  const ask = pageOf(c, 'use');
  const rows = await c.env.DB.prepare('SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?').bind(c.get('user').id, ask.limit, ask.offset).all<LedgerRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, entries: pg.items.map(toEntry) });
});

// Where a plan or a top-up will be bought. Until a payment provider is live it answers that nothing was charged.
// A discount code is checked here too, so the price shown is the price that will be charged once payments are live; nothing is used up
// while nothing is charged.
credits.post('/checkout', async (c) => {
  const body = await c.req.json<{ kind?: unknown; key?: unknown; discountCode?: unknown }>().catch(() => ({}) as { kind?: unknown; key?: unknown; discountCode?: unknown });
  const known = body.kind === 'plan' ? isPaidPlan(body.key) : body.kind === 'topup' ? TOPUP_PACKS.some((p) => p.key === body.key) : false;
  if (!known) return c.json({ error: 'No such plan or top-up.' }, 400);
  let quote: DiscountCheck | null = null;
  if (typeof body.discountCode === 'string' && body.discountCode.trim()) {
    const area = body.kind === 'plan' ? 'plan' : 'topup';
    const itemId = String(body.key);
    const list = await listPriceFor(c.env.DB, area, itemId);
    if (!list) return c.json({ error: 'No such plan or top-up.' }, 400);
    const q = await quoteCode(c.env.DB, c.get('user').id, body.discountCode, area, itemId, list);
    if (!q.ok) return c.json({ error: q.why }, 400);
    quote = checkOf(q);
  }
  if (!PAYMENTS_LIVE) return c.json({ error: 'Payments are not live yet, so nothing was charged. Until they are, the team can switch a plan on or add credits for you.', live: false, quote }, 409);
  return c.json({ error: 'Checkout is not built yet.', quote }, 501);
});
