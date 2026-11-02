import { describe, expect, it } from 'vitest';
import { RELATIONSHIPS } from './index';
import {
  JOURNAL_CARE_NOTE,
  JOURNAL_PLAN_NOTE,
  JOURNAL_PROMPTS,
  JOURNAL_PROMPT_CATEGORIES,
  JOURNAL_PROMPT_COUNT,
  nextPrompt,
  promptBody,
  promptById,
  promptCategory,
  promptRound,
  promptsIn,
  promptTitle,
  type JournalPromptCategoryKey,
} from './journalPrompts';

const KEYS = JOURNAL_PROMPT_CATEGORIES.map((c) => c.key);

/** Show `n` prompts in a row, feeding each one back into the history. */
function run(n: number, category: JournalPromptCategoryKey | 'all', seed = 1, start: string[] = []): string[] {
  const history = [...start];
  for (let i = 0; i < n; i += 1) history.push(nextPrompt(history, category, seed).id);
  return history.slice(start.length);
}

describe('journal prompt content', () => {
  it('has many prompts across at least ten categories, at least twenty in each', () => {
    expect(JOURNAL_PROMPT_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    // Help says sixteen.
    expect(JOURNAL_PROMPT_CATEGORIES).toHaveLength(16);
    expect(JOURNAL_PROMPT_COUNT).toBeGreaterThanOrEqual(300);
    expect(JOURNAL_PROMPTS).toHaveLength(JOURNAL_PROMPT_COUNT);
    for (const c of JOURNAL_PROMPT_CATEGORIES) expect(promptsIn(c.key).length).toBeGreaterThanOrEqual(20);
  });
  it('gives every prompt a unique, stable id that starts with its category', () => {
    expect(new Set(JOURNAL_PROMPTS.map((p) => p.id)).size).toBe(JOURNAL_PROMPTS.length);
    for (const p of JOURNAL_PROMPTS) {
      expect(p.id).toMatch(new RegExp(`^${p.category}-\\d\\d$`));
      expect(promptById(p.id)).toBe(p);
    }
    expect(promptById('constructor')).toBeUndefined();
    expect(promptCategory('__proto__')).toBeUndefined();
  });
  it('has well-formed categories in the relationship colours', () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
    const accents = RELATIONSHIPS.map((r) => r.key);
    for (const c of JOURNAL_PROMPT_CATEGORIES) {
      expect(c.name.length).toBeGreaterThan(3);
      expect(c.meaning.length).toBeGreaterThan(20);
      expect(c.howTo.length).toBeGreaterThan(60);
      expect(c.howTo).not.toMatch(/—|–/);
      expect(accents).toContain(c.accent);
    }
  });
  it('gives every prompt all its fields, in sensible lengths', () => {
    for (const p of JOURNAL_PROMPTS) {
      expect(KEYS).toContain(p.category);
      expect(p.text.length).toBeGreaterThanOrEqual(20);
      expect(p.text.length).toBeLessThanOrEqual(260);
      expect(p.why.length).toBeGreaterThanOrEqual(70);
      expect(p.why.length).toBeLessThanOrEqual(420);
      // Two to four sentences.
      const sentences = p.why.split(/(?<=[.!?])\s+/).length;
      expect(sentences).toBeGreaterThanOrEqual(2);
      expect(sentences).toBeLessThanOrEqual(4);
      expect(p.expect.length).toBeGreaterThanOrEqual(35);
      expect(Number.isInteger(p.minutes)).toBe(true);
      expect(p.minutes).toBeGreaterThanOrEqual(3);
      expect(p.minutes).toBeLessThanOrEqual(20);
      if (p.steps) {
        expect(p.steps.length).toBeGreaterThanOrEqual(2);
        expect(p.steps.length).toBeLessThanOrEqual(5);
        for (const s of p.steps) expect(s.length).toBeGreaterThan(5);
      }
    }
    expect(JOURNAL_PROMPTS.filter((p) => p.steps).length).toBeGreaterThan(10);
  });
  it('never repeats the same text, why or expect line', () => {
    expect(new Set(JOURNAL_PROMPTS.map((p) => p.text)).size).toBe(JOURNAL_PROMPTS.length);
    expect(new Set(JOURNAL_PROMPTS.map((p) => p.why)).size).toBe(JOURNAL_PROMPTS.length);
  });
  it('keeps the care notes: heavy categories say when to stop, hopeful ones say it is not a guarantee', () => {
    for (const c of JOURNAL_PROMPT_CATEGORIES) {
      for (const p of promptsIn(c.key)) {
        expect(p.expect.includes(JOURNAL_CARE_NOTE)).toBe(c.care === 'heavy');
        expect(p.expect.includes(JOURNAL_PLAN_NOTE)).toBe(c.care === 'plan');
      }
    }
    const care = (k: JournalPromptCategoryKey) => JOURNAL_PROMPT_CATEGORIES.find((c) => c.key === k)!.care;
    expect(care('shadow')).toBe('heavy');
    expect(care('child')).toBe('heavy');
    expect(care('script')).toBe('plan');
    expect(care('m369')).toBe('plan');
    expect(care('money')).toBe('plan');
  });
  it('makes no medical or guaranteed claims', () => {
    for (const p of JOURNAL_PROMPTS) {
      const all = `${p.text} ${p.why} ${p.expect}`;
      expect(all).not.toMatch(/\bcures?\b|\bdiagnos|\bproven to\b|\bwill definitely\b|\bwithout fail\b|\b100%/i);
    }
  });
  it('keeps to the app’s plain words, with no em dash and no old product name', () => {
    for (const p of JOURNAL_PROMPTS) {
      const all = `${p.text} ${p.why} ${p.expect} ${(p.steps ?? []).join(' ')}`;
      expect(all).not.toMatch(/\bspark\b|\btower\b|Kreators Life|\bladder\b|\brung\b|—|–/i);
      expect(all).not.toMatch(/https?:|www\./i);
    }
  });
  it('explains the 3-6-9 method as a practice: 3 in the morning, 6 at midday, 9 at night', () => {
    const m = promptsIn('m369');
    const joined = m.map((p) => `${p.text} ${p.why} ${(p.steps ?? []).join(' ')}`).join(' ');
    expect(joined).toMatch(/three times in the morning/i);
    expect(joined).toMatch(/six at midday/i);
    expect(joined).toMatch(/nine at night/i);
    expect(m.filter((p) => p.steps).length).toBeGreaterThanOrEqual(3);
  });
});

