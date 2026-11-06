// A subpath export (`@kreators/shared/ladderChoices`), not in the barrel: a long list of text only the strategy session, the vibe check and
// the build route read, so it downloads with those screens and never with the shared chunk (it took that chunk past 400 kB, 2026-11-06).
import type { RelationshipKey } from './core.ts';
import { LADDERS, type Branch } from './pillars.ts';

// ---------------------------------------------------------------------------
// Choices — the value goals and projects the strategy session and the vibe check offer for each pillar, each with
// one plain line on what it does for the person. The ideas come from well-tested approaches (CBT, ACT and DBT
// skills, trauma-informed care, attachment, family systems, positive psychology, improv and play, deliberate
// practice) and from yogic and spiritual teaching (the Bhagavad Gita, the Yoga Sutras, the Upanishads, service,
// gratitude, forgiveness), always in our own words. They are for reflection: no cure, no diagnosis, no promise.
// Every value goal and project in LADDERS is here (a test checks); a project not in LADDERS carries its own tasks.
// ---------------------------------------------------------------------------

/** A value goal or project on offer, with why it matters. */
export interface LadderChoice {
  title: string;
  why: string;
}

/** A project on offer. One that is not a LADDERS project brings its own gentle and bolder tasks. */
export interface ProjectChoice extends LadderChoice {
  tasks?: { starter: string[]; stretch: string[] };
}

const V = (title: string, why: string): LadderChoice => ({ title, why });
const P = (title: string, why: string, starter?: string[], stretch?: string[]): ProjectChoice =>
  starter && stretch ? { title, why, tasks: { starter, stretch } } : { title, why };

