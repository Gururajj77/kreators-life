import type { RelationshipKey } from './core.ts';
import type { IconName } from './roles.ts';

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
  /** The options, as people read them. How effective each one is lives on the server only (`DiscoverKeys`). */
  options: readonly string[];
}

/**
 * The answer keys for the situations and the emotional intelligence scenes: how effective each option is, 1 (least) to 4 (most),
 * and which feeling a reading scene shows. They live on the server only (apps/api/src/discoverKeys.ts), so the web bundle never
 * carries them and nobody can read the best answers out of the page; the scoring takes them as an argument.
 */
export interface DiscoverKeys {
  /** One per DISCOVER_SCENES entry, in order: the effectiveness of each option. */
  scenes: readonly (readonly number[])[];
  /** One per EQ_READING scene: the index of the right feeling. */
  reading: readonly number[];
  /** One per EQ_PEOPLE situation: the effectiveness of each option. */
  people: readonly (readonly number[])[];
}
export const DISCOVER_SCENES: readonly DiscoverScene[] = [
  {
    situation: 'A brand asks you to redo a video you thought was finished. You think the notes are unfair. What would you do?',
    options: ['Redo it quickly and say nothing, to keep them happy.', 'Ask what the main goal is, fix the notes that serve it and explain the ones that do not.', 'Tell them the video was fine and the notes are wrong.', 'Thank them, say you will review it, and reply tomorrow with what you can do.'],
  },
  {
    situation: 'A close friend keeps cancelling plans at the last minute, and you feel hurt. What would you do?',
    options: ['Stop inviting them.', 'Tell them kindly that it hurts and ask what is going on.', 'Keep making plans and say it is fine, even though it is not.', 'Suggest a smaller, easier plan and see how they respond.'],
  },
  {
    situation: 'A teammate presents your idea in a meeting as if it were theirs. What would you do?',
    options: ['Say in the meeting, “Glad you liked my idea.”', 'Talk to them privately, say what you noticed and ask them to credit you next time.', 'Let it go. It does not matter.', 'Share your next idea in writing with the whole team first.'],
  },
  {
    situation: 'Your partner says you are always on your phone. You are in the middle of a launch and stressed. What would you do?',
    options: ['Say you are busy and it will pass.', 'Agree it is true, say when the launch ends and set one phone-free hour each evening.', 'Snap: “I am doing this for us.”', 'Put the phone away for the night but feel resentful.'],
  },
  {
    situation: 'A younger sibling asks for help just as you are up against a deadline. What would you do?',
    options: ['Say “not now” and close the door.', 'Stop work and help for a long time, then rush the deadline.', 'Say you can give ten minutes now and a full hour once you have finished.', 'Pass them on to someone else.'],
  },
  {
    situation: 'A mentor gives you harsh but useful feedback on your work. What would you do?',
    options: ['Defend each point.', 'Thank them, write the points down and pick one to act on this week.', 'Take it all in and change a few things right away.', 'Feel hurt and avoid them for a while.'],
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
export const EQ_READING: readonly { scene: string; options: readonly string[] }[] = [
  { scene: 'Sam goes quiet after being left out of a group chat, and says, “It’s fine.”', options: ['Excited', 'Hurt', 'Bored', 'Proud'] },
  { scene: 'Ana’s hands shake before she goes on stage, but she smiles and says she can’t wait.', options: ['Angry', 'Sad', 'Nervous and excited', 'Calm and sure'] },
  { scene: 'Ravi just won a small award. He looks around the room to see who noticed.', options: ['Guilty', 'Proud', 'Afraid', 'Bored'] },
  { scene: 'Mia snaps at everyone the day before an exam, then says sorry and sits alone.', options: ['Joyful', 'Jealous', 'Calm', 'Stressed'] },
  { scene: 'Leo hears his friend say, “Sorry, I forgot your birthday,” and looks at the floor.', options: ['Relieved', 'Disappointed', 'Amused', 'Proud'] },
  { scene: 'Priya is asked to lead the team and says yes quickly, then goes to wash her face.', options: ['Bored', 'Angry', 'Nervous and overwhelmed', 'Sad'] },
];

/** Eight situations, each tagged with the part it tests. Keyed 1 (least) to 4 (most effective) by the team, on the server (`DiscoverKeys`). */
export const EQ_PEOPLE: readonly { dim: EqDim; situation: string; options: readonly string[] }[] = [
  { dim: 'm', situation: 'You get harsh feedback on something you worked hard on, and your face goes hot. What do you do first?', options: ['Reply right away to defend yourself.', 'Take a breath, wait an hour, then read it again.', 'Quietly decide the person is wrong.', 'Agree with everything to end the talk.'] },
  { dim: 'a', situation: 'You feel low all day for no clear reason. What helps most?', options: ['Scroll until it passes.', 'Push on and ignore it.', 'Stop, and ask what happened today and what you need.', 'Snap at someone to feel better.'] },
  { dim: 'd', situation: 'Your video flops after weeks of work. What do you do?', options: ['Blame the algorithm.', 'Delete it and say nothing.', 'Quit the format.', 'Study what worked in better ones, change one thing and post again.'] },
  { dim: 'e', situation: 'A friend cancels plans again and says they are “just tired”. Their voice sounds flat.', options: ['Tell them they are always flaky.', 'Say “fine” and move on.', 'Ask if something else is going on and offer a quieter plan.', 'Stop texting until they text first.'] },
  { dim: 's', situation: 'Two people on your team argue, and both look at you.', options: ['Leave the room.', 'Tell them to stop.', 'Pick the side you like.', 'Let each finish, ask what each needs and look for the overlap.'] },
  { dim: 'a', situation: 'You notice you have been short with your partner all week because of work stress.', options: ['Say sorry, explain the stress without blaming them and plan time together.', 'Hope they have not noticed.', 'Explain that work comes first.', 'Ask them to be more understanding.'] },
  { dim: 'd', situation: 'You are two weeks into a new habit and miss a day.', options: ['Double it tomorrow to catch up.', 'Count the whole thing as failed.', 'Wait for next Monday to restart.', 'Note why you missed and do the next day as planned.'] },
  { dim: 's', situation: 'Someone tells you something private and starts to cry.', options: ['Change the subject to cheer them up.', 'Offer a quick fix.', 'Stay with them, listen and say you are glad they told you.', 'Tell them it is not a big deal.'] },
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
export function scoreEq(a: DiscoverAnswers, keys: DiscoverKeys): EqResult {
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
    const key = keys.people[i];
    if (pick && key) sj[q.dim].push(((key[pick.most]! - key[pick.least]! + 3) / 6) * 100);
  });
  const readRight = EQ_READING.filter((_, i) => keys.reading[i] !== undefined && a.reading[i] === keys.reading[i]).length;
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
export function scoreDiscover(a: DiscoverAnswers, keys: DiscoverKeys): DiscoverResult {
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
    const key = keys.scenes[i];
    return pick && key ? n + (key[pick.most]! - key[pick.least]!) : n;
  }, 0);
  const judgment = clamp100(((gap + 3 * DISCOVER_SCENES.length) / (6 * DISCOVER_SCENES.length)) * 100);
  const measures = { ...traits, p: puzzles.score, j: judgment };
  const strengths = (Object.keys(DISCOVER_WEIGHTS) as RelationshipKey[])
    .map((key) => ({ key, score: clamp100((Object.keys(measures) as (keyof typeof measures)[]).reduce((n, m) => n + DISCOVER_WEIGHTS[key][m] * measures[m], 0)) }))
    .sort((x, y) => y.score - x.score || x.key.localeCompare(y.key));
  return { traits, puzzles, judgment, strengths, top: strengths.slice(0, 3).map((s) => s.key), growth: strengths[strengths.length - 1]!.key, ...(eqComplete(a) ? { eq: scoreEq(a, keys) } : {}) };
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
export const EXTRA_KINDS: readonly { key: ExtraKind; name: string; blurb: string; icon: IconName; steps: number }[] = [
  { key: 'type', name: '16 personality types', blurb: 'A free check in the style of the Myers-Briggs (MBTI) test. Twenty-four lines to rate give a four-letter type from sixteen, such as INFP or ESTJ, with how clear each side is and what it means for you.', icon: 'Puzzle', steps: 6 },
  { key: 'love', name: 'Love languages', blurb: 'Twenty choices between two lines: ten about how you like to be shown love, ten about how you show it. They can differ, and the gap is useful.', icon: 'Heart', steps: 20 },
  { key: 'design', name: 'Human design', blurb: 'Enter your birth date, time and zone. It works out your chart in the tropical and the sidereal zodiac, reads it in three layers (body, mind, purpose) and turns it into goals you can do and count. A system for reflection, not science.', icon: 'Orbit', steps: 1 },
  { key: 'mind', name: 'How your mind works', blurb: 'Twenty-four lines on how often something is true: attention, energy and impulse, and patterns and senses. A self-check, never a diagnosis.', icon: 'Brain', steps: 6 },
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
export const LOVE_LANGUAGES: Record<LoveKey, { name: string; icon: IconName; blurb: string; ask: string; give: string; watch: string; helps: RelationshipKey }> = {
  words: { name: 'Words of affirmation', icon: 'MessageCircle', blurb: 'Kind, clear words tell you that you matter.', ask: 'Say: “It means a lot when you tell me what you like about me.”', give: 'Be specific. “Thank you for staying late, it helped me” lands better than “good job”.', watch: 'Harsh words cut deeper for you, and silence can feel like a no.', helps: 'friendship' },
  time: { name: 'Quality time', icon: 'Hourglass', blurb: 'Full attention is how you feel close to someone.', ask: 'Say: “I would love an hour with just the two of us, phones away.”', give: 'Put the phone down and look at them. Ten full minutes beat a distracted evening.', watch: 'Cancelled plans and half-listening hurt more than people know.', helps: 'lover_partner' },
  gifts: { name: 'Thoughtful gifts', icon: 'Gift', blurb: 'A small thing that shows someone thought of you means a lot.', ask: 'Say: “A little surprise that shows you thought of me makes my week.”', give: 'It is the thought, not the price. A note, a snack or a photo is enough.', watch: 'A forgotten day that matters to you can sting.', helps: 'parent_child' },
  acts: { name: 'Acts of service', icon: 'HandHelping', blurb: 'Help with a real job tells you someone cares.', ask: 'Say: “It would mean a lot if you took one job off my plate this week.”', give: 'Do the job they dread, without being asked, and do not keep score.', watch: 'Broken promises to help, or being left with everything, feel like neglect.', helps: 'servant_leader' },
  touch: { name: 'Physical touch', icon: 'HandHeart', blurb: 'A hug, a hand or sitting close helps you feel safe and loved.', ask: 'Say: “A long hug really helps me when I am having a hard day.”', give: 'Ask or watch what they like. A hug, a hand on the shoulder or sitting close, only if it is welcome.', watch: 'Distance can feel like coldness. Always check what feels right to the other person.', helps: 'lover_partner' },
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
