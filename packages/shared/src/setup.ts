import { byKey } from './core.ts';
import type { FOCUS_OPTIONS } from './api.ts';
import type { IconName } from './roles.ts';
import { MODULES } from './modules.ts';
import type { AppModule } from './modules.ts';
import type { EXPERIENCE_LEVELS, GOALS, SKILLS } from './profile.ts';
import type { Interest } from './circles.ts';
import type { DayTypeKey } from './dayTypes.ts';

// ---------------------------------------------------------------------------
// Setup: the first chat. Who you are (identity tags, made as you answer, in your own words when no tag
// fits), what you came for, and what gets in the way. The apps that fit are matched from the whole
// combination, never one answer at a time: every answer weighs the apps, pairs of answers that belong
// together weigh more, and every app that comes on says why, in words built from your own answers. The
// strategy session is the pillars' own onboarding, inside Pillars, offered here when the answers ask for it.
// ---------------------------------------------------------------------------

export type IdentityKind = 'role' | 'craft' | 'service' | 'stage' | 'life';

/** Something the setup can tag you as. A known tag carries what it adds to the profile and how well each app fits. */
export interface IdentityOption {
  key: string;
  /** The tag as it shows: Student, Video editor. */
  label: string;
  icon: IconName;
  kind: IdentityKind;
  /** The line under it on its card. */
  blurb: string;
  /** How a reason says it, after "because": "you are studying". */
  because: string;
  /** Typed words that tag it: lower case, whole words or phrases. */
  words: readonly string[];
  skill?: (typeof SKILLS)[number];
  interest?: Interest;
  focus?: (typeof FOCUS_OPTIONS)[number];
  level?: (typeof EXPERIENCE_LEVELS)[number];
  /** How well each app fits this tag, 1 to 3. */
  apps: Readonly<Record<string, number>>;
  /** A reason for one app that says more than `because`: an agency owner's Agency names its Team tab. */
  why?: Readonly<Record<string, string>>;
  /** The kind of day the tag implies, when one does: an editor's deep work day. Read with dayTypeFor. */
  dayType?: DayTypeKey;
}

