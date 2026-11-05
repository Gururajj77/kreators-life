import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INSIGHT_APPS, insightsFor, insightsForApp, insightsForEvery, insightsForPlace, isPillarLine, RELATIONSHIPS } from './index';
import { GOLDEN_CASES, goldenFacts } from './insights.golden.fixtures';

// Emerging's golden output (2026-11-05): the whole answer of `insightsFor` and what every place shows, for three synthetic people,
// pinned before the speed pass so a change that is only about speed can be shown to change nothing.

describe('Emerging golden output', () => {
  for (const [name, opts] of Object.entries(GOLDEN_CASES)) {
    it(`${name}: the full list and every place`, async () => {
      const f = goldenFacts(opts);
      const all = insightsFor(f);
      const places: Record<string, unknown> = {};
      for (const app of INSIGHT_APPS) if (app !== 'pillar') places[app] = insightsForApp(all, app).map((i) => i.id);
      for (const r of RELATIONSHIPS) {
        const withRel = insightsFor({ ...f, rel: r.key });
        places[`pillar:${r.key}`] = insightsForApp(withRel, 'pillar', r.key);
        places[`full:${r.key}`] = withRel.map((i) => i.id);
      }
      await expect(JSON.stringify({ all, places }, null, 1)).toMatchFileSnapshot(`./__golden__/insights-${name}.json`);
    });

    it(`${name}: one list for every place gives each place what its own request gave`, () => {
      const f = goldenFacts(opts);
      const golden = JSON.parse(readFileSync(new URL(`./__golden__/insights-${name}.json`, import.meta.url), 'utf8')) as { all: unknown[]; places: Record<string, unknown> };
      const every = insightsForEvery(f);
      expect(every.filter(isPillarLine)).toHaveLength(RELATIONSHIPS.length);
      expect(JSON.parse(JSON.stringify(insightsForPlace(every, 'insights')))).toEqual(golden.all);
      expect(JSON.parse(JSON.stringify(insightsForPlace(every, null)))).toEqual(golden.all);
      for (const app of INSIGHT_APPS) if (app !== 'pillar') expect(insightsForPlace(every, app).map((i) => i.id)).toEqual(golden.places[app]);
      for (const r of RELATIONSHIPS) expect(JSON.parse(JSON.stringify(insightsForPlace(every, 'pillar', r.key)))).toEqual(golden.places[`pillar:${r.key}`]);
    });

    it(`${name}: the order ticks come in changes nothing (GET /insights reads the newest first)`, () => {
      const f = goldenFacts(opts);
      expect(insightsFor({ ...f, done: [...f.done].reverse() })).toEqual(insightsFor(f));
    });
  }
});
