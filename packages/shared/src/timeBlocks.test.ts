import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DAY_TYPE_KEYS,
  DAY_TYPES,
  STARTING_BLOCKS,
  STARTING_TEMPLATES,
  SWATCH_META,
  TIME_BLOCK_SWATCHES,
  MAX_TEMPLATE_SLOTS,
  blockOfTask,
  dayTemplateProblem,
  groupTasks,
  isSwatch,
  blockColorOf,
  isTaskSort,
  minuteOf,
  mondayOf,
  overrideTemplateId,
  parseSlots,
  planWeek,
  slotContains,
  slotLength,
  slotOrder,
  slotsOverlap,
  sortTasks,
  startingTemplateFor,
  suggestBlock,
  templateForDate,
  timeBlockProblem,
  weekDates,
  weekdayOf,
  type PlanTask,
  type Priority,
  type TemplateSlot,
  type TimeBlock,
} from './index';

// The starting set as a person's rows: a block's id is its seed, so the tests read plainly.
const BLOCKS: TimeBlock[] = STARTING_BLOCKS.map((b, i) => ({ id: b.seed, seed: b.seed, name: b.name, tag: b.tag, color: b.color, area: b.area, pillar: b.pillar, sort: i }));
const slotsFor = (seed: string): TemplateSlot[] => {
  const t = STARTING_TEMPLATES.find((x) => x.seed === seed)!;
  return slotOrder(t.slots.map((s) => ({ blockId: s.block, start: minuteOf(s.start)!, end: minuteOf(s.end)! })));
};
const EVERYDAY = slotsFor('everyday');

describe('swatches', () => {
  it('names every swatch and refuses anything else', () => {
    for (const k of TIME_BLOCK_SWATCHES) expect(SWATCH_META[k].name.length).toBeGreaterThan(2);
    expect(isSwatch('red')).toBe(true);
    expect(isSwatch('constructor')).toBe(false);
    expect(isSwatch('#ff0000')).toBe(false);
    // The picker is the founder's colour wheel, eleven round it and your own as the twelfth; a person's own colour is a hex, kept as six lower-case digits.
    expect(TIME_BLOCK_SWATCHES).toHaveLength(11);
    expect(blockColorOf('#FF0000')).toBe('#ff0000');
    expect(blockColorOf('abc')).toBe('#aabbcc');
    expect(blockColorOf('teal')).toBe('teal');
    expect(blockColorOf('slate')).toBe('slate');
    expect(blockColorOf('#12345')).toBeNull();
    expect(blockColorOf('constructor')).toBeNull();
    expect(blockColorOf('url(x)')).toBeNull();
  });
});

describe('time helpers', () => {
  it('reads only a real clock time', () => {
    expect(minuteOf('07:30')).toBe(450);
    expect(minuteOf('00:00')).toBe(0);
    for (const bad of ['24:00', '7:00', '07:60', '', null, 700]) expect(minuteOf(bad)).toBeNull();
  });
  it('measures slots that cross midnight', () => {
    expect(slotLength({ start: 1380, end: 420 })).toBe(480);
    expect(slotLength({ start: 1320, end: 0 })).toBe(120);
    expect(slotContains({ start: 1380, end: 420 }, 120)).toBe(true);
    expect(slotContains({ start: 1380, end: 420 }, 420)).toBe(false);
    expect(slotContains({ start: 600, end: 780 }, 630)).toBe(true);
  });
  it('finds overlaps, wrapping included, and lets ends touch', () => {
    expect(slotsOverlap({ start: 1380, end: 420 }, { start: 360, end: 480 })).toBe(true);
    expect(slotsOverlap({ start: 1380, end: 420 }, { start: 420, end: 480 })).toBe(false);
    expect(slotsOverlap({ start: 600, end: 780 }, { start: 780, end: 900 })).toBe(false);
    expect(slotsOverlap({ start: 600, end: 780 }, { start: 720, end: 900 })).toBe(true);
  });
});

