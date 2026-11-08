// Gratitude for the day, on Journal (2026-11-07, the founder: "gratitude for the day with prompts is missing for journal").
// Three short lines a day, each under its own prompt. The prompts follow the seven pillars, plus a few about the day itself;
// the wording is our own, from the plain idea of gratitude practice (notice what went right, and who made it so), never a quote.
//
// Per person since 2026-11-07 (the founder: "can the pillars for gratitude be changed? and the prompts never be repeated?"): the
// day's three groups are a seeded rotation, or the person's own usual three; the prompt in each group is the next one in that
// group's round that this person has not seen yet. Seen means written under on any day, or skipped with Another prompt; a prompt
// only shown on a day the person did not write is not seen, and can come back. A group starts a new round once every one of its
// prompts was seen, never opening on the prompt it closed with. The server keeps what this needs (migration 0106): the prompts
// offered for each open day, so a day reads the same everywhere, the seen marks with their round, and the usual three.
//
// This file is a leaf: it imports nothing from the rest of shared at run time, so it can be its own small chunk
// ('@kreators/shared/gratitude') and the API reads the same list to check a saved prompt. A new prompt is added at the end of its
// group's list and nowhere else; a key is never reused or renumbered, since saved days keep the key of the prompt they answered.
import type { RelationshipKey } from './core.ts';

/** A group of prompts: one of the seven pillars, or the day itself. */
export type GratitudeGroup = RelationshipKey | 'day';

export interface GratitudePrompt {
  /** `<group>-NN`, stable for good. */
  key: string;
  group: GratitudeGroup;
  text: string;
}

/** One line of a day: the prompt it answers and what the person wrote. */
export interface GratitudeLine {
  prompt: string;
  text: string;
}

/** A saved day. `day` is the person's own day (YYYY-MM-DD); `updatedAt` is the version an edit is checked against. */
export interface GratitudeDay {
  day: string;
  lines: GratitudeLine[];
  updatedAt: string;
}

/** A prompt the person has seen: written under, or skipped with Another prompt. `round` is that group's round for them; `at` orders the marks. */
export interface GratitudeSeen {
  prompt: string;
  round: number;
  at: string;
}

/** Lines a day. */
export const GRATITUDE_LINES = 3;
/** Characters a line may hold. */
export const GRATITUDE_LINE_MAX = 280;

/** The groups, the seven pillars in their own order and then the day. */
export const GRATITUDE_GROUPS: readonly GratitudeGroup[] = ['servant_leader', 'friendship', 'parent_child', 'lover_partner', 'self', 'guru', 'divine', 'day'];

/** The name shown beside a prompt. The pillars' names match `RELATIONSHIPS` (the shared test checks). */
export const GRATITUDE_GROUP_NAMES: Record<GratitudeGroup, string> = {
  servant_leader: 'Servitude',
  friendship: 'Friends',
  parent_child: 'Family',
  lover_partner: 'Love',
  self: 'Yourself',
  guru: 'Teachers',
  divine: 'Faith',
  day: 'Your day',
};

/**
 * Every group has the same number of prompts (the test checks). The first nine of each are the ones of the first day, word for word
 * (keys 01 to 09); 10 to 30 came with the bigger pool. Each fits its group, and they vary on purpose: people, small things, the body,
 * a lesson, a hard thing that taught something, something the person has now that they once wished for.
 */
