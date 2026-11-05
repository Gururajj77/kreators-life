// Golden fact sets for Emerging (2026-11-05): deterministic synthetic people, light and heavy, used by insights.golden.test.ts to pin
// the whole output of `insightsFor` and `insightsForApp`, and by the CPU benchmark. Not in the barrel; test and bench only.

import { RELATIONSHIPS, type RelationshipKey } from './core.ts';
import { addDays, zonedToUtc } from './dates.ts';
import type { InsightFacts, InsightOpenTaskFact, InsightTaskFact } from './insights.ts';
import type { PeriodNumbers } from './periods.ts';

/** mulberry32: a small seeded generator, so the same seed gives the same person every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RELS: RelationshipKey[] = RELATIONSHIPS.map((r) => r.key);
const WORDS = ['edit', 'vlog', 'intro', 'gym', 'session', 'call', 'mom', 'read', 'chapter', 'write', 'script', 'plan', 'shoot', 'reel', 'client', 'invoice', 'walk', 'evening', 'journal', 'meditate', 'review', 'draft', 'email', 'brand', 'thumbnail', 'podcast', 'record', 'upload', 'study', 'lesson'];
const RECURRING = ['Edit vlog intro', 'Gym session', 'Call mom', 'Read a chapter', 'Write the script', 'Plan the week', 'Shoot reel', 'Client invoice', 'Review draft', 'Email brand', 'Record podcast', 'Study lesson'];

export interface GoldenOptions {
  seed: number;
  today: string;
  zone: string;
  days: number;
  perDay: number;
  /** Share of ticks with a title of their own (the rest come back). */
  unique: number;
  open: number;
  apps: string[];
  focusPillars?: RelationshipKey[];
  rich: boolean;
}

const BASE_NUMBERS: PeriodNumbers = { days: 7, checkins: 5, tasksDone: 40, smallActs: 0, xp: 300, activeDays: 6, notToDoKept: 5, notToDoSlipped: 2, moodAvg: 3.4, sleepAvg: 6.6, stressAvg: 2.8, mindfulMin: 60, moveMin: 90, journalEntries: 3, journalMoodAvg: null, incomeCents: 0, expenseCents: 450000, orders: 0, salesCents: 0, salesPoints: 0, lessonsDone: 0, programsDone: 0, applications: 0, decisions: 0, events: 0, posts: 0, circles: 0, runs: 0, runMetres: 0 };

