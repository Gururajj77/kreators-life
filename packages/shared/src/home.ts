import { formatCount } from './core.ts';
import type { RelationshipKey } from './core.ts';
import type { LifeAreaKey } from './life.ts';
import { DISCOVER_STRENGTHS, LOVE_LANGUAGES } from './discover.ts';
import type { LoveKey } from './discover.ts';
import { DESIGN_TYPES, STRENGTH_PATH } from './design.ts';
import { MODULES } from './modules.ts';
import type { DiscoverProfile, ExtrasProfile } from './design.ts';

// ---------------------------------------------------------------------------
// Home — one dashboard: results first, then what you did, then where to go.
// ---------------------------------------------------------------------------

export interface HomeDay {
  date: string;
  xp: number;
  tasks: number;
}

export interface HomeFloor {
  relationship: RelationshipKey;
  level: number;
  xp: number;
  /** Progress through the current level, 0 to 1. */
  pct: number;
  built: boolean;
}

export interface HomeUpNext {
  kind: 'event' | 'booking' | 'session' | 'circle' | 'run';
  title: string;
  /** ISO instant. */
  at: string;
  path: string;
  /** For a circle: when the chat opens. */
  note?: string;
}

/** The line under the numbers. Result first, then what did it, then the one next action. */
export interface HomeNudge {
  lead: string;
  body: string;
  action: string;
  path: string;
}

/** The trackers the kit's home lists under the score: each with today's value and a week to draw. */
export interface HomeTrackers {
  score: number;
  label: string;
  /** Mood 1 to 5 per day for the last seven days, oldest first; null when not logged. */
  mood: { today: number | null; week: (number | null)[] };
  sleep: { latest: number | null; avg7: number | null; week: (number | null)[] };
  stress: { latest: number | null; week: (number | null)[] };
  mindful: { minutesWeek: number; week: number[] };
  journal: { entriesMonth: number; streakDays: number; week: boolean[]; /** The last fourteen days, oldest first. */ days14: boolean[] };
}

export interface HomeResponse {
  date: string;
  trackers: HomeTrackers;
  /** The companion card: how many messages the person has sent. */
  companion: { messages: number };
  /** Two recent pieces from Knowledge for the resource cards. */
  resources: { id: string; title: string; kind: string; tag: string }[];
  today: {
    checkedIn: boolean;
    sparkDone: boolean;
    sparkRelationship: RelationshipKey;
    taskDone: boolean;
    tasksWaiting: number;
    /** Open tasks marked Unfinished, Unresolved or Undecided, for the count on Close the unfinished (2026-11-07). */
    openBusiness?: number;
    streak: number;
    doneCount: number;
  };
  xp: { total: number; today: number; week: number; level: number; into: number; span: number };
  points: number;
  /** The last fourteen days, oldest first. */
  days: HomeDay[];
  /** Where the last fourteen days of xp came from. */
  xpBySource: { source: 'checkin' | 'spark' | 'task' | 'ripple' | 'other'; xp: number }[];
  floors: HomeFloor[];
  life: { overall: number; label: string; areas: { key: LifeAreaKey; score: number; trend: number }[] } | null;
  money: { currency: string; incomeCents: number; expenseCents: number; owedToMeCents: number; iOweCents: number; overdueInvoices: number; dueSoon: number } | null;
  shop: { products: number; ordersMonth: number; pointsMonth: number; centsMonth: number; currency: string; views: number; followers: number; days: { date: string; orders: number }[] } | null;
  upNext: HomeUpNext[];
  unread: number;
  nudge: HomeNudge;
}

export interface NudgeInput {
  checkedIn: boolean;
  sparkDone: boolean;
  taskDone: boolean;
  tasksWaiting: number;
  /** True when at least one floor has a pillar. */
  hasFloor: boolean;
  xpToday: number;
  streak: number;
  /** Local hour, 0 to 23. */
  hour: number;
}

/**
 * The line under the numbers follows one rule: show the result first, then what did it,
 * then the one thing to do next, and say what it will not work without.
 */
