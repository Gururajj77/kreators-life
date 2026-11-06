import { describe, expect, it } from 'vitest';
import { LINE_POOL_SIZE, TIP_COUNT, lineByKey, lineForDay, nextLine } from './index.ts';

describe('another line of the day', () => {
  it('never repeats a line until every line and tip has been shown', () => {
    const seen = [lineForDay('2026-11-06').key];
    let last: string | null = seen[0]!;
    for (let i = 1; i < LINE_POOL_SIZE; i += 1) {
      const { line, fresh } = nextLine(seen, 42, last);
      expect(fresh).toBe(false);
      expect(seen).not.toContain(line.key);
      seen.push(line.key);
      last = line.key;
    }
    expect(new Set(seen).size).toBe(LINE_POOL_SIZE);
    const again = nextLine(seen, 42, last);
    expect(again.fresh).toBe(true);
    expect(again.line.key).not.toBe(last);
  });
  it('takes turns: a tip, then a quote, while both are left', () => {
    const seen: string[] = [];
    let last: string | null = 'p0';
    const kinds: boolean[] = [];
    for (let i = 0; i < 40; i += 1) {
      const { line } = nextLine(seen, 9, last);
      kinds.push(line.tip);
      seen.push(line.key);
      last = line.key;
    }
    expect(kinds.every((t, i) => t === (i % 2 === 0))).toBe(true);
  });
  it('passes over a line that does not fit where it is shown, and never shows it', () => {
    const fits = (l: { text: string }) => l.text.length <= 60;
    const seen: string[] = [];
    let last: string | null = null;
    for (let i = 0; i < 120; i += 1) {
      const { line, fresh } = nextLine(seen, 3, last, fits);
      expect(line.text.length).toBeLessThanOrEqual(60);
      if (fresh) seen.length = 0;
      seen.push(line.key);
      last = line.key;
    }
  });
  it('gives the same next line for the same history', () => {
    expect(nextLine(['p1', 'a2'], 5, 'a2').line.key).toBe(nextLine(['p1', 'a2'], 5, 'a2').line.key);
  });
  it('keeps the tips short, plain and each once', () => {
    expect(TIP_COUNT).toBeGreaterThanOrEqual(40);
    const tips = Array.from({ length: TIP_COUNT }, (_, i) => lineByKey(`t${i}`)!);
    expect(new Set(tips.map((t) => t.text)).size).toBe(TIP_COUNT);
    for (const t of tips) {
      expect(t.tip).toBe(true);
      expect(t.by).toBe('');
      expect(t.text.length).toBeLessThanOrEqual(160);
      expect(t.text).not.toMatch(/\bspark\b|\btower\b|Kreators Life|\bfloors?\b|\brung\b|\bladder\b|\bvices?\b/i);
    }
    expect(lineByKey('x1')).toBeNull();
    expect(lineByKey('t99999')).toBeNull();
  });
});
