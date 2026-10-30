import { BADGES as ALL_BADGES, HOW_TO, kmLabel, MODULES as MODS, paceLabel, RUN_BADGES, runEntryState, TERMS, termGroups, weekStart, weekStreak } from './index';
import { earningGuide, nextBadge, unlockFor } from './index';
import { ageOn, birthDateProblem, MIN_AGE, normalizePhone, phoneProblem } from './index';
import { BRAND_SOURCE_KINDS, BRAND_SOURCE_META, PIECE_KINDS, PIECE_META, RESEARCH_KINDS, RESEARCH_META, sourceKindOf } from './index';
import { BAND_STATEMENTS, MAP_LEVELS, pickFocus, placementFlags, rampTime, routineFor, settleScore } from './index';
import { characterHello, characterTitle, INSECURITY_WEIGHTS, mantraLine, scoreOfStars, STAR_WORDS, starsOf, weightWord } from './index';
import { blockMinutes, minutesLabel, parseRoutineBlocks, stepsMinutes } from './index';
import type { Placement } from './index';
import { SOCIAL_REWARDS, trustScore } from './index';
import { FEATURE_FEE_POINTS, isFeatured, parseImageUrls, STORE_STAGE_META, PREOWNED_CONDITION_META } from './index';
import { builtInTemplate, parseReviewPrompts, periodDays, periodFor, periodLabel, periodShift } from './index';
import { MAX_NOT_TO_DO, notToDoStreak, notToDoWeek, shiftDay } from './index';
import { AGENT_LIMITS, AGENTS, ASSISTANT_MODELS, centsFrom, creditsFor, FALLBACK_PRICE, isPaidPlan, messagesFor, microsFrom, MODEL_PRICES, PAID_PLANS, PLANS, priceOf, spendSplit, TOPUP_PACKS } from './index';
import { describe, expect, it } from 'vitest';
import { bountyPayout, COMPLEMENTS, dressCodeFor, feeBps, greetingFor, INTEREST_GROUPS, INTERESTS, ladderOptions, MAX_INTERESTS, MODULE_GROUPS, MODULES, moduleState, nextWeek, passwordProblem, matchCircles, matchScore, money, nudgeFor, rolloutBucket, slotsFor, timeLabel, zonedToUtc } from './index';

describe('money', () => {
  it('fees use integer maths in basis points', () => {
    expect(feeBps(49_900, 500)).toBe(2495);
    expect(feeBps(1, 500)).toBe(0);
    expect(feeBps(333, 500)).toBe(17);
  });
  it('formats currency without floating noise', () => {
    expect(money(123450, 'INR')).toBe('₹1,234.50');
    expect(money(100000, 'INR')).toBe('₹1,000');
    expect(money(-2500, 'USD')).toBe('-$25');
  });
  it('content rewards pay per thousand verified views, never past the cap or below the floor', () => {
    const rule = { ratePerThousand: 10, maxPayoutPoints: 500, minViews: 1000 };
    expect(bountyPayout(999, rule)).toBe(0);
    expect(bountyPayout(25_000, rule)).toBe(250);
    expect(bountyPayout(1_000_000, rule)).toBe(500);
    expect(bountyPayout(25_000, { ...rule, maxPayoutPoints: 0 })).toBe(250);
  });
});

describe('time', () => {
  it('reads a local minute in a zone back to the right instant across daylight saving', () => {
    expect(zonedToUtc('2026-01-15', 600, 'Asia/Kolkata').toISOString()).toBe('2026-01-15T04:30:00.000Z');
    expect(zonedToUtc('2026-01-15', 600, 'America/New_York').toISOString()).toBe('2026-01-15T15:00:00.000Z');
    expect(zonedToUtc('2026-07-15', 600, 'America/New_York').toISOString()).toBe('2026-07-15T14:00:00.000Z');
  });
  it('labels times the way people say them', () => {
    expect(timeLabel('09:30')).toBe('9:30 am');
    expect(timeLabel('00:05')).toBe('12:05 am');
    expect(timeLabel('13:00')).toBe('1:00 pm');
  });
});

describe('slots', () => {
  const base = {
    date: '2026-11-02', // a Monday
    zone: 'Asia/Kolkata',
    rules: [{ weekday: 1, startMin: 600, endMin: 720 }],
    overrides: [],
    busy: [],
    durationMin: 30,
    bufferMin: 0,
    noticeHours: 0,
    maxDaysAhead: 30,
    now: new Date('2026-10-25T00:00:00Z'),
  };
  it('cuts the window into slots in the creator zone, as UTC', () => {
    expect(slotsFor(base)).toEqual(['2026-11-02T04:30:00.000Z', '2026-11-02T05:00:00.000Z', '2026-11-02T05:30:00.000Z', '2026-11-02T06:00:00.000Z']);
  });
  it('keeps a buffer around a booking', () => {
    const slots = slotsFor({ ...base, bufferMin: 15, busy: [{ startsAt: '2026-11-02T05:00:00.000Z', endsAt: '2026-11-02T05:30:00.000Z' }] });
    expect(slots).toEqual(['2026-11-02T06:00:00.000Z']);
  });
  it('blocks a day with an empty override and replaces hours with a full one', () => {
    expect(slotsFor({ ...base, overrides: [{ id: 'x', date: '2026-11-02', ranges: [] }] })).toEqual([]);
    expect(slotsFor({ ...base, overrides: [{ id: 'x', date: '2026-11-02', ranges: [{ startMin: 900, endMin: 960 }] }] })).toEqual(['2026-11-02T09:30:00.000Z', '2026-11-02T10:00:00.000Z']);
  });
  it('honours minimum notice and how far ahead', () => {
    expect(slotsFor({ ...base, now: new Date('2026-11-02T04:45:00Z'), noticeHours: 1 })).toEqual(['2026-11-02T06:00:00.000Z']);
    expect(slotsFor({ ...base, now: new Date('2026-10-01T00:00:00Z'), maxDaysAhead: 7 })).toEqual([]);
  });
  it('shows a London buyer the same instants', () => {
    const kolkata = slotsFor(base);
    expect(kolkata.map((s) => new Date(s).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }))).toEqual(['04:30', '05:00', '05:30', '06:00']);
  });
});

