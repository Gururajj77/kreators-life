// ---------------------------------------------------------------------------
// Emerging (2026-11-04): patterns the app notices in what a person already logs, read across their apps.
// Rules only, no model and no credits, like the daily brief. Computed on read from the person's own rows (GET /insights),
// owner only, nothing stored. A pairing says what happened on the same days, with how many days on each side, and never
// what caused what. A signal with too little data is "watching": it says what it still needs and shows no number.
// The rules (2026-11-07) are this file, the subpath export `@kreators/shared/insights`, read only by the API and the tests; the types, the small
// helpers and each place's share of the list are insightPlaces.ts, in the barrel.
// ---------------------------------------------------------------------------

import { formatCount, RELATIONSHIP_BY_KEY, RELATIONSHIPS } from './core.ts';
import type { RelationshipKey } from './core.ts';
import { addDays, daysBetween, isoWeekday } from './dates.ts';
import type { Repeat } from './tasks.ts';
import { slotContains } from './timeBlocks.ts';
import {
  BUDGET_OVER_MIN_MONTHS,
  BUDGET_OVER_MONTHS,
  BUDGET_PACE_MIN_DAYS,
  EAT_MIN_DAYS,
  HABIT_MIN_TICKS,
  HABIT_TIE_MIN_DAYS,
  HABIT_TIE_STRICT_DAYS,
  HABIT_TIE_STRICT_NORM,
  HABIT_WINDOW_DAYS,
  INSIGHT_BASIS_TAIL,
  INSIGHT_WINDOW_DAYS,
  localStamp,
  MAX_HABIT_TIES,
  MAX_HABIT_TIES_WATCHING,
  MAX_HABITS,
  MOVE_WEEKDAY_MIN_DAYS,
  PAIR_MIN_DAYS,
  PAIR_WINDOW_DAYS,
  splitCompare,
  taskKey,
  WATER_WEEKDAY_MIN_DAYS,
  WATER_WEEKDAY_MIN_GAP_ML,
} from './insightPlaces.ts';
import type { HabitSuggestion, HabitTie, Insight, InsightAction, InsightApp, InsightFacts, InsightKey, InsightOpenTaskFact, InsightPairRow, InsightPart, InsightTaskFact, KindRow, SplitResult } from './insightPlaces.ts';
import { KIND_MIN_DAYS, KINDS_WINDOW_DAYS, kindBeside, kindsOfDays, templateColor, templateForDate } from './dayKinds.ts';
import { money } from './money.ts';
import { MAX_NOT_TO_DO } from './api.ts';
import { DISCOVER_STRENGTHS } from './discover.ts';
import { PERIOD_META, periodLabel } from './periods.ts';
import type { Period } from './periods.ts';
import { monthShift } from './tasks.ts';

export * from './insightPlaces.ts';

// ---- helpers --------------------------------------------------------------

/** Two keys name the same thing: they share two thirds of their words, one of them four letters or longer. */
export function sameTask(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return sameWords(new Set(a.split('|')), new Set(b.split('|')));
}

/** `sameTask` on word sets already made, so a loop over many keys splits each key once. */
function sameWords(A: ReadonlySet<string>, B: ReadonlySet<string>): boolean {
  let both = 0;
  let long = false;
  for (const w of A) {
    if (!B.has(w)) continue;
    both += 1;
    if (w.length >= 4) long = true;
  }
  const union = A.size + B.size - both;
  return both / union >= 0.67 && long;
}

/** A key with its word set, made once. */
interface KeyWords {
  key: string;
  words: ReadonlySet<string>;
}
const keyWordsOf = (key: string): KeyWords => ({ key, words: new Set(key.split('|')) });
/** `sameTask` for two keys whose word sets are made. */
const sameKey = (a: KeyWords, b: KeyWords): boolean => Boolean(a.key) && Boolean(b.key) && (a.key === b.key || sameWords(a.words, b.words));

/** How often a task done on these local days could come back: daily, on weekdays, or weekly on its usual days. Every 1, no end. */
export function suggestRepeat(localDays: readonly string[], today: string): Repeat {
  const from = addDays(today, -(HABIT_WINDOW_DAYS - 1));
  const days = [...new Set(localDays.filter((d) => d >= from && d <= today))].sort();
  if (days.length >= 16) return { kind: 'daily', every: 1, days: [], until: null };
  const weekdays = days.map(isoWeekday);
  if (days.length && weekdays.every((w) => w <= 5) && new Set(weekdays).size >= 4) return { kind: 'weekdays', every: 1, days: [], until: null };
  const count = new Map<number, number>();
  for (const w of weekdays) count.set(w, (count.get(w) ?? 0) + 1);
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const twice = ranked.filter(([, n]) => n >= 2).slice(0, 3).map(([w]) => w);
  const picked = twice.length ? twice : ranked.slice(0, 1).map(([w]) => w);
  return { kind: 'weekly', every: 1, days: picked.sort((a, b) => a - b), until: null };
}

