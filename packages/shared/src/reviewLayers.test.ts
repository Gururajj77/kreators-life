import { describe, expect, it } from 'vitest';
import {
  builtInTemplate,
  builtInTemplateFor,
  builtInTemplates,
  DASHBOARD_PERIODS,
  halfPart,
  KIND_META,
  PERIOD_KINDS,
  PERIOD_META,
  periodDays,
  periodFor,
  periodLabel,
  periodShift,
  REVIEW_LAYER,
  REVIEW_PROMPT_MAX,
  REVIEW_PROMPT_SETS,
  reviewNameFor,
  reviewPeriodFor, reviewPeriodNow,
} from './index.ts';

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

describe('the year as a period', () => {
  it('is the calendar year, a leap year included', () => {
    expect(PERIOD_KINDS).toContain('year');
    expect(DASHBOARD_PERIODS).toEqual(['day', 'week', 'month', 'quarter', 'half']);
    expect(periodFor('year', '2026-11-07')).toEqual({ kind: 'year', start: '2026-01-01', end: '2026-12-31' });
    expect(periodFor('year', '2028-02-29')).toEqual({ kind: 'year', start: '2028-01-01', end: '2028-12-31' });
    expect(periodDays(periodFor('year', '2026-06-01'))).toHaveLength(365);
    expect(periodDays(periodFor('year', '2028-06-01'))).toHaveLength(366);
    expect(periodDays(periodFor('year', '2000-06-01'))).toHaveLength(366);
    expect(periodDays(periodFor('year', '2100-06-01'))).toHaveLength(365);
    expect(periodDays(periodFor('year', '2028-06-01'))).toContain('2028-02-29');
  });
  it('steps a year at a time and reads as the year', () => {
    expect(periodShift(periodFor('year', '2026-11-07'), -1)).toEqual({ kind: 'year', start: '2025-01-01', end: '2025-12-31' });
    expect(periodShift(periodFor('year', '2026-11-07'), 2).start).toBe('2028-01-01');
    expect(periodLabel(periodFor('year', '2026-11-07'))).toBe('2026');
    expect(PERIOD_META.year.previous).toBe('the year before');
  });
  it('opens the year just ended on 1 January, and the year it is in on any other day', () => {
    expect(reviewPeriodFor('year', '2027-01-01')).toEqual({ kind: 'year', start: '2026-01-01', end: '2026-12-31' });
    expect(reviewPeriodFor('year', '2026-12-31')).toEqual({ kind: 'year', start: '2026-01-01', end: '2026-12-31' });
    expect(reviewPeriodFor('year', '2026-11-07').start).toBe('2026-01-01');
  });
  it('opens the half and the year just turned on any early day, not only the first', () => {
    for (const day of ['2027-01-02', '2027-01-05', '2027-02-14', '2027-03-31']) {
      expect(reviewPeriodFor('year', day).start).toBe('2026-01-01');
      expect(reviewPeriodFor('half', day)).toEqual({ kind: 'half', start: '2026-07-01', end: '2026-12-31' });
      expect(reviewNameFor(reviewPeriodFor('half', day))).toBe('Start-of-year setting');
    }
    for (const day of ['2026-07-02', '2026-07-06', '2026-09-30']) expect(reviewNameFor(reviewPeriodFor('half', day))).toBe('Mid-year check-in');
    // Picked on Reviews: the setting around the turn of the year, the check-in around its middle, and the week as it is.
    expect(reviewNameFor(reviewPeriodNow('half', '2026-11-07'))).toBe('Start-of-year setting');
    expect(reviewNameFor(reviewPeriodNow('half', '2026-08-15'))).toBe('Mid-year check-in');
    expect(reviewNameFor(reviewPeriodNow('half', '2026-05-10'))).toBe('Mid-year check-in');
    expect(reviewPeriodNow('year', '2026-03-10').start).toBe('2025-01-01');
    expect(reviewPeriodNow('year', '2026-08-15').start).toBe('2026-01-01');
    expect(reviewPeriodNow('week', '2026-11-02')).toEqual(periodFor('week', '2026-11-02'));
    expect(reviewPeriodFor('week', '2026-11-02').start).toBe('2026-10-26');
  });
});