describe('matching', () => {
  it('scores complementary interests above plain overlap and nothing in common below zero', () => {
    expect(matchScore(['Photography'], ['Fashion'])).toBe(2);
    expect(matchScore(['Coffee', 'Gaming'], ['Coffee'])).toBe(1);
    expect(matchScore(['Writing', 'Video'], ['Writing'])).toBe(3);
    expect(matchScore(['Fashion'], ['Gaming'])).toBe(-1);
  });
  it('groups interests for everyone, with no repeats, every pair that gels listed, and ten on at once', () => {
    expect(INTEREST_GROUPS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(INTERESTS).size).toBe(INTERESTS.length);
    for (const [a, b] of COMPLEMENTS) {
      expect(INTERESTS).toContain(a);
      expect(INTERESTS).toContain(b);
      expect(a).not.toBe(b);
    }
    expect(MAX_INTERESTS).toBe(10);
  });
  it('seats people at tables of the asked size and never more than twenty km apart', () => {
    const near = (id: string, interests: string[], lat = 12.97, lng = 77.6, joinedAt = '2026-10-01') => ({ id, interests, area: '', lat, lng, joinedAt });
    const r = matchCircles([near('a', ['Photography']), near('b', ['Fashion']), near('c', ['Writing']), near('d', ['Video']), near('far', ['Gaming'], 13.5, 78.5)], 4);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toHaveLength(4);
    expect(r.unmatched).toEqual(['far']);
  });
  it('reports fewer than three people as unmatched rather than a table', () => {
    const c = (id: string) => ({ id, interests: ['Coffee'], area: '', lat: null, lng: null, joinedAt: '2026-10-01' });
    expect(matchCircles([c('a'), c('b')], 5)).toEqual({ groups: [], unmatched: ['a', 'b'] });
  });
});

describe('flags', () => {
  it('buckets the same person the same way every time', () => {
    expect(rolloutBucket('user-1', 'club')).toBe(rolloutBucket('user-1', 'club'));
    expect(rolloutBucket('user-1', 'club')).toBeGreaterThanOrEqual(0);
    expect(rolloutBucket('user-1', 'club')).toBeLessThan(100);
  });
});

describe('home', () => {
  const base = { checkedIn: false, sparkDone: false, taskDone: false, tasksWaiting: 2, hasFloor: true, xpToday: 0, streak: 3, hour: 9 };
  it('leads with the result and points at the one next box', () => {
    expect(nudgeFor(base)).toMatchObject({ action: 'Check in', path: '/today' });
    expect(nudgeFor({ ...base, checkedIn: true, xpToday: 10 })).toMatchObject({ lead: '+10 xp banked from the check-in.', action: 'Do the small act' });
    expect(nudgeFor({ ...base, checkedIn: true, sparkDone: true, xpToday: 25 })).toMatchObject({ action: 'Tick a task', path: '/today' });
    expect(nudgeFor({ ...base, checkedIn: true, sparkDone: true, taskDone: true, xpToday: 45 }).lead).toBe('All three done. +45 xp today.');
  });
  it('says what it will not work without', () => {
    expect(nudgeFor({ ...base, checkedIn: true, sparkDone: true, hasFloor: false, xpToday: 25 })).toMatchObject({ action: 'Set up a pillar', path: '/tower' });
    expect(nudgeFor({ ...base, checkedIn: true, sparkDone: true, tasksWaiting: 0, xpToday: 25 })).toMatchObject({ action: 'Add a task', path: '/tower' });
    expect(nudgeFor({ ...base, hour: 21 }).action).toBe('Check in before midnight');
  });
  it('greets by the hour', () => {
    expect(greetingFor(8)).toBe('Good morning');
    expect(greetingFor(15)).toBe('Good afternoon');
    expect(greetingFor(21)).toBe('Good evening');
  });
});

describe('circles', () => {
  it('tells each person what to wear and what the colours mean', () => {
    expect(dressCodeFor('single')).toContain('something red');
    expect(dressCodeFor('committed')).toContain('something white');
    expect(dressCodeFor('private')).toContain('whatever you like');
    expect(dressCodeFor(null)).toContain('red if you are single');
  });
  it('rolls a weekly circle to the same time one week on', () => {
    expect(nextWeek('2026-11-04T13:30:00.000Z')).toBe('2026-11-11T13:30:00.000Z');
  });
});

describe('apps', () => {
  it('starts with only the core apps on', () => {
    const on = MODULES.filter((m) => m.defaultOn && !m.locked && m.minRole === 'user').map((m) => m.key).sort();
    expect(on).toEqual(['help', 'journal', 'life', 'notifications', 'profile', 'school', 'shop', 'work', 'army'].sort());
  });
  it('does not list rank or rewards as apps', () => {
    expect(MODULES.some((m) => m.key === 'leaderboard' || m.key === 'rewards')).toBe(false);
  });
  it('keeps internal tools behind a team role, and gives every group a name', () => {
    const obs = MODULES.find((m) => m.key === 'observability')!;
    expect(obs.group).toBe('internal');
    expect(moduleState(obs, 'user', {}, {}).available).toBe(false);
    expect(moduleState(obs, 'sub_admin', {}, {}).on).toBe(true);
    expect(moduleState(obs, 'admin', {}, {}).on).toBe(true);
    for (const m of MODULES) expect(MODULE_GROUPS[m.group]).toBeTruthy();
  });
  it('offers a few value goals and projects per floor', () => {
    const o = ladderOptions('friendship');
    expect(o.valueGoals.length).toBeGreaterThanOrEqual(3);
    expect(o.projects).toContain('Real hangs');
  });
});

describe('passwords', () => {
  it('turns away short, common, repeated and email-based passwords, and takes a real one', () => {
    expect(passwordProblem('short')).toMatch(/at least 8/);
    expect(passwordProblem('x'.repeat(129))).toMatch(/under 128/);
    expect(passwordProblem('Password123')).toMatch(/guess list/);
    expect(passwordProblem('aaaaaaaaaa')).toMatch(/over and over/);
    expect(passwordProblem('mira.sharma2026', 'mira.sharma@example.com')).toMatch(/your email/);
    expect(passwordProblem('correct horse battery', 'mira@example.com')).toBeNull();
  });
});

