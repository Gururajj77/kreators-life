import { PUBLIC_BADGES, type UnlockHave } from '@kreators/shared';
import { badgesNow, honorKeys } from './db';
import type { UserRow } from './env';

/** What a signed-in person has, for the unlock rule: points, xp, badges and honors. A super admin (role admin) is never locked out. */
export async function haveFor(db: D1Database, user: UserRow): Promise<UnlockHave> {
  // Only public badges and honors open a gate: a gate saved on a private badge before that rule never opens on someone's journal,
  // focus or money count, so whether a person holds one is never told to a seller.
  const open = new Set(PUBLIC_BADGES.map((b) => b.key));
  const badges = (await badgesNow(db, user.id)).filter((k) => open.has(k));
  return { points: user.points, xp: user.xp, badges: [...badges, ...(await honorKeys(db, user))], superAdmin: user.role === 'admin' };
}
