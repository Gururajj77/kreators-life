import { describe, expect, it } from 'vitest';
import { CHANNEL_MEANINGS, DESIGN_CHANNELS, channelKey, computeDesign, designChart, gateSide, hangingGates } from './index.ts';

const FIELDS = ['what', 'best', 'watch', 'step'] as const;

describe('channel meanings', () => {
  it('has 36 meanings, one for each channel and none extra', () => {
    expect(Object.keys(CHANNEL_MEANINGS)).toHaveLength(36);
    const keys = DESIGN_CHANNELS.map(channelKey);
    expect(new Set(keys).size).toBe(36);
    for (const k of keys) expect(CHANNEL_MEANINGS[k], k).toBeDefined();
    for (const k of Object.keys(CHANNEL_MEANINGS)) expect(keys).toContain(k);
  });

  it('every meaning has every field, a whole sentence in plain words, and never predicts', () => {
    for (const [k, m] of Object.entries(CHANNEL_MEANINGS)) {
      for (const f of FIELDS) {
        const text = m[f];
        expect(typeof text, `${k}.${f}`).toBe('string');
        expect(text.length, `${k}.${f}`).toBeGreaterThan(15);
        expect(text.length, `${k}.${f}`).toBeLessThan(120);
        expect(text, `${k}.${f}`).toMatch(/^[A-Z].*\.$/);
        expect(text, `${k}.${f}`).not.toMatch(/\b(you will|destined|guarantee|always will)\b/i);
      }
    }
  });
});

describe('gates on the graph', () => {
  const r = computeDesign({ date: '1990-06-15', time: '14:30', zone: 'Asia/Kolkata', place: '', name: '' });
  const chart = designChart(r, 'tropical');

  it('every gate of a whole channel is on, and its side matches the channel', () => {
    for (const c of chart.channels) {
      const a = gateSide(chart, c.a);
      const b = gateSide(chart, c.b);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      if (c.from === 'personality') expect([a, b].every((s) => s === 'personality' || s === 'both')).toBe(true);
      if (c.from === 'design') expect([a, b].every((s) => s === 'design' || s === 'both')).toBe(true);
    }
  });

  it('a hanging gate is on, is in no whole channel, and names the gates that would complete it', () => {
    const inChannel = new Set(chart.channels.flatMap((c) => [c.a, c.b]));
    const hanging = hangingGates(chart);
    for (const h of hanging) {
      expect(inChannel.has(h.gate)).toBe(false);
      expect(gateSide(chart, h.gate)).toBe(h.side);
      expect(h.partners.length).toBeGreaterThan(0);
      for (const p of h.partners) expect(DESIGN_CHANNELS.some((c) => (c.a === h.gate && c.b === p) || (c.b === h.gate && c.a === p))).toBe(true);
    }
    // Every gate that is on is either in a channel or hanging.
    const on = new Set([...chart.personality, ...chart.design].map((x) => x.gate));
    expect(inChannel.size + hanging.length).toBe(on.size);
  });

  it('a chart with no gates on has nothing hanging', () => {
    expect(hangingGates({ personality: [], design: [], channels: [] })).toEqual([]);
  });
});
