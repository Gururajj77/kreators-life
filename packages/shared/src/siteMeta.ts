// ---------------------------------------------------------------------------
// The public site's words for search and answer engines (docs/aeo-kit.md, parts 3, 5 and 6): every stable public page's title,
// description, H1 and answer-first opening, the site's fair questions, and the JSON-LD builders. One source for the web app
// (`usePageMeta`), the build-time generator (scripts/seo) and the Worker (`/`, `/events/:id`, the sitemap), so they never drift.
// A subpath export (`@kreators/shared/siteMeta`), not in the barrel: it imports the rest of shared and nothing in the barrel imports
// it, so there is no cycle. Pure: no fetch, no environment; the caller passes the origin and the business details it read.
// ---------------------------------------------------------------------------
import { LIVE_CALL_CENTS, PAYMENTS_LIVE, PLAN_CURRENCY, PLAN_DAYS, PLANS } from './assistant.ts';
import { BOOK_AUTHOR, BOOKS } from './books.ts';
import { formatCount } from './core.ts';
import { MODULE_BY_KEY } from './modules.ts';
import { money } from './money.ts';
import { REWARDS } from './rewards.ts';

/** The production origin when nothing else names one (`PUBLIC_URL` in the Worker, `SITE_URL` at build time). */
export const DEFAULT_SITE_URL = 'https://kreators.app';

/** One stable public page: what its head says, its H1, and the answer-first opening a crawler reads before anything else. */
export interface PageMeta {
  path: string;
  title: string;
  description: string;
  h1: string;
  opening?: string;
}

/**
 * Every `/features/<slug>` page: the keys of `SITE_FEATURES` in apps/web/src/site/content.ts (the modules with a FEATURES entry,
 * less search, notifications, manage and admin), in the site's group order, then `books`. A shared test holds it equal to that list.
 */
export const FEATURE_PAGE_SLUGS: readonly string[] = [
  'school', 'work', 'army', 'win', 'agency',
  'life', 'journal', 'reviews', 'mindful', 'fitness', 'wellbeing', 'mood', 'sleep', 'stress', 'coaching', 'companion', 'discover',
  'community', 'run', 'club', 'party', 'bond', 'circles', 'cards',
  'shop', 'profile', 'content', 'audience', 'automations', 'finance', 'fund', 'tv', 'knowledge', 'tools', 'store', 'library',
  'home', 'today', 'tower', 'leaderboard', 'help', 'assistant',
  'books',
];

/** How many apps the site lists (every feature page but the books). */
const APP_COUNT = FEATURE_PAGE_SLUGS.filter((s) => s !== 'books').length;

/** The canonical answer (part 3 of the kit): the words to use wherever a short definition of kreators.app is needed. */
export const SITE_ANSWER = {
  sentence: 'kreators.app is a free-to-start web app: a daily game for the seven relationships of a life, with a creator’s tools built in.',
  paragraph:
    'kreators.app is a web app that turns the seven relationships of a life into a daily game. Each day you check in, do one small act and tick one task. Courses, paid work, brand campaigns, client work, a shop and money tools are switches you turn on. It is free to start and free to stay.',
  about: `kreators.app helps creators, freelancers, founders and students grow their work without losing their life. It sees your work as one of seven relationships: servitude, friends, family, love, yourself, teachers and faith. Each relationship is a pillar with its own guide, and each pillar is a pyramid from a foundation down to today’s task. The daily ask is three moves: check in, do one small act, tick one task. Around it sit ${APP_COUNT} apps, each one a switch, from School and Agency to Journal, Circles and the Shop. Only a few are on to start. It runs in the browser on a phone or laptop, India first, for people 18 or over. It is free to start and free to stay.`,
} as const;

const T = (page: string) => `${page} | kreators.app`;

