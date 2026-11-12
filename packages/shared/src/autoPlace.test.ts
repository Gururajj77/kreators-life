import { describe, expect, it } from 'vitest';
import { STARTING_BLOCKS, STARTING_TEMPLATES, minuteOf, slotOrder, suggestBlock, type Priority, type TemplateSlot, type TimeBlock } from './index';
import { autoPlace, autoPlaceOrder, blockUsedMin, groupWithSuggestions, noRoomLine, type AutoPlaceTask } from './blockHints';

// The starting set as a person's rows: a block's id is its seed, so the tests read plainly.
const BLOCKS: TimeBlock[] = STARTING_BLOCKS.map((b, i) => ({ id: b.seed, seed: b.seed, name: b.name, tag: b.tag, color: b.color, area: b.area, pillar: b.pillar, sort: i }));
const slotsFor = (seed: string): TemplateSlot[] => slotOrder(STARTING_TEMPLATES.find((x) => x.seed === seed)!.slots.map((s) => ({ blockId: s.block, start: minuteOf(s.start)!, end: minuteOf(s.end)! })));
const EVERYDAY = slotsFor('everyday');
const ctx = { slots: EVERYDAY, blocks: BLOCKS };

type Area = 'physical' | 'financial' | 'mental' | 'emotional' | 'spiritual';
const t = (id: string, o: Partial<AutoPlaceTask> & { lifeArea?: Area | null } = {}): AutoPlaceTask => ({ id, priority: null, dueDate: null, dueTime: null, estimateMin: 30, relationship: 'self', ...o });
const at = (plan: ReturnType<typeof autoPlace>, id: string) => plan.placed.find((p) => p.taskId === id);
const hm = (s: string) => minuteOf(s)!;

describe('the order Place my day takes tasks in', () => {
  it('is P0, P1, no priority, P2, P3; then the soonest due date; then from a pillar; then the longest; then the id', () => {
    const list = [
      t('p3', { priority: 3 }),
      t('none', { priority: null }),
      t('p2', { priority: 2 }),
      t('p1', { priority: 1 }),
      t('p0', { priority: 0 }),
    ];
    expect(autoPlaceOrder(list).map((x) => x.id)).toEqual(['p0', 'p1', 'none', 'p2', 'p3']);
    const same = [
      t('d', { priority: 1, dueDate: null }),
      t('c', { priority: 1, dueDate: '2026-11-20' }),
      t('b', { priority: 1, dueDate: '2026-11-13', estimateMin: 15 }),
      t('a', { priority: 1, dueDate: '2026-11-13', estimateMin: 90 }),
      t('z', { priority: 1, dueDate: '2026-11-13', estimateMin: 15, fromPillar: true }),
      t('y', { priority: 1, dueDate: '2026-11-13', estimateMin: 15, fromPillar: true }),
    ];
    expect(autoPlaceOrder(same).map((x) => x.id)).toEqual(['y', 'z', 'a', 'b', 'c', 'd']);
  });
});

