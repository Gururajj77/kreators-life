import { describe, expect, it } from 'vitest';
import { FACT_KINDS, FACT_KIND_META, ICON_NAMES, fact } from './index';

describe('listing facts', () => {
  it('every kind has a tone, an icon the app can draw and a name', () => {
    for (const k of FACT_KINDS) {
      const m = FACT_KIND_META[k];
      expect(m, k).toBeTruthy();
      expect((ICON_NAMES as readonly string[]).includes(m.icon), `${k} icon ${m.icon}`).toBe(true);
      expect(m.name.length).toBeGreaterThan(0);
    }
    expect(Object.keys(FACT_KIND_META).sort()).toEqual([...FACT_KINDS].sort());
  });
  it('the price, free, place, online, when and availability kinds do not all look alike', () => {
    const looks = new Set(['price', 'free', 'place', 'online', 'when', 'availability'].map((k) => FACT_KIND_META[k as (typeof FACT_KINDS)[number]].tone));
    expect(looks.size).toBe(6);
  });
  it('fact drops a blank text and trims the rest', () => {
    expect(fact('place', '')).toEqual([]);
    expect(fact('place', null)).toEqual([]);
    expect(fact('when', '  4 Nov ')).toEqual([{ kind: 'when', text: '4 Nov' }]);
  });
});