export const IDENTITIES: readonly IdentityOption[] = [
  // Who you are right now: the first card.
  // The label is Agency's own word for the team role (TEAM_ROLE_META), so a creator reads the same word in both.
  { key: 'creator', label: 'Content creator', icon: 'Clapperboard', kind: 'role', blurb: 'I make content', because: 'you make content', words: ['creator', 'content creator', 'influencer', 'youtuber', 'instagrammer', 'vlogger', 'make content', 'create content', 'post content', 'make videos', 'my channel', 'my page', 'my followers', 'my subscribers'], focus: 'Creating', dayType: 'create', apps: { profile: 2, army: 2, win: 2, work: 1, content: 1, tools: 1, agency: 1 } },
  { key: 'freelancer', label: 'Freelancer', icon: 'Luggage', kind: 'role', blurb: 'I freelance for clients', because: 'you make things for clients', words: ['freelance', 'freelancer', 'freelancing', 'clients', 'my clients', 'client work', 'fiverr', 'upwork'], focus: 'Creating', apps: { work: 3, profile: 2, agency: 2, army: 1, finance: 1 } },
  { key: 'student', label: 'Student', icon: 'GraduationCap', kind: 'role', blurb: "I'm a student", because: 'you are studying', words: ['student', 'studying', 'college', 'university', 'uni', 'school', 'exams', 'semester', 'degree', 'final year', 'class 12'], focus: 'Study', dayType: 'learning', apps: { school: 3, work: 1, knowledge: 1, circles: 1 } },
  { key: 'employee', label: 'Employee', icon: 'Briefcase', kind: 'role', blurb: 'I have a job', because: 'you have a job', words: ['my job', 'day job', 'full time job', 'i have a job', 'office', 'employee', 'corporate', 'salaried', 'working professional', '9 to 5', '9-5', 'nine to five', 'i work at', 'i work in'], focus: 'Work', apps: { reviews: 2, finance: 2, journal: 1, school: 1 } },
  { key: 'founder', label: 'Founder', icon: 'Rocket', kind: 'role', blurb: 'I run a business', because: 'you run a business', words: ['founder', 'co-founder', 'cofounder', 'my business', 'own business', 'small business', 'startup', 'my brand', 'brand owner', 'business owner', 'shop owner', 'store owner', 'entrepreneur', 'my shop', 'my store', 'my company', 'run a business', 'run a brand', 'run a company', 'run a shop', 'run a store', 'run a startup', 'run a small', 'own a business', 'own a shop', 'own brand', 'd2c'], focus: 'Business', apps: { shop: 2, finance: 3, audience: 2, content: 2, automations: 1 } },
  { key: 'agency_owner', label: 'Agency or studio owner', icon: 'FolderKanban', kind: 'role', blurb: 'I run a content agency or studio', because: 'you run a content agency or studio', words: ['agency owner', 'own an agency', 'run an agency', 'run a content agency', 'my agency', 'content agency', 'creative agency', 'video agency', 'marketing agency', 'social media agency', 'production house', 'my studio', 'studio owner', 'retainer', 'retainers'], focus: 'Business', apps: { agency: 3, finance: 2, profile: 2, reviews: 1, army: 1 }, why: { agency: 'you run a content agency or studio, and its Team tab brings in your creators, editors and clients' } },
  { key: 'agency_team', label: 'Agency team member', icon: 'Users', kind: 'role', blurb: "I work in an agency's team", because: "you work in an agency's team", words: ['agency team', 'agency team member', 'agency job', 'i work at an agency', 'i work in an agency', 'i work for an agency', 'work at an agency', 'work in an agency', 'work for an agency', 'at a content agency', 'in a content agency', 'for a content agency', 'at a creative agency', 'at a video agency', 'at a marketing agency', 'at a social media agency', 'at a production house', 'join an agency'], focus: 'Work', dayType: 'deep_work', apps: { agency: 3, army: 1, work: 1, school: 1 }, why: { agency: "you work in an agency's team, and the owner lets you in from Agency's Team tab" } },
  { key: 'brand_client', label: 'Brand or client', icon: 'Store', kind: 'role', blurb: 'I hire creators for a brand', because: 'you hire creators for a brand', words: ['hire creators', 'hiring creators', 'hire influencers', 'hiring influencers', 'hire a creator', 'hire an editor', 'hire editors', 'hire an agency', 'hired an agency', 'brand manager', 'brand team', 'marketing team', 'marketing manager', 'influencer marketing', 'creator campaigns', 'influencer campaigns', 'run campaigns', 'our brand', "i'm the client", 'i am the client', 'on the brand side'], focus: 'Business', apps: { army: 3, agency: 2, work: 1, finance: 1 }, why: { army: 'you hire creators, and Army is where a brand runs its campaigns with them', agency: 'you hire creators, and Agency is where they share your pieces and paperwork with you' } },
  { key: 'explorer', label: 'Explorer', icon: 'Compass', kind: 'role', blurb: "I'm between things", because: 'you are working out what is next', words: ['between jobs', 'unemployed', 'jobless', 'gap year', 'figuring out', 'figuring it out', 'career change', 'quit my job', 'looking for a job', 'looking for work', 'fresh start', 'what is next'], focus: 'Other', apps: { work: 3, school: 2, knowledge: 1, journal: 1 } },
  { key: 'coach', label: 'Life coach', icon: 'Target', kind: 'role', blurb: "I'm a life coach", because: 'you coach people', words: ["i'm a life coach", 'i am a life coach', 'im a life coach', "i'm a coach", 'i am a coach', 'im a coach', 'work as a coach', 'work as a life coach', 'certified coach', 'certified life coach', 'i coach people', 'coach for a living'], focus: 'Work', apps: { coaching: 3, shop: 2, profile: 1 } },
  { key: 'run_host', label: 'Run club host', icon: 'Flag', kind: 'role', blurb: 'I host runs or a run club', because: 'you host runs', words: ['run club host', 'host runs', 'host a run', 'hosting runs', 'host a run club', 'run a run club', 'my run club', 'run club organiser', 'run club organizer', 'run leader', 'lead runs', 'pacer'], interest: 'Running', focus: 'Other', dayType: 'friends', apps: { run: 3, party: 2, community: 1, profile: 1 } },
  { key: 'parent', label: 'Parent or carer', icon: 'HandHeart', kind: 'role', blurb: 'I look after family', because: 'you look after family', words: ['parent', 'mom', 'mum', 'mother', 'dad', 'father', 'my kids', 'my son', 'my daughter', 'children', 'my baby', 'carer', 'caregiver', 'looking after'], focus: 'Family', interest: 'Parenting', dayType: 'family', apps: { sleep: 2, stress: 2, journal: 1, mood: 1, finance: 1 } },
  // What a creator makes.
  { key: 'short_video', label: 'Short-form creator', icon: 'Smartphone', kind: 'craft', blurb: 'Reels and Shorts', because: 'you make short videos', words: ['reels', 'reel', 'shorts', 'tiktok', 'tiktoks', 'short videos', 'short form', 'short-form'], interest: 'Video', apps: { win: 2, army: 1, content: 1, automations: 1 } },
  { key: 'long_video', label: 'Video creator', icon: 'Video', kind: 'craft', blurb: 'YouTube videos', because: 'you make long videos', words: ['youtube', 'youtuber', 'long videos', 'long form', 'long-form', 'vlog', 'vlogs', 'documentary', 'documentaries'], interest: 'Video', apps: { content: 2, win: 1, army: 1, tools: 1, tv: 1 } },
  { key: 'photo', label: 'Photographer', icon: 'Camera', kind: 'craft', blurb: 'Photos', because: 'you take photos', words: ['photo', 'photos', 'photography', 'photographer', 'carousels'], skill: 'Photography', interest: 'Photography', apps: { work: 2, store: 1, shop: 1 } },
  { key: 'podcast', label: 'Podcaster', icon: 'MicSignal', kind: 'craft', blurb: 'Podcasts', because: 'you make a podcast', words: ['podcast', 'podcasts', 'podcaster', 'talk show'], skill: 'Interviewing', interest: 'Podcasting', apps: { tv: 2, content: 1, tools: 1 } },
  { key: 'writing', label: 'Writer', icon: 'PenLine', kind: 'craft', blurb: 'Writing', because: 'you write', words: ['writer', 'writing', 'blog', 'blogger', 'newsletter', 'threads', 'articles', 'substack'], skill: 'Writing', interest: 'Writing', apps: { content: 2, knowledge: 1 } },
  { key: 'music', label: 'Musician', icon: 'EighthNotes', kind: 'craft', blurb: 'Music', because: 'you make music', words: ['music', 'musician', 'singer', 'rapper', 'music producer', 'beats', 'songs', 'covers', 'my band'], interest: 'Music making', apps: { party: 2, shop: 1 } },
  { key: 'stream', label: 'Streamer', icon: 'Cast', kind: 'craft', blurb: 'Live streams', because: 'you stream', words: ['stream', 'streams', 'streaming', 'streamer', 'twitch', 'live stream', 'go live'], skill: 'Live streaming', interest: 'Gaming', apps: { audience: 2, community: 1, tools: 1 } },
  { key: 'teach', label: 'Educator', icon: 'Presentation', kind: 'craft', blurb: 'Courses or lessons', because: 'you teach', words: ['teach', 'teacher', 'teaching', 'tutor', 'tutoring', 'coaching', 'online course', 'courses', 'lessons', 'workshops'], skill: 'Teaching', interest: 'Education', apps: { shop: 2, audience: 1, school: 1 } },
  // What a freelancer does for others.
  { key: 'editor', label: 'Video editor', icon: 'Scissors', kind: 'service', blurb: 'Editing', because: 'you edit', words: ['edit', 'edits', 'editing', 'editor', 'video editor', 'premiere', 'premiere pro', 'davinci', 'resolve', 'capcut', 'final cut', 'after effects'], skill: 'Editing', interest: 'Video', dayType: 'deep_work', apps: { work: 2, school: 2, agency: 2, army: 2, tools: 1 } },
  { key: 'shooter', label: 'Videographer', icon: 'Aperture', kind: 'service', blurb: 'Shooting', because: 'you shoot', words: ['videographer', 'shoot', 'shooting', 'cinematographer', 'camera operator', 'dop', 'filming', 'filmmaker'], skill: 'Videography', interest: 'Film making', dayType: 'create', apps: { work: 2, agency: 2, army: 2, school: 1, store: 1 } },
  { key: 'designer', label: 'Designer', icon: 'Palette', kind: 'service', blurb: 'Design', because: 'you design', words: ['design', 'designer', 'graphic', 'graphics', 'thumbnail', 'thumbnails', 'figma', 'canva', 'illustrator', 'photoshop'], skill: 'Design', interest: 'Art & design', dayType: 'deep_work', apps: { work: 2, tools: 1 } },
  { key: 'copywriter', label: 'Copywriter', icon: 'Type', kind: 'service', blurb: 'Scripts and copy', because: 'you write for others', words: ['copywriter', 'copywriting', 'scripts', 'scriptwriter', 'script writer', 'ghostwriter', 'ghostwriting'], skill: 'Writing', dayType: 'deep_work', apps: { work: 2, content: 1 } },
  { key: 'sound', label: 'Sound person', icon: 'Headphones', kind: 'service', blurb: 'Sound', because: 'you do sound', words: ['mixing', 'mastering', 'sound design', 'audio engineer', 'sound engineer'], skill: 'Sound', apps: { work: 2, store: 1 } },
  { key: 'host', label: 'Host', icon: 'MicVocal', kind: 'service', blurb: 'On camera or on stage', because: 'you are on camera', words: ['host', 'hosting', 'anchor', 'presenter', 'on camera', 'actor', 'acting', 'modelling', 'modeling', 'emcee'], skill: 'On camera', apps: { army: 2, work: 1 } },
  { key: 'social', label: 'Social media manager', icon: 'Share2', kind: 'service', blurb: 'Social pages', because: 'you run pages for brands', words: ['social media manager', 'smm', 'managing pages', 'manage pages', 'community manager'], skill: 'Community', apps: { content: 2, automations: 2, audience: 1, work: 1 } },
  // Where you are with it. One at a time.
  { key: 'starting', label: 'Just starting', icon: 'Sprout', kind: 'stage', blurb: 'Not much out there yet', because: 'you are just starting', words: ['just started', 'just starting', 'starting out', 'beginner', 'new to this', 'zero followers', 'no followers'], level: 'Just starting', apps: { school: 2, knowledge: 1, tools: 1, win: 1 } },
  { key: 'growing', label: 'Growing', icon: 'TrendingUp', kind: 'stage', blurb: 'Posting, not earning yet', because: 'you post but do not earn yet', words: ['growing', 'consistent', 'posting daily', 'post daily', 'not earning', 'no income yet'], level: 'Early', apps: { content: 1, audience: 1, win: 2, army: 1 } },
  { key: 'earning', label: 'Earning', icon: 'Coins', kind: 'stage', blurb: 'Money comes in', because: 'your work already earns', words: ['brand deals', 'brand deal', 'sponsorships', 'sponsored', 'monetized', 'monetised', 'paid collabs', 'already earning'], level: 'Working', apps: { finance: 2, shop: 1, audience: 1, army: 1 } },
  { key: 'full_time', label: 'Full time', icon: 'Trophy', kind: 'stage', blurb: 'It is my living', because: 'this is your living', words: ['full time creator', 'full-time creator', 'creator full time', 'my living', 'main income'], level: 'Established', apps: { finance: 3, shop: 2, audience: 2, automations: 1, club: 1 } },
  // The rest of life: from your own words, or the extra pills on the first card.
  { key: 'runner', label: 'Runner', icon: 'Footprints', kind: 'life', blurb: 'I run', because: 'you run', words: ['runner', 'running', 'marathon', 'half marathon', '5k', '10k', 'jogging'], interest: 'Running', apps: { run: 3, life: 1 } },
  { key: 'gym', label: 'Gym regular', icon: 'Dumbbell', kind: 'life', blurb: 'I train', because: 'you train', words: ['gym', 'lifting', 'weights', 'workouts', 'bodybuilding', 'crossfit'], interest: 'Gym', apps: { life: 2, wellbeing: 1, sleep: 1 } },
  { key: 'yogi', label: 'Yoga and breath', icon: 'Flower2', kind: 'life', blurb: 'I do yoga or meditate', because: 'you do yoga or meditate', words: ['yoga', 'meditate', 'meditation', 'breathwork', 'pranayama'], interest: 'Yoga', apps: { mindful: 3, wellbeing: 1 } },
  // A reader leans to the books on Home, the short reads in Knowledge and School's courses.
  { key: 'reader', label: 'Reader', icon: 'BookOpen', kind: 'life', blurb: 'I read a lot', because: 'you read', words: ['reader', 'reading', 'books', 'bookworm'], interest: 'Books', dayType: 'learning', apps: { knowledge: 2, school: 2, journal: 1 } },
  { key: 'gamer', label: 'Gamer', icon: 'Gamepad2', kind: 'life', blurb: 'I play games', because: 'you play games', words: ['gamer', 'gaming', 'video games', 'playstation', 'xbox', 'esports', 'bgmi', 'valorant'], interest: 'Gaming', apps: { community: 2, circles: 1 } },
  { key: 'traveller', label: 'Traveller', icon: 'Plane', kind: 'life', blurb: 'I travel when I can', because: 'you travel', words: ['travel', 'traveller', 'traveler', 'travelling', 'traveling', 'backpacking'], interest: 'Travel', apps: { party: 1, finance: 1 } },
  { key: 'night_owl', label: 'Night owl', icon: 'MoonStar', kind: 'life', blurb: 'I come alive late', because: 'you are up late', words: ['night owl', 'up late', 'sleep late', 'late nights', 'nocturnal', 'stay up late'], apps: { sleep: 2 } },
  { key: 'spiritual', label: 'Spiritual', icon: 'Sparkle', kind: 'life', blurb: 'Faith or practice matters to me', because: 'faith or practice matters to you', words: ['spiritual', 'spirituality', 'my faith', 'god', 'temple', 'church', 'mosque', 'prayer', 'pray', 'bhakti'], interest: 'Spirituality', apps: { mindful: 2, journal: 1 } },
  { key: 'volunteer', label: 'Volunteer', icon: 'HandHelping', kind: 'life', blurb: 'I give my time', because: 'you give your time', words: ['volunteer', 'volunteering', 'ngo', 'charity', 'social work'], interest: 'Volunteering', apps: { community: 2, party: 1 } },
];

