// ---------------------------------------------------------------------------
// "Your life, this week" (2026-11-07, the founder: "dashboards data that is useful and helpful to track and grow in life in all
// areas/pillars"): one period's numbers on Emerging, first the five areas of life, then the seven pillars. Each card is the number, the
// change against the period before, a small chart and one link to where that data lives. Rules only, computed on read, nothing stored, owner
// only. A part shows only while its app is on. Journal and gratitude are counts, wellbeing is numbers, money is the person's own currency.
//
// A subpath export read only by the API and the tests (the web app imports its types and nothing else), so its words never reach the first
// download. It may import the rest of shared, since nothing in the barrel imports it.
// ---------------------------------------------------------------------------

import { formatCount, RELATIONSHIPS } from './core.ts';
import type { RelationshipKey } from './core.ts';
import { addDays, daysBetween, isoWeekday } from './dates.ts';
import { LIFE_AREA_ORDER } from './life.ts';
import type { LifeAreaKey } from './life.ts';
import { money } from './money.ts';
import { KIND_META } from './pillars.ts';
import { PERIOD_META, periodLabel } from './periods.ts';
import type { Period, PeriodNumbers, ReviewLayer } from './periods.ts';

export interface DashChange {
  /** "up 0.4 h", "down ₹1,200", "same". */
  word: string;
  /** `good` the good way, `warm` the other way where the way is clear, `neutral` where it is not for us to judge. */
  tone: 'good' | 'warm' | 'neutral';
}
export interface DashChart {
  shape: 'bars' | 'line' | 'ring';
  /** One point for each day or group of days, oldest first; null for a day still to come, or an average with nothing logged. A ring has one share, 0 to 1. */
  values: (number | null)[];
  max: number;
  /** A letter per day for a short row of bars; empty otherwise. */
  labels: string[];
  /** What the chart shows, said aloud. */
  label: string;
}
export interface DashCard {
  key: string;
  label: string;
  /** The number, in words ("7.2 h"); "–" when nothing was logged. */
  value: string;
  note: string | null;
  change: DashChange | null;
  chart: DashChart | null;
  /** Where that data lives. */
  to: string;
}
export interface DashArea {
  key: LifeAreaKey;
  cards: DashCard[];
  /** One small line under the cards (money in other currencies, left out). */
  note: string | null;
}
export interface DashPillar extends DashCard {
  relationship: RelationshipKey;
}
export interface LifeDashboard {
  /** The person's own day. */
  day: string;
  /** The period picked, or null for the rolling eight weeks. */
  period: Period | null;
  /** "this week", "that month", "today", "the last 8 weeks". */
  heading: string;
  /** "2 to 8 Nov 2026". */
  label: string;
  /** "Each one next to the week before." */
  compare: string;
  currency: string;
  areas: DashArea[];
  pillars: DashPillar[];
}

/** What the route reads for the small charts, by day, from the first day charted to the period's end. Numbers and days only. */
export interface DashReads {
  wellbeing: { kind: string; date: string; total: number; n: number }[];
  /** Mindful minutes outside focus sessions (no focus round holds the log), and their total in the period before. */
  stillness: { date: string; minutes: number }[];
  stillnessBefore: number;
  water: { day: string; ml: number }[];
  focus: { day: string; minutes: number }[];
  money: { date: string; kind: string; cents: number }[];
  /** Other currencies with money in the period: named, never added in. */
  otherCurrencies: string[];
  journal: { day: string; n: number }[];
  gratitude: string[];
  routine: string[];
  acts: string[];
  xp: { relationship: RelationshipKey; day: string; xp: number }[];
  ticks: { relationship: RelationshipKey; day: string; n: number }[];
  xpBefore: { relationship: RelationshipKey; xp: number }[];
}
export interface DashInput {
  /** The period picked, or null for the rolling eight weeks. */
  picked: Period | null;
  /** The days the numbers cover. */
  span: { start: string; end: string };
  today: string;
  currency: string;
  on: (key: string) => boolean;
  now: PeriodNumbers;
  before: PeriodNumbers;
  layer: ReviewLayer;
  reads: DashReads;
}

/** With no period picked the page covers the last eight weeks, set beside the eight before. */
export const DASH_ROLLING_DAYS = 56;
const SLEEP_MID = 7.5;
const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The first day charted: a day's report draws the week up to it, every other period its own days. */
export const dashChartStart = (p: { kind?: Period['kind']; start: string }): string => (p.kind === 'day' ? addDays(p.start, -6) : p.start);