const TEXTS: Record<GratitudeGroup, readonly string[]> = {
  // Servitude: serving the people who count on you, and the work, money and skill that let you (Ember's "Who did you serve today?").
  servant_leader: [
    'Who did you get to help today, even a little?',
    'Who counts on you, and why are you glad they do?',
    'What did you do today that made life easier for someone?',
    'Who thanked you lately, and what for?',
    'What problem did you help someone solve?',
    'Who helped you so that you could help others?',
    'What small act of service felt worth doing today?',
    'Who gave you a chance to be useful that you still feel thankful for?',
    'When did serving someone teach you something about yourself?',
    'What part of your work today are you glad to have?',
    'Who did you make things a little better for this week?',
    'What skill lets you be useful to others?',
    'What money came in lately that you are thankful for?',
    'Who at work made your day lighter?',
    'What job or task did you once wish for that you now do?',
    'What do people pay you for that you enjoy doing?',
    'Which client, customer or reader are you glad you met?',
    'What tool or space makes your work easier?',
    'What hard day at work taught you something useful?',
    'Who trusted you with something that mattered to them?',
    'What did you finish this week that someone needed?',
    'What bill or need were you able to cover this month?',
    'Who gave you work when you needed it most?',
    'What kind word did you get about something you made?',
    'What did a tough client or boss teach you?',
    'Who on your team keeps things running quietly?',
    'What chance to give back came your way lately?',
    'What did your hands or your mind make today?',
    'Who did you help without being asked?',
    'What part of your work would your younger self be proud of?',
  ],
  friendship: [
    'Which friend crossed your mind today, and why?',
    'What made you laugh with someone today?',
    'Who listened to you lately without trying to fix it?',
    'What do you like about a friend you have not spoken to in a while?',
    'Which friend stayed with you through a hard time?',
    'What message or call lifted you today?',
    'What did a friend teach you without meaning to?',
    'Who do you feel most like yourself around?',
    'What plan with a friend are you looking forward to?',
    'Which friend knows you best, and how does that feel?',
    'What inside joke still makes you smile?',
    'Who checked on you when you went quiet?',
    'What did a friend do lately that you did not expect?',
    'Which friend makes hard days easier?',
    'What place do you love going to with friends?',
    'Who is a newer friend you are glad you met?',
    'What did a friend say that you still remember?',
    'Which friend tells you the truth, even when it is hard?',
    'What did you and a friend do together that felt easy?',
    'Who would you call at two in the morning?',
    'What old friend would you like to thank today?',
    'What did a friend help you see in a new way?',
    'Which friend cheers loudest when you win?',
    'What did an argument with a friend teach you?',
    'What small gift or note from a friend do you keep?',
    'Who made you feel welcome in a new place?',
    'What kind of friend did you once hope for, and who is that now?',
    'Who shares your interests and makes them more fun?',
    'What meal or walk with a friend do you remember?',
    'Which friend has been there the longest?',
  ],
  parent_child: [
    'What did someone in your family do for you that is easy to miss?',
    'What family habit or saying are you glad you carry?',
    'Who in your family would you call first with good news?',
    'What did you learn at home that still helps you?',
    'What meal, place or smell reminds you of home in a good way?',
    'What do you admire about a parent, child or sibling?',
    'What did someone in your family give up so you could have more?',
    'What moment with family made you smile this week?',
    'What part of your family story are you proud of?',
    'What story does your family love to tell?',
    'Who in your family taught you to be brave?',
    'What do you and a family member laugh about?',
    'What did a grandparent or older relative give you?',
    'What family tradition are you glad to keep?',
    'Who in your family always shows up?',
    'What did your family get through together?',
    'What do you love about the home you grew up in?',
    'What has a younger family member taught you?',
    'What kind thing did a sibling or cousin do for you?',
    'What part of your family do you see in yourself, and like?',
    'What hard time at home taught you something you still use?',
    'Who in your family would you like to call this week, and why?',
    'What food from your family do you love?',
    'What did a parent do that you understand better now?',
    'Who makes family time feel warm?',
    'What festival or gathering with family do you love?',
    'What family do you have now that you once hoped for?',
    'Who in your family believes in you?',
    'What did you do for your family today that felt good?',
    'What would you thank your family for if they were here now?',
  ],
  lover_partner: [
    'What did the person you love do today that you noticed?',
    'What do you love about them, apart from what they do for you?',
    'What moment together would you like to keep?',
    'How did someone show you care today, in words or in deeds?',
    'What makes you feel safe with the one you love?',
    'Who loves you just as you are, partner or not?',
    'What did the two of you get through that made you closer?',
    'What small thing do they do that you would miss?',
    'What did you learn about love from someone close to you?',
    'What made you feel loved this week?',
    'What first drew you to the person you love?',
    'What do the two of you laugh about?',
    'How did someone make you feel seen today?',
    'What hard talk made the two of you stronger?',
    'What do you love doing together on a slow day?',
    'What did someone close forgive you for?',
    'What is a small habit of theirs you love?',
    'Who holds your hand, in any sense, when things get hard?',
    'What place reminds you of someone you love?',
    'What did love teach you about patience?',
    'What would you like to thank someone close for today?',
    'How do you show love, and who taught you that?',
    'What did you give someone today that came from the heart?',
    'What kind of love do you have now that you once wished for?',
    'What name do they call you that you like?',
    'What promise has someone kept to you?',
    'When did you feel at home with someone lately?',
    'What do you admire about how they treat others?',
    'What past love taught you something you are glad to know?',
    'What made you feel close to someone without words?',
  ],
  self: [
    'What did your body let you do today?',
    'What can you do now that you could not do a year ago?',
    'What choice today are you glad you made?',
    'What part of you showed up well today?',
    'When did you feel calm today, even for a moment?',
    'What rest did you give yourself today?',
    'Where did you keep going when it would have been easy to stop?',
    'What do you like about the way you think?',
    'What need of yours did you meet today?',
    'What part of your body worked hard for you today?',
    'What did you eat today that you enjoyed?',
    'What thought helped you today?',
    'What did you do today just for yourself?',
    'What fear did you face, even a little?',
    'What sleep or rest are you thankful for?',
    'What strength of yours did you use today?',
    'What mistake did you forgive yourself for?',
    'What are you better at than you were last month?',
    'Which of your senses gave you joy today?',
    'What did you say no to that kept your time your own?',
    'What did your mind figure out today?',
    'What hard time made you stronger in a way you value?',
    'What part of your daily routine do you enjoy?',
    'What ability do you have now that you once wished for?',
    'When did you laugh at yourself today?',
    'What kind thing did you say to yourself today?',
    'What did you learn about yourself this week?',
    'What breath, stretch or walk felt good today?',
    'What habit are you glad you started?',
    'What do you like about the person you are becoming?',
  ],
  guru: [
    'What did you learn today, big or small?',
    'Which teacher, coach or mentor shaped how you work?',
    'What book, video or talk changed your mind lately?',
    'Who explained something so that it finally made sense?',
    'What hard lesson are you now glad you learned?',
    'Who showed you how to do something by doing it well?',
    'What question are you glad someone asked you?',
    'What did a beginner or a younger person teach you?',
    'What advice do you still hear in your head?',
    'What did someone show you that saved you time?',
    'Which school teacher do you still remember fondly?',
    'Who showed you how to start when you felt stuck?',
    'Who gave you feedback that helped you grow?',
    'What did a child or student teach you lately?',
    'What skill are you learning now, and who helps you?',
    'Who made a hard subject feel easy?',
    'What did a stranger teach you?',
    'What lesson took you years to learn?',
    'Who answered your questions with patience?',
    'What did you read or hear today that stayed with you?',
    'Who believed you could learn something before you did?',
    'What did a failure teach you that a win could not?',
    'Who showed you a better way to treat people?',
    'What course or class are you glad you took?',
    'What do you know now that you once wished someone would teach you?',
    'Who do you learn from just by watching them?',
    'What did an elder teach you about life?',
    'What did you teach someone today, and what did you learn back?',
    'What habit did you pick up from someone wise?',
    'Which writer, artist or maker changed how you see things?',
  ],
  divine: [
    'What made you feel part of something bigger today?',
    'What in nature did you notice today?',
    'What are you thankful for that you did not earn?',
    'When did you feel at peace today?',
    'What gave your day meaning?',
    'What hope are you holding on to right now?',
    'What went right today that you did not plan?',
    'What made you feel small in a good way, like the sky at night?',
    'What belief or practice steadies you when things go wrong?',
    'What prayer, wish or quiet word did you say today?',
    'Where did you feel wonder today?',
    'What moment felt like a gift?',
    'What place feels sacred to you?',
    'What song or sound lifted your spirit?',
    'What did you see today that felt beautiful?',
    'What hard time later made sense to you?',
    'Who reminds you what matters most?',
    'What do you trust, even when you cannot see the way?',
    'What made you feel connected to all living things?',
    'What small kindness felt like more than chance?',
    'What part of your faith or values helped you today?',
    'When did you feel grateful just for being alive?',
    'What sunrise, sunset or sky do you remember?',
    'What silence did you enjoy today?',
    'What did you let go of that made you lighter?',
    'What meaning did you find in an ordinary task?',
    'Who in your faith or community lifts you up?',
    'What peace do you have now that you once prayed for?',
    'What gave you hope when things felt heavy?',
    'What are you thankful for that money cannot buy?',
  ],
  day: [
    'What went well today?',
    'What is one small thing you enjoyed today?',
    'What problem did not happen today?',
    'What do you have now that you once hoped for?',
    'What made today easier than it could have been?',
    'What sound, taste or sight did you enjoy today?',
    'What are you looking forward to tomorrow?',
    'Who or what made you smile today?',
    'What everyday thing would you miss if it were gone?',
    'What was the best part of your morning?',
    'What was the funniest moment of your day?',
    'What did you get done today that you are glad about?',
    'What surprised you today in a good way?',
    'What was the best thing you ate today?',
    'Who did you talk to today that you enjoyed?',
    'What small comfort did you have today?',
    'What hard moment today turned out fine?',
    'What did the weather give you today?',
    'What did you see on your way somewhere today?',
    'What made you feel at ease today?',
    'What would you like to remember about today?',
    'What little thing went right today?',
    'What simple thing in your home are you glad to have today?',
    'What kind act did you see today?',
    'What moment today would you like to have again?',
    'What did your evening hold that you liked?',
    'What went better than you expected today?',
    'What break or pause did you enjoy today?',
    'Who helped you today, even in a small way?',
    'What are you glad to come home to tonight?',
  ],
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Every prompt, group by group in `GRATITUDE_GROUPS` order. */
export const GRATITUDE_PROMPTS: readonly GratitudePrompt[] = GRATITUDE_GROUPS.flatMap((group) => TEXTS[group].map((text, i) => ({ key: `${group}-${pad2(i + 1)}`, group, text })));

const BY_KEY: Record<string, GratitudePrompt> = Object.create(null) as Record<string, GratitudePrompt>;
for (const p of GRATITUDE_PROMPTS) BY_KEY[p.key] = p;
const GROUP_SET: Record<string, true> = Object.create(null) as Record<string, true>;
for (const g of GRATITUDE_GROUPS) GROUP_SET[g] = true;

/** A prompt by its key, or null for one that does not exist (looked up without a prototype, so "constructor" finds nothing). */
export function gratitudePromptByKey(key: string): GratitudePrompt | null {
  return BY_KEY[key] ?? null;
}

/** Whether a word is one of the groups (looked up without a prototype). */
export function isGratitudeGroup(v: unknown): v is GratitudeGroup {
  return typeof v === 'string' && GROUP_SET[v] === true;
}

/** How many prompts each group holds. */
export const GRATITUDE_PER_GROUP = TEXTS.day.length;
/** Days in one turn of the groups: in every eight days each of the eight groups comes up three times. */
export const GRATITUDE_CYCLE_DAYS = GRATITUDE_GROUPS.length;

/** A small seeded shuffle (the same one as the line of the day), so the same seed always gives the same order. */
function shuffle<T>(list: readonly T[], seed: number): T[] {
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

/** Days since 1 January 2026 (negative before), from a YYYY-MM-DD day. */
function dayIndex(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y || 2026, (m || 1) - 1, d || 1) / 86_400_000) - Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);
}

