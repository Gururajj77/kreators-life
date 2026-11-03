import { describe, expect, it } from 'vitest';
import { BADGES, BADGE_FAMILY_META, HONORS, PUBLIC_BADGES, birthDateProblem, designInputProblem, emptyDesignInput, emptyInvoiceDoc, isRealDay, isUnlockBadgeKey, parseInvoiceDoc } from './index';

// Checks for bugs found in the 2026-11-03 audit, so each one stays fixed.

describe('isRealDay', () => {
  it('takes real days and refuses days the calendar does not have', () => {
    expect(isRealDay('2024-02-29')).toBe(true);
    expect(isRealDay('2026-11-03')).toBe(true);
    for (const d of ['2008-02-30', '1990-04-31', '2026-13-01', '2026-00-00', '2025-02-29', '2026-1-01', '', 20260101]) expect(isRealDay(d)).toBe(false);
  });
});

describe('a typed birth date must be a real day', () => {
  it('birthDateProblem refuses 30 February and 31 April', () => {
    expect(birthDateProblem('2008-02-30', '2026-11-03')).toBe('Enter your date of birth.');
    expect(birthDateProblem('1990-04-31', '2026-11-03')).toBe('Enter your date of birth.');
    expect(birthDateProblem('1990-04-30', '2026-11-03')).toBeNull();
  });
  it('designInputProblem refuses 31 February', () => {
    const base = { ...emptyDesignInput(), time: '10:30', zone: 'Asia/Kolkata' };
    expect(designInputProblem({ ...base, date: '1990-02-31' }, '2026-11-03')).toBe('Enter your birth date.');
    expect(designInputProblem({ ...base, date: '1990-02-28' }, '2026-11-03')).toBeNull();
  });
});

describe('parseInvoiceDoc keeps a discount the doc leaves out', () => {
  const base = { ...emptyInvoiceDoc(), discountMode: 'percent' as const, discountValue: 1000 };
  it('an invoice made from a template keeps its 10% off', () => {
    const doc = parseInvoiceDoc(undefined, base);
    expect(doc.discountMode).toBe('percent');
    expect(doc.discountValue).toBe(1000);
  });
  it('a partial change without the value keeps the stored one', () => {
    expect(parseInvoiceDoc({ title: 'Invoice 7' }, base).discountValue).toBe(1000);
  });
  it('a flat discount is kept the same way', () => {
    expect(parseInvoiceDoc({}, { ...emptyInvoiceDoc(), discountMode: 'flat', discountValue: 50_000 }).discountValue).toBe(50_000);
  });
  it('a new value, a new mode or none still win', () => {
    expect(parseInvoiceDoc({ discountValue: 500 }, base).discountValue).toBe(500);
    expect(parseInvoiceDoc({ discountMode: 'flat' }, base).discountValue).toBe(0);
    expect(parseInvoiceDoc({ discountMode: 'none' }, base).discountValue).toBe(0);
  });
});

describe('isUnlockBadgeKey', () => {
  it('never takes a badge from a private family', () => {
    const priv = BADGES.filter((b) => BADGE_FAMILY_META[b.family].private);
    expect(priv.length).toBeGreaterThan(0);
    for (const b of priv) expect(isUnlockBadgeKey(b.key)).toBe(false);
  });
  it('takes every public badge and every honor', () => {
    for (const b of PUBLIC_BADGES) expect(isUnlockBadgeKey(b.key)).toBe(true);
    for (const h of HONORS) expect(isUnlockBadgeKey(h.key)).toBe(true);
    expect(isUnlockBadgeKey('constructor')).toBe(false);
  });
});
