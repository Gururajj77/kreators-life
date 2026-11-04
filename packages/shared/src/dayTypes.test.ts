import { describe, expect, it } from 'vitest';
import { DAY_TYPE_KEYS, DAY_TYPES, dayTypeOf, isDayTypeKey, isTaskSort, RELATIONSHIPS, sortTasks, TASK_SORTS, TERMS, type Priority, type RelationshipKey } from './index';

type T = { id: string; relationship: RelationshipKey; priority: Priority | null; doDate: string | null; dueDate: string | null; dueTime: string | null };
const t = (id: string, relationship: RelationshipKey, priority: Priority | null, doDate = '2026-11-04', dueTime: string | null = null): T => ({ id, relationship, priority, doDate, dueDate: null, dueTime });

describe('day types', () => {
  it('has one entry per key, each with a real lead, a different second, a why and a source', () => {
    expect(DAY_TYPES.map((d) => d.key)).toEqual([...DAY_TYPE_KEYS]);
    const pillars = new Set(RELATIONSHIPS.map((r) => r.key));
    for (const d of DAY_TYPES) {
      expect(pillars.has(d.lead), d.key).toBe(true);
      expect(pillars.has(d.second), d.key).toBe(true);
      expect(d.second, d.key).not.toBe(d.lead);
      expect(d.why.length, d.key).toBeGreaterThan(20);
      expect(d.source, d.key).toMatch(/The Relationship Method|Dictionary of Mistakes for (Creators|20s)|app’s own/);
      expect(`${d.name} ${d.why}`, d.key).not.toMatch(/sprint|tower|Kreators Life|flow method/i);
    }
  });

  it('starts with deep work led by servitude, the founder’s example', () => {
    expect(DAY_TYPES[0]).toMatchObject({ key: 'deep_work', lead: 'servant_leader' });
  });

  it('looks a key up without a prototype', () => {
    expect(dayTypeOf('money')?.name).toBe('Money');
    expect(dayTypeOf('constructor')).toBeNull();
    expect(dayTypeOf('__proto__')).toBeNull();
    expect(dayTypeOf(3)).toBeNull();
    expect(isDayTypeKey('reset')).toBe(true);
    expect(isDayTypeKey('faith')).toBe(false);
  });

  it('has a word in the glossary', () => {
    expect(TERMS['day type']).toBeTruthy();
  });
});

describe('sort by context', () => {
  const list = [
    t('self-p0', 'self', 0),
    t('work-p1', 'servant_leader', 1),
    t('none-work', 'servant_leader', null),
    t('friend-p0', 'friendship', 0, '2026-11-01'),
    t('work-p0-late', 'servant_leader', 0, '2026-11-04', '18:00'),
    t('work-p0', 'servant_leader', 0, '2026-11-04', '09:00'),
    t('self-p1', 'self', 1),
    t('none-self', 'self', null),
  ];

  it('is one of the sorts', () => {
    expect(isTaskSort('context')).toBe(true);
    expect(TASK_SORTS.some((s) => s.key === 'context' && s.name === 'By context')).toBe(true);
  });

  it('keeps every P0 above everything else and puts the lead pillar first inside each priority (deep work)', () => {
    const order = sortTasks(list, 'context', { lead: 'servant_leader', second: 'self' }).map((x) => x.id);
    expect(order).toEqual(['work-p0', 'work-p0-late', 'self-p0', 'friend-p0', 'work-p1', 'self-p1', 'none-work', 'none-self']);
  });

  it('puts the second pillar before the rest inside a priority', () => {
    const order = sortTasks(list, 'context', { lead: 'friendship', second: 'self' }).map((x) => x.id);
    expect(order.slice(0, 4)).toEqual(['friend-p0', 'self-p0', 'work-p0', 'work-p0-late']);
  });

  it('falls back to priority, then the day, with no context', () => {
    const order = sortTasks(list, 'context', null).map((x) => x.id);
    expect(order.slice(0, 4)).toEqual(['friend-p0', 'work-p0', 'work-p0-late', 'self-p0']);
  });

  it('is stable and leaves the other sorts alone', () => {
    const same = [t('a', 'self', 2), t('b', 'self', 2)];
    expect(sortTasks(same, 'context', { lead: 'self' }).map((x) => x.id)).toEqual(['a', 'b']);
    expect(sortTasks(list, 'priority').map((x) => x.id)[0]).toBe('friend-p0');
  });
});
