import type { CoachPattern, CoachPeriodNumbers, CoachShare, CoachSharePart, CoachSuggestion, CoachTrackerDay, Insight, InsightKey, InsightPart, PaceStatus, PeriodKind, PeriodNumbers, RelationshipKey } from './index.ts';

// ---------------------------------------------------------------------------
// A coach's report on one student (2026-11-07, the founder: "a detailed report of each student both visually and in other ways to track and
// suggest growth/improvements ... give toggles to each section ... use emergence/suggestions for each student"). A leaf with a subpath
// export (`@kreators/shared/coachReport`, imports only types, its own chunk): the allow-lists of what may reach a coach, the section
// switches, and the rules behind the suggestions. Everything here is a pure function of what the student already shares, so the list of
// what leaves the server is one thing to read and one thing to test.
// ---------------------------------------------------------------------------

/** The periods a coach can pick. */
export const COACH_REPORT_KINDS: readonly PeriodKind[] = ['day', 'week', 'month', 'quarter'];

/**
 * Which of a period's numbers each share part lets through. Nothing else in `PeriodNumbers` ever leaves the server: never the journal,
 * gratitude, money, water, focus, supplements, shop, School, work or community counts, or the kinds of day. Xp by pillar is the Pillars
 * part's (the report's `xpByPillar`), the streak the Daily part's (read from the account, not from a period).
 */
export const COACH_PERIOD_FIELDS = {
  daily: ['tasksDone', 'checkins', 'habitTicks', 'overdueAtEnd', 'notToDoSlipped', 'xp'],
  routine: ['routineDays'],
  reflection: ['moodAvg', 'sleepAvg', 'stressAvg', 'mindfulMin', 'moveMin', 'moveDays', 'eatAvg'],
} as const satisfies Partial<Record<CoachSharePart, readonly (keyof PeriodNumbers)[]>>;

/** A period's numbers with everything stripped that the student's switches do not let through. */
export function coachPeriodNumbers(n: PeriodNumbers, share: CoachShare): CoachPeriodNumbers {
  const out: CoachPeriodNumbers = { days: n.days };
  const copy = <K extends keyof CoachPeriodNumbers & keyof PeriodNumbers>(keys: readonly K[]) => {
    for (const k of keys) out[k] = n[k] as CoachPeriodNumbers[K];
  };
  if (share.daily) copy(COACH_PERIOD_FIELDS.daily);
  if (share.routine) copy(COACH_PERIOD_FIELDS.routine);
  if (share.reflection) copy(COACH_PERIOD_FIELDS.reflection);
  return out;
}

// ---- patterns: the Emerging rules, only over what is shared ----

/**
 * The one list of patterns that can reach a coach. Left out for good: the journal, gratitude, money, Discover, Agency and reviews' saved
 * numbers (they read what a coach never sees), and focus and time blocks (no share part says so).
 */
export const COACH_PATTERN_KEYS: readonly InsightKey[] = ['habit', 'habit-tie', 'pillar-balance', 'best-hours', 'streak-weekday', 'sleep-mood', 'stress-calm', 'slips-sleep', 'routine-tasks', 'move-weekday', 'eat-days'];

/** Which share parts open each thing a pattern reads. Anything not named here never reaches a coach. */
function partOpen(part: InsightPart, s: CoachShare): boolean {
  switch (part) {
    case 'tasks':
      return s.daily || s.pillars;
    case 'xp':
      return s.pillars;
    case 'checkins':
    case 'notToDo':
      return s.daily;
    case 'routine':
      return s.routine;
    case 'wellbeing':
    case 'move':
    case 'eat':
      return s.reflection;
    default:
      return false;
  }
}

/** Words that must never stand outside a quoted task title in a line a coach reads. A last guard: the facts behind a pattern hold none of them. */
const NEVER_SAID = /\b(journal|gratitude|water|spending|money|supplements?|discover)\b/i;
const outsideQuotes = (text: string) => text.replace(/“[^”]*”/g, '');

/**
 * A line written to the person, reworded for their coach. "They" takes the same verb as "you", so only the words change, and whatever
 * the student wrote (a task's title, in curly quotes) stays as they wrote it.
 */
export function coachSays(text: string): string {
  return text
    .split(/(“[^”]*”)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/\byours\b/g, 'theirs')
            .replace(/\bYours\b/g, 'Theirs')
            .replace(/\byour\b/g, 'their')
            .replace(/\bYour\b/g, 'Their')
            .replace(/\byou\b/g, 'they')
            .replace(/\bYou\b/g, 'They'),
    )
    .join('');
}

