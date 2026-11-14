import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REAL_DAY,
  FOOD_NOTE,
  FOOD_NOTE_MOVED,
  placementFlags,
  RELATIONSHIP_BY_KEY,
  dayLayout,
  parseRoutineBlocks,
  rampTime,
  repairRoutineBlocks,
  routineBackwardsBlock,
  routineFor,
  routineTimesIssue,
  routineTimesProblem,
  TARGET_SLEEP,
  TARGET_WAKE,
  type Placement,
  type RealDay,
  type RelationshipKey,
  type Routine,
  type RoutineBlock,
} from './index';

// The routine's times on any real day (2026-11-14, the founder's yes to fixing People reading "9:30pm to 9:00pm" when work
// ends at 21:30, and Food and water's fixed 20:00 end). The template's anchors stay whenever the day allows them.

/** routineFor as it was at HEAD before the fix, kept word for word so a template day can be checked byte for byte. */
function headRoutineFor(day: RealDay, weeksCompliant: number, focus: RelationshipKey[], placements: Placement[]): Routine {
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return ((h ?? 0) * 60 + (m ?? 0) + 24 * 60) % (24 * 60);
  };
  const toHHMM = (min: number) => {
    const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const wake = rampTime(day.wake || DEFAULT_REAL_DAY.wake, TARGET_WAKE, weeksCompliant, 'earlier');
  const sleep = rampTime(day.sleep || DEFAULT_REAL_DAY.sleep, TARGET_SLEEP, weeksCompliant, 'earlier');
  const w = toMin(wake);
  const exposure = placements.filter((p) => placementFlags(p).required).map((p) => RELATIONSHIP_BY_KEY[p.relationship].name.toLowerCase());
  const morningSteps = ['Mantra, five to ten minutes', 'Three breathing rounds', 'Two minutes of seeing the day go well', 'Ten minutes of movement', 'One page of reading'];
  const general: RoutineBlock[] = [
    { key: 'morning', name: 'Morning routine', start: wake, end: toHHMM(w + 60), steps: morningSteps, minutes: [10, 3, 2, 10, 5], note: 'Done only when every step is ticked.' },
    { key: 'nutrition', name: 'Food and water', start: toHHMM(w + 60), end: '20:00', steps: [], note: 'Water through the day. Last meal by eight.' },
    { key: 'work', name: 'Work', start: day.workStart || DEFAULT_REAL_DAY.workStart, end: day.workEnd || DEFAULT_REAL_DAY.workEnd, steps: [], note: day.gym ? `Gym at ${day.gym}, before dinner.` : 'Gym before dinner if you train.' },
    { key: 'social', name: 'People', start: day.workEnd || DEFAULT_REAL_DAY.workEnd, end: '21:00', steps: [], note: exposure.length ? `One small scary thing a day for ${exposure.join(' and ')}. Log it.` : focus.length ? `One real conversation a day for ${focus.map((k) => RELATIONSHIP_BY_KEY[k].name.toLowerCase()).join(' or ')}.` : 'One real conversation a day.' },
    { key: 'skills', name: 'Learning and reflection', start: '21:00', end: '23:00', steps: [], note: 'A lesson, then the journal: mood, stress, where you were on the map today.' },
    { key: 'sleep', name: 'Lights out', start: sleep, end: wake, steps: [], note: 'Evening line on the way down.' },
  ];
  const exceptional: RoutineBlock[] = general.map((b) =>
    b.key === 'morning' ? { ...b, end: toHHMM(w + 20), steps: ['Mantra, five minutes', 'One breathing round', 'Five minutes of movement'], minutes: [5, 1, 5], note: 'The short form for a day that is not yours.' } : b.key === 'skills' ? { ...b, start: '22:00', note: 'Just the journal tonight.' } : b,
  );
  return { general, exceptional };
}

