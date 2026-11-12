import { describe, expect, it } from 'vitest';
import {
  CONTENT_BLOCK_SEEDS,
  CONTENT_DAY_SEEDS,
  DAY_TYPES,
  MAX_DAY_TEMPLATES,
  MAX_TIME_BLOCKS,
  STARTING_BLOCKS,
  STARTING_TEMPLATES,
  minuteOf,
  slotLength,
  startingTemplateFor,
  startingToRestore,
} from './index';
import {
  BREAKDOWN_STEPS_MAX,
  BREAKDOWN_TITLE_MAX,
  CONTENT_STEPS,
  breakdownOfOrigin,
  breakdownOrigin,
  breakdownProjectKey,
  breakdownTask,
  parseBreakdown,
  stepsFor,
} from './contentDays';

/** Flesch reading ease, the same sums as scripts/flesch.py. */
function flesch(text: string): number {
  const sentences = text.split(/[.!?:]+(?:\s|$)/).filter((x) => /[A-Za-z]/.test(x));
  const words = text.match(/[A-Za-z][A-Za-z']*/g) ?? [];
  const syl = words.reduce((sum, word) => {
    const w = word.toLowerCase().replace(/^'+|'+$/g, '');
    let n = (w.match(/[aeiouy]+/g) ?? []).length;
    if (w.endsWith('e') && !/(le|ee|ye)$/.test(w) && n > 1) n -= 1;
    return sum + Math.max(1, n);
  }, 0);
  return 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syl / words.length);
}

const tpl = (seed: string) => STARTING_TEMPLATES.find((t) => t.seed === seed)!;

describe('the content days', () => {
  it('are three starting templates on the four content blocks and the everyday ones, each a whole day', () => {
    expect(CONTENT_DAY_SEEDS.map((s) => tpl(s).name)).toEqual(['Edit day', 'Shoot day', 'Plan and post day']);
    const blocks = new Set(STARTING_BLOCKS.map((b) => b.seed));
    for (const seed of CONTENT_DAY_SEEDS) {
      const t = tpl(seed);
      for (const s of t.slots) expect(blocks.has(s.block), `${seed} ${s.block}`).toBe(true);
      expect(t.slots.reduce((n, s) => n + slotLength({ start: minuteOf(s.start)!, end: minuteOf(s.end)! }), 0), seed).toBe(1440);
      expect(t.slots.some((s) => (CONTENT_BLOCK_SEEDS as readonly string[]).includes(s.block)), seed).toBe(true);
    }
  });
  it('are Servitude’s focus work: Shoot and Edit carry Focus, all four the financial area and the servant_leader pillar', () => {
    for (const seed of CONTENT_BLOCK_SEEDS) {
      const b = STARTING_BLOCKS.find((x) => x.seed === seed)!;
      expect([b.area, b.pillar], seed).toEqual(['financial', 'servant_leader']);
    }
    expect(STARTING_BLOCKS.filter((b) => b.tag === 'Focus').map((b) => b.seed)).toEqual(['deep', 'shoot', 'edit']);
  });
  it('cite exactly the Create kind’s pages, take its pillars, and leave the kind to Create day', () => {
    const create = DAY_TYPES.find((k) => k.key === 'create')!;
    for (const seed of CONTENT_DAY_SEEDS) {
      const t = tpl(seed);
      expect(t.sourceKind, seed).toBeNull();
      expect(t.source, seed).toBe(create.source);
      expect([t.lead, t.second], seed).toEqual([create.lead, create.second]);
      expect(flesch(t.why), seed).toBeGreaterThanOrEqual(60);
    }
    expect(startingTemplateFor('create').seed).toBe('create');
  });
  it('never reuse a seed: the new block and template seeds are new in both lists', () => {
    const blocks = STARTING_BLOCKS.map((b) => b.seed);
    const templates = STARTING_TEMPLATES.map((t) => t.seed);
    for (const s of CONTENT_BLOCK_SEEDS) expect(templates.includes(s), s).toBe(false);
    for (const s of CONTENT_DAY_SEEDS) expect(blocks.includes(s), s).toBe(false);
    expect(STARTING_BLOCKS.length).toBeLessThanOrEqual(MAX_TIME_BLOCKS);
    expect(STARTING_TEMPLATES.length).toBeLessThanOrEqual(MAX_DAY_TEMPLATES);
  });
});

describe('a content day’s steps', () => {
  it('every content block in a content day has a list, and every list names a block that day uses', () => {
    for (const seed of CONTENT_DAY_SEEDS) {
      const used = new Set(tpl(seed).slots.map((s) => s.block));
      for (const b of used) if ((CONTENT_BLOCK_SEEDS as readonly string[]).includes(b)) expect(stepsFor(seed, b), `${seed} ${b}`).not.toBeNull();
    }
    for (const [t, byBlock] of Object.entries(CONTENT_STEPS)) {
      expect((CONTENT_DAY_SEEDS as readonly string[]).includes(t), t).toBe(true);
      const used = new Set(tpl(t).slots.map((s) => s.block));
      for (const b of Object.keys(byBlock)) expect(used.has(b), `${t} ${b}`).toBe(true);
    }
  });
  it('are short lists in plain words, with no promise and none of the words the app does not use', () => {
    const banned = /\b(guarantee|promise|viral|go viral|explode|skyrocket|boost|sprint|tower|hack|grind|crush)\w*|Kreators Life/i;
    const all: string[] = [];
    for (const byBlock of Object.values(CONTENT_STEPS))
      for (const list of Object.values(byBlock)) {
        expect(list.steps.length).toBeGreaterThanOrEqual(3);
        expect(list.steps.length).toBeLessThanOrEqual(Math.min(8, BREAKDOWN_STEPS_MAX));
        expect(list.title.length).toBeLessThanOrEqual(BREAKDOWN_TITLE_MAX);
        expect(new Set(list.steps).size, list.title).toBe(list.steps.length);
        for (const s of [list.title, ...list.steps]) {
          expect(s.length).toBeLessThanOrEqual(BREAKDOWN_TITLE_MAX);
          expect(s, s).not.toMatch(banned);
        }
        for (const s of list.steps) expect(s, s).toMatch(/^[A-Z].*\.$/);
        all.push(list.title + '.', ...list.steps);
      }
    expect(flesch(all.join(' '))).toBeGreaterThanOrEqual(60);
  });
  it('finds a list only by real seeds', () => {
    expect(stepsFor('shootday', 'shoot')!.title).toBe('Shoot: run the shot list');
    expect(stepsFor('shootday', 'edit')).toBeNull();
    expect(stepsFor('everyday', 'deep')).toBeNull();
    expect(stepsFor('constructor', 'shoot')).toBeNull();
    expect(stepsFor('shootday', 'constructor')).toBeNull();
    expect(stepsFor(null, 'shoot')).toBeNull();
  });
});

describe('Add to my tasks', () => {
  it('reads the request: a real day, a list by its seeds and a project', () => {
    expect(parseBreakdown({ date: '2026-11-12', templateSeed: 'editday', blockSeed: 'edit', projectId: 'p1' })).toEqual({ date: '2026-11-12', templateSeed: 'editday', blockSeed: 'edit', projectId: 'p1' });
    const bad = (b: unknown) => 'problem' in parseBreakdown(b);
    expect(bad({ date: '2026-02-30', templateSeed: 'editday', blockSeed: 'edit', projectId: 'p1' })).toBe(true);
    expect(bad({ date: '2026-11-12', templateSeed: 'editday', blockSeed: 'shoot', projectId: 'p1' })).toBe(true);
    expect(bad({ date: '2026-11-12', templateSeed: 'editday', blockSeed: 'edit', projectId: '' })).toBe(true);
    expect(bad(null)).toBe(true);
  });
  it('makes one task in the block, the steps as its subtasks, for that day, sized to the block', () => {
    const task = breakdownTask({ date: '2026-11-12', templateSeed: 'shootday', blockSeed: 'shoot' }, { id: 'b-shoot-u1', area: 'financial', minutes: 300 })!;
    expect(task).toEqual({
      title: 'Shoot: run the shot list',
      subtasks: stepsFor('shootday', 'shoot')!.steps,
      origin: 'breakdown:shootday:shoot',
      doDate: '2026-11-12',
      timeBlockId: 'b-shoot-u1',
      estimateMin: 300,
      lifeArea: 'financial',
    });
    expect(breakdownTask({ date: '2026-11-12', templateSeed: 'editday', blockSeed: 'edit' }, { id: 'e', area: null, minutes: 900 })!.estimateMin).toBe(600);
    expect(breakdownTask({ date: '2026-11-12', templateSeed: 'everyday', blockSeed: 'deep' }, { id: 'd', area: null, minutes: 60 })).toBeNull();
  });
  it('marks the task so Daily says Added, and reads the mark back only for a real list', () => {
    expect(breakdownOfOrigin(breakdownOrigin('postday', 'post'))).toEqual({ templateSeed: 'postday', blockSeed: 'post' });
    expect(breakdownOfOrigin('build')).toBeNull();
    expect(breakdownOfOrigin('breakdown:postday:post:extra')).toBeNull();
    expect(breakdownOfOrigin('breakdown:everyday:deep')).toBeNull();
    expect(breakdownProjectKey('u1', 'servant_leader')).toBe('kreators.breakdownProject:u1:servant_leader');
  });
});

describe('bringing back the starting set within the limits', () => {
  const all = { blocks: new Set(STARTING_BLOCKS.map((b) => b.seed)), templates: new Set(STARTING_TEMPLATES.map((t) => t.seed)) };
  const before = { blocks: new Set([...all.blocks].filter((s) => !(CONTENT_BLOCK_SEEDS as readonly string[]).includes(s))), templates: new Set([...all.templates].filter((s) => !(CONTENT_DAY_SEEDS as readonly string[]).includes(s))) };
  it('adds the content days and their blocks to someone seeded before them', () => {
    const r = startingToRestore(before, { blocks: before.blocks.size, templates: before.templates.size });
    expect(r.templates).toEqual(['editday', 'shootday', 'postday']);
    expect(r.blocks).toEqual(['shoot', 'edit', 'plan', 'post']);
    expect(r.leftOut).toEqual({ blocks: [], templates: [] });
    expect(startingToRestore(all, { blocks: all.blocks.size, templates: all.templates.size })).toEqual({ blocks: [], templates: [], leftOut: { blocks: [], templates: [] } });
  });
  it('never passes the limits, and never adds a template without its blocks', () => {
    // Twenty-two blocks of their own: room for two more, so Edit day (one new block) fits, and Shoot day (two) does not.
    const r = startingToRestore(before, { blocks: MAX_TIME_BLOCKS - 2, templates: before.templates.size });
    expect(r.templates).toEqual(['editday']);
    expect(r.blocks.length).toBeLessThanOrEqual(2);
    expect(r.blocks).toContain('edit');
    expect(r.leftOut.templates).toEqual(['shootday', 'postday']);
    const full = startingToRestore(before, { blocks: before.blocks.size, templates: MAX_DAY_TEMPLATES });
    expect(full.templates).toEqual([]);
    expect(full.leftOut.templates).toEqual(['editday', 'shootday', 'postday']);
    // With no template to add, the missing blocks still come back while there is room.
    expect(full.blocks).toEqual(['shoot', 'edit', 'plan', 'post']);
  });
});
