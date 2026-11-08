import { isRelationshipKey, LOCALE } from './core.ts';
import type { RelationshipKey } from './core.ts';
import { addDays, isoWeekday } from './dates.ts';
import { dayTypeOf } from './dayTypes.ts';
import type { DayTypeKey } from './dayTypes.ts';
import { lifeAreaProblem, parseLifeArea } from './life.ts';
import type { LifeAreaKey } from './life.ts';
import type { Priority } from './tasks.ts';

// ---------------------------------------------------------------------------
// Time blocks, day templates and the weekly pattern (the founder's ask of 2026-11-06; docs/time-blocks.md is the design).
// A block is a named stretch of the day with a tag, a colour, and maybe an area of life and a pillar. A day template lays blocks
// on the clock and carries the pillar that leads; it is the kind of day. The weekly pattern gives each weekday a template, and a
// change to one date leaves the pattern alone. Rules only: no model, no cost, nothing leaves the account.
// This file reads nothing from tasks.ts at load time (types only), so tasks.ts can use it in its functions.
// ---------------------------------------------------------------------------

export const MAX_TIME_BLOCKS = 24;
export const MAX_DAY_TEMPLATES = 24;
export const MAX_TEMPLATE_SLOTS = 24;
export const BLOCK_NAME_MAX = 40;
export const BLOCK_TAG_MAX = 24;
export const DAY_TEMPLATE_NAME_MAX = 40;
/** The most dates one "use it on more days" may set at once. */
export const MAX_APPLY_DATES = 31;
/** The most tasks Daily's grouped view reads at once (`GET /today?group=1`). */
export const DAILY_GROUPED_MAX = 60;
/** Tags offered as suggestions in the tag field (a person may type any other). */
export const TIME_BLOCK_TAGS = ['Focus', 'Admin', 'Self care', 'Recovery', 'Social', 'Fun', 'Growth', 'Travel'] as const;
/** The tag the suggestion rule and Plan my week treat as "deep work-like". Matched without case. */
export const FOCUS_TAG = 'Focus';
/** What a task with no estimate counts as inside a block (the same thirty minutes as PLAN_DEFAULT_MINUTES in tasks.ts). */
const SLOT_TASK_MINUTES = 30;
const DAY_MINUTES = 1440;

// ---- swatches: keys only; CSS maps each key to a theme token, so stored data never becomes a raw colour, except a person's own colour,
// which is their data: a "#rrggbb" they typed (2026-11-06, the founder: "allow to add custom hex code in last one") ----

