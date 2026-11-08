import type { Page, RelationshipKey } from './core.ts';
import type { Node, NotToDo } from './api.ts';
import type { NodeKind } from './pillars.ts';
import type { Review } from './periods.ts';
import type { BadgeRole } from './roles.ts';
import type { WellbeingSummary } from './wellbeing.ts';
import type { Assessment, Contract, RoutineBlock, RoutineDay } from './session.ts';
import type { Period, PeriodNumbers, ReviewLayer } from './periods.ts';
import type { InsightChart, InsightKey } from './index.ts';
import type { Priority, ProjectPace, Repeat } from './tasks.ts';

// ---------------------------------------------------------------------------
// Life coaches. The team makes someone a life coach (the coach permission, which a creator can hold, and the Life
// coach badge). A coach works only with students who said yes: they see the parts of a student's progress the
// student shares, leave notes, and add or edit tasks; every step lands in a change log both of them see. A link
// starts three ways: a coach (or an admin) asks and the student says yes, a student asks and the coach says yes, or
// an admin links the two. Either side can end it. The journal never reaches a coach.
// ---------------------------------------------------------------------------

/**
 * The six parts of a student's progress a coach can see. Each is the student's own switch. Patterns (2026-11-07) is the one part an
 * absent value reads as off: a link made before it never said yes to it. A link made from then on starts with all six on
 * (`NEW_LINK_SHARE`), and the student sees each switch when they say yes.
 */
export const COACH_SHARE_PARTS = ['daily', 'pillars', 'routine', 'lifeMap', 'reflection', 'patterns'] as const;
export type CoachSharePart = (typeof COACH_SHARE_PARTS)[number];
export type CoachShare = Record<CoachSharePart, boolean>;
/** What a stored share reads as when a part is not in it: on, but Patterns off. */
export const DEFAULT_COACH_SHARE: CoachShare = { daily: true, pillars: true, routine: true, lifeMap: true, reflection: true, patterns: false };
/** What a new link starts with (2026-11-07): every part on, Patterns too. */
export const NEW_LINK_SHARE: CoachShare = { ...DEFAULT_COACH_SHARE, patterns: true };
export const COACH_SHARE_META: Record<CoachSharePart, { name: string; blurb: string }> = {
  daily: { name: 'Daily and streaks', blurb: 'Check-ins, streaks, xp, the tasks you ticked (habits too), the day’s tasks, the small act and your not to do list.' },
  pillars: { name: 'Pillars and pyramids', blurb: 'Every layer of your pyramids, how each project keeps pace, and the layer a saved review walks. With this on, your coach can add and edit tasks.' },
  routine: { name: 'Routine and contract', blurb: 'Your routine, the days you kept it, and the deal you signed.' },
  lifeMap: { name: 'Life map answers', blurb: 'Where each pillar sits on the map, your scores, your fears and what weighs on you.' },
  reflection: { name: 'Reflection', blurb: 'Mood, sleep, stress, mindful minutes, movement (minutes, days and kinds), how you ate (1 to 5) and the answers in your saved reviews. Never your journal, gratitude, supplements or a note.' },
  patterns: { name: 'Patterns', blurb: 'Patterns the app finds only in the parts above that you share, by plain rules, kept nowhere. Never from your journal, gratitude, money, water, supplements or a note. With this off, your coach still gets plain tips from the numbers you share.' },
};
/** The one reader for what a student shares: known parts as true or false, over the defaults. */
export function parseCoachShare(raw: unknown): CoachShare {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw || '{}');
    } catch {
      v = {};
    }
  }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_COACH_SHARE };
  for (const k of COACH_SHARE_PARTS) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  return out;
}

/** Coaches a student can have at once, linked or asked. */
export const MAX_COACHES = 3;
/** Asks a coach can have waiting at once. */
export const MAX_COACH_ASKS = 20;
/** After a no, the same coach and student wait this long before either asks again. */
export const COACH_ASK_AGAIN_DAYS = 30;
export const COACH_NOTE_MAX = 1000;
export const COACH_ABOUT_MAX = 280;

export type CoachLinkStatus = 'pending' | 'active' | 'declined' | 'ended';
export type CoachAskedBy = 'coach' | 'student' | 'admin';

/** Someone on the other side of a link: a name, a handle and the badge. Never an email, a phone or a birthday. */
export interface CoachPerson {
  id: string;
  name: string;
  handle: string | null;
  badge: BadgeRole;
}

export interface CoachLink {
  id: string;
  coach: CoachPerson;
  student: CoachPerson;
  status: CoachLinkStatus;
  askedBy: CoachAskedBy;
  /** What the student shares with this coach. */
  share: CoachShare;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  /** The coach asked this student to turn Patterns on (at most once a week). */
  patternsAskedAt: string | null;
}

export interface CoachNote {
  id: string;
  linkId: string;
  coachName: string;
  body: string;
  /** Written by the person reading it. */
  mine: boolean;
  createdAt: string;
}

