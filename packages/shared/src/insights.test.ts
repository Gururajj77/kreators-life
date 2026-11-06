import { describe, expect, it } from 'vitest';
import {
  DAILY_HABITS_MAX,
  addDays,
  CAUSE_WORDS,
  classifyHabitTie,
  HABIT_MIN_TICKS,
  HABIT_TIE_MIN_DAYS,
  INSIGHT_BASIS_TAIL,
  MAX_NOT_TO_DO,
  insightsFor,
  insightsForApp,
  isoWeekday,
  localStamp,
  money,
  sameTask,
  splitCompare,
  suggestRepeat,
  taskIsHabit,
  suggestTime,
  taskKey,
  zonedToUtc,
  type Insight,
  type InsightFacts,
  type InsightTaskFact,
  type PeriodNumbers,
  type RelationshipKey,
} from './index';

// Emerging (2026-11-04): patterns from what a person already logs. Rules only; these tests pin every rule and its minimums.

const TODAY = '2026-11-04'; // a Wednesday
const ZONE = 'Asia/Kolkata';
const ALL_APPS = ['home', 'today', 'tower', 'life', 'wellbeing', 'mood', 'sleep', 'stress', 'mindful', 'journal', 'finance', 'reviews', 'discover', 'agency'];

function facts(over: Partial<InsightFacts> = {}): InsightFacts {
  return {
    today: TODAY,
    zone: ZONE,
    currency: 'INR',
    apps: ALL_APPS,
    rel: null,
    done: [],
    open: [],
    projects: [{ id: 'p1', relationship: 'self' }],
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
    expenses: [],
    review: null,
    discover: null,
    agencyDue: [],
    ...over,
  };
}

let seq = 0;
/** A tick on a local day at a local time in India. */
function tick(title: string, day: string, hhmm = '07:30', relationship: RelationshipKey = 'self', repeats = false): InsightTaskFact {
  const [h, m] = hhmm.split(':').map(Number);
  seq += 1;
  return { id: `t${seq}`, title, relationship, parentId: 'p1', completedAt: zonedToUtc(day, (h ?? 0) * 60 + (m ?? 0), ZONE).toISOString(), repeats };
}
const ago = (n: number) => addDays(TODAY, -n);
const days = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ago(from + i));
const habitsOf = (list: Insight[]) => list.filter((i) => i.key === 'habit' && i.state === 'ready');
const byKey = (list: Insight[], key: Insight['key']) => list.find((i) => i.key === key);

describe('taskKey and sameTask', () => {
  it('collapses small changes to one key', () => {
    expect(taskKey('Gym session')).toBe('gym|session');
    expect(taskKey('gym sessions')).toBe('gym|session');
    expect(taskKey('Gym session 3')).toBe('gym|session');
    expect(taskKey('  GYM   Session!! ')).toBe('gym|session');
    expect(taskKey('Gym session 2026-11-02')).toBe('gym|session');
    expect(taskKey('Go to the gym')).toBe('gym');
    expect(taskKey('Café visit')).toBe(taskKey('cafe visits'));
  });
  it('is empty when nothing names the task', () => {
    expect(taskKey('123')).toBe('');
    expect(taskKey('to do')).toBe('');
  });
  it('keeps different things apart', () => {
    expect(sameTask(taskKey('Call mom'), taskKey('Call the bank'))).toBe(false);
    expect(sameTask(taskKey('Read 20 pages'), taskKey('Read pages'))).toBe(true);
    expect(sameTask(taskKey('Write blog post'), taskKey('Write a blog post draft'))).toBe(true);
    expect(sameTask('', '')).toBe(false);
  });
});

describe('habit', () => {
  it('needs three different days, not three ticks', () => {
    const two = insightsFor(facts({ done: [tick('Gym session', ago(1)), tick('Gym session', ago(1), '18:00'), tick('Gym session', ago(3))] }));
    expect(habitsOf(two)).toHaveLength(0);
    const w = byKey(two, 'habit')!;
    expect(w.state).toBe('watching');
    expect(w.need).toBeTruthy();
    const three = insightsFor(facts({ done: [tick('Gym session', ago(1)), tick('gym sessions', ago(3)), tick('Gym session 3', ago(5))] }));
    const h = habitsOf(three);
    expect(h).toHaveLength(1);
    expect(h[0]!.habit!.ticks).toBe(HABIT_MIN_TICKS);
    expect(h[0]!.headline).toBe('3 times');
    expect(h[0]!.action?.kind).toBe('habit');
    expect(h[0]!.chart?.kind).toBe('dots');
  });
  it('never counts a task that repeats or came from a repeat', () => {
    const list = insightsFor(facts({ done: [tick('Gym session', ago(1), '07:30', 'self', true), tick('Gym session', ago(3)), tick('Gym session', ago(5))] }));
    expect(habitsOf(list)).toHaveLength(0);
  });
  it('goes once an open task in the group repeats', () => {
    const done = [tick('Gym session', ago(1)), tick('Gym session', ago(3)), tick('Gym session', ago(5))];
    expect(habitsOf(insightsFor(facts({ done })))).toHaveLength(1);
    const gone = insightsFor(facts({ done, open: [{ id: 'o1', title: 'Gym sessions', relationship: 'self', parentId: 'p1', repeats: true }] }));
    expect(habitsOf(gone)).toHaveLength(0);
  });
  it('offers the open task that does not repeat yet', () => {
    const done = [tick('Gym session', ago(1)), tick('Gym session', ago(3)), tick('Gym session', ago(5))];
    const h = habitsOf(insightsFor(facts({ done, open: [{ id: 'o1', title: 'Gym session', relationship: 'self', parentId: 'p1', repeats: false }] })))[0]!;
    expect(h.habit!.openTaskId).toBe('o1');
    expect(h.habit!.projectId).toBe('p1');
  });
  it('never joins two pillars', () => {
    const list = insightsFor(facts({ done: [tick('Gym session', ago(1), '07:30', 'self'), tick('Gym session', ago(3), '07:30', 'lover_partner'), tick('Gym session', ago(5), '07:30', 'self')] }));
    expect(habitsOf(list)).toHaveLength(0);
  });
  it('does not join tasks that only share a short word', () => {
    const list = insightsFor(facts({ done: [tick('Call mom', ago(1)), tick('Call the bank', ago(3)), tick('Call mom', ago(5))] }));
    expect(habitsOf(list)).toHaveLength(0);
  });
  it('looks only at the last four weeks', () => {
    const list = insightsFor(facts({ done: [tick('Gym session', ago(1)), tick('Gym session', ago(3)), tick('Gym session', ago(40))] }));
    expect(habitsOf(list)).toHaveLength(0);
  });
  it('without an active project, offers the pillar instead', () => {
    const done = [tick('Gym session', ago(1)), tick('Gym session', ago(3)), tick('Gym session', ago(5))];
    const h = habitsOf(insightsFor(facts({ done, projects: [] })))[0]!;
    expect(h.habit!.projectId).toBeNull();
    expect(h.action?.kind).toBe('link');
  });
  it('keeps at most three, the most ticked first', () => {
    const done = ['Gym session', 'Read pages', 'Write journal', 'Walk dog'].flatMap((t, i) => days(3 + i, 1).map((d) => tick(t, d)));
    const h = habitsOf(insightsFor(facts({ done })));
    expect(h).toHaveLength(3);
    expect(h[0]!.habit!.title).toBe('Walk dog');
  });
});