/** The usual time, the median rounded to half an hour, only when the middle half of the ticks sits inside two hours. */
export function suggestTime(minutes: readonly number[]): string | null {
  if (!minutes.length) return null;
  const s = [...minutes].sort((a, b) => a - b);
  const n = s.length;
  const q1 = s[Math.floor((n - 1) / 4)] ?? 0;
  const q3 = s[Math.ceil((3 * (n - 1)) / 4)] ?? 0;
  if (q3 - q1 > 120) return null;
  const mid = n % 2 ? (s[(n - 1) / 2] ?? 0) : ((s[n / 2 - 1] ?? 0) + (s[n / 2] ?? 0)) / 2;
  const r = (Math.round(mid / 30) * 30) % (24 * 60);
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pillarName = (k: RelationshipKey) => RELATIONSHIP_BY_KEY[k].name;
const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const plural = (n: number, word: string, many = `${word}s`) => `${formatCount(n)} ${n === 1 ? word : many}`;
function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
/** 7 → "7 am", 13 → "1 pm", 0 → "12 am". */
function hourWord(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 || 12} ${hh < 12 ? 'am' : 'pm'}`;
}
function clockWord(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const base = hourWord(h ?? 0);
  return m ? base.replace(' ', `:${String(m).padStart(2, '0')} `) : base;
}
function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
const basisOf = (a: number, b: number, span = '') => `From ${plural(a, 'day')} and ${plural(b, 'day')}${span}. ${INSIGHT_BASIS_TAIL}`;

/**
 * What a card says of the time it covers. With no period picked: the rolling windows, in the words they always had. With one (2026-11-07):
 * its name everywhere, so every card says which period it is about.
 */
interface Span {
  eight: string;
  four: string;
  thirty: string;
  /** Added to a same-days card's basis line, after its days. */
  tail: string;
  /** Whole days still to come in a picked period, today among them (0 once it is over); null with no period. */
  left: number | null;
  /** What a card says when the period cannot hold the days it needs. */
  short: string;
}
const ROLLING: Span = { eight: 'in 8 weeks', four: 'in 4 weeks', thirty: 'in 30 days', tail: '', left: null, short: '' };
function spanOf(win: Period | null | undefined, today: string): Span {
  if (!win) return ROLLING;
  const words = `${win.kind === 'day' ? 'on' : 'in'} ${periodLabel(win)}`;
  const over = win.end < today;
  const word = PERIOD_META[win.kind].short.toLowerCase();
  return { eight: words, four: words, thirty: words, tail: ` ${words}`, left: over ? 0 : daysBetween(today, win.end) + 1, short: win.kind === 'day' ? 'One day is not enough for this one.' : `Not enough days in ${over ? 'that' : 'this'} ${word} for this one.` };
}
/** The line that says what a card still needs, unless the picked period has too few days left to get there. */
const needOr = (c: Pick<Ctx, 'span'>, more: number, line: string): string => (c.span.left !== null && more > c.span.left ? c.span.short : line);

function watching(key: InsightKey, apps: InsightApp[], reads: InsightPart[], priv: boolean, text: string, need: string, relationship: RelationshipKey | null = null): Insight {
  return { key, id: key, state: 'watching', apps, reads, private: priv, relationship, headline: '', text, basis: '', chart: null, action: null, need, strength: 0 };
}

interface PairSpec {
  key: InsightKey;
  apps: InsightApp[];
  reads: InsightPart[];
  priv: boolean;
  /** What the line is about, for a watching row ("Sleep and mood"). */
  title: string;
  days: { on: boolean | null; y: number | null }[];
  minOn: number;
  minOff?: number;
  /** The smallest gap worth saying, or a function of the two averages. */
  minGap: number | ((on: number, off: number) => number);
  /** The size of a big gap, for ranking. */
  scale: number | ((on: number, off: number) => number);
  fmt: (v: number) => string;
  unit: string;
  onLabel: string;
  offLabel: string;
  sentence: (on: string, off: string) => string;
  same: (on: string, off: string) => string;
  needLine: (more: number) => string;
  action: InsightAction | null;
}

function pairInsight(c: Pick<Ctx, 'span'>, p: PairSpec): Insight {
  const minOff = p.minOff ?? p.minOn;
  const s = splitCompare(p.days, p.minOn, 0, minOff);
  if (!s.enough || s.on.avg === null || s.off.avg === null) {
    const more = Math.max(0, p.minOn - s.on.n) + Math.max(0, minOff - s.off.n);
    return watching(p.key, p.apps, p.reads, p.priv, p.title, needOr(c, Math.max(1, more), p.needLine(Math.max(1, more))));
  }
  const onV = s.on.avg;
  const offV = s.off.avg;
  const minGap = typeof p.minGap === 'function' ? p.minGap(onV, offV) : p.minGap;
  const scale = Math.max(1e-9, typeof p.scale === 'function' ? p.scale(onV, offV) : p.scale);
  const a = p.fmt(onV);
  const b = p.fmt(offV);
  const big = Math.abs(s.gap) >= minGap && a !== b;
  const strength = big ? Math.max(1, Math.min(85, Math.round(40 + 40 * (Math.abs(s.gap) / scale))) - (s.on.n < 10 || s.off.n < 10 ? 10 : 0)) : 0;
  return {
    key: p.key,
    id: p.key,
    state: 'ready',
    apps: p.apps,
    reads: p.reads,
    private: p.priv,
    relationship: null,
    headline: `${a} vs ${b}`,
    text: big ? p.sentence(a, b) : p.same(a, b),
    basis: basisOf(s.on.n, s.off.n, c.span.tail),
    chart: {
      kind: 'pair',
      rows: [
        { label: p.onLabel, value: Math.round(onV * 10) / 10, n: s.on.n, unit: p.unit },
        { label: p.offLabel, value: Math.round(offV * 10) / 10, n: s.off.n, unit: p.unit },
      ],
    },
    action: big ? p.action : null,
    need: null,
    strength,
  };
}

// ---- the signals ---------------------------------------------------------

interface Ctx {
  f: InsightFacts;
  on: (k: string) => boolean;
  /** The last day a same-days card counts: yesterday, or the picked period's end when that came first. */
  yesterday: string;
  /** The last day a tick counts: today, or the picked period's end when that came first. */
  last: string;
  pairFrom: string;
  span: Span;
  /** Local day of each tick, and its minute. */
  ticks: { day: string; minutes: number; relationship: RelationshipKey }[];
  ticksByDay: Map<string, number>;
  activeDays: Set<string>;
  wb: (kind: string) => Map<string, number>;
  /** Every ticked task read once: its local stamp and its key (2026-11-05: each was worked out again per signal). */
  stamped: StampedTick[];
  /** Open tasks by pillar, each with its key, in the order they came. */
  openByRel: (rel: RelationshipKey) => { o: InsightOpenTaskFact; k: KeyWords }[];
}

interface StampedTick {
  t: InsightTaskFact;
  at: { day: string; minutes: number; weekday: number } | null;
  key: string;
}

interface TickCluster {
  rel: RelationshipKey;
  key: string;
  ticks: { day: string; minutes: number; title: string; parentId: string | null; at: string; repeats: boolean; habit: boolean | null }[];
}

/**
 * Ticks between two local days grouped into the tasks they name: by pillar and exact key first, then keys that name the same
 * thing are joined, biggest first, so the answer never depends on order.
 */
function clusterTicks(stamped: readonly StampedTick[], from: string, to: string, withRepeats: boolean): TickCluster[] {
  const recent = stamped
    .filter((x): x is { t: InsightTaskFact; at: { day: string; minutes: number; weekday: number }; key: string } => (withRepeats || !x.t.repeats) && x.at !== null && x.key !== '' && x.at.day >= from && x.at.day <= to)
    .sort((a, b) => (a.t.completedAt < b.t.completedAt ? -1 : a.t.completedAt > b.t.completedAt ? 1 : a.t.id < b.t.id ? -1 : 1));
  const exact = new Map<string, TickCluster>();
  for (const x of recent) {
    const id = `${x.t.relationship}:${x.key}`;
    const cl = exact.get(id) ?? { rel: x.t.relationship, key: x.key, ticks: [] };
    cl.ticks.push({ day: x.at.day, minutes: x.at.minutes, title: x.t.title.trim(), parentId: x.t.parentId, at: x.t.completedAt, repeats: x.t.repeats, habit: x.t.habit ?? null });
    exact.set(id, cl);
  }
  const clusters: (TickCluster & { words: KeyWords })[] = [];
  const ordered = [...exact.values()].sort((a, b) => b.ticks.length - a.ticks.length || (a.rel + a.key < b.rel + b.key ? -1 : 1));
  for (const cl of ordered) {
    const words = keyWordsOf(cl.key);
    const into = clusters.find((k) => k.rel === cl.rel && sameKey(k.words, words));
    if (into) into.ticks.push(...cl.ticks);
    else clusters.push({ rel: cl.rel, key: cl.key, ticks: [...cl.ticks], words });
  }
  for (const cl of clusters) cl.ticks.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return clusters;
}

/** What "Make it a habit" fills in for a group of ticks: the open task or the project, the repeat, the time and the first day. */
function suggestionFor(f: InsightFacts, cl: TickCluster, mates: readonly InsightOpenTaskFact[], anchor = f.today): HabitSuggestion {
  const activeProjects = new Set(f.projects.map((p) => p.id));
  const days = [...new Set(cl.ticks.map((t) => t.day))].sort();
  const last = cl.ticks[cl.ticks.length - 1]!;
  const openTask = mates[0] ?? null;
  const projectId = openTask?.parentId && activeProjects.has(openTask.parentId) ? openTask.parentId : last.parentId && activeProjects.has(last.parentId) ? last.parentId : null;
  let repeat = suggestRepeat(days, anchor);
  // Ticks older than four weeks leave no weekday to go on: the day of the last one.
  if (repeat.kind === 'weekly' && !repeat.days.length) repeat = { ...repeat, days: [isoWeekday(last.day)] };
  const time = suggestTime(cl.ticks.map((t) => t.minutes));
  let firstDay = days.includes(f.today) ? addDays(f.today, 1) : f.today;
  for (let i = 0; i < 8; i += 1) {
    const w = isoWeekday(firstDay);
    if (repeat.kind === 'daily' || (repeat.kind === 'weekdays' && w <= 5) || (repeat.kind === 'weekly' && repeat.days.includes(w))) break;
    firstDay = addDays(firstDay, 1);
  }
  return { title: last.title, relationship: cl.rel, projectId, openTaskId: openTask?.id ?? null, repeat, time, firstDay, ticks: cl.ticks.length, days, ...(f.window ? { within: spanOf(f.window, f.today).four } : {}) };
}

function habits(c: Ctx): Insight[] {
  const { f } = c;
  const apps: InsightApp[] = ['today', 'tower', 'pillar', 'home', 'insights'];
  const from = f.window ? f.window.start : addDays(f.today, -(HABIT_WINDOW_DAYS - 1));
  const clusters = clusterTicks(c.stamped, from, c.last, false);
  const found: Insight[] = [];
  for (const cl of clusters) {
    const days = [...new Set(cl.ticks.map((t) => t.day))].sort();
    if (cl.ticks.length < HABIT_MIN_TICKS || days.length < HABIT_MIN_TICKS) continue;
    const words = keyWordsOf(cl.key);
    const mates = c.openByRel(cl.rel).filter((x) => sameKey(words, x.k)).map((x) => x.o);
    if (mates.some((o) => o.repeats)) continue;
    const habit = suggestionFor(f, cl, mates, c.last);
    const { repeat, time } = habit;
    const n = cl.ticks.length;
    // "Mostly on" only when those weekdays hold at least 60% of the days; a spread is said as a spread.
    const onPicked = repeat.kind === 'weekly' ? days.filter((d) => repeat.days.includes(isoWeekday(d))).length : days.length;
    const when =
      repeat.kind === 'daily'
        ? ', most days'
        : repeat.kind === 'weekdays'
          ? ', on weekdays'
          : onPicked / days.length >= 0.6
            ? `, mostly on ${listWords(repeat.days.map((w) => `${WEEKDAY_NAMES[w - 1]}s`))}`
            : ', on different days of the week';
    const at = time ? ` around ${clockWord(time)}` : '';
    const daySet = new Set(days);
    // Up to five weeks as rows of dots; a longer period by weekday, so a card never holds a year of rows.
    const span = dayRange(from, c.last);
    const weekdays = [0, 0, 0, 0, 0, 0, 0];
    for (const d of days) weekdays[isoWeekday(d) - 1] = (weekdays[isoWeekday(d) - 1] ?? 0) + 1;
    found.push({
      key: 'habit',
      id: `habit:${cl.rel}:${cl.key}`,
      state: 'ready',
      apps,
      reads: ['tasks'],
      private: false,
      relationship: cl.rel,
      headline: `${formatCount(n)} times`,
      text: `You ticked “${habit.title}” ${formatCount(n)} times ${c.span.four}${when}${at}. It does not repeat yet.`,
      basis: `From ${plural(n, 'tick')} on ${plural(days.length, 'day')} ${c.span.four}.`,
      chart: span.length <= 35 ? { kind: 'dots', days: span.map((d) => ({ date: d, on: daySet.has(d) })) } : { kind: 'week', labels: WEEKDAY_SHORT, values: weekdays },
      action: habit.projectId || habit.openTaskId ? { label: 'Make it a habit', to: `/realm/${cl.rel}`, kind: 'habit' } : { label: 'Open the pillar', to: `/realm/${cl.rel}`, kind: 'link' },
      need: null,
      strength: Math.min(90, 70 + 5 * Math.max(0, n - HABIT_MIN_TICKS)),
      habit,
    });
  }
  found.sort((a, b) => (b.habit!.ticks - a.habit!.ticks) || (a.id < b.id ? -1 : 1));
  if (!found.length) return [watching('habit', apps, ['tasks'], false, 'Tasks you keep doing', needOr(c, HABIT_MIN_TICKS, `Tick the same task on 3 different days ${c.span.four} and it shows here.`))];
  return found.slice(0, MAX_HABITS);
}

/** The overall balance line, and a line of its own for each pillar in `pillarRels` (a pillar page shows its own). */
function pillarBalance(c: Ctx, pillarRels: readonly RelationshipKey[]): Insight[] {
  const { f } = c;
  const apps: InsightApp[] = ['home', 'tower', 'life', 'reviews', 'insights'];
  const reads: InsightPart[] = ['xp', 'tasks'];
  const byRel = new Map(f.xp30.map((r) => [r.relationship, r]));
  const totalXp = f.xp30.reduce((s, r) => s + Math.max(0, r.xp), 0);
  const totalTicks = f.xp30.reduce((s, r) => s + Math.max(0, r.ticks), 0);
  if (totalTicks < 10 && totalXp < 100) {
    return [watching('pillar-balance', apps, reads, false, 'Where your xp goes', needOr(c, 10 - totalTicks, `Tick a few more tasks: ${formatCount(totalTicks)} of 10 so far ${c.span.thirty}.`))];
  }
  const parts = RELATIONSHIPS.map((r) => ({ relationship: r.key, value: Math.max(0, byRel.get(r.key)?.xp ?? 0) }));
  const share = (k: RelationshipKey) => pct(Math.max(0, byRel.get(k)?.xp ?? 0), totalXp);
  const out: Insight[] = [];
  const focus = f.focusPillars.filter((k) => RELATIONSHIP_BY_KEY[k]);
  let text: string;
  let headline: string;
  let strength = 30;
  let mark: RelationshipKey | undefined;
  let action: InsightAction | null = null;
  if (focus.length) {
    const low = [...focus].sort((a, b) => share(a) - share(b) || (a < b ? -1 : 1))[0]!;
    mark = low;
    headline = `${share(low)}%`;
    text = `${pillarName(low)} got ${share(low)}% of your xp ${c.span.thirty}. It is one of your focus pillars.`;
    if (share(low) < 10) strength = 60;
    action = { label: `Add a task to ${pillarName(low)}`, to: `/realm/${low}?add=1`, kind: 'link' };
  } else {
    const top = [...parts].sort((a, b) => b.value - a.value || (a.relationship < b.relationship ? -1 : 1))[0]!;
    const none = parts.filter((p) => p.value === 0).map((p) => p.relationship);
    mark = top.relationship;
    headline = `${share(top.relationship)}%`;
    const noneLine = none.length === 1 ? ` ${pillarName(none[0]!)} got none.` : none.length > 1 ? ` ${formatCount(none.length)} pillars got none.` : '';
    text = `${pillarName(top.relationship)} got ${share(top.relationship)}% of your xp ${c.span.thirty}.${noneLine}`;
    if (none.length) action = { label: `Add a task to ${pillarName(none[0]!)}`, to: `/realm/${none[0]}?add=1`, kind: 'link' };
  }
  out.push({
    key: 'pillar-balance',
    id: 'pillar-balance',
    state: 'ready',
    apps,
    reads,
    private: false,
    relationship: null,
    headline,
    text,
    basis: `From ${plural(totalTicks, 'tick')} and ${formatCount(totalXp)} xp ${c.span.thirty}.`,
    chart: { kind: 'share', parts, ...(mark ? { mark } : {}) },
    action,
    need: null,
    strength,
  });
  for (const rel of pillarRels) {
    if (!RELATIONSHIP_BY_KEY[rel]) continue;
    const r = byRel.get(rel);
    out.push({
      key: 'pillar-balance',
      id: `pillar-balance:${rel}`,
      state: 'ready',
      apps: ['pillar'],
      reads,
      private: false,
      relationship: rel,
      headline: `${share(rel)}%`,
      text: `${pillarName(rel)}: ${plural(Math.max(0, r?.ticks ?? 0), 'tick')} and ${formatCount(Math.max(0, r?.xp ?? 0))} xp ${c.span.thirty}, ${share(rel)}% of the total.`,
      basis: `From ${plural(totalTicks, 'tick')} and ${formatCount(totalXp)} xp ${c.span.thirty}.`,
      chart: { kind: 'share', parts, mark: rel },
      action: null,
      need: null,
      strength: share(rel) < 10 ? 50 : 30,
    });
  }
  return out;
}

const PARTS_OF_DAY: { name: string; from: number; to: number }[] = [
  { name: 'morning', from: 5, to: 12 },
  { name: 'afternoon', from: 12, to: 17 },
  { name: 'evening', from: 17, to: 22 },
  { name: 'night', from: 22, to: 29 },
];
const partOf = (hour: number) => PARTS_OF_DAY.findIndex((p) => (hour < 5 ? hour + 24 : hour) >= p.from && (hour < 5 ? hour + 24 : hour) < p.to);

function bestHours(c: Ctx): Insight {
  const apps: InsightApp[] = ['today', 'mindful', 'insights'];
  const ticks = c.ticks.filter((t) => t.day >= c.pairFrom && t.day <= c.last);
  const days = new Set(ticks.map((t) => t.day)).size;
  if (ticks.length < 15 || days < 7) {
    return watching('best-hours', apps, ['tasks'], false, 'When your ticks land', needOr(c, Math.max(15 - ticks.length, 7 - days), `Tick a few more tasks: ${formatCount(ticks.length)} of 15 so far, on ${formatCount(days)} of 7 days.`));
  }
  const values = [0, 0, 0, 0];
  const byHour = new Array<number>(24).fill(0);
  for (const t of ticks) {
    const h = Math.floor(t.minutes / 60);
    byHour[h] = (byHour[h] ?? 0) + 1;
    const p = partOf(h);
    if (p >= 0) values[p] = (values[p] ?? 0) + 1;
  }
  const top = values.indexOf(Math.max(...values));
  const part = PARTS_OF_DAY[top]!;
  let bestH = part.from;
  let bestN = -1;
  for (let h = part.from; h < part.to - 1; h += 1) {
    const n = (byHour[h % 24] ?? 0) + (byHour[(h + 1) % 24] ?? 0);
    if (n > bestN) {
      bestN = n;
      bestH = h;
    }
  }
  const share = pct(values[top] ?? 0, ticks.length);
  const lead = share >= 50 ? `Most of your ticks land in the ${part.name}` : `Your ticks land most often in the ${part.name}`;
  return {
    key: 'best-hours',
    id: 'best-hours',
    state: 'ready',
    apps,
    reads: ['tasks'],
    private: false,
    relationship: null,
    headline: `${share}%`,
    text: `${lead}: ${share}% of ${formatCount(ticks.length)}, most between ${hourWord(bestH)} and ${hourWord(bestH + 2)}.`,
    basis: `From ${plural(ticks.length, 'tick')} on ${plural(days, 'day')} ${c.span.eight}.`,
    chart: { kind: 'hours', labels: PARTS_OF_DAY.map((p) => p.name[0]!.toUpperCase() + p.name.slice(1)), values },
    action: { label: 'Plan my week', to: '/today?plan=week', kind: 'link' },
    need: null,
    strength: 35,
  };
}

function streakWeekday(c: Ctx): Insight | null {
  const { f } = c;
  const apps: InsightApp[] = ['today', 'home', 'insights'];
  const first = f.firstCheckin;
  if (!first || daysBetween(first, f.today) < 28) {
    const have = first ? Math.max(0, daysBetween(first, f.today)) : 0;
    return watching('streak-weekday', apps, ['checkins'], false, 'The days you miss', needOr(c, 28 - have, `Check in on Daily for ${formatCount(28 - have)} more days.`));
  }
  // The same first day the route reads check-ins from (today less 83), so a day it never read is never counted as missed.
  const windowStart = f.window ? f.window.start : addDays(f.today, -(INSIGHT_WINDOW_DAYS - 1));
  const from = first > windowStart ? first : windowStart;
  const have = new Set(f.checkins);
  const span = dayRange(from, c.yesterday);
  // The same four weeks a picked period must hold before it can say which days are missed.
  if (f.window && span.length < 28) return watching('streak-weekday', apps, ['checkins'], false, 'The days you miss', needOr(c, 28 - span.length, `Check in on Daily for ${formatCount(28 - span.length)} more days.`));
  const missed = span.filter((d) => !have.has(d));
  if (missed.length < 4) return null;
  const values = [0, 0, 0, 0, 0, 0, 0];
  for (const d of missed) values[isoWeekday(d) - 1] = (values[isoWeekday(d) - 1] ?? 0) + 1;
  const top = values.indexOf(Math.max(...values));
  const n = values[top] ?? 0;
  const weeks = Math.max(1, Math.round(span.length / 7));
  // A tie at the top is a spread, never a day picked by order.
  const tied = values.filter((v) => v === n).length > 1;
  const even = n < 3 || n / missed.length < 0.3 || tied;
  const share = n / missed.length;
  const topLine =
    n === missed.length
      ? `In ${plural(weeks, 'week')}, all ${formatCount(n)} days you missed were ${WEEKDAY_NAMES[top]}s.`
      : share >= 0.5
        ? `Most days you missed are ${WEEKDAY_NAMES[top]}s: ${formatCount(n)} of your ${formatCount(missed.length)} in ${plural(weeks, 'week')}.`
        : `You miss ${WEEKDAY_NAMES[top]}s more than any other day: ${formatCount(n)} of your ${formatCount(missed.length)} missed days in ${plural(weeks, 'week')}.`;
  return {
    key: 'streak-weekday',
    id: 'streak-weekday',
    state: 'ready',
    apps,
    reads: ['checkins'],
    private: false,
    relationship: null,
    headline: even ? `${formatCount(missed.length)} missed` : `${formatCount(n)} of ${formatCount(missed.length)}`,
    text: even
      ? `You missed ${plural(missed.length, 'day')} in ${plural(weeks, 'week')}, with no one day standing out.`
      : topLine,
    basis: f.window ? `From ${plural(span.length, 'day')} ${c.span.eight}.` : `From ${plural(span.length, 'day')} since your first check-in, up to 12 weeks.`,
    chart: { kind: 'week', labels: WEEKDAY_SHORT, values },
    action: even ? null : { label: `Remind me on ${WEEKDAY_NAMES[top]}s`, to: `/today?remind=${top + 1}#reminders`, kind: 'link' },
    need: null,
    strength: even ? 0 : Math.min(80, 50 + 5 * Math.max(0, n - 3)),
  };
}

