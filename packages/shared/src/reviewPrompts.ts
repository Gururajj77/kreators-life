import { PERIOD_META } from './periods.ts';
import type { Period, PeriodKind, ReviewLayerKind, ReviewTemplate } from './periods.ts';

// ---------------------------------------------------------------------------
// Reviews by layer (2026-11-07, the founder): each built-in review walks one layer of the person's own pyramids, pillar by pillar (the
// seven pillars are the core). A day the tasks, a week the projects, a month the goal outcomes, a quarter the value goals, half a year the
// guiding principles in two parts (the mid-year check-in, opened in July for January to June, and the start-of-year setting, opened in
// January for July to December), and a year the foundations, looking back and setting them for the year ahead.
//
// One set per period, and each question carries a short line naming the method it comes from (2026-11-07, the founder: "using the
// psychology and gita and other methods"): CBT (a thought and a fair second look), ACT (values, the next committed step, making room for
// what is hard), trauma-informed care (you set the pace; every heavy question says it can be skipped), family systems (the roles and
// patterns between people, your own part), improv ("yes, and"), positive psychology (what went well, a strength you used),
// self-compassion, the Bhagavad Gita's karma yoga (your part done well, the result held lightly), and the Stoics and the Buddha on staying
// steady in gain and loss. Our own words in plain English, never a quote from a book or a manual, never a promise, a diagnosis or therapy
// talk (How it works says this is not therapy). Only the server reads this text (the screen gets the templates from the API), so it never
// reaches the web app's shared chunk.
// ---------------------------------------------------------------------------

/** The layer each kind of review walks. */
export const REVIEW_LAYER: Record<PeriodKind, ReviewLayerKind> = { day: 'task', week: 'project', month: 'outcome', quarter: 'value_goal', half: 'principle', year: 'pillar' };

/** The half year's two parts: January to June is the mid-year check-in, July to December the start-of-year setting. */
export type HalfPart = 'checkin' | 'setting';
export function halfPart(p: Pick<Period, 'start'>): HalfPart {
  return p.start.slice(5, 7) === '01' ? 'checkin' : 'setting';
}
export const HALF_PART_NAME: Record<HalfPart, string> = { checkin: 'Mid-year check-in', setting: 'Start-of-year setting' };

/** The review's own name: the kind's, or for half a year the part it is. */
export function reviewNameFor(p: Pick<Period, 'kind' | 'start'>): string {
  return p.kind === 'half' ? HALF_PART_NAME[halfPart(p)] : PERIOD_META[p.kind].name;
}

type PromptSet = Exclude<PeriodKind, 'half'> | 'half_checkin' | 'half_setting';
/** One built-in question and the line under it that names its method. */
export interface ReviewQuestion {
  q: string;
  why: string;
}