/** The main pages, from the tables in part 6 of the kit. */
const MAIN_PAGES: readonly PageMeta[] = [
  {
    path: '/',
    title: T('Grow your work without losing your life'),
    description: 'kreators.app is a daily game for the seven relationships that make a life, with a creator’s tools built in. One small act a day. Free to start, free to stay.',
    h1: 'Grow your work without losing your life',
    opening:
      'kreators.app is a daily game for the seven relationships that make a life, with a creator’s tools built in. Each day you check in, do one small act and tick one task. Courses, paid work, brand campaigns, client work, a shop and money tools are switches you turn on. It is free to start and free to stay.',
  },
  {
    path: '/features',
    title: T(`Features: ${APP_COUNT} apps, each one a switch`),
    description: 'Every app in kreators.app by group: courses, gigs, campaigns, clients, a shop, money, wellbeing and people. Each one is a switch. Keep only the apps you use.',
    h1: 'Everything a creator needs, one switch at a time',
    opening: `kreators.app has ${APP_COUNT} apps in five groups: Contribution, Reflection, Connection, Creation and Essentials. Each app is a switch. Only a few are on to start, and a short setup chat shows the ones that fit you. Hiding an app takes one tap, and nothing is deleted. Every app below has its own page.`,
  },
  {
    path: '/7rp',
    title: T('The seven relationships'),
    description: 'Servitude, friends, family, love, yourself, teachers and faith: the seven relationships of kreators.app. Each is a pillar with a guide and its own apps.',
    h1: 'Seven relationships, one life.',
    opening:
      'kreators.app is built on seven relationships: servitude, friends, family, love, yourself, teachers and faith. Each one is a pillar with its own guide, from Ember for servitude to Lumen for faith. Pick a pillar to see the apps that serve it, or switch to the five areas of life: physical, financial, mental, emotional and spiritual.',
  },
  {
    path: '/explore',
    title: T('Explore rewards, gigs and events'),
    description: 'Search content rewards, opportunities, events, programs, tools, campaigns and circles on kreators.app. Sign in to join, apply or submit, then come back.',
    h1: 'Explore',
  },
  {
    path: '/events',
    title: T('Events: meetups and workshops'),
    description: 'Meetups, workshops and days you can join on kreators.app. Pick an event to see when and where it is, then save your seat. Tickets are free or paid in points.',
    h1: 'Events',
    opening:
      'Events on kreators.app are meetups, workshops and days you can join, online or in person. Each event page shows the start in your own time zone, the place and the seats left. A ticket is free or paid in points. You need to be 18 or older, and you can make your account right on the event’s own page.',
  },
  {
    path: '/pricing',
    title: T('Pricing: free to start, free to stay'),
    description: `kreators.app is free to start and free to stay. The Shop takes 5% of a sale. Typing to the assistant needs a plan from ${money(PLANS.pro.priceCents, PLAN_CURRENCY)} for ${PLAN_DAYS} days${PAYMENTS_LIVE ? '' : ', not on sale yet'}.`,
    h1: 'Pricing',
    opening: `kreators.app is free to start and free to stay: the daily game, your seven pillars and every app you switch on, Agency included. Three things cost money. The Shop takes 5% of each sale. Typing to the assistant needs a plan from ${money(PLANS.pro.priceCents, PLAN_CURRENCY)} for ${PLAN_DAYS} days. ${PAYMENTS_LIVE ? `An optional live call costs ${money(LIVE_CALL_CENTS, PLAN_CURRENCY)}.` : `That plan and an optional ${money(LIVE_CALL_CENTS, PLAN_CURRENCY)} live call are not on sale yet.`}`,
  },
  {
    path: '/terms',
    title: T('Terms of use'),
    description: 'The terms of use for kreators.app in plain words: who can join (18 or over), what points are, what we take from a sale, and how the assistant’s plans work.',
    h1: 'Terms of use',
  },
  {
    path: '/privacy',
    title: T('Privacy'),
    description: 'How kreators.app handles your data: what we keep and why, who sees what, how long it is kept, and your rights under India’s DPDP Act and in the EU and UK.',
    h1: 'Privacy',
    opening:
      'kreators.app keeps your journal and wellbeing away from brands, staff, the leaderboard and Club selection. We never use what you write to train AI models, and we do not sell your data. In India, the Digital Personal Data Protection Act 2023 gives you rights, and our Grievance Officer answers complaints first.',
  },
  {
    path: '/refunds',
    title: T('Refunds'),
    description: 'How refunds work on kreators.app: money goes back the way you paid, by UPI, card or bank through Razorpay, usually in five to seven working days.',
    h1: 'Refunds and cancellations',
  },
  {
    path: '/contact',
    title: T('Contact'),
    description: 'Contact the kreators.app team. A person answers. For a complaint about your data or something posted here, write first to our Grievance Officer.',
    h1: 'Contact',
  },
  {
    path: '/subprocessors',
    title: T('Subprocessors'),
    description: 'The companies that handle personal data for kreators.app, what each one does and where: hosting, email, payments, the assistant’s models and video.',
    h1: 'Subprocessors',
  },
  {
    path: '/copyright',
    title: T('Copyright notices'),
    description: 'Send kreators.app a copyright notice if something here copies your work, or a counter-notice if we took down yours by mistake. Here is how it works.',
    h1: 'Copyright',
  },
  {
    path: '/licences',
    title: T('Open-source licences'),
    description: 'The open-source parts kreators.app is built on, each with its licence, including the Google Sans Flex and Caveat fonts under the SIL Open Font License.',
    h1: 'Open-source licences',
  },
];

