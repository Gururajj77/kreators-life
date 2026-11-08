import { byKey } from './core.ts';
import type { RelationshipKey } from './core.ts';
import { roleRank } from './roles.ts';
import type { IconName, Role } from './roles.ts';

// ---------------------------------------------------------------------------
// Modules — every feature is a module. People switch them on and off under
// You; admins can disable one for everyone or limit it to a role.
// ---------------------------------------------------------------------------

export type ModuleGroup = 'core' | 'wellbeing' | 'earn' | 'community' | 'creator' | 'manage';

export interface AppModule {
  key: string;
  name: string;
  blurb: string;
  /** The app's icon, a key the web draws (`lib/appIcons.ts`). */
  icon: IconName;
  group: ModuleGroup;
  path: string;
  /** The relationship whose colours this app wears; dark mode tints its pages with that hue. */
  accent?: RelationshipKey;
  /** On for a new account. */
  defaultOn: boolean;
  /** Core modules cannot be switched off by the person. */
  locked?: boolean;
  minRole: Role;
}

/** Every app. The order here is the default order inside a group, everywhere apps are listed (the founder's, 2026-11-07: Connection, Essentials
 * and Operations as he set them, Reflection by importance and Creation by value), until a person arranges a group under Profile, Features. */
export const MODULES: readonly AppModule[] = [
  { key: 'home', name: 'Home', blurb: 'Your numbers, your day, and a door into everything.', icon: 'House', group: 'core', path: '/home', defaultOn: true, locked: true, minRole: 'user' },
  { key: 'today', name: 'Daily', blurb: 'Your three boxes a day.', icon: 'Sun', group: 'core', path: '/today', defaultOn: true, locked: true, minRole: 'user' },
  { key: 'tower', name: 'Pillars', blurb: 'The seven pillars of your life, one per relationship.', icon: 'Landmark', group: 'core', path: '/tower', defaultOn: true, locked: true, minRole: 'user' },
  { key: 'search', name: 'Search', blurb: 'Find anything you wrote, bought, applied to or read.', icon: 'Search', group: 'core', path: '/search', defaultOn: true, locked: true, minRole: 'user' },
  // On for everyone. People still only appear after they opt in under Profile, and journal and wellbeing never count.
  { key: 'leaderboard', name: 'Leaderboard', blurb: 'See where you stand by goal, pillar and city, with a monthly season.', icon: 'Trophy', group: 'core', path: '/leaderboard', defaultOn: true, minRole: 'user' },
  { key: 'notifications', name: 'Inbox', blurb: 'What happened while you were away, and daily reminders.', icon: 'Bell', group: 'core', path: '/inbox', defaultOn: true, minRole: 'user' },
  { key: 'help', name: 'Help', blurb: 'Answers to your questions, and a line to the team.', icon: 'LifeBuoy', group: 'core', path: '/help', defaultOn: true, minRole: 'user' },
  // The assistant is part of every screen, not an app of its own: locked on, and its page is its plan and credits.
  { key: 'assistant', name: 'Assistant', blurb: 'Tap a flow to log something, or type it with a plan.', icon: 'WandSparkles', group: 'core', path: '/plans', defaultOn: true, locked: true, minRole: 'user' },

  { key: 'school', name: 'School', blurb: 'Programs and cohorts: lessons, assignments, mentor feedback, completion.', icon: 'GraduationCap', group: 'earn', path: '/school', defaultOn: true, minRole: 'user', accent: 'guru' },
  { key: 'work', name: 'Work', blurb: 'Opportunities from brands and the team. Apply, track, get hired.', icon: 'BriefcaseBusiness', group: 'earn', path: '/work', defaultOn: true, minRole: 'user', accent: 'servant_leader' },
  { key: 'army', name: 'Army', blurb: 'Brand campaigns: briefs, shortlists, production, approvals, delivery.', icon: 'Clapperboard', group: 'earn', path: '/army', defaultOn: true, minRole: 'user', accent: 'servant_leader' },
  { key: 'win', name: 'Win', blurb: 'Content rewards: make a video about a brand, get paid per verified view.', icon: 'Medal', group: 'earn', path: '/win', defaultOn: false, minRole: 'user', accent: 'parent_child' },
  // Off on a new account. Owner only: a content agency's or a freelance creator's clients, pieces, time and approvals.
  { key: 'agency', name: 'Agency', blurb: 'Clients, content pieces from idea to published, retainers, time, approvals and invoices.', icon: 'FolderKanban', group: 'earn', path: '/agency', defaultOn: false, minRole: 'user', accent: 'servant_leader' },

  { key: 'community', name: 'Community', blurb: 'Posts, replies and likes, by category.', icon: 'MessagesSquare', group: 'community', path: '/community', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'run', name: 'Kreators Run', blurb: 'Run clubs near you. A start code at the line logs your run.', icon: 'Footprints', group: 'community', path: '/run', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'club', name: 'Club', blurb: 'A curated membership with benefits and members-only opportunities.', icon: 'IdCard', group: 'community', path: '/club', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'party', name: 'Party', blurb: 'Meetups, workshops, camps and flagship days. RSVP, waitlist, check in.', icon: 'PartyPopper', group: 'community', path: '/party', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'bond', name: 'Bond', blurb: 'Friends, introductions, and anonymous chats with people you met.', icon: 'Handshake', group: 'community', path: '/bond', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'circles', name: 'Circles', blurb: 'Small anonymous groups near you each week, matched by interests that fit.', icon: 'UsersRound', group: 'community', path: '/circles', defaultOn: false, minRole: 'user', accent: 'friendship' },
  // Off on a new account; unlocking a game in Rewards switches it on.
  { key: 'cards', name: 'Games', blurb: 'Unlock a game with points, then play it with the people around you.', icon: 'Spade', group: 'community', path: '/cards', defaultOn: false, minRole: 'user', accent: 'friendship' },

  { key: 'life', name: 'Life', blurb: 'The five areas of life on one dashboard.', icon: 'Compass', group: 'wellbeing', path: '/life', defaultOn: true, minRole: 'user', accent: 'lover_partner' },
  { key: 'journal', name: 'Journal', blurb: 'Write it down with an emotion and a stress level.', icon: 'NotebookPen', group: 'wellbeing', path: '/journal', defaultOn: true, minRole: 'user', accent: 'self' },
  { key: 'reviews', name: 'Reviews', blurb: 'Look back on a day to a year, with your numbers and your pillars.', icon: 'ClipboardCheck', group: 'wellbeing', path: '/reviews', defaultOn: false, minRole: 'user', accent: 'self' },
  { key: 'mindful', name: 'Mindfulness', blurb: 'A breathing timer that logs your minutes.', icon: 'Wind', group: 'wellbeing', path: '/mindful', defaultOn: false, minRole: 'user', accent: 'divine' },
  // Off on a new account. Movement and a daily eating check-in, private like every tracker; nothing in it pays.
  { key: 'fitness', name: 'Fitness', blurb: 'Log a run, a walk or a workout, and how you ate today.', icon: 'Dumbbell', group: 'wellbeing', path: '/fitness', defaultOn: false, minRole: 'user', accent: 'self' },
  { key: 'wellbeing', name: 'Wellbeing', blurb: 'One score from your mood, sleep, stress and mindful minutes.', icon: 'HeartPulse', group: 'wellbeing', path: '/wellbeing', defaultOn: false, minRole: 'user', accent: 'lover_partner' },
  { key: 'mood', name: 'Mood', blurb: 'How are you feeling today? Pick a face, see the week.', icon: 'FaceSlightlySmiling', group: 'wellbeing', path: '/mood', defaultOn: false, minRole: 'user', accent: 'parent_child' },
  { key: 'sleep', name: 'Sleep', blurb: 'Hours and quality, night by night.', icon: 'Moon', group: 'wellbeing', path: '/sleep', defaultOn: false, minRole: 'user', accent: 'guru' },
  { key: 'stress', name: 'Stress', blurb: 'Level and what is behind it.', icon: 'WavesHorizontal', group: 'wellbeing', path: '/stress', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'coaching', name: 'Coaching', blurb: 'A life coach sees only what you share, never your journal.', icon: 'Target', group: 'wellbeing', path: '/coaching', defaultOn: false, minRole: 'user', accent: 'guru' },
  { key: 'companion', name: 'Companion', blurb: 'A chat that knows how you are doing. Not a therapist.', icon: 'MessageCircleHeart', group: 'wellbeing', path: '/companion', defaultOn: false, minRole: 'user', accent: 'guru' },
  // Off on a new account. Owner only, like the journal: never shown to brands, staff, the leaderboard, a coach or the assistant.
  { key: 'discover', name: 'Discover', blurb: 'A quiz on how you think, feel and act. It shows your strengths across the seven relationships.', icon: 'Telescope', group: 'wellbeing', path: '/discover', defaultOn: false, minRole: 'user', accent: 'self' },

  { key: 'shop', name: 'Shop', blurb: 'Sell downloads, courses, memberships, sessions and events.', icon: 'ShoppingBag', group: 'creator', path: '/shop', defaultOn: true, minRole: 'user', accent: 'servant_leader' },
  { key: 'profile', name: 'Public page', blurb: 'What people see: bio, skills, portfolio, links and what you sell.', icon: 'Link', group: 'creator', path: '/profile', defaultOn: true, minRole: 'user', accent: 'self' },
  { key: 'content', name: 'Content', blurb: 'Which post made money: tracked links, views and revenue per piece of content.', icon: 'TrendingUp', group: 'creator', path: '/shop/content', defaultOn: false, minRole: 'user', accent: 'servant_leader' },
  { key: 'audience', name: 'Audience', blurb: 'Your followers, leads, broadcasts and affiliate link.', icon: 'Megaphone', group: 'creator', path: '/shop/audience', defaultOn: false, minRole: 'user', accent: 'servant_leader' },
  { key: 'automations', name: 'Auto-DM', blurb: 'Comment a keyword, get a link in DMs. Funnels show where people drop off.', icon: 'Bot', group: 'creator', path: '/shop/automations', defaultOn: false, minRole: 'user', accent: 'servant_leader' },
  { key: 'finance', name: 'Finance', blurb: 'Money in and out, dues, budgets and goals for your work.', icon: 'Wallet', group: 'creator', path: '/finance', defaultOn: false, minRole: 'user', accent: 'parent_child' },
  { key: 'fund', name: 'Fund', blurb: 'Apply for a grant or backing for a project.', icon: 'Sprout', group: 'creator', path: '/fund', defaultOn: false, minRole: 'user', accent: 'divine' },
  { key: 'tv', name: 'TV', blurb: 'Pitch a series. Track it from proposal to release.', icon: 'Tv', group: 'creator', path: '/tv', defaultOn: false, minRole: 'user', accent: 'divine' },
  { key: 'knowledge', name: 'Knowledge', blurb: 'Curated articles and exercises with their sources.', icon: 'BookOpen', group: 'creator', path: '/knowledge', defaultOn: false, minRole: 'user', accent: 'guru' },
  { key: 'tools', name: 'Tools', blurb: 'A directory of creator tools, verified by the team.', icon: 'Toolbox', group: 'creator', path: '/tools', defaultOn: false, minRole: 'user', accent: 'guru' },
  { key: 'store', name: 'Store', blurb: 'Gear new from partners, or pre-owned from other creators.', icon: 'ShoppingCart', group: 'creator', path: '/store', defaultOn: false, minRole: 'user', accent: 'servant_leader' },
  { key: 'library', name: 'My purchases', blurb: 'Courses, downloads, memberships, tickets and sessions you own.', icon: 'Backpack', group: 'creator', path: '/library', defaultOn: false, minRole: 'user', accent: 'guru' },

  { key: 'admin', name: 'Admin', blurb: 'Roles, permissions, feature flags, audit log, honors, points.', icon: 'KeyRound', group: 'manage', path: '/admin', defaultOn: true, minRole: 'admin' },
  { key: 'manage', name: 'Manage', blurb: 'Your staff tools, as far as your permissions go.', icon: 'ShieldCheck', group: 'manage', path: '/manage', defaultOn: true, minRole: 'sub_admin' },
  // Tracking for the team, in Operations: the module's minRole keeps it to staff and admins.
  { key: 'observability', name: 'Dev Tools', blurb: 'Who is here, which apps are on, roles and the build map.', icon: 'RadioTower', group: 'manage', path: '/internal/observability', defaultOn: true, minRole: 'sub_admin' },
];