describe('suggestRepeat and suggestTime', () => {
  it('daily when it is done most days', () => {
    expect(suggestRepeat(days(18), TODAY).kind).toBe('daily');
  });
  it('weekdays when only Monday to Friday, on four or more of them', () => {
    const weekdays = days(28).filter((d) => isoWeekday(d) <= 5).slice(0, 10);
    expect(suggestRepeat(weekdays, TODAY).kind).toBe('weekdays');
  });
  it('weekly on the days it falls twice', () => {
    const monThu = days(28).filter((d) => isoWeekday(d) === 1 || isoWeekday(d) === 4);
    const r = suggestRepeat(monThu, TODAY);
    expect(r.kind).toBe('weekly');
    expect(r.days).toEqual([1, 4]);
    expect(r.every).toBe(1);
    expect(r.until).toBeNull();
  });
  it('weekly on the one top day when none falls twice', () => {
    const r = suggestRepeat([ago(1), ago(2), ago(3)], TODAY);
    expect(r.kind).toBe('weekly');
    expect(r.days).toHaveLength(1);
  });
  it('time is the rounded middle only when ticks sit close', () => {
    expect(suggestTime([7 * 60 + 10, 7 * 60 + 25, 7 * 60 + 40])).toBe('07:30');
    expect(suggestTime([6 * 60, 12 * 60, 21 * 60, 23 * 60])).toBeNull();
    expect(suggestTime([])).toBeNull();
  });
});

describe('splitCompare', () => {
  it('skips nulls and waits for enough days on each side', () => {
    const rows = [...Array(7).fill({ on: true, y: 4 }), ...Array(6).fill({ on: false, y: 3 }), { on: null, y: 1 }, { on: false, y: null }];
    const s = splitCompare(rows, 7, 0.5);
    expect(s.on).toEqual({ n: 7, avg: 4 });
    expect(s.off).toEqual({ n: 6, avg: 3 });
    expect(s.enough).toBe(false);
    expect(s.ready).toBe(false);
    const s2 = splitCompare([...rows, { on: false, y: 3 }], 7, 0.5);
    expect(s2.enough).toBe(true);
    expect(s2.ready).toBe(true);
    expect(s2.gap).toBe(1);
  });
  it('is not ready when the gap is small', () => {
    const s = splitCompare([...Array(8).fill({ on: true, y: 3.2 }), ...Array(8).fill({ on: false, y: 3 })], 7, 0.5);
    expect(s.enough).toBe(true);
    expect(s.ready).toBe(false);
  });
});

describe('localStamp', () => {
  it('reads India at +5:30', () => {
    expect(localStamp('2026-11-03T20:00:00.000Z', 'Asia/Kolkata')).toEqual({ day: '2026-11-04', minutes: 90, weekday: 3 });
  });
  it('follows a clock change', () => {
    // New York moved to summer time on 8 March 2026.
    expect(localStamp('2026-03-07T12:00:00.000Z', 'America/New_York')?.minutes).toBe(7 * 60);
    expect(localStamp('2026-03-09T12:00:00.000Z', 'America/New_York')?.minutes).toBe(8 * 60);
  });
  it('is null for a bad time', () => {
    expect(localStamp('nope', ZONE)).toBeNull();
  });
});

/** Sleep and mood that move together over 20 days. */
function sleepMoodFacts(): Partial<InsightFacts> {
  const wellbeing: InsightFacts['wellbeing'] = [];
  days(20).forEach((d, i) => {
    const good = i % 2 === 0;
    wellbeing.push({ kind: 'sleep', date: d, value: good ? 8 : 6 }, { kind: 'mood', date: d, value: good ? 4 : 2.5 });
  });
  return { wellbeing };
}

describe('pairings', () => {
  it('sleep and mood: the sentence shape, both counts, never a cause', () => {
    const i = byKey(insightsFor(facts(sleepMoodFacts())), 'sleep-mood')!;
    expect(i.state).toBe('ready');
    expect(i.private).toBe(true);
    expect(i.text).toMatch(/^On days .*\. On other days, /);
    expect(i.headline).toBe('4.0 vs 2.5');
    expect(i.chart).toEqual({ kind: 'pair', rows: [expect.objectContaining({ value: 4, n: 10 }), expect.objectContaining({ value: 2.5, n: 10 })] });
    expect(i.basis).toContain('not causes');
  });
  it('watching under the minimum: no number, no chart, a need', () => {
    const wellbeing = days(5).flatMap((d) => [
      { kind: 'sleep', date: d, value: 8 },
      { kind: 'mood', date: d, value: 4 },
    ]);
    const i = byKey(insightsFor(facts({ wellbeing })), 'sleep-mood')!;
    expect(i.state).toBe('watching');
    expect(i.headline).toBe('');
    expect(i.chart).toBeNull();
    expect(i.need).toMatch(/\d/);
  });
  it('about the same either way: listed, but never shown in an app', () => {
    const wellbeing = days(20).flatMap((d, i) => [
      { kind: 'sleep', date: d, value: i % 2 ? 6 : 8 },
      { kind: 'mood', date: d, value: 3 },
    ]);
    const list = insightsFor(facts({ wellbeing }));
    const i = byKey(list, 'sleep-mood')!;
    expect(i.state).toBe('ready');
    expect(i.strength).toBe(0);
    expect(i.text).toContain('about the same');
    expect(insightsForApp(list, 'sleep')).toHaveLength(0);
  });
  it('money and stress: integer cents through money(), only the person\'s currency', () => {
    const wellbeing: InsightFacts['wellbeing'] = [];
    const expenses: InsightFacts['expenses'] = [];
    days(20).forEach((d, i) => {
      const stressed = i < 6;
      wellbeing.push({ kind: 'stress', date: d, value: stressed ? 4 : 2 });
      expenses.push({ date: d, cents: stressed ? 124_000 : 61_000 });
    });
    const i = byKey(insightsFor(facts({ wellbeing, expenses })), 'money-stress')!;
    expect(i.state).toBe('ready');
    expect(i.headline).toBe(`${money(124_000, 'INR')} vs ${money(61_000, 'INR')}`);
    expect(i.private).toBe(true);
  });
  it('journal and mood reads only the days', () => {
    const wellbeing = days(14).map((d, i) => ({ kind: 'mood', date: d, value: i < 7 ? 4 : 3 }));
    const journalAt = days(7).map((d) => zonedToUtc(d, 21 * 60, ZONE).toISOString());
    const i = byKey(insightsFor(facts({ wellbeing, journalAt })), 'journal-mood')!;
    expect(i.state).toBe('ready');
    expect(i.headline).toBe('4.0 vs 3.0');
  });
  it('no line uses a cause word', () => {
    const list = insightsFor(facts({ ...sleepMoodFacts(), done: days(20).flatMap((d) => [tick('Gym session', d), tick('Read pages', d, '09:00')]) }));
    for (const i of list) for (const w of CAUSE_WORDS) expect(`${i.text} ${i.need ?? ''}`.toLowerCase()).not.toContain(w);
  });
});

