import type { TrustScore } from './community.ts';
import type { IconName } from './roles.ts';
import { DEFAULT_PUBLIC } from './profile.ts';
import type { LinkBlock, PortfolioItem, PublicSettings, Socials } from './profile.ts';
import type { ProductFaq } from './studio.ts';

// ---------------------------------------------------------------------------
// Passwords: the same rule on the sign-up form and on the server.
// ---------------------------------------------------------------------------

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** The passwords that get tried first. One of these is not a password. */
export const COMMON_PASSWORDS = ['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop', 'iloveyou', 'letmein1', 'welcome1', 'admin123', 'abc12345', '11111111', '00000000', 'sunshine', 'princess', 'football', 'baseball', 'kreators', 'kreators1', 'kreatorslife'] as const;

/** Why a password will not do, in plain words, or null when it is fine. */
export function passwordProblem(password: string, email = ''): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Keep it under ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if ((COMMON_PASSWORDS as readonly string[]).includes(lower)) return 'That one is on every guess list. Pick another.';
  if (/^(.)\1+$/.test(password)) return 'Not one character over and over.';
  const local = (email.toLowerCase().split('@')[0] ?? '').trim();
  if (local.length >= 4 && lower.includes(local)) return 'Not your email, or a part of it.';
  return null;
}

// ---------------------------------------------------------------------------
// Sign-up: a phone number and a date of birth, and the one age rule.
// ---------------------------------------------------------------------------

/** Nobody under this age can sign up. The terms page says the same. */
export const MIN_AGE = 18;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * The one check that a YYYY-MM-DD is a day on the calendar. Date.parse rolls 2008-02-30 over to 1 March instead of failing,
 * so the day is read and written back and must come out the same.
 */
export function isRealDay(d: unknown): d is string {
  if (typeof d !== 'string' || !DAY_RE.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
}

/** Whole years between a birth date and a day, both YYYY-MM-DD. */
export function ageOn(birthDate: string, day: string): number {
  const by = Number(birthDate.slice(0, 4));
  const dy = Number(day.slice(0, 4));
  const before = day.slice(5) < birthDate.slice(5) ? 1 : 0;
  return dy - by - before;
}

/** Why a date of birth will not do, in plain words, or null when it is fine. */
export function birthDateProblem(birthDate: string, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!isRealDay(birthDate)) return 'Enter your date of birth.';
  if (birthDate > today) return 'That day has not happened yet.';
  const age = ageOn(birthDate, today);
  if (age < MIN_AGE) return `You need to be ${MIN_AGE} or older to join.`;
  if (age > 120) return 'That date does not look right.';
  return null;
}

/** The line under a phone field. */
export const PHONE_HINT = 'Without a country code we read it as Indian (+91).';

/**
 * Digits only, with a leading plus kept: "+91 98765-43210" becomes "+919876543210". India first: a bare Indian mobile (ten digits
 * starting 6 to 9, or eleven with a leading 0) gets +91; anything typed with a plus is kept as typed, so a number abroad is fine.
 */
export function normalizePhone(raw: string): string {
  const t = raw.trim();
  const digits = t.replace(/\D/g, '');
  if (t.startsWith('+')) return `+${digits}`;
  const local = /^0[6-9]\d{9}$/.test(digits) ? digits.slice(1) : digits;
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  return digits;
}

/** Why a phone number will not do, or null when it is fine: 8 to 15 digits; without a country code it is read as Indian. */
export function phoneProblem(raw: string): string | null {
  const p = normalizePhone(raw);
  if (!/^\+?\d{8,15}$/.test(p)) return 'Enter your mobile number, like 98765 43210, or with its country code, like +44 7700 900123.';
  return null;
}

/**
 * A phone number for the eye, never for storing: an Indian mobile reads the Indian way, "+91 77421 14087", whether it was kept as
 * "+917742114087", "+91 77421-14087" or a bare "7742114087". Anything else (a number abroad, a landline such as "080 2345 6789",
 * words like "ext") comes back as typed.
 */
export function phoneDisplay(raw: string): string {
  const t = raw.trim();
  if (!/^[+\d\s().-]+$/.test(t)) return t;
  const digits = t.replace(/\D/g, '');
  const local = t.startsWith('+') ? (/^91[6-9]\d{9}$/.test(digits) ? digits.slice(2) : '') : /^[6-9]\d{9}$/.test(digits) ? digits : '';
  return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : t;
}

/** India's 28 states and 8 union territories, for an address. */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
] as const;

/** Why a PIN code will not do, or null: six digits, never starting with 0. */
export function pinCodeProblem(raw: string): string | null {
  return /^[1-9][0-9]{5}$/.test(raw.trim()) ? null : 'Enter a six-digit PIN code, like 560038.';
}

