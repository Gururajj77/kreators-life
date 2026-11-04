import type { RelationshipKey } from './core.ts';
import type { AttendeeCodeHost } from './events.ts';

// ---------------------------------------------------------------------------
// Circles: anonymous small groups near you, matched by interests that fit
// ---------------------------------------------------------------------------

/**
 * Interests, grouped the way a dating app groups them, so everyone finds themselves here, not only people
 * who make content. Up to ten can be on at once. Circles seat people whose interests fit: the same ones, or pairs that gel.
 */
export const INTEREST_GROUPS = [
  { key: 'creative', name: 'Creative', icon: 'Palette', options: ['Photography', 'Video', 'Writing', 'Art & design', 'Music making', 'Dance', 'Comedy', 'Film making', 'Podcasting', 'Fashion'] },
  { key: 'sport', name: 'Sport & fitness', icon: 'Dumbbell', options: ['Gym', 'Running', 'Yoga', 'Football', 'Cricket', 'Basketball', 'Badminton', 'Cycling', 'Swimming', 'Hiking'] },
  { key: 'food', name: 'Food & drink', icon: 'UtensilsCrossed', options: ['Cooking', 'Baking', 'Coffee', 'Tea', 'Street food', 'Trying new places'] },
  { key: 'music', name: 'Music & nights out', icon: 'EighthNotes', options: ['Live music', 'Hip hop', 'Indie', 'Pop', 'Bollywood', 'Karaoke', 'Open mics', 'Festivals'] },
  { key: 'screens', name: 'Screens & pages', icon: 'Gamepad2', options: ['Gaming', 'Anime', 'Movies', 'Series', 'Books', 'Comics', 'Board games'] },
  { key: 'outdoors', name: 'Travel & outdoors', icon: 'Tent', options: ['Travel', 'Road trips', 'Beaches', 'Camping', 'Nature', 'Stargazing'] },
  { key: 'learning', name: 'Learning & tech', icon: 'Lightbulb', options: ['Tech', 'Coding', 'Science', 'Finance', 'Business', 'Languages', 'History'] },
  { key: 'wellness', name: 'Wellness & mind', icon: 'Leaf', options: ['Meditation', 'Journaling', 'Spirituality', 'Sleep', 'Mental health', 'Skincare'] },
  { key: 'causes', name: 'Causes & community', icon: 'HandHelping', options: ['Volunteering', 'Climate', 'Animals', 'Education', 'Social causes', 'Mentoring'] },
  { key: 'home', name: 'Home & life', icon: 'House', options: ['Plants', 'Pets', 'Parenting', 'DIY', 'Thrifting', 'Cars & bikes'] },
] as const;
export type InterestGroup = (typeof INTEREST_GROUPS)[number];
export type Interest = InterestGroup['options'][number];
/** Every interest, flat, for validation and matching. */
export const INTERESTS: readonly Interest[] = INTEREST_GROUPS.flatMap((g) => g.options);
/** How many interests one person can have on at once. */
export const MAX_INTERESTS = 10;

/** Pairs that gel: one side needs what the other makes. */
export const COMPLEMENTS: readonly [Interest, Interest][] = [
  ['Photography', 'Fashion'], ['Photography', 'Travel'], ['Writing', 'Video'], ['Writing', 'Books'], ['Writing', 'Podcasting'], ['Video', 'Film making'], ['Music making', 'Dance'], ['Music making', 'Film making'],
  ['Comedy', 'Open mics'], ['Art & design', 'Business'], ['Cooking', 'Trying new places'], ['Baking', 'Coffee'], ['Street food', 'Travel'], ['Road trips', 'Camping'], ['Hiking', 'Nature'], ['Camping', 'Stargazing'],
  ['Gym', 'Running'], ['Yoga', 'Meditation'], ['Cycling', 'Hiking'], ['Tech', 'Coding'], ['Coding', 'Gaming'], ['Business', 'Finance'], ['Science', 'Books'], ['Languages', 'Travel'], ['Live music', 'Festivals'],
  ['Movies', 'Series'], ['Gaming', 'Anime'], ['Board games', 'Comics'], ['Volunteering', 'Mentoring'], ['Education', 'Mentoring'], ['Climate', 'Nature'], ['Animals', 'Pets'], ['Plants', 'Nature'], ['Journaling', 'Mental health'],
  ['Fashion', 'Thrifting'], ['Skincare', 'Fashion'], ['Parenting', 'Education'], ['Spirituality', 'Meditation'], ['DIY', 'Cars & bikes'], ['Hip hop', 'Dance'], ['Bollywood', 'Dance'], ['Karaoke', 'Pop'],
];

