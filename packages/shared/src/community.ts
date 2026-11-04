import { formatCount } from './core.ts';
import { LISTING_TYPES } from './work.ts';
import type { ListingType } from './work.ts';
import type { IconName, Role } from './roles.ts';

// ---------------------------------------------------------------------------
// Journal, community, resources, notifications, companion
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  emotion: number | null;
  stress: number | null;
  stressors: string[];
  createdAt: string;
  updatedAt: string;
}

export const POST_CATEGORIES = ['Self care', 'Mindfulness', 'Stories', 'Support', 'Creative', 'Learning', 'Stress', 'Affirmation', 'Awareness'] as const;

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string | null;
  /** The author's standing, so a guide or admin sees whether they may mute them. */
  authorRank: CommunityRank;
  /** Written under a made-up name. The author's id, handle and followers are never sent, except the id to staff. */
  anonymous: boolean;
  /** The viewer wrote it. */
  mine: boolean;
  authorPro: boolean;
  /** Whether the viewer follows the author, and how many people do. */
  authorFollowing: boolean;
  authorFollowers: number;
  category: string;
  body: string;
  /** Members-only posts belong to a membership product. */
  productId: string | null;
  /** Every reaction counts here; `liked` is whether the viewer reacted at all. */
  likes: number;
  liked: boolean;
  reactions: ReactionCounts;
  myReaction: ReactionKind | null;
  replies: number;
  hidden: boolean;
  /** Pinned to the top of its category by a guide. */
  pinned: boolean;
  /** A first post waiting for a guide's okay: only its author and guides see it. */
  held: boolean;
  /** The viewer follows the post: new replies land in their inbox under Following. */
  followingPost: boolean;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  anonymous: boolean;
  mine: boolean;
  /** The reply this answers, or null for a reply straight to the post. */
  parentId: string | null;
  /** How far in it sits: 0 for a reply to the post, up to `MAX_REPLY_DEPTH`. */
  depth: number;
  body: string;
  reactions: ReactionCounts;
  myReaction: ReactionKind | null;
  createdAt: string;
}