export function nudgeFor(s: NudgeInput): HomeNudge {
  const evening = s.hour >= 18;
  if (s.checkedIn && s.sparkDone && s.taskDone) {
    return {
      lead: `All three done. +${s.xpToday} xp today.`,
      body: 'Here is what that did. The task made its whole pyramid stronger. The small act lifted your weakest pillar. The check-in kept your streak. One thing makes tomorrow easier: put a time on tomorrow’s task.',
      action: 'Set a time on tomorrow’s task',
      path: '/tower',
    };
  }
  if (!s.checkedIn) {
    if (evening) {
      return {
        lead: s.xpToday > 0 ? `+${s.xpToday} xp today, but no check-in yet.` : 'Nothing ticked yet today.',
        body: 'Most people think a missed day is lost. It is not, until midnight. The streak does not need a good day, it needs one tick, and the check-in is the easiest box on the screen.',
        action: 'Check in before midnight',
        path: '/today',
      };
    }
    return {
      lead: s.streak > 0 ? `Day ${s.streak + 1} is waiting.` : 'Zero so far. That is the normal start.',
      body: 'It is not the plan and it is not the points. It is the first tick. Check in, and the other two boxes get easier. But it only counts if you tick it today.',
      action: 'Check in',
      path: '/today',
    };
  }
  if (!s.sparkDone) {
    return {
      lead: `+${s.xpToday} xp banked from the check-in.`,
      body: 'Here is the better way to spend the next two minutes. Not the biggest task. The small act. It goes straight to your weakest area, the one holding your level down.',
      action: 'Do the small act',
      path: '/today',
    };
  }
  if (!s.hasFloor) {
    return {
      lead: `+${s.xpToday} xp today, two boxes down.`,
      body: 'The third box cannot show up yet. Daily only gives you tasks from a pillar you have set up. So this will not work until one pillar exists. Set one up and tomorrow’s task is already waiting.',
      action: 'Set up a pillar',
      path: '/tower',
    };
  }
  if (s.tasksWaiting === 0) {
    return {
      lead: `+${s.xpToday} xp today, two boxes down.`,
      body: 'No task is due today. That is not a rest day. It is a gap. Add one task with a date and a time to any pillar and the third box shows up on Daily.',
      action: 'Add a task',
      path: '/tower',
    };
  }
  return {
    lead: `+${s.xpToday} xp today, two boxes down.`,
    body: `Here is the better way to finish: not the biggest task, the one with a time on it. ${s.tasksWaiting === 1 ? 'One task is' : `${s.tasksWaiting} tasks are`} waiting. Nothing moves until one is ticked.`,
    action: 'Tick a task',
    path: '/today',
  };
}

// ---------------------------------------------------------------------------
// The daily brief, after Circle's: three signals (what changed) and three next steps (what to do about it), worked
// out by rules from the person's own numbers, so it costs no credits and says nothing it cannot back. Coaches get
// lines about their students, and the team lines about what waits for them.
// ---------------------------------------------------------------------------

export type BriefTone = 'good' | 'watch' | 'neutral';
export interface BriefLine {
  key: string;
  text: string;
  /** Where to act on it, an in-app path. */
  to: string | null;
  tone: BriefTone;
}
export interface DailyBrief {
  signals: BriefLine[];
  actions: BriefLine[];
  /** For a life coach: their students. Null for everyone else. */
  coach: BriefLine[] | null;
  /** For staff and admins: what waits for the team. Null for everyone else. */
  team: BriefLine[] | null;
}