export const MODULE_BY_KEY: Record<string, AppModule> = byKey(MODULES.map((m) => [m.key, m]));

export const MODULE_GROUPS: Record<ModuleGroup, string> = {
  earn: 'Contribution',
  creator: 'Creation',
  community: 'Connection',
  wellbeing: 'Reflection',
  core: 'Essentials',
  manage: 'Operations',
};

/** The one order of the app groups, everywhere they are listed (Apps, Profile, Features, the sidebar, the phone menu, Home's Go to,
 * the public Features page): Contribution, Reflection, Connection, Creation, Essentials, then the team's Operations. The founder's
 * order (2026-11-03); inside a group, apps come in MODULES' order unless the person arranged them. */
export const MODULE_GROUP_ORDER: readonly ModuleGroup[] = ['earn', 'wellbeing', 'community', 'creator', 'core', 'manage'];
/** The given groups, in the one order. */
export const inGroupOrder = (groups: readonly ModuleGroup[]): ModuleGroup[] => MODULE_GROUP_ORDER.filter((g) => groups.includes(g));

/** Which groups start open on Apps, in the laptop sidebar and in the phone menu for someone who has not picked: Contribution and
 * Essentials (founder, 2026-11-04). Profile, Features opens every group unless the person picked otherwise. */
export const GROUP_OPEN_DEFAULT: Readonly<Record<ModuleGroup, boolean>> = { earn: true, wellbeing: false, community: false, creator: false, core: true, manage: false };

