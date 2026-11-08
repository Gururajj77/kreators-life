import { describe, expect, it } from 'vitest';
import { CAUSE_WORDS, COACH_SHARE_PARTS, DEFAULT_COACH_SHARE, NEW_LINK_SHARE, parseCoachShare, type CoachShare, type CoachTrackerDay, type Insight, type InsightFacts, type PeriodNumbers } from './index';
import { insightsFor } from './insights';
import { COACH_PATTERN_KEYS, COACH_PERIOD_FIELDS, COACH_REPORT_KINDS, coachPatternsFrom, coachPeriodNumbers, coachSays, coachSectionsFor, coachSectionState, coachSuggestions, MAX_COACH_SUGGESTIONS, parseCoachSections, type CoachSignals } from './coachReport';

const ALL_ON: CoachShare = { ...NEW_LINK_SHARE };
const off = (...parts: (keyof CoachShare)[]): CoachShare => ({ ...ALL_ON, ...Object.fromEntries(parts.map((p) => [p, false])) });

const NUMBERS: PeriodNumbers = {
  days: 7, checkins: 5, tasksDone: 9, smallActs: 2, xp: 120, activeDays: 6, notToDoKept: 4, notToDoSlipped: 1, moodAvg: 3.5, sleepAvg: 7, stressAvg: 2, mindfulMin: 30, moveMin: 90, moveDays: 3, eatAvg: 4,
  journalEntries: 3, journalMoodAvg: 4, gratitudeDays: 2, incomeCents: 100, expenseCents: 50, orders: 1, salesCents: 10, salesPoints: 1, lessonsDone: 1, programsDone: 1, applications: 1, decisions: 1, events: 1, posts: 1, circles: 1, runs: 1, runMetres: 100,
  kindDays: 2, kinds: [], waterDays: 3, waterAvgMl: 1000, waterGoalDays: 1, focusMin: 20, focusSessions: 2, focusQualityAvg: 3, habitTicks: 2, topPriorityDone: 1, overdueAtEnd: 1, routineDays: 4, budgetsOver: 0, budgetChecks: 1, owedToYouCents: 5, youOweCents: 5, goalSavedCents: 5, goalTargetCents: 9, goalsReached: 0, goalsCount: 1, suppTaken: 3, suppDue: 4,
};

describe('a coach’s period numbers', () => {
  it('lets through only the fields a shared part names', () => {
    const everyField = new Set(Object.values(COACH_PERIOD_FIELDS).flat() as string[]);
    expect(Object.keys(coachPeriodNumbers(NUMBERS, ALL_ON)).sort()).toEqual(['days', ...everyField].sort());
    expect(Object.keys(coachPeriodNumbers(NUMBERS, off('daily', 'routine', 'reflection')))).toEqual(['days']);
    expect(coachPeriodNumbers(NUMBERS, off('reflection')).moodAvg).toBeUndefined();
    expect(coachPeriodNumbers(NUMBERS, off('daily')).tasksDone).toBeUndefined();
    expect(coachPeriodNumbers(NUMBERS, off('routine')).routineDays).toBeUndefined();
  });
  it('never carries the journal, gratitude, money, water, focus, supplements or the other apps', () => {
    const never = ['topPriorityDone', 'smallActs', 'notToDoKept', 'activeDays', 'journalEntries', 'journalMoodAvg', 'gratitudeDays', 'incomeCents', 'expenseCents', 'orders', 'salesCents', 'salesPoints', 'lessonsDone', 'programsDone', 'applications', 'decisions', 'events', 'posts', 'circles', 'runs', 'runMetres', 'kindDays', 'kinds', 'waterDays', 'waterAvgMl', 'waterGoalDays', 'focusMin', 'focusSessions', 'focusQualityAvg', 'budgetsOver', 'budgetChecks', 'owedToYouCents', 'youOweCents', 'goalSavedCents', 'goalTargetCents', 'goalsReached', 'goalsCount', 'suppTaken', 'suppDue'];
    const shown = coachPeriodNumbers(NUMBERS, ALL_ON);
    for (const k of never) expect(k in shown).toBe(false);
  });
  it('offers day, week, month and quarter', () => {
    expect(COACH_REPORT_KINDS).toEqual(['day', 'week', 'month', 'quarter']);
  });
});

