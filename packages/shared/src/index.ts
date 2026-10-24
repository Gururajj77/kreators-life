// ---------------------------------------------------------------------------
// Kreators Life — shared domain model (used by both the web app and the API)
// ---------------------------------------------------------------------------

export type RelationshipKey =
  | 'servant_leader'
  | 'friendship'
  | 'parent_child'
  | 'lover_partner'
  | 'self'
  | 'guru'
  | 'divine';

export interface Relationship {
  key: RelationshipKey;
  /** Floor of the tower. 1 is the bottom (red), 7 is the top (violet). */
  floor: number;
  name: string;
  character: string;
  color: string;
  soft: string;
  deep: string;
  /** Text color that passes contrast on top of `color`. */
  text: string;
  /** What the character says when you enter its realm. */
  greeting: string;
  /** The question this relationship keeps asking you. */
  question: string;
}

export const RELATIONSHIPS: readonly Relationship[] = [
  {
    key: 'servant_leader',
    floor: 1,
    name: 'Servant leader',
    character: 'Ember',
    color: '#FF4D5E',
    soft: '#FFE4E7',
    deep: '#C42A3A',
    text: '#2B1D3A',
    greeting: "I'm Ember. I look after the people who count on you.",
    question: 'Who did you serve today?',
  },
  {
    key: 'friendship',
    floor: 2,
    name: 'Friendship',
    character: 'Pip',
    color: '#FF8A3D',
    soft: '#FFE8D6',
    deep: '#C65A14',
    text: '#2B1D3A',
    greeting: "I'm Pip. Two lobes, one heart. Who's in your corner?",
    question: 'Who did you show up for?',
  },
  {
    key: 'parent_child',
    floor: 3,
    name: 'Parent & child',
    character: 'Sunny',
    color: '#FFC93C',
    soft: '#FFF3C4',
    deep: '#B88A00',
    text: '#2B1D3A',
    greeting: "I'm Sunny. I carry the little one on my shoulder. Family first, everything else second.",
    question: 'Did family hear from you?',
  },
  {
    key: 'lover_partner',
    floor: 4,
    name: 'Lover & partner',
    character: 'Clover',
    color: '#3FCB7A',
    soft: '#D9F5E5',
    deep: '#1E8A4D',
    text: '#2B1D3A',
    greeting: "I'm Clover. Love is a daily habit, not a yearly highlight.",
    question: 'Was there phone-free time?',
  },
  {
    key: 'self',
    floor: 5,
    name: 'With yourself',
    character: 'Dew',
    color: '#3DA5FF',
    soft: '#D8ECFF',
    deep: '#1766B8',
    text: '#2B1D3A',
    greeting: "I'm Dew. One drop, very clear. How are you really?",
    question: 'Did you rest, move, breathe?',
  },
  {
    key: 'guru',
    floor: 6,
    name: 'With the guru',
    character: 'Sage',
    color: '#5B5BE0',
    soft: '#E0E0FB',
    deep: '#3434A8',
    text: '#FFFFFF',
    greeting: "I'm Sage. Everyone you admire had a teacher. Who's yours?",
    question: 'What did you learn on purpose?',
  },
  {
    key: 'divine',
    floor: 7,
    name: 'With the divine',
    character: 'Lumen',
    color: '#8F3BFF',
    soft: '#ECDFFF',
    deep: '#5E1FB8',
    text: '#FFFFFF',
    greeting: "I'm Lumen. Something bigger than the daily rush is watching over you.",
    question: 'Did you pause for awe?',
  },
] as const;

export const RELATIONSHIP_BY_KEY: Record<RelationshipKey, Relationship> = Object.fromEntries(
  RELATIONSHIPS.map((r) => [r.key, r]),
) as Record<RelationshipKey, Relationship>;

export function isRelationshipKey(v: unknown): v is RelationshipKey {
  return typeof v === 'string' && v in RELATIONSHIP_BY_KEY;
}

// ---------------------------------------------------------------------------
// The ladder: pillar → principle → value goal → outcome → project → task
// ---------------------------------------------------------------------------

export const KINDS = ['pillar', 'principle', 'value_goal', 'outcome', 'project', 'task'] as const;
export type NodeKind = (typeof KINDS)[number];

export interface KindMeta {
  kind: NodeKind;
  rung: number;
  label: string;
  plural: string;
  /** Shown as the placeholder when adding one. */
  prompt: string;
  /** One-line explanation shown under the rung title. */
  hint: string;
}

export const KIND_META: Record<NodeKind, KindMeta> = {
  pillar: {
    kind: 'pillar',
    rung: 1,
    label: 'Pillar',
    plural: 'Pillars',
    prompt: 'A foundation you refuse to let crack',
    hint: 'The foundations. What must stay standing no matter what.',
  },
  principle: {
    kind: 'principle',
    rung: 2,
    label: 'Guiding principle',
    plural: 'Guiding principles',
    prompt: 'A rule you live by so the pillar holds',
    hint: 'Rules you live by so the pillars stay strong.',
  },
  value_goal: {
    kind: 'value_goal',
    rung: 3,
    label: 'Value goal',
    plural: 'Value goals',
    prompt: 'A feeling you want more of',
    hint: 'Emotional goals. No numbers needed, just how you want to feel.',
  },
  outcome: {
    kind: 'outcome',
    rung: 4,
    label: 'Goal outcome',
    plural: 'Goal outcomes',
    prompt: 'What the world looks like when the feeling is real',
    hint: 'What becomes true when the value goal is met.',
  },
  project: {
    kind: 'project',
    rung: 5,
    label: 'Project',
    plural: 'Projects',
    prompt: 'A bundle of work with a finish line',
    hint: 'Grouped work that moves an outcome.',
  },
  task: {
    kind: 'task',
    rung: 6,
    label: 'Task',
    plural: 'Tasks',
    prompt: 'One thing you can tick off today',
    hint: 'Small moves. Tick one and the whole ladder feels it.',
  },
};