/** A person's own arrangement of the app groups, saved on the account (`users.app_prefs_json`, migration 0074): whether each group
 * starts open, and the order of the apps they placed inside a group. Apps never move between groups and groups never reorder. */
export interface AppPrefs {
  open: Partial<Record<ModuleGroup, boolean>>;
  order: Partial<Record<ModuleGroup, string[]>>;
}

const GROUP_KEY: Record<string, ModuleGroup> = byKey(MODULE_GROUP_ORDER.map((g) => [g, g]));

/** What is wrong with app prefs sent by a person, or null: only known groups, a yes or no for open, and in each group's order only
 * that group's own app keys, each once. Looked up in prototype-less objects, so "constructor" is no group and no app. */
export function appPrefsProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'app prefs are an object';
  const { open, order } = raw as { open?: unknown; order?: unknown };
  if (open !== undefined) {
    if (!open || typeof open !== 'object' || Array.isArray(open)) return 'open is an object';
    for (const [k, v] of Object.entries(open)) {
      if (!GROUP_KEY[k]) return `no group called ${k.slice(0, 40)}`;
      if (typeof v !== 'boolean') return 'open is yes or no for each group';
    }
  }
  if (order !== undefined) {
    if (!order || typeof order !== 'object' || Array.isArray(order)) return 'order is an object';
    for (const [k, list] of Object.entries(order)) {
      const g = GROUP_KEY[k];
      if (!g) return `no group called ${k.slice(0, 40)}`;
      if (!Array.isArray(list)) return 'each order is a list';
      const seen = new Set<string>();
      for (const x of list) {
        if (typeof x !== 'string' || !MODULE_BY_KEY[x]) return 'an order names only apps';
        if (MODULE_BY_KEY[x].group !== g) return `${x} belongs to another group`;
        if (seen.has(x)) return `${x} is listed twice`;
        seen.add(x);
      }
    }
  }
  return null;
}