/** What the brief is worked out from: the person's own numbers for their own today. */
export interface BriefFacts {
  hour: number;
  checkedIn: boolean;
  streak: number;
  bestStreak: number;
  level: number;
  xpToNext: number;
  tasksDue: number;
  tasksOverdue: number;
  doneWeek: number;
  doneWeekBefore: number;
  smallActDone: boolean;
  notToDoSlipped: number;
  /** Routine days kept in the last seven, and the contract's days, when there is a routine. */
  routineWeek: number | null;
  contractDays: number | null;
  sleepAvg: number | null;
  sleepAvgBefore: number | null;
  moodAvg: number | null;
  moodAvgBefore: number | null;
  stressAvg: number | null;
  /** The next event someone signed up for in the next two days. */
  nextEvent: { title: string; when: string; to: string } | null;
  coachNotes: number;
  coachAsks: number;
  reviewDue: boolean;
  /** The first day of the week the review is due for (last week), so the step opens that week, not the one running. */
  reviewWeek?: string;
  /** The apps that are on, so a step never points at one that is off. */
  apps: readonly string[];
  /** What Discover taught the app, when the person took it and allows next steps to use it. profile is null when they have not, or switched it off. */
  discover?: { taken: boolean; profile: DiscoverProfile | null; extras?: ExtrasProfile | null };
  /**
   * Agency, read only while Agency is on: changes clients asked for that still wait (a piece sent back to making, with its
   * `change` note in the last fortnight), `changeClientId` when they are all one client's; and a retainer month made today.
   */
  agency?: {
    changeAsks: number;
    changeClientId: string | null;
    monthMade: { clientId: string; clientName: string; n: number } | null;
    /** Pieces due on the person's day (or before) and not yet approved, and the client when they are all one client's. */
    piecesDueToday?: number;
    piecesClientId?: string | null;
    /** Sent invoices past their due day. */
    invoicesOverdue?: number;
    /** Retainers a client chose that wait for the owner to confirm, and the client when there is one. */
    retainerChosen?: { clientId: string; clientName: string } | null;
    retainersChosen?: number;
    /** Agreements sent and not yet signed. */
    agreementsUnsigned?: number;
  };
  /** Unread lines in the channels the person is in (Community and Bond, only the apps that are on), and `to` when they are all in one channel. */
  channels?: { unread: number; to: string | null };
  /**
   * Fitness and Kreators Run (2026-11-07), read only while one of them is on: whether movement is logged on the person's day, and the active
   * minutes of the last seven days. `eatToday` only while Fitness is on: whether the day's eating check-in is done.
   */
  move?: { today: boolean; week: number };
  eatToday?: boolean;
  /** Journal (2026-11-07), only while it is on: whether today's gratitude has any line written. Never a word of it. */
  gratitudeToday?: boolean;
}

const BRIEF_SIZE = 3;
/** Active minutes in seven days the brief calls a good week (Fitness's MOVE_WEEK_TARGET, kept here so the brief does not load Fitness's words). */
export const BRIEF_MOVE_WEEK = 150;
/** Hours of sleep a night (the week's average) under which the brief suggests a Yourself pillar step. */
export const BRIEF_SLEEP_LOW = 6.5;
/** The week's average mood (1 to 5) at or under which the brief suggests a Friends pillar step. */
export const BRIEF_MOOD_LOW = 2.5;
/** Daily's Past due tab, where a task past its day is moved or finished. */
const PAST_DUE = '/today?taskTab=pastdue#tasks-heading';
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const one1 = (n: number) => Math.round(n * 10) / 10;

/** The one rule for the brief: every line that applies, ranked, the top three of each. */
/**
 * The brief's one link check: a path that lies inside an app (the longest app path it starts with) keeps its link only while that app is
 * on; a locked app (Daily, Pillars, Home) is always on, and a path outside every app (`/you`, `/realm/...`) is left alone.
 */