export function parentKind(kind: NodeKind): NodeKind | null {
  const i = KINDS.indexOf(kind);
  return i <= 0 ? null : KINDS[i - 1]!;
}

export function childKind(kind: NodeKind): NodeKind | null {
  const i = KINDS.indexOf(kind);
  return i < 0 || i === KINDS.length - 1 ? null : KINDS[i + 1]!;
}

export function isNodeKind(v: unknown): v is NodeKind {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// XP rules
// ---------------------------------------------------------------------------

export const XP = {
  task: 20,
  checkin: 10,
  spark: 15,
  projectClear: 30,
  /** XP that ripples up to each ancestor when a task is completed. */
  ripple: {
    project: 10,
    outcome: 8,
    value_goal: 6,
    principle: 4,
    pillar: 2,
  } as Record<Exclude<NodeKind, 'task'>, number>,
} as const;

/** Level n starts at 60 * n * (n - 1) XP: 0, 120, 360, 720, 1200 ... */
export function xpForLevel(level: number): number {
  return 60 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function levelProgress(xp: number): { level: number; into: number; span: number; pct: number } {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  const into = xp - start;
  const span = end - start;
  return { level, into, span, pct: Math.min(1, into / span) };
}

// ---------------------------------------------------------------------------
// Vibe check — an adaptive flow, not a fixed form. Each floor asks a gauge
// question, then a probe that depends on the answer, then a foundation
// question whose options are pillars. The rest of the ladder is derived from
// those choices, so nothing has to be typed in.
// ---------------------------------------------------------------------------

export type QuestionFormat = 'pick' | 'scale' | 'yesno';
export type QuestionRole = 'gauge' | 'probe' | 'foundation';
export type Branch = 'low' | 'high';

export interface FlowOption {
  label: string;
  emoji: string;
  /** Contribution to the relationship score, 0 to 4. Foundation options carry none. */
  points?: number;
  /** Question to go to next. Null ends this floor. */
  next: string | null;
  /** Foundation options name the pillar they stand for. */
  pillar?: string;
}

export interface Question {
  id: string;
  relationship: RelationshipKey;
  role: QuestionRole;
  format: QuestionFormat;
  prompt: string;
  options?: FlowOption[];
  scale?: { labels: [string, string, string, string, string]; reverse?: boolean; nextLow: string; nextHigh: string };
  yes?: { points: number; next: string | null };
  no?: { points: number; next: string | null };
}

export const MAX_POINTS_PER_QUESTION = 4;
/** Gauge plus probe. */
export const MAX_POINTS_PER_RELATIONSHIP = 8;
/** Scale answers at or below this many points take the low branch. */
export const LOW_BRANCH_MAX_POINTS = 1;

const scale = (
  id: string,
  relationship: RelationshipKey,
  prompt: string,
  labels: [string, string, string, string, string],
  reverse = false,
): Question => ({
  id,
  relationship,
  role: 'gauge',
  format: 'scale',
  prompt,
  scale: { labels, reverse, nextLow: `${relationship}.pl`, nextHigh: `${relationship}.ph` },
});

const probe = (id: string, relationship: RelationshipKey, prompt: string, options: [string, string, number][]): Question => ({
  id,
  relationship,
  role: 'probe',
  format: 'pick',
  prompt,
  options: options.map(([label, emoji, points]) => ({ label, emoji, points, next: `${relationship}.f` })),
});

const foundation = (relationship: RelationshipKey, prompt: string, options: [string, string, string][]): Question => ({
  id: `${relationship}.f`,
  relationship,
  role: 'foundation',
  format: 'pick',
  prompt,
  options: options.map(([pillar, label, emoji]) => ({ label, emoji, pillar, next: null })),
});

export const QUESTIONS: readonly Question[] = [
  // Ember
  scale('servant_leader.g', 'servant_leader', 'When people who count on you ask for something, how often do you follow through?', ['Never', 'Rarely', 'Sometimes', 'Usually', 'Always']),
  probe('servant_leader.pl', 'servant_leader', 'What usually gets in the way of helping them?', [
    ['I don’t really know what they need', '🤷', 1],
    ['I know, but my own plans win', '🎯', 2],
    ['No time. My own list eats everything', '⏰', 1],
  ]),
  probe('servant_leader.ph', 'servant_leader', 'What keeps you helping even when it is not fun?', [
    ['They tell me it helped', '💌', 4],
    ['It is just who I am', '🧭', 4],
    ['Honestly, the recognition', '🏅', 2],
  ]),
  foundation('servant_leader', 'Pick the foundation that must never crack:', [
    ['serve_first', 'Serve first, then ask', '🤝'],
    ['answer_everything', 'Every real question gets a real answer', '💬'],
    ['lift_others', 'Lift other people up', '🪜'],
  ]),
  // Pip
  scale('friendship.g', 'friendship', 'How many friends could you call at 2am after a rough day?', ['None', 'One', 'Two', 'A few', 'A crew']),
  probe('friendship.pl', 'friendship', 'What happened to the friendships?', [
    ['Work ate my calendar', '⏰', 1],
    ['I moved, or they did', '📦', 2],
    ['I only talk in group chats now', '💬', 1],
  ]),
  probe('friendship.ph', 'friendship', 'What keeps your friendships alive?', [
    ['We have rituals, like a weekly call', '🔁', 4],
    ['We show up for the big stuff', '🎂', 3],
    ['We just never stopped talking', '💞', 4],
  ]),
  foundation('friendship', 'Pick the foundation that must never crack:', [
    ['be_present', 'Be present, not just reachable', '🫶'],
    ['show_up', 'Show up in person, on time', '🚪'],
    ['rituals', 'Keep one friendship ritual alive', '🔁'],
  ]),
  // Sunny
  scale('parent_child.g', 'parent_child', 'How often do you talk with family about something that is not logistics?', ['Never', 'Monthly', 'Weekly', 'Most days', 'Daily']),
  probe('parent_child.pl', 'parent_child', 'What makes it hard?', [
    ['We only talk about plans and money', '📋', 1],
    ['They don’t get what I do', '🤷', 1],
    ['I keep saying I’ll call later', '⏳', 2],
  ]),
  probe('parent_child.ph', 'parent_child', 'What makes it easy?', [
    ['We have a standing call', '📞', 4],
    ['I tell them news first', '🎁', 4],
    ['We live close and just drop by', '🏡', 3],
  ]),
  foundation('parent_child', 'Pick the foundation that must never crack:', [
    ['first_call', 'Family gets the first call', '📞'],
    ['share_first', 'Family hears it first', '🎁'],
    ['real_questions', 'Ask real questions, not updates', '❓'],
  ]),
  // Clover
  scale('lover_partner.g', 'lover_partner', 'Phone-free time with your partner, or a date, this week?', ['None', 'Once', 'Twice', 'Most days', 'Every day']),
  probe('lover_partner.pl', 'lover_partner', 'What is stealing that time?', [
    ['Screens, even in bed', '📱', 1],
    ['Working late every night', '💼', 1],
    ['I am single and not making time to date', '🌱', 2],
  ]),
  probe('lover_partner.ph', 'lover_partner', 'What protects that time?', [
    ['Phones in another room at dinner', '🍽️', 4],
    ['We plan dates like appointments', '📅', 4],
    ['We share the same goals', '🤝', 3],
  ]),
  foundation('lover_partner', 'Pick the foundation that must never crack:', [
    ['daily_love', 'Love is daily, not a highlight reel', '💗'],
    ['phones_down', 'Phones down when we are together', '📵'],
    ['chosen', 'Choose them out loud', '🗣️'],
  ]),
  // Dew
  scale('self.g', 'self', 'Hours of sleep last night?', ['Under 5', '5 to 6', '6 to 7', '7 to 8', '8 plus']),
  probe('self.pl', 'self', 'What keeps you up?', [
    ['Working late', '🌙', 1],
    ['Scrolling in bed', '📱', 1],
    ['My head will not stop', '🌀', 2],
  ]),
  probe('self.ph', 'self', 'What is your rest secret?', [
    ['A hard stop every night', '⏹️', 4],
    ['No screens in bed', '🛏️', 4],
    ['I move my body every day', '🏃', 3],
  ]),
  foundation('self', 'Pick the foundation that must never crack:', [
    ['rest_is_work', 'Rest is part of the work', '😴'],
    ['kind_inner_voice', 'Talk to myself like a friend', '💬'],
    ['move_daily', 'Move every day', '🏃'],
  ]),
  // Sage
  scale('guru.g', 'guru', 'When did you last ask a mentor a real question?', ['This week', 'This month', 'This quarter', 'This year', 'Never'], true),
  probe('guru.pl', 'guru', 'What stops you?', [
    ['I don’t have anyone to ask', '🔍', 1],
    ['I feel like I should already know', '😶', 1],
    ['I admire people but never reach out', '👀', 2],
  ]),
  probe('guru.ph', 'guru', 'How do you learn best?', [
    ['I ask, then I do', '🙋', 4],
    ['I study and copy the method', '📚', 4],
    ['I take courses and finish them', '🎓', 3],
  ]),
  foundation('guru', 'Pick the foundation that must never crack:', [
    ['learn_on_purpose', 'Learn on purpose, not by accident', '🎯'],
    ['find_a_guru', 'Have someone to ask', '🧭'],
    ['teach_to_learn', 'Teach what I learn', '🧑‍🏫'],
  ]),
  // Lumen
  scale('divine.g', 'divine', 'How often do you pause for something bigger than your to-do list? Prayer, meditation, nature, awe.', ['Never', 'Rarely', 'Weekly', 'Most days', 'Daily']),
  probe('divine.pl', 'divine', 'What gets in the way?', [
    ['I forget it exists', '🫥', 1],
    ['It feels unproductive', '⏱️', 1],
    ['I want to, I just don’t have a practice', '🌱', 2],
  ]),
  probe('divine.ph', 'divine', 'What is your practice?', [
    ['Prayer or meditation', '🙏', 4],
    ['Nature and awe', '🌄', 4],
    ['Gratitude, written down', '📓', 3],
  ]),
  foundation('divine', 'Pick the foundation that must never crack:', [
    ['bigger_than_me', 'Something is bigger than my to-do list', '🌌'],
    ['daily_pause', 'A daily pause that is mine', '🕯️'],
    ['gratitude', 'Say thanks before I ask', '🙏'],
  ]),
];

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function firstQuestionId(relationship: RelationshipKey): string {
  return `${relationship}.g`;
}

export function pointsForAnswer(q: Question, value: number): number {
  if (q.format === 'pick') return q.options?.[value]?.points ?? 0;
  if (q.format === 'scale') {
    const clamped = Math.max(0, Math.min(4, Math.round(value)));
    return q.scale?.reverse ? 4 - clamped : clamped;
  }
  return value ? (q.yes?.points ?? 4) : (q.no?.points ?? 0);
}

/** Where the flow goes after answering `q` with `value`. Null means this floor is done. */
export function nextQuestionId(q: Question, value: number): string | null {
  if (q.format === 'scale' && q.scale) {
    return pointsForAnswer(q, value) <= LOW_BRANCH_MAX_POINTS ? q.scale.nextLow : q.scale.nextHigh;
  }
  if (q.format === 'pick') return q.options?.[value]?.next ?? null;
  return value ? (q.yes?.next ?? null) : (q.no?.next ?? null);
}

/** The floor after this one in the flow, or null after the top floor. */
export function nextRelationship(relationship: RelationshipKey): RelationshipKey | null {
  const i = RELATIONSHIPS.findIndex((r) => r.key === relationship);
  return RELATIONSHIPS[i + 1]?.key ?? null;
}

export type Answers = Record<string, number>;

export function scoreAnswers(answers: Answers): Record<RelationshipKey, number> {
  const totals = Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, 0])) as Record<RelationshipKey, number>;
  for (const [id, value] of Object.entries(answers)) {
    const q = QUESTION_BY_ID[id];
    if (!q || q.role === 'foundation') continue;
    totals[q.relationship] += pointsForAnswer(q, value);
  }
  return Object.fromEntries(
    RELATIONSHIPS.map((r) => [r.key, Math.round((Math.min(totals[r.key], MAX_POINTS_PER_RELATIONSHIP) / MAX_POINTS_PER_RELATIONSHIP) * 100)]),
  ) as Record<RelationshipKey, number>;
}