const DAY = 24 * 60;
const minOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h ?? 0) * 60 + (m ?? 0)) % DAY;
};
const hhmm = (n: number) => `${String(Math.floor((((n % DAY) + DAY) % DAY) / 60)).padStart(2, '0')}:${String((((n % DAY) + DAY) % DAY) % 60).padStart(2, '0')}`;
const block = (blocks: RoutineBlock[], key: RoutineBlock['key']) => blocks.find((b) => b.key === key)!;
const day = (wake: string, sleep: string, workStart: string, workEnd: string, gym = ''): RealDay => ({ wake, sleep, workStart, workEnd, evening: '', gym });

/** Every invariant of the rule on one built routine; returns the first broken one in words, or null. */
function broken(r: Routine, real: RealDay, weeks: number, focus: RelationshipKey[], placements: Placement[]): string | null {
  const wake = block(r.general, 'morning').start;
  const sleep = block(r.general, 'sleep').start;
  const w = minOf(wake);
  const t = (x: string) => (minOf(x) - w + DAY) % DAY;
  const D = t(sleep) || DAY;
  const tEnd = (x: string) => (t(x) === 0 && D === DAY ? DAY : t(x));
  for (const [which, blocks] of [['general', r.general], ['exceptional', r.exceptional]] as const) {
    for (const b of blocks) {
      if (b.key === 'sleep' || b.key === 'work') continue;
      if (tEnd(b.end) < t(b.start)) return `${which} ${b.key} runs backwards: ${b.start} to ${b.end}`;
      if (D >= 120 && b.key !== 'morning' && (tEnd(b.end) > D || t(b.start) > D)) return `${which} ${b.key} leaves the waking day: ${b.start} to ${b.end}, lights out ${sleep}`;
    }
    const food = block(blocks, 'nutrition');
    if (food.end !== '20:00' && food.note !== FOOD_NOTE_MOVED) return `${which} food says ${food.note} with its end at ${food.end}`;
    if (food.end === '20:00' && food.note !== FOOD_NOTE) return `${which} food at eight says ${food.note}`;
  }
  if (block(r.general, 'social').end !== block(r.general, 'skills').start) return 'People does not end where Learning starts';
  const lay = dayLayout({ wake, sleep, workStart: real.workStart || DEFAULT_REAL_DAY.workStart, workEnd: real.workEnd || DEFAULT_REAL_DAY.workEnd });
  // Off the template, an evening after work with an hour in it before half an hour short of lights out is where People goes.
  const tWorkEnd = t(real.workEnd || DEFAULT_REAL_DAY.workEnd);
  if (!lay.template.evening && Math.max(tWorkEnd, 60) + 60 <= D - 30 && t(block(r.general, 'social').start) < tWorkEnd) return `people sits before work though the evening after it has an hour: ${block(r.general, 'social').start}`;
  const head = headRoutineFor(real, weeks, focus, placements);
  if (lay.template.food && lay.template.evening && JSON.stringify(r) !== JSON.stringify(head)) return 'a template day differs from HEAD';
  // A saved routine built by HEAD is put right by the repair, and one built now needs none.
  if (repairRoutineBlocks(r.general, 'general') !== r.general || repairRoutineBlocks(r.exceptional, 'exceptional') !== r.exceptional) return 'a new routine still needed a repair';
  for (const [which, blocks] of [['general', head.general], ['exceptional', head.exceptional]] as const) {
    const fixed = repairRoutineBlocks(blocks, which);
    if (routineBackwardsBlock(fixed)) return `the repair left ${which} ${routineBackwardsBlock(fixed)!.key} backwards`;
    if (repairRoutineBlocks(fixed, which) !== fixed) return `the repair of ${which} is not settled after one go`;
    // A block the repair moved lands where a routine built now puts it.
    const now = which === 'general' ? r.general : r.exceptional;
    for (const k of ['nutrition', 'social', 'skills'] as const) {
      const was = block(blocks, k);
      const got = block(fixed, k);
      if (got !== was && (got.start !== block(now, k).start || got.end !== block(now, k).end)) return `the repair put ${which} ${k} at ${got.start} to ${got.end}, not where a new routine has it`;
      if (got !== was && (got.name !== was.name || (k !== 'nutrition' && got.note !== was.note))) return `the repair changed ${which} ${k}'s name or note`;
    }
  }
  return null;
}