describe('parseSlots', () => {
  const ids = new Set(['deep', 'recovery']);
  const names = { deep: 'Deep work', recovery: 'Recovery' };
  it('refuses an overlap and names both', () => {
    const r = parseSlots([{ blockId: 'deep', start: '10:00', end: '13:00' }, { blockId: 'recovery', start: '12:00', end: '15:00' }], ids, names);
    expect('problem' in r && r.problem).toMatch(/Deep work .* overlaps Recovery/);
  });
  it('refuses an unknown block, a zero slot and too many', () => {
    expect('problem' in parseSlots([{ blockId: 'other', start: '10:00', end: '11:00' }], ids)).toBe(true);
    expect('problem' in parseSlots([{ blockId: 'deep', start: '10:00', end: '10:00' }], ids)).toBe(true);
    const many = Array.from({ length: MAX_TEMPLATE_SLOTS + 1 }, (_, i) => ({ blockId: 'deep', start: `${String(i % 24).padStart(2, '0')}:00`, end: `${String(i % 24).padStart(2, '0')}:30` }));
    expect('problem' in parseSlots(many, ids)).toBe(true);
  });
  it('sorts by start', () => {
    const r = parseSlots([{ blockId: 'recovery', start: '13:00', end: '15:00' }, { blockId: 'deep', start: '10:00', end: '13:00' }], ids);
    expect('slots' in r && r.slots.map((s) => s.blockId)).toEqual(['deep', 'recovery']);
  });
});

describe('the starting set', () => {
  it('Everyday is exactly the founder’s ten at the founder’s times, all day long', () => {
    const t = STARTING_TEMPLATES.find((x) => x.seed === 'everyday')!;
    expect(t.isDefault).toBe(true);
    expect(t.slots).toEqual([
      { block: 'hygiene', start: '07:00', end: '08:00' },
      { block: 'routine', start: '08:00', end: '10:00' },
      { block: 'deep', start: '10:00', end: '13:00' },
      { block: 'recovery', start: '13:00', end: '15:00' },
      { block: 'busy', start: '15:00', end: '17:00' },
      { block: 'social', start: '17:00', end: '19:00' },
      { block: 'fun', start: '19:00', end: '21:00' },
      { block: 'learn', start: '21:00', end: '22:00' },
      { block: 'selflove', start: '22:00', end: '23:00' },
      { block: 'sleep', start: '23:00', end: '07:00' },
    ]);
    expect(EVERYDAY.reduce((n, s) => n + slotLength(s), 0)).toBe(1440);
    expect(STARTING_BLOCKS.find((b) => b.seed === 'sleep')!.tag).toBe('Recovery');
  });
  it('has one default, and every template is overlap-free with known blocks', () => {
    expect(STARTING_TEMPLATES.filter((t) => t.isDefault)).toHaveLength(1);
    const seeds = new Set(STARTING_BLOCKS.map((b) => b.seed));
    for (const t of STARTING_TEMPLATES) {
      const r = parseSlots(t.slots.map((s) => ({ blockId: s.block, start: s.start, end: s.end })), seeds);
      expect('slots' in r, `${t.name}: ${'problem' in r ? r.problem : ''}`).toBe(true);
    }
    expect(new Set(STARTING_TEMPLATES.map((t) => t.seed)).size).toBe(STARTING_TEMPLATES.length);
    expect(new Set(STARTING_BLOCKS.map((b) => b.seed)).size).toBe(STARTING_BLOCKS.length);
  });
  it('carries every old kind of day with its lead and second', () => {
    for (const k of DAY_TYPE_KEYS) {
      const t = startingTemplateFor(k);
      const d = DAY_TYPES.find((x) => x.key === k)!;
      expect([t.lead, t.second, t.why, t.source]).toEqual([d.lead, d.second, d.why, d.source]);
    }
  });
  it('checks a block and a template as sent', () => {
    expect(timeBlockProblem({ name: 'Deep work', color: 'red' }, false)).toBeNull();
    expect(timeBlockProblem({ name: '', color: 'red' }, false)).toBeTruthy();
    expect(timeBlockProblem({ name: 'X', color: 'pink' }, false)).toBeTruthy();
    expect(timeBlockProblem({ area: 'body' }, true)).toBeTruthy();
    expect(timeBlockProblem({ pillar: 'constructor' }, true)).toBeTruthy();
    expect(dayTemplateProblem({ name: 'My day', lead: 'self' }, false)).toBeNull();
    expect(dayTemplateProblem({ name: 'My day', lead: 'self', second: 'self' }, false)).toBeTruthy();
    expect(dayTemplateProblem({ name: 'My day' }, false)).toBeTruthy();
    // A template's own colour: a swatch, a person's hex, or none (back to its longest block's); anything else is refused.
    expect(dayTemplateProblem({ color: 'teal' }, true)).toBeNull();
    expect(dayTemplateProblem({ color: '#1E90FF' }, true)).toBeNull();
    expect(dayTemplateProblem({ color: null }, true)).toBeNull();
    expect(dayTemplateProblem({ color: '' }, true)).toBeNull();
    expect(dayTemplateProblem({ color: 'pink' }, true)).toBeTruthy();
    expect(dayTemplateProblem({ color: 'constructor' }, true)).toBeTruthy();
    expect(dayTemplateProblem({ color: 42 }, true)).toBeTruthy();
  });
});

