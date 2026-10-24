import { MODULES, roleRank, rolloutBucket, type ModuleAccess, type ModuleSetting, type Role } from '@kreators/shared';
import type { UserRow } from './env';
import { orgIdsOf, parseModules } from './db';

interface SettingRow {
  key: string;
  enabled: number;
  min_role: string;
  rollout: number;
}
interface OverrideRow {
  flag_key: string;
  subject_type: string;
  subject_id: string;
  enabled: number;
  expires_at: string | null;
}

/** Flag, then override, then rollout, then role, then the person's own toggle. */
export async function resolveAccess(db: D1Database, user: UserRow): Promise<{ settings: Record<string, ModuleSetting>; access: Record<string, ModuleAccess>; orgIds: string[] }> {
  const orgIds = await orgIdsOf(db, user.id);
  const [rows, ovs] = await Promise.all([
    db.prepare('SELECT * FROM module_settings').all<SettingRow>(),
    db.prepare('SELECT flag_key, subject_type, subject_id, enabled, expires_at FROM flag_overrides WHERE expires_at IS NULL OR expires_at > ?').bind(new Date().toISOString()).all<OverrideRow>(),
  ]);
  const settings: Record<string, ModuleSetting> = {};
  for (const r of rows.results) {
    const minRole = (['user', 'sub_admin', 'admin'] as const).includes(r.min_role as Role) ? (r.min_role as Role) : 'user';
    settings[r.key] = { key: r.key, enabled: r.enabled === 1, minRole, rollout: r.rollout ?? 100 };
  }
  const mine = parseModules(user.modules);
  const access: Record<string, ModuleAccess> = {};
  for (const m of MODULES) {
    const g = settings[m.key];
    let enabled = g?.enabled ?? true;
    let reason: ModuleAccess['reason'] = 'ok';
    const minRole = g?.minRole ?? m.minRole;
    const rollout = g?.rollout ?? 100;
    // The most specific override wins: person, then their organizations, then their role.
    const ov =
      ovs.results.find((o) => o.flag_key === m.key && o.subject_type === 'user' && o.subject_id === user.id) ??
      ovs.results.find((o) => o.flag_key === m.key && o.subject_type === 'organization' && orgIds.includes(o.subject_id)) ??
      ovs.results.find((o) => o.flag_key === m.key && o.subject_type === 'role' && o.subject_id === user.role);
    if (ov) {
      enabled = ov.enabled === 1;
      if (!enabled) reason = 'override';
    } else if (!enabled) reason = 'disabled';
    else if (rollout < 100 && rolloutBucket(user.id, m.key) >= rollout) {
      enabled = false;
      reason = 'rollout';
    }
    if (enabled && roleRank(user.role) < roleRank(minRole)) {
      enabled = false;
      reason = 'role';
    }
    const on = enabled && (m.locked ? true : (mine[m.key] ?? m.defaultOn));
    access[m.key] = { available: enabled, on, reason };
  }
  return { settings, access, orgIds };
}
