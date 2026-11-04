import { LOCALE } from './core.ts';
import type { Page } from './core.ts';
import type { IconName } from './roles.ts';

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/** Each board ranks the top of this many opted-in people; the rest are not ranked. */
export const LEADERBOARD_POOL = 200;
export type LeaderboardSort = 'xp' | 'season' | 'streak' | 'badges';

/** What a board is about. Goals and pillars are what people work on; the rest is who they are. */
export type LeaderboardScope = 'all' | 'goal' | 'pillar' | 'city' | 'identity' | 'level';
export const LEADERBOARD_SCOPES: readonly { key: LeaderboardScope; label: string; group: 'Everyone' | 'What people work on' | 'Who they are' }[] = [
  { key: 'all', label: 'Everyone', group: 'Everyone' },
  { key: 'goal', label: 'By goal', group: 'What people work on' },
  { key: 'pillar', label: 'By pillar', group: 'What people work on' },
  { key: 'city', label: 'By city', group: 'Who they are' },
  { key: 'identity', label: 'By who they are', group: 'Who they are' },
  { key: 'level', label: 'By experience', group: 'Who they are' },
];
export const isLeaderboardScope = (v: unknown): v is LeaderboardScope => LEADERBOARD_SCOPES.some((s) => s.key === v);
export interface LeaderboardOption {
  value: string;
  label: string;
  icon?: IconName;
  /** People on the board who opted in. */
  count: number;
}
export interface LeaderboardOptions {
  goal: LeaderboardOption[];
  pillar: LeaderboardOption[];
  city: LeaderboardOption[];
  identity: LeaderboardOption[];
  level: LeaderboardOption[];
}
/** One small board in the overview: the top three of a goal or pillar and where the viewer stands. */
export interface LeaderboardBlock {
  scope: LeaderboardScope;
  value: string;
  label: string;
  /** A goal's icon; a pillar's board has none (its colour says it). */
  icon?: IconName;
  people: number;
  top: { rank: number; name: string; xp: number; isMe: boolean }[];
  myRank: number | null;
}

/**
 * A season is a calendar month (UTC): the season board counts only the xp earned in it, so everyone starts level
 * at the start of the month. When a month ends its top three are kept and get the Season top three honor.
 */
export const seasonOf = (iso: string): string => iso.slice(0, 7);
export const seasonStart = (season: string): string => `${season}-01T00:00:00.000Z`;
/** "October 2026". */
export function seasonLabel(season: string): string {
  const [y, m] = season.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1)).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
/** The month before: "2026-10" for "2026-11", "2025-12" for "2026-01". */
export function previousSeason(season: string): string {
  const [y, m] = season.split('-').map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 2, 1));
  return d.toISOString().slice(0, 7);
}
export const SEASON_TOP = 3;
export interface SeasonResult {
  season: string;
  label: string;
  top: { place: number; name: string; xp: number; isMe: boolean }[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  level: number;
  streak: number;
  /** Earned badges plus honors. */
  badgeCount: number;
  isPro: boolean;
  stage: number;
  isMe: boolean;
  /** Xp earned this season (this calendar month). */
  seasonXp: number;
}


export interface LeaderboardResponse {
  by: LeaderboardSort;
  scope: LeaderboardScope;
  /** The goal, pillar, city, tag or level chosen, empty for everyone. */
  value: string;
  /** What the board is called: "Learn a new skill", "Friends", "Pune". */
  label: string;
  page: Page;
  /** People on this board, up to the pool the board ranks (`LEADERBOARD_POOL`). */
  people: number;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  optedIn: boolean;
  /** This season's month and when it ends, and the last few closed seasons' top three. */
  season: { season: string; label: string; endsAt: string };
  past: SeasonResult[];
}