describe('not to do', () => {
  it('counts kept days in a row, lets today stay open, and ends on a slip or a gap', () => {
    const t = '2026-10-25';
    expect(notToDoStreak({}, t)).toBe(0);
    expect(notToDoStreak({ [t]: 'kept' }, t)).toBe(1);
    expect(notToDoStreak({ '2026-10-24': 'kept' }, t)).toBe(1);
    expect(notToDoStreak({ '2026-10-22': 'kept', '2026-10-23': 'kept', '2026-10-24': 'kept', [t]: 'kept' }, t)).toBe(4);
    expect(notToDoStreak({ '2026-10-24': 'kept', [t]: 'slipped' }, t)).toBe(0);
    expect(notToDoStreak({ '2026-10-21': 'kept', '2026-10-22': 'kept', '2026-10-24': 'kept', [t]: 'kept' }, t)).toBe(2);
    expect(notToDoStreak({ '2026-10-24': 'slipped', [t]: 'kept' }, t)).toBe(1);
    expect(notToDoWeek({ '2026-10-19': 'kept', [t]: 'slipped' }, t)).toEqual(['kept', null, null, null, null, null, 'slipped']);
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(MAX_NOT_TO_DO).toBe(7);
  });
});

describe('periods', () => {
  it('finds the week, month, quarter and half year around a date', () => {
    expect(periodFor('week', '2026-10-25')).toEqual({ kind: 'week', start: '2026-10-19', end: '2026-10-25' });
    expect(periodFor('week', '2026-11-02')).toEqual({ kind: 'week', start: '2026-11-02', end: '2026-11-08' });
    expect(periodFor('month', '2028-02-10')).toEqual({ kind: 'month', start: '2028-02-01', end: '2028-02-29' });
    expect(periodFor('quarter', '2026-10-25')).toEqual({ kind: 'quarter', start: '2026-10-01', end: '2026-12-31' });
    expect(periodFor('half', '2026-05-01')).toEqual({ kind: 'half', start: '2026-01-01', end: '2026-06-30' });
    expect(periodFor('half', '2026-10-25').start).toBe('2026-07-01');
  });
  it('steps to the period before or after, and labels them in plain words', () => {
    expect(periodShift(periodFor('week', '2026-10-25'), -1).start).toBe('2026-10-12');
    expect(periodShift(periodFor('month', '2026-01-31'), 1)).toEqual({ kind: 'month', start: '2026-02-01', end: '2026-02-28' });
    expect(periodShift(periodFor('quarter', '2026-11-01'), 1).start).toBe('2027-01-01');
    expect(periodShift(periodFor('half', '2026-03-01'), -1)).toEqual({ kind: 'half', start: '2025-07-01', end: '2025-12-31' });
    expect(periodLabel(periodFor('week', '2026-10-25'))).toBe('19 to 25 Oct 2026');
    expect(periodLabel(periodFor('week', '2026-10-31'))).toBe('26 Oct to 1 Nov 2026');
    expect(periodLabel(periodFor('month', '2026-10-25'))).toBe('October 2026');
    expect(periodLabel(periodFor('quarter', '2026-10-25'))).toBe('Oct to Dec 2026');
    expect(periodLabel(periodFor('half', '2026-10-25'))).toBe('Jul to Dec 2026');
    expect(periodDays(periodFor('week', '2026-10-25'))).toHaveLength(7);
    expect(periodDays(periodFor('quarter', '2026-10-25'))).toHaveLength(92);
  });
  it('gives every kind a built-in template and keeps prompts tidy', () => {
    expect(builtInTemplate('half').prompts.length).toBeGreaterThanOrEqual(3);
    expect(parseReviewPrompts(['  What went well? ', '', 7, 'Next?'])).toEqual(['What went well?', 'Next?']);
    expect(parseReviewPrompts('nope')).toEqual([]);
  });
});

describe('store', () => {
  it('keeps picture links to https and a handful, and knows a featured spot by its end', () => {
    expect(parseImageUrls(['https://a.test/1.jpg', 'http://a.test/2.jpg', ' https://a.test/3.jpg ', 5])).toEqual(['https://a.test/1.jpg', 'https://a.test/3.jpg']);
    expect(parseImageUrls(Array(10).fill('https://a.test/x.jpg'))).toHaveLength(6);
    expect(isFeatured('2026-10-26T00:00:00.000Z', '2026-10-25T00:00:00.000Z')).toBe(true);
    expect(isFeatured('2026-10-24T00:00:00.000Z', '2026-10-25T00:00:00.000Z')).toBe(false);
    expect(isFeatured(null)).toBe(false);
    expect(FEATURE_FEE_POINTS).toBeGreaterThan(0);
    expect(Object.keys(STORE_STAGE_META)).toHaveLength(4);
    expect(PREOWNED_CONDITION_META.lightly_used.name).toBe('Lightly used');
  });
});

describe('trust and social rewards', () => {
  it('scores only what was earned, and names it', () => {
    const none = trustScore({ xp: 0, pointsEarned: 0, bestStreak: 0, daysHere: 0, sold: 0, rating: null, honors: 0 });
    expect(none.score).toBe(0);
    expect(none.label).toBe('New here');
    expect(none.parts).toHaveLength(6);
    const some = trustScore({ xp: 600, pointsEarned: 150, bestStreak: 8, daysHere: 60, sold: 2, rating: 4.5, honors: 0 });
    expect(some.score).toBeGreaterThan(none.score);
    expect(some.score).toBeLessThan(75);
    const lots = trustScore({ xp: 4000, pointsEarned: 1000, bestStreak: 30, daysHere: 400, sold: 20, rating: 5, honors: 3 });
    expect(lots.score).toBeGreaterThanOrEqual(90);
    expect(lots.label).toBe('Well trusted');
    expect(trustScore({ xp: 10_000_000, pointsEarned: 0, bestStreak: 0, daysHere: 0, sold: 0, rating: null, honors: 0 }).score).toBeLessThanOrEqual(100);
  });
  it('keeps every social reward small and capped by the day', () => {
    for (const r of Object.values(SOCIAL_REWARDS)) {
      expect(r.xp + r.points).toBeGreaterThan(0);
      expect(r.xp + r.points).toBeLessThanOrEqual(5);
      expect(r.perDay).toBeGreaterThan(0);
    }
  });
});

describe('unlocks and the earning guide', () => {
  it('opens for anyone when nothing is asked, and says plainly what is missing', () => {
    expect(unlockFor({ minPoints: 0, badge: '' }, null).ok).toBe(true);
    expect(unlockFor({ minPoints: 200, badge: '' }, null)).toMatchObject({ ok: false });
    expect(unlockFor({ minPoints: 200, badge: '' }, { points: 40, badges: [] }).why).toBe('Needs 200 points, you have 40.');
    expect(unlockFor({ minPoints: 200, badge: 'first_task' }, { points: 250, badges: [] }).why).toBe('Needs the First tick badge.');
    expect(unlockFor({ minPoints: 200, badge: 'first_task' }, { points: 250, badges: ['first_task'] }).ok).toBe(true);
    expect(nextBadge([])?.key).toBe('first_task');
    expect(nextBadge(['first_task'])?.key).toBe('streak_3');
    expect(earningGuide().length).toBeGreaterThanOrEqual(4);
    expect(earningGuide()[0]!.lines[0]!.pays).toContain('xp');
  });
});