/** The built-in questions, five for a day and six or seven for the rest, the first always the walk through the layer, pillar by pillar. */
export const REVIEW_PROMPT_SETS: Record<PromptSet, readonly ReviewQuestion[]> = {
  // A day: the tasks, the pyramid's sixth layer. "The day", never "today", since a morning reminder opens the day before.
  day: [
    { q: "Go through the day's tasks, pillar by pillar. Which did you tick, and which are still open?", why: "The app's own way: each pillar ends in a task, so the day starts there." },
    { q: "What went well in the day? What did you do to help it happen?", why: "From positive psychology: name what went well, and your part in it." },
    { q: "Did you do your part well, whatever the result?", why: "From the Gita's karma yoga: your part is yours to do well. The result is not yours to hold." },
    { q: "If a hard thought came up, write it. Then write a kinder one that is just as true.", why: "From CBT: a thought is not a fact, so give it a fair second look. Skip it if you like." },
    { q: "What is one small next step for the next day, and which pillar is it for?", why: "From ACT: one small step toward what matters to you." },
  ],
  // A week: the projects.
  week: [
    { q: "Go through your projects, pillar by pillar. Which ones moved this week, and what moved them?", why: "The app's own way: a week is for projects, and each one holds up a pillar." },
    { q: "What went well this week? Which of your strengths did you use?", why: "From positive psychology: name what went well, and the strength behind it." },
    { q: "Which project got stuck? What was in your hands, and what was not?", why: "From the Stoics: put your effort where your hands can reach." },
    { q: "Think of a moment with someone this week. Did you take what they gave and build on it?", why: "From improv: “yes, and” means you take what is offered and add to it." },
    { q: "Was there a hard thought about yourself this week? Write it, then a kinder one that is just as true.", why: "From CBT: a thought is not a fact, so check it. Skip it if you like." },
    { q: "Which pillar needs a project or a next task from you next week?", why: "From ACT: pick the next step that fits what matters to you." },
  ],
  // A month: the goal outcomes.
  month: [
    { q: "Look at your goal outcomes, pillar by pillar. What did you see this month that shows one is working?", why: "The app's own way: a goal outcome is a sign you can see, so look for it." },
    { q: "Which results came from your effort, and which came from luck or other people?", why: "From the Gita's karma yoga: do your part well, and hold the result lightly." },
    { q: "Did the same pattern with someone come back this month? What part of it is yours?", why: "From family systems: people fall into roles with each other. You can only change your own part." },
    { q: "When did a plan change on you this month? Did you play along, or freeze?", why: "From improv: meet what comes with a yes, then add your own move." },
    { q: "Was something hard to carry this month? If you want, name it, and let it sit there for a moment.", why: "From ACT: make room for what is hard, instead of pushing it away. You choose how much to write." },
    { q: "What did this month teach you about yourself? Write it without blame.", why: "From self-compassion work: be as kind to yourself as you would be to a friend." },
    { q: "Which goal outcome gets most of your care next month, and what first project will move it?", why: "From ACT: choose what matters, then take the first step." },
  ],
  // A quarter: the value goals.
  quarter: [
    { q: "Read your value goals, pillar by pillar. How often did you feel each one in these three months?", why: "The app's own way: a value goal is how you want to live, so count the days it showed." },
    { q: "Think of a day that felt like your value goals. What was going on that day?", why: "From positive psychology: a good day holds clues you can use again." },
    { q: "What happened that you could not control? How did you meet it?", why: "From the Stoics and the Buddha: stay steady in gain and in loss." },
    { q: "Which value goal still feels far away? What small change to your weeks would bring it closer?", why: "From ACT: a value is a direction, and a small change keeps you on it." },
    { q: "Which role did you play most at home or at work? Is it the part you want to play?", why: "From family systems: each of us plays a role in a group, and we can choose it again." },
    { q: "Do your goal outcomes and projects still serve these value goals? What should stop, and what should start?", why: "The app's own way: each layer holds up the one above it." },
    { q: "What would a kind coach say about your last three months?", why: "From self-compassion work: speak to yourself the way a good coach would." },
  ],
  // Half a year, January to June, opened in July: the guiding principles, checked in on.
  half_checkin: [
    { q: "Read your guiding principles, pillar by pillar. Which ones did you truly live by this half year?", why: "The app's own way: a guiding principle is a line you live by." },
    { q: "When did you act against one? What thought came just before, and what did it teach you?", why: "From CBT: a thought often comes before an act, so look at the thought first." },
    { q: "Did a guiding principle keep you steady in a hard moment? Write only as much as you want.", why: "From trauma-informed care: you set the pace and choose what to look at. You can skip this." },
    { q: "Which guiding principle needs new words to fit your life now?", why: "From ACT: your values grow with you, so the words can change." },
    { q: "Where did you give your best, even if it did not turn out the way you hoped?", why: "From the Gita's karma yoga: the effort is yours. The result was never only yours." },
    { q: "For the rest of the year, which guiding principle will you keep in front of you, and how?", why: "From ACT: a value turns real when you plan the next step for it." },
  ],
  // Half a year, July to December, opened from October to March: the guiding principles, set for the year ahead. "The past year" and
  // "the year ahead", never "this year", since it is answered on either side of 1 January.
  half_setting: [
    { q: "Read your guiding principles, pillar by pillar. Which ones carried you through the past year?", why: "The app's own way: a guiding principle is a line you live by." },
    { q: "Which one did you break most often? Is it still true for you, or does it need new words?", why: "From ACT: a value is a direction to walk in, not a test you pass or fail." },
    { q: "Which parts of the past year were out of your hands? What helped you stay steady?", why: "From the Stoics and the Gita: stay steady in gain and loss, and keep doing your part." },
    { q: "Think of a pattern with family or friends in the past year. What would you like your part in it to be?", why: "From family systems: look at the roles people play, and at your own first." },
    { q: "For each pillar, write the one line you want to live by in the year ahead.", why: "From ACT: name what matters to you, then live toward it." },
    { q: "How will you speak to yourself on a day one of them slips?", why: "From self-compassion work: plan a kind word for a hard day, before it comes." },
  ],
  // A year, opened in January: the foundations, looked back on and set for the year ahead.
  year: [
    { q: "Read each pillar's foundation. Which ones stayed standing this past year, and which cracked?", why: "The app's own way: the foundation is the wide top of each pyramid, and the rest rests on it." },
    { q: "Name one moment in the past year when a foundation held. Which strength did you use?", why: "From positive psychology: name what held, and the strength behind it." },
    { q: "What happened that you could not control? What did it show you about what matters?", why: "From the Gita and the Stoics: stay steady in gain and loss, and keep doing your part." },
    { q: "Which old pattern with family or close people did you see clearly this past year?", why: "From family systems: patterns pass between people, and naming one is a first step." },
    { q: "What are you most thankful for across your seven pillars this past year?", why: "From positive psychology: thanks turns your eyes to what is good." },
    { q: "What do you forgive yourself for from the past year? Write only what you are ready to.", why: "From trauma-informed care: go at your own pace. You can skip this." },
    { q: "Which foundation comes first in the year ahead, and what first project will protect it?", why: "From ACT: choose what matters, then the first step toward it." },
  ],
};

