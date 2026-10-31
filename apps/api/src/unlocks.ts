import type { UnlockHave } from '@kreators/shared';
import { badgesNow, honorKeys } from './db';
import type { UserRow } from './env';

/** What a signed-in person has, for the unlock rule: points, xp, badges and honors. A super admin (role admin) is never locked out. */
export async function haveFor(db: D1Database, user: UserRow): Promise<UnlockHave> {
  return { points: user.points, xp: user.xp, badges: [...(await badgesNow(db, user.id)), ...(await honorKeys(db, user))], superAdmin: user.role === 'admin' };
}
