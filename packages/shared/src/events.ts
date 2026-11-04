import type { Page } from './core.ts';
import { shiftDay } from './api.ts';
import type { IconName } from './roles.ts';

// ---------------------------------------------------------------------------
// Party — events
// ---------------------------------------------------------------------------

export const EVENT_TYPES = ['meetup', 'party', 'workshop', 'camp', 'day'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_META: Record<EventType, { name: string; icon: IconName; staffOnly: boolean }> = {
  meetup: { name: 'Meetup', icon: 'Coffee', staffOnly: false },
  party: { name: 'Party', icon: 'PartyPopper', staffOnly: true },
  workshop: { name: 'Workshop', icon: 'Hammer', staffOnly: true },
  camp: { name: 'Camp', icon: 'Tent', staffOnly: true },
  day: { name: 'Kreators Day', icon: 'Sun', staffOnly: true },
};

export interface PartyEvent {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  hostId: string;
  hostName: string;
  venue: string;
  onlineUrl: string | null;
  timezone: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  pricePoints: number;
  visibility: 'public' | 'private' | 'club';
  status: 'published' | 'cancelled' | 'done';
  registered: number;
  waitlisted: number;
  mine: EventRegistration | null;
  /** The xp its attendee code gives, when the host made one. */
  attendeeXp: number | null;
  createdAt: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  status: 'registered' | 'waitlisted' | 'cancelled' | 'attended';
  registeredAt: string;
  checkedInAt: string | null;
  networkingOptIn: boolean;
}

// ---------------------------------------------------------------------------
// Kreators Run — run clubs, start codes, tracking, brand collabs with giveaways
// ---------------------------------------------------------------------------

export const RUN_PACES = ['easy', 'steady', 'fast', 'all'] as const;
export type RunPace = (typeof RUN_PACES)[number];
export const RUN_PACE_META: Record<RunPace, { name: string; blurb: string }> = {
  easy: { name: 'Easy', blurb: 'Talk the whole way. Walk breaks welcome.' },
  steady: { name: 'Steady', blurb: 'A pace you can hold for an hour.' },
  fast: { name: 'Fast', blurb: 'Tempo runs and intervals.' },
  all: { name: 'All paces', blurb: 'Groups split at the start.' },
};
/** What one logged run pays. Paid by the start code, once per run, at most twice a day. */
export const RUN_REWARD = { xp: 20, points: 10, perDay: 2 } as const;

/**
 * Attendee codes, for the Connection apps that hold events with guests: Party events, runs and circles. Before the
 * event starts its host sets how much xp it gives (up to ATTENDEE_XP_MAX) and makes a code, random or their own word.
 * On the day only the event's own guests can claim it, once each, inside the event's window (the run window), and
 * never the host. A run's code is its start code, which also pays the run's points.
 */
export const ATTENDEE_CODE_APPS = ['party', 'run', 'circles'] as const;
export type AttendeeCodeApp = (typeof ATTENDEE_CODE_APPS)[number];
/** The most xp a host can set for one event. */
export const ATTENDEE_XP_MAX = 50;
/** What an event gives when its host does not say. The same as a run always gave. */
export const ATTENDEE_XP_DEFAULT = 20;
/** Event codes (Party and Circles) that pay in any 24 hours. Runs keep their own cap, RUN_REWARD.perDay. */
export const ATTENDEE_CLAIMS_PER_DAY = 3;
export const ATTENDEE_CODE_MIN = 4;
export const ATTENDEE_CODE_MAX = 12;
/** A circle has a start and no end; for its code window it lasts this long. */
export const CIRCLE_MINUTES = 120;

/** A code as it is kept and compared: capitals and digits only, at most ATTENDEE_CODE_MAX. "sunday run!" is SUNDAYRUN. */
export const normalizeCode = (text: unknown): string => (typeof text === 'string' ? text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ATTENDEE_CODE_MAX) : '');
export function codeProblem(text: unknown): string | null {
  return normalizeCode(text).length < ATTENDEE_CODE_MIN ? `A code is ${ATTENDEE_CODE_MIN} to ${ATTENDEE_CODE_MAX} letters or numbers.` : null;
}
export function attendeeXpProblem(xp: unknown): string | null {
  return typeof xp === 'number' && Number.isInteger(xp) && xp >= 1 && xp <= ATTENDEE_XP_MAX ? null : `The xp is a whole number from 1 to ${ATTENDEE_XP_MAX}.`;
}
/**
 * The xp is fixed once the code opens, thirty minutes before the start: from then on a guest can claim it, so it
 * was promised to them. Before that the host can still change it.
 */
