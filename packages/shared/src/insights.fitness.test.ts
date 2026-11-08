import { describe, expect, it } from 'vitest';
import { eatDayScore, eatHowWell, type EatInput } from './fitness';
import { addDays, BRIEF_MOVE_WEEK, briefFor, CAUSE_WORDS, EAT_MIN_DAYS, INSIGHT_BASIS_TAIL, insightsForApp, isoWeekday, MOVE_WEEKDAY_MIN_DAYS, type BriefFacts, type Insight, type InsightFacts } from './index';
import { insightsFor } from './insights';

// Emerging across Fitness, Kreators Run and gratitude (2026-11-07): movement against how the days went (a good habit only), when the
// person moves, how they ate against mood, stress and sleep, and gratitude days against mood. Rules only, and never a cause.

const TODAY = '2026-11-04'; // a Wednesday
const BASE = ['home', 'today', 'tower', 'life', 'wellbeing', 'mood', 'sleep', 'stress', 'journal', 'reviews'];

function facts(over: Partial<InsightFacts> = {}): InsightFacts {
  return {
    today: TODAY,
    zone: 'Asia/Kolkata',
    currency: 'INR',
    apps: [...BASE, 'fitness'],
    rel: null,
    done: [],
    open: [],
    projects: [],
    xp30: [],
    focusPillars: [],
    checkins: [],
    firstCheckin: null,
    wellbeing: [],
    focus: [],
    notToDo: [],
    notToDoItems: [],
    notToDoMarks: [],
    water: [],
    waterGoal: null,
    dayTypes: [],
    routine: [],
    journalAt: [],
    gratitudeDays: [],
    expenses: [],
    review: null,
    discover: null,
    agencyDue: [],
    ...over,
  };
}
const ago = (n: number) => addDays(TODAY, -n);
const span = (n: number) => Array.from({ length: n }, (_, i) => ago(i + 1));
const byId = (list: Insight[], id: string) => list.find((i) => i.id === id);
const noCause = (list: Insight[]) => {
  for (const i of list) for (const w of CAUSE_WORDS) expect(`${i.text} ${i.need ?? ''}`.toLowerCase()).not.toContain(w);
};

/**
 * The eating check-in's value as the server writes it (2026-11-07): the day's answers through `eatDayScore` and the one map `eatHowWell`.
 * A full plate (five of fruit and veg, nothing packaged, no screens) is a day you ate well; a thin one is not.
 */
const plate = (good: boolean): EatInput => {
  const meals = (['breakfast', 'lunch', 'dinner'] as const).map((moment) => ({ moment, fuel: good, tasty: true }));
  return { meals, protein: null, fasting: false, fruit: good ? 2 : 0, veg: good ? 3 : 1, packaged: good ? 0 : 2, fullness: null, screenFree: good ? 3 : 0, note: '' };
};
const ATE_WELL = eatHowWell(eatDayScore(plate(true)));
const ATE_THIN = eatHowWell(eatDayScore(plate(false)));

/** Thirty days: every other day moved, ate well and wrote gratitude, with a better mood, lower stress and longer sleep that night. */
function goodDays(lift = true): InsightFacts['wellbeing'] {
  const out: InsightFacts['wellbeing'] = [];
  span(30).forEach((d, i) => {
    const good = i % 2 === 0;
    if (good) out.push({ kind: 'move', date: d, value: 30 });
    out.push({ kind: 'eat', date: d, value: good ? ATE_WELL : ATE_THIN });
    out.push({ kind: 'mood', date: d, value: good === lift ? 4 : 2 });
    out.push({ kind: 'stress', date: d, value: good === lift ? 1 : 4 });
    out.push({ kind: 'sleep', date: addDays(d, 1), value: good === lift ? 8 : 6 });
  });
  return out;
}