/** Six ways to react to a post or a reply. Any of them on a post is the like that pays, once per post. */
export const REACTIONS = ['like', 'celebrate', 'support', 'love', 'insightful', 'funny'] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export type ReactionCounts = Partial<Record<ReactionKind, number>>;
export const REACTION_META: Record<ReactionKind, { name: string; icon: IconName }> = {
  like: { name: 'Like', icon: 'ThumbsUp' },
  celebrate: { name: 'Celebrate', icon: 'PartyPopper' },
  support: { name: 'Support', icon: 'HandHeart' },
  love: { name: 'Love', icon: 'Heart' },
  insightful: { name: 'Insightful', icon: 'Lightbulb' },
  funny: { name: 'Funny', icon: 'FaceGrinning' },
};
export const isReaction = (v: unknown): v is ReactionKind => typeof v === 'string' && (REACTIONS as readonly string[]).includes(v);
/** Pinned posts a category can hold at once. */
export const MAX_PINNED = 3;
/** People one post or reply can mention. More @handles are left as plain text. */
export const MAX_MENTIONS = 5;
/** The @handles in a text, lower case, in order, each once: the same shape a handle is saved in. */
export function mentionsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:^|[^a-z0-9_@.])@([a-z0-9_]{3,20})\b/gi)) {
    const h = (m[1] ?? '').toLowerCase();
    if (!out.includes(h)) out.push(h);
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chat channels (migration 0062): topic rooms in Community (public, made by guides, anonymous lines allowed) and in Bond
// (private, made by a member for friends, never anonymous). Polled, not live: the screen asks for lines newer than the last one it holds.
// ---------------------------------------------------------------------------

export const CHANNEL_SCOPES = ['community', 'bond'] as const;
export type ChannelScope = (typeof CHANNEL_SCOPES)[number];
export const MIN_CHANNEL_NAME = 2;
export const MAX_CHANNEL_NAME = 40;
export const MAX_CHANNEL_TOPIC = 120;
export const MAX_CHANNEL_MESSAGE = 600;
/** People in one private channel, the owner included. */
export const MAX_CHANNEL_MEMBERS = 12;
/** Private channels one person can own at a time. */
export const MAX_CHANNELS_OWNED = 5;
/** Channels one person can be in at a time, public and private together. */
export const MAX_CHANNELS_JOINED = 40;
/** Public channels that can be open in Community at once. */
export const MAX_COMMUNITY_CHANNELS = 30;
/** How often an open channel asks for newer lines, while its tab is showing. */
export const CHANNEL_POLL_MS = 5000;
/** Lines in one answer. "Load earlier" asks for the next block. */
export const CHANNEL_LINES = 50;
/** Within this many pixels of the end counts as "at the bottom": new lines then scroll into view. */
export const CHANNEL_NEAR_BOTTOM_PX = 80;

/** The short word a channel is known by: letters and numbers (any script) in lower case, joined by hyphens. Empty when the name has none. */
export function channelSlug(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
}
/** What is wrong with a channel name, in plain words, or null when it is fine. */
export function channelNameProblem(name: unknown): string | null {
  if (typeof name !== 'string') return 'Give the channel a name.';
  const n = name.trim();
  if (n.length < MIN_CHANNEL_NAME) return `A channel name needs at least ${MIN_CHANNEL_NAME} letters.`;
  if (n.length > MAX_CHANNEL_NAME) return `Keep the name under ${MAX_CHANNEL_NAME} letters.`;
  if (!channelSlug(n)) return 'Use some letters or numbers in the name.';
  return null;
}
/** A channel line as it is kept: line breaks tidied, no run of blank lines, trimmed, cut at the limit. */
export function cleanChannelMessage(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHANNEL_MESSAGE);
}
/** What is wrong with a line before it is sent, or null. */
export function channelMessageProblem(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return 'Write something first.';
  if (raw.trim().length > MAX_CHANNEL_MESSAGE) return `Keep a line under ${MAX_CHANNEL_MESSAGE} letters.`;
  return null;
}
/** A line number from a query string, or null when it is not a whole number above zero. */
export function channelCursor(raw: unknown): number | null {
  const n = typeof raw === 'string' && /^\d{1,12}$/.test(raw) ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
/** Put lines newer or older than the ones held into the list: oldest first, each line once (the newer copy wins). */
export function mergeChannelLines<T extends { seq: number }>(held: readonly T[], fresh: readonly T[]): T[] {
  const bySeq = new Map<number, T>();
  for (const l of held) bySeq.set(l.seq, l);
  for (const l of fresh) bySeq.set(l.seq, l);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}
/** Whether a scroll box is at (or nearly at) its end, so a new line may scroll into view without pulling anyone away from what they are reading. */
export function isNearBottom(box: { scrollHeight: number; scrollTop: number; clientHeight: number }, slack = CHANNEL_NEAR_BOTTOM_PX): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= slack;
}
/** The unread dot's number: nothing, the count, or 99+. */
export function unreadLabel(n: number): string {
  return n <= 0 ? '' : n > 99 ? '99+' : String(n);
}

export interface Channel {
  id: string;
  scope: ChannelScope;
  slug: string;
  name: string;
  topic: string;
  kind: 'public' | 'private';
  members: number;
  /** The person is in it. */
  joined: boolean;
  /** A private channel's owner asked the person in, and they have not answered. */
  invited: boolean;
  /** Lines from other people since the person last read it. */
  unread: number;
  lastLineAt: string | null;
  archived: boolean;
  /** The person made it (Bond). */
  owner: boolean;
  /** The person may rename it, archive it and take down any line. */
  canManage: boolean;
  createdAt: string;
}
export interface ChannelLine {
  /** The line's place in its channel: only ever goes up, and is what polling and "load earlier" ask by. */
  seq: number;
  id: string;
  /** Empty for a line written anonymously, unless the reader wrote it or is staff. */
  userId: string;
  name: string;
  handle: string | null;
  anonymous: boolean;
  mine: boolean;
  /** Community rank, shown with the name. Hidden on an anonymous line except to staff. */
  rank: CommunityRank | null;
  body: string;
  createdAt: string;
  replyTo: { id: string; name: string; body: string } | null;
}
export interface ChannelMember {
  userId: string;
  name: string;
  handle: string | null;
  role: 'member' | 'mod';
  owner: boolean;
}

