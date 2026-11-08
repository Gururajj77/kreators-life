import { describe, expect, it } from 'vitest';
import { IDENTITIES, identityLine, matchSetup, parseSetup, readAbout, SETUP_APP_LINES, SETUP_BLOCKERS, SETUP_COMBOS, SETUP_GOAL_GROUPS, SETUP_GOALS, SETUP_MOVE_GROUP, SETUP_ROLE_GROUPS, TERMS } from './index';

const apps = (identities: string[], goals: string[], blockers: string[] = []) => matchSetup({ identities, goals, blockers }).apps.map((a) => a.key);
const why = (identities: string[], goals: string[], blockers: string[], app: string) => {
  const m = matchSetup({ identities, goals, blockers });
  return [...m.apps, ...m.more].find((a) => a.key === app)?.why;
};

describe('setup: the people Fitness fits', () => {
  it('leads each kind of mover to Fitness, whatever else they came for', () => {
    for (const tag of SETUP_MOVE_GROUP.keys) {
      expect(apps([tag], []), tag).toContain('fitness');
      for (const g of SETUP_GOALS) {
        const m = matchSetup({ identities: [tag], goals: [g.key], blockers: [] });
        expect([...m.apps, ...m.more].map((a) => a.key), `${tag} ${g.key}`).toContain('fitness');
      }
    }
  });

  it('offers the movers on the who-you-are card, as tags of the rest of life', () => {
    for (const k of SETUP_MOVE_GROUP.keys) expect(IDENTITIES.find((i) => i.key === k)?.kind, k).toBe('life');
    expect(SETUP_ROLE_GROUPS.flatMap((g) => g.keys).some((k) => SETUP_MOVE_GROUP.keys.includes(k))).toBe(false);
    const swimmer = IDENTITIES.find((i) => i.key === 'swimmer')!;
    expect(swimmer.interest).toBe('Swimming');
    expect(readAbout('I swim three times a week').identities).toContain('swimmer');
    expect(readAbout("I'm a swimmer").custom).toEqual([]);
  });

  it('makes Fitness the main app of Move more and of Eat well', () => {
    expect(apps([], ['move'])[0]).toBe('fitness');
    expect(apps([], ['move'])).toContain('run');
    expect(apps([], ['eat'])[0]).toBe('fitness');
    expect(apps([], ['eat'])).not.toContain('run');
    expect(apps(['student'], ['learn', 'move'], ['time'])).toContain('fitness');
    expect(SETUP_GOAL_GROUPS.flatMap((g) => g.keys)).toEqual(expect.arrayContaining(['move', 'eat']));
    expect(readAbout('I want to eat better and sort out my diet').goals).toContain('eat');
    expect(readAbout('I want to go cycling and walk more').goals).toContain('move');
    expect(matchSetup({ identities: [], goals: ['eat'], blockers: ['energy'] }).session).toBe('soon');
    expect(parseSetup({ goals: ['eat'] }).goals).toEqual(['eat']);
  });

  it('brings Fitness forward when energy is low', () => {
    expect(apps([], [], ['energy'])).toContain('fitness');
    expect(why([], [], ['energy'], 'fitness')).toBe('Because energy runs low, and Fitness counts even a short walk.');
    expect(why([], ['move'], ['energy'], 'fitness')).toBe('Because you want to move more and energy runs low, so a short walk counts.');
    expect(why([], ['eat'], ['energy'], 'fitness')).toBe('Because energy runs low and you want to see how you eat.');
  });

  it('never suggests a supplement, in any word the setup says', () => {
    const said = JSON.stringify([IDENTITIES, SETUP_GOALS, SETUP_BLOCKERS, SETUP_COMBOS, SETUP_APP_LINES]).toLowerCase();
    for (const word of ['supplement', 'nootropic', 'vitamin', 'mineral', 'herb']) expect(said, word).not.toContain(word);
  });
});

describe('setup: reasons that say why this app', () => {
  it('reads well for Fitness, Reviews, Journal and Coaching', () => {
    expect(why(['swimmer'], [], [], 'fitness')).toBe('Because you swim, and Fitness keeps every swim in one place.');
    expect(why(['employee'], [], [], 'reviews')).toBe('Because you have a job, and a short look back shows where the week went.');
    expect(why([], ['find_coach'], [], 'reviews')).toBe('Because you want a coach in your corner, and a coach can read the reviews you share.');
    expect(why([], ['plan'], [], 'journal')).toBe('Because you want to stay on track, and a few lines a day show how it went.');
    expect(why(['coach'], [], [], 'coaching')).toBe('Because you coach people, and each student has a report of what they share.');
    expect(why([], ['plan'], ['focus'], 'reviews')).toBe('Because you want to stay on track and focus is hard, so a short look back helps.');
  });

  it('says the apps that changed in words that are still true', () => {
    expect(SETUP_APP_LINES.reviews).toMatch(/day, week, month or year/);
    expect(SETUP_APP_LINES.journal).toMatch(/gratitude/);
    expect(SETUP_APP_LINES.fitness).toMatch(/swims/);
    expect(SETUP_APP_LINES.run).toMatch(/Club runs/);
  });

  it('says every tag on the who-you-are card in one line that reads', () => {
    expect(identityLine({ identities: ['yogi'], goals: ['health'], blockers: [] })).toBe('A yogi, here to feel better day to day.');
    expect(identityLine({ identities: ['swimmer'], goals: ['eat'], blockers: [] })).toBe('A swimmer, here to eat well.');
    expect(identityLine({ identities: ['spiritual'], goals: [], blockers: [] })).toBe('A spiritual person.');
  });
});

describe('the glossary', () => {
  it('has the live call, in plain words that promise no charge yet', () => {
    expect(TERMS['live call']).toMatch(/Nothing is charged until payments go live/);
  });
});