export function goldenFacts(o: GoldenOptions): InsightFacts {
  const r = rng(o.seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const at = (day: string, minutes: number) => zonedToUtc(day, minutes, o.zone).toISOString();
  const done: InsightTaskFact[] = [];
  const wellbeing: InsightFacts['wellbeing'] = [];
  const focus: InsightFacts['focus'] = [];
  const notToDoMarks: InsightFacts['notToDoMarks'] = [];
  const notToDo: InsightFacts['notToDo'] = [];
  const water: InsightFacts['water'] = [];
  const dayTypes: InsightFacts['dayTypes'] = [];
  const routine: InsightFacts['routine'] = [];
  const journalAt: string[] = [];
  const expenses: InsightFacts['expenses'] = [];
  const checkins: string[] = [];
  const agencyDue: string[] = [];
  let id = 0;
  const ntdItems = o.rich
    ? [
        { id: 'ntd1', title: 'Doomscroll after 11 pm', relationship: 'self' as RelationshipKey },
        { id: 'ntd2', title: 'Skip breakfast', relationship: null },
        { id: 'ntd3', title: 'Late coffee', relationship: 'self' as RelationshipKey },
      ]
    : [];
  for (let i = 0; i < o.days; i += 1) {
    const day = addDays(o.today, -i);
    // A good day lifts mood, sleep and calm; the person walks on good days and snacks late on bad ones.
    const good = r() < 0.5;
    const n = o.perDay + Math.floor(r() * 3) - 1;
    for (let k = 0; k < n; k += 1) {
      const uniq = r() < o.unique;
      const title = uniq ? `${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)} ${id}` : RECURRING[k % RECURRING.length]!;
      const minutes = (6 + (k % 15)) * 60 + Math.floor(r() * 50);
      const rel = RELS[k % 7]!;
      const repeats = !uniq && k % 5 === 0;
      const habit = !uniq && k % 11 === 3 ? true : !uniq && k % 13 === 7 ? false : null;
      done.push({ id: `n${id}`, title, relationship: rel, parentId: `p${k % 7}`, completedAt: at(day, minutes), repeats, habit });
      id += 1;
    }
    if (good && r() < 0.85) {
      done.push({ id: `n${id}`, title: 'Evening walk', relationship: 'self', parentId: 'p4', completedAt: at(day, 19 * 60 + Math.floor(r() * 40)), repeats: false, habit: null });
      id += 1;
    }
    if (!good && r() < 0.7) {
      done.push({ id: `n${id}`, title: 'Late night snack run', relationship: 'friendship', parentId: 'p1', completedAt: at(day, 23 * 60 + Math.floor(r() * 30)), repeats: false, habit: false });
      id += 1;
    }
    if (i === 0) continue;
    checkins.push(day);
    if (o.apps.includes('mood') && r() < 0.9) wellbeing.push({ kind: 'mood', date: day, value: good ? 4 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2) });
    if (o.apps.includes('sleep') && r() < 0.85) wellbeing.push({ kind: 'sleep', date: day, value: Math.round((good ? 7 : 5.5) * 10 + r() * 15) / 10 });
    if (o.apps.includes('stress') && r() < 0.8) wellbeing.push({ kind: 'stress', date: day, value: good ? 1 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3) });
    if (o.apps.includes('mindful') && r() < 0.6) wellbeing.push({ kind: 'mindful', date: day, value: 5 + Math.floor(r() * 20) });
    if (o.apps.includes('mindful')) focus.push({ day, minutes: good ? 50 + Math.floor(r() * 40) : Math.floor(r() * 25) });
    if (!o.rich) continue;
    let slipped = 0;
    let kept = 0;
    for (const item of ntdItems) {
      if (r() < 0.15) continue;
      const slip = item.id === 'ntd1' ? !good && r() < 0.8 : r() < 0.2;
      notToDoMarks.push({ itemId: item.id, day, status: slip ? 'slipped' : 'kept' });
      if (slip) slipped += 1;
      else kept += 1;
    }
    if (slipped + kept) notToDo.push({ day, slipped, kept });
    water.push({ day, ml: Math.floor(r() * 3000) });
    if (r() < 0.6) dayTypes.push({ day, kind: pick(['deep', 'admin', 'rest', 'make']) });
    if (r() < 0.7) routine.push({ day, done: good || r() < 0.3 });
    if (o.apps.includes('journal') && (good ? r() < 0.7 : r() < 0.2)) journalAt.push(at(day, 21 * 60 + Math.floor(r() * 60)));
    if (o.apps.includes('finance') && r() < 0.8) expenses.push({ date: day, cents: (good ? 20000 : 90000) + Math.floor(r() * 50000) });
    if (o.apps.includes('agency') && r() < 0.35) agencyDue.push(day);
  }
  const open: InsightOpenTaskFact[] = Array.from({ length: o.open }, (_, i) => {
    const recurring = i < 24;
    return {
      id: `o${i}`,
      title: recurring ? RECURRING[i % RECURRING.length]! : `${WORDS[i % 30]} ${WORDS[(i * 7) % 30]} task ${i}`,
      relationship: RELS[i % 7]!,
      parentId: `p${i % 7}`,
      repeats: i % 9 === 0,
      habit: i % 17 === 5 ? true : null,
      openDay: i % 3 ? addDays(o.today, (i % 20) - 10) : null,
    };
  });
  const ticks30 = new Map<RelationshipKey, number>();
  const from30 = addDays(o.today, -29);
  for (const t of done) if (t.completedAt >= at(from30, 0)) ticks30.set(t.relationship, (ticks30.get(t.relationship) ?? 0) + 1);
  return {
    today: o.today,
    zone: o.zone,
    currency: 'INR',
    apps: o.apps,
    rel: null,
    done,
    open,
    projects: RELS.map((rel, i) => ({ id: `p${i}`, relationship: rel })),
    xp30: RELS.map((rel, i) => ({ relationship: rel, xp: i === 6 ? 0 : 40 * (i + 1) + (ticks30.get(rel) ?? 0) * 5, ticks: ticks30.get(rel) ?? 0 })),
    focusPillars: o.focusPillars ?? [],
    checkins,
    firstCheckin: addDays(o.today, -400),
    wellbeing,
    focus,
    notToDo,
    notToDoItems: ntdItems,
    notToDoMarks,
    water,
    waterGoal: o.rich ? 2000 : null,
    dayTypes,
    routine,
    journalAt,
    expenses,
    review: o.rich && o.apps.includes('reviews') ? { kind: 'week', start: addDays(o.today, -16), end: addDays(o.today, -10), then: BASE_NUMBERS, since: { ...BASE_NUMBERS, tasksDone: 62, sleepAvg: 6.1, moodAvg: 3.9 }, sinceStart: addDays(o.today, -9), sinceEnd: addDays(o.today, -3), ended: true } : null,
    discover: o.rich && o.apps.includes('discover') ? { growth: 'parent_child', steps: true } : null,
    agencyDue,
  };
}

const EVERY_APP = ['home', 'today', 'tower', 'life', 'wellbeing', 'mood', 'sleep', 'stress', 'mindful', 'journal', 'finance', 'reviews', 'discover', 'agency'];

export const GOLDEN_CASES: Record<string, GoldenOptions> = {
  light: { seed: 11, today: '2026-11-05', zone: 'Asia/Kolkata', days: 60, perDay: 5, unique: 0.3, open: 60, apps: ['home', 'today', 'tower', 'mood', 'sleep'], rich: false },
  heavy: { seed: 23, today: '2026-11-05', zone: 'Asia/Kolkata', days: 84, perDay: 20, unique: 0.25, open: 300, apps: EVERY_APP, rich: true },
  // Across the clocks going back (1 November 2026 in New York), with focus pillars and most titles their own.
  zoned: { seed: 37, today: '2026-11-05', zone: 'America/New_York', days: 84, perDay: 14, unique: 0.6, open: 1000, apps: EVERY_APP.filter((a) => a !== 'finance'), focusPillars: ['parent_child', 'divine'], rich: true },
};