describe('routine times on any real day', () => {
  it("lays out the founder's day forward: work to 21:30, then people, then learning", () => {
    const r = routineFor(day('08:30', '00:30', '10:00', '21:30'), 0, [], []);
    const span = (blocks: RoutineBlock[], k: RoutineBlock['key']) => `${block(blocks, k).start} to ${block(blocks, k).end}`;
    expect(span(r.general, 'nutrition')).toBe('09:30 to 20:00');
    expect(span(r.general, 'work')).toBe('10:00 to 21:30');
    expect(span(r.general, 'social')).toBe('21:30 to 22:00');
    expect(span(r.general, 'skills')).toBe('22:00 to 23:00');
    expect(span(r.exceptional, 'social')).toBe('21:30 to 22:00');
    expect(span(r.exceptional, 'skills')).toBe('22:00 to 23:00');
    expect(block(r.general, 'nutrition').note).toBe(FOOD_NOTE);
    expect(dayLayout({ wake: '08:30', sleep: '00:30', workStart: '10:00', workEnd: '21:30' }).template).toEqual({ food: true, evening: false });
  });

  it('keeps the template day exactly as it was', () => {
    for (const real of [DEFAULT_REAL_DAY, day('07:00', '23:30', '10:00', '18:00'), day('09:00', '01:00', '10:00', '18:00', '19:00'), day('', '', '', '')]) {
      const focus: RelationshipKey[] = ['friendship'];
      const placements: Placement[] = [{ relationship: 'friendship', core: 310, floor: 100, evidence: '' }];
      for (const weeks of [0, 2, 9]) expect(JSON.stringify(routineFor(real, weeks, focus, placements))).toBe(JSON.stringify(headRoutineFor(real, weeks, focus, placements)));
    }
    const r = routineFor(DEFAULT_REAL_DAY, 0, [], []);
    expect(block(r.general, 'social')).toMatchObject({ start: '18:30', end: '21:00' });
    expect(block(r.general, 'skills')).toMatchObject({ start: '21:00', end: '23:00' });
    expect(block(r.exceptional, 'skills')).toMatchObject({ start: '22:00', end: '23:00' });
  });

  it('moves the last meal when eight is not inside the day, and says it in words that hold', () => {
    // Up at 19:30: food starts at 20:30, so eight would end it before it starts.
    const r = routineFor(day('19:30', '11:30', '21:00', '05:00'), 0, [], []);
    const food = block(r.general, 'nutrition');
    expect(food.start).toBe('20:30');
    expect(food.end).toBe('08:00');
    expect(food.note).toBe(FOOD_NOTE_MOVED);
    expect(food.note).not.toMatch(/eight/);
  });

  it('puts people and learning before work on a night shift, and in the last hour when there is no room', () => {
    const night = routineFor(day('14:00', '06:00', '22:00', '06:00'), 0, [], []);
    expect(block(night.general, 'social')).toMatchObject({ start: '19:30', end: '20:00' });
    expect(block(night.general, 'skills')).toMatchObject({ start: '20:00', end: '22:00' });
    expect(block(night.exceptional, 'skills')).toMatchObject({ start: '21:00', end: '22:00' });
    // Work from the end of the morning to lights out: no hour on either side.
    const full = routineFor(day('08:00', '23:00', '09:00', '23:00'), 0, [], []);
    expect(block(full.general, 'social')).toMatchObject({ start: '22:00', end: '22:30' });
    expect(block(full.general, 'skills')).toMatchObject({ start: '22:30', end: '23:00' });
  });

  it('keeps the evening after work when work ends late but lights out leaves room, never before work or in the last hour', () => {
    // Work ends past eleven, lights out at three: the evening runs to half an hour before lights out.
    const late = routineFor(day('10:00', '03:00', '14:00', '23:30'), 0, [], []);
    expect(block(late.general, 'social')).toMatchObject({ start: '23:30', end: '00:30' });
    expect(block(late.general, 'skills')).toMatchObject({ start: '00:30', end: '02:30' });
    expect(block(late.exceptional, 'skills')).toMatchObject({ start: '01:30', end: '02:30' });
    // Work ends half an hour before eleven, lights out at two.
    const tight = routineFor(day('08:00', '02:00', '09:00', '22:30'), 0, [], []);
    expect(block(tight.general, 'social')).toMatchObject({ start: '22:30', end: '23:30' });
    expect(block(tight.general, 'skills')).toMatchObject({ start: '23:30', end: '01:30' });
    // A night shift that ends at two with lights out at six: the hours after it, not a squeeze before the shift.
    const shift = routineFor(day('14:00', '06:00', '16:00', '02:00'), 0, [], []);
    expect(block(shift.general, 'social')).toMatchObject({ start: '02:00', end: '03:30' });
    expect(block(shift.general, 'skills')).toMatchObject({ start: '03:30', end: '05:30' });
    // Work ending at half past nine still ends learning at eleven (the founder's day).
    expect(block(routineFor(day('08:30', '00:30', '10:00', '21:30'), 0, [], []).general, 'skills')).toMatchObject({ start: '22:00', end: '23:00' });
  });

  it('holds every invariant over a grid of real days, every hour of wake-up, lights out and the end of work, every two of the start of work', () => {
    let template = 0;
    let checked = 0;
    for (let wake = 0; wake < 24; wake++)
      for (let sleep = 0; sleep < 24; sleep++)
        for (let ws = 0; ws < 24; ws += 2)
          for (let we = 0; we < 24; we += 1) {
            const real = day(hhmm(wake * 60), hhmm(sleep * 60), hhmm(ws * 60), hhmm(we * 60));
            const r = routineFor(real, 0, [], []);
            const why = broken(r, real, 0, [], []);
            if (why) throw new Error(`${JSON.stringify(real)}: ${why}`);
            const lay = dayLayout({ wake: real.wake, sleep: real.sleep, workStart: real.workStart, workEnd: real.workEnd });
            if (lay.template.food && lay.template.evening) template++;
            checked++;
          }
    expect(checked).toBe(24 * 24 * 12 * 24);
    expect(template).toBeGreaterThan(1000);
  }, 60_000);

  it('holds every invariant over a seeded sample at any minute, with the ramp, empty times and the notes', () => {
    let seed = 20261114;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const pick = () => (next() < 0.04 ? '' : hhmm(Math.floor(next() * DAY)));
    for (let i = 0; i < 20000; i++) {
      const real = day(pick(), next() < 0.05 ? '' : pick(), pick(), pick(), next() < 0.3 ? '18:00' : '');
      // Sleep equal to wake now and then: a whole waking day.
      if (i % 97 === 0 && real.wake) real.sleep = real.wake;
      const weeks = Math.floor(next() * 12);
      const focus: RelationshipKey[] = next() < 0.5 ? ['lover_partner'] : [];
      const placements: Placement[] = next() < 0.5 ? [{ relationship: 'parent_child', core: 250, floor: 100, evidence: '' }] : [];
      const why = broken(routineFor(real, weeks, focus, placements), real, weeks, focus, placements);
      if (why) throw new Error(`${JSON.stringify(real)} weeks ${weeks}: ${why}`);
    }
  });
});

