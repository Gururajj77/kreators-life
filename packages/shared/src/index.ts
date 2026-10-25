// ---------------------------------------------------------------------------
// kreators.app — shared domain model (used by both the web app and the API)
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
    color: '#E11D48',
    soft: '#FFE4E6',
    deep: '#9F1239',
    text: '#FFFFFF',
    greeting: "I'm Ember. I look after the people who count on you.",
    question: 'Who did you serve today?',
  },
  {
    key: 'friendship',
    floor: 2,
    name: 'Friendship',
    character: 'Pip',
    color: '#FB8728',
    soft: '#FFEDD5',
    deep: '#C2410C',
    text: '#FFFFFF',
    greeting: "I'm Pip. Two lobes, one heart. Who's in your corner?",
    question: 'Who did you show up for?',
  },
  {
    key: 'parent_child',
    floor: 3,
    name: 'Parent & child',
    character: 'Sunny',
    color: '#FACC15',
    soft: '#FEF9C3',
    deep: '#A16207',
    text: '#262626',
    greeting: "I'm Sunny. I carry the little one on my shoulder. Family first, everything else second.",
    question: 'Did family hear from you?',
  },
  {
    key: 'lover_partner',
    floor: 4,
    name: 'Lover & partner',
    character: 'Clover',
    color: '#9BB068',
    soft: '#F0F2E8',
    deep: '#5A6B38',
    text: '#FFFFFF',
    greeting: "I'm Clover. Love is a daily habit, not a yearly highlight.",
    question: 'Was there phone-free time?',
  },
  {
    key: 'self',
    floor: 5,
    name: 'With yourself',
    character: 'Dew',
    color: '#926247',
    soft: '#E8DDD9',
    deep: '#4F3422',
    text: '#FFFFFF',
    greeting: "I'm Dew. One drop, very clear. How are you really?",
    question: 'Did you rest, move, breathe?',
  },
  {
    key: 'guru',
    floor: 6,
    name: 'With the guru',
    character: 'Sage',
    color: '#7F45E2',
    soft: '#EDE9FE',
    deep: '#5D2AAD',
    text: '#FFFFFF',
    greeting: "I'm Sage. Everyone you admire had a teacher. Who's yours?",
    question: 'What did you learn on purpose?',
  },
  {
    key: 'divine',
    floor: 7,
    name: 'With the divine',
    character: 'Lumen',
    color: '#5D2AAD',
    soft: '#DDD6FE',
    deep: '#2E1065',
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
  /** One-line explanation shown under the layer title. */
  hint: string;
  /** The plain-words line the pyramid uses to teach this layer. */
  explain: string;
  /** One example, so the layer is never abstract. */
  example: string;
}

export const KIND_META: Record<NodeKind, KindMeta> = {
  pillar: {
    kind: 'pillar',
    rung: 1,
    label: 'Foundation',
    plural: 'Foundations',
    prompt: 'One thing you will not let break',
    hint: 'The base. What must stay standing no matter what.',
    explain: 'The base of the pyramid. One thing you will not let break, ever.',
    example: 'Family gets the first call',
  },
  principle: {
    kind: 'principle',
    rung: 2,
    label: 'Guiding principle',
    plural: 'Guiding principles',
    prompt: 'A line you live by so the foundation holds',
    hint: 'A line you live by so the foundation holds.',
    explain: 'Your guiding principle: a line you live by, so the foundation holds.',
    example: 'Everything else can wait ten minutes',
  },
  value_goal: {
    kind: 'value_goal',
    rung: 3,
    label: 'Value goal',
    plural: 'Value goals',
    prompt: 'How you want to feel more often',
    hint: 'How you want to feel more often. No numbers, just the feeling.',
    explain: 'Your value goal: how you want to feel more often. No numbers, just the feeling.',
    example: 'Close to home',
  },
  outcome: {
    kind: 'outcome',
    rung: 4,
    label: 'Goal outcome',
    plural: 'Goal outcomes',
    prompt: 'What shows it is working',
    hint: 'What you would see when the value goal is real.',
    explain: 'Your goal outcome: what you would see when it is working.',
    example: 'Family knows what my week was like',
  },
  project: {
    kind: 'project',
    rung: 5,
    label: 'Project',
    plural: 'Projects',
    prompt: 'A bunch of tasks with a finish line',
    hint: 'A bunch of tasks with a finish line.',
    explain: 'A bunch of tasks with a finish line.',
    example: 'The ten-minute call',
  },
  task: {
    kind: 'task',
    rung: 6,
    label: 'Task',
    plural: 'Tasks',
    prompt: 'One thing you can tick off today',
    hint: 'Small moves. Tick one and the whole pyramid feels it.',
    explain: 'One small thing you can tick off today. The tip of the pyramid.',
    example: 'Call a parent for ten minutes',
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
  /** A day kept on the not-to-do list. Small on purpose: the streak is the prize. */
  notToDo: 5,
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

/** Every value goal and project a floor's ladders know, so the person can pick one before the floor is built. */
export function ladderOptions(relationship: RelationshipKey): { valueGoals: string[]; projects: string[] } {
  const ts = Object.values(LADDERS[relationship]);
  return { valueGoals: [...new Set(ts.map((t) => t.valueGoal))], projects: [...new Set(ts.map((t) => t.project))] };
}

/** What the person chose on the "derived from your answers" screen, by floor. Free text is allowed. */
export type LadderPicks = Partial<Record<RelationshipKey, { valueGoal?: string; project?: string }>>;

export function deriveAllLadders(answers: Answers): Record<RelationshipKey, DerivedLadder> {
  return Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, deriveLadder(r.key, answers)])) as Record<RelationshipKey, DerivedLadder>;
}

// ---------------------------------------------------------------------------
// Wait times — the game only pays for things that took real time.
// ---------------------------------------------------------------------------

export const WAIT = {
  /** A person's first few task ticks have no wait at all, so the first day feels like something. */
  freeFirstTasks: 3,
  /** After that, a task must sit this long after being written (or renamed) before it can be ticked. */
  taskMinAgeMinutes: 10,
  /** And this long after the previous tick, so ticks are never back to back. */
  gapMinutes: 10,
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
  { key: 'all_seven', name: 'All seven', emoji: '🏰', how: 'Set up every one of the seven pillars' },
  { key: 'ten_tasks', name: 'Ripple maker', emoji: '🌊', how: 'Complete ten tasks' },
  { key: 'project_clear', name: 'Project cleared', emoji: '🏁', how: 'Finish every task in a project' },
  { key: 'level_5', name: 'Level five', emoji: '⭐', how: 'Reach level five' },
  { key: 'spark_5', name: 'Good hands', emoji: '⚡', how: 'Do five small acts' },
  { key: 'club_member', name: 'Club member', emoji: '🪪', how: 'Be accepted into the Club' },
  { key: 'run_1', name: 'First run', emoji: '🏃', how: 'Log a run with a start code' },
  { key: 'run_10', name: 'Ten runs', emoji: '👟', how: 'Log ten runs with your clubs' },
  { key: 'run_100k', name: 'Hundred k', emoji: '🏅', how: 'Run a hundred kilometres with your clubs' },
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
  role: Role;
  email: string | null;
  handle: string | null;
  bio: string;
  reminderTime: string | null;
  referralCode: string | null;
  /** Per-person module toggles. Missing keys use the module default. */
  modules: Record<string, boolean>;
  permissions: Permission[];
  skills: string[];
  categories: string[];
  goals: string[];
  experienceLevel: string;
  availability: string;
  location: string;
  openToIntros: boolean;
  /** What they make and care about, for matching. */
  interests: string[];
  city: string;
  area: string;
  /** True when the person shared their position for nearby matching. The coordinates never leave the server. */
  hasLocation: boolean;
  /** IANA zone the person's availability is written in. */
  timezone: string;
  avatarUrl: string;
  socials: Socials;
  publicSettings: PublicSettings;
  /** The blocks on the public page, in order. */
  links: LinkBlock[];
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
  /** True once the vibe check for this floor has been answered. */
  answered: boolean;
}

// ---------------------------------------------------------------------------
// Internal observability: who is here and which apps they use. Team only; journal and wellbeing never appear.
// ---------------------------------------------------------------------------

export interface ObservedUser {
  id: string;
  name: string;
  handle: string | null;
  role: Role;
  createdAt: string;
  onboarded: boolean;
  /** Keys of the apps this person has on. */
  apps: string[];
}

export interface AppUsage {
  key: string;
  name: string;
  emoji: string;
  group: ModuleGroup;
  /** How many people have it on. */
  on: number;
}

export interface ObservabilityResponse {
  totals: { users: number; onboarded: number; staff: number; admins: number; newThisWeek: number };
  roles: Record<Role, number>;
  apps: AppUsage[];
  users: ObservedUser[];
  /** How many people match the search, before paging. */
  total: number;
  offset: number;
  limit: number;
}

export interface MeResponse {
  user: User;
  relationships: RelationshipState[];
  /** Earned badges, computed from stats. */
  badges: string[];
  /** Awarded honors: given by an admin or unlocked with time. */
  honors: string[];
  identity: Evolution;
  /** Global module settings set by an admin. */
  moduleSettings: Record<string, ModuleSetting>;
  /** Resolved server-side: flag, rollout, overrides, role, then the person's toggle. */
  access: Record<string, ModuleAccess>;
  unread: number;
  organizations: Organization[];
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
  /** Tasks only, optional: a time of day (HH:MM) and how long it should take, to plan the day. */
  dueTime: string | null;
  estimateMin: number | null;
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
  /** Minutes planned for today across timed tasks, minutes already done, and how many tasks carry a time. */
  timePlan: { plannedMin: number; doneMin: number; timed: number };
  /** Things to stay away from, each with its streak. Extra to the three boxes. */
  notToDo: NotToDo[];
}

/** The not-to-do list on Daily: things to stay away from, each with its own streak. */
export const MAX_NOT_TO_DO = 7;
export const NOT_TO_DO_TITLE_MAX = 60;
export type NotToDoStatus = 'kept' | 'slipped';
export interface NotToDo {
  id: string;
  title: string;
  relationship: RelationshipKey | null;
  /** Days in a row kept. Today counts once it is ticked; until then the run ends at yesterday. */
  streak: number;
  bestStreak: number;
  today: NotToDoStatus | null;
  /** The last seven days ending today, oldest first. */
  week: (NotToDoStatus | null)[];
  createdAt: string;
}

/** A YYYY-MM-DD day moved by whole days. */
export function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/**
 * The one streak rule for a not-to-do: count kept days back from today if today is kept,
 * or back from yesterday while today is still open. A slip today, or a day with nothing
 * recorded, ends the run.
 */
export function notToDoStreak(days: Record<string, NotToDoStatus | undefined>, today: string): number {
  if (days[today] === 'slipped') return 0;
  let day = days[today] === 'kept' ? today : shiftDay(today, -1);
  let n = 0;
  while (days[day] === 'kept') {
    n += 1;
    day = shiftDay(day, -1);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Periods and reviews: a week, a month, a quarter or half a year, and what you make of it
// ---------------------------------------------------------------------------

export type PeriodKind = 'week' | 'month' | 'quarter' | 'half';
export const PERIOD_KINDS: readonly PeriodKind[] = ['week', 'month', 'quarter', 'half'];
export const PERIOD_META: Record<PeriodKind, { name: string; short: string; blurb: string; previous: string }> = {
  week: { name: 'Weekly review', short: 'Week', blurb: 'Seven days: what moved, what slipped, one thing for next week.', previous: 'the week before' },
  month: { name: 'Monthly review', short: 'Month', blurb: 'A month: the numbers, the habits that held, what to change.', previous: 'the month before' },
  quarter: { name: 'Quarterly review', short: 'Quarter', blurb: 'Three months: progress on the big things, and the next quarter\'s focus.', previous: 'the quarter before' },
  half: { name: 'Mid-year check-in', short: 'Half year', blurb: 'Six months: where the year is going, and what the second half is for.', previous: 'the half before' },
};
/** A period is inclusive on both ends, in YYYY-MM-DD. Weeks start on Monday. */
export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The period of that kind containing the date. */
export function periodFor(kind: PeriodKind, date: string): Period {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  if (kind === 'week') {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const start = shiftDay(date, -((dow + 6) % 7));
    return { kind, start, end: shiftDay(start, 6) };
  }
  if (kind === 'month') return { kind, start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)) };
  const first = kind === 'quarter' ? Math.floor((m - 1) / 3) * 3 + 1 : m <= 6 ? 1 : 7;
  const last = first + (kind === 'quarter' ? 2 : 5);
  return { kind, start: ymd(y, first, 1), end: ymd(y, last, lastDayOfMonth(y, last)) };
}

/** The same kind of period, `by` steps later (or earlier when negative). */
export function periodShift(p: Period, by: number): Period {
  if (p.kind === 'week') return periodFor('week', shiftDay(p.start, 7 * by));
  const months = p.kind === 'month' ? 1 : p.kind === 'quarter' ? 3 : 6;
  const total = Number(p.start.slice(0, 4)) * 12 + (Number(p.start.slice(5, 7)) - 1) + months * by;
  return periodFor(p.kind, ymd(Math.floor(total / 12), (total % 12) + 1, 1));
}

/** "20 to 26 Oct 2026", "October 2026", "Oct to Dec 2026". */
export function periodLabel(p: Period): string {
  const y = p.start.slice(0, 4);
  const m1 = Number(p.start.slice(5, 7));
  const m2 = Number(p.end.slice(5, 7));
  if (p.kind === 'week') {
    const d1 = Number(p.start.slice(8, 10));
    const d2 = Number(p.end.slice(8, 10));
    return p.start.slice(0, 7) === p.end.slice(0, 7) ? `${d1} to ${d2} ${MONTHS_SHORT[m1 - 1]} ${y}` : `${d1} ${MONTHS_SHORT[m1 - 1]} to ${d2} ${MONTHS_SHORT[m2 - 1]} ${p.end.slice(0, 4)}`;
  }
  if (p.kind === 'month') return `${MONTHS_LONG[m1 - 1]} ${y}`;
  return `${MONTHS_SHORT[m1 - 1]} to ${MONTHS_SHORT[m2 - 1]} ${y}`;
}

/** Every day of the period, oldest first. */
export function periodDays(p: Period): string[] {
  const out: string[] = [];
  for (let d = p.start; d <= p.end; d = shiftDay(d, 1)) out.push(d);
  return out;
}

export const periodKey = (p: Period) => `${p.kind}:${p.start}`;

/** The prompts every review starts from. A person can add templates of their own on top. */
export const REVIEW_PROMPTS: Record<PeriodKind, string[]> = {
  week: ['What went well this week?', 'What got in the way?', 'Which pillar needs you most next week?', 'One thing to do differently next week.'],
  month: ['What are you proud of this month?', 'What did you let slide?', 'Which habits held, and which did not?', 'What will you change next month?'],
  quarter: ['What moved forward in the last three months?', 'What did you learn about how you work?', 'What should stop, and what should start?', 'The one focus for the next quarter.'],
  half: ['Where is the year going so far?', 'Which of the seven pillars grew the most, and which the least?', 'What do you want the second half to be about?', 'What would make December feel like a good year?'],
};
export const MAX_REVIEW_TEMPLATES = 12;
export const MAX_REVIEW_PROMPTS = 10;
export const REVIEW_NAME_MAX = 60;
export const REVIEW_PROMPT_MAX = 200;
export const REVIEW_ANSWER_MAX = 2000;
export const REVIEW_HIGHLIGHT_MAX = 200;

export interface ReviewTemplate {
  id: string;
  kind: PeriodKind;
  name: string;
  prompts: string[];
  /** Comes with the app; cannot be edited or removed. */
  builtIn: boolean;
  createdAt: string | null;
}

export function builtInTemplate(kind: PeriodKind): ReviewTemplate {
  return { id: `builtin:${kind}`, kind, name: PERIOD_META[kind].name, prompts: REVIEW_PROMPTS[kind], builtIn: true, createdAt: null };
}