/** The app pages (`/features/<slug>`): title and description from part 6; the H1 is the app's name, as Feature.tsx renders it. */
/** What reserving one book costs in Rewards, when all three cost the same (the sentence names one figure), else null and the sentence says none. */
const BOOK_POINTS: number | null = (() => {
  const costs = BOOKS.map((b) => REWARDS.find((r) => r.key === b.rewardKey)?.cost);
  return costs.every((c) => typeof c === 'number') && new Set(costs).size === 1 ? (costs[0] as number) : null;
})();

const FEATURE_HEAD: Readonly<Record<string, { title: string; description: string; opening?: string }>> = {
  school: { title: 'School: learn with a cohort', description: 'School on kreators.app: programs with lessons, assignments and a mentor who reads your work. You finish when your work meets the bar, not when a timer ends.' },
  work: { title: 'Work: opportunities for your skills', description: 'Work on kreators.app: gigs, campaigns, roles and collabs from brands and the team. Apply once with your portfolio attached, then follow every step.' },
  army: { title: 'Army: brand campaigns, run properly', description: 'Army on kreators.app runs a brand’s campaign from brief to approved work, with every version and its feedback in one thread and usage rights written first.' },
  win: {
    title: 'Win: get paid for real views',
    description: 'Win on kreators.app: content rewards where a brand funds a pool and pays per thousand verified views. No follower count needed. A reviewer checks first.',
    opening:
      'Win is how kreators.app pays for content: a brand funds a pool and sets a rate per thousand verified views. You pick a reward, post your video and submit the public link. Once the views are checked and a reviewer confirms, points land in your balance. No follower count is needed.',
  },
  agency: {
    title: 'Agency: run clients like a studio',
    description: 'Agency on kreators.app is for a content agency or a freelance creator. Each client gets a page of work to do, with invoices that work out GST and TDS, and agreements.',
    opening:
      'Agency is the kreators.app app for a content agency or a freelance creator. Each client gets a dashboard of deliverables moving from idea to published, your time, invoices with GST and TDS worked out, and agreements from templates. A client’s page never shows your fees or private notes. We take nothing from what you invoice.',
  },
  life: { title: 'Life: five areas, one picture', description: 'Life on kreators.app scores five areas of life, physical, financial, mental, emotional and spiritual, from what you already log. Only you see the scores.' },
  journal: { title: 'Journal: write it down', description: 'Journal on kreators.app: entries with an emotion and a stress level, plus gratitude prompts. Nobody else sees it: not brands, not staff, not the leaderboard.' },
  reviews: { title: 'Reviews: look back, a day to a year', description: 'Reviews on kreators.app: pick a day, week, month, quarter, half year or year and see every app’s numbers next to the period before. Then answer a few questions.' },
  mindful: { title: 'Mindfulness: breathe and focus', description: 'Mindfulness on kreators.app: a breathing timer and focus sessions with breaks, background sounds made in your browser, and a rating of how focused you were.' },
  fitness: { title: 'Fitness: move, eat, see the week', description: 'Fitness on kreators.app: log a run, a walk or a workout, and tick your meals once a day. No calories, no sizes, and your weight is never saved.' },
  wellbeing: { title: 'Wellbeing: one score, four signals', description: 'Wellbeing on kreators.app rolls mood, sleep, stress and mindful minutes into one score you watch week by week. Only you see it, unless you share it.' },
  mood: { title: 'Mood: how are you, really?', description: 'Mood on kreators.app: pick a face for how you really are and see the week. Two taps a day show a pattern over time, and only you see it unless you share.' },
  sleep: { title: 'Sleep: hours and quality', description: 'Sleep on kreators.app: log last night’s hours and quality in a few seconds, then see how your sleep lines up with everything else you log in the app.' },
  stress: { title: 'Stress: the level and the cause', description: 'Stress on kreators.app: set the level and name the cause. Patterns show up faster than you expect, and only you see them unless you share with a coach.' },
  coaching: { title: 'Coaching: a life coach for you', description: 'Coaching on kreators.app: work with a life coach the team chose. You pick what they see, never your journal, and every step is in a log you both read.' },
  companion: { title: 'Companion: a chat that knows you', description: 'Companion on kreators.app: a chat that knows how your week is going, reflects and asks questions back. It is not a therapist and never pretends to be one.' },
  discover: {
    title: 'Discover: find your strengths',
    description: 'Discover on kreators.app: a quiz that finds your top three strengths across the seven relationships, five traits and your reasoning. It is not an IQ test.',
    opening:
      'Discover is a self-discovery quiz in kreators.app. It finds your top three strengths across the seven relationships, reads five personality traits and your reasoning, and suggests one small thing to try. It is not an IQ test or a diagnosis. Add-ons include a free MBTI-style type check (not the official MBTI), love languages, and Human design for reflection, not science. Only you see it.',
  },
  community: { title: 'Community: ask and share', description: 'Community on kreators.app: a kind room to ask and share, with a room for each topic and guides who keep it calm. Post under your name or a made-up one.' },
  run: { title: 'Kreators Run: run with people', description: 'Kreators Run: run clubs anyone can start. The host shows a start code at the line, you enter it, and your run is logged once. Minutes count to your score.' },
  club: { title: 'Club: a curated circle', description: 'Club on kreators.app: apply once. Approved members get club-only events, a first look at opportunities, a named manager and an honor on their profile.' },
  party: { title: 'Party: meet people at events', description: 'Party on kreators.app: meetups anyone can host, plus workshops and parties from the team. RSVP, join a waitlist, check in at the door and meet people.' },
  bond: { title: 'Bond: introductions, with consent', description: 'Bond on kreators.app: introductions with consent. Met someone at an event? Ask to be introduced, and contact details move only after they say yes.' },
  circles: { title: 'Circles: five strangers, one table', description: 'Circles on kreators.app: every week in your city, a table of people nearby whose interests fit yours. Everyone has an alias, and a chat opens the day before.' },
  cards: { title: 'Games: card games to play', description: 'Games on kreators.app: nine card games for dating, family, friends and teams, work, and your hidden self. Unlock a game once with points, then play on screen.' },
  shop: { title: 'Shop: sell what you make', description: 'Shop on kreators.app: sell downloads, courses, memberships, sessions, events and more, with coupons, affiliates and refunds. We take 5% of each sale.' },
  profile: { title: 'Public page: one page for you', description: 'Public page on kreators.app: your bio, skills, portfolio, links and everything you sell on one public page at your own address. Share one link everywhere.' },
  content: { title: 'Content: find the posts that sell', description: 'Content on kreators.app gives every post a tracked link and shows clicks, sales and revenue for each piece, so you can make more of what sells.' },
  audience: { title: 'Audience: know who wants more', description: 'Audience on kreators.app: see who follows you, collect leads from your page, send a broadcast and share an affiliate link that pays twenty percent.' },
  automations: { title: 'Auto-DM: comment a word, get the link', description: 'Auto-DM on kreators.app sends a tracked link to anyone who comments your keyword, and funnels show where people drop off between the post and the sale.' },
  finance: { title: 'Finance: see your money clearly', description: 'Finance on kreators.app: money in and out by category and by month, with dues, repeats, budgets and goals, and what the platform paid you. Yours alone.' },
  fund: { title: 'Fund: backing for a project', description: 'Fund on kreators.app: apply for a grant or backing for a project, then follow each stage: submitted, review, diligence, and a decision with a reason.' },
  tv: { title: 'TV: pitch a series', description: 'TV on kreators.app: pitch a series with a budget, then follow it from review to diligence to release, with every decision logged where you can see it.' },
  knowledge: { title: 'Knowledge: articles with sources', description: 'Knowledge on kreators.app: articles and things to try on the seven relationships. The team writes them and always names where each idea came from.' },
  tools: { title: 'Tools: tools creators use', description: 'Tools on kreators.app: a directory of tools for capture, editing, audio, design, scheduling and analytics, verified by the team. Suggest one we missed.' },
  store: { title: 'Store: creator gear, new and used', description: 'Store on kreators.app: new gear picked by the team through partner links, and pre-owned gear from other creators, with offers and a chat built in.' },
  library: { title: 'My purchases: all in one place', description: 'My purchases on kreators.app: the courses, downloads, memberships, tickets, sessions, certificates and paid answers you own, all kept in one place.' },
  home: { title: 'Home: your numbers and your day', description: 'Home on kreators.app opens with a short brief: three signals and three next steps, worked out by plain rules, not AI. Then your numbers, water and reminders.' },
  today: {
    title: 'Daily: three small boxes',
    description: 'Daily on kreators.app: check in, do one small act, tick one task. Tasks have do dates, priorities and repeats. Plan my week suggests a day for each task that has none.',
    opening:
      'Daily is the kreators.app tab for the day’s three moves: check in, do one small act and tick one task. Every tick pays xp, and the check-in pays points. A task can have a do date, a due date, a priority from P0 to P3 and a repeat. Plan my week suggests a day for each task that has none, and nothing changes until you keep it.',
  },
  tower: {
    title: 'Pillars: seven pillars, one life',
    description: 'Pillars on kreators.app: each of the seven relationships is a pillar, and each pillar is a pyramid from a foundation down to today’s task. Tick it to grow.',
    opening:
      'In kreators.app each of the seven relationships is a pillar, and each pillar is a pyramid with six layers: a foundation, a guiding principle, a value goal, a goal outcome, a project and tasks at the tip. A short session builds them for you. Tick a task and the whole pyramid grows.',
  },
  leaderboard: { title: 'Leaderboard: climb on effort', description: 'Leaderboard on kreators.app: opt in to climb on xp, streaks and badges. Never on follower counts, and never on your journal or your wellbeing.' },
  help: { title: 'Help: answers and the team', description: 'Help on kreators.app: common questions answered, and a support ticket when you need a person. The reply comes to your own inbox inside the app.' },
  assistant: {
    title: 'Assistant: say it, it is done',
    description: 'Bumling, the kreators.app assistant, logs a mood, adds a task or ticks a box when you tap. Typing to it needs a plan. Undo anything with one tap.',
    opening: `Bumling is the kreators.app assistant, in the corner of every screen. Tapping its ready-made choices is free: log a mood, add a task, tick a box. Typing to it needs a plan from ${money(PLANS.pro.priceCents, PLAN_CURRENCY)} for ${PLAN_DAYS} days${PAYMENTS_LIVE ? '' : ', not on sale yet'}. It does the job in the app, lists what changed and asks before removing anything.`,
  },
  books: {
    title: 'Three books, three courses',
    description: 'Three books by Shubham Aggarwal, founder of kreators.app: The Relationship Method and two Dictionaries of Mistakes, each with its own course in School.',
    opening:
      `Shubham Aggarwal, the founder of kreators.app, wrote three books: The Relationship Method, Dictionary of Mistakes for Creators and Dictionary of Mistakes for 20s. The Relationship Method is where the seven relationships come from. Each book has a course in School, and each lesson marks what comes from the book. The books are not sold for money on the site yet${BOOK_POINTS ? `; each can be reserved for ${formatCount(BOOK_POINTS)} points in Rewards` : ''}.`,
  },
};

