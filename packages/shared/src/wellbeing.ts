import { JOURNAL_PROMPT_CREDIT } from './core.ts';
import type { Page } from './core.ts';
import type { TrustScore } from './community.ts';
import type { ListingStatus, OfferStatus, PreownedCondition, StoreStage } from './store.ts';
import type { Unlock } from './badges.ts';

// ---------------------------------------------------------------------------
// Wellbeing logs
// ---------------------------------------------------------------------------

/** `eat` is Fitness's daily eating check-in (one a day, written only through /fitness, `@kreators/shared/fitness`). */
export type LogKind = 'mood' | 'sleep' | 'stress' | 'mindful' | 'move' | 'eat';

export interface MoodOption {
  value: number;
  name: string;
  color: string;
  text: string;
}

/** The kit's five moods and their colors, bottom to top. */
export const MOODS: readonly MoodOption[] = [
  { value: 1, name: 'Low', color: '#7F45E2', text: '#FFFFFF' },
  { value: 2, name: 'Sad', color: '#FB8728', text: '#FFFFFF' },
  { value: 3, name: 'Neutral', color: '#926247', text: '#FFFFFF' },
  { value: 4, name: 'Happy', color: '#FACC15', text: '#262626' },
  { value: 5, name: 'Overjoyed', color: '#9BB068', text: '#FFFFFF' },
];

export const STRESSORS = ['Work', 'Money', 'Family', 'Health', 'Loneliness', 'Relationship', 'Sleep', 'Something else'] as const;

export const STRESS_LEVELS = ['Calm', 'Fine', 'Tense', 'Stressed', 'Overwhelmed'] as const;

export interface WellbeingLog {
  id: string;
  kind: LogKind;
  date: string;
  value: number;
  extra: Record<string, unknown>;
  note: string;
  createdAt: string;
}

export interface WellbeingSummary {
  score: number;
  label: string;
  parts: { kind: LogKind; latest: number | null; avg7: number | null; count7: number }[];
  week: { date: string; mood: number | null; sleep: number | null; stress: number | null; mindful: number }[];
}

export function wellbeingLabel(score: number): string {
  if (score >= 80) return 'Thriving';
  if (score >= 60) return 'Steady';
  if (score >= 40) return 'Wobbly';
  if (score >= 20) return 'Running low';
  return 'Needs care';
}

// ---------------------------------------------------------------------------
// Water and reminders, for Daily and Journal. A bubble on a laptop, a section on a phone or a tablet; never a floating button on a phone.
// ---------------------------------------------------------------------------

export const WATER_GOAL_MIN = 500;
export const WATER_GOAL_MAX = 6000;
export const WATER_GLASS_MIN = 50;
export const WATER_GLASS_MAX = 1000;
/** The most one tap can add, and the most a day can hold, so a slip of the thumb cannot ruin a day's number. */
export const WATER_DAY_MAX = 10_000;
export const MAX_CUSTOM_REMINDERS = 12;
export const REMINDER_TITLE_MAX = 60;
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface WaterState {
  day: string;
  ml: number;
  goalMl: number;
  glassMl: number;
  /** Whole glasses drunk, and how many make the goal. */
  glasses: number;
  goalGlasses: number;
  /** The last seven days, oldest first, for the small chart. */
  week: { day: string; ml: number }[];
}
export interface CustomReminder {
  id: string;
  title: string;
  time: string;
  /** ISO weekdays: 1 is Monday, 7 is Sunday. */
  days: number[];
  enabled: boolean;
}
/** A task from Daily that is tagged Remember, as the water and reminders box shows it. With a day it also sends one inbox note on that day at its time. */
export interface RememberedTask {
  id: string;
  title: string;
  /** The day it is planned for (its do date, else its due date), or null: then it waits in To remember and sends no note. */
  day: string | null;
  /** The time of the note, or null for 09:00. */
  time: string | null;
}
export interface RemindersResponse {
  water: WaterState;
  custom: CustomReminder[];
  tasks: RememberedTask[];
}
export const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The days of a reminder from anything the browser sends: whole numbers 1 to 7, once each, in order. */
export function parseWeekdays(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b);
}
/** "Mon to Fri", "Every day", or the days named. */
export function weekdaysLabel(days: readonly number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && days.every((d, i) => d === i + 1)) return 'Mon to Fri';
  if (days.length === 2 && days[0] === 6 && days[1] === 7) return 'Weekends';
  return days.map((d) => WEEKDAY_NAMES[d - 1]).join(', ');
}