describe('Patterns on a coach’s link', () => {
  it('is a sixth part, off on a link made before it and on for a new one', () => {
    expect(COACH_SHARE_PARTS).toContain('patterns');
    expect(parseCoachShare('{}').patterns).toBe(false);
    expect(parseCoachShare('{"daily":false}').patterns).toBe(false);
    expect(DEFAULT_COACH_SHARE.patterns).toBe(false);
    expect(NEW_LINK_SHARE.patterns).toBe(true);
    expect(parseCoachShare(JSON.stringify(NEW_LINK_SHARE)).patterns).toBe(true);
  });

  const ready = (over: Partial<Insight>): Insight => ({ key: 'sleep-mood', id: 'x', state: 'ready', apps: [], reads: ['wellbeing'], private: true, relationship: null, headline: '3 vs 2', text: 'On days you slept, your mood was 3.', basis: 'From 8 days.', chart: null, action: { label: 'Log', to: '/sleep', kind: 'link' }, need: null, strength: 50, ...over });

  it('gives nothing while Patterns is off', () => {
    expect(coachPatternsFrom([ready({})], off('patterns'))).toEqual({ patterns: [], forming: 0 });
  });
  it('drops a pattern when anything it reads is not shared, and every pattern on the never list', () => {
    expect(coachPatternsFrom([ready({})], off('reflection')).patterns).toHaveLength(0);
    expect(coachPatternsFrom([ready({ key: 'slips-sleep', reads: ['notToDo', 'wellbeing'] })], off('daily')).patterns).toHaveLength(0);
    expect(coachPatternsFrom([ready({ key: 'routine-tasks', reads: ['routine', 'tasks'] })], off('routine')).patterns).toHaveLength(0);
    for (const key of ['money-stress', 'journal-mood', 'gratitude-mood', 'review-since', 'discover-strength', 'agency-load', 'focus-tasks', 'daytype-done', 'block-kept'] as const) {
      expect(COACH_PATTERN_KEYS).not.toContain(key);
      expect(coachPatternsFrom([ready({ key })], ALL_ON).patterns).toHaveLength(0);
    }
    // A part that no switch opens, on an allowed key.
    expect(coachPatternsFrom([ready({ reads: ['wellbeing', 'journal'] })], ALL_ON).patterns).toHaveLength(0);
    expect(coachPatternsFrom([ready({ reads: ['wellbeing', 'money'] })], ALL_ON).patterns).toHaveLength(0);
  });
  it('strips what a student’s own screen would act on, and rewords it for the coach', () => {
    const [p] = coachPatternsFrom([ready({ tie: { verdict: 'good', kind: 'task', title: 'Call your mother', key: 'k', relationship: 'parent_child', to: '/today', toLabel: 'Open', repeats: false, canAddNotToDo: false }, text: 'On days you ticked “Call your mother”, your mood was 0.5 higher, on average.' })], ALL_ON).patterns;
    expect(p).toBeDefined();
    expect(JSON.stringify(p)).not.toContain('"action"');
    expect(JSON.stringify(p)).not.toContain('/today');
    expect(p!.text).toBe('On days they ticked “Call your mother”, their mood was 0.5 higher, on average.');
    expect(p!.verdict).toBe('good');
  });
  it('never lets a line about the journal, water or money through, whatever its key', () => {
    expect(coachPatternsFrom([ready({ text: 'On days you met your water goal, your stress was 2.' })], ALL_ON).patterns).toHaveLength(0);
    expect(coachPatternsFrom([ready({ text: 'On days you ticked “Buy water”, your mood was 3.' })], ALL_ON).patterns).toHaveLength(1);
  });
  it('says it to the coach: they for you, their for your, and leaves quoted words alone', () => {
    expect(coachSays('You move most on Saturdays.')).toBe('They move most on Saturdays.');
    expect(coachSays('Most of your ticks land in the morning.')).toBe('Most of their ticks land in the morning.');
    expect(coachSays('On days you slept, “your call” went well.')).toBe('On days they slept, “your call” went well.');
    expect(coachSays('From 8 days since your first check-in.')).toBe('From 8 days since their first check-in.');
  });

  const day = (d: number) => `2026-10-${String(d).padStart(2, '0')}`;
  const facts = (over: Partial<InsightFacts>): InsightFacts => ({ today: '2026-10-31', zone: 'Asia/Kolkata', currency: 'INR', apps: [], rel: null, done: [], open: [], projects: [], xp30: [], focusPillars: [], checkins: [], firstCheckin: null, wellbeing: [], focus: [], notToDo: [], notToDoItems: [], notToDoMarks: [], water: [], waterGoal: null, dayTypes: [], routine: [], journalAt: [], gratitudeDays: [], expenses: [], review: null, discover: null, agencyDue: [], ...over });
  it('runs the real rules: sleep and mood reach the coach only under Reflection and Patterns', () => {
    const wellbeing = Array.from({ length: 28 }, (_, i) => i + 1).flatMap((d) => [
      { kind: 'sleep', date: day(d), value: d % 2 ? 8 : 5 },
      { kind: 'mood', date: day(d), value: d % 2 ? 4 : 2 },
    ]);
    const list = insightsFor(facts({ apps: ['sleep', 'mood'], wellbeing }));
    expect(coachPatternsFrom(list, ALL_ON).patterns.some((p) => p.key === 'sleep-mood')).toBe(true);
    expect(coachPatternsFrom(list, off('reflection')).patterns.some((p) => p.key === 'sleep-mood')).toBe(false);
    expect(coachPatternsFrom(list, off('patterns')).patterns).toEqual([]);
    const line = coachPatternsFrom(list, ALL_ON).patterns.find((p) => p.key === 'sleep-mood');
    expect(line?.text).toMatch(/their mood/);
    for (const w of CAUSE_WORDS) expect(line?.text.toLowerCase()).not.toContain(w);
  });
});

