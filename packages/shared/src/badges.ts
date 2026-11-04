import { byKey, formatCount } from './core.ts';
import { XP } from './pillars.ts';
import { POINTS } from './rewards.ts';
import { SOCIAL_REWARDS } from './community.ts';
import { ATTENDEE_CLAIMS_PER_DAY, ATTENDEE_XP_MAX, RUN_REWARD } from './events.ts';
import { FEATURE_FEE_POINTS } from './store.ts';
import type { IconName } from './roles.ts';

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** The four finishes. A badge's tier is how much it asks of you, not how rare it is. */
export const BADGE_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type BadgeTier = (typeof BADGE_TIERS)[number];
export const BADGE_TIER_LABEL: Record<BadgeTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

/** The shapes a medal is drawn in. Each family wears one. */
export type BadgeShape = 'shield' | 'hexagon' | 'star' | 'seal' | 'ribbon' | 'diamond' | 'medal';

export const BADGE_FAMILIES = ['Daily habits', 'Pillars', 'Focus', 'Reflection', 'Community', 'Creator', 'Money', 'Fitness', 'Learning', 'Milestones'] as const;
export type BadgeFamily = (typeof BADGE_FAMILIES)[number];
/**
 * `private` families are counted from things only their owner may see (the journal, a tracker, money, focus time).
 * Their badges show to the owner alone: never on the public page, never in the leaderboard count, never in a unlock picker.
 */
export const BADGE_FAMILY_META: Record<BadgeFamily, { shape: BadgeShape; blurb: string; private: boolean }> = {
  'Daily habits': { shape: 'shield', blurb: 'Ticks, small acts and days in a row.', private: false },
  Pillars: { shape: 'hexagon', blurb: 'Setting up the seven pillars and finishing projects.', private: false },
  Focus: { shape: 'star', blurb: 'Focus rounds and days you stayed away from what you listed. Only you see these.', private: true },
  Reflection: { shape: 'seal', blurb: 'Journal pages, reviews and moods. Only you see these, and only counts are used, never what you wrote.', private: true },
  Community: { shape: 'ribbon', blurb: 'Posts, replies, friends, followers and events.', private: false },
  Creator: { shape: 'diamond', blurb: 'Products, sales and content rewards.', private: false },
  Money: { shape: 'medal', blurb: 'Finance entries, goals and paid invoices. Only you see these.', private: true },
  Fitness: { shape: 'medal', blurb: 'Runs and kilometres with your clubs.', private: false },
  Learning: { shape: 'seal', blurb: 'Lessons finished and certificates earned.', private: false },
  Milestones: { shape: 'star', blurb: 'Levels and the Club.', private: false },
};

/** The counts a rule can read. The server fills every one from data it already holds; a count never reads what a person wrote. */
export const BADGE_STATS = [
  'tasks_done', 'tasks_pillars', 'sparks_done', 'projects_cleared', 'pillars_set', 'best_streak', 'level', 'not_to_do_kept',
  'focus_rounds', 'focus_minutes', 'journal_entries', 'reviews_written', 'mood_days', 'mindful_logs', 'discover_taken',
  'posts', 'replies', 'friends', 'followers', 'referrals', 'events_claimed', 'products_live', 'sales', 'bounties_paid',
  'finance_entries', 'finance_goals_done', 'invoices_paid', 'runs_logged', 'run_metres', 'lessons_done', 'certificates', 'club',
] as const;
export type BadgeStat = (typeof BADGE_STATS)[number];
export type BadgeFacts = Record<BadgeStat, number>;