describe('Emerging with Fitness and gratitude', () => {
  it('moving is a good habit when the days with it went better, said as days that went together', () => {
    const list = insightsFor(facts({ wellbeing: goodDays() }));
    const move = byId(list, 'habit-tie:move')!;
    expect(move.state).toBe('ready');
    expect(move.tie).toMatchObject({ verdict: 'good', kind: 'move', title: 'Moving', relationship: 'self' });
    expect(move.text).toMatch(/^On days you moved, /);
    expect(move.basis.endsWith(INSIGHT_BASIS_TAIL)).toBe(true);
    expect(move.private).toBe(true);
    expect(move.apps).toEqual(expect.arrayContaining(['fitness', 'life', 'today', 'home']));
    expect(move.action).toEqual({ label: 'Log movement', to: '/fitness#move-heading', kind: 'link' });
    noCause(list);
  });

  it('a worse day after moving is never called a bad habit', () => {
    const move = byId(insightsFor(facts({ wellbeing: goodDays(false) })), 'habit-tie:move')!;
    expect(move.state).toBe('watching');
    expect(move.tie).toBeUndefined();
  });

  it('Kreators Run alone still reads movement, and points to its own tool', () => {
    const list = insightsFor(facts({ apps: [...BASE, 'run'], wellbeing: goodDays() }));
    expect(byId(list, 'habit-tie:move')!.action?.to).toBe('/run?tab=tracking');
    // The eating check-in is Fitness's own: with Fitness off it is never read.
    expect(byId(list, 'eat-days')).toBeUndefined();
  });

  it('with Fitness and Kreators Run off, no movement or eating line runs', () => {
    const list = insightsFor(facts({ apps: BASE, wellbeing: goodDays() }));
    for (const id of ['habit-tie:move', 'move-weekday', 'eat-days']) expect(byId(list, id)).toBeUndefined();
  });

  it('how you ate is set against the clearest of mood, stress and sleep that night', () => {
    const list = insightsFor(facts({ wellbeing: goodDays() }));
    const eat = byId(list, 'eat-days')!;
    expect(eat.state).toBe('ready');
    expect(eat.strength).toBeGreaterThan(0);
    expect(eat.text).toMatch(/^On days you said you ate well, /);
    expect(eat.relationship).toBe('self');
    expect(eat.chart?.kind).toBe('pair');
    expect(insightsForApp(list, 'fitness').map((i) => i.id)).toContain('eat-days');
    // The Yourself pillar page shows it too.
    expect(insightsForApp(list, 'pillar', 'self').length).toBeGreaterThan(0);
  });

  it('eating watches until enough check-ins are in', () => {
    const few = goodDays().filter((w) => w.kind !== 'eat' || w.date >= ago(EAT_MIN_DAYS - 2));
    const eat = byId(insightsFor(facts({ wellbeing: few })), 'eat-days')!;
    expect(eat.state).toBe('watching');
    expect(eat.need).toMatch(/eating check-in on \d+ more day/);
  });

  it('gratitude days are set against mood, from which days have it only', () => {
    const wb = goodDays();
    const gratitudeDays = span(30).filter((_, i) => i % 2 === 0);
    const g = byId(insightsFor(facts({ wellbeing: wb, gratitudeDays })), 'gratitude-mood')!;
    expect(g.state).toBe('ready');
    expect(g.text).toBe('On days you wrote your gratitude, your mood was 4.0 on average. On other days, 2.0.');
    expect(g.reads).toEqual(['gratitude', 'wellbeing']);
    expect(insightsForApp(insightsFor(facts({ wellbeing: wb, gratitudeDays })), 'journal').map((i) => i.id)).toContain('gratitude-mood');
    // Journal off: never read.
    expect(byId(insightsFor(facts({ apps: [...BASE.filter((a) => a !== 'journal'), 'fitness'], wellbeing: wb, gratitudeDays })), 'gratitude-mood')).toBeUndefined();
  });

  it('when you move: a weekday that holds the minutes stands out, a spread says so', () => {
    const sat = span(56).filter((d) => isoWeekday(d) === 6);
    const other = span(56).filter((d) => isoWeekday(d) === 2);
    const wellbeing = [...sat.map((d) => ({ kind: 'move', date: d, value: 60 })), ...other.map((d) => ({ kind: 'move', date: d, value: 10 }))];
    const w = byId(insightsFor(facts({ wellbeing })), 'move-weekday')!;
    expect(w.state).toBe('ready');
    expect(w.text).toMatch(/^You move most on Saturdays: 60 minutes on average, against \d+ on other days\.$/);
    expect(w.strength).toBeGreaterThan(0);
    const spread = span(56).filter((_, i) => i % 3 === 0).map((d) => ({ kind: 'move', date: d, value: 30 }));
    const s = byId(insightsFor(facts({ wellbeing: spread })), 'move-weekday')!;
    expect(s.text).toMatch(/^Your movement is spread across the week/);
    expect(s.strength).toBe(0);
    const few = byId(insightsFor(facts({ wellbeing: sat.slice(0, 3).map((d) => ({ kind: 'move', date: d, value: 30 })) })), 'move-weekday')!;
    expect(few.state).toBe('watching');
    expect(few.need).toBe(`Log movement on ${MOVE_WEEKDAY_MIN_DAYS - 3} more days.`);
  });

  it('since the last review, active minutes count as a mover while Fitness is on', () => {
    const n = { days: 7, checkins: 5, tasksDone: 10, smallActs: 0, xp: 100, activeDays: 6, notToDoKept: 0, notToDoSlipped: 0, moodAvg: null, sleepAvg: null, stressAvg: null, mindfulMin: 0, moveMin: 60, journalEntries: 0, journalMoodAvg: null, incomeCents: 0, expenseCents: 0, orders: 0, salesCents: 0, salesPoints: 0, lessonsDone: 0, programsDone: 0, applications: 0, decisions: 0, events: 0, posts: 0, circles: 0, runs: 0, runMetres: 0 };
    const review = { kind: 'week' as const, start: ago(16), end: ago(10), then: n, since: { ...n, moveMin: 240 }, sinceStart: ago(9), sinceEnd: ago(3), ended: true };
    const r = byId(insightsFor(facts({ review })), 'review-since')!;
    expect(r.text).toContain('240 active minutes, up from 60');
    expect(r.private).toBe(true);
    const off = byId(insightsFor(facts({ apps: BASE, review })), 'review-since')!;
    expect(off.text).not.toContain('active minutes');
  });
});

