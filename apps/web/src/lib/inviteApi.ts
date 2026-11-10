import type { TagTone } from '@kreators/shared';
import {
  INVITE_STATE_LABEL,
  WAITLIST_STATUS_LABEL,
  type AdminInvite,
  type AdminInvitesResponse,
  type InviteExpiry,
  type InviteState,
  type MyInvite,
  type MyInvitesResponse,
  type WaitlistApproval,
  type WaitlistResponse,
  type WaitlistStatus,
} from '@kreators/shared/invites';
import { adminRequest, request } from './api';

export type { AdminInvite, InviteState, MyInvite, WaitlistStatus };
export type { WaitlistEntry as WaitlistRow } from '@kreators/shared/invites';

/** What making codes sends: how many, an optional private label, and how long they work (null never runs out). */
export interface MakeInvites {
  count: number;
  label?: string;
  days?: InviteExpiry;
}

/** A code's state in words (the shared label) and as a tag's tone. */
const STATE_TONE: Record<InviteState, TagTone> = { open: 'good', used: 'calm', expired: 'neutral', revoked: 'neutral' };
export const INVITE_STATE_WORDS = Object.fromEntries(
  (Object.keys(STATE_TONE) as InviteState[]).map((k) => [k, { name: INVITE_STATE_LABEL[k], tone: STATE_TONE[k] }]),
) as Record<InviteState, { name: string; tone: TagTone }>;
const WAIT_TONE: Record<WaitlistStatus, TagTone> = { waiting: 'warn', invited: 'info', joined: 'good', declined: 'neutral' };
export const WAITLIST_WORDS = Object.fromEntries(
  (Object.keys(WAIT_TONE) as WaitlistStatus[]).map((k) => [k, { name: WAITLIST_STATUS_LABEL[k], tone: WAIT_TONE[k] }]),
) as Record<WaitlistStatus, { name: string; tone: TagTone }>;
/** An expiry choice in words: a week, 30 or 90 days, or never. */
export const expiryWords = (days: number | null): string => (days === null ? 'Never' : days === 7 ? 'A week' : `${days} days`);

const withQ = (path: string, q: string) => (q ? `${path}${path.includes('?') ? '&' : '?'}${q}` : path);
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/**
 * Invite-only joining (2026-11-10): the public checks, the maker's own codes and Admin, Invites. Kept out of lib/api.ts, which is in the
 * first download, since only the lazy gate, the /join page, Profile's Invite people and the Admin tab read them. (Whether joining needs a
 * code at all is `publicApi.join`, which the public home reads too.)
 */
export const inviteApi = {
  /** Whether a code works, said the same way for every reason it does not. */
  check: (code: string) => request<{ ok: boolean }>(`/public/invite/${encodeURIComponent(code)}`),
  waitlist: (body: { email: string; name: string; note?: string }) => request<{ ok: true }>('/public/waitlist', json('POST', body)),
  mine: (pq = '') => request<MyInvitesResponse>(withQ('/me/invites', pq)),
  make: (body: MakeInvites) => request<{ items: MyInvite[] }>('/me/invites', json('POST', body)),
  revoke: (id: string) => request<{ ok: true }>(`/me/invites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const adminInviteApi = {
  list: (key: string, f: { state?: string; maker?: string; q?: string }, pq = '') =>
    adminRequest<AdminInvitesResponse>(key, withQ(`/invites?state=${encodeURIComponent(f.state ?? '')}&maker=${encodeURIComponent(f.maker ?? '')}&q=${encodeURIComponent(f.q ?? '')}`, pq)),
  make: (key: string, body: MakeInvites) => adminRequest<{ items: AdminInvite[] }>(key, '/invites', json('POST', body)),
  revoke: (key: string, id: string) => adminRequest<{ ok: true }>(key, `/invites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  settings: (key: string) => adminRequest<{ inviteOnly: boolean }>(key, '/invites/settings'),
  setSettings: (key: string, inviteOnly: boolean) => adminRequest<{ inviteOnly: boolean }>(key, '/invites/settings', json('PUT', { inviteOnly })),
  waitlist: (key: string, f: { status?: string; q?: string }, pq = '') =>
    adminRequest<WaitlistResponse>(key, withQ(`/invites/waitlist?status=${encodeURIComponent(f.status ?? '')}&q=${encodeURIComponent(f.q ?? '')}`, pq)),
  approve: (key: string, id: string) => adminRequest<WaitlistApproval>(key, `/invites/waitlist/${encodeURIComponent(id)}/approve`, { method: 'POST', body: '{}' }),
  decline: (key: string, id: string) => adminRequest<{ ok: true }>(key, `/invites/waitlist/${encodeURIComponent(id)}/decline`, { method: 'POST', body: '{}' }),
  remove: (key: string, id: string) => adminRequest<{ ok: true }>(key, `/invites/waitlist/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