function pairDays(c: Ctx, from: string, onOf: (d: string) => boolean | null, yOf: (d: string) => number | null): { on: boolean | null; y: number | null }[] {
  return dayRange(from, c.yesterday).map((d) => ({ on: onOf(d), y: yOf(d) }));
}
const ticksOn = (c: Ctx) => (d: string) => (c.activeDays.has(d) ? (c.ticksByDay.get(d) ?? 0) : null);
const tasksFmt = (v: number) => one(v);
const tasksScale = (a: number, b: number) => Math.max(a, b, 1);

function sleepMood(c: Ctx): Insight {
  const sleep = c.wb('sleep');
  const mood = c.wb('mood');
  const both = [...sleep.entries()].filter(([d]) => d >= c.pairFrom && d <= c.yesterday && mood.has(d)).map(([, v]) => v).sort((a, b) => a - b);
  const median = both.length ? (both.length % 2 ? both[(both.length - 1) / 2]! : (both[both.length / 2 - 1]! + both[both.length / 2]!) / 2) : 7;
  const cut = Math.round(median * 2) / 2;
  const cutWord = Number.isInteger(cut) ? String(cut) : cut.toFixed(1);
  return pairInsight(c, {
    key: 'sleep-mood',
    apps: ['sleep', 'mood', 'wellbeing', 'insights'],
    reads: ['wellbeing'],
    priv: true,
    title: 'Sleep and mood',
    days: pairDays(c, c.pairFrom, (d) => (sleep.has(d) ? (sleep.get(d) ?? 0) >= cut : null), (d) => mood.get(d) ?? null),
    minOn: PAIR_MIN_DAYS,
    minGap: 0.5,
    scale: 2,
    fmt: one,
    unit: '',
    onLabel: `Mood after ${cutWord} h or more`,
    offLabel: 'Mood after less',
    sentence: (a, b) => `On days after ${cutWord} hours of sleep or more, your mood was ${a} on average. On other days, ${b}.`,
    same: (a, b) => `Your mood was about the same either way: ${a} after ${cutWord} hours of sleep or more, ${b} after less.`,
    needLine: (k) => `Log sleep and mood on ${plural(k, 'more day')}.`,
    action: { label: 'Log last night', to: '/sleep', kind: 'link' },
  });
}

function focusTasks(c: Ctx): Insight {
  const focus = new Map<string, number>();
  for (const r of c.f.focus) focus.set(r.day, (focus.get(r.day) ?? 0) + Math.max(0, r.minutes));
  return pairInsight(c, {
    key: 'focus-tasks',
    apps: ['mindful', 'today', 'insights'],
    reads: ['focus', 'tasks'],
    priv: false,
    title: 'Focus and tasks',
    days: pairDays(
      c,
      c.pairFrom,
      (d) => {
        const m = focus.get(d) ?? 0;
        return m >= 25 ? true : m === 0 ? false : null;
      },
      ticksOn(c),
    ),
    minOn: 5,
    minGap: 0.5,
    scale: tasksScale,
    fmt: tasksFmt,
    unit: 'tasks',
    onLabel: 'With a focus session',
    offLabel: 'Without',
    sentence: (a, b) => `On days with a focus session, you ticked ${a} tasks. On other days, ${b}.`,
    same: (a, b) => `You ticked about the same either way: ${a} tasks with a focus session, ${b} without.`,
    needLine: (k) => `Have ${plural(k, 'more day')} with and without a focus session of 25 minutes.`,
    action: { label: 'Start focus', to: '/mindful', kind: 'link' },
  });
}

function stressCalm(c: Ctx): Insight | null {
  const { f } = c;
  const apps: InsightApp[] = ['stress', 'mindful', 'wellbeing', 'insights'];
  const reads: InsightPart[] = ['wellbeing', 'water'];
  const stress = c.wb('stress');
  const logged = [...stress.keys()].filter((d) => d >= c.pairFrom && d <= c.yesterday).length;
  if (logged < 10) return watching('stress-calm', apps, reads, true, 'Stress and calm', needOr(c, 10 - logged, `Log stress on ${plural(10 - logged, 'more day')}.`));
  const mindful = c.wb('mindful');
  const water = new Map<string, number>();
  for (const w of f.water) water.set(w.day, (water.get(w.day) ?? 0) + Math.max(0, w.ml));
  const splits: { name: 'mindful' | 'water'; r: Insight }[] = [];
  const common = { reads, priv: true, title: 'Stress and calm', minOn: 5, minGap: 0.5, scale: 2, fmt: one, unit: '' } as const;
  if (c.on('mindful')) {
    splits.push({
      name: 'mindful',
      r: pairInsight(c, {
        ...common,
        key: 'stress-calm',
        apps,
        days: pairDays(c, c.pairFrom, (d) => (stress.has(d) ? (mindful.get(d) ?? 0) >= 10 : null), (d) => stress.get(d) ?? null),
        onLabel: 'Stress with 10 mindful minutes',
        offLabel: 'Stress on other days',
        sentence: (a, b) => `On days with 10 mindful minutes or more, your stress was ${a} on average. On other days, ${b}.`,
        same: (a, b) => `Your stress was about the same either way: ${a} with 10 mindful minutes, ${b} without.`,
        needLine: (k) => `Log stress on ${plural(k, 'more day')}, some with 10 mindful minutes and some without.`,
        action: { label: 'Breathe for 3 minutes', to: '/mindful', kind: 'link' },
      }),
    });
  }
  if (f.waterGoal && f.waterGoal > 0) {
    const goal = f.waterGoal;
    splits.push({
      name: 'water',
      r: pairInsight(c, {
        ...common,
        key: 'stress-calm',
        apps,
        days: pairDays(c, c.pairFrom, (d) => (stress.has(d) ? (water.get(d) ?? 0) >= goal : null), (d) => stress.get(d) ?? null),
        onLabel: 'Stress on water goal days',
        offLabel: 'Stress on other days',
        sentence: (a, b) => `On days you met your water goal, your stress was ${a} on average. On other days, ${b}.`,
        same: (a, b) => `Your stress was about the same either way: ${a} on water goal days, ${b} on others.`,
        needLine: (k) => `Log stress on ${plural(k, 'more day')}, some with your water goal met and some without.`,
        action: { label: 'Add a glass', to: '/today#water', kind: 'link' },
      }),
    });
  }
  if (!splits.length) return null;
  const ready = splits.filter((s) => s.r.state === 'ready');
  if (!ready.length) return splits[0]!.r;
  ready.sort((a, b) => b.r.strength - a.r.strength || (a.name < b.name ? -1 : 1));
  // The card shows the split its sentence talks about, and only that one.
  return ready[0]!.r;
}

/** "Deep work day" reads "Deep work days", "Studio" reads "Studio days", "Long days" stays; one day keeps the name as it is. */
function kindDays(raw: string, n = 2): string {
  const name = raw.trim();
  if (n === 1) return /\bdays?$/i.test(name) ? name.replace(/days$/i, 'day') : `${name} day`;
  return /\bdays$/i.test(name) ? name : /\bday$/i.test(name) ? `${name}s` : `${name} days`;
}

/** The days past the three kinds named: "7 days of other kinds", "1 day of another kind". */
const otherKinds = (n: number): string => (n === 1 ? '1 day of another kind' : `${formatCount(n)} days of other kinds`);

/**
 * Your kinds of day (2026-11-06, the founder's ask): the last four weeks by kind of day, a kind being the day template set for that
 * date or given by the weekly pattern (`kindsOfDays`; the default template's days have none, nor a day before the account), each in its
 * template's colour, and how each group of days went: tasks ticked, focus minutes while Mindfulness is on, the mood while Mood is on,
 * on the days the app was used. The sentence sets the kind with the clearest gap beside every other day and says they went together,
 * never that one made the other. No time blocks yet, or no day with a kind, and it watches with the way to start.
 */
function daytypeDone(c: Ctx): Insight | null {
  const { f } = c;
  const tb = f.timeBlocks;
  const apps: InsightApp[] = ['today', 'reviews', 'insights'];
  // Every block deleted (a new account has the starting set from code, never nothing): still say how to start.
  if (!tb) return watching('daytype-done', apps, ['dayTypes', 'timeBlocks'], false, 'Your kinds of day', 'Give a day a kind on Daily, or set your usual week in Time blocks.');
  const focusOn = c.on('mindful');
  const moodOn = c.on('mood');
  const reads: InsightPart[] = ['dayTypes', 'tasks', 'timeBlocks', ...(focusOn ? (['focus'] as const) : []), ...(moodOn ? (['wellbeing'] as const) : [])];
  const from = f.window ? f.window.start : addDays(f.today, -KINDS_WINDOW_DAYS);
  const k = kindsOfDays({ templates: tb.templates, defaultId: tb.defaultId, pattern: tb.pattern, overrides: tb.overrides, since: tb.since ?? null }, from, c.yesterday);
  if (!k.tally.length) {
    // Someone who already gives their days a kind, on a period too short to hold one, is told that, not told to start.
    const usesKinds = f.window && kindsOfDays({ templates: tb.templates, defaultId: tb.defaultId, pattern: tb.pattern, overrides: tb.overrides, since: tb.since ?? null }, addDays(f.today, -KINDS_WINDOW_DAYS), c.yesterday).tally.length > 0;
    return watching('daytype-done', apps, reads, false, 'Your kinds of day', usesKinds ? needOr(c, KIND_MIN_DAYS, 'Not enough days have gone by in this period yet.') : 'Give a day a kind on Daily, or set your usual week in Time blocks.');
  }
  const byId = new Map(tb.templates.map((t) => [t.id, t]));
  const noneName = byId.get(tb.defaultId)?.name ?? 'Everyday';
  const focusBy = new Map<string, number>();
  for (const r of f.focus) focusBy.set(r.day, (focusBy.get(r.day) ?? 0) + Math.max(0, r.minutes));
  const mood = moodOn ? c.wb('mood') : null;
  const used = (d: string) => c.activeDays.has(d);
  const metrics: { key: 'tasks' | 'focus' | 'mood'; value: (d: string) => number | null; min: number; scale: (a: number, b: number) => number }[] = [
    { key: 'tasks', value: (d) => (used(d) ? (c.ticksByDay.get(d) ?? 0) : null), min: 0.5, scale: (a, b) => Math.max(a, b, 1) },
    ...(focusOn ? [{ key: 'focus' as const, value: (d: string) => (used(d) ? (focusBy.get(d) ?? 0) : null), min: 10, scale: (a: number, b: number) => Math.max(a, b, 15) }] : []),
    ...(mood ? [{ key: 'mood' as const, value: (d: string) => mood.get(d) ?? null, min: 0.3, scale: () => 4 }] : []),
  ];
  // The groups side by side: each kind, then the days with none.
  const avg = (days: string[], value: (d: string) => number | null): number | null => {
    const vs = days.map(value).filter((v): v is number => v !== null);
    return vs.length ? Math.round((vs.reduce((s, v) => s + v, 0) / vs.length) * 10) / 10 : null;
  };
  const groups: { templateId: string | null; name: string }[] = [...k.tally.map((t) => ({ templateId: t.templateId, name: t.name })), { templateId: null, name: noneName }];
  const rows: KindRow[] = [];
  for (const g of groups) {
    const days = k.days.filter((d) => d.from !== null && d.templateId === g.templateId).map((d) => d.date);
    const n = days.filter(used).length;
    // A group with days is always listed, even with no app use on them (then its row says so; n is 0 and the numbers are not read).
    if (!days.length) continue;
    rows.push({ templateId: g.templateId, name: g.templateId ? kindDays(g.name) : `Days on ${g.name}`, n, tasks: avg(days, metrics[0]!.value) ?? 0, focus: focusOn ? avg(days, (d) => (used(d) ? (focusBy.get(d) ?? 0) : null)) : null, mood: mood ? avg(days, (d) => mood.get(d) ?? null) : null });
  }
  // The clearest gap: a kind beside every other day, on any reading with enough days each side.
  let best: { name: string; key: 'tasks' | 'focus' | 'mood'; on: number; off: number; onN: number; offN: number; norm: number } | null = null;
  for (const t of k.tally) {
    for (const m of metrics) {
      const s = kindBeside(k.days, t.templateId, m.value);
      if (s.on.avg === null || s.off.avg === null || s.on.n < KIND_MIN_DAYS || s.off.n < PAIR_MIN_DAYS) continue;
      const gap = s.on.avg - s.off.avg;
      if (Math.abs(gap) < m.min) continue;
      const norm = Math.abs(gap) / m.scale(s.on.avg, s.off.avg);
      if (!best || norm > best.norm) best = { name: t.name, key: m.key, on: s.on.avg, off: s.off.avg, onN: s.on.n, offN: s.off.n, norm };
    }
  }
  const kindTotal = k.tally.reduce((s, t) => s + t.days, 0);
  const total = kindTotal + k.none;
  const mix = listWords([...k.tally.slice(0, 3).map((t) => `${formatCount(t.days)} ${kindDays(t.name, t.days)}`), ...(k.tally.length > 3 ? [otherKinds(k.tally.slice(3).reduce((s, t) => s + t.days, 0))] : []), ...(k.none ? [`${formatCount(k.none)} on ${noneName}`] : [])]);
  let text = f.window ? `${c.span.four[0]!.toUpperCase()}${c.span.four.slice(1)}: ${mix}.` : `Your last four weeks: ${mix}.`;
  if (best) {
    const up = best.on > best.off;
    const who = kindDays(best.name);
    const minutes = (v: number) => formatCount(Math.round(v));
    text =
      best.key === 'tasks'
        ? `${who} and ${up ? 'more' : 'fewer'} ticked tasks went together: ${one(best.on)} a day, against ${one(best.off)} on other days.`
        : best.key === 'focus'
          ? `${who} and ${up ? 'more' : 'less'} focus went together: ${minutes(best.on)} minutes a day, against ${minutes(best.off)} on other days.`
          : `${who} and a ${up ? 'higher' : 'lower'} mood went together: ${one(best.on)} on average, against ${one(best.off)} on other days.`;
  }
  return {
    key: 'daytype-done',
    id: 'daytype-done',
    state: 'ready',
    apps,
    reads,
    private: moodOn,
    relationship: null,
    headline: `${formatCount(kindTotal)} of ${plural(total, 'day')}`,
    text,
    basis: f.window
      ? best
        ? `From ${plural(best.onN, 'day')} beside ${plural(best.offN, 'other day')} ${c.span.four}. ${INSIGHT_BASIS_TAIL}`
        : `Your days ${c.span.four}, set on Daily or by your usual week. ${INSIGHT_BASIS_TAIL}`
      : best
        ? `The last four weeks: ${plural(best.onN, 'day')} beside ${plural(best.offN, 'other day')}. ${INSIGHT_BASIS_TAIL}`
        : `The last four weeks, set on Daily or by your usual week. ${INSIGHT_BASIS_TAIL}`,
    chart: { kind: 'kinds', parts: k.tally.map((t) => ({ templateId: t.templateId, name: t.name, days: t.days, color: templateColor(byId.get(t.templateId) ?? { slots: [] }, tb.blocks) })), none: k.none, noneName, rows },
    action: { label: 'Open time blocks', to: '/time-blocks', kind: 'link' },
    need: null,
    strength: best ? Math.max(25, Math.min(85, Math.round(40 + 40 * best.norm)) - (best.onN < 7 ? 10 : 0)) : 20,
  };
}