/** The direct store: a new product that staff added, bought through a partner link. */
export interface StoreItem {
  id: string;
  title: string;
  category: string;
  description: string;
  priceCents: number;
  currency: string;
  /** The partner link. The app sends people through /out so the tap is counted. */
  url: string;
  imageUrl: string;
  stage: StoreStage;
  featuredUntil: string | null;
  status: 'live' | 'hidden';
  clicks: number;
  createdAt: string;
  minPoints: number;
  minXp: number;
  badge: string;
  /** Whether the viewer can open it, and why not. The link is blank while locked. */
  unlock: Unlock;
}
export interface StoreKitItem {
  type: 'item' | 'listing';
  id: string;
  title: string;
  priceCents: number;
  /** For a pre-owned piece: whether it is still for sale. */
  status: string | null;
}
/** A kit: what to buy at a stage, within a budget. Items are store products and pre-owned pieces. */
export interface StoreKit {
  id: string;
  title: string;
  description: string;
  stage: StoreStage;
  budgetCents: number;
  currency: string;
  items: StoreKitItem[];
  totalCents: number;
  featuredUntil: string | null;
  status: 'live' | 'hidden';
  createdAt: string;
}
export interface PreownedListing {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerHandle: string | null;
  title: string;
  category: string;
  description: string;
  condition: PreownedCondition;
  priceCents: number;
  originalCents: number | null;
  currency: string;
  purchaseYear: number | null;
  /** What comes with it: box, charger, cables. */
  includes: string;
  images: string[];
  /** A whole setup sold together. */
  isKit: boolean;
  city: string;
  status: ListingStatus;
  soldCents: number | null;
  /** Open offers so far. */
  offers: number;
  featuredUntil: string | null;
  createdAt: string;
  mine: boolean;
  sellerTrust: TrustScore;
}
export interface PreownedOffer {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  cents: number;
  note: string;
  status: OfferStatus;
  createdAt: string;
  decidedAt: string | null;
}
export interface PreownedMessage {
  id: string;
  listingId: string;
  buyerId: string;
  senderName: string;
  mine: boolean;
  body: string;
  createdAt: string;
}
export type MarketCard = { type: 'item'; item: StoreItem } | { type: 'kit'; kit: StoreKit } | { type: 'listing'; listing: PreownedListing };
export interface MarketResponse {
  itemsPage: Page;
  listingsPage: Page;
  featured: MarketCard[];
  kits: StoreKit[];
  items: StoreItem[];
  listings: PreownedListing[];
  /** Your own listings and offers, each a page at a time (prefixes `ml` and `mo`, 10, 25 or 50, ten by default). */
  mine: { listings: PreownedListing[]; offers: PreownedOffer[]; listingsPage: Page; offersPage: Page };
  admin: boolean;
  feature: { feePoints: number; days: number; points: number };
}
export interface ListingDetail {
  listing: PreownedListing;
  /** The seller sees every offer; a buyer sees their own. */
  offers: PreownedOffer[];
  myOffer: PreownedOffer | null;
  /** The buyer's own thread with the seller. */
  messages: PreownedMessage[];
  /** For the seller: one thread per buyer who wrote. */
  threads: { buyerId: string; buyerName: string; count: number; last: string }[];
}

export const TOOL_CATEGORIES = ['Capture', 'Editing', 'Audio', 'Design', 'Scheduling', 'Analytics', 'Monetization', 'Community', 'AI'] as const;

export const PROPOSAL_STAGES = ['submitted', 'review', 'diligence', 'approved', 'rejected', 'in_progress', 'released'] as const;
export type ProposalStage = (typeof PROPOSAL_STAGES)[number];