function groupKeys(group: GratitudeGroup): string[] {
  return TEXTS[group].map((_, i) => `${group}-${pad2(i + 1)}`);
}

/**
 * The day's three groups when the person has no usual three: the same for everyone on a day. The eight groups are shuffled for each
 * eight-day turn and taken three at a time round that order, so a day's three are always different and each group comes up three
 * times a turn.
 */
export function gratitudeGroupsForDay(day: string): GratitudeGroup[] {
  const n = dayIndex(day);
  const turn = Math.floor(n / GRATITUDE_CYCLE_DAYS);
  const at = (n - turn * GRATITUDE_CYCLE_DAYS) * GRATITUDE_LINES;
  const order = shuffle(GRATITUDE_GROUPS, turn * 3 + 101);
  return Array.from({ length: GRATITUDE_LINES }, (_, k) => order[(at + k) % order.length]!);
}

/** One group's prompts in a round's order. A round never opens on `closing`, the prompt the round before ended with. */
export function gratitudeRoundOrder(group: GratitudeGroup, round: number, closing: string | null = null): string[] {
  const list = shuffle(groupKeys(group), round * 31 + GRATITUDE_GROUPS.indexOf(group) * 7 + 5);
  if (closing && list[0] === closing && list.length > 1) [list[0], list[1]] = [list[1]!, list[0]!];
  return list;
}