describe('how-tos and terms', () => {
  it('gives every app three steps and only uses words the glossary defines', () => {
    for (const m of MODS) expect(HOW_TO[m.key]?.steps.length ?? 0, m.key).toBeGreaterThanOrEqual(3);
    for (const h of Object.values(HOW_TO)) expect(h.steps.length).toBeLessThanOrEqual(5);
    for (const h of Object.values(HOW_TO)) for (const term of h.terms) expect(TERMS[term], term).toBeTruthy();
    expect(Object.keys(TERMS).length).toBeGreaterThanOrEqual(30);
    // Every word sits in a named category, once, and each list reads A to Z.
    const groups = termGroups();
    expect(groups.some((g) => g.name === 'Other')).toBe(false);
    expect(groups.flatMap((g) => g.terms.map(([t]) => t)).sort()).toEqual(Object.keys(TERMS).sort());
    for (const g of groups) {
      const names = g.terms.map(([t]) => t);
      expect(names, g.name).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
    }
  });
});

describe('Kreators Run', () => {
  it('opens the start code thirty minutes before and closes three hours after', () => {
    const start = '2026-10-25T06:00:00.000Z';
    const end = '2026-10-25T07:00:00.000Z';
    expect(runEntryState(start, end, new Date('2026-10-25T05:29:00Z'))).toBe('early');
    expect(runEntryState(start, end, new Date('2026-10-25T05:31:00Z'))).toBe('open');
    expect(runEntryState(start, end, new Date('2026-10-25T09:59:00Z'))).toBe('open');
    expect(runEntryState(start, end, new Date('2026-10-25T10:01:00Z'))).toBe('closed');
  });
  it('labels distance and pace in plain words', () => {
    expect(kmLabel(5000)).toBe('5 km');
    expect(kmLabel(7550)).toBe('7.6 km');
    expect(paceLabel(5000, 30)).toBe('6:00 /km');
    expect(paceLabel(10000, 55)).toBe('5:30 /km');
    expect(paceLabel(0, 30)).toBeNull();
  });
  it('counts weeks in a row with a run, letting last week hold this one open', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekStreak([], '2026-10-25')).toBe(0);
    expect(weekStreak(['2026-10-25'], '2026-10-25')).toBe(1);
    expect(weekStreak(['2026-10-05', '2026-10-14', '2026-10-25'], '2026-10-25')).toBe(3);
    expect(weekStreak(['2026-10-05', '2026-10-14'], '2026-10-25')).toBe(2);
    expect(weekStreak(['2026-09-28', '2026-10-14'], '2026-10-25')).toBe(1);
    expect(weekStreak(['2026-10-05'], '2026-10-25')).toBe(0);
  });
  it('has a badge for every run milestone and a how-to under Connection', () => {
    for (const key of Object.keys(RUN_BADGES)) expect(ALL_BADGES.some((b) => b.key === key), key).toBe(true);
    const run = MODS.find((m) => m.key === 'run');
    expect(run?.group).toBe('community');
    expect(run?.defaultOn).toBe(false);
    expect(HOW_TO.run?.terms).toContain('start code');
  });
});

describe('sign-up', () => {
  it('counts whole years and turns away anyone under eighteen', () => {
    expect(MIN_AGE).toBe(18);
    expect(ageOn('2008-10-26', '2026-10-26')).toBe(18);
    expect(ageOn('2008-10-27', '2026-10-26')).toBe(17);
    expect(birthDateProblem('2008-10-27', '2026-10-26')).toMatch(/18/);
    expect(birthDateProblem('2008-10-26', '2026-10-26')).toBeNull();
    expect(birthDateProblem('1990-05-20', '2026-10-26')).toBeNull();
    expect(birthDateProblem('', '2026-10-26')).toBeTruthy();
    expect(birthDateProblem('2027-01-01', '2026-10-26')).toMatch(/not happened/);
    expect(birthDateProblem('1890-01-01', '2026-10-26')).toMatch(/not look right/);
  });
  it('keeps a phone as digits with its plus and refuses anything too short or too long', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('+919876543210');
    expect(phoneProblem('+91 98765 43210')).toBeNull();
    expect(phoneProblem('9876543210')).toBeNull();
    expect(phoneProblem('12')).toBeTruthy();
    expect(phoneProblem('+1 234 567 890 123 456')).toBeTruthy();
    expect(phoneProblem('call me')).toBeTruthy();
  });
});

describe('content strategist', () => {
  it('knows what kind of link it was handed, and leaves competitor to the owner', () => {
    expect(sourceKindOf('https://www.youtube.com/@someone')).toBe('youtube');
    expect(sourceKindOf('https://youtu.be/abc')).toBe('youtube');
    expect(sourceKindOf('https://www.instagram.com/someone/')).toBe('instagram');
    expect(sourceKindOf('https://x.com/someone')).toBe('x');
    expect(sourceKindOf('https://www.reddit.com/r/videography/')).toBe('reddit');
    expect(sourceKindOf('https://someone.substack.com/p/hooks')).toBe('article');
    expect(sourceKindOf('https://example.com')).toBe('site');
    expect(BRAND_SOURCE_KINDS).toContain('competitor');
  });
  it('has words for every kind of source, research and piece', () => {
    for (const k of BRAND_SOURCE_KINDS) expect(BRAND_SOURCE_META[k].name).toBeTruthy();
    for (const k of RESEARCH_KINDS) expect(RESEARCH_META[k].blurb.length).toBeGreaterThan(10);
    for (const k of PIECE_KINDS) expect(PIECE_META[k].askFor.length).toBeGreaterThan(10);
  });
});

