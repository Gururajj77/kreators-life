import { describe, expect, it } from 'vitest';
import { STARTING_BLOCKS, STARTING_TEMPLATES, minuteOf, slotOrder, type Priority, type TemplateSlot, type TimeBlock } from './index';
import { blockIsFor, blockMismatch, blockMismatchLine, blockUsedMin, groupWithSuggestions, moveStartIn, slotsLeft, suggestLine, suggestWhy } from './blockHints';

const BLOCKS: TimeBlock[] = STARTING_BLOCKS.map((b, i) => ({ id: b.seed, seed: b.seed, name: b.name, tag: b.tag, color: b.color, area: b.area, pillar: b.pillar, sort: i }));
const EVERYDAY: TemplateSlot[] = slotOrder(STARTING_TEMPLATES.find((x) => x.seed === 'everyday')!.slots.map((s) => ({ blockId: s.block, start: minuteOf(s.start)!, end: minuteOf(s.end)! })));
const ctx = { slots: EVERYDAY, blocks: BLOCKS };

type T = { id: string; doDate: string | null; dueDate: string | null; dueTime: string | null; priority: Priority | null; timeBlockId?: string | null; lifeArea?: 'physical' | 'financial' | 'mental' | 'emotional' | 'spiritual' | null; relationship?: 'self' | 'friendship' | 'servant_leader' | 'guru'; estimateMin?: number | null };
const t = (id: string, o: Partial<T> = {}): T => ({ id, doDate: '2026-11-07', dueDate: null, dueTime: null, priority: null, relationship: 'self', ...o });

