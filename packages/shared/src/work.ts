import type { MediaItem } from './community.ts';
import type { Unlock } from './badges.ts';
import type { IconName } from './roles.ts';
import type { TagTone } from './agency.ts';

// ---------------------------------------------------------------------------
// Organizations (brands and agencies)
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  type: 'brand' | 'agency' | 'partner';
  status: 'active' | 'suspended';
  myRole: 'owner' | 'member' | null;
  createdAt: string;
}

export interface OrganizationMember {
  userId: string;
  name: string;
  email: string | null;
  role: 'owner' | 'member';
}

// ---------------------------------------------------------------------------
// Army — brand campaigns
// ---------------------------------------------------------------------------

export const CAMPAIGN_STATUSES = ['lead', 'brief', 'scoping', 'shortlist', 'approved', 'production', 'review', 'delivered', 'reported', 'cancelled'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, string> = {
  lead: 'New lead',
  brief: 'Brief written',
  scoping: 'Scope and budget',
  shortlist: 'Creators shortlisted',
  approved: 'Approved by brand',
  production: 'In production',
  review: 'In review',
  delivered: 'Delivered',
  reported: 'Reported and invoiced',
  cancelled: 'Cancelled',
};

export interface Campaign {
  id: string;
  organizationId: string;
  organizationName: string;
  ownerId: string | null;
  ownerName: string;
  name: string;
  brief: string;
  budgetAmount: number;
  currency: string;
  startDate: string | null;
  dueDate: string | null;
  status: CampaignStatus;
  usageRights: string;
  exclusivityTerms: string;
  brandRestrictions: string;
  createdAt: string;
  updatedAt: string;
  deliverableCount: number;
  assignmentCount: number;
}

export interface Deliverable {
  id: string;
  campaignId: string;
  title: string;
  format: string;
  platform: string;
  dueAt: string | null;
  status: 'open' | 'submitted' | 'changes' | 'approved';
  approvedAt: string | null;
  finalUrl: string | null;
  versions: DeliverableVersion[];
}

export interface DeliverableVersion {
  id: string;
  deliverableId: string;
  versionNumber: number;
  url: string;
  note: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  reviewStatus: 'pending' | 'approved' | 'changes';
  feedback: { id: string; authorName: string; comment: string; createdAt: string }[];
}

export interface CampaignAssignment {
  id: string;
  campaignId: string;
  creatorId: string;
  creatorName: string;
  role: string;
  feeAmount: number;
  currency: string;
  status: 'offered' | 'accepted' | 'declined' | 'done';
  termsAcceptedAt: string | null;
}

export interface CampaignEvent {
  id: string;
  actorName: string;
  eventType: string;
  note: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// School — programs, cohorts, learning
// ---------------------------------------------------------------------------

export interface Program {
  id: string;
  name: string;
  description: string;
  pricePoints: number;
  priceCents: number;
  currency: string;
  deliveryMode: 'online' | 'in_person' | 'hybrid';
  published: boolean;
  outcomes: string;
  prerequisites: string;
  createdAt: string;
  cohorts: Cohort[];
}

export interface Cohort {
  id: string;
  programId: string;
  programName: string;
  name: string;
  startAt: string;
  endAt: string;
  capacity: number;
  enrolled: number;
  status: 'upcoming' | 'running' | 'finished' | 'cancelled';
  managerId: string | null;
  managerName: string;
}

export interface Enrollment {
  id: string;
  cohortId: string;
  learnerId: string;
  learnerName: string;
  status: 'enrolled' | 'completed' | 'withdrawn';
  paymentStatus: 'free' | 'paid' | 'test' | 'pending';
  enrolledAt: string;
  completedAt: string | null;
  progress: { assignmentsApproved: number; assignmentsTotal: number; sessionsAttended: number; sessionsTotal: number };
}

export interface LearningItem {
  id: string;
  programId: string;
  moduleTitle: string;
  contentType: 'lesson' | 'video' | 'reading';
  contentRef: string | null;
  body: string;
  sequence: number;
  published: boolean;
}

export interface CourseAssignment {
  id: string;
  programId: string;
  title: string;
  instructions: string;
  rubric: string;
  dueDays: number;
  sequence: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  cohortId: string;
  learnerId: string;
  learnerName: string;
  url: string | null;
  text: string;
  status: 'submitted' | 'changes' | 'approved';
  submittedAt: string;
  feedback: { id: string; reviewerName: string; comment: string; grade: string | null; createdAt: string }[];
}

export interface CohortSession {
  id: string;
  cohortId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  onlineUrl: string | null;
  attended: boolean;
  attendance?: { userId: string; name: string; status: string }[];
}

// ---------------------------------------------------------------------------
// Work — opportunities and applications
// ---------------------------------------------------------------------------

export const OPPORTUNITY_TYPES = ['gig', 'campaign', 'full_time', 'part_time', 'internship', 'collab'] as const;
export const APPLICATION_STATUSES = ['draft', 'submitted', 'reviewing', 'shortlisted', 'selected', 'rejected', 'withdrawn', 'completed'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Opportunity {
  id: string;
  organizationId: string | null;
  organizationName: string;
  createdBy: string;
  title: string;
  description: string;
  opportunityType: (typeof OPPORTUNITY_TYPES)[number];
  skillsRequired: string[];
  locationMode: 'remote' | 'on_site' | 'hybrid';
  locationText: string;
  compensationMin: number | null;
  compensationMax: number | null;
  currency: string;
  deliverables: string;
  deadline: string | null;
  status: 'draft' | 'published' | 'closed';
  eligibility: string;
  /** Only Club members see it and can apply. */
  clubOnly: boolean;
  createdAt: string;
  publishedAt: string | null;
  applications: number;
  myApplication: Application | null;
}

export interface Application {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string | null;
  coverNote: string;
  portfolioSnapshot: string;
  status: ApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  events?: { eventType: string; actorName: string; note: string; createdAt: string }[];
}

// ---------------------------------------------------------------------------
// Club, Win, Bond, Tools, proposals, support
// ---------------------------------------------------------------------------

export const CLUB_BENEFITS = [
  { key: 'events', name: 'Club-only events', blurb: 'Private parties and workshops.' },
  { key: 'opportunities', name: 'First look at opportunities', blurb: 'Club-only Work listings.' },
  { key: 'manager', name: 'A named manager', blurb: 'Someone on staff who knows your work.' },
  { key: 'honor', name: 'The Club honor', blurb: 'Shown on your profile and the leaderboard.' },
] as const;

export interface Membership {
  id: string;
  userId: string;
  userName: string;
  membershipType: 'club';
  status: 'applied' | 'approved' | 'active' | 'rejected' | 'suspended' | 'expired';
  note: string;
  decisionNote: string;
  approvedBy: string | null;
  /** The staff member named as this person's manager, once a reviewer picks one. */
  managerId: string | null;
  managerName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface Bounty {
  id: string;
  organizationName: string;
  brandName: string;
  title: string;
  brief: string;
  deliverable: string;
  budgetPoints: number;
  /** Points paid per thousand verified views. */
  ratePerThousand: number;
  /** Cap per creator. 0 means the only cap is the budget. */
  maxPayoutPoints: number;
  /** Views a post needs before anything is paid. */
  minViews: number;
  rewardRule: string;
  eligibility: string;
  platform: string;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'closed' | 'paid';
  featured: boolean;
  version: number;
  submissions: number;
  paidPoints: number;
  mine: BountySubmission | null;
  createdAt: string;
}

export type SocialPlatform = 'instagram' | 'youtube' | 'tiktok' | 'x' | 'facebook' | 'linkedin' | 'other';

export const SOCIAL_PLATFORM_META: Record<SocialPlatform, { name: string; auto: boolean }> = {
  instagram: { name: 'Instagram', auto: false },
  youtube: { name: 'YouTube', auto: true },
  tiktok: { name: 'TikTok', auto: false },
  x: { name: 'X', auto: false },
  facebook: { name: 'Facebook', auto: false },
  linkedin: { name: 'LinkedIn', auto: false },
  other: { name: 'Other', auto: false },
};

export function detectPlatform(url: string): SocialPlatform {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('twitter.com') || u.includes('x.com/')) return 'x';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('linkedin.com')) return 'linkedin';
  return 'other';
}

/** One reading of a post's numbers. Several accumulate over a reward's window. */
export interface SocialMetric {
  id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** auto: fetched from the platform. manual: the creator typed it. staff: a reviewer confirmed it. */
  source: 'auto' | 'manual' | 'staff';
  note: string;
  fetchedAt: string;
}

export interface BountySubmission {
  id: string;
  bountyId: string;
  bountyTitle: string;
  userId: string;
  userName: string;
  url: string;
  platform: SocialPlatform;
  status: 'submitted' | 'verified' | 'rejected' | 'paid' | 'disputed';
  latestViews: number;
  latestEngagement: number;
  /** Views a reviewer confirmed, which the payout is computed from. */
  evidenceViews: number | null;
  evidenceNote: string;
  payoutPoints: number;
  estimatedPoints: number;
  disputeNote: string;
  metrics: SocialMetric[];
  createdAt: string;
  updatedAt: string;
}

/** What a post earns at a given view count, before the budget is considered. */
export function bountyPayout(views: number, b: Pick<Bounty, 'ratePerThousand' | 'maxPayoutPoints' | 'minViews'>): number {
  if (views < b.minViews || b.ratePerThousand <= 0) return 0;
  const raw = Math.floor(views / 1000) * b.ratePerThousand;
  return b.maxPayoutPoints > 0 ? Math.min(raw, b.maxPayoutPoints) : raw;
}

/** Everything the public site can list. Each one opens a page in the app after sign-in. */
export type ListingType = 'reward' | 'opportunity' | 'event' | 'program' | 'tool' | 'campaign' | 'circle';

export interface ListingTypeMeta {
  name: string;
  plural: string;
  moduleKey: string;
  /** The verb on the sign-in button. */
  verb: string;
  icon: IconName;
}

export const LISTING_TYPE_META: Record<ListingType, ListingTypeMeta> = {
  reward: { name: 'Content reward', plural: 'Content rewards', moduleKey: 'win', verb: 'Submit a video', icon: 'Medal' },
  opportunity: { name: 'Opportunity', plural: 'Opportunities', moduleKey: 'work', verb: 'Apply', icon: 'BriefcaseBusiness' },
  event: { name: 'Event', plural: 'Events', moduleKey: 'party', verb: 'RSVP', icon: 'PartyPopper' },
  program: { name: 'Program', plural: 'Programs', moduleKey: 'school', verb: 'Enrol', icon: 'GraduationCap' },
  tool: { name: 'Tool', plural: 'Tools', moduleKey: 'tools', verb: 'Open', icon: 'Toolbox' },
  campaign: { name: 'Campaign', plural: 'Campaigns', moduleKey: 'army', verb: 'See the brief', icon: 'Clapperboard' },
  circle: { name: 'Circle', plural: 'Circles', moduleKey: 'circles', verb: 'Join', icon: 'UsersRound' },
};
export const LISTING_TYPES = Object.keys(LISTING_TYPE_META) as ListingType[];

/**
 * What a fact on a listing card is about. The server names the kind; the card picks the look from `FACT_KIND_META`,
 * so "Free", "Online", "closes 4 Nov" and "Verified" never look like the same grey chip.
 */
export const FACT_KINDS = ['price', 'free', 'place', 'online', 'when', 'availability', 'verified', 'category', 'status'] as const;
export type FactKind = (typeof FACT_KINDS)[number];
export interface ListingFact {
  kind: FactKind;
  text: string;
}
/** The tone and the icon each kind of fact wears. The word is always shown too, so colour and icon are never the only sign. */
export const FACT_KIND_META: Record<FactKind, { tone: TagTone; icon: IconName; name: string }> = {
  price: { tone: 'warn', icon: 'Coins', name: 'Price or pay' },
  free: { tone: 'good', icon: 'Gift', name: 'Free' },
  place: { tone: 'warm', icon: 'Map', name: 'Where' },
  online: { tone: 'info', icon: 'Globe', name: 'Online' },
  when: { tone: 'calm', icon: 'CalendarClock', name: 'When' },
  availability: { tone: 'deep', icon: 'Users', name: 'Places left' },
  verified: { tone: 'good', icon: 'BadgeCheck', name: 'Checked' },
  category: { tone: 'neutral', icon: 'Tag', name: 'Kind' },
  status: { tone: 'info', icon: 'Flag', name: 'Status' },
};
/** One fact, or nothing when its text is empty (so a producer can write `fact('place', r.venue)` and drop the blanks). */
export function fact(kind: FactKind, text: string | null | undefined): ListingFact[] {
  const t = (text ?? '').trim();
  return t ? [{ kind, text: t }] : [];
}

export interface Listing {
  type: ListingType;
  id: string;
  title: string;
  /** Who it is from: a brand, a host, the team. */
  by: string;
  blurb: string;
  /** Short facts shown as tags: pay, dates, place. Each says what kind of fact it is, so it can look like what it means. */
  facts: ListingFact[];
  /** The page inside the app. */
  path: string;
  featured: boolean;
  /** Draft or closed listings only appear to admins. */
  live: boolean;
  endsAt: string | null;
  createdAt: string;
  /** Pictures, GIFs and videos the owner added. The first picture is the card's cover. */
  media?: MediaItem[];
}

export interface PublicStats {
  members: number;
  rewardsOpen: number;
  opportunitiesOpen: number;
  eventsUpcoming: number;
  programs: number;
  pointsPaid: number;
  campaigns: number;
}

export interface Friend {
  userId: string;
  name: string;
  handle: string | null;
  avatarUrl: string;
  /** Pending means they asked you; sent means you asked them. */
  status: 'friends' | 'pending' | 'sent';
  requestId: string;
  createdAt: string;
}

/** A one-to-one chat where both people appear under an alias. Started from Bond; names never move through it. */
export interface BondChat {
  id: string;
  myAlias: string;
  theirAlias: string;
  source: string;
  lastMessageAt: string | null;
  lastBody: string;
  createdAt: string;
}

export interface BondMessage {
  id: string;
  alias: string;
  body: string;
  mine: boolean;
  createdAt: string;
}

export interface Introduction {
  id: string;
  requesterId: string;
  requesterName: string;
  recipientId: string;
  recipientName: string;
  context: string;
  status: 'proposed' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Tool {
  id: string;
  name: string;
  category: string;
  url: string;
  description: string;
  affiliate: boolean;
  verified: boolean;
  suggestedByName: string;
  createdAt: string;
  /** A paid or staff-given spot at the top, until this time. */
  featuredUntil: string | null;
  /** Taps on the partner link so far. */
  clicks: number;
  minPoints: number;
  minXp: number;
  badge: string;
  unlock: Unlock;
}