describe('strategy session', () => {
  const P = (relationship: Placement['relationship'], core: number, floor: number, evidence = ''): Placement => ({ relationship, core, floor, evidence });
  it('applies the placement rules: required under Courage, volatile over a 150 gap, capped without evidence', () => {
    expect(placementFlags(P('self', 350, 100))).toMatchObject({ required: true, volatile: true, capped: false });
    expect(placementFlags(P('self', 310, 250))).toMatchObject({ required: false, volatile: false });
    expect(placementFlags(P('self', 440, 200))).toMatchObject({ core: 350, capped: true });
    expect(placementFlags(P('self', 440, 200, 'I taught two friends to edit for free last Tuesday.'))).toMatchObject({ core: 440, capped: false });
    expect(placementFlags(P('self', 200, 350)).floor).toBe(200);
    expect(MAP_LEVELS.length).toBe(16);
    for (const r of Object.keys(BAND_STATEMENTS)) expect(Object.keys(BAND_STATEMENTS[r as Placement['relationship']]).length).toBe(3);
  });
  it('picks up to two focus pillars, floors under Courage first, then the lowest cores weighted by insecurity', () => {
    const all: Placement[] = [P('self', 310, 250), P('lover_partner', 350, 100), P('friendship', 250, 200), P('parent_child', 310, 310), P('servant_leader', 200, 75), P('guru', 350, 350), P('divine', 400, 310, 'daily practice, logged')];
    expect(pickFocus(all, [])).toEqual(['servant_leader', 'lover_partner']);
    const one: Placement[] = all.map((p) => (p.relationship === 'servant_leader' ? P('servant_leader', 310, 250) : p));
    expect(pickFocus(one, [])[0]).toBe('lover_partner');
    // guru at 350 less a weight of 9 is 260, still above friendship at 250; two heavy worries pull it under.
    expect(pickFocus(one, [{ text: 'awkward', weight: 9, relationship: 'guru' }])).toEqual(['lover_partner', 'friendship']);
    expect(pickFocus(one, [{ text: 'awkward', weight: 9, relationship: 'guru' }, { text: 'no mentor', weight: 6, relationship: 'guru' }])).toEqual(['lover_partner', 'guru']);
  });
  it('ramps the day thirty minutes a week and never past the target', () => {
    expect(rampTime('08:30', '06:30', 0, 'earlier')).toBe('08:30');
    expect(rampTime('08:30', '06:30', 2, 'earlier')).toBe('07:30');
    expect(rampTime('08:30', '06:30', 9, 'earlier')).toBe('06:30');
    expect(rampTime('00:30', '23:30', 1, 'earlier')).toBe('00:00');
    expect(rampTime('00:30', '23:30', 5, 'earlier')).toBe('23:30');
  });
  it('builds six blocks from the real day, with a short morning on an exceptional day', () => {
    const r = routineFor({ wake: '09:00', sleep: '01:00', workStart: '10:00', workEnd: '18:00', evening: '', gym: '' }, 0, ['friendship'], [P('friendship', 310, 100)]);
    expect(r.general.map((b) => b.key)).toEqual(['morning', 'nutrition', 'work', 'social', 'skills', 'sleep']);
    expect(r.general[0]?.start).toBe('09:00');
    expect(r.general[0]?.steps.length).toBe(5);
    expect(r.general[3]?.note).toMatch(/scary thing/);
    expect(r.exceptional[0]?.steps.length).toBe(3);
  });
  it('settles a high score over a low floor with the behaviour answer', () => {
    expect(settleScore(9, 100, 2)).toBe(6);
    expect(settleScore(9, 100, 5)).toBe(9);
    expect(settleScore(9, 250, 0)).toBe(9);
    expect(settleScore(5, 100, 0)).toBe(5);
  });
});

import { cleanIdentity, goalsFor, IDENTITIES, identityLine, matchSetup, parseIdentities, parseSetup, readAbout, SETUP_APP_LINES, SETUP_APPS_MAX, SETUP_APPS_MIN, SETUP_BLOCKER_GROUPS, SETUP_BLOCKERS, SETUP_COMBOS, SETUP_GOAL_GROUPS, SETUP_GOALS, SETUP_ROLE_GROUPS, setupSwitchable } from './index';