export function branchFor(relationship: RelationshipKey, answers: Answers): Branch {
  const g = QUESTION_BY_ID[firstQuestionId(relationship)];
  const v = answers[g?.id ?? ''];
  if (!g || v === undefined) return 'low';
  return pointsForAnswer(g, v) <= LOW_BRANCH_MAX_POINTS ? 'low' : 'high';
}

export function chosenPillar(relationship: RelationshipKey, answers: Answers): string | null {
  const f = QUESTION_BY_ID[`${relationship}.f`];
  const v = answers[f?.id ?? ''];
  if (!f || v === undefined) return null;
  return f.options?.[v]?.pillar ?? null;
}

// ---------------------------------------------------------------------------
// Ladders — one per pillar. The branch picks gentler or bolder tasks.
// ---------------------------------------------------------------------------

export interface LadderTemplate {
  pillar: string;
  principle: string;
  valueGoal: string;
  outcome: string;
  project: string;
  starterTasks: string[];
  stretchTasks: string[];
}

const L = (
  pillar: string,
  principle: string,
  valueGoal: string,
  outcome: string,
  project: string,
  starterTasks: string[],
  stretchTasks: string[],
): LadderTemplate => ({ pillar, principle, valueGoal, outcome, project, starterTasks, stretchTasks });

