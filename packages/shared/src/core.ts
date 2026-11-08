// ---------------------------------------------------------------------------
// kreators.app — shared domain model (used by both the web app and the API)
// ---------------------------------------------------------------------------

// Journal prompts live in their own file, '@kreators/shared/journalPrompts' (the content is large, so it is not part of this
// barrel and the web app downloads it only when Prompt me is opened). The one line that Help also says sits here.
/** Said once, under the prompt card and in Help. The ideas come from these traditions, the wording is ours. */
export const JOURNAL_PROMPT_CREDIT = "Prompt ideas follow the journaling methods in Keila Shaheen's journals. The wording is our own.";

// India first, open to all: every date and number on screen is written the Indian way (13 Nov 2026, 12,34,567), and a day or a time
// that has no zone of its own reads as India's. Someone abroad still picks their own zone and currency.
/** The one locale for showing dates and numbers: Indian English (DD MMM YYYY, lakh and crore grouping). */
export const LOCALE = 'en-IN';
/** The zone a time falls back to when nobody gave one (an event without a zone, an account without one). */
export const DEFAULT_ZONE = 'Asia/Kolkata';
const COUNT_FORMAT = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
/** A whole count the Indian way: 1234567 is "12,34,567". */
export function formatCount(n: number): string {
  return COUNT_FORMAT.format(Number.isFinite(n) ? Math.round(n) : 0);
}

export type RelationshipKey =
  | 'servant_leader'
  | 'friendship'
  | 'parent_child'
  | 'lover_partner'
  | 'self'
  | 'guru'
  | 'divine';

export interface Relationship {
  key: RelationshipKey;
  /** Floor of the tower. 1 is the bottom (red), 7 is the top (violet). */
  floor: number;
  name: string;
  character: string;
  /** What the character looks after, said next to its name so the name is never alone. */
  role: string;
  color: string;
  soft: string;
  deep: string;
  /** Text color that passes contrast on top of `color`. */
  text: string;
  /** What the character says when you enter its realm. */
  greeting: string;
  /** The question this relationship keeps asking you. */
  question: string;
}

export const RELATIONSHIPS: readonly Relationship[] = [
  {
    key: 'servant_leader',
    floor: 1,
    name: 'Servitude',
    character: 'Ember',
    role: 'guide to servitude',
    color: '#C2375B',
    soft: '#FFE4E6',
    deep: '#9F1239',
    text: '#FFFFFF',
    greeting: "I'm Ember. I look after the people who count on you.",
    question: 'Who did you serve today?',
  },
  {
    key: 'friendship',
    floor: 2,
    name: 'Friends',
    character: 'Pip',
    role: 'guide to friends',
    color: '#F08A4B',
    soft: '#FFEDD5',
    deep: '#C2410C',
    text: '#25293A',
    greeting: "I'm Pip. Two lobes, one heart. Who's in your corner?",
    question: 'Who did you show up for?',
  },
  {
    key: 'parent_child',
    floor: 3,
    name: 'Family',
    character: 'Sunny',
    role: 'guide to family',
    color: '#F3CF5A',
    soft: '#FEF9C3',
    deep: '#A16207',
    text: '#262626',
    greeting: "I'm Sunny. I carry the little one on my shoulder. Family first, everything else second.",
    question: 'Did family hear from you?',
  },
  {
    key: 'lover_partner',
    floor: 4,
    name: 'Love',
    character: 'Clover',
    role: 'guide to love',
    color: '#42714A',
    soft: '#F0F2E8',
    deep: '#5A6B38',
    text: '#FFFFFF',
    greeting: "I'm Clover. Love is a daily act, not a yearly highlight.",
    question: 'Was there phone-free time?',
  },
  {
    key: 'self',
    floor: 5,
    name: 'Yourself',
    character: 'Dew',
    role: 'guide to yourself',
    color: '#2A6FAA',
    soft: '#DCEBF8',
    deep: '#1F5F94',
    text: '#FFFFFF',
    greeting: "I'm Dew. One drop, very clear. How are you really?",
    question: 'Did you rest, move, breathe?',
  },
  {
    key: 'guru',
    floor: 6,
    name: 'Teachers',
    character: 'Sage',
    role: 'guide to teachers',
    color: '#4C57C7',
    soft: '#E1E4FA',
    deep: '#323C9A',
    text: '#FFFFFF',
    greeting: "I'm Sage. Everyone you admire had a teacher. Who's yours?",
    question: 'What did you learn on purpose?',
  },
  {
    key: 'divine',
    floor: 7,
    name: 'Faith',
    character: 'Lumen',
    role: 'guide to faith',
    color: '#5A3FA6',
    soft: '#DDD6FE',
    deep: '#2E1065',
    text: '#FFFFFF',
    greeting: "I'm Lumen. Something bigger than the daily rush is watching over you.",
    question: 'Did you pause for awe?',
  },
] as const;

/** A lookup by key with no prototype, so a key a person typed ("constructor", "toString") finds nothing instead of an inherited function. */
export function byKey<R>(entries: Iterable<readonly [string, unknown]>): R {
  return Object.assign(Object.create(null), Object.fromEntries(entries)) as R;
}
export const RELATIONSHIP_BY_KEY: Record<RelationshipKey, Relationship> = byKey(
  RELATIONSHIPS.map((r) => [r.key, r]),
) as Record<RelationshipKey, Relationship>;

