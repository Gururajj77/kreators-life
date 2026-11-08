import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAUSE_WORDS, LIFE_AREA_ORDER, money, periodFor, RELATIONSHIPS, type PeriodNumbers, type RelationshipKey, type ReviewLayer } from './index';
import { dashChartStart, lifeDashboardFrom, type DashInput, type LifeDashboard } from './lifeDashboard';

// "Your life, this week" (2026-11-07): the numbers of one period, the five areas then the seven pillars, each part only while its app is on.

const TODAY = '2026-11-07'; // a Saturday
const EMPTY: PeriodNumbers = { days: 7, checkins: 0, tasksDone: 0, smallActs: 0, xp: 0, activeDays: 0, notToDoKept: 0, notToDoSlipped: 0, moodAvg: null, sleepAvg: null, stressAvg: null, mindfulMin: 0, moveMin: 0, moveDays: 0, eatAvg: null, journalEntries: 0, journalMoodAvg: null, gratitudeDays: 0, incomeCents: 0, expenseCents: 0, orders: 0, salesCents: 0, salesPoints: 0, lessonsDone: 0, programsDone: 0, applications: 0, decisions: 0, events: 0, posts: 0, circles: 0, runs: 0, runMetres: 0, waterDays: 0, waterAvgMl: null, waterGoalDays: 0, routineDays: 0 };
const LAYER: ReviewLayer = { kind: 'project', pillars: RELATIONSHIPS.map((r) => ({ relationship: r.key, items: [], total: r.key === 'self' ? 2 : 1 })) };
const week = periodFor('week', TODAY);
const EVERY = ['sleep', 'fitness', 'finance', 'mindful', 'stress', 'mood', 'journal'];

function input(over: Partial<DashInput> = {}, on: readonly string[] = EVERY): DashInput {
  return {
    picked: week,
    span: { start: week.start, end: week.end },
    today: TODAY,
    currency: 'INR',
    on: (k) => on.includes(k),
    now: EMPTY,
    before: EMPTY,
    layer: LAYER,
    reads: { wellbeing: [], stillness: [], stillnessBefore: 0, water: [], focus: [], money: [], otherCurrencies: [], journal: [], gratitude: [], routine: [], acts: [], xp: [], ticks: [], xpBefore: [] },
    ...over,
  };
}
const card = (d: LifeDashboard, key: string) => d.areas.flatMap((a) => a.cards).find((c) => c.key === key);
const keys = (d: LifeDashboard) => d.areas.flatMap((a) => a.cards.map((c) => c.key));

