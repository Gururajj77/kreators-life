import { describe, expect, it } from 'vitest';
import { DATE_FORMATS, DATE_PREFS_DEFAULT, datePrefsProblem, formatClock, formatDate, formatMinute, formatStamp, parseDatePrefs, TIME_FORMATS, type DatePrefs } from './index';

const IST = 'Asia/Kolkata';
/** The founder's example: 4:17 in the morning on 7 Nov 2026 in India. */
const FOUNDERS = '2026-11-06T22:47:00.000Z';
const with24: DatePrefs = { date: 'd_mon_yy', time: '24h' };

describe('parseDatePrefs', () => {
  it('reads an object or the stored JSON', () => {
    expect(parseDatePrefs({ date: 'yyyy_mm_dd', time: '24h' })).toEqual({ date: 'yyyy_mm_dd', time: '24h' });
    expect(parseDatePrefs('{"date":"dd_mm_yy","time":"12h"}')).toEqual({ date: 'dd_mm_yy', time: '12h' });
  });
  it('falls back to the founder\'s format, part by part', () => {
    for (const bad of [null, undefined, '', 'nope', '[]', 7, []]) expect(parseDatePrefs(bad)).toEqual(DATE_PREFS_DEFAULT);
    expect(parseDatePrefs({ date: 'constructor', time: '24h' })).toEqual({ date: DATE_PREFS_DEFAULT.date, time: '24h' });
    expect(parseDatePrefs({ date: 'd_mon_yyyy', time: 'noon' })).toEqual({ date: 'd_mon_yyyy', time: DATE_PREFS_DEFAULT.time });
  });
});

describe('datePrefsProblem', () => {
  it('passes every choice and a part on its own', () => {
    for (const date of DATE_FORMATS) for (const time of TIME_FORMATS) expect(datePrefsProblem({ date, time })).toBeNull();
    expect(datePrefsProblem({ time: '24h' })).toBeNull();
  });
  it('refuses anything else', () => {
    expect(datePrefsProblem('24h')).not.toBeNull();
    expect(datePrefsProblem(null)).not.toBeNull();
    expect(datePrefsProblem([])).not.toBeNull();
    expect(datePrefsProblem({ date: 'mm/dd/yy' })).toMatch(/date format/);
    expect(datePrefsProblem({ time: 'toString' })).toMatch(/time format/);
  });
});

