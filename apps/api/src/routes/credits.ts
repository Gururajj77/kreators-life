import { Hono } from 'hono';
import { isPaidPlan, PAID_PLANS, PAYMENTS_LIVE, PLANS, TOPUP_PACKS, type CreditsResponse } from '@kreators/shared';
import type { AppEnv } from '../env';
import { pageOf, paged } from '../db';
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
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare('SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?').bind(c.get('user').id, ask.limit, ask.offset).all<LedgerRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, entries: pg.items.map(toEntry) });
});

// Where a plan or a top-up will be bought. Until a payment provider is live it answers that nothing was charged.
credits.post('/checkout', async (c) => {
  const body = await c.req.json<{ kind?: unknown; key?: unknown }>().catch(() => ({}) as { kind?: unknown; key?: unknown });
  const known = body.kind === 'plan' ? isPaidPlan(body.key) : body.kind === 'topup' ? TOPUP_PACKS.some((p) => p.key === body.key) : false;
  if (!known) return c.json({ error: 'No such plan or top-up.' }, 400);
  if (!PAYMENTS_LIVE) return c.json({ error: 'Payments are not live yet, so nothing was charged. Until they are, the team can switch a plan on or add credits for you.', live: false }, 409);
  return c.json({ error: 'Checkout is not built yet.' }, 501);
});