describe('the day as a period', () => {
  it('is one calendar day, first and shortest, and steps a day at a time', () => {
    expect(PERIOD_KINDS[0]).toBe('day');
    expect(PERIOD_KINDS).toEqual(['day', 'week', 'month', 'quarter', 'half', 'year']);
    expect(periodFor('day', '2026-11-07')).toEqual({ kind: 'day', start: '2026-11-07', end: '2026-11-07' });
    expect(periodDays(periodFor('day', '2026-11-07'))).toEqual(['2026-11-07']);
    expect(periodShift(periodFor('day', '2026-11-07'), -1)).toEqual({ kind: 'day', start: '2026-11-06', end: '2026-11-06' });
    expect(periodShift(periodFor('day', '2026-03-01'), -1).start).toBe('2026-02-28');
    expect(periodShift(periodFor('day', '2028-03-01'), -1).start).toBe('2028-02-29');
    expect(periodShift(periodFor('day', '2026-12-31'), 1).start).toBe('2027-01-01');
    expect(periodLabel(periodFor('day', '2026-11-07'))).toBe('7 Nov 2026');
    expect(periodLabel(periodFor('day', '2027-01-01'))).toBe('1 Jan 2027');
    expect(PERIOD_META.day).toMatchObject({ name: 'Daily review', short: 'Day', previous: 'the day before' });
    expect(reviewNameFor(periodFor('day', '2026-11-07'))).toBe('Daily review');
  });
  it('opens today when picked, and a morning reminder opens the day before', () => {
    expect(reviewPeriodNow('day', '2026-11-07')).toEqual(periodFor('day', '2026-11-07'));
    expect(reviewPeriodFor('day', '2026-11-07')).toEqual(periodFor('day', '2026-11-07'));
    expect(reviewPeriodFor('day', '2026-11-07', '21:30').start).toBe('2026-11-07');
    expect(reviewPeriodFor('day', '2026-11-07', '12:00').start).toBe('2026-11-07');
    expect(reviewPeriodFor('day', '2026-11-07', '07:00').start).toBe('2026-11-06');
    expect(reviewPeriodFor('day', '2026-01-01', '06:00').start).toBe('2025-12-31');
    // The longer periods ignore the time.
    expect(reviewPeriodFor('week', '2026-11-02', '07:00')).toEqual(reviewPeriodFor('week', '2026-11-02'));
  });
});

/** The methods a built-in question may say it comes from (2026-11-07, the founder's list), and the app's own walk of the layer. */
const METHODS = /^(The app's own way:|From (CBT|ACT|trauma-informed care|family systems|improv|positive psychology|self-compassion work|the Gita's karma yoga|the Gita and the Stoics|the Stoics and the Gita|the Stoics and the Buddha|the Stoics):)/;

