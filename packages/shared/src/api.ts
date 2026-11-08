import type { Page, RelationshipKey } from './core.ts';
import { WAIT } from './pillars.ts';
import type { Evolution, NodeKind } from './pillars.ts';
import type { Redemption } from './rewards.ts';
import type { Organization } from './work.ts';
import { addDays } from './dates.ts';
import type { DatePrefs } from './dates.ts';
import type { OpenKind, Priority, Repeat } from './tasks.ts';
import type { LifeAreaKey } from './life.ts';
import type { DayPlan } from './timeBlocks.ts';
import type { IconName, Permission, Role } from './roles.ts';
import type { AppPrefs, ModuleAccess, ModuleGroup, ModuleSetting } from './modules.ts';
import type { LinkBlock, PublicSettings, Socials } from './profile.ts';
import type { Intake } from './setup.ts';
import type { PlanKey } from './assistant.ts';

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

/** What fills most of someone's days. Stored as the profile's focus. */
export const FOCUS_OPTIONS = ['Work', 'Study', 'Family', 'Business', 'Creating', 'Other'] as const;

export interface User {
  id: string;
  displayName: string;
  focus: string;
  xp: number;
  /** Redeemable points, separate from xp. Earned by showing up. */
  points: number;
  isPro: boolean;
  leaderboardOptIn: boolean;
  role: Role;
  email: string | null;
  /** Asked at sign-up. Digits with a leading plus. */
  phone: string;
  /** Asked at sign-up, YYYY-MM-DD. Never shown to anyone else. */
  birthDate: string;
  handle: string | null;
  bio: string;
  reminderTime: string | null;
  /** The code others type in Bond to send this person a friend request. */
  friendCode: string | null;
  referralCode: string | null;
  /** Per-person module toggles. Missing keys use the module default. */
  modules: Record<string, boolean>;
  permissions: Permission[];
  skills: string[];
  categories: string[];
  goals: string[];
  experienceLevel: string;
  availability: string;
  location: string;
  openToIntros: boolean;
  /** What they make and care about, for matching. */
  interests: string[];
  /** Who they are, from the setup chat: known tag keys and labels in their own words. Never on the public page. */
  identities: string[];
  /** What the setup chat heard: goals and what gets in the way. */
  intake: Intake;
  city: string;
  area: string;
  /** True when the person shared their position for nearby matching. The coordinates never leave the server. */
  hasLocation: boolean;
  /** IANA zone the person's times show in, their reminders arrive by and their availability is written in. */
  timezone: string;
  /** How their dates and times read on screen (migration 0109, `parseDatePrefs`): "7 Nov 26, 4:17am" unless they changed it under Profile. */
  datePrefs: DatePrefs;
  /** The currency their own money is kept in (Finance, a new product): one of `CURRENCIES`, rupees unless they changed it. */
  currency: string;
  /** How their app groups start (open or closed) and the order of the apps inside each group (migration 0074, `parseAppPrefs`). */
  appPrefs: AppPrefs;
  avatarUrl: string;
  socials: Socials;
  publicSettings: PublicSettings;
  /** The blocks on the public page, in order. */
  links: LinkBlock[];
  streak: number;
  bestStreak: number;
  lastCheckin: string | null;
  onboardedAt: string | null;
  /** The Party event this account joined from the public event page before setup was done (migration 0121), else null. */
  attendeeEvent: string | null;
  createdAt: string;
}

export interface RelationshipState {
  key: RelationshipKey;
  /** 0–100 from the vibe check. */
  score: number;
  xp: number;
  level: number;
  pillars: number;
  /** Character evolution stage, 1 to 4. */
  stage: number;
  /** Days since this floor's first pillar. Null when nothing is built. */
  floorAgeDays: number | null;
  /** True once the vibe check for this floor has been answered. */
  answered: boolean;
}

// ---------------------------------------------------------------------------
// Internal observability: who is here and which apps they use. Team only; journal and wellbeing never appear.
// ---------------------------------------------------------------------------

export interface ObservedUser {
  id: string;
  name: string;
  handle: string | null;
  role: Role;
  createdAt: string;
  onboarded: boolean;
  /** Keys of the apps this person has on. */
  apps: string[];
}

