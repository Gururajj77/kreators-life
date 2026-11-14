import { RELATIONSHIP_BY_KEY } from './core.ts';
import type { RelationshipKey } from './core.ts';

// ---------------------------------------------------------------------------
// The strategy session: onboarding as a self-serve session. A map of levels, a placement per
// relationship (where you live, where you drop), fears and insecurities asked early, a scorecard, the
// person's real day, up to two focus pillars, a routine ramped from that day, practices and a contract.
// The map builds on Hawkins' Map of Consciousness: a shared order of levels, never a measurement.
// ---------------------------------------------------------------------------

export const MAP_BANDS = ['victim', 'empowerment', 'realization'] as const;
export type MapBand = (typeof MAP_BANDS)[number];
export const MAP_BAND_META: Record<MapBand, { name: string; blurb: string; from: number; to: number }> = {
  victim: { name: 'Stuck', blurb: 'Fear, blame or shame run the show.', from: 20, to: 199 },
  empowerment: { name: 'Owning it', blurb: 'You show up, keep promises, take what is yours.', from: 200, to: 399 },
  realization: { name: 'At ease', blurb: 'It flows. You give without keeping score.', from: 400, to: 540 },
};
export interface MapLevel {
  value: number;
  name: string;
  band: MapBand;
  /** What it sounds like in your own head. */
  sounds: string;
}
export const MAP_LEVELS: readonly MapLevel[] = [
  { value: 20, name: 'Shame', band: 'victim', sounds: 'I am the problem.' },
  { value: 30, name: 'Guilt', band: 'victim', sounds: 'I always mess this up.' },
  { value: 50, name: 'Apathy', band: 'victim', sounds: "What's the point." },
  { value: 75, name: 'Grief', band: 'victim', sounds: "It's gone and I can't get it back." },
  { value: 100, name: 'Fear', band: 'victim', sounds: "What if it goes wrong? I'll avoid it." },
  { value: 125, name: 'Desire', band: 'victim', sounds: 'I need this to feel okay.' },
  { value: 150, name: 'Anger', band: 'victim', sounds: "It's their fault." },
  { value: 175, name: 'Pride', band: 'victim', sounds: "I'm above this." },
  { value: 200, name: 'Courage', band: 'empowerment', sounds: "I'm scared and I'm doing it anyway." },
  { value: 250, name: 'Neutrality', band: 'empowerment', sounds: 'Fine either way.' },
  { value: 310, name: 'Willingness', band: 'empowerment', sounds: "I'll show up and do the work." },
  { value: 350, name: 'Acceptance', band: 'empowerment', sounds: 'This is mine to own.' },
  { value: 400, name: 'Inner light', band: 'realization', sounds: 'I can see how this works.' },
  { value: 440, name: 'Inner wisdom', band: 'realization', sounds: 'I know why, and I act from that.' },
  { value: 500, name: 'Inner love', band: 'realization', sounds: 'I act from care, not need.' },
  { value: 540, name: 'Oneness', band: 'realization', sounds: 'Your good is my good.' },
];
export const COURAGE = 200;
export const ACCEPTANCE = 350;
export const VOLATILE_GAP = 150;
export const levelByValue = (v: number): MapLevel | undefined => MAP_LEVELS.find((l) => l.value === v);

/** The statement for each band, per relationship. Health sits inside Yourself; work and wealth inside Servitude. */
export const BAND_STATEMENTS: Record<RelationshipKey, Record<MapBand, string>> = {
  self: { victim: 'Shame about my looks or body. I attack myself, numb out, and compare all the time.', empowerment: 'I keep promises to myself, hold routines through moods, and own my mistakes.', realization: 'Self-respect that needs no proof. Rest and discipline feel the same.' },
  lover_partner: { victim: 'I avoid approaching, or I stay from fear of being alone. Jealousy, control, neediness.', empowerment: 'I start honestly, say what I need, and survive a no without falling apart.', realization: 'I love without keeping score and give the other person room.' },
  friendship: { victim: 'I isolate or people-please. Envy. Friends of convenience.', empowerment: 'I show up, reach out first, and disagree honestly.', realization: "Friendship as service. I celebrate others' wins fully." },
  parent_child: { victim: 'Resentment, blame, duty out of guilt, harshness.', empowerment: 'Clear boundaries, responsibility, respectful contact.', realization: 'Gratitude and forgiveness. I teach by example, not lectures.' },
  servant_leader: { victim: 'I work from fear of loss, blame the boss, and let money worry drive my choices.', empowerment: 'I own outcomes, keep learning, and build income on purpose.', realization: 'Work as service. I lead by example. Wealth is a tool for others.' },
  guru: { victim: 'I reject all guidance, or depend on it blindly. I shop for validation.', empowerment: 'I ask for feedback, apply it, and stay coachable and critical.', realization: 'Student and teacher at once. I pass it on.' },
  divine: { victim: 'Fear of punishment, bargaining, no practice, or spiritual pride.', empowerment: 'A regular practice: prayer, mantra, reading. I am searching for meaning.', realization: 'Surrender and presence. The practice is a way of living.' },
};

export interface Placement {
  relationship: RelationshipKey;
  /** Where you usually live. */
  core: number;
  /** Where you drop under stress. */
  floor: number;
  /** For a core of 400 or more: what you did last week that shows it. Without it the core is capped at Acceptance. */
  evidence: string;
}
export interface PlacementFlags {
  core: number;
  floor: number;
  /** A floor under Courage: a required focus for month one. */
  required: boolean;
  /** A gap of more than 150 between floor and core: a weekly check. */
  volatile: boolean;
  capped: boolean;
}
/**
 * The placement rules, in one place. `required` marks a floor under Courage: the pillar the session suggests
 * starting with. The person still picks their own focus; nothing is forced on them.
 */
