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
    expect(nudgeFor({ ...base, checkedIn: true, sparkDone: true, hasFloor: false, xpToday: 25 })).toMatchObject({ action: 'Set up an area', path: '/tower' });
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
