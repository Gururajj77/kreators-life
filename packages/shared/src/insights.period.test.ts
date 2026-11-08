import { describe, expect, it } from 'vitest';
import { addDays, BUDGET_OVER_MIN_MONTHS, BUDGET_PACE_MIN_DAYS, CAUSE_WORDS, HABIT_TIE_MIN_DAYS, INSIGHT_BASIS_TAIL, insightsForApp, isoWeekday, money, PAIR_MIN_DAYS, periodFor, periodLabel, WATER_WEEKDAY_MIN_DAYS, zonedToUtc, type Insight, type InsightFacts, type Period } from './index';
import { insightsFor, insightsForEvery } from './insights';
import { GOLDEN_CASES, goldenFacts } from './insights.golden.fixtures';

// Emerging by period (2026-11-07): the patterns worked out over a picked period, each naming it, with the minimum days as they are; and water
// and budgets as patterns. Rules only, and never a cause.

const TODAY = '2026-11-07'; // a Saturday
const APPS = ['home', 'today', 'tower', 'life', 'wellbeing', 'mood', 'sleep', 'stress', 'mindful', 'journal', 'finance', 'reviews'];

function facts(over: Partial<InsightFacts> = {}): InsightFacts {
  return { today: TODAY, zone: 'Asia/Kolkata', currency: 'INR', apps: APPS, rel: null, done: [], open: [], projects: [], xp30: [], focusPillars: [], checkins: [], firstCheckin: null, wellbeing: [], focus: [], notToDo: [], notToDoItems: [], notToDoMarks: [], water: [], waterGoal: null, dayTypes: [], routine: [], journalAt: [], gratitudeDays: [], expenses: [], review: null, discover: null, agencyDue: [], ...over };
}
const ago = (n: number) => addDays(TODAY, -n);
const days = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ago(from + i));
const byKey = (list: Insight[], key: Insight['key']) => list.find((i) => i.key === key);
const all = (i: Insight) => `${i.headline} ${i.text} ${i.basis} ${i.need ?? ''}`.toLowerCase();
/** What a card says, without the tail every basis line ends in ("not causes"). */
const said = (i: Insight) => all(i).replace(INSIGHT_BASIS_TAIL.toLowerCase(), '');
const sleepMood = (ds: string[]) => ds.flatMap((d, i) => [{ kind: 'sleep', date: d, value: i % 2 ? 8 : 5 }, { kind: 'mood', date: d, value: i % 2 ? 5 : 2 }]);