/** How a count is said in a progress line: "3 of 7 days". `per` turns metres into kilometres and minutes into hours. */
export const BADGE_STAT_UNIT: Record<BadgeStat, { one: string; many: string; per?: number }> = {
  tasks_done: { one: 'task', many: 'tasks' },
  tasks_pillars: { one: 'pillar', many: 'pillars' },
  sparks_done: { one: 'small act', many: 'small acts' },
  projects_cleared: { one: 'project', many: 'projects' },
  pillars_set: { one: 'pillar', many: 'pillars' },
  best_streak: { one: 'day', many: 'days' },
  level: { one: 'level', many: 'levels' },
  not_to_do_kept: { one: 'kept day', many: 'kept days' },
  focus_rounds: { one: 'round', many: 'rounds' },
  focus_minutes: { one: 'hour', many: 'hours', per: 60 },
  journal_entries: { one: 'entry', many: 'entries' },
  reviews_written: { one: 'review', many: 'reviews' },
  mood_days: { one: 'day', many: 'days' },
  mindful_logs: { one: 'session', many: 'sessions' },
  discover_taken: { one: 'quiz', many: 'quizzes' },
  posts: { one: 'post', many: 'posts' },
  replies: { one: 'reply', many: 'replies' },
  friends: { one: 'friend', many: 'friends' },
  followers: { one: 'follower', many: 'followers' },
  referrals: { one: 'friend', many: 'friends' },
  events_claimed: { one: 'event', many: 'events' },
  products_live: { one: 'product', many: 'products' },
  sales: { one: 'sale', many: 'sales' },
  bounties_paid: { one: 'reward', many: 'rewards' },
  finance_entries: { one: 'entry', many: 'entries' },
  finance_goals_done: { one: 'goal', many: 'goals' },
  invoices_paid: { one: 'invoice', many: 'invoices' },
  runs_logged: { one: 'run', many: 'runs' },
  run_metres: { one: 'km', many: 'km', per: 1000 },
  lessons_done: { one: 'lesson', many: 'lessons' },
  certificates: { one: 'certificate', many: 'certificates' },
  club: { one: 'membership', many: 'memberships' },
};

export interface Badge {
  key: string;
  name: string;
  /** The lucide glyph at the medal's centre (drawn by the web's BadgeArt). */
  icon: IconName;
  /** How to earn it, with the exact number. */
  how: string;
  tier: BadgeTier;
  family: BadgeFamily;
  /** The rule: this count has to reach `min`. */
  stat: BadgeStat;
  min: number;
}

const badge = (key: string, name: string, icon: IconName, family: BadgeFamily, tier: BadgeTier, stat: BadgeStat, min: number, how: string): Badge => ({ key, name, icon, how, tier, family, stat, min });