describe('putting a saved routine right', () => {
  it("lays People and Learning out again together on the founder's saved routine, keeping names and notes", () => {
    const saved = headRoutineFor(day('08:30', '00:30', '10:00', '21:30'), 0, ['lover_partner'], []);
    const general = repairRoutineBlocks(saved.general, 'general');
    const exceptional = repairRoutineBlocks(saved.exceptional, 'exceptional');
    expect(block(general, 'social')).toEqual({ ...block(saved.general, 'social'), start: '21:30', end: '22:00' });
    expect(block(general, 'skills')).toEqual({ ...block(saved.general, 'skills'), start: '22:00', end: '23:00' });
    expect(block(exceptional, 'skills')).toEqual({ ...block(saved.exceptional, 'skills'), start: '22:00', end: '23:00' });
    for (const k of ['morning', 'nutrition', 'work', 'sleep'] as const) expect(block(general, k)).toBe(block(saved.general, k));
  });

  it('puts a backwards Food and water right and leaves work alone', () => {
    const saved = headRoutineFor(day('19:30', '11:30', '21:00', '05:00'), 0, [], []);
    expect(block(saved.general, 'nutrition')).toMatchObject({ start: '20:30', end: '20:00' });
    const fixed = repairRoutineBlocks(saved.general);
    expect(block(fixed, 'nutrition')).toMatchObject({ start: '20:30', end: '08:00', note: FOOD_NOTE_MOVED });
    expect(block(fixed, 'work')).toBe(block(saved.general, 'work'));
    // A note the person wrote stays theirs.
    const own = saved.general.map((b) => (b.key === 'nutrition' ? { ...b, note: 'Dal first.' } : b));
    expect(block(repairRoutineBlocks(own), 'nutrition').note).toBe('Dal first.');
  });

  it("never touches a person's own block that crosses midnight inside the day", () => {
    const saved = routineFor(day('09:00', '02:00', '10:00', '18:00'), 0, [], []);
    const own = saved.general.map((b) => (b.key === 'skills' ? { ...b, start: '23:00', end: '01:00' } : b.key === 'social' ? { ...b, end: '23:00' } : b));
    expect(repairRoutineBlocks(own)).toBe(own);
    expect(routineTimesProblem(own)).toBeNull();
  });

  it('lays out the empty blocks the old template left, People 21:00 to 21:00 and Food 20:00 to 20:00, and keeps the rest', () => {
    // Work that ended at 21:00 gave People 21:00 to 21:00.
    const nine = headRoutineFor(day('07:00', '23:30', '12:00', '21:00'), 0, [], []);
    expect(block(nine.general, 'social')).toMatchObject({ start: '21:00', end: '21:00' });
    const fixed = repairRoutineBlocks(nine.general, 'general');
    const now = routineFor(day('07:00', '23:30', '12:00', '21:00'), 0, [], []);
    expect(block(fixed, 'social')).toEqual({ ...block(nine.general, 'social'), start: '21:00', end: '21:30' });
    expect(block(fixed, 'skills')).toEqual({ ...block(nine.general, 'skills'), start: '21:30', end: '23:00' });
    expect(block(repairRoutineBlocks(nine.exceptional, 'exceptional'), 'skills')).toMatchObject({ start: '22:00', end: '23:00' });
    expect([block(fixed, 'social').start, block(fixed, 'social').end]).toEqual([block(now.general, 'social').start, block(now.general, 'social').end]);
    for (const k of ['morning', 'nutrition', 'work', 'sleep'] as const) expect(block(fixed, k)).toBe(block(nine.general, k));
    expect(repairRoutineBlocks(fixed, 'general')).toBe(fixed);
    // Up at 19:00 gave Food 20:00 to 20:00.
    const seven = headRoutineFor(day('19:00', '11:00', '21:00', '05:00'), 0, [], []);
    expect(block(seven.general, 'nutrition')).toMatchObject({ start: '20:00', end: '20:00' });
    const fed = repairRoutineBlocks(seven.general);
    expect(block(fed, 'nutrition')).toMatchObject({ start: '20:00', end: '07:30', note: FOOD_NOTE_MOVED });
    expect(repairRoutineBlocks(fed)).toBe(fed);
    // An empty block a person set at another time, or on a day the old template never made it, is theirs.
    const own = routineFor(DEFAULT_REAL_DAY, 0, [], []).general.map((b) => (b.key === 'nutrition' ? { ...b, start: '20:00', end: '20:00' } : b.key === 'social' ? { ...b, start: '21:00', end: '21:00' } : b));
    expect(repairRoutineBlocks(own)).toBe(own);
  });

  it('returns a routine that is already fine as it came', () => {
    const r = routineFor(DEFAULT_REAL_DAY, 0, [], []);
    expect(repairRoutineBlocks(r.general)).toBe(r.general);
    expect(repairRoutineBlocks(r.exceptional, 'exceptional')).toBe(r.exceptional);
    expect(repairRoutineBlocks([])).toEqual([]);
  });
});