describe('the starting templates’ colours', () => {
  // Fourteen templates over eleven wheel colours: three must share, and only these three pairs do (docs/time-blocks.md).
  const SHARED = [
    ['everyday', 'lowenergy'],
    ['create', 'travel'],
    ['money', 'selflove'],
  ];
  it('each wears a wheel colour, every wheel colour is used, and only the three named pairs share', () => {
    for (const t of STARTING_TEMPLATES) expect((TIME_BLOCK_SWATCHES as readonly string[]).includes(t.color), t.name).toBe(true);
    expect(new Set(STARTING_TEMPLATES.map((t) => t.color)).size).toBe(TIME_BLOCK_SWATCHES.length);
    const by = new Map<string, string[]>();
    for (const t of STARTING_TEMPLATES) by.set(t.color, [...(by.get(t.color) ?? []), t.seed]);
    const pairs = [...by.values()].filter((l) => l.length > 1).map((l) => [...l].sort());
    expect(pairs.sort()).toEqual(SHARED.map((p) => [...p].sort()).sort());
  });
  it('the migration gives each existing starting template the same colour', () => {
    const sql = readFileSync(new URL('../../../apps/api/migrations/0098_day_template_color.sql', import.meta.url), 'utf8');
    for (const t of STARTING_TEMPLATES) {
      expect(sql, t.seed).toContain(`WHEN '${t.seed}' THEN '${t.color}'`);
      if (t.sourceKind) expect(sql, t.sourceKind).toContain(`WHEN '${t.sourceKind}' THEN '${t.color}'`);
    }
  });
});

describe('which template a date uses', () => {
  const exists = (id: string) => ['a', 'b', 'def'].includes(id);
  const ctx = { overrides: { '2026-11-03': 'b' } as Record<string, string>, pattern: ['a', null, null, null, null, null, null], defaultId: 'def', exists };
  it('a date change wins over the week, the week over the default', () => {
    expect(templateForDate('2026-11-03', ctx)).toEqual({ templateId: 'b', from: 'date' });
    expect(templateForDate('2026-11-02', ctx)).toEqual({ templateId: 'a', from: 'week' });
    expect(templateForDate('2026-11-04', ctx)).toEqual({ templateId: 'def', from: 'default' });
  });
  it('falls through a deleted template', () => {
    expect(templateForDate('2026-11-03', { ...ctx, overrides: { '2026-11-03': 'gone' } })).toEqual({ templateId: 'def', from: 'default' });
    expect(templateForDate('2026-11-03', { ...ctx, overrides: { constructor: 'b' } })).toEqual({ templateId: 'def', from: 'default' });
  });
  it('maps an old kind row to its template', () => {
    const tpls = [{ id: 't1', sourceKind: 'family' as const }, { id: 't2', sourceKind: null }];
    expect(overrideTemplateId({ kind: 'family', template_id: null }, tpls)).toBe('t1');
    expect(overrideTemplateId({ kind: 'template', template_id: 't2' }, tpls)).toBe('t2');
    expect(overrideTemplateId({ kind: 'money', template_id: null }, tpls)).toBeNull();
  });
  it('knows the weekdays', () => {
    expect(weekdayOf('2026-11-02')).toBe(1);
    expect(weekdayOf('2026-11-08')).toBe(7);
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(weekDates('2026-11-02')).toHaveLength(7);
  });
});