export interface AppUsage {
  key: string;
  name: string;
  icon: IconName;
  group: ModuleGroup;
  /** How many people have it on. */
  on: number;
}

/** Numbers for the newer apps. Counts only: never a person, never what they wrote or answered. */
export interface ObservedAdditions {
  /** How many people unlocked each game. */
  /** Per game: its key and name and how many unlocked it. No emoji: the screen draws its own icon (2026-11-03). */
  games: { key: string; name: string; unlocked: number }[];
  discover: { results: number; people: number; withEq: number; assistantOn: number; stepsOff: number; addons: { type: number; love: number; mind: number; design: number }; mindOn: number };
  /** Agency: counts only, never a client, a name or an amount. */
  agency: { people: number; clients: number; deliverables: number; published: number; invoices: number; agreementsSigned: number; clientLinksOn: number; metricsOn: number };
  /** What super admins gave by hand in the last thirty days. */
  grants: { xp: number; badges: number; points: number; honors: number };
  /** The app's own log, last 24 hours. */
  logs: { errors: number; warnings: number; changes: number };
}

export interface LogEntry {
  id: number;
  at: string;
  level: 'info' | 'warn' | 'error';
  area: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  actorId: string | null;
  actorName: string | null;
  message: string;
}
export interface LogsResponse {
  logs: LogEntry[];
  page: Page;
  /** Counts for the last 24 hours, whatever the filter. */
  last24h: { info: number; warn: number; error: number };
  /** The areas seen in the last week, to filter by. */
  areas: string[];
  /** The people with lines in the last week, busiest first, to filter by. */
  actors: { id: string; name: string; count: number }[];
}

export interface ObservabilityResponse {
  totals: { users: number; onboarded: number; staff: number; admins: number; newThisWeek: number };
  additions: ObservedAdditions;
  roles: Record<Role, number>;
  apps: AppUsage[];
  users: ObservedUser[];
  /** How many people match the search, before paging. */
  total: number;
  page: Page;
}

export interface MeResponse {
  user: User;
  relationships: RelationshipState[];
  /** Earned badges, computed from stats. */
  badges: string[];
  /** Awarded honors: given by an admin or unlocked with time. */
  honors: string[];
  identity: Evolution;
  /** Global module settings set by an admin. */
  moduleSettings: Record<string, ModuleSetting>;
  /** Resolved server-side: flag, rollout, overrides, role, then the person's toggle. */
  access: Record<string, ModuleAccess>;
  unread: number;
  organizations: Organization[];
  stats: { tasksDone: number; sparksDone: number; projectsCleared: number };
}

export interface Node {
  id: string;
  kind: NodeKind;
  parentId: string | null;
  relationship: RelationshipKey;
  title: string;
  note: string;
  status: 'active' | 'done' | 'archived';
  xp: number;
  /** The deadline: finish by this day. */
  dueDate: string | null;
  /** Tasks only: the day to do it. A task with a do date opens on it, and cannot be ticked before. */
  doDate: string | null;
  /** Tasks only: how often it comes back. Ticking it makes the next one. */
  repeat: Repeat | null;
  /** Tasks only: 0 to 3 for P0 to P3, or null for none. Sorts and tags a task; it never changes what a tick pays. */
  priority: Priority | null;
  /** Tasks only: the strategy session or the vibe check made it from a pillar, rather than the person adding it. */
  fromPillar?: boolean;
  /** Tasks only: the small checklist inside it. Counted, never paid. */
  subtaskTotal?: number;
  subtaskDone?: number;
  /** Tasks only: the Remember tag. With a day it also sends an inbox note on that day, at its time (09:00 when it has none). */
  remind: boolean;
  /** Tasks only: brought to the review for its period. The review lists it, and a tap puts it into an answer. */
  forReview: boolean;
  /** Tasks only: counted as a habit (the Habit tag). Null keeps the old rule, a repeating task is one; see `taskIsHabit`. */
  habit?: boolean | null;
  /** Tasks only, optional: the one area of life it serves (physical, financial, mental, emotional, spiritual), or null for none. A tag and a filter; it never changes what a tick pays. */
  lifeArea: LifeAreaKey | null;
  /** Tasks only, optional: the time block the person picked for it (one of their own), or null: it then falls in the block its time sits in (`blockOfTask`). */
  timeBlockId?: string | null;
  /** Tasks only, optional: the kind of open business it carries (Unfinished, Unresolved, Undecided), or null. A tag and Daily's Unfinished business view; it never changes what a tick pays. */
  openKind?: OpenKind | null;
  /** Tasks only, optional: a time of day (HH:MM) and how long it should take, to plan the day. */
  dueTime: string | null;
  estimateMin: number | null;
  completedAt: string | null;
  /** Tasks only: when it can first be ticked. Writing it or renaming it starts the wait. */
  readyAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** A task a life coach added: the student still ticks it, and it pays the same. */
  fromCoach?: boolean;
}