describe('Emerging over a picked period', () => {
  it('no period is the rolling windows, exactly', () => {
    for (const opts of Object.values(GOLDEN_CASES)) {
      const f = goldenFacts(opts);
      expect(insightsFor({ ...f, window: null })).toEqual(insightsFor(f));
    }
  });
  it('reads only the days of the period', () => {
    const wellbeing = sleepMood(days(20, 1));
    const rolling = byKey(insightsFor(facts({ wellbeing })), 'sleep-mood')!;
    expect(rolling.state).toBe('ready');
    // The same logs, but a period that holds none of them.
    const earlier = periodFor('month', '2026-08-15');
    expect(byKey(insightsFor(facts({ wellbeing, window: earlier })), 'sleep-mood')!.state).toBe('watching');
  });
  it('every ready card names its period in its basis line, and the sentence too when it says a span', () => {
    const f = goldenFacts(GOLDEN_CASES.heavy!);
    const quarter = periodFor('quarter', '2026-10-05');
    const month = periodFor('month', '2026-10-05');
    for (const p of [quarter, month]) {
      const list = insightsFor({ ...f, window: p });
      const ready = list.filter((i) => i.state === 'ready');
      expect(ready.length).toBeGreaterThan(0);
      for (const i of ready) {
        expect(i.basis, i.id).toContain(periodLabel(p));
        expect(all(i), i.id).not.toMatch(/in 8 weeks|in 4 weeks|in 30 days|last four weeks|up to 12 weeks/);
      }
    }
  });
  it('since your last review stays with the rolling view', () => {
    const f = goldenFacts(GOLDEN_CASES.heavy!);
    expect(byKey(insightsFor(f), 'review-since')).toBeTruthy();
    expect(byKey(insightsFor({ ...f, window: periodFor('month', '2026-10-05') }), 'review-since')).toBeUndefined();
  });
  it('the minimum days stay as they are: a short period waits and says why once it cannot get there', () => {
    const wellbeing = sleepMood(days(6, 1));
    const week = periodFor('week', TODAY);
    const running = byKey(insightsFor(facts({ wellbeing, window: week })), 'sleep-mood')!;
    expect(running.state).toBe('watching');
    expect(running.need).toBe('Not enough days in this week for this one.');
    const past = byKey(insightsFor(facts({ window: periodFor('week', '2026-10-05') })), 'sleep-mood')!;
    expect(past.need).toBe('Not enough days in that week for this one.');
    const oneDay = byKey(insightsFor(facts({ window: periodFor('day', TODAY) })), 'sleep-mood')!;
    expect(oneDay.need).toBe('One day is not enough for this one.');
    // A month still running with room left keeps the line that says what to do.
    const halfDone: Period = { kind: 'month', start: '2026-11-01', end: '2026-11-30' };
    const line = byKey(insightsFor(facts({ wellbeing: sleepMood(days(5, 1)), window: halfDone })), 'sleep-mood')!;
    expect(line.need).toMatch(/^Log sleep and mood on \d+ more days?\.$/);
  });
  it('a day is never a pattern, and its whole list says so without a number or a chart', () => {
    const f = goldenFacts(GOLDEN_CASES.heavy!);
    const list = insightsFor({ ...f, window: periodFor('day', ago(2)) });
    for (const i of list) {
      if (i.state === 'watching') expect(i.headline).toBe('');
      expect(['habit-tie', 'sleep-mood', 'stress-calm', 'money-stress'].includes(i.key) && i.state === 'ready').toBe(false);
    }
  });
  it('a long period draws a habit by weekday, not a year of rows', () => {
    const f = goldenFacts(GOLDEN_CASES.heavy!);
    const habit = insightsFor({ ...f, window: periodFor('year', '2026-06-01') }).find((i) => i.key === 'habit' && i.state === 'ready');
    expect(habit?.chart?.kind).toBe('week');
    expect(habit?.habit?.within).toBe('in 2026');
  });
  it('says nothing of causes, whatever the period', () => {
    const f = goldenFacts(GOLDEN_CASES.fit!);
    for (const kind of ['day', 'week', 'month', 'quarter', 'half', 'year'] as const) {
      for (const i of insightsForEvery({ ...f, window: periodFor(kind, TODAY) })) for (const w of CAUSE_WORDS) expect(said(i), i.id).not.toContain(w);
    }
  });
});

