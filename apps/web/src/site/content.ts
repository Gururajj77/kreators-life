import { MODULE_BY_KEY, MODULES, type AppModule, type LifeAreaKey, type ListingType, type RelationshipKey } from '@kreators/shared';

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
    tagline: 'Three small boxes. One better day.',
    pitch: 'Check in, do one small act, tick one task. That is the whole daily ask. Every tick pays xp, and the check-in pays points you can spend. Every task has a do date and an optional due date, a priority from P0 (do now) to P3 (whenever), each in its own colour, and can repeat, hold subtasks, remind you and start a focus timer. Tasks with no date wait in a list until you pick one. Under the tasks, a not-to-do list keeps a streak for each thing you are staying away from.',
    steps: ['Open the app and check in.', 'Do the small act for your weakest pillar.', 'Plan a task: pick its day, its priority and how long it takes. Tick it on its day and watch the pyramid light up.'],
    relationships: ['servant_leader', 'friendship', 'parent_child', 'lover_partner', 'self', 'guru', 'divine'],
  },
  tower: {
    tagline: 'Seven pillars, one life.',
    pitch: 'Each relationship is a pillar of your life. Each pillar is a pyramid: a foundation you will not let break, a guiding principle you live by, a value goal for how you want to feel, a goal outcome you would see when it is real, a project, and tasks at the tip. Tick a task and the whole pyramid grows.',
    steps: ['Answer a short vibe check. Each answer picks the next question.', 'We build your pyramids. You never fill in a form.', 'Tick a little every day and watch your characters grow.'],
    relationships: ['servant_leader', 'friendship', 'parent_child', 'lover_partner', 'self', 'guru', 'divine'],
  },
  school: {
    tagline: 'Learn with a cohort, not alone.',
    pitch: 'Programs with lessons, assignments and a mentor who reads your work. Completion is a decision against the criteria, never a timer running out.',
    steps: ['Pick a program and a cohort date.', 'Do the lessons, submit the assignments, join the sessions.', 'Get feedback, finish, and move straight into Work.'],
    relationships: ['guru', 'servant_leader', 'self'],
    listing: 'program',
  },
  work: {
    tagline: 'Opportunities that fit your skills.',
    pitch: 'Brands and the team post gigs, campaigns, roles and collabs. Apply once with your portfolio attached, then follow every step in one place.',
    steps: ['Browse what is open and who it is for.', 'Apply with a short note. Your portfolio comes with it.', 'Track shortlist, selection and completion.'],
    relationships: ['servant_leader'],
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
    tagline: 'Get paid for views that are real.',
    pitch: 'Content rewards: a brand funds a pool and sets a rate per thousand verified views. You post, the views are checked, a reviewer confirms, and finance pays. No follower count needed.',
    steps: ['Pick a reward and read the brief.', 'Post your video and submit the public link.', 'Once the views are checked, points land in your balance.'],
    relationships: ['servant_leader'],
    listing: 'reward',
  },
  party: {
    tagline: 'Meet the people behind the handles.',
    pitch: 'Meetups anyone can host, workshops and parties from the team, and the big days. RSVP, join a waitlist, check in at the door, say what you thought afterwards.',
    steps: ['Find something near you or online.', 'RSVP. If it is full you are first in line.', 'Check in, meet people, opt in to introductions.'],
    relationships: ['friendship', 'parent_child', 'lover_partner', 'guru', 'divine'],
    listing: 'event',
  },
  run: {
    tagline: 'Run with people, not past them.',
    pitch: 'Run clubs anyone can start. Every run has a start code the host shows at the line: enter it and your run is logged once, with your kilometres, xp and points, and the minutes count toward your physical score. Badges for the first run, the tenth, and the hundredth kilometre. Brands post collabs with giveaways in their own tab, and a host applies with the club.',
    steps: ['Join a club near you, or start one.', 'At the start line, enter the code. Your run is logged and paid.', 'Watch your kilometres, earn badges, run brand collabs with giveaways.'],
    relationships: ['friendship', 'lover_partner', 'self'],
  },
  community: {
    tagline: 'A kind room to ask and share.',
    pitch: 'You want a place to ask without being judged. Community is a calm room, split by topic, where guides keep it kind. Post, reply, react, and follow the threads you care about.',
    steps: ['Pick a topic.', 'Post a question or reply to one.', 'React to what helps, and follow the threads you care about.'],
    relationships: ['friendship', 'parent_child', 'guru', 'divine'],
  },
  club: {
    tagline: 'A curated circle.',
    pitch: 'Apply once. Approved members get club-only events, first look at opportunities, a named manager and an honor on their profile.',
    steps: ['Tell us about your work.', 'A reviewer reads it and decides.', 'Enjoy the benefits for a year, then renew.'],
    relationships: ['friendship', 'servant_leader', 'guru'],
  },
  bond: {
    tagline: 'Introductions, with consent.',
    pitch: 'Met someone at an event? Ask for an introduction. Contact details only move after the other person says yes. Block anyone, any time.',
    steps: ['Switch introductions on.', 'Ask to meet someone you crossed paths with.', 'They accept, and you are both introduced.'],
    relationships: ['friendship', 'lover_partner'],
  },
  circles: {
    tagline: 'Five strangers who fit. One table.',
    pitch: 'Circles run every week in your city. Join this week\'s and, two days before, you are seated at a table of people nearby whose interests complement yours: the writer with the editor, the one on camera with the one behind it. Everyone has an alias. Show up in red if you are single, white if you are committed, so the table reads itself. The group chat opens a day before you meet, and everyone keeps their alias.',
    steps: ['Pick your interests and your city.', 'Join this week\'s circle. Tables are set two days before.', 'Wear red if single, white if committed. Plan in the chat, then meet.'],
    relationships: ['friendship', 'lover_partner', 'divine'],
    listing: 'circle',
  },
  life: {
    tagline: 'Five areas, one picture.',
    pitch: 'Physical, financial, emotional, mental and spiritual, each scored from what you already log, each part opening the screen where you act on it. Private to you.',
    steps: ['Keep logging what you log.', 'See the five scores and the week-on-week trend.', 'Tap the weakest part and go there.'],
    relationships: ['self', 'servant_leader', 'parent_child', 'lover_partner', 'guru', 'divine'],
  },
  wellbeing: {
    tagline: 'One score, four signals.',
    pitch: 'Mood, sleep, stress and mindful minutes roll into one number you can watch week by week. Private to you, always.',
    steps: ['Log how you feel in two taps.', 'See the week as a chart.', 'Notice what moves the number.'],
    relationships: ['self', 'lover_partner'],
  },
  mood: { tagline: 'How are you, really?', pitch: 'Pick a face. See the week. That is it.', steps: ['Open Mood.', 'Pick a face.', 'See the pattern.'], relationships: ['self', 'parent_child', 'lover_partner'] },
  sleep: { tagline: 'Hours and quality.', pitch: 'Log last night in a few seconds and see how your sleep lines up with everything else.', steps: ['Log hours.', 'Rate the quality.', 'Watch the week.'], relationships: ['self', 'parent_child', 'lover_partner'] },
  stress: { tagline: 'Level, and what is behind it.', pitch: 'Name the stress and the cause. Patterns show up faster than you expect.', steps: ['Set the level.', 'Name a cause.', 'See what repeats.'], relationships: ['self', 'servant_leader', 'parent_child', 'lover_partner'] },
  mindful: { tagline: 'Breathe, and log the minutes.', pitch: 'A breathing timer that counts toward your wellbeing score.', steps: ['Pick a length.', 'Breathe with the circle.', 'Minutes are logged.'], relationships: ['self', 'lover_partner', 'divine'] },
  journal: {
    tagline: 'Write it down.',
    pitch: 'Entries with an emotion and a stress level. Nobody else sees them: not brands, not staff, not the leaderboard.',
    steps: ['Write a few lines.', 'Tag how you felt.', 'Look back a month later.'],
    relationships: ['self', 'parent_child', 'lover_partner', 'divine'],
  },
  reviews: {
    tagline: 'Look back, by week, month, quarter or half year.',
    pitch: 'The numbers from every app for the period you pick, next to the one before: check-ins, tasks, xp by area, kept days, mood, sleep, money, sales, lessons, people. Then a few questions, a face for how it went, and one line to remember. Saved with the numbers as they were.',
    steps: ['Pick a week, a month, a quarter or half a year.', 'Read the numbers, each next to the period before.', 'Answer the questions, rate it, keep one line.'],
    relationships: ['self', 'parent_child', 'lover_partner', 'guru', 'divine'],
  },
  companion: {
    tagline: 'A chat that knows how you are doing.',
    pitch: 'Ask it anything about your week. It reflects and asks questions back. It is not a therapist and never pretends to be one.',
    steps: ['Say what is on your mind.', 'It asks a better question.', 'You decide what to do with it.'],
    relationships: ['self', 'parent_child', 'lover_partner', 'guru', 'divine'],
  },
  profile: {
    tagline: 'One page for everything you are.',
    pitch: 'Bio, skills, portfolio, links and everything you sell on one public page at your own address.',
    steps: ['Pick a page name.', 'Add skills and portfolio pieces.', 'Share the link everywhere.'],
    relationships: ['servant_leader', 'friendship', 'self'],
  },
  shop: {
    tagline: 'Sell anything you make.',
    pitch: 'Downloads, courses with drip and quizzes, memberships, sessions with booking, events with replays, payment links, bundles, locked posts and paid questions. Coupons, affiliates and refunds included.',
    steps: ['Make a product in a minute.', 'Share the link.', 'Points move instantly; money follows when payments are connected.'],
    relationships: ['servant_leader'],
  },
  store: {
    tagline: 'Gear for creators, new and pre-owned.',
    pitch: 'New gear and software picked by the team, bought through partner links. Pre-owned gear from other creators, graded by condition, with offers and a chat built in. Kits that say what to buy at your stage, within your budget. Featured spots at the top for a week.',
    steps: ['Pick a category, a stage and a budget.', 'Tap Get it on new gear, or make an offer on pre-owned gear.', 'List your own gear when you move up.'],
    relationships: ['servant_leader'],
  },
  audience: {
    tagline: 'Know the people who want more.',
    pitch: 'See who follows you, collect leads from your page, send a broadcast, and share an affiliate link that pays twenty percent.',
    steps: ['People follow your page.', 'Leads land in one list.', 'Broadcast when you have news.'],
    relationships: ['servant_leader', 'friendship'],
  },
  content: {
    tagline: 'Find the posts that sell.',
    pitch: 'Every post gets a tracked link. The dashboard shows clicks, sales and revenue per piece of content, so you make more of what sells.',
    steps: ['Add a post and copy its tracked link.', 'Share that link instead of the plain one.', 'Watch revenue per post, not just views.'],
    relationships: ['servant_leader'],
  },
  automations: {
    tagline: 'Comment a word, get the link.',
    pitch: 'Keyword Auto-DM sends a tracked link to anyone who comments the word on your post. Funnels show where people drop off between the post, the DM, the page and the sale.',
    steps: ['Pick a post and a keyword.', 'Write the message.', 'See comments turn into sales.'],
    relationships: ['servant_leader'],
  },
  finance: {
    tagline: 'See your money clearly.',
    pitch: 'Money in, money out, by category and by month. Track what you are owed and what repeats, set budgets and goals, and see what the platform paid you alongside everything else. Yours alone to see.',
    steps: ['Log what came in and what went out.', 'Track dues and monthly repeats; settle them with a tap.', 'Watch the month, keep budgets and goals honest.'],
    relationships: ['self', 'servant_leader', 'parent_child'],
  },
  library: {
    tagline: 'Everything you own, in one place.',
    pitch: 'Courses, downloads, memberships, tickets, sessions, certificates and answers to your paid questions.',
    steps: ['Buy something from a creator.', 'It appears here.', 'Pick up where you left off.'],
    relationships: ['guru', 'self'],
  },
  knowledge: {
    tagline: 'Articles and exercises, with sources.',
    pitch: 'Curated reading on the seven relationships, written by the team and always attributed.',
    steps: ['Browse by tag.', 'Read for ten minutes.', 'Try the exercise.'],
    relationships: ['guru', 'divine'],
  },
  tools: {
    tagline: 'The gear creators actually use.',
    pitch: 'A directory of tools for capture, editing, audio, design, scheduling, analytics and more, verified by the team. Suggest your own.',
    steps: ['Pick a category.', 'Open the tool.', 'Suggest one we missed.'],
    relationships: ['self', 'servant_leader', 'guru'],
    listing: 'tool',
  },
  tv: {
    tagline: 'Pitch a series.',
    pitch: 'Have a show in you? Submit a pitch and a budget. Follow it from review to diligence to release, with every decision logged.',
    steps: ['Write the pitch.', 'A reviewer reads it.', 'Track every stage.'],
    relationships: ['servant_leader'],
  },
  fund: {
    tagline: 'Backing for a project.',
    pitch: 'Apply for a grant or backing. Same transparent pipeline as TV: submitted, review, diligence, decision.',
    steps: ['Describe the project and the money.', 'Review and diligence.', 'A decision with a reason.'],
    relationships: ['servant_leader'],
  },
  leaderboard: {
    tagline: 'Climb on effort, not followers.',
    pitch: 'Opt in and see where you stand on experience, streaks and honors. Never on follower counts.',
    steps: ['Opt in under Profile.', 'Climb.', 'See the top twenty.'],
    relationships: ['friendship', 'servant_leader', 'self'],
  },
  rewards: {
    tagline: 'Points for real things.',
    pitch: 'Points come from showing up. Spend them on gear, three books, a meetup ticket, a call with a mentor or creators’ products. Or unlock one of nine games and play it in the app for good.',
    steps: ['Check in daily.', 'Points add up.', 'Reserve gear, or unlock a game and play it at once.'],
    relationships: ['self', 'parent_child'],
  },
  help: {
    tagline: 'Answers, and a line to the team.',
    pitch: 'Common questions answered, and a support ticket when you need a person.',
    steps: ['Read the answers.', 'Write to the team.', 'Get a reply in your inbox.'],
    relationships: ['friendship', 'guru'],
  },
  discover: {
    tagline: 'Find out what you are good at.',
    pitch: 'A quiz about how you think, feel and act. Pick what is most and least like you, solve pattern puzzles that get harder or easier as you go, choose words that fit you and judge real situations. Add emotional intelligence if you like. You get your top three strengths across the seven relationships, a detailed read on five personality traits and on your reasoning (it is not an IQ test), and one small thing to try. Four self-checks sit beside it: your four-letter type from sixteen (in the style of Myers-Briggs), your love languages for giving and for receiving love, how your mind works (attention, energy and patterns, as signs and never a diagnosis), and Human design, which works out your chart from your birth details in the tropical and the sidereal zodiac and turns it into goals. Only you see it, and you choose what the assistant and your next steps may learn.',
    steps: ['Answer in short parts. It saves as you go.', 'Add emotional intelligence, your 16 personality type (MBTI-style), your love languages, how your mind works or your Human design, if you like.', 'See your strengths and a detailed read, and let your next steps on Home start to fit you.'],
    relationships: ['self', 'guru', 'divine', 'lover_partner', 'servant_leader', 'friendship', 'parent_child'],
  },
  cards: {
    tagline: 'Games for the people you are with.',
    pitch: 'Nine card games for dating, family, friends and teams, work, and a quiet look at your hidden self. Unlock a game once with points, then play it in the app: shuffle, draw, flip and drag cards around a table. Turn on focus mode and everything else steps aside, so the table is all you see. Nothing is posted to you.',
    steps: ['Unlock a game in Rewards with points.', 'Pick a deck, shuffle, and tap the pile to draw.', 'Flip a card for its other side, and turn on focus mode when you want the whole screen.'],
    relationships: ['friendship', 'lover_partner', 'parent_child', 'self', 'servant_leader'],
  },
  coaching: {
    tagline: 'A life coach in your corner.',
    pitch: 'Life coaches the team chose, with the Life coach badge. Ask one, or say yes when one asks. You pick what they see, never your journal. They leave notes and add tasks only you tick, and every step is in a change log you both read.',
    steps: ['Find a life coach and ask, or answer a coach who asked you.', 'Pick what they see: daily, pillars, routine, life map or reflection.', 'Read their notes, tick their tasks, and end it any time.'],
    relationships: ['guru', 'lover_partner', 'self', 'divine'],
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
  return SITE_FEATURES.filter((m) => FEATURES[m.key]?.relationships.includes(key) && !['today', 'tower', 'help'].includes(m.key));
}