export function placementFlags(p: Placement): PlacementFlags {
  const capped = p.core >= 400 && p.evidence.trim().length < 10;
  const core = capped ? ACCEPTANCE : p.core;
  const floor = Math.min(p.floor, core);
  return { core, floor, required: floor < COURAGE, volatile: core - floor > VOLATILE_GAP, capped };
}

export const FEAR_OPTIONS = ['Trying new things', 'Being rejected', 'Being judged', 'Failing in public', 'Being alone', 'Losing money', 'Letting people down', 'Being seen'] as const;
export const DRIVES = ['yes', 'sometimes', 'no'] as const;
export type Drives = (typeof DRIVES)[number];
export interface Fear {
  text: string;
  relationship: RelationshipKey;
  drives: Drives;
}
export interface Insecurity {
  text: string;
  /** Out of 10, picked as one of the words in INSECURITY_WEIGHTS. */
  weight: number;
  relationship: RelationshipKey;
}
export const MAX_FEARS = 8;
export const MAX_INSECURITIES = 8;
/** How heavy an insecurity is, in words. Each keeps its number out of ten, so the focus rules are unchanged. */
export const INSECURITY_WEIGHTS = [
  { weight: 2, name: 'A little' },
  { weight: 5, name: 'Some' },
  { weight: 8, name: 'A lot' },
  { weight: 10, name: 'Very heavy' },
] as const;
/** The word for a weight out of ten: the nearest one, so older numbers read too. */
export function weightWord(weight: number): string {
  return [...INSECURITY_WEIGHTS].sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0]!.name;
}

export const SCORECARD = {
  health: ['sleep', 'nutrition', 'movement', 'positive_stress', 'negative_stress', 'emotional_control'],
  wealth: ['income', 'passive_income', 'learning', 'time'],
} as const;
export type ScoreKey = (typeof SCORECARD.health)[number] | (typeof SCORECARD.wealth)[number] | RelationshipKey;
export const SCORE_LABEL: Record<(typeof SCORECARD.health)[number] | (typeof SCORECARD.wealth)[number], string> = {
  sleep: 'Sleep',
  nutrition: 'Food',
  movement: 'Movement',
  positive_stress: 'Good stress, the kind that gets you up',
  negative_stress: 'Bad stress, the kind that wears you down',
  emotional_control: 'Control over your feelings',
  income: 'Income',
  passive_income: 'Money that comes in without your hours',
  learning: 'Learning',
  time: 'Time that is yours',
};
export type Scores = Partial<Record<ScoreKey, number>>;
/** What each star means on the scorecard, one star to five. */
export const STAR_WORDS = ['Very poor', 'Poor', 'Okay', 'Good', 'Great'] as const;
/** Stars from a score out of ten (two points a star), and back. */
export const starsOf = (score: number): number => Math.max(0, Math.min(5, Math.round(score / 2)));
export const scoreOfStars = (stars: number): number => Math.max(0, Math.min(10, Math.round(stars) * 2));

/** A score of 8 or more (four stars or five) over a floor under Courage gets one behaviour question. Fewer than four days in seven caps it at 6. */
export function settleScore(score: number, floor: number, daysInSeven: number | null): number {
  if (score < 8 || floor >= COURAGE) return score;
  if (daysInSeven === null) return score;
  return daysInSeven < 4 ? Math.min(score, 6) : score;
}

export interface RealDay {
  wake: string;
  sleep: string;
  workStart: string;
  workEnd: string;
  evening: string;
  gym: string;
}
export const DEFAULT_REAL_DAY: RealDay = { wake: '08:30', sleep: '00:30', workStart: '10:00', workEnd: '18:30', evening: '', gym: '' };

/** The suggested focus, up to two pillars: every floor under Courage first, then the lowest cores weighted by insecurity. The person can change it. */
export function pickFocus(placements: Placement[], insecurities: Insecurity[], away: readonly RelationshipKey[] = []): RelationshipKey[] {
  // A pillar that is not part of the person's life right now is never suggested.
  const flagged = placements.filter((p) => !away.includes(p.relationship)).map((p) => ({ key: p.relationship, f: placementFlags(p) }));
  const required = flagged.filter((x) => x.f.required).sort((a, b) => a.f.floor - b.f.floor).map((x) => x.key);
  if (required.length >= 2) return required.slice(0, 2);
  const weight = (k: RelationshipKey) => insecurities.filter((i) => i.relationship === k).reduce((a, i) => a + i.weight, 0);
  const rest = flagged
    .filter((x) => !required.includes(x.key))
    .sort((a, b) => a.f.core - weight(a.key) * 10 - (b.f.core - weight(b.key) * 10))
    .map((x) => x.key);
  return [...required, ...rest].slice(0, 2);
}

/**
 * The seven in the order to work on them: floors under Courage first (lowest first), then the lowest cores weighted by
 * what weighs there. A pillar that is not part of the person's life right now is left out.
 */