export const attendeeXpLocked = (startsAt: string, now: number = Date.now()): boolean => now >= Date.parse(startsAt) - RUN_CODE_WINDOW.before * 60_000;
/** When an event's code works: from RUN_CODE_WINDOW.before minutes before the start to RUN_CODE_WINDOW.after after the end. */
export function codeWindow(startsAt: string, endsAt: string): { opensAt: string; closesAt: string } {
  return { opensAt: new Date(Date.parse(startsAt) - RUN_CODE_WINDOW.before * 60_000).toISOString(), closesAt: new Date(Date.parse(endsAt) + RUN_CODE_WINDOW.after * 60_000).toISOString() };
}

/** What a guest sees: the xp, whether they claimed it, and when the code works. Never the code. */
export interface AttendeeCodeView {
  xp: number;
  claimed: boolean;
  /** Whether it works now, when this was read. The screen works it out again from the two times as the clock moves. */
  state: RunEntryState;
  opensAt: string;
  closesAt: string;
}
/** What the host (or staff) sees. Circles show counts only: their guests are aliases. */
export interface AttendeeCodeHost {
  code: string;
  xp: number;
  /** The xp is fixed: the code has opened. */
  locked: boolean;
  claims: number;
  guests: number;
  opensAt: string;
  closesAt: string;
}
/** One event in the admin's list of every attendee code. */
export interface AdminAttendeeCode {
  app: AttendeeCodeApp;
  thingId: string;
  title: string;
  hostName: string;
  startsAt: string;
  status: string;
  xp: number | null;
  code: string | null;
  locked: boolean;
  claims: number;
  guests: number;
}
/** How long before the start and after the end a start code still works, in minutes. */
export const RUN_CODE_WINDOW = { before: 30, after: 180 } as const;
export const RUN_CODE_LENGTH = 6;
export const MAX_RUN_METRES = 100_000;
export const MAX_RUN_MINUTES = 600;
/** Run badges: logged runs or metres each one needs. */
export const RUN_BADGES = { run_1: { runs: 1, metres: 0 }, run_10: { runs: 10, metres: 0 }, run_100k: { runs: 0, metres: 100_000 } } as const;