export const IDENTITY_BY_KEY: Record<string, IdentityOption> = byKey(IDENTITIES.map((i) => [i.key, i]));

/** The known tags of one kind, in order: the roles on the first card, a creator's crafts, a freelancer's services, the stages, the rest of life. */
export function identitiesOf(kind: IdentityKind): IdentityOption[] {
  return IDENTITIES.filter((i) => i.kind === kind);
}

/** A tag as people read it: a known tag's label, or your own words as you wrote them. */
export function identityLabel(key: string): string {
  return IDENTITY_BY_KEY[key]?.label ?? key;
}

/** The kind of day a person's tags imply, or null: the most specific tag that has one wins (what you do for clients, then what you make, then who you are, then the rest of life). */
export function dayTypeFor(identities: readonly string[]): DayTypeKey | null {
  const tags = identities.map((k) => IDENTITY_BY_KEY[k]).filter((o): o is IdentityOption => Boolean(o?.dayType));
  for (const kind of ['service', 'craft', 'role', 'life'] as const) {
    const t = tags.find((o) => o.kind === kind);
    if (t) return t.dayType!;
  }
  return null;
}

export interface SetupGoal {
  key: string;
  label: string;
  icon: IconName;
  /** What it opens, said on its card. */
  blurb: string;
  because: string;
  /** How the summary says it, after "here to": "find paid work". */
  to: string;
  words: readonly string[];
  /** The profile goal it fills, when one fits. */
  profileGoal?: (typeof GOALS)[number];
  apps: Readonly<Record<string, number>>;
}

