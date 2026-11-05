import { MAX_CHANNEL_MEMBERS, MAX_MENTIONS, MAX_PINNED } from './community.ts';
import { ATTENDEE_CLAIMS_PER_DAY, ATTENDEE_XP_DEFAULT, ATTENDEE_XP_MAX, CIRCLE_MINUTES, RUN_CODE_WINDOW } from './events.ts';
import { MAX_COACHES } from './coaching.ts';

// ---------------------------------------------------------------------------
// How each app works, in three steps, and the words we made up, in plain ones
// ---------------------------------------------------------------------------

/** Every term the app coined, with its meaning. Shown under "Words we use" and in each app's how-to. */
export const TERMS: Record<string, string> = {
  pillar: 'One of the seven relationships in your life, as a place in the app. Each pillar is a pyramid.',
  pyramid: 'How a pillar is built: a foundation at the top, then a guiding principle, a value goal, a goal outcome, a project, and tasks at the point at the bottom.',
  foundation: 'The first layer of a pillar, at the top: one thing you will not let break, ever.',
  'guiding principle': 'The second layer: a line you live by, so the foundation holds.',
  'value goal': 'The third layer: how you want to feel more often. No numbers, just the feeling.',
  'goal outcome': 'The fourth layer: what you would see when the value goal is real.',
  project: 'The fifth layer: a bunch of tasks with a finish line.',
  task: 'The point of the pyramid, at the bottom: one small thing you can tick off today. Each one pays xp and sends a ripple up.',
  'small act': 'One two-minute thing a day for your weakest pillar, picked for you. It should stretch you, not stress you.',
  'check-in': 'The first box on Daily. Ten xp, ten points, and it keeps your streak.',
  streak: 'Days in a row. A check-in streak pays extra every seventh day.',
  xp: 'Progress. It fills your level and your pillars. It is never spent.',
  points: 'Spendable. Earned by showing up and selling, spent on rewards and featured spots.',
  level: 'Where your xp has got you. Each level needs more than the last.',
  badge: 'A medal for something you did, earned by the app\'s own count and never taken back. It comes in bronze, silver, gold or platinum. Badges from your journal, money or focus time stay yours alone.',
  honor: 'A badge the team gives, or time unlocks.',
  ripple: 'Xp that runs up from a ticked task to every layer above it.',
  'chat channel': 'A chat room for one topic. In Community, guides open them and anyone can join. In Bond, you make a private one for your friends.',
  bumling: 'The app’s own guide. Bumling helps you set things up and runs the chats about the whole app, not one relationship.',
  'do date': 'The day you will do a task. It shows on Daily from that day, and cannot be ticked before it.',
  'due date': 'The day a task must be done by. After it the task says Overdue, but you can still tick it.',
  'day type': 'What kind of day it is, picked on Daily: deep work, money, family, rest and more. Sorted By context, P0 stays on top and each priority starts with the pillar that kind of day leads with.',
  priority: 'A tag from P0 to P3 on a task. P0 is do now, P1 important, P2 normal and P3 whenever. It helps you choose and sort, and never changes what a tick pays.',
  habit: 'A task that repeats every day, week, month or year. When you tick it, the next one appears.',
  'good habit': 'A task you keep doing, set beside how your days went. On days you did it, your mood, sleep, stress or other tasks were clearly better than on days you did not. It says they went together, not that one caused the other.',
  'bad habit': 'A task you keep doing, or a slip on your not to do list, on days that clearly went worse: a lower mood, less sleep, more stress or fewer tasks. It says they went together, not that one caused the other.',
  emerging: 'A pattern the app noticed in what you logged, like a task you keep doing or a link between sleep and mood. It says what happened together, never what caused what.',
  subtask: 'A small step inside a task. It has its own tick box, pays nothing, and never stops you ticking the task.',
  remember: 'A tag for things you want to keep in mind. With a day, it also sends a note to your inbox on that day, at the task’s time or at nine in the morning. With no day, it waits in the To remember list on Daily.',
  'not scheduled': 'Tasks with no do date and no due date. They wait in a list under Tasks until you pick one.',
  'daily three': 'Check in, the small act, one task.',
  'not-to-do': 'Things you stay away from, each with its own streak of kept days.',
  'kept day': 'A day you ticked a not-to-do: you stayed away from it.',
  'who you are becoming': 'The character on Daily that changes as your xp grows.',
  'life score': 'One number for the five areas of life, from what you log.',
  'five areas of life': 'Physical, financial, mental, emotional and spiritual, in that order, since each one holds up the next: another way to read the seven relationships.',
  period: 'A week, a month, a quarter or half a year, for a review or a dashboard filter.',
  review: 'Your own look back at a period: the numbers from every app, then your answers.',
  'plan strength': 'How well the week is planned: days with something on them, days that are not overloaded, and tasks that say how long they take.',
  pace: 'Whether a project is moving as fast as its due day needs: on track, slipping or behind.',
  retainer: 'What a client pays you each month for an agreed amount of work.',
  deliverable: 'One item of content you make for a client: a video, a post, a script, a newsletter. It moves from idea to published.',
  'client link': 'A page you can share with a client. They see what is waiting for them and can approve it or send it back. Nothing else.',
  utilisation: 'The share of your working hours that you spent on work a client pays for.',
  paperwork: 'In Agency, the invoices, agreements and other documents you send a client, kept in one place.',
  'team member': 'In Agency, someone you asked to work with you: an editor, a videographer, a content creator or a client. You choose what each one can open.',
  'first pass': 'A piece the client approved without sending it back.',
  trust: 'A score out of 100 from what a seller earned here: xp, points, streaks, time, sales and honors.',
  featured: 'A week at the top of the Store or Tools. Staff give it; a seller pays 200 points.',
  'partner link': 'A link to another shop. kreators.app may earn a share if you buy.',
  'pre-owned': 'Gear another creator is selling. You make an offer; the two of you settle the rest.',
  kit: 'What to buy at a stage, within a budget: new and pre-owned pieces added up.',
  offer: 'Your price for a pre-owned piece. The seller accepts or declines.',
  'discount code': 'A word the team gives out that takes a percent or an amount off a price. Type it where you buy, under Have a discount code. It can work once, a few times or until a day passes.',
  unlock: 'Some things ask for a points balance, a badge, or both before you can buy them. A card game is unlocked once with points and then yours for good.',
  'personality type': 'Your 16 personality types result: four letters from a self-check in the style of Myers-Briggs (MBTI), one from each of four pairs: outward or inward, hands-on or big picture, head or heart, planned or open. One of sixteen types. It is not the official MBTI®, and no type is better than another.',
  'love language': 'A way of feeling cared for or showing care: words, time, gifts, help or touch. Discover shows how you like to receive love and how you give it. They can differ.',
  'human design': 'A system for self-reflection, not science. From the date, time and place of your birth it draws a chart of your type, strategy, authority and profile. The app uses it as a set of prompts, and turns them into goals.',
  numerology: 'A system for reflection, not science, that reads the numbers in your birth date and your name. Discover works out your life path, your birthday number, your attitude and, from your full birth name, your expression, soul urge, personality and maturity, and where you are in your personal year, month and day.',
  'master number': 'In numerology, 11, 22 and 33 are kept whole instead of being added down to 2, 4 and 6. They are read as a bigger version of the number under them, and as a heavier load. 10 is a turning point that settles down to 1, and 13, 14, 16 and 19 are called karmic debts.',
  gate: 'One of sixty-four slices of the zodiac, each with a keynote, such as Gate 25, the spirit of the self. Each gate has six lines. Your chart is the gates the planets were in when you were born, and 88 degrees of the Sun before.',
  channel: 'Two gates that are both on in your chart, which join two centers. A channel is a steady skill or way of being. Thirty-six are possible.',
  sidereal: 'A zodiac measured against the fixed stars, not the seasons. Discover uses the Fagan-Bradley shift, about 24.7 degrees back from the tropical zodiac, which is the one Human design is drawn in.',
  signs: 'In How your mind works, how often things like losing track of time or needing routines are true for you. Signs are not a diagnosis. Only a trained professional can say what is going on.',
  strength: 'One of seven things you are good at in Discover, one for each relationship, such as Connecting or Getting it done. It comes from your answers, not from a comparison with other people.',
  'focus session': 'A stretch of work with a timer, followed by a mini break. After a few sessions comes a longer break. Finished sessions are kept for your own chart.',
  'focus mode': 'A view that hides the menu and the assistant so one screen has all the room. On a game table it is the icon with four corner brackets. Press Escape or tap it again to leave.',
  deck: 'A pile of cards in a card game. A game has one deck or several, and you pick which to draw from.',
  Pro: 'A paid plan that gives credits for typing to the assistant, and the Pro mark.',
  Club: 'A curated membership the team reviews you into.',
  cohort: 'A group that goes through a program together, with dates.',
  campaign: 'A brand brief that pays points per verified view.',
  bounty: 'A smaller brief with a fixed prize for the best entries.',
  'public page': 'Your page at kreators.app/u/you: links, products, posts and badges you choose to show.',
  circle: 'A small anonymous table near you, matched by interests, that meets once.',
  alias: 'The made-up name you carry in circles and Bond chats. Nobody sees the real one.',
  guide: 'A team member who keeps the community kind.',
  'run club': 'A group that runs together. Anyone can start one; members log runs with the start code.',
  'start code': 'The code the host shows at the start line: six letters, or a word the host picks. Enter it during the run and your entry is logged, once. That is how a run pays without anyone cheating.',
  'attendee code': 'The code a host shows at their event. The guests on its list type it in to get the xp the host set, once each. The xp is fixed when the code opens, thirty minutes before the start. Hosts give it; they never claim it.',
  collab: 'A brand offer to run clubs: what the brand gives, what it asks, and a giveaway for the runners. A host applies with the club.',
  giveaway: 'What a brand gives runners at a collab run: shoes, a kit, a voucher. Listed on the collab before anyone applies.',
  'brand folder': 'One place for one brand in Content: its links, the research done on them, and the pieces written from that.',
  outlier: 'A video or post that did far better than the rest of its channel or niche. Research sorts them to the top.',
  hook: 'The first line of a video or post, the part that decides whether anyone stays.',
  piece: 'Something Content wrote for a brand: an audit, a plan, a calendar, ideas, hooks, a script, posts, or a breakdown.',
  'strategy session': 'The setup for your pillars, in Pillars, whenever you want it: a few minutes that place all seven relationships on the map, name what gets in the way, and leave you with a focus, a routine and a contract.',
  'setup chat': 'The short chat at the start. It asks what you want, who you are and what gets in your way, then switches on the apps that fit. Run it again from Profile.',
  'identity tag': 'A word for who you are, like Student or Video editor, from the setup chat or in your own words. Your tags pick your apps and fill in your skills and interests. They never show on your public page.',
  map: 'Sixteen levels, from Shame to Oneness, that name how you act in each relationship. You see names, never numbers.',
  'life map': 'The page under Pillars that keeps everything the strategy session found: all seven on the map, your scores, what gets in the way, your routine and your contract.',
  assistant: 'The round button at the bottom right of every screen. Tap a flow to log something by answering a question or two, free for everyone. With a plan you can also type what you did, and it is done in the app for you, each change with an Undo.',
  credits: 'Credits are what typing to the assistant runs on; a typical message is about 12. A plan gives credits each month. Top-ups and team grants add more that do not run out.',
  'top-up': 'Extra credits on top of your plan. They stay until you use them, after the plan\'s own credits are gone.',
  core: 'Where you usually live on the map, in one relationship.',
  floor: 'Where you drop to under stress, in one relationship. A floor under Courage marks that pillar as a good place to start.',
  routine: 'Six blocks a day, built from your real day and moved thirty minutes a week. The morning block counts only when every step is ticked.',
  contract: 'Your signed deal: days a week, a check-in time, and what a short week costs.',
  'life coach': 'Someone the team made a life coach. Once you both say yes, they see the parts of your progress you share, leave you notes and add tasks. Never your journal. Their badge says Life coach.',
  student: 'Someone a life coach works with, once both said yes. In the setup chat, Student means someone at school or college.',
  'daily brief': 'The card at the top of Home: three things that changed and three next steps, worked out each day from your own numbers. It costs nothing and only says what your numbers back up.',
  reaction: 'One of six ways to answer a post or a reply without words: Like, Celebrate, Support, Love, Insightful or Funny. Your first reaction on a post is the like that pays.',
  mention: 'An @ and someone’s page name in a post or reply. It tells them, in their inbox under Replies and mentions.',
  season: 'One month on the leaderboard. Everyone starts level on the first; the top three when it ends keep the Season top three honor.',
  'change log': 'The list at the end of a coaching page: every ask, yes, note and task change between a coach and a student, with when it happened.',
  username: 'Your own name in the app, like @sam_k. Nobody else has it. It is also your public page address. Change it under Profile.',
  'friend code': 'Eight letters and numbers, yours alone. Give it to someone you know; they type it in Bond and you get a friend request.',
};