describe('setup', () => {
  it('only names apps, tags, goals and blockers that exist', () => {
    const switchable = new Set(MODS.filter(setupSwitchable).map((m) => m.key));
    const keys = [...IDENTITIES.map((i) => i.key), ...SETUP_GOALS.map((g) => g.key), ...SETUP_BLOCKERS.map((b) => b.key)];
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z_]+$/);
    for (const x of [...IDENTITIES, ...SETUP_GOALS, ...SETUP_BLOCKERS, ...SETUP_COMBOS]) for (const app of Object.keys(x.apps)) expect(switchable.has(app), app).toBe(true);
    for (const c of SETUP_COMBOS) for (const k of c.when) expect(keys, k).toContain(k);
    for (const i of IDENTITIES) if (i.interest) expect(INTERESTS).toContain(i.interest);
    expect(switchable.has('today')).toBe(false);
    expect(switchable.has('notifications')).toBe(false);
    expect(switchable.has('admin')).toBe(false);
  });

  it('matches apps from the whole combination, each with a reason', () => {
    const editor = matchSetup({ identities: ['student', 'freelancer', 'editor'], goals: ['learn', 'work'], blockers: [] });
    expect(editor.apps.map((a) => a.key).slice(0, 2).sort()).toEqual(['school', 'work']);
    expect(editor.apps.find((a) => a.key === 'school')?.why).toBe('Because you edit and want to get better at it.');
    for (const a of editor.apps) expect(a.why).toMatch(/^Because .+\.$/);
    const creator = matchSetup({ identities: ['creator', 'short_video', 'starting'], goals: ['earn', 'grow'], blockers: ['focus'] });
    // Just starting brings School in: the stage is an answer too, so it brings its own app.
    expect(creator.apps.map((a) => a.key)).toEqual(['win', 'army', 'content', 'school']);
    expect(creator.cap).toBe(4);
    const parent = matchSetup({ identities: ['parent'], goals: ['health'], blockers: ['time'] });
    expect(parent.apps.length).toBeLessThanOrEqual(3);
    expect(parent.apps.map((a) => a.key)).toContain('sleep');
    expect(parent.apps.map((a) => a.key)).not.toContain('work');
    // Only apps the person can have: a switched-off app is never offered.
    expect(matchSetup({ identities: ['creator'], goals: ['earn'], blockers: [] }, ['army', 'work', 'school', 'journal']).apps.map((a) => a.key)).not.toContain('win');
  });

  it('gives every role and goal pair its own result, never too many apps or too few', () => {
    const full = new Set<string>();
    const sets = new Set<string>();
    let pairs = 0;
    for (const r of IDENTITIES.filter((i) => i.kind === 'role')) {
      for (const g of SETUP_GOALS) {
        const m = matchSetup({ identities: [r.key], goals: [g.key], blockers: [] });
        expect(m.apps.length).toBeGreaterThanOrEqual(SETUP_APPS_MIN);
        expect(m.apps.length).toBeLessThanOrEqual(SETUP_APPS_MAX);
        full.add(JSON.stringify([m.line, m.apps]));
        sets.add(m.apps.map((a) => a.key).sort().join());
        pairs += 1;
      }
    }
    expect(full.size).toBe(pairs);
    expect(sets.size / pairs).toBeGreaterThan(0.9);
  });

  it('keeps things light when time or focus is short, and offers the strategy session when asked for', () => {
    const busy = matchSetup({ identities: ['founder', 'creator'], goals: ['sell', 'grow', 'money'], blockers: ['time'] });
    expect(busy.cap).toBe(3);
    expect(busy.apps.length).toBe(3);
    expect(busy.more.length).toBeGreaterThan(0);
    expect(matchSetup({ identities: [], goals: ['life'], blockers: [] }).session).toBe('now');
    expect(matchSetup({ identities: [], goals: ['health'], blockers: ['energy'] }).session).toBe('soon');
    expect(matchSetup({ identities: ['creator'], goals: ['earn'], blockers: [] }).session).toBe('later');
  });

  it('fills the profile from the tags', () => {
    const m = matchSetup({ identities: ['student', 'freelancer', 'editor', 'runner'], goals: ['work'], blockers: [] });
    expect(m.profile.focus).toBe('Study');
    expect(m.profile.skills).toEqual(['Editing']);
    expect(m.profile.interests).toEqual(['Video', 'Running']);
    expect(m.profile.availability).toBe('Open to work');
    expect(m.profile.goals).toEqual(['Find paid work']);
  });

  it('says who you are in one line', () => {
    expect(identityLine({ identities: ['student', 'freelancer', 'editor'], goals: ['learn', 'work'], blockers: [] })).toBe('A student and freelance video editor, here to learn a skill and find paid work.');
    expect(identityLine({ identities: ['creator', 'short_video', 'starting'], goals: ['earn'], blockers: [] })).toBe('A short-form creator, just starting, here to earn from what you make.');
    expect(identityLine({ identities: ['explorer', 'Dancer'], goals: [], blockers: [] })).toBe('An explorer and dancer.');
    expect(identityLine({ identities: [], goals: ['money'], blockers: [] })).toBe('Here to sort out your money.');
  });

  it('reads tags from your own words, and makes your own tag when none fits', () => {
    const r = readAbout("Final year student. I edit reels for a few clients and want to earn more. Always tired, ADHD. I'm a dancer too.");
    expect(r.identities).toEqual(expect.arrayContaining(['student', 'freelancer', 'short_video', 'editor']));
    expect(r.goals).toContain('earn');
    expect(r.blockers).toEqual(expect.arrayContaining(['energy', 'focus']));
    expect(r.custom).toEqual(['Dancer']);
    expect(readAbout('I am a final year student').custom).toEqual([]);
    expect(readAbout("I'm a bit lazy").custom).toEqual([]);
    expect(readAbout('I am a software engineer at a bank').custom).toEqual(['Software engineer']);
    expect(readAbout('I want to add a business model').identities).toEqual([]);
    const brand = readAbout('I run a small skincare brand and want to sell more online. No time.');
    expect(brand.identities).toEqual(['founder']);
    expect(brand.goals).toEqual(['sell']);
    expect(brand.blockers).toEqual(['time']);
  });

  it('cleans tags: known keys, your own words, three of those at most, one stage', () => {
    expect(cleanIdentity('student')).toBe('student');
    expect(cleanIdentity('  video   editor ')).toBe('editor');
    expect(cleanIdentity('chef!!')).toBe('Chef');
    expect(cleanIdentity('!!')).toBeNull();
    expect(cleanIdentity(42)).toBeNull();
    expect(parseIdentities(['student', 'Chef', 'Dancer', 'Potter', 'Baker', 'student'])).toEqual(['student', 'Chef', 'Dancer', 'Potter']);
    expect(parseIdentities(['starting', 'earning'])).toEqual(['earning']);
    expect(parseSetup({ goals: ['learn', 'nope', 'work', 'earn', 'grow'], blockers: ['time', 'x'] })).toEqual({ identities: [], goals: ['learn', 'work', 'earn'], blockers: ['time'] });
  });

  it('groups every choice exactly once, and says every app in plain words', () => {
    const once = (groups: readonly { keys: readonly string[] }[], keys: string[]) => expect(groups.flatMap((g) => g.keys).sort()).toEqual([...keys].sort());
    once(SETUP_GOAL_GROUPS, SETUP_GOALS.map((g) => g.key));
    once(SETUP_ROLE_GROUPS, IDENTITIES.filter((i) => i.kind === 'role').map((i) => i.key));
    once(SETUP_BLOCKER_GROUPS, SETUP_BLOCKERS.map((b) => b.key));
    for (const m of MODS.filter(setupSwitchable)) expect(SETUP_APP_LINES[m.key], m.key).toBeTruthy();
  });

  it('puts the goals that fit your tags first', () => {
    expect(goalsFor(['student'])[0]?.key).toBe('learn');
    expect(['grow', 'sell']).toContain(goalsFor(['founder'])[0]?.key);
    expect(goalsFor([]).map((g) => g.key)).toEqual(SETUP_GOALS.map((g) => g.key));
  });
});

describe('the session in words and stars', () => {
  it('says a mantra in words: a known name, your own words in quotes, or none yet', () => {
    expect(mantraLine({ mantra: 'hare_krishna' })).toBe('Hare Krishna');
    expect(mantraLine({ mantra: 'own', ownMantra: '  Slow is smooth ' })).toBe('“Slow is smooth”');
    expect(mantraLine({ mantra: 'own', ownMantra: '' })).toBe('No mantra yet');
    expect(mantraLine({ mantra: 'none' })).toBe('No mantra yet');
  });
  it('weighs an insecurity in words, and reads older numbers as the nearest word', () => {
    expect(INSECURITY_WEIGHTS.map((w) => weightWord(w.weight))).toEqual(INSECURITY_WEIGHTS.map((w) => w.name));
    expect(weightWord(9)).toBe('A lot');
    expect(weightWord(0)).toBe('A little');
  });
  it('turns stars into a score out of ten and back, two points a star, so the score rules hold', () => {
    expect([1, 2, 3, 4, 5].map(scoreOfStars)).toEqual([2, 4, 6, 8, 10]);
    expect([0, 3, 6, 7, 10].map(starsOf)).toEqual([0, 2, 3, 4, 5]);
    expect(STAR_WORDS).toHaveLength(5);
    // Four stars is a score of 8: a high score over a floor under Courage still gets its behaviour question.
    expect(settleScore(scoreOfStars(4), 100, 2)).toBe(6);
  });
  it('names Bumling with its role, like the seven', () => {
    expect(characterTitle('bumling')).toBe('Bumling, guide to the app');
    expect(characterHello('bumling')).toBe('Bumling here, your guide to the app.');
    expect(characterTitle('self')).toBe('Dew, guide to yourself');
  });
});