export const LADDERS: Record<RelationshipKey, Record<string, LadderTemplate>> = {
  servant_leader: {
    serve_first: L('Serve first, then ask', 'Ask what people need before deciding what to do', 'Feel useful to my people', 'People around me feel heard', 'Listening week',
      ['Ask one person what would help them this week', 'Answer a question someone asked you days ago', 'Thank one person out loud for showing up'],
      ['Ask three people what they need and act on one', 'Do one useful thing for your team that nobody asked for', 'Hold a thirty-minute open question session']),
    answer_everything: L('Every real question gets a real answer', 'No message left on read', 'Feel trusted', 'Messages answered every week', 'Inbox zero, kindly',
      ['Answer three messages you have been avoiding', 'Write down the question people ask you most', 'Reply to one message with a full, kind answer'],
      ['Clear your messages to zero', 'Write a short guide that answers your most-asked question', 'Set a weekly answering hour and keep it']),
    lift_others: L('Lift other people up', 'Share the credit on purpose', 'Feel generous', 'Three people who grew because of me', 'Lift someone',
      ['Give one person credit for their work, out loud', 'Write a note of encouragement to someone newer than you', 'Recommend someone when asked for advice'],
      ['Spend an hour helping someone newer than you', 'Give a newcomer a real chance on something you own', 'Introduce two people who should know each other']),
  },
  friendship: {
    be_present: L('Be present, not just reachable', 'When I am with friends, I am with them', 'Feel known', 'Two friends who hear from me weekly', 'Real hangs',
      ['Text one friend something that is not about work', 'Send a voice note to an old friend', 'Put the phone in your bag for one coffee'],
      ['Plan a hang with no phones at all', 'Spend a full day with a friend, screens off', 'Tell a friend what you have been struggling with']),
    show_up: L('Show up in person, on time', 'If I said yes, I am there', 'Feel reliable', 'Zero cancelled plans this month', 'The yes list',
      ['Say yes to the next invite and go', 'Confirm one plan you have been vague about', 'Arrive early to one thing this week'],
      ['Host a small dinner for three friends', 'Travel to see a friend you keep postponing', 'Organize the next reunion yourself']),
    rituals: L('Keep one friendship ritual alive', 'Same time, same people, every week', 'Feel anchored', 'A weekly ritual that survives busy weeks', 'Weekly ritual',
      ['Pick one friend and one weekly time slot', 'Do the first call, even if it is ten minutes', 'Put it in the calendar as a repeat'],
      ['Keep the ritual four weeks in a row', 'Add a second friend to the ritual', 'Protect the ritual during your busiest week']),
  },
  parent_child: {
    first_call: L('Family gets the first call', 'Everything else can wait ten minutes', 'Feel close to home', 'Family that knows what my week was like', 'The ten-minute call',
      ['Call a parent or kid for ten minutes with no agenda', 'Send a photo from your day to family', 'Reply to the family chat today'],
      ['Make the call three times this week', 'Plan a visit and put it in the calendar', 'Have one call where you only listen']),
    share_first: L('Family hears it first', 'They hear the news before anyone else', 'Feel like they are part of it', 'Family that can explain what I do', 'Family first',
      ['Tell family your next bit of news before anyone else', 'Ask what they thought and actually listen', 'Explain one thing about your work in plain words'],
      ['Do something together that you usually do alone', 'Show them what a normal day looks like for you', 'Let a family member plan your next weekend']),
    real_questions: L('Ask real questions, not updates', 'One real question per conversation', 'Feel close', 'I know what my family worries about', 'The question jar',
      ['Ask a family member one question about their life, not yours', 'Ask about a story from before you were born', 'Ask what they are proud of this year'],
      ['Record a family story, with permission', 'Have the hard conversation you have been avoiding', 'Write a letter to a family member and send it']),
  },
  lover_partner: {
    daily_love: L('Love is daily, not a highlight reel', 'One small kindness every day', 'Feel chosen, every day', 'A relationship that does not run on anniversaries', 'Small daily things',
      ['Do one small kind thing today, unannounced', 'Say one specific thank you', 'Ask what their day was like before sharing yours'],
      ['Seven days of one small thing, no repeats', 'Plan a surprise that costs nothing', 'Write three things you love about them and share one']),
    phones_down: L('Phones down when we are together', 'Phones in another room at meals', 'Feel present', 'One phone-free hour most days', 'Screen-free dinners',
      ['One dinner with phones in another room', 'No phone for the first ten minutes together', 'Charge your phone outside the bedroom tonight'],
      ['Five screen-free dinners this week', 'A full screen-free evening', 'A weekend morning with no devices']),
    chosen: L('Choose them out loud', 'Say the quiet part out loud', 'Feel safe', 'A partner who knows where they stand', 'Out loud',
      ['Tell your partner what your week looks like', 'Say one thing you appreciate, out loud', 'Ask one thing they need from you this week'],
      ['Have a monthly check-in conversation', 'Share a fear about your work with them', 'Plan a date that has nothing to do with work']),
  },
  self: {
    rest_is_work: L('Rest is part of the work', 'Sleep comes before the second shift', 'Feel calm when things go wrong', 'Seven hours of sleep, five nights a week', 'Sleep streak',
      ['In bed by a fixed time tonight', 'Phone charging outside the bedroom', 'No work messages after nine tonight'],
      ['Five nights of seven hours this week', 'A full day off from work', 'A no-screens hour before bed, all week']),
    kind_inner_voice: L('Talk to myself like a friend', 'A setback is data, not a verdict', 'Feel enough', 'I can hear bad news without spiralling', 'Kinder voice',
      ['Write down one thing you did well today', 'Rewrite one harsh thought the way a friend would say it', 'List three things that are going right'],
      ['Keep a nightly wins note for seven days', 'Share something imperfect on purpose', 'Tell someone about a setback without the joke']),
    move_daily: L('Move every day', 'Move before I scroll', 'Feel alive in my body', 'Thirty minutes of movement most days', 'Daily move',
      ['A twenty-minute walk with no headphones', 'Stretch for five minutes right now', 'Walk one errand instead of driving'],
      ['Move thirty minutes, five days this week', 'Try one new kind of movement', 'Walk a full hour with no phone']),
  },
  guru: {
    learn_on_purpose: L('Learn on purpose, not by accident', 'One deliberate study hour a week', 'Feel like a student again', 'A skill that improves on a schedule', 'Study hour',
      ['Learn one thing from someone better than you and write it down', 'Pick one skill to study this month', 'Block one study hour in the calendar'],
      ['Four study hours in four weeks', 'Copy one master’s method end to end', 'Write a one-page summary of what you learned']),
    find_a_guru: L('Have someone to ask', 'Ask a real question every week', 'Feel guided', 'A mentor who knows my name', 'Find a mentor',
      ['List three people you could learn from', 'Send one of them a specific question', 'Ask someone you admire how they got started'],
      ['Ask for a fifteen-minute call', 'Follow one piece of advice and report back', 'Join a group where your mentor spends time']),
    teach_to_learn: L('Teach what I learn', 'Explain it to someone within a week', 'Feel like it stuck', 'Everything I learn gets taught once', 'Teach it back',
      ['Explain one thing you learned to a friend', 'Write three sentences about something you learned', 'Answer a beginner’s question in your field'],
      ['Write a one-page guide from this week’s lesson', 'Run a small session for people newer than you', 'Mentor one person for a month']),
  },
  divine: {
    bigger_than_me: L('Something is bigger than my to-do list', 'Breathe before I react', 'Feel held, even on bad days', 'One bad day never feels like the whole world', 'The breath',
      ['Three slow breaths before your next hard conversation', 'Five minutes outside looking at the sky', 'Notice one beautiful, useless thing today'],
      ['Breathe before every meeting for a week', 'A full hour in nature with no phone', 'Sit in silence for ten minutes']),
    daily_pause: L('A daily pause that is mine', 'Same pause, same time, every day', 'Feel steady', 'A daily pause that survives busy weeks', 'The daily pause',
      ['Pick a time and a place for your pause', 'Do a two-minute pause today', 'Set one gentle reminder'],
      ['Pause seven days in a row', 'Extend the pause to ten minutes', 'Keep the pause on your busiest day']),
    gratitude: L('Say thanks before I ask', 'Thanks first, asks second', 'Feel enough', 'I can name what is good before what is missing', 'Thanks first',
      ['Say thanks for one thing out loud', 'Write three things you are grateful for', 'Thank one person who helped you this year'],
      ['Seven days of written thanks', 'Start every work day with one thank you', 'Write a thank-you to someone who will never see it']),
  },
};