describe('tasks and blocks', () => {
  it('a picked block wins over the time; a time falls in its slot', () => {
    expect(blockOfTask({ timeBlockId: 'learn', dueTime: '10:30' }, EVERYDAY)).toEqual({ blockId: 'learn', how: 'picked' });
    expect(blockOfTask({ dueTime: '10:30' }, EVERYDAY)).toEqual({ blockId: 'deep', how: 'time' });
    expect(blockOfTask({ dueTime: '02:00' }, EVERYDAY)).toEqual({ blockId: 'sleep', how: 'time' });
    expect(blockOfTask({ dueTime: null }, EVERYDAY)).toBeNull();
  });
  const task = (o: { lifeArea?: 'financial' | 'mental' | null; relationship?: 'self' | 'friendship' | 'servant_leader'; priority: Priority | null; estimateMin?: number | null }) => ({ estimateMin: 60, ...o });
  it('suggests a block from the area, the pillar and the priority', () => {
    expect(suggestBlock(task({ lifeArea: 'financial', priority: 0 }), EVERYDAY, BLOCKS)).toBe('deep');
    expect(suggestBlock(task({ lifeArea: 'financial', priority: 3 }), EVERYDAY, BLOCKS)).toBe('busy');
    expect(suggestBlock(task({ lifeArea: 'mental', priority: null }), EVERYDAY, BLOCKS)).toBe('learn');
    expect(suggestBlock(task({ relationship: 'friendship', priority: 2 }), EVERYDAY, BLOCKS)).toBe('social');
  });
  it('sends a P1 with no match to the first Focus block, and a P3 nowhere', () => {
    const noMatch = BLOCKS.map((b) => ({ ...b, area: null, pillar: null }));
    expect(suggestBlock(task({ lifeArea: 'mental', priority: 1 }), EVERYDAY, noMatch)).toBe('deep');
    expect(suggestBlock(task({ lifeArea: 'mental', priority: 3 }), EVERYDAY, noMatch)).toBeNull();
  });
  it('moves on to the next Focus block with room when the first is full', () => {
    const blocks = [...BLOCKS, { id: 'write', seed: null, name: 'Writing', tag: 'Focus', color: 'sky' as const, area: 'financial' as const, pillar: null, sort: 99 }];
    const slots = slotOrder([...EVERYDAY.filter((s) => s.blockId !== 'busy'), { blockId: 'write', start: 900, end: 1020 }]);
    expect(suggestBlock(task({ lifeArea: 'financial', priority: 0 }), slots, blocks, { deep: 180 })).toBe('write');
    expect(suggestBlock(task({ lifeArea: 'financial', priority: 0 }), slots, blocks, { deep: 180, write: 120 })).toBe('deep');
  });
});

describe('grouping and the grouped sorts', () => {
  type T = { id: string; doDate: string | null; dueDate: string | null; dueTime: string | null; priority: Priority | null; timeBlockId?: string | null; lifeArea?: 'physical' | 'financial' | 'mental' | 'emotional' | 'spiritual' | null; estimateMin?: number | null };
  const t = (id: string, o: Partial<T> = {}): T => ({ id, doDate: '2026-11-04', dueDate: null, dueTime: null, priority: null, ...o });
  const list = [
    t('learn-p3', { dueTime: '21:15', priority: 3, lifeArea: 'mental' }),
    t('deep-p2', { dueTime: '10:30', priority: 2, lifeArea: 'financial' }),
    t('deep-p0', { timeBlockId: 'deep', priority: 0 }),
    t('travel', { timeBlockId: 'travel', priority: 1 }),
    t('loose-p0', { priority: 0, lifeArea: 'physical' }),
  ];
  const ctx = { slots: EVERYDAY, blocks: BLOCKS };
  it('is a sort the picker knows', () => {
    expect(isTaskSort('block')).toBe(true);
    expect(isTaskSort('area')).toBe(true);
  });
  it('groups by block in clock order, then picked blocks not in the day, then none, P0 first inside each', () => {
    const groups = groupTasks(list, 'block', ctx);
    expect(groups.slice(0, 10).map((g) => g.key)).toEqual(['hygiene', 'routine', 'deep', 'recovery', 'busy', 'social', 'fun', 'learn', 'selflove', 'sleep']);
    expect(groups[10]).toMatchObject({ key: 'travel', inDay: false, minutes: 0 });
    expect(groups[11]).toMatchObject({ key: 'none', name: 'No block yet' });
    const deep = groups.find((g) => g.key === 'deep')!;
    expect(deep.tasks.map((x) => x.id)).toEqual(['deep-p0', 'deep-p2']);
    expect(deep.minutes).toBe(180);
    expect(deep.plannedMin).toBe(60);
    expect(groups.find((g) => g.key === 'hygiene')!.tasks).toEqual([]);
  });
  it('groups by area in the five areas’ order', () => {
    const groups = groupTasks(list, 'area', ctx);
    expect(groups.map((g) => g.key)).toEqual(['physical', 'financial', 'mental', 'none']);
    expect(groups[3]!.tasks.map((x) => x.id)).toEqual(['deep-p0', 'travel']);
  });
  it('the flat sorts keep the group order', () => {
    expect(sortTasks(list, 'block', { lead: 'self', ...ctx }).map((x) => x.id)).toEqual(['deep-p0', 'deep-p2', 'learn-p3', 'travel', 'loose-p0']);
    expect(sortTasks(list, 'area', { lead: 'self', ...ctx }).map((x) => x.id)[0]).toBe('loose-p0');
  });
});