/** The five areas of life, and which apps serve each. Another way to read the same seven relationships. */
export const LIFE_AREA_FEATURES: Record<LifeAreaKey, string[]> = {
  physical: ['run', 'wellbeing', 'sleep', 'mindful', 'life', 'store'],
  financial: ['finance', 'shop', 'work', 'army', 'win', 'fund', 'store', 'audience', 'content'],
  emotional: ['mood', 'journal', 'companion', 'discover', 'coaching', 'bond', 'community', 'party', 'circles', 'cards', 'profile'],
  mental: ['stress', 'school', 'knowledge', 'library', 'tools', 'reviews', 'tv'],
  spiritual: ['today', 'tower', 'mindful', 'club', 'leaderboard', 'rewards'],
};
export function featuresForLifeArea(key: LifeAreaKey): AppModule[] {
  return LIFE_AREA_FEATURES[key].map((k) => MODULE_BY_KEY[k]).filter((m): m is AppModule => Boolean(m && m.key in FEATURES));
}

export const BRAND_PITCH = {
  tagline: 'For brands and agencies',
  pitch: 'Write a brief, approve a shortlist and review every version in one thread. Or fund a content reward that pays creators per verified view, and only after a reviewer checks. Usage rights are written down before anyone shoots.',
  steps: ['Create your brand and invite your team.', 'Write a brief or launch a content reward.', 'Approve, review, and see every version and view count.'],
};