export const DEFAULT_PILLAR: Record<RelationshipKey, string> = {
  servant_leader: 'serve_first',
  friendship: 'be_present',
  parent_child: 'first_call',
  lover_partner: 'daily_love',
  self: 'rest_is_work',
  guru: 'find_a_guru',
  divine: 'bigger_than_me',
};

export interface DerivedLadder {
  relationship: RelationshipKey;
  pillarKey: string;
  branch: Branch;
  pillar: string;
  principle: string;
  valueGoal: string;
  outcome: string;
  project: string;
  tasks: string[];
}

/** Turn a floor's answers into its ladder. Falls back to the default pillar when the floor was skipped. */
export function deriveLadder(relationship: RelationshipKey, answers: Answers): DerivedLadder {
  const pillarKey = chosenPillar(relationship, answers) ?? DEFAULT_PILLAR[relationship];
  const t = LADDERS[relationship][pillarKey] ?? LADDERS[relationship][DEFAULT_PILLAR[relationship]]!;
  const branch = branchFor(relationship, answers);
  return {
    relationship,
    pillarKey,
    branch,
    pillar: t.pillar,
    principle: t.principle,
    valueGoal: t.valueGoal,
    outcome: t.outcome,
    project: t.project,
    tasks: branch === 'low' ? t.starterTasks : t.stretchTasks,
  };
}