export function priorityOrder(placements: Placement[], insecurities: Insecurity[], away: readonly RelationshipKey[] = []): { key: RelationshipKey; why: string }[] {
  const name = (v: number) => levelByValue(v)?.name ?? '';
  const weight = (k: RelationshipKey) => insecurities.filter((i) => i.relationship === k).reduce((a, i) => a + i.weight, 0);
  const rows = placements.filter((p) => !away.includes(p.relationship)).map((p) => ({ key: p.relationship, f: placementFlags(p), w: weight(p.relationship) }));
  const required = rows.filter((r) => r.f.required).sort((a, b) => a.f.floor - b.f.floor);
  const rest = rows.filter((r) => !r.f.required).sort((a, b) => a.f.core - a.w * 10 - (b.f.core - b.w * 10));
  return [
    ...required.map((r) => ({ key: r.key, why: `Drops to ${name(r.f.floor)} under stress, below Courage. A good place to start.` })),
    ...rest.map((r) => ({ key: r.key, why: `${r.f.volatile ? 'A big drop under stress, so check it each week' : `Usually at ${name(r.f.core)}`}${r.w ? ', and something you named weighs here' : ''}.` })),
  ];
}

/**
 * The pillars a person can say are not part of their life right now: love, teachers and faith. Such a pillar is placed at
 * Neutrality for both levels, is never suggested as a focus or put in the order to work on, and gets no pyramid unless the
 * person picks it later. It can be turned back on from the life map.
 */
export const OPTIONAL_PILLARS: readonly RelationshipKey[] = ['lover_partner', 'guru', 'divine'];
/** Where a pillar that is not part of someone's life sits: Neutrality, "fine either way". */
export const AWAY_LEVEL = 250;
export const isOptionalPillar = (k: RelationshipKey): boolean => OPTIONAL_PILLARS.includes(k);
export const awayPlacement = (relationship: RelationshipKey): Placement => ({ relationship, core: AWAY_LEVEL, floor: AWAY_LEVEL, evidence: '' });
/** The away list as it is kept: only the optional pillars, each once, in their own order. */
export function parseAway(input: unknown): RelationshipKey[] {
  const given = new Set(Array.isArray(input) ? input.filter((x): x is string => typeof x === 'string') : []);
  return OPTIONAL_PILLARS.filter((k) => given.has(k));
}

/**
 * A placement from the levels a person ticked ("Pick all that you feel"). The core is the band picked most often (a tie goes
 * to the higher band), at the middle of the picks in that band (the higher of two); the floor is the lowest pick. The shape
 * is the same Placement, so `placementFlags` and the server read it as before. Nothing ticked gives null.
 */
export function placementFromPicks(relationship: RelationshipKey, picks: readonly number[], evidence = ''): Placement | null {
  const levels = [...new Set(picks)].filter((v) => levelByValue(v)).sort((a, b) => a - b);
  if (levels.length === 0) return null;
  const count = (b: MapBand) => levels.filter((v) => levelByValue(v)!.band === b).length;
  // MAP_BANDS runs low to high, so reading it backwards lets the higher band win a tie.
  const band = [...MAP_BANDS].reverse().reduce((best, b) => (count(b) > count(best) ? b : best), MAP_BANDS[MAP_BANDS.length - 1]!);
  const inBand = levels.filter((v) => levelByValue(v)!.band === band);
  const core = inBand[Math.floor(inBand.length / 2)]!;
  return { relationship, core, floor: levels[0]!, evidence };
}
/** The ticks to start a placement's picker from: its floor and its core. */
export const picksOfPlacement = (p: Pick<Placement, 'core' | 'floor'>): number[] => [...new Set([p.floor, p.core])].filter((v) => levelByValue(v)).sort((a, b) => a - b);

/**
 * Words people use for each level of the map, for "Say it in your own words". Rules only, no model: a phrase found in what
 * someone typed suggests its level, and the person ticks the ones that fit. Longer phrases are read first and used up,
 * so "hate myself" reads as Shame and not also as Anger.
 */
