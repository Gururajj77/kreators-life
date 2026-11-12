import { describe, expect, it } from 'vitest';
import { HIDDEN_ALWAYS, HIDDEN_PAGE_PREFIX, TASK_HIDES, hiddenUntilFor, parseTaskHide, taskHiddenOn, taskHideOf, taskHideProblem, taskHideState } from './index.ts';

describe('hidden tasks', () => {
  it('offers the two choices the founder asked for, in his words', () => {
    expect(TASK_HIDES.map((h) => h.key)).toEqual(['tomorrow', 'always']);
    expect(TASK_HIDES.map((h) => h.name)).toEqual(['Until tomorrow', 'Until I unhide it']);
    expect(taskHideState('tomorrow')).toBe('Until tomorrow');
    expect(taskHideState('always')).toBe('Until you unhide it');
    expect(HIDDEN_PAGE_PREFIX).toBe('hd');
  });

  it('reads a choice, and anything else as shown, through a byKey object', () => {
    expect(parseTaskHide('tomorrow')).toBe('tomorrow');
    expect(parseTaskHide(' ALWAYS ')).toBe('always');
    for (const v of [null, undefined, '', 'none', 'show', 'constructor', '__proto__', 'toString', 3, true, {}]) expect(parseTaskHide(v)).toBeNull();
  });

  it('refuses an unknown choice in plain words, and takes the ways of showing it', () => {
    for (const v of ['tomorrow', 'always', 'Always', null, '', 'none', 'show']) expect(taskHideProblem(v)).toBeNull();
    for (const v of ['forever', 'constructor', '__proto__', 1, true, {}, []]) expect(taskHideProblem(v)).toBeTruthy();
  });

  it('writes the person’s today for Until tomorrow, so it is back on their next day', () => {
    const today = '2026-11-12';
    const until = hiddenUntilFor('tomorrow', today);
    expect(until).toBe(today);
    expect(taskHiddenOn(until, today)).toBe(true);
    expect(taskHideOf(until, today)).toBe('tomorrow');
    expect(taskHiddenOn(until, '2026-11-13')).toBe(false);
    expect(taskHideOf(until, '2026-11-13')).toBeNull();
    // A month and a year turning over.
    expect(taskHiddenOn(hiddenUntilFor('tomorrow', '2026-12-31'), '2027-01-01')).toBe(false);
  });

  it('keeps Until I unhide it for good, and null shows it', () => {
    const until = hiddenUntilFor('always', '2026-11-12');
    expect(until).toBe(HIDDEN_ALWAYS);
    for (const day of ['2026-11-12', '2027-03-01', '2099-12-31']) expect(taskHideOf(until, day)).toBe('always');
    expect(hiddenUntilFor(null, '2026-11-12')).toBeNull();
    expect(taskHiddenOn(null, '2026-11-12')).toBe(false);
    expect(taskHiddenOn(undefined, '2026-11-12')).toBe(false);
    expect(taskHiddenOn('', '2026-11-12')).toBe(false);
  });
});
