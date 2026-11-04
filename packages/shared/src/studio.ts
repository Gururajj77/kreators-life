import type { Page, RelationshipKey } from './core.ts';
import type { SocialPlatform } from './work.ts';
import type { ResourceKind } from './community.ts';
import type { IconName } from './roles.ts';
import type { Order, ProductKind, QuizQuestion } from './account.ts';

// ---------------------------------------------------------------------------
// Content strategist: one folder per brand, fed links, researched through Agent Reach, written up by a model.
// ---------------------------------------------------------------------------

export const MAX_BRANDS = 20;

/** A question buyers ask and the creator's answer, shown at the foot of a product's page. */
export interface ProductFaq {
  q: string;
  a: string;
}
export const MAX_FAQ = 6;
export const FAQ_Q_MAX = 120;
export const FAQ_A_MAX = 500;
/** The one reader for a creator's FAQ, from the browser or a column: only clean, non-empty pairs, trimmed and capped. */
export function parseFaq(raw: unknown): ProductFaq[] {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: ProductFaq[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const o = item as { q?: unknown; a?: unknown };
    const q = typeof o.q === 'string' ? o.q.trim().slice(0, FAQ_Q_MAX) : '';
    const a = typeof o.a === 'string' ? o.a.trim().slice(0, FAQ_A_MAX) : '';
    if (q && a) out.push({ q, a });
    if (out.length >= MAX_FAQ) break;
  }
  return out;
}

/** How many devices one account can be signed in on at once. A fourth sign-in signs the oldest one out. */
export const MAX_DEVICES = 3;
export const MAX_BRAND_SOURCES = 40;
export const BRAND_NAME_MAX = 80;
export const BRIEF_MAX = 4000;

export const BRAND_SOURCE_KINDS = ['site', 'youtube', 'instagram', 'x', 'tiktok', 'reddit', 'article', 'competitor'] as const;
export type BrandSourceKind = (typeof BRAND_SOURCE_KINDS)[number];
export const BRAND_SOURCE_META: Record<BrandSourceKind, { name: string; icon: IconName }> = {
  site: { name: 'Website', icon: 'Globe' },
  youtube: { name: 'YouTube', icon: 'SquarePlay' },
  instagram: { name: 'Instagram', icon: 'Camera' },
  x: { name: 'X', icon: 'AtSign' },
  tiktok: { name: 'TikTok', icon: 'EighthNote' },
  reddit: { name: 'Reddit', icon: 'MessagesSquare' },
  article: { name: 'Article', icon: 'Newspaper' },
  competitor: { name: 'Competitor', icon: 'Swords' },
};
/** Which kind a link is, from its address. A competitor is a choice, never a guess. */
export function sourceKindOf(url: string): BrandSourceKind {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('twitter.com') || u.includes('x.com/')) return 'x';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('reddit.com') || u.includes('redd.it')) return 'reddit';
  if (/\/(blog|news|article|post)s?\//.test(u) || u.includes('medium.com') || u.includes('substack.com')) return 'article';
  return 'site';
}

export const RESEARCH_KINDS = ['read', 'search', 'youtube_search', 'channels', 'outliers', 'x_search', 'reddit_search', 'transcript', 'profile'] as const;
export type ResearchKind = (typeof RESEARCH_KINDS)[number];
export const RESEARCH_META: Record<ResearchKind, { name: string; blurb: string; needsQuery: boolean }> = {
  read: { name: 'Read a link', blurb: 'The page, post or video behind a link, as text.', needsQuery: false },
  search: { name: 'Search the web', blurb: 'What the web says about a topic, niche or brand.', needsQuery: true },
  youtube_search: { name: 'Search YouTube', blurb: 'Videos on a topic, newest and most relevant.', needsQuery: true },
  channels: { name: 'Find channels', blurb: 'The YouTube channels winning on a topic, with how many people follow each and how their videos do.', needsQuery: true },
  outliers: { name: 'Find outliers', blurb: 'Videos on a topic sorted by views, so the ones that broke out float up.', needsQuery: true },
  x_search: { name: 'Search X', blurb: 'Posts on a topic. Needs Agent Reach with an X login.', needsQuery: true },
  reddit_search: { name: 'Search Reddit', blurb: 'Threads on a topic. Needs Agent Reach with a Reddit login.', needsQuery: true },
  transcript: { name: 'Transcript', blurb: 'The words spoken in a YouTube video.', needsQuery: false },
  profile: { name: 'Profile', blurb: 'An X or Instagram account and its recent posts.', needsQuery: false },
};