export type ResourceKind = 'article' | 'exercise' | 'video';

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  summary: string;
  body: string;
  url: string | null;
  tags: string[];
  published: boolean;
  authorName: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

/**
 * Inbox tabs, by what a note is about. All holds everything; Team is only offered to staff and admins. A kind that is
 * in no tab shows under All only.
 */
export const INBOX_TABS = ['all', 'replies', 'following', 'events', 'coaching', 'agency', 'team'] as const;
export type InboxTab = (typeof INBOX_TABS)[number];
export const INBOX_TAB_META: Record<InboxTab, { name: string; kinds: readonly string[] }> = {
  all: { name: 'Everything', kinds: [] },
  replies: { name: 'Replies and mentions', kinds: ['reply', 'mention'] },
  following: { name: 'Following', kinds: ['thread', 'follow', 'broadcast'] },
  events: { name: 'Events', kinds: ['party', 'circle', 'run', 'event'] },
  coaching: { name: 'Coaching', kinds: ['coach'] },
  // Client answers, months made, invoices due and past due. Offered only while Agency is on for the person.
  agency: { name: 'Agency', kinds: ['agency'] },
  // Notes about work waiting for the team, such as an ask to be made a life coach.
  team: { name: 'Team', kinds: ['team'] },
};
export const isInboxTab = (v: unknown): v is InboxTab => typeof v === 'string' && (INBOX_TABS as readonly string[]).includes(v);
export type InboxShow = 'inbox' | 'unread' | 'archived';

/** Reminders before an event someone signed up for: a day before, then an hour before. */
export const EVENT_REMINDERS = [
  { kind: 'day', before: 24 * 60 },
  { kind: 'hour', before: 60 },
] as const;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  createdAt: string;
  /** Who answered a Companion line: a model id, 'workers-ai', 'local' or 'crisis'. Absent on the person's own lines and old rows. */
  model?: string;
}


// ---------------------------------------------------------------------------
// Social: what the feed can sort and filter by, what each action pays, and the trust score a seller carries
// ---------------------------------------------------------------------------

export const FEED_SORTS = ['recent', 'popular', 'talked'] as const;
export type FeedSort = (typeof FEED_SORTS)[number];
export const FEED_SORT_META: Record<FeedSort, string> = { recent: 'Recent', popular: 'Popular', talked: 'Most replies' };
export const FEED_FILTERS = ['all', 'following', 'mine'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];
export const FEED_FILTER_META: Record<FeedFilter, string> = { all: 'Everyone', following: 'Following', mine: 'Mine' };

/** What a social action pays, and how many times a day it can. Small on purpose: the point is to show up, not to farm. */
export const SOCIAL_REWARDS = {
  post: { xp: 5, points: 0, perDay: 3, label: 'a post' },
  reply: { xp: 2, points: 0, perDay: 5, label: 'a reply' },
  like: { xp: 1, points: 0, perDay: 10, label: 'a like you give' },
  liked: { xp: 0, points: 1, perDay: 20, label: 'a like on your post' },
  follower: { xp: 0, points: 2, perDay: 20, label: 'a new follower' },
} as const;
export type SocialRewardKind = keyof typeof SOCIAL_REWARDS;
export interface SocialAward {
  xp: number;
  points: number;
}

/** What a trust score is made of: things that take time and work to earn, never a claim. */
export interface TrustInput {
  xp: number;
  pointsEarned: number;
  bestStreak: number;
  daysHere: number;
  sold: number;
  rating: number | null;
  honors: number;
}
export interface TrustPart {
  label: string;
  value: string;
  score: number;
}
export interface TrustScore {
  score: number;
  label: string;
  parts: TrustPart[];
}
const TRUST_LABELS: [number, string][] = [
  [75, 'Well trusted'],
  [50, 'Trusted'],
  [25, 'Getting known'],
  [0, 'New here'],
];
const cap100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * One number out of a hundred for how much a seller has proved, built only from what they earned:
 * xp, points, a best streak, time here, sales and their rating, and honors from the team.
 * Nothing here can be typed in; it all comes from showing up.
 */