describe('suggestions for a coach', () => {
  const blank = (date: string): CoachTrackerDay => ({ date, mood: null, sleep: null, stress: null, mindful: 0, move: 0, eat: null });
  const days = (over: Partial<CoachTrackerDay>[]): CoachTrackerDay[] => over.map((o, i) => ({ ...blank(`2026-11-${String(i + 1).padStart(2, '0')}`), ...o }));
  const signals = (over: Partial<CoachSignals>): CoachSignals => ({ share: ALL_ON, today: '2026-11-14', days: null, now: { days: 7 }, before: { days: 7 }, streak: null, lastCheckin: null, projects: null, routine: null, lastReview: null, patterns: [], ...over });

  it('says the founder’s two examples', () => {
    const sleepDays = days([{}, {}, {}, {}, {}, {}, {}, { sleep: 5 }, { sleep: 5 }, { sleep: 5.5 }, { sleep: 5 }, { sleep: 7 }, { sleep: 8 }, { sleep: 7 }]);
    const a = coachSuggestions(signals({ days: sleepDays }));
    expect(a.find((s) => s.id === 'sleep-short')?.text).toBe('Sleep under 6 hours on 4 of 7 nights. Ask what gets in the way.');
    const b = coachSuggestions(signals({ projects: [{ id: 'a', title: 'A', relationship: 'self', pace: 'behind' }, { id: 'b', title: 'B', relationship: 'self', pace: 'behind' }, { id: 'c', title: 'C', relationship: 'guru', pace: 'behind' }] }));
    expect(b.find((s) => s.id === 'projects-behind')?.text).toBe('Three projects behind pace. Pick one with them.');
  });
  it('reads a part only while it is shared', () => {
    const sleepDays = days(Array.from({ length: 14 }, () => ({ sleep: 5 })));
    expect(coachSuggestions(signals({ days: sleepDays, share: off('reflection') })).find((s) => s.part === 'reflection')).toBeUndefined();
    expect(coachSuggestions(signals({ streak: 12, share: off('daily') })).find((s) => s.part === 'daily')).toBeUndefined();
    expect(coachSuggestions(signals({ projects: [{ id: 'a', title: 'A', relationship: 'self', pace: 'behind' }], share: off('pillars') })).find((s) => s.part === 'pillars')).toBeUndefined();
    expect(coachSuggestions(signals({ routine: { kept: 1, minDays: 5 }, share: off('routine') })).find((s) => s.part === 'routine')).toBeUndefined();
  });
  it('offers a task only while Pillars is shared and there is a project', () => {
    const sleepDays = days(Array.from({ length: 14 }, () => ({ sleep: 5 })));
    const projects = [{ id: 'p1', title: 'Rest', relationship: 'self' as const, pace: 'on' as const }];
    expect(coachSuggestions(signals({ days: sleepDays, projects })).find((s) => s.id === 'sleep-short')?.task?.projectId).toBe('p1');
    expect(coachSuggestions(signals({ days: sleepDays, projects, share: off('pillars') })).find((s) => s.id === 'sleep-short')?.task).toBeNull();
    expect(coachSuggestions(signals({ days: sleepDays, projects: [] })).find((s) => s.id === 'sleep-short')?.task).toBeNull();
  });
  it('keeps to the cap, worst first, says no cause, and never reads eating as good or bad', () => {
    const hard = days(Array.from({ length: 14 }, (_, i) => ({ sleep: 5, stress: 5, mood: i < 7 ? 4 : 2, eat: 1 })));
    const list = coachSuggestions(signals({ days: hard, streak: 9, lastCheckin: '2026-11-01', now: { days: 7, overdueAtEnd: 5, tasksDone: 1, notToDoSlipped: 4 }, before: { days: 7, tasksDone: 9 }, routine: { kept: 1, minDays: 5 } }));
    expect(list.length).toBe(MAX_COACH_SUGGESTIONS);
    expect(list[0]!.id).toBe('sleep-short');
    for (const s of list) {
      for (const w of CAUSE_WORDS) {
        expect(s.text.toLowerCase()).not.toContain(w);
        expect(s.note.toLowerCase()).not.toContain(w);
      }
      expect(`${s.text} ${s.note}`).not.toMatch(/\b(eat|ate|food|weight)\b/i);
    }
  });
  it('never says well done for a streak that lapsed', () => {
    const lapsed = coachSuggestions(signals({ streak: 12, lastCheckin: '2026-10-20', today: '2026-11-07' }));
    expect(lapsed.find((s) => s.id === 'streak-good')).toBeUndefined();
    expect(lapsed.find((s) => s.text.startsWith('No check-in for 18 days'))).toBeDefined();
    for (const lastCheckin of ['2026-11-07', '2026-11-06']) expect(coachSuggestions(signals({ streak: 12, lastCheckin, today: '2026-11-07' })).find((s) => s.id === 'streak-good')?.text, lastCheckin).toBe('A 12-day streak. Say well done.');
  });
  it('writes moving plainly, since the student never wrote the word', () => {
    const moving = { id: 'habit-tie:move', key: 'habit-tie' as const, relationship: 'self' as const, headline: '', text: '', basis: '', chart: null, verdict: 'good' as const, title: 'Moving', projectId: null };
    const line = coachSuggestions(signals({ patterns: [moving] }))[0];
    expect(line?.text).toBe('Moving and better days go together. Say you noticed.');
    expect(line?.note).toBe('I noticed moving and your better days seem to go together. Keep it going?');
  });
  it('turns a shared pattern into a line, in the student’s own words', () => {
    const pattern = { id: 'habit-tie:x', key: 'habit-tie' as const, relationship: 'self' as const, headline: '3 vs 2', text: '', basis: '', chart: null, verdict: 'good' as const, title: 'Evening walk', projectId: null };
    expect(coachSuggestions(signals({ patterns: [pattern] }))[0]?.text).toBe('“Evening walk” and better days go together. Say you noticed.');
    const habit = { ...pattern, id: 'habit:self:x', key: 'habit' as const, verdict: null, projectId: 'p9' };
    const said = coachSuggestions(signals({ patterns: [habit], projects: [{ id: 'p9', title: 'Rest', relationship: 'self', pace: 'on' }] }))[0];
    expect(said?.task).toEqual({ title: 'Evening walk', projectId: 'p9', habit: true });
  });
});