/** The one reader of app prefs (stored JSON or a parsed object): keeps what is sound and drops the rest, never throws. */
export function parseAppPrefs(raw: unknown): AppPrefs {
  let v: unknown = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  const out: AppPrefs = { open: {}, order: {} };
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  const { open, order } = v as { open?: unknown; order?: unknown };
  if (open && typeof open === 'object' && !Array.isArray(open)) {
    for (const [k, b] of Object.entries(open)) {
      const g = GROUP_KEY[k];
      if (g && typeof b === 'boolean') out.open[g] = b;
    }
  }
  if (order && typeof order === 'object' && !Array.isArray(order)) {
    for (const [k, list] of Object.entries(order)) {
      const g = GROUP_KEY[k];
      if (!g || !Array.isArray(list)) continue;
      const seen = new Set<string>();
      const keys: string[] = [];
      for (const x of list) {
        if (typeof x !== 'string' || seen.has(x) || MODULE_BY_KEY[x]?.group !== g) continue;
        seen.add(x);
        keys.push(x);
      }
      if (keys.length > 0) out.order[g] = keys;
    }
  }
  return out;
}

/** Whether a group starts open: the person's pick, else the default for that list (`GROUP_OPEN_DEFAULT`, or every group on Profile). */
export function groupStartsOpen(prefs: AppPrefs | null | undefined, group: ModuleGroup, fallback: boolean = GROUP_OPEN_DEFAULT[group]): boolean {
  return prefs?.open[group] ?? fallback;
}

