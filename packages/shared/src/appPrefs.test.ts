import { describe, expect, it } from 'vitest';
import { appPrefsProblem, GROUP_OPEN_DEFAULT, groupStartsOpen, MODULE_GROUP_ORDER, MODULES, orderInGroup, parseAppPrefs } from './index';

describe('app prefs', () => {
  it('starts Contribution and Essentials open and the rest closed', () => {
    expect(MODULE_GROUP_ORDER.filter((g) => GROUP_OPEN_DEFAULT[g])).toEqual(['earn', 'core']);
    expect(groupStartsOpen(parseAppPrefs(null), 'earn')).toBe(true);
    expect(groupStartsOpen(parseAppPrefs(null), 'community')).toBe(false);
    // Profile opens every group unless the person picked.
    expect(groupStartsOpen(parseAppPrefs(null), 'community', true)).toBe(true);
    expect(groupStartsOpen(parseAppPrefs({ open: { community: false } }), 'community', true)).toBe(false);
    expect(groupStartsOpen(parseAppPrefs({ open: { earn: false } }), 'earn')).toBe(false);
  });

  it('keeps only known groups, booleans and each group’s own apps, once each', () => {
    const p = parseAppPrefs({ open: { earn: false, constructor: true, core: 'yes' }, order: { earn: ['work', 'school', 'work', 'life', 7, 'toString'], __proto__: ['home'], wellbeing: [] } });
    expect(p).toEqual({ open: { earn: false }, order: { earn: ['work', 'school'] } });
    expect(parseAppPrefs('{"open":{"core":true}}')).toEqual({ open: { core: true }, order: {} });
    expect(parseAppPrefs('not json')).toEqual({ open: {}, order: {} });
    expect(parseAppPrefs([1, 2])).toEqual({ open: {}, order: {} });
  });

  it('refuses a key from another group, an unknown group and a repeat', () => {
    expect(appPrefsProblem({ open: { earn: true }, order: { earn: ['work', 'army'] } })).toBeNull();
    expect(appPrefsProblem({ order: { earn: ['life'] } })).toMatch(/another group/);
    expect(appPrefsProblem({ order: { constructor: [] } })).toMatch(/no group/);
    expect(appPrefsProblem({ open: { toString: true } })).toMatch(/no group/);
    expect(appPrefsProblem({ order: { earn: ['work', 'work'] } })).toMatch(/twice/);
    expect(appPrefsProblem({ order: { earn: ['constructor'] } })).toMatch(/only apps/);
    expect(appPrefsProblem({ open: { earn: 1 } })).toMatch(/yes or no/);
    expect(appPrefsProblem('x')).not.toBeNull();
  });

  it('orders a group: placed apps first in the person’s order, the rest in the order they came', () => {
    const earn = MODULES.filter((m) => m.group === 'earn');
    const keys = earn.map((m) => m.key);
    expect(orderInGroup(earn, undefined).map((m) => m.key)).toEqual(keys);
    expect(orderInGroup(earn, []).map((m) => m.key)).toEqual(keys);
    const out = orderInGroup(earn, ['agency', 'army', 'gone-app']).map((m) => m.key);
    expect(out.slice(0, 2)).toEqual(['agency', 'army']);
    expect(out.slice(2)).toEqual(keys.filter((k) => k !== 'agency' && k !== 'army'));
    expect(out).toHaveLength(keys.length);
  });
});
