import { Hono } from 'hono';
import { isDiscountArea } from '@kreators/shared';
import type { AppEnv } from '../env';
import { str } from '../db';
import { checkOf, listPriceFor, NO_SUCH_CODE, quoteCode } from '../discounts';

/**
 * A signed-in person asks whether a code works on something they are about to buy. Nothing is used up here; the checkout of each
 * area checks again and redeems. The price comes from the item, never from the request. Limited per person and per address
 * (`discount` and `discountAddress` in limits.ts), so a code cannot be guessed at.
 */
export const discounts = new Hono<AppEnv>();

discounts.post('/check', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ code?: unknown; area?: unknown; itemId?: unknown; points?: unknown }>().catch(() => ({}) as { code?: unknown; area?: unknown; itemId?: unknown; points?: unknown });
  if (!isDiscountArea(body.area)) return c.json({ error: 'Pick what the code is for.' }, 400);
  const itemId = str(body.itemId, 80);
  if (!itemId) return c.json({ error: 'Pick what the code is for.' }, 400);
  const list = await listPriceFor(db, body.area, itemId, typeof body.points === 'number' ? body.points : undefined);
  if (!list) return c.json({ error: 'That is not for sale.' }, 404);
  const q = await quoteCode(db, user.id, body.code, body.area, itemId, list);
  if (!q.ok) return c.json({ error: q.why || NO_SUCH_CODE }, 400);
  return c.json(checkOf(q));
});