describe('the brief with Fitness, Kreators Run and gratitude', () => {
  const QUIET: BriefFacts = { hour: 19, checkedIn: true, streak: 0, bestStreak: 0, level: 2, xpToNext: 50, tasksDue: 0, tasksOverdue: 0, doneWeek: 0, doneWeekBefore: 0, smallActDone: true, notToDoSlipped: 0, routineWeek: null, contractDays: null, sleepAvg: null, sleepAvgBefore: null, moodAvg: null, moodAvgBefore: null, stressAvg: null, nextEvent: null, coachNotes: 0, coachAsks: 0, reviewDue: false, apps: [] };
  const acts = (b: ReturnType<typeof briefFor>) => b.actions.map((a) => a.key);

  it('nudges a walk, the eating check-in and gratitude, each only while its app is on and it is not done', () => {
    const b = briefFor({ ...QUIET, apps: ['fitness', 'journal'], move: { today: false, week: 20 }, eatToday: false, gratitudeToday: false });
    expect(acts(b)).toEqual(['move', 'eat', 'gratitude']);
    expect(b.actions.find((a) => a.key === 'move')?.to).toBe('/fitness#move-heading');
    expect(b.actions.find((a) => a.key === 'gratitude')?.to).toBe('/journal#gratitude-heading');
    const done = briefFor({ ...QUIET, apps: ['fitness', 'journal'], move: { today: true, week: 20 }, eatToday: true, gratitudeToday: true });
    expect(acts(done)).not.toEqual(expect.arrayContaining(['move']));
    expect(acts(done)).not.toContain('eat');
    expect(acts(done)).not.toContain('gratitude');
  });

  it('never points at an app that is off', () => {
    const off = briefFor({ ...QUIET, apps: [], move: { today: false, week: 0 }, eatToday: false, gratitudeToday: false });
    for (const k of ['move', 'eat', 'gratitude']) expect(acts(off)).not.toContain(k);
    // Kreators Run alone: the walk goes to its own tool, and the eating check-in (Fitness's) is not offered.
    const run = briefFor({ ...QUIET, apps: ['run'], move: { today: false, week: 0 }, eatToday: false });
    expect(run.actions.find((a) => a.key === 'move')?.to).toBe('/run?tab=tracking');
    expect(acts(run)).not.toContain('eat');
  });

  it('waits for the afternoon to nudge a walk, and the evening for the eating check-in', () => {
    const morning = briefFor({ ...QUIET, hour: 9, apps: ['fitness'], move: { today: false, week: 0 }, eatToday: false });
    expect(acts(morning)).not.toContain('move');
    expect(acts(morning)).not.toContain('eat');
  });

  it('says a good week of movement', () => {
    const b = briefFor({ ...QUIET, apps: ['fitness'], move: { today: true, week: BRIEF_MOVE_WEEK + 30 } });
    expect(b.signals.find((s) => s.key === 'move-week')?.text).toBe('180 active minutes these seven days.');
  });
});

describe('emerging: the eating check-in as the server stores it', () => {
  it('maps a full plate to a day you ate well and a thin one to another day, so eat-days reads the new check-in', () => {
    expect(ATE_WELL).toBe(5);
    expect(ATE_THIN).toBe(1);
  });
});
