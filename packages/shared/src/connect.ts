/**
 * Connect people (2026-11-09, the founder: "can u add ability to connect people in admin center?"): the kinds of connection the team can
 * make from Admin, Connect people, and the words for each. Every kind goes through the app's own action for it (routes/adminConnect.ts);
 * anything that lets someone see something about a person starts as an ask that person answers. A leaf: it imports only a type from the rest of
 * shared, so it rides in its own chunk (`shared-connect`), read only by the API and the lazy AdminConnect.
 */

import type { Permission } from './roles.ts';

export const CONNECT_KINDS = ['coach', 'friends', 'agency', 'program', 'product', 'club', 'cohort', 'org'] as const;
export type ConnectKind = (typeof CONNECT_KINDS)[number];
const KIND_SET: Record<string, true> = Object.assign(Object.create(null) as Record<string, true>, Object.fromEntries(CONNECT_KINDS.map((k) => [k, true])));
export const isConnectKind = (v: unknown): v is ConnectKind => typeof v === 'string' && KIND_SET[v] === true;

/** An ask waits for the person's yes; direct is only where the app already lets the team link at once (a coach they agreed to outside the app, a staff manager). */
export type ConnectMode = 'ask' | 'direct';
export type ConnectState = 'asked' | 'accepted' | 'declined' | 'ended';

export interface ConnectKindMeta {
  name: string;
  /** One line under the picker: what happens next. */
  line: string;
  /** The label of the first person's field. */
  first: string;
  /** The label of the second person's field, or null when the second is a place (a program or a course). */
  second: string | null;
  modes: readonly ConnectMode[];
}

export const CONNECT_KIND_META: Record<ConnectKind, ConnectKindMeta> = {
  coach: { name: 'Life coach and student', line: 'The student says yes or no on their Profile tab. Link now only if they already agreed.', first: 'Life coach', second: 'Student', modes: ['ask', 'direct'] },
  friends: { name: 'Friends', line: 'Both are asked on their Profile tab. They become friends only when both say yes.', first: 'First person', second: 'Second person', modes: ['ask'] },
  agency: { name: 'Agency team member', line: 'The member says yes or no in their inbox. They see nothing until the owner gives them access.', first: 'Agency owner', second: 'Team member', modes: ['ask'] },
  program: { name: 'Private School program', line: 'They get an invite that shows the price, and they enrol themselves.', first: 'Person', second: null, modes: ['ask'] },
  product: { name: 'Private Shop course', line: 'They get an invite that shows the price, and they buy it themselves.', first: 'Person', second: null, modes: ['ask'] },
  club: { name: 'Club manager', line: 'Name someone on staff as a member’s manager. The member is told.', first: 'Club member', second: 'Manager, on staff', modes: ['direct'] },
  cohort: { name: 'Cohort manager', line: 'Name who runs a cohort. The new and the old manager are told.', first: 'New manager', second: null, modes: ['direct'] },
  org: { name: 'Brand team member', line: 'They say yes or no on their Profile tab. Only a yes puts them on the brand’s team.', first: 'Person', second: null, modes: ['ask'] },
};

/**
 * Who on staff may make each kind (2026-11-10, the founder: "yes to all"). An admin and the admin key make every kind; a staff member
 * (role sub_admin) makes only the kinds whose permission they hold; a creator makes none, even one holding Moderation. Null is admins only:
 * no staff permission governs a coach link (the team's coach routes were always admin only, and a link shares a student's reflection) or an
 * Agency team (Talent runs Army, not anyone's Agency). The server checks this map on every call; the screen only follows it.
 */
export const CONNECT_KIND_PERMISSION: Record<ConnectKind, Permission | null> = {
  coach: null,
  friends: 'moderation',
  agency: null,
  program: 'cohorts',
  product: 'cohorts',
  club: 'review',
  cohort: 'cohorts',
  org: 'talent',
};

/** The kinds this person may make from Connect people, in the picker's order. */
export function connectKindsFor(user: { role: string; permissions: readonly string[] }): ConnectKind[] {
  if (user.role === 'admin') return [...CONNECT_KINDS];
  if (user.role !== 'sub_admin') return [];
  return CONNECT_KINDS.filter((k) => {
    const p = CONNECT_KIND_PERMISSION[k];
    return p !== null && user.permissions.includes(p);
  });
}

