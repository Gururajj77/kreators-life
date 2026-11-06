import { describe, expect, it } from 'vitest';
import { LIFE_AREA_ORDER, LIFE_AREA_PROBLEM, LIFE_AREAS, isLifeAreaKey, lifeAreaProblem, parseLifeArea } from './index';

describe('a task’s area of life', () => {
  it('reads every key and every name, in any case and spacing', () => {
    for (const key of LIFE_AREA_ORDER) {
      expect(parseLifeArea(key)).toBe(key);
      expect(parseLifeArea(LIFE_AREAS[key].name)).toBe(key);
      expect(parseLifeArea(` ${LIFE_AREAS[key].name.toUpperCase()} `)).toBe(key);
      expect(isLifeAreaKey(key)).toBe(true);
    }
  });

  it('reads none, empty and unknown values as no area', () => {
    for (const v of [null, undefined, '', '  ', 'none', 'NONE', 'body', 'constructor', '__proto__', 3, true, {}, ['physical']]) expect(parseLifeArea(v)).toBeNull();
    expect(isLifeAreaKey('Physical')).toBe(false);
    expect(isLifeAreaKey('toString')).toBe(false);
  });

  it('refuses only a value that is neither an area nor a way to clear one', () => {
    for (const v of [null, undefined, '', 'none', 'None', 'physical', 'Spiritual']) expect(lifeAreaProblem(v)).toBeNull();
    for (const v of ['body', 'constructor', 7, true, { key: 'physical' }]) expect(lifeAreaProblem(v)).toBe(LIFE_AREA_PROBLEM);
    expect(LIFE_AREA_PROBLEM).toBe('pick one of the five areas, or none');
  });
});