/** Trimmed, non-empty, bounded prompts. */
export function parseReviewPrompts(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, REVIEW_PROMPT_MAX))
    .filter(Boolean)
    .slice(0, MAX_REVIEW_PROMPTS);
}

/** What happened in one period, pulled from every app. Averages are null when nothing was logged. */
export interface PeriodNumbers {
  days: number;
  checkins: number;
  tasksDone: number;
  smallActs: number;
  xp: number;
  activeDays: number;
  notToDoKept: number;
  notToDoSlipped: number;
  moodAvg: number | null;
  sleepAvg: number | null;
  stressAvg: number | null;
  mindfulMin: number;
  moveMin: number;
  journalEntries: number;
  journalMoodAvg: number | null;
  incomeCents: number;
  expenseCents: number;
  orders: number;
  salesCents: number;
  salesPoints: number;
  lessonsDone: number;
  programsDone: number;
  applications: number;
  decisions: number;
  events: number;
  posts: number;
  circles: number;
  /** Runs logged with a start code, and the metres they added up to. */
  runs: number;
  runMetres: number;
}

export interface ReviewSummary {
  period: Period;
  previous: Period;
  now: PeriodNumbers;
  before: PeriodNumbers;
  /** Xp and ticked tasks per day of the period. */
  series: { date: string; xp: number; tasks: number }[];
  xpByArea: Partial<Record<RelationshipKey, number>>;
  currency: string;
}

export interface Review {
  id: string;
  kind: PeriodKind;
  start: string;
  end: string;
  templateId: string | null;
  templateName: string;
  /** The prompts as they were when the review was written, so a changed template never rewrites history. */
  prompts: string[];
  answers: string[];
  /** One to five. */
  rating: number | null;
  highlight: string;
  /** The numbers as they were when the review was saved. */
  snapshot: ReviewSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListItem {
  id: string;
  kind: PeriodKind;
  start: string;
  end: string;
  rating: number | null;
  highlight: string;
  updatedAt: string;
}

export interface ReviewsResponse {
  period: Period;
  summary: ReviewSummary;
  review: Review | null;
  templates: ReviewTemplate[];
  recent: ReviewListItem[];
}

/** The last seven days ending today, oldest first. */
export function notToDoWeek(days: Record<string, NotToDoStatus | undefined>, today: string): (NotToDoStatus | null)[] {
  return [6, 5, 4, 3, 2, 1, 0].map((back) => days[shiftDay(today, -back)] ?? null);
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "09:30" to "9:30 am". */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h)) return hhmm;
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export interface OnboardingAnswer {
  questionId: string;
  value: number;
}

