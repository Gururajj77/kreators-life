import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  EAT_FASTING_VALUE,
  EAT_MOMENT_META,
  EAT_MOMENTS,
  eatDayScore,
  eatExtra,
  eatFromStored,
  eatHowWell,
  EAT_SCORE_MIN_PARTS,
  eatSummary,
  EFFORT_LEVELS,
  FITNESS_NOTE_MAX,
  fruitVegLine,
  isMoveKind,
  kmText,
  MAX_SUPPLEMENTS,
  mealLabel,
  MOVE_KIND_META,
  MOVE_KINDS,
  MOVE_MINUTES_MAX,
  moveLine,
  parseEat,
  parseMove,
  parseProtein,
  parseProteinGoal,
  parseSupplement,
  parseSupplementSettings,
  pastSupplementNote,
  PROTEIN_ABOUT,
  PROTEIN_CAUTION,
  PROTEIN_DAY_MAX,
  PROTEIN_FOOD_BY_KEY,
  PROTEIN_FOOD_KEYS,
  PROTEIN_FOODS,
  PROTEIN_GOAL_MAX,
  PROTEIN_GOAL_MIN,
  PROTEIN_GUIDE,
  PROTEIN_WEIGHT_NOTE,
  proteinFromStored,
  proteinGoalsFor,
  proteinGrams,
  proteinLine,
  typedKilos,
  RUN_TOOL_KINDS,
  SUPPLEMENT_BEFORE,
  SUPPLEMENT_CAUTION,
  SUPPLEMENT_KIND_META,
  SUPPLEMENT_KINDS,
  SUPPLEMENT_NOOTROPIC_LINE,
  SUPPLEMENT_PRIVATE_LINE,
  SUPPLEMENT_TIME_META,
  SUPPLEMENT_TIMES,
  supplementDue,
  supplementListText,
  supplementNoteId,
  metresTyped,
  typedMetres,
  type EatInput,
} from './fitness';
import { BADGE_STATS, CAUSE_WORDS, earningGuide, ICON_NAMES, MODULE_BY_KEY, SETUP_APP_LINES, TERMS } from './index';
import { HOW_TO } from './help';

describe('fitness: movement', () => {
  it('reads a typed distance from its digits, in whole metres', () => {
    expect(typedMetres('5')).toBe(5000);
    // What the form fills in saves back to the very same metres, so changing only the effort never moves a distance.
    for (const m of [5255, 1005, 12345, 5250, 5000, 1, 300000]) expect(typedMetres(metresTyped(m)), String(m)).toBe(m);
    expect(metresTyped(5255)).toBe('5.255');
    expect(metresTyped(5250)).toBe('5.25');
    expect(metresTyped(5000)).toBe('5');
    expect(typedMetres('5.2')).toBe(5200);
    expect(typedMetres('5,25')).toBe(5250);
    expect(typedMetres('1.005')).toBe(1005);
    expect(typedMetres(' 300 ')).toBe(300_000);
    expect(typedMetres('')).toBeNull();
    for (const bad of ['0', '301', 'abc', '5.2.1', '-3', '5.1234', '1e3']) expect(typedMetres(bad), bad).toBe('bad');
    expect(kmText(5250)).toBe('5.25 km');
    expect(kmText(5000)).toBe('5 km');
  });

  it('keeps only a known kind, minutes in range and a distance where it makes sense', () => {
    expect(parseMove({ kind: 'walk', minutes: 30, metres: 2500, effort: 2, note: '  park  ' })).toEqual({ kind: 'walk', minutes: 30, metres: 2500, effort: 2, note: 'park' });
    expect(parseMove({ kind: 'yoga', minutes: 45, metres: 2500 })).toEqual({ kind: 'yoga', minutes: 45, metres: null, effort: null, note: '' });
    expect(parseMove({ minutes: 20 })).toMatchObject({ kind: 'other' });
    expect(parseMove({ kind: 'swim', minutes: 30, metres: 750 })).toMatchObject({ kind: 'swim', minutes: 30, metres: 750 });
    for (const kind of ['constructor', 'skate', 'toString', 3]) expect(typeof parseMove({ kind, minutes: 20 }), String(kind)).toBe('string');
    for (const minutes of [0, -5, MOVE_MINUTES_MAX + 1, 12.5, 'ten', null]) expect(typeof parseMove({ kind: 'run', minutes }), String(minutes)).toBe('string');
    expect(typeof parseMove({ kind: 'run', minutes: 20, metres: 400_000 })).toBe('string');
    expect(typeof parseMove({ kind: 'run', minutes: 20, metres: 1.5 })).toBe('string');
    expect(typeof parseMove({ kind: 'run', minutes: 20, effort: 6 })).toBe('string');
    expect(parseMove({ kind: 'run', minutes: 20, effort: null })).toMatchObject({ effort: null });
    expect((parseMove({ kind: 'run', minutes: 20, note: 'x'.repeat(900) }) as { note: string }).note).toHaveLength(FITNESS_NOTE_MAX);
    expect(isMoveKind('constructor')).toBe(false);
  });

  it('changes only what was sent, and drops a distance when the kind loses it', () => {
    const base = { kind: 'run' as const, minutes: 30, metres: 5000, effort: 3, note: 'tempo' };
    expect(parseMove({ minutes: 35 }, base)).toEqual({ ...base, minutes: 35 });
    expect(parseMove({ kind: 'gym' }, base)).toEqual({ ...base, kind: 'gym', metres: null });
    expect(parseMove({ metres: null, effort: null }, base)).toEqual({ ...base, metres: null, effort: null });
  });

  it('names every kind with a known icon, and the run tool offers a run or a walk only', () => {
    for (const k of MOVE_KINDS) expect(ICON_NAMES as readonly string[]).toContain(MOVE_KIND_META[k].icon);
    expect(RUN_TOOL_KINDS).toEqual(['run', 'walk']);
    expect(EFFORT_LEVELS).toHaveLength(5);
    expect(moveLine({ kind: 'walk', minutes: 30, metres: 3200 })).toBe('30 min walk, 3.2 km');
    expect(moveLine({ kind: 'yoga', minutes: 20, metres: null })).toBe('20 min yoga');
  });
});