/**
 * What a coach may read from the Emerging list: only ready patterns on the allowed keys, only when everything they read is shared, and
 * stripped of every action a student's own screen would offer. `forming` is a count of those still being watched, nothing more.
 */
export function coachPatternsFrom(list: readonly Insight[], share: CoachShare): { patterns: CoachPattern[]; forming: number } {
  if (!share.patterns) return { patterns: [], forming: 0 };
  const allowed = list.filter((i) => {
    if (!COACH_PATTERN_KEYS.includes(i.key)) return false;
    // Stress and calm names water among what it can read; a coach's facts hold no water (the guard below would catch a line about it).
    const reads = i.key === 'stress-calm' ? i.reads.filter((r) => r !== 'water') : i.reads;
    return reads.every((r) => partOpen(r, share));
  });
  const ready = allowed.filter((i) => i.state === 'ready' && i.strength > 0 && !NEVER_SAID.test(outsideQuotes(`${i.text} ${i.basis}`)));
  const patterns = ready
    .slice()
    .sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1))
    .map(
      (i): CoachPattern => ({
        id: i.id,
        key: i.key,
        relationship: i.relationship,
        headline: i.headline,
        text: coachSays(i.text),
        basis: coachSays(i.basis),
        chart: i.chart?.kind === 'pair' ? { kind: 'pair', rows: i.chart.rows.map((r) => ({ ...r, label: coachSays(r.label) })) } : i.chart,
        verdict: i.tie?.verdict ?? null,
        title: i.tie?.title ?? i.habit?.title ?? null,
        projectId: share.pillars ? (i.habit?.projectId ?? null) : null,
      }),
    );
  return { patterns, forming: allowed.filter((i) => i.state === 'watching').length };
}

// ---- suggestions: rules over what is shared ----

/** What the suggestion rules read. Each part is null while the student does not share it. */
export interface CoachSignals {
  share: CoachShare;
  today: string;
  /** The tracker days, oldest first, ending today (Reflection). */
  days: readonly CoachTrackerDay[] | null;
  /** The last seven days and the seven before, already through `coachPeriodNumbers`. */
  now: CoachPeriodNumbers;
  before: CoachPeriodNumbers;
  /** Daily. */
  streak: number | null;
  lastCheckin: string | null;
  /** Pillars. */
  projects: readonly { id: string; title: string; relationship: RelationshipKey; pace: PaceStatus }[] | null;
  /** Routine: days kept in the last seven, and what the contract asks. */
  routine: { kept: number; minDays: number | null } | null;
  /** Reflection, while Reviews is on for them: the end of the last weekly or longer review, or null with none. */
  lastReview: { on: boolean; end: string | null } | null;
  /** Through `coachPatternsFrom`: empty while Patterns is off. */
  patterns: readonly CoachPattern[];
}

/** The most a coach is shown at once. */
export const MAX_COACH_SUGGESTIONS = 5;

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const counted = (n: number) => COUNT_WORDS[n] ?? String(n);
const daysApart = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const listed = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const avg = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/**
 * What a coach might do next, from the numbers and patterns the student shares. Rules only, no model, stored nowhere. A task is offered only
 * while Pillars is shared, since a coach writes tasks only then; a line says things happen together, never that one causes another, and
 * never reads eating as good or bad (a low eating number is left alone).
 */