/** In the order the gallery shows them: family by family, the easiest first. The first two stay First tick and Three in a row. */
export const BADGES: readonly Badge[] = [
  badge('first_task', 'First tick', 'CircleCheck', 'Daily habits', 'bronze', 'tasks_done', 1, 'Complete your first task'),
  badge('streak_3', 'Three in a row', 'Flame', 'Daily habits', 'bronze', 'best_streak', 3, 'Check in three days running'),
  badge('streak_7', 'Full week', 'Rainbow', 'Daily habits', 'silver', 'best_streak', 7, 'Check in seven days running'),
  badge('ten_tasks', 'Ripple maker', 'WavesHorizontal', 'Daily habits', 'bronze', 'tasks_done', 10, 'Complete ten tasks'),
  badge('spark_5', 'Good hands', 'Zap', 'Daily habits', 'bronze', 'sparks_done', 5, 'Do five small acts'),
  badge('tasks_100', 'Hundred ticks', 'BadgeCheck', 'Daily habits', 'silver', 'tasks_done', 100, 'Complete one hundred tasks'),
  badge('streak_30', 'Thirty days', 'MoonStar', 'Daily habits', 'gold', 'best_streak', 30, 'Check in thirty days running'),
  badge('tasks_500', 'Five hundred ticks', 'Mountain', 'Daily habits', 'platinum', 'tasks_done', 500, 'Complete five hundred tasks'),
  badge('streak_100', 'Hundred days', 'Crown', 'Daily habits', 'platinum', 'best_streak', 100, 'Check in one hundred days running'),

  badge('pillar_1', 'First pillar', 'Landmark', 'Pillars', 'bronze', 'pillars_set', 1, 'Set up your first pillar'),
  badge('project_clear', 'Project cleared', 'Flag', 'Pillars', 'bronze', 'projects_cleared', 1, 'Finish every task in a project'),
  badge('project_5', 'Project closer', 'FolderCheck', 'Pillars', 'silver', 'projects_cleared', 5, 'Finish every task in five projects'),
  badge('project_10', 'Ten projects cleared', 'BrickWall', 'Pillars', 'gold', 'projects_cleared', 10, 'Finish every task in ten projects'),
  badge('all_seven', 'All seven', 'Castle', 'Pillars', 'gold', 'pillars_set', 7, 'Set up every one of the seven pillars'),
  badge('seven_sided', 'Seven-sided', 'Globe', 'Pillars', 'platinum', 'tasks_pillars', 7, 'Complete a task in every one of the seven pillars'),

  badge('not_to_do_7', 'Held the line', 'OctagonX', 'Focus', 'bronze', 'not_to_do_kept', 7, 'Keep seven days on your not to do list'),
  badge('not_to_do_30', 'Stayed away', 'Construction', 'Focus', 'silver', 'not_to_do_kept', 30, 'Keep thirty days on your not to do list'),
  badge('focus_1', 'First focus round', 'Headphones', 'Focus', 'bronze', 'focus_rounds', 1, 'Finish a focus round in Mindfulness'),
  badge('focus_10h', 'Ten hours of focus', 'Telescope', 'Focus', 'gold', 'focus_minutes', 600, 'Focus for ten hours in total'),
  badge('focus_50h', 'Fifty hours of focus', 'Brain', 'Focus', 'platinum', 'focus_minutes', 3000, 'Focus for fifty hours in total'),

  badge('journal_1', 'First page', 'NotebookPen', 'Reflection', 'bronze', 'journal_entries', 1, 'Write your first journal entry'),
  badge('journal_10', 'Ten pages', 'BookOpen', 'Reflection', 'silver', 'journal_entries', 10, 'Write ten journal entries'),
  badge('journal_50', 'Fifty pages', 'Feather', 'Reflection', 'gold', 'journal_entries', 50, 'Write fifty journal entries'),
  badge('review_1', 'First review', 'ScanSearch', 'Reflection', 'bronze', 'reviews_written', 1, 'Save your first review'),
  badge('review_4', 'Four reviews', 'ClipboardCheck', 'Reflection', 'silver', 'reviews_written', 4, 'Save four reviews'),
  badge('mood_7', 'Seven moods', 'FaceSlightlySmiling', 'Reflection', 'bronze', 'mood_days', 7, 'Log your mood on seven different days'),
  badge('mindful_10', 'Ten still moments', 'Wind', 'Reflection', 'silver', 'mindful_logs', 10, 'Log ten mindful minutes sessions'),
  badge('discover_1', 'Know yourself', 'Compass', 'Reflection', 'bronze', 'discover_taken', 1, 'Finish the Discover quiz'),

  badge('post_1', 'First post', 'MessageCircle', 'Community', 'bronze', 'posts', 1, 'Write a post in Community'),
  badge('post_10', 'Ten posts', 'Megaphone', 'Community', 'silver', 'posts', 10, 'Write ten posts in Community'),
  badge('reply_5', 'Good neighbour', 'House', 'Community', 'bronze', 'replies', 5, 'Reply to five posts'),
  badge('reply_25', 'Helpful voice', 'Speech', 'Community', 'silver', 'replies', 25, 'Reply to twenty-five posts'),
  badge('friend_1', 'First friend', 'Handshake', 'Community', 'bronze', 'friends', 1, 'Make your first friend in Bond'),
  badge('friend_5', 'Five friends', 'UsersRound', 'Community', 'silver', 'friends', 5, 'Make five friends in Bond'),
  badge('follower_10', 'Ten followers', 'Users', 'Community', 'silver', 'followers', 10, 'Get ten followers on your public page'),
  badge('referral_1', 'Brought a friend', 'Gift', 'Community', 'bronze', 'referrals', 1, 'Have a friend sign up with your link and an email'),
  badge('event_1', 'Showed up', 'Ticket', 'Community', 'bronze', 'events_claimed', 1, 'Claim an attendee code at an event'),

  badge('product_1', 'First product', 'ShoppingBag', 'Creator', 'bronze', 'products_live', 1, 'Put a product live in your Shop'),
  badge('product_5', 'Five products', 'Store', 'Creator', 'silver', 'products_live', 5, 'Have five products live in your Shop'),
  badge('sale_1', 'First sale', 'Coins', 'Creator', 'silver', 'sales', 1, 'Make your first sale'),
  badge('sale_10', 'Ten sales', 'Banknote', 'Creator', 'gold', 'sales', 10, 'Make ten sales'),
  badge('win_1', 'First reward', 'Trophy', 'Creator', 'bronze', 'bounties_paid', 1, 'Get paid for a post in Win'),
  badge('win_5', 'Five rewards', 'Award', 'Creator', 'silver', 'bounties_paid', 5, 'Get paid for five posts in Win'),

  badge('finance_1', 'First entry', 'NotebookText', 'Money', 'bronze', 'finance_entries', 1, 'Add your first entry in Finance'),
  badge('goal_done', 'Goal reached', 'PiggyBank', 'Money', 'silver', 'finance_goals_done', 1, 'Reach a savings goal in Finance'),
  badge('invoice_1', 'First invoice paid', 'Receipt', 'Money', 'silver', 'invoices_paid', 1, 'Mark your first invoice as paid'),
  badge('invoice_10', 'Ten invoices paid', 'ChartLine', 'Money', 'gold', 'invoices_paid', 10, 'Mark ten invoices as paid'),

  badge('run_1', 'First run', 'Footprints', 'Fitness', 'bronze', 'runs_logged', 1, 'Log a run with a start code'),
  badge('run_10', 'Ten runs', 'PersonStanding', 'Fitness', 'silver', 'runs_logged', 10, 'Log ten runs with your clubs'),
  badge('run_42k', 'Marathon distance', 'Route', 'Fitness', 'silver', 'run_metres', 42_195, 'Run 42.2 kilometres in total with your clubs'),
  badge('run_100k', 'Hundred k', 'Medal', 'Fitness', 'gold', 'run_metres', 100_000, 'Run a hundred kilometres with your clubs'),
  badge('run_500k', 'Five hundred k', 'Earth', 'Fitness', 'platinum', 'run_metres', 500_000, 'Run five hundred kilometres with your clubs'),

  badge('lesson_1', 'First lesson', 'BookBookmark', 'Learning', 'bronze', 'lessons_done', 1, 'Finish a lesson in School'),
  badge('lesson_10', 'Ten lessons', 'Backpack', 'Learning', 'silver', 'lessons_done', 10, 'Finish ten lessons in School'),
  badge('cert_1', 'Certified', 'GraduationCap', 'Learning', 'gold', 'certificates', 1, 'Earn a School certificate'),

  badge('level_5', 'Level five', 'Star', 'Milestones', 'silver', 'level', 5, 'Reach level five'),
  badge('club_member', 'Club member', 'IdCard', 'Milestones', 'silver', 'club', 1, 'Be accepted into the Club'),
  badge('level_10', 'Level ten', 'Sparkle', 'Milestones', 'gold', 'level', 10, 'Reach level ten'),
  badge('level_20', 'Level twenty', 'Rocket', 'Milestones', 'platinum', 'level', 20, 'Reach level twenty'),
];