/** The app's name for a slug: the module's own name, as Feature.tsx renders it; the books page keeps its own H1. */
function featureH1(slug: string): string {
  if (slug === 'books') return 'Three books, three courses';
  return MODULE_BY_KEY[slug]?.name ?? slug;
}

/** The name an app goes by in a breadcrumb or a list (its H1). */
export function featureName(slug: string): string {
  return featureH1(slug);
}

const FEATURE_PAGES: readonly PageMeta[] = FEATURE_PAGE_SLUGS.map((slug) => {
  const head = FEATURE_HEAD[slug];
  const page: PageMeta = {
    path: `/features/${slug}`,
    title: T(head?.title ?? featureH1(slug)),
    description: head?.description ?? '',
    h1: featureH1(slug),
  };
  if (head?.opening) page.opening = head.opening;
  return page;
});

/**
 * Every stable public route, with its head words. An app page without an `opening` takes its tagline and pitch from FEATURES in
 * apps/web/src/site/content.ts (part 6 of the kit). `/events/:id`, `/u/<handle>` and the like are live pages the Worker writes.
 */
export const SITE_PAGES: readonly PageMeta[] = [...MAIN_PAGES, ...FEATURE_PAGES];

const PAGE_BY_PATH: Readonly<Record<string, PageMeta>> = Object.assign(
  Object.create(null) as Record<string, PageMeta>,
  Object.fromEntries(SITE_PAGES.map((p) => [p.path, p])),
);