/** The picker's eleven colours, round the colour wheel the founder gave (2026-11-06), from amber clockwise; with your own colour, twelve. */
export const TIME_BLOCK_SWATCHES = ['amber', 'orange', 'vermilion', 'red', 'magenta', 'purple', 'indigo', 'blue', 'teal', 'green', 'lime'] as const;
/** Colours a block may still carry from before the wheel (shown as they were, never offered in the picker). */
export const LEGACY_SWATCHES = ['yellow', 'sky', 'earth', 'gold', 'violet', 'silver', 'slate'] as const;
export type SwatchKey = (typeof TIME_BLOCK_SWATCHES)[number] | (typeof LEGACY_SWATCHES)[number];
/** A person's own colour, "#rrggbb" in lower case. */
export type HexColor = `#${string}`;
/** A block's colour: one of the swatches, or a person's own. */
export type BlockColor = SwatchKey | HexColor;
/** The swatch's name (for its label) and whether a solid dot of it carries dark ink. */
export const SWATCH_META: Record<SwatchKey, { name: string; darkInk: boolean }> = {
  yellow: { name: 'Yellow', darkInk: true },
  amber: { name: 'Amber', darkInk: true },
  orange: { name: 'Orange', darkInk: true },
  vermilion: { name: 'Red orange', darkInk: false },
  red: { name: 'Red', darkInk: false },
  magenta: { name: 'Magenta', darkInk: false },
  purple: { name: 'Purple', darkInk: false },
  indigo: { name: 'Indigo', darkInk: false },
  blue: { name: 'Blue', darkInk: false },
  teal: { name: 'Teal', darkInk: false },
  green: { name: 'Green', darkInk: false },
  lime: { name: 'Lime', darkInk: true },
  sky: { name: 'Sky', darkInk: false },
  earth: { name: 'Earth', darkInk: false },
  gold: { name: 'Gold', darkInk: true },
  violet: { name: 'Violet', darkInk: false },
  silver: { name: 'Silver', darkInk: true },
  slate: { name: 'Slate', darkInk: false },
};
const SWATCH_KEYS: readonly string[] = [...TIME_BLOCK_SWATCHES, ...LEGACY_SWATCHES];
export function isSwatch(v: unknown): v is SwatchKey {
  return typeof v === 'string' && SWATCH_KEYS.includes(v);
}
const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** A typed own colour as "#rrggbb" (lower case; "#abc" and "abc" grow to six), else null. */
export function hexColorOf(v: unknown): HexColor | null {
  if (typeof v !== 'string') return null;
  const m = HEX_RE.exec(v.trim());
  if (!m) return null;
  const h = m[1]!.toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`;
}
/** A block colour as sent or stored: a swatch key, or a person's own hex; anything else is null. */
export function blockColorOf(v: unknown): BlockColor | null {
  return isSwatch(v) ? v : hexColorOf(v);
}

// ---- types ----

export interface TimeBlock {
  id: string;
  /** The starting block's key when the app made it, else null. */
  seed: string | null;
  name: string;
  tag: string;
  color: BlockColor;
  area: LifeAreaKey | null;
  pillar: RelationshipKey | null;
  sort: number;
}
/** A block on the clock: minutes after midnight, 0 to 1439. An end before the start wraps past midnight; an end of 0 is midnight. */
export interface TemplateSlot {
  blockId: string;
  start: number;
  end: number;
}
export interface DayTemplate {
  id: string;
  seed: string | null;
  /** The old kind of day (DAY_TYPES) a starting template was made from, so an old day_types row still finds it. */
  sourceKind: DayTypeKey | null;
  name: string;
  lead: RelationshipKey;
  second: RelationshipKey | null;
  why: string | null;
  source: string | null;
  isDefault: boolean;
  sort: number;
  /** The template's own colour (2026-11-06, the founder: "own colour per template"), or null when none was picked; read it through
   * `templateColor`, which falls back to the colour of its longest block. */
  color: BlockColor | null;
  slots: TemplateSlot[];
}
/** Where a day's template came from: a change to that date, the weekly pattern, or the default. */
export type DayFrom = 'date' | 'week' | 'default';
export interface ResolvedDay {
  date: string;
  /** 1 Monday to 7 Sunday. */
  weekday: number;
  templateId: string;
  from: DayFrom;
}
/** What `GET /time-blocks?week=` answers. */
export interface TimeBlocksResponse {
  /** The Monday asked about. */
  week: string;
  /** Seven, Monday first. */
  days: ResolvedDay[];
  blocks: TimeBlock[];
  /** With their slots, in their order. */
  templates: DayTemplate[];
  defaultTemplateId: string;
  /** Seven entries, Monday first; null follows the default. */
  pattern: (string | null)[];
  /** The changes to single dates inside this week. */
  overrides: { date: string; templateId: string }[];
}
/** The day's plan, on GET /today and inside the week plan. */
export interface DayPlan {
  date: string;
  template: { id: string; name: string; lead: RelationshipKey; second: RelationshipKey | null; why: string | null; source: string | null };
  from: DayFrom;
  /** In clock order (`slotOrder`). */
  slots: TemplateSlot[];
  /** Every block of the person's, so a task picked into one that is not in today's plan can still be named. */
  blocks: TimeBlock[];
  /** GET /today only: the minutes planned in each slot (in `slotOrder(slots)` order) from every open task that opens that day, whatever
   * the screen shows or filters (`slotIndexOfTask`, an estimate or PLAN_DEFAULT_MINUTES each), so a slot's room is never read off the six shown. */
  slotPlannedMin?: number[];
  /** GET /today only: whether the server sorted the six shown by context (`contextApplies`), so the screen agrees before the week loads. */
  contextual?: boolean;
}

// ---- the starting set (data only; a person can change, copy or delete every part) ----

export interface StartingBlock {
  seed: string;
  name: string;
  tag: string;
  color: BlockColor;
  area: LifeAreaKey | null;
  pillar: RelationshipKey | null;
}
export interface StartingTemplate {
  seed: string;
  name: string;
  sourceKind: DayTypeKey | null;
  lead: RelationshipKey;
  second: RelationshipKey | null;
  why: string;
  source: string;
  isDefault: boolean;
  /** Its starting colour: no two starting kinds alike where the eleven wheel colours allow (docs/time-blocks.md, "A kind's colour"). */
  color: BlockColor;
  slots: { block: string; start: string; end: string }[];
}

/** The founder's ten first, then Travel, then three that only the starting templates use. */
export const STARTING_BLOCKS: readonly StartingBlock[] = [
  { seed: 'hygiene', name: 'Morning hygiene', tag: 'Self care', color: 'lime', area: 'physical', pillar: 'self' },
  { seed: 'routine', name: 'Morning routine', tag: 'Self care', color: 'purple', area: 'spiritual', pillar: 'divine' },
  { seed: 'deep', name: 'Deep work', tag: 'Focus', color: 'red', area: 'financial', pillar: 'servant_leader' },
  { seed: 'recovery', name: 'Recovery', tag: 'Recovery', color: 'green', area: 'physical', pillar: 'self' },
  { seed: 'busy', name: 'Busy work', tag: 'Admin', color: 'blue', area: 'financial', pillar: 'servant_leader' },
  { seed: 'social', name: 'Fun/social', tag: 'Social', color: 'orange', area: 'emotional', pillar: 'friendship' },
  { seed: 'fun', name: 'Entertainment', tag: 'Fun', color: 'orange', area: 'emotional', pillar: null },
  { seed: 'learn', name: 'Learn/explore', tag: 'Growth', color: 'teal', area: 'mental', pillar: 'guru' },
  { seed: 'selflove', name: 'Self love', tag: 'Self care', color: 'magenta', area: 'emotional', pillar: 'self' },
  { seed: 'sleep', name: 'Sleep', tag: 'Recovery', color: 'indigo', area: 'physical', pillar: 'self' },
  { seed: 'travel', name: 'Travel', tag: 'Travel', color: 'vermilion', area: null, pillar: null },
  { seed: 'family', name: 'Family time', tag: 'Social', color: 'amber', area: 'emotional', pillar: 'parent_child' },
  { seed: 'date', name: 'Date', tag: 'Social', color: 'magenta', area: 'emotional', pillar: 'lover_partner' },
  { seed: 'reflect', name: 'Reflection', tag: 'Self care', color: 'purple', area: 'mental', pillar: 'self' },
];

type SlotSpec = [block: string, start: string, end: string];
const slotsOf = (list: SlotSpec[]): StartingTemplate['slots'] => list.map(([block, start, end]) => ({ block, start, end }));

/** The founder's own day: the ten blocks at the founder's times. */
const EVERYDAY: SlotSpec[] = [
  ['hygiene', '07:00', '08:00'],
  ['routine', '08:00', '10:00'],
  ['deep', '10:00', '13:00'],
  ['recovery', '13:00', '15:00'],
  ['busy', '15:00', '17:00'],
  ['social', '17:00', '19:00'],
  ['fun', '19:00', '21:00'],
  ['learn', '21:00', '22:00'],
  ['selflove', '22:00', '23:00'],
  ['sleep', '23:00', '07:00'],
];
/** Everyday with the slot that starts at `start` replaced by the given ones. */
function everydayWith(start: string, ...put: SlotSpec[]): SlotSpec[] {
  const out: SlotSpec[] = [];
  for (const s of EVERYDAY) {
    if (s[1] === start) out.push(...put);
    else out.push(s);
  }
  return out;
}
/** A starting template made from an old kind of day: its lead, second, line and book pages, word for word. */
function fromKind(seed: string, name: string, kind: DayTypeKey, color: BlockColor, slots: SlotSpec[]): StartingTemplate {
  const k = dayTypeOf(kind);
  if (!k) throw new Error(`unknown kind of day ${kind}`);
  return { seed, name, sourceKind: kind, lead: k.lead, second: k.second, why: k.why, source: k.source, isDefault: false, color, slots: slotsOf(slots) };
}

export const STARTING_TEMPLATES: readonly StartingTemplate[] = [
  {
    seed: 'everyday',
    name: 'Everyday',
    sourceKind: null,
    lead: 'servant_leader',
    second: 'self',
    why: 'Work gets your best hours; your own care holds the rest.',
    source: 'The founder’s own day',
    isDefault: true,
    color: 'indigo',
    slots: slotsOf(EVERYDAY),
  },
  fromKind('deep', 'Deep work day', 'deep_work', 'red', [
    ['hygiene', '07:00', '08:00'],
    ['routine', '08:00', '09:00'],
    ['deep', '09:00', '13:00'],
    ['recovery', '13:00', '14:00'],
    ['deep', '14:00', '16:00'],
    ['busy', '16:00', '17:00'],
    ['social', '17:00', '19:00'],
    ['fun', '19:00', '21:00'],
    ['learn', '21:00', '22:00'],
    ['selflove', '22:00', '23:00'],
    ['sleep', '23:00', '07:00'],
  ]),
  fromKind('create', 'Create day', 'create', 'vermilion', everydayWith('15:00', ['deep', '15:00', '17:00'])),
  fromKind('learning', 'Learning day', 'learning', 'teal', [
    ['hygiene', '07:00', '08:00'],
    ['routine', '08:00', '10:00'],
    ['learn', '10:00', '13:00'],
    ['recovery', '13:00', '15:00'],
    ['busy', '15:00', '17:00'],
    ['social', '17:00', '19:00'],
    ['fun', '19:00', '21:00'],
    ['learn', '21:00', '22:00'],
    ['selflove', '22:00', '23:00'],
    ['sleep', '23:00', '07:00'],
  ]),
  fromKind('money', 'Money day', 'money', 'lime', everydayWith('10:00', ['busy', '10:00', '11:00'], ['deep', '11:00', '13:00'])),
  fromKind('admin', 'Admin day', 'admin', 'blue', everydayWith('10:00', ['busy', '10:00', '13:00'])),
  fromKind('family', 'Family day', 'family', 'amber', [
    ['hygiene', '07:00', '08:00'],
    ['routine', '08:00', '09:00'],
    ['family', '09:00', '13:00'],
    ['recovery', '13:00', '15:00'],
    ['family', '15:00', '19:00'],
    ['fun', '19:00', '21:00'],
    ['learn', '21:00', '22:00'],
    ['selflove', '22:00', '23:00'],
    ['sleep', '23:00', '07:00'],
  ]),
  fromKind('recovery', 'Recovery day', 'rest', 'green', [
    ['sleep', '22:00', '08:00'],
    ['hygiene', '08:00', '09:00'],
    ['routine', '09:00', '10:00'],
    ['recovery', '10:00', '13:00'],
    ['social', '13:00', '15:00'],
    ['recovery', '15:00', '18:00'],
    ['fun', '18:00', '20:00'],
    ['selflove', '20:00', '22:00'],
  ]),
  fromKind('social', 'Social day', 'friends', 'orange', [
    ['hygiene', '07:00', '08:00'],
    ['routine', '08:00', '10:00'],
    ['busy', '10:00', '12:00'],
    ['recovery', '12:00', '14:00'],
    ['social', '14:00', '22:00'],
    ['selflove', '22:00', '23:00'],
    ['sleep', '23:00', '07:00'],
  ]),
  fromKind('date', 'Date day', 'date', 'magenta', [
    ['hygiene', '07:00', '08:00'],
    ['routine', '08:00', '10:00'],
    ['deep', '10:00', '13:00'],
    ['recovery', '13:00', '15:00'],
    ['busy', '15:00', '17:00'],
    ['selflove', '17:00', '18:00'],
    ['date', '18:00', '22:00'],
    ['selflove', '22:00', '23:00'],
    ['sleep', '23:00', '07:00'],
  ]),
  fromKind('reflection', 'Reflection day', 'reset', 'purple', [
    ['hygiene', '07:00', '08:00'],
    ['routine', '08:00', '10:00'],
    ['reflect', '10:00', '12:00'],
    ['busy', '12:00', '13:00'],
    ['recovery', '13:00', '15:00'],
    ['learn', '15:00', '17:00'],
    ['social', '17:00', '19:00'],
    ['fun', '19:00', '21:00'],
    ['reflect', '21:00', '22:00'],
    ['selflove', '22:00', '23:00'],
    ['sleep', '23:00', '07:00'],
  ]),
  fromKind('lowenergy', 'Low energy day', 'low_energy', 'indigo', [
    ['sleep', '22:00', '08:00'],
    ['hygiene', '08:00', '09:00'],
    ['routine', '09:00', '10:00'],
    ['deep', '10:00', '11:00'],
    ['recovery', '11:00', '15:00'],
    ['busy', '15:00', '16:00'],
    ['social', '16:00', '18:00'],
    ['fun', '18:00', '20:00'],
    ['selflove', '20:00', '22:00'],
  ]),
  {
    seed: 'selflove',
    name: 'Self love day',
    sourceKind: null,
    lead: 'self',
    second: 'divine',
    why: 'Your own tasks come first. Fill the day with what refills you.',
    source: 'The app’s own',
    isDefault: false,
    color: 'lime',
    slots: slotsOf([
      ['hygiene', '07:00', '08:00'],
      ['routine', '08:00', '10:00'],
      ['selflove', '10:00', '13:00'],
      ['recovery', '13:00', '15:00'],
      ['learn', '15:00', '17:00'],
      ['social', '17:00', '19:00'],
      ['fun', '19:00', '21:00'],
      ['selflove', '21:00', '23:00'],
      ['sleep', '23:00', '07:00'],
    ]),
  },
  {
    seed: 'travel',
    name: 'Travel day',
    sourceKind: null,
    lead: 'self',
    second: 'friendship',
    why: 'Your own tasks come first. Keep the day light around the journey.',
    source: 'The app’s own',
    isDefault: false,
    color: 'vermilion',
    slots: slotsOf([
      ['hygiene', '06:00', '07:00'],
      ['travel', '07:00', '12:00'],
      ['recovery', '12:00', '14:00'],
      ['travel', '14:00', '18:00'],
      ['social', '18:00', '20:00'],
      ['selflove', '20:00', '22:00'],
      ['sleep', '22:00', '06:00'],
    ]),
  },
];

/** The starting template made from an old kind of day. Every kind has one (tested). */
export function startingTemplateFor(kind: DayTypeKey): StartingTemplate {
  const found = STARTING_TEMPLATES.find((t) => t.sourceKind === kind);
  if (!found) throw new Error(`no starting template for ${kind}`);
  return found;
}

// ---- time ----

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** "07:30" to 450; anything else (24:00, 7:00, 07:60) is null. */
export function minuteOf(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string' || !HHMM_RE.test(hhmm)) return null;
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}
/** 450 to "07:30". */
export function hhmm(min: number): string {
  const m = ((Math.round(min) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** 450 to "7:30 am", in LOCALE. A plain clock time, so no zone is involved. */
export function minuteLabel(min: number): string {
  const m = ((Math.round(min) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60), m % 60)).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}
/** A slot's minutes, wrapping past midnight: 23:00 to 07:00 is 480, 22:00 to 00:00 is 120. */
export function slotLength(s: { start: number; end: number }): number {
  const n = (s.end - s.start + DAY_MINUTES) % DAY_MINUTES;
  return n === 0 ? DAY_MINUTES : n;
}
/** Whether a minute of the day lies in the slot, from its start up to (not including) its end, wrapping past midnight. */
export function slotContains(s: { start: number; end: number }, minute: number): boolean {
  if (s.start < s.end) return minute >= s.start && minute < s.end;
  return minute >= s.start || minute < s.end;
}
/** A slot as one or two plain stretches of [0, 1440). */
function stretches(s: { start: number; end: number }): [number, number][] {
  if (s.start < s.end) return [[s.start, s.end]];
  const out: [number, number][] = [[s.start, DAY_MINUTES]];
  if (s.end > 0) out.push([0, s.end]);
  return out;
}
/** Whether two slots share any minute. Touching ends do not overlap. */
export function slotsOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  for (const [a0, a1] of stretches(a)) for (const [b0, b1] of stretches(b)) if (a0 < b1 && b0 < a1) return true;
  return false;
}
/** Slots by start, earliest first (a wrapping Sleep at 23:00 sorts last). */
export function slotOrder<T extends { start: number }>(slots: readonly T[]): T[] {
  return [...slots].sort((a, b) => a.start - b.start);
}
/** "10:00 am to 1:00 pm". */
export function slotRangeLabel(s: { start: number; end: number }): string {
  return `${minuteLabel(s.start)} to ${minuteLabel(s.end)}`;
}
/** "3 h", "1 h 30", "45 min". */
export function spanLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}
const isFocusTag = (tag: string): boolean => tag.trim().toLowerCase() === FOCUS_TAG.toLowerCase();

// ---- the only readers of what a request sends ----

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const pillarOk = (v: unknown): boolean => v === null || v === undefined || v === '' || v === 'none' || isRelationshipKey(v);
const pillarOf = (v: unknown): RelationshipKey | null => (isRelationshipKey(v) ? v : null);

/** What is wrong with a block as sent, or null. `partial` (an edit) lets any field be left out. */
export function timeBlockProblem(body: unknown, partial: boolean): string | null {
  const o = obj(body);
  if (!o) return 'Send the block’s name and colour.';
  if (!partial || 'name' in o) {
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) return 'Give the block a name.';
    if (name.length > BLOCK_NAME_MAX) return `Keep the name to ${BLOCK_NAME_MAX} characters.`;
  }
  if ('tag' in o && o.tag !== null && o.tag !== undefined) {
    if (typeof o.tag !== 'string') return 'A tag is a few words.';
    if (o.tag.trim().length > BLOCK_TAG_MAX) return `Keep the tag to ${BLOCK_TAG_MAX} characters.`;
  }
  if (!partial || 'color' in o) {
    if (!blockColorOf(o.color)) return 'Pick one of the colours, or type a colour like #1e90ff.';
  }
  if ('area' in o) {
    const p = lifeAreaProblem(o.area);
    if (p) return p;
  }
  if ('pillar' in o && !pillarOk(o.pillar)) return 'Pick one of the seven pillars, or none.';
  return null;
}
/** The fields of a block as sent, checked by `timeBlockProblem` first; only the ones present. */
export function parseTimeBlockBody(body: unknown): Partial<Omit<TimeBlock, 'id' | 'seed' | 'sort'>> {
  const o = obj(body) ?? {};
  const out: Partial<Omit<TimeBlock, 'id' | 'seed' | 'sort'>> = {};
  if (typeof o.name === 'string') out.name = o.name.trim().slice(0, BLOCK_NAME_MAX);
  if ('tag' in o) out.tag = typeof o.tag === 'string' ? o.tag.trim().slice(0, BLOCK_TAG_MAX) : '';
  const color = blockColorOf(o.color);
  if (color) out.color = color;
  if ('area' in o) out.area = parseLifeArea(o.area);
  if ('pillar' in o) out.pillar = pillarOf(o.pillar);
  return out;
}

/**
 * A template's slots as sent: `[{ blockId, start: "HH:MM", end: "HH:MM" }]`. At most MAX_TEMPLATE_SLOTS, each a block the person
 * owns, never starting and ending at the same minute, no two overlapping (the problem names both). Returned in clock order.
 */
export function parseSlots(raw: unknown, blockIds: ReadonlySet<string>, names?: Readonly<Record<string, string>>): { slots: TemplateSlot[] } | { problem: string } {
  if (!Array.isArray(raw)) return { problem: 'Send the slots as a list.' };
  if (raw.length > MAX_TEMPLATE_SLOTS) return { problem: `A day holds at most ${MAX_TEMPLATE_SLOTS} slots.` };
  const slots: TemplateSlot[] = [];
  for (const item of raw) {
    const o = obj(item);
    if (!o || typeof o.blockId !== 'string' || !blockIds.has(o.blockId)) return { problem: 'Pick one of your blocks for every slot.' };
    const start = minuteOf(o.start);
    const end = minuteOf(o.end);
    if (start === null || end === null) return { problem: 'Each slot needs a start and an end, like 07:00.' };
    if (start === end) return { problem: 'A slot cannot start and end at the same time.' };
    slots.push({ blockId: o.blockId, start, end });
  }
  const label = (s: TemplateSlot) => `${names?.[s.blockId] ?? 'A block'} ${slotRangeLabel(s)}`;
  const ordered = slotOrder(slots);
  for (let i = 0; i < ordered.length; i++)
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i]!;
      const b = ordered[j]!;
      if (slotsOverlap(a, b)) return { problem: `${label(a)} overlaps ${label(b)}.` };
    }
  return { slots: ordered };
}

/** What is wrong with a day template's name and pillars as sent, or null. `partial` (an edit) lets any field be left out. */
export function dayTemplateProblem(body: unknown, partial: boolean): string | null {
  const o = obj(body);
  if (!o) return 'Send the template’s name and the pillar that leads.';
  if (!partial || 'name' in o) {
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) return 'Give the template a name.';
    if (name.length > DAY_TEMPLATE_NAME_MAX) return `Keep the name to ${DAY_TEMPLATE_NAME_MAX} characters.`;
  }
  if (!partial || 'lead' in o) {
    if (!isRelationshipKey(o.lead)) return 'Pick the pillar that leads the day.';
  }
  if ('second' in o && !pillarOk(o.second)) return 'Pick one of the seven pillars for second, or none.';
  if (isRelationshipKey(o.second) && isRelationshipKey(o.lead) && o.second === o.lead) return 'The second pillar must differ from the one that leads.';
  if ('color' in o && o.color !== null && o.color !== undefined && o.color !== '' && !blockColorOf(o.color)) return 'Pick one of the colours, or type a colour like #1e90ff.';
  return null;
}

// ---- dates ----

/** 1 Monday to 7 Sunday, from the calendar date (no zone). */
export function weekdayOf(date: string): number {
  return isoWeekday(date);
}
/** The Monday of the week a date is in. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}
/** The seven dates from a Monday. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
/** Which template a date uses (a change to that date, then the pattern's weekday, then the default): in dayKinds.ts, a leaf, so the
 * kinds-of-day reading and this file share the one rule without growing the shared chunk. */
export { templateForDate } from './dayKinds.ts';
/** The template a day_types row points at: its template_id, else (an old row) the template made from its kind, else null. */
export function overrideTemplateId(row: { kind: string; template_id: string | null }, templates: readonly Pick<DayTemplate, 'id' | 'sourceKind'>[]): string | null {
  if (row.template_id) return templates.some((t) => t.id === row.template_id) ? row.template_id : null;
  return templates.find((t) => t.sourceKind !== null && t.sourceKind === row.kind)?.id ?? null;
}

// ---- tasks and blocks ----

export type BlockHow = 'picked' | 'time';
/** The block a task is in: the one picked (even with no slot today), else the slot its time falls in, else null. */
export function blockOfTask(task: { timeBlockId?: string | null; dueTime: string | null }, slots: readonly TemplateSlot[]): { blockId: string; how: BlockHow } | null {
  if (task.timeBlockId) return { blockId: task.timeBlockId, how: 'picked' };
  const m = minuteOf(task.dueTime);
  if (m === null) return null;
  const hit = slotOrder(slots).find((s) => slotContains(s, m));
  return hit ? { blockId: hit.blockId, how: 'time' } : null;
}
/**
 * The slot a task sits in among `slots` (by index, in the order given): the one its time falls in when that slot is its block's, else its
 * block's first slot of the day; -1 when its block has no slot that day; null when it has no block (no pick and no time in a slot).
 */
export function slotIndexOfTask(task: { timeBlockId?: string | null; dueTime: string | null }, slots: readonly TemplateSlot[]): number | null {
  const hit = blockOfTask(task, slots);
  if (!hit) return null;
  const m = minuteOf(task.dueTime);
  if (m !== null) {
    const byTime = slots.findIndex((s) => s.blockId === hit.blockId && slotContains(s, m));
    if (byTime >= 0) return byTime;
  }
  return slots.findIndex((s) => s.blockId === hit.blockId);
}
/** Whether a slot runs past midnight (23:00 to 07:00); an end of 0 is midnight itself, not past it. */
export function slotCrossesMidnight(s: { start: number; end: number }): boolean {
  return s.end !== 0 && s.end < s.start;
}
/** A block's minutes in a day's slots. */
export function blockDayMinutes(blockId: string, slots: readonly TemplateSlot[]): number {
  return slots.filter((s) => s.blockId === blockId).reduce((n, s) => n + slotLength(s), 0);
}
/** The blocks with a slot that day, in the order their first slot comes. */
export function blocksInDay(slots: readonly TemplateSlot[], blocks: readonly TimeBlock[]): TimeBlock[] {
  const seen: string[] = [];
  for (const s of slotOrder(slots)) if (!seen.includes(s.blockId)) seen.push(s.blockId);
  return seen.map((id) => blocks.find((b) => b.id === id)).filter((b): b is TimeBlock => Boolean(b));
}

/**
 * A block to suggest for a task on a day, from its area of life and pillar. Rules only; it writes nothing.
 * 1. Matches: the day's blocks with the task's area (when it has one); if none, the ones with its pillar.
 * 2. P0, P1 or no priority take the first Focus-tagged match, P2 and P3 the first match that is not Focus; the first of those
 *    with room left (what is already in it plus this estimate fits its minutes) wins, else the first of those, else the first match with
 *    room, else the first match (2026-11-07: so Daily's suggestions spread over a pillar's blocks instead of piling into the first).
 * 3. No match: P0 and P1 go to the day's first Focus-tagged block; anything else gets null.
 * A block whose every slot that day runs past midnight (the night's sleep, as `templateColor` reads it) is never suggested: nobody is
 * sent to do a task at bedtime (2026-11-07).
 */
export function suggestBlock(
  task: { lifeArea?: LifeAreaKey | null; relationship?: RelationshipKey; priority: Priority | null; estimateMin: number | null },
  slots: readonly TemplateSlot[],
  blocks: readonly TimeBlock[],
  usedMin?: Readonly<Record<string, number>>,
): string | null {
  const day = blocksInDay(slots, blocks).filter((b) => slots.some((s) => s.blockId === b.id && !slotCrossesMidnight(s)));
  if (day.length === 0) return null;
  const need = task.estimateMin ?? SLOT_TASK_MINUTES;
  const room = (b: TimeBlock) => (usedMin?.[b.id] ?? 0) + need <= blockDayMinutes(b.id, slots);
  let matches = task.lifeArea ? day.filter((b) => b.area === task.lifeArea) : [];
  if (matches.length === 0 && task.relationship) matches = day.filter((b) => b.pillar === task.relationship);
  const high = task.priority === null || task.priority <= 1;
  if (matches.length > 0) {
    const preferred = matches.filter((b) => (high ? isFocusTag(b.tag) : !isFocusTag(b.tag)));
    if (preferred.length > 0) return (preferred.find(room) ?? preferred[0]!).id;
    return (matches.find(room) ?? matches[0]!).id;
  }
  if (task.priority !== null && task.priority <= 1) {
    const focus = day.filter((b) => isFocusTag(b.tag));
    if (focus.length > 0) return (focus.find(room) ?? focus[0]!).id;
  }
  return null;
}

// ---- grouping (Daily's coloured boxes; `groupTasks` itself lives in tasks.ts beside `sortTasks`) ----

export const TASK_GROUP_NONE = 'none';
export interface TaskGroup<T> {
  /** A block id, an area key, or 'none'. */
  key: string;
  kind: 'block' | 'area' | 'none';
  /** The block's name, the area's name, "No block yet" or "No area". */
  name: string;
  /** A block's swatch. */
  color: BlockColor | null;
  area: LifeAreaKey | null;
  /** The block's slots that day (a block can appear twice, Deep work 09:00 to 13:00 and 14:00 to 16:00). */
  ranges: { start: number; end: number }[];
  /** False for a picked block that has no slot in the day's template. */
  inDay: boolean;
  /** The block's minutes that day (0 when not in the day). */
  minutes: number;
  /** The tasks' estimates added up (30 for one with none). */
  plannedMin: number;
  tasks: T[];
}
/** What `groupTasks` and the block and area sorts need from a task. */
export interface GroupableTask {
  doDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority | null;
  relationship?: RelationshipKey;
  timeBlockId?: string | null;
  lifeArea?: LifeAreaKey | null;
  estimateMin?: number | null;
}