/** True for the username an account is given at sign-up, before the person picks their own. */
export const isAutoHandle = (handle: string | null | undefined): boolean => !handle || /^user_[a-z0-9]{6,8}$/.test(handle);

/** The glossary's categories, in the order they are shown. Every word in TERMS is in exactly one; the words inside each are sorted A to Z by `termGroups`. */
export const TERM_GROUPS: { name: string; terms: string[] }[] = [
  { name: 'Pillars and pyramids', terms: ['pillar', 'pyramid', 'foundation', 'guiding principle', 'value goal', 'goal outcome', 'project', 'task', 'ripple', 'map', 'life map', 'strategy session', 'routine', 'contract', 'core', 'floor'] },
  { name: 'Daily and progress', terms: ['small act', 'check-in', 'daily three', 'do date', 'due date', 'priority', 'day type', 'habit', 'good habit', 'bad habit', 'emerging', 'subtask', 'remember', 'not scheduled', 'daily brief', 'not-to-do', 'kept day', 'streak', 'xp', 'points', 'level', 'who you are becoming', 'life score', 'five areas of life', 'period', 'review', 'season'] },
  { name: 'You and your page', terms: ['strength', 'personality type', 'love language', 'signs', 'human design', 'gate', 'channel', 'sidereal', 'numerology', 'master number', 'username', 'identity tag', 'setup chat', 'public page', 'badge', 'honor', 'trust', 'unlock'] },
  { name: 'Friends and community', terms: ['friend code', 'chat channel', 'alias', 'circle', 'reaction', 'mention', 'guide', 'life coach', 'student', 'change log', 'run club', 'start code', 'attendee code', 'deck', 'focus mode', 'focus session'] },
  { name: 'Learn and earn', terms: ['cohort', 'campaign', 'bounty', 'Club', 'collab', 'giveaway', 'retainer', 'deliverable', 'client link', 'utilisation', 'paperwork', 'team member', 'first pass', 'plan strength', 'pace'] },
  { name: 'Shop and store', terms: ['featured', 'partner link', 'pre-owned', 'kit', 'offer', 'discount code'] },
  { name: 'Content', terms: ['brand folder', 'outlier', 'hook', 'piece'] },
  { name: 'Assistant and plans', terms: ['bumling', 'assistant', 'Pro', 'credits', 'top-up'] },
];