/** The latest of some marks (by `at`, then by key, so the same marks always give the same answer). */
function latest(marks: readonly GratitudeSeen[]): string | null {
  let best: GratitudeSeen | null = null;
  for (const m of marks) if (!best || m.at > best.at || (m.at === best.at && m.prompt > best.prompt)) best = m;
  return best?.prompt ?? null;
}

/**
 * Where a person stands in one group: the round they are in, the prompts seen in it, and the prompt the round before closed with.
 * A round that holds every prompt of the group is over, so the next one starts empty.
 */
export function gratitudeGroupState(group: GratitudeGroup, marks: readonly GratitudeSeen[]): { round: number; seen: Set<string>; closing: string | null } {
  const mine = marks.filter((m) => BY_KEY[m.prompt]?.group === group && Number.isInteger(m.round) && m.round >= 0);
  if (!mine.length) return { round: 0, seen: new Set(), closing: null };
  const top = Math.max(...mine.map((m) => m.round));
  const inTop = mine.filter((m) => m.round === top);
  const seen = new Set(inTop.map((m) => m.prompt));
  if (seen.size >= GRATITUDE_PER_GROUP) return { round: top + 1, seen: new Set(), closing: latest(inTop) };
  return { round: top, seen, closing: latest(mine.filter((m) => m.round === top - 1)) };
}

