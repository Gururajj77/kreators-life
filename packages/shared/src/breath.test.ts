import { describe, expect, it } from 'vitest';
import { BREATHING, BREATH_CUES, BREATH_PATTERNS, BREATH_SAY, BREATH_WORDS, breathAt, breathPatternFor, breathRounds, FOCUS_DEFAULTS, parseFocusSettings } from './index';

describe('breathing patterns', () => {
  it('every pattern has a unique key, a name, counts, a plain line and steps of whole seconds', () => {
    const keys = new Set<string>();
    for (const p of BREATH_PATTERNS) {
      expect(keys.has(p.key)).toBe(false);
      keys.add(p.key);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.line.length).toBeGreaterThan(0);
      expect(p.steps.length).toBeGreaterThan(1);
      for (const s of p.steps) {
        expect(Number.isInteger(s.seconds)).toBe(true);
        expect(s.seconds).toBeGreaterThan(0);
      }
      // A breath goes in and comes out.
      expect(p.steps.some((s) => s.kind === 'in')).toBe(true);
      expect(p.steps.some((s) => s.kind === 'out')).toBe(true);
      // No health claims.
      expect(p.line).not.toMatch(/cure|treat|anxiety|insomnia|heal|proven|guarantee/i);
    }
  });

  it('Pranayam is offered in the strategy session and in Mindfulness, with a longer breath out and no claim', () => {
    const session = BREATHING.find((b) => b.key === 'pranayam');
    expect(session?.name).toBe('Pranayam');
    expect(session?.blurb).not.toMatch(/cure|treat|anxiety|insomnia|heal|proven|guarantee/i);
    const p = breathPatternFor('pranayam');
    expect(p.key).toBe('pranayam');
    const len = (k: string) => p.steps.filter((s) => s.kind === k).reduce((t, s) => t + s.seconds, 0);
    expect(len('out')).toBeGreaterThan(len('in'));
  });

  it('the default is the calm exhale, 4 in, 4 hold, 6 out, 2 rest', () => {
    const p = breathPatternFor(undefined);
    expect(p.key).toBe('calm');
    expect(p.steps.map((s) => [s.kind, s.seconds])).toEqual([['in', 4], ['hold', 4], ['out', 6], ['rest', 2]]);
    expect(breathPatternFor('nonsense').key).toBe('calm');
    expect(breathPatternFor('constructor').key).toBe('calm');
  });

  it('breathAt walks the steps and loops', () => {
    const p = breathPatternFor('calm');
    expect(breathAt(p, 0)).toMatchObject({ index: 0, secondsLeft: 4, loop: 0 });
    expect(breathAt(p, 3_100)).toMatchObject({ index: 0, secondsLeft: 1 });
    expect(breathAt(p, 4_000)).toMatchObject({ index: 1, secondsLeft: 4 });
    expect(breathAt(p, 8_500).step.kind).toBe('out');
    expect(breathAt(p, 8_500).secondsLeft).toBe(6);
    expect(breathAt(p, 14_000).step.kind).toBe('rest');
    expect(breathAt(p, 16_000)).toMatchObject({ index: 0, loop: 1 });
    expect(breathAt(p, 2_000).progress).toBeCloseTo(0.5);
    expect(BREATH_WORDS[breathAt(p, 0).step.kind]).toBe('Breathe in');
  });

  it('the setting is read safely and defaults to calm', () => {
    expect(FOCUS_DEFAULTS.breath).toBe('calm');
    expect(parseFocusSettings({ breath: 'box' }).breath).toBe('box');
    expect(parseFocusSettings({ breath: '__proto__' }).breath).toBe('calm');
    expect(parseFocusSettings({ breath: 7 }).breath).toBe('calm');
  });

  it('cues and rounds', () => {
    expect(FOCUS_DEFAULTS.breathCue).toBe('chime');
    expect(BREATH_CUES.map((c) => c.key)).toEqual(['chime', 'bell', 'voice', 'off']);
    expect(parseFocusSettings({ breathCue: 'voice' }).breathCue).toBe('voice');
    expect(parseFocusSettings({ breathCue: 'shout' }).breathCue).toBe('chime');
    expect(BREATH_SAY.in).toBe('In');
    const calm = breathPatternFor('calm');
    expect(breathRounds(calm, 60_000)).toBe(3);
    expect(breathRounds(calm, 15_999)).toBe(0);
    expect(breathRounds(calm, 3 * 60_000)).toBe(11);
  });
});