describe('checking edited routine times', () => {
  const r = routineFor(DEFAULT_REAL_DAY, 0, [], []);
  it('refuses Food, People or Learning ending before it starts, naming the block', () => {
    const bad = r.general.map((b) => (b.key === 'social' ? { ...b, start: '21:30', end: '21:00' } : b));
    expect(routineTimesProblem(bad)).toBe('People ends before it starts. Pick an end after its start.');
    expect(routineBackwardsBlock(bad)?.key).toBe('social');
    const food = r.general.map((b) => (b.key === 'nutrition' ? { ...b, end: '09:00' } : b));
    expect(routineTimesProblem(food)).toMatch(/^Food and water ends before it starts/);
  });
  it('names the start, not the end, when a later morning leaves a block starting while the person sleeps', () => {
    // Up at 07:00, so Food runs 08:00 to 20:00; the morning moves to 08:30 to 09:30 and Food now starts before wake-up.
    const built = routineFor(day('07:00', '23:30', '10:00', '18:30'), 0, [], []);
    const later = parseRoutineBlocks([{ key: 'morning', start: '08:30', end: '09:30' }], built.general);
    const issue = routineTimesIssue(later);
    expect(issue).toMatchObject({ field: 'start', wake: '08:30' });
    expect(issue?.block.key).toBe('nutrition');
    expect(routineTimesProblem(later)).toBe('Food and water starts while you are asleep. Pick a start after you wake up.');
    // Moving the start after wake-up clears it; an end alone never does.
    expect(routineTimesProblem(parseRoutineBlocks([{ key: 'nutrition', start: '09:30' }], later))).toBeNull();
    for (const end of ['20:00', '21:00', '23:00']) expect(routineTimesIssue(parseRoutineBlocks([{ key: 'nutrition', end }], later))?.field).toBe('start');
    // A block whose end comes before its start inside the day still names the end.
    expect(routineTimesIssue(r.general.map((b) => (b.key === 'social' ? { ...b, start: '21:30', end: '21:00' } : b)))?.field).toBe('end');
  });
  it("moves Food and water's own note with an edited end, and leaves a note the person wrote", () => {
    const later = parseRoutineBlocks([{ key: 'nutrition', end: '21:30', note: FOOD_NOTE }], r.general);
    expect(block(later, 'nutrition').note).toBe(FOOD_NOTE_MOVED);
    expect(block(parseRoutineBlocks([{ key: 'nutrition', end: '20:00', note: FOOD_NOTE_MOVED }], later), 'nutrition').note).toBe(FOOD_NOTE);
    expect(block(parseRoutineBlocks([{ key: 'nutrition', end: '21:30', note: 'Dal first.' }], r.general), 'nutrition').note).toBe('Dal first.');
  });
  it('never refuses the morning, work or lights out, and passes a fine routine', () => {
    expect(routineTimesProblem(r.general)).toBeNull();
    const own = r.general.map((b) => (b.key === 'work' ? { ...b, start: '22:00', end: '06:00' } : b.key === 'sleep' ? { ...b, start: '01:00' } : b));
    expect(routineTimesProblem(own)).toBeNull();
  });
});