/** The head words for a path, or null. A trailing slash, a query or a hash is tolerated; a typed path finds no prototype key. */
export function metaForPath(path: string): PageMeta | null {
  if (typeof path !== 'string') return null;
  let p = path.split(/[?#]/, 1)[0] ?? '';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '') || '/';
  return PAGE_BY_PATH[p] ?? null;
}

// ---------------------------------------------------------------------------
// The fair questions (moved here from apps/web/src/site/content.ts, which re-exports them).
// ---------------------------------------------------------------------------

/** Shown second among the questions, and only while Invite only is on (GET /api/public/join), so it never says what is not so. */
export const INVITE_FAQ: { q: string; a: string } = {
  q: 'Do I need an invite?',
  a: 'Right now, yes: joining is by invite. If someone gave you a code or a link, Start free asks for it. Each code works once, for one account. No code? Join the waitlist on the same page, and we will email you when there is a place.',
};

/** The doubts a first-time visitor has, most common first. Each answer accepts the worry, then answers it. */
export const SITE_FAQ: { q: string; a: string }[] = [
  { q: 'What’s the catch?', a: `Fair question. The daily game and every app are free to start and free to stay, Agency included: we take nothing from what you invoice. Three things cost money. Typing to the assistant needs a plan, because the model costs us money${PAYMENTS_LIVE ? '' : '; plans are not on sale yet'}. The Shop takes 5% of each sale. An optional live call with a coach costs ${money(LIVE_CALL_CENTS, PLAN_CURRENCY)}${PAYMENTS_LIVE ? '' : ', and it is not on sale yet either'}. Partner links in the Store may earn us a share, and every card says so.` },
  { q: 'How is this different from self-help?', a: 'Most self-help picks one part of your life. kreators.app works on all seven relationships at once, because each one holds up the others. And you do not only read a plan: you tick it, one small act and one task a day, on pyramids you built.' },
  { q: 'I run a small agency. Is this for me?', a: 'Yes. Agency is for a content agency or a freelance creator. Each client gets a dashboard with their deliverables moving from idea to published, your time, invoices and agreements. You can share one page with a client, and they can approve or send back what is waiting. It is switched off until you want it.' },
  { q: 'What can my client see?', a: 'Only what you switch on. You pick the parts (what is waiting, what is coming, what is live, the month so far) and whether they can approve, send back or write a note. They never see your fees, your private notes, your time line by line or your other clients. You can preview the page first, and a fresh link closes the old one.' },
  { q: 'Can I see my tasks in my own calendar?', a: 'Yes. Under Profile, switch on the calendar link and subscribe to it in Google, Apple or Outlook Calendar. It shows each open task that has a day, and the reviews you planned. It carries only a title, a pillar and a priority, never your notes or your journal. It shows your tasks there; it does not change them.' },
  { q: 'Can I use it on my phone and my laptop?', a: 'Yes. One account can be signed in on up to three devices at once. A fourth signs out the oldest, and it tells that device why.' },
  { q: 'I don’t have time for another app.', a: 'That is the point of it. The daily ask is three moves: check in, do one small act, tick one task. It takes a few minutes. It counts reps, not hours. The rest is there when you want it, and switched off when you don’t.' },
  { q: 'Who sees my journal and Discover results?', a: 'Only you. Your journal, wellbeing numbers and Discover results never reach brands, staff, the leaderboard or Club selection, and a life coach never sees your journal or your quiz. The assistant reads your journal only when you ask, and a short Discover summary only if you switch that on, both through models that keep nothing. Discover is a self-check, not an IQ test or a diagnosis.' },
  { q: 'I’m not a creator. Is it for me?', a: 'Yes, if you are 18 or over. The seven relationships are for everyone: servitude, friends, family, love, yourself, teachers and faith. The creator apps, like the Shop and Win, stay off until you want them.' },
  { q: 'I’m doing fine. Is it still for me?', a: 'Yes. It is not only for fixing what hurts. Your pillars keep the good parts strong, and reviews show what is working, so you keep doing it.' },
  { q: 'Apps like this never stick for me.', a: 'That isn’t you. Most apps track one part of life and forget the other six. Here each tick climbs a pillar you chose, toward a foundation you wrote. And a task can only be ticked from its do date, so the plan stays honest.' },
  { q: 'Is the pay real?', a: 'It is real, and it is careful. Win pays per verified view, not per follower, and a reviewer checks before anything pays. Everything that pays out has a wait or a person who checks it. Points work today; money checkout turns on when payments go live.' },
  { q: 'Will I be on my own?', a: 'No. Bumling, the app’s own guide, and seven characters walk with you. A free first course shows you around, every app ends with a How it works section, Help answers questions, and you can work with a life coach if you want one.' },
  { q: 'I’m not ready for groups or events.', a: 'Start on your own. Circles, Run, Party and Community stay hidden until you or the setup chat bring them in, and your journal and Discover results are yours alone. Join people when you are ready.' },
  { q: 'Is there proof it works?', a: 'We will not show you a rating or a study we cannot point to. What we can show is how it works: the rules on this page are the rules the app keeps. Try it for a week and see what your first review says.' },
  { q: 'Can I leave?', a: 'Any time. From the Profile tab you can export everything, erase your progress, or delete your account. Hiding an app is one tap, and nothing is deleted.' },
  { q: 'Why do you ask for my phone and birthday?', a: 'So that everyone here is 18 or over. Nobody under 18 gets an account. Neither your phone number nor your birthday is ever shown to anyone else, and you can change the phone number under the Profile tab.' },
];

/** The questions as the home page shows them: with the invite question second while Invite only is on. */
export function siteFaq(inviteOnly: boolean): { q: string; a: string }[] {
  return inviteOnly ? [...SITE_FAQ.slice(0, 1), INVITE_FAQ, ...SITE_FAQ.slice(1)] : [...SITE_FAQ];
}

// ---------------------------------------------------------------------------
// Origins and escaping.
// ---------------------------------------------------------------------------

/** The site's origin with no trailing slash: what `PUBLIC_URL` or `SITE_URL` says when it is an http(s) address, else DEFAULT_SITE_URL. */
export function siteUrl(origin: string | undefined | null): string {
  const o = typeof origin === 'string' ? origin.trim().replace(/\/+$/, '') : '';
  return /^https?:\/\/[^/\s]+$/i.test(o) ? o : DEFAULT_SITE_URL;
}

/** JSON for an inline `<script type="application/ld+json">`: no `</script>`, no `<!--`, no raw line separators. JSON.parse reads it back unchanged. */
export function jsonForHtml(value: unknown): string {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Text made safe for HTML content or a quoted attribute. */
export function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// JSON-LD (part 5 of the kit). Pure: each returns a plain object; the caller serialises it with jsonForHtml. `origin` has no
// trailing slash (siteUrl). An empty business field is left out, never invented; there is never a rating or a review.
// ---------------------------------------------------------------------------

const CONTEXT = 'https://schema.org';

/** The business details from the Worker's business reader (`GET /api/public/business`). Any of them may be empty. */
export interface SiteBusiness {
  name?: string;
  email?: string;
  address?: string;
  registration?: string;
  vat?: string;
  grievanceName?: string;
  grievanceEmail?: string;
  grievancePhone?: string;
}

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Copies only the keys whose value is a filled string, or anything that is not a string or undefined. */
function compact(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      if (v.trim() !== '') out[k] = v.trim();
    } else out[k] = v;
  }
  return out;
}

export function organizationLd(origin: string, business: SiteBusiness): object {
  const b = business ?? {};
  const contactPoint: object[] = [compact({ '@type': 'ContactPoint', contactType: 'customer support', email: b.email, url: `${origin}/contact` })];
  if (filled(b.grievanceName) || filled(b.grievanceEmail) || filled(b.grievancePhone)) {
    contactPoint.push(
      compact({
        '@type': 'ContactPoint',
        contactType: 'Grievance Officer (India)',
        name: b.grievanceName,
        email: b.grievanceEmail,
        telephone: b.grievancePhone,
        areaServed: 'IN',
      }),
    );
  }
  return compact({
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'kreators.app',
    legalName: b.name,
    url: `${origin}/`,
    logo: `${origin}/icon-512.png`,
    email: b.email,
    address: b.address,
    taxID: b.vat,
    identifier: b.registration,
    founder: { '@type': 'Person', name: BOOK_AUTHOR },
    contactPoint,
  });
}

export function websiteLd(origin: string): object {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: 'kreators.app',
    url: `${origin}/`,
    inLanguage: 'en-IN',
    description: 'A daily game for the seven relationships that make a life, with the tools a creator needs built in. One small act a day, for all seven. Free to start, free to stay.',
    publisher: { '@id': `${origin}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${origin}/explore?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Whole paise as a schema.org price string ("1499", or "1499.50"), with no float on the way. */
function priceText(cents: number): string {
  const c = Math.max(0, Math.trunc(cents));
  const paise = c % 100;
  const whole = (c - paise) / 100;
  return paise ? `${whole}.${String(paise).padStart(2, '0')}` : String(whole);
}

export function webAppLd(origin: string): object {
  const notYet = PAYMENTS_LIVE ? '' : ' Not on sale yet.';
  const planOffers = (Object.values(PLANS) as { name: string; priceCents: number; credits: number }[]).map((p) => {
    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      name: `${p.name} (assistant plan)`,
      price: priceText(p.priceCents),
      priceCurrency: PLAN_CURRENCY,
      description: `${formatCount(p.credits)} credits for ${PLAN_DAYS} days for typing to the assistant.${notYet}`,
    };
    if (PAYMENTS_LIVE) offer.availability = 'https://schema.org/InStock';
    return offer;
  });
  return {
    '@context': CONTEXT,
    '@type': 'WebApplication',
    '@id': `${origin}/#app`,
    name: 'kreators.app',
    url: `${origin}/`,
    description: `kreators.app is a daily game for the seven relationships that make a life, with the tools a creator needs built in. Check in, do one small act and tick one task each day. ${APP_COUNT} apps, each one a switch.`,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript. Works in a modern browser on a phone or laptop.',
    inLanguage: 'en-IN',
    isAccessibleForFree: true,
    image: `${origin}/og.png`,
    publisher: { '@id': `${origin}/#organization` },
    audience: {
      '@type': 'PeopleAudience',
      audienceType: 'Anyone 18 or over building something of their own: creators, freelancers, founders, small agencies and students',
      suggestedMinAge: 18,
    },
    featureList: [
      'Daily: check in, do one small act, tick one task',
      'Seven pillars, each a pyramid from a foundation down to today’s task',
      'Life: five areas scored from what you log',
      'School: learn with a cohort and a mentor',
      'Work and Army: gigs and brand campaigns',
      'Win: content rewards paid per verified view',
      'Agency: client dashboards, invoices with GST and TDS, agreements',
      'Shop: sell downloads, courses, memberships and sessions',
      'Finance: money in and out by category and month',
      'Journal, Mood, Sleep, Stress, Mindfulness and Fitness',
      'Community, Circles, Party, Bond and Kreators Run',
      'Bumling, the assistant: free taps, typing with a plan',
    ],
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: PLAN_CURRENCY,
        description: 'The daily game, your seven pillars and every app you switch on, Agency included.',
      },
      ...planOffers,
    ],
  };
}