/** The glossary by category, each category and each word in it sorted A to Z, ignoring case. Any word not placed lands under Other. */
export function termGroups(): { name: string; terms: [string, string][] }[] {
  const placed = new Set(TERM_GROUPS.flatMap((g) => g.terms));
  const loose = Object.keys(TERMS).filter((t) => !placed.has(t));
  const groups = loose.length ? [...TERM_GROUPS, { name: 'Other', terms: loose }] : TERM_GROUPS;
  const az = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' });
  return groups
    .map((g) => ({ name: g.name, terms: g.terms.filter((t) => t in TERMS).sort(az).map((t): [string, string] => [t, TERMS[t] ?? '']) }))
    .filter((g) => g.terms.length > 0)
    .sort((a, b) => (a.name === 'Other' ? 1 : b.name === 'Other' ? -1 : az(a.name, b.name)));
}

export interface HowTo {
  /** Three to five concrete steps, each a sentence or two: what happens, what it pays, where it goes. */
  steps: string[];
  terms: string[];
}
/** How every app works, by module key, shown at the bottom of its main screen, plus the terms it leans on. */
export const HOW_TO: Record<string, HowTo> = {
  assistant: {
    steps: [
      'Tap the round button at the bottom right of any screen. The assistant opens over the page, so you can watch each change land.',
      'Tap a flow to log something by answering a question or two: a check-in, a task, your sleep, money in or out. The flows are free for everyone.',
      'With a plan you can also type what you did, like “I edited the vlog and slept six hours”. It does it in the app as you, then lists each change with an Undo. Removing things and settling money wait for your Confirm.',
      'Typing spends credits, and a typical message is about 12. Pro gives 10,000 credits a month, Pro Max 100,000 and Ultra 400,000. Each plan also caps what one message and one day can spend.',
      'It earns the same xp and points as a tap, waits the same waits, and never sees anything that is not yours. It reads your journal only when you ask about it.',
    ],
    terms: ['assistant', 'credits', 'top-up'],
  },
  home: {
    steps: [
      'Home opens after sign-in and answers “how am I doing” before “what do I do”. Under Water and reminders sits a line of the day, from a philosopher or from us, a new one every day. Your daily brief comes first: three things that changed and three next steps, from your own numbers. In your first two weeks a Getting started list sits under it and ticks itself as you go.',
      'Under them sits what moves those numbers: the three boxes on Daily, your trackers, and your money and shop when those apps are on.',
      'Up next lists the events, runs, sessions and circles you are booked into, soonest first.',
      'Pick a period at the bottom to see the same numbers by week, month, quarter or half year, next to the period before.',
      'The search box at the top finds apps, tasks, people, products and more as you type.',
    ],
    terms: ['daily brief', 'xp', 'points', 'level', 'streak', 'period', 'assistant'],
  },
  insights: {
    steps: [
      'Emerging reads what you already log, like tasks, check-ins, sleep, mood, focus and money, and points out patterns. Nothing new is asked of you.',
      'A task you tick on 3 different days in 4 weeks, and that does not repeat yet, shows as a habit you could keep. Good and bad habits go further. They set a task you keep doing, or a slip on your not to do list, beside how those days went: your mood, your sleep that night, your stress and your other tasks. A clear lift is a good habit and a clear dip is a bad one. Each needs 5 days with it and 7 without, and until then it waits under Still watching. Make it a habit and Add to not to do change nothing until you tap the button in their sheet.',
      'Links between apps say what happened on the same days, with how many days each side: “On days after 7.5 hours of sleep, your mood was 3.9.” They never say one thing caused the other, and they wait until each side has enough days: at least 4, and for most links 5 to 10.',
      'Each app shows the patterns that touch it, and Home shows the strongest three. A pattern from an app you switched off is not shown.',
      'Only you see these. Your journal is counted by day, never read. Nothing here is stored or sent anywhere.',
    ],
    terms: ['emerging', 'habit', 'good habit', 'bad habit', 'not-to-do', 'pillar', 'streak', 'period', 'day type'],
  },
  today: {
    steps: [
      'Daily is three boxes a day: check in, do the small act, tick one task. Checking in pays 10 xp and 10 points and keeps your streak; every seventh day in a row pays 50 points more. The small act is a two-minute thing for your weakest pillar and pays 15 xp. Your routine from the strategy session sits under the first box.',
      'Tasks come from the pillars you set up. Each pays 20 xp and sends a ripple up its pyramid. A task has a do date, the day you will do it, and can have a due date, the deadline. It shows here from its do date and cannot be ticked before it. After its due date it says Overdue, but you can still tick it. A new task waits ten minutes before it can be ticked.',
      'Tap the pencil on a task to plan it. Tag it P0 (do now), P1, P2 or P3 (whenever), in red, orange, purple and grey, and sort the list by day, priority or due date. Pick what kind of day it is under Tasks, a deep work day say, and the list sorts By context: P0 stays on top, and inside each priority the pillar that day leads with comes first. Make it repeat every day, week, month or year, and the next one appears when you tick it; that makes it a habit. Add subtasks, say how many minutes it takes, tag it Remember, and start a focus session on it. Remember tasks with no day wait in a To remember list on Daily, and with a day they also send a note to your inbox.',
      'A task with no date waits under Not scheduled yet. It stays out of Tasks until you pick a do date or a due date, and then it moves up. Plan my week suggests a day for each one, spread so no day is overloaded, and shows how strong the plan is; nothing changes until you keep it. Tasks with a time show as time blocks, with the free time between. Open Month calendar to see the whole month: tap a day to tick its tasks or add one, and tap Print this month for a paper copy.',
      'Under the tasks, the not-to-do list holds up to seven things you are staying away from. Tick one to say you kept it today: a kept day pays 5 xp and grows that item’s streak. At the bottom, who you are becoming shows the figure your xp is filling in.',
    ],
    terms: ['daily three', 'check-in', 'small act', 'task', 'do date', 'due date', 'priority', 'day type', 'plan strength', 'habit', 'subtask', 'remember', 'not scheduled', 'not-to-do', 'kept day', 'who you are becoming', 'routine', 'assistant'],
  },
  tower: {
    steps: [
      'Pillars has its own setup, the strategy session, for whenever you want it: a few minutes that place all seven relationships on the map (where you usually live, where you drop under stress), score your health and wealth, and build a routine and a contract from your real day. Your life map, under Pillars, keeps every answer and can be run again. Or set up one pillar at a time with a short vibe check, three taps each.',
      'Each pillar is a pyramid with six layers. The foundation is the one thing you will not let break. The guiding principle is a line you live by so it holds. The value goal is how you want to feel more often. The goal outcome is what you would see when that is real. Then a project, and tasks at the tip.',
      'Your answers build the first four layers; you pick or write the project and its tasks. Tick a task on Daily and the glow runs up to the foundation: 20 xp for the task, then a smaller ripple to each layer above it. Clear every task in a project for 30 xp more.',
      'Every pillar has a level and a character that grows with it. The weakest pillar is the one that sends your small act.',
      'Open a pillar to see its pyramid, add tasks, give them dates and times, and archive what no longer fits. A project with a due day shows its pace: on track, slipping or behind, from how many tasks are done against how much time has gone.',
    ],
    terms: ['pillar', 'pyramid', 'foundation', 'guiding principle', 'value goal', 'goal outcome', 'project', 'task', 'ripple', 'strategy session', 'life map', 'core', 'floor', 'pace', 'assistant'],
  },
  apps: {
    steps: [
      'Apps lists only what is on, in groups by what they are for: Contribution, Creation, Connection, Reflection, Essentials and Operations. Tap one to open it.',
      'The button at the top, Turn apps on or off, leads to Profile, Features, the one place every app is switched on or off.',
      'An app you switch on joins this list, the laptop sidebar under its group, and the phone menu under the top-right button.',
      'The setup chat at the start switches on the apps that fit who you are and what you want, and leaves the rest off. Run it again from Profile, or switch any app yourself.',
    ],
    terms: ['setup chat', 'identity tag'],
  },
  you: {
    steps: [
      'Who you are sits at the top: the identity tags from the setup chat. Run the setup again to change them and the apps that fit. Your account, badges, honors and life coach live here too: say yes to a coach, pick what they see, or end it.',
      'Badges are medals the app earns for you by its own count: ticks, streaks, pillars, community, your shop, runs, lessons and levels. Each is bronze, silver, gold or platinum, and the gallery says the next step for every one. Badges from your journal, money and focus time stay private. Honors are given by the team or unlocked by time here.',
      'Under Account, add an email and password so your progress survives this device, change the password, export your data, or delete the account.',
      'Under Features, switch apps on or off, in the same groups and colours as the Apps page. An app that fits your tags says why. Appearance picks light, dark or auto.',
      'See my public page shows exactly what other people see at your address.',
    ],
    terms: ['identity tag', 'setup chat', 'badge', 'honor', 'life coach', 'who you are becoming', 'public page'],
  },
  profile: {
    steps: [
      'Your public page is your door into the app, at kreators.app/u/your-handle. Pick a handle first.',
      'Choose what shows: one switch for the whole page, then social icons, links, portfolio, products, posts, activity, badges, friend requests and chats. Each part has its own switch.',
      'Add link blocks like a link-in-bio: plain or featured links, headers, text, pictures, YouTube videos and carousels, stacked in any order. Taps on them are counted for you alone.',
      'Your trust score sits in the page header, built only from what you earned here: xp, points, streaks, time, sales and honors.',
      'Journal and wellbeing never appear on a page, whatever the switches say.',
    ],
    terms: ['public page', 'trust'],
  },
  school: {
    steps: [
      'School is programs with lessons, assignments and a mentor who reads your work. Two real programs are in: Editing fundamentals, and Skills using ChatCut and AI.',
      'Pick a program and a cohort date. Open cohorts run at your own pace.',
      'Do the lessons in order, send each assignment, and join the live sessions. Every lesson links the file it was written from.',
      'A mentor leaves feedback and approves or returns an assignment. Completion is their decision against the criteria, never a timer running out.',
      'A finished program gives a certificate under My purchases.',
    ],
    terms: ['cohort'],
  },
  work: {
    steps: [
      'Brands and the team post gigs, roles, campaigns and collabs. The list shows who each one is for, what it pays and when it closes.',
      'Apply once with a short note. Your portfolio from Public page comes with it.',
      'Follow every step in one place: submitted, shortlisted, selected or declined, completed. Each change lands in your inbox.',
      'Club members get the first look at club-only openings.',
    ],
    terms: [],
  },
  army: {
    steps: [
      'Army is brand campaigns run properly. A brand writes a brief and a budget; the team scopes it and shortlists creators who fit.',
      'If you are shortlisted, the brand approves, then you produce. Versions, feedback and approvals live in one thread on the campaign.',
      'Usage rights and exclusivity are written down before anyone shoots.',
      'Points for verified views arrive after a reviewer confirms the numbers and finance pays. Nothing pays on a claim.',
    ],
    terms: ['campaign', 'points'],
  },
  win: {
    steps: [
      'Win is content rewards: a brand funds a pool and sets a rate per thousand verified views, with a cap per creator and a minimum view count.',
      'Read the brief, post your video on the platform it asks for, then submit the public link.',
      'YouTube views are read by the app. Other platforms are typed in and confirmed with a screenshot, one report every six hours.',
      'A reviewer verifies the views and finance pays points from the pool. A pool that runs dry pays nobody more.',
      'If a reward changes after launch, its version goes up and everyone who entered gets a note saying what changed.',
    ],
    terms: ['bounty'],
  },
  agency: {
    steps: [
      'For a content agency or a freelance creator. Add each client with what they pay a month, how many deliverables you owe them and which channels you make for.',
      'Every deliverable is one piece of content and has a stage: idea, script, making, review, approved, published. Move it along as you work; it has a due date and a day to go live.',
      'Switch on a client link and the client can open one page, read what is waiting for them and approve it or send it back with a note. They never see your fees, hours or notes.',
      'Log the time you spend. The page shows hours this month against what the client pays for. Under Team, ask editors, videographers, creators or a client to join, and pick what each one can open.',
      'Paperwork holds your invoices, agreements and other documents. Make an invoice from a client page for the retainer and the pieces you finished. Your business details and templates sit under the gear, Agency settings. Reviews can show these numbers as business metrics if you switch that on.',
    ],
    terms: ['retainer', 'deliverable', 'client link', 'utilisation', 'paperwork', 'team member'],
  },
  party: {
    steps: [
      'Meetups anyone can host, and run again on a new date with one tap. Parties, workshops, camps and Kreators Days are run by the team. Everyone signed up gets a reminder a day before and an hour before.',
      'RSVP to take a seat. A full room puts you on the waitlist, first in line: if a seat opens, the first person waiting gets it and a note in their inbox.',
      'Some events cost points for a ticket. Cancelling a seat refunds them.',
      `A host can set xp for the guests, up to ${ATTENDEE_XP_MAX}, and shows an attendee code at the event. It works from thirty minutes before the start to three hours after the end, once each, for up to ${ATTENDEE_CLAIMS_PER_DAY} events in 24 hours. Then the xp is fixed. Afterwards, rate it and say if you are happy to be introduced.`,
      'Club members see Club-only events. Private events only show to people with the link.',
    ],
    terms: ['attendee code', 'xp'],
  },
  run: {
    steps: [
      'Join a run club near you, or start one: a name, a city, a pace and where it usually meets. The host is its first member.',
      `The host adds runs and sets each one's xp until its code opens (${ATTENDEE_XP_DEFAULT} unless they say, up to ${ATTENDEE_XP_MAX}). Each run gets a start code only the host sees: six letters, or a word the host picks, to show at the start line.`,
      'Enter the code during the run to log it: from thirty minutes before the start to three hours after the end, once per run. A logged run pays its xp and 10 points, up to two paid runs a day, and its minutes count as movement in Life. The host does not log their own run.',
      'My runs tracks your kilometres over thirty days, your weekly streak, and three badges: First run, Ten runs and Hundred k.',
      'Brand collabs have their own tab: what a brand gives, what it asks, and the giveaway. A host applies with the club; an accepted collab shows its giveaway on the club and on the runs tied to it.',
    ],
    terms: ['run club', 'start code', 'collab', 'giveaway', 'badge', 'xp', 'points'],
  },
  community: {
    steps: [
      `Community is posts and replies by category, kept kind by guides on the team. Guides pin up to ${MAX_PINNED} posts at the top of a category, and can ask that a new member's first post waits for their okay.`,
      'Sort the feed by recent, popular or most replies. Filter it to everyone, people you follow, or your own posts.',
      `React to a post or a reply in six ways, from Like to Funny. Follow a person, or follow a post to hear about new replies. Type @ and a page name to tell someone, up to ${MAX_MENTIONS} people at a time.`,
      'A post pays 5 xp (up to three a day), a reply 2 xp (up to five), a reaction you give 1 xp (up to ten). A reaction on your post pays you a point and a new follower two, up to twenty a day. Each pays once, so changing a reaction pays nothing more.',
      `Channels are chat rooms beside the feed, one for each topic. Guides open them; join one and talk, under your name or a made-up one. New lines show up every few seconds, and a dot shows what you have not read. Members-only spaces come with memberships you buy from a creator’s shop.`,
    ],
    terms: ['reaction', 'mention', 'xp', 'points', 'guide', 'chat channel'],
  },
  club: {
    steps: [
      'Club is a curated membership. Apply once with a note about your work.',
      'A reviewer on the team reads it and decides. The answer lands in your inbox.',
      'Members get club-only events, the first look at club-only openings in Work, a named manager, and the Club honor on their page.',
      'Membership runs for a year, then you renew.',
    ],
    terms: ['Club', 'honor'],
  },
  bond: {
    steps: [
      'Bond is introductions with consent. Switch introductions on, and the app suggests people you crossed paths with at events.',
      'Ask to meet someone. Nothing moves until they say yes; then you are both introduced.',
      'Add friends from their public page and chat under aliases. Nobody is ever revealed.',
      'Block anyone, any time. A blocked person cannot ask again.',
      `Make a channel for friends: a private room for up to ${MAX_CHANNEL_MEMBERS} people. Invite friends, they say yes, and you talk in it under your own names. You can remove people, and anyone can leave.`,
    ],
    terms: ['alias', 'chat channel'],
  },
  circles: {
    steps: [
      'Circles run every week. Join this week’s; signups close thirty-six hours before.',
      'Two days before, tables are set: people nearby whose interests complement yours, under aliases.',
      'The chat opens a day before. Agree on the exact place and time together.',
      'Show up in the colour that says where you stand: red if you are single, white if you are committed. Rather not say? Wear what you like.',
      `Meet. If the host set xp, type the code shown at the meetup on your table page, once, from thirty minutes before to ${(CIRCLE_MINUTES + RUN_CODE_WINDOW.after) / 60} hours after the start. A weekly circle keeps its xp with a new code. Later, chat with your table under Bond, under aliases.`,
    ],
    terms: ['circle', 'alias', 'attendee code'],
  },
  life: {
    steps: [
      'Life reads your seven relationships the way a life is usually read: physical, financial, mental, emotional and spiritual, each scored from what you already log.',
      'Physical is sleep, movement and breath. Financial is this month’s money, budgets, invoices and goals. Mental is stress, tasks done and learning. Emotional is mood, journal and the people pillars. Spiritual is stillness, small acts and the top two pillars.',
      'A part with nothing logged does not count against you. Tap any part to go where you act on it.',
      'The score is private to you. Pick a period to compare it with the one before.',
    ],
    terms: ['five areas of life', 'life score', 'period'],
  },
  wellbeing: {
    steps: [
      'One score from four signals: mood, sleep, stress and mindful minutes.',
      'Log each in its own tracker, two taps at most. The score updates as you go.',
      'The line shows thirty days; the row of faces shows the week.',
      'Nothing here reaches brands, staff, the leaderboard or Club selection.',
    ],
    terms: ['life score'],
  },
  mood: {
    steps: [
      'Pick a face for today. That is the whole ask.',
      'Say why, if you like. Nobody else sees it.',
      'The month shows as a grid of faces, so patterns are easy to spot.',
      'Mood feeds your wellbeing score and the emotional part of Life.',
    ],
    terms: [],
  },
  sleep: {
    steps: [
      'Log last night in a few seconds: hours on the slider, quality in a tap.',
      'Seven to eight hours scores full marks; the donut shows how close you got.',
      'Watch the thirty-day line and the week of bars.',
      'Sleep feeds your wellbeing score and the physical part of Life.',
    ],
    terms: [],
  },
  stress: {
    steps: [
      'Pick a level from one to five and name what is behind it.',
      'Lower stress scores higher.',
      'What comes up most shows as bubbles: the biggest circle is the cause to look at first.',
      'Stress feeds your wellbeing score and the mental part of Life.',
    ],
    terms: [],
  },
  mindful: {
    steps: [
      'Breathe: slide the ruler to a length from one to thirty minutes, or tap a quick length, and breathe with the circle. The timer can play a background sound, such as rain, ocean, wind, a soft hum or slow lo-fi chords, that fades out when it stops.',
      'Or use the focus panel, which has three tabs. Pomodoro is focus sessions with breaks: slide the ruler to the focus length (5 to 120 minutes), and set the short break, the long break, the sessions before it and the total from the four small chips. The classic is 25 minutes of focus and a 5 minute mini break, four times, then a 30 minute long break. Timer is one countdown with no breaks. Stopwatch counts up from zero, and Stop keeps the whole minutes. The round buttons beside the panel open settings, switch sounds on or off, choose background music and pick the task you are working on.',
      'The minutes log themselves when the timer ends, and after a focus session you can rate how focused you were, from scattered to deep. The dashboard shows the average, for you alone. A finished focus session, Timer or Stopwatch counts as mindful minutes, and a finished break counts only if you switch that on. Skipping or stopping early counts for nothing. Starting the next part by itself is off until you switch it on. A chart shows your focus time and tasks ticked by day, week or month, in minutes or hours.',
      'Sounds: one soft beat marks a mini break and three mark the long break. One switch turns every sound and alarm off at once, and your other choices are kept. All your timer choices are saved on your account, so they follow you to every device.',
      'Sixty minutes a week scores full marks. The minutes count in Life twice: as breath under physical and as stillness under spiritual.',
    ],
    terms: ['focus session'],
  },
  journal: {
    steps: [
      'Write it down, with a feeling and a stress level tagged on the entry.',
      'Only you ever see an entry: not brands, not staff, not the leaderboard, never your public page.',
      'Entries this month show on the calendar. Search finds them by title or text.',
      'The feeling you tag feeds the emotional part of Life.',
      'Not sure what to write? Tap Prompt me for a question from a category such as shadow work, gratitude or a weekly reset, with why it helps and what to expect. Write about this opens a new entry with the question as its first line. Which prompts you saw stays on this device.',
    ],
    terms: [],
  },
  coaching: {
    steps: [
      'A life coach is someone the team chose, with the Life coach badge. Find one under Coaching and ask, or say yes when a coach asks you. Nothing is shared until you do.',
      `You pick what your coach sees, in five parts: Daily and streaks, pillars and pyramids, routine and contract, life map answers, and reflection. Never your journal. Change it or end it any time on your Profile tab. Up to ${MAX_COACHES} coaches at once.`,
      'Your coach leaves notes and can add or edit tasks in your pyramids, marked From your coach. Only you tick them, and they pay the same xp as your own.',
      'Every ask, yes, note and task change is in the change log at the end of the page, with the time, for both of you.',
      'Are you a life coach? Say so in the setup chat or ask here, and the team checks first. Then add students by email or handle; each one has to say yes.',
    ],
    terms: ['life coach', 'student', 'change log', 'pyramid', 'task', 'life map', 'routine', 'contract'],
  },
  companion: {
    steps: [
      'A chat that knows your day: your streak, your pillars, your tasks, your mood and your sleep.',
      'Say what is on your mind. It reflects and asks a better question back.',
      'With a plan it answers with the model you pick. Without one, the built-in companion answers, free. Only a model that keeps nothing sees your mood and sleep.',
      'It is not a therapist and never pretends to be one. In danger, call your local emergency number or go to the nearest hospital.',
      'The chat stays with you alone.',
    ],
    terms: [],
  },
  reviews: {
    steps: [
      'Pick a week, a month, a quarter or half a year. The mid-year check-in is the half.',
      'The numbers from every app for that period sit next to the period before: check-ins, tasks, small acts, xp by area, kept days, mood, sleep, money, sales, lessons, people and runs.',
      'Answer the questions for that cadence, rate how it went with a face, and keep one line to remember.',
      'A review is saved with the numbers as they were, so it never rewrites itself. One review per period.',
      'Add recurring templates of your own. The built-in ones stay as they are.',
    ],
    terms: ['period', 'review'],
  },
  shop: {
    steps: [
      'Sell what you make: downloads, courses with drip and quizzes, memberships, sessions with booking, events with replays, payment links, bundles, locked posts and paid questions.',
      'Make a product in a minute and share its link. It also sits on your public page.',
      'Set who can buy: anyone, or people with a points balance, a badge, or both.',
      'Points move instantly. Money checkout is in test mode until a payment provider is connected, and a money order is only paid once the provider confirms it.',
      'Coupons, availability, orders, customers and testimonials live under the Shop sections. A buyer can also type a discount code from the team under Have a discount code; the price shown is the price charged, and you are still paid the full price.',
    ],
    terms: ['unlock', 'points', 'discount code'],
  },
  store: {
    steps: [
      'Three shelves. New gear and software picked by the team, bought through partner links: the tap goes out through kreators.app, which may earn a share and never holds the goods or the money.',
      'Pre-owned gear from other creators, graded by condition, with pictures. Make an offer; the seller accepts or declines, and a chat opens for the two of you to settle the handover.',
      'Kits say what to buy at your stage, within a budget, mixing new and pre-owned pieces, and add up live.',
      'A featured spot is a week at the top: free from the team, 200 points for your own listing.',
      'Some items ask for a points balance or a badge before they open. The card says so in plain words.',
    ],
    terms: ['partner link', 'pre-owned', 'offer', 'kit', 'featured', 'trust', 'unlock'],
  },
  audience: {
    steps: [
      'Followers, leads and broadcasts in one place.',
      'People follow your public page; leads come from the form on it.',
      'Send a broadcast to everyone who said yes to hearing from you.',
      'Your affiliate link pays a share on the sales it brings in.',
    ],
    terms: [],
  },
  content: {
    steps: [
      'Content is a strategist with a folder per brand. Make a folder, say what the brand is and how it sounds, and feed it links: the site, the channels, the competitors.',
      'Research reads those links and searches the web, YouTube, X and Reddit through Agent Reach. Outliers are the videos that broke out in a niche; every run is kept with what it found.',
      'Create turns the research into pieces: a strategy audit, a marketing plan, a four-week calendar, video ideas, hooks, a short-form script, posts, or a video taken apart. Each piece says who wrote it.',
      'Your posts and links still live here: add a post by its link, share the tracked link, and see clicks, sales and revenue per post.',
    ],
    terms: ['brand folder', 'outlier', 'hook', 'piece'],
  },
  automations: {
    steps: [
      'Pick a post and a keyword. Anyone who comments the word gets a message with a tracked link.',
      'Without the Meta keys connected, replies queue here for you to send.',
      'Funnels show where people drop off between the post, the message, the page and the sale.',
      'Every send is logged.',
    ],
    terms: [],
  },
  finance: {
    steps: [
      'Money in, money out, by category and by month. Log what came in and what went out, who it was from or to, and any splits owed to others.',
      'Dues track what you owe and what you are owed, with a date. Recurring entries post themselves each month.',
      'Settling a due with a tap books the money in or out for you.',
      'Budgets and goals show how the month is going. Pick a period to compare with the one before.',
      'Yours alone to see.',
    ],
    terms: ['period'],
  },
  library: {
    steps: [
      'Everything you bought from a creator lands here: courses, downloads, memberships, tickets and sessions.',
      'Courses track lessons and quizzes. Pick up where you left off.',
      'Certificates and answers to paid questions live here when earned.',
    ],
    terms: [],
  },
  knowledge: {
    steps: [
      'Guides and articles from the team, on the seven relationships and on making things, always with their sources.',
      'Browse by tag or search by title.',
      'Read for ten minutes, then try the exercise.',
      'Lessons in School link back here.',
    ],
    terms: [],
  },
  tools: {
    steps: [
      'A directory of creator tools for capture, editing, audio, design, scheduling, analytics and more, checked by the team.',
      'Get it goes through a partner link. Open goes straight to the tool.',
      'Suggest one you swear by. A reviewer checks it before it shows to everyone; you see it straight away.',
      'Featured tools sit at the top for a week. Some ask for a points balance or a badge first.',
    ],
    terms: ['partner link', 'featured', 'unlock'],
  },
  tv: {
    steps: [
      'Pitch a series: the idea, the plan and a budget.',
      'A reviewer reads it. Follow it from review to diligence to a decision, with every step logged.',
      'Approved shows are released in steps.',
    ],
    terms: [],
  },
  fund: {
    steps: [
      'Apply for a grant or backing for a project: what it is and what it needs.',
      'Same pipeline as TV: submitted, review, diligence, then a decision with a reason.',
      'Approved projects get released in steps.',
    ],
    terms: [],
  },
  leaderboard: {
    steps: [
      'Pick a board: everyone, a goal such as Learn a new skill, a pillar, a city, a tag like Student, or an experience level. Rank it by xp, this month, streak or badges.',
      'Your spot, your xp and the size of the board sit at the top. Each goal and pillar also has a small board with its top three; open one to see everyone.',
      'You appear only after you opt in under Profile. People you blocked, and people who blocked you, never show up. Journal and wellbeing never count here.',
    ],
    terms: ['xp', 'streak', 'badge', 'season'],
  },
  discover: {
    steps: [
      'Take the quiz in five parts: pick the statements most and least like you, solve pattern puzzles that get harder or easier as you go, choose words that describe you and judge real situations. Then, if you like, add emotional intelligence. It saves as you go, so you can stop and come back.',
      'You get your top three strengths out of seven, one for each relationship, a detailed read on five personality traits, your reasoning puzzles and, if you add it, your emotional intelligence. The reasoning part is not an IQ test.',
      'Under More ways to know yourself are four self-checks you can take on their own: your 16 personality type, in the style of Myers-Briggs, your love languages (how you like to be shown love and how you show it), how your mind works (never a diagnosis), and Human design. Human design works out your chart from your birth date, time and zone, reads it in the tropical and the sidereal zodiac and in three layers, and turns it into goals you can do and count. Numerology sits beside the three layers, with the master numbers 11, 22 and 33, and sets your numbers next to what Discover learned about you. They are systems for reflection, not science.',
      'Every number is you against your own scale, never against other people. A result is not a verdict: use it, watch for its other side, and try the small thing it suggests.',
      'Only you see it. It never reaches brands, staff, the leaderboard or a life coach. You choose whether it shapes your next steps (on by default, plain rules) and whether the assistant may learn from a short summary (off until you say). How your mind works has its own switch, off until you say. You can retake any part or delete it.',
    ],
    terms: ['strength', 'personality type', 'love language', 'signs', 'human design', 'gate', 'channel', 'sidereal', 'numerology', 'master number'],
  },
  cards: {
    steps: [
      'Unlock a game once in Rewards with points. It opens in the app for good, and nothing is posted to you.',
      'Open a game, pick a deck and tap Shuffle. Tap the pile to draw a card onto the table.',
      'Tap a card to flip it. Some cards have two sides, like Truth and Dare or Roast and Flirt. Drag cards around the table; the one you touch comes to the front.',
      'Special cards and house rules, where a game has them, are one tap away. Play with the people you are with: pass the phone round or put it in the middle.',
      'Tap the icon with four corner brackets for focus mode. The menu and the assistant step aside, and the table fills the screen.',
    ],
    terms: ['unlock', 'deck', 'points', 'focus mode'],
  },
  rewards: {
    steps: [
      'Points buy rewards from the catalog: gear, books, a meetup ticket, a call with a mentor, and games you unlock and play in the app.',
      'Gear is a reservation until it ships; cancel any time and the points come back. A card game opens at once and is yours for good.',
      'Points also buy creators’ products, event tickets and featured spots.',
    ],
    terms: ['points'],
  },
  help: {
    steps: [
      'How you earn, the words we use, and answers to common questions.',
      'Write to the team from here. The reply lands in your inbox.',
      'In danger, call your local emergency number or go to the nearest hospital.',
    ],
    terms: [],
  },
  notifications: {
    steps: [
      'What happened while you were away, in tabs: All, Replies and mentions, Following, Events and Coaching, and Team for the team.',
      'Reminders land here: your daily one at the time you set, and one a day before and an hour before any event, circle or run you signed up for.',
      'Tap one to go where it came from. Archive the ones you are done with; show Unread or Archived to find them again.',
    ],
    terms: ['mention'],
  },
  search: {
    steps: [
      'Type two letters and results appear under the box.',
      'Apps, help, tasks, journal, knowledge, products, people, store items, pre-owned gear, tools, run clubs and posts, in groups.',
      'Nothing leaves the page. Tap a result to go there.',
    ],
    terms: [],
  },
  manage: {
    steps: [
      'Queues for staff: campaigns, cohorts, events, review, moderation, support, finance, mentoring and life coaching.',
      'Each power comes from a permission an admin gives.',
      'Everything you do here is audited.',
    ],
    terms: ['guide'],
  },
  admin: {
    steps: [
      'Tables for people, flags, listings, orders, webhooks, KYC, mail and audit.',
      'Sort by any column, search, filter, tick rows for bulk actions, and edit a cell in place.',
      'Only an admin changes a role, never their own.',
      'Life coaches: say yes or no to people who asked to coach, give or take the Life coach badge, and link a coach to a student. A link you ask for waits for the student’s yes.',
    ],
    terms: ['life coach', 'student'],
  },
  observability: {
    steps: [
      'Who is here, which apps they use, which roles they hold.',
      'The build map, embedded.',
      'Edit a role from the list. Every change is audited.',
    ],
    terms: [],
  },
};