describe('Place my day', () => {
  it('lets the area beat the pillar, and sends P0 and P1 to Focus first, P2 and P3 elsewhere first', () => {
    const plan = autoPlace(
      [
        t('focus', { priority: 0, lifeArea: 'financial', relationship: 'friendship' }),
        t('admin', { priority: 3, lifeArea: 'financial', relationship: 'friendship' }),
        t('friend', { priority: 2, relationship: 'friendship' }),
        t('read', { priority: 1, lifeArea: 'mental' }),
      ],
      ctx,
    );
    expect(at(plan, 'focus')).toMatchObject({ blockId: 'deep', start: '10:00', end: '10:30', why: 'area' });
    expect(at(plan, 'admin')).toMatchObject({ blockId: 'busy', start: '15:00', why: 'area' });
    expect(at(plan, 'friend')).toMatchObject({ blockId: 'social', start: '17:00', why: 'pillar' });
    expect(at(plan, 'read')).toMatchObject({ blockId: 'learn', start: '21:00', why: 'area' });
    expect(plan.noRoom).toEqual([]);
  });
  it('sends a P0 that fits no block to a Focus block, and lists a P3 that fits none as No room today', () => {
    const plain = BLOCKS.map((b) => ({ ...b, area: null, pillar: null }));
    const plan = autoPlace([t('urgent', { priority: 0, lifeArea: 'mental' }), t('later', { priority: 3, lifeArea: 'mental' })], { slots: EVERYDAY, blocks: plain });
    expect(at(plan, 'urgent')).toMatchObject({ blockId: 'deep', why: 'focus' });
    expect(plan.noRoom).toEqual([{ taskId: 'later', reason: 'noMatch', blockId: null, line: 'No block today fits its area or pillar.' }]);
  });
  it('agrees with suggestBlock on the first task’s block', () => {
    for (const p of [0, 1, 2, 3, null] as (Priority | null)[]) {
      const task = t('x', { priority: p, lifeArea: 'financial' });
      const plan = autoPlace([task], ctx);
      // suggestBlock treats no priority as high; Place my day takes the matches in clock order, so Deep work comes first there too.
      expect(at(plan, 'x')!.blockId).toBe(suggestBlock({ lifeArea: 'financial', priority: p, estimateMin: 30 }, EVERYDAY, BLOCKS));
    }
  });
  it('never places a task in the night’s sleep', () => {
    // Twelve Yourself tasks of an hour: hygiene (1 h), recovery (2 h) and self love (1 h) take four, and the rest have no room.
    const many = Array.from({ length: 12 }, (_, i) => t(`s${String(i).padStart(2, '0')}`, { estimateMin: 60 }));
    const plan = autoPlace(many, ctx);
    expect(plan.placed.some((p) => p.blockId === 'sleep')).toBe(false);
    expect(plan.placed.map((p) => p.blockId)).toEqual(['hygiene', 'recovery', 'recovery', 'selflove']);
    expect(plan.noRoom).toHaveLength(8);
    expect(plan.noRoom[0]).toMatchObject({ reason: 'full', blockId: 'hygiene', line: 'Morning hygiene is full today.' });
  });
  it('never places a task in time already gone today, and starts on the quarter hour', () => {
    const plan = autoPlace([t('money', { priority: 0, lifeArea: 'financial' }), t('rest')], { ...ctx, after: 10 * 60 + 7 });
    expect(at(plan, 'money')!.start).toBe('10:15');
    // Morning hygiene is over by 10:07, so a Yourself task goes to Recovery.
    expect(at(plan, 'rest')).toMatchObject({ blockId: 'recovery', start: '13:00' });
    const late = autoPlace([t('money', { priority: 0, lifeArea: 'financial' })], { ...ctx, after: 14 * 60 + 5 });
    // Deep work is over; a P0 then takes the financial block that is left.
    expect(at(late, 'money')).toMatchObject({ blockId: 'busy', start: '15:00' });
    const night = autoPlace([t('money', { priority: 0, lifeArea: 'financial' })], { ...ctx, after: 23 * 60 + 30 });
    expect(night.noRoom).toEqual([{ taskId: 'money', reason: 'dayOver', blockId: null, line: 'The day’s blocks are over.' }]);
    // At 8 pm a Servitude task's blocks are behind the clock while Self love is still to come: the day's blocks are over, not "none fits".
    const evening = autoPlace([t('work', { priority: 2, relationship: 'servant_leader' })], { ...ctx, after: 20 * 60 });
    expect(evening.noRoom[0]).toMatchObject({ taskId: 'work', reason: 'dayOver' });
    // With no clock (another day), a task that matches nothing still reads "No block today fits".
    expect(autoPlace([t('odd', { relationship: 'parent_child', priority: 2 })], ctx).noRoom[0]).toMatchObject({ reason: 'noMatch' });
    for (const p of autoPlace(Array.from({ length: 6 }, (_, i) => t(`f${i}`, { priority: 1, lifeArea: 'financial', estimateMin: 25 })), ctx).placed) expect(hm(p.start) % 15).toBe(0);
  });
  it('overlaps no timed task and no task it placed before', () => {
    const plan = autoPlace(
      [
        t('timed', { dueTime: '10:00', estimateMin: 60, lifeArea: 'financial', priority: 0 }),
        t('picked', { timeBlockId: 'deep', estimateMin: 45 }),
        t('a', { priority: 0, lifeArea: 'financial', estimateMin: 60 }),
        t('b', { priority: 0, lifeArea: 'financial', estimateMin: 60 }),
      ],
      { ...ctx, taken: [{ dueTime: '11:00', estimateMin: 30 }] },
    );
    // The timed and the picked tasks are never moved.
    expect(plan.placed.map((p) => p.taskId).sort()).toEqual(['a', 'b']);
    // 10:00 to 11:00 and 11:00 to 11:30 are taken; Deep work's 3 h then hold 60 + 45 + 60 more minutes, and the second hour-long task
    // goes on to Busy work's afternoon, since Deep work has no hour left.
    expect(at(plan, 'a')).toMatchObject({ blockId: 'deep', start: '11:30', end: '12:30' });
    expect(at(plan, 'b')).toMatchObject({ blockId: 'busy', start: '15:00' });
  });
  it('counts the room the server says is used, and names a block with minutes but no free start', () => {
    const full = autoPlace([t('x', { priority: 0, lifeArea: 'financial' })], { ...ctx, used: { deep: 180, busy: 120 } });
    expect(full.noRoom).toEqual([{ taskId: 'x', reason: 'full', blockId: 'deep', line: 'Deep work is full today.' }]);
    const busy = autoPlace([t('x', { priority: 0, lifeArea: 'financial' })], {
      ...ctx,
      used: {},
      taken: [
        { dueTime: '10:00', estimateMin: 180 },
        { dueTime: '15:00', estimateMin: 120 },
      ],
    });
    expect(busy.noRoom).toEqual([{ taskId: 'x', reason: 'busy', blockId: 'deep', line: 'Timed tasks fill Deep work today.' }]);
  });
  it('puts a task in a slot it fits in whole, not the last quarter of one', () => {
    // Edit day: Edit runs 9:00 to 1:00 and 2:00 to 4:00. At 12:45 a half-hour task waits for 2:00.
    const plan = autoPlace([t('cut', { priority: 0, lifeArea: 'financial' })], { slots: slotsFor('editday'), blocks: BLOCKS, after: 12 * 60 + 45 });
    expect(at(plan, 'cut')).toMatchObject({ blockId: 'edit', start: '14:00', end: '14:30' });
  });
  it('gives the same plan whatever order the tasks come in', () => {
    const list = [
      t('a', { priority: 2, lifeArea: 'financial', estimateMin: 45 }),
      t('b', { priority: 0, lifeArea: 'financial', estimateMin: 90 }),
      t('c', { priority: null, relationship: 'friendship' }),
      t('d', { priority: 1, lifeArea: 'mental', estimateMin: 60 }),
      t('e', { priority: 3 }),
      t('f', { priority: 0, lifeArea: 'financial', estimateMin: 120, dueDate: '2026-11-13' }),
    ];
    const one = autoPlace(list, ctx);
    expect(autoPlace([...list].reverse(), ctx)).toEqual(one);
    expect(autoPlace([list[3]!, list[0]!, list[5]!, list[1]!, list[4]!, list[2]!], ctx)).toEqual(one);
  });
  it('leaves Daily’s suggestions as they were', () => {
    const groups = groupWithSuggestions([{ id: 'a', doDate: '2026-11-12', dueDate: null, dueTime: null, priority: null, relationship: 'self' as const }], ctx);
    expect(groups.find((g) => g.key === 'hygiene')!.suggested.map((x) => x.id)).toEqual(['a']);
  });
  it('words each reason plainly', () => {
    expect(noRoomLine('full', 'Shoot')).toBe('Shoot is full today.');
    expect(noRoomLine('full')).toBe('Its blocks are full today.');
    expect(noRoomLine('busy', 'Edit')).toBe('Timed tasks fill Edit today.');
  });
});