export interface RippleEvent {
  id: string;
  kind: NodeKind;
  title: string;
  amount: number;
}

export interface CompleteResponse {
  /** The next task a repeating one made when it was ticked. */
  next?: Node | null;
  node: Node;
  ripple: RippleEvent[];
  projectCleared: Node | null;
  totalXp: number;
  newBadges: string[];
  /** True when the daily rewarded-task limit was already reached, so this one earned nothing. */
  capped: boolean;
}

export interface TodayResponse {
  date: string;
  checkedIn: boolean;
  streak: number;
  /** The main list: tasks whose do date (or due date, when there is no do date) has come, late ones included. */
  tasks: Node[];
  /** Tasks with no do date and no deadline within reach, waiting until one is picked. Not part of the main list. */
  backlog: Node[];
  backlogTotal: number;
  /** Every open task whose day has come, under the same cuts as `tasks` (which holds only the first six, or DAILY_GROUPED_MAX grouped). */
  tasksTotal?: number;
  /** How many of those are late: their do date (else due date) is before the person's day. */
  tasksLate?: number;
  /** Tasks ticked on the person's day (in their zone), newest first, so a tick stays in sight and can be undone: the first page of `DONE_PAGE_SIZE` (the rest through GET /today/done). */
  done: Node[];
  /** How many were ticked on the day in all, so the count stays true while the list is paged. */
  doneTotal?: number;
  /** The open-business cut (`?open=`, Daily's Unfinished business view): any of the three kinds or one; absent or null for every task. */
  open?: OpenKind | 'any' | null;
  /** How many tasks were let go (archived), so the Unfinished business view offers its Let go list only when there is one. */
  letGoTotal?: number;
  /** Tasks ticked in the last day, so Today can say the routine is done. */
  doneRecently: number;
  spark: { relationship: RelationshipKey; text: string; done: boolean };
  /** Minutes planned for today across timed tasks, minutes already done, and how many tasks carry a time. */
  timePlan: { plannedMin: number; doneMin: number; timed: number };
  /** Things to stay away from, each with its streak. Extra to the three boxes. */
  notToDo: NotToDo[];
  /** Party events, runs and circle tables the person signed up for that start on their day, in time order. Title, time and a link only. */
  events: TodayEvent[];
  /** Agency work waiting on the person today. Present only while Agency is on for them; owner only, titles and client names, never a fee. */
  agency?: TodayAgency;
  /** The area of life the lists were cut to (`?area=`, a `LIFE_AREAS` key or 'none'), so `tasks`, `backlog` and `backlogTotal` are all for it; absent or null for every area. */
  area?: LifeAreaKey | 'none' | null;
  /** True when any open or ticked task of the person's carries an area, whatever `area` was asked; Daily shows its Area filter then. */
  areasUsed?: boolean;
  /** The day's plan: its day template (the kind of day), where it came from, its slots in clock order and every block (docs/time-blocks.md). */
  day: DayPlan;
  /** With `?group=1` (up to DAILY_GROUPED_MAX tasks): true when more open tasks are waiting than were sent. */
  tasksMore?: boolean;
  /** The time block the lists were cut to (`?block=`, a block id or 'none'); absent or null for every block. */
  block?: string | null;
  /** "Your day": open tasks that open on the day with no block and no time, whatever the six shown or the Area cut (up to 50, oldest first). */
  looseTasks?: Node[];
  /** How many such tasks there are in all. */
  looseTotal?: number;
}