describe('the next journal prompt', () => {
  it('shows every prompt in a pool once before any comes back', () => {
    for (const cat of ['shadow', 'm369', 'weekly', 'all'] as const) {
      const size = promptsIn(cat).length;
      const first = run(size, cat, 3);
      expect(new Set(first).size).toBe(size);
      const second = run(size, cat, 3, first);
      expect(new Set(second).size).toBe(size);
    }
  });
  it('shuffles each round afresh', () => {
    const size = promptsIn('joy').length;
    const a = run(size, 'joy', 5);
    const b = run(size, 'joy', 5, a);
    expect(a).not.toEqual(b);
  });
  it('never opens a new round with the prompt the last round ended on', () => {
    for (const cat of ['body', 'love', 'future'] as const) {
      const size = promptsIn(cat).length;
      for (let seed = 0; seed < 25; seed += 1) {
        const all = run(size * 3, cat, seed);
        for (let r = 1; r < 3; r += 1) expect(all[r * size]).not.toBe(all[r * size - 1]);
      }
    }
  });
  it('gives the same prompt for the same history, category and seed, and varies with the seed', () => {
    const h = run(7, 'all', 9);
    expect(nextPrompt(h, 'all', 9)).toBe(nextPrompt([...h], 'all', 9));
    expect(nextPrompt([], 'all', 1).id).toBe(nextPrompt([], 'all', 1).id);
    const firsts = new Set(Array.from({ length: 30 }, (_, s) => nextPrompt([], 'all', s).id));
    expect(firsts.size).toBeGreaterThan(10);
  });
  it('stays in the chosen category and ignores ids from elsewhere or that do not exist', () => {
    const noise = ['money-01', 'nope-99', 'constructor', '__proto__'];
    for (let i = 0; i < 60; i += 1) expect(nextPrompt(noise, 'script', i).category).toBe('script');
    expect(nextPrompt(['nope-99'], 'all', 2).id).toBe(nextPrompt([], 'all', 2).id);
  });
  it('keeps going when a person switches category and back', () => {
    const history: string[] = [];
    const picks: JournalPromptCategoryKey[] = ['shadow', 'joy', 'shadow', 'all', 'shadow', 'joy'];
    for (let i = 0; i < 40; i += 1) history.push(nextPrompt(history, picks[i % picks.length]!, 4).id);
    expect(new Set(history).size).toBeGreaterThan(20);
    // Within the shadow pool, whatever was shown stays out until the pool is used up.
    const shownShadow = new Set(history.filter((id) => id.startsWith('shadow-')));
    const { shown, size } = promptRound(history, 'shadow');
    expect(shown).toBe(shownShadow.size % size);
    const next = nextPrompt(history, 'shadow', 4);
    if (shownShadow.size < size) expect(shownShadow.has(next.id)).toBe(false);
  });
  it('reports how far through the round a person is', () => {
    const size = promptsIn('release').length;
    expect(promptRound([], 'release')).toEqual({ shown: 0, size });
    const some = run(5, 'release', 2);
    expect(promptRound(some, 'release').shown).toBe(5);
    expect(promptRound(run(size, 'release', 2), 'release').shown).toBe(0);
  });
});

describe('writing from a prompt', () => {
  it('makes a short title that ends at a word, and a body that keeps the question', () => {
    for (const p of JOURNAL_PROMPTS) {
      const t = promptTitle(p.text);
      expect(t.length).toBeGreaterThan(5);
      expect(t.length).toBeLessThanOrEqual(60);
      expect(promptBody(p.text).startsWith('Prompt: ')).toBe(true);
    }
    expect(promptTitle('Think of a trait. Where does it live in you?')).toBe('Think of a trait');
    expect(promptTitle('A very long first sentence that keeps going and going well past the sixty character limit of a title.')).toMatch(/…$/);
    expect(promptBody('Why?')).toBe('Prompt: Why?\n\n');
  });
});