const day = (over: Partial<EatInput> = {}): EatInput => ({ meals: [], protein: null, fasting: false, fruit: null, veg: null, packaged: null, fullness: null, screenFree: null, note: '', ...over });
const meal = (moment: EatInput['meals'][number]['moment'], fuel = false, tasty = false) => ({ moment, fuel, tasty });
/** A meal as a row saved before protein left the score holds it. */
const oldMeal = (moment: EatInput['meals'][number]['moment'], protein = false, fuel = false, tasty = false) => ({ moment, protein, fuel, tasty });

describe('fitness: eating', () => {
  it('reads a check-in: each meal once, in the day order, fasting clearing the meals, screen-free meals capped', () => {
    const e = parseEat({ meals: [{ moment: 'dinner', protein: true }, { moment: 'breakfast', fuel: true, tasty: true }, { moment: 'dinner' }], fruit: 2, veg: 3, packaged: 1, fullness: 1, screenFree: 9, note: ' ok ' });
    expect(e).toEqual({ meals: [meal('breakfast', true, true), meal('dinner')], protein: null, fasting: false, fruit: 2, veg: 3, packaged: 1, fullness: 1, screenFree: 2, note: 'ok' });
    expect(parseEat({ fasting: true, meals: [{ moment: 'lunch' }], fruit: 1 })).toMatchObject({ fasting: true, meals: [], screenFree: null });
    for (const body of [{}, { meals: [] }, { meals: [{ moment: 'constructor' }] }, { meals: 'lunch' }, { fruit: 6 }, { veg: 9 }, { fruit: -1 }, { fruit: 1.5 }, { fruit: 1, packaged: 3 }, { fruit: 1, fullness: -1 }]) expect(typeof parseEat(body), JSON.stringify(body)).toBe('string');
    expect(parseEat({ veg: 2 })).toMatchObject({ veg: 2, fruit: null, meals: [] });
  });

  it('keeps "not said" apart from a real 0', () => {
    expect(parseEat({ meals: [{ moment: 'lunch' }] })).toMatchObject({ fruit: null, veg: null, screenFree: null, packaged: null });
    expect(parseEat({ meals: [{ moment: 'lunch' }], fruit: null, veg: '', screenFree: null })).toMatchObject({ fruit: null, veg: null, screenFree: null });
    expect(parseEat({ meals: [{ moment: 'lunch' }], fruit: 0, veg: 0, screenFree: 0 })).toMatchObject({ fruit: 0, veg: 0, screenFree: 0 });
    // With no meal there is nothing to be eaten without a screen.
    expect(parseEat({ veg: 2, screenFree: 3 })).toMatchObject({ screenFree: null });
    // Nothing but zeros is still nothing to save.
    expect(typeof parseEat({ fruit: 0, veg: 0 })).toBe('string');
    expect(typeof parseEat({ fruit: 'lots', veg: 1 })).toBe('string');
    expect(typeof parseEat({ veg: 1, meals: [{ moment: 'lunch' }], screenFree: -1 })).toBe('string');
  });

  it('names each moment with a known icon, and a meal by how it felt, never a grade', () => {
    for (const m of EAT_MOMENTS) expect(ICON_NAMES as readonly string[]).toContain(EAT_MOMENT_META[m].icon);
    expect(mealLabel({ fuel: true, tasty: true })).toBe('Both');
    expect(mealLabel({ fuel: true, tasty: false })).toBe('Good fuel');
    expect(mealLabel({ fuel: false, tasty: true })).toBe('Tasty');
    expect(mealLabel({ fuel: false, tasty: false })).toBe('Just ate');
    expect(fruitVegLine(1, 2)).toBe('Fruit and veg: 3 of 5.');
    expect(fruitVegLine(3, 4)).toBe('Fruit and veg: 7. That reaches 5.');
    expect(fruitVegLine(null, null)).toBe('Fruit and veg: not said.');
    expect(fruitVegLine(0, null)).toBe('Fruit and veg: 0 of 5.');
    expect(fruitVegLine(null, 2)).toBe('Fruit and veg: 2 of 5.');
  });

  it('scores a day on fruit and veg, packaged food and meals without a screen (40, 20, 15), spreading what was not said', () => {
    const three = [meal('breakfast'), meal('lunch'), meal('dinner')];
    expect(eatDayScore(day({ meals: three, fruit: 2, veg: 3, packaged: 0, screenFree: 3 }))).toBe(100);
    expect(eatDayScore(day({ meals: [meal('lunch'), meal('dinner')], fruit: 0, veg: 0, packaged: 2, screenFree: 0 }))).toBe(0);
    expect(eatDayScore(day({ meals: three, fruit: 5, veg: 8, packaged: 0, screenFree: 3 }))).toBe(100);
    // All three said: (40 * 3/5 + 20 + 15) over 75.
    expect(eatDayScore(day({ meals: [meal('lunch')], fruit: 1, veg: 2, packaged: 0, screenFree: 1 }))).toBe(79);
    // Packaged left unset: the other parts share its weight (40 + 15 * 0 over 55).
    expect(eatDayScore(day({ meals: [meal('lunch'), meal('dinner')], fruit: 5, screenFree: 0 }))).toBe(73);
    expect(eatDayScore(day({ meals: [meal('lunch'), meal('dinner')], fruit: 5, packaged: 1, screenFree: 0 }))).toBe(67);
  });

  it('leaves out every part that was not said, and the rest share its weight', () => {
    const three = [meal('breakfast'), meal('lunch'), meal('dinner')];
    // More left closed: the ordinary card gets a score, and can reach 100, and 5 of 5.
    expect(eatDayScore(day({ meals: three, fruit: 2, veg: 3 }))).toBe(100);
    expect(eatHowWell(eatDayScore(day({ meals: three, fruit: 2, veg: 3 })))).toBe(5);
    expect(eatDayScore(day({ meals: three, fruit: 1, veg: 2 }))).toBe(60);
    // One of fruit and vegetables said is enough, and the other counts as none.
    expect(eatDayScore(day({ meals: [meal('lunch')], fruit: 5 }))).toBe(100);
    // A stepper brought back to 0 is a said 0.
    expect(eatDayScore(day({ meals: [meal('lunch')], fruit: 0 }))).toBe(0);
    expect(eatDayScore(day({ meals: [meal('lunch')], fruit: 0, packaged: 0 }))).toBe(33);
    expect(eatDayScore(day({ meals: [meal('lunch')], veg: 0, packaged: 0, screenFree: 1 }))).toBe(47);
    // Two parts with no meal: 40 * 1 + 20 * 1/2 over 60.
    expect(eatDayScore(day({ veg: 5, packaged: 1 }))).toBe(83);
  });

  it('gives a check-in with too little said no score, so one tap is never a great day or a poor one', () => {
    expect(EAT_SCORE_MIN_PARTS).toBe(2);
    // No fruit or veg answered, no score (the founder, 2026-11-07): lunch, None and a screen-free meal were 5 of 5 before.
    const alone = [day({ meals: [meal('lunch')] }), day({ meals: [meal('lunch', true, true)] }), day({ meals: [meal('lunch')], packaged: 0 }), day({ meals: [meal('lunch')], screenFree: 1 }), day({ meals: [meal('lunch')], packaged: 0, screenFree: 1 }), day({ meals: [meal('breakfast'), meal('lunch'), meal('dinner')], packaged: 2, screenFree: 0, fullness: 1 }), day({ veg: 5 }), day({ fruit: 1, veg: 1 }), day({ packaged: 0 }), day({ packaged: 2 })];
    for (const e of alone) {
      expect(eatDayScore(e), JSON.stringify(e)).toBeNull();
      // Stored as no reading, so Reviews, Emerging and a coach's number leave it out.
      expect(eatHowWell(eatDayScore(e))).toBe(EAT_FASTING_VALUE);
    }
    // Lunch, as the assistant sends it (a protein mark from an older tab is dropped): read back with no score and without inventing the rest.
    const lunch = parseEat({ meals: [{ moment: 'lunch', protein: true }], fruit: undefined, veg: undefined, screenFree: undefined, packaged: null, fullness: null }) as EatInput;
    expect(lunch.meals).toEqual([meal('lunch')]);
    const back = eatFromStored(eatHowWell(eatDayScore(lunch)), eatExtra(lunch), '');
    expect(back).toMatchObject({ dayScore: null, howWell: null, legacy: false, input: { fruit: null, veg: null, screenFree: null, protein: null } });
    expect(eatSummary(back.input)).toEqual(['1 meal']);
  });

  it('keeps the reading of a stored row from before a score needed fruit or veg, and never rewrites it', () => {
    const threeTaps = day({ meals: [meal('lunch')], packaged: 0, screenFree: 1 });
    // Stored as 5 of 5 under the older rule: it keeps that, so the row and what it reads as agree.
    expect(eatFromStored(5, eatExtra(threeTaps), '')).toMatchObject({ dayScore: 100, howWell: 5 });
    // Saved under this rule it holds no reading, and reads back with none.
    expect(eatFromStored(eatHowWell(eatDayScore(threeTaps)), eatExtra(threeTaps), '')).toMatchObject({ dayScore: null, howWell: null });
    // Saved again, it takes the rule of the day.
    expect(eatHowWell(eatDayScore(eatFromStored(5, eatExtra(threeTaps), '').input))).toBe(EAT_FASTING_VALUE);
  });

  it('never lets grams of protein move the score', () => {
    const base = day({ meals: [meal('lunch')], fruit: 2, veg: 1, packaged: 1 });
    expect(eatDayScore({ ...base, protein: { foods: [{ food: 'chicken', n: 3 }], scoopG: null, typedG: 40 } })).toBe(eatDayScore(base));
    // Protein alone can be saved, and has no score.
    const only = parseEat({ protein: { foods: [{ food: 'egg', n: 2 }] } }) as EatInput;
    expect(only).toMatchObject({ meals: [], protein: { foods: [{ food: 'egg', n: 2 }] } });
    expect(eatDayScore(only)).toBeNull();
    expect(eatFromStored(EAT_FASTING_VALUE, eatExtra(only), '').input.protein).toEqual(only.protein);
  });

  it('never lets Tasty, Good fuel or how full you felt move the score', () => {
    const base = day({ meals: [meal('breakfast'), meal('dinner')], fruit: 2, veg: 1, packaged: 1, screenFree: 1 });
    const tasty = { ...base, meals: base.meals.map((m) => ({ ...m, tasty: true, fuel: true })), fullness: 2 as const };
    expect(eatDayScore(tasty)).toBe(eatDayScore(base));
    expect(eatDayScore({ ...base, fullness: 0 })).toBe(eatDayScore(base));
  });

  it('gives a fasting day no score and keeps it out of the 1 to 5 every reader uses', () => {
    expect(eatDayScore(day({ fasting: true, fruit: 2 }))).toBeNull();
    expect(eatHowWell(null)).toBe(EAT_FASTING_VALUE);
    expect([0, 12, 13, 37, 38, 62, 63, 87, 88, 100].map(eatHowWell)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('reads a stored check-in back, an older one kindly too', () => {
    const e = day({ meals: [meal('lunch', true)], protein: { foods: [{ food: 'dal', n: 2 }, { food: 'scoop', n: 1 }], scoopG: 30, typedG: 5 }, fruit: 1, veg: 2, packaged: 0, screenFree: 1 });
    const back = eatFromStored(eatHowWell(eatDayScore(e)), eatExtra(e), 'n');
    expect(back.input).toEqual({ ...e, note: 'n' });
    expect(back.legacy).toBe(false);
    expect(back.howWell).toBe(eatHowWell(eatDayScore(e)));
    const old = eatFromStored(4, JSON.stringify({ fruitVeg: 5, protein: 2, screenFree: 1 }), '');
    expect(old).toMatchObject({ legacy: true, howWell: 4, input: { veg: 5, fruit: 0, meals: [] } });
    // The same rule: 40 for five servings, protein 2 of 3 meals, 1 of 3 without a screen, over 80.
    expect(old.dayScore).toBe(Math.round((100 * (0.4 + 0.25 * (2 / 3) + 0.15 * (1 / 3))) / 0.8));
    expect(eatFromStored(3, 'not json', '').legacy).toBe(true);
    // Saved before "not said" existed: its numbers read as said, so the score and the 1 to 5 stay what they were.
    const before = eatFromStored(2, JSON.stringify({ meals: [oldMeal('lunch', true)], fasting: false, fruit: 0, veg: 0, packaged: null, fullness: null, screenFree: 0 }), '');
    expect(before).toMatchObject({ dayScore: 31, howWell: 2, legacy: false, input: { fruit: 0, veg: 0, screenFree: 0 } });
    expect(eatFromStored(0, JSON.stringify({ meals: [], fasting: true }), '')).toMatchObject({ howWell: null, dayScore: null, input: { fasting: true } });
    expect(eatFromStored(3, JSON.stringify({ meals: [{ moment: 'toString' }, { moment: 'lunch', protein: true }], fruit: 99 }), '').input.meals).toEqual([meal('lunch')]);
    // Older days keep the scores they have: a row with protein marks is read by the old weights (40, 25, 20, 15), and its marks are not shown.
    const marked = eatFromStored(4, JSON.stringify({ meals: [oldMeal('lunch', true), oldMeal('dinner', false)], fasting: false, fruit: 2, veg: 1, packaged: 1, fullness: null, screenFree: 1 }), '');
    expect(marked.dayScore).toBe(Math.round(40 * (3 / 5) + 25 * (1 / 2) + 20 * (1 / 2) + 15 * (1 / 2)));
    expect(marked.howWell).toBe(3);
    expect(marked.input.meals).toEqual([meal('lunch'), meal('dinner')]);
    expect(marked.input.protein).toBeNull();
    // A marked lunch alone stays what it was: one part, no score. With fruit and veg it had two, and scored.
    expect(eatFromStored(0, JSON.stringify({ meals: [oldMeal('lunch', true)], fasting: false }), '').dayScore).toBeNull();
    expect(eatFromStored(5, JSON.stringify({ meals: [oldMeal('lunch', true)], fasting: false, fruit: 2, veg: 3 }), '').dayScore).toBe(100);
    // A row with no meals never had a protein part, and reads the same by either rule.
    expect(eatFromStored(4, JSON.stringify({ meals: [], fasting: false, veg: 5, packaged: 1 }), '').dayScore).toBe(83);
    // Anything odd in stored protein is nothing added, never a failure.
    for (const odd of ['x', 3, [], { foods: [{ food: 'constructor', n: 1 }] }, { foods: 'dal' }, { typedG: 9999 }]) expect(proteinFromStored(odd), JSON.stringify(odd)).toBeNull();
    expect(eatFromStored(3, JSON.stringify({ meals: [meal('lunch')], protein: { foods: 'dal' }, fruit: 2 }), '')).toMatchObject({ dayScore: 40, input: { protein: null, meals: [meal('lunch')] } });
  });
});

describe('fitness: protein', () => {
  it('lists about fifteen foods in whole grams, keyed so "constructor" finds nothing', () => {
    expect(PROTEIN_FOODS.map((f) => f.key)).toEqual([...PROTEIN_FOOD_KEYS]);
    expect(PROTEIN_FOODS).toHaveLength(15);
    for (const f of PROTEIN_FOODS) {
      expect(Number.isInteger(f.grams) && f.grams > 0 && f.grams < 50, f.key).toBe(true);
      expect(f.name && f.serving, f.key).toBeTruthy();
    }
    for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(PROTEIN_FOOD_BY_KEY[k], k).toBeUndefined();
    // Veg and non-veg alike in sight.
    expect(PROTEIN_FOODS.filter((f) => f.common).map((f) => f.key)).toEqual(['dal', 'egg', 'curd', 'milk', 'paneer', 'chicken']);
  });

  it('adds up from foods, a changed scoop and typed grams, one rule, in whole grams', () => {
    expect(proteinGrams(null)).toBe(0);
    expect(proteinGrams({ foods: [{ food: 'dal', n: 2 }, { food: 'egg', n: 1 }], scoopG: null, typedG: null })).toBe(21);
    expect(proteinGrams({ foods: [{ food: 'scoop', n: 1 }], scoopG: null, typedG: null })).toBe(24);
    expect(proteinGrams({ foods: [{ food: 'scoop', n: 2 }], scoopG: 30, typedG: 5 })).toBe(65);
    expect(proteinLine(42, 60, 'today')).toBe('42 g of 60 g today');
    expect(proteinLine(42, null, 'yesterday')).toBe('42 g yesterday');
    expect(proteinLine(70, 60, 'today')).toBe('70 g of 60 g today');
  });

  it('reads what is sent, refusing a slip out loud', () => {
    expect(parseProtein(undefined)).toBeNull();
    expect(parseProtein({ foods: [], typedG: 0 })).toBeNull();
    expect(parseProtein({ foods: [{ food: 'scoop', n: 1 }, { food: 'dal', n: '2' }], scoopG: 30, typedG: '5' })).toEqual({ foods: [{ food: 'dal', n: 2 }, { food: 'scoop', n: 1 }], scoopG: 30, typedG: 5 });
    // A scoop's grams are kept only with a scoop.
    expect(parseProtein({ foods: [{ food: 'dal', n: 1 }], scoopG: 30 })).toEqual({ foods: [{ food: 'dal', n: 1 }], scoopG: null, typedG: null });
    for (const bad of ['dal', [], { foods: 'dal' }, { foods: [{ food: 'constructor', n: 1 }] }, { foods: [{ food: '__proto__', n: 1 }] }, { foods: [{ food: 'dal', n: 0 }] }, { foods: [{ food: 'dal', n: 21 }] }, { foods: [{ food: 'dal', n: 1.5 }] }, { foods: [{ food: 'dal' }] }, { foods: [{ food: 'scoop', n: 1 }], scoopG: 0 }, { foods: [{ food: 'scoop', n: 1 }], scoopG: 101 }, { typedG: 12.5 }, { typedG: -1 }, { typedG: PROTEIN_DAY_MAX + 1 }]) expect(typeof parseProtein(bad), JSON.stringify(bad)).toBe('string');
    // Each part in range, the day over the most: refused, and it says so.
    const over = parseProtein({ foods: [{ food: 'chicken', n: 20 }, { food: 'fish', n: 1 }] });
    expect(over).toContain(`${PROTEIN_DAY_MAX} g`);
    expect(typeof parseEat({ meals: [{ moment: 'lunch' }], protein: { typedG: 500 } })).toBe('string');
  });

  it('reads the goal in whole grams in a sane range, and works one out from a weight', () => {
    expect(parseProteinGoal(60)).toBe(60);
    expect(parseProteinGoal('60')).toBe(60);
    for (const clear of [null, undefined, '']) expect(parseProteinGoal(clear)).toBeNull();
    for (const bad of [PROTEIN_GOAL_MIN - 1, PROTEIN_GOAL_MAX + 1, 60.5, 'lots', -5]) expect(typeof parseProteinGoal(bad), String(bad)).toBe('string');
    expect(typedKilos('68')).toBe(680);
    expect(typedKilos('68.5')).toBe(685);
    expect(typedKilos('68,5')).toBe(685);
    expect(typedKilos(' ')).toBeNull();
    for (const bad of ['29', '251', 'abc', '68.55', '-70', '1e2']) expect(typedKilos(bad), bad).toBe('bad');
    // ICMR-NIN's own worked figures: 65 kg at 0.83 is 54.0 g (men), 55 kg is 45.7 (women).
    expect(proteinGoalsFor(650)).toEqual({ usual: 54, cereal: 65 });
    expect(proteinGoalsFor(550)).toEqual({ usual: 46, cereal: 55 });
    expect(proteinGoalsFor(685)).toEqual({ usual: 57, cereal: 69 });
  });

  it('makes no claim about what protein does, and says the weight is not kept', () => {
    const words = [PROTEIN_ABOUT, PROTEIN_CAUTION, PROTEIN_GUIDE, PROTEIN_WEIGHT_NOTE, ...PROTEIN_FOODS.flatMap((f) => [f.name, f.serving]), TERMS['protein goal']].join(' ').toLowerCase();
    for (const w of [...CAUSE_WORDS, 'muscle', 'boost', 'strong', 'build', 'burn', 'lean', 'recover', 'healthy', 'diet', 'cure', 'lose weight']) expect(words, w).not.toContain(w);
    expect(PROTEIN_CAUTION).toContain('kidney');
    expect(PROTEIN_CAUTION).toContain('pregnant');
    expect(PROTEIN_WEIGHT_NOTE).toContain('never sent or saved');
  });

  it('never reaches Emerging, the brief, badges, a coach or what pays', () => {
    const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8').toLowerCase();
    for (const f of ['./insights.ts', './insightPlaces.ts', './lifeDashboard.ts', './home.ts', './badges.ts', './dayKinds.ts', './coachReport.ts']) expect(src(f), f).not.toMatch(/protein/);
    expect(JSON.stringify(BADGE_STATS).toLowerCase()).not.toContain('protein');
    expect(JSON.stringify(earningGuide()).toLowerCase()).not.toContain('protein');
    // The server's own readers: a coach's report, Emerging's facts, the brief, reviews, the leaderboard, search and the public page never name it.
    const api = (f: string) => readFileSync(new URL(`../../../apps/api/src/${f}`, import.meta.url), 'utf8').toLowerCase();
    for (const f of ['coachReport.ts', 'coaching.ts', 'routes/coach.ts', 'routes/insights.ts', 'routes/home.ts', 'routes/reviews.ts', 'routes/leaderboard.ts', 'routes/search.ts', 'routes/store.ts']) expect(api(f), f).not.toMatch(/protein/);
  });
});

describe('fitness: supplements', () => {
  it('names every kind and time with a known icon', () => {
    for (const k of SUPPLEMENT_KINDS) expect(ICON_NAMES as readonly string[], k).toContain(SUPPLEMENT_KIND_META[k].icon);
    for (const t of SUPPLEMENT_TIMES) {
      expect(ICON_NAMES as readonly string[], t).toContain(SUPPLEMENT_TIME_META[t].icon);
      expect(SUPPLEMENT_TIME_META[t].remind).toMatch(/^\d{2}:\d{2}$/);
    }
    expect(MAX_SUPPLEMENTS).toBe(12);
  });

  it('reads a supplement, refusing an unknown kind or time and a name that is empty or too long', () => {
    expect(parseSupplement({ name: '  Vitamin   D3 ', kind: 'vitamin', amount: '60,000 IU weekly', time: 'morning' })).toEqual({ name: 'Vitamin D3', kind: 'vitamin', amount: '60,000 IU weekly', time: 'morning', days: [1, 2, 3, 4, 5, 6, 7] });
    expect(parseSupplement({ name: 'Iron', days: [3, 1, 1] })).toMatchObject({ kind: 'other', time: 'morning', days: [1, 3] });
    for (const body of [{ name: 'X', kind: 'constructor' }, { name: 'X', time: 'toString' }, { name: '' }, { name: '   ' }, { name: 'x'.repeat(41) }, { name: 'X', amount: 'y'.repeat(25) }, { name: 'X', days: [] }, { name: 'X', days: [0] }, { name: 'X', days: 'mon' }]) expect(typeof parseSupplement(body), JSON.stringify(body)).toBe('string');
    const base = parseSupplement({ name: 'Fish oil', kind: 'omega3', time: 'meal' });
    expect(typeof base === 'string' ? base : parseSupplement({ amount: '1' }, base)).toMatchObject({ name: 'Fish oil', kind: 'omega3', time: 'meal', amount: '1' });
  });

  it('is due on its days unless paused, and its settings read cleanly', () => {
    expect(supplementDue({ days: [6, 7], paused: false }, '2026-11-07')).toBe(true);
    expect(supplementDue({ days: [1], paused: false }, '2026-11-07')).toBe(false);
    expect(supplementDue({ days: [6], paused: true }, '2026-11-07')).toBe(false);
    expect(parseSupplementSettings({ on: true, remind: { morning: '08:00', night: '21:30' } })).toEqual({ on: true, daily: false, remind: { morning: '08:00', night: '21:30' } });
    expect(parseSupplementSettings({ remind: { morning: null } }, { on: true, daily: true, remind: { morning: '08:00' } })).toEqual({ on: true, daily: true, remind: {} });
    for (const body of [{ remind: { constructor: '08:00' } }, { remind: { morning: '8am' } }, { remind: [] }]) expect(typeof parseSupplementSettings(body), JSON.stringify(body)).toBe('string');
    expect(supplementNoteId('u1', 'morning', '2026-11-07')).toBe('supp-u1-morning-2026-11-07');
    expect(pastSupplementNote('supp-u1-morning-2026-11-06', '2026-11-07')).toBe(true);
    expect(pastSupplementNote('supp-u1-morning-2026-11-07', '2026-11-07')).toBe(false);
    expect(pastSupplementNote('water-u1-2026-11-06', '2026-11-07')).toBe(false);
    expect(supplementListText([{ name: 'Iron', amount: '1 tablet', time: 'meal', days: [1, 2, 3, 4, 5, 6, 7], paused: false }], () => 'Every day')).toBe('My supplements\n- Iron, 1 tablet, with a meal, every day');
  });

  it('makes no claim: no cause words, no benefit words, no dose', () => {
    const words = [SUPPLEMENT_PRIVATE_LINE, SUPPLEMENT_CAUTION, ...SUPPLEMENT_BEFORE, SUPPLEMENT_NOOTROPIC_LINE, TERMS.supplement, TERMS.nootropic, ...(HOW_TO.fitness?.steps ?? []), ...SUPPLEMENT_KINDS.map((k) => SUPPLEMENT_KIND_META[k].name)].join(' ').toLowerCase();
    for (const w of [...CAUSE_WORDS, 'boost', 'cure', 'treat', 'prevent', 'heal', 'detox', 'immunity', 'dose', 'mg a day']) expect(words, w).not.toContain(w);
  });

  it('never reaches Emerging, the brief, badges or what pays', () => {
    const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8').toLowerCase();
    for (const f of ['./insights.ts', './insightPlaces.ts', './lifeDashboard.ts', './home.ts', './badges.ts', './dayKinds.ts']) expect(src(f), f).not.toMatch(/supplement|nootropic/);
    expect(JSON.stringify(BADGE_STATS).toLowerCase()).not.toContain('supplement');
    expect(JSON.stringify(earningGuide()).toLowerCase()).not.toContain('supplement');
  });
});

describe('fitness: the app', () => {
  it('is a Reflection app, off on a new account, with its how-to, its words and its setup line', () => {
    const m = MODULE_BY_KEY.fitness;
    expect(m).toMatchObject({ group: 'wellbeing', defaultOn: false, accent: 'self', path: '/fitness' });
    expect(HOW_TO.fitness?.steps.length).toBeGreaterThanOrEqual(3);
    for (const t of HOW_TO.fitness?.terms ?? []) expect(TERMS[t], t).toBeTruthy();
    expect(SETUP_APP_LINES.fitness).toBeTruthy();
  });

  it('makes no health claim and counts nothing about the body', () => {
    const words = [...(HOW_TO.fitness?.steps ?? []), TERMS['active minutes'], TERMS['eating check-in'], TERMS['eating moment'], TERMS.serving, TERMS['protein goal'], SETUP_APP_LINES.fitness, MODULE_BY_KEY.fitness?.blurb].join(' ').toLowerCase();
    for (const claim of ['healthy', 'burn', 'lose weight', 'diet', 'cure', 'bmi', 'kcal', 'calorie', 'junk', 'cheat', 'clean eating', 'guilt', 'weight']) expect(words, claim).not.toContain(claim);
    expect(words).toContain('pays nothing');
  });
});
