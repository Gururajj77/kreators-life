import type { Page } from './core.ts';
import type { IconName } from './roles.ts';

// ---------------------------------------------------------------------------
// Fitness (2026-11-07): movement and eating, logged by the person, private like every tracker.
// A subpath export (`@kreators/shared/fitness`) and a leaf (it imports only types), so its words load with the
// Fitness screen and Kreators Run's tool, never with the first download. Both are rows of `wellbeing_logs`:
// movement is the `move` kind (minutes in `value`, the rest in `extra`), eating is the `eat` kind (one a day).
// Nothing here pays: no xp, no points, no badge. There is no body size or calorie anywhere, on purpose, and a weight is typed once for the protein
// goal and never leaves the browser (the founder, 2026-11-07).
// ---------------------------------------------------------------------------

export const MOVE_KINDS = ['run', 'walk', 'cycle', 'swim', 'yoga', 'gym', 'sport', 'other'] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

/** Each kind's name, icon and whether a distance makes sense for it. */
export const MOVE_KIND_META: Readonly<Record<MoveKind, { name: string; icon: IconName; distance: boolean }>> = {
  run: { name: 'Run', icon: 'Footprints', distance: true },
  walk: { name: 'Walk', icon: 'PersonStanding', distance: true },
  cycle: { name: 'Cycle', icon: 'Route', distance: true },
  swim: { name: 'Swim', icon: 'WavesHorizontal', distance: true },
  yoga: { name: 'Yoga', icon: 'Flower2', distance: false },
  gym: { name: 'Gym', icon: 'Dumbbell', distance: false },
  sport: { name: 'Sport', icon: 'Trophy', distance: false },
  other: { name: 'Other', icon: 'Activity', distance: false },
};
/** The two kinds Kreators Run's own tool offers. */
export const RUN_TOOL_KINDS: readonly MoveKind[] = ['run', 'walk'];

/** A kind someone sent: one of the list, looked up with `includes`, so "constructor" is no kind. */
export const isMoveKind = (v: unknown): v is MoveKind => typeof v === 'string' && (MOVE_KINDS as readonly string[]).includes(v);

export const MOVE_MINUTES_MAX = 600;
/** Three hundred kilometres: more than any day's ride, so a slip of the thumb is refused. */
export const MOVE_METRES_MAX = 300_000;
export const FITNESS_NOTE_MAX = 500;
/** Minutes of movement in seven days that score full marks, here and in Life's physical area. */
export const MOVE_WEEK_TARGET = 150;
export const EFFORT_LEVELS = ['Easy', 'Light', 'Steady', 'Hard', 'All out'] as const;
/** The most fruit and the most vegetables a check-in takes, in servings (a fistful or a katori each). */
export const EAT_FRUIT_MAX = 5;
export const EAT_VEG_MAX = 8;
/** Five servings of fruit and vegetables together is the soft mark, never a fail. */
export const EAT_FRUIT_VEG_MARK = 5;

/**
 * A distance typed in kilometres ("5", "5.2", "5,25"), as whole metres. Read from its digits, never through a float, so
 * "1.005" is 1005 metres. Empty is null; anything else that is not a distance is 'bad'.
 */
export function typedMetres(raw: string): number | null | 'bad' {
  const s = raw.trim();
  if (s === '') return null;
  const m = /^(\d{1,3})(?:[.,](\d{1,3}))?$/.exec(s);
  if (!m) return 'bad';
  const metres = Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0') || 0);
  return metres > 0 && metres <= MOVE_METRES_MAX ? metres : 'bad';
}