describe('Place my day, later in the day and with a repeat', () => {
  // A financial block with a morning slot and an afternoon slot: the morning was full, the afternoon is empty.
  const two: TimeBlock[] = [{ id: 'E', seed: null, name: 'Edit', tag: 'Focus', color: 'red', area: 'financial', pillar: null, sort: 0 }];
  const slots: TemplateSlot[] = [
    { blockId: 'E', start: hm('09:00'), end: hm('13:00') },
    { blockId: 'E', start: hm('14:00'), end: hm('16:00') },
  ];
  it('counts room only in the slots still to come, so a busy morning never makes an empty afternoon read as full', () => {
    // Three timed hours from 09:00 in the morning slot, none in the afternoon one.
    const now = hm('14:00');
    const used = blockUsedMin(slots, [180, 0], now);
    expect(used).toEqual({ E: 0 });
    expect(blockUsedMin(slots, [180, 0])).toEqual({ E: 180 });
    const plan = autoPlace([t('cut', { lifeArea: 'financial', estimateMin: 30 })], { slots, blocks: two, used, taken: [{ dueTime: '09:00', estimateMin: 180 }], after: now });
    expect(at(plan, 'cut')).toMatchObject({ blockId: 'E', start: '14:00', end: '14:30' });
    expect(plan.noRoom).toEqual([]);
  });
  it('keeps the minutes of a slot under way', () => {
    expect(blockUsedMin(slots, [180, 60], hm('15:00'))).toEqual({ E: 60 });
  });
  it('never places a task that repeats, and says why', () => {
    const plan = autoPlace([t('habit', { lifeArea: 'financial', repeats: true }), t('once', { lifeArea: 'financial' })], { slots, blocks: two });
    expect(at(plan, 'habit')).toBeUndefined();
    expect(at(plan, 'once')).toMatchObject({ start: '09:00' });
    expect(plan.noRoom).toEqual([{ taskId: 'habit', reason: 'repeats', blockId: null, line: noRoomLine('repeats') }]);
  });
  it('never lands on a timed task it was only told about', () => {
    const plan = autoPlace([t('cut', { lifeArea: 'financial', estimateMin: 30 })], { slots, blocks: two, used: { E: 60 }, taken: [{ dueTime: '09:00', estimateMin: 60 }] });
    expect(at(plan, 'cut')).toMatchObject({ start: '10:00', end: '10:30' });
  });
});