function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Up to a month, day by day; up to about half a year, by week; longer, by calendar month. So a small chart never holds a year of points. */
function groupsOf(from: string, to: string): string[][] {
  const days = dayRange(from, to);
  if (days.length <= 31) return days.map((d) => [d]);
  if (days.length <= 200) {
    const out: string[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }
  const byMonth = new Map<string, string[]>();
  for (const d of days) byMonth.set(d.slice(0, 7), [...(byMonth.get(d.slice(0, 7)) ?? []), d]);
  return [...byMonth.values()];
}

const plural = (n: number, word: string, many = `${word}s`) => `${formatCount(n)} ${n === 1 ? word : many}`;
const one = (v: number) => v.toFixed(1);

/** How a number moved. Nothing to set it beside, or nothing either side: no change is said. */
function changeOf(now: number | null | undefined, before: number | null | undefined, fmt: (abs: number) => string, better: 1 | -1 | 0): DashChange | null {
  if (now === null || now === undefined || before === null || before === undefined) return null;
  if (now === 0 && before === 0) return null;
  const d = now - before;
  const text = fmt(Math.abs(d));
  if (text === fmt(0)) return { word: 'same', tone: 'neutral' };
  return { word: `${d > 0 ? 'up' : 'down'} ${text}`, tone: better === 0 ? 'neutral' : Math.sign(d) === better ? 'good' : 'warm' };
}

/** The one builder. Pure: the same reads give the same dashboard, and an app that is off leaves nothing behind. */
export function lifeDashboardFrom(i: DashInput): LifeDashboard {
  const { picked, span, today, currency, on, now, before, reads, layer } = i;
  const chartFrom = picked ? dashChartStart(picked) : span.start;
  const groups = groupsOf(chartFrom, span.end);
  const daily = groups.every((g) => g.length === 1);
  const seen = (span.end < today ? span.end : today) >= span.start ? daysBetween(span.start, span.end < today ? span.end : today) + 1 : 0;
  const letters = daily && groups.length <= 8 ? groups.map((g) => WEEK_LETTERS[isoWeekday(g[0]!) - 1] ?? '') : [];
  const unit = daily ? 'day' : groups[0]!.length === 7 ? 'week' : 'month';
  // A day's report says done or not, never "1 of 1 day"; a thing done or not has no change to say.
  const oneDay = picked?.kind === 'day';

  /** A count or a sum for each point; 0 on a day that has passed, null on one still to come. */
  const sums = (by: ReadonlyMap<string, number>): (number | null)[] =>
    groups.map((g) => {
      const past = g.filter((d) => d <= today);
      return past.length ? past.reduce((s, d) => s + (by.get(d) ?? 0), 0) : null;
    });
  /** An average for each point, of the days logged. */
  const avgs = (kind: string): (number | null)[] => {
    const by = new Map(reads.wellbeing.filter((w) => w.kind === kind).map((w) => [w.date, w]));
    return groups.map((g) => {
      let total = 0;
      let n = 0;
      for (const d of g) {
        const w = by.get(d);
        if (w && w.n > 0) {
          total += w.total;
          n += w.n;
        }
      }
      return n ? Math.round((total / n) * 10) / 10 : null;
    });
  };
  const logged = (kind: string): Map<string, number> => new Map(reads.wellbeing.filter((w) => w.kind === kind).map((w) => [w.date, w.total]));
  const mapOf = <T>(rows: readonly T[], day: (r: T) => string, v: (r: T) => number) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(day(r), (m.get(day(r)) ?? 0) + v(r));
    return m;
  };
  const days = (list: readonly string[]) => new Map(list.map((d) => [d, 1]));

  const bars = (label: string, values: (number | null)[]): DashChart => {
    const max = Math.max(1, ...values.map((v) => v ?? 0));
    return { shape: values.length <= 8 ? 'bars' : 'line', values, max, labels: letters, label: `${label} by ${unit}` };
  };
  const line = (label: string, values: (number | null)[], max: number): DashChart => ({ shape: 'line', values, max, labels: [], label: `${label} by ${unit}` });
  const ring = (label: string, share: number): DashChart => ({ shape: 'ring', values: [Math.max(0, Math.min(1, share))], max: 1, labels: [], label });
  const onDays = (n: number) => `On ${formatCount(n)} of ${plural(seen, 'day')}`;
  const nothing = 'Nothing logged';
  const minutes = (v: number) => `${formatCount(Math.round(v))} min`;
  const countWord = (v: number) => formatCount(Math.round(v));
  const oneFmt = (suffix = '') => (v: number) => `${one(v)}${suffix}`;
  const whole = (cents: number) => money(Math.round(cents / 100) * 100, currency);
  const wholeFmt = (cents: number) => whole(cents);

  const area: Record<LifeAreaKey, DashCard[]> = { physical: [], financial: [], mental: [], emotional: [], spiritual: [] };
  const notes: Partial<Record<LifeAreaKey, string>> = {};

  // ---- physical: sleep, movement, eating, water -----------------------------------------------------------------------------------------
  if (on('sleep')) {
    // Moving toward seven or eight hours reads as the good way; away from it is not ours to judge.
    const c = changeOf(now.sleepAvg, before.sleepAvg, oneFmt(' h'), 0);
    const closer = now.sleepAvg !== null && before.sleepAvg !== null && Math.abs(now.sleepAvg - SLEEP_MID) < Math.abs(before.sleepAvg - SLEEP_MID);
    area.physical.push({
      key: 'sleep',
      label: 'Sleep',
      value: now.sleepAvg === null ? '–' : `${one(now.sleepAvg)} h`,
      note: now.sleepAvg === null ? nothing : 'A night, on average',
      change: c && c.word !== 'same' && closer ? { ...c, tone: 'good' } : c,
      chart: line('Sleep', avgs('sleep'), 10),
      to: '/sleep',
    });
  }
  if (on('fitness') || on('run')) {
    area.physical.push({
      key: 'move',
      label: 'Movement',
      value: minutes(now.moveMin),
      note: oneDay ? (now.moveMin > 0 ? 'Logged' : nothing) : onDays(now.moveDays ?? 0),
      change: changeOf(now.moveMin, before.moveMin, minutes, 1),
      chart: bars('Movement', sums(logged('move'))),
      to: on('fitness') ? '/fitness#move-heading' : '/run?tab=tracking',
    });
  }
  if (on('fitness')) {
    const eat = now.eatAvg ?? null;
    area.physical.push({
      key: 'eat',
      label: 'Eating',
      value: eat === null ? '–' : `${one(eat)} of 5`,
      // A check-in with no fruit or veg said has no score, so "nothing logged" would not be true of it.
      note: eat === null ? 'No score yet' : 'How well you ate',
      change: changeOf(eat, before.eatAvg ?? null, oneFmt(), 1),
      chart: line('Eating', avgs('eat'), 5),
      to: '/fitness#eat-heading',
    });
  }
  const waterAvg = now.waterAvgMl ?? null;
  area.physical.push({
    key: 'water',
    label: 'Water',
    value: waterAvg === null ? '–' : `${formatCount(waterAvg)} ml`,
    note: waterAvg === null ? nothing : oneDay ? ((now.waterGoalDays ?? 0) > 0 ? 'Goal met' : 'Under your goal') : `Goal met on ${formatCount(now.waterGoalDays ?? 0)} of ${plural(seen, 'day')}`,
    change: changeOf(waterAvg, before.waterAvgMl ?? null, (v) => `${formatCount(Math.round(v))} ml`, 1),
    chart: bars('Water', sums(mapOf(reads.water, (r) => r.day, (r) => r.ml))),
    to: '/home#water',
  });

  // ---- financial: money in and out, budgets, savings goals, in the person's own currency only --------------------------------------------
  if (on('finance')) {
    const spendBy = (kind: string) => mapOf(reads.money.filter((m) => m.kind === kind), (r) => r.date, (r) => Math.round(r.cents / 100));
    area.financial.push({ key: 'income', label: 'Money in', value: whole(now.incomeCents), note: null, change: changeOf(now.incomeCents, before.incomeCents, wholeFmt, 1), chart: bars('Money in', sums(spendBy('income'))), to: '/finance' });
    // More or less spending is not ours to judge, so its change wears no colour.
    area.financial.push({ key: 'expense', label: 'Money out', value: whole(now.expenseCents), note: null, change: changeOf(now.expenseCents, before.expenseCents, wholeFmt, 0), chart: bars('Money out', sums(spendBy('expense'))), to: '/finance' });
    const checks = now.budgetChecks ?? 0;
    if (checks > 0) {
      const over = now.budgetsOver ?? 0;
      // The same number of checks each side, or the counts are not like with like.
      const sameChecks = (before.budgetChecks ?? 0) === checks;
      const oneMonth = span.start.slice(0, 7) === span.end.slice(0, 7);
      area.financial.push({
        key: 'budgets',
        label: 'Budgets over',
        value: formatCount(over),
        note: oneMonth ? `Of ${plural(checks, 'budget')}` : `Of ${formatCount(checks)} monthly checks`,
        change: sameChecks ? changeOf(over, before.budgetsOver ?? 0, countWord, -1) : null,
        chart: ring(`${formatCount(checks - over)} of ${formatCount(checks)} budgets held`, (checks - over) / checks),
        to: '/finance#budgets-heading',
      });
    }
    if ((now.goalsCount ?? 0) > 0) {
      const saved = now.goalSavedCents ?? 0;
      const target = now.goalTargetCents ?? 0;
      area.financial.push({
        key: 'savings',
        label: 'Savings goals',
        value: whole(saved),
        note: `Of ${whole(target)}`,
        // The app keeps no dated record of each amount put in, so there is no change to say.
        change: null,
        chart: ring(`${whole(saved)} of ${whole(target)} saved`, target > 0 ? saved / target : 0),
        to: '/finance#goals-heading',
      });
    }
    if (reads.otherCurrencies.length) notes.financial = `Money in ${reads.otherCurrencies.join(', ')} is left out, never converted.`;
  }

  // ---- mental: focus, stress, mindful minutes -----------------------------------------------------------------------------------------
  if (on('mindful')) {
    const min = now.focusMin ?? 0;
    const quality = now.focusQualityAvg ?? null;
    area.mental.push({
      key: 'focus',
      label: 'Focus',
      value: minutes(min),
      note: quality !== null ? `Quality ${one(quality)} of 5` : plural(now.focusSessions ?? 0, 'session'),
      change: changeOf(min, before.focusMin ?? 0, minutes, 1),
      chart: bars('Focus', sums(mapOf(reads.focus, (r) => r.day, (r) => r.minutes))),
      to: '/mindful',
    });
  }
  if (on('stress')) {
    area.mental.push({
      key: 'stress',
      label: 'Stress',
      value: now.stressAvg === null ? '–' : `${one(now.stressAvg)} of 5`,
      note: now.stressAvg === null ? nothing : 'Lower is calmer',
      change: changeOf(now.stressAvg, before.stressAvg, oneFmt(), -1),
      chart: line('Stress', avgs('stress'), 5),
      to: '/stress',
    });
  }
  if (on('mindful')) {
    area.mental.push({ key: 'mindful', label: 'Mindful minutes', value: minutes(now.mindfulMin), note: 'Breath and focus together', change: changeOf(now.mindfulMin, before.mindfulMin, minutes, 1), chart: bars('Mindful minutes', sums(logged('mindful'))), to: '/mindful' });
  }

  // ---- emotional: mood, and the journal and gratitude as counts only ---------------------------------------------------------------------
  if (on('mood')) {
    area.emotional.push({
      key: 'mood',
      label: 'Mood',
      value: now.moodAvg === null ? '–' : `${one(now.moodAvg)} of 5`,
      note: now.moodAvg === null ? nothing : 'On average',
      change: changeOf(now.moodAvg, before.moodAvg, oneFmt(), 1),
      chart: line('Mood', avgs('mood'), 5),
      to: '/mood',
    });
  }
  if (on('journal')) {
    // How much a person writes is not ours to judge.
    area.emotional.push({ key: 'journal', label: 'Journal', value: formatCount(now.journalEntries), note: now.journalEntries === 1 ? 'Entry' : 'Entries', change: changeOf(now.journalEntries, before.journalEntries, countWord, 0), chart: bars('Journal entries', sums(mapOf(reads.journal, (r) => r.day, (r) => r.n))), to: '/journal' });
    area.emotional.push({ key: 'gratitude', label: 'Gratitude', value: oneDay ? ((now.gratitudeDays ?? 0) > 0 ? 'Written' : '–') : formatCount(now.gratitudeDays ?? 0), note: oneDay ? ((now.gratitudeDays ?? 0) > 0 ? null : 'Not written') : `Of ${plural(seen, 'day')}`, change: oneDay ? null : changeOf(now.gratitudeDays ?? 0, before.gratitudeDays ?? 0, countWord, 1), chart: bars('Gratitude days', sums(days(reads.gratitude))), to: '/journal#gratitude-heading' });
  }

  // ---- spiritual: breath and stillness, small acts, the routine ---------------------------------------------------------------------------
  if (on('mindful')) {
    const still = mapOf(reads.stillness, (r) => r.date, (r) => r.minutes);
    const stillNow = dayRange(span.start, span.end).reduce((s, d) => s + (still.get(d) ?? 0), 0);
    area.spiritual.push({ key: 'still', label: 'Breath and stillness', value: minutes(stillNow), note: 'Outside focus sessions', change: changeOf(stillNow, reads.stillnessBefore, minutes, 1), chart: bars('Breath and stillness', sums(still)), to: '/mindful' });
  }
  area.spiritual.push({ key: 'acts', label: 'Small act', value: oneDay ? (now.smallActs > 0 ? 'Done' : '–') : formatCount(now.smallActs), note: oneDay ? (now.smallActs > 0 ? null : 'Not done') : `Of ${plural(seen, 'day')}`, change: oneDay ? null : changeOf(now.smallActs, before.smallActs, countWord, 1), chart: bars('Small acts', sums(days(reads.acts))), to: '/today' });
  if ((now.routineDays ?? 0) > 0 || (before.routineDays ?? 0) > 0) {
    area.spiritual.push({ key: 'routine', label: 'Routine', value: oneDay ? ((now.routineDays ?? 0) > 0 ? 'Done' : '–') : formatCount(now.routineDays ?? 0), note: oneDay ? ((now.routineDays ?? 0) > 0 ? 'Every step ticked' : 'Not finished') : `Of ${plural(seen, 'day')}, every step ticked`, change: oneDay ? null : changeOf(now.routineDays ?? 0, before.routineDays ?? 0, countWord, 1), chart: bars('Routine', sums(days(reads.routine))), to: '/today#routine' });
  }

  // ---- the seven pillars, in their own order --------------------------------------------------------------------------------------------
  const layerWord = KIND_META[layer.kind];
  const pillars: DashPillar[] = RELATIONSHIPS.map((r) => {
    const xpBy = mapOf(reads.xp.filter((x) => x.relationship === r.key), (x) => x.day, (x) => x.xp);
    const tickBy = mapOf(reads.ticks.filter((x) => x.relationship === r.key), (x) => x.day, (x) => x.n);
    let xp = 0;
    let ticked = 0;
    for (const [d, v] of xpBy) if (d >= span.start && d <= span.end) xp += v;
    for (const [d, v] of tickBy) if (d >= span.start && d <= span.end) ticked += v;
    const total = layer.pillars.find((g) => g.relationship === r.key)?.total ?? 0;
    const walked = layer.kind === 'task' ? `${formatCount(Math.max(0, total - ticked))} still open` : plural(total, layerWord.label.toLowerCase(), layerWord.plural.toLowerCase());
    const beforeXp = reads.xpBefore.find((x) => x.relationship === r.key)?.xp ?? 0;
    return {
      key: r.key,
      relationship: r.key,
      label: r.name,
      value: `${formatCount(Math.max(0, xp))} xp`,
      note: `${plural(ticked, 'task')} ticked, ${walked}`,
      change: changeOf(Math.max(0, xp), Math.max(0, beforeXp), (v) => `${formatCount(Math.round(v))} xp`, 1),
      chart: bars(`${r.name} xp`, sums(xpBy)),
      to: `/realm/${r.key}`,
    };
  });

  const running = !picked || (picked.start <= today && today <= picked.end);
  const word = picked ? PERIOD_META[picked.kind].short.toLowerCase() : '';
  const heading = !picked ? 'the last 8 weeks' : picked.kind === 'day' ? (running ? 'today' : 'that day') : `${running ? 'this' : 'that'} ${word}`;
  const compare = !picked ? 'Each one next to the 8 weeks before.' : oneDay ? `Each one next to ${PERIOD_META[picked.kind].previous}. The small charts show the week up to it.` : running ? `Each one next to the same days of ${PERIOD_META[picked.kind].previous}.` : `Each one next to ${PERIOD_META[picked.kind].previous}.`;
  return {
    day: today,
    period: picked,
    heading,
    label: picked ? periodLabel(picked) : 'The last 8 weeks',
    compare,
    currency,
    areas: LIFE_AREA_ORDER.map((key) => ({ key, cards: area[key], note: notes[key] ?? null })).filter((a) => a.cards.length > 0),
    pillars,
  };
}