/** Metres as the form fills them: every metre kept in whole numbers ("5.255"), so saving it back through `typedMetres` never moves the distance. */
export function metresTyped(metres: number): string {
  const whole = Math.floor(metres / 1000);
  const rest = metres % 1000;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(3, '0')}`.replace(/0+$/, '');
}

/** "5.2 km" from metres, at most two places, never a trailing zero. */
export function kmText(metres: number): string {
  const km = Math.round(metres / 10) / 100;
  return `${km} km`;
}

export interface MoveInput {
  kind: MoveKind;
  minutes: number;
  /** Only for a kind with a distance (run, walk, cycle, swim); null when not given. */
  metres: number | null;
  /** 1 (easy) to 5 (all out), or null when not given. */
  effort: number | null;
  note: string;
}

const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\d{1,7}$/.test(v) ? Number(v) : null);

/**
 * The one reader of a movement log from anything sent: the clean input, or what is wrong in plain words. With `base`, a field that
 * was not sent keeps its old value (a change); a distance is dropped for a kind that has none.
 */
export function parseMove(body: unknown, base?: MoveInput): MoveInput | string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const kind = b.kind === undefined ? (base?.kind ?? 'other') : b.kind;
  if (!isMoveKind(kind)) return `pick a kind: ${MOVE_KINDS.join(', ')}`;
  const minutes = b.minutes === undefined ? (base?.minutes ?? null) : whole(b.minutes);
  if (minutes === null || minutes < 1 || minutes > MOVE_MINUTES_MAX) return `minutes are 1 to ${MOVE_MINUTES_MAX}`;
  let metres = b.metres === undefined ? (base?.metres ?? null) : b.metres === null || b.metres === '' ? null : whole(b.metres);
  if (b.metres !== undefined && b.metres !== null && b.metres !== '' && metres === null) return 'a distance is whole metres';
  if (metres !== null && (metres < 1 || metres > MOVE_METRES_MAX)) return `a distance is up to ${MOVE_METRES_MAX / 1000} km`;
  if (!MOVE_KIND_META[kind].distance) metres = null;
  const effort = b.effort === undefined ? (base?.effort ?? null) : b.effort === null || b.effort === '' ? null : whole(b.effort);
  if (b.effort !== undefined && b.effort !== null && b.effort !== '' && (effort === null || effort < 1 || effort > 5)) return 'effort is 1 to 5';
  const note = b.note === undefined ? (base?.note ?? '') : typeof b.note === 'string' ? b.note.trim().slice(0, FITNESS_NOTE_MAX) : '';
  return { kind, minutes, metres, effort, note };
}

// ---------------------------------------------------------------------------
// The eating check-in (2026-11-07, the founder: "track protein and fruits and the basic items like how many meals, were they healthy or
// tasty or both ... a bit more holistic"; docs/DECISIONS.md and the design brief behind it). One a day, every part optional, about thirty
// seconds: which meals, each one Good fuel, Tasty or both, fruit and vegetables, protein added up by the serving, and in More how much was
// packaged, fried or sweet, how full you felt and meals without a screen. A fasting day is never read as a poor day: it has no score.
// Never calories, size, alcohol or photos. Grams of protein are the one amount it counts, and a weight is typed once and never saved.
// ---------------------------------------------------------------------------

export const EAT_MOMENTS = ['breakfast', 'lunch', 'snack', 'dinner', 'other'] as const;
export type EatMoment = (typeof EAT_MOMENTS)[number];
export const EAT_MOMENT_META: Readonly<Record<EatMoment, { name: string; icon: IconName }>> = {
  breakfast: { name: 'Breakfast', icon: 'Sunrise' },
  lunch: { name: 'Lunch', icon: 'Sun' },
  snack: { name: 'Evening snack or chai', icon: 'Coffee' },
  dinner: { name: 'Dinner', icon: 'Moon' },
  other: { name: 'Something else', icon: 'UtensilsCrossed' },
};
/** A moment someone sent, looked up in an object with no prototype, so "constructor" is no moment. */
const MOMENT_BY_KEY: Readonly<Record<string, EatMoment>> = Object.assign(Object.create(null) as Record<string, EatMoment>, Object.fromEntries(EAT_MOMENTS.map((m) => [m, m])));
export const isEatMoment = (v: unknown): v is EatMoment => typeof v === 'string' && MOMENT_BY_KEY[v] !== undefined;

/** Packaged, fried or sweet; and how full you mostly felt after meals. Both are kept as 0, 1 or 2, or null when not said. */
export const EAT_PACKAGED = ['None', 'Some', 'A lot'] as const;
export const EAT_FULLNESS = ['Still hungry', 'Just right', 'Too full or sluggish'] as const;

export interface EatMeal {
  moment: EatMoment;
  /** Good fuel and Tasty answer "healthy, tasty or both"; neither is a grade, and neither moves the score. */
  fuel: boolean;
  tasty: boolean;
}

// ---------------------------------------------------------------------------
// Protein (2026-11-07, the founder: "protien calculator should be also there not rating right? within food, that needs tracking right"). Added up
// by what you ate, in everyday servings, never weighed. Whole grams, and every one is "about". Protein stays on Fitness: its grams and goal reach
// no coach, Emerging, Reviews, the brief, the leaderboard, a badge, search, the assistant or the public page, and it is out of the eating score.
// The one exception (2026-11-13): a day's grams show in the Eating table, which a coach reads only when the person switches it on for them.
//
// Where the grams come from, per 100 g of the food as bought, from the Indian Food Composition Tables (IFCT 2017, Longvah and others, ICMR-NIN):
//   lentil dal 24.35 (B013), green gram dal 23.88 (B010), black gram dal 23.06 (B003), red gram dal 21.70 (B021), Bengal gram dal 21.55 (B001);
//   rajmah, red 19.91 (B020), Bengal gram, whole 18.77 (B002); green gram, whole 22.53 (B011); paneer 18.86 (L003); milk, cow 3.26 (L002),
//   buffalo 3.68 (L001); egg, whole, boiled 13.43 (M004); chicken, skinless, breast 21.81, leg 19.44, thigh 18.18 (N003, N001, N002);
//   rohu 19.71 (S006), catla 17.94 (S002); ground nut 23.65 (H012), almond 18.41 (H001), cashew 18.78 (H005); atta 10.57 (A019); rice, raw, milled 7.94 (A015).
// The servings follow NIN's Dietary Guidelines for Indians, Annexure 14 (raw: pulses 30 g, 6 g of protein; cereals 30 g, 3 g; egg 50 g, 7 g; meat,
// chicken or fish 50 g, 9 g; milk and milk products 100 ml, 3 g) and its menus (20 g of pulses makes half a cup of dal, a cup being 200 ml, so a
// 150 ml katori of dal is about 30 g raw). So: dal 30 g raw, 6.5 to 7.3 g. Rajma or chole 30 g raw, 5.6 to 6.0. Sprouts 30 g dry, 6.8. Paneer 50 g, 9.4.
// Milk 200 ml, 6.5 to 7.4. Egg 50 g, 6.7. Chicken 100 g raw, 18.2 to 21.8. Fish 100 g raw, 17.9 to 19.7. Nuts or peanuts 30 g, 5.5 to 7.1. A roti from 30 g of atta, 3.2. A katori of rice from 40 g raw, 3.2.
// Not in IFCT 2017, so from the next best public source: curd, NIN's 3 g for 100 ml of milk products, so 4.5 for a 150 ml katori; soya chunks, 50 to 52 g per
// 100 g dry on product labels, so 13 for 25 g dry; tofu, USDA FoodData Central, 8 to 17 g per 100 g by the kind, so 5 for 50 g; a scoop, the label (20 to 25 g on most), which is why it can be changed.
// A key is never reused: a day keeps its foods, and its total is worked out from this list.
// ---------------------------------------------------------------------------

export const PROTEIN_FOOD_KEYS = ['dal', 'egg', 'curd', 'milk', 'paneer', 'chicken', 'rajma', 'sprouts', 'soya', 'tofu', 'fish', 'nuts', 'roti', 'rice', 'scoop'] as const;
export type ProteinFoodKey = (typeof PROTEIN_FOOD_KEYS)[number];
export interface ProteinFood {
  key: ProteinFoodKey;
  name: string;
  /** The serving in plain words. */
  serving: string;
  /** About this many whole grams in one serving. */
  grams: number;
  /** Always in sight on the card; the rest sit in a fold. */
  common: boolean;
}
export const PROTEIN_FOODS: readonly ProteinFood[] = [
  { key: 'dal', name: 'Dal', serving: 'a katori, cooked', grams: 7, common: true },
  { key: 'egg', name: 'Egg', serving: 'one egg', grams: 7, common: true },
  { key: 'curd', name: 'Curd', serving: 'a katori', grams: 5, common: true },
  { key: 'milk', name: 'Milk', serving: 'a glass, 200 ml', grams: 7, common: true },
  { key: 'paneer', name: 'Paneer', serving: '50 g, a few pieces', grams: 9, common: true },
  { key: 'chicken', name: 'Chicken', serving: '100 g raw', grams: 20, common: true },
  { key: 'rajma', name: 'Rajma or chole', serving: 'a katori, cooked', grams: 6, common: false },
  { key: 'sprouts', name: 'Sprouts', serving: 'a katori', grams: 7, common: false },
  { key: 'soya', name: 'Soya chunks', serving: 'a katori, cooked', grams: 13, common: false },
  { key: 'tofu', name: 'Tofu', serving: '50 g, a few pieces', grams: 5, common: false },
  { key: 'fish', name: 'Fish', serving: 'a piece, 100 g raw', grams: 19, common: false },
  { key: 'nuts', name: 'Nuts or peanuts', serving: 'a small handful', grams: 6, common: false },
  { key: 'roti', name: 'Roti', serving: 'one roti', grams: 3, common: false },
  { key: 'rice', name: 'Rice', serving: 'a katori, cooked', grams: 3, common: false },
  { key: 'scoop', name: 'Protein scoop', serving: 'one scoop', grams: 24, common: false },
];
/** A food someone sent, looked up in an object with no prototype, so "constructor" finds nothing. */
export const PROTEIN_FOOD_BY_KEY: Readonly<Record<string, ProteinFood>> = Object.assign(Object.create(null) as Record<string, ProteinFood>, Object.fromEntries(PROTEIN_FOODS.map((p) => [p.key, p])));
export const isProteinFood = (v: unknown): v is ProteinFoodKey => typeof v === 'string' && PROTEIN_FOOD_BY_KEY[v] !== undefined;

/** The most servings of one food, the most grams a scoop can say and the most a day can add up to: past these it is a slip of the thumb, refused out loud. */
export const PROTEIN_SERVINGS_MAX = 20;
export const PROTEIN_SCOOP_MAX = 100;
export const PROTEIN_DAY_MAX = 400;
export const PROTEIN_GOAL_MIN = 10;
export const PROTEIN_GOAL_MAX = 300;

/** What a day's protein keeps: which foods and how many, the grams on your scoop's label when it was changed, and any grams typed from a label. */
export interface ProteinAdded {
  foods: { food: ProteinFoodKey; n: number }[];
  /** Grams in one scoop, or null for the usual amount. Kept only when a scoop was added. */
  scoopG: number | null;
  /** Grams typed from a label, or null. */
  typedG: number | null;
}

/** The one sum: a day's protein in whole grams, 0 when nothing was added. */
export function proteinGrams(p: ProteinAdded | null | undefined): number {
  if (!p) return 0;
  const foods = p.foods.reduce((a, f) => a + f.n * (f.food === 'scoop' && p.scoopG !== null ? p.scoopG : (PROTEIN_FOOD_BY_KEY[f.food]?.grams ?? 0)), 0);
  return foods + (p.typedG ?? 0);
}

const countOr = (v: unknown): number | null | 'bad' => (v === undefined || v === null || v === '' ? null : ((typeof v === 'number' && Number.isInteger(v)) || (typeof v === 'string' && /^\d{1,7}$/.test(v)) ? Number(v) : 'bad'));

/** The one reader of a day's protein from anything sent: the clean foods and grams, null when nothing was added, or what is wrong in plain words. */
export function parseProtein(raw: unknown): ProteinAdded | null | string {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return 'send protein as foods and grams';
  const b = raw as Record<string, unknown>;
  if (b.foods !== undefined && !Array.isArray(b.foods)) return 'send the foods as a list';
  const counts = new Map<ProteinFoodKey, number>();
  for (const item of (Array.isArray(b.foods) ? b.foods : []) as unknown[]) {
    const x = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    if (!isProteinFood(x.food)) return 'pick a food from the list';
    const n = countOr(x.n);
    if (n === null || n === 'bad' || n < 1 || n > PROTEIN_SERVINGS_MAX) return `a food is 1 to ${PROTEIN_SERVINGS_MAX} servings`;
    counts.set(x.food, n);
  }
  const scoop = countOr(b.scoopG);
  if (scoop === 'bad' || (scoop !== null && (scoop < 1 || scoop > PROTEIN_SCOOP_MAX))) return `a scoop is 1 to ${PROTEIN_SCOOP_MAX} g`;
  const typed = countOr(b.typedG);
  if (typed === 'bad' || (typed !== null && (typed < 0 || typed > PROTEIN_DAY_MAX))) return `Type whole grams, up to ${PROTEIN_DAY_MAX}.`;
  const foods = PROTEIN_FOOD_KEYS.flatMap((food) => {
    const n = counts.get(food);
    return n === undefined ? [] : [{ food, n }];
  });
  const typedG = typed === 0 ? null : typed;
  if (foods.length === 0 && typedG === null) return null;
  const out: ProteinAdded = { foods, scoopG: counts.has('scoop') ? scoop : null, typedG };
  if (proteinGrams(out) > PROTEIN_DAY_MAX) return `That is over ${PROTEIN_DAY_MAX} g of protein for one day. Check the numbers.`;
  return out;
}
/** A stored day's protein read back, kindly: anything odd is nothing added, never a failure. An older row has none. */
export function proteinFromStored(raw: unknown): ProteinAdded | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = parseProtein(raw);
  return typeof p === 'string' ? null : p;
}
/** The goal someone sent: whole grams in a sane range, null to clear it, or what is wrong in plain words. */
export function parseProteinGoal(raw: unknown): number | null | string {
  const g = countOr(raw);
  if (g === null) return null;
  if (g === 'bad' || g < PROTEIN_GOAL_MIN || g > PROTEIN_GOAL_MAX) return `A daily goal is ${PROTEIN_GOAL_MIN} to ${PROTEIN_GOAL_MAX} g, in whole grams.`;
  return g;
}
/** "42 g of 60 g today", or "42 g today" with no goal. Never a grade: going over reads the same. */
export const proteinLine = (grams: number, goal: number | null, when: string): string => (goal === null ? `${grams} g ${when}` : `${grams} g of ${goal} g ${when}`);

/**
 * The goal calculator. ICMR-NIN's Nutrient Requirements for Indians (2020, the brief note's Table 2a and text): a safe requirement of 0.83 g a day for each kg
 * of body weight for healthy Indian adults (the RDA, whatever the work; an average need of 0.66), and "for people consuming cereal-based diet with low
 * quality protein, the protein requirements are 1 g/kg per day". Pregnancy and breastfeeding add more, so those are for a doctor. The weight is only
 * ever an argument here: nothing sends, stores or logs it.
 */
export const PROTEIN_KG_MIN = 30;
export const PROTEIN_KG_MAX = 250;
/** A weight typed in kg ("68", "68.5"), as whole tenths, read from its digits. Empty is null; anything else that is not a weight is 'bad'. */
export function typedKilos(raw: string): number | null | 'bad' {
  const s = raw.trim();
  if (s === '') return null;
  const m = /^(\d{1,3})(?:[.,](\d))?$/.exec(s);
  if (!m) return 'bad';
  const tenths = Number(m[1]) * 10 + Number(m[2] ?? 0);
  return tenths >= PROTEIN_KG_MIN * 10 && tenths <= PROTEIN_KG_MAX * 10 ? tenths : 'bad';
}
/** The two goals the guidance gives for a weight in tenths of a kg: the usual one (0.83 g a kg) and the one for mostly rice or roti (1 g a kg), in whole grams. */
export function proteinGoalsFor(tenths: number): { usual: number; cereal: number } {
  return { usual: Math.round((tenths * 83) / 1000), cereal: Math.round(tenths / 10) };
}
export const PROTEIN_CAUTION = 'Check with a doctor if you have a kidney condition or are pregnant.';
export const PROTEIN_ABOUT = 'The grams are rough amounts from India’s food tables. A label beats them.';
export const PROTEIN_GUIDE = 'India’s nutrition institute, ICMR-NIN, gives adults about 0.83 g a day for each kg they weigh, and 1 g when most meals are rice or roti.';
export const PROTEIN_WEIGHT_NOTE = 'This stays in this box. It is never sent or saved. Only the goal you pick is kept.';

export interface EatInput {
  /** The meals ticked, in the day's order, each moment once. Empty on a fasting day. */
  meals: EatMeal[];
  /** Protein added up by the serving, or null when nothing was added. Its own number: never part of the day's score. */
  protein: ProteinAdded | null;
  /** Fasting today (a vrat, a roza or any other): the day has no score, so it is never read as a poor day. */
  fasting: boolean;
  /** Servings, 0 to EAT_FRUIT_MAX and 0 to EAT_VEG_MAX, or null when not said: a stepper nobody touched. One brought back to 0 is a said 0. */
  fruit: number | null;
  veg: number | null;
  /** Packaged, fried or sweet: 0 none, 1 some, 2 a lot, null when not said. */
  packaged: 0 | 1 | 2 | null;
  /** After meals: 0 still hungry, 1 just right, 2 too full or sluggish, null when not said. Never scored. */
  fullness: 0 | 1 | 2 | null;
  /** Meals eaten without a screen, never more than the meals ticked, or null when not said (the More fold left alone). */
  screenFree: number | null;
  note: string;
}

/** A meal's words: Good fuel, Tasty, Both, or a plain "Just ate", never a grade. */
export function mealLabel(m: Pick<EatMeal, 'fuel' | 'tasty'>): string {
  return m.fuel && m.tasty ? 'Both' : m.fuel ? 'Good fuel' : m.tasty ? 'Tasty' : 'Just ate';
}

const flag = (v: unknown): boolean => v === true || v === 'true' || v === 1;
const level = (v: unknown): 0 | 1 | 2 | null | 'bad' => {
  if (v === undefined || v === null || v === '') return null;
  const n = whole(v);
  return n === 0 || n === 1 || n === 2 ? n : 'bad';
};
/** A count someone sent: null when it was not said (absent, null or empty), 'bad' when it is no whole number. A 0 is a real 0. */
const saidCount = (v: unknown): number | null | 'bad' => (v === undefined || v === null || v === '' ? null : (whole(v) ?? 'bad'));

/** The one reader of a day's eating check-in: the clean input, or what is wrong in plain words. */
export function parseEat(body: unknown): EatInput | string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const fasting = flag(b.fasting);
  const seen = new Set<EatMoment>();
  const meals: EatMeal[] = [];
  if (b.meals !== undefined && !Array.isArray(b.meals)) return 'send the meals as a list';
  for (const raw of (Array.isArray(b.meals) ? b.meals : []) as unknown[]) {
    const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (!isEatMoment(m.moment)) return `pick a meal: ${EAT_MOMENTS.join(', ')}`;
    if (seen.has(m.moment)) continue;
    seen.add(m.moment);
    meals.push({ moment: m.moment, fuel: flag(m.fuel), tasty: flag(m.tasty) });
  }
  // Fasting clears the meals, as the chip does on the screen.
  if (fasting) meals.length = 0;
  meals.sort((a, c) => EAT_MOMENTS.indexOf(a.moment) - EAT_MOMENTS.indexOf(c.moment));
  const fruit = saidCount(b.fruit);
  if (fruit === 'bad' || (fruit !== null && (fruit < 0 || fruit > EAT_FRUIT_MAX))) return `fruit is 0 to ${EAT_FRUIT_MAX} servings`;
  const veg = saidCount(b.veg);
  if (veg === 'bad' || (veg !== null && (veg < 0 || veg > EAT_VEG_MAX))) return `vegetables are 0 to ${EAT_VEG_MAX} servings`;
  const packaged = level(b.packaged);
  if (packaged === 'bad') return 'packaged, fried or sweet is none, some or a lot';
  const fullness = level(b.fullness);
  if (fullness === 'bad') return 'how full you felt is one of three';
  const sf = saidCount(b.screenFree);
  if (sf === 'bad' || (sf !== null && sf < 0)) return 'meals without a screen is a count';
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, FITNESS_NOTE_MAX) : '';
  const protein = parseProtein(b.protein);
  if (typeof protein === 'string') return protein;
  // Protein alone can be saved: every part is optional.
  if (!fasting && meals.length === 0 && !fruit && !veg && packaged === null && protein === null) return 'Tick a meal, add some protein, or tick Fasting today, first.';
  // With no meal ticked there is nothing to be eaten without a screen, so it stays not said.
  return { meals, protein, fasting, fruit, veg, packaged, fullness, screenFree: sf === null || meals.length === 0 ? null : Math.min(sf, meals.length), note };
}

/** What the score is worked out from: shares, so an older check-in (counted out of three meals) reads by the same rule. */
interface EatParts {
  fasting: boolean;
  fruitVeg: number | null;
  mealCount: number;
  /** Only a row saved before 2026-11-07's protein change has these marks: it keeps the score it had. Null for every day since. */
  oldProteinMeals: number | null;
  screenFree: number | null;
  packaged: 0 | 1 | 2 | null;
}
const PACKAGED_SCORE = [1, 0.5, 0] as const;
/**
 * A day's score needs fruit or vegetables answered (the founder, 2026-11-07; a said 0 is an answer), and then a meal ticked or this many of its parts said (fruit and veg, packaged food,
 * meals without a screen). So the ordinary card with More left closed gets a score, while lunch, None and one screen-free meal with no fruit or veg said never reads as 5 of 5.
 */
export const EAT_SCORE_MIN_PARTS = 2;
/** `olderRule` is for a stored row that already holds a reading, from before fruit or veg was needed: it keeps the score it had, and is never rewritten. */
function scoreParts(p: EatParts, olderRule = false): number | null {
  if (p.fasting) return null;
  // Whole weights out of a hundred, and a nudge past a float's error, so the same share always rounds the same way (12.5 never reads 12 from one mix and 13 from another).
  const parts: [number, number][] = [];
  if (p.fruitVeg !== null) parts.push([40, Math.min(EAT_FRUIT_VEG_MARK, Math.max(0, p.fruitVeg)) / EAT_FRUIT_VEG_MARK]);
  if (p.mealCount > 0) {
    // A row from before protein left the score keeps it: there a ticked meal without a mark is said.
    if (p.oldProteinMeals !== null) parts.push([25, Math.min(1, p.oldProteinMeals / p.mealCount)]);
    if (p.screenFree !== null) parts.push([15, Math.min(1, p.screenFree / p.mealCount)]);
  }
  if (p.packaged !== null) parts.push([20, PACKAGED_SCORE[p.packaged]]);
  if (parts.length === 0 || (parts.length < EAT_SCORE_MIN_PARTS && !(p.fruitVeg !== null && p.mealCount > 0))) return null;
  if (p.fruitVeg === null && !olderRule) return null;
  const weight = parts.reduce((a, [w]) => a + w, 0);
  return Math.round((100 * parts.reduce((a, [w, v]) => a + w * v, 0)) / weight + 1e-9);
}

/** Fruit and vegetables together, or null when neither was said: one said is enough, and the other then counts as none. */
const fruitVegSaid = (e: Pick<EatInput, 'fruit' | 'veg'>): number | null => (e.fruit === null && e.veg === null ? null : (e.fruit ?? 0) + (e.veg ?? 0));

/**
 * A day's eating as 0 to 100, the one rule (the Fitness line and Life's physical area): fruit and vegetables together out of five, packaged, fried or
 * sweet (none full marks, some half, a lot none) and the share of meals without a screen, weighed 40, 20 and 15. The 25 that protein at meals had went on
 * 2026-11-07 (the founder) and those three share it in proportion: with all of them said that is about 53, 27 and 20 of 100. A part that was not said is
 * left out and the rest share its weight, so a day with More left closed can still reach 100. See EAT_SCORE_MIN_PARTS for when there is none. Tasty, Good fuel,
 * how full you felt and the grams of protein never move it, so enjoying food never costs anything. A fasting day is null too: no score, and left out of every average.
 */
export function eatDayScore(e: Pick<EatInput, 'meals' | 'fasting' | 'fruit' | 'veg' | 'packaged' | 'screenFree'>): number | null {
  return scoreParts({ fasting: e.fasting, fruitVeg: fruitVegSaid(e), mealCount: e.meals.length, oldProteinMeals: null, screenFree: e.screenFree, packaged: e.packaged });
}

/** The stored value of a day with no score (a fasting day, no fruit or veg answered, or too little said): no reading, so every average and pattern leaves it out (they read 1 to 5 only). */
export const EAT_FASTING_VALUE = 0;
/**
 * The one map from a day's score to the 1 to 5 kept in `wellbeing_logs.value`, which Reviews average, Emerging reads (4 or 5 is a day you
 * ate well) and a coach under Reflection sees: 0 to 12 is 1, 13 to 37 is 2, 38 to 62 is 3, 63 to 87 is 4, 88 and up is 5. A day with no
 * score is EAT_FASTING_VALUE.
 */
export function eatHowWell(score: number | null): number {
  return score === null ? EAT_FASTING_VALUE : Math.min(5, Math.max(1, 1 + Math.round(score / 25)));
}

const extraOf = (s: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(s || '{}') as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const intIn = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** What a check-in keeps beside its 1 to 5 value. */
export const eatExtra = (e: EatInput): string => JSON.stringify({ meals: e.meals, fasting: e.fasting, fruit: e.fruit, veg: e.veg, packaged: e.packaged, fullness: e.fullness, screenFree: e.screenFree, ...(e.protein ? { protein: e.protein } : {}) });

/**
 * A stored check-in read back, kindly: anything odd in its extra is dropped, never a failure. A row saved before "not said" existed holds
 * its fruit, vegetables and screen-free meals as numbers, so they read as said and its score and stored value stay what they were.
 * A row that holds a reading (`value` 1 to 5) with no fruit or veg said was saved before a score needed them, and keeps that score; saved again, it takes the rule of the day.
 * A row with a protein mark on its meals (saved before protein left the score, 2026-11-07) keeps the score it had by the old weights, and is never rewritten; its marks are
 * not shown any more. An older one (before 2026-11-07: how you
 * ate 1 to 5, fruit and vegetables together, protein and screen-free meals out of three) keeps its own 1 to 5, its fruit and vegetables
 * as vegetables first, and its score from the same rule with its counts out of three meals; it is marked `legacy` and shows no meals.
 */
export function eatFromStored(value: number, extra: string, note: string): { input: EatInput; howWell: number | null; dayScore: number | null; legacy: boolean } {
  const x = extraOf(extra);
  if (!Array.isArray(x.meals)) {
    const fv = intIn(x.fruitVeg, 0, 10) ?? 0;
    const veg = Math.min(EAT_VEG_MAX, fv);
    const input: EatInput = { meals: [], protein: null, fasting: false, fruit: Math.min(EAT_FRUIT_MAX, fv - veg), veg, packaged: null, fullness: null, screenFree: 0, note };
    const dayScore = scoreParts({ fasting: false, fruitVeg: fv, mealCount: 3, oldProteinMeals: intIn(x.protein, 0, 3) ?? 0, screenFree: intIn(x.screenFree, 0, 3) ?? 0, packaged: null });
    return { input, howWell: Math.min(5, Math.max(1, Math.round(value))), dayScore, legacy: true };
  }
  const rawMeals = x.meals.filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object' && isEatMoment((m as Record<string, unknown>).moment));
  const firstOfEach = rawMeals.filter((m, i) => rawMeals.findIndex((o) => o.moment === m.moment) === i);
  const oldProteinMeals = firstOfEach.some((m) => typeof m.protein === 'boolean') ? firstOfEach.filter((m) => m.protein === true).length : null;
  const parsed = parseEat({ ...x, meals: rawMeals, protein: proteinFromStored(x.protein), note, fruit: intIn(x.fruit, 0, EAT_FRUIT_MAX), veg: intIn(x.veg, 0, EAT_VEG_MAX), packaged: intIn(x.packaged, 0, 2), fullness: intIn(x.fullness, 0, 2), screenFree: intIn(x.screenFree, 0, 5) });
  const input: EatInput = typeof parsed === 'string' ? { meals: [], protein: null, fasting: false, fruit: null, veg: null, packaged: null, fullness: null, screenFree: null, note } : parsed;
  const dayScore = scoreParts({ fasting: input.fasting, fruitVeg: fruitVegSaid(input), mealCount: input.meals.length, oldProteinMeals, screenFree: input.screenFree, packaged: input.packaged }, value >= 1);
  return { input, howWell: dayScore === null ? null : eatHowWell(dayScore), dayScore, legacy: false };
}

/** "Fruit and veg: 3 of 5." under the two steppers; five is a soft mark, so more just says it reached it. */
export function fruitVegLine(fruit: number | null, veg: number | null): string {
  const n = fruitVegSaid({ fruit, veg });
  if (n === null) return 'Fruit and veg: not said.';
  return n < EAT_FRUIT_VEG_MARK ? `Fruit and veg: ${n} of ${EAT_FRUIT_VEG_MARK}.` : `Fruit and veg: ${n}. That reaches ${EAT_FRUIT_VEG_MARK}.`;
}

/** A day's check-in in a few words, for the day sheet: "3 meals · fruit and veg 4 · protein 42 g", or "Fasting today". */
export function eatSummary(e: Pick<EatInput, 'meals' | 'fasting' | 'fruit' | 'veg' | 'protein'>, legacy = false): string[] {
  const fruitVeg = fruitVegSaid(e);
  const grams = proteinGrams(e.protein);
  const protein = grams > 0 ? [`protein ${grams} g`] : [];
  if (e.fasting) return ['Fasting today', ...(fruitVeg ? [`fruit and veg ${fruitVeg}`] : []), ...protein];
  const parts: string[] = [];
  if (!legacy && e.meals.length) parts.push(`${e.meals.length} ${e.meals.length === 1 ? 'meal' : 'meals'}`);
  if (fruitVeg !== null) parts.push(`fruit and veg ${fruitVeg}`);
  return [...parts, ...protein];
}

/** A movement log as the screens read it. `club` is a run logged with a start code in Kreators Run: read only here, paid there. */
export interface MoveLog {
  id: string;
  date: string;
  kind: MoveKind;
  minutes: number;
  metres: number | null;
  effort: number | null;
  note: string;
  source: 'self' | 'club';
  createdAt: string;
}
export interface EatLog extends EatInput {
  id: string;
  date: string;
  /** 0 to 100 by `eatDayScore`; null on a fasting day, with no fruit or veg answered or with too little said. */
  dayScore: number | null;
  /** The stored 1 to 5 (`eatHowWell`); null when there is no score. */
  howWell: number | null;
  /** The day's protein in whole grams (`proteinGrams`), or null when none was added. */
  proteinG: number | null;
  /** A check-in from before the meals were asked: it shows its fruit and vegetables and no meals. */
  legacy: boolean;
  createdAt: string;
}

/** The Fitness screen: thirty-five days of movement and eating, newest first, and the last seven days' minutes. */
export interface FitnessResponse {
  day: string;
  from: string;
  moves: MoveLog[];
  eats: EatLog[];
  weekMinutes: number;
  /** The person's daily protein goal in grams, or null when they have not set one. */
  proteinGoal: number | null;
  /** True when the window held more movement than was sent. */
  more: boolean;
}
/** One month for the calendar. */
export interface FitnessMonth {
  month: string;
  moves: MoveLog[];
  eats: EatLog[];
  more: boolean;
}
export interface MovesPage {
  moves: MoveLog[];
  page: Page;
}
/** Kreators Run's tool: the runs and walks logged on your own in the last seven days. */
export interface RunMovesResponse {
  day: string;
  moves: MoveLog[];
  minutes: number;
}

/** "30 min walk, 3.2 km" for a row. */
export function moveLine(m: Pick<MoveLog, 'kind' | 'minutes' | 'metres'>): string {
  return `${m.minutes} min ${MOVE_KIND_META[m.kind].name.toLowerCase()}${m.metres ? `, ${kmText(m.metres)}` : ''}`;
}

// ---------------------------------------------------------------------------
// Supplements (2026-11-07, the founder: "a toggle that tracks supplement intakes and or shows a list of supplements to take, like vitamins,
// minerals, nootropics, those can also be a toggle in daily"). The person's own list, off until they switch on Track supplements (that
// switch is the consent), and on Daily only when they also switch on Show on Daily. The app never suggests one, never gives an amount,
// never checks a mix with medicines and never says what any supplement does: the only words about one are what the person typed. It
// pays nothing, counts toward no streak or badge, and never reaches Emerging, the brief, the leaderboard or the assistant, nor a coach
// but as its own tables (Supplements, Supplement days) when the person switches them on for that coach under All tables (2026-11-13).
// ---------------------------------------------------------------------------

export const SUPPLEMENT_KINDS = ['vitamin', 'mineral', 'protein', 'omega3', 'herbal', 'probiotic', 'nootropic', 'other'] as const;
export type SupplementKind = (typeof SUPPLEMENT_KINDS)[number];
export const SUPPLEMENT_KIND_META: Readonly<Record<SupplementKind, { name: string; icon: IconName }>> = {
  vitamin: { name: 'Vitamin', icon: 'Pill' },
  mineral: { name: 'Mineral', icon: 'Gem' },
  protein: { name: 'Protein', icon: 'Dumbbell' },
  omega3: { name: 'Omega-3 or fish oil', icon: 'WavesHorizontal' },
  herbal: { name: 'Herb or Ayurvedic', icon: 'Leaf' },
  probiotic: { name: 'Probiotic', icon: 'Sprout' },
  nootropic: { name: 'Nootropic', icon: 'Brain' },
  other: { name: 'Other', icon: 'Package' },
};
export const SUPPLEMENT_TIMES = ['morning', 'meal', 'evening', 'night'] as const;
export type SupplementTime = (typeof SUPPLEMENT_TIMES)[number];
/** Each time of day's name, icon and the reminder time it starts from when switched on. */
export const SUPPLEMENT_TIME_META: Readonly<Record<SupplementTime, { name: string; icon: IconName; remind: string }>> = {
  morning: { name: 'Morning', icon: 'Sunrise', remind: '08:00' },
  meal: { name: 'With a meal', icon: 'UtensilsCrossed', remind: '13:00' },
  evening: { name: 'Evening', icon: 'Moon', remind: '18:00' },
  night: { name: 'Night', icon: 'MoonStar', remind: '21:30' },
};
const KIND_BY_KEY: Readonly<Record<string, SupplementKind>> = Object.assign(Object.create(null) as Record<string, SupplementKind>, Object.fromEntries(SUPPLEMENT_KINDS.map((k) => [k, k])));
const TIME_BY_KEY: Readonly<Record<string, SupplementTime>> = Object.assign(Object.create(null) as Record<string, SupplementTime>, Object.fromEntries(SUPPLEMENT_TIMES.map((k) => [k, k])));
export const isSupplementKind = (v: unknown): v is SupplementKind => typeof v === 'string' && KIND_BY_KEY[v] !== undefined;
export const isSupplementTime = (v: unknown): v is SupplementTime => typeof v === 'string' && TIME_BY_KEY[v] !== undefined;

export const MAX_SUPPLEMENTS = 12;
export const SUPPLEMENT_NAME_MAX = 40;
export const SUPPLEMENT_AMOUNT_MAX = 24;
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7] as const;

export interface SupplementInput {
  /** The name on the label, as typed. */
  name: string;
  kind: SupplementKind;
  /** As typed ("1 tablet", "60,000 IU weekly"): shown exactly so, never read, added up or compared. */
  amount: string;
  time: SupplementTime;
  /** Weekdays, 1 for Monday to 7 for Sunday; every day unless chosen. */
  days: number[];
}
export interface Supplement extends SupplementInput {
  id: string;
  position: number;
  paused: boolean;
  createdAt: string;
}

const oneLine = (v: unknown): string | null => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : null);

/** The one reader of a supplement from anything sent. With `base`, what was not sent keeps its old value (a change). */
export function parseSupplement(body: unknown, base?: SupplementInput): SupplementInput | string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = b.name === undefined && base ? base.name : oneLine(b.name);
  if (!name) return 'Write the name on the label.';
  if (name.length > SUPPLEMENT_NAME_MAX) return `A name is up to ${SUPPLEMENT_NAME_MAX} letters.`;
  const kind = b.kind === undefined ? (base?.kind ?? 'other') : b.kind;
  if (!isSupplementKind(kind)) return `pick a kind: ${SUPPLEMENT_KINDS.join(', ')}`;
  const time = b.time === undefined ? (base?.time ?? 'morning') : b.time;
  if (!isSupplementTime(time)) return `pick when: ${SUPPLEMENT_TIMES.join(', ')}`;
  const amount = b.amount === undefined ? (base?.amount ?? '') : (oneLine(b.amount) ?? '');
  if (amount.length > SUPPLEMENT_AMOUNT_MAX) return `An amount is up to ${SUPPLEMENT_AMOUNT_MAX} letters.`;
  let days: number[] = base?.days ?? [...EVERY_DAY];
  if (b.days !== undefined) {
    if (!Array.isArray(b.days) || !b.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) return 'days are 1 (Monday) to 7 (Sunday)';
    days = [...new Set(b.days as number[])].sort((x, y) => x - y);
  }
  if (days.length === 0) return 'Pick at least one day.';
  return { name, kind, amount, time, days };
}

/** The weekday of a day, 1 for Monday to 7 for Sunday. */
export function weekdayOfDay(day: string): number {
  return ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}
/** Whether a supplement is on the list for a day: not paused, and that weekday is one of its days. */
export const supplementDue = (s: Pick<Supplement, 'days' | 'paused'>, day: string): boolean => !s.paused && s.days.includes(weekdayOfDay(day));

export interface SupplementSettings {
  /** Track supplements: the switch, and the consent. Off until the person turns it on. */
  on: boolean;
  /** Show on Daily, off until the person turns it on. */
  daily: boolean;
  /** A reminder time (HH:MM in the person's zone) for each time of day that has one; none by default. */
  remind: Partial<Record<SupplementTime, string>>;
}
export const SUPPLEMENT_SETTINGS_OFF: SupplementSettings = { on: false, daily: false, remind: {} };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The one reader of the settings, from a stored row or from what was sent over `base`. Unknown times and bad clocks are dropped or refused. */
export function parseSupplementSettings(body: unknown, base: SupplementSettings = SUPPLEMENT_SETTINGS_OFF): SupplementSettings | string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const on = b.on === undefined ? base.on : b.on === true;
  const daily = b.daily === undefined ? base.daily : b.daily === true;
  let remind = base.remind;
  if (b.remind !== undefined) {
    if (!b.remind || typeof b.remind !== 'object' || Array.isArray(b.remind)) return 'send reminders as times by part of the day';
    const next: Partial<Record<SupplementTime, string>> = { ...base.remind };
    for (const [k, v] of Object.entries(b.remind as Record<string, unknown>)) {
      if (!isSupplementTime(k)) return `pick when: ${SUPPLEMENT_TIMES.join(', ')}`;
      if (v === null || v === '') delete next[k];
      else if (typeof v === 'string' && HHMM.test(v)) next[k] = v;
      else return 'a reminder time is HH:MM';
    }
    remind = next;
  }
  return { on, daily, remind };
}

/** One supplement on the Fitness list: today's tick, and the last seven days for a doctor's visit ("Taken on 5 of 7 days"). */
export interface SupplementRow extends Supplement {
  dueToday: boolean;
  takenToday: boolean;
  /** The last seven days, oldest first, ending today: taken or not. */
  week: boolean[];
  /** Of those seven days, the ones it was on the list (since it was added) and the ones it was taken. */
  dueDays: number;
  takenDays: number;
}
export interface SupplementsView {
  day: string;
  settings: SupplementSettings;
  items: SupplementRow[];
}
/** Daily's fold: today's items by time of day, or `show: false` while either switch is off, Fitness is off or nothing is on the list today. */
export interface SupplementsTodayView {
  show: boolean;
  day: string;
  total: number;
  taken: number;
  groups: { time: SupplementTime; items: { id: string; name: string; amount: string; kind: SupplementKind; taken: boolean }[] }[];
}

/** "Name, amount, when" a line, for showing a doctor or pharmacist (Copy my list). Paused ones are marked. */
export function supplementListText(items: readonly Pick<Supplement, 'name' | 'amount' | 'time' | 'days' | 'paused'>[], dayWords: (days: readonly number[]) => string): string {
  return ['My supplements', ...items.map((s) => `- ${s.name}${s.amount ? `, ${s.amount}` : ''}, ${SUPPLEMENT_TIME_META[s.time].name.toLowerCase()}, ${dayWords(s.days).toLowerCase()}${s.paused ? ' (paused)' : ''}`)].join('\n');
}

/** The inbox line a supplement reminder writes: one per person, time of day and day. */
export const supplementNoteId = (userId: string, time: SupplementTime, day: string): string => `supp-${userId}-${time}-${day}`;
/** Once its day is over the line is no use. */
export function pastSupplementNote(id: string, today: string): boolean {
  const m = /^supp-.+-(\d{4}-\d{2}-\d{2})$/.exec(id);
  return Boolean(m && m[1]! < today);
}

/** The caution lines, word for word from the design brief. Plain words, no claim, never about what a supplement does. */
export const SUPPLEMENT_PRIVATE_LINE = 'Your list stays private. Only you see it, unless you share its table with a life coach.';
export const SUPPLEMENT_CAUTION = 'The app does not check amounts or mixes. Ask a doctor or pharmacist before you start, stop or change one, more so if you take medicines or are pregnant.';
export const SUPPLEMENT_BEFORE: readonly string[] = [
  'Natural does not mean safe.',
  'Follow the label or what your doctor said. More is not better.',
  'Show this list to your doctor or pharmacist. It helps them spot a clash with your medicines.',
];
export const SUPPLEMENT_NOOTROPIC_LINE = 'Some brain products hold stimulants or hidden medicines. Talk to a doctor first.';