export function coachSuggestions(s: CoachSignals): CoachSuggestion[] {
  const out: (CoachSuggestion & { rank: number })[] = [];
  const canTask = s.share.pillars && (s.projects?.length ?? 0) > 0;
  const firstIn = (rel: RelationshipKey) => s.projects?.find((p) => p.relationship === rel)?.id ?? s.projects?.[0]?.id ?? null;
  const taskIn = (rel: RelationshipKey, title: string, habit = false) => (canTask ? { title, projectId: firstIn(rel), habit } : null);
  const add = (rank: number, x: CoachSuggestion) => out.push({ ...x, rank });

  if (s.days && s.share.reflection) {
    const week = s.days.slice(-7);
    const prior = s.days.slice(-14, -7);
    const sleep = week.filter((d) => d.sleep !== null);
    const short = sleep.filter((d) => (d.sleep ?? 0) < 6).length;
    if (short >= 3)
      add(90, {
        id: 'sleep-short',
        part: 'reflection',
        tone: 'warn',
        text: `Sleep under 6 hours on ${short} of ${sleep.length} nights. Ask what gets in the way.`,
        note: `I noticed sleep under 6 hours on ${short} of the last ${sleep.length} nights you logged. What gets in the way? Is there one small change you want to try this week?`,
        task: taskIn('self', 'Set a lights-out time for this week'),
      });
    const stress = week.filter((d) => d.stress !== null);
    const high = stress.filter((d) => (d.stress ?? 0) >= 4).length;
    if (high >= 3)
      add(85, {
        id: 'stress-high',
        part: 'reflection',
        tone: 'warn',
        text: `Stress at 4 or more on ${high} of ${stress.length} days. Ask what weighs most.`,
        note: `Stress looks high on ${high} of the last ${stress.length} days you logged. What weighs on you most right now? We can look at it together.`,
        task: taskIn('self', 'Breathe for three minutes after lunch'),
      });
    const moodNow = week.flatMap((d) => (d.mood === null ? [] : [d.mood]));
    const moodThen = prior.flatMap((d) => (d.mood === null ? [] : [d.mood]));
    if (moodNow.length >= 3 && moodThen.length >= 3 && avg(moodThen) - avg(moodNow) >= 0.5)
      add(80, {
        id: 'mood-down',
        part: 'reflection',
        tone: 'warn',
        text: `Mood ${one(avg(moodNow))} this week, ${one(avg(moodThen))} the week before. Ask how the week felt.`,
        note: 'Your mood looks a little lower this week than last. How has the week felt to you?',
        task: null,
      });
    const moved = week.filter((d) => d.move > 0).length;
    const movedBefore = s.days.slice(0, -7).filter((d) => d.move > 0).length;
    if (moved === 0 && movedBefore >= 3)
      add(60, {
        id: 'move-none',
        part: 'reflection',
        tone: 'info',
        text: `No movement in 7 days, after ${movedBefore} days moved before that. Ask what changed.`,
        note: 'I noticed no movement logged this week, after a good run before it. What changed? Would a short walk fit somewhere?',
        task: taskIn('self', 'Take a ten-minute walk'),
      });
    if (moved >= 4)
      add(30, {
        id: 'move-good',
        part: 'reflection',
        tone: 'good',
        text: `Moved on ${moved} of 7 days. Say you noticed.`,
        note: `Moved on ${moved} of the last 7 days. I noticed. Well done.`,
        task: null,
      });
  }

  if (s.share.daily) {
    if (s.lastCheckin) {
      const gap = daysApart(s.lastCheckin, s.today);
      if (gap >= 3)
        add(75, {
          id: 'checkin-gap',
          part: 'daily',
          tone: 'info',
          text: `No check-in for ${gap} days. A short note may help.`,
          note: 'Just checking in. How have the last few days been? No need to catch up. One small thing today is plenty.',
          task: null,
        });
    }
    const late = s.now.overdueAtEnd ?? 0;
    if (late >= 3)
      add(70, {
        id: 'overdue',
        part: 'daily',
        tone: 'warn',
        text: `${counted(late)} tasks past their due day. Ask which still matter.`,
        note: `${counted(late)} of your tasks are past their due day. Which still matter? We can move a day or let one go.`,
        task: null,
      });
    const done = s.now.tasksDone ?? 0;
    const was = s.before.tasksDone ?? 0;
    if (was >= 4 && done * 2 <= was)
      add(55, {
        id: 'tasks-down',
        part: 'daily',
        tone: 'info',
        text: `${done} tasks ticked in 7 days, ${was} in the 7 before. Ask how the week went.`,
        note: 'Fewer tasks got ticked this week than last. How did the week go? Is anything in the way?',
        task: null,
      });
    const slips = s.now.notToDoSlipped ?? 0;
    if (slips >= 3)
      add(50, {
        id: 'slips',
        part: 'daily',
        tone: 'info',
        text: `${counted(slips)} slips on the not to do list in 7 days. Ask what those days had in common.`,
        note: 'A few slips on your not to do list this week. What did those days have in common? No blame, just curious.',
        task: null,
      });
    // `streak` is what the account holds, and only a check-in moves it, so a lapsed one earns no well done.
    if ((s.streak ?? 0) >= 7 && s.lastCheckin !== null && daysApart(s.lastCheckin, s.today) <= 1)
      add(25, {
        id: 'streak-good',
        part: 'daily',
        tone: 'good',
        text: `A ${s.streak}-day streak. Say well done.`,
        note: `A ${s.streak}-day streak. Well done. What is helping you keep it going?`,
        task: null,
      });
  }

  if (s.share.pillars && s.projects) {
    const behind = s.projects.filter((p) => p.pace === 'behind');
    if (behind.length >= 1) {
      const names = behind.slice(0, 3).map((p) => `“${p.title}”`);
      const first = behind[0]!;
      add(78, {
        id: 'projects-behind',
        part: 'pillars',
        tone: 'warn',
        text: behind.length === 1 ? `One project behind pace: ${names[0]}. Pick the next step with them.` : `${counted(behind.length)} projects behind pace. Pick one with them.`,
        note: `${behind.length === 1 ? 'This project is' : 'These projects are'} behind pace: ${listed(names)}. Which matters most this week? We can move a due day or drop a task.`,
        task: canTask ? { title: `Pick the next step for ${first.title}`.slice(0, 140), projectId: first.id, habit: false } : null,
      });
    }
  }

  if (s.routine && s.share.routine && s.routine.minDays !== null) {
    if (s.routine.kept < s.routine.minDays)
      add(65, {
        id: 'routine-under',
        part: 'routine',
        tone: 'warn',
        text: `Routine kept ${s.routine.kept} of 7 days. Their contract says ${s.routine.minDays}.`,
        note: `Your routine came in at ${s.routine.kept} of the last 7 days, and your contract says ${s.routine.minDays}. Does the plan still fit your real day?`,
        task: null,
      });
    else
      add(20, {
        id: 'routine-good',
        part: 'routine',
        tone: 'good',
        text: `Routine kept ${s.routine.kept} of 7 days, at or above their contract of ${s.routine.minDays}. Say you noticed.`,
        note: `Your routine came in at ${s.routine.kept} of the last 7 days, at or above your contract. I noticed. Well done.`,
        task: null,
      });
  }

  if (s.lastReview?.on && s.share.reflection) {
    const gap = s.lastReview.end ? daysApart(s.lastReview.end, s.today) : null;
    if (gap !== null && gap >= 21)
      add(40, {
        id: 'review-gap',
        part: 'reflection',
        tone: 'info',
        text: `No weekly or longer review in ${gap} days. Ask for one this week.`,
        note: 'It has been a while since your last review. A short weekly one could help us both see how things are going. Could you write one this week?',
        task: taskIn('self', 'Write this week’s review'),
      });
  }

  for (const p of s.patterns) {
    // Moving is the app's word for the person's own movement, never words they wrote, so it wears no quote marks.
    const moving = !p.title || p.id === 'habit-tie:move';
    const named = moving ? 'Moving' : `“${p.title}”`;
    if (p.verdict === 'good')
      add(45, {
        id: `pattern-good:${p.id}`,
        part: 'patterns',
        tone: 'good',
        text: `${named} and better days go together. Say you noticed.`,
        note: `I noticed ${moving ? 'moving' : named} and your better days seem to go together. Keep it going?`,
        task: null,
      });
    else if (p.verdict === 'bad')
      add(68, {
        id: `pattern-bad:${p.id}`,
        part: 'patterns',
        tone: 'info',
        text: `${named} and harder days go together. Ask how those days go.`,
        note: `I noticed ${named} and your harder days seem to go together. It may be nothing. How do those days feel to you?`,
        task: null,
      });
    else if (p.key === 'habit' && p.title)
      add(35, {
        id: `pattern-habit:${p.id}`,
        part: 'patterns',
        tone: 'info',
        text: `${named} keeps coming back. Offer to make it a habit.`,
        note: `${named} keeps coming back. Want to make it a habit, so it shows up on its own?`,
        task: canTask && p.projectId ? { title: p.title, projectId: p.projectId, habit: true } : null,
      });
  }

  return out
    .sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_COACH_SUGGESTIONS)
    .map(({ rank: _rank, ...x }) => x);
}