describe('the week plan with time blocks', () => {
  const today = '2026-11-02';
  const task = (id: string, o: Partial<PlanTask> = {}): PlanTask => ({ id, title: `Task ${id}`, relationship: 'self', estimateMin: 60, priority: null, doDate: null, dueDate: null, ...o });
  const tasks = [task('a', { lifeArea: 'financial', priority: 0 }), task('b', { priority: 3 }), task('c', { doDate: today, timeBlockId: 'learn', estimateMin: 120 })];
  const blocking = { days: weekDates(today).map((date) => ({ date, slots: EVERYDAY, templateId: 't-everyday', templateName: 'Everyday' })), blocks: BLOCKS };
  it('leaves the plan as it was without blocks', () => {
    const plain = planWeek(today, tasks);
    expect(plain.suggestions.every((s) => s.blockId === null)).toBe(true);
    expect(plain.attention.some((a) => a.kind === 'blockFull' || a.kind === 'blockEmpty')).toBe(false);
    expect(plain.days[0]!.templateName).toBeUndefined();
  });
  it('suggests a block, names the day template and flags full and empty blocks', () => {
    const p = planWeek(today, tasks, 600, blocking);
    expect(p.suggestions.find((s) => s.id === 'a')!.blockId).toBe('deep');
    expect(p.days[0]!.templateName).toBe('Everyday');
    expect(p.attention.find((a) => a.kind === 'blockFull')!.text).toMatch(/Learn\/explore on Mon holds 2h of 1h/);
    expect(p.attention.find((a) => a.kind === 'blockEmpty')!.text).toMatch(/Deep work is empty on/);
  });
  it('gives a timed task with no pick the block its time falls in, before its area and pillar', () => {
    const timed = task('t', { lifeArea: 'financial', priority: 3, dueTime: '10:30' });
    expect(suggestBlock(timed, EVERYDAY, BLOCKS)).toBe('busy');
    const p = planWeek(today, [timed], 600, blocking);
    expect(p.suggestions.find((s) => s.id === 't')!.blockId).toBe('deep');
    expect(p.suggestions.find((s) => s.id === 't')!.blockHow).toBe('time');
    const picked = planWeek(today, [{ ...timed, timeBlockId: 'learn' }], 600, blocking);
    expect(picked.suggestions.find((s) => s.id === 't')!.blockId).toBe('learn');
  });
});

describe('time blocks in help', () => {
  it('has a How it works entry and every word it leans on', async () => {
    const { HOW_TO, TERMS, TASK_SORTS } = await import('./index');
    const how = HOW_TO.timeBlocks!;
    expect(how.steps.length).toBeGreaterThanOrEqual(3);
    expect(how.steps.length).toBeLessThanOrEqual(5);
    for (const w of ['time block', 'day template', 'weekly pattern', 'by time block', 'by area']) {
      expect(TERMS[w], w).toBeTruthy();
      expect(how.terms).toContain(w);
      expect(HOW_TO.today!.terms).toContain(w);
    }
    // The two grouped sorts the words name exist under those names.
    expect(TASK_SORTS.map((s) => s.name)).toEqual(expect.arrayContaining(['By time block', 'By area']));
    // The numbers the steps give are the real ones.
    const { MAX_TIME_BLOCKS, MAX_TEMPLATE_SLOTS, STARTING_BLOCKS: blocks, STARTING_TEMPLATES: templates } = await import('./index');
    expect(how.steps[0]).toContain(`keep up to ${MAX_TIME_BLOCKS}`);
    expect(how.steps[0]).toContain(`${(await import('./index')).TIME_BLOCK_SWATCHES.length} swatches or your own`);
    expect(how.steps[0]).toContain(`You start with ${blocks.length}`);
    expect(how.steps[1]).toContain(`up to ${MAX_TEMPLATE_SLOTS} slots`);
    expect(how.steps[1]).toContain(`You start with ${templates.length} templates`);
  });
});
