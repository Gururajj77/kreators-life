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
  /** What the character looks after, said next to its name so the name is never alone. */
  role: string;
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
    role: 'guide to work and money',
    color: '#D6456B',
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
    role: 'guide to friends',
    color: '#F08A4B',
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
    role: 'guide to family',
    color: '#F3CF5A',
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
    role: 'guide to love',
    color: '#6F9B74',
    soft: '#F0F2E8',
    deep: '#5A6B38',
    text: '#FFFFFF',
    greeting: "I'm Clover. Love is a daily act, not a yearly highlight.",
    question: 'Was there phone-free time?',
  },
  {
    key: 'self',
    floor: 5,
    name: 'With yourself',
    character: 'Dew',
    role: 'guide to yourself',
    color: '#3F8FD2',
    soft: '#DCEBF8',
    deep: '#1F5F94',
    text: '#FFFFFF',
    greeting: "I'm Dew. One drop, very clear. How are you really?",
    question: 'Did you rest, move, breathe?',
  },
  {
    key: 'guru',
    floor: 6,
    name: 'With the guru',
    character: 'Sage',
    role: 'guide to teachers',
    color: '#4C57C7',
    soft: '#E1E4FA',
    deep: '#323C9A',
    text: '#FFFFFF',
    greeting: "I'm Sage. Everyone you admire had a teacher. Who's yours?",
    question: 'What did you learn on purpose?',
  },
  {
    key: 'divine',
    floor: 7,
    name: 'With the divine',
    character: 'Lumen',
    role: 'guide to faith',
    color: '#5A3FA6',
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

/** A character's name with what it looks after: "Dew, guide to yourself". */
/**
 * Bumling: the app's own guide. It runs the parts of a chat that belong to no one of the seven, like setting up
 * the app, the map and the plan, so a character only speaks where its relationship is the subject.
 */
export const BUMLING = { key: 'bumling', character: 'Bumling', role: 'guide to the app' } as const;
/** Who speaks in a chat: one of the seven, or Bumling. */
export type Host = RelationshipKey | 'bumling';
export const hostName = (h: Host): string => (h === 'bumling' ? BUMLING.character : RELATIONSHIP_BY_KEY[h].character);

export function characterTitle(key: Host): string {
  if (key === 'bumling') return `${BUMLING.character}, ${BUMLING.role}`;
  const r = RELATIONSHIP_BY_KEY[key];
  return `${r.character}, ${r.role}`;
}

/** How a character introduces itself in a chat: "Dew here, your guide to yourself." */
export function characterHello(key: Host): string {
  if (key === 'bumling') return `${BUMLING.character} here, your ${BUMLING.role}.`;
  const r = RELATIONSHIP_BY_KEY[key];
  return `${r.character} here, your ${r.role}.`;
}

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
    hint: 'The first layer, at the top. What must stay standing no matter what.',
    explain: 'The first layer, at the top of the pyramid. One thing you will not let break, ever.',
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
    explain: 'One small thing you can tick off today. The point of the pyramid, at the bottom.',
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
    ['be_there', 'Be there for the family moments', '🏡'],
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
    be_there: L('Be there for the family moments', 'Birthdays, meals and hard days come first when I can', 'Feel like I belong at home', 'Family can count on me to show up', 'Show up at home',
      ['Put the next family birthday or event in your calendar', 'Eat one meal with family this week, phones away', 'Ask a family member what they need help with this week'],
      ['Plan a family day out and lead it', 'Help with one family job without being asked', 'Visit someone in the family you have not seen in a while']),
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

/** What the person chose or wrote for a floor: the value goal and the project, and the foundation in their own words. Free text is allowed. */
export type LadderPicks = Partial<Record<RelationshipKey, { pillar?: string; valueGoal?: string; project?: string }>>;

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
  /** Asked at sign-up. Digits with a leading plus. */
  phone: string;
  /** Asked at sign-up, YYYY-MM-DD. Never shown to anyone else. */
  birthDate: string;
  handle: string | null;
  bio: string;
  reminderTime: string | null;
  /** The code others type in Bond to send this person a friend request. */
  friendCode: string | null;
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
  /** Who they are, from the setup chat: known tag keys and labels in their own words. Never on the public page. */
  identities: string[];
  /** What the setup chat heard: goals and what gets in the way. */
  intake: Intake;
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

/** Numbers for the newer apps. Counts only: never a person, never what they wrote or answered. */
export interface ObservedAdditions {
  /** How many people unlocked each game. */
  games: { key: string; name: string; emoji: string; unlocked: number }[];
  discover: { results: number; people: number; withEq: number; assistantOn: number; stepsOff: number; addons: { type: number; love: number; mind: number; design: number }; mindOn: number };
  /** What super admins gave by hand in the last thirty days. */
  grants: { xp: number; badges: number; points: number; honors: number };
  /** The app's own log, last 24 hours. */
  logs: { errors: number; warnings: number; changes: number };
}

export interface LogEntry {
  id: number;
  at: string;
  level: 'info' | 'warn' | 'error';
  area: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  actorId: string | null;
  actorName: string | null;
  message: string;
}
export interface LogsResponse {
  logs: LogEntry[];
  page: Page;
  /** Counts for the last 24 hours, whatever the filter. */
  last24h: { info: number; warn: number; error: number };
  /** The areas seen in the last week, to filter by. */
  areas: string[];
  /** The people with lines in the last week, busiest first, to filter by. */
  actors: { id: string; name: string; count: number }[];
}

export interface ObservabilityResponse {
  totals: { users: number; onboarded: number; staff: number; admins: number; newThisWeek: number };
  additions: ObservedAdditions;
  roles: Record<Role, number>;
  apps: AppUsage[];
  users: ObservedUser[];
  /** How many people match the search, before paging. */
  total: number;
  page: Page;
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
  /** The deadline: finish by this day. */
  dueDate: string | null;
  /** Tasks only: the day to do it. A task with a do date opens on it, and cannot be ticked before. */
  doDate: string | null;
  /** Tasks only: how often it comes back. Ticking it makes the next one. */
  repeat: Repeat | null;
  /** Tasks only: 0 to 3 for P0 to P3, or null for none. Sorts and tags a task; it never changes what a tick pays. */
  priority: Priority | null;
  /** Tasks only: the strategy session or the vibe check made it from a pillar, rather than the person adding it. */
  fromPillar?: boolean;
  /** Tasks only: the small checklist inside it. Counted, never paid. */
  subtaskTotal?: number;
  subtaskDone?: number;
  /** Tasks only: send an inbox reminder on the task's day, at its time (09:00 when it has none). */
  remind: boolean;
  /** Tasks only, optional: a time of day (HH:MM) and how long it should take, to plan the day. */
  dueTime: string | null;
  estimateMin: number | null;
  completedAt: string | null;
  /** Tasks only: when it can first be ticked. Writing it or renaming it starts the wait. */
  readyAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** A task a life coach added: the student still ticks it, and it pays the same. */
  fromCoach?: boolean;
}

export interface RippleEvent {
  id: string;
  kind: NodeKind;
  title: string;
  amount: number;
}

export interface CompleteResponse {
  /** The next task a repeating one made when it was ticked. */
  next?: Node | null;
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
  /** The main list: tasks whose do date (or due date, when there is no do date) has come, late ones included. */
  tasks: Node[];
  /** Tasks with no do date and no deadline within reach, waiting until one is picked. Not part of the main list. */
  backlog: Node[];
  backlogTotal: number;
  /** Tasks ticked on the person's day (in their zone), newest first, so a tick stays in sight and can be undone. */
  done: Node[];
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
  month: { name: 'Monthly review', short: 'Month', blurb: 'A month: the numbers, the routines that held, what to change.', previous: 'the month before' },
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
  month: ['What are you proud of this month?', 'What did you let slide?', 'Which routines held, and which did not?', 'What will you change next month?'],
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
  { stage: 2, name: 'Sprout', minXp: 300, minDays: 3, blurb: 'First small acts breaking the surface.' },
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
  source: 'admin' | 'time' | 'season';
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
  { key: 'season_top', name: 'Season top three', emoji: '🏅', source: 'season', how: 'Finished a monthly season in the top three on the leaderboard' },
];

export const HONOR_BY_KEY: Record<string, Honor> = Object.fromEntries(HONORS.map((h) => [h.key, h]));

export function timeHonors(createdAt: string, now: Date = new Date()): string[] {
  const started = new Date(createdAt).getTime();
  if (Number.isNaN(started)) return [];
  const days = (now.getTime() - started) / 86_400_000;
  return HONORS.filter((h) => h.source === 'time' && h.days !== undefined && days >= h.days).map((h) => h.key);
}

// ---------------------------------------------------------------------------
// Card games
// ---------------------------------------------------------------------------

/**
 * Card games, played in the app. Each game is unlocked once with points (see REWARDS in index.ts) and then played for good.
 * The card text lives in apps/api/src/cards-data.json and is only served to someone who unlocked the game (or to the team);
 * this file holds what the client needs before that: the name, the line, the picture and the price.
 */
export interface CardGameInfo {
  key: string;
  name: string;
  tagline: string;
  emoji: string;
  /** The relationship whose colours the game wears. */
  accent: RelationshipKey;
  /** Points to unlock it for good. */
  cost: number;
  /** An xp floor before it can be unlocked, on top of the points. Zero means none. */
  minXp: number;
  /** A badge to hold first, when the game asks for one. */
  badge?: string;
}

export const CARD_GAMES: readonly CardGameInfo[] = [
  { key: 'ulta_seedha', name: 'Ulta Seedha', tagline: 'A game to help you overcome approach anxiety.', emoji: '🙃', accent: 'friendship', cost: 2000, minXp: 500 },
  { key: 'dateflow_connect', name: 'DateFlow Connect', tagline: 'A game for better dating experiences.', emoji: '💞', accent: 'lover_partner', cost: 2000, minXp: 500 },
  { key: 'date_guru', name: 'DateGuru', tagline: 'Fifty-two lessons for better dating experiences.', emoji: '🧭', accent: 'lover_partner', cost: 1500, minXp: 100 },
  { key: 'healflow', name: 'HealFlow', tagline: 'For mindful families who want to heal, bond and connect over fun, therapeutic activities.', emoji: '🌿', accent: 'parent_child', cost: 1500, minXp: 100 },
  { key: 'funflow', name: 'FunFlow', tagline: 'For friends and teams who want to bond and grow together.', emoji: '🎉', accent: 'friendship', cost: 1500, minXp: 100 },
  { key: 'relationship_method', name: 'The Relationship Method Challenge', tagline: 'One small daily challenge for each of the seven relationships.', emoji: '🌈', accent: 'self', cost: 1000, minXp: 0 },
  { key: 'roast_or_flirt', name: 'Roast or Flirt', tagline: 'Build better self-esteem with your relationships power.', emoji: '🔥', accent: 'friendship', cost: 2000, minXp: 500 },
  { key: 'shadowflow', name: 'ShadowFlow', tagline: 'Use ShadowFlow to learn more about your hidden self.', emoji: '🌙', accent: 'divine', cost: 1500, minXp: 250 },
  { key: 'workflow', name: 'WorkFlow', tagline: 'Reveal the hidden secrets of office culture.', emoji: '💼', accent: 'servant_leader', cost: 1500, minXp: 250 },
];

export const CARD_GAME_BY_KEY: Record<string, CardGameInfo> = Object.fromEntries(CARD_GAMES.map((g) => [g.key, g]));

/** A game's unlock is a reward with this key. */
export const gameRewardKey = (gameKey: string) => `game_${gameKey}`;

/** One card. A card with `alt` has two sides (Truth and Dare, Roast and Flirt, This and That): the flip shows the other. */
export interface PlayCard {
  /** A short name at the top, when the card has one. */
  title?: string;
  /** What the side is called: This, Roast, Seedha: Truth. */
  label?: string;
  text: string;
  /** Extra lines under the text: examples, questions, riddles, statements. */
  list?: string[];
  alt?: { label: string; text: string };
}

export interface PlayDeck {
  key: string;
  name: string;
  /** What the back of every card in this deck says, when the deck has its own line. */
  hint?: string;
  cards: PlayCard[];
}

/** What the game list shows for each game. */
export interface CardGameCard extends CardGameInfo {
  unlocked: boolean;
  /** What stands between this person and the game: xp, points and a badge, in plain words. Open when they have it all. */
  unlock: Unlock;
  decks: { key: string; name: string; count: number }[];
  total: number;
}

/** A whole game, served only when it is unlocked. */
export interface CardGamePlay extends CardGameInfo {
  howTo: string;
  /** Special cards: rules that shake a turn up. */
  special?: string[];
  specialNote?: string;
  /** House rules, for games that have them. */
  rules?: string[];
  decks: PlayDeck[];
}

export interface CardGamesResponse {
  points: number;
  games: CardGameCard[];
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

export type RewardGroup = 'apparel' | 'tech' | 'drinkware' | 'stationery' | 'lifestyle' | 'novelty' | 'books' | 'games' | 'experiences';

export interface Reward {
  key: string;
  name: string;
  /** An unlock opens something in the app for good (a card game); a merch item or an event ships or happens later. */
  kind: 'event' | 'merch' | 'unlock';
  group: RewardGroup;
  /** For kind unlock: the card game it opens. */
  game?: string;
  /** Its own picture on the card. */
  emoji: string;
  cost: number;
  blurb: string;
  /** Where to read more about it, for the books and games that come from the founder's own sites. */
  link?: string;
}

/** The shelves of the catalog, in the order they are shown. */
export const REWARD_GROUPS: readonly { key: RewardGroup; name: string; emoji: string; blurb: string }[] = [
  { key: 'books', name: 'Books', emoji: '📚', blurb: 'Three books by Shubham Aggarwal, who builds kreators.app.' },
  { key: 'games', name: 'Games', emoji: '🃏', blurb: 'Unlock a game once with points and play it in the app: shuffle, flip and draw. Nothing is posted to you.' },
  { key: 'apparel', name: 'Apparel and wearables', emoji: '👕', blurb: 'Wear it, and people ask what it is.' },
  { key: 'tech', name: 'Tech accessories', emoji: '📱', blurb: 'Small things you use every day.' },
  { key: 'drinkware', name: 'Drinkware', emoji: '☕', blurb: 'Keep a drink with you, again and again.' },
  { key: 'stationery', name: 'Office and stationery', emoji: '📝', blurb: 'For your desk and your plans.' },
  { key: 'lifestyle', name: 'Lifestyle and wellness', emoji: '🧼', blurb: 'Look after yourself, at home or on the road.' },
  { key: 'novelty', name: 'Novelty and fun', emoji: '🎮', blurb: 'Just for the joy of it.' },
  { key: 'experiences', name: 'Experiences', emoji: '🎟️', blurb: 'Time with real people.' },
];

export const REWARDS: readonly Reward[] = [
  ...CARD_GAMES.map((g): Reward => ({ key: gameRewardKey(g.key), name: g.name, kind: 'unlock', emoji: g.emoji, group: 'games', cost: g.cost, blurb: g.tagline, game: g.key })),
  { key: 'book_relationship_method', name: 'The Relationship Method', kind: 'merch', emoji: '📘', group: 'books', cost: 2000, blurb: 'The book behind the seven relationships this app is built on.', link: 'https://brandingbum.com' },
  { key: 'book_dictionary_of_mistakes', name: 'Dictionary of Mistakes for Kreators', kind: 'merch', emoji: '📕', group: 'books', cost: 2000, blurb: 'The mistakes kreators make, so you can skip them.', link: 'https://brandingbum.com' },
  { key: 'book_20_somethings', name: 'Dictionary of Mistakes for 20 Somethings', kind: 'merch', emoji: '📗', group: 'books', cost: 2000, blurb: 'The mistakes people in their twenties make, so you can skip them.', link: 'https://brandingbum.com' },

  { key: 'tee', name: 'Kreators tee', kind: 'merch', emoji: '👕', group: 'apparel', cost: 2500, blurb: 'The seven characters, printed big.' },
  { key: 'hoodie', name: 'Kreators hoodie', kind: 'merch', emoji: '🧥', group: 'apparel', cost: 4500, blurb: 'Warm, soft and easy to spot.' },
  { key: 'cap', name: 'Cap', kind: 'merch', emoji: '🧢', group: 'apparel', cost: 1800, blurb: 'A plain cap with the Kreators mark.' },
  { key: 'beanie', name: 'Beanie', kind: 'merch', emoji: '🎿', group: 'apparel', cost: 1500, blurb: 'For the cold days.' },
  { key: 'socks', name: 'Socks', kind: 'merch', emoji: '🧦', group: 'apparel', cost: 1200, blurb: 'Fun socks with the characters.' },
  { key: 'tote', name: 'Tote bag', kind: 'merch', emoji: '👜', group: 'apparel', cost: 1000, blurb: 'Strong, reusable and roomy.' },

  { key: 'usb_drive', name: 'USB flash drive', kind: 'merch', emoji: '💾', group: 'tech', cost: 1500, blurb: 'Carry your files anywhere.' },
  { key: 'power_bank', name: 'Power bank', kind: 'merch', emoji: '🔋', group: 'tech', cost: 3000, blurb: 'Charge your phone on the go.' },
  { key: 'phone_grip', name: 'Phone grip and stand', kind: 'merch', emoji: '📲', group: 'tech', cost: 600, blurb: 'Sticks to your phone and holds it up.' },
  { key: 'laptop_stickers', name: 'Laptop stickers', kind: 'merch', emoji: '💻', group: 'tech', cost: 400, blurb: 'A few small stickers for your laptop.' },

  { key: 'water_bottle', name: 'Water bottle', kind: 'merch', emoji: '💧', group: 'drinkware', cost: 1800, blurb: 'A steel bottle for your daily water goal.' },
  { key: 'mug', name: 'Coffee mug', kind: 'merch', emoji: '☕', group: 'drinkware', cost: 1200, blurb: 'A ceramic mug for your desk.' },
  { key: 'tumbler', name: 'Tumbler', kind: 'merch', emoji: '🥤', group: 'drinkware', cost: 2200, blurb: 'Keeps drinks hot or cold for hours.' },

  { key: 'notebook', name: 'Notebook', kind: 'merch', emoji: '📓', group: 'stationery', cost: 1200, blurb: 'A good notebook for plans and ideas.' },
  { key: 'pens', name: 'Pen and highlighter set', kind: 'merch', emoji: '🖊️', group: 'stationery', cost: 500, blurb: 'The classic set.' },
  { key: 'sticky_notes', name: 'Sticky notes', kind: 'merch', emoji: '🗒️', group: 'stationery', cost: 500, blurb: 'Small reminders you can see.' },
  { key: 'desk_organizer', name: 'Desk organizer', kind: 'merch', emoji: '🗂️', group: 'stationery', cost: 1000, blurb: 'Keeps your desk tidy.' },

  { key: 'lip_balm', name: 'Lip balm', kind: 'merch', emoji: '💋', group: 'lifestyle', cost: 400, blurb: 'Small enough for any bag.' },
  { key: 'hand_sanitizer', name: 'Hand sanitizer', kind: 'merch', emoji: '🧴', group: 'lifestyle', cost: 400, blurb: 'A pocket size bottle.' },
  { key: 'travel_pillow', name: 'Travel pillow', kind: 'merch', emoji: '😴', group: 'lifestyle', cost: 1800, blurb: 'For long trips.' },
  { key: 'luggage_tag', name: 'Luggage tag', kind: 'merch', emoji: '🧳', group: 'lifestyle', cost: 500, blurb: 'Find your bag fast.' },
  { key: 'sunglasses', name: 'Sunglasses', kind: 'merch', emoji: '🕶️', group: 'lifestyle', cost: 1500, blurb: 'For sunny days and festivals.' },

  { key: 'stickers', name: 'Sticker pack', kind: 'merch', emoji: '✨', group: 'novelty', cost: 600, blurb: 'All seven characters, die-cut.' },
  { key: 'stress_ball', name: 'Stress ball', kind: 'merch', emoji: '🟡', group: 'novelty', cost: 400, blurb: 'Squeeze it when work gets heavy.' },
  { key: 'enamel_pin', name: 'Enamel pin', kind: 'merch', emoji: '📌', group: 'novelty', cost: 500, blurb: 'A collectible pin of one of the characters.' },
  { key: 'keychain', name: 'Keychain', kind: 'merch', emoji: '🔑', group: 'novelty', cost: 500, blurb: 'Small, strong and always with you.' },
  { key: 'bottle_opener', name: 'Bottle opener', kind: 'merch', emoji: '🍾', group: 'novelty', cost: 400, blurb: 'Useful more often than you think.' },

  { key: 'meetup', name: 'Meetup ticket', kind: 'event', emoji: '🎟️', group: 'experiences', cost: 1500, blurb: 'A seat at the next city meetup.' },
  { key: 'coaching', name: 'One-to-one call', kind: 'event', emoji: '🎯', group: 'experiences', cost: 4000, blurb: 'Forty minutes with a mentor.' },
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
  /** The card games this person has unlocked. */
  games: string[];
  rewards: Reward[];
  redemptions: Redemption[];
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/** Each board ranks the top of this many opted-in people; the rest are not ranked. */
export const LEADERBOARD_POOL = 200;
export type LeaderboardSort = 'xp' | 'season' | 'streak' | 'badges';

/** What a board is about. Goals and pillars are what people work on; the rest is who they are. */
export type LeaderboardScope = 'all' | 'goal' | 'pillar' | 'city' | 'identity' | 'level';
export const LEADERBOARD_SCOPES: readonly { key: LeaderboardScope; label: string; group: 'Everyone' | 'What people work on' | 'Who they are' }[] = [
  { key: 'all', label: 'Everyone', group: 'Everyone' },
  { key: 'goal', label: 'By goal', group: 'What people work on' },
  { key: 'pillar', label: 'By pillar', group: 'What people work on' },
  { key: 'city', label: 'By city', group: 'Who they are' },
  { key: 'identity', label: 'By who they are', group: 'Who they are' },
  { key: 'level', label: 'By experience', group: 'Who they are' },
];
export const isLeaderboardScope = (v: unknown): v is LeaderboardScope => LEADERBOARD_SCOPES.some((s) => s.key === v);
export interface LeaderboardOption {
  value: string;
  label: string;
  emoji?: string;
  /** People on the board who opted in. */
  count: number;
}
export interface LeaderboardOptions {
  goal: LeaderboardOption[];
  pillar: LeaderboardOption[];
  city: LeaderboardOption[];
  identity: LeaderboardOption[];
  level: LeaderboardOption[];
}
/** One small board in the overview: the top three of a goal or pillar and where the viewer stands. */
export interface LeaderboardBlock {
  scope: LeaderboardScope;
  value: string;
  label: string;
  emoji: string;
  people: number;
  top: { rank: number; name: string; xp: number; isMe: boolean }[];
  myRank: number | null;
}

/**
 * A season is a calendar month (UTC): the season board counts only the xp earned in it, so everyone starts level
 * at the start of the month. When a month ends its top three are kept and get the Season top three honor.
 */
export const seasonOf = (iso: string): string => iso.slice(0, 7);
export const seasonStart = (season: string): string => `${season}-01T00:00:00.000Z`;
/** "October 2026". */
export function seasonLabel(season: string): string {
  const [y, m] = season.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
/** The month before: "2026-10" for "2026-11", "2025-12" for "2026-01". */
export function previousSeason(season: string): string {
  const [y, m] = season.split('-').map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 2, 1));
  return d.toISOString().slice(0, 7);
}
export const SEASON_TOP = 3;
export interface SeasonResult {
  season: string;
  label: string;
  top: { place: number; name: string; xp: number; isMe: boolean }[];
}

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
  /** Xp earned this season (this calendar month). */
  seasonXp: number;
}


export interface LeaderboardResponse {
  by: LeaderboardSort;
  scope: LeaderboardScope;
  /** The goal, pillar, city, tag or level chosen, empty for everyone. */
  value: string;
  /** What the board is called: "Learn a new skill", "Friends", "Pune". */
  label: string;
  page: Page;
  /** People on this board, up to the pool the board ranks (`LEADERBOARD_POOL`). */
  people: number;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  optedIn: boolean;
  /** This season's month and when it ends, and the last few closed seasons' top three. */
  season: { season: string; label: string; endsAt: string };
  past: SeasonResult[];
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
  /** Badges a super admin gave by hand, on top of the ones the person earned. */
  grantedBadges: string[];
  role: Role;
  email: string | null;
  handle: string | null;
  permissions: Permission[];
  /** The assistant plan, or none, and when it ends. */
  plan: PlanKey;
  planUntil: string | null;
  /** Credits left: the plan's for this period, and extra ones that stay. */
  planCredits: number;
  extraCredits: number;
  /** Asked to be made a life coach, and still waiting for an answer. */
  coachAskedAt: string | null;
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

/**
 * Staff permissions. A permission is a job someone is trusted with; admins hold all of them, apart from Life coach,
 * which is never implied: a life coach is someone the team chose to coach, so even an admin is given it on purpose.
 */
export const PERMISSIONS = ['talent', 'cohorts', 'events', 'finance', 'moderation', 'support', 'review', 'mentor', 'coach'] as const;
export type Permission = (typeof PERMISSIONS)[number];
/** The permissions a creator can hold. Every other one needs the Staff role. */
export const CREATOR_PERMISSIONS: readonly Permission[] = ['mentor', 'coach'];

export const PERMISSION_META: Record<Permission, { name: string; blurb: string }> = {
  talent: { name: 'Talent manager', blurb: 'Runs Army campaigns, shortlists and assigns creators.' },
  cohorts: { name: 'Cohort manager', blurb: 'Publishes programs, runs cohorts, marks completion.' },
  events: { name: 'Event host', blurb: 'Creates any kind of event and checks people in.' },
  finance: { name: 'Finance', blurb: 'Approves bounty payouts and reviews money orders.' },
  moderation: { name: 'Moderator', blurb: 'Hides posts and handles reports.' },
  support: { name: 'Support', blurb: 'Answers help requests.' },
  review: { name: 'Reviewer', blurb: 'Decides Club applications, bounties, TV and Fund proposals.' },
  mentor: { name: 'Mentor', blurb: 'Gives feedback on assignments. Can be held by a creator.' },
  coach: { name: 'Life coach', blurb: 'Coaches students who said yes: sees what they share, leaves notes, adds tasks. Never their journal. Can be held by a creator.' },
};

export function hasPermission(user: { role: Role; permissions: readonly string[] }, perm: Permission): boolean {
  return user.role === 'admin' || user.permissions.includes(perm);
}

/**
 * Staff-level: admin or staff holding the permission. Mentor and Life coach are the permissions a creator can hold,
 * and Life coach is the one an admin does not hold unless given it.
 */
export function isStaffFor(user: { role: Role; permissions: readonly string[] }, perm: Permission): boolean {
  if (perm === 'coach') return user.permissions.includes('coach');
  if (user.role === 'admin') return true;
  if (CREATOR_PERMISSIONS.includes(perm)) return user.permissions.includes(perm);
  return user.role === 'sub_admin' && user.permissions.includes(perm);
}

/** What the small badge on a picture says: the role, or Life coach for a creator the team made a life coach. */
export type BadgeRole = Role | 'coach';
export const BADGE_META: Record<BadgeRole, { name: string; blurb: string; emoji: string; accent: RelationshipKey }> = {
  ...ROLE_META,
  coach: { name: 'Life coach', blurb: 'Coaches students who said yes. The team makes someone a life coach.', emoji: '🎯', accent: 'guru' },
};
/** Staff and admins keep their own badge; a creator who holds Life coach wears that one. */
export function badgeRoleOf(user: { role: Role; permissions: readonly string[] }): BadgeRole {
  return user.role === 'user' && user.permissions.includes('coach') ? 'coach' : user.role;
}

// ---------------------------------------------------------------------------
// Modules — every feature is a module. People switch them on and off under
// You; admins can disable one for everyone or limit it to a role.
// ---------------------------------------------------------------------------

export type ModuleGroup = 'core' | 'wellbeing' | 'earn' | 'community' | 'creator' | 'manage';

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
  // On for everyone. People still only appear after they opt in under Profile, and journal and wellbeing never count.
  { key: 'leaderboard', name: 'Leaderboard', blurb: 'See where you stand by goal, pillar, city and more. Boards for each goal, filters, and a monthly season.', emoji: '🏆', group: 'core', path: '/leaderboard', defaultOn: true, minRole: 'user' },
  // Off on a new account; unlocking a game in Rewards switches it on.
  { key: 'cards', name: 'Games', blurb: 'Unlock a game once with points, then shuffle, flip and play it with the people you are with.', emoji: '🃏', group: 'community', path: '/cards', defaultOn: false, minRole: 'user', accent: 'friendship' },
  // Off on a new account. Owner only, like the journal: never shown to brands, staff, the leaderboard, a coach or the assistant.
  { key: 'discover', name: 'Discover', blurb: 'A quiz about how you think, feel and act, with puzzles and real situations. It gives a detailed read on your personality, your reasoning and your emotional intelligence, and your strengths across the seven relationships.', emoji: '🔭', group: 'wellbeing', path: '/discover', defaultOn: false, minRole: 'user', accent: 'self' },
  { key: 'notifications', name: 'Inbox', blurb: 'What happened while you were away, and daily reminders.', emoji: '🔔', group: 'core', path: '/inbox', defaultOn: true, minRole: 'user' },
  { key: 'help', name: 'Help', blurb: 'Answers to common questions, and a line to the team.', emoji: '🛟', group: 'core', path: '/help', defaultOn: true, minRole: 'user' },
  // The assistant is part of every screen, not an app of its own: locked on, and its page is its plan and credits.
  { key: 'assistant', name: 'Assistant', blurb: 'Tap a flow to log something, or type what you did and it is done in the app for you. Typing is part of a plan.', emoji: '🪄', group: 'core', path: '/plans', defaultOn: true, locked: true, minRole: 'user' },

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
  { key: 'coaching', name: 'Coaching', blurb: 'Work with a life coach who sees the progress you choose to share, or coach your own students. Never your journal.', emoji: '🎯', group: 'wellbeing', path: '/coaching', defaultOn: false, minRole: 'user', accent: 'guru' },

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
  // Tracking for the team, in Operations: the module's minRole keeps it to staff and admins.
  { key: 'observability', name: 'Observability', blurb: 'Who is here, which apps they have on, who holds which role, and the build map.', emoji: '📡', group: 'manage', path: '/internal/observability', defaultOn: true, minRole: 'sub_admin' },
];

export const MODULE_BY_KEY: Record<string, AppModule> = Object.fromEntries(MODULES.map((m) => [m.key, m]));

export const MODULE_GROUPS: Record<ModuleGroup, string> = {
  earn: 'Contribution',
  creator: 'Creation',
  community: 'Connection',
  wellbeing: 'Reflection',
  core: 'Essentials',
  manage: 'Operations',
};

/** The relationship whose colour each app group wears on the Apps page and under You, Features. */
export const MODULE_GROUP_ACCENT: Record<ModuleGroup, RelationshipKey> = {
  earn: 'servant_leader',
  creator: 'parent_child',
  community: 'friendship',
  wellbeing: 'lover_partner',
  core: 'self',
  manage: 'guru',
};

/** One line on what each group is for. */
export const MODULE_GROUP_BLURB: Record<ModuleGroup, string> = {
  earn: 'Learn a craft, do the work, get paid.',
  creator: 'Make things: your page, your shop, your numbers.',
  community: 'Meet people, on your terms.',
  wellbeing: 'How you are doing, day by day.',
  core: 'The basics that are always around.',
  manage: 'Tools for the team.',
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
  /** The author's standing, so a guide or admin sees whether they may mute them. */
  authorRank: CommunityRank;
  /** Written under a made-up name. The author's id, handle and followers are never sent, except the id to staff. */
  anonymous: boolean;
  /** The viewer wrote it. */
  mine: boolean;
  authorPro: boolean;
  /** Whether the viewer follows the author, and how many people do. */
  authorFollowing: boolean;
  authorFollowers: number;
  category: string;
  body: string;
  /** Members-only posts belong to a membership product. */
  productId: string | null;
  /** Every reaction counts here; `liked` is whether the viewer reacted at all. */
  likes: number;
  liked: boolean;
  reactions: ReactionCounts;
  myReaction: ReactionKind | null;
  replies: number;
  hidden: boolean;
  /** Pinned to the top of its category by a guide. */
  pinned: boolean;
  /** A first post waiting for a guide's okay: only its author and guides see it. */
  held: boolean;
  /** The viewer follows the post: new replies land in their inbox under Following. */
  followingPost: boolean;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  anonymous: boolean;
  mine: boolean;
  /** The reply this answers, or null for a reply straight to the post. */
  parentId: string | null;
  /** How far in it sits: 0 for a reply to the post, up to `MAX_REPLY_DEPTH`. */
  depth: number;
  body: string;
  reactions: ReactionCounts;
  myReaction: ReactionKind | null;
  createdAt: string;
}

/** Six ways to react to a post or a reply. Any of them on a post is the like that pays, once per post. */
export const REACTIONS = ['like', 'celebrate', 'support', 'love', 'insightful', 'funny'] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export type ReactionCounts = Partial<Record<ReactionKind, number>>;
export const REACTION_META: Record<ReactionKind, { name: string; emoji: string }> = {
  like: { name: 'Like', emoji: '👍' },
  celebrate: { name: 'Celebrate', emoji: '🎉' },
  support: { name: 'Support', emoji: '🙌' },
  love: { name: 'Love', emoji: '❤️' },
  insightful: { name: 'Insightful', emoji: '💡' },
  funny: { name: 'Funny', emoji: '😄' },
};
export const isReaction = (v: unknown): v is ReactionKind => typeof v === 'string' && (REACTIONS as readonly string[]).includes(v);
/** Pinned posts a category can hold at once. */
export const MAX_PINNED = 3;
/** People one post or reply can mention. More @handles are left as plain text. */
export const MAX_MENTIONS = 5;
/** The @handles in a text, lower case, in order, each once: the same shape a handle is saved in. */
export function mentionsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:^|[^a-z0-9_@.])@([a-z0-9_]{3,20})\b/gi)) {
    const h = (m[1] ?? '').toLowerCase();
    if (!out.includes(h)) out.push(h);
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
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
  archivedAt: string | null;
  createdAt: string;
}

/**
 * Inbox tabs, by what a note is about. All holds everything; Team is only offered to staff and admins. A kind that is
 * in no tab shows under All only.
 */
export const INBOX_TABS = ['all', 'replies', 'following', 'events', 'coaching', 'team'] as const;
export type InboxTab = (typeof INBOX_TABS)[number];
export const INBOX_TAB_META: Record<InboxTab, { name: string; kinds: readonly string[] }> = {
  all: { name: 'All', kinds: [] },
  replies: { name: 'Replies and mentions', kinds: ['reply', 'mention'] },
  following: { name: 'Following', kinds: ['thread', 'follow', 'broadcast'] },
  events: { name: 'Events', kinds: ['party', 'circle', 'run', 'event'] },
  coaching: { name: 'Coaching', kinds: ['coach'] },
  // Notes about work waiting for the team, such as an ask to be made a life coach.
  team: { name: 'Team', kinds: ['team'] },
};
export const isInboxTab = (v: unknown): v is InboxTab => typeof v === 'string' && (INBOX_TABS as readonly string[]).includes(v);
export type InboxShow = 'inbox' | 'unread' | 'archived';

/** Reminders before an event someone signed up for: a day before, then an hour before. */
export const EVENT_REMINDERS = [
  { kind: 'day', before: 24 * 60 },
  { kind: 'hour', before: 60 },
] as const;

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

// ---------------------------------------------------------------------------
// The strategy session: onboarding as a self-serve session. A map of levels, a placement per
// relationship (where you live, where you drop), fears and insecurities asked early, a scorecard, the
// person's real day, up to two focus pillars, a routine ramped from that day, practices and a contract.
// The map builds on Hawkins' Map of Consciousness: a shared order of levels, never a measurement.
// ---------------------------------------------------------------------------

export const MAP_BANDS = ['victim', 'empowerment', 'realization'] as const;
export type MapBand = (typeof MAP_BANDS)[number];
export const MAP_BAND_META: Record<MapBand, { name: string; blurb: string; from: number; to: number }> = {
  victim: { name: 'Stuck', blurb: 'Fear, blame or shame run the show.', from: 20, to: 199 },
  empowerment: { name: 'Owning it', blurb: 'You show up, keep promises, take what is yours.', from: 200, to: 399 },
  realization: { name: 'At ease', blurb: 'It flows. You give without keeping score.', from: 400, to: 540 },
};
export interface MapLevel {
  value: number;
  name: string;
  band: MapBand;
  /** What it sounds like in your own head. */
  sounds: string;
}
export const MAP_LEVELS: readonly MapLevel[] = [
  { value: 20, name: 'Shame', band: 'victim', sounds: 'I am the problem.' },
  { value: 30, name: 'Guilt', band: 'victim', sounds: 'I always mess this up.' },
  { value: 50, name: 'Apathy', band: 'victim', sounds: "What's the point." },
  { value: 75, name: 'Grief', band: 'victim', sounds: "It's gone and I can't get it back." },
  { value: 100, name: 'Fear', band: 'victim', sounds: "What if it goes wrong? I'll avoid it." },
  { value: 125, name: 'Desire', band: 'victim', sounds: 'I need this to feel okay.' },
  { value: 150, name: 'Anger', band: 'victim', sounds: "It's their fault." },
  { value: 175, name: 'Pride', band: 'victim', sounds: "I'm above this." },
  { value: 200, name: 'Courage', band: 'empowerment', sounds: "I'm scared and I'm doing it anyway." },
  { value: 250, name: 'Neutrality', band: 'empowerment', sounds: 'Fine either way.' },
  { value: 310, name: 'Willingness', band: 'empowerment', sounds: "I'll show up and do the work." },
  { value: 350, name: 'Acceptance', band: 'empowerment', sounds: 'This is mine to own.' },
  { value: 400, name: 'Inner light', band: 'realization', sounds: 'I can see how this works.' },
  { value: 440, name: 'Inner wisdom', band: 'realization', sounds: 'I know why, and I act from that.' },
  { value: 500, name: 'Inner love', band: 'realization', sounds: 'I act from care, not need.' },
  { value: 540, name: 'Oneness', band: 'realization', sounds: 'Your good is my good.' },
];
export const COURAGE = 200;
export const ACCEPTANCE = 350;
export const VOLATILE_GAP = 150;
export const levelByValue = (v: number): MapLevel | undefined => MAP_LEVELS.find((l) => l.value === v);
export const levelsInBand = (band: MapBand): MapLevel[] => MAP_LEVELS.filter((l) => l.band === band);
export const bandOfLevel = (v: number): MapBand => (v >= 400 ? 'realization' : v >= COURAGE ? 'empowerment' : 'victim');

/** The statement for each band, per relationship. Health sits inside Self; work and wealth inside Servant leader. */
export const BAND_STATEMENTS: Record<RelationshipKey, Record<MapBand, string>> = {
  self: { victim: 'Shame about my looks or body. I attack myself, numb out, and compare all the time.', empowerment: 'I keep promises to myself, hold routines through moods, and own my mistakes.', realization: 'Self-respect that needs no proof. Rest and discipline feel the same.' },
  lover_partner: { victim: 'I avoid approaching, or I stay from fear of being alone. Jealousy, control, neediness.', empowerment: 'I start honestly, say what I need, and survive a no without falling apart.', realization: 'I love without keeping score and give the other person room.' },
  friendship: { victim: 'I isolate or people-please. Envy. Friends of convenience.', empowerment: 'I show up, reach out first, and disagree honestly.', realization: "Friendship as service. I celebrate others' wins fully." },
  parent_child: { victim: 'Resentment, blame, duty out of guilt, harshness.', empowerment: 'Clear boundaries, responsibility, respectful contact.', realization: 'Gratitude and forgiveness. I teach by example, not lectures.' },
  servant_leader: { victim: 'I work from fear of loss, blame the boss, and let money worry drive my choices.', empowerment: 'I own outcomes, keep learning, and build income on purpose.', realization: 'Work as service. I lead by example. Wealth is a tool for others.' },
  guru: { victim: 'I reject all guidance, or depend on it blindly. I shop for validation.', empowerment: 'I ask for feedback, apply it, and stay coachable and critical.', realization: 'Student and teacher at once. I pass it on.' },
  divine: { victim: 'Fear of punishment, bargaining, no practice, or spiritual pride.', empowerment: 'A regular practice: prayer, mantra, reading. I am searching for meaning.', realization: 'Surrender and presence. The practice is a way of living.' },
};

export interface Placement {
  relationship: RelationshipKey;
  /** Where you usually live. */
  core: number;
  /** Where you drop under stress. */
  floor: number;
  /** For a core of 400 or more: what you did last week that shows it. Without it the core is capped at Acceptance. */
  evidence: string;
}
export interface PlacementFlags {
  core: number;
  floor: number;
  /** A floor under Courage: a required focus for month one. */
  required: boolean;
  /** A gap of more than 150 between floor and core: a weekly check. */
  volatile: boolean;
  capped: boolean;
}
/**
 * The placement rules, in one place. `required` marks a floor under Courage: the pillar the session suggests
 * starting with. The person still picks their own focus; nothing is forced on them.
 */
export function placementFlags(p: Placement): PlacementFlags {
  const capped = p.core >= 400 && p.evidence.trim().length < 10;
  const core = capped ? ACCEPTANCE : p.core;
  const floor = Math.min(p.floor, core);
  return { core, floor, required: floor < COURAGE, volatile: core - floor > VOLATILE_GAP, capped };
}

export const FEAR_OPTIONS = ['Trying new things', 'Being rejected', 'Being judged', 'Failing in public', 'Being alone', 'Losing money', 'Letting people down', 'Being seen'] as const;
export const DRIVES = ['yes', 'sometimes', 'no'] as const;
export type Drives = (typeof DRIVES)[number];
export interface Fear {
  text: string;
  relationship: RelationshipKey;
  drives: Drives;
}
export interface Insecurity {
  text: string;
  /** Out of 10, picked as one of the words in INSECURITY_WEIGHTS. */
  weight: number;
  relationship: RelationshipKey;
}
export const MAX_FEARS = 8;
export const MAX_INSECURITIES = 8;
/** How heavy an insecurity is, in words. Each keeps its number out of ten, so the focus rules are unchanged. */
export const INSECURITY_WEIGHTS = [
  { weight: 2, name: 'A little' },
  { weight: 5, name: 'Some' },
  { weight: 8, name: 'A lot' },
  { weight: 10, name: 'Very heavy' },
] as const;
/** The word for a weight out of ten: the nearest one, so older numbers read too. */
export function weightWord(weight: number): string {
  return [...INSECURITY_WEIGHTS].sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0]!.name;
}

export const SCORECARD = {
  health: ['sleep', 'nutrition', 'movement', 'positive_stress', 'negative_stress', 'emotional_control'],
  wealth: ['income', 'passive_income', 'learning', 'time'],
} as const;
export type ScoreKey = (typeof SCORECARD.health)[number] | (typeof SCORECARD.wealth)[number] | RelationshipKey;
export const SCORE_LABEL: Record<(typeof SCORECARD.health)[number] | (typeof SCORECARD.wealth)[number], string> = {
  sleep: 'Sleep',
  nutrition: 'Food',
  movement: 'Movement',
  positive_stress: 'Good stress, the kind that gets you up',
  negative_stress: 'Bad stress, the kind that wears you down',
  emotional_control: 'Control over your feelings',
  income: 'Income',
  passive_income: 'Money that comes in without your hours',
  learning: 'Learning',
  time: 'Time that is yours',
};
export type Scores = Partial<Record<ScoreKey, number>>;
/** What each star means on the scorecard, one star to five. */
export const STAR_WORDS = ['Very poor', 'Poor', 'Okay', 'Good', 'Great'] as const;
/** Stars from a score out of ten (two points a star), and back. */
export const starsOf = (score: number): number => Math.max(0, Math.min(5, Math.round(score / 2)));
export const scoreOfStars = (stars: number): number => Math.max(0, Math.min(10, Math.round(stars) * 2));

/** A score of 8 or more (four stars or five) over a floor under Courage gets one behaviour question. Fewer than four days in seven caps it at 6. */
export function settleScore(score: number, floor: number, daysInSeven: number | null): number {
  if (score < 8 || floor >= COURAGE) return score;
  if (daysInSeven === null) return score;
  return daysInSeven < 4 ? Math.min(score, 6) : score;
}

export interface RealDay {
  wake: string;
  sleep: string;
  workStart: string;
  workEnd: string;
  evening: string;
  gym: string;
}
export const DEFAULT_REAL_DAY: RealDay = { wake: '08:30', sleep: '00:30', workStart: '10:00', workEnd: '18:30', evening: '', gym: '' };

/** The suggested focus, up to two pillars: every floor under Courage first, then the lowest cores weighted by insecurity. The person can change it. */
export function pickFocus(placements: Placement[], insecurities: Insecurity[]): RelationshipKey[] {
  const flagged = placements.map((p) => ({ key: p.relationship, f: placementFlags(p) }));
  const required = flagged.filter((x) => x.f.required).sort((a, b) => a.f.floor - b.f.floor).map((x) => x.key);
  if (required.length >= 2) return required.slice(0, 2);
  const weight = (k: RelationshipKey) => insecurities.filter((i) => i.relationship === k).reduce((a, i) => a + i.weight, 0);
  const rest = flagged
    .filter((x) => !required.includes(x.key))
    .sort((a, b) => a.f.core - weight(a.key) * 10 - (b.f.core - weight(b.key) * 10))
    .map((x) => x.key);
  return [...required, ...rest].slice(0, 2);
}

export const BLOCK_KEYS = ['morning', 'nutrition', 'work', 'skills', 'social', 'sleep'] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];
export interface RoutineBlock {
  key: BlockKey;
  name: string;
  start: string;
  end: string;
  /** Only the morning block has steps; the day is done when every one is ticked. */
  steps: string[];
  /** The minutes each morning step takes, in the same order. Older routines may not have them. */
  minutes?: number[];
  note: string;
}
export interface Routine {
  general: RoutineBlock[];
  exceptional: RoutineBlock[];
}
export type DayType = 'general' | 'exceptional';
export const TARGET_WAKE = '06:30';
export const TARGET_SLEEP = '23:30';
export const RAMP_MINUTES = 30;
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h ?? 0) * 60 + (m ?? 0) + 24 * 60) % (24 * 60);
};
const toHHMM = (min: number) => {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
/** Thirty minutes a week from the real time toward the target, never past it. Sleep counts past midnight as late. */
export function rampTime(real: string, target: string, weeksCompliant: number, direction: 'earlier'): string {
  const r = toMin(real);
  const t = toMin(target);
  // Times after 20:00 are "last night"; treat them as before midnight for the arithmetic.
  const late = (v: number) => (v < 12 * 60 ? v + 24 * 60 : v);
  const rr = late(r);
  const tt = late(t);
  const moved = rr - RAMP_MINUTES * Math.max(0, weeksCompliant);
  void direction;
  return toHHMM(Math.max(tt, moved));
}
/** The routine from the coach's template, ramped from the person's real day. Pure, so it can be tested. */
export function routineFor(day: RealDay, weeksCompliant: number, focus: RelationshipKey[], placements: Placement[]): Routine {
  const wake = rampTime(day.wake || DEFAULT_REAL_DAY.wake, TARGET_WAKE, weeksCompliant, 'earlier');
  const sleep = rampTime(day.sleep || DEFAULT_REAL_DAY.sleep, TARGET_SLEEP, weeksCompliant, 'earlier');
  const w = toMin(wake);
  const exposure = placements.filter((p) => placementFlags(p).required).map((p) => RELATIONSHIP_BY_KEY[p.relationship].name.toLowerCase());
  const morningSteps = ['Mantra, five to ten minutes', 'Three breathing rounds', 'Two minutes of seeing the day go well', 'Ten minutes of movement', 'One page of reading'];
  const general: RoutineBlock[] = [
    { key: 'morning', name: 'Morning routine', start: wake, end: toHHMM(w + 60), steps: morningSteps, minutes: [10, 3, 2, 10, 5], note: 'Done only when every step is ticked.' },
    { key: 'nutrition', name: 'Food and water', start: toHHMM(w + 60), end: '20:00', steps: [], note: 'Water through the day. Last meal by eight.' },
    { key: 'work', name: 'Work', start: day.workStart || DEFAULT_REAL_DAY.workStart, end: day.workEnd || DEFAULT_REAL_DAY.workEnd, steps: [], note: day.gym ? `Gym at ${day.gym}, before dinner.` : 'Gym before dinner if you train.' },
    { key: 'social', name: 'People', start: day.workEnd || DEFAULT_REAL_DAY.workEnd, end: '21:00', steps: [], note: exposure.length ? `One small scary thing a day for ${exposure.join(' and ')}. Log it.` : focus.length ? `One real conversation a day for ${focus.map((k) => RELATIONSHIP_BY_KEY[k].name.toLowerCase()).join(' or ')}.` : 'One real conversation a day.' },
    { key: 'skills', name: 'Learning and reflection', start: '21:00', end: '23:00', steps: [], note: 'A lesson, then the journal: mood, stress, where you were on the map today.' },
    { key: 'sleep', name: 'Lights out', start: sleep, end: wake, steps: [], note: 'Evening line on the way down.' },
  ];
  const exceptional: RoutineBlock[] = general.map((b) =>
    b.key === 'morning' ? { ...b, end: toHHMM(w + 20), steps: ['Mantra, five minutes', 'One breathing round', 'Five minutes of movement'], minutes: [5, 1, 5], note: 'The short form for a day that is not yours.' } : b.key === 'skills' ? { ...b, start: '22:00', note: 'Just the journal tonight.' } : b,
  );
  return { general, exceptional };
}

/** How much a routine can hold once edited: morning steps, and the words in a step or a note. */
export const ROUTINE_STEPS_MAX = 10;
export const ROUTINE_STEP_MAX = 80;
export const ROUTINE_NOTE_MAX = 160;
export const ROUTINE_STEP_MINUTES_MAX = 120;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** How long a block runs, start to end, in minutes. A block that runs past midnight, like lights out, wraps. */
export function blockMinutes(b: Pick<RoutineBlock, 'start' | 'end'>): number {
  const d = toMin(b.end) - toMin(b.start);
  return d >= 0 ? d : d + 24 * 60;
}
/** The minutes a block's steps add up to. */
export function stepsMinutes(b: Pick<RoutineBlock, 'steps' | 'minutes'>): number {
  return b.steps.reduce((a, _, i) => a + (b.minutes?.[i] ?? 0), 0);
}
/** Minutes in words: "45 min", "1 hr", "1 hr 30 min". */
export function minutesLabel(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}
/**
 * The one check on an edited routine, for the editor and for PATCH /session/routine: the six blocks in the
 * routine's own order (a block that is not sent keeps what it had), times as HH:MM, a note per block, and the morning's steps
 * with their minutes, one to ROUTINE_STEPS_MAX, each named once. The other blocks keep no steps.
 */
export function parseRoutineBlocks(input: unknown, current: RoutineBlock[]): RoutineBlock[] {
  const given = Array.isArray(input) ? input : [];
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  // The routine's own order, which is the day's order; a block it somehow lacks joins at the end.
  const order = [...current.map((b) => b.key), ...BLOCK_KEYS.filter((k) => !current.some((b) => b.key === k))];
  return order.map((key) => {
    const was = current.find((b) => b.key === key) ?? { key, name: key, start: '00:00', end: '00:00', steps: [], note: '' };
    const raw = given.find((g): g is Record<string, unknown> => Boolean(g) && typeof g === 'object' && (g as { key?: unknown }).key === key);
    if (!raw) return was;
    const time = (v: unknown, fallback: string) => (typeof v === 'string' && HHMM.test(v) ? v : fallback);
    const block: RoutineBlock = { key, name: was.name, start: time(raw.start, was.start), end: time(raw.end, was.end), steps: [], note: typeof raw.note === 'string' ? text(raw.note, ROUTINE_NOTE_MAX) : was.note };
    if (key !== 'morning') return block;
    const minutes = Array.isArray(raw.minutes) ? raw.minutes : [];
    const seen = new Set<string>();
    const kept = (Array.isArray(raw.steps) ? raw.steps : [])
      .map((st, i) => ({ step: text(st, ROUTINE_STEP_MAX), mins: Math.max(0, Math.min(ROUTINE_STEP_MINUTES_MAX, Math.round(Number(minutes[i]) || 0))) }))
      .filter((x) => x.step && !seen.has(x.step.toLowerCase()) && seen.add(x.step.toLowerCase()))
      .slice(0, ROUTINE_STEPS_MAX);
    // The morning always keeps at least one step, or the day could never be done.
    if (kept.length === 0) return { ...block, steps: was.steps, ...(was.minutes ? { minutes: was.minutes } : {}) };
    return { ...block, steps: kept.map((x) => x.step), minutes: kept.map((x) => x.mins) };
  });
}

export const MANTRAS = [
  { key: 'om_namah_shivaya', name: 'Om Namah Shivaya', blurb: 'For the material path: work, money, the body.' },
  { key: 'hare_krishna', name: 'Hare Krishna', blurb: 'For the spiritual path: practice, surrender, meaning.' },
  { key: 'own', name: 'My own mantra', blurb: 'Words of your own.' },
  { key: 'none', name: 'No mantra yet', blurb: 'Breathing and reading only.' },
] as const;
export const OWN_MANTRA_MAX = 80;
export const BREATHING = [
  { key: 'box', name: 'Box breathing', blurb: 'In four, hold four, out four, hold four.' },
  { key: '478', name: 'Four seven eight', blurb: 'In four, hold seven, out eight.' },
  { key: 'nostril', name: 'Alternate nostril', blurb: 'One side in, the other out, slow.' },
] as const;
export interface Practices {
  mantra: (typeof MANTRAS)[number]['key'];
  /** The words, when the mantra is your own. */
  ownMantra?: string;
  breathing: (typeof BREATHING)[number]['key'];
  affirmation: string;
  reading: string;
}
/** The mantra in words: a known one's name, your own words in quotes, or none yet. */
export function mantraLine(p: Pick<Practices, 'mantra' | 'ownMantra'>): string {
  const own = p.ownMantra?.trim();
  if (p.mantra === 'own') return own ? `“${own}”` : 'No mantra yet';
  return MANTRAS.find((m) => m.key === p.mantra)?.name ?? 'No mantra yet';
}

/** One line to say on waking and before sleep, from the focus. */
export function affirmationFor(focus: RelationshipKey[]): string {
  const names = focus.map((k) => RELATIONSHIP_BY_KEY[k].name.toLowerCase());
  if (names.length === 0) return 'I show up today, scared or not.';
  return `I show up for ${names.join(' and ')} today, scared or not. Courage first; the rest follows.`;
}

export const PENALTIES = [
  { key: 'streak', name: 'The streak breaks', blurb: 'A missed week resets the routine streak to zero.' },
  { key: 'unlock', name: 'Unlocks wait', blurb: 'The next app does not open until a full week is in.' },
  { key: 'roster', name: 'The coach sees it', blurb: 'A red week shows on the coach roster.' },
] as const;
export interface Contract {
  minDays: number;
  checkinTime: string;
  penalty: (typeof PENALTIES)[number]['key'];
  nextWeekly: string;
  nextMonthly: string;
  signedName: string;
  signedAt: string;
}
export const CONTRACT_MIN_DAYS_DEFAULT = 5;

export interface Assessment {
  id: string;
  kind: 'onboard' | 'monthly' | 'quarterly' | 'biannual';
  placements: (Placement & PlacementFlags)[];
  fears: Fear[];
  insecurities: Insecurity[];
  scores: Scores;
  realDay: RealDay;
  focus: RelationshipKey[];
  createdAt: string;
}
export interface RoutineDay {
  day: string;
  dayType: DayType;
  steps: string[];
  done: boolean;
}
export interface SessionResponse {
  assessment: Assessment | null;
  routine: (Routine & { id: string; rampStep: number; practices: Practices; createdAt: string }) | null;
  contract: Contract | null;
  today: RoutineDay | null;
  /** Days this week the morning routine was fully done, out of seven. */
  week: { done: number; days: (boolean | null)[] };
}

// ---------------------------------------------------------------------------
// Content strategist: one folder per brand, fed links, researched through Agent Reach, written up by a model.
// ---------------------------------------------------------------------------

export const MAX_BRANDS = 20;

/** A question buyers ask and the creator's answer, shown at the foot of a product's page. */
export interface ProductFaq {
  q: string;
  a: string;
}
export const MAX_FAQ = 6;
export const FAQ_Q_MAX = 120;
export const FAQ_A_MAX = 500;
/** The one reader for a creator's FAQ, from the browser or a column: only clean, non-empty pairs, trimmed and capped. */
export function parseFaq(raw: unknown): ProductFaq[] {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: ProductFaq[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const o = item as { q?: unknown; a?: unknown };
    const q = typeof o.q === 'string' ? o.q.trim().slice(0, FAQ_Q_MAX) : '';
    const a = typeof o.a === 'string' ? o.a.trim().slice(0, FAQ_A_MAX) : '';
    if (q && a) out.push({ q, a });
    if (out.length >= MAX_FAQ) break;
  }
  return out;
}

/** How many devices one account can be signed in on at once. A fourth sign-in signs the oldest one out. */
export const MAX_DEVICES = 3;
export const MAX_BRAND_SOURCES = 40;
export const BRAND_NAME_MAX = 80;
export const BRIEF_MAX = 4000;

export const BRAND_SOURCE_KINDS = ['site', 'youtube', 'instagram', 'x', 'tiktok', 'reddit', 'article', 'competitor'] as const;
export type BrandSourceKind = (typeof BRAND_SOURCE_KINDS)[number];
export const BRAND_SOURCE_META: Record<BrandSourceKind, { name: string; emoji: string }> = {
  site: { name: 'Website', emoji: '🌐' },
  youtube: { name: 'YouTube', emoji: '▶️' },
  instagram: { name: 'Instagram', emoji: '📸' },
  x: { name: 'X', emoji: '✖️' },
  tiktok: { name: 'TikTok', emoji: '🎵' },
  reddit: { name: 'Reddit', emoji: '👽' },
  article: { name: 'Article', emoji: '📰' },
  competitor: { name: 'Competitor', emoji: '🥊' },
};
/** Which kind a link is, from its address. A competitor is a choice, never a guess. */
export function sourceKindOf(url: string): BrandSourceKind {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('twitter.com') || u.includes('x.com/')) return 'x';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('reddit.com') || u.includes('redd.it')) return 'reddit';
  if (/\/(blog|news|article|post)s?\//.test(u) || u.includes('medium.com') || u.includes('substack.com')) return 'article';
  return 'site';
}

export const RESEARCH_KINDS = ['read', 'search', 'youtube_search', 'channels', 'outliers', 'x_search', 'reddit_search', 'transcript', 'profile'] as const;
export type ResearchKind = (typeof RESEARCH_KINDS)[number];
export const RESEARCH_META: Record<ResearchKind, { name: string; blurb: string; needsQuery: boolean }> = {
  read: { name: 'Read a link', blurb: 'The page, post or video behind a link, as text.', needsQuery: false },
  search: { name: 'Search the web', blurb: 'What the web says about a topic, niche or brand.', needsQuery: true },
  youtube_search: { name: 'Search YouTube', blurb: 'Videos on a topic, newest and most relevant.', needsQuery: true },
  channels: { name: 'Find channels', blurb: 'The YouTube channels winning on a topic, with how many people follow each and how their videos do.', needsQuery: true },
  outliers: { name: 'Find outliers', blurb: 'Videos on a topic sorted by views, so the ones that broke out float up.', needsQuery: true },
  x_search: { name: 'Search X', blurb: 'Posts on a topic. Needs Agent Reach with an X login.', needsQuery: true },
  reddit_search: { name: 'Search Reddit', blurb: 'Threads on a topic. Needs Agent Reach with a Reddit login.', needsQuery: true },
  transcript: { name: 'Transcript', blurb: 'The words spoken in a YouTube video.', needsQuery: false },
  profile: { name: 'Profile', blurb: 'An X or Instagram account and its recent posts.', needsQuery: false },
};

export const PIECE_KINDS = ['audit', 'plan', 'calendar', 'ideas', 'hooks', 'script', 'post', 'analysis', 'playbook'] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];
export const PIECE_META: Record<PieceKind, { name: string; emoji: string; blurb: string; askFor: string }> = {
  audit: { name: 'Strategy audit', emoji: '🔍', blurb: 'What the brand does now, what wins in its niche, the gaps, and ten moves in order.', askFor: 'Anything the audit should weigh, like a launch date or a platform you care about most.' },
  plan: { name: 'Marketing plan', emoji: '🗺️', blurb: 'Positioning, who it is for, three content pillars, channels and cadence, the first 30, 60 and 90 days, and the numbers to watch.', askFor: 'The goal, the budget if any, and the time you can give it each week.' },
  calendar: { name: 'Four-week calendar', emoji: '📅', blurb: 'Four weeks of posts: day, platform, format, hook and call to action.', askFor: 'How many posts a week, and on which platforms.' },
  ideas: { name: 'Video ideas', emoji: '💡', blurb: 'Fifteen ideas, each with its angle, hook, format and the research that says it should work.', askFor: 'A theme, a product to push, or nothing at all.' },
  hooks: { name: 'Hooks', emoji: '🪝', blurb: 'Twenty opening lines in the patterns the outliers used, grouped by type, each with why it works.', askFor: 'The topic of the video the hooks are for.' },
  script: { name: 'Short-form script', emoji: '🎬', blurb: 'A 30 to 60 second script: the hook, the setup, the payoff, the call to action. Remix a winner, start from scratch, or fix a draft.', askFor: 'The idea, or paste a draft to fix, or name the research item to remix.' },
  post: { name: 'Posts and captions', emoji: '✍️', blurb: 'Captions and threads ready to post, one per platform you name.', askFor: 'What the post is about and which platforms.' },
  playbook: { name: 'What is working', emoji: '📘', blurb: 'The patterns behind the winners: hook types, structures, lengths and topics, counted, each with the video that shows it, and what to copy and what to skip.', askFor: 'The platform and format you want the patterns for, like YouTube Shorts under a minute.' },
  analysis: { name: 'Why it worked', emoji: '🧪', blurb: 'One video or post taken apart: the hook, the structure, the format, the style, and what to take from it.', askFor: 'Which research item to take apart, or paste the transcript.' },
};

export interface Brand {
  id: string;
  name: string;
  niche: string;
  description: string;
  /** How the brand sounds, in the owner's words. Goes into every piece. */
  voice: string;
  sources: number;
  runs: number;
  pieces: number;
  createdAt: string;
  updatedAt: string;
}
export interface BrandSource {
  id: string;
  kind: BrandSourceKind;
  url: string;
  label: string;
  /** The first lines of what was read, so the folder shows what each link is. */
  summary: string;
  meta: Record<string, unknown>;
  lastReadAt: string | null;
  createdAt: string;
}
/** One thing research brought back: a page, a video, a post. */
export interface ResearchItem {
  title: string;
  url: string;
  author: string;
  publishedAt: string;
  text: string;
  /** Numbers when the platform gives them: views, likes, comments, followers. */
  stats: Record<string, number>;
}
export interface ResearchRun {
  id: string;
  kind: ResearchKind;
  query: string;
  status: 'done' | 'failed';
  /** Which road brought the data: agent-reach, page, youtube-api, or none. */
  backend: string;
  items: ResearchItem[];
  error: string;
  createdAt: string;
}
export interface BrandPiece {
  id: string;
  kind: PieceKind;
  title: string;
  brief: string;
  /** Markdown in the app's small dialect. */
  body: string;
  sources: string[];
  /** claude, workers-ai or digest, so a draft never passes for a model's work. */
  writer: string;
  status: 'draft' | 'kept';
  createdAt: string;
  updatedAt: string;
}
export interface BrandDetail {
  brand: Brand;
  sources: BrandSource[];
  runs: ResearchRun[];
  pieces: BrandPiece[];
  page: Page;
  /** What the server can do right now, so the screen says it before anyone waits. */
  tools: { reach: boolean; writer: 'claude' | 'workers-ai' | 'none' };
  /** How many finished runs and pieces of each kind the folder holds, so the strategy path knows where you are. */
  counts: { runs: Partial<Record<ResearchKind, number>>; pieces: Partial<Record<PieceKind, number>> };
}

/** The path from "who is this for" to a month of posts. Each step is done by doing the thing, never ticked by hand. */
export interface PathStep {
  key: string;
  title: string;
  why: string;
  done: boolean;
  /** Where the step's button goes: the brand's details, a research run, or a piece to write. */
  go: { to: 'edit' } | { to: 'research'; kind: ResearchKind } | { to: 'create'; kind: PieceKind };
}
export function strategyPath(brand: Pick<Brand, 'niche' | 'voice'>, counts: BrandDetail['counts']): PathStep[] {
  const r = (k: ResearchKind) => (counts.runs[k] ?? 0) > 0;
  const p = (k: PieceKind) => (counts.pieces[k] ?? 0) > 0;
  return [
    { key: 'say', title: 'Say what this brand makes and how it sounds', why: 'Every step after this leans on the niche and the voice.', done: Boolean(brand.niche.trim() && brand.voice.trim()), go: { to: 'edit' } },
    { key: 'channels', title: 'See who is winning', why: 'The channels that already own your topic show what an audience wants.', done: r('channels'), go: { to: 'research', kind: 'channels' } },
    { key: 'outliers', title: 'Find what broke out', why: 'Videos far above their channel\'s usual views are the ones to learn from.', done: r('outliers'), go: { to: 'research', kind: 'outliers' } },
    { key: 'analysis', title: 'Take one winner apart', why: 'See its hook, its beats and its length, one at a time.', done: p('analysis'), go: { to: 'create', kind: 'analysis' } },
    { key: 'playbook', title: 'Write your playbook', why: 'The patterns across all the winners, counted, with what to copy and what to skip.', done: p('playbook'), go: { to: 'create', kind: 'playbook' } },
    { key: 'ideas', title: 'Pick your ideas', why: 'Fifteen ideas that lean on the playbook, each with its hook.', done: p('ideas'), go: { to: 'create', kind: 'ideas' } },
    { key: 'script', title: 'Write the script for the best one', why: 'Hook, setup, payoff and call to action, in your voice.', done: p('script'), go: { to: 'create', kind: 'script' } },
    { key: 'calendar', title: 'Plan the month', why: 'Four weeks of posts, so you are never starting from a blank page.', done: p('calendar'), go: { to: 'create', kind: 'calendar' } },
  ];
}

// ---------------------------------------------------------------------------
// Pages: every long list is served a page at a time, 10, 25, 50 or 100 rows, with a next page.
// ---------------------------------------------------------------------------

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** Where a list is: which page, how many rows a page holds, and whether a next page exists. */
export interface Page {
  page: number;
  size: PageSize;
  more: boolean;
}

/** A page size from a query string or a select, or the default. */
export function pageSizeOf(v: unknown): PageSize {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
}

/** The query string for a page, with an optional prefix for a second list on the same screen: "lpage=2&lsize=50". */
export function pageQuery(page: number, size: number, prefix = ''): string {
  return `${prefix}page=${Math.max(1, Math.floor(page))}&${prefix}size=${pageSizeOf(size)}`;
}

// ---------------------------------------------------------------------------
// Sign-up: a phone number and a date of birth, and the one age rule.
// ---------------------------------------------------------------------------

/** Nobody under this age can sign up. The terms page says the same. */
export const MIN_AGE = 18;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole years between a birth date and a day, both YYYY-MM-DD. */
export function ageOn(birthDate: string, day: string): number {
  const by = Number(birthDate.slice(0, 4));
  const dy = Number(day.slice(0, 4));
  const before = day.slice(5) < birthDate.slice(5) ? 1 : 0;
  return dy - by - before;
}

/** Why a date of birth will not do, in plain words, or null when it is fine. */
export function birthDateProblem(birthDate: string, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!DAY_RE.test(birthDate) || Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`))) return 'Enter your date of birth.';
  if (birthDate > today) return 'That day has not happened yet.';
  const age = ageOn(birthDate, today);
  if (age < MIN_AGE) return `You need to be ${MIN_AGE} or older to join.`;
  if (age > 120) return 'That date does not look right.';
  return null;
}

/** Digits only, with a leading plus kept: "+91 98765-43210" becomes "+919876543210". */
export function normalizePhone(raw: string): string {
  const t = raw.trim();
  return (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
}

/** Why a phone number will not do, or null when it is fine: 8 to 15 digits, a country code is welcome. */
export function phoneProblem(raw: string): string | null {
  const p = normalizePhone(raw);
  if (!/^\+?\d{8,15}$/.test(p)) return 'Enter a phone number with the country code, like +91 98765 43210.';
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
  /** Questions and answers the creator shows on the product's page, up to MAX_FAQ. */
  faq: ProductFaq[];
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
  /** Who can buy: a points balance to reach, an xp floor, a badge to hold, or any mix. Zero and empty mean anyone. */
  minPoints: number;
  minXp: number;
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

/** Replies nest this deep; an answer to the deepest one lands beside it, so a long argument stays readable. */
export const MAX_REPLY_DEPTH = 4;
export const ANON_ANIMALS = ['Otter', 'Heron', 'Fox', 'Finch', 'Lynx', 'Panda', 'Gecko', 'Owl', 'Koala', 'Swan', 'Hare', 'Wren'] as const;
/** A made-up name from some bytes of a hash: the same person gets the same name in one conversation and a new one in the next. */
export function anonAliasFrom(bytes: ArrayLike<number>): string {
  return `${ALIAS_WORDS[(bytes[0] ?? 0) % ALIAS_WORDS.length]} ${ANON_ANIMALS[(bytes[1] ?? 0) % ANON_ANIMALS.length]} ${10 + ((bytes[2] ?? 0) % 90)}`;
}
/** Put replies in reading order: each one right under what it answers, oldest first inside a level. An orphan becomes a top-level reply. */
export function threadOrder<T extends { id: string; parentId: string | null; depth: number }>(rows: readonly T[]): T[] {
  const ids = new Set(rows.map((r) => r.id));
  const kids = new Map<string | null, T[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    kids.set(key, [...(kids.get(key) ?? []), r]);
  }
  const out: T[] = [];
  const walk = (key: string | null, depth: number) => {
    for (const r of kids.get(key) ?? []) {
      out.push({ ...r, depth: Math.min(depth, MAX_REPLY_DEPTH) });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
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
  /** The xp its attendee code gives, when the host made one. */
  attendeeXp: number | null;
  /** The code itself, with its counts, for the host and events staff only. */
  hostCode: AttendeeCodeHost | null;
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
  /** Only Club members see it and can apply. */
  clubOnly: boolean;
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
  /** The xp its attendee code gives, when the host made one. */
  attendeeXp: number | null;
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

/**
 * Attendee codes, for the Connection apps that hold events with guests: Party events, runs and circles. Before the
 * event starts its host sets how much xp it gives (up to ATTENDEE_XP_MAX) and makes a code, random or their own word.
 * On the day only the event's own guests can claim it, once each, inside the event's window (the run window), and
 * never the host. A run's code is its start code, which also pays the run's points.
 */
export const ATTENDEE_CODE_APPS = ['party', 'run', 'circles'] as const;
export type AttendeeCodeApp = (typeof ATTENDEE_CODE_APPS)[number];
/** The most xp a host can set for one event. */
export const ATTENDEE_XP_MAX = 50;
/** What an event gives when its host does not say. The same as a run always gave. */
export const ATTENDEE_XP_DEFAULT = 20;
/** Event codes (Party and Circles) that pay in any 24 hours. Runs keep their own cap, RUN_REWARD.perDay. */
export const ATTENDEE_CLAIMS_PER_DAY = 3;
export const ATTENDEE_CODE_MIN = 4;
export const ATTENDEE_CODE_MAX = 12;
/** A circle has a start and no end; for its code window it lasts this long. */
export const CIRCLE_MINUTES = 120;

/** A code as it is kept and compared: capitals and digits only, at most ATTENDEE_CODE_MAX. "sunday run!" is SUNDAYRUN. */
export const normalizeCode = (text: unknown): string => (typeof text === 'string' ? text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ATTENDEE_CODE_MAX) : '');
export function codeProblem(text: unknown): string | null {
  return normalizeCode(text).length < ATTENDEE_CODE_MIN ? `A code is ${ATTENDEE_CODE_MIN} to ${ATTENDEE_CODE_MAX} letters or numbers.` : null;
}
export function attendeeXpProblem(xp: unknown): string | null {
  return typeof xp === 'number' && Number.isInteger(xp) && xp >= 1 && xp <= ATTENDEE_XP_MAX ? null : `The xp is a whole number from 1 to ${ATTENDEE_XP_MAX}.`;
}
/**
 * The xp is fixed once the code opens, thirty minutes before the start: from then on a guest can claim it, so it
 * was promised to them. Before that the host can still change it.
 */
export const attendeeXpLocked = (startsAt: string, now: number = Date.now()): boolean => now >= Date.parse(startsAt) - RUN_CODE_WINDOW.before * 60_000;
/** When an event's code works: from RUN_CODE_WINDOW.before minutes before the start to RUN_CODE_WINDOW.after after the end. */
export function codeWindow(startsAt: string, endsAt: string): { opensAt: string; closesAt: string } {
  return { opensAt: new Date(Date.parse(startsAt) - RUN_CODE_WINDOW.before * 60_000).toISOString(), closesAt: new Date(Date.parse(endsAt) + RUN_CODE_WINDOW.after * 60_000).toISOString() };
}

/** What a guest sees: the xp, whether they claimed it, and when the code works. Never the code. */
export interface AttendeeCodeView {
  xp: number;
  claimed: boolean;
  /** Whether it works now, when this was read. The screen works it out again from the two times as the clock moves. */
  state: RunEntryState;
  opensAt: string;
  closesAt: string;
}
/** What the host (or staff) sees. Circles show counts only: their guests are aliases. */
export interface AttendeeCodeHost {
  code: string;
  xp: number;
  /** The xp is fixed: the code has opened. */
  locked: boolean;
  claims: number;
  guests: number;
  opensAt: string;
  closesAt: string;
}
/** One event in the admin's list of every attendee code. */
export interface AdminAttendeeCode {
  app: AttendeeCodeApp;
  thingId: string;
  title: string;
  hostName: string;
  startsAt: string;
  status: string;
  xp: number | null;
  code: string | null;
  locked: boolean;
  claims: number;
  guests: number;
}
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
  /** The xp a logged run pays, set by the host before it starts. */
  xp: number;
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
  page: Page;
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
  page: Page;
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
  /** The staff member named as this person's manager, once a reviewer picks one. */
  managerId: string | null;
  managerName: string | null;
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
  /** Pictures, GIFs and videos the owner added. The first picture is the card's cover. */
  media?: MediaItem[];
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
  minXp: number;
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
  /** An xp floor, on top of points and a badge. Zero means none. */
  minXp: number;
  badge: string;
  ok: boolean;
  /** Plain words for the lock, empty when open. */
  why: string;
}
export function badgeName(key: string): string {
  return BADGES.find((b) => b.key === key)?.name ?? HONORS.find((h) => h.key === key)?.name ?? key;
}
export const isBadgeKey = (key: string): boolean => BADGES.some((b) => b.key === key) || HONORS.some((h) => h.key === key);
/** The viewer, for the unlock rule. A super admin (role admin) is never locked out of anything. */
export interface UnlockHave {
  points: number;
  xp?: number;
  badges: readonly string[];
  superAdmin?: boolean;
}
const joinWords = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** The one unlock rule: the points balance and xp have to reach their floors, and the badge has to be held. A super admin always passes. */
export function unlockFor(ask: { minPoints: number; minXp?: number; badge: string }, have: UnlockHave | null): Unlock {
  const minXp = ask.minXp ?? 0;
  const needsPoints = ask.minPoints > 0;
  const needsXp = minXp > 0;
  const needsBadge = Boolean(ask.badge);
  const open = { minPoints: ask.minPoints, minXp, badge: ask.badge, ok: true, why: '' };
  if (!needsPoints && !needsXp && !needsBadge) return { ...open, minPoints: 0, minXp: 0, badge: '' };
  if (have?.superAdmin) return open;
  const asks = [needsXp ? `${minXp} xp` : '', needsPoints ? `${ask.minPoints} points` : '', needsBadge ? `the ${badgeName(ask.badge)} badge` : ''].filter(Boolean);
  if (!have) return { ...open, ok: false, why: `Sign in to open this. It asks for ${joinWords(asks)}.` };
  const short: string[] = [];
  if (needsXp && (have.xp ?? 0) < minXp) short.push(`${minXp} xp, you have ${have.xp ?? 0}`);
  if (needsPoints && have.points < ask.minPoints) short.push(`${ask.minPoints} points, you have ${have.points}`);
  if (needsBadge && !have.badges.includes(ask.badge)) short.push(`the ${badgeName(ask.badge)} badge`);
  return { ...open, ok: short.length === 0, why: short.length ? `Needs ${joinWords(short)}.` : '' };
}
/** What a locked button says: "Unlocks at 500 xp, 2000 points and the First tick badge". Empty when there is nothing to reach. */
export function unlockAt(u: Pick<Unlock, 'minPoints' | 'minXp' | 'badge'>): string {
  const asks = [u.minXp > 0 ? `${u.minXp} xp` : '', u.minPoints > 0 ? `${u.minPoints} points` : '', u.badge ? `the ${badgeName(u.badge)} badge` : ''].filter(Boolean);
  return asks.length ? `Unlocks at ${joinWords(asks)}` : '';
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
      { what: 'A run with a club', pays: `Up to ${ATTENDEE_XP_MAX} xp and ${RUN_REWARD.points} points`, how: `The host sets the xp before the code opens. Enter the start code during the run. Once per run, ${RUN_REWARD.perDay} runs a day.` },
      { what: 'Going to an event or a circle', pays: `Up to ${ATTENDEE_XP_MAX} xp`, how: `If the host set xp, type their attendee code at the event. Guests only, once each, ${ATTENDEE_CLAIMS_PER_DAY} in any 24 hours.` },
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
// Life coaches. The team makes someone a life coach (the coach permission, which a creator can hold, and the Life
// coach badge). A coach works only with students who said yes: they see the parts of a student's progress the
// student shares, leave notes, and add or edit tasks; every step lands in a change log both of them see. A link
// starts three ways: a coach (or an admin) asks and the student says yes, a student asks and the coach says yes, or
// an admin links the two. Either side can end it. The journal never reaches a coach.
// ---------------------------------------------------------------------------

/** The five parts of a student's progress a coach can see. Each is the student's own switch, on to start with. */
export const COACH_SHARE_PARTS = ['daily', 'pillars', 'routine', 'lifeMap', 'reflection'] as const;
export type CoachSharePart = (typeof COACH_SHARE_PARTS)[number];
export type CoachShare = Record<CoachSharePart, boolean>;
export const DEFAULT_COACH_SHARE: CoachShare = { daily: true, pillars: true, routine: true, lifeMap: true, reflection: true };
export const COACH_SHARE_META: Record<CoachSharePart, { name: string; blurb: string }> = {
  daily: { name: 'Daily and streaks', blurb: 'Check-ins, streaks, xp, the day’s tasks, the small act and your not to do list.' },
  pillars: { name: 'Pillars and pyramids', blurb: 'Every layer of your seven pyramids. With this on, your coach can add and edit tasks.' },
  routine: { name: 'Routine and contract', blurb: 'Your routine, the days you kept it, and the deal you signed.' },
  lifeMap: { name: 'Life map answers', blurb: 'Where each pillar sits on the map, your scores, your fears and what weighs on you.' },
  reflection: { name: 'Reflection', blurb: 'Wellbeing, mood, sleep, stress, mindful minutes and your saved reviews. Never your journal or tracker notes.' },
};
/** The one reader for what a student shares: known parts as true or false, over the defaults. */
export function parseCoachShare(raw: unknown): CoachShare {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw || '{}');
    } catch {
      v = {};
    }
  }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_COACH_SHARE };
  for (const k of COACH_SHARE_PARTS) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  return out;
}

/** Coaches a student can have at once, linked or asked. */
export const MAX_COACHES = 3;
/** Asks a coach can have waiting at once. */
export const MAX_COACH_ASKS = 20;
/** After a no, the same coach and student wait this long before either asks again. */
export const COACH_ASK_AGAIN_DAYS = 30;
export const COACH_NOTE_MAX = 1000;
export const COACH_ABOUT_MAX = 280;

export type CoachLinkStatus = 'pending' | 'active' | 'declined' | 'ended';
export type CoachAskedBy = 'coach' | 'student' | 'admin';

/** Someone on the other side of a link: a name, a handle and the badge. Never an email, a phone or a birthday. */
export interface CoachPerson {
  id: string;
  name: string;
  handle: string | null;
  badge: BadgeRole;
}

export interface CoachLink {
  id: string;
  coach: CoachPerson;
  student: CoachPerson;
  status: CoachLinkStatus;
  askedBy: CoachAskedBy;
  /** What the student shares with this coach. */
  share: CoachShare;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
}

export interface CoachNote {
  id: string;
  linkId: string;
  coachName: string;
  body: string;
  /** Written by the person reading it. */
  mine: boolean;
  createdAt: string;
}

export type CoachLogAction = 'link.ask' | 'link.yes' | 'link.no' | 'link.end' | 'link.admin' | 'share.change' | 'note.add' | 'note.remove' | 'task.add' | 'task.edit';
/** One line of the change log: who did what, in plain words, and when. */
export interface CoachLogEntry {
  id: string;
  action: CoachLogAction;
  label: string;
  actorName: string;
  coachName: string;
  studentName: string;
  createdAt: string;
}

/** One student on a coach's roster. Each number is there only when the student shares the part it comes from. */
export interface CoachRosterRow {
  linkId: string;
  student: CoachPerson;
  since: string;
  share: CoachShare;
  streak: number | null;
  lastCheckin: string | null;
  /** The routine's last seven days: kept, missed, or no record. */
  week: (boolean | null)[] | null;
  contractDays: number | null;
  /** Last week (Monday to Sunday) came in under the contract's days. */
  redWeek: boolean | null;
  focus: RelationshipKey[] | null;
}

export interface CoachProfile {
  about: string;
  /** Open to new students: the directory lists only open coaches. */
  open: boolean;
  /** Asked the team to be made a life coach, and still waiting. */
  askedAt: string | null;
}

/** The Coaching page for a coach: their profile, their students a page at a time, and the asks either way. */
export interface CoachHub {
  coach: boolean;
  profile: CoachProfile;
  /** How many students, asks to answer and asks still out, over every page. */
  counts: { students: number; asks: number; sent: number };
  students: CoachRosterRow[];
  studentsPage: Page;
  /** Students who asked this coach, a page at a time. */
  asks: CoachLink[];
  asksPage: Page;
  /** This coach's own asks and the team's, still waiting, a page at a time. */
  sent: CoachLink[];
  sentPage: Page;
}

export interface CoachDirectoryEntry {
  coach: CoachPerson;
  about: string;
  students: number;
  /** Where the viewer stands with this coach. */
  mine: CoachLinkStatus | null;
}

/** The student's side: their coaches and asks, and their coaches' notes a page at a time. */
export interface MyCoachResponse {
  links: CoachLink[];
  notes: CoachNote[];
  notesPage: Page;
}

/** A day of trackers for a coach: the numbers only, never a note. */
export interface CoachTrackerDay {
  date: string;
  mood: number | null;
  sleep: number | null;
  stress: number | null;
  mindful: number;
  move: number;
}

/** A coach's view of one student. Each part is null when the student does not share it. */
export interface CoachStudentView {
  link: CoachLink;
  /** The student's own today, from their zone. */
  date: string;
  daily: {
    streak: number;
    bestStreak: number;
    lastCheckin: string | null;
    checkedIn: boolean;
    xp: number;
    /** Days checked in, over the last thirty. */
    checkins: string[];
    /** Tasks ticked per day over the last thirty, oldest first. */
    tasksByDay: number[];
    tasks: Node[];
    done: Node[];
    /** Today's small act: done or not, and the pillar it was for once it is done. */
    smallAct: { relationship: RelationshipKey | null; done: boolean };
    notToDo: NotToDo[];
  } | null;
  pillars: { relationships: { key: RelationshipKey; xp: number }[]; nodes: Node[] } | null;
  routine: { general: RoutineBlock[]; exceptional: RoutineBlock[]; contract: Omit<Contract, 'signedName'> | null; today: RoutineDay | null; week: { done: number; days: (boolean | null)[] } } | null;
  lifeMap: Pick<Assessment, 'placements' | 'fears' | 'insecurities' | 'scores' | 'realDay' | 'focus' | 'createdAt'> | null;
  reflection: { wellbeing: WellbeingSummary; days: CoachTrackerDay[]; reviews: Review[]; reviewsPage: Page } | null;
  notes: CoachNote[];
  notesPage: Page;
  log: CoachLogEntry[];
  logPage: Page;
}

/** What a coach sends to add a task to a student's pyramid: under one of the student's projects. */
export interface CoachTaskInput {
  parentId: string;
  title: string;
  note?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  estimateMin?: number | null;
}

/** One link in the admin's list. */
export interface AdminCoachLink {
  id: string;
  coachId: string;
  coachName: string;
  studentId: string;
  studentName: string;
  status: CoachLinkStatus;
  askedBy: CoachAskedBy;
  createdAt: string;
  endedAt: string | null;
}

/** Someone who asked to be made a life coach, for the admin to say yes or no. */
export interface AdminCoachAsk {
  userId: string;
  name: string;
  email: string | null;
  handle: string | null;
  about: string;
  askedAt: string;
}

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
  'small act': 'One two-minute thing a day for your weakest pillar, picked for you.',
  'check-in': 'The first box on Daily. Ten xp, ten points, and it keeps your streak.',
  streak: 'Days in a row. A check-in streak pays extra every seventh day.',
  xp: 'Progress. It fills your level and your pillars. It is never spent.',
  points: 'Spendable. Earned by showing up and selling, spent on rewards and featured spots.',
  level: 'Where your xp has got you. Each level needs more than the last.',
  badge: 'Proof you did something, earned by the app\'s own count. It sits on your public page.',
  honor: 'A badge the team gives, or time unlocks.',
  ripple: 'Xp that runs up from a ticked task to every layer above it.',
  bumling: 'The app’s own guide. Bumling helps you set things up and runs the chats about the whole app, not one relationship.',
  'do date': 'The day you will do a task. It shows on Daily from that day, and cannot be ticked before it.',
  'due date': 'The day a task must be done by. After it the task says Overdue, but you can still tick it.',
  priority: 'A tag from P0 to P3 on a task. P0 is do now, P1 important, P2 normal and P3 whenever. It helps you choose and sort, and never changes what a tick pays.',
  habit: 'A task that repeats every day, week, month or year. When you tick it, the next one appears.',
  subtask: 'A small step inside a task. It has its own tick box, pays nothing, and never stops you ticking the task.',
  remember: 'A tag that sends a note to your inbox on the task’s day, at its time, or at nine in the morning if it has none.',
  'not scheduled': 'Tasks with no do date and no due date. They wait in a list under Tasks until you pick one.',
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
  credits: 'What typing to the assistant runs on. One credit is a tenth of a US cent of model use, so a typical message is about 12 credits. A plan gives credits each month; top-ups and team grants add more that do not run out.',
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
  { name: 'Daily and progress', terms: ['small act', 'check-in', 'daily three', 'do date', 'due date', 'priority', 'habit', 'subtask', 'remember', 'not scheduled', 'daily brief', 'not-to-do', 'kept day', 'streak', 'xp', 'points', 'level', 'who you are becoming', 'life score', 'five areas of life', 'period', 'review', 'season'] },
  { name: 'You and your page', terms: ['strength', 'personality type', 'love language', 'signs', 'human design', 'gate', 'channel', 'sidereal', 'numerology', 'master number', 'username', 'identity tag', 'setup chat', 'public page', 'badge', 'honor', 'trust', 'unlock'] },
  { name: 'Friends and community', terms: ['friend code', 'alias', 'circle', 'reaction', 'mention', 'guide', 'life coach', 'student', 'change log', 'run club', 'start code', 'attendee code', 'deck', 'focus mode', 'focus session'] },
  { name: 'Learn and earn', terms: ['cohort', 'campaign', 'bounty', 'Club', 'collab', 'giveaway'] },
  { name: 'Shop and store', terms: ['featured', 'partner link', 'pre-owned', 'kit', 'offer'] },
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
      'Typing spends credits: one credit is a tenth of a US cent of model use, and a typical message is about 12. Pro gives 10,000 credits a month, Pro Max 100,000 and Ultra 400,000. Each plan also caps what one message and one day can spend.',
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
  today: {
    steps: [
      'Daily is three boxes a day: check in, do the small act, tick one task. Checking in pays 10 xp and 10 points and keeps your streak; every seventh day in a row pays 50 points more. The small act is a two-minute thing for your weakest pillar and pays 15 xp. Your routine from the strategy session sits under the first box.',
      'Tasks come from the pillars you set up. Each pays 20 xp and sends a ripple up its pyramid. A task has a do date, the day you will do it, and can have a due date, the deadline. It shows here from its do date and cannot be ticked before it. After its due date it says Overdue, but you can still tick it. A new task waits ten minutes before it can be ticked.',
      'Tap the pencil on a task to plan it. Tag it P0 (do now), P1, P2 or P3 (whenever), in red, orange, purple and grey, and sort the list by day, priority or due date. Make it repeat every day, week, month or year, and the next one appears when you tick it; that makes it a habit. Add subtasks, say how many minutes it takes, tag it Remember for a note in your inbox on its day, and start a focus session on it.',
      'A task with no date waits under Not scheduled yet. It stays out of Tasks until you pick a do date or a due date, and then it moves up.',
      'Under the tasks, the not-to-do list holds up to seven things you are staying away from. Tick one to say you kept it today: a kept day pays 5 xp and grows that item’s streak. At the bottom, who you are becoming shows the figure your xp is filling in.',
    ],
    terms: ['daily three', 'check-in', 'small act', 'task', 'do date', 'due date', 'priority', 'habit', 'subtask', 'remember', 'not scheduled', 'not-to-do', 'kept day', 'who you are becoming', 'routine', 'assistant'],
  },
  tower: {
    steps: [
      'Pillars has its own setup, the strategy session, for whenever you want it: a few minutes that place all seven relationships on the map (where you usually live, where you drop under stress), score your health and wealth, and build a routine and a contract from your real day. Your life map, under Pillars, keeps every answer and can be run again. Or set up one pillar at a time with a short vibe check, three taps each.',
      'Each pillar is a pyramid with six layers. The foundation is the one thing you will not let break. The guiding principle is a line you live by so it holds. The value goal is how you want to feel more often. The goal outcome is what you would see when that is real. Then a project, and tasks at the tip.',
      'Your answers build the first four layers; you pick or write the project and its tasks. Tick a task on Daily and the glow runs up to the foundation: 20 xp for the task, then a smaller ripple to each layer above it. Clear every task in a project for 30 xp more.',
      'Every pillar has a level and a character that grows with it. The weakest pillar is the one that sends your small act.',
      'Open a pillar to see its pyramid, add tasks, give them dates and times, and archive what no longer fits.',
    ],
    terms: ['pillar', 'pyramid', 'foundation', 'guiding principle', 'value goal', 'goal outcome', 'project', 'task', 'ripple', 'strategy session', 'life map', 'core', 'floor', 'assistant'],
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
      'Badges are earned by the app’s own count: your first task, streaks, ten tasks, a cleared project, level five, small acts, the Club, and runs. Honors are given by the team or unlocked by time here.',
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
      'Members-only spaces come with memberships you buy from a creator’s shop.',
    ],
    terms: ['reaction', 'mention', 'xp', 'points', 'guide'],
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
      `Meet. If the host set xp, type the code shown at the meetup on your table page, once, from thirty minutes before to ${(CIRCLE_MINUTES + RUN_CODE_WINDOW.after) / 60} hours after the start. A weekly circle keeps its xp with a new code. Later, chat with your table under Bond, under aliases.`,
    ],
    terms: ['circle', 'alias', 'attendee code'],
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
      'Or work in focus sessions. The classic is 25 minutes of focus and a 5 minute mini break, four times, then a 30 minute long break. Change any length, how many sessions come before the long break, and how many times it runs, even while it runs. Point a session at one of your tasks. The clock keeps time even when the tab is in the background.',
      'The minutes log themselves when the timer ends. A finished break counts as mindful minutes, and a focus session counts only if you switch that on. A chart shows your focus time and tasks ticked by day, week or month.',
      'Sixty minutes a week scores full marks. The minutes count in Life twice: as breath under physical and as stillness under spiritual.',
      'The line shows thirty days.',
    ],
    terms: ['focus session'],
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
      'In danger, call your local emergency number.',
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

// ---------------------------------------------------------------------------
// Media: pictures, GIFs and videos on listings, lessons and events. Uploaded or linked.
// ---------------------------------------------------------------------------

export type MediaKind = 'image' | 'gif' | 'video';
export interface MediaItem {
  id: string;
  kind: MediaKind;
  /** An https link, or the app's own `/api/public/media/<id>` for a file that was uploaded. */
  url: string;
  caption: string;
}
/** Who can carry media: every public listing, and a lesson in School. */
export type MediaOwner = ListingType | 'lesson';
export const MEDIA_OWNERS: readonly MediaOwner[] = [...LISTING_TYPES, 'lesson'];
export const MAX_MEDIA_ITEMS = 8;
export const MAX_MEDIA_CAPTION = 120;
/** An upload is a picture or a GIF. The browser shrinks pictures first; videos are linked, never uploaded. */
export const MAX_UPLOAD_BYTES = 1_000_000;
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;
export const OWN_MEDIA_PREFIX = '/api/public/media/';

export interface MediaEmbed {
  /** `frame` is a player on another site; `file` is a video file the browser plays itself. */
  type: 'frame' | 'file';
  src: string;
}

/** A link taken apart, without needing the browser's URL: https only. */
function splitLink(raw: string): { host: string; path: string; query: Record<string, string> } | null {
  const m = /^https:\/\/([^/?#\s]+)([^?#\s]*)(?:\?([^#\s]*))?(?:#.*)?$/i.exec(raw.trim());
  if (!m) return null;
  const query: Record<string, string> = {};
  for (const pair of (m[3] ?? '').split('&')) {
    const [k, v = ''] = pair.split('=');
    if (k) query[k] = v;
  }
  const host = (m[1] ?? '').toLowerCase().replace(/:\d+$/, '').replace(/^(www|m)\./, '');
  return { host, path: m[2] ?? '', query };
}

/** How to play a video link: YouTube and Vimeo in their own player, a direct file in the browser's. */
export function videoEmbed(url: string): MediaEmbed | null {
  const u = splitLink(url);
  if (!u) return null;
  const parts = u.path.split('/').filter(Boolean);
  const yt = (id: string): MediaEmbed | null => (/^[\w-]{6,20}$/.test(id) ? { type: 'frame', src: `https://www.youtube-nocookie.com/embed/${id}` } : null);
  if (u.host === 'youtu.be') return yt(parts[0] ?? '');
  if (u.host === 'youtube.com' || u.host === 'youtube-nocookie.com') return yt(u.query.v ?? (['embed', 'shorts', 'live'].includes(parts[0] ?? '') ? (parts[1] ?? '') : ''));
  if (u.host === 'vimeo.com' || u.host === 'player.vimeo.com') {
    const id = parts.find((x) => /^\d{5,}$/.test(x)) ?? '';
    return id ? { type: 'frame', src: `https://player.vimeo.com/video/${id}` } : null;
  }
  return /\.(mp4|webm|mov|m4v)$/i.test(u.path) ? { type: 'file', src: url.trim() } : null;
}

/** What a pasted link is: a video we can play, a GIF, or a picture. Null when it is none of them. */
export function mediaFromLink(raw: string): { kind: MediaKind; url: string } | null {
  const url = raw.trim().slice(0, 500);
  if (url.startsWith(OWN_MEDIA_PREFIX)) return { kind: 'image', url };
  const u = splitLink(url);
  if (!u) return null;
  if (videoEmbed(url)) return { kind: 'video', url };
  return { kind: /\.gif$/i.test(u.path) ? 'gif' : 'image', url };
}

/** Where a guest can get their pictures after an event: a shared folder on one of these. */
export const PHOTO_HOSTS = ['drive.google.com', 'photos.google.com', 'photos.app.goo.gl', 'dropbox.com', 'icloud.com', '1drv.ms', 'onedrive.live.com', 'wetransfer.com', 'we.tl'] as const;
export function photoLinkProblem(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return 'Paste the link to your photo folder.';
  const u = splitLink(raw);
  if (!u) return 'Use a link that starts with https.';
  return PHOTO_HOSTS.some((h) => u.host === h || u.host.endsWith(`.${h}`)) ? null : 'Use a Google Drive, Google Photos, Dropbox, iCloud, OneDrive or WeTransfer link.';
}

/** The events that carry a photo link, a conversation and a list of people to connect with. Circles keep their own anonymous tables. */
export type EventApp = 'party' | 'run';
export const EVENT_APPS: readonly EventApp[] = ['party', 'run'];
export const MAX_EVENT_MESSAGE = 500;

export interface EventPhotos {
  url: string;
  note: string;
}
export interface EventMessage {
  id: string;
  /** Empty for a line written anonymously. */
  userId: string;
  anonymous: boolean;
  parentId: string | null;
  depth: number;
  name: string;
  handle: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
  /** The host's own lines wear a tag. */
  host: boolean;
}
export interface EventPerson {
  userId: string;
  name: string;
  handle: string | null;
  /** none, sent (you asked), pending (they asked you), friends. */
  friend: 'none' | 'sent' | 'pending' | 'friends';
}
/** What the event page shows beyond the event itself, for a guest, the host and staff. */
export interface EventExtras {
  /** Host, staff or a guest: who may read the conversation and the photos. */
  role: 'host' | 'guest';
  started: boolean;
  ended: boolean;
  photos: EventPhotos | null;
  messages: EventMessage[];
  /** Guests who said yes to meeting others, and allow friend requests. */
  people: EventPerson[];
  /** Whether the person is on that list themselves. */
  iAmListed: boolean;
}

/** Who may do what to another member in Community. A rank, not a switch: nobody acts on an equal or a higher rank. */
export const COMMUNITY_RANKS = { member: 0, guide: 1, staff: 2, admin: 3 } as const;
export type CommunityRank = keyof typeof COMMUNITY_RANKS;
export const communityRankOf = (u: { role: Role; permissions: readonly string[] }): CommunityRank =>
  u.role === 'admin' ? 'admin' : u.role === 'sub_admin' ? 'staff' : u.permissions.includes('moderation') ? 'guide' : 'member';
/** Muting someone from Community: a guide or above, and only someone of a lower rank. */
export const canMute = (actor: CommunityRank, target: CommunityRank): boolean => COMMUNITY_RANKS[actor] >= COMMUNITY_RANKS.guide && COMMUNITY_RANKS[actor] > COMMUNITY_RANKS[target];

export interface BlockedPerson {
  userId: string;
  name: string;
  handle: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Water and reminders, for Daily and Journal. A bubble on a laptop, a section on a phone; never a floating button on a phone.
// ---------------------------------------------------------------------------

export const WATER_EVERY_CHOICES = [30, 45, 60, 90, 120, 180] as const;
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
  on: boolean;
  everyMin: number;
  from: string;
  to: string;
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
export interface RemindersResponse {
  water: WaterState;
  custom: CustomReminder[];
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
  { q: 'What are the seven pillars?', a: 'The seven relationships that make a life, one pillar each. Each pillar has a pyramid: a foundation at the top, then a guiding principle, a value goal, a goal outcome, a project, and tasks at the point at the bottom. Tick a task and its xp runs up through every layer above it.' },
  { q: 'What is a small act?', a: 'One quick thing for your weakest pillar, picked for you each day. It takes two minutes and pays fifteen xp.' },
  { q: 'Why can I not tick a task yet?', a: 'A task needs ten minutes after being written or renamed before it can be ticked, and it cannot be ticked before its do date. Only six ticks a day pay xp; the rest still count as done.' },
  { q: 'What is the difference between a do date and a due date?', a: 'The do date is the day you will do the task. It shows on Daily from that day and cannot be ticked before it. The due date is the deadline. After it the task says Overdue, but you can still tick it. The do date cannot come after the due date.' },
  { q: 'What do P0, P1, P2 and P3 mean?', a: 'They are priority tags. P0 (red) is do now, P1 (orange) is important, P2 (purple) is normal and P3 (grey) is whenever. Pick one on a task, then sort Daily by priority. A tag never changes what a tick pays.' },
  { q: 'How do I make a task repeat?', a: 'Tap the pencil on a task and pick Repeat: every day, on weekdays, every week on days you choose, every month or every year, every one or more of them, with an end day if you like. It needs a do date or a due date. When you tick it, the next one is made. A repeating task shows a Habit tag.' },
  { q: 'Where did my task with no date go?', a: 'Under Not scheduled yet, below Tasks on Daily. It stays there until you pick a do date or a due date. Then it moves up into Tasks on that day.' },
  { q: 'What are subtasks, and what does Remember do?', a: 'Subtasks are a small checklist inside a task. They pay no xp. Remember sends a note to your inbox on the task’s day, at its time (9:00 when it has none). Tasks the strategy session made for you carry a From pillar tag, and tasks that repeat carry a Habit tag.' },
  { q: 'How do I focus on one task?', a: 'Tap the pencil on a task, add how many minutes it takes, then tap Start focus. Mindful minutes opens with that task picked and that many minutes on the timer. The Focus dashboard there can show your time in minutes or hours.' },
  { q: 'Points versus xp?', a: 'Xp levels you and your pillars up. Points come from showing up. You can trade points for rewards, for things people sell, and for events.' },
  { q: 'How do I sell something?', a: 'Switch Shop on from Apps. Make a product, publish it, and share your Profile page.' },
  { q: 'How do I get work?', a: 'Work lists opportunities from brands and the team. Apply once per opportunity and follow its status in Work.' },
  { q: 'Is the Companion a therapist?', a: 'No. It reflects and asks questions. If you are in danger, contact your local emergency number. In India, Tele-MANAS is 14416.' },
  { q: 'Who can see my journal?', a: 'Only you. Journal entries and wellbeing scores are never shown to brands, staff, the leaderboard or Club selection.' },
  { q: 'What are Games?', a: 'Nine card games you unlock once with points in Rewards, then play in the app. You shuffle, draw, flip and drag cards around a table. Nothing is posted to you. Games switches on when you unlock your first one.' },
  { q: 'What is focus mode?', a: 'On a game table, the icon with four corner brackets hides the menu, the assistant and everything else, so the table has the whole screen. Press Escape or tap the icon again to leave.' },
  { q: 'What is Discover?', a: 'A quiz about how you think, feel and act, with puzzles and real situations. It shows your top strengths across the seven relationships, a detailed read on five personality traits and on your reasoning, and, if you add it, your emotional intelligence. It is a self-check, not an IQ test or a diagnosis.' },
  { q: 'What are the type, love languages and mind self-checks in Discover?', a: 'Three short self-checks under More ways to know yourself. 16 personality types, in the style of Myers-Briggs (MBTI), gives four letters out of sixteen, with what each side means for you. Love languages shows how you like to be shown love and how you show it, which can differ. How your mind works shows how often attention, energy and impulse, and patterns and senses show up for you. It is not a test for ADHD or autism, and only a trained professional can say what is going on.' },
  { q: 'What is Human design in Discover, and how exact is it?', a: 'Human design is a system for self-reflection, not science. Enter your birth date, time and the time zone of your birthplace. The app works out where thirteen bodies stood at your birth and when the Sun stood 88 degrees earlier, then shows your type, strategy, authority, profile and channels, in the tropical zodiac and in the sidereal one (Fagan-Bradley), in three layers: body, mind and purpose. Positions are good to a few arc minutes, a little less for the outer planets, and a line that sits right on an edge is marked. Each part of the reading becomes a goal you can add as a task.' },
  { q: 'How many devices can I use at once?', a: 'Three. Your account can be signed in on three devices at the same time, such as a phone, a laptop and a tablet. When you sign in on a fourth, the one that has been signed in the longest is signed out to make room, and it tells you why when you open it. Your progress is kept on your account, so signing in again brings everything back. Changing your password signs out every other device at once.' },
  { q: 'What does numerology in Discover work out?', a: 'It sits beside the body, mind and purpose layers of Human design. From your birth date it gives your life path, birthday number and attitude. From the full name on your birth record it adds your expression, soul urge, personality and maturity, and the numbers your name is missing. It shows where you are in your personal year, month and day, keeps the master numbers 11, 22 and 33 whole, and points out the turning point 10 and the karmic numbers 13, 14, 16 and 19. Then it sets your numbers next to your Discover answers: where they agree, where they stretch you, and how they fit your Human design. Numerology is a system for reflection, not science.' },
  { q: 'How much will a reward pay me?', a: 'Open the reward and use What could I earn. Type the number of views your post might get and it shows the points. Nothing is paid under the minimum views, a post stops earning at the most one post can pay, and a reviewer must confirm the views first. The pool also has to have points left.' },
  { q: 'Can I answer buyers’ questions on my product page?', a: 'Yes. In the product editor, add up to six questions and answers, such as who it is for and how long it takes. They show as a fold-out list at the foot of the page.' },
  { q: 'What is the line of the day on Home?', a: 'One line under Water and reminders, from a philosopher or written for this app, in turn. It changes every day, and every line is shown once before any comes back, which takes about a year. Nothing is saved about you, and the same day shows the same line to everyone.' },
  { q: 'Who sees my Discover results?', a: 'Only you. They never reach brands, staff, the leaderboard or a life coach. You choose whether they shape your next steps on Home, and whether the assistant may read a short summary. You can delete a result any time.' },
  { q: 'Why are my apps in this order?', a: 'Lists put the apps that matter most to you first: the ones that are on, then the ones that fit what you told the setup chat, then the ones you open most on this device. The order catches up the next time you open the app.' },
  { q: 'Where is the water button?', a: 'On a laptop, a small Water bubble sits at the left of Daily and Journal, and a Water button sits above a game table. On a phone, the Water section is inside Home, Daily and Journal.' },
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

// ---------------------------------------------------------------------------
// The daily brief, after Circle's: three signals (what changed) and three next steps (what to do about it), worked
// out by rules from the person's own numbers, so it costs no credits and says nothing it cannot back. Coaches get
// lines about their students, and the team lines about what waits for them.
// ---------------------------------------------------------------------------

export type BriefTone = 'good' | 'watch' | 'neutral';
export interface BriefLine {
  key: string;
  text: string;
  /** Where to act on it, an in-app path. */
  to: string | null;
  tone: BriefTone;
}
export interface DailyBrief {
  signals: BriefLine[];
  actions: BriefLine[];
  /** For a life coach: their students. Null for everyone else. */
  coach: BriefLine[] | null;
  /** For staff and admins: what waits for the team. Null for everyone else. */
  team: BriefLine[] | null;
}

/** What the brief is worked out from: the person's own numbers for their own today. */
export interface BriefFacts {
  hour: number;
  checkedIn: boolean;
  streak: number;
  bestStreak: number;
  level: number;
  xpToNext: number;
  tasksDue: number;
  tasksOverdue: number;
  doneWeek: number;
  doneWeekBefore: number;
  smallActDone: boolean;
  notToDoSlipped: number;
  /** Routine days kept in the last seven, and the contract's days, when there is a routine. */
  routineWeek: number | null;
  contractDays: number | null;
  sleepAvg: number | null;
  sleepAvgBefore: number | null;
  moodAvg: number | null;
  moodAvgBefore: number | null;
  stressAvg: number | null;
  /** The next event someone signed up for in the next two days. */
  nextEvent: { title: string; when: string; to: string } | null;
  coachNotes: number;
  coachAsks: number;
  reviewDue: boolean;
  /** The apps that are on, so a step never points at one that is off. */
  apps: readonly string[];
  /** What Discover taught the app, when the person took it and allows next steps to use it. profile is null when they have not, or switched it off. */
  discover?: { taken: boolean; profile: DiscoverProfile | null; extras?: ExtrasProfile | null };
}

const BRIEF_SIZE = 3;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const one1 = (n: number) => Math.round(n * 10) / 10;

/** The one rule for the brief: every line that applies, ranked, the top three of each. */
export function briefFor(f: BriefFacts): { signals: BriefLine[]; actions: BriefLine[] } {
  const on = (app: string) => f.apps.includes(app);
  const signals: (BriefLine & { rank: number })[] = [];
  const actions: (BriefLine & { rank: number })[] = [];
  const sig = (rank: number, key: string, tone: BriefTone, text: string, to: string | null) => signals.push({ rank, key, tone, text, to });
  const act = (rank: number, key: string, text: string, to: string | null) => actions.push({ rank, key, tone: 'neutral', text, to });

  if (!f.checkedIn && f.streak >= 3 && f.hour >= 17) sig(100, 'streak-risk', 'watch', `Your ${f.streak}-day streak ends tonight unless you check in.`, '/today');
  else if (f.checkedIn && f.streak >= 3 && f.streak >= f.bestStreak) sig(70, 'streak-best', 'good', `A new best: ${plural(f.streak, 'day')} in a row.`, '/today');
  else if (f.streak >= 3) sig(40, 'streak', 'good', `${plural(f.streak, 'day')} in a row so far.`, '/today');
  if (f.tasksOverdue > 0) sig(90, 'overdue', 'watch', `${plural(f.tasksOverdue, 'task')} ${f.tasksOverdue === 1 ? 'is' : 'are'} past ${f.tasksOverdue === 1 ? 'its' : 'their'} day.`, '/tower');
  if (f.doneWeekBefore > 0 && f.doneWeek > f.doneWeekBefore) sig(60, 'tasks-up', 'good', `${plural(f.doneWeek, 'task')} ticked these seven days, ${f.doneWeek - f.doneWeekBefore} more than the seven before.`, '/today');
  else if (f.doneWeekBefore > 0 && f.doneWeek < f.doneWeekBefore) sig(65, 'tasks-down', 'watch', `${plural(f.doneWeek, 'task')} ticked these seven days, ${f.doneWeekBefore - f.doneWeek} fewer than the seven before.`, '/today');
  if (f.sleepAvg !== null && f.sleepAvgBefore !== null && Math.abs(f.sleepAvg - f.sleepAvgBefore) >= 0.5)
    sig(f.sleepAvg < f.sleepAvgBefore ? 80 : 50, 'sleep', f.sleepAvg < f.sleepAvgBefore ? 'watch' : 'good', `Sleep is ${f.sleepAvg < f.sleepAvgBefore ? 'down' : 'up'} to ${one1(f.sleepAvg)} hours a night, from ${one1(f.sleepAvgBefore)}.`, on('sleep') ? '/sleep' : null);
  if (f.moodAvg !== null && f.moodAvgBefore !== null && Math.abs(f.moodAvg - f.moodAvgBefore) >= 0.5)
    sig(f.moodAvg < f.moodAvgBefore ? 75 : 45, 'mood', f.moodAvg < f.moodAvgBefore ? 'watch' : 'good', `Your mood is ${f.moodAvg < f.moodAvgBefore ? 'lower' : 'brighter'} this week than last.`, on('mood') ? '/mood' : null);
  if (f.stressAvg !== null && f.stressAvg >= 4) sig(85, 'stress', 'watch', 'Stress has been high most of this week.', on('stress') ? '/stress' : null);
  if (f.notToDoSlipped > 0) sig(55, 'slipped', 'watch', `You slipped on ${plural(f.notToDoSlipped, 'not to do item')} yesterday. Today is a fresh start.`, '/today');
  if (f.routineWeek !== null && f.contractDays !== null)
    sig(f.routineWeek < f.contractDays ? 58 : 35, 'routine', f.routineWeek < f.contractDays ? 'watch' : 'good', `Your routine: ${f.routineWeek} of the last 7 days, against a deal of ${f.contractDays}.`, '/today');
  if (f.nextEvent) sig(68, 'event', 'neutral', `${f.nextEvent.title} is ${f.nextEvent.when}.`, f.nextEvent.to);
  if (f.coachNotes > 0) sig(72, 'coach-note', 'neutral', f.coachNotes === 1 ? 'Your life coach left you a note.' : `Your life coach left you ${f.coachNotes} notes.`, '/coaching');
  if (f.coachAsks > 0) sig(74, 'coach-ask', 'neutral', f.coachAsks === 1 ? 'A life coach asked to work with you.' : `${f.coachAsks} life coaches asked to work with you.`, '/you#coach');
  sig(10, 'level', 'neutral', `Level ${f.level}. ${f.xpToNext} xp to the next one.`, '/you');

  if (!f.checkedIn) act(100, 'checkin', 'Check in on Daily. It keeps your streak.', '/today');
  if (f.tasksDue > 0) act(90, 'task', f.tasksDue === 1 ? 'Tick today’s task.' : `Tick one of today’s ${f.tasksDue} tasks.`, '/today');
  if (!f.smallActDone) act(80, 'act', 'Do today’s small act. It takes a minute.', '/today');
  if (f.coachAsks > 0) act(88, 'coach-ask', 'Answer the coach who asked: yes or no, on your Profile tab.', '/you#coach');
  if (f.coachNotes > 0 && on('coaching')) act(76, 'coach-note', 'Read your coach’s note.', '/coaching');
  if (f.tasksOverdue > 0) act(70, 'overdue', 'Move or finish the tasks past their day.', '/tower');
  if (f.reviewDue && on('reviews')) act(65, 'review', 'Write last week’s review. Five minutes, and the numbers are filled in.', '/reviews');
  if (f.stressAvg !== null && f.stressAvg >= 4 && on('mindful')) act(72, 'breathe', 'Take five minutes with the breathing timer.', '/mindful');
  if (f.sleepAvg !== null && f.sleepAvgBefore !== null && f.sleepAvg < f.sleepAvgBefore - 0.5 && on('sleep')) act(60, 'sleep', 'Log tonight’s sleep, and aim for lights out on time.', '/sleep');
  if (f.nextEvent) act(55, 'event', `Check the plan for ${f.nextEvent.title}.`, f.nextEvent.to);
  // Next steps that emerge from what Discover learned about this person: their quietest strength, and the shape of their traits.
  const d = f.discover;
  if (d && !d.taken && on('discover')) act(48, 'discover', 'Take the Discover quiz: puzzles, personality and strengths. Your next steps get personal.', '/discover');
  if (d?.profile) {
    const p = d.profile;
    const grow = DISCOVER_STRENGTHS[p.growth];
    act(58, 'strength-grow', `Your quietest strength is ${grow.name}. ${grow.tryThis}`, STRENGTH_PATH[p.growth]);
    if (p.bands.c === 'low') act(66, 'style-small', 'Pick one task and finish only that today. Small and done beats big and open.', '/today');
    if (p.bands.s === 'low' && on('mindful')) act(64, 'style-calm', 'Take two minutes with the breathing timer before your hardest task.', '/mindful');
    if (p.bands.e === 'high') act(52, 'style-people', 'Do one step with another person today: a friend, a circle or a run.', on('circles') ? '/circles' : null);
    if (p.bands.o === 'high') act(50, 'style-new', 'Try one new thing in your pillars today, even a small one.', '/tower');
    if (p.eq?.a === 'low' && on('journal')) act(54, 'eq-name', 'Write one line about how you feel right now and what set it off.', '/journal');
    if (p.eq?.m === 'low' && on('mindful')) act(63, 'eq-calm', 'Before you answer a message that stung, take five slow breaths.', '/mindful');
    if (p.eq?.e === 'low') act(51, 'eq-ask', 'Ask one person how they are today, then listen without fixing.', null);
    sig(30, 'strength', 'good', `Your strongest strength is ${DISCOVER_STRENGTHS[p.top[0]!].name}. Use it today.`, STRENGTH_PATH[p.top[0]!]);
  }
  // And from the self-checks: the four letters of a type, how they give and receive love, and (only when they switched it on) how their mind works.
  const x = d?.extras;
  if (x) {
    if (x.type?.includes('I')) act(49, 'type-quiet', 'Block one quiet hour for your hardest task, with no messages.', '/today');
    if (x.type?.includes('J')) act(47, 'type-plan', 'Plan tomorrow’s three tasks tonight, so you can relax.', '/today');
    if (x.type?.includes('P')) act(47, 'type-finish', 'Pick one task and give it a finish time. Open days need one fixed point.', '/today');
    if (x.type?.includes('N')) act(46, 'type-steps', 'Turn one big idea into three small steps in Pillars.', '/tower');
    if (x.design) act(48, 'design-strategy', `Today’s practice from your Human design: ${DESIGN_TYPES[x.design.type].strategy.charAt(0).toLowerCase()}${DESIGN_TYPES[x.design.type].strategy.slice(1)}.`, '/discover?more=design');
    if (x.love) {
      const give = x.love.give[0]!;
      const GIVE: Record<LoveKey, string> = {
        words: 'Send one kind message to someone today and say what you like about them.',
        time: 'Give one person ten minutes of full attention today, phone away.',
        gifts: 'Do one small kind thing for someone: a note, a treat or a photo that made you think of them.',
        acts: 'Do one favour for someone today without being asked.',
        touch: 'Give someone a hug today, if they like those.',
      };
      act(45, 'love-give', GIVE[give], null);
      if (!x.love.receive.some((k) => x.love!.give.includes(k))) act(44, 'love-ask', `Tell one person how you feel most cared for: ${LOVE_LANGUAGES[x.love.receive[0]!].name.toLowerCase()}. They cannot guess it.`, null);
    }
    if (x.mind) {
      if (x.mind.att !== 'few') act(62, 'mind-att', 'Break one task into three subtasks, then run one 15 minute focus round on the first.', on('mindful') ? '/mindful' : '/today');
      if (x.mind.ene !== 'few') act(53, 'mind-ene', 'Stand up and move for two minutes before a long task.', null);
      if (x.mind.pat !== 'few') act(53, 'mind-pat', 'Plan tomorrow tonight, so a change of plan feels smaller.', '/today');
    }
  }
  act(20, 'pillar', 'Add a task to the pillar you want to grow.', '/tower');
  if (on('journal')) act(15, 'journal', 'Write one line in your journal about today.', '/journal');

  const top = (xs: (BriefLine & { rank: number })[]) =>
    xs
      .sort((a, b) => b.rank - a.rank)
      .slice(0, BRIEF_SIZE)
      .map(({ rank: _r, ...line }) => line);
  return { signals: top(signals), actions: top(actions) };
}

// ---------------------------------------------------------------------------
// Getting started: a short list on Home for the first two weeks, ticked by what the person actually does, never by
// a tap on the list. It pays nothing; it points the way. It folds away once every item is done, after two weeks, or
// when the person folds it.
// ---------------------------------------------------------------------------

export const GETTING_STARTED = [
  { key: 'checkin', label: 'Check in on Daily', to: '/today' },
  { key: 'task', label: 'Tick your first task', to: '/today' },
  { key: 'act', label: 'Do a small act', to: '/today' },
  { key: 'interests', label: 'Pick two interests', to: '/profile#interests' },
  { key: 'handle', label: 'Choose your username', to: '/profile' },
  { key: 'people', label: 'Join a circle, an event or a run club', to: '/apps' },
  { key: 'session', label: 'Take the strategy session', to: '/session' },
] as const;
export type GettingStartedKey = (typeof GETTING_STARTED)[number]['key'];
export const GETTING_STARTED_DAYS = 14;
export interface GettingStarted {
  items: { key: GettingStartedKey; label: string; to: string; done: boolean }[];
  done: number;
  /** Shown while some item is open and the account is under GETTING_STARTED_DAYS old. */
  show: boolean;
  /** The person folded it into the small toggle. It stays one tap from open again. */
  folded: boolean;
}
export function gettingStarted(done: Partial<Record<GettingStartedKey, boolean>>, ageDays: number, folded: boolean): GettingStarted {
  const items = GETTING_STARTED.map((g) => ({ key: g.key, label: g.label, to: g.to, done: Boolean(done[g.key]) }));
  const n = items.filter((i) => i.done).length;
  return { items, done: n, show: ageDays < GETTING_STARTED_DAYS && n < items.length, folded };
}

/** "Good morning", by the local hour. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ---------------------------------------------------------------------------
// Setup: the first chat. Who you are (identity tags, made as you answer, in your own words when no tag
// fits), what you came for, and what gets in the way. The apps that fit are matched from the whole
// combination, never one answer at a time: every answer weighs the apps, pairs of answers that belong
// together weigh more, and every app that comes on says why, in words built from your own answers. The
// strategy session is the pillars' own onboarding, inside Pillars, offered here when the answers ask for it.
// ---------------------------------------------------------------------------

export type IdentityKind = 'role' | 'craft' | 'service' | 'stage' | 'life';

/** Something the setup can tag you as. A known tag carries what it adds to the profile and how well each app fits. */
export interface IdentityOption {
  key: string;
  /** The tag as it shows: Student, Video editor. */
  label: string;
  emoji: string;
  kind: IdentityKind;
  /** The line under it on its card. */
  blurb: string;
  /** How a reason says it, after "because": "you are studying". */
  because: string;
  /** Typed words that tag it: lower case, whole words or phrases. */
  words: readonly string[];
  skill?: (typeof SKILLS)[number];
  interest?: Interest;
  focus?: (typeof FOCUS_OPTIONS)[number];
  level?: (typeof EXPERIENCE_LEVELS)[number];
  /** How well each app fits this tag, 1 to 3. */
  apps: Readonly<Record<string, number>>;
}

export const IDENTITIES: readonly IdentityOption[] = [
  // Who you are right now: the first card.
  { key: 'creator', label: 'Creator', emoji: '🎬', kind: 'role', blurb: 'I make content', because: 'you make content', words: ['creator', 'content creator', 'influencer', 'youtuber', 'instagrammer', 'vlogger', 'make content', 'create content', 'post content', 'make videos', 'my channel', 'my page', 'my followers', 'my subscribers'], focus: 'Creating', apps: { profile: 2, army: 2, win: 2, work: 1, content: 1, tools: 1 } },
  { key: 'freelancer', label: 'Freelancer', emoji: '🧳', kind: 'role', blurb: 'I freelance for clients', because: 'you make things for clients', words: ['freelance', 'freelancer', 'freelancing', 'clients', 'my clients', 'client work', 'fiverr', 'upwork', 'agency'], focus: 'Creating', apps: { work: 3, profile: 2, army: 1, finance: 1 } },
  { key: 'student', label: 'Student', emoji: '🎓', kind: 'role', blurb: "I'm a student", because: 'you are studying', words: ['student', 'studying', 'college', 'university', 'uni', 'school', 'exams', 'semester', 'degree', 'final year', 'class 12'], focus: 'Study', apps: { school: 3, work: 1, knowledge: 1, circles: 1 } },
  { key: 'employee', label: 'Employee', emoji: '💼', kind: 'role', blurb: 'I have a job', because: 'you have a job', words: ['my job', 'day job', 'full time job', 'i have a job', 'office', 'employee', 'corporate', 'salaried', 'working professional', '9 to 5', '9-5', 'nine to five', 'i work at', 'i work in'], focus: 'Work', apps: { reviews: 2, finance: 2, journal: 1, school: 1 } },
  { key: 'founder', label: 'Founder', emoji: '🚀', kind: 'role', blurb: 'I run a business', because: 'you run a business', words: ['founder', 'co-founder', 'cofounder', 'my business', 'own business', 'small business', 'startup', 'my brand', 'brand owner', 'business owner', 'shop owner', 'store owner', 'entrepreneur', 'my shop', 'my store', 'my company', 'run a business', 'run a brand', 'run a company', 'run a shop', 'run a store', 'run a startup', 'run a small', 'own a business', 'own a shop', 'own brand', 'd2c'], focus: 'Business', apps: { shop: 2, finance: 3, audience: 2, content: 2, automations: 1 } },
  { key: 'explorer', label: 'Explorer', emoji: '🧭', kind: 'role', blurb: "I'm between things", because: 'you are working out what is next', words: ['between jobs', 'unemployed', 'jobless', 'gap year', 'figuring out', 'figuring it out', 'career change', 'quit my job', 'looking for a job', 'looking for work', 'fresh start', 'what is next'], focus: 'Other', apps: { work: 3, school: 2, knowledge: 1, journal: 1 } },
  { key: 'coach', label: 'Life coach', emoji: '🎯', kind: 'role', blurb: "I'm a life coach", because: 'you coach people', words: ["i'm a life coach", 'i am a life coach', 'im a life coach', "i'm a coach", 'i am a coach', 'im a coach', 'work as a coach', 'work as a life coach', 'certified coach', 'certified life coach', 'i coach people', 'coach for a living'], focus: 'Work', apps: { coaching: 3, shop: 2, profile: 1 } },
  { key: 'parent', label: 'Parent or carer', emoji: '👪', kind: 'role', blurb: 'I look after family', because: 'you look after family', words: ['parent', 'mom', 'mum', 'mother', 'dad', 'father', 'my kids', 'my son', 'my daughter', 'children', 'my baby', 'carer', 'caregiver', 'looking after'], focus: 'Family', interest: 'Parenting', apps: { sleep: 2, stress: 2, journal: 1, mood: 1, finance: 1 } },
  // What a creator makes.
  { key: 'short_video', label: 'Short-form creator', emoji: '📱', kind: 'craft', blurb: 'Reels and Shorts', because: 'you make short videos', words: ['reels', 'reel', 'shorts', 'tiktok', 'tiktoks', 'short videos', 'short form', 'short-form'], interest: 'Video', apps: { win: 2, army: 1, content: 1, automations: 1 } },
  { key: 'long_video', label: 'Video creator', emoji: '🎥', kind: 'craft', blurb: 'YouTube videos', because: 'you make long videos', words: ['youtube', 'youtuber', 'long videos', 'long form', 'long-form', 'vlog', 'vlogs', 'documentary', 'documentaries'], interest: 'Video', apps: { content: 2, win: 1, army: 1, tools: 1, tv: 1 } },
  { key: 'photo', label: 'Photographer', emoji: '📷', kind: 'craft', blurb: 'Photos', because: 'you take photos', words: ['photo', 'photos', 'photography', 'photographer', 'carousels'], skill: 'Photography', interest: 'Photography', apps: { work: 2, store: 1, shop: 1 } },
  { key: 'podcast', label: 'Podcaster', emoji: '🎙️', kind: 'craft', blurb: 'Podcasts', because: 'you make a podcast', words: ['podcast', 'podcasts', 'podcaster', 'talk show'], skill: 'Interviewing', interest: 'Podcasting', apps: { tv: 2, content: 1, tools: 1 } },
  { key: 'writing', label: 'Writer', emoji: '✍️', kind: 'craft', blurb: 'Writing', because: 'you write', words: ['writer', 'writing', 'blog', 'blogger', 'newsletter', 'threads', 'articles', 'substack'], skill: 'Writing', interest: 'Writing', apps: { content: 2, knowledge: 1 } },
  { key: 'music', label: 'Musician', emoji: '🎵', kind: 'craft', blurb: 'Music', because: 'you make music', words: ['music', 'musician', 'singer', 'rapper', 'music producer', 'beats', 'songs', 'covers', 'my band'], interest: 'Music making', apps: { party: 2, shop: 1 } },
  { key: 'stream', label: 'Streamer', emoji: '🎮', kind: 'craft', blurb: 'Live streams', because: 'you stream', words: ['stream', 'streams', 'streaming', 'streamer', 'twitch', 'live stream', 'go live'], skill: 'Live streaming', interest: 'Gaming', apps: { audience: 2, community: 1, tools: 1 } },
  { key: 'teach', label: 'Educator', emoji: '🧑‍🏫', kind: 'craft', blurb: 'Courses or lessons', because: 'you teach', words: ['teach', 'teacher', 'teaching', 'tutor', 'tutoring', 'coaching', 'online course', 'courses', 'lessons', 'workshops'], skill: 'Teaching', interest: 'Education', apps: { shop: 2, audience: 1, school: 1 } },
  // What a freelancer does for others.
  { key: 'editor', label: 'Video editor', emoji: '✂️', kind: 'service', blurb: 'Editing', because: 'you edit', words: ['edit', 'edits', 'editing', 'editor', 'video editor', 'premiere', 'premiere pro', 'davinci', 'resolve', 'capcut', 'final cut', 'after effects'], skill: 'Editing', interest: 'Video', apps: { work: 2, school: 2, tools: 1, army: 1 } },
  { key: 'shooter', label: 'Videographer', emoji: '📹', kind: 'service', blurb: 'Shooting', because: 'you shoot', words: ['videographer', 'shoot', 'shooting', 'cinematographer', 'camera operator', 'dop', 'filming', 'filmmaker'], skill: 'Videography', interest: 'Film making', apps: { work: 2, store: 2, army: 1 } },
  { key: 'designer', label: 'Designer', emoji: '🎨', kind: 'service', blurb: 'Design', because: 'you design', words: ['design', 'designer', 'graphic', 'graphics', 'thumbnail', 'thumbnails', 'figma', 'canva', 'illustrator', 'photoshop'], skill: 'Design', interest: 'Art & design', apps: { work: 2, tools: 1 } },
  { key: 'copywriter', label: 'Copywriter', emoji: '📝', kind: 'service', blurb: 'Scripts and copy', because: 'you write for others', words: ['copywriter', 'copywriting', 'scripts', 'scriptwriter', 'script writer', 'ghostwriter', 'ghostwriting'], skill: 'Writing', apps: { work: 2, content: 1 } },
  { key: 'sound', label: 'Sound person', emoji: '🎧', kind: 'service', blurb: 'Sound', because: 'you do sound', words: ['mixing', 'mastering', 'sound design', 'audio engineer', 'sound engineer'], skill: 'Sound', apps: { work: 2, store: 1 } },
  { key: 'host', label: 'Host', emoji: '🎤', kind: 'service', blurb: 'On camera or on stage', because: 'you are on camera', words: ['host', 'hosting', 'anchor', 'presenter', 'on camera', 'actor', 'acting', 'modelling', 'modeling', 'emcee'], skill: 'On camera', apps: { army: 2, work: 1 } },
  { key: 'social', label: 'Social media manager', emoji: '📲', kind: 'service', blurb: 'Social pages', because: 'you run pages for brands', words: ['social media manager', 'smm', 'managing pages', 'manage pages', 'community manager'], skill: 'Community', apps: { content: 2, automations: 2, audience: 1, work: 1 } },
  // Where you are with it. One at a time.
  { key: 'starting', label: 'Just starting', emoji: '🌱', kind: 'stage', blurb: 'Not much out there yet', because: 'you are just starting', words: ['just started', 'just starting', 'starting out', 'beginner', 'new to this', 'zero followers', 'no followers'], level: 'Just starting', apps: { school: 2, knowledge: 1, tools: 1, win: 1 } },
  { key: 'growing', label: 'Growing', emoji: '📈', kind: 'stage', blurb: 'Posting, not earning yet', because: 'you post but do not earn yet', words: ['growing', 'consistent', 'posting daily', 'post daily', 'not earning', 'no income yet'], level: 'Early', apps: { content: 1, audience: 1, win: 2, army: 1 } },
  { key: 'earning', label: 'Earning', emoji: '🪙', kind: 'stage', blurb: 'Some money comes in', because: 'your work already earns', words: ['brand deals', 'brand deal', 'sponsorships', 'sponsored', 'monetized', 'monetised', 'paid collabs', 'already earning'], level: 'Working', apps: { finance: 2, shop: 1, audience: 1, army: 1 } },
  { key: 'full_time', label: 'Full time', emoji: '🏆', kind: 'stage', blurb: 'It is my living', because: 'this is your living', words: ['full time creator', 'full-time creator', 'creator full time', 'my living', 'main income'], level: 'Established', apps: { finance: 3, shop: 2, audience: 2, automations: 1, club: 1 } },
  // The rest of life: from your own words, or the extra pills on the first card.
  { key: 'runner', label: 'Runner', emoji: '🏃', kind: 'life', blurb: 'I run', because: 'you run', words: ['runner', 'running', 'marathon', 'half marathon', '5k', '10k', 'jogging'], interest: 'Running', apps: { run: 3, life: 1 } },
  { key: 'gym', label: 'Gym regular', emoji: '🏋️', kind: 'life', blurb: 'I train', because: 'you train', words: ['gym', 'lifting', 'weights', 'workouts', 'bodybuilding', 'crossfit'], interest: 'Gym', apps: { life: 2, wellbeing: 1, sleep: 1 } },
  { key: 'yogi', label: 'Yoga and breath', emoji: '🧘', kind: 'life', blurb: 'I do yoga or meditate', because: 'you do yoga or meditate', words: ['yoga', 'meditate', 'meditation', 'breathwork', 'pranayama'], interest: 'Yoga', apps: { mindful: 3, wellbeing: 1 } },
  { key: 'reader', label: 'Reader', emoji: '📚', kind: 'life', blurb: 'I read a lot', because: 'you read', words: ['reader', 'reading', 'books', 'bookworm'], interest: 'Books', apps: { knowledge: 2, journal: 1 } },
  { key: 'gamer', label: 'Gamer', emoji: '🕹️', kind: 'life', blurb: 'I play games', because: 'you play games', words: ['gamer', 'gaming', 'video games', 'playstation', 'xbox', 'esports', 'bgmi', 'valorant'], interest: 'Gaming', apps: { community: 2, circles: 1 } },
  { key: 'traveller', label: 'Traveller', emoji: '✈️', kind: 'life', blurb: 'I travel when I can', because: 'you travel', words: ['travel', 'traveller', 'traveler', 'travelling', 'traveling', 'backpacking'], interest: 'Travel', apps: { party: 1, finance: 1 } },
  { key: 'night_owl', label: 'Night owl', emoji: '🦉', kind: 'life', blurb: 'I come alive late', because: 'you are up late', words: ['night owl', 'up late', 'sleep late', 'late nights', 'nocturnal', 'stay up late'], apps: { sleep: 2 } },
  { key: 'spiritual', label: 'Spiritual', emoji: '🪔', kind: 'life', blurb: 'Faith or practice matters to me', because: 'faith or practice matters to you', words: ['spiritual', 'spirituality', 'my faith', 'god', 'temple', 'church', 'mosque', 'prayer', 'pray', 'bhakti'], interest: 'Spirituality', apps: { mindful: 2, journal: 1 } },
  { key: 'volunteer', label: 'Volunteer', emoji: '🤝', kind: 'life', blurb: 'I give my time', because: 'you give your time', words: ['volunteer', 'volunteering', 'ngo', 'charity', 'social work'], interest: 'Volunteering', apps: { community: 2, party: 1 } },
];

export const IDENTITY_BY_KEY: Record<string, IdentityOption> = Object.fromEntries(IDENTITIES.map((i) => [i.key, i]));

/** The known tags of one kind, in order: the roles on the first card, a creator's crafts, a freelancer's services, the stages, the rest of life. */
export function identitiesOf(kind: IdentityKind): IdentityOption[] {
  return IDENTITIES.filter((i) => i.kind === kind);
}

/** A tag as people read it: a known tag's label, or your own words as you wrote them. */
export function identityLabel(key: string): string {
  return IDENTITY_BY_KEY[key]?.label ?? key;
}

export interface SetupGoal {
  key: string;
  label: string;
  emoji: string;
  /** What it opens, said on its card. */
  blurb: string;
  because: string;
  /** How the summary says it, after "here to": "find paid work". */
  to: string;
  words: readonly string[];
  /** The profile goal it fills, when one fits. */
  profileGoal?: (typeof GOALS)[number];
  apps: Readonly<Record<string, number>>;
}

export const SETUP_GOALS: readonly SetupGoal[] = [
  { key: 'earn', label: 'Earn from my content', emoji: '💸', blurb: 'Win pays per verified view. Army runs paid brand campaigns.', because: 'you want to earn from what you make', to: 'earn from what you make', words: ['earn', 'make money', 'monetize', 'monetise', 'get paid', 'side income', 'side hustle', 'extra income'], profileGoal: 'Find paid work', apps: { win: 3, army: 3, work: 1, finance: 1 } },
  { key: 'work', label: 'Find paid work', emoji: '🧰', blurb: 'Gigs and jobs from brands and the team, in Work.', because: 'you want paid work', to: 'find paid work', words: ['find work', 'paid work', 'gigs', 'more clients', 'get hired', 'find a job', 'need a job', 'get a job', 'new job', 'internship', 'opportunities'], profileGoal: 'Find paid work', apps: { work: 3, army: 1, profile: 2, club: 1 } },
  { key: 'learn', label: 'Learn a new skill', emoji: '📖', blurb: 'Programs with lessons and a mentor, in School.', because: 'you want to learn', to: 'learn a skill', words: ['learn', 'learning', 'a skill', 'new skill', 'skills', 'upskill', 'get better at', 'improve my'], profileGoal: 'Learn skills', apps: { school: 3, knowledge: 2, tools: 1 } },
  { key: 'grow', label: 'Grow my audience', emoji: '📣', blurb: 'What worked, who follows, and replies that sell.', because: 'you want to grow an audience', to: 'grow an audience', words: ['grow', 'growth', 'more followers', 'followers', 'audience', 'reach', 'views', 'subscribers', 'go viral', 'viral', 'engagement'], apps: { content: 3, audience: 2, automations: 2, profile: 1, community: 1 } },
  { key: 'sell', label: 'Sell what I make', emoji: '🛍️', blurb: 'Courses, downloads, sessions and memberships, in Shop.', because: 'you want to sell', to: 'sell what you make', words: ['sell', 'selling', 'products', 'merch', 'my course', 'digital products', 'presets', 'ebook', 'my services'], profileGoal: 'Sell what I make', apps: { shop: 3, profile: 2, finance: 1, audience: 1, automations: 1 } },
  { key: 'money', label: 'Sort out my money', emoji: '💰', blurb: 'Money in and out, dues, budgets and goals, in Finance.', because: 'you want your money sorted', to: 'sort out your money', words: ['save money', 'saving', 'savings', 'budget', 'budgeting', 'debt', 'loan', 'expenses', 'spending', 'my money', 'finances', 'taxes'], apps: { finance: 3, reviews: 1 } },
  { key: 'people', label: 'Meet new people', emoji: '🫶', blurb: 'Small tables near you, a feed, events and friends.', because: 'you want to meet people', to: 'meet people', words: ['meet people', 'friends', 'make friends', 'network', 'networking', 'community', 'people like me', 'collab', 'collabs', 'collaborate'], profileGoal: 'Collaborate', apps: { circles: 3, community: 2, bond: 2, party: 2, club: 1 } },
  { key: 'health', label: 'Feel better day to day', emoji: '🌿', blurb: 'Mood, sleep, stress and calm, on one score.', because: 'you want to feel better day to day', to: 'feel better day to day', words: ['feel better', 'mood', 'mental health', 'calm', 'peace', 'health', 'healthy', 'happier', 'sleep better'], profileGoal: 'Get healthier habits', apps: { wellbeing: 3, mood: 2, sleep: 2, stress: 2, mindful: 2, life: 1 } },
  { key: 'move', label: 'Move more', emoji: '👟', blurb: 'Run clubs, movement minutes and a body score.', because: 'you want to move more', to: 'move more', words: ['fitness', 'get fit', 'lose weight', 'weight loss', 'exercise', 'run more', 'move more', 'workout', 'be active'], profileGoal: 'Get healthier habits', apps: { run: 3, life: 2, wellbeing: 1 } },
  { key: 'life', label: 'Work on myself', emoji: '🏰', blurb: 'The deeper path: your seven relationships, a routine and a plan.', because: 'you want to work on yourself', to: 'work on yourself', words: ['my life', 'life together', 'purpose', 'discipline', 'self improvement', 'self-improvement', 'better person', 'habits', 'routine', 'relationships', 'grow as a person'], apps: { journal: 2, reviews: 2, life: 2, mindful: 1, discover: 2 } },
  { key: 'find_coach', label: 'Work with a life coach', emoji: '🙋', blurb: 'A coach the team checked sees what you share and helps you keep going.', because: 'you want a coach in your corner', to: 'work with a life coach', words: ['need a life coach', 'want a life coach', 'find a life coach', 'get a life coach', 'need a coach', 'want a coach', 'find a coach', 'get a coach', 'my coach', 'accountability', 'keep me accountable', 'hold me accountable'], apps: { coaching: 3, life: 1, reviews: 1 } },
];

export const SETUP_GOAL_BY_KEY: Record<string, SetupGoal> = Object.fromEntries(SETUP_GOALS.map((g) => [g.key, g]));
/** Three goals at most: a setup that wants everything matches nothing. */
export const MAX_SETUP_GOALS = 3;

export interface SetupBlocker {
  key: string;
  label: string;
  emoji: string;
  because: string;
  words: readonly string[];
  apps: Readonly<Record<string, number>>;
  /** With this ticked, at most this many apps come on: less to look at, not more. Time short: three; focus hard: four. */
  cap?: number;
}

export const SETUP_BLOCKERS: readonly SetupBlocker[] = [
  { key: 'time', label: 'Not enough time', emoji: '⏳', because: 'time is short', words: ['no time', 'not enough time', 'busy', 'too busy', 'short on time'], cap: 3, apps: {} },
  { key: 'focus', label: 'Hard to focus (ADHD counts)', emoji: '🌀', because: 'focus is hard', words: ['adhd', 'distracted', 'procrastinate', 'procrastinating', 'procrastination', "can't focus", 'cant focus', 'hard to focus', 'overthinking'], cap: 4, apps: { mindful: 1 } },
  { key: 'energy', label: 'Low energy or feeling lazy', emoji: '🔋', because: 'energy runs low', words: ['lazy', 'laziness', 'tired', 'no energy', 'low energy', 'unmotivated', 'no motivation', 'burnt out', 'burned out', 'burnout', 'exhausted'], apps: { sleep: 2, mood: 1, wellbeing: 1 } },
  { key: 'start', label: 'Not sure where to start', emoji: '🗺️', because: 'you are not sure where to start', words: ['where to start', 'how to start', "don't know how", 'dont know how', 'confused', 'feel lost', "i'm lost", 'no idea'], apps: { school: 2, knowledge: 2 } },
  { key: 'alone', label: 'Doing it alone', emoji: '🫥', because: 'you are doing it alone', words: ['alone', 'lonely', 'loneliness', 'no friends', 'by myself', 'isolated', 'on my own'], apps: { circles: 2, community: 2, bond: 1, party: 1 } },
  { key: 'cash', label: 'Money is tight', emoji: '🪫', because: 'money is tight', words: ['broke', 'no money', 'money is tight', 'tight on money', "can't afford", 'cant afford', 'in debt'], apps: { finance: 2, win: 1, work: 1 } },
  { key: 'stress', label: 'Stress or worry', emoji: '🌊', because: 'stress gets in', words: ['stress', 'stressed', 'anxious', 'anxiety', 'worry', 'worried', 'overwhelmed', 'pressure'], apps: { stress: 2, journal: 2, mindful: 1 } },
  { key: 'sleep', label: 'Bad sleep', emoji: '🌙', because: 'sleep is off', words: ['bad sleep', 'insomnia', "can't sleep", 'cant sleep', 'sleep badly', 'no sleep', 'sleep at 4', 'sleep at 3'], apps: { sleep: 3 } },
];

export const SETUP_BLOCKER_BY_KEY: Record<string, SetupBlocker> = Object.fromEntries(SETUP_BLOCKERS.map((b) => [b.key, b]));

/** Two answers that mean more together than apart. Each pair adds its own weight and gives its own reason. */
export interface SetupCombo {
  when: readonly [string, string];
  apps: Readonly<Record<string, number>>;
  /** After "because": names both halves. */
  because: string;
}

/** Most specific first: when two pairs back the same app equally, the first one gives the reason. */
export const SETUP_COMBOS: readonly SetupCombo[] = [
  { when: ['editor', 'learn'], apps: { school: 3 }, because: 'you edit and want to get better at it' },
  { when: ['editor', 'work'], apps: { work: 1, army: 1 }, because: 'brands need editors for their campaigns' },
  { when: ['short_video', 'earn'], apps: { win: 2 }, because: 'you make short videos and want them to pay' },
  { when: ['long_video', 'grow'], apps: { content: 2 }, because: 'you make long videos and want more people to watch' },
  { when: ['teach', 'sell'], apps: { shop: 2 }, because: 'you teach and want to sell your lessons' },
  { when: ['coach', 'sell'], apps: { shop: 2 }, because: 'you coach and want to sell your sessions' },
  { when: ['coach', 'grow'], apps: { profile: 1, audience: 1 }, because: 'you coach and want more people to find you' },
  { when: ['social', 'grow'], apps: { content: 1, automations: 1 }, because: 'you run pages and want them to grow' },
  { when: ['shooter', 'work'], apps: { work: 1, store: 1 }, because: 'you shoot for clients, and the right gear wins jobs' },
  { when: ['starting', 'learn'], apps: { school: 2, tools: 1 }, because: 'you are just starting and want to learn the craft' },
  { when: ['starting', 'earn'], apps: { win: 2 }, because: 'you are new and want your first pay' },
  { when: ['earning', 'money'], apps: { finance: 2 }, because: 'creator money comes in bits, so it helps to see it in one place' },
  { when: ['full_time', 'sell'], apps: { automations: 2, shop: 1 }, because: 'this is your living, so selling should run while you sleep' },
  { when: ['runner', 'people'], apps: { run: 2 }, because: 'you run and want company' },
  { when: ['night_owl', 'health'], apps: { sleep: 2 }, because: 'you are up late and want to feel better' },
  { when: ['student', 'earn'], apps: { work: 2, win: 2 }, because: 'you study and want to earn on the side' },
  { when: ['student', 'work'], apps: { work: 2 }, because: 'you study and want paid work that fits around classes' },
  { when: ['student', 'learn'], apps: { school: 2 }, because: 'you study and want a skill that pays' },
  { when: ['explorer', 'work'], apps: { work: 2, school: 1 }, because: 'you are between things and want paid work' },
  { when: ['explorer', 'learn'], apps: { school: 2, knowledge: 1 }, because: 'a new skill is a good next step' },
  { when: ['employee', 'earn'], apps: { win: 2, work: 1 }, because: 'you have a job and want to earn on the side' },
  { when: ['employee', 'money'], apps: { finance: 1, reviews: 1 }, because: 'a salary goes further with a plan' },
  { when: ['creator', 'earn'], apps: { win: 2, army: 2 }, because: 'you make content and want it to pay' },
  { when: ['creator', 'grow'], apps: { content: 2, audience: 1 }, because: 'you make content and want more people to see it' },
  { when: ['creator', 'sell'], apps: { shop: 2, automations: 1 }, because: 'you make content and want to sell to the people who watch' },
  { when: ['creator', 'people'], apps: { community: 1, circles: 1, party: 1 }, because: 'creators grow faster with other creators around' },
  { when: ['freelancer', 'work'], apps: { work: 2, profile: 1 }, because: 'your page is your portfolio for the gigs you apply to' },
  { when: ['freelancer', 'money'], apps: { finance: 2 }, because: 'client money comes in bits, so it helps to see it in one place' },
  { when: ['freelancer', 'grow'], apps: { profile: 1, content: 1 }, because: 'you work for clients and want more of them to find you' },
  { when: ['founder', 'sell'], apps: { shop: 2, automations: 1 }, because: 'you run a business and want to sell more' },
  { when: ['founder', 'grow'], apps: { audience: 2, content: 1 }, because: 'you run a business and want more people to know it' },
  { when: ['founder', 'money'], apps: { finance: 2, reviews: 1 }, because: 'a business needs its money in one place' },
  { when: ['parent', 'health'], apps: { sleep: 1, stress: 1 }, because: 'looking after others starts with your own sleep and stress' },
  { when: ['parent', 'money'], apps: { finance: 1 }, because: 'a family budget is easier in one place' },
  { when: ['move', 'people'], apps: { run: 2 }, because: 'run clubs are moving and meeting in one' },
  { when: ['people', 'alone'], apps: { circles: 2, bond: 1 }, because: 'you do it alone and want people around' },
  { when: ['health', 'stress'], apps: { stress: 2, mindful: 1 }, because: 'you want to feel better and stress gets in' },
  { when: ['health', 'sleep'], apps: { sleep: 2 }, because: 'better days start with better nights' },
  { when: ['health', 'energy'], apps: { sleep: 1, mood: 1 }, because: 'low energy shows up in sleep and mood first' },
  { when: ['learn', 'start'], apps: { school: 2, knowledge: 1 }, because: 'a program gives you a first step' },
  { when: ['life', 'focus'], apps: { reviews: 1 }, because: 'a short look back each week keeps you on track' },
  { when: ['life', 'energy'], apps: { journal: 1 }, because: 'writing it down shows what drains you' },
  { when: ['money', 'cash'], apps: { finance: 2 }, because: 'money is tight and you want it sorted' },
  { when: ['earn', 'cash'], apps: { win: 1, work: 1 }, because: 'money is tight and you want to earn' },
];

export interface SetupAnswers {
  /** Known tag keys, and labels in your own words. */
  identities: string[];
  goals: string[];
  blockers: string[];
}

/** What the setup chat heard, kept with the account so a second run starts from it. */
export interface Intake {
  goals: string[];
  blockers: string[];
  /** When the setup was last saved. */
  at: string | null;
}

export interface AppPick {
  key: string;
  score: number;
  /** One sentence, built from your answers. */
  why: string;
}

export interface SetupMatch {
  /** Switched on, best fit first. */
  apps: AppPick[];
  /** A good fit too, left off to keep things light. */
  more: AppPick[];
  /** Who you are and what you came for, in one sentence. */
  line: string;
  /** What the setup writes into the profile. */
  profile: { focus: string; skills: string[]; interests: string[]; level: string; availability: string; goals: string[] };
  /** The strategy session: offer it now, soon, or leave it in Pillars for later. */
  session: 'now' | 'soon' | 'later';
  /** The most apps that could come on, from what gets in the way. */
  cap: number;
}

export const MAX_IDENTITIES = 12;
/** Tags in your own words, on top of the known ones. */
export const MAX_CUSTOM_IDENTITIES = 3;
export const IDENTITY_LABEL_MAX = 30;
export const SETUP_APPS_MIN = 3;
export const SETUP_APPS_MAX = 5;
/** The score an app needs to come on by itself. A goal counts double, so one goal and one tag are enough. */
export const SETUP_PASS = 4;

/** The apps the setup switches: every app a person can turn on or off, apart from the essentials and the team's tools. */
export function setupSwitchable(m: AppModule): boolean {
  return !m.locked && (m.group === 'earn' || m.group === 'creator' || m.group === 'community' || m.group === 'wellbeing');
}

const lowerFirst = (label: string) => (/^\S[^\sA-Z]*(\s|$)/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label);
const listed = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const STAGE_SAID: Record<string, string> = { starting: 'just starting', growing: 'growing', earning: 'already earning', full_time: 'doing it full time' };

/** Who you are and what you came for, in one sentence: "A student and freelance video editor, here to learn a skill and find paid work." */
export function identityLine(a: SetupAnswers): string {
  const has = (k: string) => a.identities.includes(k);
  const anyOf = (kind: IdentityKind) => a.identities.some((k) => IDENTITY_BY_KEY[k]?.kind === kind);
  const nouns = a.identities
    .filter((k) => {
      const o = IDENTITY_BY_KEY[k];
      if (!o) return true;
      if (o.kind === 'stage') return false;
      // A craft says more than "creator", and "freelance video editor" more than "freelancer".
      if (k === 'creator' && anyOf('craft')) return false;
      if (k === 'freelancer' && anyOf('service')) return false;
      return true;
    })
    .map((k) => {
      const o = IDENTITY_BY_KEY[k];
      const label = lowerFirst(o?.label ?? k);
      return o?.kind === 'service' && has('freelancer') ? `freelance ${label}` : label;
    });
  const stage = a.identities.map((k) => STAGE_SAID[k]).find(Boolean);
  const goals = a.goals.map((g) => SETUP_GOAL_BY_KEY[g]?.to).filter((x): x is string => Boolean(x));
  const who = nouns.length ? `${/^[aeiou]/i.test(nouns[0]!) ? 'An' : 'A'} ${listed(nouns)}` : '';
  const parts = [who, stage ?? '', goals.length ? `here to ${listed(goals)}` : ''].filter(Boolean);
  if (parts.length === 0) return '';
  const s = parts.join(', ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

/** The goals in the order that fits these tags: the ones a tag or a pair points at come first. */
export function goalsFor(identities: readonly string[]): SetupGoal[] {
  const tags = identities.map((k) => IDENTITY_BY_KEY[k]).filter((o): o is IdentityOption => Boolean(o));
  const fit = (g: SetupGoal) => {
    let f = 0;
    for (const t of tags) for (const [app, w] of Object.entries(g.apps)) f += Math.min(w, t.apps[app] ?? 0);
    for (const c of SETUP_COMBOS) if (c.when.includes(g.key) && c.when.some((k) => identities.includes(k))) f += 3;
    return f;
  };
  return SETUP_GOALS.map((g, i) => ({ g, i, f: fit(g) }))
    .sort((x, y) => y.f - x.f || x.i - y.i)
    .map((x) => x.g);
}

/**
 * The one matching rule. Every tag, goal and thing in the way weighs the apps (a goal counts double), every pair
 * in SETUP_COMBOS that is all there adds its own weight, and the apps that clear SETUP_PASS come on, best first,
 * no more than the cap (fewer when time or focus is short). Each app says why: the pair behind it when there is
 * one, else the two answers that weigh most. The same answers always give the same result, and a different mix
 * gives its own.
 */
export function matchSetup(a: SetupAnswers, available?: readonly string[]): SetupMatch {
  const order = new Map(MODULES.map((m, i) => [m.key, i]));
  const open = new Set(MODULES.filter((m) => setupSwitchable(m) && (!available || available.includes(m.key))).map((m) => m.key));
  const score = new Map<string, number>();
  const sources = new Map<string, { because: string; w: number; pair: boolean }[]>();
  const add = (app: string, w: number, because: string, pair = false) => {
    if (!open.has(app) || w <= 0) return;
    score.set(app, (score.get(app) ?? 0) + w);
    sources.set(app, [...(sources.get(app) ?? []), { because, w, pair }]);
  };
  const tags = a.identities.map((k) => IDENTITY_BY_KEY[k]).filter((o): o is IdentityOption => Boolean(o));
  const goals = a.goals.map((k) => SETUP_GOAL_BY_KEY[k]).filter((g): g is SetupGoal => Boolean(g));
  const blockers = a.blockers.map((k) => SETUP_BLOCKER_BY_KEY[k]).filter((b): b is SetupBlocker => Boolean(b));
  for (const t of tags) for (const [app, w] of Object.entries(t.apps)) add(app, w, t.because);
  for (const g of goals) for (const [app, w] of Object.entries(g.apps)) add(app, w * 2, g.because);
  for (const b of blockers) for (const [app, w] of Object.entries(b.apps)) add(app, w, b.because);
  const keys = new Set([...a.identities, ...a.goals, ...a.blockers]);
  for (const c of SETUP_COMBOS) if (c.when.every((k) => keys.has(k))) for (const [app, w] of Object.entries(c.apps)) add(app, w, c.because, true);

  const why = (app: string) => {
    const list = sources.get(app) ?? [];
    const pair = list.filter((s) => s.pair).reduce<{ because: string; w: number } | null>((best, s) => (!best || s.w > best.w ? s : best), null);
    if (pair) return `Because ${pair.because}.`;
    const top = [...new Set([...list].sort((x, y) => y.w - x.w).map((s) => s.because))].slice(0, 2);
    return top.length ? `Because ${top.join(' and ')}.` : 'A good place to start.';
  };
  const cap = Math.max(SETUP_APPS_MIN, Math.min(SETUP_APPS_MAX, ...blockers.map((b) => b.cap ?? SETUP_APPS_MAX)));
  const rank = (x: string, y: string) => (score.get(y) ?? 0) - (score.get(x) ?? 0) || (order.get(x) ?? 0) - (order.get(y) ?? 0);
  const ranked = [...score.entries()].sort((x, y) => rank(x[0], y[0]));
  // Every answer brings its own app first, so the mix always shows both who you are and what you came for:
  // each goal its main app, each tag its strongest (a fit of 2 or more), each thing in the way its strongest,
  // then each tag its second. The rest fill in by score, up to the cap.
  const tops = (apps: Readonly<Record<string, number>>, min: number, n: number) =>
    Object.entries(apps)
      .filter(([app, w]) => w >= min && open.has(app))
      .sort((x, y) => y[1] - x[1] || rank(x[0], y[0]))
      .slice(0, n)
      .map(([app]) => app);
  const lasting = tags.filter((t) => t.kind !== 'stage');
  const anchors = [
    ...goals.flatMap((g) => tops(g.apps, 1, 1)),
    ...lasting.flatMap((t) => tops(t.apps, 2, 1)),
    ...blockers.flatMap((b) => tops(b.apps, 2, 1)),
    ...tags.filter((t) => t.kind === 'stage').flatMap((t) => tops(t.apps, 2, 1)),
    ...lasting.flatMap((t) => tops(t.apps, 2, 2).slice(1)),
  ];
  const picked: string[] = [];
  for (const k of [...anchors, ...ranked.filter(([, s]) => s >= SETUP_PASS).map(([k]) => k)]) if (picked.length < cap && !picked.includes(k)) picked.push(k);
  // Too little to go on: the next best fits, then the apps most people start with.
  for (const [k] of ranked) if (picked.length < SETUP_APPS_MIN && !picked.includes(k)) picked.push(k);
  for (const k of ['journal', 'life', 'school']) if (picked.length < SETUP_APPS_MIN && open.has(k) && !picked.includes(k)) picked.push(k);
  picked.sort(rank);
  const pick = (k: string): AppPick => ({ key: k, score: score.get(k) ?? 0, why: why(k) });
  const more = ranked.filter(([k, s]) => s >= 2 && !picked.includes(k)).slice(0, 3).map(([k]) => pick(k));

  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))];
  const has = (k: string) => a.identities.includes(k);
  const wants = (k: string) => a.goals.includes(k);
  const availability = (wants('work') || wants('earn')) && ['freelancer', 'explorer', 'student', 'creator'].some(has) ? 'Open to work' : (wants('people') || wants('grow')) && has('creator') ? 'Open to collabs' : '';
  const signs = ['focus', 'energy', 'stress', 'sleep'];
  const session = wants('life') ? 'now' : (wants('health') || wants('move')) && a.blockers.some((b) => signs.includes(b)) ? 'soon' : 'later';
  return {
    apps: picked.map(pick),
    more,
    line: identityLine(a),
    profile: {
      focus: tags.find((t) => t.focus)?.focus ?? '',
      skills: uniq(tags.map((t) => t.skill)),
      interests: uniq(tags.map((t) => t.interest)),
      level: tags.find((t) => t.level)?.level ?? '',
      availability,
      goals: uniq(goals.map((g) => g.profileGoal)),
    },
    session,
    cap,
  };
}

// Reading your own words: whole words and phrases from each tag's list, nothing guessed past them.
const plain = (s: string) => ` ${s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'+\s-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const CUSTOM_STOP = new Set(['and', 'who', 'but', 'with', 'at', 'in', 'on', 'from', 'for', 'to', 'of', 'that', 'so', 'also', 'or', 'by', 'too', 'as', 'now', 'here', 'there', 'currently', 'trying', 'looking']);
const CUSTOM_PLAIN = new Set(['person', 'guy', 'girl', 'boy', 'man', 'woman', 'human', 'fan', 'lover', 'bit', 'lot', 'member', 'newbie', 'other', 'user', 'kid', 'adult', 'teen', 'teenager', 'citizen', 'resident', 'number', 'computer', 'paper', 'water', 'power', 'poster', 'sticker', 'corner', 'winter', 'summer', 'server', 'center', 'centre', 'after', 'under', 'over', 'never', 'ever', 'rather', 'better', 'bigger', 'later', 'quarter', 'chapter', 'letter', 'matter', 'character', 'monster', 'introvert', 'extrovert', 'student', 'parent', 'agent', 'client', 'talent', 'content', 'moment', 'event', 'percent', 'giant', 'want', 'plant']);
const CUSTOM_ADJ = new Set(['final', 'first', 'second', 'third', 'big', 'small', 'little', 'huge', 'good', 'bad', 'new', 'young', 'old', 'full', 'part', 'proud', 'single', 'busy', 'lazy', 'tired', 'year', 'time', 'aspiring', 'wannabe', 'struggling', 'budding', 'very', 'really', 'total', 'complete', 'real', 'pro', 'professional', 'freelance', 'part-time', 'full-time']);
const CUSTOM_ROLE = /(er|or|ist|ian|ant|ent|eur|ee|smith|maker|wright)$/;
const CUSTOM_ALLOW = new Set(['chef', 'cook', 'nurse', 'poet', 'athlete', 'pilot', 'vet', 'dj', 'barista', 'medic', 'monk', 'artisan', 'architect', 'analyst', 'scientist']);

export interface AboutRead {
  identities: string[];
  /** Tags in your own words, from "I am a ..." when no known tag fits. */
  custom: string[];
  goals: string[];
  blockers: string[];
}

/** Tags, goals and what gets in the way, read from a line you typed. Every one of them is shown back to be ticked or not. */
export function readAbout(text: string): AboutRead {
  const t = plain(text.slice(0, 600));
  const hit = (words: readonly string[]) => words.some((w) => t.includes(plain(w)));
  // A word some tag already knows is never made into a tag of your own.
  const known = new Set([...IDENTITIES.flatMap((i) => i.words), ...SETUP_GOALS.flatMap((g) => g.words), ...SETUP_BLOCKERS.flatMap((b) => b.words)]);
  let identities = IDENTITIES.filter((i) => hit(i.words)).map((i) => i.key);
  // One stage at a time: the furthest along.
  const stages = identities.filter((k) => IDENTITY_BY_KEY[k]!.kind === 'stage');
  if (stages.length > 1) identities = identities.filter((k) => IDENTITY_BY_KEY[k]!.kind !== 'stage' || k === stages.at(-1));
  const custom: string[] = [];
  for (const m of t.matchAll(/ (?:i am|i'm|im|i work as|working as|work as|job as) (?:a|an) ([a-z][a-z'-]*(?: [a-z][a-z'-]*){0,2})/g)) {
    const words: string[] = [];
    for (const w of (m[1] ?? '').split(' ')) {
      if (CUSTOM_STOP.has(w)) break;
      words.push(w);
    }
    // The rightmost word that names what someone does is the tag: "a software engineer", "a dancer too".
    let at = words.length - 1;
    while (at >= 0 && !(CUSTOM_ROLE.test(words[at]!) || CUSTOM_ALLOW.has(words[at]!))) at -= 1;
    const head = words[at];
    if (!head || CUSTOM_PLAIN.has(head) || known.has(head)) continue;
    const before = words[at - 1];
    const phrase = before && !CUSTOM_ADJ.has(before) && !known.has(before) ? `${before} ${head}` : head;
    const label = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    if (custom.length < MAX_CUSTOM_IDENTITIES && !custom.includes(label)) custom.push(label);
  }
  return {
    identities,
    custom,
    goals: SETUP_GOALS.filter((g) => hit(g.words)).map((g) => g.key).slice(0, MAX_SETUP_GOALS),
    blockers: SETUP_BLOCKERS.filter((b) => hit(b.words)).map((b) => b.key),
  };
}

/** A tag as it is kept: a known key, or your own words cleaned up. A label that names a known tag becomes that tag. */
export function cleanIdentity(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (IDENTITY_BY_KEY[raw]) return raw;
  const label = raw.normalize('NFKC').replace(/[^\p{L}\p{N} &'.-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, IDENTITY_LABEL_MAX).trim();
  if (label.replace(/[^\p{L}\p{N}]/gu, '').length < 2) return null;
  const lower = label.toLowerCase();
  const known = IDENTITIES.find((i) => i.label.toLowerCase() === lower || i.words.includes(lower));
  if (known) return known.key;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The one validator for a list of tags: known keys and cleaned labels, no repeats, three of your own at most, one stage. */
export function parseIdentities(raw: unknown): string[] {
  const out: string[] = [];
  let own = 0;
  for (const x of Array.isArray(raw) ? raw : []) {
    const k = cleanIdentity(x);
    if (!k || out.some((o) => o.toLowerCase() === k.toLowerCase())) continue;
    if (!IDENTITY_BY_KEY[k]) {
      if (own >= MAX_CUSTOM_IDENTITIES) continue;
      own += 1;
    }
    out.push(k);
    if (out.length >= MAX_IDENTITIES) break;
  }
  const stages = out.filter((k) => IDENTITY_BY_KEY[k]?.kind === 'stage');
  return stages.length > 1 ? out.filter((k) => IDENTITY_BY_KEY[k]?.kind !== 'stage' || k === stages.at(-1)) : out;
}

/** The setup's answers from a request body: tags through parseIdentities, goals and blockers from their lists only. */
export function parseSetup(raw: unknown): SetupAnswers {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (v: unknown, keys: readonly string[], max: number) => [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && keys.includes(x)))].slice(0, max);
  return {
    identities: parseIdentities(o.identities),
    goals: pick(o.goals, SETUP_GOALS.map((g) => g.key), MAX_SETUP_GOALS),
    blockers: pick(o.blockers, SETUP_BLOCKERS.map((b) => b.key), SETUP_BLOCKERS.length),
  };
}

/** What a stored intake holds, whatever was saved. */
export function parseIntake(raw: string | null | undefined): Intake {
  try {
    const v = JSON.parse(raw || '{}') as Record<string, unknown>;
    const a = parseSetup(v);
    return { goals: a.goals, blockers: a.blockers, at: typeof v.at === 'string' ? v.at : null };
  } catch {
    return { goals: [], blockers: [], at: null };
  }
}

/** A few small groups of choices, so a list reads at a glance. The setup chat draws every list this way. */
export interface ChoiceGroup {
  label: string;
  emoji: string;
  keys: readonly string[];
}

export const SETUP_GOAL_GROUPS: readonly ChoiceGroup[] = [
  { label: 'Money and work', emoji: '💸', keys: ['earn', 'work', 'sell', 'money'] },
  { label: 'Grow', emoji: '🌱', keys: ['learn', 'grow', 'people'] },
  { label: 'You', emoji: '🌿', keys: ['health', 'move', 'life', 'find_coach'] },
];

export const SETUP_ROLE_GROUPS: readonly ChoiceGroup[] = [
  { label: 'What you do', emoji: '🛠️', keys: ['creator', 'freelancer', 'employee', 'founder', 'coach'] },
  { label: 'Where you are in life', emoji: '🧭', keys: ['student', 'explorer', 'parent'] },
];

export const SETUP_BLOCKER_GROUPS: readonly ChoiceGroup[] = [
  { label: 'Time and energy', emoji: '⏳', keys: ['time', 'energy', 'sleep'] },
  { label: 'Head space', emoji: '🧠', keys: ['focus', 'stress', 'start'] },
  { label: 'Life stuff', emoji: '🤝', keys: ['alone', 'cash'] },
];

/** Every app the setup can switch on, said the way a friend would say it. The match shows this line under each app. */
export const SETUP_APP_LINES: Readonly<Record<string, string>> = {
  school: 'Short lessons with a mentor.',
  work: 'Paid gigs from brands.',
  army: 'Brand campaigns you can join.',
  win: 'Get paid for views on brand videos.',
  party: 'Meetups and events near you.',
  run: 'Run clubs near you. Runs earn points.',
  community: 'Post, ask and cheer each other on.',
  club: 'A members club with perks.',
  bond: 'Stay friends with people you meet.',
  circles: 'A small group that meets each week.',
  life: 'Your body, money, mood, mind and faith.',
  wellbeing: 'One score for how you are doing.',
  mood: 'Tap a face each day.',
  sleep: 'Log your nights, sleep better.',
  stress: 'Note your stress and what causes it.',
  mindful: 'A timer for calm breathing.',
  journal: 'Write it down, with how you felt.',
  reviews: 'A short look back each week.',
  companion: 'A chat about how you are doing. Not a therapist.',
  coaching: 'Work with a life coach, or coach your students.',
  cards: 'Card games to play with the people you are with, shuffled and flipped on a table.',
  discover: 'A quiz on your personality, reasoning and strengths.',
  profile: 'Your page: links, work and shop.',
  shop: 'Sell courses, downloads and sessions.',
  store: 'Gear, new or second hand.',
  audience: 'See who follows you, send them news.',
  content: 'Ideas, hooks and scripts for posts.',
  automations: 'Auto DM a link when people comment.',
  finance: 'Money in and out, and your goals.',
  library: 'Everything you bought, in one place.',
  knowledge: 'Short reads worth your time.',
  tools: 'Creator tools the team checked.',
  tv: 'Pitch a show idea.',
  fund: 'Ask for money to back a project.',
};

// ---------------------------------------------------------------------------
// The assistant and credits. The assistant does things in the app as the person: the free flows, and, with a
// plan, typing to a model that calls the same API routes the screens use. Typing is paid for in credits: one
// credit is a tenth of a US cent of model use, worked out from the tokens with whole numbers only.
// ---------------------------------------------------------------------------

/** "12.50" or 12.5 to 1250. Integer cents only, never a float: the decimal is read as text. */
export function centsFrom(input: string | number): number | null {
  const m = /^\s*(\d{1,9})(?:[.,](\d{1,2}))?\s*$/.exec(String(input));
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return cents > 0 ? cents : null;
}

/** A model's price in US micro-dollars per million tokens, which is the same number as picodollars per token. */
export interface ModelPrice {
  input: number;
  output: number;
}
/** One credit is US$0.001, which is 10^9 picodollars. */
export const PICO_PER_CREDIT = 1_000_000_000;
/** Known prices. A deployment can override them with ASSISTANT_PRICE_IN and ASSISTANT_PRICE_OUT. */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'moonshotai/kimi-k2.6': { input: 541_500, output: 2_280_000 },
};
/** What a model with no known price is charged: high on purpose, so a missing price never undercharges. */
export const FALLBACK_PRICE: ModelPrice = { input: 3_000_000, output: 15_000_000 };
/** OpenRouter's free models (ids ending in ":free") cost nothing, so a message on one spends no credits. */
export const FREE_PRICE: ModelPrice = { input: 0, output: 0 };
export const priceOf = (model: string): ModelPrice => (model.endsWith(':free') ? FREE_PRICE : (MODEL_PRICES[model] ?? FALLBACK_PRICE));

/** A model the assistant can run on, picked in the panel for now. */
export interface AssistantModel {
  id: string;
  name: string;
  by: string;
  /**
   * True when OpenRouter lists a zero-retention host for it. Only then is the assistant offered the journal and the
   * trackers to read, and only then is OpenRouter told to keep nothing. A model that keeps data never sees them.
   */
  private: boolean;
  /** Its reasoning cannot be switched off, so it gets more room to answer. Every other model is asked not to reason. */
  thinks?: boolean;
}
/**
 * The models to pick from while the assistant is being tried out: OpenRouter's free models that take tools (checked
 * against OpenRouter's model list on 29 Oct 2026). Free models are limited by OpenRouter to 20 requests a minute,
 * and 50 a day until the key's account has bought US$10 of credits. The first one is the default.
 */
export const ASSISTANT_MODELS: readonly AssistantModel[] = [
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', by: 'NVIDIA', private: false },
  { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron 3.5 Super VL', by: 'NVIDIA', private: false },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning', by: 'NVIDIA', private: false },
  { id: 'xingchen-agi/xing4.0-29b-a4b:free', name: 'Xing4.0 29B', by: 'XingChen', private: true },
  { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', by: 'Poolside', private: false },
  { id: 'poolside/laguna-xs-2.1:free', name: 'Laguna XS 2.1', by: 'Poolside', private: false },
  { id: 'dots-studio/dots-3-note-preview:free', name: 'Dots3-Note Preview', by: 'Dots Studio', private: false },
  { id: 'thinkingmachines/inkling:free', name: 'Inkling', by: 'Thinking Machines', private: false },
  { id: 'thinkingmachines/inkling-small:free', name: 'Inkling Small', by: 'Thinking Machines', private: false },
  { id: 'recursive/flint-v1.0:free', name: 'Flint', by: 'Recursive', private: false, thinks: true },
  { id: 'cohere/north-mini-code:free', name: 'North Mini Code', by: 'Cohere', private: false },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', by: 'Google', private: false },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B', by: 'Google', private: false },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni', by: 'NVIDIA', private: false },
  { id: 'liquid/lfm-2.5-2.6b:free', name: 'LFM2.5 2.6B', by: 'Liquid', private: false, thinks: true },
];
export const ASSISTANT_MODEL_BY_ID: Readonly<Record<string, AssistantModel>> = Object.fromEntries(ASSISTANT_MODELS.map((m) => [m.id, m]));

/** "0.5415" (US dollars per million tokens) to 541500 micro-dollars, read as text so no float is involved. */
export function microsFrom(input: string): number | null {
  const m = /^\s*(\d{1,5})(?:\.(\d{1,6}))?\s*$/.exec(input);
  if (!m) return null;
  return Number(m[1]) * 1_000_000 + Number((m[2] ?? '').padEnd(6, '0') || '0');
}

/** The credits some tokens cost at a price, rounded up to a whole credit. Whole numbers all the way through. */
export function creditsFor(tokens: { input: number; output: number }, price: ModelPrice): number {
  const pico = Math.max(0, Math.round(tokens.input)) * price.input + Math.max(0, Math.round(tokens.output)) * price.output;
  const rest = pico % PICO_PER_CREDIT;
  return (pico - rest) / PICO_PER_CREDIT + (rest > 0 ? 1 : 0);
}

export const PAID_PLANS = ['pro', 'pro_max', 'ultra'] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];
export type PlanKey = PaidPlan | 'none';
export const isPaidPlan = (v: unknown): v is PaidPlan => (PAID_PLANS as readonly unknown[]).includes(v);

export interface Plan {
  key: PaidPlan;
  name: string;
  /** What it costs, in US cents a period. */
  priceCents: number;
  /** Credits for each period. They do not carry over. */
  credits: number;
  blurb: string;
}
/** A plan runs this many days, then ends unless it is renewed. */
export const PLAN_DAYS = 30;
export const PLAN_CURRENCY = 'USD';
/** The only three plans. Each gives a fixed worth of model use a month, and the price on top pays for the rest. */
export const PLANS: Readonly<Record<PaidPlan, Plan>> = {
  pro: { key: 'pro', name: 'Pro', priceCents: 1_500, credits: 10_000, blurb: '10,000 credits a month: US$10 of model use.' },
  pro_max: { key: 'pro_max', name: 'Pro Max', priceCents: 12_500, credits: 100_000, blurb: '100,000 credits a month: US$100 of model use.' },
  ultra: { key: 'ultra', name: 'Ultra', priceCents: 50_000, credits: 400_000, blurb: '400,000 credits a month: US$400 of model use.' },
};
export const planName = (key: string): string => (isPaidPlan(key) ? PLANS[key].name : 'No plan');

export interface TopUpPack {
  key: string;
  priceCents: number;
  credits: number;
}
/** Extra credits on top of a plan. They stay until used. */
export const TOPUP_PACKS: readonly TopUpPack[] = [
  { key: 'small', priceCents: 1_000, credits: 8_000 },
  { key: 'medium', priceCents: 2_500, credits: 20_000 },
  { key: 'large', priceCents: 5_000, credits: 40_000 },
];
/** True once a payment provider takes money for plans and top-ups. Until then the team switches plans on. */
export const PAYMENTS_LIVE = false;
/** The most credits the team can grant in one go. */
export const MAX_CREDIT_GRANT = 1_000_000;

/** The agents that spend credits. More join this list as they move onto a model. */
export const AGENTS = ['assistant'] as const;
export type AgentKey = (typeof AGENTS)[number];
export const AGENT_META: Readonly<Record<AgentKey, { name: string; blurb: string }>> = {
  assistant: { name: 'Assistant', blurb: 'Does things in the app when you type what you want.' },
};
export interface AgentLimit {
  /** How much the agent reads per message, in tokens: its own rules, its tools, the chat so far and what it looks up. */
  contextTokens: number;
  /** The most one message may spend, in credits. */
  perMessage: number;
  /** The most the agent may spend in any 24 hours, in credits. */
  perDay: number;
  /** How many rounds of tools one message may take. */
  steps: number;
}
/** Each plan's limits, per agent. One place to change them. */
export const AGENT_LIMITS: Readonly<Record<PaidPlan, Record<AgentKey, AgentLimit>>> = {
  pro: { assistant: { contextTokens: 16_000, perMessage: 60, perDay: 1_000, steps: 6 } },
  pro_max: { assistant: { contextTokens: 64_000, perMessage: 250, perDay: 8_000, steps: 10 } },
  ultra: { assistant: { contextTokens: 128_000, perMessage: 600, perDay: 30_000, steps: 12 } },
};
/** About what one assistant message costs, to say how far credits go. A guess, and said as one. */
export const TYPICAL_MESSAGE_CREDITS = 12;
export const messagesFor = (credits: number): number => Math.floor(Math.max(0, credits) / TYPICAL_MESSAGE_CREDITS);

/** Plan credits are spent first, then the extra ones. Never more than there is. */
export function spendSplit(cost: number, plan: number, extra: number): { plan: number; extra: number } {
  const want = Math.max(0, Math.round(cost));
  const fromPlan = Math.min(want, Math.max(0, plan));
  return { plan: fromPlan, extra: Math.min(want - fromPlan, Math.max(0, extra)) };
}

export interface CreditAccount {
  plan: PlanKey;
  planName: string;
  planUntil: string | null;
  planCredits: number;
  extraCredits: number;
  total: number;
  /** The plan's limits per agent, or null without a plan. */
  limits: Record<AgentKey, AgentLimit> | null;
  /** Credits each agent spent in the last 24 hours. */
  usedToday: Record<AgentKey, number>;
}
export type CreditReason = 'plan' | 'topup' | 'admin' | 'usage' | 'expire';
export interface CreditEntry {
  id: string;
  bucket: 'plan' | 'extra';
  amount: number;
  reason: CreditReason;
  agent: AgentKey | null;
  note: string;
  tokens: { input: number; output: number } | null;
  createdAt: string;
}
export interface CreditsResponse {
  account: CreditAccount;
  /** Credits used per day over the last thirty days, oldest first. */
  usage: { date: string; credits: number }[];
  plans: Plan[];
  topUps: readonly TopUpPack[];
  paymentsLive: boolean;
}

/** One line of the chat, as the client keeps it. `note` is what the assistant did that turn, for its memory. */
export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
  note?: string;
  /** The client's own record of the receipts a reply made, so the note it sends says what is true now (after an Undo). */
  actions?: string[];
}
export interface AssistantContext {
  /** The screen the person is on. */
  path: string;
  /** The person's own date and zone; the model never picks "today". */
  date: string;
  timeZone: string;
}
export type AssistantActionStatus = 'done' | 'failed' | 'pending' | 'undone' | 'cancelled';
/** One thing the assistant did, or waits to do until the person confirms. */
export interface AssistantReceipt {
  id: string;
  tool: string;
  label: string;
  status: AssistantActionStatus;
  error: string;
  /** True when Undo can take it back. */
  undo: boolean;
  /** The query keys on screen that show this change. */
  refresh: string[];
}
export interface AssistantCall {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  error?: string;
}
export interface AssistantReply {
  text: string;
  /** The model that answered. */
  model: string;
  receipts: AssistantReceipt[];
  note: string;
  calls: AssistantCall[];
  credits: { spent: number; left: number };
  /** Why it stopped early, when it did: the message's cap, the credits ran out, the step cap, or the person tapped Stop. */
  stopped: 'limit' | 'credits' | 'steps' | 'user' | null;
  /** The model failed after some tools ran; the text says so, and the receipts show what did happen. */
  failed?: boolean;
}
export interface AssistantStatus {
  /** A model is set up on the server. */
  connected: boolean;
  /** The server's default model, used when none is picked. */
  model: string | null;
  /** The models that can be picked in the panel. */
  models: readonly AssistantModel[];
  account: CreditAccount;
}
/** Why typing is refused: no plan, no credits left, or the day's cap reached. */
export type AssistantPaywall = 'plan' | 'credits' | 'day';

// ---------------------------------------------------------------------------
// Discover: a short self-discovery quiz. Five parts in the shape of a modern talent survey (pick the statement that is most
// and least like you; pattern puzzles; descriptor words; real situations), with our own items and our own scoring.
// It never compares you with other people: every number is you against your own scale. Owner only, like the journal.
// ---------------------------------------------------------------------------

/** The five traits behind the scoring (the well-known Big Five, in plain words). */
export type Trait = 'o' | 'c' | 'e' | 'a' | 's';
export const TRAITS: readonly { key: Trait; name: string; high: string; low: string }[] = [
  { key: 'o', name: 'Curiosity', high: 'Likes new ideas, new places and new ways', low: 'Likes what is proven and clear' },
  { key: 'c', name: 'Follow-through', high: 'Plans, finishes and keeps promises', low: 'Goes with the flow and starts many things' },
  { key: 'e', name: 'Energy with people', high: 'Gets energy from people and talks easily', low: 'Gets energy from quiet and thinks before talking' },
  { key: 'a', name: 'Warmth', high: 'Puts people first and keeps the peace', low: 'Says it straight and stands firm' },
  { key: 's', name: 'Calm', high: 'Stays steady when things go wrong', low: 'Feels things strongly and worries more' },
];

export interface DiscoverStatement {
  id: string;
  trait: Trait;
  /** 1 when saying yes means more of the trait, -1 when it means less. */
  sign: 1 | -1;
  text: string;
}

const STATEMENT_TEXT: Record<Trait, { text: string; sign: 1 | -1 }[]> = {
  o: [
    { text: 'I like to try new and different things.', sign: 1 },
    { text: 'I enjoy learning about ideas just for fun.', sign: 1 },
    { text: 'I often come up with new ways to do things.', sign: 1 },
    { text: 'I notice small details in art, music or words.', sign: 1 },
    { text: 'I get bored when things stay the same.', sign: 1 },
    { text: 'I like to ask why things work the way they do.', sign: 1 },
    { text: 'I prefer to stick to what I know works.', sign: -1 },
    { text: 'I like clear rules more than big ideas.', sign: -1 },
    { text: 'I would rather do it the usual way.', sign: -1 },
    { text: 'Abstract ideas lose me quickly.', sign: -1 },
    { text: 'I like to explore places I have never been.', sign: 1 },
  ],
  c: [
    { text: 'I finish what I start.', sign: 1 },
    { text: 'I plan my week before it begins.', sign: 1 },
    { text: 'I keep my space and files in order.', sign: 1 },
    { text: 'I do the hard task first.', sign: 1 },
    { text: 'I double-check my work before I share it.', sign: 1 },
    { text: 'I keep promises, even small ones.', sign: 1 },
    { text: 'I often leave things until the last minute.', sign: -1 },
    { text: 'My plans change with my mood.', sign: -1 },
    { text: 'I lose track of where I put things.', sign: -1 },
    { text: 'I start many things and drop some.', sign: -1 },
    { text: 'I keep a list and tick things off.', sign: 1 },
  ],
  e: [
    { text: 'I feel full of energy around other people.', sign: 1 },
    { text: 'I start conversations easily.', sign: 1 },
    { text: 'I like being the one who gets things moving.', sign: 1 },
    { text: 'I share my feelings out loud.', sign: 1 },
    { text: 'I am happy in a big, busy group.', sign: 1 },
    { text: 'I say yes to new invitations.', sign: 1 },
    { text: 'I need quiet time alone to recharge.', sign: -1 },
    { text: 'I think a lot before I speak.', sign: -1 },
    { text: 'I keep my private life to myself.', sign: -1 },
    { text: 'Big crowds tire me out.', sign: -1 },
    { text: 'I am the first to speak up in a group.', sign: 1 },
  ],
  a: [
    { text: 'I notice when someone needs help.', sign: 1 },
    { text: 'I look for the good in people.', sign: 1 },
    { text: 'I give way to keep the peace.', sign: 1 },
    { text: 'I listen without rushing to fix things.', sign: 1 },
    { text: 'I trust people until they show me otherwise.', sign: 1 },
    { text: 'I share credit easily.', sign: 1 },
    { text: 'I say what I think, even when it stings.', sign: -1 },
    { text: 'I like to win an argument.', sign: -1 },
    { text: 'I do not mind being disliked.', sign: -1 },
    { text: 'I find it hard to forgive and forget.', sign: -1 },
    { text: 'I put other people’s needs first.', sign: 1 },
  ],
  s: [
    { text: 'I stay calm when things go wrong.', sign: 1 },
    { text: 'I bounce back quickly after a bad day.', sign: 1 },
    { text: 'I rarely worry about what might happen.', sign: 1 },
    { text: 'I sleep well even before big days.', sign: 1 },
    { text: 'Criticism rarely ruins my mood.', sign: 1 },
    { text: 'I feel at ease with who I am.', sign: 1 },
    { text: 'I replay mistakes in my head.', sign: -1 },
    { text: 'My mood can swing from hour to hour.', sign: -1 },
    { text: 'I get nervous before I share my work.', sign: -1 },
    { text: 'Small problems can feel very big to me.', sign: -1 },
  ],
};

export const DISCOVER_STATEMENTS: Record<string, DiscoverStatement> = Object.fromEntries(
  (Object.keys(STATEMENT_TEXT) as Trait[]).flatMap((t) => STATEMENT_TEXT[t].map((s, i) => [`${t}${i + 1}`, { id: `${t}${i + 1}`, trait: t, sign: s.sign, text: s.text }] as const)),
);

/** Eighteen groups of three statements from three different traits, so a pick always says something. */
export const DISCOVER_TRIADS: readonly (readonly [string, string, string])[] = [
  ['e8', 'a7', 's1'], ['o10', 'c5', 's7'], ['a4', 'c7', 's3'], ['a1', 's10', 'o2'], ['o11', 'e10', 'a5'], ['a10', 'o6', 'c3'],
  ['c2', 'e5', 'o3'], ['a6', 'c10', 'e3'], ['o9', 'e11', 's5'], ['e6', 'a3', 'c9'], ['s4', 'a9', 'c11'], ['c6', 'o4', 's9'],
  ['c8', 'e9', 's2'], ['s6', 'a2', 'o5'], ['o8', 'e1', 'a8'], ['o7', 'c4', 'e2'], ['e7', 'o1', 'a11'], ['s8', 'c1', 'e4'],
];

export interface DiscoverWord {
  trait: Trait;
  sign: 1 | -1;
  text: string;
}
/** Three lists of ten words, two from each trait in each list. */
export const DISCOVER_WORDS: readonly (readonly DiscoverWord[])[] = [
  [['Curious', 'o', 1], ['Reserved', 'e', -1], ['Calm', 's', 1], ['Scattered', 'c', -1], ['Kind', 'a', 1], ['Traditional', 'o', -1], ['Anxious', 's', -1], ['Outgoing', 'e', 1], ['Blunt', 'a', -1], ['Organized', 'c', 1]],
  [['Moody', 's', -1], ['Generous', 'a', 1], ['Literal', 'o', -1], ['Talkative', 'e', 1], ['Impulsive', 'c', -1], ['Steady', 's', 1], ['Quiet', 'e', -1], ['Imaginative', 'o', 1], ['Stubborn', 'a', -1], ['Reliable', 'c', 1]],
  [['Patient', 'a', 1], ['Energetic', 'e', 1], ['Thorough', 'c', 1], ['Inventive', 'o', 1], ['Relaxed', 's', 1], ['Disciplined', 'c', 1], ['Supportive', 'a', 1], ['Creative', 'o', 1], ['Cheerful', 'e', 1], ['Resilient', 's', 1]],
].map((list) => list.map(([text, trait, sign]) => ({ text: text as string, trait: trait as Trait, sign: sign as 1 | -1 })));

export interface DiscoverScene {
  situation: string;
  /** The options, as people read them. */
  options: readonly string[];
  /** How effective each option is, 1 (least) to 4 (most), from the team's own reading of the situation. */
  key: readonly number[];
}
export const DISCOVER_SCENES: readonly DiscoverScene[] = [
  {
    situation: 'A brand asks you to redo a video you thought was finished. You think the notes are unfair. What would you do?',
    options: ['Redo it quickly and say nothing, to keep them happy.', 'Ask what the main goal is, fix the notes that serve it and explain the ones that do not.', 'Tell them the video was fine and the notes are wrong.', 'Thank them, say you will review it, and reply tomorrow with what you can do.'],
    key: [2, 4, 1, 3],
  },
  {
    situation: 'A close friend keeps cancelling plans at the last minute, and you feel hurt. What would you do?',
    options: ['Stop inviting them.', 'Tell them kindly that it hurts and ask what is going on.', 'Keep making plans and say it is fine, even though it is not.', 'Suggest a smaller, easier plan and see how they respond.'],
    key: [1, 4, 2, 3],
  },
  {
    situation: 'A teammate presents your idea in a meeting as if it were theirs. What would you do?',
    options: ['Say in the meeting, “Glad you liked my idea.”', 'Talk to them privately, say what you noticed and ask them to credit you next time.', 'Let it go. It does not matter.', 'Share your next idea in writing with the whole team first.'],
    key: [2, 4, 1, 3],
  },
  {
    situation: 'Your partner says you are always on your phone. You are in the middle of a launch and stressed. What would you do?',
    options: ['Say you are busy and it will pass.', 'Agree it is true, say when the launch ends and set one phone-free hour each evening.', 'Snap: “I am doing this for us.”', 'Put the phone away for the night but feel resentful.'],
    key: [2, 4, 1, 3],
  },
  {
    situation: 'A younger sibling asks for help just as you are up against a deadline. What would you do?',
    options: ['Say “not now” and close the door.', 'Stop work and help for a long time, then rush the deadline.', 'Say you can give ten minutes now and a full hour once you have finished.', 'Pass them on to someone else.'],
    key: [1, 2, 4, 3],
  },
  {
    situation: 'A mentor gives you harsh but useful feedback on your work. What would you do?',
    options: ['Defend each point.', 'Thank them, write the points down and pick one to act on this week.', 'Take it all in and change a few things right away.', 'Feel hurt and avoid them for a while.'],
    key: [2, 4, 3, 1],
  },
];

// ---- puzzles: made by code from fixed seeds, so the same bank every time and no answer key to keep ----

export type PuzzleKind = 'dice' | 'turn' | 'grid' | 'numbers' | 'odd';
export interface PuzzleCell {
  /** A dice face, 1 to 6. */
  n?: number;
  /** A quarter turn, 0 to 3, and a count of dots. */
  rot?: number;
  dots?: number;
  /** A 3 by 3 pattern of 9 bits. */
  mask?: number;
  /** A number in a series. */
  text?: string;
}
export interface DiscoverPuzzle {
  id: number;
  /** 1 (easy) to 5 (hard). The quiz moves up after a right answer and down after a wrong one. */
  level: 1 | 2 | 3 | 4 | 5;
  kind: PuzzleKind;
  /** Cells per row. The cell that is null is the one to find. */
  cols: number;
  prompt: string;
  cells: (PuzzleCell | null)[];
  options: PuzzleCell[];
  answer: number;
}
type Made = Omit<DiscoverPuzzle, 'id' | 'level'>;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mixed<T>(list: readonly T[], r: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
const cellKey = (c: PuzzleCell) => `${c.n ?? ''}|${c.rot ?? ''}|${c.dots ?? ''}|${c.mask ?? ''}|${c.text ?? ''}`;
const NEXT_PROMPT = 'Tap the piece that should come next.';
function withAnswer(kind: PuzzleKind, cols: number, cells: (PuzzleCell | null)[], right: PuzzleCell, wrong: PuzzleCell[], r: () => number, prompt = NEXT_PROMPT): Made {
  const seen = new Set([cellKey(right)]);
  const rest = wrong.filter((w) => !seen.has(cellKey(w)) && seen.add(cellKey(w))).slice(0, 4);
  const options = mixed([right, ...rest], r);
  return { kind, cols, prompt, cells, options, answer: options.findIndex((o) => cellKey(o) === cellKey(right)) };
}

function diceLatin(seed: number): Made {
  const r = seeded(seed);
  const base = mixed([1, 2, 3, 4, 5, 6], r).slice(0, 3);
  const grid = [0, 1, 2].map((row) => base.map((_, c) => base[(c + row) % 3]!));
  const right = { n: grid[2]![2]! };
  const cells = grid.flat().map((n, i) => (i === 8 ? null : { n }));
  const wrong = [1, 2, 3, 4, 5, 6].filter((n) => n !== right.n).map((n) => ({ n }));
  return withAnswer('dice', 3, cells, right, mixed(wrong, r), r);
}
function diceSum(seed: number): Made {
  const r = seeded(seed);
  const rows = [0, 1, 2].map(() => {
    const x = 1 + Math.floor(r() * 3);
    const y = 1 + Math.floor(r() * 3);
    return [x, y, x + y];
  });
  const right = { n: rows[2]![2]! };
  const cells = rows.flat().map((n, i) => (i === 8 ? null : { n }));
  const wrong = [1, 2, 3, 4, 5, 6].filter((n) => n !== right.n).sort((a, b) => Math.abs(a - right.n) - Math.abs(b - right.n)).map((n) => ({ n }));
  return withAnswer('dice', 3, cells, right, wrong, r);
}
function turned(seed: number, hard: boolean): Made {
  const r = seeded(seed);
  const rot0 = Math.floor(r() * 4);
  const step = 1 + Math.floor(r() * 3);
  const d0 = 1 + Math.floor(r() * 2);
  const at = (i: number): PuzzleCell => ({ rot: (rot0 + step * i) % 4, dots: hard ? d0 + (i % 3) : d0 + Math.min(i, 2) });
  const right = at(4);
  const wrong: PuzzleCell[] = [
    { rot: (right.rot! + 1) % 4, dots: right.dots },
    { rot: (right.rot! + 2) % 4, dots: right.dots },
    { rot: (right.rot! + 3) % 4, dots: right.dots },
    { rot: right.rot, dots: right.dots! + 1 },
    { rot: right.rot, dots: Math.max(1, right.dots! - 1) },
  ];
  return withAnswer('turn', 5, [at(0), at(1), at(2), at(3), null], right, wrong, r);
}
/** A quarter turn of a 3 by 3 pattern. */
const turnMask = (m: number) => {
  let out = 0;
  for (let b = 0; b < 9; b += 1) if ((m >> b) & 1) out |= 1 << (((b % 3) * 3) + (2 - Math.floor(b / 3)));
  return out;
};
function gridRule(seed: number, rule: 'xor' | 'or' | 'turn'): Made {
  const r = seeded(seed);
  const rows = [0, 1, 2].map(() => {
    const a = 1 + Math.floor(r() * 510);
    const b = 1 + Math.floor(r() * 510);
    return [a, b, (rule === 'xor' ? a ^ b : rule === 'or' ? a | b : turnMask(a) ^ b) || 1];
  });
  const right = { mask: rows[2]![2]! };
  const cells = rows.flat().map((mask, i) => (i === 8 ? null : { mask }));
  const bits = mixed([0, 1, 2, 3, 4, 5, 6, 7, 8], r);
  const wrong = bits.map((b) => ({ mask: (right.mask ^ (1 << b)) || 511 }));
  return withAnswer('grid', 3, cells, right, wrong, r);
}
/** A short number series with one gap at the end. Harder levels use bigger ideas than adding the same step. */
function numbers(seed: number, level: number): Made {
  const r = seeded(seed);
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  let seq: number[];
  let trap: number | null = null;
  if (level <= 1) {
    const s = int(2, 9);
    const d = int(2, 5);
    seq = [0, 1, 2, 3, 4].map((i) => s + d * i);
  } else if (level === 2) {
    const s = int(1, 4);
    const k = int(2, 3);
    seq = [0, 1, 2, 3, 4].map((i) => s * k ** i);
  } else if (level === 3) {
    const s = int(1, 6);
    const d = int(2, 3);
    seq = [s];
    for (let i = 1; i < 5; i += 1) seq.push(seq[i - 1]! + d + (i - 1));
    trap = seq[3]! + (seq[3]! - seq[2]!);
  } else if (level === 4) {
    seq = [int(1, 3), int(2, 4)];
    for (let i = 2; i < 5; i += 1) seq.push(seq[i - 1]! + seq[i - 2]!);
  } else {
    const s1 = int(2, 6);
    const d1 = int(2, 4);
    const s2 = int(20, 30);
    const d2 = int(3, 5);
    seq = [0, 1, 2, 3, 4, 5].map((i) => (i % 2 === 0 ? s1 + d1 * (i / 2) : s2 - d2 * ((i - 1) / 2)));
  }
  const right = seq[seq.length - 1]!;
  const shown = seq.slice(0, -1).map((v) => ({ text: String(v) }));
  const near = [trap, right + 1, right - 1, right + 2, right - 2, right + 3, right - 3, right * 2].filter((v): v is number => v !== null && v > 0);
  return withAnswer('numbers', shown.length + 1, [...shown, null], { text: String(right) }, near.map((v) => ({ text: String(v) })), r, 'Tap the number that comes next.');
}
/** Five dice faces, four follow a rule and one does not. Tap the one that does not belong. */
function oddOne(seed: number, level: number): Made {
  const r = seeded(seed);
  const groups = level <= 1 ? [[2, 4, 6], [1, 3, 5]] : level === 2 ? [[4, 5, 6], [1, 2, 3]] : [[3, 6], [1, 2, 4, 5]];
  const flip = r() < 0.5;
  const major = groups[flip ? 1 : 0]!;
  const minor = groups[flip ? 0 : 1]!;
  const odd = minor[Math.floor(r() * minor.length)]!;
  const faces = [...Array.from({ length: 4 }, () => major[Math.floor(r() * major.length)]!), odd];
  const order = mixed([0, 1, 2, 3, 4], r);
  return { kind: 'odd', cols: 5, prompt: 'Tap the one that does not belong.', cells: [], options: order.map((i) => ({ n: faces[i]! })), answer: order.indexOf(4) };
}

const SPEC: [() => Made, DiscoverPuzzle['level']][] = [
  [() => diceLatin(101), 1], [() => numbers(102, 1), 1], [() => oddOne(103, 1), 1], [() => numbers(104, 1), 1], [() => diceSum(105), 1], [() => turned(106, false), 1],
  [() => numbers(201, 2), 2], [() => oddOne(202, 2), 2], [() => diceLatin(203), 2], [() => numbers(204, 2), 2], [() => turned(205, false), 2], [() => diceSum(206), 2],
  [() => gridRule(301, 'xor'), 3], [() => numbers(302, 3), 3], [() => oddOne(303, 3), 3], [() => gridRule(304, 'or'), 3], [() => numbers(305, 3), 3], [() => turned(306, true), 3],
  [() => gridRule(401, 'xor'), 4], [() => numbers(402, 4), 4], [() => gridRule(403, 'or'), 4], [() => numbers(404, 4), 4], [() => turned(405, true), 4], [() => gridRule(406, 'turn'), 4],
  [() => gridRule(501, 'turn'), 5], [() => numbers(502, 5), 5], [() => gridRule(503, 'turn'), 5], [() => numbers(504, 5), 5], [() => turned(505, true), 5], [() => gridRule(506, 'xor'), 5],
];
/** Thirty puzzles, six at each of five levels. A person sees twelve. */
export const DISCOVER_BANK: readonly DiscoverPuzzle[] = SPEC.map(([make, level], id) => ({ id, level, ...make() }));
export const PUZZLES_SHOWN = 12;

function pickPuzzle(level: number, seen: ReadonlySet<number>): DiscoverPuzzle {
  for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const lv = level + d;
    const hit = lv >= 1 && lv <= 5 ? DISCOVER_BANK.find((p) => p.level === lv && !seen.has(p.id)) : undefined;
    if (hit) return hit;
  }
  return DISCOVER_BANK[0]!;
}
/**
 * The twelve puzzles one person sees, which depend on how they answered the ones before: start in the middle, go up a level
 * after a right answer and down after a wrong one (or a skipped one). The same answers always give the same twelve.
 */
export function puzzleSequence(picks: readonly (number | null)[], count = PUZZLES_SHOWN): { puzzle: DiscoverPuzzle; pick: number | null }[] {
  let level = 3;
  const seen = new Set<number>();
  const out: { puzzle: DiscoverPuzzle; pick: number | null }[] = [];
  for (let i = 0; i < count; i += 1) {
    const puzzle = pickPuzzle(level, seen);
    seen.add(puzzle.id);
    const pick = picks[i] ?? null;
    out.push({ puzzle, pick });
    level = pick !== null && pick === puzzle.answer ? Math.min(5, level + 1) : Math.max(1, level - 1);
  }
  return out;
}
export const puzzleAt = (picks: readonly (number | null)[], i: number): DiscoverPuzzle => puzzleSequence(picks, i + 1)[i]!.puzzle;

// ---- emotional intelligence: five parts, three kinds of question (how you see yourself, reading people, handling situations) ----

export type EqDim = 'a' | 'm' | 'd' | 'e' | 's';
export const EQ_DIMS: readonly { key: EqDim; name: string; blurb: string; helps: RelationshipKey }[] = [
  { key: 'a', name: 'Knowing your feelings', blurb: 'Noticing what you feel, and why.', helps: 'self' },
  { key: 'm', name: 'Handling your feelings', blurb: 'Staying steady when feelings run high.', helps: 'lover_partner' },
  { key: 'd', name: 'Staying motivated', blurb: 'Keeping going toward what matters.', helps: 'servant_leader' },
  { key: 'e', name: 'Reading other people', blurb: 'Sensing how someone feels and seeing their side.', helps: 'parent_child' },
  { key: 's', name: 'Handling relationships', blurb: 'Talking things through, asking for help and staying close.', helps: 'friendship' },
];

/** Twenty statements to rate from "not like me" to "very like me": four screens of five, one from each part. */
export const EQ_FEELINGS: readonly (readonly { dim: EqDim; sign: 1 | -1; text: string }[])[] = [
  [
    { dim: 'a', sign: 1, text: 'I can usually name what I am feeling.' },
    { dim: 'm', sign: 1, text: 'I stay in control when I am angry.' },
    { dim: 'd', sign: 1, text: 'I keep going when a goal gets hard.' },
    { dim: 'e', sign: 1, text: 'I can tell how someone feels before they say it.' },
    { dim: 's', sign: 1, text: 'I can disagree without hurting the relationship.' },
  ],
  [
    { dim: 'a', sign: 1, text: 'I notice how my body reacts when I am stressed.' },
    { dim: 'm', sign: 1, text: 'I can calm myself down when I am upset.' },
    { dim: 'd', sign: 1, text: 'I set goals that matter to me.' },
    { dim: 'e', sign: 1, text: 'I find it easy to see things from another person’s side.' },
    { dim: 's', sign: 1, text: 'I make new people feel welcome.' },
  ],
  [
    { dim: 'a', sign: -1, text: 'My own moods often surprise me.' },
    { dim: 'm', sign: -1, text: 'I say things I regret when I am upset.' },
    { dim: 'd', sign: -1, text: 'I give up quickly when I do not see results.' },
    { dim: 'e', sign: -1, text: 'I often miss it when someone is upset.' },
    { dim: 's', sign: -1, text: 'I put off hard talks until they get worse.' },
  ],
  [
    { dim: 'a', sign: 1, text: 'I know what sets me off.' },
    { dim: 'm', sign: 1, text: 'I can wait for what I want without rushing.' },
    { dim: 'd', sign: 1, text: 'I find ways to stay hopeful after a setback.' },
    { dim: 'e', sign: 1, text: 'People tell me I listen well.' },
    { dim: 's', sign: 1, text: 'I know how to ask for help.' },
  ],
];
export const EQ_SCALE = ['Not like me', 'A little like me', 'Somewhat like me', 'Quite like me', 'Very like me'] as const;

/** Six short scenes: what is the person feeling? */
export const EQ_READING: readonly { scene: string; options: readonly string[]; key: number }[] = [
  { scene: 'Sam goes quiet after being left out of a group chat, and says, “It’s fine.”', options: ['Excited', 'Hurt', 'Bored', 'Proud'], key: 1 },
  { scene: 'Ana’s hands shake before she goes on stage, but she smiles and says she can’t wait.', options: ['Angry', 'Sad', 'Nervous and excited', 'Calm and sure'], key: 2 },
  { scene: 'Ravi just won a small award. He looks around the room to see who noticed.', options: ['Guilty', 'Proud', 'Afraid', 'Bored'], key: 1 },
  { scene: 'Mia snaps at everyone the day before an exam, then says sorry and sits alone.', options: ['Joyful', 'Jealous', 'Calm', 'Stressed'], key: 3 },
  { scene: 'Leo hears his friend say, “Sorry, I forgot your birthday,” and looks at the floor.', options: ['Relieved', 'Disappointed', 'Amused', 'Proud'], key: 1 },
  { scene: 'Priya is asked to lead the team and says yes quickly, then goes to wash her face.', options: ['Bored', 'Angry', 'Nervous and overwhelmed', 'Sad'], key: 2 },
];

/** Eight situations, each tagged with the part it tests. Keyed 1 (least) to 4 (most effective) by the team. */
export const EQ_PEOPLE: readonly { dim: EqDim; situation: string; options: readonly string[]; key: readonly number[] }[] = [
  { dim: 'm', situation: 'You get harsh feedback on something you worked hard on, and your face goes hot. What do you do first?', options: ['Reply right away to defend yourself.', 'Take a breath, wait an hour, then read it again.', 'Quietly decide the person is wrong.', 'Agree with everything to end the talk.'], key: [1, 4, 2, 2] },
  { dim: 'a', situation: 'You feel low all day for no clear reason. What helps most?', options: ['Scroll until it passes.', 'Push on and ignore it.', 'Stop, and ask what happened today and what you need.', 'Snap at someone to feel better.'], key: [1, 2, 4, 1] },
  { dim: 'd', situation: 'Your video flops after weeks of work. What do you do?', options: ['Blame the algorithm.', 'Delete it and say nothing.', 'Quit the format.', 'Study what worked in better ones, change one thing and post again.'], key: [2, 2, 1, 4] },
  { dim: 'e', situation: 'A friend cancels plans again and says they are “just tired”. Their voice sounds flat.', options: ['Tell them they are always flaky.', 'Say “fine” and move on.', 'Ask if something else is going on and offer a quieter plan.', 'Stop texting until they text first.'], key: [1, 2, 4, 2] },
  { dim: 's', situation: 'Two people on your team argue, and both look at you.', options: ['Leave the room.', 'Tell them to stop.', 'Pick the side you like.', 'Let each finish, ask what each needs and look for the overlap.'], key: [2, 2, 1, 4] },
  { dim: 'a', situation: 'You notice you have been short with your partner all week because of work stress.', options: ['Say sorry, explain the stress without blaming them and plan time together.', 'Hope they have not noticed.', 'Explain that work comes first.', 'Ask them to be more understanding.'], key: [4, 1, 2, 2] },
  { dim: 'd', situation: 'You are two weeks into a new habit and miss a day.', options: ['Double it tomorrow to catch up.', 'Count the whole thing as failed.', 'Wait for next Monday to restart.', 'Note why you missed and do the next day as planned.'], key: [2, 1, 2, 4] },
  { dim: 's', situation: 'Someone tells you something private and starts to cry.', options: ['Change the subject to cheer them up.', 'Offer a quick fix.', 'Stay with them, listen and say you are glad they told you.', 'Tell them it is not a big deal.'], key: [2, 3, 4, 1] },
];

// ---- the eight parts, the answers and the scoring ----

export const DISCOVER_SECTIONS: readonly { key: 'priorities' | 'puzzles1' | 'words' | 'puzzles2' | 'scenes' | 'feelings' | 'reading' | 'people'; name: string; count: number; blurb: string; /** Part of the emotional intelligence add-on, which can be left out. */ optional?: boolean }[] = [
  { key: 'priorities', name: 'Priorities and preferences', count: DISCOVER_TRIADS.length, blurb: 'Each question has three statements. Pick the one that is most like you and the one that is least like you. Some may fit you and others may not, and that is fine.' },
  { key: 'puzzles1', name: 'Puzzles, part 1', count: 6, blurb: 'Now for something different. Look at each picture and pick the answer. There is no time limit, but go with your first good guess. The puzzles get harder when you do well and easier when you do not.' },
  { key: 'words', name: 'You, in words', count: DISCOVER_WORDS.length, blurb: 'Each question has ten words. Pick three that are most like you and three that are least like you. A word cannot be both.' },
  { key: 'puzzles2', name: 'Puzzles, part 2', count: 6, blurb: 'Same as before. The puzzles keep adjusting to you.' },
  { key: 'scenes', name: 'Real situations', count: DISCOVER_SCENES.length, blurb: 'Read each situation. Pick the response you think is the most effective and the one you think is the least effective.' },
  { key: 'feelings', name: 'Your feelings', count: EQ_FEELINGS.length, optional: true, blurb: 'Rate how much each line is like you, from not like me to very like me. Go with how you are most days, not your best or worst day.' },
  { key: 'reading', name: 'Reading people', count: EQ_READING.length, optional: true, blurb: 'Each question is a short scene. Pick the feeling that fits the person best.' },
  { key: 'people', name: 'With people', count: EQ_PEOPLE.length, optional: true, blurb: 'Read each situation. Pick the response you think is the most effective and the one you think is the least effective.' },
];
export const DISCOVER_STEPS = DISCOVER_SECTIONS.reduce((n, s) => n + s.count, 0);
/** The steps before the emotional intelligence add-on. */
export const DISCOVER_CORE_STEPS = DISCOVER_SECTIONS.filter((s) => !s.optional).reduce((n, s) => n + s.count, 0);

export interface DiscoverAnswers {
  triads: ({ most: number; least: number } | null)[];
  /** The pick for each of the twelve puzzles shown, and how long each took in milliseconds. */
  puzzles: (number | null)[];
  puzzleMs: (number | null)[];
  words: ({ most: number[]; least: number[] } | null)[];
  scenes: ({ most: number; least: number } | null)[];
  /** For each screen of statements, a rating from 0 to 4 for each. */
  feelings: (number[] | null)[];
  reading: (number | null)[];
  people: ({ most: number; least: number } | null)[];
}
export const emptyDiscoverAnswers = (): DiscoverAnswers => ({
  triads: DISCOVER_TRIADS.map(() => null),
  puzzles: Array.from({ length: PUZZLES_SHOWN }, () => null),
  puzzleMs: Array.from({ length: PUZZLES_SHOWN }, () => null),
  words: DISCOVER_WORDS.map(() => null),
  scenes: DISCOVER_SCENES.map(() => null),
  feelings: EQ_FEELINGS.map(() => null),
  reading: EQ_READING.map(() => null),
  people: EQ_PEOPLE.map(() => null),
});

const intIn = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < max;
/** The one reader for saved or sent answers: anything that is not a clean answer becomes "not answered yet". */
export function parseDiscoverAnswers(raw: unknown): DiscoverAnswers {
  const out = emptyDiscoverAnswers();
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const arr = (k: string): unknown[] => (Array.isArray(o[k]) ? (o[k] as unknown[]) : []);
  const pair = (v: unknown, max: number) => {
    const t = v as { most?: unknown; least?: unknown } | null;
    return t && intIn(t.most, max) && intIn(t.least, max) && t.most !== t.least ? { most: t.most, least: t.least } : null;
  };
  arr('triads').slice(0, out.triads.length).forEach((v, i) => (out.triads[i] = pair(v, 3)));
  arr('puzzles').slice(0, out.puzzles.length).forEach((v, i) => {
    if (intIn(v, 5)) out.puzzles[i] = v;
  });
  arr('puzzleMs').slice(0, out.puzzleMs.length).forEach((v, i) => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 600_000) out.puzzleMs[i] = Math.round(v);
  });
  arr('words').slice(0, out.words.length).forEach((v, i) => {
    const w = v as { most?: unknown; least?: unknown } | null;
    const most = Array.isArray(w?.most) ? (w!.most as unknown[]) : [];
    const least = Array.isArray(w?.least) ? (w!.least as unknown[]) : [];
    const all = [...most, ...least];
    if (most.length === 3 && least.length === 3 && all.every((x) => intIn(x, 10)) && new Set(all).size === 6) out.words[i] = { most: most as number[], least: least as number[] };
  });
  arr('scenes').slice(0, out.scenes.length).forEach((v, i) => (out.scenes[i] = pair(v, 4)));
  arr('feelings').slice(0, out.feelings.length).forEach((v, i) => {
    if (Array.isArray(v) && v.length === EQ_FEELINGS[i]!.length && v.every((x) => intIn(x, 5))) out.feelings[i] = v as number[];
  });
  arr('reading').slice(0, out.reading.length).forEach((v, i) => {
    if (intIn(v, 4)) out.reading[i] = v;
  });
  arr('people').slice(0, out.people.length).forEach((v, i) => (out.people[i] = pair(v, 4)));
  return out;
}

/** How many steps are answered, in all and part by part. */
export function discoverProgress(a: DiscoverAnswers): { done: number; total: number; core: { done: number; total: number }; parts: { key: string; done: number; count: number; optional: boolean }[] } {
  const done = {
    priorities: a.triads.filter(Boolean).length,
    puzzles1: a.puzzles.slice(0, 6).filter((x) => x !== null).length,
    words: a.words.filter(Boolean).length,
    puzzles2: a.puzzles.slice(6).filter((x) => x !== null).length,
    scenes: a.scenes.filter(Boolean).length,
    feelings: a.feelings.filter(Boolean).length,
    reading: a.reading.filter((x) => x !== null).length,
    people: a.people.filter(Boolean).length,
  };
  const parts = DISCOVER_SECTIONS.map((s) => ({ key: s.key, done: done[s.key], count: s.count, optional: Boolean(s.optional) }));
  return { done: parts.reduce((n, p) => n + p.done, 0), total: DISCOVER_STEPS, core: { done: parts.filter((p) => !p.optional).reduce((n, p) => n + p.done, 0), total: DISCOVER_CORE_STEPS }, parts };
}

/** What each strength means, in plain words. One strength for each of the seven relationships. */
export const DISCOVER_STRENGTHS: Record<RelationshipKey, { name: string; line: string; use: string; watch: string; tryThis: string }> = {
  servant_leader: { name: 'Getting it done', line: 'You turn plans into finished work.', use: 'Take the project that needs an owner. People trust you with deadlines.', watch: 'Doing everything yourself. Ask for help before you are tired.', tryThis: 'Pick one project this week and write its finish line on a card.' },
  friendship: { name: 'Connecting', line: 'You make it easy for people to be around you.', use: 'Introduce two people who should know each other. You are the glue of a group.', watch: 'Saying yes to every plan. Protect some time for yourself.', tryThis: 'Message one friend you have not heard from in a month.' },
  parent_child: { name: 'Caring', line: 'You notice what the people close to you need.', use: 'Be the one who checks in. Families and teams run on this.', watch: 'Putting your own needs last until you run dry.', tryThis: 'Ask one person at home how they are, then just listen for two minutes.' },
  lover_partner: { name: 'Opening up', line: 'You can be honest about what you feel, and steady when others are.', use: 'Say the true thing kindly. Closeness grows when someone goes first.', watch: 'Waiting for the perfect moment. Small honest talks work better.', tryThis: 'Tell someone you trust one thing you appreciate about them.' },
  self: { name: 'Knowing yourself', line: 'You stay level and you know what you value.', use: 'Use your calm to make clear choices when others are rushed.', watch: 'Hiding in routine. Check that your days still match what you want.', tryThis: 'Write three lines in your journal tonight: what went well, what was hard, what you want tomorrow.' },
  guru: { name: 'Learning', line: 'You pick up ideas fast and enjoy working things out.', use: 'Teach what you learn. Explaining it makes it yours.', watch: 'Learning without doing. Turn one idea into one action.', tryThis: 'Pick one lesson in School and finish it this week.' },
  divine: { name: 'Finding meaning', line: 'You look for the bigger reason behind things and stay calm about it.', use: 'Pause and ask why. Your sense of purpose steadies people.', watch: 'Waiting for a sign. Choose a small practice and keep it.', tryThis: 'Spend ten quiet minutes in a practice that matters to you.' },
};

/** How much each measure feeds each strength. Every row adds up to 1. The measures: the five traits, puzzles (p) and situations (j). */
export const DISCOVER_WEIGHTS: Record<RelationshipKey, Record<Trait | 'p' | 'j', number>> = {
  servant_leader: { o: 0, c: 0.35, e: 0.1, a: 0.1, s: 0.15, p: 0.15, j: 0.15 },
  friendship: { o: 0.1, c: 0, e: 0.3, a: 0.3, s: 0.1, p: 0, j: 0.2 },
  parent_child: { o: 0, c: 0.2, e: 0.1, a: 0.35, s: 0.2, p: 0, j: 0.15 },
  lover_partner: { o: 0.15, c: 0, e: 0.1, a: 0.3, s: 0.25, p: 0, j: 0.2 },
  self: { o: 0.25, c: 0.2, e: 0, a: 0, s: 0.3, p: 0.1, j: 0.15 },
  guru: { o: 0.35, c: 0.15, e: 0, a: 0.1, s: 0, p: 0.25, j: 0.15 },
  divine: { o: 0.3, c: 0.1, e: 0, a: 0.2, s: 0.25, p: 0, j: 0.15 },
};

export interface EqResult {
  /** For each part: the mix of how you see yourself and how you chose in situations, 0 to 100. */
  dims: Record<EqDim, { score: number; self: number; ability: number }>;
  overall: number;
  reading: { right: number; of: number };
}

export interface DiscoverResult {
  /** 0 to 100 for each trait, you against your own scale. */
  traits: Record<Trait, number>;
  puzzles: {
    right: number;
    of: number;
    score: number;
    /** Where the puzzles settled, 1 to 5. Results taken before the puzzles adjusted do not have it. */
    level?: number;
    /** Right answers by kind of puzzle, and in the first and second six. */
    byKind?: Partial<Record<PuzzleKind, { right: number; of: number }>>;
    parts?: [number, number];
    /** The middle time for one puzzle, in seconds, when it was measured. */
    medianSeconds?: number | null;
  };
  /** 0 to 100: how closely your picks match the team's reading of each situation. */
  judgment: number;
  /** All seven, best first. */
  strengths: { key: RelationshipKey; score: number }[];
  top: RelationshipKey[];
  growth: RelationshipKey;
  /** Only when the emotional intelligence part was answered in full. */
  eq?: EqResult;
}

const answered = (...xs: (unknown | null)[][]) => xs.every((x) => x.every((v) => v !== null));
/** The five core parts, which are all a result needs. */
export function discoverComplete(a: DiscoverAnswers): boolean {
  return answered(a.triads, a.puzzles, a.words, a.scenes);
}
/** The emotional intelligence add-on. */
export function eqComplete(a: DiscoverAnswers): boolean {
  return answered(a.feelings, a.reading, a.people);
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const mean = (xs: number[]) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0);

/** The reasoning side: the staircase the puzzles walked, and where it settled. */
export function puzzleSummary(a: DiscoverAnswers): NonNullable<DiscoverResult['puzzles']> {
  const seq = puzzleSequence(a.puzzles);
  const byKind: Partial<Record<PuzzleKind, { right: number; of: number }>> = {};
  const parts: [number, number] = [0, 0];
  let right = 0;
  seq.forEach(({ puzzle, pick }, i) => {
    const k = (byKind[puzzle.kind] ??= { right: 0, of: 0 });
    k.of += 1;
    if (pick === puzzle.answer) {
      right += 1;
      k.right += 1;
      parts[i < 6 ? 0 : 1] += 1;
    }
  });
  const last = seq[seq.length - 1]!;
  const est = Math.max(1, Math.min(5, mean(seq.slice(4).map((s) => s.puzzle.level)) + (last.pick === last.puzzle.answer ? 0.5 : -0.5)));
  const times = a.puzzleMs.filter((x): x is number => x !== null && x > 0).sort((x, y) => x - y);
  const medianSeconds = times.length ? Math.round((times[Math.floor((times.length - 1) / 2)]! / 1000) * 10) / 10 : null;
  return { right, of: seq.length, score: clamp100(((est - 1) / 4) * 100), level: Math.round(est * 10) / 10, byKind, parts, medianSeconds };
}

/** Emotional intelligence: each part is half how you see yourself and half how you chose in the situations (and, for reading people, the scenes). */
export function scoreEq(a: DiscoverAnswers): EqResult {
  const self: Record<EqDim, number[]> = { a: [], m: [], d: [], e: [], s: [] };
  EQ_FEELINGS.forEach((screen, i) =>
    screen.forEach((item, k) => {
      const v = a.feelings[i]?.[k];
      if (v !== undefined) self[item.dim].push(((item.sign === 1 ? v : 4 - v) / 4) * 100);
    }),
  );
  const sj: Record<EqDim, number[]> = { a: [], m: [], d: [], e: [], s: [] };
  EQ_PEOPLE.forEach((q, i) => {
    const pick = a.people[i];
    if (pick) sj[q.dim].push(((q.key[pick.most]! - q.key[pick.least]! + 3) / 6) * 100);
  });
  const readRight = EQ_READING.filter((q, i) => a.reading[i] === q.key).length;
  const dims = Object.fromEntries(
    EQ_DIMS.map((d) => {
      const s = mean(self[d.key]);
      const sjt = mean(sj[d.key]);
      const ability = d.key === 'e' ? 0.5 * sjt + 0.5 * (readRight / EQ_READING.length) * 100 : sjt;
      return [d.key, { score: clamp100(0.5 * s + 0.5 * ability), self: clamp100(s), ability: clamp100(ability) }];
    }),
  ) as Record<EqDim, { score: number; self: number; ability: number }>;
  return { dims, overall: clamp100(mean(EQ_DIMS.map((d) => dims[d.key].score))), reading: { right: readRight, of: EQ_READING.length } };
}

/**
 * The scoring. Traits: each "most" pick adds a point towards the statement's trait (or takes one away when the statement
 * says the opposite), each "least" pick does the reverse; the total is shared by how often the trait was on offer, in the
 * statements (60%) and the words (40%), and centred on 50. Puzzles: twelve that move up after a right answer and down after
 * a wrong one; the score is where they settle, from level 1 to level 5. Situations: for each one, the key of your "most
 * effective" pick minus the key of your "least effective" pick, over its best case of 3. Strengths: the weights in
 * DISCOVER_WEIGHTS over those numbers. Emotional intelligence, when answered, is scored on its own (scoreEq). No number
 * is compared with other people.
 */
export function scoreDiscover(a: DiscoverAnswers): DiscoverResult {
  const raw: Record<Trait, number> = { o: 0, c: 0, e: 0, a: 0, s: 0 };
  const seen: Record<Trait, number> = { o: 0, c: 0, e: 0, a: 0, s: 0 };
  DISCOVER_TRIADS.forEach((ids, i) => {
    const pick = a.triads[i];
    for (const id of new Set(ids.map((x) => DISCOVER_STATEMENTS[x]!.trait))) seen[id] += 1;
    if (!pick) return;
    const most = DISCOVER_STATEMENTS[ids[pick.most]!]!;
    const least = DISCOVER_STATEMENTS[ids[pick.least]!]!;
    raw[most.trait] += most.sign;
    raw[least.trait] -= least.sign;
  });
  const wordRaw: Record<Trait, number> = { o: 0, c: 0, e: 0, a: 0, s: 0 };
  const wordSeen: Record<Trait, number> = { o: 0, c: 0, e: 0, a: 0, s: 0 };
  DISCOVER_WORDS.forEach((list, i) => {
    for (const t of new Set(list.map((w) => w.trait))) wordSeen[t] += 2;
    const pick = a.words[i];
    if (!pick) return;
    for (const k of pick.most) wordRaw[list[k]!.trait] += list[k]!.sign;
    for (const k of pick.least) wordRaw[list[k]!.trait] -= list[k]!.sign;
  });
  const traits = Object.fromEntries(
    TRAITS.map((t) => {
      const x = seen[t.key] ? raw[t.key] / seen[t.key] : 0;
      const w = wordSeen[t.key] ? wordRaw[t.key] / wordSeen[t.key] : 0;
      return [t.key, clamp100(50 + 50 * (0.6 * x + 0.4 * w))];
    }),
  ) as Record<Trait, number>;
  const puzzles = puzzleSummary(a);
  const gap = DISCOVER_SCENES.reduce((n, s, i) => {
    const pick = a.scenes[i];
    return pick ? n + (s.key[pick.most]! - s.key[pick.least]!) : n;
  }, 0);
  const judgment = clamp100(((gap + 3 * DISCOVER_SCENES.length) / (6 * DISCOVER_SCENES.length)) * 100);
  const measures = { ...traits, p: puzzles.score, j: judgment };
  const strengths = (Object.keys(DISCOVER_WEIGHTS) as RelationshipKey[])
    .map((key) => ({ key, score: clamp100((Object.keys(measures) as (keyof typeof measures)[]).reduce((n, m) => n + DISCOVER_WEIGHTS[key][m] * measures[m], 0)) }))
    .sort((x, y) => y.score - x.score || x.key.localeCompare(y.key));
  return { traits, puzzles, judgment, strengths, top: strengths.slice(0, 3).map((s) => s.key), growth: strengths[strengths.length - 1]!.key, ...(eqComplete(a) ? { eq: scoreEq(a) } : {}) };
}

// ---- the detailed analysis, written from a result: personality by trait and reasoning by kind of puzzle ----

export type TraitBand = 'low' | 'mid' | 'high';
export const traitBand = (score: number): TraitBand => (score < 40 ? 'low' : score > 60 ? 'high' : 'mid');

export interface TraitReading {
  title: string;
  describes: string;
  atBest: string;
  watchFor: string;
  inRelationships: string;
  tryThis: string;
}
const reading = (title: string, describes: string, atBest: string, watchFor: string, inRelationships: string, tryThis: string): TraitReading => ({ title, describes, atBest, watchFor, inRelationships, tryThis });

/** What each trait reads like at each level. Not good and bad: a low score is a different way to be. */
export const DISCOVER_TRAIT_READINGS: Record<Trait, Record<TraitBand, TraitReading>> = {
  o: {
    low: reading('Grounded and practical', 'You like what is proven and clear. You trust what works.', 'You are steady and sensible. You turn ideas into things that run.', 'You may skip a better way because the old one is comfortable.', 'People know where they stand with you. Plan something new together now and then, so things stay fresh.', 'Try one small new thing a week: a new route, a new food or a new tool.'),
    mid: reading('Open, but not restless', 'You enjoy new ideas and also value what is tested.', 'You can bridge the dreamers and the doers.', 'You may sit on the fence when a bold change is needed.', 'You fit partners who like novelty and partners who like routine.', 'Pick the bolder option once this week and see how it feels.'),
    high: reading('Curious and inventive', 'You love ideas, new places and new ways to do things.', 'You spot chances others miss and you learn fast.', 'You may start more than you finish, or tune out routine tasks.', 'You bring fun and depth. Partners may need you to stay for the boring parts too.', 'Pair every new idea with one finish line.'),
  },
  c: {
    low: reading('Flexible and spontaneous', 'You go with the flow and keep plans loose.', 'You adapt fast and are fun when plans change.', 'Deadlines and details can slip, and others may feel they cannot count on you.', 'You are easy company. Be clear about promises so people can trust them.', 'Write the one thing that must happen today and do it first.'),
    mid: reading('Organised when it counts', 'You plan when it matters and relax when it does not.', 'You balance structure and freedom well.', 'You may let small things pile up before a rush.', 'You are dependable without being rigid.', 'Pick one small habit to make automatic, such as a weekly review.'),
    high: reading('Reliable and driven', 'You plan, finish and keep your promises.', 'People trust you with big jobs. You get things done.', 'You may be hard on yourself or others when things get messy.', 'You are dependable. Leave room for play and for plans to change.', 'Schedule rest the way you schedule work.'),
  },
  e: {
    low: reading('Quiet and reflective', 'You recharge alone and think before you speak.', 'You listen well and go deep with a few people.', 'You may be missed in big groups, or hold ideas back.', 'You offer calm, close friendship. Say when you need space so nobody has to guess.', 'Share one idea out loud in every meeting.'),
    mid: reading('Social when you choose', 'You enjoy people and also need time of your own.', 'You can fit a crowd or a quiet room.', 'You may be unsure how many invitations to accept.', 'You are easy to be with. Say clearly how much company you want.', 'Plan your social time and your quiet time on the same day.'),
    high: reading('Outgoing and energised', 'People give you energy, and you start conversations easily.', 'You bring warmth and momentum to a group.', 'You may talk more than you listen, or feel flat when alone.', 'You are fun and open. Leave space for quieter people.', 'Ask one more question before you tell your own story.'),
  },
  a: {
    low: reading('Direct and firm', 'You say what you think and hold your ground.', 'You are honest, clear and good at hard calls.', 'You may come across as cold, or win the point and lose the person.', 'People trust your honesty. Add a kind word before the hard one.', 'Say one thing you appreciate before you give feedback.'),
    mid: reading('Kind and clear', 'You care about people and can stand firm when you need to.', 'You balance honesty with kindness.', 'You may swing between giving in and pushing back.', 'You can be supportive and straight. Name what you need.', 'Notice when you say yes but mean no, and practise a kind no.'),
    high: reading('Warm and giving', 'You put people first and keep the peace.', 'You make others feel safe and heard.', 'You may avoid conflict or put your own needs last.', 'You are a loving friend and partner. Share your needs before you are tired.', 'Say no to one thing this week without a long explanation.'),
  },
  s: {
    low: reading('Sensitive and deep-feeling', 'You feel things strongly and notice shifts in mood.', 'You read people well and care deeply about getting things right.', 'You may worry, replay mistakes or feel stress in your body.', 'You feel with people. Tell them what helps when you are anxious.', 'Take a two-minute breathing break before a big moment.'),
    mid: reading('Steady most days', 'You handle most things well and feel the strain on hard days.', 'You recover fairly quickly and still care.', 'Tiredness can tip you into worry.', 'You are steady, with room to feel. Rest keeps you there.', 'Protect your sleep. It is the best friend of a calm mind.'),
    high: reading('Calm and resilient', 'You stay level when things go wrong and bounce back fast.', 'Others lean on your steadiness in a crisis.', 'You may seem unbothered when someone needs you to feel it with them.', 'You are a rock. Show you care in words as well as in calm.', 'Check in with one person who is struggling this week.'),
  },
};

/** One word for each end of each trait, used to say which two traits stand out. */
export const TRAIT_POLES: Record<Trait, { high: string; low: string }> = {
  o: { high: 'curious', low: 'practical' },
  c: { high: 'reliable', low: 'flexible' },
  e: { high: 'outgoing', low: 'reflective' },
  a: { high: 'warm', low: 'direct' },
  s: { high: 'calm', low: 'sensitive' },
};

export const REASONING_KINDS: Record<PuzzleKind, { name: string; what: string; strong: string; weak: string }> = {
  dice: { name: 'Number patterns', what: 'Dice grids where each row repeats a set or adds up.', strong: 'You spot rules in numbers quickly.', weak: 'Rules in numbers took longer. Count across rows and down columns before you guess.' },
  turn: { name: 'Turning shapes', what: 'Arrows that turn and gain dots, step by step.', strong: 'You follow step-by-step change well.', weak: 'Say the change out loud for each step, such as "turns a quarter, adds a dot", then apply it once more.' },
  numbers: { name: 'Number series', what: 'A row of numbers where each one follows from the ones before.', strong: 'You see how numbers grow, even when the step changes.', weak: 'Write the gaps between the numbers. If the gaps are not the same, look at how the gaps change.' },
  odd: { name: 'Odd one out', what: 'Five dice where four follow one rule.', strong: 'You find the rule fast and spot what breaks it.', weak: 'Sort the dice into two piles, such as even and odd, and see which pile has only one.' },
  grid: { name: 'Pattern rules', what: 'Grids of squares where the third piece comes from the first two.', strong: 'You see how pieces combine.', weak: 'Compare the first two pieces square by square. Which squares are in both, in one, or in neither?' },
};

/** What each emotional intelligence part reads like at each level. A low score is a place to practise, not a verdict. */
export const EQ_READINGS: Record<EqDim, Record<TraitBand, TraitReading>> = {
  a: {
    low: reading('Still tuning in', 'Your feelings can arrive as a surprise, or as a general "off" mood you cannot name yet.', 'You are not stuck in your head. With a little practice you notice more.', 'Stress can build up in your body or your mood before you see it.', 'Others may know you are upset before you do. Ask them what they see.', 'Three times a day, stop and finish the line: "Right now I feel ... because ...".'),
    mid: reading('Often aware', 'You can usually name what you feel, and sometimes it takes a while.', 'You catch the big feelings and many of the small ones.', 'Busy days can hide how you feel until they spill over.', 'You can say how you feel, if you take the minute to check.', 'End each day with one word for how it felt, and why.'),
    high: reading('Tuned in', 'You know what you feel, what sets it off and how it shows in your body.', 'You can explain yourself to others and make clean choices.', 'You may analyse a feeling so much that you forget to just feel it.', 'People find you easy to understand because you say what is going on.', 'Share one feeling out loud this week before you try to fix it.'),
  },
  m: {
    low: reading('Feelings run fast', 'Strong feelings can take over before you choose what to do with them.', 'Your feelings are real and quick, which makes you honest and alive.', 'You may say or do things you regret in the heat of the moment.', 'Loved ones may walk on eggshells. Tell them what you do when you feel it rise.', 'When you feel it rise, count five slow breaths before you speak.'),
    mid: reading('Steady most of the time', 'You can usually calm down and choose your words, but a bad day can test it.', 'You recover well and you are good company in a crisis.', 'Tiredness or hunger can tip you faster than you expect.', 'You repair quickly after a snap. Keep saying sorry first.', 'Notice your early signs, such as a tight jaw, and take a pause then.'),
    high: reading('Calm under pressure', 'You can feel a lot and still choose what to do.', 'You keep your head when others lose theirs.', 'You may hold feelings in too long, or seem hard to read.', 'You are a steady partner. Let people see you feel it too.', 'Tell one person about something that bothered you this week, in a calm voice.'),
  },
  d: {
    low: reading('Easily knocked off course', 'Setbacks can drain you, and goals can slip when results are slow.', 'You are honest about what is hard, and that can point you to what matters.', 'You may quit one step before the payoff.', 'People who rely on you may not know whether you will stay the course. Say what you can commit to.', 'Pick one goal and cut it to a size you can do on your worst day.'),
    mid: reading('Keeps going, mostly', 'You usually keep going, and you need a reason or a rhythm to stay with it.', 'You finish more than you quit.', 'Long goals with no feedback wear you down.', 'You can be counted on for most things. Build in small wins.', 'Write down what you did this week that you could not do a month ago.'),
    high: reading('Driven and hopeful', 'You set goals that matter and find a way back after a setback.', 'You carry a team through the slow middle.', 'You may push too hard, or expect others to keep your pace.', 'You inspire people. Check that you are not leaving anyone behind.', 'Take one full rest day and see that the goals are still there.'),
  },
  e: {
    low: reading('Learning to read people', 'Other people’s feelings can be hard to sense, especially when they do not say them.', 'You are direct and fair, because you do not read into things.', 'You may miss a hint that someone is hurt or worried.', 'Ask more than you guess: "How are you really?" goes a long way.', 'Next time someone seems off, ask one question and listen without fixing.'),
    mid: reading('Often in step', 'You read most people well, and sometimes need to be told.', 'You listen and adapt to most people.', 'You may misread someone when you are busy or stressed.', 'Check your read out loud: "It seems like you are worried. Am I right?"', 'Look at faces, not phones, for one conversation a day.'),
    high: reading('Reads the room', 'You sense how others feel and can see things from their side.', 'People feel understood around you.', 'You may carry other people’s feelings as if they were yours.', 'You are a caring friend or partner. Keep some of your energy for yourself.', 'After a heavy talk, take five minutes to reset before you move on.'),
  },
  s: {
    low: reading('Hard talks are hard', 'Disagreement, asking for help or putting a thing into words can feel risky.', 'You avoid needless fights and take care not to hurt people.', 'Things may go unsaid until they grow.', 'Close people may not know what you need. Start small and say it kindly.', 'Say one honest thing this week that you would normally let go.'),
    mid: reading('Good with people', 'You get on with most people and can handle most conversations, with a few you put off.', 'You can disagree and still keep the peace.', 'You may save hard talks for a better time that never comes.', 'You are easy to be around. Name hard things early and they stay small.', 'Pick one talk you have put off and set a time for it.'),
    high: reading('A natural connector', 'You talk things through, ask for help and keep relationships in good repair.', 'You make people feel welcome and you mend things after a clash.', 'You may take on the role of peacemaker too often.', 'You are good at closeness. Let others do some of the work.', 'Ask someone to do one thing for you this week, and let them.'),
  },
};

export interface EqAnalysis {
  overall: number;
  readingLine: string;
  dims: { dim: EqDim; name: string; blurb: string; score: number; self: number; ability: number; band: TraitBand; reading: TraitReading; gap: string | null; helps: RelationshipKey }[];
  strongest: EqDim;
  quietest: EqDim;
}

export interface DiscoverAnalysis {
  /** One line on the two traits that stand out most. */
  pattern: string;
  personality: { trait: Trait; name: string; score: number; band: TraitBand; reading: TraitReading }[];
  reasoning: {
    right: number;
    of: number;
    level: 'Just starting' | 'Steady' | 'Strong' | 'Sharp';
    /** Where the puzzles settled, 1 to 5, when the puzzles adjusted. */
    levelNumber: number | null;
    levelLine: string;
    kinds: { kind: PuzzleKind; name: string; what: string; right: number; of: number; note: string }[];
    trend: string | null;
    speed: string | null;
    caveat: string;
  };
  /** Only when the emotional intelligence part was answered. */
  eq: EqAnalysis | null;
}

export function analyseEq(eq: EqResult): EqAnalysis {
  const dims = EQ_DIMS.map((d) => {
    const v = eq.dims[d.key];
    const band = traitBand(v.score);
    const diff = v.self - v.ability;
    const gap = diff >= 20 ? 'You see yourself higher here than your choices in the situations showed. That is a good place to practise.' : diff <= -20 ? 'You chose better in the situations than you give yourself credit for. Trust yourself a little more here.' : null;
    return { dim: d.key, name: d.name, blurb: d.blurb, score: v.score, self: v.self, ability: v.ability, band, reading: EQ_READINGS[d.key][band], gap, helps: d.helps };
  });
  const sorted = [...dims].sort((x, y) => y.score - x.score || x.dim.localeCompare(y.dim));
  const r = eq.reading;
  return {
    overall: eq.overall,
    readingLine: r.right >= 5 ? `You read ${r.right} of ${r.of} scenes right: you pick up how people feel from small clues.` : r.right >= 3 ? `You read ${r.right} of ${r.of} scenes right. Quiet clues are sometimes missed, and asking helps.` : `You read ${r.right} of ${r.of} scenes right. Feelings are often mixed or hidden, so asking, not guessing, will serve you well.`,
    dims,
    strongest: sorted[0]!.dim,
    quietest: sorted[sorted.length - 1]!.dim,
  };
}

export function analyseDiscover(result: DiscoverResult): DiscoverAnalysis {
  const personality = TRAITS.map((t) => ({ trait: t.key, name: t.name, score: result.traits[t.key], band: traitBand(result.traits[t.key]), reading: DISCOVER_TRAIT_READINGS[t.key][traitBand(result.traits[t.key])] }));
  const [first, second] = [...personality].sort((x, y) => Math.abs(y.score - 50) - Math.abs(x.score - 50) || x.trait.localeCompare(y.trait));
  const pole = (p: { trait: Trait; score: number }) => TRAIT_POLES[p.trait][p.score >= 50 ? 'high' : 'low'];
  const pattern =
    first && second && Math.abs(first.score - 50) >= 8
      ? `You read as ${pole(first)} and ${pole(second)}. Those two traits stand out most from your middle.`
      : 'Your traits sit close to the middle. You are flexible: you can lean either way depending on the day.';

  const right = result.puzzles.right;
  const of = result.puzzles.of;
  // New results carry the level the puzzles settled at; older ones only have a count out of ten.
  const lv = result.puzzles.level;
  const level = lv !== undefined ? (lv >= 4 ? 'Sharp' : lv >= 2.8 ? 'Strong' : lv >= 1.8 ? 'Steady' : 'Just starting') : right >= 9 ? 'Sharp' : right >= 6 ? 'Strong' : right >= 3 ? 'Steady' : 'Just starting';
  const levelLine = {
    Sharp: 'You found nearly every pattern, including the harder ones. You see rules fast and hold them while you check the options.',
    Strong: 'You found most of the patterns. A few took more care, which is normal when the rules get layered.',
    Steady: 'You found about half of the patterns. Puzzles like these respond well to practice, and the first few tries are often the hardest.',
    'Just starting': 'Few patterns clicked this time. That is common on a first try, a tired day or a noisy room. Try again when you are fresh.',
  }[level];
  const kinds = result.puzzles.byKind
    ? (Object.keys(result.puzzles.byKind) as PuzzleKind[]).map((kind) => {
        const k = result.puzzles.byKind![kind]!;
        const k0 = REASONING_KINDS[kind];
        return { kind, name: k0.name, what: k0.what, right: k.right, of: k.of, note: k.of && k.right / k.of >= 0.66 ? k0.strong : k0.weak };
      })
    : [];
  const [p1, p2] = result.puzzles.parts ?? [null, null];
  const trend =
    p1 === null || p2 === null
      ? null
      : p2 > p1
        ? 'You did better in the second part, which was harder, so you learn the rules as you go.'
        : p2 === p1
          ? 'You scored the same in both parts, even though the second was harder. That is steady.'
          : 'You scored lower in the second part. It is harder, and it usually is. Slow down on the layered ones.';
  const sec = result.puzzles.medianSeconds;
  const speed = sec === null || sec === undefined ? null : sec <= 8 ? `You answered fast, about ${sec} seconds a puzzle. Check that speed is not costing you the odd one.` : sec <= 25 ? `You took about ${sec} seconds a puzzle, a good pace for patterns.` : `You took about ${sec} seconds a puzzle. You think things through, and a quicker first guess may help on the easy ones.`;
  return {
    pattern,
    personality,
    reasoning: {
      right,
      of,
      level,
      levelNumber: lv ?? null,
      levelLine,
      kinds,
      trend,
      speed,
      caveat: 'This is not an IQ score. A real IQ test has far more questions, is checked against thousands of people and is given by a trained person. These twelve puzzles show how you handle patterns today, and the result can change with sleep, focus and practice.',
    },
    eq: result.eq ? analyseEq(result.eq) : null,
  };
}

// ---- what the app learns from Discover, kept small: used for next steps and, if the person allows it, by the assistant ----

// ---- more ways to know yourself: a 16-type self-check, love languages (given and received) and how your mind works ----
// Our own items and our own scoring. The type check is not the official MBTI®, and "how your mind works" is not a test for ADHD or
// autism: each is a self-check that points to what may help. Each can be taken alone, is kept apart from the main quiz (`discover_extras`),
// and is owner only like the journal.

export type ExtraKind = 'type' | 'love' | 'mind' | 'design';
export const EXTRA_KINDS: readonly { key: ExtraKind; name: string; blurb: string; emoji: string; steps: number }[] = [
  { key: 'type', name: '16 personality types', blurb: 'A free check in the style of the Myers-Briggs (MBTI) test. Twenty-four lines to rate give a four-letter type from sixteen, such as INFP or ESTJ, with how clear each side is and what it means for you.', emoji: '🧩', steps: 6 },
  { key: 'love', name: 'Love languages', blurb: 'Twenty choices between two lines: ten about how you like to be shown love, ten about how you show it. They can differ, and the gap is useful.', emoji: '💞', steps: 20 },
  { key: 'design', name: 'Human design', blurb: 'Enter your birth date, time and zone. It works out your chart in the tropical and the sidereal zodiac, reads it in three layers (body, mind, purpose) and turns it into goals you can do and count. A system for reflection, not science.', emoji: '🪐', steps: 1 },
  { key: 'mind', name: 'How your mind works', blurb: 'Twenty-four lines on how often something is true: attention, energy and impulse, and patterns and senses. A self-check, never a diagnosis.', emoji: '🧠', steps: 6 },
];
export const isExtraKind = (v: unknown): v is ExtraKind => EXTRA_KINDS.some((k) => k.key === v);

/** Rate each line from "not like me" to "very like me" (type) or from "never" to "very often" (mind). */
export const RATE_FREQUENCY = ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often'] as const;

// -- the sixteen types: four pairs --

export type TypeAxis = 'ei' | 'sn' | 'tf' | 'jp';
export type TypeLetter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
export const TYPE_AXES: readonly { key: TypeAxis; first: TypeLetter; second: TypeLetter; name: string; blurb: string }[] = [
  { key: 'ei', first: 'E', second: 'I', name: 'Where your energy comes from', blurb: 'Outward (E) is people and action. Inward (I) is quiet and depth.' },
  { key: 'sn', first: 'S', second: 'N', name: 'How you take things in', blurb: 'Hands-on (S) is facts and what you can see. Big picture (N) is patterns and what could be.' },
  { key: 'tf', first: 'T', second: 'F', name: 'How you decide', blurb: 'Head (T) is logic and fair rules. Heart (F) is what matters to people.' },
  { key: 'jp', first: 'J', second: 'P', name: 'How you live day to day', blurb: 'Planned (J) is a list and a finish line. Open (P) is options and going with the flow.' },
];
/** Six screens of four lines, one line from each pair on every screen. Half of each pair's lines lean to each side, so saying yes to everything cancels out. */
export const TYPE_SCREENS: readonly (readonly { axis: TypeAxis; pole: TypeLetter; text: string }[])[] = [
  [
    { axis: 'ei', pole: 'E', text: 'I feel more awake after time with a group.' },
    { axis: 'sn', pole: 'S', text: 'I trust facts and what I can see more than hunches.' },
    { axis: 'tf', pole: 'T', text: 'When I decide, I put logic before feelings.' },
    { axis: 'jp', pole: 'J', text: 'I like a plan and I like to stick to it.' },
  ],
  [
    { axis: 'ei', pole: 'I', text: 'I need time alone to recharge after a busy day.' },
    { axis: 'sn', pole: 'N', text: 'I enjoy thinking about what could be, not only what is.' },
    { axis: 'tf', pole: 'F', text: 'When I decide, I think first about how people will feel.' },
    { axis: 'jp', pole: 'P', text: 'I like to keep my options open and decide late.' },
  ],
  [
    { axis: 'ei', pole: 'E', text: 'I think best when I talk things through out loud.' },
    { axis: 'sn', pole: 'S', text: 'I like clear steps and ways of doing things that are proven.' },
    { axis: 'tf', pole: 'T', text: 'I would rather be honest than gentle if it helps.' },
    { axis: 'jp', pole: 'J', text: 'A finished list makes me feel calm.' },
  ],
  [
    { axis: 'ei', pole: 'I', text: 'I think things through quietly before I speak.' },
    { axis: 'sn', pole: 'N', text: 'I get bored when I do the same thing the same way.' },
    { axis: 'tf', pole: 'F', text: 'I find it hard to say things that might hurt someone.' },
    { axis: 'jp', pole: 'P', text: 'I work well in bursts, close to the deadline.' },
  ],
  [
    { axis: 'ei', pole: 'E', text: 'I find it easy to start a chat with someone new.' },
    { axis: 'sn', pole: 'S', text: 'I notice small details that other people miss.' },
    { axis: 'tf', pole: 'T', text: 'I like to find the flaw in an idea before I back it.' },
    { axis: 'jp', pole: 'J', text: 'I like to settle things early so I can relax.' },
  ],
  [
    { axis: 'ei', pole: 'I', text: 'I prefer a few close friends to a big circle.' },
    { axis: 'sn', pole: 'N', text: 'I often see links between things that seem unrelated.' },
    { axis: 'tf', pole: 'F', text: 'I often sense what others feel before they say it.' },
    { axis: 'jp', pole: 'P', text: 'I am happy to change the plan when something better comes up.' },
  ],
];

export const TYPE_LETTERS: Record<TypeLetter, { name: string; line: string; best: string; watch: string; people: string; tryThis: string; hint: string }> = {
  E: { name: 'Outward', line: 'You get energy from people and action.', best: 'You start conversations, rally a group and think out loud.', watch: 'Talking before you have thought it through, and running out of quiet time.', people: 'Say what you need. People cannot guess it as well as you think.', tryThis: 'Plan one thing with another person today.', hint: 'People-based steps suit them, such as a friend, a circle or a run.' },
  I: { name: 'Inward', line: 'You get energy from quiet time and a few people.', best: 'You listen well, think deeply and go far on one thing.', watch: 'Keeping good ideas to yourself, and going quiet when you need help.', people: 'Say what you need before you are tired. A short text is enough.', tryThis: 'Share one idea with someone you trust today.', hint: 'Quiet, solo steps suit them. Keep messages short and do not push social plans.' },
  S: { name: 'Hands-on', line: 'You trust what you can see, touch and test.', best: 'You notice details, stay practical and finish what you start.', watch: 'Missing the bigger picture when you are deep in the details.', people: 'Give people clear, concrete help, not only kind words.', tryThis: 'Write down one detail you usually skip.', hint: 'Give clear, concrete, ordered steps.' },
  N: { name: 'Big picture', line: 'You look for patterns and what could be.', best: 'You come up with new ideas and see where things are heading.', watch: 'Skipping the dull steps that make an idea real.', people: 'Check that others can follow your leaps. Give the plain version too.', tryThis: 'Turn one idea into three small steps.', hint: 'Give the why and the big picture first, then the step.' },
  T: { name: 'Head', line: 'You decide with logic and fair rules.', best: 'You stay clear when others are upset, and you spot weak points.', watch: 'Sounding cold when you only mean to be honest.', people: 'Say the kind part out loud. People cannot see it in your head.', tryThis: 'Before you give feedback, name one thing that is good.', hint: 'Be direct and give reasons.' },
  F: { name: 'Heart', line: 'You decide by what matters to people.', best: 'You build trust, sense moods and keep a group together.', watch: 'Taking things personally and putting off hard talks.', people: 'Say the hard thing kindly. It helps more than silence.', tryThis: 'Have one honest talk you have been putting off.', hint: 'Open with warmth, then give the step.' },
  J: { name: 'Planned', line: 'You like a plan and a finished list.', best: 'You keep your word, meet deadlines and make order.', watch: 'Getting stiff when plans change.', people: 'Leave room for others to surprise you.', tryThis: 'Leave one hour today with no plan.', hint: 'Give a plan with a finish line.' },
  P: { name: 'Open', line: 'You like to keep options open and see what comes.', best: 'You adapt fast, stay relaxed and spot new chances.', watch: 'Leaving things to the last minute, or starting more than you finish.', people: 'Tell people early when plans may change.', tryThis: 'Pick one thing and set a finish time for it.', hint: 'Keep it flexible: offer choices and short bursts.' },
};

/** A name and a line for each of the sixteen four-letter types. Our own names, not the official ones. */
export const TYPE_NAMES: Record<string, { name: string; line: string }> = {
  ISTJ: { name: 'The Steady Keeper', line: 'You keep promises and keep things running.' },
  ISFJ: { name: 'The Quiet Carer', line: 'You look after people in small, steady ways.' },
  INFJ: { name: 'The Deep Guide', line: 'You see what people need and where they could grow.' },
  INTJ: { name: 'The Long Planner', line: 'You make a plan for the future and work it.' },
  ISTP: { name: 'The Calm Fixer', line: 'You stay cool and work out how things work.' },
  ISFP: { name: 'The Gentle Maker', line: 'You follow your own taste and make things with care.' },
  INFP: { name: 'The Quiet Dreamer', line: 'You live by your values and see the good in people.' },
  INTP: { name: 'The Curious Thinker', line: 'You love ideas and taking them apart.' },
  ESTP: { name: 'The Quick Mover', line: 'You act fast and enjoy the moment.' },
  ESFP: { name: 'The Lively Friend', line: 'You bring fun and warmth wherever you go.' },
  ENFP: { name: 'The Idea Starter', line: 'You light up a room and start new things.' },
  ENTP: { name: 'The Bold Debater', line: 'You love a good argument and a fresh angle.' },
  ESTJ: { name: 'The Natural Organiser', line: 'You like clear rules and getting it done.' },
  ESFJ: { name: 'The Warm Host', line: 'You bring people together and look after them.' },
  ENFJ: { name: 'The Encouraging Leader', line: 'You help people see what they can do.' },
  ENTJ: { name: 'The Bold Planner', line: 'You set a goal and lead people to it.' },
};

export type TypeAnswers = (number[] | null)[];
export interface TypeAxisResult {
  /** 0 to 100 toward the first letter of the pair. */
  toward: number;
  letter: TypeLetter;
  strength: 'slight' | 'moderate' | 'clear';
}
export interface TypeResult {
  code: string;
  axes: Record<TypeAxis, TypeAxisResult>;
}
export const emptyTypeAnswers = (): TypeAnswers => TYPE_SCREENS.map(() => null);
export function parseTypeAnswers(raw: unknown): TypeAnswers {
  const out = emptyTypeAnswers();
  (Array.isArray(raw) ? raw : []).slice(0, out.length).forEach((v, i) => {
    if (Array.isArray(v) && v.length === TYPE_SCREENS[i]!.length && v.every((x) => intIn(x, 5))) out[i] = v as number[];
  });
  return out;
}
export function scoreType(a: TypeAnswers): TypeResult {
  const axes = {} as Record<TypeAxis, TypeAxisResult>;
  for (const ax of TYPE_AXES) {
    const vals: number[] = [];
    TYPE_SCREENS.forEach((screen, i) =>
      screen.forEach((item, k) => {
        const v = a[i]?.[k];
        if (item.axis === ax.key && v !== undefined) vals.push(item.pole === ax.first ? v : 4 - v);
      }),
    );
    const toward = clamp100((mean(vals) / 4) * 100);
    const away = Math.abs(toward - 50);
    axes[ax.key] = { toward, letter: toward >= 50 ? ax.first : ax.second, strength: away < 10 ? 'slight' : away < 25 ? 'moderate' : 'clear' };
  }
  return { code: TYPE_AXES.map((ax) => axes[ax.key].letter).join(''), axes };
}

export interface TypeAnalysis {
  code: string;
  name: string;
  line: string;
  axes: { key: TypeAxis; name: string; letter: TypeLetter; letterName: string; other: TypeLetter; toward: number; leaning: number; strength: TypeAxisResult['strength']; reading: (typeof TYPE_LETTERS)[TypeLetter] }[];
  /** Pairs that sit near the middle, where either letter could be you. */
  close: TypeAxis[];
  /** Where to work on it in the app. */
  tryFirst: string;
}
export function analyseType(r: TypeResult): TypeAnalysis {
  const axes = TYPE_AXES.map((ax) => {
    const v = r.axes[ax.key];
    return { key: ax.key, name: ax.name, letter: v.letter, letterName: TYPE_LETTERS[v.letter].name, other: v.letter === ax.first ? ax.second : ax.first, toward: v.toward, leaning: v.letter === ax.first ? v.toward : 100 - v.toward, strength: v.strength, reading: TYPE_LETTERS[v.letter] };
  });
  const t = TYPE_NAMES[r.code] ?? { name: 'Your type', line: '' };
  return { code: r.code, name: t.name, line: t.line, axes, close: axes.filter((x) => x.strength === 'slight').map((x) => x.key), tryFirst: axes[0]!.reading.tryThis };
}

// -- love languages: given and received --

export type LoveKey = 'words' | 'time' | 'gifts' | 'acts' | 'touch';
export const LOVE_KEYS: readonly LoveKey[] = ['words', 'time', 'gifts', 'acts', 'touch'];
export const LOVE_LANGUAGES: Record<LoveKey, { name: string; emoji: string; blurb: string; ask: string; give: string; watch: string; helps: RelationshipKey }> = {
  words: { name: 'Words of affirmation', emoji: '💬', blurb: 'Kind, clear words tell you that you matter.', ask: 'Say: “It means a lot when you tell me what you like about me.”', give: 'Be specific. “Thank you for staying late, it helped me” lands better than “good job”.', watch: 'Harsh words cut deeper for you, and silence can feel like a no.', helps: 'friendship' },
  time: { name: 'Quality time', emoji: '⏳', blurb: 'Full attention is how you feel close to someone.', ask: 'Say: “I would love an hour with just the two of us, phones away.”', give: 'Put the phone down and look at them. Ten full minutes beat a distracted evening.', watch: 'Cancelled plans and half-listening hurt more than people know.', helps: 'lover_partner' },
  gifts: { name: 'Thoughtful gifts', emoji: '🎁', blurb: 'A small thing that shows someone thought of you means a lot.', ask: 'Say: “A little surprise that shows you thought of me makes my week.”', give: 'It is the thought, not the price. A note, a snack or a photo is enough.', watch: 'A forgotten day that matters to you can sting.', helps: 'parent_child' },
  acts: { name: 'Acts of service', emoji: '🛠️', blurb: 'Help with a real job tells you someone cares.', ask: 'Say: “It would mean a lot if you took one job off my plate this week.”', give: 'Do the job they dread, without being asked, and do not keep score.', watch: 'Broken promises to help, or being left with everything, feel like neglect.', helps: 'servant_leader' },
  touch: { name: 'Physical touch', emoji: '🤝', blurb: 'A hug, a hand or sitting close helps you feel safe and loved.', ask: 'Say: “A long hug really helps me when I am having a hard day.”', give: 'Ask or watch what they like. A hug, a hand on the shoulder or sitting close, only if it is welcome.', watch: 'Distance can feel like coldness. Always check what feels right to the other person.', helps: 'lover_partner' },
};
/** Ten pairs: every language against every other once. Each language shows up four times, so a score runs from 0 to 4. */
export const LOVE_PAIRS: readonly (readonly [LoveKey, LoveKey])[] = [
  ['words', 'time'], ['words', 'gifts'], ['words', 'acts'], ['words', 'touch'],
  ['time', 'gifts'], ['time', 'acts'], ['time', 'touch'],
  ['gifts', 'acts'], ['gifts', 'touch'],
  ['acts', 'touch'],
];
export type LoveDirection = 'receive' | 'give';
/** Four lines for each language and direction, one for each time it appears. */
export const LOVE_LINES: Record<LoveDirection, Record<LoveKey, readonly string[]>> = {
  receive: {
    words: ['Someone tells me they are proud of me.', 'I get a kind message out of the blue.', 'Someone thanks me and says what I did well.', 'A person says “I love you” and means it.'],
    time: ['Someone gives me their full attention, phone away.', 'We spend a whole evening together with no rush.', 'A friend plans time just for the two of us.', 'Someone sits with me while I talk and does not hurry.'],
    gifts: ['I get a small present that shows they know me.', 'Someone brings me something because they thought of me.', 'I get a handwritten note or a keepsake.', 'A person remembers a day that matters to me and marks it.'],
    acts: ['Someone does a job I was dreading.', 'A person helps without being asked.', 'Someone makes me a meal when I am worn out.', 'A person fixes something that was bothering me.'],
    touch: ['I get a long hug when I need one.', 'Someone holds my hand or sits close to me.', 'I get a pat on the back or a squeeze of the shoulder.', 'Someone leans on me while we sit together.'],
  },
  give: {
    words: ['I tell people what I like about them.', 'I send a kind message to cheer someone up.', 'I say thank you and say why.', 'I say “I love you” or “I am proud of you” often.'],
    time: ['I give someone my full attention.', 'I make time to be with a person, with no rush.', 'I plan a day just for the two of us.', 'I sit and listen as long as they need.'],
    gifts: ['I buy small things that make me think of someone.', 'I bring someone a treat for no reason.', 'I keep notes and keepsakes for people.', 'I remember birthdays and mark them well.'],
    acts: ['I do a job for someone to lighten their load.', 'I help before I am asked.', 'I cook or fix things for the people I love.', 'I run an errand so that someone can rest.'],
    touch: ['I hug people hello and goodbye.', 'I hold a hand or sit close.', 'I give a pat on the back to cheer someone on.', 'I like to lean on the person I love.'],
  },
};
/** The two lines of pair `p` for one direction. */
export function lovePairLines(dir: LoveDirection, p: number): [string, string] {
  const pair = LOVE_PAIRS[p]!;
  const line = (lang: LoveKey) => LOVE_LINES[dir][lang][LOVE_PAIRS.slice(0, p).filter((q) => q.includes(lang)).length]!;
  return [line(pair[0]), line(pair[1])];
}
export interface LoveAnswers {
  /** For each pair: 0 for the first line, 1 for the second. */
  receive: (0 | 1 | null)[];
  give: (0 | 1 | null)[];
}
export const emptyLoveAnswers = (): LoveAnswers => ({ receive: LOVE_PAIRS.map(() => null), give: LOVE_PAIRS.map(() => null) });
export function parseLoveAnswers(raw: unknown): LoveAnswers {
  const out = emptyLoveAnswers();
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const dir of ['receive', 'give'] as const) (Array.isArray(o[dir]) ? (o[dir] as unknown[]) : []).slice(0, out[dir].length).forEach((v, i) => (out[dir][i] = v === 0 || v === 1 ? v : null));
  return out;
}
export interface LoveResult {
  /** How often each language won its four pairs, 0 to 4. */
  receive: Record<LoveKey, number>;
  give: Record<LoveKey, number>;
}
export function scoreLove(a: LoveAnswers): LoveResult {
  const tally = (picks: (0 | 1 | null)[]) => {
    const t = Object.fromEntries(LOVE_KEYS.map((k) => [k, 0])) as Record<LoveKey, number>;
    picks.forEach((v, i) => {
      if (v !== null) t[LOVE_PAIRS[i]![v]] += 1;
    });
    return t;
  };
  return { receive: tally(a.receive), give: tally(a.give) };
}
/** The languages in order, best first; ties keep the order of the list. */
export const loveRanked = (t: Record<LoveKey, number>): LoveKey[] => [...LOVE_KEYS].sort((x, y) => t[y] - t[x] || LOVE_KEYS.indexOf(x) - LOVE_KEYS.indexOf(y));
/** Every language tied for the top score. */
export const loveTop = (t: Record<LoveKey, number>): LoveKey[] => LOVE_KEYS.filter((k) => t[k] === Math.max(...LOVE_KEYS.map((x) => t[x])));
export interface LoveAnalysis {
  receive: { key: LoveKey; score: number }[];
  give: { key: LoveKey; score: number }[];
  topReceive: LoveKey[];
  topGive: LoveKey[];
  /** True when the top language you give is also one you like to receive. */
  match: boolean;
  /** A plain line on how the two sides line up. */
  gapLine: string;
}
export function analyseLove(r: LoveResult): LoveAnalysis {
  const topReceive = loveTop(r.receive);
  const topGive = loveTop(r.give);
  const match = topReceive.some((k) => topGive.includes(k));
  const names = (ks: LoveKey[]) => ks.map((k) => LOVE_LANGUAGES[k].name.toLowerCase()).join(' and ');
  const gapLine = match
    ? `You show love the way you like to feel it: ${names(topGive)}. That makes it easy to know what to give, but do not assume the people close to you want the same.`
    : `You show love through ${names(topGive)}, but you feel it most through ${names(topReceive)}. People may be giving you what they would like to get. Tell them what works for you, and ask what works for them.`;
  return { receive: loveRanked(r.receive).map((key) => ({ key, score: r.receive[key] })), give: loveRanked(r.give).map((key) => ({ key, score: r.give[key] })), topReceive, topGive, match, gapLine };
}

// -- how your mind works: attention, energy and impulse, patterns and senses --

export type MindArea = 'att' | 'ene' | 'pat';
export type MindBand = 'few' | 'some' | 'many';
export const MIND_AREAS: readonly { key: MindArea; name: string; blurb: string; helps: string[] }[] = [
  { key: 'att', name: 'Attention', blurb: 'Starting, staying with and finishing things, and keeping track of what you need.', helps: ['Cut a task into subtasks, so the first step is tiny.', 'Run a short focus round (15 minutes) with Start focus, then a break.', 'Keep one list and let new ideas wait in Not scheduled yet.'] },
  { key: 'ene', name: 'Energy and impulse', blurb: 'Feeling restless, acting quickly and finding it hard to wait.', helps: ['Move before you sit: a two-minute walk or stretch before a long task.', 'Use short rounds with a stand-up break.', 'Count to ten before you say yes to something new.'] },
  { key: 'pat', name: 'Patterns and senses', blurb: 'Needing routines, noticing detail, strong interests, and being easily worn out by noise, light or people.', helps: ['Keep a steady routine on Daily and plan tomorrow tonight.', 'Warn yourself about changes, and give yourself time to land.', 'Build quiet breaks into the day and ask for what your senses need.'] },
];
/** Six screens of four lines. Say how often each is true for you. */
export const MIND_SCREENS: readonly (readonly { area: MindArea; text: string }[])[] = [
  [
    { area: 'att', text: 'I put off starting tasks, even ones I care about.' },
    { area: 'ene', text: 'I feel restless when I have to sit still.' },
    { area: 'pat', text: 'Loud noise, bright light or certain textures bother me a lot.' },
    { area: 'att', text: 'My mind drifts when I read or listen for a while.' },
  ],
  [
    { area: 'ene', text: 'I fidget, tap or move my legs when I am sitting.' },
    { area: 'pat', text: 'A change of plan upsets me more than it seems to upset others.' },
    { area: 'att', text: 'I lose things I need, like keys, my phone or my notes.' },
    { area: 'ene', text: 'I finish other people’s sentences or talk over them.' },
  ],
  [
    { area: 'pat', text: 'I can dive into an interest for hours and forget everything else.' },
    { area: 'att', text: 'I leave tasks half done and jump to something else.' },
    { area: 'ene', text: 'I act first and think later.' },
    { area: 'pat', text: 'I need my routines to feel okay.' },
  ],
  [
    { area: 'att', text: 'I forget plans, bills or replies unless I write them down.' },
    { area: 'ene', text: 'I find waiting in a line hard.' },
    { area: 'pat', text: 'I rehearse conversations in my head before I have them.' },
    { area: 'att', text: 'I lose track of time and run late.' },
  ],
  [
    { area: 'ene', text: 'I feel driven, as if I am always on the go.' },
    { area: 'pat', text: 'Being around people for long leaves me drained.' },
    { area: 'att', text: 'I find it hard to keep my space or my files in order.' },
    { area: 'ene', text: 'I take on too much because a new thing looks exciting.' },
  ],
  [
    { area: 'pat', text: 'I notice small details and patterns that others miss.' },
    { area: 'att', text: 'Small noises or passing thoughts pull me off a task.' },
    { area: 'ene', text: 'I blurt out things I wish I had kept in.' },
    { area: 'pat', text: 'I take words literally and sometimes miss hints or jokes.' },
  ],
];
export type MindAnswers = (number[] | null)[];
export interface MindResult {
  /** 0 to 100 for each area: how often the lines are true for you. */
  areas: Record<MindArea, { score: number; band: MindBand }>;
}
export const mindBand = (score: number): MindBand => (score < 40 ? 'few' : score < 65 ? 'some' : 'many');
export const emptyMindAnswers = (): MindAnswers => MIND_SCREENS.map(() => null);
export function parseMindAnswers(raw: unknown): MindAnswers {
  const out = emptyMindAnswers();
  (Array.isArray(raw) ? raw : []).slice(0, out.length).forEach((v, i) => {
    if (Array.isArray(v) && v.length === MIND_SCREENS[i]!.length && v.every((x) => intIn(x, 5))) out[i] = v as number[];
  });
  return out;
}
export function scoreMind(a: MindAnswers): MindResult {
  const areas = {} as MindResult['areas'];
  for (const ar of MIND_AREAS) {
    const vals: number[] = [];
    MIND_SCREENS.forEach((screen, i) => screen.forEach((item, k) => (item.area === ar.key && a[i]?.[k] !== undefined ? vals.push(a[i]![k]!) : null)));
    const score = clamp100((mean(vals) / 4) * 100);
    areas[ar.key] = { score, band: mindBand(score) };
  }
  return { areas };
}
export const MIND_READINGS: Record<MindArea, Record<MindBand, string>> = {
  att: {
    few: 'Few signs. Starting and finishing things is mostly steady for you.',
    some: 'Some signs. Starting or finishing can be hard on some days, especially with long or dull tasks.',
    many: 'Many signs. Starting, staying on track and keeping track of things is often hard. That is common, and there are good tools for it.',
  },
  ene: {
    few: 'Few signs. You can usually sit, wait and think before you act.',
    some: 'Some signs. You feel restless or act fast now and then, mostly when you are bored or stressed.',
    many: 'Many signs. Restlessness or acting before you think shows up often. Movement and short bursts can help a lot.',
  },
  pat: {
    few: 'Few signs. Change, noise and crowds usually do not throw you.',
    some: 'Some signs. You like your routines and can be worn out by noise or people, mostly on busy days.',
    many: 'Many signs. Routines, strong interests and sensitive senses shape your days a lot. Plan for them and they become strengths.',
  },
};
export interface MindAnalysis {
  areas: { key: MindArea; name: string; blurb: string; score: number; band: MindBand; reading: string; helps: string[] }[];
  /** True when two areas read many, or any area scores 75 or more. This is only a pointer, never a finding. */
  talkToSomeone: boolean;
  note: string;
}
export const MIND_NOTE = 'This is a self-check, not a test for ADHD, autism or anything else. Only a trained professional can say what is going on. Many people have some of these signs, and stress, poor sleep or low mood can cause the same ones.';
export function analyseMind(r: MindResult): MindAnalysis {
  const areas = MIND_AREAS.map((ar) => ({ key: ar.key, name: ar.name, blurb: ar.blurb, score: r.areas[ar.key].score, band: r.areas[ar.key].band, reading: MIND_READINGS[ar.key][r.areas[ar.key].band], helps: ar.helps }));
  const many = areas.filter((a) => a.band === 'many').length;
  return { areas, talkToSomeone: many >= 2 || areas.some((a) => a.score >= 75), note: MIND_NOTE };
}

// ---- Human design: where the planets were. Our own low-precision astronomy (Meeus, and the JPL approximate orbits), good to a few arc minutes
// for the years people are born in, which is far finer than a gate (5.625 degrees) and fine enough for a line (0.9375 degrees) except right on its edge. ----

const RAD = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;
const sinD = (d: number) => Math.sin(d * RAD);
const cosD = (d: number) => Math.cos(d * RAD);

export type DesignBody = 'sun' | 'earth' | 'moon' | 'nnode' | 'snode' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
export const DESIGN_BODIES: readonly { key: DesignBody; name: string; glyph: string }[] = [
  { key: 'sun', name: 'Sun', glyph: '☉' },
  { key: 'earth', name: 'Earth', glyph: '⊕' },
  { key: 'moon', name: 'Moon', glyph: '☽' },
  { key: 'nnode', name: 'North node', glyph: '☊' },
  { key: 'snode', name: 'South node', glyph: '☋' },
  { key: 'mercury', name: 'Mercury', glyph: '☿' },
  { key: 'venus', name: 'Venus', glyph: '♀' },
  { key: 'mars', name: 'Mars', glyph: '♂' },
  { key: 'jupiter', name: 'Jupiter', glyph: '♃' },
  { key: 'saturn', name: 'Saturn', glyph: '♄' },
  { key: 'uranus', name: 'Uranus', glyph: '♅' },
  { key: 'neptune', name: 'Neptune', glyph: '♆' },
  { key: 'pluto', name: 'Pluto', glyph: '♇' },
];

/** The Julian day of an instant (milliseconds since 1970, UTC). */
export const julianDay = (ms: number): number => ms / 86_400_000 + 2440587.5;

/** Dynamical time minus universal time, in seconds (Espenak and Meeus fits, 1900 to 2050). */
export function deltaTSeconds(year: number): number {
  if (year < 1900) return -2.79;
  if (year < 1920) {
    const t = year - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (year < 1941) {
    const t = year - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (year < 1961) {
    const t = year - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (year < 1986) {
    const t = year - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (year < 2005) {
    const t = year - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  const t = year - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
}

/** Julian centuries of dynamical time since J2000, for an instant in UTC milliseconds. */
export function centuriesOf(ms: number): number {
  const year = 1970 + ms / 31_556_952_000;
  return (julianDay(ms) + deltaTSeconds(year) / 86400 - 2451545.0) / 36525;
}

/** The small wobble of the equinox in longitude, in degrees. */
function nutationLongitude(T: number): number {
  const omega = 125.04452 - 1934.136261 * T;
  const L = 280.4665 + 36000.7698 * T;
  const Lm = 218.3165 + 481267.8813 * T;
  return (-17.2 * sinD(omega) - 1.32 * sinD(2 * L) - 0.23 * sinD(2 * Lm) + 0.21 * sinD(2 * omega)) / 3600;
}

/** The Sun's apparent longitude (Meeus, chapter 25), in degrees. */
export function sunLongitude(T: number): number {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinD(M) + (0.019993 - 0.000101 * T) * sinD(2 * M) + 0.000289 * sinD(3 * M);
  const omega = 125.04 - 1934.136 * T;
  return norm360(L0 + C - 0.00569 - 0.00478 * sinD(omega));
}

// Meeus table 47.A, longitude terms: [D, M, M', F, coefficient in millionths of a degree].
const MOON_TERMS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892], [2, 1, 1, 0, -810], [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381], [1, 1, 1, 0, 351], [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330], [2, -1, 2, 0, 327], [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];

/** The arguments the Moon's series and the node share (Meeus, chapter 47). */
function lunarArgs(T: number) {
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  return {
    Lp: 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000,
    D: 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000,
    M: 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000,
    Mp: 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000,
    F: 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000,
  };
}

/** The Moon's longitude (Meeus, chapter 47, longitude terms), with the equinox wobble added. */
export function moonLongitude(T: number): number {
  const { Lp, D, M, Mp, F } = lunarArgs(T);
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sum = 0;
  for (const [d, m, mp, f, c] of MOON_TERMS) sum += c * (Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1) * sinD(d * D + m * M + mp * Mp + f * F);
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  sum += 3958 * sinD(A1) + 1962 * sinD(Lp - F) + 318 * sinD(A2);
  return norm360(Lp + sum / 1e6 + nutationLongitude(T));
}

/** The true north node of the Moon, in degrees. */
export function trueNodeLongitude(T: number): number {
  const { D, M, Mp, F } = lunarArgs(T);
  const T2 = T * T;
  const mean = 125.0445479 - 1934.1362891 * T + 0.0020754 * T2 + (T2 * T) / 467441 - (T2 * T2) / 60616000;
  const corr = -1.4979 * sinD(2 * (D - F)) - 0.15 * sinD(M) - 0.1226 * sinD(2 * D) + 0.1176 * sinD(2 * F) - 0.0801 * sinD(2 * (Mp - F));
  return norm360(mean + corr + nutationLongitude(T));
}

// The JPL approximate orbits (1800 to 2050): a, e, I, L, long. of perihelion, long. of node, each with its rate per century.
type Orbit = readonly [number, number, number, number, number, number, number, number, number, number, number, number];
const ORBITS: Record<string, Orbit> = {
  mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
  uranus: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.9542763, 0.40805281, 74.01692503, 0.04240589],
  neptune: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664],
  pluto: [39.48211675, -0.00031596, 0.2488273, 0.0000517, 17.14001206, 0.00004818, 238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482],
};

/** Heliocentric position on the J2000 ecliptic, in AU. */
function orbitPosition(name: string, T: number): [number, number, number] {
  const o = ORBITS[name]!;
  const a = o[0] + o[1] * T;
  const e = o[2] + o[3] * T;
  const I = o[4] + o[5] * T;
  const L = o[6] + o[7] * T;
  const w = o[8] + o[9] * T;
  const node = o[10] + o[11] * T;
  const peri = w - node;
  let M = ((L - w) % 360) * RAD;
  if (M > Math.PI) M -= 2 * Math.PI;
  if (M < -Math.PI) M += 2 * Math.PI;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = cosD(peri);
  const sw = sinD(peri);
  const cO = cosD(node);
  const sO = sinD(node);
  const cI = cosD(I);
  const sI = sinD(I);
  return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp, (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp, sw * sI * xp + cw * sI * yp];
}

/** A planet's longitude as seen from the Earth, of the date, in degrees. */
export function planetLongitude(name: 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto', T: number): number {
  const p = orbitPosition(name, T);
  const e = orbitPosition('earth', T);
  const lon = Math.atan2(p[1] - e[1], p[0] - e[0]) / RAD;
  const precession = 1.396971 * T + 0.0003086 * T * T;
  return norm360(lon + precession + nutationLongitude(T));
}

/** The ecliptic longitude of each of the thirteen bodies, tropical, in degrees, for an instant in UTC milliseconds. */
export function bodyLongitudes(ms: number): Record<DesignBody, number> {
  const T = centuriesOf(ms);
  const sun = sunLongitude(T);
  const node = trueNodeLongitude(T);
  return {
    sun,
    earth: norm360(sun + 180),
    moon: moonLongitude(T),
    nnode: node,
    snode: norm360(node + 180),
    mercury: planetLongitude('mercury', T),
    venus: planetLongitude('venus', T),
    mars: planetLongitude('mars', T),
    jupiter: planetLongitude('jupiter', T),
    saturn: planetLongitude('saturn', T),
    uranus: planetLongitude('uranus', T),
    neptune: planetLongitude('neptune', T),
    pluto: planetLongitude('pluto', T),
  };
}

/** The instant (UTC milliseconds) when the Sun stood 88 degrees of longitude before where it stood at `ms`: the design moment. */
export function designMoment(ms: number): number {
  const target = norm360(sunLongitude(centuriesOf(ms)) - 88);
  let t = ms - 88.3 * 86_400_000;
  for (let i = 0; i < 20; i += 1) {
    const diff = ((sunLongitude(centuriesOf(t)) - target + 540) % 360) - 180;
    if (Math.abs(diff) < 1e-6) break;
    t -= (diff / 0.9856) * 86_400_000;
  }
  return Math.round(t);
}

/** The Fagan-Bradley ayanamsa: the gap between the tropical and the sidereal zodiac, in degrees (24 02' 31" on 1 Jan 1950, growing about 50.26" a year). */
export function faganBradleyAyanamsa(ms: number): number {
  const years = (julianDay(ms) - 2433282.4235) / 365.2425;
  return 24.042044 + (50.2564 / 3600) * years;
}

// ---- Human design: the chart, in either zodiac ----
// Human design is a system for self-reflection, not science. The app uses it as a set of prompts, and turns each one into a small step you can do and count.

export type Zodiac = 'tropical' | 'fagan';
export const ZODIACS: readonly { key: Zodiac; name: string; blurb: string }[] = [
  { key: 'tropical', name: 'Tropical', blurb: 'The zodiac of the seasons, and the one Human design is usually drawn in. Zero degrees Aries is the March equinox.' },
  { key: 'fagan', name: 'Sidereal (Fagan-Bradley)', blurb: 'The zodiac measured against the fixed stars, using the Fagan-Bradley shift, about 24.7 degrees back from tropical today.' },
];
export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'] as const;
/** A longitude as a sign and a position in it: "Pisces 3°12′". */
export function signOf(lon: number): { sign: string; deg: number; min: number; text: string } {
  const x = norm360(lon);
  const s = Math.floor(x / 30);
  const within = x - s * 30;
  const deg = Math.floor(within);
  const min = Math.floor((within - deg) * 60);
  return { sign: SIGNS[s]!, deg, min, text: `${SIGNS[s]} ${deg}°${String(min).padStart(2, '0')}′` };
}

/** The sixty-four gates in the order they run round the wheel, from 2 degrees of Aquarius (302 degrees) on. */
export const GATE_WHEEL: readonly number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57,
  32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
];
const GATE_SPAN = 360 / 64;
const LINE_SPAN = GATE_SPAN / 6;
export function gateAt(lon: number): { gate: number; line: number; edge: number } {
  const x = norm360(lon - 302);
  const idx = Math.min(63, Math.floor(x / GATE_SPAN));
  const within = x - idx * GATE_SPAN;
  const line = Math.min(6, Math.floor(within / LINE_SPAN) + 1);
  const into = within - (line - 1) * LINE_SPAN;
  return { gate: GATE_WHEEL[idx]!, line, edge: Math.min(into, LINE_SPAN - into) };
}

/** The keynote of each gate, 1 to 64. */
export const GATE_NAMES: readonly string[] = [
  'Self-expression', 'Direction of the self', 'Ordering', 'Formulizing', 'Fixed rhythms', 'Friction', 'The role of the self', 'Contribution', 'Focus', 'Behavior of the self',
  'Ideas', 'Caution', 'The listener', 'Power skills', 'Extremes', 'Skills', 'Opinions', 'Correction', 'Wanting', 'The now',
  'Control', 'Grace', 'Assimilation', 'Rationalizing', 'The spirit of the self', 'The egoist', 'Caring', 'The game player', 'Perseverance', 'Feelings',
  'Influence', 'Continuity', 'Privacy', 'Power', 'Change', 'Crisis', 'Friendship', 'The fighter', 'Provocation', 'Aloneness',
  'Contraction', 'Growth', 'Insight', 'Alertness', 'The gatherer', 'Determination of the self', 'Realization', 'Depth', 'Principles', 'Values',
  'Shock', 'Stillness', 'Beginnings', 'Ambition', 'Spirit', 'Stimulation', 'Intuitive clarity', 'Vitality', 'Sexuality', 'Acceptance',
  'Mystery', 'Details', 'Doubt', 'Confusion',
];

export type DesignCenter = 'head' | 'ajna' | 'throat' | 'g' | 'heart' | 'spleen' | 'solar' | 'sacral' | 'root';
export const DESIGN_CENTERS: readonly { key: DesignCenter; name: string; motor: boolean; gates: readonly number[]; defined: string; open: string }[] = [
  { key: 'head', name: 'Head', motor: false, gates: [64, 61, 63], defined: 'A steady pull to think about big questions and ideas.', open: 'You take in other people’s questions. Not every question is yours to answer.' },
  { key: 'ajna', name: 'Ajna', motor: false, gates: [47, 24, 4, 17, 43, 11], defined: 'A set way of making sense of things, which you use again and again.', open: 'A flexible mind that sees many sides. You may feel pressure to look certain when you are not.' },
  { key: 'throat', name: 'Throat', motor: false, gates: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16], defined: 'A steady way to speak and to make things happen.', open: 'Your voice changes with the room. Speak when it is truly your turn, and you need not fill the silence.' },
  { key: 'g', name: 'Identity (G)', motor: false, gates: [1, 13, 25, 46, 2, 15, 10, 7], defined: 'A steady sense of who you are and where you are heading.', open: 'Your sense of direction shifts with the place and the people. The right places and people matter a lot.' },
  { key: 'heart', name: 'Heart (Ego)', motor: true, gates: [21, 40, 26, 51], defined: 'Steady willpower. You can keep promises to yourself.', open: 'You may feel you have something to prove. You do not. Promise less, and keep it.' },
  { key: 'spleen', name: 'Spleen', motor: false, gates: [48, 57, 44, 50, 32, 28, 18], defined: 'A steady gut sense for what is safe and healthy, which speaks once and quietly.', open: 'You can hold on to people, habits and places past their time. Practise letting go.' },
  { key: 'solar', name: 'Solar plexus', motor: true, gates: [36, 22, 37, 6, 49, 55, 30], defined: 'Your mood moves in waves. Clarity comes with time, not in the moment.', open: 'You take in other people’s feelings and may avoid conflict. Notice which feelings are yours.' },
  { key: 'sacral', name: 'Sacral', motor: true, gates: [34, 5, 14, 29, 59, 9, 3, 42, 27], defined: 'Steady life force. Your energy is there when the work fits you.', open: 'Your energy is borrowed. Rest before you are tired, and learn when you have done enough.' },
  { key: 'root', name: 'Root', motor: true, gates: [53, 60, 52, 19, 39, 41, 58, 38, 54], defined: 'Steady drive and pressure to get things done.', open: 'You take in stress and hurry. Do not rush to be free of pressure.' },
];
const CENTER_OF: Record<number, DesignCenter> = Object.fromEntries(DESIGN_CENTERS.flatMap((c) => c.gates.map((g) => [g, c.key]))) as Record<number, DesignCenter>;
export const centerOfGate = (g: number): DesignCenter => CENTER_OF[g]!;

/** The thirty-six channels: two gates that, when both are on, join two centers. */
export const DESIGN_CHANNELS: readonly { a: number; b: number; name: string }[] = [
  { a: 64, b: 47, name: 'Abstraction' }, { a: 61, b: 24, name: 'Awareness' }, { a: 63, b: 4, name: 'Logic' }, { a: 17, b: 62, name: 'Acceptance' },
  { a: 43, b: 23, name: 'Structuring' }, { a: 11, b: 56, name: 'Curiosity' }, { a: 31, b: 7, name: 'The alpha' }, { a: 8, b: 1, name: 'Inspiration' },
  { a: 33, b: 13, name: 'The prodigal' }, { a: 20, b: 10, name: 'Awakening' }, { a: 45, b: 21, name: 'Money' }, { a: 16, b: 48, name: 'The wavelength' },
  { a: 20, b: 57, name: 'The brainwave' }, { a: 35, b: 36, name: 'Transitoriness' }, { a: 12, b: 22, name: 'Openness' }, { a: 20, b: 34, name: 'Charisma' },
  { a: 25, b: 51, name: 'Initiation' }, { a: 15, b: 5, name: 'Rhythm' }, { a: 2, b: 14, name: 'The beat' }, { a: 46, b: 29, name: 'Discovery' },
  { a: 10, b: 34, name: 'Exploration' }, { a: 10, b: 57, name: 'Perfected form' }, { a: 26, b: 44, name: 'Surrender' }, { a: 40, b: 37, name: 'Community' },
  { a: 27, b: 50, name: 'Preservation' }, { a: 57, b: 34, name: 'Power' }, { a: 59, b: 6, name: 'Intimacy' }, { a: 9, b: 52, name: 'Concentration' },
  { a: 3, b: 60, name: 'Mutation' }, { a: 42, b: 53, name: 'Maturation' }, { a: 18, b: 58, name: 'Judgment' }, { a: 28, b: 38, name: 'Struggle' },
  { a: 32, b: 54, name: 'Transformation' }, { a: 19, b: 49, name: 'Synthesis' }, { a: 39, b: 55, name: 'Emoting' }, { a: 41, b: 30, name: 'Recognition' },
];

export type DesignType = 'generator' | 'mg' | 'manifestor' | 'projector' | 'reflector';
export const DESIGN_TYPES: Record<DesignType, { name: string; share: string; strategy: string; signature: string; notSelf: string; line: string; aura: string }> = {
  generator: { name: 'Generator', share: 'about 37 in 100 people', strategy: 'Wait to respond', signature: 'Satisfaction', notSelf: 'Frustration', aura: 'Open and drawing, it invites people in.', line: 'You are built to work at what lights you up. Life asks, and your gut answers with a clear yes or no.' },
  mg: { name: 'Manifesting Generator', share: 'about 33 in 100 people', strategy: 'Wait to respond, then tell people before you act', signature: 'Satisfaction and peace', notSelf: 'Frustration and anger', aura: 'Open and drawing, and quick to move.', line: 'You are a fast builder with many passions. You can skip steps, change course and still finish.' },
  manifestor: { name: 'Manifestor', share: 'about 9 in 100 people', strategy: 'Tell people before you act', signature: 'Peace', notSelf: 'Anger', aura: 'Closed and strong, and it keeps people at a distance.', line: 'You are here to start things. People push back less when you tell them first.' },
  projector: { name: 'Projector', share: 'about 20 in 100 people', strategy: 'Wait for the invitation', signature: 'Success', notSelf: 'Bitterness', aura: 'Focused and deep, it sees the person in front of you.', line: 'You see people and systems clearly and guide them. You do your best work when you are asked, and you need more rest than most.' },
  reflector: { name: 'Reflector', share: 'about 1 in 100 people', strategy: 'Wait about 28 days before big decisions', signature: 'Surprise', notSelf: 'Disappointment', aura: 'Open and sampling, it mirrors the room.', line: 'You mirror the health of the places and people around you. Choose both with care.' },
};
export type DesignAuthority = 'emotional' | 'sacral' | 'splenic' | 'ego' | 'self' | 'mental' | 'lunar';
export const DESIGN_AUTHORITIES: Record<DesignAuthority, { name: string; line: string }> = {
  emotional: { name: 'Emotional', line: 'Do not decide in the moment. Ride the wave and wait for clarity. That is often a night or more.' },
  sacral: { name: 'Sacral', line: 'Your gut answers in the moment, with a yes or a no. Ask yourself questions that can be answered that way.' },
  splenic: { name: 'Splenic', line: 'A quiet, quick hunch that speaks once. Act on it the first time you notice it.' },
  ego: { name: 'Ego (Heart)', line: 'Ask: what do I want, and what is worth my effort? Only commit to what you have the will for.' },
  self: { name: 'Self-projected', line: 'Talk it out loud with people you trust, and listen to what you hear yourself say.' },
  mental: { name: 'Mental (no inner authority)', line: 'Talk it through with a few people, in a few different places, and see which answer stays clear.' },
  lunar: { name: 'Lunar', line: 'Wait about 28 days, and talk the choice over with different people on the way.' },
};
export const DESIGN_LINES: readonly { name: string; line: string }[] = [
  { name: 'Investigator', line: 'You need a solid base. You dig in until you feel safe.' },
  { name: 'Hermit', line: 'You have natural talent that others see before you do, and you need time alone.' },
  { name: 'Experimenter', line: 'You learn by trying. Mistakes are how you find what works.' },
  { name: 'Networker', line: 'You grow through a few close ties, and your circle opens doors.' },
  { name: 'Problem solver', line: 'People hope you will fix things. Promise less than you can do.' },
  { name: 'Role model', line: 'Life comes in three stages: you try things, step back, then lead by example.' },
];
export const DESIGN_PROFILES: Record<string, string> = {
  '1/3': 'Investigator and Experimenter', '1/4': 'Investigator and Networker', '2/4': 'Hermit and Networker', '2/5': 'Hermit and Problem solver', '3/5': 'Experimenter and Problem solver', '3/6': 'Experimenter and Role model',
  '4/6': 'Networker and Role model', '4/1': 'Networker and Investigator', '5/1': 'Problem solver and Investigator', '5/2': 'Problem solver and Hermit', '6/2': 'Role model and Hermit', '6/3': 'Role model and Experimenter',
};
export type DesignAngle = 'right' | 'juxtaposition' | 'left';
export const DESIGN_ANGLES: Record<DesignAngle, { name: string; line: string }> = {
  right: { name: 'Right angle', line: 'A personal path: your life is about your own story, and the people who come into it.' },
  juxtaposition: { name: 'Juxtaposition', line: 'A fixed path with a strong focus. Your way of seeing stays steady all your life.' },
  left: { name: 'Left angle', line: 'A path through other people: your work shows in how you touch groups and teams.' },
};

export interface DesignActivation {
  body: DesignBody;
  /** In the zodiac asked for, degrees. */
  lon: number;
  gate: number;
  line: number;
  /** How far inside its line the position sits, in degrees. Near zero means another program might call it the next line. */
  edge: number;
}
export interface DesignChannel {
  a: number;
  b: number;
  name: string;
  centers: [DesignCenter, DesignCenter];
  /** Which side switched on both gates: the conscious side, the unconscious side, or both. */
  from: 'personality' | 'design' | 'both';
}
export interface DesignChart {
  zodiac: Zodiac;
  personality: DesignActivation[];
  design: DesignActivation[];
  channels: DesignChannel[];
  defined: DesignCenter[];
  open: DesignCenter[];
  type: DesignType;
  authority: DesignAuthority;
  profile: { p: number; d: number; text: string };
  definition: 'none' | 'single' | 'split' | 'triple' | 'quadruple';
  cross: { angle: DesignAngle; pSun: number; pEarth: number; dSun: number; dEarth: number };
}

export interface DesignInput {
  /** Birth date, YYYY-MM-DD, as written on the birth record. */
  date: string;
  /** Birth time, HH:MM, 24-hour. */
  time: string;
  /** The IANA zone of the birthplace, such as Asia/Kolkata, so a summer-time or an old offset comes out right. */
  zone: string;
  /** The place, as the person writes it. For their own page only. */
  place: string;
  /** The full name on the birth record, for numerology. Optional. */
  name: string;
}
export interface DesignResult {
  input: DesignInput;
  birthUtc: string;
  designUtc: string;
  /** The Fagan-Bradley shift at each of the two moments, in degrees. */
  ayanamsa: { personality: number; design: number };
  /** Tropical longitudes, in degrees, for each of the thirteen bodies. */
  personality: Record<DesignBody, number>;
  design: Record<DesignBody, number>;
}

const isZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone.length > 0 && zone.length <= 64;
  } catch {
    return false;
  }
};
export const emptyDesignInput = (): DesignInput => ({ date: '', time: '', zone: '', place: '', name: '' });
/** The one reader for a birth record from the browser or a column. Anything unclean is left empty. */
export function parseDesignInput(raw: unknown): DesignInput {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof o[k] === 'string' ? (o[k] as string).trim().slice(0, max) : '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str('date', 10)) ? str('date', 10) : '';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(str('time', 5)) ? str('time', 5) : '';
  const zone = isZone(str('zone', 64)) ? str('zone', 64) : '';
  // A name is letters, spaces and the marks inside names.
  const name = str('name', 80).replace(/[^\p{L}\p{M} '’.-]/gu, '').replace(/\s+/g, ' ').trim();
  return { date, time, zone, place: str('place', 80), name };
}
export function designInputProblem(i: DesignInput, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!i.date || Number.isNaN(Date.parse(`${i.date}T00:00:00Z`))) return 'Enter your birth date.';
  if (i.date > today) return 'That day has not happened yet.';
  if (i.date < '1900-01-01') return 'The chart works for births from 1900 on.';
  if (!i.time) return 'Enter your birth time, as the hours and minutes on your birth record.';
  if (!i.zone) return 'Pick the time zone of the place you were born.';
  return null;
}
/** The chart's raw numbers for a birth record. Everything else is worked out from these, in either zodiac. */
export function computeDesign(input: DesignInput): DesignResult {
  const [h, m] = input.time.split(':').map(Number);
  const birth = zonedToUtc(input.date, (h ?? 0) * 60 + (m ?? 0), input.zone).getTime();
  const design = designMoment(birth);
  const round = (r: Record<DesignBody, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 10000) / 10000])) as Record<DesignBody, number>;
  return {
    input,
    birthUtc: new Date(birth).toISOString(),
    designUtc: new Date(design).toISOString(),
    ayanamsa: { personality: Math.round(faganBradleyAyanamsa(birth) * 10000) / 10000, design: Math.round(faganBradleyAyanamsa(design) * 10000) / 10000 },
    personality: round(bodyLongitudes(birth)),
    design: round(bodyLongitudes(design)),
  };
}

const EDGE_LIMIT: Partial<Record<DesignBody, number>> = { jupiter: 0.12, saturn: 0.12, uranus: 0.12, neptune: 0.12, pluto: 0.12 };
/** The chart as read in one zodiac: gates and lines, channels, centers, type, authority, profile and cross. */
export function designChart(r: DesignResult, zodiac: Zodiac): DesignChart {
  const side = (lons: Record<DesignBody, number>, shift: number): DesignActivation[] =>
    DESIGN_BODIES.map((b) => {
      const lon = norm360(lons[b.key] - (zodiac === 'fagan' ? shift : 0));
      const g = gateAt(lon);
      return { body: b.key, lon, gate: g.gate, line: g.line, edge: g.edge };
    });
  const personality = side(r.personality, r.ayanamsa.personality);
  const design = side(r.design, r.ayanamsa.design);
  const on = { p: new Set(personality.map((x) => x.gate)), d: new Set(design.map((x) => x.gate)) };
  const channels: DesignChannel[] = [];
  for (const c of DESIGN_CHANNELS) {
    const pa = on.p.has(c.a);
    const pb = on.p.has(c.b);
    const da = on.d.has(c.a);
    const db = on.d.has(c.b);
    if (!((pa || da) && (pb || db))) continue;
    const from = pa && pb ? 'personality' : da && db ? 'design' : 'both';
    channels.push({ a: c.a, b: c.b, name: c.name, centers: [centerOfGate(c.a), centerOfGate(c.b)], from });
  }
  const defined = DESIGN_CENTERS.map((c) => c.key).filter((k) => channels.some((c) => c.centers.includes(k)));
  const open = DESIGN_CENTERS.map((c) => c.key).filter((k) => !defined.includes(k));
  // Which defined centers touch each other through channels: the groups that make up definition.
  const parent = new Map<DesignCenter, DesignCenter>(defined.map((c) => [c, c]));
  const find = (c: DesignCenter): DesignCenter => (parent.get(c) === c ? c : find(parent.get(c)!));
  for (const ch of channels) parent.set(find(ch.centers[0]), find(ch.centers[1]));
  const groupOf = (c: DesignCenter) => (defined.includes(c) ? find(c) : null);
  const groups = new Set(defined.map(find)).size;
  const definition = (['none', 'single', 'split', 'triple', 'quadruple'] as const)[Math.min(4, groups)]!;
  const isOn = (c: DesignCenter) => defined.includes(c);
  const throatGroup = groupOf('throat');
  const motorToThroat = throatGroup !== null && DESIGN_CENTERS.some((c) => c.motor && isOn(c.key) && groupOf(c.key) === throatGroup);
  const type: DesignType = defined.length === 0 ? 'reflector' : isOn('sacral') ? (motorToThroat ? 'mg' : 'generator') : motorToThroat ? 'manifestor' : 'projector';
  const authority: DesignAuthority =
    type === 'reflector' ? 'lunar' : isOn('solar') ? 'emotional' : isOn('sacral') ? 'sacral' : isOn('spleen') ? 'splenic' : isOn('heart') ? 'ego' : isOn('g') && throatGroup !== null && groupOf('g') === throatGroup ? 'self' : 'mental';
  const pSun = personality[0]!;
  const dSun = design[0]!;
  const key = `${pSun.line}/${dSun.line}`;
  const angle: DesignAngle = key === '4/1' ? 'juxtaposition' : ['5/1', '5/2', '6/2', '6/3'].includes(key) ? 'left' : 'right';
  return {
    zodiac,
    personality,
    design,
    channels,
    defined,
    open,
    type,
    authority,
    profile: { p: pSun.line, d: dSun.line, text: key },
    definition,
    cross: { angle, pSun: pSun.gate, pEarth: personality[1]!.gate, dSun: dSun.gate, dEarth: design[1]!.gate },
  };
}

// ---- Human design: the reading, in three layers, and what to do about it ----

/** The app's own way to group a reading, by the dimensions on its map of consciousness: 3D for the body and the day, 5D for the mind and other people, 7D for purpose. */
export const DESIGN_DEPTHS: readonly { key: '3d' | '5d' | '7d' | 'num'; name: string; blurb: string }[] = [
  { key: '3d', name: '3D · Body and day', blurb: 'How you are built to work, decide and rest. The practical layer: your type, strategy, authority and energy.' },
  { key: '5d', name: '5D · Mind and people', blurb: 'How you learn, relate and think. Your profile, your channels, and what you take in from others.' },
  { key: '7d', name: '7D · Purpose', blurb: 'What you are here to give. Your cross, the gates of your Sun, Earth and nodes, and what stands out between the two zodiacs.' },
  { key: 'num', name: 'Numerology', blurb: 'The numbers in your birth date and your name, with the master numbers 11, 22 and 33 and the turning point 10, set beside what Discover learned about you.' },
];
export interface DesignBlock {
  title: string;
  text: string;
  items?: string[];
}
export interface DesignGoal {
  pillar: RelationshipKey;
  title: string;
  /** Why the chart suggests it. */
  why: string;
  /** The first small step. */
  step: string;
  /** How you will know it happened: something to count. */
  proof: string;
}
export interface DesignAnalysis {
  headline: string;
  depths: Record<'3d' | '5d' | '7d', DesignBlock[]>;
  goals: DesignGoal[];
  /** Positions that sit so near the edge of a line that another program may read the next line. */
  edges: string[];
}
const listNames = (g: number[]) => g.map((n) => `${n} ${GATE_NAMES[n - 1]}`).join(', ');
const centerName = (k: DesignCenter) => DESIGN_CENTERS.find((c) => c.key === k)!.name;

const TYPE_GOAL: Record<DesignType, { title: string; step: string; proof: string }> = {
  generator: { title: 'Say yes only to what lights you up', step: 'Before you agree to anything this week, ask yourself a yes or no question and notice how your body answers.', proof: 'Count your gut yeses. Aim for five this week.' },
  mg: { title: 'Respond first, then tell people your plan', step: 'When something comes up, wait for your gut to answer. If it is a yes, say what you will do before you do it.', proof: 'Tell someone your plan first on five days this week.' },
  manifestor: { title: 'Tell people before you act', step: 'Before a move that touches other people, send one line: what you are about to do.', proof: 'Send five heads-up messages this week.' },
  projector: { title: 'Wait to be asked, and rest well', step: 'Share advice only when someone asks. If you see something useful, say you have a thought and ask if they want it.', proof: 'Get asked, or invited, three times this month. Sleep eight hours on five nights this week.' },
  reflector: { title: 'Sleep on every big choice', step: 'Write the choice in your journal today, talk it over with three different people, and decide in about 28 days.', proof: 'One big decision logged and decided on its day.' },
};
const AUTH_GOAL: Record<DesignAuthority, { title: string; step: string; proof: string }> = {
  emotional: { title: 'Never decide a money or work matter in the moment', step: 'For any big yes, say, “Let me sleep on it.” Come back after a night, then after three, and see if the answer holds.', proof: 'Three big decisions delayed by a night this month.' },
  sacral: { title: 'Make work choices with a yes or no gut check', step: 'Turn each choice into a yes or no question. Say it aloud and notice the first answer in your body.', proof: 'Five work choices made this way this week.' },
  splenic: { title: 'Act on the first quiet hunch', step: 'When a quiet hunch speaks, write it down and act on it before you talk yourself out of it.', proof: 'Three hunches noted and acted on this week.' },
  ego: { title: 'Promise only what you want to do', step: 'Before you commit, ask: do I want this, and is it worth my effort? Write down what you promise.', proof: 'Keep every promise you make this week, and make fewer.' },
  self: { title: 'Decide by talking it out', step: 'Pick one trusted person for each big choice. Say what you think out loud and listen to yourself.', proof: 'Two big choices talked through before you decide this month.' },
  mental: { title: 'Talk it through in different places', step: 'Take each big choice to two people and to two different places, such as a walk and a cafe. See which answer stays clear.', proof: 'Three decisions made this way this month.' },
  lunar: { title: 'Give big choices a moon', step: 'Log the choice, then check in on it each week for four weeks with a different person.', proof: 'One big decision followed through four weeks.' },
};
const LINE_LEARN: readonly { title: string; step: string; proof: string }[] = [
  { title: 'Study one thing deeply before you share it', step: 'Pick one topic. Spend four weeks reading and testing before you teach or post about it.', proof: 'Thirty minutes a day on five days a week, for four weeks.' },
  { title: 'Make room for your natural talent', step: 'Block two free afternoons a week with no plan, and notice what you do without being asked.', proof: 'Two free blocks kept each week for a month.' },
  { title: 'Run three small experiments', step: 'Try three small things. After each, write what did not work and what you learned. Mistakes count as results.', proof: 'Three experiments with three written lessons this month.' },
  { title: 'Share what you learn with three people', step: 'Pick three people you know. Tell each one a thing you learned this week.', proof: 'Three conversations a week for four weeks.' },
  { title: 'Solve one real problem for someone', step: 'Ask a person what is stuck. Offer one small fix, and under-promise.', proof: 'One problem solved and one thank-you received this month.' },
  { title: 'Learn by trying, then lead by example', step: 'For thirty days, be a student of one skill. After that, show someone else the first steps.', proof: 'Thirty days logged, then one lesson given.' },
];
const OPEN_GOAL: Partial<Record<DesignCenter, { title: string; step: string; proof: string }>> = {
  heart: { title: 'Stop proving yourself at home', step: 'This week, do one thing for your family with no promise attached and nothing to show for it.', proof: 'Three small things done quietly.' },
  solar: { title: 'Pause before you answer a heated message', step: 'Before you reply to a message that stirs you, wait an hour and ask whose feeling it is.', proof: 'Five replies delayed an hour.' },
  sacral: { title: 'Rest before you are tired', step: 'Pick a fixed bedtime and keep it. Stop work when your day’s work is done, not when you are empty.', proof: 'Bedtime kept seven nights in a row.' },
  root: { title: 'Do not rush to be free of pressure', step: 'Pick one task you feel hurried about. Do it at an even pace for twenty minutes, then stop.', proof: 'Five calm twenty-minute blocks this week.' },
  spleen: { title: 'Let one old thing go', step: 'Name one habit, thing or tie that has outlived its use. Take one step to let it go.', proof: 'One thing let go this month.' },
  g: { title: 'Choose your places and people', step: 'List where you feel most like yourself. Spend your next free evening in one of those places.', proof: 'Three evenings in places that feel right.' },
  throat: { title: 'Speak when it is truly your turn', step: 'In a group, wait until you are asked or until the point is clearly yours, then say it plainly.', proof: 'Three times you waited and then spoke.' },
  ajna: { title: 'Say “I am not sure yet”', step: 'Once a day, let a question stay open instead of pretending to be certain.', proof: 'Five open questions kept open this week.' },
  head: { title: 'Pick which questions are yours', step: 'Write the questions on your mind. Cross out the ones other people put there.', proof: 'One list written and cut down to three.' },
};
const CROSS_GOAL: Record<DesignAngle, string> = {
  right: 'Write one page on your own path: where you want to be in a year and what you will build to get there.',
  juxtaposition: 'Write down the one thing you keep returning to, and give it a fixed hour every week.',
  left: 'Choose one group or team and plan one thing to give them each month.',
};

/** The chart, read in three layers, with goals you can do and count. */
export function analyseDesign(c: DesignChart): DesignAnalysis {
  const t = DESIGN_TYPES[c.type];
  const au = DESIGN_AUTHORITIES[c.authority];
  const pl = DESIGN_LINES[c.profile.p - 1]!;
  const dl = DESIGN_LINES[c.profile.d - 1]!;
  const all = [...c.personality, ...c.design];
  const edges = all
    .filter((a) => a.edge < (EDGE_LIMIT[a.body] ?? 0.04))
    .map((a) => `${DESIGN_BODIES.find((b) => b.key === a.body)!.name}, ${all.indexOf(a) < 13 ? 'conscious' : 'unconscious'}: gate ${a.gate} line ${a.line}`);
  const sunP = c.personality[0]!;
  const earthP = c.personality[1]!;
  const sunD = c.design[0]!;
  const earthD = c.design[1]!;

  const d3: DesignBlock[] = [
    { title: `${t.name}`, text: `${t.line} Strategy: ${t.strategy}. When it works you feel ${t.signature.toLowerCase()}. When it does not, you feel ${t.notSelf.toLowerCase()}.`, items: [`How common: ${t.share}`, `Aura: ${t.aura}`] },
    { title: `${au.name} authority`, text: au.line },
    { title: 'Definition', text: c.definition === 'none' ? 'No centers are defined: you take in the world and reflect it.' : c.definition === 'single' ? 'Single: all your defined centers join, so you feel self-contained and make sense on your own.' : c.definition === 'split' ? 'Split: two groups of centers with a gap. You may like people who bridge the gap for you.' : c.definition === 'triple' ? 'Triple split: three groups. You do well with a variety of people around you, and you need time to join the dots.' : 'Quadruple split: four groups. You need time, and the right people, for things to come together.' },
    { title: `Defined centers (${c.defined.length})`, text: c.defined.length ? 'These work the same way every day. They are your steady energy.' : 'You have none. Your whole chart is open.', items: c.defined.map((k) => `${centerName(k)}: ${DESIGN_CENTERS.find((x) => x.key === k)!.defined}`) },
    { title: `Open centers (${c.open.length})`, text: c.open.length ? 'These take in the world around you. They are where you learn and where you can be pushed around.' : 'You have none open.', items: c.open.map((k) => `${centerName(k)}: ${DESIGN_CENTERS.find((x) => x.key === k)!.open}`) },
  ];
  const d5: DesignBlock[] = [
    { title: `Profile ${c.profile.text}`, text: `${DESIGN_PROFILES[c.profile.text] ?? ''}. The first number is how you show up and the second is the part of you that works underneath.`, items: [`Line ${c.profile.p}, ${pl.name}: ${pl.line}`, `Line ${c.profile.d}, ${dl.name}: ${dl.line}`] },
    { title: `Channels (${c.channels.length})`, text: c.channels.length ? 'A channel joins two centers. It is a skill or a way of being you can count on.' : 'You have no whole channels. You have single gates, which are like themes you can use but do not always have.', items: c.channels.map((ch) => `${ch.a}-${ch.b} ${ch.name}: ${centerName(ch.centers[0])} to ${centerName(ch.centers[1])}, ${ch.from === 'both' ? 'from both sides' : ch.from === 'personality' ? 'conscious' : 'unconscious'}`) },
    { title: 'Conscious and unconscious', text: 'Conscious gates are the ones you know you have. Unconscious gates show up in your body and in how others see you before you do.', items: [`Conscious Sun: gate ${sunP.gate}.${sunP.line}, ${GATE_NAMES[sunP.gate - 1]}`, `Unconscious Sun: gate ${sunD.gate}.${sunD.line}, ${GATE_NAMES[sunD.gate - 1]}`, `Conscious Moon: gate ${c.personality[2]!.gate}.${c.personality[2]!.line}, ${GATE_NAMES[c.personality[2]!.gate - 1]}`] },
    { title: 'With other people', text: `Tell the people close to you your strategy: “${t.strategy}.” Then ask for theirs. Your open centers are where you take on their energy, so notice what is yours.` },
  ];
  const d7: DesignBlock[] = [
    { title: `${DESIGN_ANGLES[c.cross.angle].name} cross`, text: `${DESIGN_ANGLES[c.cross.angle].line} Your cross is made of four gates: the Sun and Earth of your conscious side and of your unconscious side.`, items: [`Conscious Sun: ${c.cross.pSun} ${GATE_NAMES[c.cross.pSun - 1]}`, `Conscious Earth: ${c.cross.pEarth} ${GATE_NAMES[c.cross.pEarth - 1]}`, `Unconscious Sun: ${c.cross.dSun} ${GATE_NAMES[c.cross.dSun - 1]}`, `Unconscious Earth: ${c.cross.dEarth} ${GATE_NAMES[c.cross.dEarth - 1]}`] },
    { title: 'Your nodes', text: 'The nodes point to where you are headed and what you grow out of.', items: [`North node, conscious: ${listNames([c.personality[3]!.gate])}`, `South node, conscious: ${listNames([c.personality[4]!.gate])}`, `North node, unconscious: ${listNames([c.design[3]!.gate])}`, `South node, unconscious: ${listNames([c.design[4]!.gate])}`] },
    { title: 'What you give', text: `Your Sun gate is ${sunP.gate}, ${GATE_NAMES[sunP.gate - 1]}, and your Earth gate is ${earthP.gate}, ${GATE_NAMES[earthP.gate - 1]}. The Sun is what lights you up and the Earth is what keeps you grounded. Underneath, ${sunD.gate} ${GATE_NAMES[sunD.gate - 1]} and ${earthD.gate} ${GATE_NAMES[earthD.gate - 1]} work without you trying.` },
  ];

  const g: DesignGoal[] = [];
  const typeGoal = TYPE_GOAL[c.type];
  g.push({ pillar: 'self', title: typeGoal.title, why: `Your type is ${t.name}, and your strategy is “${t.strategy}.”`, step: typeGoal.step, proof: typeGoal.proof });
  const au2 = AUTH_GOAL[c.authority];
  g.push({ pillar: 'servant_leader', title: au2.title, why: `Your authority is ${au.name.toLowerCase()}.`, step: au2.step, proof: au2.proof });
  const learn = LINE_LEARN[c.profile.p - 1]!;
  g.push({ pillar: 'guru', title: learn.title, why: `The first number of your profile is ${c.profile.p}, the ${pl.name.toLowerCase()}.`, step: learn.step, proof: learn.proof });
  const friendLine = DESIGN_LINES[c.profile.d - 1]!;
  g.push({ pillar: 'friendship', title: `Meet people the way a ${friendLine.name.toLowerCase()} does`, why: `The second number of your profile is ${c.profile.d}: ${friendLine.line}`, step: c.profile.d === 4 ? 'Pick three people you already like and book a coffee with each.' : c.profile.d === 2 ? 'Keep one hour a week for being alone, and answer when friends reach out.' : c.profile.d === 3 ? 'Try one new group or event this month. If it is not for you, that is a result.' : c.profile.d === 5 ? 'Ask a friend what is stuck, and offer one small, honest fix.' : c.profile.d === 6 ? 'Say one honest thing about how you live, to one friend who can use it.' : 'Pick one friend and spend an unhurried evening with them.', proof: 'Three friend moments this month.' });
  const openFirst = (['heart', 'solar', 'sacral', 'root', 'spleen', 'g', 'throat', 'ajna', 'head'] as const).find((k) => c.open.includes(k) && OPEN_GOAL[k]);
  if (openFirst) {
    const o = OPEN_GOAL[openFirst]!;
    g.push({ pillar: openFirst === 'heart' || openFirst === 'solar' ? 'parent_child' : 'self', title: o.title, why: `Your ${centerName(openFirst)} center is open: ${DESIGN_CENTERS.find((x) => x.key === openFirst)!.open}`, step: o.step, proof: o.proof });
  }
  g.push({ pillar: 'lover_partner', title: 'Share how you work with someone close', why: `Your strategy and authority only help if the people you love know them.`, step: `Tell your partner or a close friend: “I do best when I ${t.strategy.charAt(0).toLowerCase()}${t.strategy.slice(1)}, and I decide by ${au.name.toLowerCase()} authority.” Then ask for theirs.`, proof: 'One honest talk, with their answer written down.' });
  g.push({ pillar: 'divine', title: 'Write what your cross says about what you give', why: `Your cross is ${c.cross.pSun}, ${c.cross.pEarth}, ${c.cross.dSun} and ${c.cross.dEarth}, a ${DESIGN_ANGLES[c.cross.angle].name.toLowerCase()} cross.`, step: CROSS_GOAL[c.cross.angle], proof: 'One page written by Sunday.' });
  return { headline: `${t.name} ${c.profile.text}, ${au.name.toLowerCase()} authority`, depths: { '3d': d3, '5d': d5, '7d': d7 }, goals: g, edges };
}

/** Where the two zodiacs agree and where they do not. */
export function designCompare(r: DesignResult): { same: boolean; lines: string[] } {
  const a = designChart(r, 'tropical');
  const b = designChart(r, 'fagan');
  const ta = DESIGN_TYPES[a.type].name;
  const tb = DESIGN_TYPES[b.type].name;
  const lines: string[] = [];
  lines.push(ta === tb ? `Type: ${ta} in both.` : `Type: ${ta} in the tropical zodiac, ${tb} in the sidereal.`);
  lines.push(a.authority === b.authority ? `Authority: ${DESIGN_AUTHORITIES[a.authority].name} in both.` : `Authority: ${DESIGN_AUTHORITIES[a.authority].name} (tropical), ${DESIGN_AUTHORITIES[b.authority].name} (sidereal).`);
  lines.push(a.profile.text === b.profile.text ? `Profile: ${a.profile.text} in both.` : `Profile: ${a.profile.text} (tropical), ${b.profile.text} (sidereal).`);
  const gates = (c: DesignChart) => new Set([...c.personality, ...c.design].map((x) => x.gate));
  const ga = gates(a);
  const gb = gates(b);
  const shared = [...ga].filter((x) => gb.has(x)).length;
  lines.push(`${shared} of ${ga.size} gates are the same in both.`);
  return { same: ta === tb && a.authority === b.authority && a.profile.text === b.profile.text, lines };
}

/** A short line on the chart for the assistant. Never the birth record. */
export interface DesignProfile {
  type: DesignType;
  strategy: string;
  authority: DesignAuthority;
  profile: string;
  /** Numerology: the life path, and the expression when a name was given. Never the name or the date. */
  lifePath: number;
  expression: number | null;
}
export const designProfile = (r: DesignResult): DesignProfile => {
  const c = designChart(r, 'tropical');
  const n = computeNumerology(r.input.date, r.input.name);
  return { type: c.type, strategy: DESIGN_TYPES[c.type].strategy, authority: c.authority, profile: c.profile.text, lifePath: n.lifePath.value, expression: n.expression?.value ?? null };
};


// ---- Numerology: the numbers in a birth date and a name, and what they say next to what Discover learned ----
// Numerology is a system for reflection, not science. Pythagorean letters (A=1 to I=9, then round again), master numbers 11, 22 and 33 kept whole,
// and the compound 10 and the karmic debts 13, 14, 16 and 19 noticed on the way down.

export interface NumberValue {
  /** The number it settles on: 1 to 9, or a master number 11, 22 or 33. */
  value: number;
  /** The sums on the way down, such as [19, 10, 1]. */
  chain: number[];
  master: boolean;
  /** The single digit under it: 11 is 2 underneath, 22 is 4, 33 is 6. */
  base: number;
  /** 13, 14, 16 or 19 when the sums passed through one of the karmic debts. */
  karmic: 13 | 14 | 16 | 19 | null;
}
const digitSum = (n: number): number => String(Math.abs(n)).split('').reduce((s, d) => s + Number(d), 0);
const MASTERS = [11, 22, 33];
export function numberValue(sum: number): NumberValue {
  const chain = [sum];
  let n = sum;
  while (n > 9 && !MASTERS.includes(n)) {
    n = digitSum(n);
    chain.push(n);
  }
  const karmic = chain.find((c) => c === 13 || c === 14 || c === 16 || c === 19) as 13 | 14 | 16 | 19 | undefined;
  const master = MASTERS.includes(n);
  return { value: n, chain, master, base: master ? digitSum(n) : n, karmic: karmic ?? null };
}
const reduced = (n: number): number => numberValue(n).value;

const PYTHAGOREAN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letterValue = (ch: string): number => ((PYTHAGOREAN.indexOf(ch) % 9) + 1);
/** The letters of a name, upper case, with accents taken off and anything else dropped. */
export const nameWords = (name: string): string[] =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
/** A word's vowels: A E I O U, and Y when the word has no other vowel. */
const vowelsOf = (word: string): string[] => {
  const v = word.split('').filter((c) => 'AEIOU'.includes(c));
  return v.length ? v : word.split('').filter((c) => c === 'Y');
};

export interface NumerologyResult {
  lifePath: NumberValue;
  birthday: NumberValue;
  attitude: NumberValue;
  /** From the full name: all letters, the vowels, the consonants. Null without a name. */
  expression: NumberValue | null;
  soulUrge: NumberValue | null;
  personality: NumberValue | null;
  /** The life path and the expression together. */
  maturity: NumberValue | null;
  /** Numbers from 1 to 9 that no letter of the name carries. */
  lessons: number[];
}
/** The numbers in a birth date (YYYY-MM-DD, as written on the record) and, if given, a full name. */
export function computeNumerology(date: string, name = ''): NumerologyResult {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const lifePath = numberValue(reduced(m) + reduced(d) + reduced(y));
  const words = nameWords(name);
  const letters = words.join('').split('');
  let expression: NumberValue | null = null;
  let soulUrge: NumberValue | null = null;
  let personality: NumberValue | null = null;
  let maturity: NumberValue | null = null;
  let lessons: number[] = [];
  if (letters.length > 0) {
    const sum = (cs: string[]) => cs.reduce((s, c) => s + letterValue(c), 0);
    const vowels = words.flatMap(vowelsOf);
    const vowelSet = new Set<string>();
    const consonants: string[] = [];
    for (const w of words) {
      const v = vowelsOf(w);
      w.split('').forEach((c, i) => (v.includes(c) && !(c === 'Y' && !v.every((x) => x === 'Y') ) ? vowelSet.add(`${w}${i}`) : consonants.push(c)));
    }
    expression = numberValue(sum(letters));
    soulUrge = vowels.length ? numberValue(sum(vowels)) : null;
    personality = consonants.length ? numberValue(sum(consonants)) : null;
    maturity = numberValue(lifePath.value + expression.value);
    const have = new Set(letters.map(letterValue));
    lessons = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !have.has(n));
  }
  return { lifePath, birthday: numberValue(d), attitude: numberValue(reduced(d) + reduced(m)), expression, soulUrge, personality, maturity, lessons };
}
/** The year, the month and the day you are in, from the birthday and today's date. The year turns over on 1 January. */
export function personalCycle(date: string, today: string): { year: NumberValue; month: NumberValue; day: NumberValue } {
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const year = numberValue(reduced(m) + reduced(d) + reduced(Number(today.slice(0, 4))));
  const month = numberValue(year.base + Number(today.slice(5, 7)));
  const day = numberValue(month.base + Number(today.slice(8, 10)));
  return { year, month, day };
}

export const NUMBER_LABELS: Record<'lifePath' | 'birthday' | 'attitude' | 'expression' | 'soulUrge' | 'personality' | 'maturity', { name: string; line: string }> = {
  lifePath: { name: 'Life path', line: 'The road you walk. The biggest number.' },
  birthday: { name: 'Birthday number', line: 'A gift you carry from the day you were born.' },
  attitude: { name: 'Attitude', line: 'How you meet the world at first.' },
  expression: { name: 'Expression', line: 'What you are here to do, from your full name.' },
  soulUrge: { name: 'Soul urge', line: 'What you want deep down, from the vowels of your name.' },
  personality: { name: 'Personality', line: 'How others see you, from the consonants of your name.' },
  maturity: { name: 'Maturity', line: 'Who you grow into later in life: life path and expression together.' },
};
export interface NumberReading {
  name: string;
  line: string;
  gift: string;
  shadow: string;
  tryThis: string;
  /** Which of the five Discover traits this number leans on. */
  leans: Partial<Record<Trait, 'high' | 'low'>>;
  /** The pillar it calls on. */
  pillar: RelationshipKey;
}
export const NUMBER_READINGS: Record<number, NumberReading> = {
  1: { name: 'The starter', line: 'You are here to begin things and to stand on your own.', gift: 'Courage, drive and the will to go first.', shadow: 'Going it alone, pushing too hard, or waiting to be told.', tryThis: 'Start one small thing this week without waiting for anyone’s okay.', leans: { c: 'high', a: 'low' }, pillar: 'servant_leader' },
  2: { name: 'The peacemaker', line: 'You are here to join people together and keep the peace.', gift: 'Listening, patience and tact.', shadow: 'Putting yourself last, or dodging a hard talk.', tryThis: 'Ask for one thing you need, kindly and plainly.', leans: { a: 'high', e: 'low' }, pillar: 'lover_partner' },
  3: { name: 'The voice', line: 'You are here to express yourself and bring joy.', gift: 'Words, humour and an easy way with people.', shadow: 'Scattering your energy, or hiding hurt behind a joke.', tryThis: 'Share something you made or wrote with one person.', leans: { e: 'high', o: 'high' }, pillar: 'friendship' },
  4: { name: 'The builder', line: 'You are here to build something solid and lasting.', gift: 'Discipline, order and reliability.', shadow: 'Rigidity, and worry about change.', tryThis: 'Pick one foundation habit and keep it for 21 days.', leans: { c: 'high', o: 'low' }, pillar: 'servant_leader' },
  5: { name: 'The explorer', line: 'You are here to change, to move and to learn by doing.', gift: 'Curiosity, freedom and quick adapting.', shadow: 'Restlessness, and starting more than you finish.', tryThis: 'Try one new thing this week, and finish one old thing.', leans: { o: 'high', c: 'low' }, pillar: 'guru' },
  6: { name: 'The carer', line: 'You are here to care for people and make a home.', gift: 'Warmth, responsibility and a love of beauty.', shadow: 'Taking on everyone’s load, or trying to control.', tryThis: 'Do one kind thing for family, then one for yourself.', leans: { a: 'high', s: 'high' }, pillar: 'parent_child' },
  7: { name: 'The seeker', line: 'You are here to look deeper and find the truth.', gift: 'Insight, focus and a quiet mind.', shadow: 'Pulling away, doubt and overthinking.', tryThis: 'Give one question twenty quiet minutes a day, then write one line.', leans: { o: 'high', e: 'low' }, pillar: 'divine' },
  8: { name: 'The achiever', line: 'You are here to build power, money and results, and to use them well.', gift: 'Drive, judgment and a head for business.', shadow: 'Chasing status, or working too much.', tryThis: 'Set one money or work goal with a number and a date.', leans: { c: 'high', s: 'high' }, pillar: 'servant_leader' },
  9: { name: 'The giver', line: 'You are here to finish things and to serve something larger.', gift: 'Compassion, wisdom and a wide view.', shadow: 'Holding on to the past, or giving until you are empty.', tryThis: 'Finish one thing you left open, then give something away.', leans: { a: 'high', o: 'high' }, pillar: 'divine' },
  10: { name: 'The wheel', line: 'Ten is a turning point: an ending and a fresh start in one number. It settles down to a 1.', gift: 'A chance to begin again with what you learned.', shadow: 'Clinging to what is over.', tryThis: 'Name one thing that is done. Close it, and take the first small step on the next.', leans: {}, pillar: 'self' },
  11: { name: 'The messenger', line: 'A master number, a high 2: you pick up what others miss and can light the way.', gift: 'Intuition, inspiration and sensitivity.', shadow: 'Nervous tension, and doubt about your own gift.', tryThis: 'Write down one hunch a day for a week, then act on one.', leans: { o: 'high', s: 'low' }, pillar: 'divine' },
  22: { name: 'The master builder', line: 'A master number, a high 4: you can turn a big vision into something real.', gift: 'Practical vision, and the patience to build at scale.', shadow: 'Feeling crushed by the size of your own vision.', tryThis: 'Break your biggest goal into ten steps and do the first one today.', leans: { c: 'high', o: 'high' }, pillar: 'servant_leader' },
  33: { name: 'The master teacher', line: 'A master number, a high 6: you are here to lift others through care.', gift: 'Healing, teaching and warm leadership.', shadow: 'Giving yourself away until you burn out.', tryThis: 'Teach one thing you know to one person, and stop when you are tired.', leans: { a: 'high', s: 'high' }, pillar: 'parent_child' },
};
export const KARMIC_DEBTS: Record<13 | 14 | 16 | 19, string> = {
  13: 'A debt around effort: work steadily, because shortcuts cost you more later. It settles into a 4.',
  14: 'A debt around freedom: keep a balance, because freedom works best with limits. It settles into a 5.',
  16: 'A debt around ego: let pride go, because a fall can be a clean start. It settles into a 7.',
  19: 'A debt around power: ask for help and share, and do not carry it all alone. It settles into a 1.',
};
export const YEAR_THEMES: Record<number, { theme: string; step: string }> = {
  1: { theme: 'A year to start. Plant seeds.', step: 'Start the one thing you have been putting off.' },
  2: { theme: 'A year to partner and be patient.', step: 'Make one connection stronger.' },
  3: { theme: 'A year to express and enjoy.', step: 'Share your work, and say yes to joy.' },
  4: { theme: 'A year to build a base.', step: 'Pick one foundation and work on it every week.' },
  5: { theme: 'A year of change and freedom.', step: 'Say yes to one change, and plan for it.' },
  6: { theme: 'A year of home and care.', step: 'Look after the people and the place close to you.' },
  7: { theme: 'A year to look inward.', step: 'Rest, study and think. Do less and see more clearly.' },
  8: { theme: 'A year of power and results.', step: 'Aim at one clear goal with a number.' },
  9: { theme: 'A year to finish and let go.', step: 'Close what is done, and clear space.' },
  11: { theme: 'A year of insight.', step: 'Listen for the hunch, and act on one.' },
  22: { theme: 'A year to build something big.', step: 'Take the first real step on a long plan.' },
  33: { theme: 'A year to teach and to heal.', step: 'Give your time to one person who needs it.' },
};
const TRAIT_STEP: Record<Trait, { high: string; low: string }> = {
  o: { high: 'Try one new thing in your pillars today, even a small one.', low: 'Keep the routine that works, and change only one thing in it.' },
  c: { high: 'Plan the day the night before, and give each task a finish line.', low: 'Pick one task and finish only that today. Small and done beats big and open.' },
  e: { high: 'Do one step with another person today: a friend, a circle or a run.', low: 'Keep a quiet hour in your day, and do your hardest task in it.' },
  a: { high: 'Put one of your own needs on today’s list, and keep it.', low: 'Say one kind, plain thing to someone today before you give your view.' },
  s: { high: 'Use your steadiness: take the one task others are avoiding.', low: 'Take two minutes with the breathing timer before your hardest task.' },
};
const TYPE_ACTION: Record<DesignType, string> = {
  generator: 'let the year bring things to you to respond to, and say yes only to what lights you up',
  mg: 'respond first, then tell the people involved your plan before you move',
  manifestor: 'start what the year asks for, and tell the people it touches before you act',
  projector: 'wait for the invitation that fits the year, and rest well',
  reflector: 'give each big choice a moon, about 28 days, before you commit',
};
export interface NumerologyContext {
  /** How each of the five traits reads, from the main Discover result. */
  traits?: Record<Trait, TraitBand> | null;
  top?: RelationshipKey[];
  growth?: RelationshipKey | null;
  design?: DesignProfile | null;
  love?: { receive: LoveKey[]; give: LoveKey[] } | null;
}
export interface NumerologyInsight {
  kind: 'agree' | 'stretch' | 'combo';
  title: string;
  text: string;
  /** A small thing to do about it. */
  step: string;
  pillar?: RelationshipKey;
}
/** What the numbers say next to what the person's own answers said: where they agree, where they stretch, and how they combine with the chart. */
export function numerologyInsights(n: NumerologyResult, cycle: ReturnType<typeof personalCycle>, ctx: NumerologyContext): NumerologyInsight[] {
  const out: NumerologyInsight[] = [];
  const core: [string, NumberValue | null][] = [
    ['Life path', n.lifePath],
    ['Expression', n.expression],
    ['Soul urge', n.soulUrge],
  ];
  const traitName = (t: Trait) => TRAITS.find((x) => x.key === t)!.name.toLowerCase();
  let agree = 0;
  let stretch = 0;
  for (const [label, v] of core) {
    if (!v) continue;
    const r = NUMBER_READINGS[v.value]!;
    const tag = `${label} ${v.value}${v.master ? `/${v.base}` : ''}`;
    for (const [trait, dir] of Object.entries(r.leans) as [Trait, 'high' | 'low'][]) {
      const band = ctx.traits?.[trait];
      if (!band || band === 'mid') continue;
      if (band === dir && agree < 3) {
        agree += 1;
        out.push({ kind: 'agree', title: `${tag} and your ${traitName(trait)}`, text: `Your ${tag}, ${r.name.toLowerCase()}, leans ${dir === 'high' ? 'high' : 'low'} on ${traitName(trait)}, and your Discover answers read ${band}. They point the same way, so this is a strength to lean on. ${r.gift}`, step: r.tryThis, pillar: r.pillar });
      } else if (band !== dir && stretch < 3) {
        stretch += 1;
        out.push({ kind: 'stretch', title: `${tag} and your ${traitName(trait)}`, text: `Your ${tag}, ${r.name.toLowerCase()}, leans ${dir} on ${traitName(trait)}, but your Discover answers read ${band}. That is a place to grow, not a flaw: a number says what you are here to build, not what you have built so far.`, step: TRAIT_STEP[trait][dir], pillar: r.pillar });
      }
    }
  }
  const lp = NUMBER_READINGS[n.lifePath.value]!;
  if (ctx.top?.includes(lp.pillar)) out.push({ kind: 'agree', title: 'Your life path and your top strengths', text: `Your life path calls on ${RELATIONSHIP_BY_KEY[lp.pillar].name.toLowerCase()}, and ${DISCOVER_STRENGTHS[lp.pillar].name} is one of your top three strengths in Discover. The road and the strength match.`, step: lp.tryThis, pillar: lp.pillar });
  else if (ctx.growth === lp.pillar) out.push({ kind: 'stretch', title: 'Your life path and your quietest strength', text: `Your life path calls on ${RELATIONSHIP_BY_KEY[lp.pillar].name.toLowerCase()}, but ${DISCOVER_STRENGTHS[lp.pillar].name} is your quietest strength in Discover. It is the easiest place to start a small habit.`, step: DISCOVER_STRENGTHS[lp.pillar].tryThis, pillar: lp.pillar });
  const yr = YEAR_THEMES[cycle.year.value] ?? YEAR_THEMES[cycle.year.base]!;
  if (ctx.design) {
    out.push({ kind: 'combo', title: `Personal year ${cycle.year.value} and your strategy`, text: `${yr.theme} Your Human design strategy is “${ctx.design.strategy.charAt(0).toLowerCase()}${ctx.design.strategy.slice(1)}”, so this year, ${TYPE_ACTION[ctx.design.type]}.`, step: yr.step });
  }
  if (ctx.love && [2, 6, 33].includes(n.lifePath.value)) {
    out.push({ kind: 'combo', title: 'A care number and how you show love', text: `Your life path ${n.lifePath.value} is about care, and you show love through ${ctx.love.give.map((k) => LOVE_LANGUAGES[k].name.toLowerCase()).join(' and ')}. Put the two together in one act.`, step: LOVE_LANGUAGES[ctx.love.give[0]!].give, pillar: 'lover_partner' });
  }
  return out;
}

/** Progress through one add-on. */
export function extraProgress(kind: ExtraKind, raw: unknown): { done: number; total: number } {
  if (kind === 'design') return { done: designInputProblem(parseDesignInput(raw)) === null ? 1 : 0, total: 1 };
  if (kind === 'type') return { done: parseTypeAnswers(raw).filter(Boolean).length, total: TYPE_SCREENS.length };
  if (kind === 'mind') return { done: parseMindAnswers(raw).filter(Boolean).length, total: MIND_SCREENS.length };
  const a = parseLoveAnswers(raw);
  return { done: a.receive.filter((v) => v !== null).length + a.give.filter((v) => v !== null).length, total: LOVE_PAIRS.length * 2 };
}
export const extraComplete = (kind: ExtraKind, raw: unknown): boolean => {
  const p = extraProgress(kind, raw);
  return p.done === p.total;
};
export const emptyExtra = (kind: ExtraKind): unknown => (kind === 'type' ? emptyTypeAnswers() : kind === 'mind' ? emptyMindAnswers() : kind === 'design' ? emptyDesignInput() : emptyLoveAnswers());
export const parseExtra = (kind: ExtraKind, raw: unknown): unknown => (kind === 'type' ? parseTypeAnswers(raw) : kind === 'mind' ? parseMindAnswers(raw) : kind === 'design' ? parseDesignInput(raw) : parseLoveAnswers(raw));
export function scoreExtra(kind: ExtraKind, answers: unknown): TypeResult | LoveResult | MindResult | DesignResult {
  return kind === 'type' ? scoreType(answers as TypeAnswers) : kind === 'mind' ? scoreMind(answers as MindAnswers) : kind === 'design' ? computeDesign(answers as DesignInput) : scoreLove(answers as LoveAnswers);
}

/** A short summary of the add-ons taken. Never the answers or the scores. The mind part only travels when the person switched it on. */
export interface ExtrasProfile {
  type?: string;
  love?: { receive: LoveKey[]; give: LoveKey[] };
  mind?: Record<MindArea, MindBand>;
  /** Human design: the type, strategy, authority and profile only. Never the birth date, time or place. */
  design?: DesignProfile;
}
export function extrasProfile(x: { type?: TypeResult | null; love?: LoveResult | null; mind?: MindResult | null; design?: DesignResult | null }, allowMind: boolean): ExtrasProfile | null {
  const out: ExtrasProfile = {};
  if (x.type) out.type = x.type.code;
  if (x.design) out.design = designProfile(x.design);
  if (x.love) out.love = { receive: loveTop(x.love.receive), give: loveTop(x.love.give) };
  if (x.mind && allowMind) out.mind = Object.fromEntries(MIND_AREAS.map((a) => [a.key, x.mind!.areas[a.key].band])) as Record<MindArea, MindBand>;
  return Object.keys(out).length ? out : null;
}
/** How to help, from the add-ons. Never names a condition. */
export function extraHints(x: ExtrasProfile): string[] {
  const out: string[] = [];
  if (x.type) for (const l of x.type.split('')) if (l in TYPE_LETTERS) out.push(TYPE_LETTERS[l as TypeLetter].hint);
  if (x.love) {
    out.push(`They feel cared for through ${x.love.receive.map((k) => LOVE_LANGUAGES[k].name.toLowerCase()).join(' and ')}, and show care through ${x.love.give.map((k) => LOVE_LANGUAGES[k].name.toLowerCase()).join(' and ')}. For a step about a person, suggest that kind of gesture.`);
  }
  if (x.design) {
    const h: Record<DesignType, string> = {
      generator: 'Let them respond: ask a clear question that can be answered with a yes or a no, rather than pushing a plan.',
      mg: 'Let them respond first, then help them tell the people involved before they move. They like to try several things.',
      manifestor: 'Do not hold them up with questions. Suggest telling the people involved before they act.',
      projector: 'Wait to be asked before you advise, and ask whether they would like your view first. Remind them to rest.',
      reflector: 'Do not rush big choices. Suggest giving them time and talking them over with a few people.',
    };
    out.push(h[x.design.type]);
    out.push(`Decisions suit their ${DESIGN_AUTHORITIES[x.design.authority].name.toLowerCase()} authority: ${DESIGN_AUTHORITIES[x.design.authority].line}`);
  }
  if (x.mind) {
    if (x.mind.att !== 'few') out.push('Offer one small step at a time and a short focus round. Use plain checklists and remind them kindly, never with blame.');
    if (x.mind.ene !== 'few') out.push('Keep steps short and active, and suggest a movement break between them.');
    if (x.mind.pat !== 'few') out.push('Keep things predictable. Say what is coming and warn them before a change. Be clear and literal.');
  }
  return out;
}
export function extrasForAssistant(x: ExtrasProfile): string {
  const bits: string[] = [];
  if (x.type) bits.push(`Four-letter type from a self-check: ${x.type} (${TYPE_NAMES[x.type]?.name ?? 'a type'}).`);
  if (x.love) bits.push(`Love languages: receives best through ${x.love.receive.map((k) => LOVE_LANGUAGES[k].name).join(' and ')}; shows love through ${x.love.give.map((k) => LOVE_LANGUAGES[k].name).join(' and ')}.`);
  if (x.design) bits.push(`Human design (a system for reflection, not science, so never state it as fact): ${DESIGN_TYPES[x.design.type].name}, strategy “${x.design.strategy}”, ${DESIGN_AUTHORITIES[x.design.authority].name.toLowerCase()} authority, profile ${x.design.profile}. Numerology, another reflection tool: life path ${x.design.lifePath} (${NUMBER_READINGS[x.design.lifePath]?.name.toLowerCase() ?? ''})${x.design.expression ? `, expression ${x.design.expression}` : ''}.`);
  if (x.mind) bits.push(`How their mind works, as self-reported signs (never a diagnosis, never name a condition, never suggest they have one): ${MIND_AREAS.map((a) => `${a.name.toLowerCase()}: ${x.mind![a.key]} signs`).join('; ')}. Use this only to pace and shape steps.`);
  return bits.join(' ');
}
/** The one paragraph the assistant reads: the main quiz and the add-ons together, either may be missing. */
export function learnedForAssistant(p: DiscoverProfile | null, x: ExtrasProfile | null): string | null {
  if (!p && !x) return null;
  if (p && !x) return profileForAssistant(p);
  const extra = `${extrasForAssistant(x!)} How to help: ${extraHints(x!).join(' ')}`;
  if (p) return `${profileForAssistant(p)} Self-checks too. ${extra}`;
  return `They took short self-checks in Discover. They are not diagnoses, so never state them back as facts about the person and never use them to label them. Use them only to pick your tone and the size of a step. ${extra}`;
}

/** A short summary of the latest result. Never the answers, and nothing a person could not read on their own Discover page. */
export interface DiscoverProfile {
  takenAt: string;
  top: RelationshipKey[];
  growth: RelationshipKey;
  bands: Record<Trait, TraitBand>;
  level: DiscoverAnalysis['reasoning']['level'];
  /** How each emotional intelligence part reads, when that part was taken. */
  eq?: Record<EqDim, TraitBand>;
}

export function discoverProfile(result: DiscoverResult, takenAt: string): DiscoverProfile {
  const a = analyseDiscover(result);
  const bands = Object.fromEntries(a.personality.map((p) => [p.trait, p.band])) as Record<Trait, TraitBand>;
  const eq = a.eq ? (Object.fromEntries(a.eq.dims.map((d) => [d.dim, d.band])) as Record<EqDim, TraitBand>) : undefined;
  return { takenAt, top: result.top, growth: result.growth, bands, level: a.reasoning.level, ...(eq ? { eq } : {}) };
}

/** How to help this person, in plain sentences: used to pick a tone and the size of a step. Rules only. */
export function styleHints(p: DiscoverProfile): string[] {
  const out: string[] = [];
  if (p.bands.c === 'low') out.push('Keep steps tiny and one at a time, each with a clear finish line.');
  if (p.bands.c === 'high') out.push('They like plans: give an ordered list and respect their deadlines.');
  if (p.bands.s === 'low') out.push('Be calm and reassuring. Name one small step and do not pile on.');
  if (p.bands.s === 'high') out.push('They are steady, so you can be direct.');
  if (p.bands.e === 'low') out.push('Keep messages short. Do not push social plans.');
  if (p.bands.e === 'high') out.push('They like energy: people-based steps, such as a friend, a circle or a run, suit them.');
  if (p.bands.a === 'high') out.push('Gently encourage them to put their own needs on the list.');
  if (p.bands.a === 'low') out.push('Be straight and brief. They prefer honesty to softness.');
  if (p.bands.o === 'high') out.push('Offer a fresh option now and then.');
  if (p.bands.o === 'low') out.push('Stick to routines that work and change one thing at a time.');
  if (p.eq?.m === 'low') out.push('When they are upset, slow down and name the feeling before you offer a step.');
  if (p.eq?.a === 'low') out.push('Ask how they feel before you suggest a fix.');
  if (p.eq?.s === 'low') out.push('Keep hard conversations in small steps, and let them lead.');
  if (p.eq?.d === 'low') out.push('Celebrate small wins, because motivation dips when results are slow.');
  out.push(p.level === 'Sharp' || p.level === 'Strong' ? 'They like to know the why: give a short reason.' : 'Use short examples and plain words.');
  return out;
}

/** The paragraph the assistant reads, when the person allowed it and the model keeps nothing. */
export function profileForAssistant(p: DiscoverProfile): string {
  const strengths = p.top.map((k) => DISCOVER_STRENGTHS[k].name).join(', ');
  const traits = TRAITS.map((t) => `${t.name.toLowerCase()}: ${p.bands[t.key]}`).join('; ');
  const eqLine = p.eq ? ` Emotional side: ${EQ_DIMS.map((d) => `${d.name.toLowerCase()}: ${p.eq![d.key]}`).join('; ')}.` : '';
  return `They took the Discover quiz on ${p.takenAt.slice(0, 10)}. It is a self-check, not a diagnosis, so never state it back as a fact about them and never use it to label them. Use it only to pick your tone and the size of a step. Strongest: ${strengths}. Quietest: ${DISCOVER_STRENGTHS[p.growth].name}. Traits: ${traits}. Reasoning puzzles: ${p.level}.${eqLine} How to help: ${styleHints(p).join(' ')}`;
}

/** Where each strength is worked on in the app. */
export const STRENGTH_PATH: Record<RelationshipKey, string> = Object.fromEntries((Object.keys(DISCOVER_STRENGTHS) as RelationshipKey[]).map((k) => [k, `/realm/${k}`])) as Record<RelationshipKey, string>;

// ---- focus rounds: pomodoro-style work in Mindful minutes, with a dashboard of how the time went ----

export type FocusView = 'day' | 'week' | 'month';
export const FOCUS_VIEWS: readonly { key: FocusView; name: string; count: number; blurb: string }[] = [
  { key: 'day', name: 'Days', count: 14, blurb: 'The last two weeks, day by day.' },
  { key: 'week', name: 'Weeks', count: 8, blurb: 'The last eight weeks, Monday to Sunday.' },
  { key: 'month', name: 'Months', count: 6, blurb: 'The last six months.' },
];
export const isFocusView = (v: unknown): v is FocusView => v === 'day' || v === 'week' || v === 'month';
export const FOCUS_MAX_MINUTES = 120;

export interface FocusTask {
  id: string;
  title: string;
  relationship: RelationshipKey;
  dueDate: string | null;
}
export interface FocusBucket {
  /** The first day of the bucket: a day, a Monday, or the first of a month. */
  key: string;
  label: string;
  minutes: number;
  rounds: number;
  /** Tasks ticked in the bucket. */
  tasksDone: number;
}
export interface FocusResponse {
  view: FocusView;
  buckets: FocusBucket[];
  totals: { minutes: number; rounds: number; tasksDone: number; activeBuckets: number };
  /** Where the time went in this stretch, most first. */
  tasks: { nodeId: string | null; title: string; minutes: number; rounds: number }[];
  best: { key: string; label: string; minutes: number } | null;
  /** A plain line on how this stretch compares with the one before it. */
  trend: string;
}

// ---- repeating tasks: daily, on weekdays, weekly on chosen days, monthly, yearly; every N of them; until a day, or for ever ----

export type RepeatKind = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';
export interface Repeat {
  kind: RepeatKind;
  /** Every this many days, weeks, months or years. 1 to 52. Weekdays ignores it. */
  every: number;
  /** Weekly only: the days, 1 for Monday to 7 for Sunday. Empty means the day the task is on. */
  days: number[];
  /** The last day it may come back on, or null for no end. */
  until: string | null;
}
export const REPEAT_KINDS: readonly { key: RepeatKind; name: string; unit: string }[] = [
  { key: 'daily', name: 'Every day', unit: 'day' },
  { key: 'weekdays', name: 'Weekdays', unit: 'weekday' },
  { key: 'weekly', name: 'Every week', unit: 'week' },
  { key: 'monthly', name: 'Every month', unit: 'month' },
  { key: 'yearly', name: 'Every year', unit: 'year' },
];
export const MAX_REPEAT_EVERY = 52;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const asDay = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const fromDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY_MS = 86_400_000;
export const addDays = (d: string, n: number): string => fromDay(asDay(d) + n * DAY_MS);
/** 1 for Monday to 7 for Sunday. */
export const isoWeekday = (d: string): number => ((new Date(asDay(d)).getUTCDay() + 6) % 7) + 1;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const daysBetween = (a: string, b: string): number => Math.round((asDay(b) - asDay(a)) / DAY_MS);

/** The one reader for a repeat rule, from the browser or from a column: anything that is not a clean rule is no rule. */
export function parseRepeat(raw: unknown): Repeat | null {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const kind = REPEAT_KINDS.find((k) => k.key === o.kind)?.key;
  if (!kind) return null;
  const every = Math.min(MAX_REPEAT_EVERY, Math.max(1, Math.round(Number(o.every) || 1)));
  const days = Array.isArray(o.days) ? [...new Set(o.days.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b) : [];
  const until = typeof o.until === 'string' && DATE_PATTERN.test(o.until) ? o.until : null;
  return { kind, every: kind === 'weekdays' ? 1 : every, days: kind === 'weekly' ? days : [], until };
}

/**
 * The first day after `after` on which the rule falls, counting from `base` (the day the task was on): daily and weekly steps are
 * counted from the base, a month keeps the same day of the month (the 31st lands on the last day of a short month) and a year the same
 * day of the year (29 February lands on 28 February in a year without one). Null when the rule has ended.
 */
export function nextOccurrence(rule: Repeat, base: string, after: string): string | null {
  const pick = (d: string | null): string | null => (d && (!rule.until || d <= rule.until) ? d : null);
  if (rule.kind === 'daily') {
    const gap = daysBetween(base, after);
    const k = gap < 0 ? 0 : Math.floor(gap / rule.every) + 1;
    return pick(addDays(base, k * rule.every));
  }
  if (rule.kind === 'weekdays') {
    let d = addDays(after, 1);
    while (isoWeekday(d) > 5) d = addDays(d, 1);
    return pick(d);
  }
  if (rule.kind === 'weekly') {
    const days = rule.days.length ? rule.days : [isoWeekday(base)];
    const weekOf = (d: string) => addDays(d, -(isoWeekday(d) - 1));
    for (let i = 1; i <= 7 * rule.every + 7; i += 1) {
      const d = addDays(after, i);
      if (days.includes(isoWeekday(d)) && (daysBetween(weekOf(base), weekOf(d)) / 7) % rule.every === 0) return pick(d);
    }
    return null;
  }
  const y0 = Number(base.slice(0, 4));
  const m0 = Number(base.slice(5, 7)) - 1;
  const day = Number(base.slice(8, 10));
  for (let k = 0; k < 800; k += 1) {
    const total = rule.kind === 'monthly' ? m0 + k * rule.every : m0 + k * rule.every * 12;
    const y = y0 + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    const d = fromDay(Date.UTC(y, m, Math.min(day, daysInMonth(y, m))));
    if (d > after) return pick(d);
  }
  return null;
}

const ORDINAL = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};
const WEEKDAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The rule in plain words: "Every day", "Every 2 weeks on Mon and Thu", "Every month on the 15th until 2027-03-01". */
export function repeatLabel(rule: Repeat, base: string | null = null): string {
  const n = rule.every;
  const days = rule.days.length ? rule.days : base ? [isoWeekday(base)] : [];
  const list = days.map((d) => WEEKDAY_NAMES_SHORT[d - 1]!);
  const on = list.length ? ` on ${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]}` : '';
  const head =
    rule.kind === 'daily'
      ? n === 1 ? 'Every day' : `Every ${n} days`
      : rule.kind === 'weekdays'
        ? 'On weekdays'
        : rule.kind === 'weekly'
          ? `${n === 1 ? 'Every week' : `Every ${n} weeks`}${on}`
          : rule.kind === 'monthly'
            ? `${n === 1 ? 'Every month' : `Every ${n} months`}${base ? ` on the ${ORDINAL(Number(base.slice(8, 10)))}` : ''}`
            : n === 1 ? 'Every year' : `Every ${n} years`;
  return rule.until ? `${head}, until ${rule.until}` : head;
}
/** The day a task opens: its do date, else its due date. Null for a task with no date. */
export const openDay = (t: { doDate: string | null; dueDate: string | null }): string | null => t.doDate ?? t.dueDate;

/** One line in a task's checklist. */
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/** Priority tags, P0 the most pressing. A tag helps a person choose; it never changes what a tick pays. */
export type Priority = 0 | 1 | 2 | 3;
export const PRIORITIES: { value: Priority; tag: string; name: string; blurb: string }[] = [
  { value: 0, tag: 'P0', name: 'Do now', blurb: 'Urgent and it matters. Drop other things for it.' },
  { value: 1, tag: 'P1', name: 'Important', blurb: 'Matters this week. Do it before the normal ones.' },
  { value: 2, tag: 'P2', name: 'Normal', blurb: 'Part of the plan. Do it in its turn.' },
  { value: 3, tag: 'P3', name: 'Whenever', blurb: 'Nice to do. Fine to wait.' },
];
export function parsePriority(raw: unknown): Priority | null {
  if (typeof raw === 'string') {
    const m = /^p?([0-3])$/i.exec(raw.trim());
    return m ? (Number(m[1]) as Priority) : null;
  }
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3 ? (raw as Priority) : null;
}
export const priorityTag = (p: Priority | null): string => (p === null ? '' : `P${p}`);

/** How a list of tasks can be ordered. */
export const TASK_SORTS = [
  { key: 'day', name: 'Day', blurb: 'The day to do it first, then priority.' },
  { key: 'priority', name: 'Priority', blurb: 'P0 first, then the day.' },
  { key: 'due', name: 'Due date', blurb: 'The soonest deadline first; no deadline last.' },
] as const;
export type TaskSort = (typeof TASK_SORTS)[number]['key'];
export const isTaskSort = (v: unknown): v is TaskSort => TASK_SORTS.some((s) => s.key === v);

/** The one ordering for a list of tasks. Stable: ties keep the order given. A task with no priority sorts after P3. */
export function sortTasks<T extends { doDate: string | null; dueDate: string | null; dueTime: string | null; priority: Priority | null }>(list: T[], by: TaskSort): T[] {
  const pri = (t: T) => (t.priority === null ? 4 : t.priority);
  const day = (t: T) => t.doDate ?? t.dueDate ?? '9999-99-99';
  const due = (t: T) => t.dueDate ?? '9999-99-99';
  const time = (t: T) => t.dueTime ?? '99:99';
  const cmp = (a: T, b: T): number => {
    if (by === 'priority') return pri(a) - pri(b) || day(a).localeCompare(day(b)) || time(a).localeCompare(time(b));
    if (by === 'due') return due(a).localeCompare(due(b)) || pri(a) - pri(b) || day(a).localeCompare(day(b));
    return day(a).localeCompare(day(b)) || time(a).localeCompare(time(b)) || pri(a) - pri(b);
  };
  return list.map((t, i) => ({ t, i })).sort((x, y) => cmp(x.t, y.t) || x.i - y.i).map((x) => x.t);
}

// ---- The line of the day: a thought from a philosopher or from the app, one a day, none back until all have been shown ----

/** Lines from philosophers and thinkers, each with who said it. Translations vary; these are the common English renderings. */
const PHILOSOPHER_LINES: readonly (readonly [string, string])[] = [
  ['The soul becomes dyed with the color of its thoughts.', 'Marcus Aurelius'],
  ['If it is not right, do not do it; if it is not true, do not say it.', 'Marcus Aurelius'],
  ['What stands in the way becomes the way.', 'Marcus Aurelius'],
  ['Waste no more time arguing about what a good man should be. Be one.', 'Marcus Aurelius'],
  ['Very little is needed to make a happy life; it is all within yourself, in your way of thinking.', 'Marcus Aurelius'],
  ['Do every act of your life as though it were your last.', 'Marcus Aurelius'],
  ['Our life is what our thoughts make it.', 'Marcus Aurelius'],
  ['Loss is nothing else but change, and change is nature’s delight.', 'Marcus Aurelius'],
  ['Accept the things to which fate binds you, and love the people with whom fate brings you together, but do so with all your heart.', 'Marcus Aurelius'],
  ['Never esteem anything as of advantage to you that will make you break your word or lose your self-respect.', 'Marcus Aurelius'],
  ['Look well into thyself; there is a source of strength which will always spring up if thou wilt always look.', 'Marcus Aurelius'],
  ['We suffer more often in imagination than in reality.', 'Seneca'],
  ['It is not that we have a short time to live, but that we waste much of it.', 'Seneca'],
  ['While we are postponing, life speeds by.', 'Seneca'],
  ['No man was ever wise by chance.', 'Seneca'],
  ['Difficulties strengthen the mind, as labor does the body.', 'Seneca'],
  ['If a man knows not to which port he sails, no wind is favorable.', 'Seneca'],
  ['Begin at once to live, and count each separate day as a separate life.', 'Seneca'],
  ['He suffers more than necessary who suffers before it is necessary.', 'Seneca'],
  ['Life is long if you know how to use it.', 'Seneca'],
  ['True happiness is to enjoy the present, without anxious dependence upon the future.', 'Seneca'],
  ['Associate with people who are likely to improve you.', 'Seneca'],
  ['It is a rough road that leads to the heights of greatness.', 'Seneca'],
  ['Sometimes even to live is an act of courage.', 'Seneca'],
  ['Men are disturbed not by things, but by the views they take of them.', 'Epictetus'],
  ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus'],
  ['No man is free who is not master of himself.', 'Epictetus'],
  ['Wealth consists not in having great possessions, but in having few wants.', 'Epictetus'],
  ['It is impossible for a man to learn what he thinks he already knows.', 'Epictetus'],
  ['If you want to improve, be content to be thought foolish and stupid.', 'Epictetus'],
  ['Make the best use of what is in your power, and take the rest as it happens.', 'Epictetus'],
  ['How long will you wait before you demand the best for yourself?', 'Epictetus'],
  ['Only the educated are free.', 'Epictetus'],
  ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
  ['Knowing others is intelligence; knowing yourself is true wisdom.', 'Lao Tzu'],
  ['He who knows he has enough is rich.', 'Lao Tzu'],
  ['Nature does not hurry, yet everything is accomplished.', 'Lao Tzu'],
  ['The softest things in the world overcome the hardest things in the world.', 'Lao Tzu'],
  ['Mastering others is strength; mastering yourself is true power.', 'Lao Tzu'],
  ['The best of people is like water.', 'Lao Tzu'],
  ['Do the difficult things while they are easy, and do the great things while they are small.', 'Lao Tzu'],
  ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
  ['To know what you know and what you do not know, that is true knowledge.', 'Confucius'],
  ['The man who moves a mountain begins by carrying away small stones.', 'Confucius'],
  ['Everything has beauty, but not everyone sees it.', 'Confucius'],
  ['He who learns but does not think is lost; he who thinks but does not learn is in great danger.', 'Confucius'],
  ['Wherever you go, go with all your heart.', 'Confucius'],
  ['The gem cannot be polished without friction, nor man perfected without trials.', 'Confucius'],
  ['We are what we repeatedly do. Excellence, then, is not an act but a habit.', 'Will Durant, on Aristotle'],
  ['Happiness depends upon ourselves.', 'Aristotle'],
  ['The roots of education are bitter, but the fruit is sweet.', 'Aristotle'],
  ['Pleasure in the job puts perfection in the work.', 'Aristotle'],
  ['Well begun is half done.', 'Aristotle'],
  ['Hope is a waking dream.', 'Aristotle'],
  ['The aim of the wise is not to secure pleasure, but to avoid pain.', 'Aristotle'],
  ['Friendship is a single soul dwelling in two bodies.', 'Aristotle'],
  ['In all things of nature there is something of the marvelous.', 'Aristotle'],
  ['The unexamined life is not worth living.', 'Socrates'],
  ['I neither know nor think that I know.', 'Socrates'],
  ['Know thyself.', 'Socrates'],
  ['Be as you wish to seem.', 'Socrates'],
  ['The beginning is the most important part of the work.', 'Plato'],
  ['Courage is knowing what not to fear.', 'Plato'],
  ['Wonder is the feeling of a philosopher, and philosophy begins in wonder.', 'Plato'],
  ['No man ever steps in the same river twice.', 'Heraclitus'],
  ['Character is destiny.', 'Heraclitus'],
  ['Change is the only constant.', 'Heraclitus'],
  ['All that we are is the result of what we have thought.', 'The Buddha'],
  ['Better than a thousand hollow words is one word that brings peace.', 'The Buddha'],
  ['Hatred does not cease by hatred, but only by love.', 'The Buddha'],
  ['Three things cannot be long hidden: the sun, the moon and the truth.', 'The Buddha'],
  ['Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.', 'The Buddha'],
  ['Happiness is the absence of the striving for happiness.', 'Zhuangzi'],
  ['The fish trap exists because of the fish. Once you have the fish, you can forget the trap.', 'Zhuangzi'],
  ['Nothing great was ever achieved without enthusiasm.', 'Ralph Waldo Emerson'],
  ['Every wall is a door.', 'Ralph Waldo Emerson'],
  ['Trust thyself: every heart vibrates to that iron string.', 'Ralph Waldo Emerson'],
  ['It is not length of life, but depth of life.', 'Ralph Waldo Emerson'],
  ['Go confidently in the direction of your dreams. Live the life you have imagined.', 'Henry David Thoreau'],
  ['It is not what you look at that matters, it is what you see.', 'Henry David Thoreau'],
  ['The man who goes alone can start today; but he who travels with another must wait till that other is ready.', 'Henry David Thoreau'],
  ['Our life is frittered away by detail. Simplify, simplify.', 'Henry David Thoreau'],
  ['He who has a why to live can bear almost any how.', 'Friedrich Nietzsche'],
  ['You must have chaos within you to give birth to a dancing star.', 'Friedrich Nietzsche'],
  ['Without music, life would be a mistake.', 'Friedrich Nietzsche'],
  ['There are no facts, only interpretations.', 'Friedrich Nietzsche'],
  ['Become who you are.', 'Friedrich Nietzsche'],
  ['Life can only be understood backwards; but it must be lived forwards.', 'Søren Kierkegaard'],
  ['Anxiety is the dizziness of freedom.', 'Søren Kierkegaard'],
  ['To dare is to lose one’s footing momentarily. Not to dare is to lose oneself.', 'Søren Kierkegaard'],
  ['My life has been full of terrible misfortunes, most of which never happened.', 'Michel de Montaigne'],
  ['The greatest thing in the world is to know how to belong to oneself.', 'Michel de Montaigne'],
  ['All of humanity’s problems stem from man’s inability to sit quietly in a room alone.', 'Blaise Pascal'],
  ['Do not weep; do not wax indignant. Understand.', 'Baruch Spinoza'],
  ['Peace is not an absence of war, it is a virtue, a state of mind, a disposition for benevolence, confidence and justice.', 'Baruch Spinoza'],
  ['Not what we have but what we enjoy constitutes our abundance.', 'Epicurus'],
  ['Do not spoil what you have by desiring what you have not.', 'Epicurus'],
  ['Of all the things wisdom provides to make life happy, the greatest by far is friendship.', 'Epicurus'],
  ['The wound is the place where the light enters you.', 'Rumi'],
  ['Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.', 'Rumi'],
  ['What you seek is seeking you.', 'Rumi'],
  ['Act only according to that maxim whereby you can at the same time will that it should become a universal law.', 'Immanuel Kant'],
  ['The greatest weapon against stress is our ability to choose one thought over another.', 'William James'],
  ['Act as if what you do makes a difference. It does.', 'William James'],
  ['My experience is what I agree to attend to.', 'William James'],
  ['Talent hits a target no one else can hit; genius hits a target no one else can see.', 'Arthur Schopenhauer'],
  ['The limits of my language mean the limits of my world.', 'Ludwig Wittgenstein'],
  ['If you have a garden and a library, you have everything you need.', 'Cicero'],
  ['While there is life, there is hope.', 'Cicero'],
  ['I am a citizen of the world.', 'Diogenes'],
  ['The mind is not a vessel to be filled but a fire to be kindled.', 'Plutarch'],
  ['Attention is the rarest and purest form of generosity.', 'Simone Weil'],
  ['When we are no longer able to change a situation, we are challenged to change ourselves.', 'Viktor Frankl'],
  ['In the midst of winter, I found there was, within me, an invincible summer.', 'Albert Camus'],
  ['The struggle itself toward the heights is enough to fill a man’s heart.', 'Albert Camus'],
  ['Man is condemned to be free.', 'Jean-Paul Sartre'],
  ['Commitment is an act, not a word.', 'Jean-Paul Sartre'],
  ['The only way to make sense out of change is to plunge into it, move with it, and join the dance.', 'Alan Watts'],
  ['The good life is one inspired by love and guided by knowledge.', 'Bertrand Russell'],
  ['It is better to be a human being dissatisfied than a pig satisfied.', 'John Stuart Mill'],
  ['Smile, breathe and go slowly.', 'Thich Nhat Hanh'],
  ['The present moment is the only moment available to us, and it is the door to all moments.', 'Thich Nhat Hanh'],
  ['Be a philosopher; but, amidst all your philosophy, be still a man.', 'David Hume'],
  ['Doubt is not a pleasant condition, but certainty is absurd.', 'Voltaire'],
  ['It is not enough to have a good mind; the main thing is to use it well.', 'René Descartes'],
  ['Man conquers the world by conquering himself.', 'Zeno of Citium'],
  ['Knowledge itself is power.', 'Francis Bacon'],
  ['Read not to contradict and confute; nor to believe and take for granted; but to weigh and consider.', 'Francis Bacon'],
  ['You have a right to your actions, but never to your actions’ fruits.', 'The Bhagavad Gita'],
  ['Set thy heart upon thy work, but never on its reward.', 'The Bhagavad Gita'],
  ['Arise, awake, and stop not till the goal is reached.', 'Swami Vivekananda'],
];

const APP_LINES: readonly string[] = [
  "You are not late. You are exactly on the only schedule your life has ever had.",
  "Time is the one thing you spend every day without ever seeing a receipt.",
  "Nobody is watching as closely as you think. That is the good news.",
  "The person you will be in five years is being decided in the next five minutes.",
  "You will never find time. You can only decide what the time you have is for.",
  "Busy is not a measure of importance. It is often a way to avoid the one hard thing.",
  "A year from now you will wish you had started today. So start today.",
  "Today is the oldest you have ever been and the youngest you will ever be again.",
  "The days feel long and the years feel short because the days are where you decide.",
  "Your future self is a stranger you are building a home for. Be a good host.",
  "You are always one hour away from a different day.",
  "Waiting for the right moment is a moment spent.",
  "There is no later. There is only a pile of nows you did not use.",
  "Five minutes a day is thirty hours a year. Ask what thirty hours could build.",
  "The clock does not care how you feel. That is why a small plan beats a strong mood.",
  "You do not rise to the level of your goals. You fall to the level of your daily acts.",
  "Motivation is a visitor. A routine is a resident. Build for the resident.",
  "A goal is a wish with a deadline. A system is a wish with a Tuesday.",
  "Big change is small changes that nobody clapped for.",
  "What you do once is an event. What you do daily is who you are.",
  "You are always practising something. The question is what.",
  "The hardest part of any task is the thirty seconds before it.",
  "If you can do it badly, you can do it. Do it badly first.",
  "Perfect is a way of never starting that sounds like a standard.",
  "Most of life is decided in the first step you almost did not take.",
  "A small win each day is an unfair advantage.",
  "Slow progress is still the only kind of progress there is.",
  "Effort feels like hard work. It is also what building feels like from the inside.",
  "The pain of starting lasts a minute. The pain of never starting lasts years.",
  "You can only be consistent with something that is small enough to do on a bad day.",
  "Do not trust a plan that needs you to feel great.",
  "Done is a skill, and it is learned only by finishing.",
  "The thing you keep postponing is usually the thing you most need.",
  "Progress hides. Look back, not at your feet.",
  "You are one habit away from a different life, and one excuse away from the same one.",
  "What gets measured gets attention. What gets attention gets better.",
  "You become what you rehearse.",
  "Growth is not a feeling. It is a result you notice later.",
  "Wherever your attention goes for a year is where your life goes.",
  "You are the only person who has ever heard every thought you have had. Be careful what you say to yourself.",
  "A mind in a hurry sees little. A mind at rest sees what matters.",
  "What you pay attention to grows. Choose what you water.",
  "Most worries are rehearsals for plays that never open.",
  "You have been practising your mood for years. Practise another one.",
  "A thought is not a fact. It is a weather report from a very small corner of you.",
  "You cannot think your way out of a feeling, but you can walk your way out.",
  "Your phone is a window or a mirror. Notice which one you are using.",
  "If your attention is the product, you are the thing being sold. Take it back for an hour.",
  "The mind is a brilliant servant and a terrible master.",
  "Silence is not empty. It is where the answers wait.",
  "Boredom is the doorway to an idea. Stop shutting it.",
  "You are not your anxious thought. You are the one who hears it.",
  "Notice that you can notice. That is the part of you that is free.",
  "Most arguments are won in the first sentence, and lost in the second.",
  "If a thought makes you smaller, question it. If it makes you honest, follow it.",
  "Changing your mind is not weakness. It is the proof that you are still learning.",
  "Certainty feels like knowledge. It is usually only comfort.",
  "The brain that worries is the brain that cares. Teach it where to put that care.",
  "Fear is a compass pointing at what matters. Follow it carefully, not blindly.",
  "Courage is not feeling fear. It is the work you do while feeling it.",
  "What you avoid grows teeth. What you face grows smaller.",
  "The cost of safety is a smaller life.",
  "One brave minute can change the shape of a week.",
  "You are not stuck. You are standing in front of a decision you have not made.",
  "What would you do if you knew you could not fail? Now do a small version, knowing you might.",
  "Regret is mostly about what we did not try.",
  "Discomfort is the sound of your edges stretching.",
  "Nobody feels ready. The ready ones simply began.",
  "The first draft of anything is a brave act.",
  "Be willing to be a beginner. It is the only door to the next level.",
  "Say the thing you have been rehearsing in your head. It will be shorter out loud.",
  "Doubt is a sign you are near something that matters.",
  "You have survived every bad day so far. That is a perfect record.",
  "Rich is a number. Enough is a feeling. Know which one you are chasing.",
  "Money is stored time. Spend it like it is.",
  "Pay yourself first, and your future self will pay you back.",
  "Your work is a gift only if it is given. Ship it.",
  "Nobody has ever been moved by a perfect plan. They are moved by a finished thing.",
  "Make something this week that you would be proud to be known for.",
  "The best marketing is a person who can finally do what they could not do last month.",
  "A career is the sum of small hours nobody saw.",
  "If you want to be good at your work, be useful before you are visible.",
  "You do not need an audience to start. You need one person you can help.",
  "Make it good, make it kind, make it again.",
  "What would you make if no one was going to rate it?",
  "The best idea you have is the one you finish.",
  "Learn in public. Everyone is more patient than you fear.",
  "Price your work by what it gives, not by what it costs you in hours.",
  "A deadline is a friend that tells the truth about time.",
  "Do work that makes tomorrow easier for someone.",
  "Ask what the work needs, not what you feel like doing.",
  "You are allowed to be paid for what comes easily to you. It does not come easily to everyone.",
  "A creative life is built on boring mornings.",
  "The people you are closest to are quietly writing your next chapter.",
  "Most people are not waiting to judge you. They are waiting to be noticed by you.",
  "A friend is someone who remembers the question you did not ask.",
  "Listening is the cheapest gift and the rarest.",
  "You teach people how to treat you by what you quietly allow.",
  "Love is not a feeling you wait for. It is a series of small decisions made at inconvenient times.",
  "The way you speak when you are tired is who you are.",
  "Call the person you keep meaning to call. The window does close.",
  "Parents were once as unsure as you are now. Be gentle with them, and with yourself.",
  "Your family has a story about you. You are allowed to write the next page.",
  "You cannot pour from an empty cup, but you can ask someone for a refill.",
  "Most conflicts are two people defending a hurt. Ask about the hurt.",
  "Keep your promises to people who will never find out. That is character.",
  "The kindest thing is often the plain thing, said early.",
  "People remember how you made them feel, and how you made them wait.",
  "Be the person who makes the room a little more honest.",
  "The quality of your life is the quality of your closest relationships, multiplied by your attention to them.",
  "Show up for the small things in other people’s lives. That is where trust lives.",
  "Forgiveness is a door you open for yourself.",
  "Say I love you in a way they can feel, not only in a way you would like.",
  "Rest is not the reward for finishing. It is part of what makes finishing possible.",
  "Your body keeps the minutes you do not. Treat it like a partner in the work.",
  "Sleep is the cheapest performance tool you will ever be given.",
  "Walk before you decide. Your thoughts will be easier to carry.",
  "You do not get a spare body or a spare life. Maintenance is love.",
  "If you would not say it to a friend, do not say it to yourself.",
  "Water, sleep and sunlight fix more problems than they get credit for.",
  "Burnout is what happens when you give your future away to pay for today.",
  "A day with nothing in it is not wasted. It is rest doing its work.",
  "You are not a machine, and a good plan accounts for that.",
  "Take care of the person you are going to be at sixty. They are counting on you.",
  "A tired mind lies. Do not trust your worst hour.",
  "The best version of you is rested, fed and unhurried. Protect that version.",
  "Boundaries are how you love people for longer.",
  "There is no finish line for self-care. That is the point of it.",
  "Everyone you admire had a teacher. Go and find yours.",
  "The best way to learn something is to explain it to a child, or to a wall.",
  "You do not need to know everything. You need to know who to ask and how to keep going.",
  "Read one page of something that disagrees with you.",
  "A good question is worth ten answers.",
  "The expert was once the person who did not give up on being confused.",
  "You learn most from the people who make you slightly uncomfortable.",
  "Your teachers are not only in classrooms. They are in anyone who knows a little more than you about one thing.",
  "Teaching is the fastest way to find the holes in your own understanding.",
  "Be a student for long enough that you stop being embarrassed by it.",
  "What you learn is only yours when you use it.",
  "The point of knowledge is not to be right. It is to be useful.",
  "Curiosity is a muscle. Use it daily or lose it quietly.",
  "The more you know, the more you see what you do not. That is progress, not failure.",
  "Ask one more question than you are comfortable with.",
  "What would still matter to you if no one ever knew you did it?",
  "The meaning of a life is rarely found. It is built, one choice at a time.",
  "You are small, and the universe is vast, and your kindness still counts.",
  "Ask not what the world owes you, but what you want to leave in it.",
  "A good life is less about what you gather and more about what you give away.",
  "Gratitude is the only feeling that makes you richer without taking from anyone.",
  "Awe is free. Look at a tree for a full minute.",
  "Faith is not knowing. It is acting well while you do not know.",
  "What you worship is what you organise your day around. Look at your day.",
  "The question is not whether you will die. It is what you will do with the days before.",
  "Everything you have is on loan, including your time.",
  "Some things only make sense when you stop trying to make them make sense.",
  "If your life were a letter to the world, what would today’s line say?",
  "You are part of something larger than your list. Remember that, and then do the list.",
  "Silence, prayer, or a walk: pick a way to ask what it is all for.",
  "Be the reason someone breathes a little easier today.",
  "A kind act is a prayer with hands.",
  "At the end, nobody counts their likes. They count who sat by the bed.",
  "What would a wise old you tell you today?",
  "If you could only do one thing today that mattered, which would it be?",
  "You are not who you were. You are not yet who you will be. Today you get to choose which way to lean.",
  "Every day you vote for a type of person. Cast a good vote.",
  "You are the author, and you keep forgetting you are holding the pen.",
  "The story you tell about yourself is the one you will live. Edit it kindly.",
  "Do not wait to become confident. Act, and confidence will catch up.",
  "Your identity is a habit of choosing. Choose slightly differently today.",
  "Become the person who would find your goals easy.",
  "You are not behind. You are not ahead. You are on your road, and comparing it to others is like comparing two maps.",
  "Strong people are not hard on themselves. They are honest with themselves.",
  "A small change in who you think you are changes a hundred small choices.",
  "You can be proud of who you are and still be curious about who you could be.",
  "Your past is a place you visit. It is not a place you live.",
  "Today’s version of you is a draft. Drafts are meant to be improved.",
  "You are never too late to become what you intend to become.",
  "Act like the person you are becoming, a little at a time.",
  "The fastest way to feel less busy is to finish one thing.",
  "The more you chase certainty, the less you live.",
  "You cannot get ahead by looking behind, and you cannot learn without it.",
  "Sometimes the most productive thing you can do is stop.",
  "You often get what you want by first being willing not to get it.",
  "The things you own end up owning your time.",
  "If you only do what you are comfortable with, you will be comfortable and stuck.",
  "The harder you push on a stuck door, the less likely you are to notice that it opens the other way.",
  "Everything you have ever wanted is on the other side of a little fear and a lot of ordinary days.",
  "Less is often the answer, and we keep asking for more.",
  "You are not what you do, and what you do is how you become who you are.",
  "Say no to the good so you have room for the great.",
  "A closed door is a kind of map.",
  "What you resist persists, and what you accept can change.",
  "You can be very busy and make no progress at all, and you can do almost nothing and move mountains.",
  "Choosing one thing means letting go of a hundred others. That is the price, and the point.",
  "Other people’s opinions of you are mostly about them.",
  "You can only lose what you were afraid to use.",
  "The opposite of fear is not courage. It is curiosity.",
  "Doing nothing is also a decision, and it is one that gets made for you.",
  "Your biggest limit is usually a story you have told so often you stopped checking it.",
  "Your best ideas arrive when you stop forcing them, which is why you need to leave space.",
  "The best way to be heard is to listen first.",
  "If you cannot find the right words, the right thing is often silence and a hand on the shoulder.",
  "What you call luck is mostly preparation meeting a door you remembered to open.",
  "The smallest unit of change is a single honest decision.",
  "If everything is important, nothing is. Pick the one.",
  "You are surrounded by the people and things you have been choosing, whether you noticed or not.",
  "Ask not what you are good at, but what you are willing to be bad at for long enough.",
  "The map is not the road. Start walking and the map will update.",
  "Be gentle. You are doing something hard, which is being a person.",
  "The world needs the version of you that does not give up quietly.",
  "Look at what you carried yesterday and notice that you are still here.",
  "Small and steady wins the long game.",
  "Let the day be ordinary and do one thing well.",
  "Finish the day with one honest line to yourself: what mattered?",
  "Whatever you did today, you can begin again tomorrow.",
  "A good day is a day you can look back on without flinching.",
  "You do not have to be extraordinary to do something extraordinary. You have to keep going.",
  "The next small step is enough.",
  "Most people overestimate what they can do in a day and underestimate what they can do in a year.",
  "The gap between who you are and who you want to be is closed one ordinary Tuesday at a time.",
  "If you are tired of starting over, stop quitting in the middle.",
  "A decision made with calm will outlast a decision made with heat.",
  "Ask yourself: will this matter in ten days, ten months, ten years? Spend your worry accordingly.",
  "You are allowed to outgrow a place, a plan or a version of yourself.",
  "The most honest thing you will do all day is look at your schedule and see what you really value.",
  "Pay attention to what energises you after you have done it, not before.",
  "A good question asked kindly can change a whole conversation.",
  "Compare yourself to who you were last year, and be fair about it.",
  "What you repeat in private becomes what you are in public.",
  "You will never feel completely ready, and you will do it anyway. So do it now.",
  "Everything difficult becomes ordinary with enough ordinary days.",
  "The quiet work you do when no one thanks you is the work that builds you.",
  "A life is made of Tuesdays. Make them count.",
  "One honest hour beats ten distracted ones.",
  "Do not confuse movement with progress. Check the direction first.",
  "The things you cannot control are not your job today. The next step is.",
  "Remember that the kind person you are looking for is also you.",
  "Some days the biggest thing you can do is the smallest thing, done on purpose.",
  "You do not owe anyone a perfect version of yourself. You owe yourself an honest one.",
  "Care about the work, and care about the people the work is for.",
  "If it is worth doing, it is worth doing slowly enough to do well.",
  "Every master was once a beginner who kept showing up on the days that felt pointless.",
  "The best time to be kind to yourself is when you least feel like it.",
];

/** A small seeded shuffle, so every person sees the same order on the same day. */
function seededShuffle<T>(list: readonly T[], seed: number): T[] {
  const out = [...list];
  let a = (seed * 2654435761) >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
export interface DailyLine {
  text: string;
  /** Who said it: a philosopher. Empty for a line written for the app, which carries no name. */
  by: string;
  /** True for a line written for the app. */
  own: boolean;
}
export const DAILY_LINE_COUNT = PHILOSOPHER_LINES.length + APP_LINES.length;
/** The order of one round: every line once, a philosopher and then the app and so on, shuffled afresh each round. */
function lineOrder(round: number): number[] {
  const p = seededShuffle(PHILOSOPHER_LINES.map((_, i) => i), round * 2 + 11);
  const a = seededShuffle(APP_LINES.map((_, i) => PHILOSOPHER_LINES.length + i), round * 2 + 12);
  const out: number[] = [];
  let first = round % 2 === 0 ? p : a;
  let second = round % 2 === 0 ? a : p;
  while (first.length || second.length) {
    if (first.length) out.push(first.shift()!);
    if (second.length) out.push(second.shift()!);
  }
  return out;
}
/**
 * The line for a day (YYYY-MM-DD, the person's own day). Every line is shown once before any is shown again, so none comes back for as many days as
 * there are lines (about a year); the lines alternate between a philosopher and the app, and each round is shuffled anew. The first line of a round
 * is never the last of the one before. Nothing is stored: the same day always gives the same line.
 */
export function lineForDay(day: string): DailyLine & { round: number; position: number } {
  const [y, m, d] = day.split('-').map(Number);
  const n = Math.floor(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1) / 86_400_000) - Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);
  const size = DAILY_LINE_COUNT;
  const round = Math.floor(n / size);
  const position = n - round * size;
  const order = lineOrder(round);
  // The round must not start with the line the last round ended on.
  if (position <= 1 && round > -1000000) {
    const lastBefore = lineOrder(round - 1)[size - 1]!;
    if (order[0] === lastBefore) [order[0], order[1]] = [order[1]!, order[0]!];
  }
  const idx = order[position]!;
  return idx < PHILOSOPHER_LINES.length ? { text: PHILOSOPHER_LINES[idx]![0], by: PHILOSOPHER_LINES[idx]![1], own: false, round, position } : { text: APP_LINES[idx - PHILOSOPHER_LINES.length]!, by: '', own: true, round, position };
}
