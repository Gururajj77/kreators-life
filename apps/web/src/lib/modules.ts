import { MODULES, moduleState, type AppModule, type ModuleAccess } from '@kreators/shared';
import { useMe } from './queries';

export interface ModuleView extends AppModule {
  available: boolean;
  on: boolean;
  reason: ModuleAccess['reason'];
}

/** Every module with its state for the signed-in person. The server resolves flags, rollout and overrides; the old formula is the fallback. */
export function useModules(): { modules: ModuleView[]; ready: boolean } {
  const me = useMe();
  if (!me.data) return { modules: [], ready: false };
  const { user, moduleSettings, access } = me.data;
  return {
    ready: true,
    modules: MODULES.map((m) => {
      const a = access?.[m.key];
      if (a) return { ...m, ...a };
      return { ...m, ...moduleState(m, user.role, moduleSettings, user.modules), reason: 'ok' as const };
    }),
  };
}

export function useModule(key: string): ModuleView | null {
  const { modules } = useModules();
  return modules.find((m) => m.key === key) ?? null;
}