describe('other signals', () => {
  it('pillar balance names the quiet focus pillar', () => {
    const xp30 = [
      { relationship: 'servant_leader' as const, xp: 900, ticks: 30 },
      { relationship: 'lover_partner' as const, xp: 20, ticks: 1 },
    ];
    const i = byKey(insightsFor(facts({ xp30, focusPillars: ['lover_partner'] })), 'pillar-balance')!;
    expect(i.state).toBe('ready');
    expect(i.headline).toBe('2%');
    expect(i.strength).toBe(60);
    expect(i.action?.to).toBe('/realm/lover_partner?add=1');
  });
  it('pillar balance waits for 10 ticks', () => {
    const i = byKey(insightsFor(facts({ xp30: [{ relationship: 'self', xp: 40, ticks: 4 }] })), 'pillar-balance')!;
    expect(i.state).toBe('watching');
    expect(i.need).toContain('4 of 10');
  });
  it('best hours from local tick times', () => {
    const done = days(10).flatMap((d) => [tick('A thing', d, '09:15', 'self'), tick('Other thing', d, '10:20', 'lover_partner')]);
    const i = byKey(insightsFor(facts({ done })), 'best-hours')!;
    expect(i.state).toBe('ready');
    expect(i.headline).toBe('100%');
    expect(i.text).toContain('morning');
  });
  it('streak weekday finds the day most missed', () => {
    const first = ago(40);
    const all = days(40);
    const checkins = all.filter((d) => isoWeekday(d) !== 7);
    const i = byKey(insightsFor(facts({ checkins, firstCheckin: first })), 'streak-weekday')!;
    expect(i.state).toBe('ready');
    expect(i.text).toContain('Sundays');
    expect(i.action?.to).toBe('/today?remind=7#reminders');
  });
  it('a review shows what moved since', () => {
    const base: PeriodNumbers = { days: 7, checkins: 5, tasksDone: 18, smallActs: 0, xp: 0, activeDays: 5, notToDoKept: 0, notToDoSlipped: 0, moodAvg: null, sleepAvg: 6.4, stressAvg: null, mindfulMin: 0, moveMin: 0, journalEntries: 0, journalMoodAvg: null, incomeCents: 0, expenseCents: 0, orders: 0, salesCents: 0, salesPoints: 0, lessonsDone: 0, programsDone: 0, applications: 0, decisions: 0, events: 0, posts: 0, circles: 0, runs: 0, runMetres: 0 };
    const review = { kind: 'week' as const, start: '2026-10-19', end: '2026-10-25', then: base, since: { ...base, tasksDone: 24, sleepAvg: 6.9 }, sinceStart: '2026-10-26', sinceEnd: '2026-11-01', ended: true };
    const i = byKey(insightsFor(facts({ review })), 'review-since')!;
    expect(i.state).toBe('ready');
    expect(i.text).toContain('Since your week review of 19 to 25 Oct 2026');
    expect(i.text).toContain('24 tasks, up from 18');
    const noSleep = byKey(insightsFor(facts({ review, apps: ALL_APPS.filter((a) => a !== 'sleep') })), 'review-since')!;
    expect(noSleep.text).not.toContain('sleep');
  });
  it('a review period still running is compared per day, never three days against a whole week', () => {
    const base: PeriodNumbers = { days: 7, checkins: 5, tasksDone: 21, smallActs: 0, xp: 0, activeDays: 7, notToDoKept: 7, notToDoSlipped: 0, moodAvg: null, sleepAvg: null, stressAvg: null, mindfulMin: 0, moveMin: 0, journalEntries: 0, journalMoodAvg: null, incomeCents: 0, expenseCents: 0, orders: 0, salesCents: 0, salesPoints: 0, lessonsDone: 0, programsDone: 0, applications: 0, decisions: 0, events: 0, posts: 0, circles: 0, runs: 0, runMetres: 0 };
    // Three days in at the same pace: 9 tasks, 3 active days, 3 kept. Nothing moved.
    const same = { kind: 'week' as const, start: '2026-10-26', end: '2026-11-01', then: base, since: { ...base, days: 3, tasksDone: 9, activeDays: 3, notToDoKept: 3 }, sinceStart: '2026-11-02', sinceEnd: '2026-11-08', ended: false };
    const steady = byKey(insightsFor(facts({ review: same, apps: ['reviews'] })), 'review-since')!;
    expect(steady.headline).toBe('Steady');
    expect(steady.text).not.toContain('down from');
    // Three days in, half the pace: a per-day line.
    const slow = { ...same, since: { ...base, days: 3, tasksDone: 4, activeDays: 3, notToDoKept: 3 } };
    const i = byKey(insightsFor(facts({ review: slow, apps: ['reviews'] })), 'review-since')!;
    expect(i.text).toContain('1.3 tasks a day, down from 3.0');
    expect(i.text).not.toContain('4 tasks');
  });
  it('streak weekday never counts a day before the window the route reads', () => {
    // Check-ins on every day the route reads (today less 83 to yesterday) but Sundays; the first one long before.
    const read = Array.from({ length: 83 }, (_, k) => ago(k + 1));
    const checkins = read.filter((d) => isoWeekday(d) !== 7);
    const sundays = read.length - checkins.length;
    const i = byKey(insightsFor(facts({ checkins, firstCheckin: ago(300) })), 'streak-weekday')!;
    expect(i.headline).toBe(`${sundays} of ${sundays}`);
    expect(i.basis).toContain('83 days');
    expect(i.text).toContain(`all ${sundays} days you missed were Sundays`);
  });
  it('streak weekday says "most" only for half or more, and a tie is a spread', () => {
    const read = Array.from({ length: 83 }, (_, k) => ago(k + 1));
    // Missed: every Sunday (12) and every Saturday but two (10) and four Mondays: 12 of 26, under half.
    let sat = 0;
    let mon = 0;
    const missedSet = new Set(read.filter((d) => isoWeekday(d) === 7 || (isoWeekday(d) === 6 && (sat += 1) > 2) || (isoWeekday(d) === 1 && (mon += 1) <= 4)));
    const i = byKey(insightsFor(facts({ checkins: read.filter((d) => !missedSet.has(d)), firstCheckin: ago(300) })), 'streak-weekday')!;
    expect(i.text).toContain('You miss Sundays more than any other day');
    expect(i.text).not.toMatch(/^Most/);
    // Sundays and Saturdays tied: no day is named.
    const tie = new Set(read.filter((d) => isoWeekday(d) >= 6));
    const t = byKey(insightsFor(facts({ checkins: read.filter((d) => !tie.has(d)), firstCheckin: ago(300) })), 'streak-weekday')!;
    expect(t.text).toContain('no one day standing out');
    expect(t.action).toBeNull();
  });
  it('a habit spread over the week is never said to be mostly on some days', () => {
    // Eleven ticks over every weekday: the top three hold 6 of them, under 60%.
    const spread = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map((n) => tick('Reply to the brand', ago(n)));
    const h = habitsOf(insightsFor(facts({ done: spread })))[0]!;
    expect(h.text).toContain('on different days of the week');
    expect(h.text).not.toContain('mostly');
  });
  it('discover strength only with the steps switch on', () => {
    const xp30 = [{ relationship: 'servant_leader' as const, xp: 300, ticks: 20 }];
    expect(byKey(insightsFor(facts({ xp30, discover: { growth: 'parent_child', steps: false } })), 'discover-strength')).toBeUndefined();
    const i = byKey(insightsFor(facts({ xp30, discover: { growth: 'parent_child', steps: true } })), 'discover-strength')!;
    expect(i.text).toContain('Caring');
    expect(i.headline).toBe('0%');
  });
});