export type RunEntryState = 'early' | 'open' | 'closed';
/** Whether a start code can be entered now: early before the window opens, closed once it has passed. */
export function runEntryState(startsAt: string, endsAt: string, now: Date = new Date()): RunEntryState {
  const t = now.getTime();
  if (t < new Date(startsAt).getTime() - RUN_CODE_WINDOW.before * 60_000) return 'early';
  if (t > new Date(endsAt).getTime() + RUN_CODE_WINDOW.after * 60_000) return 'closed';
  return 'open';
}
/** Metres as a short kilometre label: 5000 is "5 km", 7500 is "7.5 km". */
export function kmLabel(metres: number): string {
  const km = Math.round(metres / 100) / 10;
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}
/** Minutes per kilometre as "5:30 /km". Null when either number is missing. */
export function paceLabel(metres: number, minutes: number): string | null {
  if (metres <= 0 || minutes <= 0) return null;
  const secPerKm = Math.round((minutes * 60) / (metres / 1000));
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`;
}
/** The Monday that starts the week a date falls in. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
/** Weeks in a row with at least one run, counting back from this week; last week keeps the run alive until this one has a run. */
export function weekStreak(dates: readonly string[], today: string): number {
  const weeks = new Set(dates.map(weekStart));
  let w = weekStart(today);
  if (!weeks.has(w)) w = shiftDay(w, -7);
  let n = 0;
  while (weeks.has(w)) {
    n += 1;
    w = shiftDay(w, -7);
  }
  return n;
}

export interface RunClub {
  id: string;
  name: string;
  city: string;
  description: string;
  pace: RunPace;
  /** When and where the club usually meets, in the host's words. */
  meets: string;
  hostId: string;
  hostName: string;
  visibility: 'public' | 'private';
  status: 'active' | 'closed';
  members: number;
  nextRunAt: string | null;
  /** You are a member (hosts are members too). */
  mine: boolean;
  host: boolean;
  createdAt: string;
}

export interface RunEntry {
  id: string;
  runId: string;
  userId: string;
  name: string;
  metres: number;
  minutes: number;
  status: 'logged' | 'void';
  loggedAt: string;
}

export interface Run {
  id: string;
  clubId: string;
  title: string;
  meetingPoint: string;
  startsAt: string;
  endsAt: string;
  /** The planned distance. */
  metres: number;
  /** The start code. Only the host sees it; everyone else gets null. */
  code: string | null;
  /** The xp a logged run pays, set by the host before it starts. */
  xp: number;
  entryState: RunEntryState;
  collab: { id: string; title: string; brand: string; giveaway: string } | null;
  status: 'published' | 'cancelled' | 'done';
  entries: number;
  mine: RunEntry | null;
  createdAt: string;
}

export interface RunCollab {
  id: string;
  title: string;
  brand: string;
  organizationId: string | null;
  posterId: string;
  brief: string;
  /** What the brand asks of the club: a post, a tag, a photo at the line. */
  asks: string;
  /** What runners can win, in plain words. */
  giveaway: string;
  /** How many of the giveaway there are. 0 when it is not counted. */
  giveawayCount: number;
  city: string;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'closed';
  applications: number;
  accepted: number;
  /** Your clubs' applications to this collab. */
  mine: RunCollabApplication[];
  /** You posted it, or you hold the events permission. */
  poster: boolean;
  createdAt: string;
}

export interface RunCollabApplication {
  id: string;
  collabId: string;
  clubId: string;
  clubName: string;
  hostName: string;
  note: string;
  status: 'applied' | 'accepted' | 'declined';
  createdAt: string;
}

export interface RunTracking {
  runs: number;
  metres: number;
  minutes: number;
  monthRuns: number;
  monthMetres: number;
  weekStreak: number;
  /** Metres per day over the last thirty days, oldest first. */
  days: { date: string; metres: number }[];
  badges: string[];
}

export interface RunResponse {
  page: Page;
  clubs: RunClub[];
  mine: RunClub[];
  /** Runs coming up in your clubs. */
  upcoming: Run[];
  tracking: RunTracking;
  collabsOpen: number;
  canPostCollab: boolean;
}

export interface RunClubDetail {
  club: RunClub;
  runs: Run[];
  past: Run[];
  /** Kilometres this month per member, most first. */
  board: { userId: string; name: string; metres: number; runs: number }[];
  /** Collabs the club was accepted into. */
  collabs: RunCollab[];
  /** For the host: every entry on the club's runs, newest first. */
  entryPage: Page;
  entries: RunEntry[];
}

export interface RunCollabsResponse {
  page: Page;
  collabs: RunCollab[];
  /** Clubs you host, to apply with. */
  myClubs: RunClub[];
  canPost: boolean;
  /** For posters: applications to your collabs, newest first. */
  applicationPage: Page;
  applications: (RunCollabApplication & { collabTitle: string })[];
}