// ---- what shows on a Coaching page ----

/** Hidden, shown closed or shown open. Saved on the account, the same for every student. */
export type CoachSectionState = 'open' | 'closed' | 'hidden';

export interface CoachSectionMeta {
  key: string;
  name: string;
  /** The coach's page for one student, or Coaching itself. */
  page: 'student' | 'hub';
  /** Who has it on Coaching: a coach, someone who is not one, or both. */
  who?: 'coach' | 'student';
  /** A roster's own line, not a section: it is shown or hidden, never folded. */
  line?: boolean;
  open: boolean;
  /** Open for someone who is not a coach, when that differs. */
  openForStudent?: boolean;
}

/** Every section a person can switch, with what it starts as: the most useful three or four open, the rest folded. */
export const COACH_SECTIONS: readonly CoachSectionMeta[] = [
  { key: 'numbers', name: 'Report numbers', page: 'student', open: true },
  { key: 'charts', name: 'Charts', page: 'student', open: true },
  { key: 'patterns', name: 'Patterns and suggestions', page: 'student', open: true },
  { key: 'notes', name: 'Notes', page: 'student', open: true },
  { key: 'pillars', name: 'Pillars and pace', page: 'student', open: false },
  { key: 'tasks', name: 'Tasks you added', page: 'student', open: false },
  { key: 'day', name: 'The day', page: 'student', open: false },
  { key: 'routine', name: 'Routine and contract', page: 'student', open: false },
  { key: 'reviews', name: 'Saved reviews', page: 'student', open: false },
  { key: 'map', name: 'Life map answers', page: 'student', open: false },
  { key: 'log', name: 'Change log', page: 'student', open: false },
  { key: 'hubStudents', name: 'Your students', page: 'hub', who: 'coach', open: true },
  { key: 'rosterStreak', name: 'Roster: streak and last check-in', page: 'hub', who: 'coach', line: true, open: true },
  { key: 'rosterRoutine', name: 'Roster: routine days', page: 'hub', who: 'coach', line: true, open: true },
  { key: 'rosterFocus', name: 'Roster: focus pillars', page: 'hub', who: 'coach', line: true, open: true },
  { key: 'rosterSees', name: 'Roster: what each one shares', page: 'hub', who: 'coach', line: true, open: false },
  { key: 'hubAsks', name: 'Asking to be your student', page: 'hub', who: 'coach', open: true },
  { key: 'hubSent', name: 'Waiting for a yes', page: 'hub', who: 'coach', open: false },
  { key: 'hubLine', name: 'Your line in the directory', page: 'hub', who: 'coach', open: false },
  { key: 'hubMine', name: 'Your life coach', page: 'hub', open: false, openForStudent: true },
  { key: 'hubNotes', name: 'Notes from your coach', page: 'hub', open: false, openForStudent: true },
  { key: 'hubDirectory', name: 'Find a life coach', page: 'hub', open: false, openForStudent: true },
  { key: 'hubBecome', name: 'Are you a life coach?', page: 'hub', who: 'student', open: false },
  { key: 'hubLog', name: 'Change log', page: 'hub', open: false },
];