describe('editing the routine', () => {
  const day = { wake: '07:00', sleep: '23:30', workStart: '10:00', workEnd: '18:00', evening: '', gym: '' };
  const built = routineFor(day, 0, [], []);
  it('counts how long a block runs, wrapping past midnight, and what the steps add up to', () => {
    const morning = built.general.find((b) => b.key === 'morning')!;
    expect(blockMinutes(morning)).toBe(60);
    expect(blockMinutes(built.general.find((b) => b.key === 'sleep')!)).toBe(450);
    expect(stepsMinutes(morning)).toBe(30);
    expect([45, 60, 90].map(minutesLabel)).toEqual(['45 min', '1 hr', '1 hr 30 min']);
  });
  it('keeps the six blocks in order, checks the times, and keeps steps only in the morning', () => {
    const edited = parseRoutineBlocks(
      [
        { key: 'morning', start: '06:45', end: '25:00', steps: ['  Water  ', 'Water', 'Stretch', ''], minutes: [2, 9, 500], note: 'x' },
        { key: 'work', start: '09:00', end: '17:30', steps: ['Not here'], note: 'Deep work first' },
      ],
      built.general,
    );
    expect(edited.map((b) => b.key)).toEqual(built.general.map((b) => b.key));
    const morning = edited.find((b) => b.key === 'morning')!;
    expect([morning.start, morning.end]).toEqual(['06:45', built.general[0]!.end]);
    expect(morning.steps).toEqual(['Water', 'Stretch']);
    expect(morning.minutes).toEqual([2, 120]);
    const work = edited.find((b) => b.key === 'work')!;
    expect([work.start, work.end, work.note, work.steps.length]).toEqual(['09:00', '17:30', 'Deep work first', 0]);
    expect(edited.find((b) => b.key === 'social')).toEqual(built.general.find((b) => b.key === 'social'));
  });
  it('never leaves the morning without a step, so the day can still be done', () => {
    const edited = parseRoutineBlocks([{ key: 'morning', steps: [] }], built.general);
    expect(edited.find((b) => b.key === 'morning')!.steps).toEqual(built.general[0]!.steps);
  });
});

describe('assistant credits', () => {
  it('prices the three plans as agreed: Pro $15 for $10 of use, Pro Max $125 for $100, Ultra $500 for $400', () => {
    expect(PAID_PLANS).toEqual(['pro', 'pro_max', 'ultra']);
    // One credit is a tenth of a US cent, so a dollar of model use is a thousand credits.
    expect([PLANS.pro.priceCents, PLANS.pro.credits]).toEqual([1_500, 10_000]);
    expect([PLANS.pro_max.priceCents, PLANS.pro_max.credits]).toEqual([12_500, 100_000]);
    expect([PLANS.ultra.priceCents, PLANS.ultra.credits]).toEqual([50_000, 400_000]);
    for (const k of PAID_PLANS) expect(PLANS[k].priceCents).toBeGreaterThan(PLANS[k].credits / 10);
    expect(isPaidPlan('none')).toBe(false);
    expect(isPaidPlan('pro_max')).toBe(true);
  });
  it('gives every plan a limit for every agent, growing with the plan', () => {
    for (const a of AGENTS) {
      const [pro, max, ultra] = PAID_PLANS.map((k) => AGENT_LIMITS[k][a]);
      expect(pro!.contextTokens).toBeLessThan(max!.contextTokens);
      expect(max!.contextTokens).toBeLessThan(ultra!.contextTokens);
      expect(pro!.perMessage).toBeLessThan(pro!.perDay);
      for (const k of PAID_PLANS) expect(AGENT_LIMITS[k][a].perDay).toBeLessThanOrEqual(PLANS[k].credits);
    }
    // Top-ups never sell credits cheaper than the biggest plan does.
    for (const t of TOPUP_PACKS) expect(t.priceCents / t.credits).toBeGreaterThanOrEqual(PLANS.ultra.priceCents / PLANS.ultra.credits);
  });
  it('turns tokens into whole credits, rounding up, with no float in between', () => {
    const kimi = MODEL_PRICES['moonshotai/kimi-k2.6']!;
    // 20,000 tokens in at $0.5415 a million is 1.083 cents; 500 out at $2.28 a million is 0.114 cents: 11.97 credits.
    expect(creditsFor({ input: 20_000, output: 500 }, kimi)).toBe(12);
    expect(creditsFor({ input: 0, output: 0 }, kimi)).toBe(0);
    expect(creditsFor({ input: 1, output: 0 }, kimi)).toBe(1);
    // Exactly a dollar of the fallback price is exactly a thousand credits.
    expect(creditsFor({ input: 1_000_000 / 3, output: 0 }, FALLBACK_PRICE)).toBe(1_000);
    expect(microsFrom('0.5415')).toBe(541_500);
    expect(microsFrom('3')).toBe(3_000_000);
    expect(microsFrom('1.2345678')).toBeNull();
    expect(messagesFor(10_000)).toBe(833);
  });
  it('charges nothing for free models and the fallback for an unknown one', () => {
    expect(creditsFor({ input: 50_000, output: 4_000 }, priceOf('nvidia/nemotron-3-ultra-550b-a55b:free'))).toBe(0);
    expect(priceOf('moonshotai/kimi-k2.6')).toEqual(MODEL_PRICES['moonshotai/kimi-k2.6']);
    expect(priceOf('someone/unknown-model')).toEqual(FALLBACK_PRICE);
    expect(ASSISTANT_MODELS.every((m) => m.id.endsWith(':free'))).toBe(true);
    expect(new Set(ASSISTANT_MODELS.map((m) => m.id)).size).toBe(ASSISTANT_MODELS.length);
  });
  it('reads amounts as text into whole cents', () => {
    expect(centsFrom('12.50')).toBe(1250);
    expect(centsFrom(12.5)).toBe(1250);
    expect(centsFrom('400')).toBe(40_000);
    expect(centsFrom('0')).toBeNull();
    expect(centsFrom('12.345')).toBeNull();
  });
  it('spends plan credits first, then extra ones, and never more than there is', () => {
    expect(spendSplit(30, 100, 50)).toEqual({ plan: 30, extra: 0 });
    expect(spendSplit(130, 100, 50)).toEqual({ plan: 100, extra: 30 });
    expect(spendSplit(500, 100, 50)).toEqual({ plan: 100, extra: 50 });
    expect(spendSplit(10, 0, 0)).toEqual({ plan: 0, extra: 0 });
  });
});