export const MAP_LEVEL_WORDS: Record<number, readonly string[]> = {
  20: ['shame', 'ashamed', 'embarrassed', 'humiliated', 'worthless', 'hate myself', 'not good enough', 'i am the problem', "i'm the problem", 'disgusted with myself'],
  30: ['guilt', 'guilty', 'my fault', 'blame myself', 'regret', 'mess up', 'messed up', 'let them down', 'let people down', 'let everyone down', 'feel bad about'],
  50: ['apathy', 'pointless', "what's the point", 'what is the point', 'numb', "don't care", 'do not care', 'dont care', 'hopeless', 'give up', 'gave up', 'empty', "can't be bothered", 'cannot be bothered', 'unmotivated', 'no energy', 'lazy'],
  75: ['grief', 'grieving', 'sad', 'sadness', 'heartbroken', 'heartbreak', 'i miss', 'miss them', 'miss her', 'miss him', 'lost them', 'loss', 'lonely', 'cry', 'crying', 'mourning'],
  100: ['fear', 'afraid', 'scared', 'anxious', 'anxiety', 'worry', 'worried', 'nervous', 'panic', 'avoid', 'avoiding', 'dread', 'overthink', 'overthinking', 'terrified'],
  125: ['desire', 'crave', 'craving', 'desperate', 'envy', 'envious', 'jealous', 'jealousy', 'never enough', 'longing', 'obsessed', 'need approval', 'validation', 'want more', 'clingy', 'needy'],
  150: ['anger', 'angry', 'mad at', 'furious', 'resent', 'resentment', 'annoyed', 'irritated', 'frustrated', 'frustration', 'rage', 'their fault', 'his fault', 'her fault', 'blame them', 'hate', 'bitter'],
  175: ['pride', 'better than', 'above this', 'above it', 'superior', 'arrogant', 'ego', 'show off', 'showing off', "don't need anyone", 'do not need anyone', 'know better', 'look down on'],
  200: ['courage', 'brave', 'do it anyway', 'doing it anyway', 'try anyway', 'trying anyway', 'keep trying', 'step up', 'stepping up', 'face it', 'facing it', 'push through', 'pushing through'],
  250: ['neutral', 'fine', 'okay', 'alright', 'all right', 'so-so', 'not bad', 'either way', 'it is what it is', 'meh', 'ok'],
  310: ['willing', 'show up', 'showing up', 'working on', 'work on it', 'effort', 'ready', 'committed', 'motivated', 'keen', 'putting in', 'trying hard', 'doing the work'],
  350: ['accept', 'acceptance', 'own it', 'owning it', 'responsible', 'responsibility', 'my part', 'let go', 'letting go', 'at peace with', 'it is mine'],
  400: ['understand', 'i see how', 'makes sense', 'clear', 'clarity', 'curious', 'learning a lot', 'figured out'],
  440: ['wise', 'wisdom', 'i know why', 'purpose', 'insight', 'meaningful', 'meaning'],
  500: ['love', 'loving', 'care', 'caring', 'kind', 'kindness', 'grateful', 'gratitude', 'thankful', 'warm', 'close to', 'connected', 'give freely'],
  540: ['oneness', 'one with', 'at peace', 'peaceful', 'joy', 'joyful', 'bliss', 'whole', 'surrender', 'unity', 'your good is my good'],
};
const NEGATED = /\b(?:not|never|no|isn't|isnt|aren't|wasn't|don't|doesn't|didn't|hardly|rarely)\s+(?:\w+\s+)?$/;
/** The levels a line someone typed points to, lowest first, at most four. A word after "not" or "never" does not count. */
export function readFeelings(text: string): number[] {
  let t = ` ${text.slice(0, 600).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ')} `;
  const phrases = Object.entries(MAP_LEVEL_WORDS)
    .flatMap(([v, words]) => words.map((w) => ({ w, v: Number(v) })))
    .sort((a, b) => b.w.length - a.w.length);
  const found = new Set<number>();
  for (const { w, v } of phrases) {
    const re = new RegExp(`(?<=[ ])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[ ])`, 'g');
    t = t.replace(re, (m, at: number) => {
      // A phrase that holds its own "not" or "don't" is read as it is; a plain word after one is not.
      if (!/\b(?:not|don't|dont|no|never)\b/.test(w) && NEGATED.test(t.slice(0, at))) return m;
      found.add(v);
      return ' '.repeat(m.length);
    });
  }
  return [...found].sort((a, b) => a - b).slice(0, 4);
}

/**
 * "Read with AI": the same suggestion, from a model, for someone with a plan and only through a model that keeps
 * nothing (`POST /assistant/feelings`). The rules above stay the default and free. The words are never stored or
 * logged; what comes back is only level numbers, and the person still ticks the ones that fit.
 */
export interface FeelingsReadResult {
  /** Level values from MAP_LEVELS, lowest first, at most four. */
  levels: number[];
  /** The model that read it, said under the suggestion. */
  model: string;
  credits: { spent: number; left: number };
}
/** The most characters of someone's words the AI reader sends. */
export const FEELINGS_TEXT_MAX = 600;
/** What the feelings reader tells the model: the level names and their lines, and to answer with numbers only. */
export function feelingsPrompt(relationship?: string): string {
  const lines = MAP_LEVELS.map((l) => `${l.value} ${l.name}: "${l.sounds}"`).join('\n');
  return `You read how someone feels${relationship ? ` about ${relationship}` : ''} and match it to levels on a map of feelings. The levels are:\n${lines}\n\nCall suggest_levels with the one to four level numbers their words point to most. A feeling they say they do not have does not count. Never write anything else.`;
}
/**
 * The levels in a model's answer: the `levels` of a suggest_levels call, or numbers in plain text. Only values in
 * MAP_LEVELS count, each once, lowest first, at most four. Anything else is dropped.
 */
export function feelingsFromModel(answer: unknown): number[] {
  let raw: unknown[] = [];
  if (typeof answer === 'string') raw = answer.match(/\b\d{2,3}\b/g)?.map(Number) ?? [];
  else if (Array.isArray(answer)) raw = answer;
  else if (answer && typeof answer === 'object' && Array.isArray((answer as { levels?: unknown }).levels)) raw = (answer as { levels: unknown[] }).levels;
  const found = new Set<number>();
  for (const v of raw) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d{2,3}\s*$/.test(v) ? Number(v) : NaN;
    if (Number.isInteger(n) && levelByValue(n)) found.add(n);
  }
  return [...found].sort((a, b) => a - b).slice(0, 4);
}

export const BLOCK_KEYS = ['morning', 'nutrition', 'work', 'skills', 'social', 'sleep'] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];
export interface RoutineBlock {
  key: BlockKey;
  name: string;
  start: string;
  end: string;
  /** Only the morning block has steps; the day is done when every one is ticked. */
  steps: string[];
  /** The minutes each morning step takes, in the same order. Older routines may not have them. */
  minutes?: number[];
  note: string;
}
export interface Routine {
  general: RoutineBlock[];
  exceptional: RoutineBlock[];
}
export type DayType = 'general' | 'exceptional';
export const TARGET_WAKE = '06:30';
export const TARGET_SLEEP = '23:30';
export const RAMP_MINUTES = 30;
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h ?? 0) * 60 + (m ?? 0) + 24 * 60) % (24 * 60);
};
const toHHMM = (min: number) => {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
/** Thirty minutes a week from the real time toward the target, never past it. A time already earlier than the target stays where it is. */
export function rampTime(real: string, target: string, weeksCompliant: number, direction: 'earlier'): string {
  void direction;
  const day = 24 * 60;
  // How far earlier the target is than the real time, going back round the clock; more than half a day means the person is already earlier.
  const gap = (((toMin(real) - toMin(target)) % day) + day) % day;
  if (gap > day / 2) return toHHMM(toMin(real));
  return toHHMM(toMin(target) + Math.max(0, gap - RAMP_MINUTES * Math.max(0, weeksCompliant)));
}
/**
 * The coach's template anchors (Strategy Session App Product Spec, the routine table): the last meal by eight, people until
 * nine, nine to eleven for learning and reflection. They hold whenever the person's day allows them.
 */
const LAST_MEAL = '20:00';
const PEOPLE_UNTIL = '21:00';
const LEARNING_UNTIL = '23:00';
/** The template's gap from the last meal to lights out (20:00 against 23:30). */
const LAST_MEAL_BEFORE_SLEEP = 210;
/** Food and water's note: the template's own while the last meal is at eight, and words that hold for any time once it moved. */
export const FOOD_NOTE = 'Water through the day. Last meal by eight.';
export const FOOD_NOTE_MOVED = 'Water through the day. Last meal by the end of this block.';
const foodNoteFor = (end: string) => (end === LAST_MEAL ? FOOD_NOTE : FOOD_NOTE_MOVED);

export interface DaySpan {
  start: string;
  end: string;
}
/** Where Food and water, People and Learning sit on one day, and whether the template's own times held. */
export interface DayLayout {
  food: DaySpan;
  people: DaySpan;
  learning: DaySpan;
  /** Learning on an exceptional day: the last hour of it at most. */
  learningShort: DaySpan;
  template: { food: boolean; evening: boolean };
}

/**
 * The one rule for the times of Food and water, People and Learning, used by routineFor and by repairRoutineBlocks. It works
 * in minutes since wake-up (t), on a waking day that runs from wake-up to lights out (D; lights out at the wake-up time is a
 * whole day). The morning is the first hour, work keeps the person's own times, lights out keeps theirs.
 * - Food and water starts an hour after wake-up and ends at eight while eight is at least an hour into it and not after
 *   lights out; otherwise it ends three and a half hours before lights out, never under an hour long and never past lights out.
 * - People then Learning: the template (people from the end of work to nine, learning nine to eleven, an exceptional day ten
 *   to eleven) while work ends at least half an hour before nine and eleven falls before lights out. Otherwise the evening
 *   after work up to eleven, or up to half an hour before lights out when eleven is past lights out or less than an hour
 *   after work (so work that ends at half past eleven still leaves its evening after it): Learning takes up to two hours at
 *   its end, People at least half an hour before it. With no hour after work, the stretch before work (its last two and a
 *   half hours at most). With no hour on either side, the last hour of the waking day. An exceptional day's Learning is the
 *   last hour of it at most.
 */
export function dayLayout(day: Pick<RealDay, 'wake' | 'sleep' | 'workStart' | 'workEnd'>): DayLayout {
  const DAY = 24 * 60;
  const w = toMin(day.wake);
  const t = (x: string) => (((toMin(x) - w) % DAY) + DAY) % DAY;
  const at = (m: number) => toHHMM(w + m);
  const D = t(day.sleep) || DAY;
  // Food and water.
  const t20 = t(LAST_MEAL);
  const foodHolds = t20 >= 120 && t20 <= D;
  const food = { start: at(60), end: foodHolds ? LAST_MEAL : at(Math.max(60, Math.min(D, Math.max(120, D - LAST_MEAL_BEFORE_SLEEP)))) };
  // People then Learning.
  const tWorkEnd = t(day.workEnd);
  const t21 = t(PEOPLE_UNTIL);
  const t23 = t(LEARNING_UNTIL);
  const split = (a: number, b: number) => {
    const learn = Math.min(120, b - a - 30);
    return { people: { start: at(a), end: at(b - learn) }, learning: { start: at(b - learn), end: at(b) }, learningShort: { start: at(b - Math.min(60, learn)), end: at(b) } };
  };
  const eveningHolds = tWorkEnd + 30 <= t21 && t21 < t23 && t23 <= D;
  let evening: Pick<DayLayout, 'people' | 'learning' | 'learningShort'>;
  if (eveningHolds) {
    evening = { people: { start: day.workEnd, end: PEOPLE_UNTIL }, learning: { start: PEOPLE_UNTIL, end: LEARNING_UNTIL }, learningShort: { start: '22:00', end: LEARNING_UNTIL } };
  } else {
    const a = Math.max(tWorkEnd, 60);
    // Eleven ends the evening only while it leaves an hour after work; past that the evening runs to half an hour before lights out.
    const b = t23 <= D && t23 - a >= 60 ? t23 : D - 30;
    const beforeWork = Math.min(t(day.workStart), D);
    if (b - a >= 60) evening = split(a, b);
    else if (beforeWork - 60 >= 60) evening = split(Math.max(60, beforeWork - 150), beforeWork);
    else {
      const from = Math.max(0, D - 60);
      const mid = Math.max(from, D - 30);
      const learning = { start: at(mid), end: at(D) };
      evening = { people: { start: at(from), end: at(mid) }, learning, learningShort: learning };
    }
  }
  return { food, ...evening, template: { food: foodHolds, evening: eveningHolds } };
}

/** The routine from the coach's template, ramped from the person's real day. Pure, so it can be tested. */
export function routineFor(day: RealDay, weeksCompliant: number, focus: RelationshipKey[], placements: Placement[]): Routine {
  const wake = rampTime(day.wake || DEFAULT_REAL_DAY.wake, TARGET_WAKE, weeksCompliant, 'earlier');
  const sleep = rampTime(day.sleep || DEFAULT_REAL_DAY.sleep, TARGET_SLEEP, weeksCompliant, 'earlier');
  const w = toMin(wake);
  const workStart = day.workStart || DEFAULT_REAL_DAY.workStart;
  const workEnd = day.workEnd || DEFAULT_REAL_DAY.workEnd;
  const lay = dayLayout({ wake, sleep, workStart, workEnd });
  const exposure = placements.filter((p) => placementFlags(p).required).map((p) => RELATIONSHIP_BY_KEY[p.relationship].name.toLowerCase());
  const morningSteps = ['Mantra, five to ten minutes', 'Three breathing rounds', 'Two minutes of seeing the day go well', 'Ten minutes of movement', 'One page of reading'];
  const general: RoutineBlock[] = [
    { key: 'morning', name: 'Morning routine', start: wake, end: toHHMM(w + 60), steps: morningSteps, minutes: [10, 3, 2, 10, 5], note: 'Done only when every step is ticked.' },
    { key: 'nutrition', name: 'Food and water', start: lay.food.start, end: lay.food.end, steps: [], note: foodNoteFor(lay.food.end) },
    { key: 'work', name: 'Work', start: workStart, end: workEnd, steps: [], note: day.gym ? `Gym at ${day.gym}, before dinner.` : 'Gym before dinner if you train.' },
    { key: 'social', name: 'People', start: lay.people.start, end: lay.people.end, steps: [], note: exposure.length ? `One small scary thing a day for ${exposure.join(' and ')}. Log it.` : focus.length ? `One real conversation a day for ${focus.map((k) => RELATIONSHIP_BY_KEY[k].name.toLowerCase()).join(' or ')}.` : 'One real conversation a day.' },
    { key: 'skills', name: 'Learning and reflection', start: lay.learning.start, end: lay.learning.end, steps: [], note: 'A lesson, then the journal: mood, stress, where you were on the map today.' },
    { key: 'sleep', name: 'Lights out', start: sleep, end: wake, steps: [], note: 'Evening line on the way down.' },
  ];
  const exceptional: RoutineBlock[] = general.map((b) =>
    b.key === 'morning' ? { ...b, end: toHHMM(w + 20), steps: ['Mantra, five minutes', 'One breathing round', 'Five minutes of movement'], minutes: [5, 1, 5], note: 'The short form for a day that is not yours.' } : b.key === 'skills' ? { ...b, start: lay.learningShort.start, note: 'Just the journal tonight.' } : b,
  );
  return { general, exceptional };
}

/** How much a routine can hold once edited: morning steps, and the words in a step or a note. */
export const ROUTINE_STEPS_MAX = 10;
export const ROUTINE_STEP_MAX = 80;
export const ROUTINE_NOTE_MAX = 160;
export const ROUTINE_STEP_MINUTES_MAX = 120;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** How long a block runs, start to end, in minutes. A block that runs past midnight, like lights out, wraps. */
export function blockMinutes(b: Pick<RoutineBlock, 'start' | 'end'>): number {
  const d = toMin(b.end) - toMin(b.start);
  return d >= 0 ? d : d + 24 * 60;
}
/** The minutes a block's steps add up to. */
export function stepsMinutes(b: Pick<RoutineBlock, 'steps' | 'minutes'>): number {
  return b.steps.reduce((a, _, i) => a + (b.minutes?.[i] ?? 0), 0);
}
/** Minutes in words: "45 min", "1 hr", "1 hr 30 min". */
export function minutesLabel(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}
/**
 * The one check on an edited routine, for the editor and for PATCH /session/routine: the six blocks in the
 * routine's own order (a block that is not sent keeps what it had), times as HH:MM, a note per block, and the morning's steps
 * with their minutes, one to ROUTINE_STEPS_MAX, each named once. The other blocks keep no steps.
 */
export function parseRoutineBlocks(input: unknown, current: RoutineBlock[]): RoutineBlock[] {
  const given = Array.isArray(input) ? input : [];
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  // The routine's own order, which is the day's order; a block it somehow lacks joins at the end.
  const order = [...current.map((b) => b.key), ...BLOCK_KEYS.filter((k) => !current.some((b) => b.key === k))];
  return order.map((key) => {
    const was = current.find((b) => b.key === key) ?? { key, name: key, start: '00:00', end: '00:00', steps: [], note: '' };
    const raw = given.find((g): g is Record<string, unknown> => Boolean(g) && typeof g === 'object' && (g as { key?: unknown }).key === key);
    if (!raw) return was;
    const time = (v: unknown, fallback: string) => (typeof v === 'string' && HHMM.test(v) ? v : fallback);
    const block: RoutineBlock = { key, name: was.name, start: time(raw.start, was.start), end: time(raw.end, was.end), steps: [], note: typeof raw.note === 'string' ? text(raw.note, ROUTINE_NOTE_MAX) : was.note };
    // Food and water's note follows its end while it is still one of the app's own two, so a moved end never says "by eight";
    // a note the person wrote stays theirs.
    if (key === 'nutrition' && (block.note === FOOD_NOTE || block.note === FOOD_NOTE_MOVED)) block.note = foodNoteFor(block.end);
    if (key !== 'morning') return block;
    const minutes = Array.isArray(raw.minutes) ? raw.minutes : [];
    const seen = new Set<string>();
    const kept = (Array.isArray(raw.steps) ? raw.steps : [])
      .map((st, i) => ({ step: text(st, ROUTINE_STEP_MAX), mins: Math.max(0, Math.min(ROUTINE_STEP_MINUTES_MAX, Math.round(Number(minutes[i]) || 0))) }))
      .filter((x) => x.step && !seen.has(x.step.toLowerCase()) && seen.add(x.step.toLowerCase()))
      .slice(0, ROUTINE_STEPS_MAX);
    // The morning always keeps at least one step, or the day could never be done.
    if (kept.length === 0) return { ...block, steps: was.steps, ...(was.minutes ? { minutes: was.minutes } : {}) };
    return { ...block, steps: kept.map((x) => x.step), minutes: kept.map((x) => x.mins) };
  });
}

/** The blocks whose times must run forward on the person's day. Morning, work and lights out are the person's own and are never refused. */
export const ROUTINE_TIMED_KEYS: readonly BlockKey[] = ['nutrition', 'social', 'skills'];
const isClock = (v: unknown): v is string => typeof v === 'string' && HHMM.test(v);
const blockIn = (blocks: readonly RoutineBlock[], key: BlockKey): RoutineBlock | undefined =>
  blocks.find((b): b is RoutineBlock => Boolean(b) && typeof b === 'object' && (b as { key?: unknown }).key === key);
/** The day a saved routine describes: wake-up from the morning's start (else lights out's end), lights out, and work. */
function routineDayOf(blocks: readonly RoutineBlock[]): Pick<RealDay, 'wake' | 'sleep' | 'workStart' | 'workEnd'> | null {
  const morning = blockIn(blocks, 'morning');
  const sleep = blockIn(blocks, 'sleep');
  const work = blockIn(blocks, 'work');
  const wake = [morning?.start, sleep?.end].find(isClock);
  if (!wake) return null;
  return {
    wake,
    sleep: isClock(sleep?.start) ? sleep.start : wake,
    workStart: isClock(work?.start) ? work.start : DEFAULT_REAL_DAY.workStart,
    workEnd: isClock(work?.end) ? work.end : DEFAULT_REAL_DAY.workEnd,
  };
}
/**
 * A block runs backwards when its end comes before its start on the day counted from wake-up, so a block that crosses
 * midnight inside the waking day is fine. With lights out at the wake-up time the day is a whole day, and an end at wake-up is its end.
 */
function runsBackwards(day: Pick<RealDay, 'wake' | 'sleep'>, b: RoutineBlock | undefined): boolean {
  if (!b || !isClock(b.start) || !isClock(b.end)) return false;
  const DAY = 24 * 60;
  const w = toMin(day.wake);
  const t = (x: string) => (((toMin(x) - w) % DAY) + DAY) % DAY;
  const whole = t(day.sleep) === 0;
  const end = t(b.end) === 0 && whole ? DAY : t(b.end);
  return end < t(b.start);
}
/** A timed block that runs backwards, and which of its times to change. */
export interface RoutineTimesIssue {
  block: RoutineBlock;
  /**
   * The start when it falls while the person is asleep (after lights out and before wake-up, as when the morning moved later
   * than Food and water's start): no end can fix that. Otherwise the end, which comes before the start.
   */
  field: 'start' | 'end';
  /** Wake-up as the routine's own blocks give it (the morning's start), for "Pick a start after …". */
  wake: string;
}
/** The first of Food and water, People or Learning (in the routine's own order) that runs backwards, and which time to change. */
export function routineTimesIssue(blocks: readonly RoutineBlock[]): RoutineTimesIssue | null {
  if (!Array.isArray(blocks)) return null;
  const day = routineDayOf(blocks);
  if (!day) return null;
  const block = blocks.find((b) => Boolean(b) && typeof b === 'object' && ROUTINE_TIMED_KEYS.includes(b.key) && runsBackwards(day, b));
  if (!block) return null;
  const DAY = 24 * 60;
  const w = toMin(day.wake);
  const t = (x: string) => (((toMin(x) - w) % DAY) + DAY) % DAY;
  const D = t(day.sleep) || DAY;
  return { block, field: t(block.start) > D ? 'start' : 'end', wake: day.wake };
}
/** The first of Food and water, People or Learning (in the routine's own order) whose end comes before its start, if any. */
export function routineBackwardsBlock(blocks: readonly RoutineBlock[]): RoutineBlock | null {
  return routineTimesIssue(blocks)?.block ?? null;
}
/**
 * The one check on edited routine times, for PATCH /session/routine (the editor words the same with the times in the person's
 * own format): the block named and the time to change, or null.
 */
export function routineTimesProblem(blocks: readonly RoutineBlock[]): string | null {
  const issue = routineTimesIssue(blocks);
  if (!issue) return null;
  const name = issue.block.name || 'This block';
  return issue.field === 'start' ? `${name} starts while you are asleep. Pick a start after you wake up.` : `${name} ends before it starts. Pick an end after its start.`;
}
/**
 * A block the template left empty before 2026-11-14, read only by what it wrote: People from the end of work to 21:00 when work
 * ended at 21:00, and Food from an hour after wake-up to 20:00 when the morning started at 19:00. A block a person set to
 * nothing at another time is theirs and stays.
 */
const emptyFromTemplate = (b: RoutineBlock | undefined, at: string, anchor: string | undefined, anchorAt: string): boolean =>
  Boolean(b) && b!.start === at && b!.end === at && anchor === anchorAt;
/**
 * A saved routine put right: a Food and water, People or Learning block that runs backwards on the person's own day (as the
 * routine's own blocks describe it) is laid out again by dayLayout. People and Learning are a pair, so both move when either
 * runs backwards, keeping their names and notes; Food's note moves only while it is one of the app's own two. The empty
 * blocks the same old template left (People 21:00 to 21:00 when work ended at 21:00, Food 20:00 to 20:00 for someone up
 * at 19:00) are laid out the same way. Nothing else moves, and a block that runs forward is never touched. A block laid out
 * where it already was keeps its own object, and a routine that needs nothing is returned as it came, the same array, so a
 * repair is kept once and never again.
 */
export function repairRoutineBlocks(blocks: RoutineBlock[], dayType: DayType = 'general'): RoutineBlock[] {
  if (!Array.isArray(blocks)) return blocks;
  const day = routineDayOf(blocks);
  if (!day) return blocks;
  const food = blockIn(blocks, 'nutrition');
  const people = blockIn(blocks, 'social');
  const fixFood = runsBackwards(day, food) || emptyFromTemplate(food, LAST_MEAL, blockIn(blocks, 'morning')?.start, '19:00');
  const fixPair = runsBackwards(day, people) || runsBackwards(day, blockIn(blocks, 'skills')) || emptyFromTemplate(people, PEOPLE_UNTIL, blockIn(blocks, 'work')?.end, PEOPLE_UNTIL);
  if (!fixFood && !fixPair) return blocks;
  const lay = dayLayout(day);
  const moved = (b: RoutineBlock, span: DaySpan, note = b.note): RoutineBlock => (b.start === span.start && b.end === span.end && b.note === note ? b : { ...b, start: span.start, end: span.end, note });
  const next = blocks.map((b) => {
    if (!b || typeof b !== 'object') return b;
    if (fixFood && b.key === 'nutrition') return moved(b, lay.food, b.note === FOOD_NOTE || b.note === FOOD_NOTE_MOVED ? foodNoteFor(lay.food.end) : b.note);
    if (fixPair && b.key === 'social') return moved(b, lay.people);
    if (fixPair && b.key === 'skills') return moved(b, dayType === 'exceptional' ? lay.learningShort : lay.learning);
    return b;
  });
  return next.every((b, i) => b === blocks[i]) ? blocks : next;
}

export const MANTRAS = [
  { key: 'om_namah_shivaya', name: 'Om Namah Shivaya', blurb: 'For the material path: work, money, the body.' },
  { key: 'hare_krishna', name: 'Hare Krishna', blurb: 'For the spiritual path: practice, surrender, meaning.' },
  { key: 'own', name: 'My own mantra', blurb: 'Words of your own.' },
  { key: 'none', name: 'No mantra yet', blurb: 'Breathing and reading only.' },
] as const;
export const OWN_MANTRA_MAX = 80;
export const BREATHING = [
  { key: 'box', name: 'Box breathing', blurb: 'In four, hold four, out four, hold four.' },
  { key: '478', name: 'Four seven eight', blurb: 'In four, hold seven, out eight.' },
  { key: 'nostril', name: 'Alternate nostril', blurb: 'One side in, the other out, slow.' },
  { key: 'pranayam', name: 'Pranayam', blurb: 'Slow, deep breaths into the belly, the breath out longer than the breath in.' },
] as const;
export interface Practices {
  mantra: (typeof MANTRAS)[number]['key'];
  /** The words, when the mantra is your own. */
  ownMantra?: string;
  breathing: (typeof BREATHING)[number]['key'];
  affirmation: string;
  reading: string;
}
/** The mantra in words: a known one's name, your own words in quotes, or none yet. */
export function mantraLine(p: Pick<Practices, 'mantra' | 'ownMantra'>): string {
  const own = p.ownMantra?.trim();
  if (p.mantra === 'own') return own ? `“${own}”` : 'No mantra yet';
  return MANTRAS.find((m) => m.key === p.mantra)?.name ?? 'No mantra yet';
}

/** One line to say on waking and before sleep, from the focus. */
export function affirmationFor(focus: RelationshipKey[]): string {
  const names = focus.map((k) => RELATIONSHIP_BY_KEY[k].name.toLowerCase());
  if (names.length === 0) return 'I show up today, scared or not.';
  return `I show up for ${names.join(' and ')} today, scared or not. Courage first; the rest follows.`;
}

export const PENALTIES = [
  { key: 'streak', name: 'The streak breaks', blurb: 'A missed week resets the routine streak to zero.' },
  { key: 'unlock', name: 'Unlocks wait', blurb: 'The next app does not open until a full week is in.' },
  { key: 'roster', name: 'The coach sees it', blurb: 'A red week shows on the coach roster.' },
] as const;
export interface Contract {
  minDays: number;
  checkinTime: string;
  penalty: (typeof PENALTIES)[number]['key'];
  nextWeekly: string;
  nextMonthly: string;
  signedName: string;
  signedAt: string;
}
export const CONTRACT_MIN_DAYS_DEFAULT = 5;

export interface Assessment {
  id: string;
  kind: 'onboard' | 'monthly' | 'quarterly' | 'biannual';
  placements: (Placement & PlacementFlags)[];
  fears: Fear[];
  insecurities: Insecurity[];
  scores: Scores;
  realDay: RealDay;
  focus: RelationshipKey[];
  /** The optional pillars the person said are not part of their life right now (`OPTIONAL_PILLARS`), placed at Neutrality. */
  away?: RelationshipKey[];
  createdAt: string;
}
export interface RoutineDay {
  day: string;
  dayType: DayType;
  steps: string[];
  /** The other blocks ticked that day, by key (never the morning, whose steps are ticked one by one). Pays nothing and never moves `done`. */
  blocks?: BlockKey[];
  done: boolean;
}
export interface SessionResponse {
  assessment: Assessment | null;
  routine: (Routine & { id: string; rampStep: number; practices: Practices; createdAt: string }) | null;
  contract: Contract | null;
  today: RoutineDay | null;
  /** Days this week the morning routine was fully done, out of seven. */
  week: { done: number; days: (boolean | null)[] };
}
