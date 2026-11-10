/**
 * Joining by invite (2026-11-10, the founder: "dont allow people to join the website without waitlist approval by admins or a secret invite
 * code that can only be used 1 per account and can be generated and shared as link or code by the admins or staff members and gets linked to
 * the referrer affiliate if someone is given permission to add people this way, add this in admin").
 *
 * While "Invite only" is on (signup_settings, Admin, Invites), a new account needs a code: one an admin, a staff member or someone holding
 * the Inviter permission made, or one an admin's yes on the waitlist made. A code is used once, by one account, and an account uses one.
 * The account it makes is credited to the code's maker (`users.referred_by` = the maker's referral code).
 *
 * A leaf: it imports only types from the rest of shared, so it rides in its own chunk (`shared-invites`), read by the API, Welcome's gate,
 * /join/:code, Admin's Invites tab and the Profile section, all lazy.
 */
import type { Page } from './core.ts';

/** Ten characters from an alphabet without look-alikes: no 0, O, 1, I or L. */
export const INVITE_CODE_LENGTH = 10;
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ALPHABET_SET: Record<string, true> = Object.assign(Object.create(null) as Record<string, true>, Object.fromEntries([...INVITE_ALPHABET].map((ch) => [ch, true])));

/** A typed or pasted code as stored: trimmed, upper case, spaces and dashes dropped. Null when it is not ten characters of the alphabet. */
export function normalizeInviteCode(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const code = text.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (code.length !== INVITE_CODE_LENGTH) return null;
  for (const ch of code) if (ALPHABET_SET[ch] !== true) return null;
  return code;
}
/** What a code field says under a code that cannot be one. Null when it reads as a code (it may still not work). */
export function inviteCodeProblem(text: unknown): string | null {
  if (typeof text !== 'string' || !text.trim()) return 'Type your invite code.';
  return normalizeInviteCode(text) ? null : `An invite code is ${INVITE_CODE_LENGTH} letters and numbers.`;
}

/** The page an invite link opens: PUBLIC_URL + this. */
export const inviteLinkPath = (code: string): string => `/join/${code}`;

/** Codes made in one go. */
export const INVITE_BATCH_MAX = 20;
/** A private label on a code, for example who it is for. Only its maker and the admins see it. */
export const INVITE_LABEL_MAX = 60;
/** How long a code works, in days; null never runs out. */
export const INVITE_EXPIRY_CHOICES = [7, 30, 90, null] as const;
export type InviteExpiry = (typeof INVITE_EXPIRY_CHOICES)[number];
export const INVITE_EXPIRY_DEFAULT: InviteExpiry = 30;
/** A maker who is not an admin holds at most this many codes that are unused and still work. */
export const MAX_OPEN_INVITES = 50;

export const INVITE_STATES = ['open', 'used', 'expired', 'revoked'] as const;
export type InviteState = (typeof INVITE_STATES)[number];
export const INVITE_STATE_LABEL: Record<InviteState, string> = { open: 'Open', used: 'Used', expired: 'Expired', revoked: 'Taken back' };
/** The one reading of a code's state: used beats taken back, which beats expired. */
export function inviteStateOf(row: { usedAt: string | null; revokedAt: string | null; expiresAt: string | null }, now: Date | string = new Date()): InviteState {
  if (row.usedAt) return 'used';
  if (row.revokedAt) return 'revoked';
  const at = typeof now === 'string' ? now : now.toISOString();
  if (row.expiresAt && row.expiresAt <= at) return 'expired';
  return 'open';
}

export const WAITLIST_STATUSES = ['waiting', 'invited', 'joined', 'declined'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];
export const WAITLIST_STATUS_LABEL: Record<WaitlistStatus, string> = { waiting: 'Waiting', invited: 'Invited', joined: 'Joined', declined: 'Declined' };
export const WAITLIST_NAME_MAX = 60;
export const WAITLIST_NOTE_MAX = 280;

/** The words, one copy each. */
export const INVITE_GATE_LINE = 'Joining is by invite for now. Enter your invite code, or join the waitlist.';
export const INVITE_UNUSABLE = 'This invite code does not work. It may be used, expired or taken back.';
/** Under the heading "This invite does not work" on /join/<code>, which already says the first half (2026-11-10). */
export const INVITE_UNUSABLE_WHY = 'It may be used, expired or taken back. Try another code, or join the waitlist.';
export const WAITLIST_DONE = 'You are on the waitlist. We will email you when there is a place.';
/** Why the code field is there, on Profile and Admin: who a join is credited to. */
export const INVITE_CREDIT_LINE = 'People who join with your code are credited to you.';

/** GET /public/join */
export interface JoinSettings {
  inviteOnly: boolean;
}

/** One of a person's own codes (GET /me/invites). Who used it is never named here. */
export interface MyInvite {
  id: string;
  code: string;
  /** The whole link, PUBLIC_URL + /join/<code>. */
  link: string;
  label: string;
  state: InviteState;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
}
export interface MyInvitesResponse {
  items: MyInvite[];
  /** People who joined with this person's codes. */
  joinedCount: number;
  page: Page;
}

export interface InvitePerson {
  id: string;
  name: string;
  handle: string;
}
/** A code as Admin, Invites lists it: who made it and, once used, who used it (admins only). */
export interface AdminInvite extends MyInvite {
  revokedAt: string | null;
  maker: InvitePerson | null;
  usedBy: InvitePerson | null;
  /** The waitlist row it was made for, if any. */
  waitlistId: string | null;
}
export interface AdminInvitesResponse {
  items: AdminInvite[];
  page: Page;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  name: string;
  note: string;
  status: WaitlistStatus;
  createdAt: string;
  decidedAt: string | null;
  /** The code an approval made, and its link, while one exists. */
  code: string | null;
  link: string | null;
}
export interface WaitlistResponse {
  items: WaitlistEntry[];
  page: Page;
  /** How many wait, whatever the filter. */
  waiting: number;
}
/** POST /admin/invites/waitlist/:id/approve. `emailed` is false while mail is not set up, so the admin copies the link. */
export interface WaitlistApproval {
  code: string;
  link: string;
  emailed: boolean;
}
