import { inGroupOrder, matchSetup, MODULES, moduleState, orderInGroup, setupSwitchable, type AppModule, type AppPrefs, type MeResponse, type ModuleAccess, type ModuleGroup } from '@kreators/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from './api';
import { keys, useMe } from './queries';

export interface ModuleView extends AppModule {
  available: boolean;
  on: boolean;
  reason: ModuleAccess['reason'];
}

/**
 * Every module with its state for the signed-in person: what is on first, then what they could turn on, and inside that the default order
 * (`MODULES`, the founder's, 2026-11-07). Every list in the app takes this order, so an app stays where the person last saw it; a group the
 * person arranged under Profile, Features goes on top of it (`orderInGroup`).
 */
export function useModules(): { modules: ModuleView[]; ready: boolean } {
  const me = useMe();
  const data = me.data;
  const modules = useMemo(() => {
    if (!data) return [];
    const { user, moduleSettings, access } = data;
    const standing = (m: { on: boolean; available: boolean }) => (m.on ? 2 : m.available ? 1 : 0);
    return MODULES.map((m): ModuleView => {
      const a = access?.[m.key];
      const state = a ?? { ...moduleState(m, user.role, moduleSettings, user.modules), reason: 'ok' as const };
      return { ...m, ...state };
    }).sort((x, y) => standing(y) - standing(x));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.access, data?.moduleSettings, data?.user.role, data?.user.modules]);
  return { ready: Boolean(data), modules };
}

/**
 * The groups in the one order every list uses (MODULE_GROUP_ORDER in shared: Contribution, Reflection, Connection, Creation, Essentials,
 * Operations).
 */
export function useGroupOrder(groups: readonly ModuleGroup[]): ModuleGroup[] {
  return inGroupOrder(groups);
}

/**
 * Whether a tile or link stays, by the page it opens: one that opens an app shows only while that app is on, and a page that is no app's own shows always. Home's and
 * Reviews' tiles use it (the founder, 2026-11-06 and 2026-11-07). A hash or query is left out, so /journal#gratitude-heading is Journal's.
 */
export const keepForApps =
  (modules: readonly ModuleView[]) =>
  (to: string | undefined): boolean => {
    const path = to?.split(/[#?]/)[0];
    return !path || modules.every((m) => m.path !== path || m.on);
  };

export function useModule(key: string): ModuleView | null {
  const { modules } = useModules();
  return modules.find((m) => m.key === key) ?? null;
}

const NO_PREFS: AppPrefs = { open: {}, order: {} };

/** The person's own arrangement of the app groups (saved on the account): which start open, and the order of the apps they placed. */
export function useAppPrefs(): AppPrefs {
  return useMe().data?.user.appPrefs ?? NO_PREFS;
}

/** Saves the whole arrangement (PATCH /me { appPrefs }). The screen shows it at once; a refused save puts the last saved one back. */
export function useSaveAppPrefs(): (next: AppPrefs) => Promise<boolean> {
  const qc = useQueryClient();
  return useCallback(
    async (next: AppPrefs) => {
      const was = qc.getQueryData<MeResponse>(keys.me);
      if (was) qc.setQueryData<MeResponse>(keys.me, { ...was, user: { ...was.user, appPrefs: next } });
      try {
        const { user } = await api.updateMe({ appPrefs: next });
        const now = qc.getQueryData<MeResponse>(keys.me);
        if (now && user) qc.setQueryData<MeResponse>(keys.me, { ...now, user: { ...now.user, appPrefs: user.appPrefs } });
        return true;
      } catch {
        const now = qc.getQueryData<MeResponse>(keys.me);
        if (now && was) qc.setQueryData<MeResponse>(keys.me, { ...now, user: { ...now.user, appPrefs: was.user.appPrefs } });
        return false;
      }
    },
    [qc],
  );
}

/**
 * The apps that fit this person, each with why, from the setup chat's answers (the same `matchSetup` the chat and Features use):
 * Profile, Features marks them "Fits you", and the hidden-apps panel (Apps, Home's Go to) lists them first. Empty before any answers.
 */
export function useFits(): Map<string, string> {
  const me = useMe();
  const { modules } = useModules();
  const user = me.data?.user;
  const key = user ? `${user.identities.join('|')}#${user.intake.goals.join('|')}#${user.intake.blockers.join('|')}` : '';
  return useMemo(() => {
    if (!user || (user.identities.length === 0 && user.intake.goals.length === 0)) return new Map<string, string>();
    const setup = { identities: user.identities, goals: user.intake.goals, blockers: user.intake.blockers };
    const m = matchSetup(setup, modules.filter((x) => setupSwitchable(x) && x.available).map((x) => x.key));
    return new Map([...m.apps, ...m.more].map((a) => [a.key, a.why]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, modules]);
}

/** The apps this person hid, in group order and each group's own order. */
export function useHiddenApps(groups: readonly ModuleGroup[]) {
  const { modules } = useModules();
  const prefs = useAppPrefs();
  return groups
    .map((g) => ({ group: g, list: orderInGroup(modules.filter((m) => m.group === g && m.available && !m.locked && !m.on), prefs.order[g]) }))
    .filter((x) => x.list.length > 0);
}
