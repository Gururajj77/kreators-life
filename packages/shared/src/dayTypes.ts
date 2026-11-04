import type { RelationshipKey } from './core.ts';

// ---------------------------------------------------------------------------
// Day types (2026-11-04, the founder's ask): a person says what kind of day it is, and Daily's "By context" sort puts that day's
// lead pillar first inside each priority. P0 always stays above P1 and the rest; the lead only decides the order within a priority.
// The kinds come from the founder's three books. `source` names the book and the pages a type was read from, or says it is the
// app's own reading. Nothing here quotes a book at length or adds what a book does not say.
// ---------------------------------------------------------------------------

export const DAY_TYPE_KEYS = ['deep_work', 'create', 'learning', 'money', 'admin', 'family', 'rest', 'friends', 'date', 'reset', 'low_energy'] as const;
export type DayTypeKey = (typeof DAY_TYPE_KEYS)[number];

export interface DayKind {
  key: DayTypeKey;
  /** The chip's words. */
  name: string;
  /** The pillar whose tasks come first inside each priority. */
  lead: RelationshipKey;
  /** The pillar that comes next, before the rest. */
  second: RelationshipKey;
  /** One plain line on why this pillar leads today. */
  why: string;
  /** Where the idea comes from: a book and its pages, or "The app's own". */
  source: string;
}

const TRM = 'The Relationship Method';
const DOM_C = 'Dictionary of Mistakes for Creators';
const DOM_20 = 'Dictionary of Mistakes for 20s';

/** The kinds of day, in the order the picker shows them. Deep work is the founder's own example and comes first. */
export const DAY_TYPES: readonly DayKind[] = [
  {
    key: 'deep_work',
    name: 'Deep work',
    lead: 'servant_leader',
    second: 'self',
    why: 'Servitude tasks come first. Give your first hours to output, with the internet off.',
    source: `${TRM}, p. 168 and 197–198; ${DOM_20}, p. 269–270`,
  },
  {
    key: 'create',
    name: 'Create',
    lead: 'self',
    second: 'servant_leader',
    why: 'Your own craft comes first. Write, edit and publish on different days, and never publish the day you make it.',
    source: `${TRM}, p. 257 and 267; ${DOM_C}, p. 44 and 180–182`,
  },
  {
    key: 'learning',
    name: 'Learning',
    lead: 'guru',
    second: 'self',
    why: 'Teacher tasks come first. Turn what you learn into one thing done within a day.',
    source: `${TRM}, p. 162 and 189–190; ${DOM_20}, p. 266–268`,
  },
  {
    key: 'money',
    name: 'Money',
    lead: 'servant_leader',
    second: 'self',
    why: 'Money tasks come first. Look at your bank account, cut what you do not use, plan the week’s cash.',
    source: `${TRM}, p. 168–170 and 346–347; ${DOM_20}, p. 159–162`,
  },
  {
    key: 'admin',
    name: 'Admin',
    lead: 'servant_leader',
    second: 'guru',
    why: 'Clear the admin pile first. Write down how a job is done so it stops coming back to you.',
    source: `${TRM}, p. 168 and 232; ${DOM_20}, p. 299 and 302–307`,
  },
  {
    key: 'family',
    name: 'Family',
    lead: 'parent_child',
    second: 'self',
    why: 'Family tasks come first. Go to dinner, eat the food, and let that be enough.',
    source: `${TRM}, p. 166 and 194–195`,
  },
  {
    key: 'rest',
    name: 'Rest and body',
    lead: 'parent_child',
    second: 'self',
    why: 'The book puts health on the family level, so family tasks lead. Sleep, move and rest; recovery, not escape.',
    source: `${TRM}, p. 165–166 and 336; ${DOM_20}, p. 74–77`,
  },
  {
    key: 'friends',
    name: 'Friends and fun',
    lead: 'friendship',
    second: 'self',
    why: 'Friend tasks come first. Play, a hike, a game of pool: friends keep the joy moving.',
    source: `${TRM}, p. 167 and 328–331; ${DOM_20}, p. 209–211`,
  },
  {
    key: 'date',
    name: 'Date',
    lead: 'lover_partner',
    second: 'self',
    why: 'Partner tasks come first, and your own after. Clear your own load so you can share the time.',
    source: `${TRM}, p. 165, 192–194 and 278; ${DOM_20}, p. 193`,
  },
  {
    key: 'reset',
    name: 'Reset',
    lead: 'self',
    second: 'guru',
    why: 'Your own tasks come first. Look back on the week and write what to stop doing.',
    source: `${DOM_20}, p. 357–371; ${TRM}, p. 378–379`,
  },
  {
    key: 'low_energy',
    name: 'Low energy',
    lead: 'self',
    second: 'divine',
    why: 'Your own tasks come first. Do the smallest version you promised for your worst days, and never drop to zero.',
    source: `${DOM_C}, p. 182–183; ${TRM}, p. 249–250. Faith second is the app’s own reading`,
  },
];

const DAY_TYPE_BY_KEY: Readonly<Record<string, DayKind>> = Object.freeze(Object.assign(Object.create(null) as Record<string, DayKind>, Object.fromEntries(DAY_TYPES.map((d) => [d.key, d]))));

/** The day type for a key, or null for anything else (a typed key is looked up without a prototype, so "constructor" finds nothing). */
export function dayTypeOf(raw: unknown): DayKind | null {
  return typeof raw === 'string' ? (DAY_TYPE_BY_KEY[raw] ?? null) : null;
}
export const isDayTypeKey = (raw: unknown): raw is DayTypeKey => dayTypeOf(raw) !== null;

/** What `GET /today/day-type` answers: the kind picked for that day, or null. */
export interface DayTypeResponse {
  date: string;
  kind: DayTypeKey | null;
}