describe('the app filter', () => {
  const rich = (): Partial<InsightFacts> => ({
    ...sleepMoodFacts(),
    agencyDue: days(10),
    done: days(20).map((d) => tick('Thing', d)),
    journalAt: days(5).map((d) => `${d}T10:00:00.000Z`),
    waterGoal: 2000,
    routine: days(10).map((d, i) => ({ day: d, done: i % 2 === 0 })),
  });
  it('a switched-off app takes its signals with it', () => {
    const noStress = insightsFor(facts({ ...rich(), apps: ALL_APPS.filter((a) => a !== 'stress') })).map((i) => i.key);
    expect(noStress).not.toContain('stress-calm');
    expect(noStress).not.toContain('money-stress');
    const noAgency = insightsFor(facts({ ...rich(), apps: ALL_APPS.filter((a) => a !== 'agency') })).map((i) => i.key);
    expect(noAgency).not.toContain('agency-load');
    const noJournal = insightsFor(facts({ ...rich(), apps: ALL_APPS.filter((a) => a !== 'journal') })).map((i) => i.key);
    expect(noJournal).not.toContain('journal-mood');
    const noSleep = insightsFor(facts({ ...rich(), apps: ALL_APPS.filter((a) => a !== 'sleep') })).map((i) => i.key);
    expect(noSleep).not.toContain('sleep-mood');
    expect(noSleep).not.toContain('slips-sleep');
  });
  it('the same facts give the same answer, ready ones by strength, then watching', () => {
    const f = facts(rich());
    const a = insightsFor(f);
    expect(insightsFor(f)).toEqual(a);
    const ready = a.filter((i) => i.state === 'ready');
    for (let k = 1; k < ready.length; k += 1) expect(ready[k - 1]!.strength).toBeGreaterThanOrEqual(ready[k]!.strength);
    const firstWatch = a.findIndex((i) => i.state === 'watching');
    if (firstWatch >= 0) expect(a.slice(firstWatch).every((i) => i.state === 'watching')).toBe(true);
  });
  it('a new account sees only watching lines', () => {
    const list = insightsFor(facts());
    expect(list.length).toBeGreaterThan(0);
    for (const i of list) {
      expect(i.state).toBe('watching');
      expect(i.headline).toBe('');
      expect(i.chart).toBeNull();
      expect(i.need).toBeTruthy();
    }
  });
  it('Home takes at most three, one private pairing and one of each key', () => {
    const list = insightsFor(facts({ ...rich(), done: ['Gym session', 'Read pages', 'Walk dog'].flatMap((t) => days(6).map((d) => tick(t, d))) }));
    const home = insightsForApp(list, 'home');
    expect(home.length).toBeLessThanOrEqual(3);
    const keys = home.filter((i) => i.key !== 'habit-tie').map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(home.filter((i) => i.key === 'habit-tie').length).toBeLessThanOrEqual(2);
    expect(home.filter((i) => i.private && i.chart?.kind === 'pair' && i.key !== 'habit-tie').length).toBeLessThanOrEqual(1);
    for (const i of home) expect(i.apps).toContain('home');
  });
  it('Daily keeps up to five good and bad habits for its Habits section, beside its two other patterns', () => {
    const make = (key: Insight['key'], n: number): Insight => ({ key, id: `${key}:${n}`, state: 'ready', apps: ['today'], reads: ['tasks'], private: false, relationship: null, headline: '1', text: 'x', basis: 'y', chart: null, action: null, need: null, strength: 50 - n });
    const list = [...Array.from({ length: 7 }, (_, n) => make('habit-tie', n)), make('best-hours', 8), make('streak-weekday', 9), make('focus-tasks', 10)];
    const today = insightsForApp(list, 'today');
    expect(today.filter((i) => i.key === 'habit-tie')).toHaveLength(DAILY_HABITS_MAX);
    expect(today.filter((i) => i.key !== 'habit-tie')).toHaveLength(2);
  });
  it('a pillar page gets only its own pillar', () => {
    const list = insightsFor(facts({ rel: 'lover_partner', xp30: [{ relationship: 'lover_partner', xp: 200, ticks: 12 }], done: days(4).map((d) => tick('Date night', d, '20:00', 'lover_partner')) }));
    const page = insightsForApp(list, 'pillar', 'lover_partner');
    expect(page.length).toBeGreaterThan(0);
    for (const i of page) expect(i.relationship).toBe('lover_partner');
  });
});