/** Which set a period asks: its kind's, or for half a year its part's. */
const setFor = (p: Pick<Period, 'kind' | 'start'>): PromptSet => (p.kind === 'half' ? (halfPart(p) === 'checkin' ? 'half_checkin' : 'half_setting') : p.kind);

/** The built-in template for a period. Its id stays `builtin:<kind>`; the half picks its part from which half the period is. */
export function builtInTemplateFor(p: Pick<Period, 'kind' | 'start'>): ReviewTemplate {
  const set = REVIEW_PROMPT_SETS[setFor(p)];
  const part = p.kind === 'half' ? { part: halfPart(p) } : {};
  return { id: `builtin:${p.kind}`, kind: p.kind, name: reviewNameFor(p), prompts: set.map((x) => x.q), why: set.map((x) => x.why), ...part, builtIn: true, createdAt: null };
}

/** The built-in template of a kind with no period: the half's is the check-in unless the setting is asked for. */
export function builtInTemplate(kind: PeriodKind, part: HalfPart = 'checkin'): ReviewTemplate {
  return builtInTemplateFor({ kind, start: kind === 'half' && part === 'setting' ? '2000-07-01' : '2000-01-01' });
}

/** Every built-in template, shortest period first, the half's two parts each (the Templates list on Reviews, GET /reviews/templates). */
export function builtInTemplates(): ReviewTemplate[] {
  return [builtInTemplate('day'), builtInTemplate('week'), builtInTemplate('month'), builtInTemplate('quarter'), builtInTemplate('half', 'checkin'), builtInTemplate('half', 'setting'), builtInTemplate('year')];
}