export const PIECE_KINDS = ['audit', 'plan', 'calendar', 'ideas', 'hooks', 'script', 'post', 'analysis', 'playbook'] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];
export const PIECE_META: Record<PieceKind, { name: string; icon: IconName; blurb: string; askFor: string }> = {
  audit: { name: 'Strategy audit', icon: 'ScanSearch', blurb: 'What the brand does now, what wins in its niche, the gaps, and ten moves in order.', askFor: 'Anything the audit should weigh, like a launch date or a platform you care about most.' },
  plan: { name: 'Marketing plan', icon: 'Map', blurb: 'Positioning, who it is for, three content pillars, channels and cadence, the first 30, 60 and 90 days, and the numbers to watch.', askFor: 'The goal, the budget if any, and the time you can give it each week.' },
  calendar: { name: 'Four-week calendar', icon: 'CalendarDays', blurb: 'Four weeks of posts: day, platform, format, hook and call to action.', askFor: 'How many posts a week, and on which platforms.' },
  ideas: { name: 'Video ideas', icon: 'Lightbulb', blurb: 'Fifteen ideas, each with its angle, hook, format and the research that says it should work.', askFor: 'A theme, a product to push, or nothing at all.' },
  hooks: { name: 'Hooks', icon: 'Anchor', blurb: 'Twenty opening lines in the patterns the outliers used, grouped by type, each with why it works.', askFor: 'The topic of the video the hooks are for.' },
  script: { name: 'Short-form script', icon: 'Clapperboard', blurb: 'A 30 to 60 second script: the hook, the setup, the payoff, the call to action. Remix a winner, start from scratch, or fix a draft.', askFor: 'The idea, or paste a draft to fix, or name the research item to remix.' },
  post: { name: 'Posts and captions', icon: 'PenLine', blurb: 'Captions and threads ready to post, one per platform you name.', askFor: 'What the post is about and which platforms.' },
  playbook: { name: 'What is working', icon: 'BookBookmark', blurb: 'The patterns behind the winners: hook types, structures, lengths and topics, counted, each with the video that shows it, and what to copy and what to skip.', askFor: 'The platform and format you want the patterns for, like YouTube Shorts under a minute.' },
  analysis: { name: 'Why it worked', icon: 'FlaskConical', blurb: 'One video or post taken apart: the hook, the structure, the format, the style, and what to take from it.', askFor: 'Which research item to take apart, or paste the transcript.' },
};

export interface Brand {
  id: string;
  name: string;
  niche: string;
  description: string;
  /** How the brand sounds, in the owner's words. Goes into every piece. */
  voice: string;
  sources: number;
  runs: number;
  pieces: number;
  createdAt: string;
  updatedAt: string;
}
export interface BrandSource {
  id: string;
  kind: BrandSourceKind;
  url: string;
  label: string;
  /** The first lines of what was read, so the folder shows what each link is. */
  summary: string;
  meta: Record<string, unknown>;
  lastReadAt: string | null;
  createdAt: string;
}
/** One thing research brought back: a page, a video, a post. */
export interface ResearchItem {
  title: string;
  url: string;
  author: string;
  publishedAt: string;
  text: string;
  /** Numbers when the platform gives them: views, likes, comments, followers. */
  stats: Record<string, number>;
}
export interface ResearchRun {
  id: string;
  kind: ResearchKind;
  query: string;
  status: 'done' | 'failed';
  /** Which road brought the data: agent-reach, page, youtube-api, or none. */
  backend: string;
  items: ResearchItem[];
  error: string;
  createdAt: string;
}
export interface BrandPiece {
  id: string;
  kind: PieceKind;
  title: string;
  brief: string;
  /** Markdown in the app's small dialect. */
  body: string;
  sources: string[];
  /** claude, workers-ai or digest, so a draft never passes for a model's work. */
  writer: string;
  status: 'draft' | 'kept';
  createdAt: string;
  updatedAt: string;
}
export interface BrandDetail {
  brand: Brand;
  sources: BrandSource[];
  runs: ResearchRun[];
  pieces: BrandPiece[];
  page: Page;
  /** What the server can do right now, so the screen says it before anyone waits. */
  tools: { reach: boolean; writer: 'claude' | 'workers-ai' | 'none' };
  /** How many finished runs and pieces of each kind the folder holds, so the strategy path knows where you are. */
  counts: { runs: Partial<Record<ResearchKind, number>>; pieces: Partial<Record<PieceKind, number>> };
}