/** A page of tasks and how many in all: done tasks (GET /today/done for the day, prefix `d`; GET /nodes/done for a pillar, prefix `dn`) or the tasks let go (GET /today/let-go, prefix `lg`). */
export interface DoneTasksResponse {
  tasks: Node[];
  page: Page;
  total: number;
}

/** GET /today/waiting: the open tasks past the ones GET /today shows, in the same order, a page at a time (prefix `w`). */
export interface TodayWaitingResponse {
  tasks: Node[];
  page: Page;
}

/** Something the person signed up for that starts today. */
export interface TodayEvent {
  kind: 'event' | 'run' | 'circle';
  title: string;
  /** UTC ISO start. */
  at: string;
  path: string;
}

/** The most rows of each agency list Daily shows; the counts say when there are more. */
export const TODAY_AGENCY_MAX = 8;

/** Agency on Daily: pieces due today or late, changes clients asked for, retainers a client chose, invoices due or past due. */
export interface TodayAgency {
  due: { id: string; title: string; clientId: string; client: string; due: string; late: boolean }[];
  dueTotal: number;
  /** Pieces a client sent back with a change ask in the last fortnight that are still in making. */
  changeAsks: number;
  changeClientId: string | null;
  retainerToConfirm: { id: string; clientId: string; client: string; months: number | null }[];
  invoicesDue: { id: string; number: string; clientId: string | null; client: string; due: string; late: boolean; cents: number; currency: string }[];
}

/** The not-to-do list on Daily: things to stay away from, each with its own streak. */
export const MAX_NOT_TO_DO = 7;
export const NOT_TO_DO_TITLE_MAX = 60;
export type NotToDoStatus = 'kept' | 'slipped';
export interface NotToDo {
  id: string;
  title: string;
  relationship: RelationshipKey | null;
  /** Days in a row kept. Today counts once it is ticked; until then the run ends at yesterday. */
  streak: number;
  bestStreak: number;
  today: NotToDoStatus | null;
  /** The last seven days ending today, oldest first. */
  week: (NotToDoStatus | null)[];
  createdAt: string;
}

/** A YYYY-MM-DD day moved by whole days: the same as `addDays` (the one day arithmetic, further down); kept as a name because the period and not-to-do rules read better with it. */
export function shiftDay(day: string, by: number): string {
  return addDays(day, by);
}

/**
 * The one streak rule for a not-to-do: count kept days back from today if today is kept,
 * or back from yesterday while today is still open. A slip today, or a day with nothing
 * recorded, ends the run.
 */
export function notToDoStreak(days: Record<string, NotToDoStatus | undefined>, today: string): number {
  if (days[today] === 'slipped') return 0;
  let day = days[today] === 'kept' ? today : shiftDay(today, -1);
  let n = 0;
  while (days[day] === 'kept') {
    n += 1;
    day = shiftDay(day, -1);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  displayName: string;
  focus: string;
  xp: number;
  points: number;
  streak: number;
  isPro: boolean;
  createdAt: string;
  honors: string[];
  /** Badges a super admin gave by hand, on top of the ones the person earned. */
  grantedBadges: string[];
  role: Role;
  email: string | null;
  handle: string | null;
  permissions: Permission[];
  /** The assistant plan, or none, and when it ends. */
  plan: PlanKey;
  planUntil: string | null;
  /** Credits left: the plan's for this period, and extra ones that stay. */
  planCredits: number;
  extraCredits: number;
  /** Asked to be made a life coach, and still waiting for an answer. */
  coachAskedAt: string | null;
}

export interface AdminRedemption extends Redemption {
  userId: string;
  userName: string;
}

/** When a task can first be ticked. */
export function taskReadyAt(createdAt: string, readyAt: string | null): string {
  if (readyAt) return readyAt;
  return new Date(new Date(createdAt).getTime() + WAIT.taskMinAgeMinutes * 60_000).toISOString();
}