export const SETUP_GOALS: readonly SetupGoal[] = [
  { key: 'earn', label: 'Earn from my content', icon: 'BadgeDollarSign', blurb: 'Win pays per verified view. Army runs paid brand campaigns.', because: 'you want to earn from what you make', to: 'earn from what you make', words: ['earn', 'make money', 'monetize', 'monetise', 'get paid', 'side income', 'side hustle', 'extra income'], profileGoal: 'Find paid work', apps: { win: 3, army: 3, work: 1, finance: 1 } },
  { key: 'work', label: 'Find paid work', icon: 'BriefcaseBusiness', blurb: 'Gigs and jobs from brands and the team, in Work.', because: 'you want paid work', to: 'find paid work', words: ['find work', 'paid work', 'gigs', 'more clients', 'get hired', 'find a job', 'need a job', 'get a job', 'new job', 'internship', 'opportunities'], profileGoal: 'Find paid work', apps: { work: 3, army: 1, profile: 2, club: 1 } },
  { key: 'learn', label: 'Learn a new skill', icon: 'GraduationCap', blurb: 'Programs with lessons and a mentor, in School.', because: 'you want to learn', to: 'learn a skill', words: ['learn', 'learning', 'a skill', 'new skill', 'skills', 'upskill', 'get better at', 'improve my'], profileGoal: 'Learn skills', apps: { school: 3, knowledge: 2, tools: 1 } },
  { key: 'grow', label: 'Grow my audience', icon: 'Megaphone', blurb: 'What worked, who follows, and replies that sell.', because: 'you want to grow an audience', to: 'grow an audience', words: ['grow', 'growth', 'more followers', 'followers', 'audience', 'reach', 'views', 'subscribers', 'go viral', 'viral', 'engagement'], apps: { content: 3, audience: 2, automations: 2, profile: 1, community: 1 } },
  { key: 'sell', label: 'Sell what I make', icon: 'ShoppingBag', blurb: 'Courses, downloads, sessions and memberships, in Shop.', because: 'you want to sell', to: 'sell what you make', words: ['sell', 'selling', 'products', 'merch', 'my course', 'digital products', 'presets', 'ebook', 'my services'], profileGoal: 'Sell what I make', apps: { shop: 3, profile: 2, finance: 1, audience: 1, automations: 1 } },
  { key: 'money', label: 'Sort out my money', icon: 'Wallet', blurb: 'Money in and out, dues, budgets and goals, in Finance.', because: 'you want your money sorted', to: 'sort out your money', words: ['save money', 'saving', 'savings', 'budget', 'budgeting', 'debt', 'loan', 'expenses', 'spending', 'my money', 'finances', 'taxes'], apps: { finance: 3, reviews: 1 } },
  { key: 'people', label: 'Meet new people', icon: 'UsersRound', blurb: 'Small tables near you, a feed, events and friends.', because: 'you want to meet people', to: 'meet people', words: ['meet people', 'friends', 'make friends', 'network', 'networking', 'community', 'people like me', 'collab', 'collabs', 'collaborate', 'new to the city', 'new in town', 'just moved'], profileGoal: 'Collaborate', apps: { circles: 3, community: 2, bond: 2, party: 2, club: 1 } },
  { key: 'health', label: 'Feel better day to day', icon: 'HeartPulse', blurb: 'Mood, sleep, stress and calm, on one score.', because: 'you want to feel better day to day', to: 'feel better day to day', words: ['feel better', 'mood', 'mental health', 'calm', 'peace', 'health', 'healthy', 'happier', 'sleep better'], profileGoal: 'Get healthier habits', apps: { wellbeing: 3, mood: 2, sleep: 2, stress: 2, mindful: 2, life: 1 } },
  { key: 'move', label: 'Move more', icon: 'Footprints', blurb: 'Run clubs, movement minutes and a body score.', because: 'you want to move more', to: 'move more', words: ['fitness', 'get fit', 'lose weight', 'weight loss', 'exercise', 'run more', 'move more', 'workout', 'be active'], profileGoal: 'Get healthier habits', apps: { run: 3, life: 2, wellbeing: 1 } },
  { key: 'life', label: 'Work on myself', icon: 'Landmark', blurb: 'The deeper path: your seven relationships, a routine and a plan.', because: 'you want to work on yourself', to: 'work on yourself', words: ['my life', 'life together', 'purpose', 'discipline', 'self improvement', 'self-improvement', 'better person', 'habits', 'routine', 'relationships', 'grow as a person'], apps: { journal: 2, reviews: 2, life: 2, mindful: 1, discover: 2 } },
  { key: 'clients', label: 'Manage my clients and invoices', icon: 'FolderKanban', blurb: 'Clients, deliverables, time, invoices and approvals, in Agency.', because: 'you want your client work in one place', to: 'manage your clients and invoices', words: ['manage clients', 'manage my clients', 'client management', 'invoice', 'invoices', 'invoicing', 'send invoices', 'bill clients', 'client approvals', 'client portal'], apps: { agency: 3, finance: 2, shop: 1 } },
  { key: 'plan', label: 'Plan my week and stay on track', icon: 'CalendarRange', blurb: 'Plan my week on Daily is always on. Reviews adds a calendar and reminders for looking back.', because: 'you want to plan your week and stay on track', to: 'plan your week and stay on track', words: ['plan my week', 'plan my day', 'plan my time', 'stay on track', 'stay organized', 'stay organised', 'time management', 'manage my time', 'be more productive', 'to-do list', 'to do list'], apps: { reviews: 3, mindful: 1, journal: 1, life: 1 } },
  { key: 'find_coach', label: 'Work with a life coach', icon: 'Target', blurb: 'A coach the team checked sees what you share and helps you keep going.', because: 'you want a coach in your corner', to: 'work with a life coach', words: ['need a life coach', 'want a life coach', 'find a life coach', 'get a life coach', 'need a coach', 'want a coach', 'find a coach', 'get a coach', 'my coach', 'accountability', 'keep me accountable', 'hold me accountable'], apps: { coaching: 3, life: 1, reviews: 1 } },
];

export const SETUP_GOAL_BY_KEY: Record<string, SetupGoal> = byKey(SETUP_GOALS.map((g) => [g.key, g]));
/** Three goals at most: a setup that wants everything matches nothing. */
export const MAX_SETUP_GOALS = 3;

export interface SetupBlocker {
  key: string;
  label: string;
  icon: IconName;
  because: string;
  words: readonly string[];
  apps: Readonly<Record<string, number>>;
  /** With this ticked, at most this many apps come on: less to look at, not more. Time short: three; focus hard: four. */
  cap?: number;
}

export const SETUP_BLOCKERS: readonly SetupBlocker[] = [
  { key: 'time', label: 'Not enough time', icon: 'Hourglass', because: 'time is short', words: ['no time', 'not enough time', 'busy', 'too busy', 'short on time'], cap: 3, apps: {} },
  { key: 'focus', label: 'Hard to focus (ADHD counts)', icon: 'Tornado', because: 'focus is hard', words: ['adhd', 'distracted', 'procrastinate', 'procrastinating', 'procrastination', "can't focus", 'cant focus', 'hard to focus', 'overthinking'], cap: 4, apps: { mindful: 1 } },
  { key: 'energy', label: 'Low energy or feeling lazy', icon: 'BatteryLow', because: 'energy runs low', words: ['lazy', 'laziness', 'tired', 'no energy', 'low energy', 'unmotivated', 'no motivation', 'burnt out', 'burned out', 'burnout', 'exhausted'], apps: { sleep: 2, mood: 1, wellbeing: 1 } },
  { key: 'start', label: 'Not sure where to start', icon: 'Signpost', because: 'you are not sure where to start', words: ['where to start', 'how to start', "don't know how", 'dont know how', 'confused', 'feel lost', "i'm lost", 'no idea'], apps: { school: 2, knowledge: 2 } },
  { key: 'alone', label: 'Doing it alone', icon: 'UserRound', because: 'you are doing it alone', words: ['alone', 'lonely', 'loneliness', 'no friends', 'by myself', 'isolated', 'on my own'], apps: { circles: 2, community: 2, bond: 1, party: 1 } },
  { key: 'cash', label: 'Money is tight', icon: 'WalletMinimal', because: 'money is tight', words: ['broke', 'no money', 'money is tight', 'tight on money', "can't afford", 'cant afford', 'in debt'], apps: { finance: 2, win: 1, work: 1 } },
  { key: 'stress', label: 'Stress or worry', icon: 'WavesHorizontal', because: 'stress gets in', words: ['stress', 'stressed', 'anxious', 'anxiety', 'worry', 'worried', 'overwhelmed', 'pressure'], apps: { stress: 2, journal: 2, mindful: 1 } },
  { key: 'sleep', label: 'Bad sleep', icon: 'Moon', because: 'sleep is off', words: ['bad sleep', 'insomnia', "can't sleep", 'cant sleep', 'sleep badly', 'no sleep', 'sleep at 4', 'sleep at 3'], apps: { sleep: 3 } },
];

export const SETUP_BLOCKER_BY_KEY: Record<string, SetupBlocker> = byKey(SETUP_BLOCKERS.map((b) => [b.key, b]));

/** Two answers that mean more together than apart. Each pair adds its own weight and gives its own reason. */
export interface SetupCombo {
  when: readonly [string, string];
  apps: Readonly<Record<string, number>>;
  /** After "because": names both halves. */
  because: string;
}

