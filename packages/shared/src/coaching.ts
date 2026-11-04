import type { Page, RelationshipKey } from './core.ts';
import type { Node, NotToDo } from './api.ts';
import type { Review } from './periods.ts';
import type { BadgeRole } from './roles.ts';
import type { WellbeingSummary } from './wellbeing.ts';
import type { Assessment, Contract, RoutineBlock, RoutineDay } from './session.ts';

// ---------------------------------------------------------------------------
// Life coaches. The team makes someone a life coach (the coach permission, which a creator can hold, and the Life
// coach badge). A coach works only with students who said yes: they see the parts of a student's progress the
// student shares, leave notes, and add or edit tasks; every step lands in a change log both of them see. A link
// starts three ways: a coach (or an admin) asks and the student says yes, a student asks and the coach says yes, or
// an admin links the two. Either side can end it. The journal never reaches a coach.
// ---------------------------------------------------------------------------

/** The five parts of a student's progress a coach can see. Each is the student's own switch, on to start with. */
export const COACH_SHARE_PARTS = ['daily', 'pillars', 'routine', 'lifeMap', 'reflection'] as const;
export type CoachSharePart = (typeof COACH_SHARE_PARTS)[number];
export type CoachShare = Record<CoachSharePart, boolean>;
export const DEFAULT_COACH_SHARE: CoachShare = { daily: true, pillars: true, routine: true, lifeMap: true, reflection: true };
export const COACH_SHARE_META: Record<CoachSharePart, { name: string; blurb: string }> = {
  daily: { name: 'Daily and streaks', blurb: 'Check-ins, streaks, xp, the day’s tasks, the small act and your not to do list.' },
  pillars: { name: 'Pillars and pyramids', blurb: 'Every layer of your seven pyramids. With this on, your coach can add and edit tasks.' },
  routine: { name: 'Routine and contract', blurb: 'Your routine, the days you kept it, and the deal you signed.' },
  lifeMap: { name: 'Life map answers', blurb: 'Where each pillar sits on the map, your scores, your fears and what weighs on you.' },
  reflection: { name: 'Reflection', blurb: 'Wellbeing, mood, sleep, stress, mindful minutes and your saved reviews. Never your journal or tracker notes.' },
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

export type CoachLogAction = 'link.ask' | 'link.yes' | 'link.no' | 'link.end' | 'link.admin' | 'share.change' | 'note.add' | 'note.remove' | 'task.add' | 'task.edit';
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
  reflection: { wellbeing: WellbeingSummary; days: CoachTrackerDay[]; reviews: Review[]; reviewsPage: Page } | null;
  notes: CoachNote[];
  notesPage: Page;
  log: CoachLogEntry[];
  logPage: Page;
}

/** What a coach sends to add a task to a student's pyramid: under one of the student's projects. */
export interface CoachTaskInput {
  parentId: string;
  title: string;
  note?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  estimateMin?: number | null;
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