/**
 * The next prompt of a group this person has not seen in their round. `exclude` holds prompts already on a line of an open day (the
 * day itself and the day beside it), so two open days never show the same one; only when the round has nothing else left does an
 * excluded one come back.
 */
export function nextGratitudePrompt(group: GratitudeGroup, marks: readonly GratitudeSeen[], exclude: readonly string[] = []): GratitudePrompt {
  const st = gratitudeGroupState(group, marks);
  const fresh = gratitudeRoundOrder(group, st.round, st.closing).filter((k) => !st.seen.has(k));
  return BY_KEY[fresh.find((k) => !exclude.includes(k)) ?? fresh[0] ?? groupKeys(group)[0]!]!;
}

/** The round a new seen mark for `prompt` goes in, or null when it was already seen in the person's round (or is not a prompt). */
export function gratitudeMarkRound(prompt: string, marks: readonly GratitudeSeen[]): number | null {
  const p = BY_KEY[prompt];
  if (!p) return null;
  const st = gratitudeGroupState(p.group, marks);
  return st.seen.has(prompt) ? null : st.round;
}

/**
 * A day's three prompts for one person, the one rule, worked out once when the day is first opened and then kept on the server:
 * the usual three groups when they pinned them, else the day's rotation, and in each group the next prompt they have not seen.
 */
