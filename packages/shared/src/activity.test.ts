import { describe, expect, it } from 'vitest';
import { ACTIVITY_DAYS, activityLevel, activityRange, activityWeeks } from './activity';

describe('activityLevel', () => {
  it('is 0 only for nothing', () => {
    expect(activityLevel(0, 10)).toBe(0);
    expect(activityLevel(-3, 10)).toBe(0);
    expect(activityLevel(1, 1000)).toBe(1);
  });
  it('splits the busiest day into quarters, and the busiest day is 4', () => {
    expect(activityLevel(25, 100)).toBe(1);
    expect(activityLevel(26, 100)).toBe(2);
    expect(activityLevel(50, 100)).toBe(2);
    expect(activityLevel(51, 100)).toBe(3);
    expect(activityLevel(75, 100)).toBe(3);
    expect(activityLevel(76, 100)).toBe(4);
    expect(activityLevel(100, 100)).toBe(4);
    expect(activityLevel(7, 7)).toBe(4);
  });
  it('is 0 when the year is empty (max 0) and never above 4', () => {
    expect(activityLevel(5, 0)).toBe(0);
    expect(activityLevel(0, 0)).toBe(0);
    expect(activityLevel(200, 100)).toBe(4);
  });
  it('always gives a whole number from 0 to 4', () => {
    for (let c = 0; c <= 37; c += 1) {
      const l = activityLevel(c, 37);
      expect(Number.isInteger(l)).toBe(true);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(4);
    }
  });
});

describe('activityRange', () => {
  it('ends on the day and covers 53 weeks, oldest first', () => {
    const r = activityRange('2026-11-03');
    expect(r).toHaveLength(ACTIVITY_DAYS);
    expect(ACTIVITY_DAYS).toBe(53 * 7);
    expect(r.at(-1)).toBe('2026-11-03');
    expect(r[0]).toBe('2025-10-29');
    expect(new Set(r).size).toBe(ACTIVITY_DAYS);
  });
});

describe('activityWeeks', () => {
  const at = (days: string[]) => days.map((day) => ({ day }));
  it('lays a week that starts on a Monday out as one full column', () => {
    // 2026-11-02 is a Monday.
    const w = activityWeeks(at(activityRange('2026-11-08', 7)));
    expect(w).toHaveLength(1);
    expect(w[0]!.map((d) => d?.day)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  });
  it('pads a year that starts mid-week before its first day and after its last', () => {
    const days = activityRange('2026-11-03');
    const w = activityWeeks(at(days));
    // 2025-10-29 is a Wednesday: two empty days before it; 2026-11-03 is a Tuesday: five empty days after it.
    expect(w[0]![0]).toBeNull();
    expect(w[0]![1]).toBeNull();
    expect(w[0]![2]!.day).toBe('2025-10-29');
    expect(w).toHaveLength(54);
    const last = w.at(-1)!;
    expect(last[1]!.day).toBe('2026-11-03');
    expect(last.slice(2).every((d) => d === null)).toBe(true);
    expect(w.every((col) => col.length === 7)).toBe(true);
    expect(w.flat().filter(Boolean)).toHaveLength(ACTIVITY_DAYS);
  });
  it('puts every day on its own weekday row', () => {
    const w = activityWeeks(at(activityRange('2026-03-01', 60)));
    for (const col of w)
      col.forEach((d, row) => {
        if (!d) return;
        const js = new Date(`${d.day}T00:00:00Z`).getUTCDay();
        expect(row).toBe(js === 0 ? 6 : js - 1);
      });
  });
  it('gives nothing for no days', () => {
    expect(activityWeeks([])).toEqual([]);
  });
});
