import { money, typedCents } from './money.ts';

// ---------------------------------------------------------------------------
// Discount codes: made by the team, taken off the paid areas, paid for by the platform
// ---------------------------------------------------------------------------

/** The places a code can work: a creator's product, a School program, a Party ticket, a plan and a credit top-up. */
export const DISCOUNT_AREAS = ['product', 'program', 'event', 'plan', 'topup'] as const;
export type DiscountArea = (typeof DISCOUNT_AREAS)[number];
export const DISCOUNT_AREA_META: Readonly<Record<DiscountArea, { name: string; blurb: string }>> = {
  product: { name: 'Shop products', blurb: 'Anything a creator sells in the Shop, paid in points or money.' },
  program: { name: 'School programs', blurb: 'Enrolling in a cohort of a School program.' },
  event: { name: 'Party tickets', blurb: 'A ticket to a Party event that costs points.' },
  plan: { name: 'Plans', blurb: 'Pro, Pro Max and Ultra.' },
  topup: { name: 'Credit top-ups', blurb: 'Extra credits on top of a plan.' },
};
export const isDiscountArea = (v: unknown): v is DiscountArea => (DISCOUNT_AREAS as readonly unknown[]).includes(v);
/** 100% off, in basis points. */
export const DISCOUNT_MAX_PERCENT_BPS = 10_000;
export const DISCOUNT_CODE_MIN = 3;
export const DISCOUNT_CODE_MAX = 24;
/** Most people use a code once; the team can allow more. */
export const DISCOUNT_PER_PERSON_MAX = 100;

/**
 * A code as typed, made into the one form that is stored and looked up: upper case, letters, numbers and single dashes, three to
 * twenty-four of them. Anything else is dropped, so "spring 25" and "SPRING-25" are different words but "Spring25" and "SPRING25" are
 * one. An empty string means the text is not a usable code. (Attendee codes have their own `normalizeCode`.)
 */
export function discountCodeKey(text: unknown): string {
  if (typeof text !== 'string') return '';
  const key = text.toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, DISCOUNT_CODE_MAX).replace(/-$/, '');
  return key.length < DISCOUNT_CODE_MIN ? '' : key;
}

/** A percent typed by the team ("12.5") as basis points (1250), read from its digits the way `typedCents` reads money. NaN when it is not between 0.01 and 100. */
export function typedPercentBps(typed: string | number): number {
  const bps = typedCents(typed);
  return Number.isInteger(bps) && bps >= 1 && bps <= DISCOUNT_MAX_PERCENT_BPS ? bps : Number.NaN;
}

/** The rules of one code that the arithmetic and the checks need. */
export interface DiscountRule {
  kind: 'percent' | 'fixed';
  /** percent: 1 to 10000. */
  percentBps: number;
  /** fixed: the cents taken off, in `currency`. */
  amountCents: number;
  currency: string;
  areas: readonly DiscountArea[];
  itemId: string | null;
  minCents: number;
  maxUses: number | null;
  usedCount: number;
  perPersonLimit: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
}

const wholeNonNegative = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** `bps` of an amount, rounded down, in integers only: 12.5% of 99 is 12. Never below 0 and never above the amount. */
export function percentOff(amount: number, bps: number): number {
  const a = wholeNonNegative(amount);
  const b = Math.min(DISCOUNT_MAX_PERCENT_BPS, wholeNonNegative(bps));
  const q = Math.floor(a / 10_000);
  const r = a - q * 10_000;
  return Math.min(a, q * b + Math.floor((r * b) / 10_000));
}

/** The cents a code takes off a price in cents: a percent is rounded down, a fixed amount never goes over the price. */
export function discountCents(priceCents: number, code: Pick<DiscountRule, 'kind' | 'percentBps' | 'amountCents'>): number {
  const price = wholeNonNegative(priceCents);
  return code.kind === 'percent' ? percentOff(price, code.percentBps) : Math.min(price, wholeNonNegative(code.amountCents));
}