describe('suggested into a block', () => {
  it('puts a task with no block and no time into the block suggestBlock picks, after the placed ones', () => {
    const list = [t('placed', { timeBlockId: 'learn', priority: 2 }), t('read', { lifeArea: 'mental', priority: 0 }), t('call', { relationship: 'friendship', priority: 2 })];
    const groups = groupWithSuggestions(list, ctx);
    const learn = groups.find((g) => g.key === 'learn')!;
    expect(learn.tasks.map((x) => x.id)).toEqual(['placed', 'read']);
    expect(learn.suggested.map((x) => x.id)).toEqual(['read']);
    expect(learn.plannedMin).toBe(30);
    expect(groups.find((g) => g.key === 'social')!.suggested.map((x) => x.id)).toEqual(['call']);
    expect(groups.some((g) => g.key === 'none')).toBe(false);
  });
  it('leaves a timed task, a picked one and one with no match in No block yet', () => {
    const list = [t('night', { dueTime: '23:59', priority: 3 }), t('p3', { relationship: 'guru', priority: 3, lifeArea: null })];
    const noMatch = BLOCKS.map((b) => ({ ...b, area: null, pillar: null }));
    const groups = groupWithSuggestions([...list, t('nomatch', { priority: 3 })], { slots: EVERYDAY, blocks: noMatch });
    expect(groups.find((g) => g.key === 'none')!.tasks.map((x) => x.id)).toEqual(['p3', 'nomatch']);
    expect(groups.find((g) => g.key === 'sleep')!.tasks.map((x) => x.id)).toEqual(['night']);
  });
  it('counts each suggestion toward the room left for the next', () => {
    const blocks = [...BLOCKS, { id: 'write', seed: null, name: 'Writing', tag: 'Focus', color: 'sky' as const, area: 'financial' as const, pillar: null, sort: 99 }];
    const slots = slotOrder([...EVERYDAY.filter((s) => s.blockId !== 'busy'), { blockId: 'write', start: 900, end: 1020 }]);
    const list = [t('a', { lifeArea: 'financial', priority: 0, estimateMin: 120 }), t('b', { lifeArea: 'financial', priority: 0, estimateMin: 90 })];
    const groups = groupWithSuggestions(list, { slots, blocks, used: { deep: 30 } });
    expect(groups.find((g) => g.key === 'deep')!.suggested.map((x) => x.id)).toEqual(['a']);
    expect(groups.find((g) => g.key === 'write')!.suggested.map((x) => x.id)).toEqual(['b']);
  });
  it('spreads a pillar’s tasks over its blocks with room, instead of piling them into the first', () => {
    const groups = groupWithSuggestions([t('a'), t('b'), t('c')], ctx);
    expect(groups.find((g) => g.key === 'hygiene')!.suggested.map((x) => x.id)).toEqual(['a', 'b']);
    expect(groups.find((g) => g.key === 'recovery')!.suggested.map((x) => x.id)).toEqual(['c']);
  });
  it('never suggests the night’s sleep, a full block or a block that is over', () => {
    // Twelve Yourself tasks: hygiene, recovery and self love fill up, and the rest stay in No block yet rather than going to Sleep.
    const many = Array.from({ length: 12 }, (_, i) => t(`s${i}`));
    const groups = groupWithSuggestions(many, ctx);
    expect(groups.find((g) => g.key === 'sleep')?.suggested ?? []).toEqual([]);
    const placed = groups.flatMap((g) => g.suggested.map((x) => x.id));
    expect(placed.length).toBeLessThan(12);
    expect(groups.find((g) => g.key === 'none')!.tasks.length).toBe(12 - placed.length);
    // At 9:00 pm, Morning hygiene and Recovery are over: a Yourself task goes to Self love (10:00 pm), or nowhere once that is full.
    const evening = groupWithSuggestions([t('a'), t('b'), t('c')], { ...ctx, after: 21 * 60 });
    expect(evening.find((g) => g.key === 'selflove')!.suggested.map((x) => x.id)).toEqual(['a', 'b']);
    expect(evening.find((g) => g.key === 'none')!.tasks.map((x) => x.id)).toEqual(['c']);
  });
  it('keeps the part of the day still to come', () => {
    const left = slotsLeft(EVERYDAY, 10 * 60 + 50);
    expect(left.some((s) => s.blockId === 'hygiene')).toBe(false);
    expect(left.find((s) => s.blockId === 'deep')!.start).toBe(11 * 60);
    expect(left.find((s) => s.blockId === 'sleep')!.start).toBe(23 * 60);
    expect(slotsLeft(EVERYDAY, null)).toEqual(EVERYDAY);
  });
  it('reads the used minutes from the server’s per-slot sums', () => {
    expect(blockUsedMin(EVERYDAY, EVERYDAY.map((_, i) => (i === 2 ? 45 : 0)))!.deep).toBe(45);
    expect(blockUsedMin(EVERYDAY, [1, 2])).toBeUndefined();
  });
  it('says why in plain words', () => {
    const social = BLOCKS.find((b) => b.id === 'social')!;
    expect(suggestWhy({ relationship: 'friendship' }, social)).toBe('pillar');
    expect(suggestLine('pillar', social)).toBe('It fits here by its pillar, Friends.');
    expect(suggestLine('area', social)).toBe('It fits here by its area, Emotional.');
  });
});