function moneyStress(c: Ctx): Insight {
  const { f } = c;
  const stress = c.wb('stress');
  const spent = new Map<string, number>();
  for (const e of f.expenses) spent.set(e.date, (spent.get(e.date) ?? 0) + Math.max(0, Math.round(e.cents)));
  const spendDays = [...spent.entries()].filter(([d, v]) => d >= c.pairFrom && d <= c.yesterday && v > 0).length;
  const apps: InsightApp[] = ['finance', 'stress', 'insights'];
  if (spendDays < 10) return watching('money-stress', apps, ['money', 'wellbeing'], true, 'Spending and stress', needOr(c, 10 - spendDays, `Log spending on ${plural(10 - spendDays, 'more day')}.`));
  // Whole rupees (or the person's whole unit) for the line, kept as integer cents.
  const whole = (v: number) => Math.round(v / 100) * 100;
  return pairInsight(c, {
    key: 'money-stress',
    apps,
    reads: ['money', 'wellbeing'],
    priv: true,
    title: 'Spending and stress',
    days: pairDays(c, c.pairFrom, (d) => (stress.has(d) ? (stress.get(d) ?? 0) >= 4 : null), (d) => (stress.has(d) ? (spent.get(d) ?? 0) : null)),
    minOn: 5,
    minOff: 10,
    minGap: (a, b) => Math.max(100, 0.2 * Math.min(a, b)),
    scale: (a, b) => Math.max(a, b, 100),
    fmt: (v) => money(whole(v), f.currency),
    unit: f.currency,
    onLabel: 'Spent on Stressed days',
    offLabel: 'Spent on calmer days',
    sentence: (a, b) => `On days you logged Stressed or more, you spent ${a} on average. On other days, ${b}.`,
    same: (a, b) => `You spent about the same either way: ${a} on Stressed days, ${b} on calmer ones.`,
    needLine: (k) => `Log stress on ${plural(k, 'more day')}, with your spending.`,
    action: { label: "See this month's spending", to: '/finance', kind: 'link' },
  });
}

function slipsSleep(c: Ctx): Insight {
  const sleep = c.wb('sleep');
  const byDay = new Map(c.f.notToDo.map((r) => [r.day, r]));
  return pairInsight(c, {
    key: 'slips-sleep',
    apps: ['today', 'sleep', 'insights'],
    reads: ['notToDo', 'wellbeing'],
    priv: true,
    title: 'Not to do and sleep',
    days: pairDays(
      c,
      c.pairFrom,
      (d) => {
        const r = byDay.get(d);
        if (!r) return null;
        return r.slipped > 0 ? true : r.kept > 0 ? false : null;
      },
      (d) => sleep.get(d) ?? null,
    ),
    minOn: 4,
    minOff: PAIR_MIN_DAYS,
    minGap: 0.5,
    scale: 2,
    fmt: one,
    unit: 'h',
    onLabel: 'Sleep on slip days',
    offLabel: 'Sleep on kept days',
    sentence: (a, b) => `On days you slipped on your not to do list, you had slept ${a} hours. On other days, ${b}.`,
    same: (a, b) => `You had slept about the same either way: ${a} hours on slip days, ${b} on kept days.`,
    needLine: (k) => `Mark your not to do list and log sleep on ${plural(k, 'more day')}.`,
    action: { label: 'Set a lights-out reminder', to: '/today?remind=1#reminders', kind: 'link' },
  });
}

function routineTasks(c: Ctx): Insight | null {
  if (!c.f.routine.length) return null;
  const byDay = new Map(c.f.routine.map((r) => [r.day, r.done]));
  return pairInsight(c, {
    key: 'routine-tasks',
    apps: ['today', 'tower', 'insights'],
    reads: ['routine', 'tasks'],
    priv: false,
    title: 'Morning routine and tasks',
    days: pairDays(c, c.pairFrom, (d) => (byDay.has(d) ? Boolean(byDay.get(d)) : null), (d) => c.ticksByDay.get(d) ?? 0),
    minOn: 5,
    minGap: 0.5,
    scale: tasksScale,
    fmt: tasksFmt,
    unit: 'tasks',
    onLabel: 'Routine done',
    offLabel: 'Routine not done',
    sentence: (a, b) => `On days you finished your morning routine, you ticked ${a} tasks. On other days, ${b}.`,
    same: (a, b) => `You ticked about the same either way: ${a} tasks with your routine done, ${b} without.`,
    needLine: (k) => `Open your routine on Daily on ${plural(k, 'more day')}.`,
    action: { label: "Open today's routine", to: '/today#routine', kind: 'link' },
  });
}

function journalMood(c: Ctx): Insight {
  const mood = c.wb('mood');
  const wrote = new Set(c.f.journalAt.map((iso) => localStamp(iso, c.f.zone)?.day).filter((d): d is string => Boolean(d)));
  return pairInsight(c, {
    key: 'journal-mood',
    apps: ['journal', 'mood', 'insights'],
    reads: ['journal', 'wellbeing'],
    priv: true,
    title: 'Journal and mood',
    days: pairDays(c, c.pairFrom, (d) => (mood.has(d) ? wrote.has(d) : null), (d) => mood.get(d) ?? null),
    minOn: 5,
    minGap: 0.5,
    scale: 2,
    fmt: one,
    unit: '',
    onLabel: 'Mood on journal days',
    offLabel: 'Mood on other days',
    sentence: (a, b) => `On days you wrote in your journal, your mood was ${a} on average. On other days, ${b}.`,
    same: (a, b) => `Your mood was about the same either way: ${a} on journal days, ${b} on others.`,
    needLine: (k) => `Log your mood on ${plural(k, 'more day')}, some with a journal entry and some without.`,
    action: { label: 'Write today', to: '/journal?new=1', kind: 'link' },
  });
}

// ---- Fitness and gratitude (2026-11-07) -------------------------------------
// Movement (minutes, from Fitness and Kreators Run's own tool and club runs), the daily eating check-in (how well the person ate, 1 to
// 5) and the days with gratitude written, set against the person's own days. The value only: never a note, an extra or a line written.

/** Movement is read while Fitness or Kreators Run is on (both write it). */
const moveOn = (c: Pick<Ctx, 'on'>): boolean => c.on('fitness') || c.on('run');
/** Where movement is logged: Fitness, else Kreators Run's own tool. */
const moveTo = (c: Pick<Ctx, 'on'>): string => (c.on('fitness') ? '/fitness#move-heading' : '/run?tab=tracking');

/** Gratitude and mood: days with gratitude written (only that a day has it) against days without, on the mood logged. */
function gratitudeMood(c: Ctx): Insight {
  const mood = c.wb('mood');
  const wrote = new Set(c.f.gratitudeDays ?? []);
  return pairInsight(c, {
    key: 'gratitude-mood',
    apps: ['journal', 'mood', 'insights'],
    reads: ['gratitude', 'wellbeing'],
    priv: true,
    title: 'Gratitude and mood',
    days: pairDays(c, c.pairFrom, (d) => (mood.has(d) ? wrote.has(d) : null), (d) => mood.get(d) ?? null),
    minOn: 5,
    minGap: 0.5,
    scale: 2,
    fmt: one,
    unit: '',
    onLabel: 'Mood on gratitude days',
    offLabel: 'Mood on other days',
    sentence: (a, b) => `On days you wrote your gratitude, your mood was ${a} on average. On other days, ${b}.`,
    same: (a, b) => `Your mood was about the same either way: ${a} on gratitude days, ${b} on others.`,
    needLine: (k) => `Log your mood on ${plural(k, 'more day')}, some with gratitude written and some without.`,
    action: { label: 'Write today’s gratitude', to: '/journal#gratitude-heading', kind: 'link' },
  });
}

/**
 * When you move: the average active minutes on each weekday over eight weeks (every day counted, a day with none as 0), and the weekday
 * that stands out. A spread with no day holding a quarter of the minutes says so and ranks 0 (listed on /insights only).
 */
function moveWeekday(c: Ctx): Insight {
  const apps: InsightApp[] = ['fitness', 'life', 'pillar', 'insights'];
  const reads: InsightPart[] = ['move'];
  const move = c.wb('move');
  const span = dayRange(c.pairFrom, c.yesterday);
  const moved = span.filter((d) => (move.get(d) ?? 0) > 0).length;
  if (moved < MOVE_WEEKDAY_MIN_DAYS) return watching('move-weekday', apps, reads, true, 'When you move', needOr(c, MOVE_WEEKDAY_MIN_DAYS - moved, `Log movement on ${plural(MOVE_WEEKDAY_MIN_DAYS - moved, 'more day')}.`), 'self');
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of span) {
    const w = isoWeekday(d) - 1;
    counts[w] = (counts[w] ?? 0) + 1;
    totals[w] = (totals[w] ?? 0) + Math.max(0, move.get(d) ?? 0);
  }
  const values = totals.map((t, i) => ((counts[i] ?? 0) > 0 ? Math.round(t / counts[i]!) : 0));
  const total = totals.reduce((s, v) => s + v, 0);
  const max = Math.max(...values);
  const top = values.indexOf(max);
  const tied = values.filter((v) => v === max).length > 1;
  const share = total > 0 ? (totals[top] ?? 0) / total : 0;
  const even = tied || share < 0.25;
  const otherDays = span.length - (counts[top] ?? 0);
  const others = otherDays > 0 ? Math.round((total - (totals[top] ?? 0)) / otherDays) : 0;
  const weekAvg = Math.round((total / Math.max(1, span.length)) * 7);
  return {
    key: 'move-weekday',
    id: 'move-weekday',
    state: 'ready',
    apps,
    reads,
    private: true,
    relationship: 'self',
    headline: even ? `${formatCount(weekAvg)} min a week` : `${WEEKDAY_SHORT[top]}s`,
    text: even
      ? `Your movement is spread across the week: ${formatCount(weekAvg)} active minutes a week on average.`
      : `You move most on ${WEEKDAY_NAMES[top]}s: ${formatCount(max)} minutes on average, against ${formatCount(others)} on other days.`,
    basis: `From ${plural(moved, 'day')} with movement ${c.span.eight}.`,
    chart: { kind: 'week', labels: WEEKDAY_SHORT, values },
    action: { label: 'Log movement', to: moveTo(c), kind: 'link' },
    need: null,
    strength: even ? 0 : Math.min(70, 30 + Math.round(share * 60)),
  };
}

/**
 * How you eat and how you feel: days the person said they ate well or very well (4 or 5 of 5 on the eating check-in) against the other
 * days they checked in, on the mood that day, the stress that day and the sleep that night, each only while its app is on; the card
 * says the clearest one.
 */
function eatDays(c: Ctx): Insight | null {
  const apps: InsightApp[] = ['fitness', 'life', 'pillar', 'insights'];
  const reads: InsightPart[] = ['eat', 'wellbeing'];
  const eat = c.wb('eat');
  const logged = [...eat.keys()].filter((d) => d >= c.pairFrom && d <= c.yesterday).length;
  if (logged < EAT_MIN_DAYS) return { ...watching('eat-days', apps, reads, true, 'How you eat and how you feel', needOr(c, EAT_MIN_DAYS - logged, `Do the eating check-in on ${plural(EAT_MIN_DAYS - logged, 'more day')}.`)), relationship: 'self' };
  const well = (d: string): boolean | null => (eat.has(d) ? (eat.get(d) ?? 0) >= 4 : null);
  const common = { key: 'eat-days' as const, reads, priv: true, title: 'How you eat and how you feel', minOn: 5, minGap: 0.5, scale: 2, fmt: one, offLabel: '', action: { label: 'Open the eating check-in', to: '/fitness#eat-heading', kind: 'link' as const } };
  const splits: { name: string; r: Insight }[] = [];
  if (c.on('mood')) {
    const mood = c.wb('mood');
    splits.push({
      name: 'mood',
      r: pairInsight(c, {
        ...common,
        apps: [...apps, 'mood'],
        days: pairDays(c, c.pairFrom, (d) => (mood.has(d) ? well(d) : null), (d) => mood.get(d) ?? null),
        unit: '',
        onLabel: 'Mood on days you ate well',
        offLabel: 'Mood on other days',
        sentence: (a, b) => `On days you said you ate well, your mood was ${a} on average. On other days, ${b}.`,
        same: (a, b) => `Your mood was about the same either way: ${a} on days you ate well, ${b} on others.`,
        needLine: (k) => `Do the eating check-in and log your mood on ${plural(k, 'more day')}.`,
      }),
    });
  }
  if (c.on('stress')) {
    const stress = c.wb('stress');
    splits.push({
      name: 'stress',
      r: pairInsight(c, {
        ...common,
        apps: [...apps, 'stress'],
        days: pairDays(c, c.pairFrom, (d) => (stress.has(d) ? well(d) : null), (d) => stress.get(d) ?? null),
        unit: '',
        onLabel: 'Stress on days you ate well',
        offLabel: 'Stress on other days',
        sentence: (a, b) => `On days you said you ate well, your stress was ${a} on average. On other days, ${b}.`,
        same: (a, b) => `Your stress was about the same either way: ${a} on days you ate well, ${b} on others.`,
        needLine: (k) => `Do the eating check-in and log your stress on ${plural(k, 'more day')}.`,
      }),
    });
  }
  if (c.on('sleep')) {
    // Sleep is logged the morning after, so the night after a day is the next day's log.
    const sleep = c.wb('sleep');
    const night = (d: string) => sleep.get(addDays(d, 1)) ?? null;
    splits.push({
      name: 'sleep',
      r: pairInsight(c, {
        ...common,
        apps: [...apps, 'sleep'],
        days: pairDays(c, c.pairFrom, (d) => (night(d) !== null ? well(d) : null), night),
        unit: 'h',
        onLabel: 'Sleep after you ate well',
        offLabel: 'Sleep after other days',
        sentence: (a, b) => `On days you said you ate well, you slept ${a} hours that night on average. On other days, ${b}.`,
        same: (a, b) => `You slept about the same either way: ${a} hours after days you ate well, ${b} after others.`,
        needLine: (k) => `Do the eating check-in and log your sleep on ${plural(k, 'more day')}.`,
      }),
    });
  }
  if (!splits.length) return null;
  const ready = splits.filter((s) => s.r.state === 'ready').sort((a, b) => b.r.strength - a.r.strength || (a.name < b.name ? -1 : 1));
  // The card shows the split its sentence talks about, and only that one.
  return { ...(ready[0] ?? splits[0]!).r, relationship: 'self' };
}

