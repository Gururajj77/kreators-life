import { teamAllows, type TeamAccess, type TeamTab } from '@kreators/shared';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { useSession } from './store';

/**
 * Which Agency someone is working on: their own (null), or a team they joined (the agency_team row id). The Agency screen sets it from
 * `?team=` in its address; every /agency request then carries `X-Agency-Team` (lib/api.ts), and the server's gate swaps in the owner's
 * Agency and holds the member to their tabs. It is kept for the tab and the person (sessionStorage, tied to the session, so a sign-out or
 * another person on the device starts on their own Agency), and dropped when the server answers that the member is no longer on that team.
 */
const KEY = 'kreators.agencyTeam';
let current: string | null = null;
let gone: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

/** A short mark of the session, so a kept choice never follows a different person onto the same device. */
const mark = () => (useSession.getState().token ?? '').slice(0, 12);

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    const kept = raw ? (JSON.parse(raw) as { s?: string; id?: string }) : null;
    if (kept?.id && kept.s === mark()) current = kept.id;
  } catch {
    // not kept: the person starts on their own Agency
  }
}

function emit() {
  for (const l of listeners) l();
}

/** The team row the /agency requests act on, or null for the person's own Agency. */
export function agencyTeamNow(): string | null {
  load();
  // A different session (signed out, someone else) never inherits the choice.
  if (current && !useSession.getState().token) return null;
  return current;
}

export function setAgencyTeam(id: string | null) {
  load();
  if (id === current) return;
  current = id;
  if (id) gone = null;
  try {
    if (id) sessionStorage.setItem(KEY, JSON.stringify({ s: mark(), id }));
    else sessionStorage.removeItem(KEY);
  } catch {
    // kept in memory only
  }
  emit();
}

/** The server said the member is no longer on the team they were working in: back to their own Agency. */
export function markAgencyTeamGone() {
  load();
  if (!current) return;
  gone = current;
  setAgencyTeam(null);
}

/** The header for one request: only /agency paths, and only while a team is chosen. */
export function agencyTeamHeader(path: string): Record<string, string> {
  const id = agencyTeamNow();
  return id && (path === '/agency' || path.startsWith('/agency/') || path.startsWith('/agency?')) ? { 'X-Agency-Team': id } : {};
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snap = () => `${agencyTeamNow() ?? ''}|${gone ?? ''}`;

/** The chosen team (or null) and the last team the server said is gone, kept in step with the store. */
export function useAgencyTeam(): { team: string | null; gone: string | null } {
  const s = useSyncExternalStore(subscribe, snap, snap);
  const [team, g] = s.split('|');
  return { team: team || null, gone: g || null };
}

/**
 * What the person may do on the Agency they are looking at. The owner may do everything; a team member only what their access opens.
 * The server's gate is what enforces it: this only keeps buttons a member cannot use off their screen.
 */
export interface AgencyCan {
  /** Null on the person's own Agency. */
  access: TeamAccess | null;
  can: (tab: TeamTab, need: 'view' | 'edit') => boolean;
}
const OWNER: AgencyCan = { access: null, can: () => true };
export const AgencyCanContext = createContext<AgencyCan>(OWNER);
export function agencyCanFor(access: TeamAccess | null): AgencyCan {
  return access ? { access, can: (tab, need) => teamAllows(access, tab, need) } : OWNER;
}
export function useAgencyCan(): AgencyCan {
  return useContext(AgencyCanContext);
}