describe('water as a pattern', () => {
  const goal = 2000;
  /** Mood lifts on the days at the goal, on `at` days at it and `under` under it. */
  function watered(at: number, under: number, lift = 1.5) {
    const ds = days(at + under);
    const water = ds.map((d, i) => ({ day: d, ml: i < at ? 2400 : 1200 }));
    const wellbeing = ds.map((d, i) => ({ kind: 'mood', date: d, value: i < at ? 3 + lift : 3 }));
    return { water, wellbeing, waterGoal: goal };
  }
  it('sets days at the goal beside days under it, and says what went together', () => {
    const line = byKey(insightsFor(facts(watered(HABIT_TIE_MIN_DAYS + 5, PAIR_MIN_DAYS + 5))), 'water-days')!;
    expect(line.state).toBe('ready');
    expect(line.text).toBe('On days you met your water goal, your mood was 1.5 higher, on average.');
    expect(line.basis).toContain(INSIGHT_BASIS_TAIL);
    expect(line.basis).toContain('in 8 weeks');
    expect(line.action?.to).toBe('/home#water');
    expect(line.apps).toEqual(expect.arrayContaining(['home', 'today', 'life', 'insights', 'mood']));
    for (const w of CAUSE_WORDS) expect(said(line)).not.toContain(w);
  });
  it('waits for the days it needs, on both sides', () => {
    const few = byKey(insightsFor(facts(watered(HABIT_TIE_MIN_DAYS - 1, PAIR_MIN_DAYS))), 'water-days')!;
    expect(few.state).toBe('watching');
    expect(few.need).toBe('Log water on 1 more day, some at your goal and some under it.');
    expect(byKey(insightsFor(facts(watered(HABIT_TIE_MIN_DAYS, PAIR_MIN_DAYS))), 'water-days')!.state).toBe('ready');
    expect(byKey(insightsFor(facts()), 'water-days')!.need).toBe('Log water on 12 more days, some at your goal and some under it.');
  });
  it('is never a bad habit: a worse day at the goal just waits', () => {
    const line = byKey(insightsFor(facts(watered(8, 8, -1.5))), 'water-days')!;
    expect(line.state).toBe('watching');
    expect(line.need).toBe('About the same so far on days you met your goal and days you did not.');
    expect(line.tie).toBeUndefined();
  });
  it('a day with no water logged is not known, so it counts on neither side', () => {
    const f = watered(8, 8);
    // Twenty more days with a mood and nothing logged change nothing.
    const extra = days(20, 17).map((d) => ({ kind: 'mood', date: d, value: 1 }));
    const a = byKey(insightsFor(facts(f)), 'water-days')!;
    const b = byKey(insightsFor(facts({ ...f, wellbeing: [...f.wellbeing, ...extra] })), 'water-days')!;
    expect(b.text).toBe(a.text);
    expect(b.basis).toBe(a.basis);
  });
  it('never says the same stress fact twice', () => {
    const ds = days(24);
    const water = ds.map((d, i) => ({ day: d, ml: i % 2 ? 2400 : 1200 }));
    const wellbeing = ds.map((d, i) => ({ kind: 'stress', date: d, value: i % 2 ? 1 : 4 }));
    const list = insightsFor(facts({ water, wellbeing, waterGoal: goal, apps: APPS.filter((a) => a !== 'mindful') }));
    expect(byKey(list, 'stress-calm')!.text).toContain('water goal');
    expect(byKey(list, 'water-days')!.state).toBe('watching');
  });
  it('names the weekday you drink least, from the days logged, and a spread says so', () => {
    const ds = days(28);
    const water = ds.map((d) => ({ day: d, ml: isoWeekday(d) === 7 ? 1200 : 2200 }));
    const line = byKey(insightsFor(facts({ water, waterGoal: goal })), 'water-weekday')!;
    expect(line.state).toBe('ready');
    expect(line.headline).toBe('Suns');
    expect(line.text).toBe('You drink least on Sundays: 1,200 ml on average, against 2,200 ml on other days.');
    expect(line.basis).toBe('From 28 days with water logged in 8 weeks.');
    expect(line.chart?.kind).toBe('week');
    expect(line.strength).toBeGreaterThan(0);
    const even = byKey(insightsFor(facts({ water: ds.map((d) => ({ day: d, ml: 2000 })), waterGoal: goal })), 'water-weekday')!;
    expect(even.text).toBe('Your water is about even across the week: 2,000 ml a day on the days you logged it.');
    expect(even.strength).toBe(0);
    const few = byKey(insightsFor(facts({ water: days(WATER_WEEKDAY_MIN_DAYS - 1).map((d) => ({ day: d, ml: 2000 })), waterGoal: goal })), 'water-weekday')!;
    expect(few.state).toBe('watching');
    expect(few.need).toBe('Log water on 1 more day.');
  });
  it('a picked period names itself', () => {
    const p = periodFor('quarter', '2026-10-05');
    const ds = dayList(p.start, 28);
    const water = ds.map((d, i) => ({ day: d, ml: i % 2 ? 2400 : 1200 }));
    const wellbeing = ds.map((d, i) => ({ kind: 'mood', date: d, value: i % 2 ? 4.5 : 3 }));
    const line = byKey(insightsFor(facts({ water, wellbeing, waterGoal: goal, window: p })), 'water-days')!;
    expect(line.basis).toContain('in Oct to Dec 2026');
  });
});
function dayList(from: string, n: number) {
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

describe('budgets as patterns', () => {
  const budgets = [{ category: 'Food', monthlyCents: 1000000 }, { category: 'Travel', monthlyCents: 500000 }];
  const row = (month: string, category: string, cents: number) => ({ month, category, cents });
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  it('finds the budget that keeps running over, and says it plainly', () => {
    const budgetSpend = months.flatMap((m, i) => [row(m, 'Food', i % 3 === 0 ? 900000 : 1200000), row(m, 'Travel', 200000)]);
    const line = byKey(insightsFor(facts({ budgets, budgetSpend })), 'budget-over')!;
    expect(line.state).toBe('ready');
    expect(line.text).toBe(`Food ran over its budget in 4 of 6 months, by ${money(200000, 'INR')} on average.`);
    expect(line.basis).toBe('From 6 months of your spending, in INR, against your budgets as they are now.');
    expect(line.apps).toEqual(expect.arrayContaining(['finance', 'home', 'life', 'insights']));
    expect(line.action?.to).toBe('/finance#budgets-heading');
    expect(all(line)).not.toMatch(/fail|overspent|bad|should/);
    for (const w of CAUSE_WORDS) expect(said(line)).not.toContain(w);
  });
  it('one month over is no pattern', () => {
    const budgetSpend = months.flatMap((m, i) => [row(m, 'Food', i === 2 ? 1200000 : 900000), row(m, 'Travel', 200000)]);
    const line = byKey(insightsFor(facts({ budgets, budgetSpend })), 'budget-over')!;
    expect(line.headline).toBe('Held');
    expect(line.text).toBe('No budget kept running over in the last 6 months.');
  });
  it('waits for months with spending logged', () => {
    const budgetSpend = months.slice(0, BUDGET_OVER_MIN_MONTHS - 1).map((m) => row(m, 'Food', 1200000));
    const line = byKey(insightsFor(facts({ budgets, budgetSpend })), 'budget-over')!;
    expect(line.state).toBe('watching');
    expect(line.need).toBe('Log your spending for 1 more month.');
  });
  it('the month still running is not counted, and a quarter or longer names itself', () => {
    const budgetSpend = [...['2026-07', '2026-08', '2026-09'].map((m) => row(m, 'Food', 1200000)), row('2026-11', 'Food', 9900000)];
    const q = periodFor('quarter', '2026-08-01');
    const line = byKey(insightsFor(facts({ budgets, budgetSpend, window: q })), 'budget-over')!;
    expect(line.text).toBe(`Food ran over its budget in 3 of 3 months, by ${money(200000, 'INR')} on average.`);
    expect(line.basis).toContain('in Jul to Sep 2026');
    expect(byKey(insightsFor(facts({ budgets, budgetSpend, window: periodFor('month', '2026-08-01') })), 'budget-over')).toBeUndefined();
  });
  it('compares the month so far with its budget', () => {
    // The 7th of a 30-day month: 23% gone.
    const ahead = byKey(insightsFor(facts({ budgets, budgetSpend: [row('2026-11', 'Food', 600000), row('2026-11', 'Travel', 50000)] })), 'budget-pace')!;
    expect(ahead.state).toBe('ready');
    expect(ahead.text).toBe('Food is at 60% of its budget with 23% of the month gone.');
    expect(ahead.headline).toBe('60% vs 23%');
    expect(ahead.strength).toBeGreaterThan(30);
    const fine = byKey(insightsFor(facts({ budgets, budgetSpend: [row('2026-11', 'Food', 200000)] })), 'budget-pace')!;
    expect(fine.text).toBe('Your budgets are on pace: the fullest is Food at 20%, with 23% of the month gone.');
    expect(fine.strength).toBeLessThan(30);
  });
  it('waits for the first days of a month, and for a budget', () => {
    const early = byKey(insightsFor(facts({ today: '2026-11-03', budgets, budgetSpend: [row('2026-11', 'Food', 900000)] })), 'budget-pace')!;
    expect(early.state).toBe('watching');
    expect(early.need).toBe(`Give the month ${BUDGET_PACE_MIN_DAYS - 3} more days.`);
    expect(byKey(insightsFor(facts({ budgets: [] })), 'budget-pace')!.need).toBe('Set a monthly budget in Finance and it shows here.');
    expect(byKey(insightsFor(facts({ budgets: [] })), 'budget-over')).toBeUndefined();
  });
  it('a closed month says how it ended, in plain words', () => {
    const p = periodFor('month', '2026-09-10');
    const over = byKey(insightsFor(facts({ budgets, budgetSpend: [row('2026-09', 'Food', 1300000)], window: p })), 'budget-pace')!;
    expect(over.text).toBe('Food ran over its budget, at 130% in September 2026.');
    const held = byKey(insightsFor(facts({ budgets, budgetSpend: [row('2026-09', 'Food', 900000)], window: p })), 'budget-pace')!;
    expect(held.text).toBe('Your budgets held in September 2026: the fullest was Food at 90%.');
  });
  it('a budget past its amount is over at any pace, and never reads as held or on pace', () => {
    const p = periodFor('month', '2026-09-10');
    const closed = byKey(insightsFor(facts({ budgets, budgetSpend: [row('2026-09', 'Food', 1050000)], window: p })), 'budget-pace')!;
    expect(closed.text).toBe('Food ran over its budget, at 105% in September 2026.');
    expect(closed.strength).toBeGreaterThanOrEqual(30);
    const late = byKey(insightsFor(facts({ today: '2026-10-30', budgets, budgetSpend: [row('2026-10', 'Food', 1040000)] })), 'budget-pace')!;
    expect(late.text).toBe('Food has run over its budget, at 104%, with 97% of the month gone.');
    expect(late.strength).toBeGreaterThanOrEqual(30);
    // A rupee past it is over too, and does not read as 100%.
    const rupee = byKey(insightsFor(facts({ budgets, budgetSpend: [row('2026-09', 'Food', 1000100)], window: p })), 'budget-pace')!;
    expect(rupee.text).toBe('Food ran over its budget, at 101% in September 2026.');
    // Exactly the budget has not run over it.
    const exact = byKey(insightsFor(facts({ budgets, budgetSpend: [row('2026-09', 'Food', 1000000)], window: p })), 'budget-pace')!;
    expect(exact.text).toBe('Your budgets held in September 2026: the fullest was Food at 100%.');
  });
  it('is off with Finance, and a longer period leaves the pace to the other card', () => {
    const none = insightsFor(facts({ apps: APPS.filter((a) => a !== 'finance'), budgets, budgetSpend: [row('2026-11', 'Food', 900000)] }));
    expect(byKey(none, 'budget-pace')).toBeUndefined();
    expect(byKey(none, 'budget-over')).toBeUndefined();
    expect(byKey(insightsFor(facts({ budgets, window: periodFor('year', '2026-03-01') })), 'budget-pace')).toBeUndefined();
  });
  it('reaches Finance and Home by rank', () => {
    const list = insightsFor(facts({ budgets, budgetSpend: [row('2026-11', 'Food', 900000)] }));
    expect(insightsForApp(list, 'finance').map((i) => i.key)).toContain('budget-pace');
    expect(insightsForApp(list, 'home').map((i) => i.key)).toContain('budget-pace');
  });
});

it('someone who gives their days a kind is told a period is too short, not told to start', () => {
  for (const name of ['heavy', 'fit', 'zoned']) {
    const f = goldenFacts(GOLDEN_CASES[name]!);
    const rolling = byKey(insightsFor(f), 'daytype-done')!;
    expect(rolling.state, name).toBe('ready');
    for (const window of [periodFor('day', f.today), { kind: 'week' as const, start: f.today, end: addDays(f.today, 6) }]) {
      const short = byKey(insightsFor({ ...f, window }), 'daytype-done')!;
      expect(short.state, name).toBe('watching');
      expect(short.need, name).not.toContain('Give a day a kind');
    }
  }
  // With no kinds at all, the line that says how to start stays.
  expect(byKey(insightsFor(facts({ window: periodFor('day', TODAY) })), 'daytype-done')!.need).toContain('Give a day a kind');
});

it('a tick late at night lands on the person own day, inside the period or out of it', () => {
  const tickAt = (id: string, day: string) => ({ id, title: 'Night walk', relationship: 'self' as const, parentId: 'p', completedAt: zonedToUtc(day, 23 * 60, 'Asia/Kolkata').toISOString(), repeats: false });
  const done = [tickAt('a', '2026-11-01'), tickAt('b', '2026-11-02'), tickAt('c', '2026-11-03'), tickAt('d', '2026-11-05')];
  const inside = insightsFor(facts({ done, window: periodFor('week', '2026-11-05') }));
  expect(inside.find((i) => i.key === 'habit' && i.state === 'ready')?.habit?.days).toEqual(['2026-11-02', '2026-11-03', '2026-11-05']);
});