interface Mover {
  key: string;
  then: number;
  now: number;
  /** "24 tasks, up from 18" */
  line: (now: string, then: string, up: boolean) => string;
  delta: (d: number) => string;
  fmt: (v: number) => string;
  label: string;
  unit: string;
}

function reviewSince(c: Ctx): Insight | null {
  const r = c.f.review;
  const apps: InsightApp[] = ['reviews', 'home', 'insights'];
  if (!r) return watching('review-since', apps, ['reviews'], false, 'Since your last review', 'Save a review and the period after it shows here.');
  if (r.sinceStart > c.f.today) return null;
  const sign = (d: number, f: (v: number) => string) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${f(Math.abs(d))}`;
  const daysSoFar = Math.max(1, daysBetween(r.sinceStart, r.sinceEnd < c.f.today ? r.sinceEnd : c.f.today) + 1);
  const thenDays = Math.max(1, r.then.days);
  // A count is compared as a whole only over two spans of the same length; a period still running (or a month of
  // another length) is compared per day, so three days are never set against a whole week.
  const whole = r.ended && daysSoFar === thenDays;
  const pctWord = (v: number) => `${Math.round(v)}%`;
  const cand: Mover[] = whole
    ? [
        { key: 'tasks', then: r.then.tasksDone, now: r.since.tasksDone, line: (n, t, up) => `${n} tasks, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} tasks`, fmt: formatCount, label: 'Tasks', unit: 'tasks' },
        { key: 'active', then: r.then.activeDays, now: r.since.activeDays, line: (n, t, up) => `${n} active days, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} days`, fmt: formatCount, label: 'Active days', unit: 'days' },
        { key: 'kept', then: r.then.notToDoKept, now: r.since.notToDoKept, line: (n, t, up) => `${n} kept on your not to do list, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} kept`, fmt: formatCount, label: 'Not to do kept', unit: 'days' },
      ]
    : [
        { key: 'tasks', then: r.then.tasksDone / thenDays, now: r.since.tasksDone / daysSoFar, line: (n, t, up) => `${n} tasks a day, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, one)} a day`, fmt: one, label: 'Tasks a day', unit: 'tasks' },
        { key: 'active', then: (100 * r.then.activeDays) / thenDays, now: (100 * r.since.activeDays) / daysSoFar, line: (n, t, up) => `active on ${n} of days, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, pctWord)} active`, fmt: pctWord, label: 'Days active', unit: '%' },
        { key: 'kept', then: (100 * r.then.notToDoKept) / thenDays, now: (100 * r.since.notToDoKept) / daysSoFar, line: (n, t, up) => `not to do kept on ${n} of days, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, pctWord)} kept`, fmt: pctWord, label: 'Not to do kept', unit: '%' },
      ];
  const priv = { sleep: c.on('sleep'), mood: c.on('mood'), mindful: c.on('mindful') };
  if (priv.sleep && r.then.sleepAvg !== null && r.since.sleepAvg !== null)
    cand.push({ key: 'sleep', then: r.then.sleepAvg, now: r.since.sleepAvg, line: (n, t, up) => `sleep ${n} h, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, one)} h sleep`, fmt: one, label: 'Sleep', unit: 'h' });
  if (priv.mood && r.then.moodAvg !== null && r.since.moodAvg !== null)
    cand.push({ key: 'mood', then: r.then.moodAvg, now: r.since.moodAvg, line: (n, t, up) => `mood ${n}, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, one)} mood`, fmt: one, label: 'Mood', unit: '' });
  if (priv.mindful && whole)
    cand.push({ key: 'mindful', then: r.then.mindfulMin, now: r.since.mindfulMin, line: (n, t, up) => `${n} mindful minutes, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} minutes`, fmt: formatCount, label: 'Mindful minutes', unit: 'min' });
  else if (priv.mindful)
    cand.push({ key: 'mindful', then: r.then.mindfulMin / thenDays, now: r.since.mindfulMin / daysSoFar, line: (n, t, up) => `${n} mindful minutes a day, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} min a day`, fmt: (v) => formatCount(Math.round(v)), label: 'Mindful a day', unit: 'min' });
  // Active minutes (Fitness and Kreators Run's logs), private like the trackers.
  if (moveOn(c) && whole)
    cand.push({ key: 'move', then: r.then.moveMin, now: r.since.moveMin, line: (n, t, up) => `${n} active minutes, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} active minutes`, fmt: formatCount, label: 'Active minutes', unit: 'min' });
  else if (moveOn(c))
    cand.push({ key: 'move', then: r.then.moveMin / thenDays, now: r.since.moveMin / daysSoFar, line: (n, t, up) => `${n} active minutes a day, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} active min a day`, fmt: (v) => formatCount(Math.round(v)), label: 'Active a day', unit: 'min' });
  const movers = cand
    .filter((m) => m.fmt(m.now) !== m.fmt(m.then))
    .sort((a, b) => Math.abs(b.now - b.then) / Math.max(Math.abs(b.then), 1) - Math.abs(a.now - a.then) / Math.max(Math.abs(a.then), 1) || (a.key < b.key ? -1 : 1))
    .slice(0, 2);
  const isPriv = movers.some((m) => m.key === 'sleep' || m.key === 'mood' || m.key === 'mindful' || m.key === 'move');
  const kindWord = PERIOD_META[r.kind].short.toLowerCase();
  const label = periodLabel({ kind: r.kind, start: r.start, end: r.end } as Parameters<typeof periodLabel>[0]);
  const lead = `Since your ${kindWord} review of ${label}${r.ended ? '' : ', so far'}`;
  const daysIn = Math.max(1, daysBetween(r.sinceStart, r.sinceEnd < c.f.today ? r.sinceEnd : c.f.today) + 1);
  const fresh = !r.ended && daysIn <= 3;
  if (!movers.length) {
    return {
      key: 'review-since',
      id: 'review-since',
      state: 'ready',
      apps,
      reads: ['reviews'],
      private: false,
      relationship: null,
      headline: 'Steady',
      text: `${lead}: your numbers are about the same as then.`,
      basis: `From your saved ${kindWord} review and ${plural(daysIn, 'day')} since.`,
      chart: null,
      action: { label: 'Write a review', to: `/reviews?kind=${r.kind}`, kind: 'link' },
      need: null,
      strength: 0,
    };
  }
  const parts = movers.map((m) => m.line(m.fmt(m.now), m.fmt(m.then), m.now > m.then));
  // One mover in the sentence, the one the card draws first, so the card stays short.
  const sentence = `${lead}: ${parts[0]}.`;
  return {
    key: 'review-since',
    id: 'review-since',
    state: 'ready',
    apps,
    reads: isPriv ? ['reviews', 'wellbeing'] : ['reviews'],
    private: isPriv,
    relationship: null,
    // Per day, both numbers ("33% vs 57%"), so a share is never read as a change of a share.
    headline: whole ? movers[0]!.delta(movers[0]!.now - movers[0]!.then) : `${movers[0]!.fmt(movers[0]!.now)} vs ${movers[0]!.fmt(movers[0]!.then)}`,
    text: sentence,
    basis: `From your saved ${kindWord} review and ${plural(daysIn, 'day')} since.`,
    chart: {
      kind: 'pair',
      rows: movers.flatMap((m) => [
        { label: `${m.label} then`, value: Math.round(m.then * 10) / 10, n: r.then.days, unit: m.unit },
        { label: `${m.label} since`, value: Math.round(m.now * 10) / 10, n: daysIn, unit: m.unit },
      ]),
    },
    action: { label: `Write this ${kindWord}'s review`, to: `/reviews?kind=${r.kind}`, kind: 'link' },
    need: null,
    strength: fresh ? 55 : 25,
  };
}

function discoverStrength(c: Ctx): Insight | null {
  const d = c.f.discover;
  if (!d || !d.steps || !RELATIONSHIP_BY_KEY[d.growth]) return null;
  const apps: InsightApp[] = ['discover', 'pillar', 'insights'];
  const ticks = c.f.xp30.reduce((s, r) => s + Math.max(0, r.ticks), 0);
  if (ticks < 10) return watching('discover-strength', apps, ['discover', 'tasks'], false, 'Your quietest strength', needOr(c, 10 - ticks, `Tick a few more tasks: ${formatCount(ticks)} of 10 so far ${c.span.thirty}.`), d.growth);
  const by = new Map(c.f.xp30.map((r) => [r.relationship, Math.max(0, r.ticks)]));
  const mine = by.get(d.growth) ?? 0;
  const share = pct(mine, ticks);
  const min = Math.min(...RELATIONSHIPS.map((r) => by.get(r.key) ?? 0));
  const strength = DISCOVER_STRENGTHS[d.growth].name;
  const pillar = pillarName(d.growth);
  const lead = `Your quietest strength is ${strength}, the ${pillar} pillar.`;
  const quiet = share < 10;
  const text = quiet
    ? `${lead} ${pillar} got ${share}% of your ticks ${c.span.thirty}${mine === min ? ', the fewest of any pillar' : ''}.`
    : `${lead} You already give ${pillar} ${share}% of your ticks.`;
  return {
    key: 'discover-strength',
    id: 'discover-strength',
    state: 'ready',
    apps,
    reads: ['discover', 'tasks'],
    private: false,
    relationship: d.growth,
    headline: `${share}%`,
    text,
    basis: `From your Discover result and ${plural(ticks, 'tick')} ${c.span.thirty}.`,
    chart: { kind: 'share', parts: RELATIONSHIPS.map((r) => ({ relationship: r.key, value: by.get(r.key) ?? 0 })), mark: d.growth },
    action: { label: `Add a task to ${pillar}`, to: `/realm/${d.growth}?add=1`, kind: 'link' },
    need: null,
    strength: quiet ? 45 : 20,
  };
}

function agencyLoad(c: Ctx): Insight {
  const due = new Set(c.f.agencyDue);
  return pairInsight(c, {
    key: 'agency-load',
    apps: ['agency', 'today', 'insights'],
    reads: ['agency', 'tasks'],
    priv: false,
    title: 'Client work and your tasks',
    days: pairDays(c, c.pairFrom, (d) => (c.activeDays.has(d) || due.has(d) ? due.has(d) : null), (d) => c.ticksByDay.get(d) ?? 0),
    minOn: 5,
    minOff: PAIR_MIN_DAYS,
    minGap: 0.5,
    scale: tasksScale,
    fmt: tasksFmt,
    unit: 'tasks',
    onLabel: 'A client piece due',
    offLabel: 'Nothing due',
    sentence: (a, b) => `On days a client piece was due, you ticked ${a} of your own tasks. On other days, ${b}.`,
    same: (a, b) => `You ticked about the same either way: ${a} tasks with a client piece due, ${b} without.`,
    needLine: (k) => `Give client pieces due days on ${plural(k, 'more day')}.`,
    action: { label: 'Plan my week', to: '/today?plan=week', kind: 'link' },
  });
}

// ---- good and bad habits (2026-11-04) --------------------------------------
// A task done again and again, or a slip on the not to do list, set against the person's own days: on days with it, how did the
// day go next to days without it. How the day felt (mood, sleep that night, stress) decides first; other tasks and focus decide
// only when no feeling is clear, and back a verdict up only when they agree. Every line says what went together, never a cause.

/** What a habit is set against: mood, sleep that night, stress (lower is calmer), other tasks ticked and focus minutes. */
export type TieSignalName = 'mood' | 'sleep' | 'calm' | 'tasks' | 'focus';
const TIE_ORDER: TieSignalName[] = ['mood', 'sleep', 'calm', 'tasks', 'focus'];
export interface TieSignal {
  name: TieSignalName;
  /** How the day felt (wellbeing): private, and it decides first. */
  feel: boolean;
  apps: InsightApp[];
  reads: InsightPart[];
  /** The day's number, or null when there is none; `own` is how many of the habit's own ticks fell that day. */
  y: (d: string, own: number) => number | null;
  /** 1 when higher is a better day, -1 when lower is (stress). */
  better: 1 | -1;
  minGap: number;
  scale: (a: number, b: number) => number;
  fmt: (v: number) => string;
  unit: string;
  label: string;
  /** "your mood was 0.8 higher": `up` means higher on the days with it. */
  said: (gap: number, up: boolean) => string;
}