/** The apps of one group in the person's order: the ones they placed first, in their order, then every other app in the order it came
 * in (the default order, `MODULES`), so an app added later slots in by that rule. */
export function orderInGroup<T extends { key: string }>(list: readonly T[], order: readonly string[] | null | undefined): T[] {
  if (!order || order.length === 0) return [...list];
  const at = new Map(order.map((k, i) => [k, i] as const));
  const placed = list.filter((m) => at.has(m.key)).sort((a, b) => (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0));
  return [...placed, ...list.filter((m) => !at.has(m.key))];
}

/** The relationship whose colour each app group wears on the Apps page and under You, Features. */
export const MODULE_GROUP_ACCENT: Record<ModuleGroup, RelationshipKey> = {
  earn: 'servant_leader',
  creator: 'parent_child',
  community: 'friendship',
  wellbeing: 'lover_partner',
  core: 'self',
  manage: 'guru',
};

/** One line on what each group is for. */
export const MODULE_GROUP_BLURB: Record<ModuleGroup, string> = {
  earn: 'Learn a craft, do the work, get paid.',
  creator: 'Make things: your page, your shop, your numbers.',
  community: 'Meet people, on your terms.',
  wellbeing: 'How you are doing, day by day.',
  core: 'The basics that are always around.',
  manage: 'Tools for the team.',
};

export interface ModuleSetting {
  key: string;
  enabled: boolean;
  minRole: Role;
  /** Percentage of people the module is rolled out to, 0 to 100. */
  rollout: number;
}

export interface FlagOverride {
  id: string;
  flagKey: string;
  subjectType: 'user' | 'role' | 'organization';
  subjectId: string;
  enabled: boolean;
  expiresAt: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface ModuleAccess {
  available: boolean;
  on: boolean;
  /** Why it is unavailable, for the admin preview and the gate screen. */
  reason: 'ok' | 'disabled' | 'role' | 'rollout' | 'override';
}

/** Deterministic 0 to 99 bucket for rollout percentages. */
export function rolloutBucket(subject: string, key: string): number {
  let h = 2166136261;
  for (const ch of `${subject}:${key}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: string;
  after: string;
  createdAt: string;
}

/** Resolve what a person can see: global switch, role, then their own toggle. */
export function moduleState(m: AppModule, role: Role, globals: Record<string, ModuleSetting | undefined>, mine: Record<string, boolean>): { available: boolean; on: boolean } {
  const g = globals[m.key];
  const minRole = g?.minRole ?? m.minRole;
  const available = (g?.enabled ?? true) && roleRank(role) >= roleRank(minRole);
  const on = available && (m.locked ? true : (mine[m.key] ?? m.defaultOn));
  return { available, on };
}