describe('formatting a moment', () => {
  it('reads the founder\'s example exactly', () => {
    expect(formatStamp(FOUNDERS, DATE_PREFS_DEFAULT, IST)).toBe('7 Nov 26, 4:17am');
    expect(formatStamp(new Date(FOUNDERS), DATE_PREFS_DEFAULT, IST)).toBe('7 Nov 26, 4:17am');
  });
  it('has the four date formats', () => {
    expect(formatDate(FOUNDERS, { ...DATE_PREFS_DEFAULT, date: 'd_mon_yy' }, IST)).toBe('7 Nov 26');
    expect(formatDate(FOUNDERS, { ...DATE_PREFS_DEFAULT, date: 'd_mon_yyyy' }, IST)).toBe('7 Nov 2026');
    expect(formatDate(FOUNDERS, { ...DATE_PREFS_DEFAULT, date: 'dd_mm_yy' }, IST)).toBe('07/11/26');
    expect(formatDate(FOUNDERS, { ...DATE_PREFS_DEFAULT, date: 'yyyy_mm_dd' }, IST)).toBe('2026-11-07');
    expect(DATE_FORMATS).toHaveLength(4);
  });
  it('reads midnight and noon on both clocks', () => {
    const midnight = '2026-11-06T18:30:00.000Z';
    const noon = '2026-11-07T06:30:00.000Z';
    expect(formatClock(midnight, DATE_PREFS_DEFAULT, IST)).toBe('12:00am');
    expect(formatClock(noon, DATE_PREFS_DEFAULT, IST)).toBe('12:00pm');
    expect(formatClock(midnight, with24, IST)).toBe('00:00');
    expect(formatClock(noon, with24, IST)).toBe('12:00');
    expect(formatStamp(midnight, DATE_PREFS_DEFAULT, IST)).toBe('7 Nov 26, 12:00am');
  });
  it('reads a 24-hour clock', () => {
    expect(formatClock('2026-11-07T10:47:00.000Z', with24, IST)).toBe('16:17');
    expect(formatClock(FOUNDERS, with24, IST)).toBe('04:17');
    expect(formatStamp('2026-11-07T10:47:00.000Z', with24, IST)).toBe('7 Nov 26, 16:17');
    expect(formatClock('2026-11-07T10:47:05.000Z', with24, IST, true)).toBe('16:17:05');
    expect(formatClock('2026-11-07T10:47:05.000Z', DATE_PREFS_DEFAULT, IST, true)).toBe('4:17:05pm');
  });
  it('lands on the zone\'s own day across the date line', () => {
    const at = '2026-11-07T10:30:00.000Z';
    expect(formatStamp(at, DATE_PREFS_DEFAULT, 'Pacific/Auckland')).toBe('7 Nov 26, 11:30pm');
    expect(formatStamp(at, DATE_PREFS_DEFAULT, 'Pacific/Kiritimati')).toBe('8 Nov 26, 12:30am');
    expect(formatStamp(at, DATE_PREFS_DEFAULT, 'Pacific/Pago_Pago')).toBe('6 Nov 26, 11:30pm');
    expect(formatStamp(at, DATE_PREFS_DEFAULT, 'UTC')).toBe('7 Nov 26, 10:30am');
  });
  it('rolls over the new year in a zone ahead', () => {
    expect(formatDate('2026-12-31T20:00:00.000Z', { ...DATE_PREFS_DEFAULT, date: 'yyyy_mm_dd' }, IST)).toBe('2027-01-01');
    expect(formatDate('2026-12-31T20:00:00.000Z', DATE_PREFS_DEFAULT, IST)).toBe('1 Jan 27');
  });
  it('never moves a bare day by a zone', () => {
    for (const zone of [IST, 'Pacific/Pago_Pago', 'Pacific/Kiritimati', 'UTC']) {
      expect(formatDate('2026-11-07', DATE_PREFS_DEFAULT, zone)).toBe('7 Nov 26');
      expect(formatDate('2026-11-07', { ...DATE_PREFS_DEFAULT, date: 'dd_mm_yy' }, zone)).toBe('07/11/26');
    }
  });
  it('keeps the day two digits only where the format says so', () => {
    expect(formatDate('2026-01-02', { ...DATE_PREFS_DEFAULT, date: 'd_mon_yyyy' }, IST)).toBe('2 Jan 2026');
    expect(formatDate('2026-01-02', { ...DATE_PREFS_DEFAULT, date: 'dd_mm_yy' }, IST)).toBe('02/01/26');
    expect(formatDate('2009-01-02', DATE_PREFS_DEFAULT, IST)).toBe('2 Jan 09');
  });
  it('gives nothing for what is not a date, and never throws', () => {
    expect(formatStamp('nonsense', DATE_PREFS_DEFAULT, IST)).toBe('');
    expect(formatDate('', DATE_PREFS_DEFAULT, IST)).toBe('');
    expect(formatClock(new Date(NaN), DATE_PREFS_DEFAULT, IST)).toBe('');
  });
  it('reads an unknown zone as the default one', () => {
    expect(formatStamp(FOUNDERS, DATE_PREFS_DEFAULT, 'Mars/Olympus')).toBe('7 Nov 26, 4:17am');
  });
});

describe('formatMinute', () => {
  it('reads a minute of the day on both clocks', () => {
    expect(formatMinute(450, DATE_PREFS_DEFAULT)).toBe('7:30am');
    expect(formatMinute(450, with24)).toBe('07:30');
    expect(formatMinute(0, DATE_PREFS_DEFAULT)).toBe('12:00am');
    expect(formatMinute(720, DATE_PREFS_DEFAULT)).toBe('12:00pm');
    expect(formatMinute(977, with24)).toBe('16:17');
    expect(formatMinute(1440, with24)).toBe('00:00');
    expect(formatMinute(-30, DATE_PREFS_DEFAULT)).toBe('11:30pm');
  });
});
