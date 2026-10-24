import { describe, expect, it } from 'vitest';
import { bountyPayout, dressCodeFor, feeBps, greetingFor, nextWeek, matchCircles, matchScore, money, nudgeFor, rolloutBucket, slotsFor, timeLabel, zonedToUtc } from './index';

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
    expect(matchScore(['On camera'], ['Behind camera'])).toBe(2);
    expect(matchScore(['Food', 'Gaming'], ['Food'])).toBe(1);
    expect(matchScore(['Writing', 'Video'], ['Writing'])).toBe(3);
    expect(matchScore(['Fashion'], ['Gaming'])).toBe(-1);
  });
  it('seats people at tables of the asked size and never more than twenty km apart', () => {
    const near = (id: string, interests: string[], lat = 12.97, lng = 77.6, joinedAt = '2026-10-01') => ({ id, interests, area: '', lat, lng, joinedAt });
    const r = matchCircles([near('a', ['On camera']), near('b', ['Behind camera']), near('c', ['Writing']), near('d', ['Video']), near('far', ['Editing'], 13.5, 78.5)], 4);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toHaveLength(4);
    expect(r.unmatched).toEqual(['far']);
  });
  it('reports fewer than three people as unmatched rather than a table', () => {
    const c = (id: string) => ({ id, interests: ['Music'], area: '', lat: null, lng: null, joinedAt: '2026-10-01' });
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
    expect(nudgeFor({ ...base, checkedIn: true, xpToday: 10 })).toMatchObject({ lead: '+10 xp banked from the check-in.', action: 'Do the spark' });
    expect(nudgeFor({ ...base, checkedIn: true, sparkDone: true, xpToday: 25 })).toMatchObject({ action: 'Tick a task', path: '/today' });
    expect(nudgeFor({ ...base, checkedIn: true, sparkDone: true, taskDone: true, xpToday: 45 }).lead).toBe('All three done. +45 xp today.');
  });
  it('says what it will not work without', () => {
    expect(nudgeFor({ ...base, checkedIn: true, sparkDone: true, hasFloor: false, xpToday: 25 })).toMatchObject({ action: 'Build a floor', path: '/tower' });
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
