import { matchSetup, MODULES, moduleState, setupSwitchable, type AppModule, type ModuleAccess, type ModuleGroup } from '@kreators/shared';
import { useMemo } from 'react';
import { usageScore } from './context';
import { useMe } from './queries';

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
 * The groups in the order that suits this person: the group holding their highest-context app first. The team's own group stays last.
 * A group with nothing in it keeps its place at the end.
 */
export function useGroupOrder(groups: readonly ModuleGroup[]): ModuleGroup[] {
  const { modules } = useModules();
  const best = (g: ModuleGroup) => Math.max(-1, ...modules.filter((m) => m.group === g && m.on && !m.locked).map((m) => m.rank));
  return [...groups].sort((a, b) => Number(a === 'manage') - Number(b === 'manage') || best(b) - best(a));
}

export function useModule(key: string): ModuleView | null {
  const { modules } = useModules();
  return modules.find((m) => m.key === key) ?? null;
}