export function gratitudeOfferFor(o: { day: string; marks?: readonly GratitudeSeen[]; usual?: readonly GratitudeGroup[] | null; exclude?: readonly string[] }): string[] {
  const groups = o.usual && o.usual.length === GRATITUDE_LINES ? o.usual : gratitudeGroupsForDay(o.day);
  const marks = o.marks ?? [];
  const exclude = o.exclude ?? [];
  return groups.map((g) => nextGratitudePrompt(g, marks, exclude).key);
}

/**
 * The prompts of a day that already had lines written before its prompts were kept: each saved line's own prompt where it is a real
 * one in a group not taken yet, and for any other place a prompt from `fresh` (the day's offer) in a group not taken yet.
 */
export function gratitudeOfferFrom(saved: readonly GratitudeLine[], fresh: readonly string[]): string[] {
  const out: string[] = [];
  const used = new Set<GratitudeGroup>();
  const take = (k: string | undefined) => {
    const p = k ? BY_KEY[k] : undefined;
    if (!p || used.has(p.group)) return false;
    used.add(p.group);
    out.push(p.key);
    return true;
  };
  for (let i = 0; i < GRATITUDE_LINES; i += 1) {
    if (take(saved[i]?.prompt)) continue;
    if (fresh.some((k) => take(k))) continue;
    // Every fresh group is taken: the first group not used yet, from its first prompt.
    take(groupKeys(GRATITUDE_GROUPS.find((g) => !used.has(g))!)[0]);
  }
  return out;
}

/**
 * "Another prompt" on line `index`: the prompt there counts as seen (`mark`, null when it already was), and the line takes the next
 * prompt of the same group this person has not seen. `exclude` is the prompts on the day beside it.
 */
export function gratitudeSkip(prompts: readonly string[], index: number, marks: readonly GratitudeSeen[], exclude: readonly string[], at: string): { prompts: string[]; mark: { prompt: string; round: number } | null } | null {
  const cur = BY_KEY[prompts[index] ?? ''];
  if (!cur) return null;
  const round = gratitudeMarkRound(cur.key, marks);
  const mark = round === null ? null : { prompt: cur.key, round };
  const next = nextGratitudePrompt(cur.group, mark ? [...marks, { ...mark, at }] : marks, [...exclude, ...prompts]);
  const out = [...prompts];
  out[index] = next.key;
  return { prompts: out, mark };
}

/**
 * The pillar picker on line `index`: the line takes `group`. When another line of the day has that group, the two lines swap their
 * prompts, unless that line is written, which is refused; otherwise the line takes that group's next prompt this person has not seen.
 * Only an empty line can change. Picking is not skipping: the prompt the line had stays unseen. Returns the day's new prompts or a
 * reason in plain words.
 */
export function gratitudePick(prompts: readonly string[], index: number, group: unknown, written: readonly boolean[], marks: readonly GratitudeSeen[], exclude: readonly string[]): string[] | string {
  if (!isGratitudeGroup(group)) return 'Pick one of the pillars, or the day.';
  if (index < 0 || index >= prompts.length) return 'Pick a line first.';
  if (written[index]) return 'That line is written. Clear it to pick another pillar.';
  const out = [...prompts];
  const j = prompts.findIndex((k) => BY_KEY[k]?.group === group);
  if (j === index) return out;
  if (j >= 0) {
    if (written[j]) return `${GRATITUDE_GROUP_NAMES[group]} is on a line you wrote. Pick another pillar.`;
    [out[index], out[j]] = [out[j]!, out[index]!];
    return out;
  }
  out[index] = nextGratitudePrompt(group, marks, [...exclude, ...prompts]).key;
  return out;
}