export const CONNECT_STATE_NAMES: Record<ConnectState, string> = { asked: 'Asked', accepted: 'Connected', declined: 'Said no', ended: 'Ended' };
export const CONNECT_MODE_NAMES: Record<ConnectMode, string> = { ask: 'Ask', direct: 'Direct' };

/** The words for nobody, a deleted member and a pair the rules refuse: the same, so a lookup never tells who blocked whom. */
export const CONNECT_NOBODY = 'We could not find that person.';
export const CONNECT_REASON_MAX = 200;
/**
 * Ending by rank (2026-11-10, the rule a guide's undo follows: undoing needs at least the rank that did it): staff end or take back only
 * what staff made; a connection an admin or the admin key made stays with admins. The row says so in its quiet line, and DELETE answers
 * 403 in the longer words.
 */
export const CONNECT_ADMIN_ROW = 'An admin made this one.';
export const CONNECT_ADMIN_ONLY = 'An admin made this one. Only an admin can end it.';
/** A row whose place is not this staff member's (a creator's private program or course): its maker's and an admin's to end. */
export const CONNECT_PLACE_NOT_YOURS = 'Its maker or an admin ends it.';
/** Whoever makes a connection is never paid for it, so nobody on the team suggests themself as a friend (2026-11-10). */
export const CONNECT_NOT_YOURSELF = 'You are one of the two. Send your own friend request in Bond.';

/** A person as the form shows them: never a phone, a birth date, an email or anything private. */
export interface ConnectPerson {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
}

/** A program, a course, an Agency client, a cohort or a brand the form can pick. */
export interface ConnectPlace {
  id: string;
  name: string;
  pricePoints: number;
  priceCents: number;
  currency: string;
  /** A cohort's manager as the list read it (null for none): the form sends it back as `from`, so a change made since answers 409. */
  managerId?: string | null;
  /** A cohort's own words without who runs it now, for the line after a send, which names the new manager. */
  label?: string;
}
/** GET …/connect/places. `mine` is true when the list holds only the caller's own (a staff member's private programs and courses). */
export interface ConnectPlaces {
  places: ConnectPlace[];
  mine: boolean;
}

/** One row of "Connections the team made". */
export interface TeamConnection {
  id: string;
  kind: ConnectKind;
  first: { id: string; name: string; handle: string };
  second: { id: string; name: string; handle: string } | null;
  place: string;
  mode: ConnectMode;
  state: ConnectState;
  createdAt: string;
  endedAt: string | null;
  /** Who on the team made it. */
  by: string;
  /** Whether the team may still end it or take it back from here. */
  canEnd: boolean;
  /** Why this caller may not end it while it is not over: an admin made it (CONNECT_ADMIN_ROW), or its place is not theirs (CONNECT_PLACE_NOT_YOURS). */
  endNote: string | null;
}

/** One line in a person's Connections sheet under People. */
export interface PersonConnection {
  kind: ConnectKind;
  /** The other person, or the place. */
  with: string;
  /** Their side of it, in words: "Student", "Coach", "Member", "Invited", "Enrolled in a cohort". */
  as: string;
  state: ConnectState;
  /** What kind of thing it is, when the kind's own name would be wrong: a School program or a Shop course in its real state ("Public School program"). */
  label?: string;
}

export interface PersonConnections {
  person: ConnectPerson;
  items: PersonConnection[];
  /** How many friends they have: a count, never the list. */
  friends: number;
}

/** A brand's ask to join its team, as the person sees it on their Profile tab (`/you#org-invites`). */
export interface OrgInvite {
  orgId: string;
  name: string;
  /** brand, agency or partner. */
  type: string;
  createdAt: string;
}

/** A friend suggestion from the team, as the person sees it on their Profile tab. */
export interface TeamSuggestion {
  id: string;
  other: ConnectPerson;
  createdAt: string;
  /** Their own answer so far: null until they answer. */
  said: boolean | null;
}