const SECTION_BY_KEY: Readonly<Record<string, CoachSectionMeta>> = (() => {
  const by = Object.create(null) as Record<string, CoachSectionMeta>;
  for (const s of COACH_SECTIONS) by[s.key] = s;
  return by;
})();

/** The one reader of saved section choices: known keys and the three states only (a key a person can send is looked up with no prototype). */
export function parseCoachSections(raw: unknown): Record<string, CoachSectionState> {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw || '{}');
    } catch {
      v = {};
    }
  }
  const out = Object.create(null) as Record<string, CoachSectionState>;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...out };
  for (const [k, state] of Object.entries(v as Record<string, unknown>)) {
    if (SECTION_BY_KEY[k] && (state === 'open' || state === 'closed' || state === 'hidden')) out[k] = state;
  }
  return { ...out };
}

/** How a section shows: the person's choice, else what it starts as. A roster's own line reads open for shown. */
export function coachSectionState(saved: Readonly<Record<string, string>> | undefined, key: string, isCoach = true): CoachSectionState {
  const chosen = saved?.[key];
  if (chosen === 'open' || chosen === 'closed' || chosen === 'hidden') return chosen;
  const meta = SECTION_BY_KEY[key];
  if (!meta) return 'open';
  const open = isCoach ? meta.open : (meta.openForStudent ?? meta.open);
  return open ? 'open' : meta.line ? 'hidden' : 'closed';
}

/** The sections one page offers. */
export const coachSectionsFor = (page: 'student' | 'hub', isCoach: boolean): CoachSectionMeta[] =>
  COACH_SECTIONS.filter((s) => s.page === page && (!s.who || s.who === (isCoach ? 'coach' : 'student')));