export function briefPath(to: string | null, apps: readonly string[]): string | null {
  if (!to) return null;
  const path = to.split(/[?#]/)[0]!;
  let owner: (typeof MODULES)[number] | null = null;
  for (const m of MODULES) if ((path === m.path || path.startsWith(`${m.path}/`)) && (!owner || m.path.length > owner.path.length)) owner = m;
  return !owner || owner.locked || apps.includes(owner.key) ? to : null;
}

export function briefFor(f: BriefFacts): { signals: BriefLine[]; actions: BriefLine[] } {
  const on = (app: string) => f.apps.includes(app);
  const signals: (BriefLine & { rank: number })[] = [];
  const actions: (BriefLine & { rank: number })[] = [];
  // A line never points at an app that is off: a path inside an app the person switched off (or cannot have) loses its link and keeps its words.
  const sig = (rank: number, key: string, tone: BriefTone, text: string, to: string | null) => signals.push({ rank, key, tone, text, to: briefPath(to, f.apps) });
  const act = (rank: number, key: string, text: string, to: string | null) => actions.push({ rank, key, tone: 'neutral', text, to: briefPath(to, f.apps) });

  if (!f.checkedIn && f.streak >= 3 && f.hour >= 17) sig(100, 'streak-risk', 'watch', `Your ${f.streak}-day streak ends tonight unless you check in.`, '/today');
  else if (f.checkedIn && f.streak >= 3 && f.streak >= f.bestStreak) sig(70, 'streak-best', 'good', `A new best: ${plural(f.streak, 'day')} in a row.`, '/today');
  else if (f.streak >= 3) sig(40, 'streak', 'good', `${plural(f.streak, 'day')} in a row so far.`, '/today');
  if (f.tasksOverdue > 0) sig(90, 'overdue', 'watch', `${plural(f.tasksOverdue, 'task')} ${f.tasksOverdue === 1 ? 'is' : 'are'} past ${f.tasksOverdue === 1 ? 'its' : 'their'} day.`, PAST_DUE);
  if (f.doneWeekBefore > 0 && f.doneWeek > f.doneWeekBefore) sig(60, 'tasks-up', 'good', `${plural(f.doneWeek, 'task')} ticked these seven days, ${f.doneWeek - f.doneWeekBefore} more than the seven before.`, '/today');
  else if (f.doneWeekBefore > 0 && f.doneWeek < f.doneWeekBefore) sig(65, 'tasks-down', 'watch', `${plural(f.doneWeek, 'task')} ticked these seven days, ${f.doneWeekBefore - f.doneWeek} fewer than the seven before.`, '/today');
  if (f.sleepAvg !== null && f.sleepAvgBefore !== null && Math.abs(f.sleepAvg - f.sleepAvgBefore) >= 0.5)
    sig(f.sleepAvg < f.sleepAvgBefore ? 80 : 50, 'sleep', f.sleepAvg < f.sleepAvgBefore ? 'watch' : 'good', `Sleep is ${f.sleepAvg < f.sleepAvgBefore ? 'down' : 'up'} to ${one1(f.sleepAvg)} hours a night, from ${one1(f.sleepAvgBefore)}.`, on('sleep') ? '/sleep' : null);
  if (f.moodAvg !== null && f.moodAvgBefore !== null && Math.abs(f.moodAvg - f.moodAvgBefore) >= 0.5)
    sig(f.moodAvg < f.moodAvgBefore ? 75 : 45, 'mood', f.moodAvg < f.moodAvgBefore ? 'watch' : 'good', `Your mood is ${f.moodAvg < f.moodAvgBefore ? 'lower' : 'brighter'} this week than last.`, on('mood') ? '/mood' : null);
  if (f.stressAvg !== null && f.stressAvg >= 4) sig(85, 'stress', 'watch', 'Stress has been high most of this week.', on('stress') ? '/stress' : null);
  if (f.notToDoSlipped > 0) sig(55, 'slipped', 'watch', `You slipped on ${plural(f.notToDoSlipped, 'not to do item')} yesterday. Today is a fresh start.`, '/today#ntd-heading');
  if (f.routineWeek !== null && f.contractDays !== null)
    sig(f.routineWeek < f.contractDays ? 58 : 35, 'routine', f.routineWeek < f.contractDays ? 'watch' : 'good', `Routine: ${f.routineWeek} of the last 7 days, against a deal of ${f.contractDays}.`, '/today#routine');
  if (f.nextEvent) sig(68, 'event', 'neutral', `${f.nextEvent.title} is ${f.nextEvent.when}.`, f.nextEvent.to);
  if (f.coachNotes > 0) sig(72, 'coach-note', 'neutral', f.coachNotes === 1 ? 'Your life coach left you a note.' : `Your life coach left you ${f.coachNotes} notes.`, on('coaching') ? '/coaching' : '/you#coach');
  if (f.coachAsks > 0) sig(74, 'coach-ask', 'neutral', f.coachAsks === 1 ? 'A life coach asked to work with you.' : `${f.coachAsks} life coaches asked to work with you.`, '/you#coach');
  const ag = on('agency') ? f.agency : undefined;
  const agTo = ag?.changeClientId ? `/agency/${ag.changeClientId}` : '/agency';
  if (ag && ag.changeAsks > 0) sig(78, 'agency-change', 'watch', ag.changeAsks === 1 ? 'A client asked for a change to a piece.' : `Clients asked for ${ag.changeAsks} changes to pieces.`, agTo);
  if (ag?.retainersChosen && ag.retainersChosen > 0)
    sig(82, 'agency-retainer', 'watch', ag.retainersChosen === 1 && ag.retainerChosen ? `${ag.retainerChosen.clientName} chose a retainer. Confirm it to start.` : `${plural(ag.retainersChosen, 'client')} chose a retainer. Confirm to start.`, ag.retainersChosen === 1 && ag.retainerChosen ? `/agency/${ag.retainerChosen.clientId}` : '/agency');
  if (ag?.piecesDueToday && ag.piecesDueToday > 0) sig(76, 'agency-due', 'watch', `${plural(ag.piecesDueToday, 'piece')} for clients ${ag.piecesDueToday === 1 ? 'is' : 'are'} due today or late.`, ag.piecesClientId ? `/agency/${ag.piecesClientId}` : '/today');
  if (ag?.invoicesOverdue && ag.invoicesOverdue > 0) sig(73, 'agency-invoice', 'watch', `${plural(ag.invoicesOverdue, 'invoice')} ${ag.invoicesOverdue === 1 ? 'is' : 'are'} past due.`, '/agency?tab=invoices');
  if (ag?.agreementsUnsigned && ag.agreementsUnsigned > 0) sig(52, 'agency-agreement', 'neutral', `${plural(ag.agreementsUnsigned, 'agreement')} sent and not signed yet.`, '/agency?tab=agreements');
  if (ag?.monthMade) sig(62, 'agency-month', 'good', `Month ${ag.monthMade.n} for ${ag.monthMade.clientName} is set up: its pieces and its invoice.`, `/agency/${ag.monthMade.clientId}`);
  const ch = on('community') || on('bond') ? f.channels : undefined;
  if (ch && ch.unread > 0) sig(42, 'channels', 'neutral', `${plural(ch.unread, 'new line')} in your channels.`, ch.to ?? (on('community') ? '/community?tab=channels' : '/bond#bond-channels'));
  // Fitness and Kreators Run: a good week of movement is said; the person's own numbers, for their own brief.
  const mv = on('fitness') || on('run') ? f.move : undefined;
  const moveTo = on('fitness') ? '/fitness#move-heading' : '/run?tab=tracking';
  if (mv && mv.week >= BRIEF_MOVE_WEEK) sig(44, 'move-week', 'good', `${formatCount(mv.week)} active minutes these seven days.`, moveTo);
  sig(10, 'level', 'neutral', `Level ${f.level}. ${f.xpToNext} xp to the next one.`, '/you');

  if (!f.checkedIn) act(100, 'checkin', 'Check in on Daily. It keeps your streak.', '/today#show-heading');
  if (f.tasksDue > 0) act(90, 'task', f.tasksDue === 1 ? 'Tick today’s task.' : `Tick one of today’s ${f.tasksDue} tasks.`, '/today#tasks-heading');
  if (!f.smallActDone) act(80, 'act', 'Do today’s small act. It takes a minute.', '/today#spark-heading');
  if (f.coachAsks > 0) act(88, 'coach-ask', 'Answer the coach who asked: yes or no, on your Profile tab.', '/you#coach');
  if (f.coachNotes > 0 && on('coaching')) act(76, 'coach-note', 'Read your coach’s note.', '/coaching');
  if (ag && ag.changeAsks > 0) act(74, 'agency-change', ag.changeAsks === 1 ? 'Make the change your client asked for, then send it back.' : 'Work through the changes your clients asked for.', agTo);
  if (ag?.retainersChosen && ag.retainersChosen > 0) act(86, 'agency-retainer', 'Confirm the retainer your client chose, so its first month is made.', ag.retainersChosen === 1 && ag.retainerChosen ? `/agency/${ag.retainerChosen.clientId}` : '/agency');
  if (ag?.piecesDueToday && ag.piecesDueToday > 0) act(78, 'agency-due', ag.piecesDueToday === 1 ? 'Finish the client piece due today and send it for review.' : 'Work through the client pieces due today, oldest first.', '/today');
  if (ag?.invoicesOverdue && ag.invoicesOverdue > 0) act(68, 'agency-invoice', 'Remind the client about the late invoice, or mark it paid.', '/agency?tab=invoices');
  if (f.tasksOverdue > 0) act(70, 'overdue', 'Move or finish the tasks past their day.', PAST_DUE);
  if (f.reviewDue && on('reviews')) act(65, 'review', 'Write last week’s review. Five minutes, and the numbers are filled in.', f.reviewWeek ? `/reviews?kind=week&date=${f.reviewWeek}#review-heading` : '/reviews');
  if (f.stressAvg !== null && f.stressAvg >= 4 && on('mindful')) act(72, 'breathe', 'Take five minutes with the breathing timer.', '/mindful');
  if (f.sleepAvg !== null && f.sleepAvgBefore !== null && f.sleepAvg < f.sleepAvgBefore - 0.5 && on('sleep')) act(60, 'sleep', 'Log tonight’s sleep, and aim for lights out on time.', '/sleep');
  if (f.nextEvent) act(55, 'event', `Check the plan for ${f.nextEvent.title}.`, f.nextEvent.to);
  // Wellbeing feeds the pillars (the owner's own numbers, for the owner's own brief): a short-sleep week, a low mood week or a high-stress
  // week each suggest one step in the pillar that looks after it. Rules only; the numbers never leave this brief.
  if (f.sleepAvg !== null && f.sleepAvg < BRIEF_SLEEP_LOW) act(57, 'pillar-sleep', `Under ${BRIEF_SLEEP_LOW} hours a night. Add a set lights-out task to Yourself.`, '/realm/self');
  if (f.moodAvg !== null && f.moodAvg <= BRIEF_MOOD_LOW) act(56, 'pillar-mood', 'A low mood week. Add a task to Friends: call one friend.', '/realm/friendship');
  if (f.stressAvg !== null && f.stressAvg >= 4 && !on('mindful')) act(56, 'pillar-stress', 'Stress is high. Add a task to Yourself: ten minutes outside daily.', '/realm/self');
  // Next steps that emerge from what Discover learned about this person: their quietest strength, and the shape of their traits.
  const d = f.discover;
  if (d && !d.taken && on('discover')) act(48, 'discover', 'Take the Discover quiz, so your next steps fit you.', '/discover');
  if (d?.profile) {
    const p = d.profile;
    const grow = DISCOVER_STRENGTHS[p.growth];
    act(58, 'strength-grow', `Your quietest strength is ${grow.name}. ${grow.tryThis}`, STRENGTH_PATH[p.growth]);
    if (p.bands.c === 'low') act(66, 'style-small', 'Pick one task and finish only that today.', '/today');
    if (p.bands.s === 'low' && on('mindful')) act(64, 'style-calm', 'Take two minutes with the breathing timer before your hardest task.', '/mindful');
    if (p.bands.e === 'high') act(52, 'style-people', 'Do one step with a friend, a circle or a run today.', on('circles') ? '/circles' : null);
    if (p.bands.o === 'high') act(50, 'style-new', 'Try one new thing in your pillars today, even a small one.', '/tower');
    if (p.eq?.a === 'low' && on('journal')) act(54, 'eq-name', 'Write one line on how you feel and what set it off.', '/journal');
    if (p.eq?.m === 'low' && on('mindful')) act(63, 'eq-calm', 'Before you answer a message that stung, take five slow breaths.', '/mindful');
    if (p.eq?.e === 'low') act(51, 'eq-ask', 'Ask one person how they are today, then listen without fixing.', null);
    sig(30, 'strength', 'good', `Your strongest strength is ${DISCOVER_STRENGTHS[p.top[0]!].name}. Use it today.`, STRENGTH_PATH[p.top[0]!]);
  }
  // And from the self-checks: the four letters of a type, how they give and receive love, and (only when they switched it on) how their mind works.
  const x = d?.extras;
  if (x) {
    if (x.type?.includes('I')) act(49, 'type-quiet', 'Block one quiet hour for your hardest task, with no messages.', '/today');
    if (x.type?.includes('J')) act(47, 'type-plan', 'Plan tomorrow’s three tasks tonight, so you can relax.', '/today');
    if (x.type?.includes('P')) act(47, 'type-finish', 'Give one task a finish time today.', '/today');
    if (x.type?.includes('N')) act(46, 'type-steps', 'Turn one big idea into three small steps in Pillars.', '/tower');
    if (x.design) act(48, 'design-strategy', `Today’s practice from your Human design: ${DESIGN_TYPES[x.design.type].strategy.charAt(0).toLowerCase()}${DESIGN_TYPES[x.design.type].strategy.slice(1)}.`, '/discover?more=design');
    if (x.love) {
      const give = x.love.give[0]!;
      const GIVE: Record<LoveKey, string> = {
        words: 'Tell someone today what you like about them.',
        time: 'Give one person ten minutes of full attention today, phone away.',
        gifts: 'Do one small kind thing for someone today, like a note.',
        acts: 'Do one favour for someone today without being asked.',
        touch: 'Give someone a hug today, if they like those.',
      };
      act(45, 'love-give', GIVE[give], null);
      if (!x.love.receive.some((k) => x.love!.give.includes(k))) act(44, 'love-ask', `Tell someone you feel cared for through ${LOVE_LANGUAGES[x.love.receive[0]!].name.toLowerCase()}.`, null);
    }
    if (x.mind) {
      if (x.mind.att !== 'few') act(62, 'mind-att', 'Split one task into three subtasks, then focus 15 minutes on one.', on('mindful') ? '/mindful' : '/today');
      if (x.mind.ene !== 'few') act(53, 'mind-ene', 'Stand up and move for two minutes before a long task.', null);
      if (x.mind.pat !== 'few') act(53, 'mind-pat', 'Plan tomorrow tonight, so a change of plan feels smaller.', '/today');
    }
  }
  // Fitness, Kreators Run and Journal (2026-11-07): log a walk on a day with no movement yet, do the eating check-in in the evening, and
  // write the day's gratitude, each only while its app is on and only when it is not done.
  if (mv && !mv.today && f.hour >= 12) act(54, 'move', 'No movement logged today. Go for a short walk, then log it.', moveTo);
  if (on('fitness') && f.eatToday === false && f.hour >= 18) act(47, 'eat', 'Do your eating check-in: how did you eat today?', '/fitness#eat-heading');
  if (on('journal') && f.gratitudeToday === false && f.hour >= 12) act(46, 'gratitude', 'Write three things you are grateful for today.', '/journal#gratitude-heading');
  act(20, 'pillar', 'Add a task to the pillar you want to grow.', '/tower');
  if (on('journal')) act(15, 'journal', 'Write one line in your journal about today.', '/journal');

  const top = (xs: (BriefLine & { rank: number })[]) =>
    xs
      .sort((a, b) => b.rank - a.rank)
      .slice(0, BRIEF_SIZE)
      .map(({ rank: _r, ...line }) => line);
  return { signals: top(signals), actions: top(actions) };
}

// ---------------------------------------------------------------------------
// Getting started: a short list on Home for the first two weeks, ticked by what the person actually does, never by
// a tap on the list. It pays nothing; it points the way. It folds away once every item is done, after two weeks, or
// when the person folds it.
// ---------------------------------------------------------------------------

export const GETTING_STARTED = [
  { key: 'checkin', label: 'Check in on Daily', to: '/today#show-heading' },
  { key: 'task', label: 'Tick your first task', to: '/today#tasks-heading' },
  { key: 'act', label: 'Do a small act', to: '/today#spark-heading' },
  { key: 'interests', label: 'Pick two interests', to: '/profile#interests' },
  { key: 'handle', label: 'Choose your username', to: '/profile#username' },
  { key: 'people', label: 'Join a circle, an event or a run club', to: '/apps' },
  { key: 'session', label: 'Take the strategy session', to: '/session' },
] as const;
export type GettingStartedKey = (typeof GETTING_STARTED)[number]['key'];
export const GETTING_STARTED_DAYS = 14;
export interface GettingStarted {
  items: { key: GettingStartedKey; label: string; to: string; done: boolean }[];
  done: number;
  /** Shown while some item is open and the account is under GETTING_STARTED_DAYS old. */
  show: boolean;
  /** The person folded it into the small toggle. It stays one tap from open again. */
  folded: boolean;
}
export function gettingStarted(done: Partial<Record<GettingStartedKey, boolean>>, ageDays: number, folded: boolean): GettingStarted {
  const items = GETTING_STARTED.map((g) => ({ key: g.key, label: g.label, to: g.to, done: Boolean(done[g.key]) }));
  const n = items.filter((i) => i.done).length;
  return { items, done: n, show: ageDays < GETTING_STARTED_DAYS && n < items.length, folded };
}

/** "Good morning", by the local hour. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