/** The usual three as sent or stored: three different groups, or nothing (null or an empty list) to go back to the rotation. */
export function parseGratitudeUsual(raw: unknown): GratitudeGroup[] | null | string {
  if (raw === null || raw === undefined || (Array.isArray(raw) && raw.length === 0)) return null;
  if (!Array.isArray(raw) || raw.length !== GRATITUDE_LINES) return `Pick ${GRATITUDE_LINES} pillars.`;
  if (!raw.every(isGratitudeGroup)) return 'Pick from the seven pillars and the day.';
  if (new Set(raw).size !== raw.length) return 'Pick three different pillars.';
  return [...raw];
}

/**
 * The day's three prompts for someone who has seen none and pinned nothing (the rotation's groups, each from its first round). The
 * server's offer for a person starts from this and moves on with what they have seen.
 */
export function gratitudePromptsForDay(day: string): GratitudePrompt[] {
  return gratitudeOfferFor({ day }).map((k) => BY_KEY[k]!);
}

/** How many of a day's lines have words in them. */
export function gratitudeWritten(lines: readonly GratitudeLine[]): number {
  return lines.filter((l) => l.text.trim().length > 0).length;
}

/** One line of plain text: control characters and line breaks become spaces, runs of spaces become one. */
function cleanLine(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The one reader of a day's lines, on the server and in the test: exactly `GRATITUDE_LINES` lines, each a real prompt key (no prompt
 * twice) and up to `GRATITUDE_LINE_MAX` characters of plain text on one line. Returns the clean lines, or a reason in plain words.
 */
export function parseGratitudeLines(raw: unknown): GratitudeLine[] | string {
  if (!Array.isArray(raw) || raw.length !== GRATITUDE_LINES) return `send ${GRATITUDE_LINES} lines`;
  const out: GratitudeLine[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') return 'each line needs a prompt and its words';
    const { prompt, text } = item as { prompt?: unknown; text?: unknown };
    if (typeof prompt !== 'string' || !gratitudePromptByKey(prompt)) return 'that prompt does not exist';
    if (seen.has(prompt)) return 'each line needs its own prompt';
    seen.add(prompt);
    if (text !== undefined && typeof text !== 'string') return 'a line is words';
    const clean = cleanLine(text ?? '');
    if (clean.length > GRATITUDE_LINE_MAX) return `keep each line to ${GRATITUDE_LINE_MAX} characters`;
    out.push({ prompt, text: clean });
  }
  return out;
}

/**
 * A saved day's lines read back from storage. A clean row reads as it was written. Anything else is read kindly: the words of each
 * line are kept, a prompt that is not in the app (or a repeat) reads as '' (no prompt shown), and a line with no words takes the
 * day's first-round prompt for its place.
 */
export function readGratitudeLines(json: string, day: string): GratitudeLine[] {
  let raw: unknown = null;
  try {
    raw = JSON.parse(json);
  } catch {
    raw = null;
  }
  const parsed = parseGratitudeLines(raw);
  if (typeof parsed !== 'string') return parsed;
  const fresh = gratitudePromptsForDay(day).map((p) => ({ prompt: p.key, text: '' }));
  if (!Array.isArray(raw)) return fresh;
  const used = new Set<string>();
  return fresh.map((f, i) => {
    const item: unknown = raw[i];
    if (!item || typeof item !== 'object') return f;
    const { prompt, text } = item as { prompt?: unknown; text?: unknown };
    const words = typeof text === 'string' ? cleanLine(text).slice(0, GRATITUDE_LINE_MAX) : '';
    if (!words) return f;
    const known = typeof prompt === 'string' && BY_KEY[prompt] && !used.has(prompt) ? prompt : '';
    if (known) used.add(known);
    return { prompt: known, text: words };
  });
}
