import { describe, expect, it } from 'vitest';
import { focusRunActive, parseFocusRun, resumeFrom, type FocusRun } from './focusRun';

const NOW = 1_800_000_000_000;
const base = (over: Partial<FocusRun> = {}): FocusRun => ({
  v: 1,
  owner: 'abc123',
  mode: 'pomodoro',
  phase: 'focus',
  round: 1,
  cycle: 1,
  partMs: 25 * 60_000,
  leftMs: 25 * 60_000,
  endsAt: null,
  timer: { total: 30 * 60_000, left: 30 * 60_000, endsAt: null },
  breathe: { total: 3 * 60_000, left: 3 * 60_000, endsAt: null },
  sw: { startedAt: null, accumMs: 0 },
  taskId: '',
  finished: false,
  ...over,
});
const text = (r: unknown) => JSON.stringify(r);

describe('parseFocusRun', () => {
  it('reads back what was written', () => {
    const r = base({ round: 2, endsAt: NOW + 60_000, taskId: 'node-1' });
    expect(parseFocusRun(text(r), 'abc123')).toEqual(r);
  });
  it('refuses a record from someone else, a broken one, or another version', () => {
    expect(parseFocusRun(text(base()), 'someone-else')).toBeNull();
    expect(parseFocusRun('{not json', 'abc123')).toBeNull();
    expect(parseFocusRun(null, 'abc123')).toBeNull();
    expect(parseFocusRun(text({ ...base(), v: 2 }), 'abc123')).toBeNull();
    expect(parseFocusRun(text({ ...base(), mode: 'sprint' }), 'abc123')).toBeNull();
    expect(parseFocusRun(text({ ...base(), timer: null }), 'abc123')).toBeNull();
    expect(parseFocusRun(text(base()), '')).toBeNull();
  });
  it('holds every number to its range and drops an odd task id', () => {
    const r = parseFocusRun(text({ ...base(), round: 500, leftMs: 99 * 60 * 60_000, endsAt: -4, taskId: '../x', sw: { startedAt: 'soon', accumMs: -1 } }), 'abc123')!;
    expect(r.round).toBe(99);
    expect(r.leftMs).toBe(r.partMs);
    expect(r.endsAt).toBeNull();
    expect(r.taskId).toBe('');
    expect(r.sw).toEqual({ startedAt: null, accumMs: 0 });
  });
});

describe('resumeFrom', () => {
  it('a running countdown comes back with the time its end time leaves', () => {
    const r = resumeFrom(base({ endsAt: NOW + 90_000, leftMs: 5 * 60_000 }), NOW);
    expect(r.pomodoro).toEqual({ running: true, leftMs: 90_000, due: false });
    expect(r.run.leftMs).toBe(90_000);
  });
  it('one whose end time passed while the page was gone comes back due, to be finished once by its own tick', () => {
    const r = resumeFrom(base({ mode: 'timer', timer: { total: 60_000, left: 60_000, endsAt: NOW - 5_000 } }), NOW);
    expect(r.timer).toMatchObject({ running: true, left: 0, due: true, endsAt: NOW - 5_000 });
  });
  it('a paused one stays paused with the time it had', () => {
    const r = resumeFrom(base({ mode: 'breathe', breathe: { total: 180_000, left: 70_000, endsAt: null } }), NOW);
    expect(r.breathe).toMatchObject({ running: false, left: 70_000, due: false });
  });
  it('a stopwatch keeps counting from its start, and a paused one keeps what it had', () => {
    expect(resumeFrom(base({ mode: 'stopwatch', sw: { startedAt: NOW - 120_000, accumMs: 30_000 } }), NOW).stopwatch).toEqual({ running: true, ms: 150_000 });
    expect(resumeFrom(base({ mode: 'stopwatch', sw: { startedAt: null, accumMs: 30_000 } }), NOW).stopwatch).toEqual({ running: false, ms: 30_000 });
  });
});

describe('focusRunActive', () => {
  it('an untouched clock is not worth keeping; a started, paused or part-way one is', () => {
    expect(focusRunActive(base())).toBe(false);
    expect(focusRunActive(base({ endsAt: NOW }))).toBe(true);
    expect(focusRunActive(base({ phase: 'short' }))).toBe(true);
    expect(focusRunActive(base({ round: 2 }))).toBe(true);
    expect(focusRunActive(base({ mode: 'timer' }))).toBe(false);
    expect(focusRunActive(base({ mode: 'timer', timer: { total: 60_000, left: 30_000, endsAt: null } }))).toBe(true);
    expect(focusRunActive(base({ mode: 'stopwatch', sw: { startedAt: null, accumMs: 1000 } }))).toBe(true);
  });
});