/** A character's name with what it looks after: "Dew, guide to yourself". */
/**
 * Bumling: the app's own guide. It runs the parts of a chat that belong to no one of the seven, like setting up
 * the app, the map and the plan, so a character only speaks where its relationship is the subject.
 */
export const BUMLING = { key: 'bumling', character: 'Bumling', role: 'guide to the app' } as const;
/** Who speaks in a chat: one of the seven, or Bumling. */
export type Host = RelationshipKey | 'bumling';
export const hostName = (h: Host): string => (h === 'bumling' ? BUMLING.character : RELATIONSHIP_BY_KEY[h].character);

export function characterTitle(key: Host): string {
  if (key === 'bumling') return `${BUMLING.character}, ${BUMLING.role}`;
  const r = RELATIONSHIP_BY_KEY[key];
  return `${r.character}, ${r.role}`;
}

/** How a character introduces itself in a chat: "Dew here, your guide to yourself." */
export function characterHello(key: Host): string {
  if (key === 'bumling') return `${BUMLING.character} here, your ${BUMLING.role}.`;
  const r = RELATIONSHIP_BY_KEY[key];
  return `${r.character} here, your ${r.role}.`;
}

export function isRelationshipKey(v: unknown): v is RelationshipKey {
  return typeof v === 'string' && v in RELATIONSHIP_BY_KEY;
}

// ---------------------------------------------------------------------------
// Pages: every long list is served a page at a time, 10, 25, 50 or 100 rows, with a next page.
// ---------------------------------------------------------------------------

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** Where a list is: which page, how many rows a page holds, and whether a next page exists. */
export interface Page {
  page: number;
  size: PageSize;
  more: boolean;
  /** Set when a page past the first came back with no rows (its last row was acted on, or a filter changed under it), so the pager steps back. */
  empty?: boolean;
}

/** A page size from a query string or a select, or the default. */
export function pageSizeOf(v: unknown): PageSize {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
}

/** The query string for a page, with an optional prefix for a second list on the same screen: "lpage=2&lsize=50". */
export function pageQuery(page: number, size: number, prefix = ''): string {
  return `${prefix}page=${Math.max(1, Math.floor(page))}&${prefix}size=${pageSizeOf(size)}`;
}

// ---------------------------------------------------------------------------
// The ruler (components/RulerPicker.tsx): a row of tick marks for choosing a number from a range with a step. Only the maths lives here.
// ---------------------------------------------------------------------------

/** How many decimals a step carries (0.5 has one, 5 has none), so a value never drifts to 0.30000000000000004. */
const stepDecimals = (step: number): number => {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : Math.min(6, s.length - dot - 1);
};
const roundTo = (v: number, decimals: number): number => Number(v.toFixed(decimals));
/** A ruler's range, made safe: a whole-or-decimal step above zero, and a max that is not under the min. */
function rulerRange(min: number, max: number, step: number) {
  const st = Number.isFinite(step) && step > 0 ? step : 1;
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) && max >= lo ? max : lo;
  const decimals = Math.max(stepDecimals(st), stepDecimals(lo));
  // The last tick is the highest value `min + n * step` that does not pass the max (a max that is not a multiple of the step is not itself a tick).
  const last = Math.floor((hi - lo) / st + 1e-9);
  return { lo, st, decimals, last };
}
/** The tick number (0 is the first) of a value, as a fraction when the value sits between two ticks. Clamped to the ruler. */
export function rulerIndex(value: number, min: number, max: number, step: number): number {
  const { lo, st, last } = rulerRange(min, max, step);
  const raw = (Number(value) - lo) / st;
  if (!Number.isFinite(raw)) return 0;
  return Math.min(last, Math.max(0, raw));
}
/** A value held to the ruler: inside min and max and on the nearest tick (a step counted from the min). */
export function rulerClamp(value: number, min: number, max: number, step: number): number {
  const { lo, st, decimals } = rulerRange(min, max, step);
  return roundTo(lo + Math.round(rulerIndex(value, min, max, step)) * st, decimals);
}
/** The value under a pixel offset from the first tick's centre, on a ruler whose ticks sit `gap` pixels apart. */
export function rulerValueAt(offsetPx: number, min: number, max: number, step: number, gap: number): number {
  const g = Number.isFinite(gap) && gap > 0 ? gap : 1;
  const { lo, st, decimals, last } = rulerRange(min, max, step);
  const i = Math.min(last, Math.max(0, Math.round((Number.isFinite(offsetPx) ? offsetPx : 0) / g)));
  return roundTo(lo + i * st, decimals);
}
/** Every tick of a ruler, with the ones that carry a label (a multiple of `labelEvery`, counted from zero, so 20, 25 and 30 when it is 5). */
export function rulerTicks(min: number, max: number, step: number, labelEvery?: number): { value: number; major: boolean }[] {
  const { lo, st, decimals, last } = rulerRange(min, max, step);
  const out: { value: number; major: boolean }[] = [];
  for (let i = 0; i <= last; i += 1) {
    const value = roundTo(lo + i * st, decimals);
    const major = typeof labelEvery === 'number' && labelEvery > 0 ? Math.abs(value / labelEvery - Math.round(value / labelEvery)) < 1e-9 : false;
    out.push({ value, major });
  }
  return out;
}
