import type { Page } from '@kreators/shared';
import type { ConnectKind, ConnectMode, ConnectPerson, ConnectPlaces, OrgInvite, PersonConnections, TeamConnection, TeamSuggestion } from '@kreators/shared/connect';
import { adminRequest, request } from './api';

const withQ = (path: string, q: string) => (q ? `${path}${path.includes('?') ? '&' : '?'}${q}` : path);

/**
 * Which door Connect people goes through (2026-11-10): a string is Admin's (the admin key, or '' for an admin's own session) at
 * /admin/connect; null is a staff member's at /manage/connect, which serves only the kinds their permissions govern.
 */
export type ConnectDoor = string | null;
const via = <T>(door: ConnectDoor, path: string, init: RequestInit = {}) => (door === null ? request<T>(`/manage${path}`, init) : adminRequest<T>(door, path, init));

/**
 * Connect people (2026-11-09; routes/adminConnect.ts). Kept out of lib/api.ts, which is in the first download, since only the lazy Admin
 * tab, Manage's Connect people, People's Connections sheet, the cohort page's manager and the Profile cards read them.
 */
export const connectApi = {
  person: (door: ConnectDoor, who: string) => via<{ person: ConnectPerson }>(door, `/connect/person?who=${encodeURIComponent(who)}`),
  /** `mine` says the list holds only the caller's own private programs or courses (a staff member's; 2026-11-10). */
  places: (door: ConnectDoor, kind: 'program' | 'product' | 'client' | 'cohort' | 'org', owner = '') => via<ConnectPlaces>(door, `/connect/places?kind=${kind}${owner ? `&owner=${encodeURIComponent(owner)}` : ''}`),
  list: (door: ConnectDoor, filter: { kind?: string; person?: string }, pq = '') =>
    via<{ page: Page; connections: TeamConnection[]; kinds: ConnectKind[] }>(door, withQ(`/connect?kind=${encodeURIComponent(filter.kind ?? '')}&person=${encodeURIComponent(filter.person ?? '')}`, pq)),
  connect: (door: ConnectDoor, body: { kind: ConnectKind; first: string; second?: string; mode: ConnectMode; reason?: string; role?: string; clientId?: string; place?: string; from?: string | null }) =>
    via<{ id: string }>(door, '/connect', { method: 'POST', body: JSON.stringify(body) }),
  end: (door: ConnectDoor, id: string) => via<{ ok: true }>(door, `/connect/${id}`, { method: 'DELETE' }),
  ofPerson: (key: string, id: string) => adminRequest<PersonConnections>(key, `/connect/people/${id}`),
  /** Friend suggestions the team made, answered on the Profile tab (`/me/suggestions`, core). */
  mine: () => request<{ suggestions: TeamSuggestion[] }>('/me/suggestions'),
  answer: (id: string, yes: boolean) => request<{ ok: true; status: 'asked' | 'declined' | 'friends' }>(`/me/suggestions/${id}/answer`, { method: 'POST', body: JSON.stringify({ yes }) }),
  /** A brand's ask onto its team, answered on the Profile tab (`/me/org-invites`, core; 2026-11-10). */
  orgInvites: () => request<{ invites: OrgInvite[] }>('/me/org-invites'),
  answerOrg: (orgId: string, yes: boolean) => request<{ ok: true; status: 'member' | 'declined' }>(`/me/org-invites/${orgId}/answer`, { method: 'POST', body: JSON.stringify({ yes }) }),
  /** The cohort page's own lookup for a new manager, for whoever may name one, the program's maker too (2026-11-10). */
  cohortPerson: (cohortId: string, who: string) => request<{ person: ConnectPerson }>(`/school/cohorts/${cohortId}/manager/person?who=${encodeURIComponent(who)}`),
  /** Name who runs a cohort (the cohort page; admins, staff with Cohorts on a public program, and the program's maker). */
  setCohortManager: (cohortId: string, userId: string, from: string | null) => request<{ ok: true; managerId: string; managerName: string }>(`/school/cohorts/${cohortId}/manager`, { method: 'PATCH', body: JSON.stringify({ userId, from }) }),
};