describe('a task in a block meant for another area or pillar', () => {
  it('prompts only for a block reached by time, meant for someone else, with a better block that day', () => {
    // A self task about money at 17:30 sits in Fun/social (Friends, emotional); Busy work (financial, not Focus) fits a P2.
    const m = blockMismatch(t('x', { dueTime: '17:30', lifeArea: 'financial', priority: 2 }), EVERYDAY, BLOCKS);
    expect(m).toMatchObject({ block: { id: 'social' }, better: { id: 'busy' }, start: '15:00' });
    expect(blockMismatchLine(m!)).toBe('Fun/social is for Friends. This fits Busy work, 3:00 pm to 5:00 pm.');
  });
  it('never asks for a picked block, a fitting one, a block for nobody, or with no better block', () => {
    expect(blockMismatch(t('x', { dueTime: '17:30', timeBlockId: 'social', lifeArea: 'financial', priority: 2 }), EVERYDAY, BLOCKS)).toBeNull();
    expect(blockMismatch(t('x', { dueTime: '17:30', relationship: 'friendship', priority: 2 }), EVERYDAY, BLOCKS)).toBeNull();
    const travel = slotOrder([...EVERYDAY.filter((s) => s.blockId !== 'social'), { blockId: 'travel', start: 1020, end: 1140 }]);
    expect(blockMismatch(t('x', { dueTime: '17:30', lifeArea: 'financial', priority: 2 }), travel, BLOCKS)).toBeNull();
    // A P0 with no area or pillar match anywhere gets only the Focus fallback, which is not enough to ask.
    const noMatch = BLOCKS.map((b) => (b.id === 'social' ? b : { ...b, area: null, pillar: null }));
    expect(blockMismatch(t('x', { dueTime: '17:30', relationship: 'guru', priority: 0 }), EVERYDAY, noMatch)).toBeNull();
    expect(blockMismatch(t('x', { dueTime: null, lifeArea: 'financial', priority: 2 }), EVERYDAY, BLOCKS)).toBeNull();
  });
  it('never points at bedtime, a full block or one that is over', () => {
    // A Yourself task about the body at 5:30 pm with hygiene and recovery full: no Sleep at 11:00 pm, no prompt.
    expect(blockMismatch(t('x', { dueTime: '17:30', lifeArea: 'physical', priority: 3 }), EVERYDAY, BLOCKS, { used: { hygiene: 60, recovery: 120 } })).toBeNull();
    // A P0 about money with Deep work full has nowhere better to go.
    expect(blockMismatch(t('x', { dueTime: '17:30', lifeArea: 'financial', priority: 0 }), EVERYDAY, BLOCKS, { used: { deep: 180 } })).toBeNull();
    // In the evening, a Yourself task in Entertainment is pointed at Self love (10:00 pm), never at Morning hygiene (7:00 am).
    const m = blockMismatch(t('x', { dueTime: '19:30', relationship: 'self', priority: 2 }), EVERYDAY, BLOCKS, { after: 19 * 60 + 40 });
    expect(m).toMatchObject({ better: { id: 'selflove' }, start: '22:00' });
    expect(blockMismatch(t('x', { dueTime: '19:30', relationship: 'self', priority: 2 }), EVERYDAY, BLOCKS)).toMatchObject({ better: { id: 'hygiene' }, start: '07:00' });
  });
  it('Move it takes the block’s first start where the task fits whole, past timed tasks and the time now', () => {
    expect(moveStartIn('busy', EVERYDAY)).toMatchObject({ start: '15:00' });
    expect(moveStartIn('busy', EVERYDAY, [{ dueTime: '15:00', estimateMin: 25 }])!.start).toBe('15:30');
    // A 60-minute task never lands on a task at 15:15; it waits until 15:45.
    expect(moveStartIn('busy', EVERYDAY, [{ dueTime: '15:15', estimateMin: 30 }], 60)!.start).toBe('15:45');
    expect(moveStartIn('busy', EVERYDAY, [{ dueTime: '15:00', estimateMin: 120 }])).toBeNull();
    expect(moveStartIn('busy', EVERYDAY, [], 30, 15 * 60 + 5)!.start).toBe('15:15');
    expect(moveStartIn('busy', EVERYDAY, [], 30, 17 * 60)).toBeNull();
    // Longer than the block: it takes the block from its start.
    expect(moveStartIn('busy', EVERYDAY, [], 180)!.start).toBe('15:00');
    expect(moveStartIn('nope', EVERYDAY)).toBeNull();
  });
  it('names who a block is for', () => {
    expect(blockIsFor({ area: 'emotional', pillar: null })).toBe('the emotional area');
    expect(blockIsFor({ area: null, pillar: null })).toBeNull();
  });
});