export const BADGE_BY_KEY: Record<string, Badge> = byKey(BADGES.map((b) => [b.key, b]));

/** A badge whose count comes from things only its owner may see: it never leaves their own screens. */
export const isPrivateBadge = (key: string): boolean => {
  const b = BADGE_BY_KEY[key];
  return b ? BADGE_FAMILY_META[b.family].private : false;
};
/** What the public page, the leaderboard and an unlock picker may use. */
export const PUBLIC_BADGES: readonly Badge[] = BADGES.filter((b) => !BADGE_FAMILY_META[b.family].private);

/** The badges these counts earn, in catalogue order. A count that is missing is zero. */
export function badgesFrom(facts: Partial<BadgeFacts>): string[] {
  return BADGES.filter((b) => (facts[b.stat] ?? 0) >= b.min).map((b) => b.key);
}

/** How far along a badge is: "3 of 7 days". Only a rule that asks for more than one has a bar. */
export function badgeProgress(b: Badge, have: number): { have: number; need: number; pct: number; label: string; countable: boolean } {
  const u = BADGE_STAT_UNIT[b.stat];
  const per = u.per ?? 1;
  const say = (n: number) => String(per > 1 ? Math.round((n / per) * 10) / 10 : n);
  const shown = Math.min(have, b.min);
  const need = per > 1 ? b.min / per : b.min;
  return {
    have: Math.min(have, b.min),
    need: b.min,
    pct: b.min > 0 ? Math.max(0, Math.min(100, Math.floor((shown / b.min) * 100))) : 100,
    label: `${say(shown)} of ${say(b.min)} ${need === 1 ? u.one : u.many}`,
    countable: b.min > 1,
  };
}

/** One badge a person holds. `at` is empty for a badge earned before dates were kept. `given` is a badge the team gave by hand. */
export interface HeldBadge {
  key: string;
  at: string | null;
  given: boolean;
}
/** What the gallery reads: what is held, and every count a rule reads so a bar can be drawn. */
export interface BadgesResponse {
  held: HeldBadge[];
  progress: BadgeFacts;
}

// ---------------------------------------------------------------------------
// Honors — the second kind of badge. Not earned by stats: given by the team or
// unlocked by time on the tower. Both count on the leaderboard.
// ---------------------------------------------------------------------------

export interface Honor {
  key: string;
  name: string;
  /** The lucide glyph inside its seal. */
  icon: IconName;
  source: 'admin' | 'time' | 'season';
  /** The finish its medal is drawn in. */
  tier: BadgeTier;
  /** For time honors: days since the account started. */
  days?: number;
  how: string;
}