export function parsePublicSettings(raw: unknown): PublicSettings {
  const out = { ...DEFAULT_PUBLIC };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(DEFAULT_PUBLIC) as (keyof PublicSettings)[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out[k] = v;
    }
  }
  return out;
}

/** A post as it appears on a person's page. */
export interface PublicPost {
  id: string;
  category: string;
  body: string;
  likes: number;
  replies: number;
  createdAt: string;
}

export interface PublicActivity {
  level: number;
  streak: number;
  areasSetUp: number;
  memberSince: string;
}

/** Zones people in the first markets live in, plus the big ones elsewhere. Any IANA name is accepted. */
export const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Manila', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Kathmandu', 'Asia/Colombo',
  'Australia/Sydney', 'Pacific/Auckland', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Istanbul', 'Africa/Nairobi', 'Africa/Lagos', 'Africa/Johannesburg',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Sao_Paulo', 'America/Mexico_City', 'UTC',
] as const;

export const PRODUCT_KINDS = ['digital', 'course', 'membership', 'session', 'event', 'link', 'payment', 'bundle', 'locked', 'dm'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_META: Record<ProductKind, { name: string; icon: IconName; blurb: string; buy: string }> = {
  digital: { name: 'Download', icon: 'FileDown', blurb: 'A file or link delivered after purchase.', buy: 'Get it' },
  course: { name: 'Course', icon: 'GraduationCap', blurb: 'Lessons, released on a schedule if you like.', buy: 'Enrol' },
  membership: { name: 'Membership', icon: 'IdCard', blurb: 'Access to members-only community posts.', buy: 'Join' },
  session: { name: 'Session', icon: 'CalendarClock', blurb: 'One-to-one time, booked from your availability.', buy: 'Book' },
  event: { name: 'Event', icon: 'Ticket', blurb: 'A live session on a date, with a joining link.', buy: 'Get a ticket' },
  link: { name: 'Link', icon: 'Link', blurb: 'A free link on your page.', buy: 'Open' },
  payment: { name: 'Payment link', icon: 'CreditCard', blurb: 'A fixed price, or pay what you want. Nothing to deliver.', buy: 'Pay' },
  bundle: { name: 'Bundle', icon: 'Package', blurb: 'Several of your products for one price.', buy: 'Get the bundle' },
  locked: { name: 'Locked post', icon: 'Lock', blurb: 'One paid post: text, links or a video, shown after purchase.', buy: 'Unlock' },
  dm: { name: 'Priority DM', icon: 'Mail', blurb: 'A paid question you promise to answer within a few days.', buy: 'Ask' },
};

/** Emoji a product's `cover` once defaulted to, before product covers drew an icon; a product whose cover is still
 * exactly its kind's old default shows the kind's icon instead of that emoji as text. */
const PRODUCT_KIND_LEGACY_COVER: Record<ProductKind, string> = {
  digital: '📄', course: '🎓', membership: '🪪', session: '📅', event: '🎟️', link: '🔗', payment: '💳', bundle: '🎁', locked: '🔒', dm: '✉️',
};
export function productHasOwnCover(kind: ProductKind, cover: string): boolean {
  return Boolean(cover) && cover !== PRODUCT_KIND_LEGACY_COVER[kind];
}

export interface QuizQuestion {
  q: string;
  options: string[];
  /** Index into options. */
  answer: number;
}

export const AFFILIATE_SHARE = 0.2;

export interface Product {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerHandle: string | null;
  kind: ProductKind;
  title: string;
  description: string;
  pricePoints: number;
  priceCents: number;
  currency: string;
  url: string | null;
  startsAt: string | null;
  durationMin: number | null;
  capacity: number | null;
  meetingUrl: string | null;
  status: 'draft' | 'live' | 'archived';
  cover: string;
  sortOrder: number;
  createdAt: string;
  sold: number;
  rating: number | null;
  /** Pay what you want: the price is the floor. */
  pwyw: boolean;
  /** Questions a buyer answers when booking a session or at checkout. */
  intake: string[];
  /** Questions and answers the creator shows on the product's page, up to MAX_FAQ. */
  faq: ProductFaq[];
  /** Events: a recording buyers can watch afterwards, and a price for people who missed it. */
  replayUrl: string | null;
  replayPoints: number;
  /** Bundles: the products inside. */
  bundleIds: string[];
  /** Locked posts: only sent to people who have it. */
  lockedBody: string;
  /** Priority DM: answer within this many days. */
  responseDays: number | null;
  /** A free download that captures a lead. */
  leadMagnet: boolean;
  /** Courses: issue a certificate on completion. */
  certificate: boolean;
  /** Sessions: minutes kept free before and after, hours of notice needed, how far ahead people can book. */
  bufferMin: number;
  noticeHours: number;
  maxDaysAhead: number;
  /** Memberships: how many months one purchase lasts. Null means it never ends. */
  periodMonths: number | null;
  /** Who can buy: a points balance to reach, an xp floor, a badge to hold, or any mix. Zero and empty mean anyone. */
  minPoints: number;
  minXp: number;
  badge: string;
}

export interface Lesson {
  id: string;
  productId: string;
  title: string;
  body: string;
  videoUrl: string | null;
  sortOrder: number;
  dripDays: number;
  quiz: QuizQuestion[];
  /** Percent needed to pass the quiz. 0 means no quiz gate. */
  passScore: number;
  /** Buyer-side: whether the drip has released it and whether it is done. */
  unlocked?: boolean;
  unlocksOn?: string | null;
  completedAt?: string | null;
  quizScore?: number | null;
  quizPassed?: boolean;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  productId: string;
  productTitle: string;
  productKind: ProductKind;
  points: number;
  cents: number;
  currency: string;
  /** paid: settled in points or by the provider. test: recorded, nothing charged. pending: waiting for the provider. */
  status: 'paid' | 'test' | 'refunded' | 'pending' | 'failed' | 'expired';
  couponCode: string | null;
  affiliateCode: string | null;
  /** points, test or razorpay. */
  provider: string;
  providerOrderId: string | null;
  paidAt: string | null;
  /** Memberships: when this purchase stops counting. */
  expiresAt: string | null;
  /** Attribution: the tracked link this sale came through, if any. */
  sourceLinkId: string | null;
  sourceLabel: string | null;
  clickId: string | null;
  platformFeePoints: number;
  intake: string[];
  /** '' for the product itself, 'replay' for an event recording. */
  variant: string;
  refundedAt: string | null;
  createdAt: string;
  /** What a discount code took off (the platform pays it; the seller is settled on the price before it). 0 without a code. */
  discountCents: number;
  discountPoints: number;
}

export interface Coupon {
  id: string;
  code: string;
  percentOff: number;
  productId: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
}

export interface Availability {
  id: string;
  weekday: number;
  startMin: number;
  endMin: number;
}

export interface Booking {
  id: string;
  productId: string;
  productTitle: string;
  ownerId: string;
  ownerName: string;
  buyerId: string;
  buyerName: string;
  startsAt: string;
  endsAt: string;
  status: 'requested' | 'confirmed' | 'cancelled' | 'done';
  meetingUrl: string | null;
  note: string;
  createdAt: string;
  intake: string[];
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  message: string;
  source: string;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  productId: string;
  productTitle: string;
  authorName: string;
  rating: number;
  body: string;
  approved: boolean;
  createdAt: string;
}

export interface PublicPage {
  id: string;
  handle: string;
  name: string;
  /** Where the viewer stands with this person. */
  friend: 'none' | 'friends' | 'pending' | 'sent';
  friendRequestId: string | null;
  /** True when this is the owner looking at their own page. */
  mine: boolean;
  /** The owner switched the whole page off; only the name comes back. */
  isPrivate: boolean;
  /** What the owner chose to show. Parts that are off come back empty. */
  shows: { socials: boolean; blocks: boolean; portfolio: boolean; products: boolean; posts: boolean; activity: boolean; badges: boolean };
  allowFriendRequests: boolean;
  allowChats: boolean;
  posts: PublicPost[];
  activity: PublicActivity | null;
  /** Earned badge keys and awarded honor keys, only when the badges switch is on. */
  badges: string[];
  honors: string[];
  /** The link blocks that are on, in order, when the links switch is on. */
  links: LinkBlock[];
  bio: string;
  skills: string[];
  categories: string[];
  experienceLevel: string;
  availability: string;
  location: string;
  portfolio: PortfolioItem[];
  isPro: boolean;
  followers: number;
  /** How much this person has proved, from what they earned. */
  trust: TrustScore;
  following: boolean;
  products: Product[];
  testimonials: Testimonial[];
  avatarUrl: string;
  socials: Socials;
  timezone: string;
}

export interface StudioAnalytics {
  views: number;
  clicks: number;
  followers: number;
  leads: number;
  orders: number;
  pointsEarned: number;
  centsEarned: number;
  affiliatePoints: number;
  byProduct: { productId: string; title: string; orders: number; points: number }[];
  /** Sales that came through a tracked link, versus straight from the page. */
  attributed: number;
  direct: number;
  /** Orders per day for the last fourteen days, oldest first. */
  days: { date: string; orders: number }[];
}