describe('reviews by layer', () => {
  it('walks one layer of the pyramid for each kind', () => {
    expect(REVIEW_LAYER).toEqual({ day: 'task', week: 'project', month: 'outcome', quarter: 'value_goal', half: 'principle', year: 'pillar' });
  });
  it('gives every period one built-in template of plain questions that starts by walking its layer, pillar by pillar', () => {
    const periods = [periodFor('day', '2026-11-07'), periodFor('week', '2026-11-07'), periodFor('month', '2026-11-07'), periodFor('quarter', '2026-11-07'), periodFor('half', '2026-03-01'), periodFor('half', '2026-09-01'), periodFor('year', '2026-11-07')];
    for (const p of periods) {
      const t = builtInTemplateFor(p);
      expect(t.id).toBe(`builtin:${p.kind}`);
      expect(t.builtIn).toBe(true);
      expect(t.kind).toBe(p.kind);
      // A day's set is shorter: about five. The others five to seven.
      expect(t.prompts.length).toBeGreaterThanOrEqual(p.kind === 'day' ? 4 : 5);
      expect(t.prompts.length).toBeLessThanOrEqual(p.kind === 'day' ? 6 : 7);
      expect(new Set(t.prompts).size).toBe(t.prompts.length);
      const layerWord = (p.kind === 'year' ? 'foundation' : KIND_META[REVIEW_LAYER[p.kind]].label).toLowerCase();
      expect(t.prompts[0]!.toLowerCase()).toContain(layerWord);
      expect(t.prompts[0]!.toLowerCase()).toMatch(/pillar/);
      for (const q of t.prompts) {
        expect(q.length).toBeLessThanOrEqual(REVIEW_PROMPT_MAX);
        expect(flesch(q)).toBeGreaterThanOrEqual(60);
      }
      // Every question carries a short why that names its method, in plain words; the first is the app's own walk of the layer.
      expect(t.why).toHaveLength(t.prompts.length);
      expect(t.why![0]).toMatch(/^The app's own way:/);
      for (const w of t.why!) {
        expect(w).toMatch(METHODS);
        expect(w.length).toBeLessThanOrEqual(120);
        expect(flesch(w)).toBeGreaterThanOrEqual(60);
      }
    }
  });
  it('has one template per period, the half in its two parts, with the methods the founder asked for across them', () => {
    const all = builtInTemplates();
    expect(all.map((t) => `${t.kind}${t.part ? `:${t.part}` : ''}`)).toEqual(['day', 'week', 'month', 'quarter', 'half:checkin', 'half:setting', 'year']);
    expect(new Set(all.map((t) => t.id)).size).toBe(PERIOD_KINDS.length);
    const whys = all.flatMap((t) => t.why ?? []).join(' ');
    for (const m of ['CBT', 'ACT', 'trauma-informed care', 'family systems', 'improv', 'positive psychology', 'karma yoga', 'Stoics', 'Buddha', 'self-compassion']) expect(whys).toContain(m);
    // A heavy question is optional and gentle: a hard thought, or anything trauma-informed, says it can be skipped.
    for (const t of all) {
      t.prompts.forEach((q, i) => {
        const w = t.why![i]!;
        if (/hard thought|forgive|hard moment|hard to carry/i.test(q) || /trauma-informed/.test(w)) expect(`${q} ${w}`).toMatch(/skip|only as much as you want|only what you are ready|if you want|you choose how much/i);
      });
    }
  });
  it('keeps to the words the app uses, and never promises, diagnoses or talks like therapy', () => {
    const all = Object.values(REVIEW_PROMPT_SETS)
      .flat()
      .map((x) => `${x.q} ${x.why}`)
      .join(' ');
    expect(all).not.toMatch(/\b(rule|rules|feeling|proof|rung|ladder|tower|floor|spark|sprint|cycle|retro|guarantee|cure|cures|diagnos\w*|disorder|symptom\w*|patient|treat\w*|heal\w*|therap\w*|always will|you will succeed|will make you)\b/i);
    // Our own words: no quotation from a book (a quote mark appears only around the improv phrase "yes, and").
    expect(all.replace(/“yes, and”/g, '')).not.toMatch(/[“”"]/);
    // Each of the three leanings shows up in every set: the next small step, what was in your hands, and a kind look at yourself.
    for (const set of Object.values(REVIEW_PROMPT_SETS)) {
      const text = set
        .map((x) => x.q)
        .join(' ')
        .toLowerCase();
      expect(text).toMatch(/next|first|which .* (needs|gets|comes first)|for each pillar|for the rest of the year|what one project|what small change|what should stop/);
      expect(text).toMatch(/hands|control|steady|calm|luck|whatever the result|turn out/);
      expect(text).toMatch(/kind|blame|forgive|friend|thankful|speak to yourself|teach|learn/);
    }
  });
  it('splits the half year: January to June is the mid-year check-in, July to December the start-of-year setting', () => {
    const checkin = builtInTemplateFor(periodFor('half', '2026-04-10'));
    const setting = builtInTemplateFor(periodFor('half', '2026-10-10'));
    expect(halfPart(periodFor('half', '2026-04-10'))).toBe('checkin');
    expect(halfPart(periodFor('half', '2026-10-10'))).toBe('setting');
    expect(checkin.name).toBe('Mid-year check-in');
    expect(setting.name).toBe('Start-of-year setting');
    expect(checkin.id).toBe(setting.id);
    expect(checkin.prompts).not.toEqual(setting.prompts);
    expect(checkin.prompts.join(' ')).toMatch(/rest of the year/);
    expect(setting.prompts.join(' ')).toMatch(/live by in the year ahead/);
    // Answered on either side of 1 January, so the setting and the yearly review never say "this year".
    expect(setting.prompts.join(' ')).not.toMatch(/this year/);
    expect(builtInTemplateFor(periodFor('year', '2026-11-07')).prompts.join(' ')).not.toMatch(/this year/);
    // The reminder on 1 July opens the check-in; on 1 January the setting, beside the yearly review of the foundations.
    expect(reviewNameFor(reviewPeriodFor('half', '2026-07-01'))).toBe('Mid-year check-in');
    expect(reviewNameFor(reviewPeriodFor('half', '2027-01-01'))).toBe('Start-of-year setting');
    expect(reviewNameFor(reviewPeriodFor('year', '2027-01-01'))).toBe('Yearly review');
    expect(builtInTemplate('half').name).toBe('Mid-year check-in');
    expect(builtInTemplate('half', 'setting').name).toBe('Start-of-year setting');
    expect(reviewNameFor(periodFor('week', '2026-11-07'))).toBe('Weekly review');
  });
});