// The 2026-11-04 ask: a task done again and again, or a slip on the not to do list, tied to how the days went and sorted into
// good habits and bad habits. Rules only; a line says what went together, never a cause.
describe('good and bad habits', () => {
  const ties = (list: Insight[]) => list.filter((i) => i.key === 'habit-tie');
  const readyTie = (list: Insight[], title: string) => ties(list).find((i) => i.state === 'ready' && i.tie?.title === title);
  /** Ticked on the odd days back (1, 3, … 19), with a mood of `on` those days and `off` on the even ones. */
  function walkFacts(title: string, on: number, off: number, extra: Partial<InsightFacts> = {}): Partial<InsightFacts> {
    const done: InsightTaskFact[] = [];
    const wellbeing: InsightFacts['wellbeing'] = [];
    for (let n = 1; n <= 20; n += 1) {
      const withIt = n % 2 === 1;
      if (withIt) done.push(tick(title, ago(n), '19:00'));
      wellbeing.push({ kind: 'mood', date: ago(n), value: withIt ? on : off });
    }
    return { done, wellbeing, ...extra };
  }

  it('a clear lift is a good habit, and it offers Make it a habit', () => {
    const list = insightsFor(facts(walkFacts('Evening walk', 4, 3)));
    const i = readyTie(list, 'Evening walk')!;
    expect(i.tie?.verdict).toBe('good');
    expect(i.text).toBe('On days you ticked “Evening walk”, your mood was 1.0 higher, on average.');
    expect(i.headline).toBe('4.0 vs 3.0');
    expect(i.basis).toBe(`From 10 days with it and 9 days without, in 8 weeks. ${INSIGHT_BASIS_TAIL}`);
    expect(i.private).toBe(true);
    expect(i.reads).toContain('wellbeing');
    expect(i.action).toEqual({ label: 'Make it a habit', to: '/realm/self', kind: 'habit' });
    expect(i.habit?.projectId).toBe('p1');
    expect(i.chart).toEqual({ kind: 'pair', rows: [expect.objectContaining({ label: 'Mood with it', value: 4, n: 10 }), expect.objectContaining({ label: 'Mood without', value: 3, n: 9 })] });
    // Said once: the plain "you keep doing this" card for the same task goes.
    expect(list.some((x) => x.key === 'habit' && x.state === 'ready')).toBe(false);
  });

  it('a task that repeats already offers to open it instead', () => {
    const f = walkFacts('Evening walk', 4, 3);
    f.done = f.done!.map((t) => ({ ...t, repeats: true }));
    const open = [{ id: 'o1', title: 'Evening walk', relationship: 'self' as const, parentId: 'p1', repeats: true, openDay: TODAY }];
    const i = readyTie(insightsFor(facts({ ...f, open })), 'Evening walk')!;
    expect(i.tie?.verdict).toBe('good');
    expect(i.action).toEqual({ label: 'Open the task', to: '/today?task=o1', kind: 'link' });
  });

  it('a clear dip is a bad habit, and it offers Add to not to do while the list has room', () => {
    const i = readyTie(insightsFor(facts(walkFacts('Late night gaming', 2, 4))), 'Late night gaming')!;
    expect(i.tie?.verdict).toBe('bad');
    expect(i.text).toBe('On days you ticked “Late night gaming”, your mood was 2.0 lower, on average.');
    expect(i.action?.kind).toBe('notToDo');
    expect(i.action?.label).toBe('Add to not to do');
    expect(i.tie?.canAddNotToDo).toBe(true);
    // Already on the list by name, or the list is full: open the task instead.
    const named = readyTie(insightsFor(facts(walkFacts('Late night gaming', 2, 4, { notToDoItems: [{ id: 'n1', title: 'late-night gaming', relationship: null }] }))), 'Late night gaming')!;
    expect(named.action).toEqual({ label: 'Open the task', to: '/realm/self', kind: 'link' });
    const full = Array.from({ length: MAX_NOT_TO_DO }, (_, k) => ({ id: `n${k}`, title: `Thing ${k}`, relationship: null }));
    expect(readyTie(insightsFor(facts(walkFacts('Late night gaming', 2, 4, { notToDoItems: full }))), 'Late night gaming')!.action?.kind).toBe('link');
  });

  it('a slip on the not to do list is the bad side', () => {
    const notToDoMarks: InsightFacts['notToDoMarks'] = [];
    const wellbeing: InsightFacts['wellbeing'] = [];
    for (let n = 1; n <= 16; n += 1) {
      const slipped = n % 3 === 0 || n === 1; // 1, 3, 6, 9, 12, 15
      notToDoMarks.push({ itemId: 'n1', day: ago(n), status: slipped ? 'slipped' : 'kept' });
      wellbeing.push({ kind: 'mood', date: ago(n), value: slipped ? 2 : 4 });
    }
    const list = insightsFor(facts({ notToDoItems: [{ id: 'n1', title: 'Scroll in bed', relationship: 'self' }], notToDoMarks, wellbeing }));
    const i = readyTie(list, 'Scroll in bed')!;
    expect(i.tie?.verdict).toBe('bad');
    expect(i.tie?.kind).toBe('notToDo');
    expect(i.text).toBe('On days you slipped on “Scroll in bed”, your mood was 2.0 lower, on average.');
    expect(i.basis).toBe(`From 6 slip days and 10 kept days in 8 weeks. ${INSIGHT_BASIS_TAIL}`);
    expect(i.action).toEqual({ label: 'Open your not to do list', to: '/today#ntd-heading', kind: 'link' });
    expect(i.chart).toEqual({ kind: 'pair', rows: [expect.objectContaining({ label: 'Mood on slip days', n: 6 }), expect.objectContaining({ label: 'Mood on kept days', n: 10 })] });
    // A better day after a slip is never a good habit: it stays watching.
    const flipped = insightsFor(facts({ notToDoItems: [{ id: 'n1', title: 'Scroll in bed', relationship: 'self' }], notToDoMarks, wellbeing: wellbeing.map((w) => ({ ...w, value: 6 - w.value })) }));
    const w = ties(flipped).find((x) => x.id === 'habit-tie:ntd:n1')!;
    expect(w.state).toBe('watching');
    expect(w.need).toBe('Nothing clear yet between slip days and kept days.');
  });

  it('too few days or no gap is still watching, with no number', () => {
    const few = insightsFor(facts({ done: [1, 3, 5].map((n) => tick('Evening walk', ago(n))), wellbeing: [1, 2, 3, 4, 5].map((n) => ({ kind: 'mood', date: ago(n), value: 4 })) }));
    const w = ties(few).find((x) => x.id.startsWith('habit-tie:task'))!;
    expect(w.state).toBe('watching');
    expect(w.headline).toBe('');
    expect(w.chart).toBeNull();
    expect(w.need).toMatch(/^Have \d+ more days? with it and without, with your mood, sleep or stress logged\.$/);
    const same = insightsFor(facts(walkFacts('Evening walk', 3, 3)));
    expect(ties(same).find((x) => x.id.startsWith('habit-tie:task'))?.need).toBe('About the same so far on days with it and without.');
    expect(readyTie(same, 'Evening walk')).toBeUndefined();
  });

  it('how the day felt decides; mixed feelings stay watching', () => {
    // Mood up and stress up (a worse day) on the same days: mixed.
    const f = walkFacts('Evening walk', 4, 3);
    const stress = days(20).map((d, k) => ({ kind: 'stress', date: d, value: k % 2 === 0 ? 4 : 2 }));
    const mixed = ties(insightsFor(facts({ ...f, wellbeing: [...f.wellbeing!, ...stress] }))).find((x) => x.id.startsWith('habit-tie:task'))!;
    expect(mixed.state).toBe('watching');
    expect(mixed.need).toContain('Mixed so far');
    // Mood up and stress down agree: both are said.
    const calm = days(20).map((d, k) => ({ kind: 'stress', date: d, value: k % 2 === 0 ? 2 : 3 }));
    const both = readyTie(insightsFor(facts({ ...f, wellbeing: [...f.wellbeing!, ...calm] })), 'Evening walk')!;
    expect(both.text).toBe('On days you ticked “Evening walk”, your mood was 1.0 higher and your stress was 1.0 lower, on average.');
    expect(both.chart?.kind === 'pair' && both.chart.rows).toHaveLength(4);
  });

  it('sleep is the night after: the next morning\'s log', () => {
    const done = [1, 3, 5, 7, 9, 11, 13, 15].map((n) => tick('Evening walk', ago(n), '19:00'));
    // Logged the morning after a walk day (n - 1 back) is 8 hours; after other days, 6.
    const wellbeing = days(16, 0).map((d, k) => ({ kind: 'sleep', date: d, value: k % 2 === 0 ? 8 : 6 }));
    const i = readyTie(insightsFor(facts({ done, wellbeing })), 'Evening walk')!;
    expect(i.text).toBe('On days you ticked “Evening walk”, you slept 2.0 hours more that night, on average.');
  });

  it('with Mood, Sleep and Stress off, no habit reads how a day felt', () => {
    const f = walkFacts('Evening walk', 4, 3);
    const apps = ALL_APPS.filter((a) => !['mood', 'sleep', 'stress'].includes(a));
    const list = insightsFor(facts({ ...f, apps }));
    for (const i of ties(list)) {
      expect(i.private).toBe(false);
      expect(i.reads).not.toContain('wellbeing');
    }
    expect(readyTie(list, 'Evening walk')).toBeUndefined();
  });

  it('other tasks decide only when no feeling is clear', () => {
    // No wellbeing at all: three other tasks on walk days, one on the others.
    const done: InsightTaskFact[] = [];
    for (let n = 1; n <= 20; n += 1) {
      if (n % 2 === 1) done.push(tick('Evening walk', ago(n)), tick('Mail', ago(n), '10:00'), tick('Plan', ago(n), '11:00'), tick('Call', ago(n), '12:00'));
      else done.push(tick('Errand', ago(n), '10:00'));
    }
    const i = readyTie(insightsFor(facts({ done })), 'Evening walk')!;
    expect(i.tie?.verdict).toBe('good');
    expect(i.private).toBe(false);
    expect(i.text).toBe('On days you ticked “Evening walk”, you ticked 2.0 more other tasks, on average.');
  });

  it('the classifier on its own: good, bad, watching', () => {
    const sig = [{ name: 'mood' as const, feel: true, better: 1 as const, minGap: 0.5, scale: () => 2, fmt: (v: number) => v.toFixed(1) }];
    const rows = (on: number, off: number, nOn = HABIT_TIE_MIN_DAYS, nOff = 7) => [
      ...Array.from({ length: nOn }, () => ({ on: true, ys: { mood: on } })),
      ...Array.from({ length: nOff }, () => ({ on: false, ys: { mood: off } })),
    ];
    expect(classifyHabitTie(rows(4, 3), sig, false).verdict).toBe('good');
    expect(classifyHabitTie(rows(3, 4), sig, false).verdict).toBe('bad');
    expect(classifyHabitTie(rows(3.2, 3), sig, false)).toMatchObject({ verdict: 'watching', reason: 'same' });
    expect(classifyHabitTie(rows(4, 3, HABIT_TIE_MIN_DAYS - 1), sig, false)).toMatchObject({ verdict: 'watching', reason: 'days', more: 1 });
    expect(classifyHabitTie(rows(3, 4), sig, true).verdict).toBe('bad');
    expect(classifyHabitTie(rows(4, 3), sig, true)).toMatchObject({ verdict: 'watching', reason: 'same' });
  });

  it('Home takes up to two, a pillar page its own, and no line names a cause', () => {
    const good = walkFacts('Evening walk', 4, 3);
    const bad: InsightTaskFact[] = [2, 4, 6, 8, 10, 12, 14].map((n) => tick('Doomscroll news', ago(n), '23:00', 'friendship'));
    const list = insightsFor(facts({ ...good, done: [...good.done!, ...bad], wellbeing: good.wellbeing, rel: 'self' }));
    const home = insightsForApp(list, 'home');
    expect(home.filter((i) => i.key === 'habit-tie').length).toBeLessThanOrEqual(2);
    expect(home.filter((i) => i.key === 'habit-tie')).toHaveLength(2);
    const page = insightsForApp(list, 'pillar', 'self');
    expect(page.some((i) => i.tie?.title === 'Evening walk')).toBe(true);
    for (const i of page) expect(i.relationship).toBe('self');
    for (const i of ties(list)) {
      // The basis ends with the one line that says these are not causes; everything before it is checked.
      const words = `${i.text} ${i.need ?? ''} ${i.basis.replace(INSIGHT_BASIS_TAIL, '')}`.toLowerCase();
      for (const w of CAUSE_WORDS) expect(words).not.toContain(w);
      if (i.state === 'ready') expect(i.basis.endsWith(INSIGHT_BASIS_TAIL)).toBe(true);
    }
  });

  it('a new account has one line still watching, saying what it needs', () => {
    const w = ties(insightsFor(facts()));
    expect(w).toHaveLength(1);
    expect(w[0]!.state).toBe('watching');
    expect(w[0]!.need).toBe(`Tick the same task on ${HABIT_TIE_MIN_DAYS} days or mark your not to do list and log your mood, sleep or stress.`);
  });
});