export function trustScore(i: TrustInput): TrustScore {
  const parts: (TrustPart & { weight: number })[] = [
    { label: 'Xp earned', value: `${formatCount(i.xp)} xp`, score: cap100(i.xp / 20), weight: 30 },
    { label: 'Points earned', value: `${formatCount(i.pointsEarned)} points`, score: cap100(i.pointsEarned / 5), weight: 20 },
    { label: 'Best streak', value: `${i.bestStreak} ${i.bestStreak === 1 ? 'day' : 'days'} in a row`, score: cap100(i.bestStreak * 5), weight: 15 },
    { label: 'Time here', value: i.daysHere < 1 ? 'joined today' : `${i.daysHere} ${i.daysHere === 1 ? 'day' : 'days'}`, score: cap100(i.daysHere / 1.8), weight: 15 },
    { label: 'Sales', value: i.sold === 0 ? 'none yet' : `${i.sold} sold${i.rating ? `, rated ${i.rating.toFixed(1)}` : ''}`, score: i.sold === 0 ? 0 : cap100((cap100(i.sold * 10) + (i.rating ? (i.rating / 5) * 100 : 70)) / 2), weight: 10 },
    { label: 'Honors', value: i.honors === 0 ? 'none yet' : `${i.honors} from the team`, score: cap100(i.honors * 34), weight: 10 },
  ];
  const score = cap100(parts.reduce((s, p) => s + p.score * p.weight, 0) / 100);
  const label = TRUST_LABELS.find(([at]) => score >= at)?.[1] ?? 'New here';
  return { score, label, parts: parts.map(({ label, value, score }) => ({ label, value, score })) };
}

// ---------------------------------------------------------------------------
// Media: pictures, GIFs and videos on listings, lessons and events. Uploaded or linked.
// ---------------------------------------------------------------------------

export type MediaKind = 'image' | 'gif' | 'video';
export interface MediaItem {
  id: string;
  kind: MediaKind;
  /** An https link, or the app's own `/api/public/media/<id>` for a file that was uploaded. */
  url: string;
  caption: string;
}
/** Who can carry media: every public listing, a lesson in School, a creator's product, a store item and a pre-owned listing. */
export type MediaOwner = ListingType | 'lesson' | 'product' | 'item' | 'preowned';
export const MEDIA_OWNERS: readonly MediaOwner[] = [...LISTING_TYPES, 'lesson', 'product', 'item', 'preowned'];
export const MAX_MEDIA_ITEMS = 8;
export const MAX_MEDIA_CAPTION = 120;
/** An upload is a picture or a GIF. The browser shrinks pictures first; videos are linked, never uploaded. */
export const MAX_UPLOAD_BYTES = 1_000_000;
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;
export const OWN_MEDIA_PREFIX = '/api/public/media/';

export interface MediaEmbed {
  /** `frame` is a player on another site; `file` is a video file the browser plays itself. */
  type: 'frame' | 'file';
  src: string;
}

