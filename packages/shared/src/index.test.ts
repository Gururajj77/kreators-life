import { BADGES as ALL_BADGES, HOW_TO, kmLabel, MODULES as MODS, paceLabel, RUN_BADGES, runEntryState, TERMS, weekStart, weekStreak } from './index';
import { earningGuide, nextBadge, unlockFor } from './index';
import { ageOn, birthDateProblem, MIN_AGE, normalizePhone, phoneProblem } from './index';
import { BRAND_SOURCE_KINDS, BRAND_SOURCE_META, PIECE_KINDS, PIECE_META, RESEARCH_KINDS, RESEARCH_META, sourceKindOf } from './index';
import { BAND_STATEMENTS, MAP_LEVELS, pickFocus, placementFlags, rampTime, routineFor, settleScore } from './index';
import type { Placement } from './index';
import { SOCIAL_REWARDS, trustScore } from './index';
import { FEATURE_FEE_POINTS, isFeatured, parseImageUrls, STORE_STAGE_META, PREOWNED_CONDITION_META } from './index';
import { builtInTemplate, parseReviewPrompts, periodDays, periodFor, periodLabel, periodShift } from './index';
import { MAX_NOT_TO_DO, notToDoStreak, notToDoWeek, shiftDay } from './index';
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
