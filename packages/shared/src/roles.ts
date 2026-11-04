import type { RelationshipKey } from './core.ts';

// ---------------------------------------------------------------------------
// Roles and accounts
// ---------------------------------------------------------------------------

export const ROLES = ['user', 'sub_admin', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Icons. Shared stays free of React, so a registry names its icon with a key and the web draws it
// (`apps/web/src/lib/appIcons.ts` maps every key to a lucide-react icon, and the type check insists on all of them).
// The keys are lucide's own names in 1.66. A new key is added here and in that map, nowhere else.
// ---------------------------------------------------------------------------

export const ICON_NAMES = [
  'Activity', 'Anchor', 'Aperture', 'ArrowRight', 'AtSign', 'Award', 'Backpack', 'BadgeCheck', 'BadgeDollarSign', 'Ban', 'Banknote', 'BatteryLow',
  'Bell', 'BellRing', 'BookBookmark', 'BookOpen', 'Bot', 'Brain', 'BrickWall', 'Briefcase', 'BriefcaseBusiness', 'BuildingComplex', 'CalendarClock',
  'CalendarDays', 'CalendarRange', 'Camera', 'Cast', 'Castle', 'ChartLine', 'Check', 'CircleAlert', 'CircleCheck', 'CircleCheckBig', 'CirclePlus',
  'CircleQuestionMark', 'Clapperboard', 'ClipboardCheck', 'CloudRain', 'Coffee', 'Coins', 'Compass', 'Construction', 'CreditCard', 'Crown', 'Disc3',
  'Dumbbell', 'Earth', 'EighthNote', 'EighthNotes', 'FaceGrinning', 'FaceSlightlySmiling', 'Feather', 'FileDown', 'FileText', 'Flag', 'Flame',
  'FlaskConical', 'Flower2', 'FolderCheck', 'FolderKanban', 'Footprints', 'GalleryHorizontal', 'Gamepad2', 'Gem', 'Gift', 'Globe', 'GraduationCap',
  'Hammer', 'HandCoins', 'HandHeart', 'HandHelping', 'Handshake', 'Headphones', 'Heart', 'HeartPulse', 'Hourglass', 'House', 'IdCard', 'Image',
  'KeyRound', 'Landmark', 'LayoutList', 'Leaf', 'LetterH', 'LifeBuoy', 'Lightbulb', 'Link', 'ListChecks', 'ListPlus', 'Lock', 'Luggage', 'Mail',
  'Map', 'Medal', 'Megaphone', 'MessageCircle', 'MessageCircleHeart', 'MessagesSquare', 'MicSignal', 'MicVocal', 'Minus', 'Moon', 'MoonStar',
  'Mountain', 'Newspaper', 'NotebookPen', 'NotebookText', 'OctagonX', 'Orbit', 'Package', 'Palette', 'PartyPopper', 'PenLine', 'PersonStanding',
  'PiggyBank', 'Plane', 'Presentation', 'Puzzle', 'RadioTower', 'Rainbow', 'Receipt', 'Recycle', 'Repeat', 'Rocket', 'Route', 'ScanSearch',
  'Scissors', 'Search', 'SearchCheck', 'Share2', 'Shield', 'ShieldCheck', 'Shirt', 'ShoppingBag', 'ShoppingCart', 'Signpost', 'Smartphone', 'Spade',
  'Sparkle', 'Sparkles', 'Speech', 'Sprout', 'SquareCheck', 'SquarePlay', 'Star', 'Store', 'Sun', 'Sunrise', 'Swords', 'Tag', 'Target', 'Telescope',
  'Tent', 'ThumbsUp', 'Ticket', 'Toolbox', 'Tornado', 'TreeDeciduous', 'TreePine', 'TrendingUp', 'Triangle', 'Trophy', 'Tv', 'Type', 'Undo2',
  'UserRound', 'Users', 'UsersRound', 'UtensilsCrossed', 'Video', 'VolumeX', 'Wallet', 'WalletMinimal', 'WandSparkles', 'WavesHorizontal', 'Wind',
  'X', 'Zap',
] as const;
export type IconName = (typeof ICON_NAMES)[number];
export const isIconName = (v: unknown): v is IconName => typeof v === 'string' && (ICON_NAMES as readonly string[]).includes(v);
/** The icon a tag in someone's own words wears: it is not one of the known tags. */
export const OWN_TAG_ICON: IconName = 'Tag';

/** One icon per kind of Knowledge read, shared by Home and Knowledge so the two never disagree. */
export const KNOWLEDGE_KIND_ICON: Readonly<Record<string, IconName>> = {
  article: 'FileText',
  exercise: 'Puzzle',
  video: 'Video',
  audio: 'Headphones',
  link: 'Link',
};
export const knowledgeKindIcon = (kind: string): IconName => (Object.hasOwn(KNOWLEDGE_KIND_ICON, kind) ? KNOWLEDGE_KIND_ICON[kind]! : 'FileText');

/** Each role has a small badge: it sits on the profile picture and under the logo. It is not an earned badge. */
export const ROLE_META: Record<Role, { name: string; blurb: string; icon: IconName; accent: RelationshipKey }> = {
  user: { name: 'Creator', blurb: 'Learns, works, connects and sells.', icon: 'Sparkles', accent: 'self' },
  sub_admin: { name: 'Staff', blurb: 'Runs parts of Kreators, as far as their permissions go.', icon: 'Shield', accent: 'guru' },
  admin: { name: 'Admin', blurb: 'Everything, including roles, permissions and which features exist.', icon: 'KeyRound', accent: 'divine' },
};

/**
 * Staff permissions. A permission is a job someone is trusted with; admins hold all of them, apart from Life coach,
 * which is never implied: a life coach is someone the team chose to coach, so even an admin is given it on purpose.
 */
export const PERMISSIONS = ['talent', 'cohorts', 'events', 'finance', 'moderation', 'support', 'review', 'mentor', 'coach'] as const;
export type Permission = (typeof PERMISSIONS)[number];
/** The permissions a creator can hold. Every other one needs the Staff role. */
export const CREATOR_PERMISSIONS: readonly Permission[] = ['mentor', 'coach'];

export const PERMISSION_META: Record<Permission, { name: string; blurb: string; icon: IconName }> = {
  talent: { name: 'Talent manager', blurb: 'Runs Army campaigns, shortlists and assigns creators.', icon: 'Clapperboard' },
  cohorts: { name: 'Cohort manager', blurb: 'Publishes programs, runs cohorts, marks completion.', icon: 'GraduationCap' },
  events: { name: 'Event host', blurb: 'Creates any kind of event and checks people in.', icon: 'PartyPopper' },
  finance: { name: 'Finance', blurb: 'Approves bounty payouts and reviews money orders.', icon: 'Banknote' },
  moderation: { name: 'Moderator', blurb: 'Hides posts and handles reports.', icon: 'ShieldCheck' },
  support: { name: 'Support', blurb: 'Answers help requests.', icon: 'LifeBuoy' },
  review: { name: 'Reviewer', blurb: 'Decides Club applications, bounties, TV and Fund proposals.', icon: 'SearchCheck' },
  mentor: { name: 'Mentor', blurb: 'Gives feedback on assignments. Can be held by a creator.', icon: 'Presentation' },
  coach: { name: 'Life coach', blurb: 'Coaches students who said yes: sees what they share, leaves notes, adds tasks. Never their journal. Can be held by a creator.', icon: 'Target' },
};

/**
 * Staff-level: admin or staff holding the permission. Mentor and Life coach are the permissions a creator can hold,
 * and Life coach is the one an admin does not hold unless given it.
 */
export function isStaffFor(user: { role: Role; permissions: readonly string[] }, perm: Permission): boolean {
  if (perm === 'coach') return user.permissions.includes('coach');
  if (user.role === 'admin') return true;
  if (CREATOR_PERMISSIONS.includes(perm)) return user.permissions.includes(perm);
  return user.role === 'sub_admin' && user.permissions.includes(perm);
}

/** What the small badge on a picture says: the role, or Life coach for a creator the team made a life coach. */
export type BadgeRole = Role | 'coach';
export const BADGE_META: Record<BadgeRole, { name: string; blurb: string; icon: IconName; accent: RelationshipKey }> = {
  ...ROLE_META,
  coach: { name: 'Life coach', blurb: 'Coaches students who said yes. The team makes someone a life coach.', icon: 'Target', accent: 'guru' },
};
/** Staff and admins keep their own badge; a creator who holds Life coach wears that one. */
export function badgeRoleOf(user: { role: Role; permissions: readonly string[] }): BadgeRole {
  return user.role === 'user' && user.permissions.includes('coach') ? 'coach' : user.role;
}
