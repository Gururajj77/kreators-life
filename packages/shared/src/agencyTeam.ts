// The Agency team (2026-11-04, wave 14): people who work on someone's Agency, and what each may open. The owner invites a member by email,
// @username or friend code; the member says yes or no. Each member has a role and, per tab of the Agency screen, off, view or edit.
// parseTeamAccess is the one reader of what is stored, and it applies the caps: Overview is never edit, and a client member is at most
// view everywhere with Clients locked off. The server's gate (apps/api/src/agencyTeamAccess.ts) is what enforces it.
import type { IconName } from './roles.ts';
import type { TagTone } from './agency.ts';

export const TEAM_ROLES = ['content_creator', 'videographer', 'editor', 'client'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_META: Record<TeamRole, { name: string; blurb: string; icon: IconName }> = {
  content_creator: { name: 'Content creator', blurb: 'Plans and makes pieces, and can see the clients.', icon: 'Sparkles' },
  videographer: { name: 'Videographer', blurb: 'Shoots the pieces in the pipeline.', icon: 'Video' },
  editor: { name: 'Video editor', blurb: 'Cuts the pieces in the pipeline.', icon: 'Scissors' },
  client: { name: 'Client', blurb: 'Sees their own work and paperwork, read only.', icon: 'Briefcase' },
};

export const TEAM_TABS = ['overview', 'pipeline', 'clients', 'paperwork'] as const;
export type TeamTab = (typeof TEAM_TABS)[number];
export const TEAM_TAB_NAME: Record<TeamTab, string> = { overview: 'Overview', pipeline: 'Pipeline', clients: 'Clients', paperwork: 'Paperwork' };

export const TEAM_LEVELS = ['off', 'view', 'edit'] as const;
export type TeamLevel = (typeof TEAM_LEVELS)[number];
export const TEAM_LEVEL_NAME: Record<TeamLevel, string> = { off: 'Off', view: 'View', edit: 'Edit' };

export type TeamAccess = Record<TeamTab, TeamLevel>;

export const TEAM_STATUSES = ['invited', 'active', 'removed'] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];
export const TEAM_STATUS_TONE: Record<TeamStatus, TagTone> = { invited: 'warn', active: 'good', removed: 'neutral' };
export const TEAM_STATUS_NAME: Record<TeamStatus, string> = { invited: 'Invited', active: 'Active', removed: 'Removed' };

/** Members invited plus active, per owner. */
export const MAX_TEAM = 25;
/** Invites waiting for an answer, per owner. */
export const MAX_TEAM_INVITES = 10;

export function isTeamRole(v: unknown): v is TeamRole {
  return typeof v === 'string' && (TEAM_ROLES as readonly string[]).includes(v);
}

/** What a role starts with. The owner changes any of it per member. */
export function teamDefaults(role: TeamRole): TeamAccess {
  if (role === 'client') return { overview: 'view', pipeline: 'view', clients: 'off', paperwork: 'view' };
  if (role === 'content_creator') return { overview: 'off', pipeline: 'edit', clients: 'view', paperwork: 'off' };
  return { overview: 'off', pipeline: 'edit', clients: 'off', paperwork: 'off' };
}

function levelRank(l: TeamLevel): number {
  return l === 'edit' ? 2 : l === 'view' ? 1 : 0;
}

/** The highest a tab can be for a role. */
export function teamCap(role: TeamRole, tab: TeamTab): TeamLevel {
  if (role === 'client') return tab === 'clients' ? 'off' : 'view';
  return tab === 'overview' ? 'view' : 'edit';
}

/**
 * The one reader of a member's access. A tab that is missing or not a level takes the role's default; then the caps apply, so a stored
 * or sent value can never give a client edit or the Clients tab, or anyone edit on Overview.
 */
export function parseTeamAccess(v: unknown, role: TeamRole): TeamAccess {
  const base = teamDefaults(role);
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const out = {} as TeamAccess;
  for (const tab of TEAM_TABS) {
    const raw = Object.prototype.hasOwnProperty.call(o, tab) ? o[tab] : undefined;
    const level: TeamLevel = typeof raw === 'string' && (TEAM_LEVELS as readonly string[]).includes(raw) ? (raw as TeamLevel) : base[tab];
    const cap = teamCap(role, tab);
    out[tab] = levelRank(level) > levelRank(cap) ? cap : level;
  }
  return out;
}

/** Whether the access opens a tab at least as far as `need`. */
export function teamAllows(access: TeamAccess, tab: TeamTab, need: 'view' | 'edit'): boolean {
  return levelRank(access[tab]) >= levelRank(need);
}

/** One member as the owner's Team tab lists them. */
export interface TeamMember {
  id: string;
  role: TeamRole;
  status: TeamStatus;
  access: TeamAccess;
  client: { id: string; name: string } | null;
  person: { name: string; handle: string; avatarUrl: string };
  invitedAt: string;
  joinedAt: string | null;
  friends: boolean;
}

/** One agency a person is invited to or works on, as their own list shows it. */
export interface MyTeam {
  id: string;
  agency: { name: string; logo: string };
  role: TeamRole;
  status: Exclude<TeamStatus, 'removed'>;
  access: TeamAccess;
  clientName: string | null;
  invitedAt: string;
}