export function faqLd(faq: readonly { q: string; a: string }[]): object {
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function breadcrumbLd(origin: string, trail: readonly { name: string; path: string }[]): object {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: `${origin}${t.path}` })),
  };
}

export function itemListLd(origin: string, items: readonly { name: string; path: string }[]): object {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    name: 'The apps in kreators.app',
    numberOfItems: items.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: items.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${origin}${t.path}` })),
  };
}

/** Who published a book, read from its own line ("… Published by FyndFlow"); nothing when the line names nobody. */
function bookPublisher(line: string): object | undefined {
  const m = /published by\s+(.+)$/i.exec(line.trim());
  const who = m?.[1]?.trim();
  if (!who) return undefined;
  return who === BOOK_AUTHOR ? { '@type': 'Person', name: who } : { '@type': 'Organization', name: who };
}

/** One Book block for each of the founder's books, only the fields the site states; no offers (they are not sold for money). */
export function booksLd(origin: string): object[] {
  return BOOKS.map((b) => {
    const url = `${origin}/features/books#${b.slug}`;
    const cover = b.cover.startsWith('/') ? `${origin}${b.cover}` : b.cover;
    return compact({
      '@context': CONTEXT,
      '@type': 'Book',
      '@id': url,
      name: b.title,
      alternativeHeadline: b.subtitle,
      description: b.tagline,
      author: { '@type': 'Person', name: b.author },
      publisher: bookPublisher(b.publisher),
      image: cover,
      url,
    });
  });
}