/** How well two people's interests fit: a little overlap is good, complementary pairs are better, nothing in common is not. */
export function matchScore(a: readonly string[], b: readonly string[]): number {
  const shared = a.filter((x) => b.includes(x)).length;
  let complementary = 0;
  for (const [x, y] of COMPLEMENTS) if ((a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))) complementary += 1;
  if (shared === 0 && complementary === 0) return -1;
  return Math.min(3, shared) + Math.min(6, complementary * 2);
}

export interface MatchCandidate {
  id: string;
  interests: string[];
  area: string;
  lat: number | null;
  lng: number | null;
  joinedAt: string;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Fit between one candidate and a whole group: interest score plus nearness. People more than twenty km apart never share a table. */
function groupFit(c: MatchCandidate, group: MatchCandidate[]): number {
  let total = 0;
  for (const g of group) {
    if (c.lat !== null && c.lng !== null && g.lat !== null && g.lng !== null && distanceKm({ lat: c.lat, lng: c.lng }, { lat: g.lat, lng: g.lng }) > 20) return -100;
    total += matchScore(c.interests, g.interests) + (c.area && c.area === g.area ? 1 : 0);
  }
  return total;
}

/**
 * Greedy tables: the earliest signup seeds a group, then the best-fitting person joins until the table is full.
 * Groups smaller than three are not groups; their people are reported as unmatched.
 */
export function matchCircles(candidates: MatchCandidate[], groupSize: number): { groups: string[][]; unmatched: string[] } {
  const size = Math.max(3, Math.min(8, groupSize));
  const pool = [...candidates].sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1));
  const groups: MatchCandidate[][] = [];
  const unmatched: string[] = [];
  while (pool.length > 0) {
    const seed = pool.shift();
    if (!seed) break;
    const group = [seed];
    while (group.length < size && pool.length > 0) {
      let bestIndex = -1;
      let best = -Infinity;
      pool.forEach((c, i) => {
        const fit = groupFit(c, group);
        if (fit > best) {
          best = fit;
          bestIndex = i;
        }
      });
      if (bestIndex < 0 || best <= -50) break;
      group.push(pool.splice(bestIndex, 1)[0] as MatchCandidate);
    }
    if (group.length >= 3) groups.push(group);
    else {
      // Try to seat the leftovers at a table with one spare chair.
      for (const c of group) {
        const home = groups.find((g) => g.length < size + 1 && groupFit(c, g) > -50);
        if (home) home.push(c);
        else unmatched.push(c.id);
      }
    }
  }
  return { groups: groups.map((g) => g.map((c) => c.id)), unmatched };
}