import { badgeRoleOf, BADGE_META, COACH_SHARE_PARTS, DEFAULT_COACH_SHARE, isStaffFor, parseCoachShare } from './index';
import { attendeeXpLocked, codeWindow } from './index';

describe('life coaches', () => {
  it('lets a creator hold Life coach and Mentor, never the staff jobs, and never gives Life coach without asking', () => {
    const creator = { role: 'user' as const, permissions: ['coach', 'talent'] };
    expect(isStaffFor(creator, 'coach')).toBe(true);
    expect(isStaffFor(creator, 'talent')).toBe(false);
    expect(isStaffFor({ role: 'user', permissions: ['mentor'] }, 'mentor')).toBe(true);
    const admin = { role: 'admin' as const, permissions: [] };
    expect(isStaffFor(admin, 'talent')).toBe(true);
    expect(isStaffFor(admin, 'coach')).toBe(false);
    expect(isStaffFor({ role: 'admin', permissions: ['coach'] }, 'coach')).toBe(true);
  });

  it('names the badge Life coach for a creator who coaches; staff and admins keep their own', () => {
    expect(badgeRoleOf({ role: 'user', permissions: ['coach'] })).toBe('coach');
    expect(BADGE_META[badgeRoleOf({ role: 'user', permissions: ['coach'] })].name).toBe('Life coach');
    expect(badgeRoleOf({ role: 'user', permissions: [] })).toBe('user');
    expect(badgeRoleOf({ role: 'sub_admin', permissions: ['coach'] })).toBe('sub_admin');
  });

  it('reads what a student shares over the defaults, and keeps the journal out of every part', () => {
    expect(parseCoachShare('{}')).toEqual(DEFAULT_COACH_SHARE);
    expect(parseCoachShare('{"reflection":false,"journal":true}')).toEqual({ ...DEFAULT_COACH_SHARE, reflection: false });
    expect(parseCoachShare('not json')).toEqual(DEFAULT_COACH_SHARE);
    expect(COACH_SHARE_PARTS as readonly string[]).not.toContain('journal');
  });

  it('tells a life coach from someone who wants one, in the setup chat', () => {
    expect(readAbout("I'm a life coach for creators").identities).toContain('coach');
    expect(readAbout("I'm a life coach for creators").goals).not.toContain('find_coach');
    expect(readAbout('I need a coach to keep me on track').goals).toContain('find_coach');
    expect(readAbout('I need a coach to keep me on track').identities).not.toContain('coach');
    expect(matchSetup({ identities: ['coach'], goals: ['sell'], blockers: [] }).apps.map((a) => a.key)).toContain('coaching');
    expect(matchSetup({ identities: ['student'], goals: ['find_coach'], blockers: [] }).apps.map((a) => a.key)).toContain('coaching');
  });
});

describe('attendee codes', () => {
  it('fixes the xp when the code opens, thirty minutes before the start', () => {
    const start = '2026-11-01T10:00:00.000Z';
    expect(attendeeXpLocked(start, Date.parse('2026-11-01T09:29:00.000Z'))).toBe(false);
    expect(attendeeXpLocked(start, Date.parse('2026-11-01T09:30:00.000Z'))).toBe(true);
    expect(codeWindow(start, '2026-11-01T11:00:00.000Z')).toEqual({ opensAt: '2026-11-01T09:30:00.000Z', closesAt: '2026-11-01T14:00:00.000Z' });
  });
});

import { briefFor, gettingStarted, GETTING_STARTED, mentionsIn, previousSeason, seasonLabel, type BriefFacts } from './index';

describe('engagement', () => {
  const facts: BriefFacts = { hour: 20, checkedIn: false, streak: 12, bestStreak: 12, level: 4, xpToNext: 80, tasksDue: 2, tasksOverdue: 1, doneWeek: 3, doneWeekBefore: 8, smallActDone: false, notToDoSlipped: 0, routineWeek: null, contractDays: null, sleepAvg: 6, sleepAvgBefore: 7.2, moodAvg: null, moodAvgBefore: null, stressAvg: null, nextEvent: null, coachNotes: 0, coachAsks: 0, reviewDue: false, apps: ['sleep'] };
  it('briefs three signals and three steps, the most pressing first, never to an app that is off', () => {
    const b = briefFor(facts);
    expect(b.signals.map((x) => x.key)).toEqual(['streak-risk', 'overdue', 'sleep']);
    expect(b.actions.map((x) => x.key)).toEqual(['checkin', 'task', 'act']);
    const calm = briefFor({ ...facts, apps: [], checkedIn: true, tasksDue: 0, smallActDone: true, tasksOverdue: 0, sleepAvg: 6, sleepAvgBefore: 7.2 });
    expect(calm.actions.every((a) => a.to !== '/sleep' && a.to !== '/journal')).toBe(true);
    expect(calm.signals.find((x) => x.key === 'sleep')?.to).toBeNull();
  });
  it('ticks the checklist from what was done, and folds it away when done, folded or old', () => {
    expect(gettingStarted({ checkin: true }, 2, false)).toMatchObject({ done: 1, show: true });
    expect(gettingStarted({ checkin: true }, 20, false).show).toBe(false);
    expect(gettingStarted({ checkin: true }, 2, true).show).toBe(false);
    expect(gettingStarted(Object.fromEntries(GETTING_STARTED.map((g) => [g.key, true])), 2, false).show).toBe(false);
  });
  it('reads mentions as page names, each once, five at most, never an email', () => {
    expect(mentionsIn('Thanks @Asha_R and @asha_r, see @kiran. Mail me at a@b.co')).toEqual(['asha_r', 'kiran']);
    expect(mentionsIn('@a1b @a2b @a3b @a4b @a5b @a6b').length).toBe(5);
  });
  it('counts seasons by calendar month', () => {
    expect(previousSeason('2026-01')).toBe('2025-12');
    expect(seasonLabel('2026-10')).toBe('October 2026');
  });
});