export const HONORS: readonly Honor[] = [
  { key: 'pro', name: 'Pro', icon: 'Gem', source: 'admin', tier: 'platinum', how: 'Given by the kreators.app team to pro members' },
  { key: 'founder', name: 'Founding member', icon: 'BuildingComplex', source: 'admin', tier: 'gold', how: 'For the first hundred climbers' },
  { key: 'community_star', name: 'Community star', icon: 'Sparkles', source: 'admin', tier: 'gold', how: 'For lifting other people up' },
  { key: 'collab', name: 'Team player', icon: 'Handshake', source: 'admin', tier: 'silver', how: 'For working with others in a way that moved people' },
  { key: 'week_in', name: 'One week in', icon: 'Sprout', source: 'time', tier: 'bronze', days: 7, how: 'Unlocks seven days after you start' },
  { key: 'month_in', name: 'One month in', icon: 'Leaf', source: 'time', tier: 'silver', days: 30, how: 'Unlocks thirty days after you start' },
  { key: 'season_in', name: 'One season in', icon: 'TreeDeciduous', source: 'time', tier: 'gold', days: 90, how: 'Unlocks ninety days after you start' },
  { key: 'year_in', name: 'One year in', icon: 'TreePine', source: 'time', tier: 'platinum', days: 365, how: 'Unlocks a year after you start' },
  { key: 'season_top', name: 'Season top three', icon: 'Medal', source: 'season', tier: 'gold', how: 'Finished a monthly season in the top three on the leaderboard' },
];

export const HONOR_BY_KEY: Record<string, Honor> = byKey(HONORS.map((h) => [h.key, h]));

export function timeHonors(createdAt: string, now: Date = new Date()): string[] {
  const started = new Date(createdAt).getTime();
  if (Number.isNaN(started)) return [];
  const days = (now.getTime() - started) / 86_400_000;
  return HONORS.filter((h) => h.source === 'time' && h.days !== undefined && days >= h.days).map((h) => h.key);
}

// ---------------------------------------------------------------------------
// Unlocks and the earning guide: what a thing asks for before you can have it, and how everything pays
// ---------------------------------------------------------------------------

/** What a product, store item or tool asks for, and whether this viewer meets it. */
export interface Unlock {
  minPoints: number;
  /** An xp floor, on top of points and a badge. Zero means none. */
  minXp: number;
  badge: string;
  ok: boolean;
  /** Plain words for the lock, empty when open. */
  why: string;
}
export function badgeName(key: string): string {
  return BADGES.find((b) => b.key === key)?.name ?? HONORS.find((h) => h.key === key)?.name ?? key;
}
/**
 * A badge a product, store item, tool or game may ask for: a public badge or an honor. The private families (Reflection, Focus,
 * Money) are never an unlock, since a gate on them would tell a seller something drawn from a journal, focus or money count.
 */
export const isUnlockBadgeKey = (key: string): boolean => PUBLIC_BADGES.some((b) => b.key === key) || HONORS.some((h) => h.key === key);
/** The viewer, for the unlock rule. A super admin (role admin) is never locked out of anything. */
export interface UnlockHave {
  points: number;
  xp?: number;
  badges: readonly string[];
  superAdmin?: boolean;
}
const joinWords = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** The one unlock rule: the points balance and xp have to reach their floors, and the badge has to be held. A super admin always passes. */
export function unlockFor(ask: { minPoints: number; minXp?: number; badge: string }, have: UnlockHave | null): Unlock {
  const minXp = ask.minXp ?? 0;
  const needsPoints = ask.minPoints > 0;
  const needsXp = minXp > 0;
  const needsBadge = Boolean(ask.badge);
  const open = { minPoints: ask.minPoints, minXp, badge: ask.badge, ok: true, why: '' };
  if (!needsPoints && !needsXp && !needsBadge) return { ...open, minPoints: 0, minXp: 0, badge: '' };
  if (have?.superAdmin) return open;
  const asks = [needsXp ? `${formatCount(minXp)} xp` : '', needsPoints ? `${formatCount(ask.minPoints)} points` : '', needsBadge ? `the ${badgeName(ask.badge)} badge` : ''].filter(Boolean);
  if (!have) return { ...open, ok: false, why: `Sign in to open this. It asks for ${joinWords(asks)}.` };
  const short: string[] = [];
  if (needsXp && (have.xp ?? 0) < minXp) short.push(`${formatCount(minXp)} xp, you have ${formatCount(have.xp ?? 0)}`);
  if (needsPoints && have.points < ask.minPoints) short.push(`${formatCount(ask.minPoints)} points, you have ${formatCount(have.points)}`);
  if (needsBadge && !have.badges.includes(ask.badge)) short.push(`the ${badgeName(ask.badge)} badge`);
  return { ...open, ok: short.length === 0, why: short.length ? `Needs ${joinWords(short)}.` : '' };
}
/** What a locked button says: "Unlocks at 500 xp, 2,000 points and the First tick badge". Empty when there is nothing to reach. */
export function unlockAt(u: Pick<Unlock, 'minPoints' | 'minXp' | 'badge'>): string {
  const asks = [u.minXp > 0 ? `${formatCount(u.minXp)} xp` : '', u.minPoints > 0 ? `${formatCount(u.minPoints)} points` : '', u.badge ? `the ${badgeName(u.badge)} badge` : ''].filter(Boolean);
  return asks.length ? `Unlocks at ${joinWords(asks)}` : '';
}

