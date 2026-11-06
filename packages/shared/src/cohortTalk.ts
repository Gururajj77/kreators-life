import type { Page } from './core.ts';

// ---------------------------------------------------------------------------
// School cohort discussions (migration 0084): threads under a cohort for everyone enrolled in it (enrolled or completed), its
// manager, mentors and the team with the cohorts permission. Replies nest three levels; past that a reply sits beside the line it
// answers and names who it answers. Each member picks how they appear in each cohort: Public (their @handle, which others can open
// and send a friend request from) or Private, the default (their handle and friend code with the middle in stars). The masking
// happens on the server, so a private member's real handle, id and code never reach other members.
// ---------------------------------------------------------------------------

/** Replies nest this deep under a post (the post is 0). A reply to a line at this depth is kept at this depth, beside it. */
export const COHORT_TALK_MAX_DEPTH = 3;
/** The longest line, in letters. */
export const MAX_COHORT_TALK_LINE = 2000;
/** How many replies one page of threads brings back at most, so a page stays small. */
export const COHORT_TALK_REPLIES_MAX = 1000;

export const COHORT_TALK_VISIBILITIES = ['private', 'public'] as const;
export type CohortTalkVisibility = (typeof COHORT_TALK_VISIBILITIES)[number];
/** Private until the member says otherwise. */
export const COHORT_TALK_DEFAULT_VISIBILITY: CohortTalkVisibility = 'private';
export function isCohortTalkVisibility(v: unknown): v is CohortTalkVisibility {
  return v === 'private' || v === 'public';
}

/**
 * A handle with its middle in stars: the first two letters and the last stay, with always four stars between, so the length is never
 * given away ("shubham" is "sh****m", "user_ab12cd" is "us****d"). A short one (five letters or fewer) keeps only its first and last;
 * one or two letters keep only the first. Never the whole handle.
 */
export function maskHandle(handle: string | null | undefined): string {
  const h = (handle ?? '').trim().replace(/^@/, '');
  if (!h) return '****';
  const chars = [...h];
  const n = chars.length;
  if (n <= 2) return `${chars[0]}****`;
  if (n <= 5) return `${chars[0]}****${chars[n - 1]}`;
  return `${chars[0]}${chars[1]}****${chars[n - 1]}`;
}

/** A friend code with its middle in stars: the first two and the last two stay, four stars between ("AB3K9QYZ" is "AB****YZ"). A short one is all stars. */
export function maskCode(code: string | null | undefined): string {
  const c = (code ?? '').trim();
  if (c.length <= 4) return '****';
  return `${c.slice(0, 2)}****${c.slice(-2)}`;
}

/**
 * The name a private member shows in a cohort's discussion: the starred handle and the starred friend code together
 * ("us****d · AB****YZ"), so two private members never read as one person (every new handle starts `user_`), while neither the
 * handle nor the code is given away. Used for the line, "Replying to" and the inbox note alike.
 */
export function cohortTalkPrivateLabel(handle: string | null | undefined, code: string | null | undefined): string {
  return `${maskHandle(handle)} · ${maskCode(code)}`;
}

/** Where a new line sits, from the line it answers: a post is 0, a reply one deeper, never past `COHORT_TALK_MAX_DEPTH`. */
export function cohortTalkDepth(parentDepth: number | null | undefined): number {
  if (parentDepth === null || parentDepth === undefined || !Number.isFinite(parentDepth)) return 0;
  return Math.min(Math.max(0, Math.floor(parentDepth)) + 1, COHORT_TALK_MAX_DEPTH);
}

/**
 * Where a reply is kept. A reply to a line above the deepest level nests under it; a reply to a line at the deepest level is kept
 * beside it, under the same parent, at the same depth, and names the line it answers (`replyToId`).
 */
export function cohortTalkPlace(parent: { id: string; parentId: string | null; depth: number }): { parentId: string; replyToId: string; depth: number } {
  if (parent.depth >= COHORT_TALK_MAX_DEPTH) return { parentId: parent.parentId ?? parent.id, replyToId: parent.id, depth: COHORT_TALK_MAX_DEPTH };
  return { parentId: parent.id, replyToId: parent.id, depth: cohortTalkDepth(parent.depth) };
}

/**
 * Lines in reading order: the posts in the order given (newest first from the server), each followed by its replies, every reply
 * right under what it answers and oldest first inside a level. A reply whose parent is not in the list is dropped, since its thread
 * is not on this page. Depths are capped at `COHORT_TALK_MAX_DEPTH`.
 */
export function cohortTalkOrder<T extends { id: string; parentId: string | null; depth: number; createdAt: string }>(rows: readonly T[]): T[] {
  const ids = new Set(rows.map((r) => r.id));
  const kids = new Map<string, T[]>();
  const roots: T[] = [];
  for (const r of rows) {
    if (r.parentId === null) roots.push(r);
    else if (ids.has(r.parentId)) kids.set(r.parentId, [...(kids.get(r.parentId) ?? []), r]);
  }
  for (const list of kids.values()) list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
  const out: T[] = [];
  const walk = (r: T, depth: number) => {
    out.push({ ...r, depth: Math.min(depth, COHORT_TALK_MAX_DEPTH) });
    for (const k of kids.get(r.id) ?? []) walk(k, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  return out;
}

/**
 * Drop lines that hold nothing for the reader (taken down, or by someone blocked either way) and have nothing under them that does,
 * so an empty place is kept only where it holds a thread together.
 */
export function pruneEmptyLines<T extends { id: string; parentId: string | null; empty: boolean }>(rows: readonly T[]): T[] {
  const keep = new Set<string>();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    if (r.empty) continue;
    let cur: T | undefined = r;
    while (cur && !keep.has(cur.id)) {
      keep.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }
  return rows.filter((r) => keep.has(r.id));
}

/** How a writer shows on a line. A private member's real handle, id and code are never sent to other members. */
export interface CohortTalkAuthor {
  /** What the line shows: "@handle" for a public member, the starred handle and code for a private one (`cohortTalkPrivateLabel`). */
  label: string;
  /** The real handle: for a public member to everyone, for a private one only to themself and the cohort's moderators. */
  handle: string | null;
  /** The real display name, only where the real handle is sent. */
  name: string | null;
  /** The friend code with its middle in stars, for a private member, so two starred handles can be told apart. */
  code: string | null;
  public: boolean;
  /** Empty unless the member is public, or the reader is the writer or one of the cohort's moderators. */
  userId: string;
  /** The cohort's manager wrote it. */
  manager: boolean;
}

/** One line of a cohort discussion, as it leaves the server. */
export interface CohortTalkLine {
  id: string;
  threadId: string;
  parentId: string | null;
  depth: number;
  /** Past the deepest level: who this line answers, by the label they show. */
  replyTo: { id: string; label: string } | null;
  body: string;
  createdAt: string;
  /** Taken down: the words are gone, the place stays because replies hang from it. */
  takenDown: boolean;
  /** Written by someone blocked either way: shown as an empty place, because replies hang from it. */
  hidden: boolean;
  mine: boolean;
  author: CohortTalkAuthor;
}

/** The reader's own setting in one cohort, and how they show. */
export interface CohortTalkMe {
  visibility: CohortTalkVisibility;
  /** How others see them now. */
  label: string;
  code: string | null;
  handle: string | null;
}

export interface CohortTalkResponse {
  page: Page;
  lines: CohortTalkLine[];
  me: CohortTalkMe;
  /** The reader may take any line down: the cohort's manager, a mentor, or the team with the cohorts permission. */
  moderator: boolean;
}
