import { INVITE_ACTIVE_DAYS, MAX_CHANNEL_MEMBERS, MAX_MENTIONS, MAX_PINNED } from './community.ts';
import { ATTENDEE_CLAIMS_PER_DAY, ATTENDEE_XP_DEFAULT, ATTENDEE_XP_MAX, CIRCLE_MINUTES, RUN_CODE_WINDOW } from './events.ts';
import { MAX_COACHES } from './coaching.ts';

// ---------------------------------------------------------------------------
// How each app works, in three to five steps
// ---------------------------------------------------------------------------
// A subpath export (`@kreators/shared/help`), not in the barrel: only the How it works panel (a lazy chunk) and the
// tests read it, so its text loads when that panel first shows, never with the first download (2026-11-07). It imports
// the rest of shared and nothing in the barrel may import it, or the two chunks cycle (see vite.config.ts). The words it
// names live in TERMS (terms.ts, in the barrel).

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
      'With a plan you can also type what you did, like “I edited the vlog and slept six hours”. It does it in the app as you, then lists each change with an Undo. It can also log movement, your eating check-in and the day’s gratitude. Removing things and settling money wait for your Confirm.',
      'Typing spends credits, and a typical message is about 12. Pro gives 10,000 credits a month, Pro Max 100,000 and Ultra 400,000. Each plan also caps what one message and one day can spend.',
      'It earns the same xp and points as a tap, waits the same waits, and never sees anything that is not yours. It reads your journal only when you ask about it.',
    ],
    terms: ['assistant', 'credits', 'top-up'],
  },
  home: {
    steps: [
      'Home opens after sign-in and answers “how am I doing” before “what do I do”. Under Water and reminders sits a line of the day, from a philosopher or from us, a new one every day. Your daily brief comes first: three things that changed and three next steps, from your own numbers. In your first two weeks a Getting started list sits under it and ticks itself as you go.',
      'Under them sits what moves those numbers: the three boxes on Daily, your trackers, your money and your shop. Anything that belongs to an app shows only while that app is not hidden.',
      'Up next lists the events, runs, sessions and circles you are booked into, soonest first.',
      'Pick a period at the bottom to see the same numbers by day, week, month, quarter or half year, next to the period before.',
      'The search box at the top finds apps, tasks, people, products and more as you type.',
    ],
    terms: ['daily brief', 'xp', 'points', 'level', 'streak', 'period', 'assistant'],
  },
  insights: {
    steps: [
      'Pick a day, a week, a month, a quarter, half a year or a year, or leave it on the last 8 weeks. Your life shows that period first: the five areas of life, then the seven pillars, each number next to the period before, and only for the apps you have not hidden. A day is your daily report.',
      'Emerging reads what you already log, like tasks, check-ins, sleep, mood, focus, water and money, and points out patterns over the period you picked. Nothing new is asked of you. A pattern needs enough days to be fair, so a short period shows more under Still watching.',
      'A task you tick on 3 different days in 4 weeks, and that does not repeat yet, shows as a habit you could keep. Good and bad habits go further. They set a task you keep doing, or a slip on your not to do list, beside how those days went: your mood, your sleep that night, your stress and your other tasks. A clear lift is a good habit and a clear dip is a bad one. Each needs 5 days with it and 7 without, and until then it waits under Still watching. Make it a habit and Add to not to do change nothing until you tap the button in their sheet.',
      'Links between apps say what happened on the same days, with how many days each side: “On days after 7.5 hours of sleep, your mood was 3.9.” They never say one thing caused the other, and they wait until each side has enough days: at least 4, and for most links 5 to 10. Water and budgets count too: days you met your water goal beside days you did not, the day you drink least, and a budget that keeps running over.',
      'Each app shows the patterns that touch it, and Home shows the strongest three. A pattern from an app you hid is not shown. Only you see these, unless you switch Patterns on for a life coach. Your journal is counted by day, never read. Nothing here is stored.',
    ],
    terms: ['emerging', 'habit', 'good habit', 'bad habit', 'not-to-do', 'pillar', 'streak', 'period', 'day type'],
  },
  timeBlocks: {
    steps: [
      'A block has a name, a tag, a colour from 11 swatches or your own and, if you like, an area of life and a pillar. You start with 18, like Deep work from 10 am to 1 pm and Sleep from 11 pm to 7 am, and can keep up to 24.',
      'A day template places blocks on the clock, up to 24 slots. Slots may cross midnight and never overlap, and a gap shows as free time. A template has a colour of its own. You start with 17 templates, like Deep work day, Family day and Shoot day. Change or copy any of them, and delete any but your default. On Edit day, Shoot day and Plan and post day, each content block shows a list of steps, and Add to my tasks makes it one task with those steps inside.',
      'Your usual week gives each weekday a template, and every day starts on Everyday. Tap a day in the week, or in the month calendar on Daily, to see or change its kind. A change to one date leaves the week alone. A day counts as the kind set for it, else the one your week gives, and Everyday counts as none: This month, Your kinds of day and the Reviews tile add them up.',
      'A task sits in the block you pick, else the one its time falls in. Plan my week suggests one from its area and pillar, and nothing changes until you keep it. A task with no block or time shows as Suggested in the block that fits, with Keep here. A task whose time sits in a block meant for something else gets one line, with Move it or Keep here. Place my day gives every task with no block or time a start in the block that fits, and saves those times only when you tap it.',
      'On Daily, sort By time block or By area to see tasks in coloured boxes you can open and fold. P0 stays first in every box, then the area or the block, then the day.',
    ],
    terms: ['time block', 'day template', 'weekly pattern', 'by time block', 'by area', 'day type', 'place my day', 'content day', 'five areas of life', 'pillar', 'plan strength'],
  },
  today: {
    steps: [
      'Daily is three boxes a day: check in, do the small act, tick one task. Checking in pays 10 xp and 10 points and keeps your streak; every seventh day in a row pays 50 points more. The small act is a two-minute thing for your weakest pillar and pays 15 xp. Your routine from the strategy session sits under the first box.',
      'Tasks come from the pillars you set up. Each pays 20 xp and sends a ripple up its pyramid. A task has a do date, the day you will do it, and can have a due date, the deadline. It shows here from its do date and cannot be ticked before it. After its due date it says Overdue, but you can still tick it. A new task waits ten minutes before it can be ticked.',
      'Tick a task with the box at its left, and tap the task to plan it, rename it or delete it. Give it an area of life and a priority, P0 (do now) to P3 (whenever). Pick the kind of day, a day template like Deep work day, and the list sorts By context: P0 on top, then the pillar the day leads with. Sort By time block or By area for coloured boxes, or Bottlenecks for tasks marked Unfinished, Unresolved or Undecided; end those in the plan or let them go. Make a task repeat and it becomes a habit. Add subtasks, minutes and Remember, or start a focus session on it. Tap a tag on a task, like Remember or its pillar, to show only tasks with it; tap more to narrow it, and tap a chip’s cross above the list to take one off.',
      'Tasks has three tabs. Today holds what is set for today. Past due holds open tasks from days gone by, oldest first, and Upcoming what comes later, soonest first, ten a page. A task with no date waits under Not scheduled yet, and a Remember task with no day under To remember. The eye, View, hides parts of Daily you do not use, like Habits or Month calendar, on every device; a link to one still shows it. Plan my week suggests a day for each task with no day. Hide a task in its plan, until tomorrow or until you unhide it: it waits under Hidden tasks at the foot of the list, sends no reminder, and a tick there still counts.',
      'Under Your day, Place my day gives today’s tasks with no block or time a start in the block that fits, P0 first, and saves the times only when you tap it. A task that repeats waits for a time from you. On Edit day, Shoot day or Plan and post day, a block shows its steps; Add to my tasks makes them one task with a checklist. Below the tasks, the not-to-do list holds up to seven things you stay away from; a kept day pays 5 xp.',
    ],
    terms: ['daily three', 'check-in', 'small act', 'task', 'do date', 'due date', 'priority', 'day type', 'time block', 'day template', 'weekly pattern', 'by time block', 'by area', 'plan strength', 'habit', 'subtask', 'remember', 'past due', 'not scheduled', 'hidden task', 'place my day', 'content day', 'bottlenecks', 'unfinished', 'unresolved', 'undecided', 'three endings', 'not-to-do', 'kept day', 'who you are becoming', 'routine', 'assistant'],
  },
  tower: {
    steps: [
      'Pillars has its own setup, the strategy session, for whenever you want it: a few minutes that place all seven relationships on the map (where you usually live, where you drop under stress), score your health and wealth, and build a routine and a contract from your real day. Your life map, under Pillars, keeps every answer and can be run again. Or set up one pillar at a time with a short vibe check, three taps each.',
      'Each pillar is a pyramid with six layers. The foundation is the one thing you will not let break. The guiding principle is a line you live by so it holds. The value goal is how you want to feel more often. The goal outcome is what you would see when that is real. Then a project, and tasks at the tip.',
      'Your answers build the first four layers; you pick or write the project and its tasks. Tick a task on Daily and the glow runs up to the foundation: 20 xp for the task, then a smaller ripple to each layer above it. Clear every task in a project for 30 xp more.',
      'Every pillar has a level and a character that grows with it. The weakest pillar is the one that sends your small act.',
      'Open a pillar to see its pyramid, add tasks, give them dates and times, and archive what no longer fits. A project with a due day shows its pace: on track, slipping or behind, from how many tasks are done against how much time has gone. Tap Add a due day on a project to set one.',
    ],
    terms: ['pillar', 'pyramid', 'foundation', 'guiding principle', 'value goal', 'goal outcome', 'project', 'task', 'ripple', 'strategy session', 'life map', 'live call', 'core', 'floor', 'pace', 'assistant'],
  },
  apps: {
    steps: [
      'Apps lists your apps in groups by what they are for: Contribution, Reflection, Connection, Creation, Essentials and Operations. Tap one to open it.',
      'Hide an app you do not use. It moves to Hidden apps at the end of its group, and leaves the sidebar and the phone menu.',
      'Show it again from Hidden apps any time. Nothing is deleted when an app is hidden.',
      'To change several at once, tap Select at the top. Tick the apps, or tap Select all for every app on the page. Then tap Hide or Show beside it, and Done when you finish.',
      'The setup chat at the start shows the apps that fit who you are and what you want, and hides the rest. Run it again from Profile, or hide and unhide apps yourself.',
    ],
    terms: ['setup chat', 'identity tag'],
  },
  you: {
    steps: [
      'Who you are sits at the top: tap a tile to pick a tag, and tags mark the apps that fit you. Match my apps again runs the setup chat, which shows and hides apps to fit. Picking a tag does not. Your account, badges, honors and life coach live here too: say yes to a coach, pick what they see, or end it.',
      'Badges are medals the app earns for you by its own count: ticks, streaks, pillars, community, your shop, runs, lessons and levels. Each is bronze, silver, gold or platinum, and the gallery says the next step for every one. Badges from your journal, money and focus time stay private. Honors are given by the team or unlocked by time here.',
      'Under Account, add an email and password so your progress survives this device, change the password, export your data, or delete the account. Deleting takes your name, logs and journal. Money records and what others rely on stay, without your name.',
      'Under Features, hide or unhide apps, in the same groups and colours as the Apps page. Hidden apps sit open at the end of each group. An app that fits your tags says why. Appearance picks light, dark or auto. Dates and times sets your time zone and how dates and clocks read on every screen.',
      `See my public page shows exactly what other people see at your address. When the team suggests a friend, you both answer here. If the team lets you invite people, Invite people makes codes to share as a link or a code. You earn once someone who joined with yours has used the app on ${INVITE_ACTIVE_DAYS} different days.`,
    ],
    terms: ['identity tag', 'setup chat', 'badge', 'honor', 'life coach', 'who you are becoming', 'public page', 'invite code'],
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
      'School is programs with lessons, assignments and a mentor who reads your work. Start with Onboarding into kreators.app, free and always open. More programs sit under it, the founder’s three books among them.',
      'Pick a program and a cohort date. Open cohorts run at your own pace.',
      'Do the lessons in order, send each assignment, and join the live sessions. A lesson can end in up to six resources: files, videos, links or books. Each cohort has its own Discussion. Stay private, or show your @username.',
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
      'Paperwork holds your invoices, agreements and other documents. Make an invoice from a client page for the retainer and the pieces you finished. Email a copy writes the note from your records, with a link to each paper. Your business details and templates sit under the gear, Agency settings. A client’s brief answers save as they type. Print this section, in a section’s menu, works on a signed agreement too. Reviews can show these numbers as business metrics if you switch that on.',
    ],
    terms: ['retainer', 'deliverable', 'client link', 'utilisation', 'paperwork', 'team member'],
  },
  party: {
    steps: [
      'Meetups anyone can host, and run again on a new date with one tap. Parties, workshops, camps and Kreators Days are run by the team. Everyone signed up gets a reminder a day before and an hour before.',
      'RSVP to take a seat. A full room puts you on the waitlist, first in line: if a seat opens, the first person waiting gets it and a note in their inbox.',
      'Some events cost points for a ticket. Cancelling a seat refunds them.',
      `A host can set xp for the guests, up to ${ATTENDEE_XP_MAX}, and shows an attendee code at the event. It works from thirty minutes before the start to three hours after the end, once each, for up to ${ATTENDEE_CLAIMS_PER_DAY} events in 24 hours. Then the xp is fixed. Afterwards, rate it and say if you are happy to be introduced.`,
      'Public events are listed on the site under Events, each with its own page to share. Someone new joins and makes an account there, lands on the event, and finishes setting up later. Club members see Club-only events. Private events only show to people with the link.',
    ],
    terms: ['attendee code', 'xp'],
  },
  run: {
    steps: [
      'Join a run club near you, or start one: a name, a city, a pace and where it usually meets. The host is its first member.',
      `The host adds runs and sets each one's xp until its code opens (${ATTENDEE_XP_DEFAULT} unless they say, up to ${ATTENDEE_XP_MAX}). Each run gets a start code only the host sees: six letters, or a word the host picks, to show at the start line.`,
      'Enter the code during the run to log it: from thirty minutes before the start to three hours after the end, once per run. A logged run pays its xp and 10 points, up to two paid runs a day, and its minutes count as movement in Life. The host does not log their own run.',
      'My runs tracks your kilometres over thirty days, your weekly streak, and three badges: First run, Ten runs and Hundred k. A run or walk you log there on your own counts as movement and pays nothing.',
      'Brand collabs have their own tab: what a brand gives, what it asks, and the giveaway. A host applies with the club; an accepted collab shows its giveaway on the club and on the runs tied to it. Discussions has one thread per run, for its people, open until thirty days after it.',
    ],
    terms: ['run club', 'start code', 'collab', 'giveaway', 'badge', 'xp', 'points'],
  },
  community: {
    steps: [
      `Community is posts and replies by category, kept kind by guides. Guides pin up to ${MAX_PINNED} posts at the top of a category, and can ask that a new member's first post waits for their okay.`,
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
      'Add friends from their page, by their friend code, or by scanning their QR code (My QR code, on Profile, in Bond and at an event). They still say yes. Chats run under aliases, and nobody is ever revealed.',
      'Block anyone, any time. A blocked person cannot ask again. A block by name leaves anonymous posts alone, or it would say who wrote them, so block those from the post itself.',
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
      'Physical is sleep, movement, breath and, once you log it in Fitness, eating. Financial is this month’s money, budgets, invoices and goals. Mental is stress, tasks done and learning. Emotional is mood, journal and the people pillars. Spiritual is stillness, small acts and the top two pillars.',
      'A part with nothing logged does not count against you. Tap any part to go where you act on it. A task you tag with an area counts toward it, five in seven days for full marks.',
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
  fitness: {
    steps: [
      'Log a run, a walk, a ride, a swim, yoga, the gym or a sport, today or yesterday. A hundred and fifty active minutes in seven days scores full marks in Life.',
      'Once a day, tick your meals and mark each one Good fuel, Tasty or both. Try half your plate as vegetables and fruit, a quarter grains, ideally whole, and a quarter protein. Five servings of fruit and veg is the mark.',
      'The score reads fruit and veg, packaged food and meals without a screen. What you leave out does not count, but a score needs your fruit and veg, even 0. Tasty and how full you felt never lower it, and a fasting day has none. On packaged food, check the label: flavours, colours or sweeteners mean it is highly processed.',
      'Open Protein to add up what you ate: tap a katori of dal, an egg, paneer or a scoop, or type a number from a label. The grams are rough amounts from India’s food tables, and protein is its own number, never part of the score. For a daily goal, type what you weigh once: ICMR-NIN gives adults about 0.83 g a day for each kg, and 1 g when most meals are rice or roti. Only the goal is kept. Check with a doctor if you have a kidney condition or are pregnant.',
      'Track supplements stays off until you switch it on. It is for supplements you already take: the app does not suggest any and does not check them against medicines. A supplement adds to food, it does not replace it. All of Fitness pays nothing: no xp, no points, no badges. Only you see it, unless you share reflection with a life coach, who sees numbers and never your protein or your supplements.',
    ],
    terms: ['active minutes', 'eating check-in', 'eating moment', 'serving', 'protein goal', 'supplement', 'nootropic'],
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
      'Or keep time with the other three tabs. Pomodoro is focus sessions with breaks: slide the ruler to the focus length (5 to 120 minutes), and set the short break, the long break, the sessions before it and the total from the four small chips. The classic is 25 minutes of focus and a 5 minute mini break, four times, then a 30 minute long break. Timer is one countdown with no breaks. Stopwatch counts up from zero, and Stop keeps the whole minutes. The round buttons beside the panel open settings, switch sounds on or off, choose background music and pick the task you are working on.',
      'The minutes log themselves when the timer ends, and after a focus session you can rate how focused you were, from scattered to deep. The dashboard shows the average, for you alone. A finished focus session, Timer or Stopwatch counts as mindful minutes, and a finished break counts only if you switch that on. Skipping or stopping early counts for nothing. Starting the next part by itself is off until you switch it on. A chart shows your focus time and tasks ticked by day, week or month, in minutes or hours.',
      'Sounds: one soft beat marks a mini break and three mark the long break. One switch turns every sound and alarm off at once, and your other choices are kept. All your timer choices are saved on your account, so they follow you to every device.',
      'Sixty minutes a week scores full marks. The minutes count in Life twice: as breath under physical and as stillness under spiritual.',
    ],
    terms: ['focus session'],
  },
  journal: {
    steps: [
      'Write it down, with a feeling and a stress level. The feeling feeds Life.',
      'Gratitude for today: three lines, each under a prompt, saved as you type. On an empty line, tap the pillar’s name to pick another, or keep the three as your usual. A prompt you wrote under or skipped comes back only after the rest of that pillar’s prompts.',
      'Only you see your journal: never brands, staff, a coach or the leaderboard.',
      'A dot on the calendar marks a day with gratitude. Search finds entries.',
      'Not sure what to write? Tap Prompt me for a question from a category such as shadow work, gratitude or a weekly reset, with why it helps and what to expect. Write about this opens a new entry with the question as its first line. Which prompts you saw stays on this device.',
    ],
    terms: [],
  },
  coaching: {
    steps: [
      'A life coach is someone the team chose, with the Life coach badge. Find one under Coaching and ask, say yes when a coach asks you, or open a coach’s invite link. Nothing is shared until you say yes.',
      `You pick what your coach sees, in six parts: Daily and streaks, pillars and pyramids, routine and contract, life map answers, reflection and patterns. Reflection is your mood, sleep, stress, mindful minutes, movement and how you ate, as numbers, and your saved reviews. Never your journal, gratitude, supplements, money or a note. Change it or end it any time on your Profile tab. Up to ${MAX_COACHES} coaches at once.`,
      'Patterns are what the app finds in the parts you share, by plain rules, kept nowhere. They say what goes together, never why. On for a new coach, off for a coach you had before. A coach can ask once a week, and the choice stays yours.',
      'Your coach leaves notes and can add or edit tasks in your pyramids, marked From your coach: the dates, priority, repeat, length and whether it counts as a habit, never a time block. Only you tick them, and they pay the same xp as your own. Every ask, yes, note and task change is in the change log, for both of you.',
      'Are you a life coach? Say so in the setup chat, on your Profile or here, and the team checks first. Then add students by @username, friend code or email, or share your invite link; each one has to say yes. Each student has a report by day, week, month or quarter, and Show on this page hides any section.',
    ],
    terms: ['life coach', 'student', 'invite link', 'patterns', 'change log', 'pyramid', 'task', 'life map', 'routine', 'contract'],
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
      'Pick a day, a week, a month, a quarter, half a year or a year. The numbers from the apps you use sit next to the period before.',
      'Each review walks one layer of your pyramids, pillar by pillar: a day your tasks, a week your projects, a month your goal outcomes, a quarter your value goals. Half a year looks at your guiding principles, a year your foundations. Add any of them to an answer.',
      'Half a year has two parts: a mid-year check-in in July, and setting the year in January, beside the yearly review.',
      'Answer one question at a time, then rate it with a face and keep one line. Each built-in question says the idea it comes from, such as CBT, ACT or the Gita. Copy a set under Templates to make it your own.',
      'A review is a look back, not therapy. Skip anything heavy, and talk it through with a professional or someone you trust. Each review is saved with its numbers as they were, one per period.',
    ],
    terms: ['period', 'review', 'CBT', 'ACT', 'trauma-informed care', 'family systems', 'improv', 'positive psychology', 'self-compassion', 'karma yoga', 'the Stoics'],
  },
  shop: {
    steps: [
      'Sell what you make: downloads, courses with drip and quizzes, memberships, sessions with booking, events with replays, payment links, bundles, locked posts and paid questions.',
      'Make a product in a minute and share its link. It also sits on your public page. A course can stay Private, for people you invite, until you make it Public.',
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
      'You appear only after you opt in, here or under Profile. People you blocked, and people who blocked you, never show up. Journal and wellbeing never count here.',
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
      'Want to invite a friend? While joining is by invite, a new account needs an invite code. The team makes them, and so does anyone it lets invite, from Invite people on the Profile tab. A friend with no code can tap Start free and join the waitlist.',
      'In danger, call your local emergency number or go to the nearest hospital.',
    ],
    terms: ['invite code', 'waitlist'],
  },
  notifications: {
    steps: [
      'What happened while you were away. Everything holds it all, and each note also sits in one tab: Replies and mentions, Following, Reminders, Events, Friends, Work, Shop and money, School and coaching, Agency while you use it or are on an agency team, and Team for the team.',
      'Reminders holds your own reminders, the daily one at the time you set, tasks, focus and reviews. Notes before an event, circle or run sit under Events.',
      'Tap one to go where it came from. Archive the ones you are done with; show Unread or Archived to find them again. After you archive one, Undo stays for a few seconds.',
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
      'Connect people makes the connections your permissions cover. Private programs and courses are only your own. What an admin made, only an admin ends.',
      'Everything you do here is audited.',
    ],
    terms: ['guide'],
  },
  admin: {
    steps: [
      'Tables for people, flags, listings, orders, webhooks, KYC, mail and audit. Sort by any column, search, filter, tick rows for bulk actions, and edit a cell in place. Only an admin changes a role, never their own.',
      'Life coaches: say yes or no to people who asked to coach, and give or take the Life coach badge.',
      'Connect people joins two people the app’s own way: a coach and a student, an Agency team, a private program or course, a Club manager, or two friends. Most wait for a yes. Every one is listed, and you can end it.',
      `Invites: while Invite only is on, a new account needs an invite code. Approve someone on the waitlist and they get a code by email, or make codes to share as a link or a code. Each works once. Whoever made it is credited, and paid once the person has used the app on ${INVITE_ACTIVE_DAYS} different days.`,
      'The Admin guide, from the button on this page’s cover, walks through every screen. Only admins can open it.',
    ],
    terms: ['life coach', 'student', 'invite code', 'waitlist'],
  },
  observability: {
    steps: [
      'Counts for each app, with no names in them, and how people join: the waitlist, invite codes and whether Invite only is on. Nothing private shows here, not even as a count: no journal, gratitude, mood, sleep, stress, Fitness or supplements.',
      'Who is here and which apps they use. An admin changes a role from the list, and every change is audited.',
      'The build map shows what is built, what needs a key and what is not built. Green means a script checks it.',
      'Logs, from the button on the cover, list changes, refusals and errors for 30 days. Only a super admin reads them, since they name people.',
    ],
    terms: [],
  },
};
