import { describe, expect, it } from 'vitest';
import { MAP_LEVELS, RELATIONSHIPS } from './index';
import { LEVEL_LINES, levelLineFor } from './levelLines';

describe('what each map level sounds like in each relationship', () => {
  it('has a line for every level in every relationship, and no other', () => {
    for (const r of RELATIONSHIPS) {
      expect(Object.keys(LEVEL_LINES[r.key]).map(Number).sort((a, b) => a - b)).toEqual(MAP_LEVELS.map((l) => l.value).sort((a, b) => a - b));
      for (const l of MAP_LEVELS) expect(levelLineFor(r.key, l.value)).toBeTruthy();
    }
    expect(levelLineFor('self', 999)).toBeNull();
  });
  it('keeps every line short, plain and different within a relationship', () => {
    for (const r of RELATIONSHIPS) {
      const lines = Object.values(LEVEL_LINES[r.key]);
      expect(new Set(lines).size).toBe(lines.length);
      for (const line of lines) {
        expect(line.split(/\s+/).length).toBeLessThanOrEqual(14);
        expect(line).toMatch(/[.?]$/);
        expect(line).not.toMatch(/\b(always will|guarantee|cure|diagnos|disorder|tower|spark|rung|ladder)\b/i);
      }
    }
  });
});