describe('what shows on a Coaching page', () => {
  it('reads only known keys and the three states, with no prototype', () => {
    expect(parseCoachSections('{"numbers":"hidden","nope":"open","log":"weird","constructor":"open","__proto__":"open"}')).toEqual({ numbers: 'hidden' });
    expect(parseCoachSections('not json')).toEqual({});
    expect(parseCoachSections(['numbers'])).toEqual({});
    expect(parseCoachSections({ hubLog: 'open' })).toEqual({ hubLog: 'open' });
  });
  it('starts with the most useful few open and the rest folded', () => {
    const open = coachSectionsFor('student', true).filter((s) => coachSectionState(undefined, s.key) === 'open').map((s) => s.key);
    expect(open).toEqual(['numbers', 'charts', 'patterns', 'notes']);
    expect(coachSectionState({ numbers: 'hidden' }, 'numbers')).toBe('hidden');
    expect(coachSectionState({ log: 'open' }, 'log')).toBe('open');
    expect(coachSectionState(undefined, 'unknown')).toBe('open');
  });
  it('gives a coach and someone who is not one their own sections and defaults', () => {
    const coachKeys = coachSectionsFor('hub', true).map((s) => s.key);
    const studentKeys = coachSectionsFor('hub', false).map((s) => s.key);
    expect(coachKeys).toContain('hubStudents');
    expect(coachKeys).not.toContain('hubBecome');
    expect(studentKeys).toContain('hubBecome');
    expect(studentKeys).not.toContain('rosterStreak');
    expect(coachSectionState(undefined, 'hubDirectory', true)).toBe('closed');
    expect(coachSectionState(undefined, 'hubDirectory', false)).toBe('open');
    // A roster's own line is shown or hidden, never folded.
    expect(coachSectionState(undefined, 'rosterSees', true)).toBe('hidden');
    expect(coachSectionState(undefined, 'rosterStreak', true)).toBe('open');
  });
});