// The 2026-11-04 extra ask: a repeating task can be counted as a habit, or not ("Count it as a habit").
describe('count it as a habit', () => {
  const rule = { kind: 'daily' as const, every: 1, days: [], until: null };
  it('the Habit tag: the person\'s pick, else a repeat is a habit', () => {
    expect(taskIsHabit({ repeat: rule })).toBe(true);
    expect(taskIsHabit({ repeat: rule, habit: null })).toBe(true);
    expect(taskIsHabit({ repeat: rule, habit: false })).toBe(false);
    expect(taskIsHabit({ repeat: null, habit: null })).toBe(false);
    expect(taskIsHabit({ repeat: rule, habit: true })).toBe(true);
  });
  /** `n` days back, ticked on the odd ones, a mood of `on` with it and `off` without. */
  function flagged(habit: boolean | null, on: number, off: number, n = 22): Partial<InsightFacts> {
    const done: InsightTaskFact[] = [];
    const wellbeing: InsightFacts['wellbeing'] = [];
    for (let k = 1; k <= n; k += 1) {
      if (k % 2 === 1) done.push({ ...tick('Evening walk', ago(k), '19:00'), repeats: true, habit });
      wellbeing.push({ kind: 'mood', date: ago(k), value: k % 2 === 1 ? on : off });
    }
    return { done, wellbeing };
  }
  const tieOf = (list: Insight[]) => list.find((i) => i.key === 'habit-tie' && i.id.startsWith('habit-tie:task'));
  it('counted as a habit, it is watched from its first tick', () => {
    const done = [{ ...tick('Evening walk', ago(2), '19:00'), repeats: true, habit: true }];
    const w = tieOf(insightsFor(facts({ done })))!;
    expect(w.state).toBe('watching');
    expect(w.need).toMatch(/more days? with it and without/);
    // Without the pick, two ticks are not enough to watch.
    expect(tieOf(insightsFor(facts({ done: [{ ...done[0]!, habit: null }] })))).toBeUndefined();
  });
  it('not a habit by the person\'s word: only a strong pattern shows, and nothing waits', () => {
    expect(tieOf(insightsFor(facts(flagged(null, 4, 3.4))))?.state).toBe('ready');
    expect(tieOf(insightsFor(facts(flagged(false, 4, 3.4))))).toBeUndefined();
    const strong = tieOf(insightsFor(facts(flagged(false, 4, 2))))!;
    expect(strong.state).toBe('ready');
    expect(strong.tie?.verdict).toBe('good');
    // Too few days for a strong pattern: still nothing.
    expect(tieOf(insightsFor(facts(flagged(false, 4, 2, 14))))).toBeUndefined();
  });
});