function tieSignals(c: Ctx, kind: TieCandidate['kind']): TieSignal[] {
  const out: TieSignal[] = [];
  const twoScale = () => 2;
  if (c.on('mood')) {
    const mood = c.wb('mood');
    out.push({ name: 'mood', feel: true, apps: ['mood', 'wellbeing'], reads: ['wellbeing'], y: (d) => mood.get(d) ?? null, better: 1, minGap: 0.5, scale: twoScale, fmt: one, unit: '', label: 'Mood', said: (g, up) => `your mood was ${one(g)} ${up ? 'higher' : 'lower'}` });
  }
  if (c.on('sleep')) {
    // Sleep is logged on the morning after ("last night"), so the night after a day is the next day's log.
    const sleep = c.wb('sleep');
    out.push({ name: 'sleep', feel: true, apps: ['sleep', 'wellbeing'], reads: ['wellbeing'], y: (d) => sleep.get(addDays(d, 1)) ?? null, better: 1, minGap: 0.5, scale: twoScale, fmt: one, unit: 'h', label: 'Sleep that night', said: (g, up) => `you slept ${one(g)} hours ${up ? 'more' : 'less'} that night` });
  }
  if (c.on('stress')) {
    const stress = c.wb('stress');
    out.push({ name: 'calm', feel: true, apps: ['stress', 'wellbeing'], reads: ['wellbeing'], y: (d) => stress.get(d) ?? null, better: -1, minGap: 0.5, scale: twoScale, fmt: one, unit: '', label: 'Stress', said: (g, up) => `your stress was ${one(g)} ${up ? 'higher' : 'lower'}` });
  }
  const other = kind === 'task' ? 'other tasks' : 'tasks';
  out.push({
    name: 'tasks',
    feel: false,
    apps: [],
    reads: ['tasks'],
    y: (d, own) => (c.activeDays.has(d) ? Math.max(0, (c.ticksByDay.get(d) ?? 0) - own) : null),
    better: 1,
    minGap: 0.5,
    scale: tasksScale,
    fmt: tasksFmt,
    unit: 'tasks',
    label: kind === 'task' ? 'Other tasks' : 'Tasks',
    said: (g, up) => `you ticked ${one(g)} ${up ? 'more' : 'fewer'} ${other}`,
  });
  if (c.on('mindful')) {
    const focus = new Map<string, number>();
    for (const r of c.f.focus) focus.set(r.day, (focus.get(r.day) ?? 0) + Math.max(0, r.minutes));
    out.push({
      name: 'focus',
      feel: false,
      apps: ['mindful'],
      reads: ['focus'],
      y: (d) => (c.activeDays.has(d) ? (focus.get(d) ?? 0) : null),
      better: 1,
      minGap: 10,
      scale: (a, b) => Math.max(a, b, 25),
      fmt: (v) => formatCount(Math.round(v)),
      unit: 'min',
      label: 'Focus',
      said: (g, up) => `you focused ${formatCount(Math.round(g))} minutes ${up ? 'more' : 'less'}`,
    });
  }
  return out;
}

function listOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}
const FEEL_WORDS: Record<TieSignalName, string> = { mood: 'mood', sleep: 'sleep', calm: 'stress', tasks: 'tasks', focus: 'focus' };

interface TieCandidate {
  kind: 'task' | 'notToDo' | 'move';
  id: string;
  key: string;
  title: string;
  rel: RelationshipKey | null;
  /** Each day from the first one it could count to yesterday: with it (or a slip), without it (or kept), or not known. */
  days: { d: string; on: boolean | null; own: number }[];
  repeats: boolean;
  to: string;
  toLabel: string;
  canAddNotToDo: boolean;
  suggestion: HabitSuggestion | null;
  /** The person's own "Count it as a habit": true lowers the floor, false asks for a strong pattern. */
  habit: boolean | null;
}

/**
 * The one classifier: a clear lift on how the days went is a good habit, a clear dip a bad one, and too few days, no gap or a
 * mix is still watching. A slip on the not to do list is the bad side, so it can only be a bad habit; moving (`goodOnly`) can only be a
 * good one. Pure.
 */
export function classifyHabitTie(days: readonly { on: boolean | null; ys: Partial<Record<TieSignalName, number | null>> }[], signals: readonly Pick<TieSignal, 'name' | 'feel' | 'better' | 'minGap' | 'scale' | 'fmt'>[], slip: boolean, minOn = HABIT_TIE_MIN_DAYS, minOff = PAIR_MIN_DAYS, minNorm = 0, goodOnly = false): {
  verdict: 'good' | 'bad' | 'watching';
  /** Why it is still watching. */
  reason: 'days' | 'same' | 'mixed' | null;
  /** The signals behind the verdict, the strongest first (at most two). */
  shown: { name: TieSignalName; split: SplitResult; norm: number }[];
  /** The fewest more days any signal needs. */
  more: number;
} {
  const splits = signals.map((s) => ({ s, split: splitCompare(days.map((d) => ({ on: d.on, y: d.ys[s.name] ?? null })), minOn, s.minGap, minOff) }));
  const more = Math.max(1, Math.min(...splits.map(({ split }) => Math.max(0, minOn - split.on.n) + Math.max(0, minOff - split.off.n)), Number.MAX_SAFE_INTEGER));
  const clear = splits
    .filter(({ s, split }) => split.ready && split.on.avg !== null && split.off.avg !== null && s.fmt(split.on.avg) !== s.fmt(split.off.avg))
    .map(({ s, split }) => ({ s, split, dir: Math.sign(split.gap) * s.better, norm: Math.abs(split.gap) / Math.max(1e-9, s.scale(split.on.avg!, split.off.avg!)) }));
  if (!splits.some(({ split }) => split.enough)) return { verdict: 'watching', reason: 'days', shown: [], more };
  // How the day felt decides; tasks and focus only when no feeling is clear.
  const feel = clear.filter((x) => x.s.feel);
  const pool = feel.length ? feel : clear;
  const ups = pool.filter((x) => x.dir > 0);
  const downs = pool.filter((x) => x.dir < 0);
  if (!pool.length) return { verdict: 'watching', reason: 'same', shown: [], more: 0 };
  if (ups.length && downs.length) return { verdict: 'watching', reason: 'mixed', shown: [], more: 0 };
  // A better day after a slip is no verdict: the not to do list only ever names a bad habit.
  if (slip && ups.length) return { verdict: 'watching', reason: 'same', shown: [], more: 0 };
  // Moving (2026-11-07) is only ever named a good habit: a worse day after moving is no verdict.
  if (goodOnly && downs.length) return { verdict: 'watching', reason: 'same', shown: [], more: 0 };
  const verdict: 'good' | 'bad' = ups.length ? 'good' : 'bad';
  const dir = verdict === 'good' ? 1 : -1;
  const agree = clear.filter((x) => x.dir === dir).sort((a, b) => Number(b.s.feel) - Number(a.s.feel) || b.norm - a.norm || TIE_ORDER.indexOf(a.s.name) - TIE_ORDER.indexOf(b.s.name));
  // Only a strong pattern when one is asked for (a task the person said is not a habit).
  if ((agree[0]?.norm ?? 0) < minNorm) return { verdict: 'watching', reason: 'same', shown: [], more: 0 };
  return { verdict, reason: null, shown: agree.slice(0, 2).map((x) => ({ name: x.s.name, split: x.split, norm: x.norm })), more: 0 };
}

function tieInsight(c: Ctx, cand: TieCandidate, signals: TieSignal[]): Insight | null {
  const slip = cand.kind === 'notToDo';
  const move = cand.kind === 'move';
  const days = cand.days.map((d) => ({ on: d.on, ys: Object.fromEntries(signals.map((s) => [s.name, d.on === null ? null : s.y(d.d, d.own)])) as Partial<Record<TieSignalName, number | null>> }));
  const strict = cand.habit === false;
  const r = strict ? classifyHabitTie(days, signals, slip, HABIT_TIE_STRICT_DAYS, HABIT_TIE_STRICT_DAYS, HABIT_TIE_STRICT_NORM) : classifyHabitTie(days, signals, slip, HABIT_TIE_MIN_DAYS, PAIR_MIN_DAYS, 0, move);
  // Not a habit by the person's own word: only a strong pattern is said, and nothing waits under Still watching.
  if (strict && r.verdict === 'watching') return null;
  const baseApps: InsightApp[] = cand.kind === 'task' ? ['home', 'today', 'tower', 'pillar', 'insights'] : move ? ['home', 'today', 'fitness', 'life', 'pillar', 'insights'] : ['home', 'today', 'pillar', 'insights'];
  const baseReads: InsightPart[] = [cand.kind === 'task' ? 'tasks' : move ? 'move' : 'notToDo'];
  const quoted = `“${cand.title}”`;
  if (r.verdict === 'watching') {
    const feelOn = signals.filter((s) => s.feel).map((s) => FEEL_WORDS[s.name]);
    const logged = feelOn.length ? `, with your ${listOr(feelOn)} logged` : '';
    const need =
      r.reason === 'days'
        ? slip
          ? needOr(c, r.more, `Mark it kept or slipped on ${plural(r.more, 'more day')}${logged}.`)
          : move
            ? needOr(c, r.more, `Have ${plural(r.more, 'more day')} with movement and without${logged}.`)
            : needOr(c, r.more, `Have ${plural(r.more, 'more day')} with it and without${logged}.`)
        : r.reason === 'mixed'
          ? 'Mixed so far: some days went better with it, some worse.'
          : slip
            ? 'Nothing clear yet between slip days and kept days.'
            : move
              ? 'Nothing clear yet between days you moved and days you did not.'
              : 'About the same so far on days with it and without.';
    const w = watching('habit-tie', move ? ['fitness', 'insights'] : ['insights'], baseReads, move, slip ? `Slips on ${quoted} and how your days go` : move ? 'Moving and how your days go' : `${quoted} and how your days go`, need, cand.rel);
    return { ...w, id: `habit-tie:${cand.id}` };
  }
  const byName = new Map(signals.map((s) => [s.name, s]));
  const shown = r.shown.map((x) => ({ ...x, s: byName.get(x.name)! }));
  const lead = shown[0]!;
  const a = lead.s.fmt(lead.split.on.avg!);
  const b = lead.s.fmt(lead.split.off.avg!);
  const clauses = shown.map((x) => x.s.said(Math.abs(x.split.gap), x.split.gap > 0));
  const text = move ? `On days you moved, ${clauses.join(' and ')}, on average.` : `On days you ${slip ? 'slipped on' : 'ticked'} ${quoted}, ${clauses.join(' and ')}, on average.`;
  const onN = Math.min(...shown.map((x) => x.split.on.n));
  const offN = Math.min(...shown.map((x) => x.split.off.n));
  const basis = slip
    ? `From ${plural(lead.split.on.n, 'slip day')} and ${plural(lead.split.off.n, 'kept day')} ${c.span.eight}. ${INSIGHT_BASIS_TAIL}`
    : move
      ? `From ${plural(lead.split.on.n, 'day')} you moved and ${plural(lead.split.off.n, 'day')} you did not, ${c.span.eight}. ${INSIGHT_BASIS_TAIL}`
      : `From ${plural(lead.split.on.n, 'day')} with it and ${plural(lead.split.off.n, 'day')} without, ${c.span.eight}. ${INSIGHT_BASIS_TAIL}`;
  const rows: InsightPairRow[] = shown.flatMap((x) => [
    { label: slip ? `${x.s.label} on slip days` : move ? `${x.s.label}, days you moved` : `${x.s.label} with it`, value: Math.round(x.split.on.avg! * 10) / 10, n: x.split.on.n, unit: x.s.unit },
    { label: slip ? `${x.s.label} on kept days` : move ? `${x.s.label}, other days` : `${x.s.label} without`, value: Math.round(x.split.off.avg! * 10) / 10, n: x.split.off.n, unit: x.s.unit },
  ]);
  // Movement is a tracker's number, so a card about it is private like the trackers.
  const priv = move || shown.some((x) => x.s.feel);
  const apps = [...new Set<InsightApp>([...baseApps, ...shown.flatMap((x) => x.s.apps)])];
  const reads = [...new Set<InsightPart>([...baseReads, ...shown.flatMap((x) => x.s.reads)])];
  const verdict = r.verdict;
  const open: InsightAction = { label: cand.toLabel, to: cand.to, kind: 'link' };
  const action: InsightAction =
    verdict === 'good'
      ? cand.suggestion && !cand.repeats && (cand.suggestion.projectId || cand.suggestion.openTaskId)
        ? { label: 'Make it a habit', to: cand.rel ? `/realm/${cand.rel}` : '/today', kind: 'habit' }
        : open
      : cand.kind === 'task' && cand.canAddNotToDo
        ? { label: 'Add to not to do', to: '/today#ntd-heading', kind: 'notToDo' }
        : open;
  const strength = Math.max(1, Math.min(90, Math.round(40 + 40 * Math.min(1, lead.norm)) - (onN < 10 || offN < 10 ? 10 : 0) + (shown.length > 1 ? 5 : 0)));
  return {
    key: 'habit-tie',
    id: `habit-tie:${cand.id}`,
    state: 'ready',
    apps,
    reads,
    private: priv,
    relationship: cand.rel,
    headline: `${a} vs ${b}`,
    text,
    basis,
    chart: { kind: 'pair', rows },
    action,
    need: null,
    strength,
    ...(action.kind === 'habit' && cand.suggestion ? { habit: cand.suggestion } : {}),
    tie: { verdict, kind: cand.kind, title: cand.title, key: cand.key, relationship: cand.rel, to: cand.to, toLabel: cand.toLabel, repeats: cand.repeats, canAddNotToDo: cand.canAddNotToDo },
  };
}