export function deriveAllLadders(answers: Answers): Record<RelationshipKey, DerivedLadder> {
  return Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, deriveLadder(r.key, answers)])) as Record<RelationshipKey, DerivedLadder>;
}

// ---------------------------------------------------------------------------
// Wait times — the game only pays for things that took real time.
// ---------------------------------------------------------------------------

export const WAIT = {
  /** A task must sit this long after being written (or renamed) before it can be ticked. */
  taskMinAgeMinutes: 10,
  /** Only this many task completions per rolling day earn xp. The rest still count as done. */
  dailyRewardedTasks: 6,
  /** A client date may differ from the server's UTC date by at most this many days. */
  dateWindowDays: 1,
} as const;

// ---------------------------------------------------------------------------
// Sparks — tiny daily micro-challenges from the character that needs you most
// ---------------------------------------------------------------------------

export const SPARKS: Record<RelationshipKey, string[]> = {
  servant_leader: [
    'Help one person with something before they ask.',
    'Give someone credit out loud today.',
    'Answer a message you have been putting off.',
    'Ask someone who counts on you what they need this week.',
    'Do one thing today that helps, not just impresses.',
  ],
  friendship: [
    'Send a friend a photo that made you think of them.',
    'Call a friend for two minutes. Just to say hi.',
    'Tell a friend one thing you admire about them.',
    'Invite someone to something this week.',
    'Reply to the group chat you have been ignoring.',
  ],
  parent_child: [
    'Send a parent or kid a voice note.',
    'Ask a family member about their day before talking about yours.',
    'Tell family one piece of good news before anyone else.',
    'Look at an old family photo for one full minute.',
    'Plan one family thing for this weekend.',
  ],
  lover_partner: [
    'Put your phone in another room for one meal.',
    'Say one specific thank you to your partner.',
    'Ask your partner what they want from this week.',
    'Plan a date that has nothing to do with work.',
    'Hug for ten full seconds.',
  ],
  self: [
    'Drink a glass of water before you check your phone.',
    'Stretch for two minutes right now.',
    'Write one sentence about how you actually feel.',
    'Take a ten-minute walk without headphones.',
    'Go to bed thirty minutes earlier tonight.',
  ],
  guru: [
    'Learn one thing from someone better than you and write it down.',
    'Ask one specific question to someone you learn from.',
    'Re-read your notes from the last thing you studied.',
    'Teach one thing you learned this week to someone.',
    'Find one person to learn from this month.',
  ],
  divine: [
    'Take three slow breaths before your next hard task.',
    'Step outside and look up for one minute.',
    'Say thanks for one thing out loud.',
    'Sit in silence for five minutes.',
    'Notice one thing that is beautiful and not useful.',
  ],
};

/** Deterministic spark for a given date (YYYY-MM-DD) and relationship. */
export function sparkFor(relationship: RelationshipKey, date: string): string {
  const list = SPARKS[relationship];
  let h = 0;
  for (const ch of date + relationship) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length]!;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface Badge {
  key: string;
  name: string;
  emoji: string;
  how: string;
}