/** The next badge to go for, by the order they are listed. */
export function nextBadge(earned: readonly string[]): Badge | null {
  return BADGES.find((b) => !earned.includes(b.key)) ?? null;
}

export interface EarningLine {
  what: string;
  pays: string;
  how: string;
}
/** How everything pays, in one place. Nudges around the app point here and quote single lines. A function, so it can quote constants declared further down. */
export function earningGuide(): { title: string; lines: EarningLine[] }[] {
  return [
  {
    title: 'Every day',
    lines: [
      { what: 'Check in', pays: `${XP.checkin} xp and ${POINTS.checkin} points`, how: 'The first box on Daily.' },
      { what: 'A week in a row', pays: `${POINTS.streakBonus} points more`, how: `Every ${POINTS.streakBonusEvery}th day of a check-in streak.` },
      { what: 'The small act', pays: `${XP.spark} xp`, how: 'Two minutes for your weakest pillar.' },
      { what: 'A task', pays: `${XP.task} xp`, how: 'Six a day pay. The rest still count as done.' },
      { what: 'A kept day on the not-to-do list', pays: `${XP.notToDo} xp`, how: 'Tick what you stayed away from.' },
      { what: 'Clearing a project', pays: `${XP.projectClear} xp`, how: 'Every task in it done.' },
    ],
  },
  {
    title: 'With people',
    lines: [
      { what: 'A post', pays: `${SOCIAL_REWARDS.post.xp} xp`, how: `Up to ${SOCIAL_REWARDS.post.perDay} a day.` },
      { what: 'A reply', pays: `${SOCIAL_REWARDS.reply.xp} xp`, how: `Up to ${SOCIAL_REWARDS.reply.perDay} a day.` },
      { what: 'A like you give', pays: `${SOCIAL_REWARDS.like.xp} xp`, how: `Up to ${SOCIAL_REWARDS.like.perDay} a day.` },
      { what: 'A like on your post', pays: `${SOCIAL_REWARDS.liked.points} point`, how: 'Paid to you, once per person per post.' },
      { what: 'A new follower', pays: `${SOCIAL_REWARDS.follower.points} points`, how: 'Paid to you, once per person.' },
      { what: 'A run with a club', pays: `Up to ${ATTENDEE_XP_MAX} xp and ${RUN_REWARD.points} points`, how: `The host sets the xp before the code opens. Enter the start code during the run. Once per run, ${RUN_REWARD.perDay} runs a day.` },
      { what: 'Going to an event or a circle', pays: `Up to ${ATTENDEE_XP_MAX} xp`, how: `If the host set xp, type their attendee code at the event. Guests only, once each, ${ATTENDEE_CLAIMS_PER_DAY} in any 24 hours.` },
    ],
  },
  {
    title: 'Making and selling',
    lines: [
      { what: 'A sale in your Shop', pays: 'the price in points, minus the fee', how: 'Downloads, courses, sessions, events and more.' },
      { what: 'Campaigns and bounties', pays: 'points per verified view', how: 'Under Win and Army.' },
      { what: 'A featured week in the Store', pays: `costs ${FEATURE_FEE_POINTS} points`, how: 'Your pre-owned listing at the top for seven days.' },
    ],
  },
  {
    title: 'Badges',
    lines: BADGE_FAMILIES.map((f) => {
      const own = BADGES.filter((b) => b.family === f);
      return { what: f, pays: `${own.length} badges, no xp`, how: BADGE_FAMILY_META[f].blurb };
    }),
  },
  ];
}