describe('time blocks kept', () => {
  const blocks = [{ id: 'deep', seed: 'deep', name: 'Deep work', tag: 'Focus', color: 'red' as const, area: 'financial' as const, pillar: 'servant_leader' as const, sort: 0 }];
  const templates = [{ id: 'every', seed: 'everyday', sourceKind: null, name: 'Everyday', lead: 'servant_leader' as const, second: 'self' as const, why: null, source: null, isDefault: true, sort: 0, color: null, slots: [{ blockId: 'deep', start: 600, end: 780 }] }];
  const timeBlocks = { blocks, templates, defaultId: 'every', pattern: [null, null, null, null, null, null, null], overrides: {} as Record<string, string> };
  const inBlock = (i: number, hhmm: string) => ({ ...tick(`Deep ${i}`, ago(i + 1), hhmm, 'servant_leader'), timeBlockId: 'deep' });
  it('says nothing for an account without blocks, and watches until ten tasks', () => {
    expect(insightsFor(facts()).some((x) => x.key === 'block-kept')).toBe(false);
    const few = insightsFor(facts({ timeBlocks, done: [inBlock(1, '10:30')] })).find((x) => x.key === 'block-kept');
    expect(few?.state).toBe('watching');
    expect(few?.need).toMatch(/9 more tasks you put in Deep work/);
  });
  it('counts the tasks ticked inside the block', () => {
    const done = [...Array.from({ length: 14 }, (_, i) => inBlock(i, '11:00')), ...Array.from({ length: 6 }, (_, i) => inBlock(i + 14, '18:00'))];
    const line = insightsFor(facts({ timeBlocks, done })).find((x) => x.key === 'block-kept')!;
    expect(line.state).toBe('ready');
    expect(line.text).toBe('You ticked 14 of 20 Deep work tasks inside the block.');
    expect(line.basis).toContain(INSIGHT_BASIS_TAIL);
    expect(line.action?.to).toBe('/time-blocks');
    expect(line.strength).toBeGreaterThanOrEqual(50);
    for (const w of CAUSE_WORDS) expect(line.text.toLowerCase()).not.toContain(w);
  });
});

