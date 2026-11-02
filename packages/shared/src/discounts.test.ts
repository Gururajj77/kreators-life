import { describe, expect, it } from 'vitest';
import {
  DISCOUNT_AREAS,
  DISCOUNT_MAX_PERCENT_BPS,
  discountCents,
  discountCodeKey,
  discountLabel,
  discountPoints,
  discountProblem,
  percentOff,
  priceWithDiscount,
  typedCents,
  typedPercentBps,
  type DiscountContext,
  type DiscountRule,
} from './index';

const rule = (over: Partial<DiscountRule> = {}): DiscountRule => ({
  kind: 'percent',
  percentBps: 2_500,
  amountCents: 0,
  currency: 'INR',
  areas: ['product'],
  itemId: null,
  minCents: 0,
  maxUses: null,
  usedCount: 0,
  perPersonLimit: 1,
  startsAt: null,
  endsAt: null,
  active: true,
  ...over,
});
const ctx = (over: Partial<DiscountContext> = {}): DiscountContext => ({ area: 'product', itemId: 'p1', cents: 10_000, points: 0, currency: 'INR', now: '2026-11-02T10:00:00.000Z', usedByPerson: 0, ...over });

describe('discount arithmetic, in whole cents and basis points', () => {
  it('takes a percent off and rounds the amount off down', () => {
    expect(discountCents(10_000, rule())).toBe(2_500);
    expect(discountCents(99, rule({ percentBps: 1_250 }))).toBe(12); // 12.375 -> 12
    expect(discountCents(1, rule({ percentBps: 9_999 }))).toBe(0);
    expect(discountCents(3, rule({ percentBps: 3_333 }))).toBe(0);
    expect(discountCents(7, rule({ percentBps: 5_000 }))).toBe(3);
  });
  it('100% off takes the whole price and no more, and is exact on big prices', () => {
    expect(discountCents(12_345, rule({ percentBps: DISCOUNT_MAX_PERCENT_BPS }))).toBe(12_345);
    expect(discountCents(0, rule({ percentBps: DISCOUNT_MAX_PERCENT_BPS }))).toBe(0);
    expect(percentOff(123_456_789_012, 10_000)).toBe(123_456_789_012);
    expect(percentOff(123_456_789_012, 5_000)).toBe(61_728_394_506);
    expect(percentOff(999_999_999_999, 1)).toBe(99_999_999);
  });
  it('a bps above 100% is held at 100%, and rubbish takes nothing off', () => {
    expect(percentOff(500, 50_000)).toBe(500);
    expect(percentOff(500, -5)).toBe(0);
    expect(percentOff(Number.NaN, 5_000)).toBe(0);
    expect(percentOff(-500, 5_000)).toBe(0);
    expect(percentOff(10.9, 10_000)).toBe(10);
  });
  it('a fixed amount never goes over the price and never below zero', () => {
    const f = rule({ kind: 'fixed', percentBps: 0, amountCents: 5_000 });
    expect(discountCents(10_000, f)).toBe(5_000);
    expect(discountCents(3_000, f)).toBe(3_000);
    expect(discountCents(0, f)).toBe(0);
    expect(discountCents(10_000, rule({ kind: 'fixed', amountCents: -5 }))).toBe(0);
  });
  it('points take a percent only; a fixed amount is money', () => {
    expect(discountPoints(200, rule())).toBe(50);
    expect(discountPoints(7, rule({ percentBps: 5_000 }))).toBe(3);
    expect(discountPoints(200, rule({ kind: 'fixed', amountCents: 5_000 }))).toBe(0);
  });
  it('a price and what is left to pay always add back to the list price', () => {
    for (const cents of [0, 1, 99, 100, 101, 12_345, 99_999]) {
      for (const bps of [1, 333, 1_250, 2_500, 3_333, 9_999, 10_000]) {
        const q = priceWithDiscount({ cents, points: cents }, rule({ percentBps: bps }));
        expect(q.offCents + q.payCents).toBe(cents);
        expect(q.offPoints + q.payPoints).toBe(cents);
        expect(q.payCents).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(q.offCents)).toBe(true);
      }
    }
  });
  it('an amount the team types is read from its digits: 1.005 is 101, not 100', () => {
    expect(typedCents('1.005')).toBe(101);
    expect(typedCents('500')).toBe(50_000);
    expect(discountCents(100_000, rule({ kind: 'fixed', amountCents: typedCents('1.005') }))).toBe(101);
  });
  it('a percent the team types becomes basis points from its digits', () => {
    expect(typedPercentBps('12.5')).toBe(1_250);
    expect(typedPercentBps('100')).toBe(10_000);
    expect(typedPercentBps('0.01')).toBe(1);
    expect(typedPercentBps('1.005')).toBe(101);
    expect(Number.isNaN(typedPercentBps('0'))).toBe(true);
    expect(Number.isNaN(typedPercentBps('100.01'))).toBe(true);
    expect(Number.isNaN(typedPercentBps('abc'))).toBe(true);
    expect(Number.isNaN(typedPercentBps('-5'))).toBe(true);
  });
  it('says what the code is worth in words', () => {
    expect(discountLabel(rule())).toBe('25% off');
    expect(discountLabel(rule({ percentBps: 1_250 }))).toBe('12.5% off');
    expect(discountLabel(rule({ percentBps: 1_205 }))).toBe('12.05% off');
    expect(discountLabel(rule({ percentBps: 10_000 }))).toBe('100% off');
    expect(discountLabel(rule({ kind: 'fixed', amountCents: 50_000 }))).toBe('₹500 off');
  });
});