export interface Proposal {
  id: string;
  kind: 'tv' | 'fund';
  userId: string;
  userName: string;
  title: string;
  pitch: string;
  budgetAmount: number;
  currency: string;
  stage: ProposalStage;
  createdAt: string;
  updatedAt: string;
  log: { actorName: string; fromStage: string; toStage: string; note: string; createdAt: string }[];
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  body: string;
  status: 'open' | 'answered' | 'closed';
  reply: string;
  repliedByName: string;
  createdAt: string;
  updatedAt: string;
}

export const HELP_FAQ = [
  { q: 'How do I use a discount code?', a: 'Where you pay, tap Have a discount code, type it and tap Apply. You see what it saves and the new total before you buy. A code can be for one thing or many, can run out or end on a day, and may be used once each. If it does not work, the message says why. The team pays for the discount, so a seller still gets the full price. A refund gives back what you paid, and the code is not given back.' },
  { q: 'What does Plan my week do?', a: 'On Daily, it looks at your open tasks and suggests a day for each one that has none. It puts the most important first and spreads them so no day is overloaded. It also shows how strong the plan is, out of a hundred, and a few notes on what to look at. Nothing changes until you tap Keep. It uses rules, not an AI, so it costs no credits.' },
  { q: 'What are time blocks and day templates?', a: 'A time block is a named part of your day with a colour and a tag, like Deep work from 10 am to 1 pm or Sleep from 11 pm to 7 am. A day template lays blocks on the clock, like Deep work day or Family day, and it is your kind of day. Open Time blocks from Daily, or the gear in Plan my week, to change names, times and colours, add or delete blocks, and make your own templates. You start with 18 blocks and 17 templates, Edit day, Shoot day and Plan and post day among them. It uses rules, not an AI.' },
  { q: 'How do I give one day a different template?', a: 'Open Time blocks and tap the day in the week. Pick a template under Kind of day, or pick Follow your week to undo it. That changes only that date. To change every Monday, say, set it under Your usual week. Daily has the same Kind of day picker for its own day.' },
  { q: 'How do tasks get into a time block?', a: 'Pick a block in the task\'s form. With none picked, a task with a time sits in the block that time falls in, and a task with no block or time shows as Suggested in the block that fits, with Keep here. Plan my week suggests a block from the task\'s area of life and pillar, and nothing changes until you keep it. On Daily, sort By time block or By area to see tasks in coloured boxes; P0 stays first in each.' },
  { q: 'How do I see my tasks in Google, Apple or Outlook Calendar?', a: 'Under Profile, switch on Calendar. You get a private address to subscribe to in your calendar app. It shows each open task that has a day, with its time when it has one. It never shows notes, your journal or your mood. A fresh link closes the old one. It shows your tasks in the calendar; it does not change them from there.' },
  { q: 'Can I change how dates and times read?', a: 'Yes. On the Profile tab, Dates and times sets your time zone, your date format and a 12 or 24 hour clock. Every screen follows it, and your reminders arrive by that zone. Printed paper keeps its own format.' },
  { q: 'Can the app block other apps or websites while I focus?', a: 'No. A web app cannot block other apps. What it can do is time your focus sessions, play a background sound, and show how focused each one felt. Use your phone\'s own focus mode, or a blocker app, beside it.' },
  { q: 'What is Agency, and who is it for?', a: 'Agency is for a content agency or a freelance creator who makes videos, posts, scripts and newsletters for clients. Add a client, then move each deliverable from idea to published. Log your time, make invoices and agreements, and share a page where the client approves what is waiting. Show it under Features.' },
  { q: 'How do I share a dashboard with a client?', a: 'Open the client, find Client link and switch it on. Copy the link and send it. Under it you pick what they can see (what is waiting, coming up, published, the month so far, notes, and more) and what they can do (approve or send back, write notes). Use Open preview to see exactly what they see. A fresh link closes the old one.' },
  { q: 'What can a client never see?', a: 'Your private notes, your fee for each piece and the retainer amount, your time line by line, your other clients, and what a brand wrote in Army. Hours, invoices, agreements and channels stay off until you switch them on.' },
  { q: 'Can a client read and download an invoice or an agreement?', a: 'Yes. Each has its own link they open without signing in. They can save a copy as a PDF (the Download PDF button uses your browser\'s print and save), and write a comment to ask for a change. You switch each of those off per invoice or per agreement, and you can switch off the bank details, tax numbers, due date and notes on one invoice.' },
  { q: 'Can I change an invoice or an agreement after I sent it?', a: 'Yes. Change it and the client sees the new version at the same link, marked Revised with the date. A paid invoice must be marked sent again first, so your money records stay true. A signed agreement is a record: use Revise to make a new draft from it.' },
  { q: 'How do I copy an invoice for next month?', a: 'Open it and tap Duplicate. The copy takes the next number in the same series, today\'s date, and the same gap to the due date. A month written in the lines, like 2026-09, moves on with it.' },
  { q: 'Who sees business metrics in Reviews?', a: 'Only you, and only after you switch them on. They sit in Reviews under the numbers. Type a number for each period, or read it from Agency. They never appear anywhere else.' },
  { q: 'What are the daily three?', a: 'Check in, do the small act, tick one task. They are on Daily. Each one you tick pays xp. The check-in pays points too.' },
  { q: 'What are the seven pillars?', a: 'The seven relationships that make a life, one pillar each. Each pillar has a pyramid: a foundation at the top, then a guiding principle, a value goal, a goal outcome, a project, and tasks at the point at the bottom. Tick a task and its xp runs up through every layer above it.' },
  { q: 'What is a small act?', a: 'One quick thing for your weakest pillar, picked for you each day. It takes two minutes and pays fifteen xp.' },
  { q: 'What if I miss a day?', a: 'Your streaks start again, and nothing else is lost. A missed day never takes xp away. Open tasks stay on Daily until you tick them, and one past its due date says Overdue. If you signed a contract, Daily shows your routine days against it, and a coach you share your routine with sees a short week. Pick up where you left off.' },
  { q: 'Why can I not tick a task yet?', a: 'A task needs ten minutes after being written or renamed before it can be ticked, and it cannot be ticked before its do date. Only six ticks a day pay xp; the rest still count as done.' },
  { q: 'What is the difference between a do date and a due date?', a: 'The do date is the day you will do the task. It shows on Daily from that day and cannot be ticked before it. The due date is the deadline. After it the task says Overdue, but you can still tick it. The do date cannot come after the due date.' },
  { q: 'What do P0, P1, P2 and P3 mean?', a: 'They are priority tags. P0 (red) is do now, P1 (orange) is important, P2 (purple) is normal and P3 (grey) is whenever. Pick one on a task, then sort Daily by priority. A tag never changes what a tick pays.' },
  { q: 'What is Emerging?', a: 'Patterns the app notices in what you already log: a task you keep ticking, or how sleep and mood went on the same days. It says what happened together, never what caused what. Only you see it, unless you switch Patterns on for a life coach. Nothing is stored, and your journal is counted by day, never read. Find it on Home under Emerging, or open the Emerging page.' },
  { q: 'How do I make a task repeat?', a: 'Tap the pencil on a task and pick Repeat: every day, on weekdays, every week on days you choose, every month or every year, every one or more of them, with an end day if you like. It needs a do date or a due date. When you tick it, the next one is made. A repeating task shows a Habit tag.' },
  { q: 'Where did my task with no date go?', a: 'Under Not scheduled yet, below Tasks on Daily. It stays there until you pick a do date or a due date. Then it moves up into Tasks on that day.' },
  { q: 'What is Close the unfinished?', a: 'A button on Home, shown while one of these tasks is open. It opens Daily showing only your unfinished business: the tasks marked Unfinished, Unresolved or Undecided, each kind in its own box. Mark a task in its plan, and end it there: do it, give it a time and date, or let it go. What you let go waits under Let go, so you can bring it back.' },
  { q: 'What are subtasks, and what does Remember do?', a: 'Subtasks are a small checklist inside a task. They pay no xp. Remember is a tag for things to keep in mind. With a day, it also sends a note to your inbox on that day, at its time (9:00 when it has none). With no day, it waits in To remember on Daily. Tasks the strategy session made for you carry a From pillar tag, and tasks that repeat carry a Habit tag.' },
  { q: 'How do I focus on one task?', a: 'Tap the pencil on a task, add how many minutes it takes, then tap Start focus. Mindfulness opens with that task picked and that many minutes on the timer. The Focus dashboard there can show your time in minutes or hours.' },
  { q: 'Points versus xp?', a: 'Xp levels you and your pillars up. Points come from showing up. You can trade points for rewards, for things people sell, and for events.' },
  { q: 'How do I sell something?', a: 'Open Shop from Apps, or Show it there. Make a product, publish it, and share your public page.' },
  { q: 'How do I get work?', a: 'Work lists opportunities from brands and the team. Apply once per opportunity and follow its status in Work.' },
  { q: 'Is the Companion a therapist?', a: 'No. It reflects and asks questions. If you are in danger, contact your local emergency number or go to the nearest hospital. In India, Tele-MANAS is 14416.' },
  { q: 'Where do the journal prompts come from?', a: `Under Prompt me in Journal there are prompts in sixteen categories, such as shadow work, inner child, gratitude, boundaries, manifestation scripting, 3-6-9 writing, money, body and a weekly reset. Each says why it helps and what you can reasonably expect. ${JOURNAL_PROMPT_CREDIT} They are for reflection, not therapy or medical advice, and a hopeful prompt is a planning tool, not a promise. Which prompts you were shown stays on your device and is never sent to us or to the assistant.` },
  { q: 'Who can see my journal?', a: 'Only you, unless you share. Journal entries, gratitude lines and wellbeing scores are never shown to brands, staff, the leaderboard or Club selection. A life coach sees your journal or gratitude only if you switch that table on for them, with Show to my coach at the top of the table or under your coach on your Profile tab. The assistant reads your journal only when you ask about it, and only with a model that keeps nothing. Show to AI chat on the table lets it and the Companion read the whole table, with that kind of model too.' },
  { q: 'What are Games?', a: 'Nine card games you unlock once with points in Rewards, then play in the app. You shuffle, draw, flip and drag cards around a table. Nothing is posted to you. Games switches on when you unlock your first one.' },
  { q: 'What is focus mode?', a: 'On a game table, or on the focus timer in Mindfulness, the icon with four corner brackets hides the menu, the assistant and everything else, so it has the whole screen. Press Escape or tap the icon again to leave.' },
  { q: 'What is Discover?', a: 'A quiz about how you think, feel and act, with puzzles and real situations. It shows your top strengths across the seven relationships, a detailed read on five personality traits and on your reasoning, and, if you add it, your emotional intelligence. It is a self-check, not an IQ test or a diagnosis.' },
  { q: 'What are the type, love languages and mind self-checks in Discover?', a: 'Three short self-checks under More ways to know yourself. 16 personality types, in the style of Myers-Briggs (MBTI), gives four letters out of sixteen, with what each side means for you. Love languages shows how you like to be shown love and how you show it, which can differ. How your mind works shows how often attention, energy and impulse, and patterns and senses show up for you. It is not a test for ADHD or autism, and only a trained professional can say what is going on.' },
  { q: 'What is Human design in Discover, and how exact is it?', a: 'Human design is a system for self-reflection, not science. Enter your birth date, time and the time zone of your birthplace. The app works out where thirteen bodies stood at your birth and when the Sun stood 88 degrees earlier, then shows your type, strategy, authority, profile and channels, in the tropical zodiac and in the sidereal one (Fagan-Bradley), in three layers: body, mind and purpose. Positions are good to a few arc minutes, a little less for the outer planets, and a line that sits right on an edge is marked. Each part of the reading becomes a goal you can add as a task.' },
  { q: 'Can I turn the timer sounds off?', a: 'Yes. In Mindfulness, the first switch under Sounds and alarms turns off every beat, chime, background sound and buzz at once. Your other choices stay saved. Otherwise you can choose a soft beat for the mini break (one beat) and the long break (three beats), a background sound with its volume, and whether a phone buzzes. These follow your account to every device.' },
  { q: 'Are there keyboard shortcuts for the focus timer?', a: 'Yes, on a laptop, in Mindfulness. Space starts or pauses the clock. S stops it. K skips to the next part of a Pomodoro. A question mark shows the list. They do nothing while you type in a box.' },
  { q: 'Can I change or delete a focus session, or add one I forgot?', a: 'Yes. Your sessions from today are listed under the timer. Tap one to change its length or its task, or to delete it. If it also counted as mindful minutes, those change with it. Tap Add a session I forgot to add one for today or yesterday. Continue on a row starts the same task and length again.' },
  { q: 'What happens if I stop a timer early?', a: 'Once a whole minute has passed, you choose: keep the minutes so far, or throw them away. Under a minute, nothing is kept.' },
  { q: 'Can I set a daily focus goal or a reminder?', a: 'Yes, both are off until you switch them on in Timer settings. A goal shows how many minutes you have done today against it, and the dashboard counts the days you met it. There is no streak and nothing to lose. A reminder sends one inbox note on the days you pick, at your time, and skips a day you already focused.' },
  { q: 'Can I choose which app groups start open, and the order of apps?', a: 'Yes. Under Profile, Features, each group has a switch for whether it starts open or closed on Apps, in the menu and in the sidebar; Contribution and Essentials start open until you pick. Tap Arrange apps to drag the apps of a group into your own order, or use the arrows. Apps stay in their own group. Your choice is kept on your account, so it follows you to every device, and Reset order in a group\'s More menu puts it back.' },
  { q: 'How many devices can I use at once?', a: 'Three. Your account can be signed in on three devices at the same time, such as a phone, a laptop and a tablet. When you sign in on a fourth, the one that has been signed in the longest is signed out to make room, and it tells you why when you open it. Your progress is kept on your account, so signing in again brings everything back. Changing your password signs out every other device at once.' },
  { q: 'What does numerology in Discover work out?', a: 'It sits beside the body, mind and purpose layers of Human design. From your birth date it gives your life path, birthday number and attitude. From the full name on your birth record it adds your expression, soul urge, personality and maturity, and the numbers your name is missing. It shows where you are in your personal year, month and day, keeps the master numbers 11, 22 and 33 whole, and points out the turning point 10 and the karmic numbers 13, 14, 16 and 19. Then it sets your numbers next to your Discover answers: where they agree, where they stretch you, and how they fit your Human design. Numerology is a system for reflection, not science.' },
  { q: 'How much will a reward pay me?', a: 'Open the reward and use What could I earn. Type the number of views your post might get and it shows the points. Nothing is paid under the minimum views, a post stops earning at the most one post can pay, and a reviewer must confirm the views first. The pool also has to have points left.' },
  { q: 'Can I answer buyers’ questions on my product page?', a: 'Yes. In the product editor, add up to six questions and answers, such as who it is for and how long it takes. They show as a fold-out list at the foot of the page.' },
  { q: 'What is the line of the day on Home?', a: 'One line under Water and reminders, from a philosopher or written for this app, in turn. It changes every day, and every line is shown once before any comes back, which takes about a year. Nothing is saved about you, and the same day shows the same line to everyone. Another line shows a new one, a tip or a quote, when you want it.' },
  { q: 'Who sees my Discover results?', a: 'Only you. They never reach brands, staff, the leaderboard or a life coach. You choose whether they shape your next steps on Home, and whether the assistant may read a short summary. You can delete a result any time.' },
  { q: 'Why are my apps in this order?', a: 'Each group keeps one order, so an app stays where you last saw it, with the ones you have not hidden first. Your own order comes before it: tap Arrange apps under Profile, Features.' },
  { q: 'Where is the water button?', a: 'On a phone or a tablet, the Water section is inside Home, Daily and Journal. On a laptop, it is a small bubble at the left of Daily and Journal, and still a section on Home. A game table has a Water button of its own.' },
  { q: 'Why did water reminders stop?', a: 'The app no longer sends water notes to your inbox. Your goal, your glasses and your week stay. If you want a nudge, add your own reminder under Reminders in the water card.' },
] as const;