export interface OnboardingResponse {
  scores: Record<RelationshipKey, number>;
  weakest: RelationshipKey[];
  /** Floors with answers on file. The others were skipped for now and can be answered from the Tower later. */
  answered: RelationshipKey[];
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
  { stage: 3, name: 'Climber', minXp: 900, minDays: 14, blurb: 'Your pyramids are holding weight.' },
  { stage: 4, name: 'Steady hand', minXp: 2000, minDays: 45, blurb: 'All seven pillars lit up.' },
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
  { key: 'pro', name: 'Pro', emoji: '💎', source: 'admin', how: 'Given by the kreators.app team to pro members' },
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
  { key: 'tee', name: 'kreators.app tee', kind: 'merch', cost: 2500, blurb: 'The seven characters, printed big.' },
  { key: 'coaching', name: 'One-to-one call', kind: 'event', cost: 4000, blurb: 'Forty minutes with a mentor.' },
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
  role: Role;
  email: string | null;
  handle: string | null;
  permissions: Permission[];
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

// ---------------------------------------------------------------------------
// Roles and accounts
// ---------------------------------------------------------------------------

export const ROLES = ['user', 'sub_admin', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

/** Each role has a small badge: it sits on the profile picture and under the logo. It is not an earned badge. */
export const ROLE_META: Record<Role, { name: string; blurb: string; emoji: string; accent: RelationshipKey }> = {
  user: { name: 'Creator', blurb: 'Learns, works, connects and sells.', emoji: '✨', accent: 'self' },
  sub_admin: { name: 'Staff', blurb: 'Runs parts of Kreators, as far as their permissions go.', emoji: '🛡️', accent: 'guru' },
  admin: { name: 'Admin', blurb: 'Everything, including roles, permissions and which features exist.', emoji: '🔑', accent: 'divine' },
};

/** Staff permissions. A permission is a job someone is trusted with; admins hold all of them. */
export const PERMISSIONS = ['talent', 'cohorts', 'events', 'finance', 'moderation', 'support', 'review', 'mentor'] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_META: Record<Permission, { name: string; blurb: string }> = {
  talent: { name: 'Talent manager', blurb: 'Runs Army campaigns, shortlists and assigns creators.' },
  cohorts: { name: 'Cohort manager', blurb: 'Publishes programs, runs cohorts, marks completion.' },
  events: { name: 'Event host', blurb: 'Creates any kind of event and checks people in.' },
  finance: { name: 'Finance', blurb: 'Approves bounty payouts and reviews money orders.' },
  moderation: { name: 'Moderator', blurb: 'Hides posts and handles reports.' },
  support: { name: 'Support', blurb: 'Answers help requests.' },
  review: { name: 'Reviewer', blurb: 'Decides Club applications, bounties, TV and Fund proposals.' },
  mentor: { name: 'Mentor', blurb: 'Gives feedback on assignments. Can be held by a creator.' },
};

export function hasPermission(user: { role: Role; permissions: readonly string[] }, perm: Permission): boolean {
  return user.role === 'admin' || user.permissions.includes(perm);
}

/** Staff-level: admin or staff holding the permission. Mentor is the one permission a creator can hold. */
export function isStaffFor(user: { role: Role; permissions: readonly string[] }, perm: Permission): boolean {
  if (user.role === 'admin') return true;
  if (perm === 'mentor') return user.permissions.includes('mentor');
  return user.role === 'sub_admin' && user.permissions.includes(perm);
}

// ---------------------------------------------------------------------------
// Modules — every feature is a module. People switch them on and off under
// You; admins can disable one for everyone or limit it to a role.
// ---------------------------------------------------------------------------

export type ModuleGroup = 'core' | 'wellbeing' | 'earn' | 'community' | 'creator' | 'manage' | 'internal';

export interface AppModule {
  key: string;
  name: string;
  blurb: string;
  emoji: string;
  group: ModuleGroup;
  path: string;
  /** The relationship whose colours this app wears; dark mode tints its pages with that hue. */
  accent?: RelationshipKey;
  /** On for a new account. */
  defaultOn: boolean;
  /** Core modules cannot be switched off by the person. */
  locked?: boolean;
  minRole: Role;
}

export const MODULES: readonly AppModule[] = [
  { key: 'home', name: 'Home', blurb: 'Your numbers, your day, and a door into everything.', emoji: '🏠', group: 'core', path: '/home', defaultOn: true, locked: true, minRole: 'user' },
  { key: 'today', name: 'Daily', blurb: 'Your three boxes a day.', emoji: '☀️', group: 'core', path: '/today', defaultOn: true, locked: true, minRole: 'user' },
  { key: 'tower', name: 'Pillars', blurb: 'The seven pillars of your life, one per relationship.', emoji: '🏰', group: 'core', path: '/tower', defaultOn: true, locked: true, minRole: 'user' },
  { key: 'search', name: 'Search', blurb: 'Find anything you wrote, bought, applied to or read.', emoji: '🔍', group: 'core', path: '/search', defaultOn: true, locked: true, minRole: 'user' },
  { key: 'notifications', name: 'Inbox', blurb: 'What happened while you were away, and daily reminders.', emoji: '🔔', group: 'core', path: '/inbox', defaultOn: true, minRole: 'user' },
  { key: 'help', name: 'Help', blurb: 'Answers to common questions, and a line to the team.', emoji: '🛟', group: 'core', path: '/help', defaultOn: true, minRole: 'user' },

  { key: 'school', name: 'School', blurb: 'Programs and cohorts: lessons, assignments, mentor feedback, completion.', emoji: '🎓', group: 'earn', path: '/school', defaultOn: true, minRole: 'user', accent: 'guru' },
  { key: 'work', name: 'Work', blurb: 'Opportunities from brands and the team. Apply, track, get hired.', emoji: '💼', group: 'earn', path: '/work', defaultOn: true, minRole: 'user', accent: 'servant_leader' },
  { key: 'army', name: 'Army', blurb: 'Brand campaigns: briefs, shortlists, production, approvals, delivery.', emoji: '🎬', group: 'earn', path: '/army', defaultOn: true, minRole: 'user', accent: 'servant_leader' },
  { key: 'win', name: 'Win', blurb: 'Content rewards: make a video about a brand, get paid per verified view.', emoji: '🥇', group: 'earn', path: '/win', defaultOn: false, minRole: 'user', accent: 'parent_child' },

  { key: 'party', name: 'Party', blurb: 'Meetups, workshops, camps and flagship days. RSVP, waitlist, check in.', emoji: '🎉', group: 'community', path: '/party', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'run', name: 'Kreators Run', blurb: 'Run clubs near you. A start code at the line logs your run and pays points. Kilometres, badges, and brand collabs with giveaways.', emoji: '🏃', group: 'community', path: '/run', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'community', name: 'Community', blurb: 'Posts, replies and likes, by category.', emoji: '🫶', group: 'community', path: '/community', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'club', name: 'Club', blurb: 'A curated membership with benefits and exclusive opportunities.', emoji: '🪪', group: 'community', path: '/club', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'bond', name: 'Bond', blurb: 'Friends, introductions, and anonymous chats with people you met.', emoji: '🤝', group: 'community', path: '/bond', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'circles', name: 'Circles', blurb: 'Small anonymous groups near you every week, matched by interests that fit together. The chat opens a day before you meet.', emoji: '🫧', group: 'community', path: '/circles', defaultOn: false, minRole: 'user', accent: 'friendship' },

  { key: 'life', name: 'Life', blurb: 'Physical, financial, emotional, mental and spiritual, on one dashboard that opens into each part of the app.', emoji: '🧭', group: 'wellbeing', path: '/life', defaultOn: true, minRole: 'user', accent: 'lover_partner' },
  { key: 'wellbeing', name: 'Wellbeing', blurb: 'One score from your mood, sleep, stress and mindful minutes.', emoji: '💚', group: 'wellbeing', path: '/wellbeing', defaultOn: false, minRole: 'user', accent: 'lover_partner' },
  { key: 'mood', name: 'Mood', blurb: 'How are you feeling today? Pick a face, see the week.', emoji: '🙂', group: 'wellbeing', path: '/mood', defaultOn: false, minRole: 'user', accent: 'parent_child' },
  { key: 'sleep', name: 'Sleep', blurb: 'Hours and quality, night by night.', emoji: '🌙', group: 'wellbeing', path: '/sleep', defaultOn: false, minRole: 'user', accent: 'guru' },
  { key: 'stress', name: 'Stress', blurb: 'Level and what is behind it.', emoji: '🌊', group: 'wellbeing', path: '/stress', defaultOn: false, minRole: 'user', accent: 'friendship' },
  { key: 'mindful', name: 'Mindful minutes', blurb: 'A breathing timer that logs your minutes.', emoji: '🧘', group: 'wellbeing', path: '/mindful', defaultOn: false, minRole: 'user', accent: 'divine' },
  { key: 'journal', name: 'Journal', blurb: 'Write it down with an emotion and a stress level.', emoji: '📓', group: 'wellbeing', path: '/journal', defaultOn: true, minRole: 'user', accent: 'self' },
  { key: 'reviews', name: 'Reviews', blurb: 'Weekly, monthly, quarterly and mid-year reviews: the numbers from every app, and what you make of them.', emoji: '📝', group: 'wellbeing', path: '/reviews', defaultOn: false, minRole: 'user', accent: 'self' },
  { key: 'companion', name: 'Companion', blurb: 'A chat that knows how you are doing. Not a therapist.', emoji: '💬', group: 'wellbeing', path: '/companion', defaultOn: false, minRole: 'user', accent: 'guru' },

  { key: 'profile', name: 'Public page', blurb: 'What people see: bio, skills, portfolio, links and what you sell.', emoji: '🔗', group: 'creator', path: '/profile', defaultOn: true, minRole: 'user', accent: 'self' },
  { key: 'shop', name: 'Shop', blurb: 'Sell downloads, courses, memberships, sessions and events.', emoji: '🛍️', group: 'creator', path: '/shop', defaultOn: true, minRole: 'user', accent: 'servant_leader' },
  { key: 'store', name: 'Store', blurb: 'Gear and software for creators: new through partner links, pre-owned from other creators with offers and chat, and kits by budget.', emoji: '🛒', group: 'creator', path: '/store', defaultOn: false, minRole: 'user', accent: 'servant_leader' },
  { key: 'audience', name: 'Audience', blurb: 'Followers, leads, broadcasts and your affiliate link.', emoji: '📣', group: 'creator', path: '/shop/audience', defaultOn: false, minRole: 'user', accent: 'servant_leader' },
  { key: 'content', name: 'Content', blurb: 'Which post made money: tracked links, views and revenue per piece of content.', emoji: '📈', group: 'creator', path: '/shop/content', defaultOn: false, minRole: 'user', accent: 'servant_leader' },
  { key: 'automations', name: 'Auto-DM', blurb: 'Comment a keyword, get a link in DMs. Funnels show where people drop off.', emoji: '🤖', group: 'creator', path: '/shop/automations', defaultOn: false, minRole: 'user', accent: 'servant_leader' },
  { key: 'finance', name: 'Finance', blurb: 'Money in, money out, dues, budgets, goals and a monthly picture of your creator business.', emoji: '💰', group: 'creator', path: '/finance', defaultOn: false, minRole: 'user', accent: 'parent_child' },
  { key: 'library', name: 'My purchases', blurb: 'Courses, downloads, memberships, tickets and sessions you own.', emoji: '🎒', group: 'creator', path: '/library', defaultOn: false, minRole: 'user', accent: 'guru' },
  { key: 'knowledge', name: 'Knowledge', blurb: 'Curated articles and exercises with their sources.', emoji: '📚', group: 'creator', path: '/knowledge', defaultOn: false, minRole: 'user', accent: 'guru' },
  { key: 'tools', name: 'Tools', blurb: 'A directory of creator tools, verified by the team.', emoji: '🧰', group: 'creator', path: '/tools', defaultOn: false, minRole: 'user', accent: 'guru' },
  { key: 'tv', name: 'TV', blurb: 'Pitch a series. Track it from proposal to release.', emoji: '📺', group: 'creator', path: '/tv', defaultOn: false, minRole: 'user', accent: 'divine' },
  { key: 'fund', name: 'Fund', blurb: 'Apply for a grant or backing for a project.', emoji: '🌱', group: 'creator', path: '/fund', defaultOn: false, minRole: 'user', accent: 'divine' },

  { key: 'manage', name: 'Manage', blurb: 'Your staff tools, as far as your permissions go.', emoji: '🛡️', group: 'manage', path: '/manage', defaultOn: true, minRole: 'sub_admin' },
  { key: 'admin', name: 'Admin', blurb: 'Roles, permissions, feature flags, audit log, honors, points.', emoji: '🔑', group: 'manage', path: '/admin', defaultOn: true, minRole: 'admin' },
  // internal: tracking for the team. Only staff and admins see this group at all.
  { key: 'observability', name: 'Observability', blurb: 'Who is here, which apps they have on, who holds which role, and the build map.', emoji: '📡', group: 'internal', path: '/internal/observability', defaultOn: true, minRole: 'sub_admin' },
];

export const MODULE_BY_KEY: Record<string, AppModule> = Object.fromEntries(MODULES.map((m) => [m.key, m]));

export const MODULE_GROUPS: Record<ModuleGroup, string> = {
  earn: 'Contribution',
  creator: 'Creation',
  community: 'Connection',
  wellbeing: 'Reflection',
  core: 'Essentials',
  manage: 'Operations',
  internal: 'Internal',
};

/** The relationship whose colour each app group wears on the Apps page and under You, Features. */
export const MODULE_GROUP_ACCENT: Record<ModuleGroup, RelationshipKey> = {
  earn: 'servant_leader',
  creator: 'parent_child',
  community: 'friendship',
  wellbeing: 'lover_partner',
  core: 'self',
  manage: 'guru',
  internal: 'divine',
};

/** One line on what each group is for. */
export const MODULE_GROUP_BLURB: Record<ModuleGroup, string> = {
  earn: 'Learn a craft, do the work, get paid.',
  creator: 'Make things: your page, your shop, your numbers.',
  community: 'Meet people, on your terms.',
  wellbeing: 'How you are doing, day by day.',
  core: 'The basics that are always around.',
  manage: 'Tools for the team.',
  internal: 'Tracking for the team. Only the roles that need it see this.',
};

export interface ModuleSetting {
  key: string;
  enabled: boolean;
  minRole: Role;
  /** Percentage of people the module is rolled out to, 0 to 100. */
  rollout: number;
}

export interface FlagOverride {
  id: string;
  flagKey: string;
  subjectType: 'user' | 'role' | 'organization';
  subjectId: string;
  enabled: boolean;
  expiresAt: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface ModuleAccess {
  available: boolean;
  on: boolean;
  /** Why it is unavailable, for the admin preview and the gate screen. */
  reason: 'ok' | 'disabled' | 'role' | 'rollout' | 'override';
}

/** Deterministic 0 to 99 bucket for rollout percentages. */
export function rolloutBucket(subject: string, key: string): number {
  let h = 2166136261;
  for (const ch of `${subject}:${key}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: string;
  after: string;
  createdAt: string;
}

/** Resolve what a person can see: global switch, role, then their own toggle. */
export function moduleState(m: AppModule, role: Role, globals: Record<string, ModuleSetting | undefined>, mine: Record<string, boolean>): { available: boolean; on: boolean } {
  const g = globals[m.key];
  const minRole = g?.minRole ?? m.minRole;
  const available = (g?.enabled ?? true) && roleRank(role) >= roleRank(minRole);
  const on = available && (m.locked ? true : (mine[m.key] ?? m.defaultOn));
  return { available, on };
}

// ---------------------------------------------------------------------------
// Wellbeing logs
// ---------------------------------------------------------------------------

export type LogKind = 'mood' | 'sleep' | 'stress' | 'mindful' | 'move';

export interface MoodOption {
  value: number;
  name: string;
  emoji: string;
  color: string;
  text: string;
}

/** The kit's five moods and their colors, bottom to top. */
export const MOODS: readonly MoodOption[] = [
  { value: 1, name: 'Low', emoji: '😞', color: '#7F45E2', text: '#FFFFFF' },
  { value: 2, name: 'Sad', emoji: '😔', color: '#FB8728', text: '#FFFFFF' },
  { value: 3, name: 'Neutral', emoji: '😐', color: '#926247', text: '#FFFFFF' },
  { value: 4, name: 'Happy', emoji: '🙂', color: '#FACC15', text: '#262626' },
  { value: 5, name: 'Overjoyed', emoji: '😄', color: '#9BB068', text: '#FFFFFF' },
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
// Journal, community, resources, notifications, companion
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  emotion: number | null;
  stress: number | null;
  stressors: string[];
  createdAt: string;
  updatedAt: string;
}

export const POST_CATEGORIES = ['Self care', 'Mindfulness', 'Stories', 'Support', 'Creative', 'Learning', 'Stress', 'Affirmation', 'Awareness'] as const;

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string | null;
  authorPro: boolean;
  /** Whether the viewer follows the author, and how many people do. */
  authorFollowing: boolean;
  authorFollowers: number;
  category: string;
  body: string;
  /** Members-only posts belong to a membership product. */
  productId: string | null;
  likes: number;
  liked: boolean;
  replies: number;
  hidden: boolean;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export type ResourceKind = 'article' | 'exercise' | 'video';

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  summary: string;
  body: string;
  url: string | null;
  tags: string[];
  published: boolean;
  authorName: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Creator studio — products, orders, bookings, leads
// ---------------------------------------------------------------------------

export interface Socials {
  instagram: string;
  youtube: string;
  x: string;
  website: string;
}
export const EMPTY_SOCIALS: Socials = { instagram: '', youtube: '', x: '', website: '' };

/**
 * What a person shows on their public page. One switch for the whole page, then one per part.
 * Everything here is the person's choice; nothing on the page is shown unless its switch is on.
 */
export interface PublicSettings {
  /** The whole page. Off means only you can open it. */
  pagePublic: boolean;
  showSocials: boolean;
  /** The link blocks: buttons, headers, text, images, videos, carousels. */
  showBlocks: boolean;
  showPortfolio: boolean;
  showProducts: boolean;
  /** Your community posts, on your page. */
  showPosts: boolean;
  /** Level, streak, pillars set up. Never the journal or wellbeing. */
  showActivity: boolean;
  /** The badges you earned and the honors you were awarded. */
  showBadges: boolean;
  allowFriendRequests: boolean;
  /** Friends can open an anonymous chat with you from your page. */
  allowChats: boolean;
}
export const DEFAULT_PUBLIC: PublicSettings = { pagePublic: true, showSocials: true, showBlocks: true, showPortfolio: true, showProducts: true, showPosts: true, showActivity: false, showBadges: true, allowFriendRequests: true, allowChats: true };
export const PUBLIC_SETTING_META: { key: keyof PublicSettings; name: string; blurb: string }[] = [
  { key: 'pagePublic', name: 'My page is public', blurb: 'Off hides the whole page from everyone but you. Every switch below needs this on.' },
  { key: 'showSocials', name: 'Show my social icons', blurb: 'Instagram, YouTube, X and your website.' },
  { key: 'showBlocks', name: 'Show my links', blurb: 'Your link buttons, headers, text, images, videos and carousels.' },
  { key: 'showPortfolio', name: 'Show my portfolio', blurb: 'Your public portfolio items.' },
  { key: 'showProducts', name: 'Show what I sell', blurb: 'Products from your shop.' },
  { key: 'showPosts', name: 'Show my posts', blurb: 'Your posts in the community feed, on your page too.' },
  { key: 'showActivity', name: 'Show my activity', blurb: 'Level, streak and how many pillars are set up. Never your journal or wellbeing.' },
  { key: 'showBadges', name: 'Show my badges', blurb: 'The badges you earned and any honors the team awarded you.' },
  { key: 'allowFriendRequests', name: 'Let people add me as a friend', blurb: 'Off hides the Add friend button.' },
  { key: 'allowChats', name: 'Let friends start a chat', blurb: 'Anonymous, under aliases. Off means nobody can open one with you.' },
];
// ---------------------------------------------------------------------------
// Links on the public page: the Linktree part. Blocks the creator stacks in order, shown to everyone.
// ---------------------------------------------------------------------------

export const LINK_BLOCK_TYPES = ['link', 'header', 'text', 'image', 'video', 'carousel'] as const;
export type LinkBlockType = (typeof LINK_BLOCK_TYPES)[number];

export interface LinkBlockItem {
  id: string;
  title: string;
  url: string;
  image: string;
}

export interface LinkBlock {
  id: string;
  type: LinkBlockType;
  /** The button label, header text, caption or video title. */
  title: string;
  /** Where it goes. A video block takes a YouTube link. */
  url: string;
  /** An https picture, for image blocks. */
  image: string;
  /** The paragraph of a text block. */
  text: string;
  /** A link drawn big and in colour. */
  featured: boolean;
  /** Off hides it from the page without deleting it. */
  on: boolean;
  /** The cards of a carousel. */
  items: LinkBlockItem[];
}

export const MAX_LINK_BLOCKS = 30;
export const MAX_CAROUSEL_ITEMS = 10;

export const LINK_BLOCK_META: Record<LinkBlockType, { name: string; emoji: string; blurb: string }> = {
  link: { name: 'Link', emoji: '🔗', blurb: 'A button that opens any page.' },
  header: { name: 'Header', emoji: '🏷️', blurb: 'A title that groups the links under it.' },
  text: { name: 'Text', emoji: '✍️', blurb: 'A short paragraph in your words.' },
  image: { name: 'Image', emoji: '🖼️', blurb: 'One picture, with a link if you want.' },
  video: { name: 'Video', emoji: '▶️', blurb: 'A YouTube video that plays on your page.' },
  carousel: { name: 'Carousel', emoji: '🎠', blurb: 'Cards people swipe through, each with a link.' },
};

const httpsUrl = (v: unknown): string => (typeof v === 'string' && /^https:\/\/\S{1,500}$/.test(v.trim()) ? v.trim() : '');
const shortText = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Keeps only what a block may hold: https links, short text, a bounded carousel. Empty or unknown blocks are dropped. */
export function parseLinkBlocks(raw: unknown): LinkBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: LinkBlock[] = [];
  for (const b of raw.slice(0, MAX_LINK_BLOCKS)) {
    if (!b || typeof b !== 'object') continue;
    const r = b as Record<string, unknown>;
    if (!(LINK_BLOCK_TYPES as readonly string[]).includes(String(r.type))) continue;
    const type = r.type as LinkBlockType;
    const items: LinkBlockItem[] = Array.isArray(r.items)
      ? r.items
          .slice(0, MAX_CAROUSEL_ITEMS)
          .map((it, i) => {
            const x = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
            return { id: shortText(x.id, 40) || `c${i + 1}`, title: shortText(x.title, 80), url: httpsUrl(x.url), image: httpsUrl(x.image) };
          })
          .filter((it) => it.title || it.image)
      : [];
    const block: LinkBlock = { id: shortText(r.id, 40), type, title: shortText(r.title, 120), url: httpsUrl(r.url), image: httpsUrl(r.image), text: shortText(r.text, 600), featured: r.featured === true, on: r.on !== false, items: type === 'carousel' ? items : [] };
    if (type === 'link' && !block.url) continue;
    if (type === 'header' && !block.title) continue;
    if (type === 'text' && !block.text) continue;
    if (type === 'image' && !block.image) continue;
    if (type === 'video' && !block.url) continue;
    if (type === 'carousel' && block.items.length === 0) continue;
    out.push(block);
  }
  return out;
}

/** The id inside a YouTube link, or null for anything else. */
export function youtubeId(url: string): string | null {
  const m = url.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? (m[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Passwords: the same rule on the sign-up form and on the server.
// ---------------------------------------------------------------------------

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** The passwords that get tried first. One of these is not a password. */
export const COMMON_PASSWORDS = ['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop', 'iloveyou', 'letmein1', 'welcome1', 'admin123', 'abc12345', '11111111', '00000000', 'sunshine', 'princess', 'football', 'baseball', 'kreators', 'kreators1', 'kreatorslife'] as const;

/** Why a password will not do, in plain words, or null when it is fine. */
export function passwordProblem(password: string, email = ''): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Keep it under ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if ((COMMON_PASSWORDS as readonly string[]).includes(lower)) return 'That one is on every guess list. Pick another.';
  if (/^(.)\1+$/.test(password)) return 'Not one character over and over.';
  const local = (email.toLowerCase().split('@')[0] ?? '').trim();
  if (local.length >= 4 && lower.includes(local)) return 'Not your email, or a part of it.';
  return null;
}

export function parsePublicSettings(raw: unknown): PublicSettings {
  const out = { ...DEFAULT_PUBLIC };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(DEFAULT_PUBLIC) as (keyof PublicSettings)[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out[k] = v;
    }
  }
  return out;
}

/** A post as it appears on a person's page. */
export interface PublicPost {
  id: string;
  category: string;
  body: string;
  likes: number;
  replies: number;
  createdAt: string;
}

export interface PublicActivity {
  level: number;
  streak: number;
  areasSetUp: number;
  memberSince: string;
}

/** Zones people in the first markets live in, plus the big ones elsewhere. Any IANA name is accepted. */
export const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Manila', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Kathmandu', 'Asia/Colombo',
  'Australia/Sydney', 'Pacific/Auckland', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Istanbul', 'Africa/Nairobi', 'Africa/Lagos', 'Africa/Johannesburg',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Sao_Paulo', 'America/Mexico_City', 'UTC',
] as const;

export const PRODUCT_KINDS = ['digital', 'course', 'membership', 'session', 'event', 'link', 'payment', 'bundle', 'locked', 'dm'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_META: Record<ProductKind, { name: string; emoji: string; blurb: string; buy: string }> = {
  digital: { name: 'Download', emoji: '📄', blurb: 'A file or link delivered after purchase.', buy: 'Get it' },
  course: { name: 'Course', emoji: '🎓', blurb: 'Lessons, released on a schedule if you like.', buy: 'Enrol' },
  membership: { name: 'Membership', emoji: '🪪', blurb: 'Access to members-only community posts.', buy: 'Join' },
  session: { name: 'Session', emoji: '📅', blurb: 'One-to-one time, booked from your availability.', buy: 'Book' },
  event: { name: 'Event', emoji: '🎟️', blurb: 'A live session on a date, with a joining link.', buy: 'Get a ticket' },
  link: { name: 'Link', emoji: '🔗', blurb: 'A free link on your page.', buy: 'Open' },
  payment: { name: 'Payment link', emoji: '💳', blurb: 'A fixed price, or pay what you want. Nothing to deliver.', buy: 'Pay' },
  bundle: { name: 'Bundle', emoji: '🎁', blurb: 'Several of your products for one price.', buy: 'Get the bundle' },
  locked: { name: 'Locked post', emoji: '🔒', blurb: 'One paid post: text, links or a video, shown after purchase.', buy: 'Unlock' },
  dm: { name: 'Priority DM', emoji: '✉️', blurb: 'A paid question you promise to answer within a few days.', buy: 'Ask' },
};

export interface QuizQuestion {
  q: string;
  options: string[];
  /** Index into options. */
  answer: number;
}

export const AFFILIATE_SHARE = 0.2;

export interface Product {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerHandle: string | null;
  kind: ProductKind;
  title: string;
  description: string;
  pricePoints: number;
  priceCents: number;
  currency: string;
  url: string | null;
  startsAt: string | null;
  durationMin: number | null;
  capacity: number | null;
  meetingUrl: string | null;
  status: 'draft' | 'live' | 'archived';
  cover: string;
  sortOrder: number;
  createdAt: string;
  sold: number;
  rating: number | null;
  /** Pay what you want: the price is the floor. */
  pwyw: boolean;
  /** Questions a buyer answers when booking a session or at checkout. */
  intake: string[];
  /** Events: a recording buyers can watch afterwards, and a price for people who missed it. */
  replayUrl: string | null;
  replayPoints: number;
  /** Bundles: the products inside. */
  bundleIds: string[];
  /** Locked posts: only sent to people who have it. */
  lockedBody: string;
  /** Priority DM: answer within this many days. */
  responseDays: number | null;
  /** A free download that captures a lead. */
  leadMagnet: boolean;
  /** Courses: issue a certificate on completion. */
  certificate: boolean;
  /** Sessions: minutes kept free before and after, hours of notice needed, how far ahead people can book. */
  bufferMin: number;
  noticeHours: number;
  maxDaysAhead: number;
  /** Memberships: how many months one purchase lasts. Null means it never ends. */
  periodMonths: number | null;
  /** Who can buy: a points balance to reach, a badge to hold, or both. Zero and empty mean anyone. */
  minPoints: number;
  badge: string;
}

export interface Lesson {
  id: string;
  productId: string;
  title: string;
  body: string;
  videoUrl: string | null;
  sortOrder: number;
  dripDays: number;
  quiz: QuizQuestion[];
  /** Percent needed to pass the quiz. 0 means no quiz gate. */
  passScore: number;
  /** Buyer-side: whether the drip has released it and whether it is done. */
  unlocked?: boolean;
  unlocksOn?: string | null;
  completedAt?: string | null;
  quizScore?: number | null;
  quizPassed?: boolean;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  productId: string;
  productTitle: string;
  productKind: ProductKind;
  points: number;
  cents: number;
  currency: string;
  /** paid: settled in points or by the provider. test: recorded, nothing charged. pending: waiting for the provider. */
  status: 'paid' | 'test' | 'refunded' | 'pending' | 'failed' | 'expired';
  couponCode: string | null;
  affiliateCode: string | null;
  /** points, test or razorpay. */
  provider: string;
  providerOrderId: string | null;
  paidAt: string | null;
  /** Memberships: when this purchase stops counting. */
  expiresAt: string | null;
  /** Attribution: the tracked link this sale came through, if any. */
  sourceLinkId: string | null;
  sourceLabel: string | null;
  clickId: string | null;
  platformFeePoints: number;
  intake: string[];
  /** '' for the product itself, 'replay' for an event recording. */
  variant: string;
  refundedAt: string | null;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  percentOff: number;
  productId: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
}

export interface Availability {
  id: string;
  weekday: number;
  startMin: number;
  endMin: number;
}

export interface Booking {
  id: string;
  productId: string;
  productTitle: string;
  ownerId: string;
  ownerName: string;
  buyerId: string;
  buyerName: string;
  startsAt: string;
  endsAt: string;
  status: 'requested' | 'confirmed' | 'cancelled' | 'done';
  meetingUrl: string | null;
  note: string;
  createdAt: string;
  intake: string[];
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  message: string;
  source: string;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  productId: string;
  productTitle: string;
  authorName: string;
  rating: number;
  body: string;
  approved: boolean;
  createdAt: string;
}

export interface PublicPage {
  id: string;
  handle: string;
  name: string;
  /** Where the viewer stands with this person. */
  friend: 'none' | 'friends' | 'pending' | 'sent';
  friendRequestId: string | null;
  /** True when this is the owner looking at their own page. */
  mine: boolean;
  /** The owner switched the whole page off; only the name comes back. */
  isPrivate: boolean;
  /** What the owner chose to show. Parts that are off come back empty. */
  shows: { socials: boolean; blocks: boolean; portfolio: boolean; products: boolean; posts: boolean; activity: boolean; badges: boolean };
  allowFriendRequests: boolean;
  allowChats: boolean;
  posts: PublicPost[];
  activity: PublicActivity | null;
  /** Earned badge keys and awarded honor keys, only when the badges switch is on. */
  badges: string[];
  honors: string[];
  /** The link blocks that are on, in order, when the links switch is on. */
  links: LinkBlock[];
  bio: string;
  skills: string[];
  categories: string[];
  experienceLevel: string;
  availability: string;
  location: string;
  portfolio: PortfolioItem[];
  isPro: boolean;
  followers: number;
  /** How much this person has proved, from what they earned. */
  trust: TrustScore;
  following: boolean;
  products: Product[];
  testimonials: Testimonial[];
  avatarUrl: string;
  socials: Socials;
  timezone: string;
}

export interface StudioAnalytics {
  views: number;
  clicks: number;
  followers: number;
  leads: number;
  orders: number;
  pointsEarned: number;
  centsEarned: number;
  affiliatePoints: number;
  byProduct: { productId: string; title: string; orders: number; points: number }[];
  /** Sales that came through a tracked link, versus straight from the page. */
  attributed: number;
  direct: number;
  /** Orders per day for the last fourteen days, oldest first. */
  days: { date: string; orders: number }[];
}

// ---------------------------------------------------------------------------
// Growth: tracked links, content attribution, Auto-DM, funnels, sequences
// ---------------------------------------------------------------------------

export const LINK_SOURCES = ['content', 'automation', 'bio', 'youtube', 'newsletter', 'other'] as const;
export type LinkSource = (typeof LINK_SOURCES)[number];

export interface TrackedLink {
  id: string;
  code: string;
  /** Null means the link opens your page. */
  productId: string | null;
  productTitle: string | null;
  sourceType: LinkSource;
  contentItemId: string | null;
  automationId: string | null;
  label: string;
  clicks: number;
  checkouts: number;
  sales: number;
  revenuePoints: number;
  createdAt: string;
}

export const CONTENT_KINDS = ['reel', 'post', 'carousel', 'story', 'video', 'short', 'other'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

/** A post, Reel or video you made, with its numbers and what it sold. */
export interface ContentItem {
  id: string;
  platform: SocialPlatform;
  kind: ContentKind;
  url: string;
  caption: string;
  postedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  syncedAt: string | null;
  links: number;
  clicks: number;
  sales: number;
  revenuePoints: number;
  /** Revenue per thousand views, when views are known. */
  rpm: number | null;
  createdAt: string;
}

export interface DmAutomation {
  id: string;
  contentItemId: string | null;
  contentCaption: string | null;
  keywords: string[];
  dmMessage: string;
  publicReplies: string[];
  linkId: string;
  linkCode: string;
  productTitle: string | null;
  active: boolean;
  matched: number;
  sent: number;
  queued: number;
  failed: number;
  clicks: number;
  sales: number;
  revenuePoints: number;
  createdAt: string;
}

export interface DmSend {
  id: string;
  automationId: string;
  recipientHandle: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error: string;
  createdAt: string;
}

export type FunnelStepKind = 'content' | 'automation' | 'link' | 'lead' | 'product' | 'broadcast';
export interface FunnelStep {
  kind: FunnelStepKind;
  ref: string;
  label: string;
  /** Filled by the server: people at this step. */
  count?: number;
}
export interface Funnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  createdAt: string;
}

/** A message sent to buyers some days after a purchase. */
export interface Sequence {
  id: string;
  productId: string | null;
  productTitle: string | null;
  delayDays: number;
  title: string;
  body: string;
  active: boolean;
  sent: number;
  createdAt: string;
}

export interface DmRequest {
  id: string;
  productId: string;
  productTitle: string;
  ownerName: string;
  buyerName: string;
  question: string;
  answer: string;
  status: 'open' | 'answered' | 'refunded';
  dueAt: string;
  answeredAt: string | null;
  createdAt: string;
}

export interface Certificate {
  code: string;
  productTitle: string;
  learnerName: string;
  ownerName: string;
  issuedAt: string;
}

export interface Customer {
  userId: string;
  name: string;
  handle: string | null;
  email: string | null;
  orders: number;
  points: number;
  cents: number;
  firstAt: string;
  lastAt: string;
  /** Where their first purchase came from. */
  source: string;
}

export interface PayoutSummary {
  feeBps: number;
  grossPoints: number;
  feePoints: number;
  affiliatePoints: number;
  netPoints: number;
  refundedPoints: number;
  testCents: number;
  rows: { orderId: string; productTitle: string; buyerName: string; points: number; fee: number; affiliate: number; net: number; status: Order['status']; createdAt: string }[];
}

// ---------------------------------------------------------------------------
// Finance: a creator's money, kept simple
// ---------------------------------------------------------------------------

export const INCOME_CATEGORIES = ['Brand deal', 'Content reward', 'Courses', 'Products', 'Sessions', 'Affiliate', 'Ad revenue', 'Other income'] as const;
export const EXPENSE_CATEGORIES = ['Equipment', 'Software', 'Travel', 'Team', 'Marketing', 'Fees', 'Taxes', 'Other expense'] as const;

/** A share of one transaction that belongs to someone else, for example an editor's cut of a brand deal. */
export interface FinanceSplit {
  name: string;
  cents: number;
  status: 'due' | 'paid';
}

export interface FinanceTransaction {
  id: string;
  kind: 'income' | 'expense';
  amountCents: number;
  currency: string;
  category: string;
  /** Who it came from or went to. */
  counterparty: string;
  note: string;
  /** YYYY-MM-DD */
  date: string;
  /** manual: typed in. invoice: an invoice marked paid. due: a due settled. recurring: posted on schedule. */
  source: 'manual' | 'invoice' | 'due' | 'recurring';
  ref: string | null;
  splits: FinanceSplit[];
  createdAt: string;
}

/** Money someone owes you, or you owe someone. Settling it books the transaction. */
export interface FinanceDue {
  id: string;
  direction: 'owe' | 'owed';
  counterparty: string;
  amountCents: number;
  currency: string;
  category: string;
  note: string;
  dueDate: string | null;
  recurring: 'none' | 'monthly';
  status: 'open' | 'settled';
  settledAt: string | null;
  createdAt: string;
}

/** Posted automatically every month on a day you pick. */
export interface FinanceRecurring {
  id: string;
  kind: 'income' | 'expense';
  amountCents: number;
  currency: string;
  category: string;
  counterparty: string;
  note: string;
  dayOfMonth: number;
  nextDate: string;
  active: boolean;
  createdAt: string;
}

/** save: you put money aside toward it. earn: income since the start counts toward it. */
export interface FinanceGoal {
  id: string;
  title: string;
  kind: 'save' | 'earn';
  targetCents: number;
  progressCents: number;
  startDate: string;
  deadline: string | null;
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitCents: number;
}

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'] as const;

export interface Invoice {
  id: string;
  number: string;
  ownerName: string;
  ownerHandle: string | null;
  clientName: string;
  clientEmail: string;
  items: InvoiceItem[];
  totalCents: number;
  currency: string;
  status: (typeof INVOICE_STATUSES)[number];
  issueDate: string;
  dueDate: string | null;
  note: string;
  /** The public link is /i/<token>. */
  token: string;
  paidAt: string | null;
  createdAt: string;
}

export interface FinanceBudget {
  category: string;
  monthlyCents: number;
  spentCents: number;
}

export interface FinanceSummary {
  /** YYYY-MM */
  month: string;
  currency: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** Points earned on the platform this month: sales, affiliate shares, content rewards. */
  platformPoints: number;
  byCategory: { category: string; kind: 'income' | 'expense'; cents: number }[];
  /** The last six months, oldest first. */
  months: { month: string; incomeCents: number; expenseCents: number }[];
  budgets: FinanceBudget[];
  openInvoicesCents: number;
  overdueInvoices: number;
  transactions: FinanceTransaction[];
  invoices: Invoice[];
  /** Since the beginning. */
  totals: { incomeCents: number; expenseCents: number; netCents: number; platformPoints: number };
  dues: FinanceDue[];
  owedToMeCents: number;
  iOweCents: number;
  recurring: FinanceRecurring[];
  goals: FinanceGoal[];
}

/** Whole currency units with two decimals, e.g. 1234.50. */
export function money(cents: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  const abs = Math.abs(cents) / 100;
  return `${cents < 0 ? '-' : ''}${symbol}${abs.toLocaleString(undefined, { minimumFractionDigits: abs % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Circles: anonymous small groups near you, matched by interests that fit
// ---------------------------------------------------------------------------

/**
 * Interests, grouped the way a dating app groups them, so everyone finds themselves here, not only people
 * who make content. Up to ten can be on at once. Circles seat people whose interests fit: the same ones, or pairs that gel.
 */
export const INTEREST_GROUPS = [
  { key: 'creative', name: 'Creative', emoji: '🎨', options: ['Photography', 'Video', 'Writing', 'Art & design', 'Music making', 'Dance', 'Comedy', 'Film making', 'Podcasting', 'Fashion'] },
  { key: 'sport', name: 'Sport & fitness', emoji: '🏃', options: ['Gym', 'Running', 'Yoga', 'Football', 'Cricket', 'Basketball', 'Badminton', 'Cycling', 'Swimming', 'Hiking'] },
  { key: 'food', name: 'Food & drink', emoji: '🍜', options: ['Cooking', 'Baking', 'Coffee', 'Tea', 'Street food', 'Trying new places'] },
  { key: 'music', name: 'Music & nights out', emoji: '🎧', options: ['Live music', 'Hip hop', 'Indie', 'Pop', 'Bollywood', 'Karaoke', 'Open mics', 'Festivals'] },
  { key: 'screens', name: 'Screens & pages', emoji: '🎮', options: ['Gaming', 'Anime', 'Movies', 'Series', 'Books', 'Comics', 'Board games'] },
  { key: 'outdoors', name: 'Travel & outdoors', emoji: '🏕️', options: ['Travel', 'Road trips', 'Beaches', 'Camping', 'Nature', 'Stargazing'] },
  { key: 'learning', name: 'Learning & tech', emoji: '💡', options: ['Tech', 'Coding', 'Science', 'Finance', 'Business', 'Languages', 'History'] },
  { key: 'wellness', name: 'Wellness & mind', emoji: '🌿', options: ['Meditation', 'Journaling', 'Spirituality', 'Sleep', 'Mental health', 'Skincare'] },
  { key: 'causes', name: 'Causes & community', emoji: '🤝', options: ['Volunteering', 'Climate', 'Animals', 'Education', 'Social causes', 'Mentoring'] },
  { key: 'home', name: 'Home & life', emoji: '🏠', options: ['Plants', 'Pets', 'Parenting', 'DIY', 'Thrifting', 'Cars & bikes'] },
] as const;
export type InterestGroup = (typeof INTEREST_GROUPS)[number];
export type Interest = InterestGroup['options'][number];
/** Every interest, flat, for validation and matching. */
export const INTERESTS: readonly Interest[] = INTEREST_GROUPS.flatMap((g) => g.options);
/** How many interests one person can have on at once. */
export const MAX_INTERESTS = 10;

/** Pairs that gel: one side needs what the other makes. */
export const COMPLEMENTS: readonly [Interest, Interest][] = [
  ['Photography', 'Fashion'], ['Photography', 'Travel'], ['Writing', 'Video'], ['Writing', 'Books'], ['Writing', 'Podcasting'], ['Video', 'Film making'], ['Music making', 'Dance'], ['Music making', 'Film making'],
  ['Comedy', 'Open mics'], ['Art & design', 'Business'], ['Cooking', 'Trying new places'], ['Baking', 'Coffee'], ['Street food', 'Travel'], ['Road trips', 'Camping'], ['Hiking', 'Nature'], ['Camping', 'Stargazing'],
  ['Gym', 'Running'], ['Yoga', 'Meditation'], ['Cycling', 'Hiking'], ['Tech', 'Coding'], ['Coding', 'Gaming'], ['Business', 'Finance'], ['Science', 'Books'], ['Languages', 'Travel'], ['Live music', 'Festivals'],
  ['Movies', 'Series'], ['Gaming', 'Anime'], ['Board games', 'Comics'], ['Volunteering', 'Mentoring'], ['Education', 'Mentoring'], ['Climate', 'Nature'], ['Animals', 'Pets'], ['Plants', 'Nature'], ['Journaling', 'Mental health'],
  ['Fashion', 'Thrifting'], ['Skincare', 'Fashion'], ['Parenting', 'Education'], ['Spirituality', 'Meditation'], ['DIY', 'Cars & bikes'], ['Hip hop', 'Dance'], ['Bollywood', 'Dance'], ['Karaoke', 'Pop'],
];

/** How well two people's interests fit: a little overlap is good, complementary pairs are better, nothing in common is not. */
export function matchScore(a: readonly string[], b: readonly string[]): number {
  const shared = a.filter((x) => b.includes(x)).length;
  let complementary = 0;
  for (const [x, y] of COMPLEMENTS) if ((a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))) complementary += 1;
  if (shared === 0 && complementary === 0) return -1;
  return Math.min(3, shared) + Math.min(6, complementary * 2);
}

export interface MatchCandidate {
  id: string;
  interests: string[];
  area: string;
  lat: number | null;
  lng: number | null;
  joinedAt: string;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Fit between one candidate and a whole group: interest score plus nearness. People more than twenty km apart never share a table. */
function groupFit(c: MatchCandidate, group: MatchCandidate[]): number {
  let total = 0;
  for (const g of group) {
    if (c.lat !== null && c.lng !== null && g.lat !== null && g.lng !== null && distanceKm({ lat: c.lat, lng: c.lng }, { lat: g.lat, lng: g.lng }) > 20) return -100;
    total += matchScore(c.interests, g.interests) + (c.area && c.area === g.area ? 1 : 0);
  }
  return total;
}

/**
 * Greedy tables: the earliest signup seeds a group, then the best-fitting person joins until the table is full.
 * Groups smaller than three are not groups; their people are reported as unmatched.
 */
export function matchCircles(candidates: MatchCandidate[], groupSize: number): { groups: string[][]; unmatched: string[] } {
  const size = Math.max(3, Math.min(8, groupSize));
  const pool = [...candidates].sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1));
  const groups: MatchCandidate[][] = [];
  const unmatched: string[] = [];
  while (pool.length > 0) {
    const seed = pool.shift();
    if (!seed) break;
    const group = [seed];
    while (group.length < size && pool.length > 0) {
      let bestIndex = -1;
      let best = -Infinity;
      pool.forEach((c, i) => {
        const fit = groupFit(c, group);
        if (fit > best) {
          best = fit;
          bestIndex = i;
        }
      });
      if (bestIndex < 0 || best <= -50) break;
      group.push(pool.splice(bestIndex, 1)[0] as MatchCandidate);
    }
    if (group.length >= 3) groups.push(group);
    else {
      // Try to seat the leftovers at a table with one spare chair.
      for (const c of group) {
        const home = groups.find((g) => g.length < size + 1 && groupFit(c, g) > -50);
        if (home) home.push(c);
        else unmatched.push(c.id);
      }
    }
  }
  return { groups: groups.map((g) => g.map((c) => c.id)), unmatched };
}

export const ALIAS_WORDS = ['Quiet', 'Bright', 'Curious', 'Steady', 'Wild', 'Gentle', 'Bold', 'Warm', 'Swift', 'Calm', 'Keen', 'Merry'] as const;

/** How someone will show up, so the table knows what colour to look for. Red for single, white for committed. */
export const CIRCLE_STATUSES = ['single', 'committed', 'private'] as const;
export type CircleStatus = (typeof CIRCLE_STATUSES)[number];
export const CIRCLE_STATUS_META: Record<CircleStatus, { name: string; wear: string; blurb: string }> = {
  single: { name: 'Single', wear: 'something red', blurb: 'Red on the table means open to meeting someone.' },
  committed: { name: 'Committed', wear: 'something white', blurb: 'White means here for friends and work.' },
  private: { name: 'Rather not say', wear: 'whatever you like', blurb: 'No colour, no questions.' },
};
export function isCircleStatus(v: unknown): v is CircleStatus {
  return typeof v === 'string' && (CIRCLE_STATUSES as readonly string[]).includes(v);
}
/** One line on what to wear, for the person's own pick. */
export function dressCodeFor(status: CircleStatus | null): string {
  if (!status) return 'Wear red if you are single, white if you are committed, or anything if you would rather not say.';
  const m = CIRCLE_STATUS_META[status];
  return status === 'private' ? `You chose not to say, so wear ${m.wear}. Red on others means single, white means committed.` : `You said ${m.name.toLowerCase()}, so wear ${m.wear}. ${status === 'single' ? 'White on others means committed.' : 'Red on others means single.'}`;
}

/** The same weekday and time, one week on. */
export function nextWeek(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 86_400_000).toISOString();
}

export interface CircleEvent {
  id: string;
  title: string;
  city: string;
  area: string;
  startsAt: string;
  venueHint: string;
  groupSize: number;
  status: 'open' | 'matched' | 'done' | 'cancelled';
  /** Weekly circles open the next occurrence on their own once this one's tables are set. */
  repeat: 'none' | 'weekly';
  seriesId: string | null;
  signups: number;
  joined: boolean;
  /** The person's own pick when they joined. Never anyone else's. */
  myStatus: CircleStatus | null;
  myGroupId: string | null;
  createdAt: string;
}

export interface CircleMember {
  alias: string;
  character: RelationshipKey;
  interests: string[];
  revealed: boolean;
  /** Only present once the person chose to reveal. */
  name: string | null;
  handle: string | null;
  userId: string | null;
  isMe: boolean;
}

export interface CircleMessage {
  id: string;
  alias: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface CircleGroup {
  id: string;
  eventId: string;
  eventTitle: string;
  city: string;
  area: string;
  startsAt: string;
  name: string;
  venue: string;
  plan: string;
  chatOpensAt: string;
  chatOpen: boolean;
  chatClosesAt: string;
  members: CircleMember[];
  messages: CircleMessage[];
  myAlias: string;
  myStatus: CircleStatus | null;
  repeat: 'none' | 'weekly';
}

// ---------------------------------------------------------------------------
// Life: five areas, one dashboard
// ---------------------------------------------------------------------------

export type LifeAreaKey = 'physical' | 'financial' | 'emotional' | 'mental' | 'spiritual';

export const LIFE_AREAS: Record<LifeAreaKey, { name: string; emoji: string; blurb: string; path: string; relationship: RelationshipKey }> = {
  physical: { name: 'Physical', emoji: '🏃', blurb: 'Sleep, movement and breath.', path: '/wellbeing', relationship: 'self' },
  financial: { name: 'Financial', emoji: '💰', blurb: 'What comes in, what goes out, where you are heading.', path: '/finance', relationship: 'servant_leader' },
  emotional: { name: 'Emotional', emoji: '💛', blurb: 'Mood, what you wrote, and the people pillars.', path: '/mood', relationship: 'lover_partner' },
  mental: { name: 'Mental', emoji: '🧠', blurb: 'Stress, focus, and what you are learning.', path: '/stress', relationship: 'guru' },
  spiritual: { name: 'Spiritual', emoji: '✨', blurb: 'Stillness, awe, and the top two pillars.', path: '/mindful', relationship: 'divine' },
};

export interface LifePart {
  label: string;
  /** What to show, e.g. "7.2 h" or "3 of 5 days". */
  value: string;
  /** Null when there is nothing logged yet. */
  score: number | null;
  path: string;
  hint: string;
}

export interface LifeArea {
  key: LifeAreaKey;
  score: number;
  /** Change against the week before, in points. */
  trend: number;
  parts: LifePart[];
}

export interface LifeSummary {
  date: string;
  overall: number;
  label: string;
  areas: LifeArea[];
}

// ---------------------------------------------------------------------------
// Bookings: availability maths in the creator's own zone
// ---------------------------------------------------------------------------

export interface AvailabilityOverride {
  id: string;
  /** YYYY-MM-DD in the creator's zone. */
  date: string;
  /** Empty means the whole day is blocked. */
  ranges: { startMin: number; endMin: number }[];
}

/** Minutes the zone is ahead of UTC at a given instant, via the platform's own tables. */
export function zoneOffsetMinutes(zone: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((asUtc - at.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

/** The instant that a local date and minute-of-day in a zone refers to. */
export function zonedToUtc(date: string, minutes: number, zone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, Math.floor(minutes / 60), minutes % 60));
  const offset = zoneOffsetMinutes(zone, guess);
  const fixed = new Date(guess.getTime() - offset * 60_000);
  // A second pass catches the rare case where the offset changes between guess and answer.
  const offset2 = zoneOffsetMinutes(zone, fixed);
  return offset2 === offset ? fixed : new Date(guess.getTime() - offset2 * 60_000);
}

export interface SlotInput {
  /** YYYY-MM-DD in the creator's zone. */
  date: string;
  zone: string;
  rules: { weekday: number; startMin: number; endMin: number }[];
  overrides: AvailabilityOverride[];
  /** Taken intervals as ISO strings. */
  busy: { startsAt: string; endsAt: string }[];
  durationMin: number;
  bufferMin: number;
  noticeHours: number;
  maxDaysAhead: number;
  now: Date;
}

/** Free slot starts, as ISO strings, for one day. Pure, so it is tested without a server. */
export function slotsFor(input: SlotInput): string[] {
  const { date, zone, durationMin, bufferMin } = input;
  const step = Math.max(5, durationMin);
  const dayStart = zonedToUtc(date, 0, zone);
  const weekday = new Date(dayStart.getTime() + 12 * 3600_000).getUTCDay();
  const localWeekday = (() => {
    try {
      const w = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(new Date(dayStart.getTime() + 12 * 3600_000));
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
    } catch {
      return weekday;
    }
  })();
  const override = input.overrides.find((o) => o.date === date);
  const ranges = override ? override.ranges : input.rules.filter((r) => r.weekday === localWeekday).map((r) => ({ startMin: r.startMin, endMin: r.endMin }));
  const earliest = input.now.getTime() + input.noticeHours * 3600_000;
  const latest = input.now.getTime() + input.maxDaysAhead * 86_400_000;
  const busy = input.busy.map((b) => ({ s: new Date(b.startsAt).getTime() - bufferMin * 60_000, e: new Date(b.endsAt).getTime() + bufferMin * 60_000 }));
  const out: string[] = [];
  for (const r of ranges) {
    for (let m = r.startMin; m + durationMin <= r.endMin; m += step) {
      const start = zonedToUtc(date, m, zone).getTime();
      const end = start + durationMin * 60_000;
      if (start < earliest || start > latest) continue;
      if (busy.some((b) => start < b.e && end > b.s)) continue;
      out.push(new Date(start).toISOString());
    }
  }
  return out;
}

/** A fee in basis points with integer maths. */
export function feeBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10_000);
}

// ---------------------------------------------------------------------------
// Payments, KYC, email, events: the operator's side
// ---------------------------------------------------------------------------

export interface PaymentsConfig {
  /** test: orders are recorded and nothing is charged. razorpay: the provider is live. */
  mode: 'test' | 'razorpay';
  keyId: string | null;
  currency: string;
}

export interface KycProfile {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  legalName: string;
  panLast4: string;
  bankLast4: string;
  ifsc: string;
  address: string;
  note: string;
  submittedAt: string | null;
  decidedAt: string | null;
}

export interface AdminKyc extends KycProfile {
  userId: string;
  userName: string;
  email: string | null;
}

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error: string;
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  type: string;
  data: string;
  createdAt: string;
}

export interface AdminOrder extends Order {
  ownerName: string;
  ownerHandle: string | null;
  buyerEmail: string | null;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  type: string;
  processedAt: string | null;
  error: string | null;
  receivedAt: string;
}

export interface AdminFunnel {
  name: string;
  steps: { label: string; count: number }[];
}

export const TRACKED_EVENTS = ['creator_signed_up', 'profile_published', 'product_created', 'profile_viewed', 'product_viewed', 'checkout_started', 'payment_succeeded', 'payment_failed', 'booking_confirmed', 'refund_issued', 'link_created', 'automation_created', 'content_dashboard_viewed', 'kyc_submitted', 'kyc_approved'] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export interface CourseDraft {
  lessons: { title: string; body: string; quiz: QuizQuestion[] }[];
  source: 'ai' | 'outline';
}

export interface SearchResults {
  tasks: { id: string; title: string; relationship: RelationshipKey; status: string }[];
  journal: { id: string; title: string; createdAt: string }[];
  resources: { id: string; title: string; kind: ResourceKind }[];
  products: { id: string; title: string; kind: ProductKind; ownerHandle: string | null }[];
  people: { handle: string; name: string }[];
  items: { id: string; title: string; category: string }[];
  listings: { id: string; title: string; condition: string }[];
  tools: { id: string; title: string; category: string }[];
  posts: { id: string; body: string; authorName: string }[];
  clubs: { id: string; title: string; city: string }[];
}

// ---------------------------------------------------------------------------
// Profile and portfolio
// ---------------------------------------------------------------------------

export const SKILLS = ['Videography', 'Editing', 'On camera', 'Interviewing', 'Writing', 'Design', 'Photography', 'Sound', 'Sales and pitching', 'Community', 'Live streaming', 'Teaching'] as const;
export const CATEGORIES = ['Education', 'Comedy', 'Lifestyle', 'Fitness', 'Food', 'Tech', 'Finance', 'Travel', 'Music', 'Gaming', 'Fashion', 'Wellbeing'] as const;
export const EXPERIENCE_LEVELS = ['Just starting', 'Early', 'Working', 'Established'] as const;
export const AVAILABILITY = ['Open to work', 'Open to collabs', 'Busy right now'] as const;
export const GOALS = ['Learn skills', 'Find paid work', 'Collaborate', 'Attend events', 'Sell what I make', 'Get healthier habits'] as const;

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  url: string;
  visibility: 'public' | 'private';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Organizations (brands and agencies)
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  type: 'brand' | 'agency' | 'partner';
  status: 'active' | 'suspended';
  myRole: 'owner' | 'member' | null;
  createdAt: string;
}

export interface OrganizationMember {
  userId: string;
  name: string;
  email: string | null;
  role: 'owner' | 'member';
}

// ---------------------------------------------------------------------------
// Army — brand campaigns
// ---------------------------------------------------------------------------

export const CAMPAIGN_STATUSES = ['lead', 'brief', 'scoping', 'shortlist', 'approved', 'production', 'review', 'delivered', 'reported', 'cancelled'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, string> = {
  lead: 'New lead',
  brief: 'Brief written',
  scoping: 'Scope and budget',
  shortlist: 'Creators shortlisted',
  approved: 'Approved by brand',
  production: 'In production',
  review: 'In review',
  delivered: 'Delivered',
  reported: 'Reported and invoiced',
  cancelled: 'Cancelled',
};

export interface Campaign {
  id: string;
  organizationId: string;
  organizationName: string;
  ownerId: string | null;
  ownerName: string;
  name: string;
  brief: string;
  budgetAmount: number;
  currency: string;
  startDate: string | null;
  dueDate: string | null;
  status: CampaignStatus;
  usageRights: string;
  exclusivityTerms: string;
  brandRestrictions: string;
  createdAt: string;
  updatedAt: string;
  deliverableCount: number;
  assignmentCount: number;
}

export interface Deliverable {
  id: string;
  campaignId: string;
  title: string;
  format: string;
  platform: string;
  dueAt: string | null;
  status: 'open' | 'submitted' | 'changes' | 'approved';
  approvedAt: string | null;
  finalUrl: string | null;
  versions: DeliverableVersion[];
}

export interface DeliverableVersion {
  id: string;
  deliverableId: string;
  versionNumber: number;
  url: string;
  note: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  reviewStatus: 'pending' | 'approved' | 'changes';
  feedback: { id: string; authorName: string; comment: string; createdAt: string }[];
}

export interface CampaignAssignment {
  id: string;
  campaignId: string;
  creatorId: string;
  creatorName: string;
  role: string;
  feeAmount: number;
  currency: string;
  status: 'offered' | 'accepted' | 'declined' | 'done';
  termsAcceptedAt: string | null;
}

export interface CampaignEvent {
  id: string;
  actorName: string;
  eventType: string;
  note: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// School — programs, cohorts, learning
// ---------------------------------------------------------------------------

export interface Program {
  id: string;
  name: string;
  description: string;
  pricePoints: number;
  priceCents: number;
  currency: string;
  deliveryMode: 'online' | 'in_person' | 'hybrid';
  published: boolean;
  outcomes: string;
  prerequisites: string;
  createdAt: string;
  cohorts: Cohort[];
}

export interface Cohort {
  id: string;
  programId: string;
  programName: string;
  name: string;
  startAt: string;
  endAt: string;
  capacity: number;
  enrolled: number;
  status: 'upcoming' | 'running' | 'finished' | 'cancelled';
  managerId: string | null;
  managerName: string;
}

export interface Enrollment {
  id: string;
  cohortId: string;
  learnerId: string;
  learnerName: string;
  status: 'enrolled' | 'completed' | 'withdrawn';
  paymentStatus: 'free' | 'paid' | 'test' | 'pending';
  enrolledAt: string;
  completedAt: string | null;
  progress: { assignmentsApproved: number; assignmentsTotal: number; sessionsAttended: number; sessionsTotal: number };
}

export interface LearningItem {
  id: string;
  programId: string;
  moduleTitle: string;
  contentType: 'lesson' | 'video' | 'reading';
  contentRef: string | null;
  body: string;
  sequence: number;
  published: boolean;
}

export interface CourseAssignment {
  id: string;
  programId: string;
  title: string;
  instructions: string;
  rubric: string;
  dueDays: number;
  sequence: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  cohortId: string;
  learnerId: string;
  learnerName: string;
  url: string | null;
  text: string;
  status: 'submitted' | 'changes' | 'approved';
  submittedAt: string;
  feedback: { id: string; reviewerName: string; comment: string; grade: string | null; createdAt: string }[];
}

export interface CohortSession {
  id: string;
  cohortId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  onlineUrl: string | null;
  attended: boolean;
  attendance?: { userId: string; name: string; status: string }[];
}

// ---------------------------------------------------------------------------
// Work — opportunities and applications
// ---------------------------------------------------------------------------

export const OPPORTUNITY_TYPES = ['gig', 'campaign', 'full_time', 'part_time', 'internship', 'collab'] as const;
export const APPLICATION_STATUSES = ['draft', 'submitted', 'reviewing', 'shortlisted', 'selected', 'rejected', 'withdrawn', 'completed'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Opportunity {
  id: string;
  organizationId: string | null;
  organizationName: string;
  createdBy: string;
  title: string;
  description: string;
  opportunityType: (typeof OPPORTUNITY_TYPES)[number];
  skillsRequired: string[];
  locationMode: 'remote' | 'on_site' | 'hybrid';
  locationText: string;
  compensationMin: number | null;
  compensationMax: number | null;
  currency: string;
  deliverables: string;
  deadline: string | null;
  status: 'draft' | 'published' | 'closed';
  eligibility: string;
  createdAt: string;
  publishedAt: string | null;
  applications: number;
  myApplication: Application | null;
}

export interface Application {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string | null;
  coverNote: string;
  portfolioSnapshot: string;
  status: ApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  events?: { eventType: string; actorName: string; note: string; createdAt: string }[];
}

// ---------------------------------------------------------------------------
// Party — events
// ---------------------------------------------------------------------------

export const EVENT_TYPES = ['meetup', 'party', 'workshop', 'camp', 'day'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_META: Record<EventType, { name: string; emoji: string; staffOnly: boolean }> = {
  meetup: { name: 'Meetup', emoji: '☕', staffOnly: false },
  party: { name: 'Party', emoji: '🎉', staffOnly: true },
  workshop: { name: 'Workshop', emoji: '🛠️', staffOnly: true },
  camp: { name: 'Camp', emoji: '⛺', staffOnly: true },
  day: { name: 'Kreators Day', emoji: '🌞', staffOnly: true },
};

export interface PartyEvent {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  hostId: string;
  hostName: string;
  venue: string;
  onlineUrl: string | null;
  timezone: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  pricePoints: number;
  visibility: 'public' | 'private' | 'club';
  status: 'published' | 'cancelled' | 'done';
  registered: number;
  waitlisted: number;
  mine: EventRegistration | null;
  createdAt: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  status: 'registered' | 'waitlisted' | 'cancelled' | 'attended';
  registeredAt: string;
  checkedInAt: string | null;
  networkingOptIn: boolean;
}

// ---------------------------------------------------------------------------
// Kreators Run — run clubs, start codes, tracking, brand collabs with giveaways
// ---------------------------------------------------------------------------

export const RUN_PACES = ['easy', 'steady', 'fast', 'all'] as const;
export type RunPace = (typeof RUN_PACES)[number];
export const RUN_PACE_META: Record<RunPace, { name: string; blurb: string }> = {
  easy: { name: 'Easy', blurb: 'Talk the whole way. Walk breaks welcome.' },
  steady: { name: 'Steady', blurb: 'A pace you can hold for an hour.' },
  fast: { name: 'Fast', blurb: 'Tempo runs and intervals.' },
  all: { name: 'All paces', blurb: 'Groups split at the start.' },
};
/** What one logged run pays. Paid by the start code, once per run, at most twice a day. */
export const RUN_REWARD = { xp: 20, points: 10, perDay: 2 } as const;
/** How long before the start and after the end a start code still works, in minutes. */
export const RUN_CODE_WINDOW = { before: 30, after: 180 } as const;
export const RUN_CODE_LENGTH = 6;
export const MAX_RUN_METRES = 100_000;
export const MAX_RUN_MINUTES = 600;
/** Run badges: logged runs or metres each one needs. */
export const RUN_BADGES = { run_1: { runs: 1, metres: 0 }, run_10: { runs: 10, metres: 0 }, run_100k: { runs: 0, metres: 100_000 } } as const;

export type RunEntryState = 'early' | 'open' | 'closed';
/** Whether a start code can be entered now: early before the window opens, closed once it has passed. */
export function runEntryState(startsAt: string, endsAt: string, now: Date = new Date()): RunEntryState {
  const t = now.getTime();
  if (t < new Date(startsAt).getTime() - RUN_CODE_WINDOW.before * 60_000) return 'early';
  if (t > new Date(endsAt).getTime() + RUN_CODE_WINDOW.after * 60_000) return 'closed';
  return 'open';
}
/** Metres as a short kilometre label: 5000 is "5 km", 7500 is "7.5 km". */
export function kmLabel(metres: number): string {
  const km = Math.round(metres / 100) / 10;
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}
/** Minutes per kilometre as "5:30 /km". Null when either number is missing. */
export function paceLabel(metres: number, minutes: number): string | null {
  if (metres <= 0 || minutes <= 0) return null;
  const secPerKm = Math.round((minutes * 60) / (metres / 1000));
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`;
}
/** The Monday that starts the week a date falls in. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
/** Weeks in a row with at least one run, counting back from this week; last week keeps the run alive until this one has a run. */
export function weekStreak(dates: readonly string[], today: string): number {
  const weeks = new Set(dates.map(weekStart));
  let w = weekStart(today);
  if (!weeks.has(w)) w = shiftDay(w, -7);
  let n = 0;
  while (weeks.has(w)) {
    n += 1;
    w = shiftDay(w, -7);
  }
  return n;
}

export interface RunClub {
  id: string;
  name: string;
  city: string;
  description: string;
  pace: RunPace;
  /** When and where the club usually meets, in the host's words. */
  meets: string;
  hostId: string;
  hostName: string;
  visibility: 'public' | 'private';
  status: 'active' | 'closed';
  members: number;
  nextRunAt: string | null;
  /** You are a member (hosts are members too). */
  mine: boolean;
  host: boolean;
  createdAt: string;
}

export interface RunEntry {
  id: string;
  runId: string;
  userId: string;
  name: string;
  metres: number;
  minutes: number;
  status: 'logged' | 'void';
  loggedAt: string;
}

export interface Run {
  id: string;
  clubId: string;
  title: string;
  meetingPoint: string;
  startsAt: string;
  endsAt: string;
  /** The planned distance. */
  metres: number;
  /** The start code. Only the host sees it; everyone else gets null. */
  code: string | null;
  entryState: RunEntryState;
  collab: { id: string; title: string; brand: string; giveaway: string } | null;
  status: 'published' | 'cancelled' | 'done';
  entries: number;
  mine: RunEntry | null;
  createdAt: string;
}

export interface RunCollab {
  id: string;
  title: string;
  brand: string;
  organizationId: string | null;
  posterId: string;
  brief: string;
  /** What the brand asks of the club: a post, a tag, a photo at the line. */
  asks: string;
  /** What runners can win, in plain words. */
  giveaway: string;
  /** How many of the giveaway there are. 0 when it is not counted. */
  giveawayCount: number;
  city: string;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'closed';
  applications: number;
  accepted: number;
  /** Your clubs' applications to this collab. */
  mine: RunCollabApplication[];
  /** You posted it, or you hold the events permission. */
  poster: boolean;
  createdAt: string;
}

export interface RunCollabApplication {
  id: string;
  collabId: string;
  clubId: string;
  clubName: string;
  hostName: string;
  note: string;
  status: 'applied' | 'accepted' | 'declined';
  createdAt: string;
}

export interface RunTracking {
  runs: number;
  metres: number;
  minutes: number;
  monthRuns: number;
  monthMetres: number;
  weekStreak: number;
  /** Metres per day over the last thirty days, oldest first. */
  days: { date: string; metres: number }[];
  badges: string[];
}

export interface RunResponse {
  clubs: RunClub[];
  mine: RunClub[];
  /** Runs coming up in your clubs. */
  upcoming: Run[];
  tracking: RunTracking;
  collabsOpen: number;
  canPostCollab: boolean;
}

export interface RunClubDetail {
  club: RunClub;
  runs: Run[];
  past: Run[];
  /** Kilometres this month per member, most first. */
  board: { userId: string; name: string; metres: number; runs: number }[];
  /** Collabs the club was accepted into. */
  collabs: RunCollab[];
  /** For the host: every entry on the club's runs, newest first. */
  entries: RunEntry[];
}

export interface RunCollabsResponse {
  collabs: RunCollab[];
  /** Clubs you host, to apply with. */
  myClubs: RunClub[];
  canPost: boolean;
  /** For posters: applications to your collabs, newest first. */
  applications: (RunCollabApplication & { collabTitle: string })[];
}

// ---------------------------------------------------------------------------
// Club, Win, Bond, Tools, proposals, support
// ---------------------------------------------------------------------------

export const CLUB_BENEFITS = [
  { key: 'events', name: 'Club-only events', blurb: 'Private parties and workshops.' },
  { key: 'opportunities', name: 'First look at opportunities', blurb: 'Club-only Work listings.' },
  { key: 'manager', name: 'A named manager', blurb: 'Someone on staff who knows your work.' },
  { key: 'honor', name: 'The Club honor', blurb: 'Shown on your profile and the leaderboard.' },
] as const;

export interface Membership {
  id: string;
  userId: string;
  userName: string;
  membershipType: 'club';
  status: 'applied' | 'approved' | 'active' | 'rejected' | 'suspended' | 'expired';
  note: string;
  decisionNote: string;
  approvedBy: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface Bounty {
  id: string;
  organizationName: string;
  brandName: string;
  title: string;
  brief: string;
  deliverable: string;
  budgetPoints: number;
  /** Points paid per thousand verified views. */
  ratePerThousand: number;
  /** Cap per creator. 0 means the only cap is the budget. */
  maxPayoutPoints: number;
  /** Views a post needs before anything is paid. */
  minViews: number;
  rewardRule: string;
  eligibility: string;
  platform: string;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'closed' | 'paid';
  featured: boolean;
  version: number;
  submissions: number;
  paidPoints: number;
  mine: BountySubmission | null;
  createdAt: string;
}

export type SocialPlatform = 'instagram' | 'youtube' | 'tiktok' | 'x' | 'facebook' | 'linkedin' | 'other';

export const SOCIAL_PLATFORM_META: Record<SocialPlatform, { name: string; auto: boolean }> = {
  instagram: { name: 'Instagram', auto: false },
  youtube: { name: 'YouTube', auto: true },
  tiktok: { name: 'TikTok', auto: false },
  x: { name: 'X', auto: false },
  facebook: { name: 'Facebook', auto: false },
  linkedin: { name: 'LinkedIn', auto: false },
  other: { name: 'Other', auto: false },
};

export function detectPlatform(url: string): SocialPlatform {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('twitter.com') || u.includes('x.com/')) return 'x';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('linkedin.com')) return 'linkedin';
  return 'other';
}

/** One reading of a post's numbers. Several accumulate over a reward's window. */
export interface SocialMetric {
  id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** auto: fetched from the platform. manual: the creator typed it. staff: a reviewer confirmed it. */
  source: 'auto' | 'manual' | 'staff';
  note: string;
  fetchedAt: string;
}

export interface BountySubmission {
  id: string;
  bountyId: string;
  bountyTitle: string;
  userId: string;
  userName: string;
  url: string;
  platform: SocialPlatform;
  status: 'submitted' | 'verified' | 'rejected' | 'paid' | 'disputed';
  latestViews: number;
  latestEngagement: number;
  /** Views a reviewer confirmed, which the payout is computed from. */
  evidenceViews: number | null;
  evidenceNote: string;
  payoutPoints: number;
  estimatedPoints: number;
  disputeNote: string;
  metrics: SocialMetric[];
  createdAt: string;
  updatedAt: string;
}

/** What a post earns at a given view count, before the budget is considered. */
export function bountyPayout(views: number, b: Pick<Bounty, 'ratePerThousand' | 'maxPayoutPoints' | 'minViews'>): number {
  if (views < b.minViews || b.ratePerThousand <= 0) return 0;
  const raw = Math.floor(views / 1000) * b.ratePerThousand;
  return b.maxPayoutPoints > 0 ? Math.min(raw, b.maxPayoutPoints) : raw;
}

/** Everything the public site can list. Each one opens a page in the app after sign-in. */
export type ListingType = 'reward' | 'opportunity' | 'event' | 'program' | 'tool' | 'campaign' | 'circle';

export interface ListingTypeMeta {
  name: string;
  plural: string;
  moduleKey: string;
  /** The verb on the sign-in button. */
  verb: string;
  emoji: string;
}

export const LISTING_TYPE_META: Record<ListingType, ListingTypeMeta> = {
  reward: { name: 'Content reward', plural: 'Content rewards', moduleKey: 'win', verb: 'Submit a video', emoji: '🥇' },
  opportunity: { name: 'Opportunity', plural: 'Opportunities', moduleKey: 'work', verb: 'Apply', emoji: '💼' },
  event: { name: 'Event', plural: 'Events', moduleKey: 'party', verb: 'RSVP', emoji: '🎉' },
  program: { name: 'Program', plural: 'Programs', moduleKey: 'school', verb: 'Enrol', emoji: '🎓' },
  tool: { name: 'Tool', plural: 'Tools', moduleKey: 'tools', verb: 'Open', emoji: '🧰' },
  campaign: { name: 'Campaign', plural: 'Campaigns', moduleKey: 'army', verb: 'See the brief', emoji: '🎬' },
  circle: { name: 'Circle', plural: 'Circles', moduleKey: 'circles', verb: 'Join', emoji: '🫧' },
};
export const LISTING_TYPES = Object.keys(LISTING_TYPE_META) as ListingType[];

export interface Listing {
  type: ListingType;
  id: string;
  title: string;
  /** Who it is from: a brand, a host, the team. */
  by: string;
  blurb: string;
  /** Short facts shown as chips: pay, dates, place. */
  facts: string[];
  /** The page inside the app. */
  path: string;
  featured: boolean;
  /** Draft or closed listings only appear to admins. */
  live: boolean;
  endsAt: string | null;
  createdAt: string;
}

export interface PublicStats {
  members: number;
  rewardsOpen: number;
  opportunitiesOpen: number;
  eventsUpcoming: number;
  programs: number;
  pointsPaid: number;
  campaigns: number;
}

export interface Friend {
  userId: string;
  name: string;
  handle: string | null;
  avatarUrl: string;
  /** Pending means they asked you; sent means you asked them. */
  status: 'friends' | 'pending' | 'sent';
  requestId: string;
  createdAt: string;
}

/** A one-to-one chat where both people appear under an alias. Started from Bond; names never move through it. */
export interface BondChat {
  id: string;
  myAlias: string;
  theirAlias: string;
  source: string;
  lastMessageAt: string | null;
  lastBody: string;
  createdAt: string;
}

export interface BondMessage {
  id: string;
  alias: string;
  body: string;
  mine: boolean;
  createdAt: string;
}

export interface Introduction {
  id: string;
  requesterId: string;
  requesterName: string;
  recipientId: string;
  recipientName: string;
  context: string;
  status: 'proposed' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Tool {
  id: string;
  name: string;
  category: string;
  url: string;
  description: string;
  affiliate: boolean;
  verified: boolean;
  suggestedByName: string;
  createdAt: string;
  /** A paid or staff-given spot at the top, until this time. */
  featuredUntil: string | null;
  /** Taps on the partner link so far. */
  clicks: number;
  minPoints: number;
  badge: string;
  unlock: Unlock;
}


// ---------------------------------------------------------------------------
// Social: what the feed can sort and filter by, what each action pays, and the trust score a seller carries
// ---------------------------------------------------------------------------

export const FEED_SORTS = ['recent', 'popular', 'talked'] as const;
export type FeedSort = (typeof FEED_SORTS)[number];
export const FEED_SORT_META: Record<FeedSort, string> = { recent: 'Recent', popular: 'Popular', talked: 'Most replies' };
export const FEED_FILTERS = ['all', 'following', 'mine'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];
export const FEED_FILTER_META: Record<FeedFilter, string> = { all: 'Everyone', following: 'Following', mine: 'Mine' };

/** What a social action pays, and how many times a day it can. Small on purpose: the point is to show up, not to farm. */
export const SOCIAL_REWARDS = {
  post: { xp: 5, points: 0, perDay: 3, label: 'a post' },
  reply: { xp: 2, points: 0, perDay: 5, label: 'a reply' },
  like: { xp: 1, points: 0, perDay: 10, label: 'a like you give' },
  liked: { xp: 0, points: 1, perDay: 20, label: 'a like on your post' },
  follower: { xp: 0, points: 2, perDay: 20, label: 'a new follower' },
} as const;
export type SocialRewardKind = keyof typeof SOCIAL_REWARDS;
export interface SocialAward {
  xp: number;
  points: number;
}

/** What a trust score is made of: things that take time and work to earn, never a claim. */
export interface TrustInput {
  xp: number;
  pointsEarned: number;
  bestStreak: number;
  daysHere: number;
  sold: number;
  rating: number | null;
  honors: number;
}
export interface TrustPart {
  label: string;
  value: string;
  score: number;
}
export interface TrustScore {
  score: number;
  label: string;
  parts: TrustPart[];
}
const TRUST_LABELS: [number, string][] = [
  [75, 'Well trusted'],
  [50, 'Trusted'],
  [25, 'Getting known'],
  [0, 'New here'],
];
const cap100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * One number out of a hundred for how much a seller has proved, built only from what they earned:
 * xp, points, a best streak, time here, sales and their rating, and honors from the team.
 * Nothing here can be typed in; it all comes from showing up.
 */
export function trustScore(i: TrustInput): TrustScore {
  const parts: (TrustPart & { weight: number })[] = [
    { label: 'Xp earned', value: `${i.xp.toLocaleString()} xp`, score: cap100(i.xp / 20), weight: 30 },
    { label: 'Points earned', value: `${i.pointsEarned.toLocaleString()} points`, score: cap100(i.pointsEarned / 5), weight: 20 },
    { label: 'Best streak', value: `${i.bestStreak} ${i.bestStreak === 1 ? 'day' : 'days'} in a row`, score: cap100(i.bestStreak * 5), weight: 15 },
    { label: 'Time here', value: i.daysHere < 1 ? 'joined today' : `${i.daysHere} ${i.daysHere === 1 ? 'day' : 'days'}`, score: cap100(i.daysHere / 1.8), weight: 15 },
    { label: 'Sales', value: i.sold === 0 ? 'none yet' : `${i.sold} sold${i.rating ? `, rated ${i.rating.toFixed(1)}` : ''}`, score: i.sold === 0 ? 0 : cap100((cap100(i.sold * 10) + (i.rating ? (i.rating / 5) * 100 : 70)) / 2), weight: 10 },
    { label: 'Honors', value: i.honors === 0 ? 'none yet' : `${i.honors} from the team`, score: cap100(i.honors * 34), weight: 10 },
  ];
  const score = cap100(parts.reduce((s, p) => s + p.score * p.weight, 0) / 100);
  const label = TRUST_LABELS.find(([at]) => score >= at)?.[1] ?? 'New here';
  return { score, label, parts: parts.map(({ label, value, score }) => ({ label, value, score })) };
}

// ---------------------------------------------------------------------------
// Unlocks and the earning guide: what a thing asks for before you can have it, and how everything pays
// ---------------------------------------------------------------------------

/** What a product, store item or tool asks for, and whether this viewer meets it. */
export interface Unlock {
  minPoints: number;
  badge: string;
  ok: boolean;
  /** Plain words for the lock, empty when open. */
  why: string;
}
export function badgeName(key: string): string {
  return BADGES.find((b) => b.key === key)?.name ?? HONORS.find((h) => h.key === key)?.name ?? key;
}
export const isBadgeKey = (key: string): boolean => BADGES.some((b) => b.key === key) || HONORS.some((h) => h.key === key);
/** The one unlock rule: the points balance has to reach the floor, and the badge has to be held. */
export function unlockFor(ask: { minPoints: number; badge: string }, have: { points: number; badges: readonly string[] } | null): Unlock {
  const needsPoints = ask.minPoints > 0;
  const needsBadge = Boolean(ask.badge);
  if (!needsPoints && !needsBadge) return { minPoints: 0, badge: '', ok: true, why: '' };
  if (!have) return { minPoints: ask.minPoints, badge: ask.badge, ok: false, why: `Sign in to open this. It asks for ${[needsPoints ? `${ask.minPoints} points` : '', needsBadge ? `the ${badgeName(ask.badge)} badge` : ''].filter(Boolean).join(' and ')}.` };
  const short: string[] = [];
  if (needsPoints && have.points < ask.minPoints) short.push(`${ask.minPoints} points, you have ${have.points}`);
  if (needsBadge && !have.badges.includes(ask.badge)) short.push(`the ${badgeName(ask.badge)} badge`);
  return { minPoints: ask.minPoints, badge: ask.badge, ok: short.length === 0, why: short.length ? `Needs ${short.join(' and ')}.` : '' };
}

/** The next badge to go for, by the order they are listed. */
export function nextBadge(earned: readonly string[]): Badge | null {
  return BADGES.find((b) => !earned.includes(b.key)) ?? null;
}

export interface EarningLine {
  what: string;
  pays: string;
  how: string;
}
/** How everything pays, in one place. Nudges around the app point here and quote single lines. A function, so it can quote constants declared further down. */
export function earningGuide(): { title: string; lines: EarningLine[] }[] {
  return [
  {
    title: 'Every day',
    lines: [
      { what: 'Check in', pays: `${XP.checkin} xp and ${POINTS.checkin} points`, how: 'The first box on Daily.' },
      { what: 'A week in a row', pays: `${POINTS.streakBonus} points more`, how: `Every ${POINTS.streakBonusEvery}th day of a check-in streak.` },
      { what: 'The small act', pays: `${XP.spark} xp`, how: 'Two minutes for your weakest pillar.' },
      { what: 'A task', pays: `${XP.task} xp`, how: 'Six a day pay. The rest still count as done.' },
      { what: 'A kept day on the not-to-do list', pays: `${XP.notToDo} xp`, how: 'Tick what you stayed away from.' },
      { what: 'Clearing a project', pays: `${XP.projectClear} xp`, how: 'Every task in it done.' },
    ],
  },
  {
    title: 'With people',
    lines: [
      { what: 'A post', pays: `${SOCIAL_REWARDS.post.xp} xp`, how: `Up to ${SOCIAL_REWARDS.post.perDay} a day.` },
      { what: 'A reply', pays: `${SOCIAL_REWARDS.reply.xp} xp`, how: `Up to ${SOCIAL_REWARDS.reply.perDay} a day.` },
      { what: 'A like you give', pays: `${SOCIAL_REWARDS.like.xp} xp`, how: `Up to ${SOCIAL_REWARDS.like.perDay} a day.` },
      { what: 'A like on your post', pays: `${SOCIAL_REWARDS.liked.points} point`, how: 'Paid to you, once per person per post.' },
      { what: 'A new follower', pays: `${SOCIAL_REWARDS.follower.points} points`, how: 'Paid to you, once per person.' },
      { what: 'A run with a club', pays: `${RUN_REWARD.xp} xp and ${RUN_REWARD.points} points`, how: `Enter the start code during the run. Once per run, ${RUN_REWARD.perDay} runs a day.` },
    ],
  },
  {
    title: 'Making and selling',
    lines: [
      { what: 'A sale in your Shop', pays: 'the price in points, minus the fee', how: 'Downloads, courses, sessions, events and more.' },
      { what: 'Campaigns and bounties', pays: 'points per verified view', how: 'Under Win and Army.' },
      { what: 'A featured week in the Store', pays: `costs ${FEATURE_FEE_POINTS} points`, how: 'Your pre-owned listing at the top for seven days.' },
    ],
  },
  {
    title: 'Badges',
    lines: BADGES.map((b) => ({ what: `${b.emoji} ${b.name}`, pays: 'a badge on your page', how: b.how })),
  },
  ];
}

// ---------------------------------------------------------------------------
// How each app works, in three steps, and the words we made up, in plain ones
// ---------------------------------------------------------------------------

/** Every term the app coined, with its meaning. Shown under "Words we use" and in each app's how-to. */
export const TERMS: Record<string, string> = {
  pillar: 'One of the seven relationships in your life, as a place in the app. Each pillar is a pyramid.',
  pyramid: 'How a pillar is built: a foundation at the base, then a guiding principle, a value goal, a goal outcome, a project, and tasks at the tip.',
  foundation: 'The base of a pillar: one thing you will not let break, ever.',
  'guiding principle': 'The second layer: a line you live by, so the foundation holds.',
  'value goal': 'The third layer: how you want to feel more often. No numbers, just the feeling.',
  'goal outcome': 'The fourth layer: what you would see when the value goal is real.',
  project: 'The fifth layer: a bunch of tasks with a finish line.',
  task: 'The tip of the pyramid: one small thing you can tick off today. Each one pays xp and sends a ripple down.',
  'small act': 'One two-minute thing a day for your weakest pillar, picked for you.',
  'check-in': 'The first box on Daily. Ten xp, ten points, and it keeps your streak.',
  streak: 'Days in a row. A check-in streak pays extra every seventh day.',
  xp: 'Progress. It fills your level and your pillars. It is never spent.',
  points: 'Spendable. Earned by showing up and selling, spent on rewards and featured spots.',
  level: 'Where your xp has got you. Each level needs more than the last.',
  badge: 'Proof you did something, earned by the app\'s own count. It sits on your public page.',
  honor: 'A badge the team gives, or time unlocks.',
  ripple: 'Xp that runs down from a ticked task to every layer under it.',
  'daily three': 'Check in, the small act, one task.',
  'not-to-do': 'Things you stay away from, each with its own streak of kept days.',
  'kept day': 'A day you ticked a not-to-do: you stayed away from it.',
  'who you are becoming': 'The character on Daily that changes as your xp grows.',
  'life score': 'One number for the five areas of life, from what you log.',
  'five areas of life': 'Physical, financial, emotional, mental and spiritual: another way to read the seven relationships.',
  period: 'A week, a month, a quarter or half a year, for a review or a dashboard filter.',
  review: 'Your own look back at a period: the numbers from every app, then your answers.',
  trust: 'A score out of 100 from what a seller earned here: xp, points, streaks, time, sales and honors.',
  featured: 'A week at the top of the Store or Tools. Staff give it; a seller pays 200 points.',
  'partner link': 'A link to another shop. kreators.app may earn a share if you buy.',
  'pre-owned': 'Gear another creator is selling. You make an offer; the two of you settle the rest.',
  kit: 'What to buy at a stage, within a budget: new and pre-owned pieces added up.',
  offer: 'Your price for a pre-owned piece. The seller accepts or declines.',
  unlock: 'Some things ask for a points balance, a badge, or both before you can buy them.',
  Pro: 'A paid membership with more room and the Pro mark.',
  Club: 'A curated membership the team reviews you into.',
  cohort: 'A group that goes through a program together, with dates.',
  campaign: 'A brand brief that pays points per verified view.',
  bounty: 'A smaller brief with a fixed prize for the best entries.',
  'public page': 'Your page at kreators.app/u/you: links, products, posts and badges you choose to show.',
  circle: 'A small anonymous table near you, matched by interests, that meets once.',
  alias: 'The made-up name you carry in circles and Bond chats. Nobody sees the real one.',
  guide: 'A team member who keeps the community kind.',
  'run club': 'A group that runs together. Anyone can start one; members log runs with the start code.',
  'start code': 'Six letters the host shows at the start line. Enter it during the run and your entry is logged, once. That is how a run pays points without anyone cheating.',
  collab: 'A brand offer to run clubs: what the brand gives, what it asks, and a giveaway for the runners. A host applies with the club.',
  giveaway: 'What a brand gives runners at a collab run: shoes, a kit, a voucher. Listed on the collab before anyone applies.',
};

export interface HowTo {
  /** Three to five concrete steps, each a sentence or two: what happens, what it pays, where it goes. */
  steps: string[];
  terms: string[];
}
/** How every app works, by module key, shown at the bottom of its main screen, plus the terms it leans on. */
export const HOW_TO: Record<string, HowTo> = {
  home: {
    steps: [
      'Home opens after sign-in and answers “how am I doing” before “what do I do”. The top tiles are your streak, xp today, points and level.',
      'Under them sits what moves those numbers: the three boxes on Daily, your trackers, and your money and shop when those apps are on.',
      'Up next lists the events, runs, sessions and circles you are booked into, soonest first.',
      'Pick a period at the bottom to see the same numbers by week, month, quarter or half year, next to the period before.',
      'The search box at the top finds apps, tasks, people, products and more as you type.',
    ],
    terms: ['xp', 'points', 'level', 'streak', 'period'],
  },
  today: {
    steps: [
      'Daily is three boxes a day: check in, do the small act, tick one task. Checking in pays 10 xp and 10 points and keeps your streak; every seventh day in a row pays 50 points more.',
      'The small act is a two-minute thing for your weakest pillar, picked for you each day. It pays 15 xp.',
      'Tasks come from the pillars you set up. Each pays 20 xp and sends a ripple down its pyramid. A task with a date waits for that day, and a new task waits ten minutes before it can be ticked.',
      'Under the tasks, the not-to-do list holds up to seven things you are staying away from. Tick one to say you kept it today: a kept day pays 5 xp and grows that item’s streak. A slip or a missed day starts the streak over.',
      'At the bottom, who you are becoming shows the figure your xp is filling in, and how far away the next form is.',
    ],
    terms: ['daily three', 'check-in', 'small act', 'task', 'not-to-do', 'kept day', 'who you are becoming'],
  },
  tower: {
    steps: [
      'Seven pillars, one for each relationship in your life. Tap one that is not set up and answer a short vibe check, three taps per pillar. You never fill in a form.',
      'Each pillar is a pyramid with six layers. The foundation is the one thing you will not let break. The guiding principle is a line you live by so it holds. The value goal is how you want to feel more often. The goal outcome is what you would see when that is real. Then a project, and tasks at the tip.',
      'Your answers build the lower four layers; you pick or write the project and its tasks. Tick a task on Daily and the glow runs down to the base: 20 xp for the task, then a smaller ripple to each layer under it. Clear every task in a project for 30 xp more.',
      'Every pillar has a level and a character that grows with it. The weakest pillar is the one that sends your small act.',
      'Open a pillar to see its pyramid, add tasks, give them dates and times, and archive what no longer fits.',
    ],
    terms: ['pillar', 'pyramid', 'foundation', 'guiding principle', 'value goal', 'goal outcome', 'project', 'task', 'ripple'],
  },
  apps: {
    steps: [
      'Every part of the app is a switch here. Apps sit in groups by what they are for: Contribution, Creation, Connection, Reflection, Essentials and Operations.',
      'An app that is on opens when you tap it. A grey one is off: tap it and a sheet explains it and asks before switching it on.',
      'An app you switch on joins the laptop sidebar under its group, and the phone menu under the top-right button.',
      'Switching off happens under Profile, Features, where the same groups and switches live.',
      'Only a few apps start on: School, Work, Army, Journal, Life, Shop and Public page. The rest wait until you want them.',
    ],
    terms: [],
  },
  you: {
    steps: [
      'Your account, your badges and honors, and the figure you are becoming all live here.',
      'Badges are earned by the app’s own count: your first task, streaks, ten tasks, a cleared project, level five, small acts, the Club, and runs. Honors are given by the team or unlocked by time here.',
      'Under Account, add an email and password so your progress survives this device, change the password, export your data, or delete the account.',
      'Under Features, switch apps on or off, in the same groups and colours as the Apps page. Appearance picks light, dark or auto.',
      'See my public page shows exactly what other people see at your address.',
    ],
    terms: ['badge', 'honor', 'who you are becoming', 'public page'],
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
    ],
    terms: ['bounty'],
  },
  party: {
    steps: [
      'Meetups anyone can host. Parties, workshops, camps and Kreators Days are run by the team.',
      'RSVP to take a seat. A full room puts you on the waitlist, first in line: if a seat opens, the first person waiting gets it and a note in their inbox.',
      'Some events cost points for a ticket. Cancelling a seat refunds them.',
      'The host checks people in at the door. Afterwards, rate it and say if you are happy to be introduced; Bond uses that to suggest people you met.',
      'Club members see Club-only events. Private events only show to people with the link.',
    ],
    terms: [],
  },
  run: {
    steps: [
      'Join a run club near you, or start one: a name, a city, a pace and where it usually meets. The host is its first member.',
      'The host adds runs. Each run gets a six-letter start code that only the host sees, to show at the start line.',
      'Enter the code during the run to log it: from thirty minutes before the start to three hours after the end, once per run. A logged run pays 20 xp and 10 points, up to two paid runs a day, and its minutes count as movement in Life.',
      'My runs tracks your kilometres over thirty days, your weekly streak, and three badges: First run, Ten runs and Hundred k.',
      'Brand collabs have their own tab: what a brand gives, what it asks, and the giveaway. A host applies with the club; an accepted collab shows its giveaway on the club and on the runs tied to it.',
    ],
    terms: ['run club', 'start code', 'collab', 'giveaway', 'badge', 'xp', 'points'],
  },
  community: {
    steps: [
      'Community is posts, replies and likes by category, kept kind by guides on the team.',
      'Sort the feed by recent, popular or most replies. Filter it to everyone, people you follow, or your own posts.',
      'Follow anyone from their post. The Following filter shows you their posts first.',
      'A post pays 5 xp (up to three a day), a reply 2 xp (up to five), a like you give 1 xp (up to ten). A like on your post pays you a point and a new follower two, up to twenty a day. Each pays once, so nothing can be farmed.',
      'Members-only spaces come with memberships you buy from a creator’s shop.',
    ],
    terms: ['xp', 'points', 'guide'],
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
    ],
    terms: ['alias'],
  },
  circles: {
    steps: [
      'Circles run every week. Join this week’s; signups close thirty-six hours before.',
      'Two days before, tables are set: people nearby whose interests complement yours, under aliases.',
      'The chat opens a day before. Agree on the exact place and time together.',
      'Show up in the colour that says where you stand: red if you are single, white if you are committed. Rather not say? Wear what you like.',
      'Meet. Afterwards, open an anonymous chat with anyone from your table under Bond. Nobody is ever revealed.',
    ],
    terms: ['circle', 'alias'],
  },
  life: {
    steps: [
      'Life reads your seven relationships the way a life is usually read: physical, financial, emotional, mental and spiritual, each scored from what you already log.',
      'Physical is sleep, movement and breath. Financial is this month’s money, budgets, invoices and goals. Emotional is mood, journal and the people pillars. Mental is stress, tasks done and learning. Spiritual is stillness, small acts and the top two pillars.',
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
      'Pick a length and breathe with the circle.',
      'The minutes log themselves when the timer ends.',
      'Sixty minutes a week scores full marks. The minutes count in Life twice: as breath under physical and as stillness under spiritual.',
      'The line shows thirty days.',
    ],
    terms: [],
  },
  journal: {
    steps: [
      'Write it down, with a feeling and a stress level tagged on the entry.',
      'Only you ever see an entry: not brands, not staff, not the leaderboard, never your public page.',
      'Entries this month show on the calendar. Search finds them by title or text.',
      'The feeling you tag feeds the emotional part of Life.',
    ],
    terms: [],
  },
  companion: {
    steps: [
      'A chat that knows your numbers: streak, mood, sleep, stress and what you wrote this week.',
      'Say what is on your mind. It reflects and asks a better question back.',
      'It is not a therapist and never pretends to be one. In danger, call your local emergency number.',
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
      'Coupons, availability, orders, customers and testimonials live under the Shop sections.',
    ],
    terms: ['unlock', 'points'],
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
      'Add a post by its link and get a tracked link back.',
      'Share the tracked link instead of the plain one.',
      'The dashboard shows clicks, sales and revenue per piece of content, so you make more of what sells.',
    ],
    terms: [],
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
      'The top twenty climbers by xp, streak or badges. Never by follower counts.',
      'Opt in from Profile to appear. Otherwise you are never listed.',
      'Journal and wellbeing never count here.',
    ],
    terms: ['xp', 'streak', 'badge'],
  },
  rewards: {
    steps: [
      'Points buy rewards from the catalog: stickers, a meetup ticket, a tee, a call with a mentor.',
      'A reward is a reservation until it ships. Cancel any time and the points come back.',
      'Points also buy creators’ products, event tickets and featured spots.',
    ],
    terms: ['points'],
  },
  help: {
    steps: [
      'How you earn, the words we use, and answers to common questions.',
      'Write to the team from here. The reply lands in your inbox.',
      'In danger, call your local emergency number.',
    ],
    terms: [],
  },
  notifications: {
    steps: [
      'What happened while you were away: seats, replies, decisions, payouts and reminders.',
      'Daily reminders land here at the time you set under Profile.',
      'Tap one to go where it came from.',
    ],
    terms: [],
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
      'Queues for staff: campaigns, cohorts, events, review, moderation, support, finance and mentoring.',
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
    ],
    terms: [],
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

// ---------------------------------------------------------------------------
// Store: new gear through partner links, pre-owned gear from other creators, kits by budget, featured spots
// ---------------------------------------------------------------------------

export const STORE_CATEGORIES = ['Camera', 'Audio', 'Lighting', 'Computer', 'Phone', 'Software', 'Desk', 'Other'] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];
export const STORE_STAGES = ['starting', 'growing', 'pro', 'any'] as const;
export type StoreStage = (typeof STORE_STAGES)[number];
export const STORE_STAGE_META: Record<StoreStage, { name: string; blurb: string }> = {
  starting: { name: 'Starting out', blurb: 'First videos, one mic, a phone that already works.' },
  growing: { name: 'Growing', blurb: 'Posting every week and ready for a real camera and light.' },
  pro: { name: 'Full time', blurb: 'This pays the rent, so the gear has to.' },
  any: { name: 'Any stage', blurb: 'Good at every step.' },
};
export const PREOWNED_CONDITIONS = ['new', 'lightly_used', 'regularly_used', 'well_used'] as const;
export type PreownedCondition = (typeof PREOWNED_CONDITIONS)[number];
export const PREOWNED_CONDITION_META: Record<PreownedCondition, { name: string; blurb: string }> = {
  new: { name: 'Brand new', blurb: 'Sealed, or never used.' },
  lightly_used: { name: 'Lightly used', blurb: 'Looks new, works like new.' },
  regularly_used: { name: 'Regularly used', blurb: 'Marks of use, fully working.' },
  well_used: { name: 'Well used', blurb: 'Worn, still working. Say what is wrong.' },
};
export const LISTING_STATUSES = ['live', 'agreed', 'sold', 'withdrawn'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const OFFER_STATUSES = ['open', 'accepted', 'declined', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
/** A featured spot: a week at the top, paid in points by a seller, free when staff give it. */
export const FEATURE_FEE_POINTS = 200;
export const FEATURE_DAYS = 7;
export const MAX_LISTING_IMAGES = 6;
export const MAX_KIT_ITEMS = 12;
export const MAX_OPEN_LISTINGS = 20;
export const isFeatured = (until: string | null | undefined, now = new Date().toISOString()): boolean => Boolean(until && until > now);
/** Picture links: https only, a handful at most. */
export function parseImageUrls(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, 500))
    .filter((x) => /^https:\/\//.test(x))
    .slice(0, MAX_LISTING_IMAGES);
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
  featured: MarketCard[];
  kits: StoreKit[];
  items: StoreItem[];
  listings: PreownedListing[];
  mine: { listings: PreownedListing[]; offers: PreownedOffer[] };
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
  { q: 'What are the daily three?', a: 'Check in, do the small act, tick one task. They are on Daily. Each one you tick pays xp. The check-in pays points too.' },
  { q: 'What are the seven pillars?', a: 'The seven relationships that make a life, one pillar each. Each pillar has a pyramid: a foundation at the base, then a guiding principle, a value goal, a goal outcome, a project, and tasks at the tip. Tick a task and the whole pyramid gets stronger.' },
  { q: 'What is a small act?', a: 'One quick thing for your weakest pillar, picked for you each day. It takes two minutes and pays fifteen xp.' },
  { q: 'Why can I not tick a task yet?', a: 'A task needs ten minutes after being written or renamed before it can be ticked. Only six ticks a day pay xp; the rest still count as done.' },
  { q: 'Points versus xp?', a: 'Xp levels you and your pillars up. Points come from showing up. You can trade points for rewards, for things people sell, and for events.' },
  { q: 'How do I sell something?', a: 'Switch Shop on from Apps. Make a product, publish it, and share your Profile page.' },
  { q: 'How do I get work?', a: 'Work lists opportunities from brands and the team. Apply once per opportunity and follow its status in Work.' },
  { q: 'Is the Companion a therapist?', a: 'No. It reflects and asks questions. If you are in danger, contact your local emergency number. In India, Tele-MANAS is 14416.' },
  { q: 'Who can see my journal?', a: 'Only you. Journal entries and wellbeing scores are never shown to brands, staff, the leaderboard or Club selection.' },
] as const;

// ---------------------------------------------------------------------------
// Home — one dashboard: results first, then what you did, then where to go.
// ---------------------------------------------------------------------------

export interface HomeDay {
  date: string;
  xp: number;
  tasks: number;
}

export interface HomeFloor {
  relationship: RelationshipKey;
  level: number;
  xp: number;
  /** Progress through the current level, 0 to 1. */
  pct: number;
  built: boolean;
}

export interface HomeUpNext {
  kind: 'event' | 'booking' | 'session' | 'circle' | 'run';
  title: string;
  /** ISO instant. */
  at: string;
  path: string;
  /** For a circle: when the chat opens. */
  note?: string;
}

/** The line under the numbers. Result first, then what did it, then the one next action. */
export interface HomeNudge {
  lead: string;
  body: string;
  action: string;
  path: string;
}

/** The trackers the kit's home lists under the score: each with today's value and a week to draw. */
export interface HomeTrackers {
  score: number;
  label: string;
  /** Mood 1 to 5 per day for the last seven days, oldest first; null when not logged. */
  mood: { today: number | null; week: (number | null)[] };
  sleep: { latest: number | null; avg7: number | null; week: (number | null)[] };
  stress: { latest: number | null; week: (number | null)[] };
  mindful: { minutesWeek: number; week: number[] };
  journal: { entriesMonth: number; streakDays: number; week: boolean[]; /** The last fourteen days, oldest first. */ days14: boolean[] };
}

export interface HomeResponse {
  date: string;
  trackers: HomeTrackers;
  /** The companion card: how many messages the person has sent. */
  companion: { messages: number };
  /** Two recent pieces from Knowledge for the resource cards. */
  resources: { id: string; title: string; kind: string; tag: string }[];
  today: {
    checkedIn: boolean;
    sparkDone: boolean;
    sparkRelationship: RelationshipKey;
    taskDone: boolean;
    tasksWaiting: number;
    streak: number;
    doneCount: number;
  };
  xp: { total: number; today: number; week: number; level: number; into: number; span: number };
  points: number;
  /** The last fourteen days, oldest first. */
  days: HomeDay[];
  /** Where the last fourteen days of xp came from. */
  xpBySource: { source: 'checkin' | 'spark' | 'task' | 'ripple' | 'other'; xp: number }[];
  floors: HomeFloor[];
  life: { overall: number; label: string; areas: { key: LifeAreaKey; score: number; trend: number }[] } | null;
  money: { currency: string; incomeCents: number; expenseCents: number; owedToMeCents: number; iOweCents: number; overdueInvoices: number; dueSoon: number } | null;
  shop: { products: number; ordersMonth: number; pointsMonth: number; centsMonth: number; currency: string; views: number; followers: number; days: { date: string; orders: number }[] } | null;
  upNext: HomeUpNext[];
  unread: number;
  nudge: HomeNudge;
}

export interface NudgeInput {
  checkedIn: boolean;
  sparkDone: boolean;
  taskDone: boolean;
  tasksWaiting: number;
  /** True when at least one floor has a pillar. */
  hasFloor: boolean;
  xpToday: number;
  streak: number;
  /** Local hour, 0 to 23. */
  hour: number;
}

/**
 * The line under the numbers follows one rule: show the result first, then what did it,
 * then the one thing to do next, and say what it will not work without.
 */
export function nudgeFor(s: NudgeInput): HomeNudge {
  const evening = s.hour >= 18;
  if (s.checkedIn && s.sparkDone && s.taskDone) {
    return {
      lead: `All three done. +${s.xpToday} xp today.`,
      body: 'Here is what that did. The task made its whole pyramid stronger. The small act lifted your weakest pillar. The check-in kept your streak. One thing makes tomorrow easier: put a time on tomorrow’s task.',
      action: 'Set a time on tomorrow’s task',
      path: '/tower',
    };
  }
  if (!s.checkedIn) {
    if (evening) {
      return {
        lead: s.xpToday > 0 ? `+${s.xpToday} xp today, but no check-in yet.` : 'Nothing ticked yet today.',
        body: 'Most people think a missed day is lost. It is not, until midnight. The streak does not need a good day, it needs one tick, and the check-in is the easiest box on the screen.',
        action: 'Check in before midnight',
        path: '/today',
      };
    }
    return {
      lead: s.streak > 0 ? `Day ${s.streak + 1} is waiting.` : 'Zero so far. That is the normal start.',
      body: 'It is not the plan and it is not the points. It is the first tick. Check in, and the other two boxes get easier. But it only counts if you tick it today.',
      action: 'Check in',
      path: '/today',
    };
  }
  if (!s.sparkDone) {
    return {
      lead: `+${s.xpToday} xp banked from the check-in.`,
      body: 'Here is the better way to spend the next two minutes. Not the biggest task. The small act. It goes straight to your weakest area, the one holding your level down.',
      action: 'Do the small act',
      path: '/today',
    };
  }
  if (!s.hasFloor) {
    return {
      lead: `+${s.xpToday} xp today, two boxes down.`,
      body: 'The third box cannot show up yet. Daily only gives you tasks from a pillar you have set up. So this will not work until one pillar exists. Set one up and tomorrow’s task is already waiting.',
      action: 'Set up a pillar',
      path: '/tower',
    };
  }
  if (s.tasksWaiting === 0) {
    return {
      lead: `+${s.xpToday} xp today, two boxes down.`,
      body: 'No task is due today. That is not a rest day. It is a gap. Add one task with a date and a time to any pillar and the third box shows up on Daily.',
      action: 'Add a task',
      path: '/tower',
    };
  }
  return {
    lead: `+${s.xpToday} xp today, two boxes down.`,
    body: `Here is the better way to finish: not the biggest task, the one with a time on it. ${s.tasksWaiting === 1 ? 'One task is' : `${s.tasksWaiting} tasks are`} waiting. Nothing moves until one is ticked.`,
    action: 'Tick a task',
    path: '/today',
  };
}

/** "Good morning", by the local hour. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