/** A link taken apart, without needing the browser's URL: https only. */
function splitLink(raw: string): { host: string; path: string; query: Record<string, string> } | null {
  const m = /^https:\/\/([^/?#\s]+)([^?#\s]*)(?:\?([^#\s]*))?(?:#.*)?$/i.exec(raw.trim());
  if (!m) return null;
  const query: Record<string, string> = {};
  for (const pair of (m[3] ?? '').split('&')) {
    const [k, v = ''] = pair.split('=');
    if (k) query[k] = v;
  }
  const host = (m[1] ?? '').toLowerCase().replace(/:\d+$/, '').replace(/^(www|m)\./, '');
  return { host, path: m[2] ?? '', query };
}

/** How to play a video link: YouTube and Vimeo in their own player, a direct file in the browser's. */
export function videoEmbed(url: string): MediaEmbed | null {
  const u = splitLink(url);
  if (!u) return null;
  const parts = u.path.split('/').filter(Boolean);
  const yt = (id: string): MediaEmbed | null => (/^[\w-]{6,20}$/.test(id) ? { type: 'frame', src: `https://www.youtube-nocookie.com/embed/${id}` } : null);
  if (u.host === 'youtu.be') return yt(parts[0] ?? '');
  if (u.host === 'youtube.com' || u.host === 'youtube-nocookie.com') return yt(u.query.v ?? (['embed', 'shorts', 'live'].includes(parts[0] ?? '') ? (parts[1] ?? '') : ''));
  if (u.host === 'vimeo.com' || u.host === 'player.vimeo.com') {
    const id = parts.find((x) => /^\d{5,}$/.test(x)) ?? '';
    return id ? { type: 'frame', src: `https://player.vimeo.com/video/${id}` } : null;
  }
  return /\.(mp4|webm|mov|m4v)$/i.test(u.path) ? { type: 'file', src: url.trim() } : null;
}

/** What a pasted link is: a video we can play, a GIF, or a picture. Null when it is none of them. */
export function mediaFromLink(raw: string): { kind: MediaKind; url: string } | null {
  const url = raw.trim().slice(0, 500);
  if (url.startsWith(OWN_MEDIA_PREFIX)) return { kind: 'image', url };
  const u = splitLink(url);
  if (!u) return null;
  if (videoEmbed(url)) return { kind: 'video', url };
  return { kind: /\.gif$/i.test(u.path) ? 'gif' : 'image', url };
}

/** Where a guest can get their pictures after an event: a shared folder on one of these. */
export const PHOTO_HOSTS = ['drive.google.com', 'photos.google.com', 'photos.app.goo.gl', 'dropbox.com', 'icloud.com', '1drv.ms', 'onedrive.live.com', 'wetransfer.com', 'we.tl'] as const;
export function photoLinkProblem(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return 'Paste the link to your photo folder.';
  const u = splitLink(raw);
  if (!u) return 'Use a link that starts with https.';
  return PHOTO_HOSTS.some((h) => u.host === h || u.host.endsWith(`.${h}`)) ? null : 'Use a Google Drive, Google Photos, Dropbox, iCloud, OneDrive or WeTransfer link.';
}

/** The events that carry a photo link, a conversation and a list of people to connect with. Circles keep their own anonymous tables. */
export type EventApp = 'party' | 'run';
export const EVENT_APPS: readonly EventApp[] = ['party', 'run'];
export const MAX_EVENT_MESSAGE = 500;

export interface EventPhotos {
  url: string;
  note: string;
}
export interface EventMessage {
  id: string;
  /** Empty for a line written anonymously. */
  userId: string;
  anonymous: boolean;
  parentId: string | null;
  depth: number;
  name: string;
  handle: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
  /** The host's own lines wear a tag. */
  host: boolean;
}
export interface EventPerson {
  userId: string;
  name: string;
  handle: string | null;
  /** none, sent (you asked), pending (they asked you), friends. */
  friend: 'none' | 'sent' | 'pending' | 'friends';
}
/** What the event page shows beyond the event itself, for a guest, the host and staff. */
export interface EventExtras {
  /** Host, staff or a guest: who may read the conversation and the photos. */
  role: 'host' | 'guest';
  started: boolean;
  ended: boolean;
  photos: EventPhotos | null;
  messages: EventMessage[];
  /** Guests who said yes to meeting others, and allow friend requests. */
  people: EventPerson[];
  /** Whether the person is on that list themselves. */
  iAmListed: boolean;
}

/** Who may do what to another member in Community. A rank, not a switch: nobody acts on an equal or a higher rank. */
export const COMMUNITY_RANKS = { member: 0, guide: 1, staff: 2, admin: 3 } as const;
export type CommunityRank = keyof typeof COMMUNITY_RANKS;
export const communityRankOf = (u: { role: Role; permissions: readonly string[] }): CommunityRank =>
  u.role === 'admin' ? 'admin' : u.role === 'sub_admin' ? 'staff' : u.permissions.includes('moderation') ? 'guide' : 'member';
/** Muting someone from Community: a guide or above, and only someone of a lower rank. */
export const canMute = (actor: CommunityRank, target: CommunityRank): boolean => COMMUNITY_RANKS[actor] >= COMMUNITY_RANKS.guide && COMMUNITY_RANKS[actor] > COMMUNITY_RANKS[target];

export interface BlockedPerson {
  userId: string;
  name: string;
  handle: string | null;
  createdAt: string;
}
