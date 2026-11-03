import { DATE_RE, num } from './db';

/**
 * Small readers every Agency route uses, in one place (they were copied into agency.ts, agencyDocs.ts and agencyLife.ts).
 * The day a person is on comes from `dayFromDevice` in db.ts; these only read what a request sent.
 */

/** A real calendar day (`DATE_RE`, so 2026-11-31 is refused), or null. */
export const dateOrNull = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) ? v : null);

/** An amount in whole cents, never below zero and never past a billion in the currency; anything else is zero. */
export const moneyIn = (v: unknown): number => num(v, 0, 0, 1_000_000_000_00) ?? 0;