export type CoachLogAction = 'link.ask' | 'link.yes' | 'link.no' | 'link.end' | 'link.admin' | 'link.join' | 'share.change' | 'patterns.ask' | 'note.add' | 'note.remove' | 'task.add' | 'task.edit' | 'invite.renew' | 'invite.close' | 'invite.email';
/** One line of the change log: who did what, in plain words, and when. */
export interface CoachLogEntry {
  id: string;
  action: CoachLogAction;
  label: string;
  actorName: string;
  coachName: string;
  studentName: string;
  createdAt: string;
}

/** One student on a coach's roster. Each number is there only when the student shares the part it comes from. */
export interface CoachRosterRow {
  linkId: string;
  student: CoachPerson;
  since: string;
  share: CoachShare;
  streak: number | null;
  lastCheckin: string | null;
  /** The routine's last seven days: kept, missed, or no record. */
  week: (boolean | null)[] | null;
  contractDays: number | null;
  /** Last week (Monday to Sunday) came in under the contract's days. */
  redWeek: boolean | null;
  focus: RelationshipKey[] | null;
}

export interface CoachProfile {
  about: string;
  /** Open to new students: the directory lists only open coaches. */
  open: boolean;
  /** Asked the team to be made a life coach, and still waiting. */
  askedAt: string | null;
}

/** The Coaching page for a coach: their profile, their students a page at a time, and the asks either way. */
export interface CoachHub {
  coach: boolean;
  profile: CoachProfile;
  /** How many students, asks to answer and asks still out, over every page. */
  counts: { students: number; asks: number; sent: number };
  students: CoachRosterRow[];
  studentsPage: Page;
  /** Students who asked this coach, a page at a time. */
  asks: CoachLink[];
  asksPage: Page;
  /** This coach's own asks and the team's, still waiting, a page at a time. */
  sent: CoachLink[];
  sentPage: Page;
  /** The coach's invite link's token while it is open, else null. Only the coach ever reads it. */
  invite: string | null;
  /** A coach's first steps, each ticked by doing it. Null for someone who is not a coach. */
  steps: { line: boolean; invited: boolean; sharing: boolean } | null;
}

/** What the box on Coaching read as it was typed. An email is never looked up until it is sent; a blocked person reads like nobody. */
export interface CoachLookup {
  read: 'none' | 'email' | 'username' | 'code';
  person: { name: string; handle: string | null; avatarUrl: string; badge: BadgeRole } | null;
}

/** What Send answers: the ask, or for an email with no account the invite it sent (the address masked), in the same words whoever it was. */
export interface CoachAskResult {
  link?: CoachLink;
  invited?: { to: string; sent: boolean };
}

/** The join card behind an invite link. */
export interface CoachJoinCard {
  coach: CoachPerson;
  about: string;
}
/** The same for someone signed in, with where they stand with this coach. */
export interface CoachJoinState extends CoachJoinCard {
  state: 'new' | 'waiting' | 'linked' | 'self';
}

export interface CoachDirectoryEntry {
  coach: CoachPerson;
  about: string;
  students: number;
  /** Where the viewer stands with this coach. */
  mine: CoachLinkStatus | null;
}

/** The student's side: their coaches and asks, and their coaches' notes a page at a time. */
export interface MyCoachResponse {
  links: CoachLink[];
  notes: CoachNote[];
  notesPage: Page;
}

/** A day of trackers for a coach: the numbers only, never a note. */
export interface CoachTrackerDay {
  date: string;
  mood: number | null;
  sleep: number | null;
  stress: number | null;
  mindful: number;
  move: number;
  /** How they ate (Fitness's eating check-in, 1 to 5), or null. Never its note. */
  eat?: number | null;
}

/** A saved review as a coach reads it: its own name, the answers, never the snapshot, and the layer it walks only while Pillars is shared too. */
export interface CoachReview extends Review {
  name: string;
  layer: ReviewLayer | null;
}

/** A coach's view of one student. Each part is null when the student does not share it. */
export interface CoachStudentView {
  link: CoachLink;
  /** The student's own today, from their zone. */
  date: string;
  daily: {
    streak: number;
    bestStreak: number;
    lastCheckin: string | null;
    checkedIn: boolean;
    xp: number;
    /** Days checked in, over the last thirty. */
    checkins: string[];
    /** Tasks ticked per day over the last thirty, oldest first. */
    tasksByDay: number[];
    tasks: Node[];
    done: Node[];
    /** Today's small act: done or not, and the pillar it was for once it is done. */
    smallAct: { relationship: RelationshipKey | null; done: boolean };
    notToDo: NotToDo[];
  } | null;
  pillars: { relationships: { key: RelationshipKey; xp: number }[]; nodes: Node[] } | null;
  routine: { general: RoutineBlock[]; exceptional: RoutineBlock[]; contract: Omit<Contract, 'signedName'> | null; today: RoutineDay | null; week: { done: number; days: (boolean | null)[] } } | null;
  lifeMap: Pick<Assessment, 'placements' | 'fears' | 'insecurities' | 'scores' | 'realDay' | 'focus' | 'createdAt'> | null;
  reflection: {
    wellbeing: WellbeingSummary;
    days: CoachTrackerDay[];
    /** Movement over the same thirty days by kind: minutes and days. Never a note, a distance or an effort. */
    moveKinds: { kind: string; minutes: number; days: number }[];
    /** Weekly and longer reviews, newest first, a page at a time. */
    reviews: CoachReview[];
    reviewsPage: Page;
    /** The daily reviews apart (prefix `revd`), so they never bury the weekly and longer ones. */
    dayReviews: CoachReview[];
    dayReviewsPage: Page;
  } | null;
  /** The tasks this coach added and how each stands, newest first (prefix `ct`), while Daily or Pillars is shared. */
  coachTasks: { tasks: Node[]; page: Page } | null;
  notes: CoachNote[];
  notesPage: Page;
  log: CoachLogEntry[];
  logPage: Page;
}