/** The points a code takes off a price in points. Only a percent can: a fixed amount is money. */
export function discountPoints(pricePoints: number, code: Pick<DiscountRule, 'kind' | 'percentBps'>): number {
  return code.kind === 'percent' ? percentOff(pricePoints, code.percentBps) : 0;
}

export interface DiscountQuote {
  offCents: number;
  offPoints: number;
  payCents: number;
  payPoints: number;
}
/** What is taken off a list price and what is left to pay, in cents and in points. */
export function priceWithDiscount(price: { cents: number; points: number }, code: Pick<DiscountRule, 'kind' | 'percentBps' | 'amountCents'>): DiscountQuote {
  const cents = wholeNonNegative(price.cents);
  const points = wholeNonNegative(price.points);
  const offCents = discountCents(cents, code);
  const offPoints = discountPoints(points, code);
  return { offCents, offPoints, payCents: cents - offCents, payPoints: points - offPoints };
}

/** "25% off", "12.5% off" or "₹500 off". */
export function discountLabel(code: Pick<DiscountRule, 'kind' | 'percentBps' | 'amountCents' | 'currency'>): string {
  if (code.kind === 'fixed') return `${money(code.amountCents, code.currency)} off`;
  const whole = Math.floor(code.percentBps / 100);
  const frac = code.percentBps % 100;
  return `${whole}${frac ? `.${String(frac).padStart(2, '0').replace(/0$/, '')}` : ''}% off`;
}

export interface DiscountContext {
  area: DiscountArea;
  itemId: string | null;
  /** The list price. */
  cents: number;
  points: number;
  currency: string;
  /** Now, as a UTC ISO string. */
  now: string;
  /** How many times this person has used the code already (a released use does not count). */
  usedByPerson: number;
}
/**
 * Why a code does not work here, in plain words, or null when it does. The order is: switched off, not started, ended, used up,
 * not for this, wrong money, below the minimum, already used by you, nothing to take off. A code starts at `startsAt` and
 * works up to, not including, `endsAt`.
 */
export function discountProblem(code: DiscountRule, ctx: DiscountContext): string | null {
  const now = Date.parse(ctx.now);
  if (!code.active) return 'That code is switched off.';
  if (code.startsAt && Date.parse(code.startsAt) > now) return `That code starts on ${code.startsAt.slice(0, 10)}.`;
  if (code.endsAt && Date.parse(code.endsAt) <= now) return 'That code has expired.';
  if (code.maxUses !== null && code.usedCount >= code.maxUses) return 'That code has been used up.';
  if (!code.areas.includes(ctx.area)) return 'That code is not for this.';
  if (code.itemId && code.itemId !== ctx.itemId) return 'That code is not for this item.';
  if (code.kind === 'fixed') {
    if (ctx.cents <= 0) return 'That code takes money off, and this costs points.';
    if (code.currency !== ctx.currency) return `That code is in ${code.currency}, and this is priced in ${ctx.currency}.`;
  }
  if (code.minCents > 0 && ctx.cents > 0 && ctx.cents < code.minCents) return `That code is for prices from ${money(code.minCents, ctx.currency)}.`;
  if (ctx.usedByPerson >= Math.max(1, code.perPersonLimit)) return code.perPersonLimit <= 1 ? 'You already used that code.' : 'You used that code as many times as it allows.';
  const q = priceWithDiscount({ cents: ctx.cents, points: ctx.points }, code);
  if (q.offCents + q.offPoints === 0) return 'That code takes nothing off this.';
  return null;
}

/** One code as the team sees it. */
export interface AdminDiscountCode extends DiscountRule {
  id: string;
  code: string;
  note: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Redemptions that were not given back. */
  redeemed: number;
  /** What those redemptions took off, by kind. */
  givenCents: number;
  givenPoints: number;
}

/** The answer to "does this code work here?" for a signed-in person. */
export interface DiscountCheck {
  ok: true;
  code: string;
  label: string;
  area: DiscountArea;
  itemId: string | null;
  currency: string;
  /** The list price and what is taken off it, in cents and points. */
  listCents: number;
  listPoints: number;
  offCents: number;
  offPoints: number;
  payCents: number;
  payPoints: number;
}
