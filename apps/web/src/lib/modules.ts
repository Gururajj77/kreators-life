import { inGroupOrder, matchSetup, MODULES, moduleState, setupSwitchable, type AppModule, type AppPrefs, type MeResponse, type ModuleAccess, type ModuleGroup } from '@kreators/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from './api';
import { usageScore } from './context';
import { keys, useMe } from './queries';

export interface ModuleView extends AppModule {
  available: boolean;
  on: boolean;
  reason: ModuleAccess['reason'];
  /** How much it matters to this person right now: on first, then what fits who they are, then what they open most. Higher is first. */
  rank: number;
}

/**
 * Every module with its state for the signed-in person, in order of context: what is on first, then the apps that fit who they
 * are and what they came for (the same match the setup chat and Features use), then the ones they open most on this device, then
 * the app's own order. Every list in the app takes this order, so the most useful app is first on a phone and on a laptop alike.
 */
export function useModules(): { modules: ModuleView[]; ready: boolean } {
  const me = useMe();
  const data = me.data;
  const key = data ? `${data.user.identities.join('|')}#${data.user.intake.goals.join('|')}#${data.user.intake.blockers.join('|')}` : '';
  const modules = useMemo(() => {
    if (!data) return [];
    const { user, moduleSettings, access } = data;
    const base = MODULES.map((m, i) => {
      const a = access?.[m.key];
      const state = a ?? { ...moduleState(m, user.role, moduleSettings, user.modules), reason: 'ok' as const };
      return { ...m, ...state, idx: i };
    });
    const setup = { identities: user.identities, goals: user.intake.goals, blockers: user.intake.blockers };
    const fits = new Set<string>();
    if (setup.identities.length > 0 || setup.goals.length > 0) {
      const m = matchSetup(setup, base.filter((x) => setupSwitchable(x) && x.available).map((x) => x.key));
      for (const a of [...m.apps, ...m.more]) fits.add(a.key);
    }
    return base
      .map((m): ModuleView & { idx: number } => ({ ...m, rank: (m.on ? 1000 : m.available ? 500 : 0) + (fits.has(m.key) ? 400 : 0) + usageScore(m.key) - m.idx * 0.01 }))
      .sort((x, y) => y.rank - x.rank)
      .map(({ idx: _idx, ...m }) => m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.access, data?.moduleSettings, data?.user.role, data?.user.modules, key]);
  return { ready: Boolean(data), modules };
}

/**
 * The groups in the one order every list uses (MODULE_GROUP_ORDER in shared: Contribution, Reflection, Connection, Creation, Essentials,
 * Operations). Only the apps inside a group follow what fits the person.
 */
export function useGroupOrder(groups: readonly ModuleGroup[]): ModuleGroup[] {
  return inGroupOrder(groups);
}

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