/** Most specific first: when two pairs back the same app equally, the first one gives the reason. */
export const SETUP_COMBOS: readonly SetupCombo[] = [
  { when: ['editor', 'learn'], apps: { school: 3 }, because: 'you edit and want to get better at it' },
  { when: ['editor', 'work'], apps: { work: 1, army: 1, agency: 1 }, because: 'brands and agencies need editors for their campaigns' },
  { when: ['shooter', 'learn'], apps: { school: 2 }, because: 'you shoot and want to get better at it' },
  { when: ['agency_team', 'clients'], apps: { agency: 3 }, because: "you work on an agency's clients, and its Team tab is where the owner lets you in" },
  { when: ['agency_team', 'learn'], apps: { school: 2 }, because: "you work in an agency's team and want to get better at the craft" },
  { when: ['agency_team', 'work'], apps: { work: 2, army: 1 }, because: "you work in an agency's team and want paid work on the side" },
  { when: ['agency_team', 'earn'], apps: { army: 2, win: 1 }, because: "you work in an agency's team and want your own work to pay too" },
  { when: ['brand_client', 'clients'], apps: { agency: 3 }, because: 'you hire creators and want their pieces and approvals in one place' },
  { when: ['brand_client', 'grow'], apps: { army: 2, content: 1 }, because: 'you hire creators and want more people to see your brand' },
  { when: ['brand_client', 'sell'], apps: { army: 2, shop: 1 }, because: 'you hire creators and want them to help you sell' },
  { when: ['brand_client', 'money'], apps: { finance: 2, reviews: 1 }, because: 'you pay creators and want that money in one place' },
  { when: ['brand_client', 'work'], apps: { work: 2 }, because: 'you hire creators, and Work is where you post the gig' },
  { when: ['run_host', 'people'], apps: { run: 2, party: 1 }, because: 'you host runs and want more people to join' },
  { when: ['run_host', 'move'], apps: { run: 2, life: 1 }, because: 'you host runs and want to move more yourself' },
  { when: ['run_host', 'grow'], apps: { run: 1, community: 1, profile: 1 }, because: 'you host runs and want more runners to find your club' },
  { when: ['reader', 'learn'], apps: { school: 2, knowledge: 1 }, because: 'you read and want to turn it into a skill' },
  { when: ['short_video', 'earn'], apps: { win: 2 }, because: 'you make short videos and want them to pay' },
  { when: ['long_video', 'grow'], apps: { content: 2 }, because: 'you make long videos and want more people to watch' },
  { when: ['teach', 'sell'], apps: { shop: 2 }, because: 'you teach and want to sell your lessons' },
  { when: ['coach', 'sell'], apps: { shop: 2 }, because: 'you coach and want to sell your sessions' },
  { when: ['coach', 'grow'], apps: { profile: 1, audience: 1 }, because: 'you coach and want more people to find you' },
  { when: ['social', 'grow'], apps: { content: 1, automations: 1 }, because: 'you run pages and want them to grow' },
  { when: ['shooter', 'work'], apps: { work: 1, store: 1 }, because: 'you shoot for clients, and the right gear wins jobs' },
  { when: ['starting', 'learn'], apps: { school: 2, tools: 1 }, because: 'you are just starting and want to learn the craft' },
  { when: ['starting', 'earn'], apps: { win: 2 }, because: 'you are new and want your first pay' },
  { when: ['earning', 'money'], apps: { finance: 2 }, because: 'creator money comes in bits, so it helps to see it in one place' },
  { when: ['full_time', 'sell'], apps: { automations: 2, shop: 1 }, because: 'this is your living, so selling should run while you sleep' },
  { when: ['runner', 'people'], apps: { run: 2 }, because: 'you run and want company' },
  { when: ['night_owl', 'health'], apps: { sleep: 2 }, because: 'you are up late and want to feel better' },
  { when: ['student', 'earn'], apps: { work: 2, win: 2 }, because: 'you study and want to earn on the side' },
  { when: ['student', 'work'], apps: { work: 2 }, because: 'you study and want paid work that fits around classes' },
  { when: ['student', 'learn'], apps: { school: 2 }, because: 'you study and want a skill that pays' },
  { when: ['explorer', 'work'], apps: { work: 2, school: 1 }, because: 'you are between things and want paid work' },
  { when: ['explorer', 'learn'], apps: { school: 2, knowledge: 1 }, because: 'a new skill is a good next step' },
  { when: ['employee', 'earn'], apps: { win: 2, work: 1 }, because: 'you have a job and want to earn on the side' },
  { when: ['employee', 'money'], apps: { finance: 1, reviews: 1 }, because: 'a salary goes further with a plan' },
  { when: ['creator', 'earn'], apps: { win: 2, army: 2 }, because: 'you make content and want it to pay' },
  { when: ['freelancer', 'earn'], apps: { agency: 2 }, because: 'you make content for clients and want to be paid on time' },
  { when: ['creator', 'grow'], apps: { content: 2, audience: 1 }, because: 'you make content and want more people to see it' },
  { when: ['creator', 'sell'], apps: { shop: 2, automations: 1 }, because: 'you make content and want to sell to the people who watch' },
  { when: ['creator', 'people'], apps: { community: 1, circles: 1, party: 1 }, because: 'creators grow faster with other creators around' },
  { when: ['freelancer', 'work'], apps: { work: 2, profile: 1 }, because: 'your page is your portfolio for the gigs you apply to' },
  { when: ['freelancer', 'money'], apps: { finance: 2 }, because: 'client money comes in bits, so it helps to see it in one place' },
  { when: ['freelancer', 'grow'], apps: { profile: 1, content: 1 }, because: 'you work for clients and want more of them to find you' },
  { when: ['agency_owner', 'earn'], apps: { agency: 2, finance: 1 }, because: 'you run an agency, and invoices, approvals and the people on its Team tab decide how fast it earns' },
  { when: ['agency_owner', 'work'], apps: { work: 2, army: 1 }, because: 'you run an agency and want briefs and gigs coming in' },
  { when: ['agency_owner', 'money'], apps: { finance: 2, reviews: 1 }, because: 'an agency needs its money and its numbers in one place' },
  { when: ['agency_owner', 'clients'], apps: { agency: 3 }, because: 'you run an agency and want all your client work in one place, with your team on its Team tab' },
  { when: ['agency_owner', 'grow'], apps: { content: 1, audience: 1 }, because: 'you run an agency and want more people to find it' },
  { when: ['agency_owner', 'plan'], apps: { reviews: 2 }, because: 'you run an agency and can track its numbers in each review' },
  { when: ['freelancer', 'clients'], apps: { agency: 3, finance: 1 }, because: 'you work for clients and want their work, time and invoices in one place' },
  { when: ['creator', 'clients'], apps: { agency: 2, finance: 1 }, because: 'you make content for brands and want their work and invoices in one place' },
  { when: ['social', 'clients'], apps: { agency: 2 }, because: 'you run pages for brands and want their posts and approvals in one place' },
  { when: ['editor', 'clients'], apps: { agency: 2 }, because: 'you edit for clients and want their pieces and approvals in one place' },
  { when: ['founder', 'plan'], apps: { reviews: 2 }, because: 'you run a business and can track its numbers in each review' },
  { when: ['plan', 'focus'], apps: { mindful: 2, reviews: 1 }, because: 'you want to stay on track and focus is hard, so short focus sessions help' },
  { when: ['founder', 'sell'], apps: { shop: 2, automations: 1 }, because: 'you run a business and want to sell more' },
  { when: ['founder', 'grow'], apps: { audience: 2, content: 1 }, because: 'you run a business and want more people to know it' },
  { when: ['founder', 'money'], apps: { finance: 2, reviews: 1 }, because: 'a business needs its money in one place' },
  { when: ['parent', 'health'], apps: { sleep: 1, stress: 1 }, because: 'looking after others starts with your own sleep and stress' },
  { when: ['parent', 'money'], apps: { finance: 1 }, because: 'a family budget is easier in one place' },
  { when: ['move', 'people'], apps: { run: 2 }, because: 'run clubs are moving and meeting in one' },
  { when: ['people', 'alone'], apps: { circles: 2, bond: 1 }, because: 'you do it alone and want people around' },
  { when: ['health', 'stress'], apps: { stress: 2, mindful: 1 }, because: 'you want to feel better and stress gets in' },
  { when: ['health', 'sleep'], apps: { sleep: 2 }, because: 'better days start with better nights' },
  { when: ['health', 'energy'], apps: { sleep: 1, mood: 1 }, because: 'low energy shows up in sleep and mood first' },
  { when: ['learn', 'start'], apps: { school: 2, knowledge: 1 }, because: 'a program gives you a first step' },
  { when: ['life', 'focus'], apps: { reviews: 1 }, because: 'a short look back each week keeps you on track' },
  { when: ['life', 'energy'], apps: { journal: 1 }, because: 'writing it down shows what drains you' },
  { when: ['money', 'cash'], apps: { finance: 2 }, because: 'money is tight and you want it sorted' },
  { when: ['earn', 'cash'], apps: { win: 1, work: 1 }, because: 'money is tight and you want to earn' },
];

