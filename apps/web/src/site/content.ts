import { MODULE_BY_KEY, MODULES, type AppModule, type ListingType, type RelationshipKey } from '@kreators/shared';

/** The public story for each part of the app: what it is, how it goes, which relationships it serves. */
export interface FeatureCopy {
  tagline: string;
  pitch: string;
  steps: [string, string, string];
  relationships: RelationshipKey[];
  /** What the public site can list for it. */
  listing?: ListingType;
}

export const FEATURES: Record<string, FeatureCopy> = {
  today: {
    tagline: 'Three boxes a day.',
    pitch: 'Check in, do a small spark, tick one task. That is the whole daily ask. Every tick pays experience, and the check-in pays points you can spend.',
    steps: ['Open the app and check in.', 'Do the spark from your weakest floor.', 'Tick one task. Watch the ladder light up.'],
    relationships: ['servant_leader', 'friendship', 'parent_child', 'lover_partner', 'self', 'guru', 'divine'],
  },
  tower: {
    tagline: 'Seven floors, one life.',
    pitch: 'Each relationship is a floor of a rainbow tower. Each floor is a ladder: a pillar holds up a principle, a value goal, an outcome, a project and tasks. Tick a task and every rung above it grows.',
    steps: ['Answer a short, branching vibe check.', 'We derive your ladders. You never fill in a form.', 'Climb a little every day and watch your characters evolve.'],
    relationships: ['servant_leader', 'friendship', 'parent_child', 'lover_partner', 'self', 'guru', 'divine'],
  },
  school: {
    tagline: 'Learn with a cohort, not alone.',
    pitch: 'Programs with lessons, assignments and a mentor who reads your work. Completion is a decision against the criteria, never a timer running out.',
    steps: ['Pick a program and a cohort date.', 'Do the lessons, submit the assignments, join the sessions.', 'Get feedback, finish, and move straight into Work.'],
    relationships: ['guru'],
    listing: 'program',
  },
  work: {
    tagline: 'Opportunities that fit your skills.',
    pitch: 'Brands and the team post gigs, campaigns, roles and collabs. Apply once with your portfolio attached, then follow every step in one place.',
    steps: ['Browse what is open and who it is for.', 'Apply with a short note. Your portfolio comes with it.', 'Track shortlist, selection and completion.'],
    relationships: ['servant_leader', 'self'],
    listing: 'opportunity',
  },
  army: {
    tagline: 'Campaigns, run properly.',
    pitch: 'Brands write a brief, the team shortlists, the brand approves, creators produce, everyone reviews versions in one thread. Usage rights and exclusivity are written down before anyone shoots.',
    steps: ['A brand submits a brief and a budget.', 'The team scopes it and shortlists creators who fit.', 'Versions, feedback and approvals live on the campaign.'],
    relationships: ['servant_leader'],
    listing: 'campaign',
  },
  win: {
    tagline: 'Make a video. Get paid per view.',
    pitch: 'Content rewards: a brand funds a pool and sets a rate per thousand verified views. You post, we track the numbers, a reviewer confirms, finance pays. No follower count required.',
    steps: ['Pick a reward and read the brief.', 'Post your video and submit the public link.', 'Views are read or confirmed, then points land in your balance.'],
    relationships: ['servant_leader', 'self'],
    listing: 'reward',
  },
  party: {
    tagline: 'Meet the people behind the handles.',
    pitch: 'Meetups anyone can host, workshops and parties from the team, and the big days. RSVP, join a waitlist, check in at the door, say what you thought afterwards.',
    steps: ['Find something near you or online.', 'RSVP. If it is full you are first in line.', 'Check in, meet people, opt in to introductions.'],
    relationships: ['friendship', 'parent_child'],
    listing: 'event',
  },
  community: {
    tagline: 'Posts, replies, likes. By topic.',
    pitch: 'A calm place to ask, share and cheer each other on, with moderators who keep it kind. Members-only spaces come with memberships you buy.',
    steps: ['Pick a category.', 'Post or reply.', 'Like what helps.'],
    relationships: ['friendship'],
  },
  club: {
    tagline: 'A curated circle.',
    pitch: 'Apply once. Approved members get club-only events, first look at opportunities, a named manager and an honor on their profile.',
    steps: ['Tell us about your work.', 'A reviewer reads it and decides.', 'Enjoy the benefits for a year, then renew.'],
    relationships: ['friendship', 'guru'],
  },
  bond: {
    tagline: 'Introductions, with consent.',
    pitch: 'Met someone at an event? Ask for an introduction. Contact details only move after the other person says yes. Block anyone, any time.',
    steps: ['Switch introductions on.', 'Ask to meet someone you crossed paths with.', 'They accept, and you are both introduced.'],
    relationships: ['friendship'],
  },
  circles: {
    tagline: 'Meet five strangers who fit.',
    pitch: 'Sign up for a circle in your city. Two days before, you are seated at a table of people nearby whose interests complement yours: the writer with the editor, the one on camera with the one behind it. Everyone has an alias. The group chat opens a day before you meet, and names only appear when someone chooses to reveal.',
    steps: ['Pick your interests and your city.', 'Join a circle. Tables are set two days before.', 'Plan the meetup in the chat, meet, then reveal if you like.'],
    relationships: ['friendship', 'servant_leader'],
    listing: 'circle',
  },
  life: {
    tagline: 'Five areas, one picture.',
    pitch: 'Physical, financial, emotional, mental and spiritual, each scored from what you already log, each part opening the screen where you act on it. Private to you.',
    steps: ['Keep logging what you log.', 'See the five scores and the week-on-week trend.', 'Tap the weakest part and go there.'],
    relationships: ['self', 'servant_leader', 'lover_partner', 'guru', 'divine'],
  },
  wellbeing: {
    tagline: 'One score, four signals.',
    pitch: 'Mood, sleep, stress and mindful minutes roll into one number you can watch week by week. Private to you, always.',
    steps: ['Log how you feel in two taps.', 'See the week as a chart.', 'Notice what moves the number.'],
    relationships: ['self'],
  },
  mood: { tagline: 'How are you, really?', pitch: 'Pick a face. See the week. That is it.', steps: ['Open Mood.', 'Pick a face.', 'See the pattern.'], relationships: ['self'] },
  sleep: { tagline: 'Hours and quality.', pitch: 'Log last night in a few seconds and see how your sleep lines up with everything else.', steps: ['Log hours.', 'Rate the quality.', 'Watch the week.'], relationships: ['self'] },
  stress: { tagline: 'Level, and what is behind it.', pitch: 'Name the stress and the cause. Patterns show up faster than you expect.', steps: ['Set the level.', 'Name a cause.', 'See what repeats.'], relationships: ['self'] },
  mindful: { tagline: 'Breathe, and log the minutes.', pitch: 'A breathing timer that counts toward your wellbeing score.', steps: ['Pick a length.', 'Breathe with the circle.', 'Minutes are logged.'], relationships: ['self', 'divine'] },
  journal: {
    tagline: 'Write it down.',
    pitch: 'Entries with an emotion and a stress level. Nobody else sees them: not brands, not staff, not the leaderboard.',
    steps: ['Write a few lines.', 'Tag how you felt.', 'Look back a month later.'],
    relationships: ['self', 'divine', 'lover_partner'],
  },
  companion: {
    tagline: 'A reflective chat that knows your tower.',
    pitch: 'Ask it anything about your week. It reflects and asks questions back. It is not a therapist and never pretends to be one.',
    steps: ['Say what is on your mind.', 'It asks a better question.', 'You decide what to do with it.'],
    relationships: ['self', 'guru'],
  },
  profile: {
    tagline: 'One page for everything you are.',
    pitch: 'Bio, skills, portfolio, links and everything you sell on one public page at your own address.',
    steps: ['Pick a page name.', 'Add skills and portfolio pieces.', 'Share the link everywhere.'],
    relationships: ['servant_leader', 'self'],
  },
  shop: {
    tagline: 'Sell anything you make.',
    pitch: 'Downloads, courses with drip and quizzes, memberships, sessions with booking, events with replays, payment links, bundles, locked posts and paid questions. Coupons, affiliates and refunds included.',
    steps: ['Make a product in a minute.', 'Share the link.', 'Points move instantly; money follows when payments are connected.'],
    relationships: ['servant_leader', 'self'],
  },
  audience: {
    tagline: 'Followers, leads, broadcasts.',
    pitch: 'See who follows you, collect leads from your page, send a broadcast, and share an affiliate link that pays twenty percent.',
    steps: ['People follow your page.', 'Leads land in one list.', 'Broadcast when you have news.'],
    relationships: ['servant_leader'],
  },
  content: {
    tagline: 'Which post made money?',
    pitch: 'Every post gets a tracked link. The dashboard shows clicks, sales and revenue per piece of content, so you make more of what sells.',
    steps: ['Add a post and copy its tracked link.', 'Share that link instead of the plain one.', 'Watch revenue per post, not just views.'],
    relationships: ['servant_leader'],
  },
  automations: {
    tagline: 'Comment a word, get the link.',
    pitch: 'Keyword Auto-DM sends a tracked link to anyone who comments the word on your post. Funnels show where people drop off between the post, the DM, the page and the sale.',
    steps: ['Pick a post and a keyword.', 'Write the message.', 'See comments turn into sales.'],
    relationships: ['servant_leader', 'friendship'],
  },
  finance: {
    tagline: 'Know your numbers.',
    pitch: 'Money in, money out, by category and by month. Send invoices from a link, set budgets, and see what the platform paid you alongside everything else. Yours alone to see.',
    steps: ['Log what came in and what went out.', 'Send an invoice; marking it paid books the income.', 'Watch the month, keep budgets honest.'],
    relationships: ['self', 'servant_leader'],
  },
  library: {
    tagline: 'Everything you own, in one place.',
    pitch: 'Courses, downloads, memberships, tickets, sessions, certificates and answers to your paid questions.',
    steps: ['Buy something from a creator.', 'It appears here.', 'Pick up where you left off.'],
    relationships: ['guru'],
  },
  knowledge: {
    tagline: 'Articles and exercises, with sources.',
    pitch: 'Curated reading on the seven relationships, written by the team and always attributed.',
    steps: ['Browse by tag.', 'Read for ten minutes.', 'Try the exercise.'],
    relationships: ['guru'],
  },
  tools: {
    tagline: 'The gear creators actually use.',
    pitch: 'A directory of tools for capture, editing, audio, design, scheduling, analytics and more, verified by the team. Suggest your own.',
    steps: ['Pick a category.', 'Open the tool.', 'Suggest one we missed.'],
    relationships: ['self'],
    listing: 'tool',
  },
  tv: {
    tagline: 'Pitch a series.',
    pitch: 'Have a show in you? Submit a pitch and a budget. Follow it from review to diligence to release, with every decision logged.',
    steps: ['Write the pitch.', 'A reviewer reads it.', 'Track every stage.'],
    relationships: ['guru', 'divine'],
  },
  fund: {
    tagline: 'Backing for a project.',
    pitch: 'Apply for a grant or backing. Same transparent pipeline as TV: submitted, review, diligence, decision.',
    steps: ['Describe the project and the money.', 'Review and diligence.', 'A decision with a reason.'],
    relationships: ['divine', 'servant_leader'],
  },
  leaderboard: {
    tagline: 'The top twenty climbers.',
    pitch: 'Opt in and see where you stand on experience, streaks and honors. Never on follower counts.',
    steps: ['Opt in under You.', 'Climb.', 'See the top twenty.'],
    relationships: ['friendship'],
  },
  rewards: {
    tagline: 'Points for real things.',
    pitch: 'Points come from showing up. Spend them on rewards, on creators’ products, or on event tickets.',
    steps: ['Check in daily.', 'Points add up.', 'Trade them in.'],
    relationships: ['self'],
  },
  help: {
    tagline: 'Answers, and a line to the team.',
    pitch: 'Common questions answered, and a support ticket when you need a person.',
    steps: ['Read the answers.', 'Write to the team.', 'Get a reply in your inbox.'],
    relationships: ['friendship'],
  },
};

/** Modules worth a public page. */
export const SITE_FEATURES: AppModule[] = MODULES.filter((m) => m.key in FEATURES && !['search', 'notifications', 'manage', 'admin'].includes(m.key));

export function featureFor(key: string): { module: AppModule; copy: FeatureCopy } | null {
  const module = MODULE_BY_KEY[key];
  const copy = FEATURES[key];
  return module && copy ? { module, copy } : null;
}

/** Features that serve a relationship, for the seven floors section. */
export function featuresForRelationship(key: RelationshipKey): AppModule[] {
  return SITE_FEATURES.filter((m) => FEATURES[m.key]?.relationships.includes(key) && !['today', 'tower'].includes(m.key)).slice(0, 5);
}

export const BRAND_PITCH = {
  tagline: 'For brands and agencies',
  pitch: 'Submit a brief, approve a shortlist, review versions, and fund content rewards that pay creators per verified view. One workspace for your team, with usage rights written down.',
  steps: ['Create your brand and invite your team.', 'Write a brief or launch a content reward.', 'Approve, review, and see every version and view count.'],
};