export const BADGES: readonly Badge[] = [
  { key: 'first_task', name: 'First tick', emoji: '✅', how: 'Complete your first task' },
  { key: 'streak_3', name: 'Three in a row', emoji: '🔥', how: 'Check in three days running' },
  { key: 'streak_7', name: 'Full week', emoji: '🌈', how: 'Check in seven days running' },
  { key: 'all_seven', name: 'Seven floors', emoji: '🏰', how: 'Add a pillar in every relationship' },
  { key: 'ten_tasks', name: 'Ripple maker', emoji: '🌊', how: 'Complete ten tasks' },
  { key: 'project_clear', name: 'Project cleared', emoji: '🏁', how: 'Finish every task in a project' },
  { key: 'level_5', name: 'Level five', emoji: '⭐', how: 'Reach level five' },
  { key: 'spark_5', name: 'Spark plug', emoji: '⚡', how: 'Do five sparks' },
];

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

/** What fills most of someone's days. Stored as the profile's focus. */
export const FOCUS_OPTIONS = ['Work', 'Study', 'Family', 'Business', 'Creating', 'Other'] as const;

export interface User {
  id: string;
  displayName: string;
  focus: string;
  xp: number;
  /** Redeemable points, separate from xp. Earned by showing up. */
  points: number;
  isPro: boolean;
  leaderboardOptIn: boolean;
  streak: number;
  bestStreak: number;
  lastCheckin: string | null;
  onboardedAt: string | null;
  createdAt: string;
}

export interface RelationshipState {
  key: RelationshipKey;
  /** 0–100 from the vibe check. */
  score: number;
  xp: number;
  level: number;
  pillars: number;
  activeTasks: number;
  doneTasks: number;
  /** Character evolution stage, 1 to 4. */
  stage: number;
  /** Days since this floor's first pillar. Null when nothing is built. */
  floorAgeDays: number | null;
}

export interface MeResponse {
  user: User;
  relationships: RelationshipState[];
  /** Earned badges, computed from stats. */
  badges: string[];
  /** Awarded honors: given by an admin or unlocked with time. */
  honors: string[];
  identity: Evolution;
  stats: { tasksDone: number; sparksDone: number; projectsCleared: number };
}