export interface SetupAnswers {
  /** Known tag keys, and labels in your own words. */
  identities: string[];
  goals: string[];
  blockers: string[];
}

/** What the setup chat heard, kept with the account so a second run starts from it. */
export interface Intake {
  goals: string[];
  blockers: string[];
  /** When the setup was last saved. */
  at: string | null;
}

export interface AppPick {
  key: string;
  score: number;
  /** One sentence, built from your answers. */
  why: string;
}

export interface SetupMatch {
  /** Switched on, best fit first. */
  apps: AppPick[];
  /** A good fit too, left off to keep things light. */
  more: AppPick[];
  /** Who you are and what you came for, in one sentence. */
  line: string;
  /** What the setup writes into the profile. */
  profile: { focus: string; skills: string[]; interests: string[]; level: string; availability: string; goals: string[] };
  /** The strategy session: offer it now, soon, or leave it in Pillars for later. */
  session: 'now' | 'soon' | 'later';
  /** The most apps that could come on, from what gets in the way. */
  cap: number;
}

export const MAX_IDENTITIES = 12;
/** Tags in your own words, on top of the known ones. */
export const MAX_CUSTOM_IDENTITIES = 3;
export const IDENTITY_LABEL_MAX = 30;
export const SETUP_APPS_MIN = 3;
export const SETUP_APPS_MAX = 5;
/** The score an app needs to come on by itself. A goal counts double, so one goal and one tag are enough. */
export const SETUP_PASS = 4;

/** The apps the setup switches: every app a person can turn on or off, apart from the essentials and the team's tools. */
export function setupSwitchable(m: AppModule): boolean {
  return !m.locked && (m.group === 'earn' || m.group === 'creator' || m.group === 'community' || m.group === 'wellbeing');
}

const lowerFirst = (label: string) => (/^\S[^\sA-Z]*(\s|$)/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label);
const listed = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const STAGE_SAID: Record<string, string> = { starting: 'just starting', growing: 'growing', earning: 'already earning', full_time: 'doing it full time' };

/** Who you are and what you came for, in one sentence: "A student and freelance video editor, here to learn a skill and find paid work." */
export function identityLine(a: SetupAnswers): string {
  const has = (k: string) => a.identities.includes(k);
  const anyOf = (kind: IdentityKind) => a.identities.some((k) => IDENTITY_BY_KEY[k]?.kind === kind);
  const nouns = a.identities
    .filter((k) => {
      const o = IDENTITY_BY_KEY[k];
      if (!o) return true;
      if (o.kind === 'stage') return false;
      // A craft says more than "creator", and "freelance video editor" more than "freelancer".
      if (k === 'creator' && anyOf('craft')) return false;
      if (k === 'freelancer' && anyOf('service')) return false;
      // "An agency video editor" says what "an agency team member and video editor" does.
      if (k === 'agency_team' && anyOf('service') && !has('freelancer')) return false;
      return true;
    })
    .map((k) => {
      const o = IDENTITY_BY_KEY[k];
      const label = lowerFirst(o?.label ?? k);
      if (o?.kind !== 'service') return label;
      return has('freelancer') ? `freelance ${label}` : has('agency_team') ? `agency ${label}` : label;
    });
  const stage = a.identities.map((k) => STAGE_SAID[k]).find(Boolean);
  const goals = a.goals.map((g) => SETUP_GOAL_BY_KEY[g]?.to).filter((x): x is string => Boolean(x));
  const who = nouns.length ? `${/^[aeiou]/i.test(nouns[0]!) ? 'An' : 'A'} ${listed(nouns)}` : '';
  const parts = [who, stage ?? '', goals.length ? `here to ${listed(goals)}` : ''].filter(Boolean);
  if (parts.length === 0) return '';
  const s = parts.join(', ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

/**
 * The one matching rule. Every tag, goal and thing in the way weighs the apps (a goal counts double), every pair
 * in SETUP_COMBOS that is all there adds its own weight, and the apps that clear SETUP_PASS come on, best first,
 * no more than the cap (fewer when time or focus is short). Each app says why: the pair behind it when there is
 * one, else the two answers that weigh most. The same answers always give the same result, and a different mix
 * gives its own.
 */
export function matchSetup(a: SetupAnswers, available?: readonly string[]): SetupMatch {
  const order = new Map(MODULES.map((m, i) => [m.key, i]));
  const open = new Set(MODULES.filter((m) => setupSwitchable(m) && (!available || available.includes(m.key))).map((m) => m.key));
  const score = new Map<string, number>();
  const sources = new Map<string, { because: string; w: number; pair: boolean }[]>();
  const add = (app: string, w: number, because: string, pair = false) => {
    if (!open.has(app) || w <= 0) return;
    score.set(app, (score.get(app) ?? 0) + w);
    sources.set(app, [...(sources.get(app) ?? []), { because, w, pair }]);
  };
  const tags = a.identities.map((k) => IDENTITY_BY_KEY[k]).filter((o): o is IdentityOption => Boolean(o));
  const goals = a.goals.map((k) => SETUP_GOAL_BY_KEY[k]).filter((g): g is SetupGoal => Boolean(g));
  const blockers = a.blockers.map((k) => SETUP_BLOCKER_BY_KEY[k]).filter((b): b is SetupBlocker => Boolean(b));
  for (const t of tags) for (const [app, w] of Object.entries(t.apps)) if (!t.why?.[app]) add(app, w, t.because);
  for (const g of goals) for (const [app, w] of Object.entries(g.apps)) add(app, w * 2, g.because);
  for (const b of blockers) for (const [app, w] of Object.entries(b.apps)) add(app, w, b.because);
  const keys = new Set([...a.identities, ...a.goals, ...a.blockers]);
  for (const c of SETUP_COMBOS) if (c.when.every((k) => keys.has(k))) for (const [app, w] of Object.entries(c.apps)) add(app, w, c.because, true);
  // A tag's own reason for one app is as telling as a pair, and comes after the pairs so an equal pair still gives the reason.
  for (const t of tags) for (const [app, w] of Object.entries(t.apps)) if (t.why?.[app]) add(app, w, t.why[app]!, true);

  const why = (app: string) => {
    const list = sources.get(app) ?? [];
    const pair = list.filter((s) => s.pair).reduce<{ because: string; w: number } | null>((best, s) => (!best || s.w > best.w ? s : best), null);
    if (pair) return `Because ${pair.because}.`;
    const top = [...new Set([...list].sort((x, y) => y.w - x.w).map((s) => s.because))].slice(0, 2);
    // A reason that already says two things ("..., and its Team tab ...") stands alone rather than joining a third.
    const said = top.some((x) => x.includes(', and ')) ? top.slice(0, 1) : top;
    return said.length ? `Because ${said.join(' and ')}.` : 'A good place to start.';
  };
  const cap = Math.max(SETUP_APPS_MIN, Math.min(SETUP_APPS_MAX, ...blockers.map((b) => b.cap ?? SETUP_APPS_MAX)));
  const rank = (x: string, y: string) => (score.get(y) ?? 0) - (score.get(x) ?? 0) || (order.get(x) ?? 0) - (order.get(y) ?? 0);
  const ranked = [...score.entries()].sort((x, y) => rank(x[0], y[0]));
  // Every answer brings its own app first, so the mix always shows both who you are and what you came for:
  // each goal its main app, each tag its strongest (a fit of 2 or more), each thing in the way its strongest,
  // then each tag its second. The rest fill in by score, up to the cap.
  const tops = (apps: Readonly<Record<string, number>>, min: number, n: number) =>
    Object.entries(apps)
      .filter(([app, w]) => w >= min && open.has(app))
      .sort((x, y) => y[1] - x[1] || rank(x[0], y[0]))
      .slice(0, n)
      .map(([app]) => app);
  const lasting = tags.filter((t) => t.kind !== 'stage');
  const anchors = [
    ...goals.flatMap((g) => tops(g.apps, 1, 1)),
    ...lasting.flatMap((t) => tops(t.apps, 2, 1)),
    ...blockers.flatMap((b) => tops(b.apps, 2, 1)),
    ...tags.filter((t) => t.kind === 'stage').flatMap((t) => tops(t.apps, 2, 1)),
    ...lasting.flatMap((t) => tops(t.apps, 2, 2).slice(1)),
  ];
  const picked: string[] = [];
  for (const k of [...anchors, ...ranked.filter(([, s]) => s >= SETUP_PASS).map(([k]) => k)]) if (picked.length < cap && !picked.includes(k)) picked.push(k);
  // Too little to go on: the next best fits, then the apps most people start with.
  for (const [k] of ranked) if (picked.length < SETUP_APPS_MIN && !picked.includes(k)) picked.push(k);
  for (const k of ['journal', 'life', 'school']) if (picked.length < SETUP_APPS_MIN && open.has(k) && !picked.includes(k)) picked.push(k);
  picked.sort(rank);
  const pick = (k: string): AppPick => ({ key: k, score: score.get(k) ?? 0, why: why(k) });
  const more = ranked.filter(([k, s]) => s >= 2 && !picked.includes(k)).slice(0, 3).map(([k]) => pick(k));

  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))];
  const has = (k: string) => a.identities.includes(k);
  const wants = (k: string) => a.goals.includes(k);
  const availability = (wants('work') || wants('earn')) && ['freelancer', 'explorer', 'student', 'creator', 'agency_team'].some(has) ? 'Open to work' : (wants('people') || wants('grow')) && has('creator') ? 'Open to collabs' : '';
  const signs = ['focus', 'energy', 'stress', 'sleep'];
  const session = wants('life') ? 'now' : (wants('health') || wants('move')) && a.blockers.some((b) => signs.includes(b)) ? 'soon' : 'later';
  return {
    apps: picked.map(pick),
    more,
    line: identityLine(a),
    profile: {
      focus: tags.find((t) => t.focus)?.focus ?? '',
      skills: uniq(tags.map((t) => t.skill)),
      interests: uniq(tags.map((t) => t.interest)),
      level: tags.find((t) => t.level)?.level ?? '',
      availability,
      goals: uniq(goals.map((g) => g.profileGoal)),
    },
    session,
    cap,
  };
}