/** The doubts a first-time visitor has, most common first. Each answer accepts the worry, then answers it. */
export const SITE_FAQ: { q: string; a: string }[] = [
  { q: 'What’s the catch?', a: 'Fair question. The daily game and every app are free to start and free to stay. Two things cost money. Typing to the assistant needs a plan, because the model costs us money; plans are not on sale yet. The Shop takes 5% of each sale. Partner links in the Store may earn us a share, and every card says so.' },
  { q: 'I don’t have time for another app.', a: 'That is the point of it. The daily ask is three moves: check in, do one small act, tick one task. It takes a few minutes. The rest is there when you want it, and switched off when you don’t.' },
  { q: 'Who sees my Discover results?', a: 'Only you. Your answers never reach brands, staff, the leaderboard or a life coach. You choose whether your results shape your next steps and whether the assistant may read a short summary. It is not an IQ test or a diagnosis: it is a self-discovery quiz that compares you only with your own scale.' },
  { q: 'Who sees my journal?', a: 'Only you. Your journal and wellbeing numbers never reach brands, staff, the leaderboard or Club selection. The assistant reads the journal only when you ask it to, and only through models that keep nothing. A life coach never sees it.' },
  { q: 'I’m not a creator. Is it for me?', a: 'Yes, if you are 18 or over. The seven relationships are for everyone: work, friends, family, love, yourself, teachers and faith. The creator apps, like the Shop and Win, stay off until you want them.' },
  { q: 'Apps like this never stick for me.', a: 'That isn’t you. Most apps track one part of life and forget the other six. Here each tick climbs a pillar you chose, toward a foundation you wrote. And a task can only be ticked from its do date, so the plan stays honest.' },
  { q: 'Won’t it be too many apps?', a: 'Only a few are on at the start. A short chat asks what you want and switches on up to five more that fit you. You can switch any of them on or off later, under the Profile tab.' },
  { q: 'Is the pay real?', a: 'It is real, and it is careful. Win pays per verified view, not per follower, and a reviewer checks before anything pays. Everything that pays out has a wait or a person who checks it. Points work today; money checkout turns on when payments go live.' },
  { q: 'Will I be on my own?', a: 'No. Bumling, the app’s own guide, and seven characters walk with you. Every app ends with a How it works section, Help answers questions, and you can work with a life coach if you want one.' },
  { q: 'Can I leave?', a: 'Any time. From the Profile tab you can export everything, erase your progress, or delete your account. Switching an app off is one tap.' },
  { q: 'Why do you ask for my phone and birthday?', a: 'So that everyone here is 18 or over. Nobody under 18 gets an account. Neither your phone number nor your birthday is ever shown to anyone else, and you can change the phone number under the Profile tab.' },
];