describe('your kinds of day (the last four weeks by day template)', () => {
  const blocks = [
    { id: 'deep', seed: 'deep', name: 'Deep work', tag: 'Focus', color: 'red' as const, area: 'financial' as const, pillar: 'servant_leader' as const, sort: 0 },
    { id: 'sleep', seed: 'sleep', name: 'Sleep', tag: 'Recovery', color: 'slate' as const, area: 'physical' as const, pillar: 'self' as const, sort: 1 },
  ];
  const tpl = (id: string, name: string, isDefault = false) => ({ id, seed: null, sourceKind: null, name, lead: 'servant_leader' as const, second: null, why: null, source: null, isDefault, sort: 0, color: null, slots: [{ blockId: 'deep', start: 600, end: 780 }, { blockId: 'sleep', start: 1380, end: 420 }] });
  const templates = [tpl('every', 'Everyday', true), tpl('t-deep', 'Deep focus'), tpl('t-mine', 'Studio day')];
  // TODAY is a Wednesday: Mondays are 2, 9, 16 and 23 days ago. The weekly pattern makes every Monday "Deep focus"; five dates are "Studio day".
  const studio = [ago(1), ago(3), ago(4), ago(5), ago(6)];
  const overrides: Record<string, string> = Object.fromEntries(studio.map((d) => [d, 't-mine']));
  const timeBlocks = { blocks, templates, defaultId: 'every', pattern: ['t-deep', null, null, null, null, null, null], overrides };
  const done = days(42).flatMap((d, i) => {
    const n = (i + 1) % 7 === 2 ? 5 : studio.includes(d) ? 3 : 1;
    return Array.from({ length: n }, (_, k) => tick(`Task ${i}-${k}`, d));
  });
  const dayTypes = studio.map((d) => ({ day: d, kind: 'template' }));
  const rowsOf = (i: Insight) => (i.chart?.kind === 'kinds' ? i.chart.rows : []);
  it('counts set and patterned days, names them by the template, keeps the default days apart and says what went together', () => {
    const line = byKey(insightsFor(facts({ timeBlocks, done, dayTypes })), 'daytype-done')!;
    expect(line.state).toBe('ready');
    expect(line.headline).toBe('9 of 28 days');
    expect(line.apps).toEqual(['today', 'reviews', 'insights']);
    const chart = line.chart?.kind === 'kinds' ? line.chart : null;
    expect(chart?.parts.map((p) => [p.name, p.days, p.color])).toEqual([
      ['Studio day', 5, 'red'],
      ['Deep focus', 4, 'red'],
    ]);
    expect(chart?.none).toBe(19);
    expect(rowsOf(line).map((r) => [r.name, r.n, r.tasks])).toEqual([
      ['Studio days', 5, 3],
      ['Deep focus days', 4, 5],
      ['Days on Everyday', 19, 1],
    ]);
    expect(line.text).toBe('Deep focus days and more ticked tasks went together: 5.0 a day, against 1.4 on other days.');
    expect(line.basis).toContain(INSIGHT_BASIS_TAIL);
    expect(line.action?.to).toBe('/time-blocks');
    for (const w of CAUSE_WORDS) expect(line.text.toLowerCase()).not.toContain(w);
  });
  it('reads mood and focus only while their apps are on', () => {
    const wellbeing = days(28).map((d) => ({ kind: 'mood', date: d, value: studio.includes(d) ? 4.5 : 3 }));
    const focus = studio.map((d) => ({ day: d, minutes: 60 }));
    const on = byKey(insightsFor(facts({ timeBlocks, done, dayTypes, wellbeing, focus })), 'daytype-done')!;
    expect(rowsOf(on)[0]).toMatchObject({ name: 'Studio days', mood: 4.5, focus: 60 });
    expect(on.private).toBe(true);
    const off = byKey(insightsFor(facts({ timeBlocks, done, dayTypes, wellbeing, focus, apps: ALL_APPS.filter((a) => a !== 'mood' && a !== 'mindful') })), 'daytype-done')!;
    expect(rowsOf(off)[0]).toMatchObject({ mood: null, focus: null });
    expect(off.private).toBe(false);
    expect(off.reads).not.toContain('wellbeing');
  });
  it('leaves out the days before the account, follows a rename, and watches before time blocks exist', () => {
    const since = byKey(insightsFor(facts({ timeBlocks: { ...timeBlocks, since: ago(10) }, done, dayTypes })), 'daytype-done')!;
    expect(since.headline).toBe('7 of 10 days');
    const renamed = { ...timeBlocks, templates: templates.map((t) => (t.id === 't-deep' ? { ...t, name: 'Maker Monday' } : t)) };
    expect(byKey(insightsFor(facts({ timeBlocks: renamed, done, dayTypes })), 'daytype-done')!.text).toMatch(/^Maker Monday days and more/);
    const none = byKey(insightsFor(facts({ done, dayTypes })), 'daytype-done')!;
    expect(none.state).toBe('watching');
    expect(none.need).toBe('Give a day a kind on Daily, or set your usual week in Time blocks.');
  });
  it('sets a kind beside the other days only with 4 days of it and 7 others, else shows the mix alone', () => {
    // Three Deep focus days (the Monday of 23 days ago falls before the account), every other day a Studio day or Everyday.
    const few = byKey(insightsFor(facts({ timeBlocks: { ...timeBlocks, overrides: {}, since: ago(22) }, done, dayTypes: [] })), 'daytype-done')!;
    expect(few.state).toBe('ready');
    expect(few.text).toBe('Your last four weeks: 3 Deep focus days and 19 on Everyday.');
    expect(few.basis).not.toMatch(/beside/);
    expect(rowsOf(few).map((r) => [r.name, r.n])).toEqual([
      ['Deep focus days', 3],
      ['Days on Everyday', 19],
    ]);
    // Four Deep focus days (the Mondays, five ticks each) and only six other days the app was used: still no comparison; a seventh brings it.
    const mondays = [ago(2), ago(9), ago(16), ago(23)];
    const used = (others: string[]) => [...mondays.flatMap((d) => Array.from({ length: 5 }, (_, k) => tick(`Mon ${d}-${k}`, d))), ...others.map((d) => tick(`Day ${d}`, d))];
    const tb = { ...timeBlocks, overrides: {} };
    const six = byKey(insightsFor(facts({ timeBlocks: tb, done: used(days(6, 3)), dayTypes: [] })), 'daytype-done')!;
    expect(six.text).toMatch(/^Your last four weeks:/);
    const seven = byKey(insightsFor(facts({ timeBlocks: tb, done: used([...days(6, 3), ago(10)]), dayTypes: [] })), 'daytype-done')!;
    expect(seven.text).toBe('Deep focus days and more ticked tasks went together: 5.0 a day, against 1.0 on other days.');
  });
  it('draws a kind in its own colour, and lists a kind with days but no app use on them', () => {
    const tb = { ...timeBlocks, templates: [...templates, { ...tpl('t-trip', 'Trip day'), color: 'teal' as const }], pattern: [null, null, null, null, null, null, null], overrides: { [ago(12)]: 't-trip', [ago(13)]: 't-trip' } };
    const line = byKey(insightsFor(facts({ timeBlocks: tb, done: days(6, 3).map((d) => tick(`Day ${d}`, d)), dayTypes: [] })), 'daytype-done')!;
    const chart = line.chart?.kind === 'kinds' ? line.chart : null;
    expect(chart?.parts.map((p) => [p.name, p.days, p.color])).toEqual([['Trip day', 2, 'teal']]);
    expect(rowsOf(line).map((r) => [r.name, r.n])).toEqual([
      ['Trip days', 0],
      ['Days on Everyday', 6],
    ]);
  });
  it('watches while no day has a kind', () => {
    const w = byKey(insightsFor(facts({ timeBlocks: { ...timeBlocks, pattern: [null, null, null, null, null, null, null], overrides: {} }, done })), 'daytype-done')!;
    expect(w.state).toBe('watching');
    expect(w.need).toBe('Give a day a kind on Daily, or set your usual week in Time blocks.');
  });
});