// Reading your own words: whole words and phrases from each tag's list, nothing guessed past them.
const plain = (s: string) => ` ${s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'+\s-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const CUSTOM_STOP = new Set(['and', 'who', 'but', 'with', 'at', 'in', 'on', 'from', 'for', 'to', 'of', 'that', 'so', 'also', 'or', 'by', 'too', 'as', 'now', 'here', 'there', 'currently', 'trying', 'looking']);
const CUSTOM_PLAIN = new Set(['person', 'guy', 'girl', 'boy', 'man', 'woman', 'human', 'fan', 'lover', 'bit', 'lot', 'member', 'newbie', 'other', 'user', 'kid', 'adult', 'teen', 'teenager', 'citizen', 'resident', 'number', 'computer', 'paper', 'water', 'power', 'poster', 'sticker', 'corner', 'winter', 'summer', 'server', 'center', 'centre', 'after', 'under', 'over', 'never', 'ever', 'rather', 'better', 'bigger', 'later', 'quarter', 'chapter', 'letter', 'matter', 'character', 'monster', 'introvert', 'extrovert', 'student', 'parent', 'agent', 'client', 'talent', 'content', 'moment', 'event', 'percent', 'giant', 'want', 'plant']);
const CUSTOM_ADJ = new Set(['final', 'first', 'second', 'third', 'big', 'small', 'little', 'huge', 'good', 'bad', 'new', 'young', 'old', 'full', 'part', 'proud', 'single', 'busy', 'lazy', 'tired', 'year', 'time', 'aspiring', 'wannabe', 'struggling', 'budding', 'very', 'really', 'total', 'complete', 'real', 'pro', 'professional', 'freelance', 'part-time', 'full-time']);
const CUSTOM_ROLE = /(er|or|ist|ian|ant|ent|eur|ee|smith|maker|wright)$/;
const CUSTOM_ALLOW = new Set(['chef', 'cook', 'nurse', 'poet', 'athlete', 'pilot', 'vet', 'dj', 'barista', 'medic', 'monk', 'artisan', 'architect', 'analyst', 'scientist']);

export interface AboutRead {
  identities: string[];
  /** Tags in your own words, from "I am a ..." when no known tag fits. */
  custom: string[];
  goals: string[];
  blockers: string[];
}

/** Tags, goals and what gets in the way, read from a line you typed. Every one of them is shown back to be ticked or not. */
export function readAbout(text: string): AboutRead {
  const t = plain(text.slice(0, 600));
  const hit = (words: readonly string[]) => words.some((w) => t.includes(plain(w)));
  // A word some tag already knows is never made into a tag of your own.
  const known = new Set([...IDENTITIES.flatMap((i) => i.words), ...SETUP_GOALS.flatMap((g) => g.words), ...SETUP_BLOCKERS.flatMap((b) => b.words)]);
  // The longest phrase wins: a tag whose every phrase sits inside a longer phrase of another tag is not tagged, so "I host a run
  // club" is a run club host and not a host on camera, and "I work at an agency" is an agency team member and not an employee.
  const spans = new Map<string, [number, number][]>();
  for (const i of IDENTITIES) {
    const found: [number, number][] = [];
    for (const w of i.words) {
      const p = plain(w);
      for (let at = t.indexOf(p); at >= 0; at = t.indexOf(p, at + 1)) found.push([at + 1, at + p.length - 1]);
    }
    if (found.length) spans.set(i.key, found);
  }
  // A stage never hides who you are: "a full time creator" is both a creator and full time.
  const covered = (key: string, [a, b]: [number, number]) => [...spans].some(([k, list]) => k !== key && IDENTITY_BY_KEY[k]!.kind !== 'stage' && list.some(([c, d]) => d - c > b - a && c < b && a < d));
  let identities = IDENTITIES.filter((i) => spans.get(i.key)?.some((s) => !covered(i.key, s))).map((i) => i.key);
  // One stage at a time: the furthest along.
  const stages = identities.filter((k) => IDENTITY_BY_KEY[k]!.kind === 'stage');
  if (stages.length > 1) identities = identities.filter((k) => IDENTITY_BY_KEY[k]!.kind !== 'stage' || k === stages.at(-1));
  const custom: string[] = [];
  for (const m of t.matchAll(/ (?:i am|i'm|im|i work as|working as|work as|job as) (?:a|an) ([a-z][a-z'-]*(?: [a-z][a-z'-]*){0,2})/g)) {
    const words: string[] = [];
    for (const w of (m[1] ?? '').split(' ')) {
      if (CUSTOM_STOP.has(w)) break;
      words.push(w);
    }
    // The rightmost word that names what someone does is the tag: "a software engineer", "a dancer too".
    let at = words.length - 1;
    while (at >= 0 && !(CUSTOM_ROLE.test(words[at]!) || CUSTOM_ALLOW.has(words[at]!))) at -= 1;
    const head = words[at];
    if (!head || CUSTOM_PLAIN.has(head) || known.has(head)) continue;
    const before = words[at - 1];
    const phrase = before && !CUSTOM_ADJ.has(before) && !known.has(before) ? `${before} ${head}` : head;
    const label = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    if (custom.length < MAX_CUSTOM_IDENTITIES && !custom.includes(label)) custom.push(label);
  }
  return {
    identities,
    custom,
    goals: SETUP_GOALS.filter((g) => hit(g.words)).map((g) => g.key).slice(0, MAX_SETUP_GOALS),
    blockers: SETUP_BLOCKERS.filter((b) => hit(b.words)).map((b) => b.key),
  };
}

/** A tag as it is kept: a known key, or your own words cleaned up. A label that names a known tag becomes that tag. */
export function cleanIdentity(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (IDENTITY_BY_KEY[raw]) return raw;
  const label = raw.normalize('NFKC').replace(/[^\p{L}\p{N} &'.-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, IDENTITY_LABEL_MAX).trim();
  if (label.replace(/[^\p{L}\p{N}]/gu, '').length < 2) return null;
  const lower = label.toLowerCase();
  const known = IDENTITIES.find((i) => i.label.toLowerCase() === lower || i.words.includes(lower));
  if (known) return known.key;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The one validator for a list of tags: known keys and cleaned labels, no repeats, three of your own at most, one stage. */
export function parseIdentities(raw: unknown): string[] {
  const out: string[] = [];
  let own = 0;
  for (const x of Array.isArray(raw) ? raw : []) {
    const k = cleanIdentity(x);
    if (!k || out.some((o) => o.toLowerCase() === k.toLowerCase())) continue;
    if (!IDENTITY_BY_KEY[k]) {
      if (own >= MAX_CUSTOM_IDENTITIES) continue;
      own += 1;
    }
    out.push(k);
    if (out.length >= MAX_IDENTITIES) break;
  }
  const stages = out.filter((k) => IDENTITY_BY_KEY[k]?.kind === 'stage');
  return stages.length > 1 ? out.filter((k) => IDENTITY_BY_KEY[k]?.kind !== 'stage' || k === stages.at(-1)) : out;
}

/** The setup's answers from a request body: tags through parseIdentities, goals and blockers from their lists only. */
export function parseSetup(raw: unknown): SetupAnswers {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (v: unknown, keys: readonly string[], max: number) => [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && keys.includes(x)))].slice(0, max);
  return {
    identities: parseIdentities(o.identities),
    goals: pick(o.goals, SETUP_GOALS.map((g) => g.key), MAX_SETUP_GOALS),
    blockers: pick(o.blockers, SETUP_BLOCKERS.map((b) => b.key), SETUP_BLOCKERS.length),
  };
}

/** What a stored intake holds, whatever was saved. */
export function parseIntake(raw: string | null | undefined): Intake {
  try {
    const v = JSON.parse(raw || '{}') as Record<string, unknown>;
    const a = parseSetup(v);
    return { goals: a.goals, blockers: a.blockers, at: typeof v.at === 'string' ? v.at : null };
  } catch {
    return { goals: [], blockers: [], at: null };
  }
}

/** A few small groups of choices, so a list reads at a glance. The setup chat draws every list this way. */
export interface ChoiceGroup {
  label: string;
  icon: IconName;
  keys: readonly string[];
}

export const SETUP_GOAL_GROUPS: readonly ChoiceGroup[] = [
  { label: 'Money and work', icon: 'Banknote', keys: ['earn', 'work', 'sell', 'clients', 'money'] },
  { label: 'Grow', icon: 'Sprout', keys: ['learn', 'grow', 'people', 'plan'] },
  { label: 'You', icon: 'UserRound', keys: ['health', 'move', 'life', 'find_coach'] },
];

export const SETUP_ROLE_GROUPS: readonly ChoiceGroup[] = [
  { label: 'What you make', icon: 'Clapperboard', keys: ['creator', 'freelancer', 'agency_owner', 'agency_team'] },
  { label: 'What you do', icon: 'BriefcaseBusiness', keys: ['employee', 'founder', 'brand_client', 'coach', 'run_host'] },
  { label: 'Where you are in life', icon: 'Compass', keys: ['student', 'explorer', 'parent'] },
];

export const SETUP_BLOCKER_GROUPS: readonly ChoiceGroup[] = [
  { label: 'Time and energy', icon: 'Hourglass', keys: ['time', 'energy', 'sleep'] },
  { label: 'Head space', icon: 'Brain', keys: ['focus', 'stress', 'start'] },
  { label: 'Life stuff', icon: 'Handshake', keys: ['alone', 'cash'] },
];

/** Every app the setup can switch on, said the way a friend would say it. The match shows this line under each app. */
export const SETUP_APP_LINES: Readonly<Record<string, string>> = {
  school: 'Short lessons with a mentor.',
  work: 'Paid gigs from brands.',
  army: 'Brand campaigns: join one, or run your own as a brand.',
  win: 'Get paid for views on brand videos.',
  agency: 'For content agencies and freelancers: clients, deliverables, invoices and approvals.',
  party: 'Meetups and events near you.',
  run: 'Run clubs near you. Runs earn points.',
  community: 'Post, ask and cheer each other on.',
  club: 'A members club with perks.',
  bond: 'Stay friends with people you meet.',
  circles: 'A small group that meets each week.',
  life: 'Five areas of your life on one dashboard: body, money, mind, mood and faith.',
  wellbeing: 'One score from your mood, sleep, stress and calm.',
  mood: 'Tap a face each day.',
  sleep: 'Log your nights, sleep better.',
  stress: 'Note your stress and what causes it.',
  mindful: 'Calm breathing and focus sessions, with sounds, lo-fi music and a rating for each.',
  journal: 'Write it down, with how you felt.',
  reviews: 'Look back each week, with reminders. Business numbers too, once you switch them on.',
  companion: 'A chat about how you are doing. Not a therapist.',
  coaching: 'Work with a life coach, or coach your students. You choose what they see.',
  cards: 'Unlock card games with points, then shuffle, flip and play them with the people you are with.',
  discover: 'Quizzes on your strengths, personality and love languages. Private to you.',
  profile: 'Your page: links, work and shop.',
  shop: 'Sell courses, downloads, sessions and memberships.',
  store: 'Gear new from partners, or second hand with offers and chat.',
  audience: 'See who follows you, send them news.',
  content: 'Research who is winning, then write hooks, scripts and a month of posts.',
  automations: 'Auto DM a link when people comment.',
  finance: 'Money in and out, and your goals.',
  library: 'Everything you bought, in one place.',
  knowledge: 'Short reads worth your time.',
  tools: 'Creator tools the team checked.',
  tv: 'Pitch a show idea.',
  fund: 'Ask for money to back a project.',
};