describe('the code as typed', () => {
  it('is upper case, letters, numbers and single dashes, three to twenty-four long', () => {
    expect(discountCodeKey(' spring-25 ')).toBe('SPRING-25');
    expect(discountCodeKey('Spring25')).toBe('SPRING25');
    expect(discountCodeKey('a--b')).toBe('A-B');
    expect(discountCodeKey('-ab-')).toBe('');
    expect(discountCodeKey('ab')).toBe('');
    expect(discountCodeKey('x'.repeat(40)).length).toBe(24);
    expect(discountCodeKey(42)).toBe('');
    expect(discountCodeKey('<script>')).toBe('SCRIPT');
  });
  it('is looked up in an object with no prototype, so "constructor" finds nothing', () => {
    const byKey: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, { SPRING25: 'row' });
    expect(byKey[discountCodeKey('spring25')]).toBe('row');
    expect(byKey[discountCodeKey('constructor')]).toBeUndefined();
    expect(byKey[discountCodeKey('__proto__')]).toBeUndefined();
  });
  it('lists the paid areas', () => {
    expect([...DISCOUNT_AREAS]).toEqual(['product', 'program', 'event', 'plan', 'topup']);
  });
});

describe('why a code does not work, in plain words', () => {
  it('works when everything fits', () => {
    expect(discountProblem(rule(), ctx())).toBeNull();
  });
  it('is switched off', () => {
    expect(discountProblem(rule({ active: false }), ctx())).toBe('That code is switched off.');
  });
  it('starts at its start and ends before its end', () => {
    const r = rule({ startsAt: '2026-11-02T10:00:00.000Z', endsAt: '2026-11-02T10:00:01.000Z' });
    expect(discountProblem(r, ctx({ now: '2026-11-02T09:59:59.999Z' }))).toBe('That code starts on 2026-11-02.');
    expect(discountProblem(r, ctx({ now: '2026-11-02T10:00:00.000Z' }))).toBeNull(); // the first instant works
    expect(discountProblem(r, ctx({ now: '2026-11-02T10:00:00.999Z' }))).toBeNull();
    expect(discountProblem(r, ctx({ now: '2026-11-02T10:00:01.000Z' }))).toBe('That code has expired.'); // the end does not
  });
  it('is used up on the last use', () => {
    expect(discountProblem(rule({ maxUses: 3, usedCount: 2 }), ctx())).toBeNull();
    expect(discountProblem(rule({ maxUses: 3, usedCount: 3 }), ctx())).toBe('That code has been used up.');
    expect(discountProblem(rule({ maxUses: 0, usedCount: 0 }), ctx())).toBe('That code has been used up.');
  });
  it('is for some areas and one item', () => {
    expect(discountProblem(rule(), ctx({ area: 'plan', itemId: 'pro' }))).toBe('That code is not for this.');
    expect(discountProblem(rule({ itemId: 'p2' }), ctx())).toBe('That code is not for this item.');
    expect(discountProblem(rule({ itemId: 'p1' }), ctx())).toBeNull();
  });
  it('a fixed amount needs a money price in the same currency', () => {
    const f = rule({ kind: 'fixed', percentBps: 0, amountCents: 5_000 });
    expect(discountProblem(f, ctx({ cents: 0, points: 200 }))).toBe('That code takes money off, and this costs points.');
    expect(discountProblem(f, ctx({ currency: 'USD' }))).toBe('That code is in INR, and this is priced in USD.');
    expect(discountProblem(f, ctx())).toBeNull();
  });
  it('has a smallest price', () => {
    expect(discountProblem(rule({ minCents: 10_001 }), ctx())).toBe('That code is for prices from ₹100.01.');
    expect(discountProblem(rule({ minCents: 10_000 }), ctx())).toBeNull();
    // a price in points only has no money price to be under the least
    expect(discountProblem(rule({ minCents: 10_000 }), ctx({ cents: 0, points: 400 }))).toBeNull();
  });
  it('is used once by each person unless the team allows more', () => {
    expect(discountProblem(rule(), ctx({ usedByPerson: 1 }))).toBe('You already used that code.');
    expect(discountProblem(rule({ perPersonLimit: 3 }), ctx({ usedByPerson: 2 }))).toBeNull();
    expect(discountProblem(rule({ perPersonLimit: 3 }), ctx({ usedByPerson: 3 }))).toBe('You used that code as many times as it allows.');
  });
  it('takes nothing off a free thing', () => {
    expect(discountProblem(rule(), ctx({ cents: 0, points: 0 }))).toBe('That code takes nothing off this.');
    expect(discountProblem(rule({ percentBps: 1 }), ctx({ cents: 50, points: 0 }))).toBe('That code takes nothing off this.');
  });
});
