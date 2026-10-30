import { MODULES, roleRank, rolloutBucket, type ModuleAccess, type ModuleSetting, type Role } from '@kreators/shared';
import type { UserRow } from './env';
import { orgIdsOf, parseModules } from './db';

/**
 * Which module each API prefix belongs to, so a switched-off module is refused on the server and not
 * only hidden by the client. A prefix that is not here is the core and always open. A two-segment
 * prefix (studio/links) wins over its one-segment parent (studio). A route opens when any of the
 * listed modules is available to the person: the wellbeing route serves every tracker, and the
 * proposals route serves TV and Fund.
 */
export const MODULE_FOR_PREFIX: Record<string, readonly string[]> = {
  school: ['school'],
  work: ['work'],
  army: ['army'],
  win: ['win'],
  party: ['party'],
  run: ['run'],
  community: ['community'],
  club: ['club'],
  leaderboard: ['leaderboard'],
  bond: ['bond'],
  // Photos, the conversation and who to meet inside an event: open when either events app is.
  connect: ['party', 'run'],
  circles: ['circles'],
  life: ['life'],
  wellbeing: ['wellbeing', 'mood', 'sleep', 'stress', 'mindful', 'life'],
  journal: ['journal'],
  reviews: ['reviews'],
  companion: ['companion'],
  // The coach's side and the directory. The student's own side (answers, what they share, ending a link) lives
  // under /me/coach, which is core, so switching Coaching off never stops anyone from saying no or ending it.
  coach: ['coaching'],
  assistant: ['assistant'],
  studio: ['shop'],
  'studio/links': ['content', 'automations'],
  'studio/content': ['content', 'automations'],
  'studio/brands': ['content'],
  'studio/automations': ['automations'],
  'studio/funnels': ['automations'],
  'studio/sequences': ['automations'],
  'studio/leads': ['audience'],
  'studio/broadcasts': ['audience'],
  kyc: ['shop'],
  market: ['store'],
  finance: ['finance'],
  resources: ['knowledge'],
  tools: ['tools'],
  proposals: ['tv', 'fund'],
  manage: ['manage'],
  internal: ['observability'],
};

/** The modules an API path under /api belongs to, or null for the core. */
export function modulesForPath(path: string): readonly string[] | null {
  const parts = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  const two = parts.length > 1 ? `${parts[0]}/${parts[1]}` : '';
  return MODULE_FOR_PREFIX[two] ?? MODULE_FOR_PREFIX[parts[0] ?? ''] ?? null;
}

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

export interface AccessContext {
  settings: Record<string, ModuleSetting>;
  overrides: OverrideRow[];
}

/** The global flags and live overrides, read once. The same context scores one person or every account. */
export async function loadAccessContext(db: D1Database): Promise<AccessContext> {
  const [rows, ovs] = await Promise.all([
    db.prepare('SELECT * FROM module_settings').all<SettingRow>(),
    db.prepare('SELECT flag_key, subject_type, subject_id, enabled, expires_at FROM flag_overrides WHERE expires_at IS NULL OR expires_at > ?').bind(new Date().toISOString()).all<OverrideRow>(),
  ]);
  const settings: Record<string, ModuleSetting> = {};
  for (const r of rows.results) {
    const minRole = (['user', 'sub_admin', 'admin'] as const).includes(r.min_role as Role) ? (r.min_role as Role) : 'user';
    settings[r.key] = { key: r.key, enabled: r.enabled === 1, minRole, rollout: r.rollout ?? 100 };
  }
  return { settings, overrides: ovs.results };
}

/** Flag, then override, then rollout, then role, then the person's own toggle. */
export async function resolveAccess(db: D1Database, user: UserRow): Promise<{ settings: Record<string, ModuleSetting>; access: Record<string, ModuleAccess>; orgIds: string[] }> {
  const [orgIds, ctx] = await Promise.all([orgIdsOf(db, user.id), loadAccessContext(db)]);
  return { settings: ctx.settings, access: accessFor(user, ctx, orgIds), orgIds };
}

/** Pure: which modules one person can see and has on, given the loaded context. */
export function accessFor(user: Pick<UserRow, 'id' | 'role' | 'modules'>, ctx: AccessContext, orgIds: string[]): Record<string, ModuleAccess> {
  const { settings, overrides: ovs } = ctx;
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
      ovs.find((o) => o.flag_key === m.key && o.subject_type === 'user' && o.subject_id === user.id) ??
      ovs.find((o) => o.flag_key === m.key && o.subject_type === 'organization' && orgIds.includes(o.subject_id)) ??
      ovs.find((o) => o.flag_key === m.key && o.subject_type === 'role' && o.subject_id === user.role);
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
  return access;
}