/** A public event's fields as the Worker reads them (`GET /api/public/events/:id`). Text is raw here; jsonForHtml makes it safe. */
export interface SiteEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  online: boolean;
  venue: string;
  hostName: string;
  status: string;
  pricePoints: number;
  seatsLeft: number | null;
  image?: string | null;
}

const EVENT_DESCRIPTION_MAX = 300;

/** Cut near 300 characters at a word, with an ellipsis. */
function cutText(s: string, max: number): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const space = head.lastIndexOf(' ');
  return `${(space > max * 0.6 ? head.slice(0, space) : head).replace(/[\s,;:.]+$/, '')}…`;
}

export function eventLd(origin: string, e: SiteEvent): object {
  const url = `${origin}/events/${encodeURIComponent(e.id)}`;
  const venue = String(e.venue ?? '').trim();
  // Online: the page itself, never the room link. In person: the venue as typed; with none typed, no location rather than a made-up one.
  const location = e.online ? { '@type': 'VirtualLocation', url } : venue ? { '@type': 'Place', name: venue, address: venue } : undefined;
  const image = typeof e.image === 'string' && e.image.trim() ? (e.image.startsWith('/') ? `${origin}${e.image}` : e.image) : null;
  const free = e.pricePoints === 0;
  const open = e.seatsLeft === null || e.seatsLeft > 0;
  return compact({
    '@context': CONTEXT,
    '@type': 'Event',
    name: e.title,
    description: cutText(e.description, EVENT_DESCRIPTION_MAX),
    startDate: e.startsAt,
    endDate: e.endsAt,
    eventStatus: e.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: e.online ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    location,
    organizer: filled(e.hostName) ? { '@type': 'Person', name: e.hostName.trim() } : undefined,
    image: image ? [image] : undefined,
    remainingAttendeeCapacity: typeof e.seatsLeft === 'number' && Number.isFinite(e.seatsLeft) ? Math.max(0, Math.trunc(e.seatsLeft)) : undefined,
    url,
    isAccessibleForFree: free ? true : undefined,
    offers: free
      ? {
          '@type': 'Offer',
          price: '0',
          priceCurrency: PLAN_CURRENCY,
          availability: open ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
          url,
        }
      : undefined,
  });
}