/** The path from "who is this for" to a month of posts. Each step is done by doing the thing, never ticked by hand. */
export interface PathStep {
  key: string;
  title: string;
  why: string;
  done: boolean;
  /** Where the step's button goes: the brand's details, a research run, or a piece to write. */
  go: { to: 'edit' } | { to: 'research'; kind: ResearchKind } | { to: 'create'; kind: PieceKind };
}
export function strategyPath(brand: Pick<Brand, 'niche' | 'voice'>, counts: BrandDetail['counts']): PathStep[] {
  const r = (k: ResearchKind) => (counts.runs[k] ?? 0) > 0;
  const p = (k: PieceKind) => (counts.pieces[k] ?? 0) > 0;
  return [
    { key: 'say', title: 'Say what this brand makes and how it sounds', why: 'Every step after this leans on the niche and the voice.', done: Boolean(brand.niche.trim() && brand.voice.trim()), go: { to: 'edit' } },
    { key: 'channels', title: 'See who is winning', why: 'The channels that already own your topic show what an audience wants.', done: r('channels'), go: { to: 'research', kind: 'channels' } },
    { key: 'outliers', title: 'Find what broke out', why: 'Videos far above their channel\'s usual views are the ones to learn from.', done: r('outliers'), go: { to: 'research', kind: 'outliers' } },
    { key: 'analysis', title: 'Take one winner apart', why: 'See its hook, its beats and its length, one at a time.', done: p('analysis'), go: { to: 'create', kind: 'analysis' } },
    { key: 'playbook', title: 'Write your playbook', why: 'The patterns across all the winners, counted, with what to copy and what to skip.', done: p('playbook'), go: { to: 'create', kind: 'playbook' } },
    { key: 'ideas', title: 'Pick your ideas', why: 'Fifteen ideas that lean on the playbook, each with its hook.', done: p('ideas'), go: { to: 'create', kind: 'ideas' } },
    { key: 'script', title: 'Write the script for the best one', why: 'Hook, setup, payoff and call to action, in your voice.', done: p('script'), go: { to: 'create', kind: 'script' } },
    { key: 'calendar', title: 'Plan the month', why: 'Four weeks of posts, so you are never starting from a blank page.', done: p('calendar'), go: { to: 'create', kind: 'calendar' } },
  ];
}

// ---------------------------------------------------------------------------
// Growth: tracked links, content attribution, Auto-DM, funnels, sequences
// ---------------------------------------------------------------------------

export const LINK_SOURCES = ['content', 'automation', 'bio', 'youtube', 'newsletter', 'other'] as const;
export type LinkSource = (typeof LINK_SOURCES)[number];

export interface TrackedLink {
  id: string;
  code: string;
  /** Null means the link opens your page. */
  productId: string | null;
  productTitle: string | null;
  sourceType: LinkSource;
  contentItemId: string | null;
  automationId: string | null;
  label: string;
  clicks: number;
  checkouts: number;
  sales: number;
  revenuePoints: number;
  createdAt: string;
}

export const CONTENT_KINDS = ['reel', 'post', 'carousel', 'story', 'video', 'short', 'other'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

/** A post, Reel or video you made, with its numbers and what it sold. */
export interface ContentItem {
  id: string;
  platform: SocialPlatform;
  kind: ContentKind;
  url: string;
  caption: string;
  postedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  syncedAt: string | null;
  links: number;
  clicks: number;
  sales: number;
  revenuePoints: number;
  /** Revenue per thousand views, when views are known. */
  rpm: number | null;
  createdAt: string;
}

export interface DmAutomation {
  id: string;
  contentItemId: string | null;
  contentCaption: string | null;
  keywords: string[];
  dmMessage: string;
  publicReplies: string[];
  linkId: string;
  linkCode: string;
  productTitle: string | null;
  active: boolean;
  matched: number;
  sent: number;
  queued: number;
  failed: number;
  clicks: number;
  sales: number;
  revenuePoints: number;
  createdAt: string;
}

export interface DmSend {
  id: string;
  automationId: string;
  recipientHandle: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error: string;
  createdAt: string;
}

export type FunnelStepKind = 'content' | 'automation' | 'link' | 'lead' | 'product' | 'broadcast';
export interface FunnelStep {
  kind: FunnelStepKind;
  ref: string;
  label: string;
  /** Filled by the server: people at this step. */
  count?: number;
}
export interface Funnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  createdAt: string;
}