/** Replies nest this deep; an answer to the deepest one lands beside it, so a long argument stays readable. */
export const MAX_REPLY_DEPTH = 4;
export const ANON_ANIMALS = ['Otter', 'Heron', 'Fox', 'Finch', 'Lynx', 'Panda', 'Gecko', 'Owl', 'Koala', 'Swan', 'Hare', 'Wren'] as const;
/** A made-up name from some bytes of a hash: the same person gets the same name in one conversation and a new one in the next. */
export function anonAliasFrom(bytes: ArrayLike<number>): string {
  return `${ALIAS_WORDS[(bytes[0] ?? 0) % ALIAS_WORDS.length]} ${ANON_ANIMALS[(bytes[1] ?? 0) % ANON_ANIMALS.length]} ${10 + ((bytes[2] ?? 0) % 90)}`;
}
/** Put replies in reading order: each one right under what it answers, oldest first inside a level. An orphan becomes a top-level reply. */
export function threadOrder<T extends { id: string; parentId: string | null; depth: number }>(rows: readonly T[]): T[] {
  const ids = new Set(rows.map((r) => r.id));
  const kids = new Map<string | null, T[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    kids.set(key, [...(kids.get(key) ?? []), r]);
  }
  const out: T[] = [];
  const walk = (key: string | null, depth: number) => {
    for (const r of kids.get(key) ?? []) {
      out.push({ ...r, depth: Math.min(depth, MAX_REPLY_DEPTH) });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
export const ALIAS_WORDS = ['Quiet', 'Bright', 'Curious', 'Steady', 'Wild', 'Gentle', 'Bold', 'Warm', 'Swift', 'Calm', 'Keen', 'Merry'] as const;

/** How someone will show up, so the table knows what colour to look for. Red for single, white for committed. */
export const CIRCLE_STATUSES = ['single', 'committed', 'private'] as const;
export type CircleStatus = (typeof CIRCLE_STATUSES)[number];
export const CIRCLE_STATUS_META: Record<CircleStatus, { name: string; wear: string; blurb: string }> = {
  single: { name: 'Single', wear: 'something red', blurb: 'Red on the table means open to meeting someone.' },
  committed: { name: 'Committed', wear: 'something white', blurb: 'White means here for friends and work.' },
  private: { name: 'Rather not say', wear: 'whatever you like', blurb: 'No colour, no questions.' },
};
export function isCircleStatus(v: unknown): v is CircleStatus {
  return typeof v === 'string' && (CIRCLE_STATUSES as readonly string[]).includes(v);
}
/** One line on what to wear, for the person's own pick. */
export function dressCodeFor(status: CircleStatus | null): string {
  if (!status) return 'Wear red if you are single, white if you are committed, or anything if you would rather not say.';
  const m = CIRCLE_STATUS_META[status];
  return status === 'private' ? `You chose not to say, so wear ${m.wear}. Red on others means single, white means committed.` : `You said ${m.name.toLowerCase()}, so wear ${m.wear}. ${status === 'single' ? 'White on others means committed.' : 'Red on others means single.'}`;
}

/** The same weekday and time, one week on. */
export function nextWeek(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 86_400_000).toISOString();
}

export interface CircleEvent {
  id: string;
  title: string;
  city: string;
  area: string;
  startsAt: string;
  venueHint: string;
  groupSize: number;
  status: 'open' | 'matched' | 'done' | 'cancelled';
  /** Weekly circles open the next occurrence on their own once this one's tables are set. */
  repeat: 'none' | 'weekly';
  seriesId: string | null;
  signups: number;
  joined: boolean;
  /** The person's own pick when they joined. Never anyone else's. */
  myStatus: CircleStatus | null;
  myGroupId: string | null;
  /** The xp its attendee code gives, when the host made one. */
  attendeeXp: number | null;
  /** The code itself, with its counts, for the host and events staff only. */
  hostCode: AttendeeCodeHost | null;
  createdAt: string;
}

export interface CircleMember {
  alias: string;
  character: RelationshipKey;
  interests: string[];
  revealed: boolean;
  /** Only present once the person chose to reveal. */
  name: string | null;
  handle: string | null;
  userId: string | null;
  isMe: boolean;
}

export interface CircleMessage {
  id: string;
  alias: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface CircleGroup {
  id: string;
  eventId: string;
  eventTitle: string;
  city: string;
  area: string;
  startsAt: string;
  name: string;
  venue: string;
  plan: string;
  chatOpensAt: string;
  chatOpen: boolean;
  chatClosesAt: string;
  members: CircleMember[];
  messages: CircleMessage[];
  myAlias: string;
  myStatus: CircleStatus | null;
  repeat: 'none' | 'weekly';
}