function habitTies(c: Ctx): Insight[] {
  const { f } = c;
  const to = c.yesterday;
  const candidates: TieCandidate[] = [];
  const listKeys = f.notToDoItems.map((i) => keyWordsOf(taskKey(i.title)));
  const onList = (key: string) => {
    const words = keyWordsOf(key);
    return listKeys.some((k) => sameKey(k, words));
  };
  const listRoom = f.notToDoItems.length < MAX_NOT_TO_DO;
  // Tasks: every group ticked on at least 3 days in 8 weeks, repeating or not, the most days first. A task the person counts as a
  // habit is one from its first tick, and comes first.
  // The person's own pick on an open task in the group wins (the first such task, in the order they came), then the newest tick's.
  // Only open tasks that carry a pick are looked at here; the whole group of mates is found for the twelve kept below.
  const habitOf = (cl: TickCluster): boolean | null => {
    const words = keyWordsOf(cl.key);
    const set = c.openByRel(cl.rel).find((x) => (x.o.habit === true || x.o.habit === false) && sameKey(words, x.k));
    if (set) return set.o.habit ?? null;
    for (let k = cl.ticks.length - 1; k >= 0; k -= 1) if (cl.ticks[k]!.habit !== null) return cl.ticks[k]!.habit;
    return null;
  };
  const matesOf = (cl: TickCluster) => {
    const words = keyWordsOf(cl.key);
    return c.openByRel(cl.rel).filter((x) => sameKey(words, x.k)).map((x) => x.o);
  };
  const clusters = clusterTicks(c.stamped, c.pairFrom, to, true)
    .map((cl) => ({ cl, days: [...new Set(cl.ticks.map((t) => t.day))].sort(), habit: habitOf(cl) }))
    .filter((x) => x.days.length >= (x.habit === true ? 1 : HABIT_MIN_TICKS))
    .sort((a, b) => Number(b.habit === true) - Number(a.habit === true) || b.days.length - a.days.length || (a.cl.rel + a.cl.key < b.cl.rel + b.cl.key ? -1 : 1))
    .slice(0, 12);
  for (const { cl, days, habit } of clusters) {
    const mates = matesOf(cl);
    const repeats = cl.ticks.some((t) => t.repeats) || mates.some((o) => o.repeats);
    const onDaily = mates.find((o) => o.openDay && o.openDay <= f.today);
    const own = new Map<string, number>();
    for (const t of cl.ticks) own.set(t.day, (own.get(t.day) ?? 0) + 1);
    const span = dayRange(days[0]!, to);
    const suggestion = suggestionFor(f, cl, mates.filter((o) => !o.repeats), c.last);
    candidates.push({
      kind: 'task',
      id: `task:${cl.rel}:${cl.key}`,
      key: cl.key,
      title: cl.ticks[cl.ticks.length - 1]!.title,
      rel: cl.rel,
      days: span.map((d) => ({ d, on: own.has(d), own: own.get(d) ?? 0 })),
      repeats,
      to: onDaily ? `/today?task=${onDaily.id}` : `/realm/${cl.rel}`,
      toLabel: 'Open the task',
      canAddNotToDo: listRoom && !onList(cl.key),
      suggestion,
      habit,
    });
  }
  // The not to do list: a slip is the day with it, a kept day the day without; a day with no mark is not counted.
  for (const item of f.notToDoItems) {
    const marks = new Map(f.notToDoMarks.filter((m) => m.itemId === item.id && m.day >= c.pairFrom && m.day <= to).map((m) => [m.day, m.status]));
    if (![...marks.values()].includes('slipped')) continue;
    const first = [...marks.keys()].sort()[0]!;
    candidates.push({
      kind: 'notToDo',
      id: `ntd:${item.id}`,
      key: item.id,
      title: item.title.trim(),
      rel: item.relationship,
      days: dayRange(first, to).map((d) => ({ d, on: marks.has(d) ? marks.get(d) === 'slipped' : null, own: 0 })),
      repeats: false,
      to: '/today#ntd-heading',
      toLabel: 'Open your not to do list',
      canAddNotToDo: false,
      suggestion: null,
      habit: null,
    });
  }
  // Moving at all (2026-11-07; Fitness, Kreators Run's tool and club runs): a day with movement logged against a day the person used the
  // app and logged none, from the first day moved in eight weeks. Only ever a good habit; never a not to do item.
  if (moveOn(c)) {
    const mv = c.wb('move');
    const moved = [...mv.entries()].filter(([d, v]) => d >= c.pairFrom && d <= to && v > 0).map(([d]) => d).sort();
    if (moved.length) {
      candidates.push({
        kind: 'move',
        id: 'move',
        key: 'move',
        title: 'Moving',
        rel: 'self',
        days: dayRange(moved[0]!, to).map((d) => ({ d, on: (mv.get(d) ?? 0) > 0 ? true : c.activeDays.has(d) ? false : null, own: 0 })),
        repeats: false,
        to: moveTo(c),
        // The link goes to the movement form (Fitness's, or Kreators Run's own tool), so it reads the same on Fitness itself.
        toLabel: 'Log movement',
        canAddNotToDo: false,
        suggestion: null,
        habit: null,
      });
    }
  }
  const signals = { task: tieSignals(c, 'task'), notToDo: tieSignals(c, 'notToDo'), move: tieSignals(c, 'move') };
  const all = candidates.map((cand) => tieInsight(c, cand, signals[cand.kind])).filter((x): x is Insight => x !== null);
  const ready = all.filter((i) => i.state === 'ready').sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).slice(0, MAX_HABIT_TIES);
  const wait = all.filter((i) => i.state === 'watching').slice(0, MAX_HABIT_TIES_WATCHING);
  if (!ready.length && !wait.length) {
    const feelOn = (['mood', 'sleep', 'stress'] as const).filter((k) => c.on(k));
    const log = feelOn.length ? ` and log your ${listOr([...feelOn])}` : '';
    return [watching('habit-tie', ['insights'], ['tasks', 'notToDo'], false, 'Good and bad habits', needOr(c, HABIT_TIE_MIN_DAYS, `Tick the same task on ${HABIT_TIE_MIN_DAYS} days or mark your not to do list${log}.`))];
  }
  return [...ready, ...wait];
}

const KEY_ORDER: InsightKey[] = ['habit', 'habit-tie', 'pillar-balance', 'best-hours', 'streak-weekday', 'sleep-mood', 'focus-tasks', 'stress-calm', 'daytype-done', 'block-kept', 'money-stress', 'slips-sleep', 'routine-tasks', 'journal-mood', 'review-since', 'discover-strength', 'agency-load', 'gratitude-mood', 'move-weekday', 'eat-days', 'water-days', 'water-weekday', 'budget-over', 'budget-pace'];

// ---- water and budgets (2026-11-07, the founder: "Water and budgets in Emerging patterns") ----------------------------------------------
// Water is core: a day counts only with water logged, and a day under the goal is set beside a day at it (an unlogged day is not known).
// It is only ever a good habit. Budgets are Finance's: spending in the person's own currency against each monthly budget as it is now,
// since the app keeps no history of a budget. A budget that runs over is said in plain words, never as a failure.

/** Each day's water in the person's own days, only the days with some. */
function waterByDay(c: Ctx): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of c.f.water) out.set(w.day, (out.get(w.day) ?? 0) + Math.max(0, w.ml));
  for (const [d, ml] of out) if (ml <= 0) out.delete(d);
  return out;
}

/**
 * Days you met your water goal against days you logged water and did not, on mood, sleep that night, stress, tasks and focus, through the
 * one classifier the good and bad habits use. Only a lift is said; anything else waits under Still watching.
 */
function waterDays(c: Ctx, skipCalm: boolean): Insight {
  const apps: InsightApp[] = ['home', 'today', 'life', 'insights'];
  const title = 'Your water goal and how your days go';
  const wait = (need: string): Insight => watching('water-days', ['insights'], ['water'], true, title, need, 'self');
  const ml = waterByDay(c);
  const goal = c.f.waterGoal ?? 0;
  const logged = [...ml.keys()].filter((d) => d >= c.pairFrom && d <= c.yesterday).sort();
  const firstTime = HABIT_TIE_MIN_DAYS + PAIR_MIN_DAYS;
  if (goal <= 0 || !logged.length) return wait(needOr(c, firstTime, `Log water on ${plural(firstTime, 'more day')}, some at your goal and some under it.`));
  const signals = tieSignals(c, 'move').filter((s) => !(skipCalm && s.name === 'calm'));
  const days = logged.map((d) => ({ on: (ml.get(d) ?? 0) >= goal, ys: Object.fromEntries(signals.map((s) => [s.name, s.y(d, 0)])) as Partial<Record<TieSignalName, number | null>> }));
  const r = classifyHabitTie(days, signals, false, HABIT_TIE_MIN_DAYS, PAIR_MIN_DAYS, 0, true);
  if (r.verdict !== 'good') {
    if (r.reason === 'days') return wait(needOr(c, r.more, `Log water on ${plural(r.more, 'more day')}, some at your goal and some under it.`));
    return wait(r.reason === 'mixed' ? 'Mixed so far: some days went better at your goal, some worse.' : 'About the same so far on days you met your goal and days you did not.');
  }
  const byName = new Map(signals.map((s) => [s.name, s]));
  const shown = r.shown.map((x) => ({ ...x, s: byName.get(x.name)! }));
  const lead = shown[0]!;
  const onN = Math.min(...shown.map((x) => x.split.on.n));
  const offN = Math.min(...shown.map((x) => x.split.off.n));
  return {
    key: 'water-days',
    id: 'water-days',
    state: 'ready',
    apps: [...new Set<InsightApp>([...apps, ...shown.flatMap((x) => x.s.apps)])],
    reads: [...new Set<InsightPart>(['water', ...shown.flatMap((x) => x.s.reads)])],
    private: true,
    relationship: 'self',
    headline: `${lead.s.fmt(lead.split.on.avg!)} vs ${lead.s.fmt(lead.split.off.avg!)}`,
    text: `On days you met your water goal, ${shown.map((x) => x.s.said(Math.abs(x.split.gap), x.split.gap > 0)).join(' and ')}, on average.`,
    basis: `From ${plural(lead.split.on.n, 'day')} you met it and ${plural(lead.split.off.n, 'day')} you did not, ${c.span.eight}. ${INSIGHT_BASIS_TAIL}`,
    chart: {
      kind: 'pair',
      rows: shown.flatMap((x) => [
        { label: `${x.s.label}, goal met`, value: Math.round(x.split.on.avg! * 10) / 10, n: x.split.on.n, unit: x.s.unit },
        { label: `${x.s.label}, other days`, value: Math.round(x.split.off.avg! * 10) / 10, n: x.split.off.n, unit: x.s.unit },
      ]),
    },
    action: { label: 'Add a glass', to: '/home#water', kind: 'link' },
    need: null,
    strength: Math.max(1, Math.min(90, Math.round(40 + 40 * Math.min(1, lead.norm)) - (onN < 10 || offN < 10 ? 10 : 0) + (shown.length > 1 ? 5 : 0))),
  };
}

/** The weekday you drink least, on the days you logged water; a weekday needs two such days to stand out, and a spread says so and ranks 0. */
function waterWeekday(c: Ctx): Insight {
  const apps: InsightApp[] = ['today', 'life', 'insights'];
  const ml = waterByDay(c);
  const logged = [...ml.keys()].filter((d) => d >= c.pairFrom && d <= c.yesterday);
  if (logged.length < WATER_WEEKDAY_MIN_DAYS) return watching('water-weekday', apps, ['water'], true, 'The day you drink least', needOr(c, WATER_WEEKDAY_MIN_DAYS - logged.length, `Log water on ${plural(WATER_WEEKDAY_MIN_DAYS - logged.length, 'more day')}.`), 'self');
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const d of logged) {
    const w = isoWeekday(d) - 1;
    const v = ml.get(d) ?? 0;
    totals[w] = (totals[w] ?? 0) + v;
    counts[w] = (counts[w] ?? 0) + 1;
    total += v;
  }
  const values = totals.map((t, i) => ((counts[i] ?? 0) > 0 ? Math.round(t / counts[i]!) : 0));
  const seen = values.map((v, i) => ({ v, i })).filter((x) => (counts[x.i] ?? 0) >= 2);
  const least = seen.length ? Math.min(...seen.map((x) => x.v)) : 0;
  const low = seen.find((x) => x.v === least)?.i ?? 0;
  const tied = seen.filter((x) => x.v === least).length > 1;
  const otherDays = logged.length - (counts[low] ?? 0);
  const others = otherDays > 0 ? Math.round((total - (totals[low] ?? 0)) / otherDays) : 0;
  const gap = others - least;
  const even = seen.length < 2 || tied || gap < WATER_WEEKDAY_MIN_GAP_ML || gap / Math.max(1, others) < 0.15;
  const avg = Math.round(total / logged.length);
  return {
    key: 'water-weekday',
    id: 'water-weekday',
    state: 'ready',
    apps,
    reads: ['water'],
    private: true,
    relationship: 'self',
    headline: even ? `${formatCount(avg)} ml a day` : `${WEEKDAY_SHORT[low]}s`,
    text: even
      ? `Your water is about even across the week: ${formatCount(avg)} ml a day on the days you logged it.`
      : `You drink least on ${WEEKDAY_NAMES[low]}s: ${formatCount(least)} ml on average, against ${formatCount(others)} ml on other days.`,
    basis: `From ${plural(logged.length, 'day')} with water logged ${c.span.eight}.`,
    chart: { kind: 'week', labels: WEEKDAY_SHORT, values },
    action: { label: 'Add a glass', to: '/home#water', kind: 'link' },
    need: null,
    strength: even ? 0 : Math.min(65, 30 + Math.round((60 * gap) / Math.max(1, others))),
  };
}

const budgetAction: InsightAction = { label: 'See your budgets', to: '/finance#budgets-heading', kind: 'link' };
/** A month's spending by category, and all of it, from the rows the route read. */
function spendIndex(f: InsightFacts): { of: (month: string, category: string) => number; all: (month: string) => number } {
  const by = new Map<string, number>();
  const whole = new Map<string, number>();
  for (const r of f.budgetSpend ?? []) {
    by.set(`${r.month}|${r.category}`, (by.get(`${r.month}|${r.category}`) ?? 0) + Math.max(0, r.cents));
    whole.set(r.month, (whole.get(r.month) ?? 0) + Math.max(0, r.cents));
  }
  return { of: (m, cat) => by.get(`${m}|${cat}`) ?? 0, all: (m) => whole.get(m) ?? 0 };
}
/** Whole rupees (or the person's whole unit) for a line, from integer cents. */
const wholeMoney = (cents: number, currency: string) => money(Math.round(cents / 100) * 100, currency);

/**
 * Which budget keeps running over: over its monthly budget in at least two finished months and at least half of them, among the months with
 * any spending logged. A quarter or longer when a period is picked, else the last six finished months. "Ran over", never "failed".
 */