export const LADDER_CHOICES: Record<RelationshipKey, { valueGoals: LadderChoice[]; projects: ProjectChoice[] }> = {
  servant_leader: {
    valueGoals: [
      V('Feel useful to my people', 'Help that fits what people need gives a quiet sense of meaning.'),
      V('Feel trusted', 'Trust grows when what you say and what you do match, week after week.'),
      V('Feel generous', 'Giving without keeping score often lifts the giver as much as the one who gets.'),
      V('Feel calm about the results', 'Give the work your best and hold the outcome lightly, so worry has less to grip.'),
      V('Feel clear on what is mine to do', 'Knowing your own part stops you carrying everyone’s load and burning out.'),
      V('Feel like my team can tell me anything', 'People bring problems early when they know they will not be punished for it.'),
    ],
    projects: [
      P('Listening week', 'Asking before acting means your help lands where it is needed.'),
      P('Inbox zero, kindly', 'Clearing what you owe people frees your head and shows them they count.'),
      P('Lift someone', 'Backing someone newer builds them up and grows what the whole group can do.'),
      P('Do it, then let go', 'Full effort with a loose grip on the result lowers worry and keeps you steady.',
        ['Before one task, write what you control and what you do not', 'Finish one piece of work and do not check how it landed for a day', 'Notice one time today you worked for praise'],
        ['For a week, judge each day by your effort, not the results', 'Ship one thing and wait a week before you look at the numbers', 'Write what you would still do if no one ever thanked you']),
      P('Service hour', 'Service done for its own sake is how many traditions train a calm, open heart.',
        ['Pick one person or place you could serve for an hour', 'Do one helpful thing today and tell no one', 'Offer to help a neighbour or a colleague with a small job'],
        ['Give one hour of service this week with nothing asked back', 'Give a full morning to a cause you care about', 'Keep a weekly service hour for a month']),
      P('Safe to speak', 'When people can raise a worry without fear, problems show up early and small.',
        ['Ask your team or group one question: what is getting in your way?', 'Thank the next person who brings you bad news', 'Own one mistake of yours out loud'],
        ['Run one meeting where you speak last', 'Ask for honest notes on how you lead and act on one', 'Set up a way for people to raise a worry without their name']),
    ],
  },
  friendship: {
    valueGoals: [
      V('Feel known', 'Being truly seen by a friend is one of the deepest kinds of comfort.'),
      V('Feel reliable', 'Keeping your word in small things is what makes friends trust you with big ones.'),
      V('Feel anchored', 'A steady ritual keeps a friendship alive through busy and hard weeks.'),
      V('Feel playful again', 'Play lowers our guard and brings people closer than serious talk often does.'),
      V('Feel I can be myself', 'Friends who see the real you, not the polished one, are the ones who last.'),
      V('Feel part of a circle', 'A group gives you somewhere to land when one friend is busy.'),
    ],
    projects: [
      P('Real hangs', 'Time with your full attention tells a friend they matter more than any screen.'),
      P('The yes list', 'Showing up, again and again, is how a friend becomes a close friend.'),
      P('Weekly ritual', 'Same time, same people makes staying in touch easy instead of a chore.'),
      P('Yes, and', 'Building on what a friend says, instead of correcting it, makes time together warmer and more fun.',
        ['In one chat today, answer with yes, and, then add something', 'Say yes to one small plan a friend suggests', 'Share something silly that made you laugh'],
        ['Go to an improv, games or open mic night with a friend', 'Plan a play day: board games, a sport or something silly', 'For a week, build on every idea a friend shares before you weigh in']),
      P('Mend a friendship', 'Reaching out after a drift or a fight is often welcome, and repair can make a bond stronger.',
        ['Write the name of one friend you drifted from', 'Send them a short hello with no need to reply', 'Think about your part in the drift and own it to yourself'],
        ['Say sorry for your part, plainly, with no but', 'Meet them in person and listen first', 'Ask what they needed back then that you missed']),
      P('Even give and take', 'Friendships last when both people give, so notice if you only give or only take.',
        ['List three friends and who reached out last', 'Ask one friend for a small favour', 'Do one small favour for a friend'],
        ['Reach out first to every friend you are waiting on', 'Let a friend help you with something real', 'Plan a day around what a friend loves, not what you love']),
    ],
  },
  parent_child: {
    valueGoals: [
      V('Feel close to home', 'Small, regular contact keeps family close more than rare big visits do.'),
      V('Feel like I belong at home', 'Showing up for family moments builds a sense of place no job can give.'),
      V('Feel close', 'Real questions turn family from people you update into people you know.'),
      V('Feel like myself around family', 'Staying yourself while staying close is how we grow up inside a family.'),
      V('Feel like a safe place for them', 'A calm, steady person to come back to helps others feel brave in the world.'),
      V('Feel at peace with the past', 'Seeing where your family’s ways came from loosens their hold on you.'),
    ],
    projects: [
      P('The ten-minute call', 'A short call with no agenda keeps you part of each other’s days.'),
      P('Show up at home', 'Being there for meals, birthdays and hard days is what family remembers.'),
      P('The question jar', 'Asking about their life, not only plans, shows them you care who they are.'),
      P('Family map', 'Drawing who is who and what repeats shows the patterns you can keep or change. Go slow, and get support if it feels heavy.',
        ['Draw your family tree back to your grandparents', 'Write one trait that shows up in many of them', 'Write one family pattern you want to keep'],
        ['Ask an older relative how their parents handled hard times', 'Write one pattern you want to stop with you', 'Share your map with one family member and compare notes']),
      P('Out of the middle', 'Talking to a person, not about them, stops family tension running through you.',
        ['Notice one time you were pulled into someone else’s fight', 'Next time, say kindly: you two should talk about this', 'Talk to one relative straight, not through someone else'],
        ['Go a week without passing on family gossip', 'Have one direct talk you would usually send through someone else', 'Step back, kindly, from one old role, like the fixer or the go-between']),
      P('The repair talk', 'Every family clashes. What keeps bonds strong is coming back to fix it.',
        ['Think of one recent clash and what you felt under the anger', 'Send a short message: I am sorry for how I said that', 'Ask one family member how they saw it'],
        ['Have a calm talk to repair one old fight', 'Use I feel and I need, not you always', 'Agree on one small thing you will both do differently']),
    ],
  },
  lover_partner: {
    valueGoals: [
      V('Feel chosen, every day', 'Small daily kindness matters more to a bond than rare grand gestures.'),
      V('Feel present', 'Full attention, even for a short while, is how a partner feels loved.'),
      V('Feel safe', 'Knowing where you stand lets both of you relax and be honest.'),
      V('Feel like a team', 'Couples who face a problem side by side, not face to face, fix more and fight less.'),
      V('Feel playful together', 'Shared play and new things keep a relationship fresh long after the start.'),
      V('Feel understood', 'Being heard without being fixed is what makes a partner feel close.'),
    ],
    projects: [
      P('Small daily things', 'Little acts done often build a store of goodwill for harder days.'),
      P('Screen-free dinners', 'Phones away gives you back the talk that screens quietly take.'),
      P('Out loud', 'Saying what you feel and need stops your partner from having to guess.'),
      P('Notice the small asks', 'Partners reach out in small ways all day. Turning toward them builds trust.',
        ['Notice one time today your partner reached for your attention', 'Put down what you are holding and turn toward them once', 'Ask a follow-up question about something they said'],
        ['For a week, answer every small ask with interest', 'Ask them which moments made them feel noticed', 'Do one thing they mentioned in passing weeks ago']),
      P('Something new together', 'Trying new things as a pair brings back the fun of the early days.',
        ['List five things neither of you has tried', 'Pick one and put it in the calendar', 'Play a game together tonight'],
        ['Do one new thing together this week', 'Learn a small skill together, like a dance or a dish', 'Plan a day trip somewhere new to you both']),
      P('Fight fair', 'A soft start and a short break keep a fight about the problem, not about each other.',
        ['Start your next complaint with I feel, not you always', 'Agree on a word that means: let us take twenty minutes', 'Say one thing you understand about their side'],
        ['Have one hard talk with a soft start and a break when needed', 'After a fight, both name one thing you could do better', 'Ask what need was under your last fight']),
    ],
  },
  self: {
    valueGoals: [
      V('Feel calm when things go wrong', 'A rested body handles stress far better than a tired one.'),
      V('Feel enough', 'Treating yourself like a friend makes it easier to grow, not harder.'),
      V('Feel alive in my body', 'Moving every day often lifts mood and energy, not only the body.'),
      V('Feel steady when feelings run high', 'Calming the body first gives you room to choose what to do next.'),
      V('Feel content with today', 'Being at ease with what is here now leaves room to grow without always chasing.'),
      V('Feel like I live by my values', 'Living by what matters to you feels right even on days that go badly.'),
    ],
    projects: [
      P('Sleep streak', 'Steady sleep is the base that mood, focus and patience stand on.'),
      P('Kinder voice', 'A kinder inner voice helps you try again after a setback instead of giving up.'),
      P('Daily move', 'A little movement every day does more than a big effort once in a while.'),
      P('Check the thought', 'Writing down a harsh thought, with the facts for and against it, often shrinks it.',
        ['Write one thought that upset you today', 'Write the facts for it and the facts against it', 'Write a fairer way to see it'],
        ['Write down a hard thought every day for a week and answer it', 'Test one fear with a small real try and write what happened', 'Spot the thought you have most and write a reply to keep']),
      P('Steady in the storm', 'Simple grounding skills calm the body first so the mind can catch up. Get support if feelings stay heavy.',
        ['Name five things you can see and four you can hear', 'Breathe out longer than you breathe in, for two minutes', 'Hold something cold for thirty seconds when upset'],
        ['Practise one grounding skill every day this week, calm or not', 'Write your own list of three skills that work for you', 'Tell someone you trust what helps you when it gets hard']),
      P('My values', 'Naming what matters most gives you a way to choose when life pulls in many ways.',
        ['Write five things that matter most to you', 'Pick the one you lived least this week', 'Do one small act for that value today'],
        ['Do one act for each of your top three values this week', 'Drop one thing that goes against your values', 'Each day, ask what the person you want to be would do, and do it once']),
    ],
  },
  guru: {
    valueGoals: [
      V('Feel like a student again', 'Learning on purpose keeps the mind curious and your work growing.'),
      V('Feel guided', 'A good guide saves you years of finding out the hard way.'),
      V('Feel like it stuck', 'Teaching what you learn is one of the surest ways to remember it.'),
      V('Feel humble and open', 'Coming as a beginner lets a teacher give you what you came for.'),
      V('Feel I am getting better', 'Seeing your own progress keeps you going when the learning gets hard.'),
      V('Feel thankful to my teachers', 'Honouring the people who taught you keeps the chain of learning alive.'),
    ],
    projects: [
      P('Study hour', 'A fixed hour turns learning from a wish into something that happens.'),
      P('Find a mentor', 'One person who knows your name and your goal can open many doors.'),
      P('Teach it back', 'Explaining a lesson shows you what you really understood.'),
      P('Practise the hard part', 'Skill grows by working on the part you are worst at, with notes, not by repeating what you know.',
        ['Pick the one part of your skill that is weakest', 'Practise only that part for twenty minutes', 'Ask someone better to watch and give you one note'],
        ['Practise the weak part four times this week', 'Record yourself and compare it with someone better', 'Set a clear target and track it for a month']),
      P('Ask for the hard note', 'Asking for honest notes, and thanking people for them, shows you what you cannot see alone.',
        ['Ask one person: what is one thing I could do better?', 'Say thank you, and do not defend yourself', 'Write down the note and one way to use it'],
        ['Ask three people for one note each this month', 'Act on one note and show them the result', 'Ask a teacher what they see in you that you do not']),
      P('Thank a teacher', 'Telling a teacher what their lesson did for you honours them and roots the lesson deeper.',
        ['Write the names of three people who taught you something big', 'Send one of them a short thank-you', 'Write what you still use from them'],
        ['Write a real letter to a teacher and send it', 'Pass one of their lessons on to someone newer', 'Call or visit a teacher you have not spoken to in years']),
    ],
  },
  divine: {
    valueGoals: [
      V('Feel held, even on bad days', 'Feeling part of something larger makes a bad day feel smaller.'),
      V('Feel steady', 'A daily pause trains the mind to come back to calm on its own.'),
      V('Feel enough', 'Thanks before asking turns your eye to what is already good.'),
      V('Feel at peace with what I cannot control', 'Doing your part and letting go of the rest is at the heart of many faiths.'),
      V('Feel lighter without old grudges', 'Letting go of a grudge is for your own peace. It does not mean what happened was fine.'),
      V('Feel connected to something larger', 'Moments of awe shrink everyday worries and remind you that you belong to more.'),
    ],
    projects: [
      P('The breath', 'A few slow breaths before you react give you a moment to choose.'),
      P('The daily pause', 'The same pause at the same time each day becomes a quiet place to return to.'),
      P('Thanks first', 'Saying thanks every day trains the eye to see what is going right.'),
      P('Steady practice', 'A small practice done daily, without chasing results, slowly steadies the mind.',
        ['Choose one practice: prayer, chanting, reading or sitting still', 'Do it for five minutes today', 'Let go of judging how well it went'],
        ['Keep the practice every day for three weeks', 'Read one page of a scripture you trust each day and sit with it', 'Keep the practice on a day you do not feel like it']),
      P('Let one grudge go', 'Forgiving is for your own peace, and it can take time. Go slow, and get support if it is heavy.',
        ['Write the name of one person you hold a small grudge against', 'Write what it costs you to keep holding it', 'Wish them well in one quiet sentence'],
        ['Write a letter of forgiveness you never send', 'Forgive yourself for one old mistake, in writing', 'Tell someone you trust how letting go felt']),
      P('Kind, true and simple', 'Old yogic rules of no harm, truth and enough make a simple test for daily choices.',
        ['Go one day without a harsh word to anyone, yourself included', 'Tell the plain truth in one moment you would usually bend it', 'Give away one thing you do not need'],
        ['Keep no harm, truth and enough for a full week', 'Each night, write where you kept them and where you slipped', 'Buy nothing extra for a week']),
    ],
  },
};

/** The value goals and projects on offer for a pillar, each with its why, so the person can pick one before the pyramid is built. */
export function ladderOptions(relationship: RelationshipKey): { valueGoals: LadderChoice[]; projects: LadderChoice[] } {
  const c = LADDER_CHOICES[relationship];
  return { valueGoals: c.valueGoals.map(({ title, why }) => ({ title, why })), projects: c.projects.map(({ title, why }) => ({ title, why })) };
}

/** The first tasks for a project on offer: its own, or those of the LADDERS pyramid it comes from. Null for a project the person wrote. */
export function projectTasks(relationship: RelationshipKey, project: string, branch: Branch): string[] | null {
  const c = LADDER_CHOICES[relationship].projects.find((p) => p.title === project);
  if (c?.tasks) return branch === 'low' ? c.tasks.starter : c.tasks.stretch;
  const t = Object.values(LADDERS[relationship]).find((l) => l.project === project);
  return t ? (branch === 'low' ? t.starterTasks : t.stretchTasks) : null;
}