export interface Node {
  id: string;
  kind: NodeKind;
  parentId: string | null;
  relationship: RelationshipKey;
  title: string;
  note: string;
  status: 'active' | 'done' | 'archived';
  xp: number;
  dueDate: string | null;
  completedAt: string | null;
  /** Tasks only: when it can first be ticked. Writing it or renaming it starts the wait. */
  readyAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RippleEvent {
  id: string;
  kind: NodeKind;
  title: string;
  amount: number;
}

export interface CompleteResponse {
  node: Node;
  ripple: RippleEvent[];
  projectCleared: Node | null;
  totalXp: number;
  newBadges: string[];
  /** True when the daily rewarded-task limit was already reached, so this one earned nothing. */
  capped: boolean;
}

export interface TodayResponse {
  date: string;
  checkedIn: boolean;
  streak: number;
  tasks: Node[];
  /** Tasks ticked in the last day, so Today can say the routine is done. */
  doneRecently: number;
  spark: { relationship: RelationshipKey; text: string; done: boolean };
}

export interface OnboardingAnswer {
  questionId: string;
  value: number;
}

export interface OnboardingResponse {
  scores: Record<RelationshipKey, number>;
  weakest: RelationshipKey[];
  /** One derived ladder per floor, ready to build. */
  ladders: Record<RelationshipKey, DerivedLadder>;
}

export interface CheckinResponse {
  streak: number;
  bestStreak: number;
  awarded: number;
  /** Redeemable points awarded, including any streak bonus. */
  points: number;
  streakBonus: number;
  alreadyCheckedIn: boolean;
}

// ---------------------------------------------------------------------------
// Evolution — identity and characters evolve in stages. The next form fills in
// as xp arrives, and each stage also needs time before it can happen.
// ---------------------------------------------------------------------------

export interface EvolutionStage {
  stage: number;
  name: string;
  minXp: number;
  /** Days that must pass before this stage can be reached, however much xp there is. */
  minDays: number;
  blurb: string;
}

export const CHARACTER_STAGES: readonly EvolutionStage[] = [
  { stage: 1, name: 'Spark', minXp: 0, minDays: 0, blurb: 'Just woke up.' },
  { stage: 2, name: 'Glow', minXp: 150, minDays: 2, blurb: 'Starting to shine.' },
  { stage: 3, name: 'Blaze', minXp: 500, minDays: 10, blurb: 'Hard to miss.' },
  { stage: 4, name: 'Beacon', minXp: 1200, minDays: 30, blurb: 'Others steer by it.' },
];

export const IDENTITY_STAGES: readonly EvolutionStage[] = [
  { stage: 1, name: 'Seed', minXp: 0, minDays: 0, blurb: 'Everything is still underground.' },
  { stage: 2, name: 'Sprout', minXp: 300, minDays: 3, blurb: 'First habits breaking the surface.' },
  { stage: 3, name: 'Climber', minXp: 900, minDays: 14, blurb: 'The ladder is holding weight.' },
  { stage: 4, name: 'Steady hand', minXp: 2000, minDays: 45, blurb: 'Seven floors, all lit.' },
  { stage: 5, name: 'Luminary', minXp: 4000, minDays: 120, blurb: 'People climb because you did.' },
];

export interface Evolution {
  stage: EvolutionStage;
  next: EvolutionStage | null;
  /** 0 to 1, how charged the next evolution is by xp. 1 at the final stage. */
  charge: number;
  xpToNext: number;
  /** Days still to wait before the next stage can happen, even when fully charged. */
  readyInDays: number;
  /** True when xp is there but the clock is not. The evolution is being prepared. */
  preparing: boolean;
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}

/** `ageDays` is how long the thing evolving has existed: the account, or the floor. */
export function evolutionFor(stages: readonly EvolutionStage[], xp: number, ageDays = Number.POSITIVE_INFINITY): Evolution {
  let current = stages[0]!;
  for (const st of stages) if (xp >= st.minXp && ageDays >= st.minDays) current = st;
  const next = stages.find((st) => st.stage === current.stage + 1) ?? null;
  if (!next) return { stage: current, next: null, charge: 1, xpToNext: 0, readyInDays: 0, preparing: false };
  const span = next.minXp - current.minXp;
  const into = xp - current.minXp;
  const charge = Math.max(0, Math.min(1, into / span));
  const readyInDays = Math.max(0, Math.ceil(next.minDays - ageDays));
  return { stage: current, next, charge, xpToNext: Math.max(0, next.minXp - xp), readyInDays, preparing: charge >= 1 && readyInDays > 0 };
}

// ---------------------------------------------------------------------------
// Honors — the second kind of badge. Not earned by stats: given by the team or
// unlocked by time on the tower. Both count on the leaderboard.
// ---------------------------------------------------------------------------

export interface Honor {
  key: string;
  name: string;
  emoji: string;
  source: 'admin' | 'time';
  /** For time honors: days since the account started. */
  days?: number;
  how: string;
}

export const HONORS: readonly Honor[] = [
  { key: 'pro', name: 'Pro', emoji: '💎', source: 'admin', how: 'Given by the Kreators team to pro members' },
  { key: 'founder', name: 'Founding member', emoji: '🏗️', source: 'admin', how: 'For the first hundred climbers' },
  { key: 'community_star', name: 'Community star', emoji: '🌟', source: 'admin', how: 'For lifting other people up' },
  { key: 'collab', name: 'Team player', emoji: '🤝', source: 'admin', how: 'For working with others in a way that moved people' },
  { key: 'week_in', name: 'One week in', emoji: '🌱', source: 'time', days: 7, how: 'Unlocks seven days after you start' },
  { key: 'month_in', name: 'One month in', emoji: '🌿', source: 'time', days: 30, how: 'Unlocks thirty days after you start' },
  { key: 'season_in', name: 'One season in', emoji: '🌳', source: 'time', days: 90, how: 'Unlocks ninety days after you start' },
  { key: 'year_in', name: 'One year in', emoji: '🌲', source: 'time', days: 365, how: 'Unlocks a year after you start' },
];

export const HONOR_BY_KEY: Record<string, Honor> = Object.fromEntries(HONORS.map((h) => [h.key, h]));

export function timeHonors(createdAt: string, now: Date = new Date()): string[] {
  const started = new Date(createdAt).getTime();
  if (Number.isNaN(started)) return [];
  const days = (now.getTime() - started) / 86_400_000;
  return HONORS.filter((h) => h.source === 'time' && h.days !== undefined && days >= h.days).map((h) => h.key);
}

// ---------------------------------------------------------------------------
// Points and rewards — check-ins earn points you can later trade for real
// things. Rewards are reservations until the first drop ships.
// ---------------------------------------------------------------------------

export const POINTS = {
  checkin: 10,
  /** Every Nth day of a streak pays a bonus. */
  streakBonusEvery: 7,
  streakBonus: 50,
} as const;

export interface Reward {
  key: string;
  name: string;
  kind: 'event' | 'merch';
  cost: number;
  blurb: string;
}

export const REWARDS: readonly Reward[] = [
  { key: 'stickers', name: 'Sticker pack', kind: 'merch', cost: 600, blurb: 'All seven characters, die-cut.' },
  { key: 'meetup', name: 'Meetup ticket', kind: 'event', cost: 1500, blurb: 'A seat at the next city meetup.' },
  { key: 'tee', name: 'Kreators tee', kind: 'merch', cost: 2500, blurb: 'The tower, printed big.' },
  { key: 'coaching', name: 'One-to-one call', kind: 'event', cost: 4000, blurb: 'Forty minutes with a mentor from the guru floor.' },
];

export const REWARD_BY_KEY: Record<string, Reward> = Object.fromEntries(REWARDS.map((r) => [r.key, r]));

export type RedemptionStatus = 'reserved' | 'fulfilled' | 'cancelled';

export interface Redemption {
  id: string;
  rewardKey: string;
  points: number;
  status: RedemptionStatus;
  note: string;
  createdAt: string;
}

export interface RewardsResponse {
  points: number;
  rewards: Reward[];
  redemptions: Redemption[];
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export type LeaderboardSort = 'xp' | 'streak' | 'badges';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  level: number;
  streak: number;
  /** Earned badges plus honors. */
  badgeCount: number;
  isPro: boolean;
  stage: number;
  isMe: boolean;
}

export interface LeaderboardResponse {
  by: LeaderboardSort;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  optedIn: boolean;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  displayName: string;
  focus: string;
  xp: number;
  points: number;
  streak: number;
  isPro: boolean;
  createdAt: string;
  honors: string[];
}

export interface AdminRedemption extends Redemption {
  userId: string;
  userName: string;
}

/** When a task can first be ticked. */
export function taskReadyAt(createdAt: string, readyAt: string | null): string {
  if (readyAt) return readyAt;
  return new Date(new Date(createdAt).getTime() + WAIT.taskMinAgeMinutes * 60_000).toISOString();
}