/** A message sent to buyers some days after a purchase. */
export interface Sequence {
  id: string;
  productId: string | null;
  productTitle: string | null;
  delayDays: number;
  title: string;
  body: string;
  active: boolean;
  sent: number;
  createdAt: string;
}

export interface DmRequest {
  id: string;
  productId: string;
  productTitle: string;
  ownerName: string;
  buyerName: string;
  question: string;
  answer: string;
  status: 'open' | 'answered' | 'refunded';
  dueAt: string;
  answeredAt: string | null;
  createdAt: string;
}

export interface Certificate {
  code: string;
  productTitle: string;
  learnerName: string;
  ownerName: string;
  issuedAt: string;
}

export interface Customer {
  userId: string;
  name: string;
  handle: string | null;
  email: string | null;
  orders: number;
  points: number;
  cents: number;
  firstAt: string;
  lastAt: string;
  /** Where their first purchase came from. */
  source: string;
}

export interface PayoutSummary {
  feeBps: number;
  grossPoints: number;
  feePoints: number;
  affiliatePoints: number;
  netPoints: number;
  refundedPoints: number;
  testCents: number;
  rows: { orderId: string; productTitle: string; buyerName: string; points: number; fee: number; affiliate: number; net: number; status: Order['status']; createdAt: string }[];
}

// ---------------------------------------------------------------------------
// Payments, KYC, email, events: the operator's side
// ---------------------------------------------------------------------------

export interface PaymentsConfig {
  /** test: orders are recorded and nothing is charged. razorpay: the provider is live. */
  mode: 'test' | 'razorpay';
  keyId: string | null;
  currency: string;
}

export interface KycProfile {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  legalName: string;
  panLast4: string;
  bankLast4: string;
  ifsc: string;
  address: string;
  note: string;
  submittedAt: string | null;
  decidedAt: string | null;
}

export interface AdminKyc extends KycProfile {
  userId: string;
  userName: string;
  email: string | null;
}

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error: string;
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  type: string;
  data: string;
  createdAt: string;
}

export interface AdminOrder extends Order {
  ownerName: string;
  ownerHandle: string | null;
  buyerEmail: string | null;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  type: string;
  processedAt: string | null;
  error: string | null;
  receivedAt: string;
}

export interface AdminFunnel {
  name: string;
  steps: { label: string; count: number }[];
}

export const TRACKED_EVENTS = ['creator_signed_up', 'profile_published', 'product_created', 'profile_viewed', 'product_viewed', 'checkout_started', 'payment_succeeded', 'payment_failed', 'booking_confirmed', 'refund_issued', 'link_created', 'automation_created', 'content_dashboard_viewed', 'kyc_submitted', 'kyc_approved'] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export interface CourseDraft {
  lessons: { title: string; body: string; quiz: QuizQuestion[] }[];
  source: 'ai' | 'outline';
}

export interface SearchResults {
  tasks: { id: string; title: string; relationship: RelationshipKey; status: string }[];
  journal: { id: string; title: string; createdAt: string }[];
  resources: { id: string; title: string; kind: ResourceKind }[];
  products: { id: string; title: string; kind: ProductKind; ownerHandle: string | null }[];
  people: { handle: string; name: string }[];
  items: { id: string; title: string; category: string }[];
  listings: { id: string; title: string; condition: string }[];
  tools: { id: string; title: string; category: string }[];
  posts: { id: string; body: string; authorName: string }[];
  clubs: { id: string; title: string; city: string }[];
  /** Agency, the person's own only and only while Agency is on for them. `client` is the client's name, when the record has one. */
  agencyClients: { id: string; title: string; status: string }[];
  agencyInvoices: { id: string; title: string; client: string; status: string }[];
  agencyContracts: { id: string; title: string; client: string; status: string }[];
  agencyDocs: { id: string; title: string; client: string; status: string }[];
  /** Channels by name or topic: Community's open ones (while Community is on) and the Bond ones the person is in (while Bond is on). Never the lines. */
  channels: { id: string; title: string; topic: string; scope: 'community' | 'bond' }[];
}
