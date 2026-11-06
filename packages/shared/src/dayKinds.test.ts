import { describe, expect, it } from 'vitest';
import { kindBeside, kindsOfDays, KINDS_WINDOW_DAYS, templateColor, templateForDate, type KindFacts } from './index';

// Kinds of day over many days (2026-11-06): the one reading behind Emerging's "Your kinds of day", the Reviews tile, the month
// calendar's marks and the Time blocks page's This month line.

// 2026-11-02 is a Monday.
const templates = [
  { id: 'every', name: 'Everyday' },
  { id: 'deep', name: 'Deep work day' },
  { id: 'family', name: 'Family day' },
];
const base: KindFacts = { templates, defaultId: 'every', pattern: ['deep', null, null, null, null, 'family', null], overrides: {} };

describe('kindsOfDays', () => {
  it('a date set to a template beats the weekly pattern', () => {
    const k = kindsOfDays({ ...base, overrides: { '2026-11-02': 'family' } }, '2026-11-02', '2026-11-02');
    expect(k.days).toEqual([{ date: '2026-11-02', templateId: 'family', from: 'date' }]);
  });
  it('a patterned day counts as the kind its weekday gives', () => {
    const k = kindsOfDays(base, '2026-11-02', '2026-11-08');
    expect(k.days.map((d) => d.templateId)).toEqual(['deep', null, null, null, null, 'family', null]);
    expect(k.tally).toEqual([
      { templateId: 'deep', name: 'Deep work day', days: 1 },
      { templateId: 'family', name: 'Family day', days: 1 },
    ]);
    expect(k.none).toBe(5);
  });
  it('a day on the default template counts as no kind, even when set for that date', () => {
    const k = kindsOfDays({ ...base, overrides: { '2026-11-02': 'every' } }, '2026-11-02', '2026-11-02');
    expect(k.days[0]).toEqual({ date: '2026-11-02', templateId: null, from: 'date' });
    expect(k.none).toBe(1);
    expect(k.tally).toEqual([]);
  });
  it('a deleted template counts as none: a date change falls back to the week, a weekday to the default', () => {
    const gone = kindsOfDays({ ...base, pattern: ['gone', null, null, null, null, null, null], overrides: { '2026-11-07': 'gone' } }, '2026-11-02', '2026-11-08');
    expect(gone.tally).toEqual([]);
    expect(gone.none).toBe(7);
    // The Saturday's own change is gone, so the Saturday follows the week again.
    const sat = kindsOfDays({ ...base, overrides: { '2026-11-07': 'gone' } }, '2026-11-07', '2026-11-07');
    expect(sat.days[0]).toEqual({ date: '2026-11-07', templateId: 'family', from: 'week' });
  });
  it('a date before the account, or with no pattern, counts as none', () => {
    const k = kindsOfDays({ ...base, since: '2026-11-03' }, '2026-11-02', '2026-11-03');
    expect(k.days[0]).toEqual({ date: '2026-11-02', templateId: null, from: null });
    expect(k.before).toBe(1);
    expect(k.none).toBe(1);
    const plain = kindsOfDays({ ...base, pattern: [null, null, null, null, null, null, null] }, '2026-11-02', '2026-11-29');
    expect(plain.tally).toEqual([]);
    expect(plain.none).toBe(28);
  });
  it('a key a person could type finds nothing', () => {
    const k = kindsOfDays({ ...base, overrides: { constructor: 'deep' } }, '2026-11-03', '2026-11-03');
    expect(k.days[0]!.templateId).toBeNull();
  });
  it('sorts the tally by days, then by name', () => {
    const k = kindsOfDays({ ...base, pattern: ['deep', 'family', 'family', null, null, null, null] }, '2026-11-02', '2026-11-08');
    expect(k.tally.map((t) => [t.name, t.days])).toEqual([
      ['Family day', 2],
      ['Deep work day', 1],
    ]);
    expect(KINDS_WINDOW_DAYS).toBe(28);
  });
  it('agrees with templateForDate, the rule Daily reads', () => {
    const ctx = { overrides: { '2026-11-04': 'family' }, pattern: base.pattern, defaultId: 'every', exists: (id: string) => templates.some((t) => t.id === id) };
    const k = kindsOfDays({ ...base, overrides: ctx.overrides }, '2026-11-02', '2026-11-15');
    for (const d of k.days) {
      const t = templateForDate(d.date, ctx).templateId;
      expect(d.templateId).toBe(t === 'every' ? null : t);
    }
  });
});

describe('templateColor', () => {
  const blocks = [
    { id: 'deep', color: 'red' as const },
    { id: 'busy', color: 'blue' as const },
    { id: 'sleep', color: 'slate' as const },
    { id: 'own', color: '#336699' as const },
  ];
  it('is the longest block over the day, leaving out the night that crosses midnight', () => {
    const t = { slots: [{ blockId: 'sleep', start: 1380, end: 420 }, { blockId: 'deep', start: 600, end: 780 }, { blockId: 'busy', start: 900, end: 1020 }] };
    expect(templateColor(t, blocks)).toBe('red');
  });
  it('adds a block up over its slots, and a tie goes to the one that starts first', () => {
    expect(templateColor({ slots: [{ blockId: 'busy', start: 480, end: 540 }, { blockId: 'deep', start: 600, end: 660 }, { blockId: 'busy', start: 900, end: 960 }] }, blocks)).toBe('blue');
    expect(templateColor({ slots: [{ blockId: 'deep', start: 600, end: 660 }, { blockId: 'busy', start: 480, end: 540 }] }, blocks)).toBe('blue');
  });
  it('a slot to midnight is a day slot; only crossing slots take the night; no slots have no colour', () => {
    expect(templateColor({ slots: [{ blockId: 'own', start: 1200, end: 0 }, { blockId: 'deep', start: 600, end: 660 }] }, blocks)).toBe('#336699');
    expect(templateColor({ slots: [{ blockId: 'sleep', start: 1320, end: 360 }] }, blocks)).toBe('slate');
    expect(templateColor({ slots: [] }, blocks)).toBeNull();
  });
  it('a template’s own colour comes first; with none it falls back to its longest block', () => {
    const slots = [{ blockId: 'deep', start: 600, end: 780 }];
    expect(templateColor({ slots, color: 'teal' }, blocks)).toBe('teal');
    expect(templateColor({ slots: [], color: '#1e90ff' }, blocks)).toBe('#1e90ff');
    expect(templateColor({ slots, color: null }, blocks)).toBe('red');
  });
});

describe('kindBeside', () => {
  it('sets a kind beside every other day and leaves out days with no value or before the account', () => {
    const k = kindsOfDays({ ...base, since: '2026-11-02' }, '2026-11-01', '2026-11-08');
    const v: Record<string, number> = { '2026-11-01': 99, '2026-11-02': 6, '2026-11-03': 2, '2026-11-04': 4 };
    const s = kindBeside(k.days, 'deep', (d) => v[d] ?? null);
    expect(s.on).toEqual({ n: 1, avg: 6 });
    expect(s.off).toEqual({ n: 2, avg: 3 });
  });
});