/**
 * One period's numbers for a coach, each field only while the part it comes from is shared (`COACH_PERIOD_FIELDS`): the rest of a
 * period's numbers never leave the server.
 */
export type CoachPeriodNumbers = Pick<PeriodNumbers, 'days'> &
  Partial<Pick<PeriodNumbers, 'tasksDone' | 'checkins' | 'habitTicks' | 'overdueAtEnd' | 'notToDoSlipped' | 'xp' | 'routineDays' | 'moodAvg' | 'sleepAvg' | 'stressAvg' | 'mindfulMin' | 'moveMin' | 'moveDays' | 'eatAvg'>>;

/** One pillar in a coach's report: its xp, how far each layer has come, and each project's pace. */
export interface CoachPillarRow {
  key: RelationshipKey;
  xp: number;
  layers: { kind: NodeKind; total: number; done: number }[];
  projects: { id: string; title: string; status: Node['status']; dueDate: string | null; done: number; total: number; pace: ProjectPace }[];
}

/** The picked period on a coach's student page. Every part is there only while the student shares it. */
export interface CoachReport {
  period: Period;
  previous: Period;
  /** The student's own today. */
  date: string;
  now: CoachPeriodNumbers;
  before: CoachPeriodNumbers;
  streak: { current: number; best: number; checkedIn: boolean } | null;
  /** Tasks ticked and xp earned per day of the period. */
  series: { date: string; tasks: number; xp: number }[] | null;
  xpByPillar: { key: RelationshipKey; xp: number }[] | null;
  pillars: CoachPillarRow[] | null;
  /** The routine's last seven days against the contract; a period's own count is `now.routineDays`. */
  routine: { days: (boolean | null)[]; kept: number; minDays: number | null } | null;
}

/** A pattern from the Emerging rules, worded for the coach, with nothing a student's own screen would act on. */
export interface CoachPattern {
  id: string;
  key: InsightKey;
  relationship: RelationshipKey | null;
  headline: string;
  text: string;
  basis: string;
  chart: InsightChart | null;
  /** A good or bad habit's word, or null for any other pattern. */
  verdict: 'good' | 'bad' | null;
  /** The task or not to do item it is about, in the student's own words. */
  title: string | null;
  /** Where a new repeating task for it would go, only while Pillars is shared. */
  projectId: string | null;
}

/** One suggestion for the coach: rules only, from what the student shares. Both actions are prefilled, and the coach edits before sending. */
export interface CoachSuggestion {
  id: string;
  part: CoachSharePart;
  tone: 'good' | 'warn' | 'info';
  text: string;
  note: string;
  /** Null while Pillars is not shared: a coach writes tasks only then. */
  task: { title: string; projectId: string | null; habit: boolean } | null;
}

export interface CoachPatternsAnswer {
  /** Patterns is on for this link. */
  on: boolean;
  patterns: CoachPattern[];
  /** Patterns the rules are still watching, a count only. */
  forming: number;
  suggestions: CoachSuggestion[];
  askedAt: string | null;
  /** The first day the coach can ask again. */
  askAgainFrom: string | null;
}

/** What a person keeps on their own Coaching pages. */
export interface CoachPrefs {
  sections: Record<string, 'open' | 'closed' | 'hidden'>;
  readSharing: boolean;
}

/** What a coach sends to add a task to a student's pyramid: under one of the student's projects. */
export interface CoachTaskInput {
  parentId: string;
  title: string;
  note?: string;
  doDate?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  estimateMin?: number | null;
  priority?: Priority | null;
  repeat?: Repeat | null;
  /** "Count it as a habit", while it repeats. Null goes back to the old rule. */
  habit?: boolean | null;
}

/** One link in the admin's list. */
export interface AdminCoachLink {
  id: string;
  coachId: string;
  coachName: string;
  studentId: string;
  studentName: string;
  status: CoachLinkStatus;
  askedBy: CoachAskedBy;
  createdAt: string;
  endedAt: string | null;
}

/** Someone who asked to be made a life coach, for the admin to say yes or no. */
export interface AdminCoachAsk {
  userId: string;
  name: string;
  email: string | null;
  handle: string | null;
  about: string;
  askedAt: string;
}