function budgetOver(c: Ctx): Insight | null {
  const { f } = c;
  const budgets = f.budgets ?? [];
  const win = f.window;
  if (!budgets.length || (win && (win.kind === 'day' || win.kind === 'week' || win.kind === 'month'))) return null;
  const apps: InsightApp[] = ['finance', 'home', 'life', 'insights'];
  const thisMonth = f.today.slice(0, 7);
  const months: string[] = [];
  if (win) for (let m = win.start.slice(0, 7); m <= win.end.slice(0, 7) && m < thisMonth; m = monthShift(m, 1)) months.push(m);
  else for (let i = BUDGET_OVER_MONTHS; i >= 1; i -= 1) months.push(monthShift(thisMonth, -i));
  const spend = spendIndex(f);
  const logged = months.filter((m) => spend.all(m) > 0);
  if (logged.length < BUDGET_OVER_MIN_MONTHS) {
    const more = BUDGET_OVER_MIN_MONTHS - logged.length;
    return watching('budget-over', apps, ['money'], true, 'Budgets that keep running over', needOr(c, more * 28, `Log your spending for ${plural(more, 'more month')}.`));
  }
  const n = logged.length;
  const rows = budgets
    .map((b) => {
      const over = logged.filter((m) => spend.of(m, b.category) > b.monthlyCents);
      const spent = logged.reduce((s, m) => s + spend.of(m, b.category), 0);
      return { b, over: over.length, by: over.length ? over.reduce((s, m) => s + spend.of(m, b.category) - b.monthlyCents, 0) / over.length : 0, avg: spent / n };
    })
    .filter((r) => r.over >= 2 && r.over * 2 >= n)
    .sort((a, b) => b.over - a.over || b.by - a.by || (a.b.category < b.b.category ? -1 : 1));
  const during = win ? c.span.eight : `in the last ${formatCount(n)} months`;
  const basis = `From ${plural(n, 'month')} of your spending${c.span.tail}, in ${f.currency}, against your budgets as they are now.`;
  const top = rows[0];
  if (!top) return { key: 'budget-over', id: 'budget-over', state: 'ready', apps, reads: ['money'], private: true, relationship: null, headline: 'Held', text: `No budget kept running over ${during}.`, basis, chart: null, action: budgetAction, need: null, strength: 20 };
  return {
    key: 'budget-over',
    id: 'budget-over',
    state: 'ready',
    apps,
    reads: ['money'],
    private: true,
    relationship: null,
    headline: `${formatCount(top.over)} of ${formatCount(n)} months`,
    text: `${top.b.category} ran over its budget in ${formatCount(top.over)} of ${formatCount(n)} months, by ${wholeMoney(top.by, f.currency)} on average.`,
    basis,
    chart: {
      kind: 'pair',
      rows: [
        { label: 'Spent in a month, on average', value: Math.round(top.avg), n: n, unit: f.currency },
        { label: 'Its budget', value: top.b.monthlyCents, n: n, unit: f.currency },
      ],
    },
    action: budgetAction,
    need: null,
    strength: Math.max(1, Math.min(80, 40 + Math.round((40 * top.over) / n)) - (n < 4 ? 10 : 0)),
  };
}

/**
 * How the month's pace compares with its budgets: the share of each budget used against the share of the month gone, as of the period's end.
 * Only a month or shorter, or no period picked; a longer one is the card above. Ahead by ten points or more is worth saying.
 */
function budgetPace(c: Ctx): Insight | null {
  const { f } = c;
  const win = f.window;
  if (win && win.kind !== 'day' && win.kind !== 'week' && win.kind !== 'month') return null;
  const apps: InsightApp[] = ['finance', 'home', 'life', 'insights'];
  const budgets = f.budgets ?? [];
  if (!budgets.length) return watching('budget-pace', apps, ['money'], true, 'Your budgets', 'Set a monthly budget in Finance and it shows here.');
  const month = c.last.slice(0, 7);
  const dayNo = Number(c.last.slice(8, 10));
  const daysIn = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  if (dayNo < BUDGET_PACE_MIN_DAYS) return watching('budget-pace', apps, ['money'], true, 'Your budgets', needOr(c, BUDGET_PACE_MIN_DAYS - dayNo, `Give the month ${plural(BUDGET_PACE_MIN_DAYS - dayNo, 'more day')}.`));
  const spend = spendIndex(f);
  const gone = pct(dayNo, daysIn);
  // Over is the money itself, not the pace: a rupee past the budget is over, at any day of the month, and never reads as 100%.
  const rows = budgets
    .map((b) => {
      const spent = spend.of(month, b.category);
      const over = spent > b.monthlyCents;
      return { b, over, used: over ? Math.max(101, pct(spent, b.monthlyCents)) : pct(spent, b.monthlyCents) };
    })
    .sort((a, b) => b.used - a.used || (a.b.category < b.b.category ? -1 : 1));
  const top = rows[0]!;
  const ahead = top.used - gone;
  const whole = dayNo === daysIn;
  const words = win ? ` ${c.span.eight}` : '';
  const text = top.over
    ? whole
      ? `${top.b.category} ran over its budget, at ${top.used}%${words}.`
      : `${top.b.category} has run over its budget, at ${top.used}%, with ${gone}% of the month gone.`
    : ahead >= 10
      ? `${top.b.category} is at ${top.used}% of its budget with ${gone}% of the month gone.`
      : whole
        ? `Your budgets held${words}: the fullest was ${top.b.category} at ${top.used}%.`
        : `Your budgets are on pace: the fullest is ${top.b.category} at ${top.used}%, with ${gone}% of the month gone.`;
  return {
    key: 'budget-pace',
    id: 'budget-pace',
    state: 'ready',
    apps,
    reads: ['money'],
    private: true,
    relationship: null,
    headline: `${top.used}% vs ${gone}%`,
    text,
    basis: win ? `From the month's spending so far${words}, in ${f.currency}.` : `From this month's spending so far, in ${f.currency}.`,
    chart: {
      kind: 'pair',
      rows: [
        { label: `${top.b.category} budget used`, value: top.used, n: dayNo, unit: '%' },
        { label: 'The month gone', value: gone, n: dayNo, unit: '%' },
      ],
    },
    action: budgetAction,
    need: null,
    strength: top.over || ahead >= 10 ? Math.min(80, 45 + Math.round(Math.max(0, ahead - 10) / 2)) : 20,
  };
}

/** The fewest ticked tasks put in one block, over BLOCK_KEPT_DAYS, before the block line says anything. */
export const BLOCK_KEPT_MIN = 10;
export const BLOCK_KEPT_DAYS = 56;

/**
 * Time blocks kept (docs/time-blocks.md): of the tasks the person put in a block and ticked in the last eight weeks, how many were ticked
 * inside one of that block's slots on that day (the day's template as it is now: a date change, the weekly pattern, else the default).
 * Counts only; it never says why. Absent facts give nothing, so an account without blocks sees no line.
 */
function blockKept(c: Ctx): Insight | null {
  const tb = c.f.timeBlocks;
  if (!tb) return null;
  const apps: InsightApp[] = ['today', 'insights'];
  const from = c.f.window ? c.f.window.start : addDays(c.f.today, -(BLOCK_KEPT_DAYS - 1));
  const ids = new Set(tb.templates.map((t) => t.id));
  const known = new Map(tb.blocks.map((b) => [b.id, b]));
  const counts = new Map<string, { total: number; inside: number }>();
  for (const x of c.stamped) {
    const blockId = x.t.timeBlockId;
    if (!blockId || !x.at || x.at.day < from || x.at.day > c.last || !known.has(blockId)) continue;
    const { templateId } = templateForDate(x.at.day, { overrides: tb.overrides, pattern: tb.pattern, defaultId: tb.defaultId, exists: (id) => ids.has(id) });
    const slots = tb.templates.find((t) => t.id === templateId)?.slots ?? [];
    const minute = x.at.minutes;
    const inside = slots.some((sl) => sl.blockId === blockId && slotContains(sl, minute));
    const cur = counts.get(blockId) ?? { total: 0, inside: 0 };
    cur.total += 1;
    if (inside) cur.inside += 1;
    counts.set(blockId, cur);
  }
  if (counts.size === 0) return null;
  const ranked = [...counts.entries()].sort((a, b) => b[1].total - a[1].total || (known.get(a[0])!.name < known.get(b[0])!.name ? -1 : 1));
  const [blockId, n] = ranked[0]!;
  const name = known.get(blockId)!.name;
  if (n.total < BLOCK_KEPT_MIN) return watching('block-kept', apps, ['tasks', 'timeBlocks'], false, 'Time blocks', needOr(c, BLOCK_KEPT_MIN - n.total, `Tick ${plural(BLOCK_KEPT_MIN - n.total, 'more task')} you put in ${name}.`));
  const share = pct(n.inside, n.total);
  return {
    key: 'block-kept',
    id: 'block-kept',
    state: 'ready',
    apps,
    reads: ['tasks', 'timeBlocks'],
    private: false,
    relationship: known.get(blockId)!.pillar,
    headline: `${formatCount(n.inside)} of ${formatCount(n.total)}`,
    text: `You ticked ${formatCount(n.inside)} of ${formatCount(n.total)} ${name} tasks inside the block.`,
    basis: `Tasks you put in ${name}, ticked ${c.f.window ? c.span.eight : 'in the last 8 weeks'}. ${INSIGHT_BASIS_TAIL}`,
    chart: { kind: 'pair', rows: [{ label: 'Inside the block', value: n.inside, n: n.inside, unit: 'tasks' }, { label: 'At other times', value: n.total - n.inside, n: n.total - n.inside, unit: 'tasks' }] },
    action: { label: 'Open time blocks', to: '/time-blocks', kind: 'link' },
    need: null,
    strength: share >= 60 ? Math.min(70, 30 + Math.round(share / 3)) : 20,
  };
}

/**
 * The one rule: every signal whose apps are on, from the person's own facts. Ready ones by strength, then the ones still
 * watching in a fixed order. Pure: the same facts give the same answer.
 */
export function insightsFor(f: InsightFacts): Insight[] {
  return computeInsights(f, f.rel ? [f.rel] : []);
}

/**
 * Everything at once (2026-11-05), for the one GET /insights every place shares: the whole list with each of the seven pillars'
 * own balance line, so a pillar page needs no request of its own. Each place picks its share with `insightsForPlace`.
 */
export function insightsForEvery(f: InsightFacts): Insight[] {
  return computeInsights({ ...f, rel: null }, RELATIONSHIPS.map((r) => r.key));
}

function computeInsights(f: InsightFacts, pillarRels: readonly RelationshipKey[]): Insight[] {
  const apps = new Set(f.apps);
  const on = (k: string) => apps.has(k);
  const win = f.window ?? null;
  const dayBefore = addDays(f.today, -1);
  // With a period picked (2026-11-07) every signal reads its days; the minimum days each one needs stay as they are.
  const yesterday = win && win.end < dayBefore ? win.end : dayBefore;
  const last = win && win.end < f.today ? win.end : f.today;
  const pairFrom = win ? win.start : addDays(f.today, -PAIR_WINDOW_DAYS);
  const span = spanOf(win, f.today);
  // Each tick is read in the person's zone and keyed once, here, for every signal below.
  const stamped: StampedTick[] = f.done.map((t) => ({ t, at: localStamp(t.completedAt, f.zone), key: taskKey(t.title) }));
  const ticks = stamped.flatMap((x) => (x.at ? [{ day: x.at.day, minutes: x.at.minutes, relationship: x.t.relationship }] : []));
  const openCache = new Map<RelationshipKey, { o: InsightOpenTaskFact; k: KeyWords }[]>();
  const openByRel = (rel: RelationshipKey) => {
    const hit = openCache.get(rel);
    if (hit) return hit;
    const list = f.open.filter((o) => o.relationship === rel).map((o) => ({ o, k: keyWordsOf(taskKey(o.title)) }));
    openCache.set(rel, list);
    return list;
  };
  const ticksByDay = new Map<string, number>();
  for (const t of ticks) ticksByDay.set(t.day, (ticksByDay.get(t.day) ?? 0) + 1);
  const wbCache = new Map<string, Map<string, number>>();
  const wb = (kind: string) => {
    const hit = wbCache.get(kind);
    if (hit) return hit;
    const sums = new Map<string, { s: number; n: number }>();
    for (const r of f.wellbeing) {
      if (r.kind !== kind || !Number.isFinite(r.value)) continue;
      const cur = sums.get(r.date) ?? { s: 0, n: 0 };
      cur.s += r.value;
      cur.n += 1;
      sums.set(r.date, cur);
    }
    // Minutes add up over a day; a score (mood, sleep, stress) is the day's average.
    const add = kind === 'mindful' || kind === 'move';
    const out = new Map([...sums.entries()].map(([d, v]) => [d, add ? v.s : v.s / v.n]));
    wbCache.set(kind, out);
    return out;
  };
  const activeDays = new Set<string>([
    ...ticksByDay.keys(),
    ...f.checkins,
    ...f.wellbeing.map((w) => w.date),
    ...f.focus.map((r) => r.day),
    ...f.water.map((w) => w.day),
    ...f.notToDo.map((r) => r.day),
    ...f.routine.map((r) => r.day),
    ...f.dayTypes.map((r) => r.day),
  ]);
  const c: Ctx = { f, on, yesterday, last, pairFrom, span, ticks, ticksByDay, activeDays, wb, stamped, openByRel };
  // A task that is a good or bad habit is said once, on that card (which offers Make it a habit when it fits).
  const ties = habitTies(c);
  const tiedTasks = ties.filter((t) => t.state === 'ready' && t.tie?.kind === 'task');
  const plainHabits = habits(c).filter((h) => !(h.state === 'ready' && h.habit && tiedTasks.some((t) => t.relationship === h.relationship && sameTask(t.tie!.key, h.id.split(':').slice(2).join(':')))));
  const stress = on('stress') ? stressCalm(c) : null;
  const all: (Insight | null)[] = [
    ...plainHabits,
    ...ties,
    ...pillarBalance(c, pillarRels),
    bestHours(c),
    streakWeekday(c),
    on('sleep') && on('mood') ? sleepMood(c) : null,
    on('mindful') ? focusTasks(c) : null,
    stress,
    daytypeDone(c),
    blockKept(c),
    on('finance') && on('stress') ? moneyStress(c) : null,
    on('sleep') ? slipsSleep(c) : null,
    routineTasks(c),
    on('journal') && on('mood') ? journalMood(c) : null,
    on('journal') && on('mood') ? gratitudeMood(c) : null,
    moveOn(c) ? moveWeekday(c) : null,
    on('fitness') && (on('mood') || on('stress') || on('sleep')) ? eatDays(c) : null,
    // Since your last review is about the days after that review, so it shows only with no period picked.
    on('reviews') && !win ? reviewSince(c) : null,
    on('discover') ? discoverStrength(c) : null,
    on('agency') ? agencyLoad(c) : null,
    // A stress card already about water days keeps stress out of the water card, so one fact is never said twice.
    waterDays(c, stress?.action?.to === '/today#water'),
    waterWeekday(c),
    on('finance') ? budgetOver(c) : null,
    on('finance') ? budgetPace(c) : null,
  ];
  const list = all.filter((x): x is Insight => x !== null);
  const ready = list.filter((i) => i.state === 'ready').sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1));
  const wait = list.filter((i) => i.state === 'watching').sort((a, b) => KEY_ORDER.indexOf(a.key) - KEY_ORDER.indexOf(b.key));
  return [...ready, ...wait];
}
