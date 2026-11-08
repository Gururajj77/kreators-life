import { describe, expect, it } from 'vitest';
import { RELATIONSHIP_BY_KEY } from './index';
import {
  GRATITUDE_CYCLE_DAYS,
  GRATITUDE_GROUPS,
  GRATITUDE_GROUP_NAMES,
  GRATITUDE_LINES,
  GRATITUDE_LINE_MAX,
  GRATITUDE_PER_GROUP,
  GRATITUDE_PROMPTS,
  gratitudeGroupState,
  gratitudeGroupsForDay,
  gratitudeMarkRound,
  gratitudeOfferFor,
  gratitudeOfferFrom,
  gratitudePick,
  gratitudePromptByKey,
  gratitudePromptsForDay,
  gratitudeRoundOrder,
  gratitudeSkip,
  gratitudeWritten,
  isGratitudeGroup,
  nextGratitudePrompt,
  parseGratitudeLines,
  parseGratitudeUsual,
  readGratitudeLines,
  type GratitudeGroup,
  type GratitudeSeen,
} from './gratitude';

/** YYYY-MM-DD for `n` days after 1 January 2026. */
const dayAt = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);
const groupOf = (k: string) => gratitudePromptByKey(k)!.group;

/** Flesch reading ease, the same sums as scripts/flesch.py. */
function flesch(text: string): number {
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((x) => /[A-Za-z]/.test(x));
  const words = text.match(/[A-Za-z][A-Za-z']*/g) ?? [];
  const syl = words.reduce((sum, word) => {
    const w = word.toLowerCase().replace(/^'+|'+$/g, '');
    let n = (w.match(/[aeiouy]+/g) ?? []).length;
    if (w.endsWith('e') && !/(le|ee|ye)$/.test(w) && n > 1) n -= 1;
    return sum + Math.max(1, n);
  }, 0);
  return 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syl / words.length);
}

/**
 * A person writing for `days` days in a row, the way the server does it: each day's offer is worked out from their seen marks (and
 * kept apart from the day before's), then `write` says which lines they wrote, and each written line becomes a mark in its round.
 */
function simulate(days: number, o: { usual?: GratitudeGroup[] | null; write?: (day: number, line: number) => boolean; start?: number } = {}) {
  const marks: GratitudeSeen[] = [];
  const offers: string[][] = [];
  for (let d = 0; d < days; d += 1) {
    const day = dayAt((o.start ?? 0) + d);
    const offer = gratitudeOfferFor({ day, marks, usual: o.usual ?? null, exclude: offers[d - 1] ?? [] });
    offers.push(offer);
    offer.forEach((k, i) => {
      if (!(o.write?.(d, i) ?? true)) return;
      const round = gratitudeMarkRound(k, marks);
      if (round !== null) marks.push({ prompt: k, round, at: `${day}T12:00:0${i}Z` });
    });
  }
  return { marks, offers };
}

describe('gratitude prompts', () => {
  it('has the seven pillars and the day, 30 prompts in each, with unique stable keys', () => {
    expect(GRATITUDE_GROUPS).toHaveLength(8);
    expect(GRATITUDE_PER_GROUP).toBe(30);
    expect(GRATITUDE_PROMPTS).toHaveLength(240);
    for (const g of GRATITUDE_GROUPS) {
      const list = GRATITUDE_PROMPTS.filter((p) => p.group === g);
      expect(list.length, g).toBe(GRATITUDE_PER_GROUP);
      list.forEach((p, i) => expect(p.key).toBe(`${g}-${String(i + 1).padStart(2, '0')}`));
      if (g !== 'day') expect(GRATITUDE_GROUP_NAMES[g]).toBe(RELATIONSHIP_BY_KEY[g].name);
    }
    expect(new Set(GRATITUDE_PROMPTS.map((p) => p.key)).size).toBe(GRATITUDE_PROMPTS.length);
    expect(new Set(GRATITUDE_PROMPTS.map((p) => p.text.toLowerCase())).size).toBe(GRATITUDE_PROMPTS.length);
  });

  it('keeps the first nine of each group word for word, so saved days read as they were written', () => {
    expect(gratitudePromptByKey('servant_leader-01')?.text).toBe('Who did you get to help today, even a little?');
    expect(gratitudePromptByKey('friendship-09')?.text).toBe('What plan with a friend are you looking forward to?');
    expect(gratitudePromptByKey('lover_partner-06')?.text).toBe('Who loves you just as you are, partner or not?');
    expect(gratitudePromptByKey('divine-08')?.text).toBe('What made you feel small in a good way, like the sky at night?');
    expect(gratitudePromptByKey('day-01')?.text).toBe('What went well today?');
    expect(gratitudePromptByKey('day-09')?.text).toBe('What everyday thing would you miss if it were gone?');
  });

  it('keeps every prompt a short, plain question in the app’s words, with no claim and no "should"', () => {
    for (const p of GRATITUDE_PROMPTS) {
      expect(p.text, p.key).toMatch(/^[A-Z].*\?$/);
      expect(p.text.split(/\s+/).length, p.key).toBeLessThanOrEqual(16);
      expect(p.text, p.key).not.toMatch(/\bspark\b|\btower\b|Kreators Life|\bfloors?\b|\brung\b|\bladder\b|\bvices?\b|\bcure\b|\bguarantee|\bshould\b|\bmust\b|\bheal|\bproven\b/i);
    }
    // Plain enough for a teenager, group by group (Flesch 60 or above, the app's bar).
    for (const g of GRATITUDE_GROUPS) {
      const text = GRATITUDE_PROMPTS.filter((p) => p.group === g)
        .map((p) => p.text)
        .join(' ');
      expect(flesch(text), g).toBeGreaterThanOrEqual(60);
    }
  });

  it('looks a key and a group up without a prototype', () => {
    expect(gratitudePromptByKey('friendship-01')?.group).toBe('friendship');
    expect(gratitudePromptByKey('friendship-30')?.group).toBe('friendship');
    expect(gratitudePromptByKey('constructor')).toBeNull();
    expect(gratitudePromptByKey('friendship-31')).toBeNull();
    expect(isGratitudeGroup('day')).toBe(true);
    expect(isGratitudeGroup('constructor')).toBe(false);
  });
});

describe('the day’s groups', () => {
  it('gives three different groups a day, the same on the same day, each group three times in eight days', () => {
    for (let n = -40; n < 400; n += 1) {
      const g = gratitudeGroupsForDay(dayAt(n));
      expect(g).toHaveLength(GRATITUDE_LINES);
      expect(new Set(g).size, dayAt(n)).toBe(GRATITUDE_LINES);
      expect(gratitudeGroupsForDay(dayAt(n))).toEqual(g);
    }
    for (const turn of [-2, 0, 1, 5, 40]) {
      const count: Record<string, number> = {};
      for (let i = 0; i < GRATITUDE_CYCLE_DAYS; i += 1) for (const g of gratitudeGroupsForDay(dayAt(turn * GRATITUDE_CYCLE_DAYS + i))) count[g] = (count[g] ?? 0) + 1;
      expect(Object.values(count).sort(), `turn ${turn}`).toEqual(GRATITUDE_GROUPS.map(() => 3));
    }
  });

  it('starts every day with the usual three, in their order, once they are pinned', () => {
    const usual: GratitudeGroup[] = ['self', 'friendship', 'day'];
    for (let n = 0; n < 20; n += 1) expect(gratitudeOfferFor({ day: dayAt(n), usual }).map(groupOf)).toEqual(usual);
    expect(parseGratitudeUsual(usual)).toEqual(usual);
    expect(parseGratitudeUsual(null)).toBeNull();
    expect(parseGratitudeUsual([])).toBeNull();
    expect(typeof parseGratitudeUsual(['self', 'self', 'day'])).toBe('string');
    expect(typeof parseGratitudeUsual(['self', 'day'])).toBe('string');
    expect(typeof parseGratitudeUsual(['self', 'day', 'constructor'])).toBe('string');
    expect(typeof parseGratitudeUsual('self')).toBe('string');
  });
});

describe('prompts per person', () => {
  it('gives the same offer for the same history, and someone new starts at each group’s first prompt', () => {
    const day = '2026-11-07';
    expect(gratitudeOfferFor({ day })).toEqual(gratitudeOfferFor({ day }));
    expect(gratitudePromptsForDay(day).map((p) => p.key)).toEqual(gratitudeOfferFor({ day }));
    expect(gratitudeOfferFor({ day }).map(groupOf)).toEqual(gratitudeGroupsForDay(day));
    for (const k of gratitudeOfferFor({ day })) expect(gratitudeRoundOrder(groupOf(k), 0)[0]).toBe(k);
  });

  it('never repeats a prompt the person wrote under until they have written under every prompt of that group', () => {
    // Every line written, every day, for over two rounds of the busiest group.
    const { offers } = simulate(260);
    const seenInRound: Record<string, Set<string>> = {};
    for (const offer of offers)
      for (const k of offer) {
        const g = groupOf(k);
        const s = (seenInRound[g] ??= new Set());
        if (s.size === GRATITUDE_PER_GROUP) s.clear();
        expect(s.has(k), k).toBe(false);
        s.add(k);
      }
    // With the usual three, each of those groups goes round in exactly 30 days.
    const pinned = simulate(95, { usual: ['divine', 'guru', 'self'] });
    for (let d = 0; d < 95; d += 1) {
      const round = Math.floor(d / GRATITUDE_PER_GROUP);
      const keys = pinned.offers.slice(round * GRATITUDE_PER_GROUP, round * GRATITUDE_PER_GROUP + GRATITUDE_PER_GROUP).map((o) => o[0]);
      if (keys.length === GRATITUDE_PER_GROUP) expect(new Set(keys).size).toBe(GRATITUDE_PER_GROUP);
    }
  });

  it('keeps a prompt that was only shown: a line left empty offers the same prompt next time', () => {
    const usual: GratitudeGroup[] = ['guru', 'divine', 'day'];
    const { offers } = simulate(3, { usual, write: (_, line) => line !== 1 });
    // Line 2 (Faith) was never written, and the day beside it is kept apart, so it comes back every other day.
    expect(offers[0]![1]).not.toBe(offers[1]![1]);
    expect(offers[2]![1]).toBe(offers[0]![1]);
    expect(offers[0]![0]).not.toBe(offers[2]![0]);
  });

  it('starts a new round once a group is used up, never opening on the prompt it closed with', () => {
    for (const g of GRATITUDE_GROUPS) {
      const order = gratitudeRoundOrder(g, 0);
      for (const close of [order[GRATITUDE_PER_GROUP - 1]!, order[0]!, order[7]!]) {
        // The whole round seen, in its order but ending on `close`.
        const keys = [...order.filter((k) => k !== close), close];
        const marks = keys.map((k, i) => ({ prompt: k, round: 0, at: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z` }));
        const st = gratitudeGroupState(g, marks);
        expect(st.round).toBe(1);
        expect(st.closing).toBe(close);
        const next = nextGratitudePrompt(g, marks);
        expect(next.key, g).not.toBe(close);
        expect(gratitudeRoundOrder(g, 1, close)[0]).toBe(next.key);
        // A mark in the new round goes in round 1.
        expect(gratitudeMarkRound(next.key, marks)).toBe(1);
      }
    }
    // Rounds are shuffled anew.
    expect(gratitudeRoundOrder('day', 0).join()).not.toBe(gratitudeRoundOrder('day', 1).join());
  });

  it('keeps two open days apart, and lets an excluded prompt come back only when nothing else is left', () => {
    const order = gratitudeRoundOrder('self', 0);
    expect(nextGratitudePrompt('self', [], [order[0]!]).key).toBe(order[1]);
    const allButLast = order.slice(0, -1).map((k, i) => ({ prompt: k, round: 0, at: `t${String(i).padStart(2, '0')}` }));
    expect(nextGratitudePrompt('self', allButLast, [order[GRATITUDE_PER_GROUP - 1]!]).key).toBe(order[GRATITUDE_PER_GROUP - 1]);
  });
});

describe('Another prompt and the pillar picker', () => {
  const day = '2026-11-07';

  it('marks the skipped prompt seen and gives the next unseen one of the same group, cycling the whole group once', () => {
    const marks: GratitudeSeen[] = [];
    let prompts = gratitudeOfferFor({ day });
    const group = groupOf(prompts[1]!);
    const shown = new Set([prompts[1]]);
    for (let i = 0; i < GRATITUDE_PER_GROUP - 1; i += 1) {
      const s = gratitudeSkip(prompts, 1, marks, [], `2026-11-07T10:00:${String(i).padStart(2, '0')}Z`)!;
      expect(s.mark?.prompt).toBe(prompts[1]);
      expect(groupOf(s.prompts[1]!)).toBe(group);
      expect([prompts[0], prompts[2]]).toEqual([s.prompts[0], s.prompts[2]]);
      expect(shown.has(s.prompts[1]!), s.prompts[1]).toBe(false);
      marks.push({ prompt: s.mark!.prompt, round: s.mark!.round, at: `2026-11-07T10:00:${String(i).padStart(2, '0')}Z` });
      shown.add(s.prompts[1]!);
      prompts = s.prompts;
    }
    expect(shown.size).toBe(GRATITUDE_PER_GROUP);
    // The same history gives the same answer.
    expect(gratitudeSkip(prompts, 1, marks, [], 'z')!.prompts).toEqual(gratitudeSkip(prompts, 1, marks, [], 'z')!.prompts);
    // Skipping the last one opens a new round on another prompt.
    const last = gratitudeSkip(prompts, 1, marks, [], 'z')!;
    expect(last.mark).toEqual({ prompt: prompts[1], round: 0 });
    expect(last.prompts[1]).not.toBe(prompts[1]);
    // A skipped prompt never comes back on a later day in the same round.
    const later = gratitudeOfferFor({ day: '2026-11-09', marks, usual: [group, ...GRATITUDE_GROUPS.filter((g) => g !== group).slice(0, 2)] });
    expect(later[0]).toBe(prompts[1]);
  });

  it('picks a pillar for an empty line, swaps with an empty line that has it, and refuses a written one', () => {
    const prompts = gratitudeOfferFor({ day });
    const groups = prompts.map(groupOf);
    const other = GRATITUDE_GROUPS.find((g) => !groups.includes(g))!;
    const picked = gratitudePick(prompts, 0, other, [false, false, false], [], []);
    expect(Array.isArray(picked) && groupOf(picked[0]!)).toBe(other);
    expect(Array.isArray(picked) && picked.slice(1)).toEqual(prompts.slice(1));
    // The group already on line 2: the two empty lines swap their prompts.
    expect(gratitudePick(prompts, 0, groups[2], [false, false, false], [], [])).toEqual([prompts[2], prompts[1], prompts[0]]);
    // The same group again changes nothing.
    expect(gratitudePick(prompts, 1, groups[1], [false, false, false], [], [])).toEqual(prompts);
    expect(typeof gratitudePick(prompts, 0, groups[2], [false, false, true], [], [])).toBe('string');
    expect(typeof gratitudePick(prompts, 0, other, [true, false, false], [], [])).toBe('string');
    expect(typeof gratitudePick(prompts, 0, 'constructor', [false, false, false], [], [])).toBe('string');
    // A pick is not a skip: it takes the group's next unseen prompt and marks nothing.
    const used = gratitudeRoundOrder(other, 0)[0]!;
    const next = gratitudePick(prompts, 0, other, [false, false, false], [{ prompt: used, round: 0, at: 'a' }], []);
    expect(Array.isArray(next) && next[0]).toBe(gratitudeRoundOrder(other, 0)[1]);
  });
});

describe('reading and writing lines', () => {
  it('reads lines with one rule', () => {
    const keys = gratitudePromptsForDay('2026-11-07').map((p) => p.key);
    const ok = parseGratitudeLines(keys.map((k, i) => ({ prompt: k, text: i === 0 ? '  My  sister\ncalled. ' : '' })));
    expect(ok).toEqual([
      { prompt: keys[0], text: 'My sister called.' },
      { prompt: keys[1], text: '' },
      { prompt: keys[2], text: '' },
    ]);
    expect(typeof ok === 'string' ? 0 : gratitudeWritten(ok)).toBe(1);
    expect(typeof parseGratitudeLines(keys.slice(0, 2).map((k) => ({ prompt: k, text: 'x' })))).toBe('string');
    expect(typeof parseGratitudeLines([keys[0], keys[0], keys[1]].map((k) => ({ prompt: k, text: 'x' })))).toBe('string');
    expect(typeof parseGratitudeLines(['nope', keys[1], keys[2]].map((k) => ({ prompt: k, text: 'x' })))).toBe('string');
    expect(typeof parseGratitudeLines(keys.map((k) => ({ prompt: k, text: 'x'.repeat(GRATITUDE_LINE_MAX + 1) })))).toBe('string');
    expect(typeof parseGratitudeLines('three lines')).toBe('string');
  });

  it('reads an older day kindly: a clean row as written, an unknown prompt keeps its words with no prompt', () => {
    const keys = gratitudePromptsForDay('2026-11-07').map((p) => p.key);
    const ok = keys.map((k, i) => ({ prompt: k, text: i === 1 ? 'A walk' : '' }));
    expect(readGratitudeLines(JSON.stringify(ok), '2026-11-07')).toEqual(ok);
    expect(readGratitudeLines('{oops', '2026-11-07').map((l) => l.prompt)).toEqual(keys);
    const odd = readGratitudeLines(JSON.stringify([{ prompt: 'friendship-99', text: 'Old words' }, { prompt: keys[1], text: 'Kept' }, { prompt: keys[1], text: 'Twice' }]), '2026-11-07');
    expect(odd).toEqual([
      { prompt: '', text: 'Old words' },
      { prompt: keys[1], text: 'Kept' },
      { prompt: '', text: 'Twice' },
    ]);
  });

  it('works out an offer for a day that had lines before its prompts were kept', () => {
    const fresh = gratitudeOfferFor({ day: '2026-11-07' });
    const saved = [
      { prompt: 'self-04', text: 'x' },
      { prompt: '', text: 'y' },
      { prompt: 'self-09', text: '' },
    ];
    const offer = gratitudeOfferFrom(saved, fresh);
    expect(offer[0]).toBe('self-04');
    expect(new Set(offer.map(groupOf)).size).toBe(GRATITUDE_LINES);
    expect(gratitudeOfferFrom(fresh.map((k) => ({ prompt: k, text: '' })), fresh)).toEqual(fresh);
  });
});
