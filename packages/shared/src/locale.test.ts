import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ZONE,
  formatCount,
  INDIAN_STATES,
  kpiShown,
  LOCALE,
  normalizePhone,
  phoneProblem,
  pinCodeProblem,
  seasonLabel,
  trustScore,
} from './index';

describe('India-first locale', () => {
  it('names one locale and one fallback zone', () => {
    expect(LOCALE).toBe('en-IN');
    expect(DEFAULT_ZONE).toBe('Asia/Kolkata');
  });
  it('groups counts in lakhs and crores', () => {
    expect(formatCount(1234567)).toBe('12,34,567');
    expect(formatCount(123456789)).toBe('12,34,56,789');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(Number.NaN)).toBe('0');
  });
  it('shows a count metric the same way', () => {
    expect(kpiShown('count', 1234567, 'INR')).toBe('12,34,567');
  });
  it('writes trust values and a season the Indian way', () => {
    const t = trustScore({ xp: 1234567, pointsEarned: 150000, bestStreak: 3, daysHere: 10, sold: 0, rating: null, honors: 0 });
    const labels = t.parts.map((p) => p.value);
    expect(labels).toContain('12,34,567 xp');
    expect(labels).toContain('1,50,000 points');
    expect(seasonLabel('2026-11')).toBe('November 2026');
  });
});

describe('phone numbers, India first', () => {
  it('reads a bare Indian mobile as +91', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('09876543210')).toBe('+919876543210');
    expect(normalizePhone('9876543210')).toBe('+919876543210');
  });
  it('keeps a number with a plus as typed', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
    expect(normalizePhone('+91 98765-43210')).toBe('+919876543210');
  });
  it('leaves other digits alone and still checks the length', () => {
    expect(normalizePhone('12345678')).toBe('12345678');
    expect(phoneProblem('98765 43210')).toBeNull();
    expect(phoneProblem('12')).toBeTruthy();
  });
});

describe('Indian addresses', () => {
  it('lists 28 states and 8 union territories, each once', () => {
    expect(INDIAN_STATES.length).toBe(36);
    expect(new Set(INDIAN_STATES).size).toBe(36);
    expect(INDIAN_STATES).toContain('Karnataka');
    expect(INDIAN_STATES).toContain('Ladakh');
  });
  it('takes a six-digit PIN code that does not start with 0', () => {
    expect(pinCodeProblem('560038')).toBeNull();
    expect(pinCodeProblem(' 110001 ')).toBeNull();
    expect(pinCodeProblem('012345')).toBeTruthy();
    expect(pinCodeProblem('56003')).toBeTruthy();
    expect(pinCodeProblem('5600381')).toBeTruthy();
    expect(pinCodeProblem('56O038')).toBeTruthy();
  });
});