describe('the life dashboard', () => {
  it('goes through the five areas in their one order, then the seven pillars in theirs', () => {
    const d = lifeDashboardFrom(input());
    expect(d.areas.map((a) => a.key)).toEqual([...LIFE_AREA_ORDER]);
    expect(d.pillars.map((p) => p.relationship)).toEqual(RELATIONSHIPS.map((r) => r.key));
    expect(keys(d)).toEqual(['sleep', 'move', 'eat', 'water', 'income', 'expense', 'focus', 'stress', 'mindful', 'mood', 'journal', 'gratitude', 'still', 'acts']);
  });
  it('an app that is off leaves nothing behind, and an area with nothing on goes', () => {
    const d = lifeDashboardFrom(input({}, []));
    expect(keys(d)).toEqual(['water', 'acts']);
    expect(d.areas.map((a) => a.key)).toEqual(['physical', 'spiritual']);
    expect(keys(lifeDashboardFrom(input({}, ['run'])))).toContain('move');
    expect(keys(lifeDashboardFrom(input({}, ['run'])))).not.toContain('eat');
    expect(card(lifeDashboardFrom(input({}, ['run'])), 'move')?.to).toBe('/run?tab=tracking');
    // Numbers read for an app that is off stay off the page.
    const now = { ...EMPTY, moodAvg: 4.5, sleepAvg: 7, incomeCents: 500000 };
    const off = JSON.stringify(lifeDashboardFrom(input({ now }, ['stress'])));
    expect(off).not.toContain('4.5');
    expect(off).not.toContain(money(500000, 'INR'));
  });
  it('says each number, its change and where it lives', () => {
    const now: PeriodNumbers = { ...EMPTY, sleepAvg: 7.4, stressAvg: 2.5, moodAvg: 4, moveMin: 90, moveDays: 3, waterAvgMl: 2100, waterGoalDays: 4, waterDays: 5 };
    const before: PeriodNumbers = { ...EMPTY, sleepAvg: 6.1, stressAvg: 3.5, moodAvg: 3.4, moveMin: 60, moveDays: 2, waterAvgMl: 1800, waterDays: 5 };
    const d = lifeDashboardFrom(input({ now, before }));
    expect(card(d, 'sleep')).toMatchObject({ value: '7.4 h', change: { word: 'up 1.3 h', tone: 'good' }, to: '/sleep' });
    expect(card(d, 'stress')).toMatchObject({ value: '2.5 of 5', change: { word: 'down 1.0', tone: 'good' }, to: '/stress' });
    expect(card(d, 'mood')).toMatchObject({ change: { word: 'up 0.6', tone: 'good' } });
    expect(card(d, 'move')).toMatchObject({ value: '90 min', note: 'On 3 of 6 days', change: { word: 'up 30 min', tone: 'good' } });
    expect(card(d, 'water')).toMatchObject({ value: '2,100 ml', note: 'Goal met on 4 of 6 days', to: '/home#water' });
  });
  it('lower stress is the good way, and a higher one is said without red', () => {
    const d = lifeDashboardFrom(input({ now: { ...EMPTY, stressAvg: 4 }, before: { ...EMPTY, stressAvg: 3 } }));
    expect(card(d, 'stress')?.change).toEqual({ word: 'up 1.0', tone: 'warm' });
  });
  it('never judges where it is not ours to: spending, how much you write, sleep moving away from the middle', () => {
    const d = lifeDashboardFrom(input({ now: { ...EMPTY, expenseCents: 200000, journalEntries: 1, sleepAvg: 9.5 }, before: { ...EMPTY, expenseCents: 100000, journalEntries: 5, sleepAvg: 8 } }));
    expect(card(d, 'expense')?.change?.tone).toBe('neutral');
    expect(card(d, 'journal')?.change?.tone).toBe('neutral');
    expect(card(d, 'sleep')?.change?.tone).toBe('neutral');
  });
  it('nothing logged has no number and no change', () => {
    const d = lifeDashboardFrom(input());
    expect(card(d, 'sleep')).toMatchObject({ value: '–', note: 'Nothing logged', change: null });
    expect(card(d, 'focus')?.change).toBeNull();
  });
  it('eating with no score says that, since a check-in with no fruit or veg said was logged', () => {
    expect(card(lifeDashboardFrom(input()), 'eat')).toMatchObject({ value: '–', note: 'No score yet', change: null });
  });
  it('money is whole units in the person own currency, and other currencies are named, never added', () => {
    const d = lifeDashboardFrom(input({ currency: 'USD', now: { ...EMPTY, incomeCents: 123456, expenseCents: 4500 }, reads: { ...input().reads, otherCurrencies: ['INR'] } }));
    expect(card(d, 'income')?.value).toBe(money(123500, 'USD'));
    expect(d.areas.find((a) => a.key === 'financial')?.note).toBe('Money in INR is left out, never converted.');
  });
  it('budgets and savings show only when there are some, and savings say no change', () => {
    expect(keys(lifeDashboardFrom(input()))).not.toContain('budgets');
    const d = lifeDashboardFrom(input({ now: { ...EMPTY, budgetChecks: 3, budgetsOver: 1, goalsCount: 2, goalSavedCents: 500000, goalTargetCents: 2000000, goalsReached: 0 }, before: { ...EMPTY, budgetChecks: 3, budgetsOver: 2 } }));
    expect(card(d, 'budgets')).toMatchObject({ value: '1', note: 'Of 3 budgets', change: { word: 'down 1', tone: 'good' }, to: '/finance#budgets-heading' });
    expect(card(d, 'savings')).toMatchObject({ change: null, note: `Of ${money(2000000, 'INR')}` });
    expect(card(d, 'savings')?.chart?.values).toEqual([0.25]);
  });
  it('the routine shows only for someone who keeps one', () => {
    expect(keys(lifeDashboardFrom(input()))).not.toContain('routine');
    expect(card(lifeDashboardFrom(input({ now: { ...EMPTY, routineDays: 4 } })), 'routine')?.value).toBe('4');
  });
  it('a week draws its seven days, with the days to come left empty', () => {
    const reads = { ...input().reads, water: [{ day: '2026-11-02', ml: 1000 }, { day: '2026-11-06', ml: 2000 }] };
    const c = card(lifeDashboardFrom(input({ reads })), 'water')!;
    expect(c.chart).toMatchObject({ shape: 'bars', values: [1000, 0, 0, 0, 2000, 0, null], labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], max: 2000 });
  });
  it('a day is the daily report: done or not, and the week up to it in the charts', () => {
    const day = periodFor('day', '2026-11-05');
    expect(dashChartStart(day)).toBe('2026-10-30');
    const now = { ...EMPTY, days: 1, smallActs: 1, gratitudeDays: 0, waterAvgMl: 2100, waterGoalDays: 1, moveMin: 20, moveDays: 1 };
    const d = lifeDashboardFrom(input({ picked: day, span: { start: day.start, end: day.end }, now }));
    expect(d.heading).toBe('that day');
    expect(d.compare).toContain('the day before');
    expect(card(d, 'acts')).toMatchObject({ value: 'Done', change: null });
    expect(card(d, 'gratitude')).toMatchObject({ value: '–', note: 'Not written', change: null });
    expect(card(d, 'water')?.note).toBe('Goal met');
    expect(card(d, 'move')?.note).toBe('Logged');
    expect(card(d, 'water')?.chart?.values).toHaveLength(7);
  });
  it('a quarter charts by week and a year by month, and neither by day', () => {
    const q = periodFor('quarter', '2026-08-01');
    const dq = lifeDashboardFrom(input({ picked: q, span: { start: q.start, end: q.end } }));
    expect(card(dq, 'water')?.chart?.values).toHaveLength(14);
    expect(card(dq, 'water')?.chart?.shape).toBe('line');
    const y = periodFor('year', '2025-03-01');
    const dy = lifeDashboardFrom(input({ picked: y, span: { start: y.start, end: y.end } }));
    expect(card(dy, 'water')?.chart?.values).toHaveLength(12);
    expect(dy.heading).toBe('that year');
  });
  it('with no period it is the last eight weeks, set beside the eight before', () => {
    const d = lifeDashboardFrom(input({ picked: null, span: { start: '2026-09-13', end: TODAY } }));
    expect(d.period).toBeNull();
    expect(d.heading).toBe('the last 8 weeks');
    expect(d.compare).toBe('Each one next to the 8 weeks before.');
    expect(card(d, 'water')?.chart?.values).toHaveLength(8);
  });
  it('a running period is set beside the same days, a closed one beside the whole one before', () => {
    expect(lifeDashboardFrom(input()).compare).toBe('Each one next to the same days of the week before.');
    const past = periodFor('week', '2026-10-05');
    const d = lifeDashboardFrom(input({ picked: past, span: { start: past.start, end: past.end } }));
    expect(d.compare).toBe('Each one next to the week before.');
    expect(d.heading).toBe('that week');
    expect(lifeDashboardFrom(input()).heading).toBe('this week');
  });
  it('each pillar has its xp, its ticks and its layer, from the days of the period only', () => {
    const rel: RelationshipKey = 'self';
    const reads = { ...input().reads, xp: [{ relationship: rel, day: '2026-11-03', xp: 30 }, { relationship: rel, day: '2026-11-04', xp: 20 }], ticks: [{ relationship: rel, day: '2026-11-03', n: 2 }], xpBefore: [{ relationship: rel, xp: 80 }] };
    const self = lifeDashboardFrom(input({ reads })).pillars.find((p) => p.relationship === rel)!;
    expect(self).toMatchObject({ value: '50 xp', note: '2 tasks ticked, 2 projects', change: { word: 'down 30 xp', tone: 'warm' }, to: '/realm/self' });
    expect(self.chart?.values).toEqual([0, 30, 20, 0, 0, 0, null]);
    expect(lifeDashboardFrom(input()).pillars[0]).toMatchObject({ value: '0 xp', note: '0 tasks ticked, 1 project', change: null });
  });
  it('a day walks its tasks', () => {
    const day = periodFor('day', TODAY);
    const layer: ReviewLayer = { kind: 'task', pillars: RELATIONSHIPS.map((r) => ({ relationship: r.key, items: [], total: 3 })) };
    const reads = { ...input().reads, ticks: RELATIONSHIPS.map((r) => ({ relationship: r.key, day: TODAY, n: 1 })) };
    const d = lifeDashboardFrom(input({ picked: day, span: { start: day.start, end: day.end }, layer, reads }));
    expect(d.pillars[0]?.note).toBe('1 task ticked, 2 still open');
  });
  it('says nothing of causes, and its source names nothing that must stay out of Emerging', () => {
    const text = JSON.stringify(lifeDashboardFrom(input({ now: { ...EMPTY, moodAvg: 3 } }))).toLowerCase();
    for (const w of CAUSE_WORDS) expect(text).not.toContain(w);
    const src = readFileSync(new URL('./lifeDashboard.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/supplement|nootropic|suppTaken|suppDue/);
  });
});
