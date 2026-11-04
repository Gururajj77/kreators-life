import { describe, expect, it } from 'vitest';
import { RUN_TALK_DAYS_AFTER, runTalkClosesAt, runTalkOpen } from './index';

describe('run discussions', () => {
  it('stays open a month after the run, and never for a cancelled run', () => {
    expect(RUN_TALK_DAYS_AFTER).toBe(30);
    const endsAt = '2026-11-01T07:00:00.000Z';
    expect(runTalkClosesAt(endsAt)).toBe('2026-12-01T07:00:00.000Z');
    expect(runTalkOpen({ status: 'published', endsAt }, '2026-10-30T00:00:00.000Z')).toBe(true);
    expect(runTalkOpen({ status: 'done', endsAt }, '2026-11-30T23:59:59.000Z')).toBe(true);
    expect(runTalkOpen({ status: 'done', endsAt }, '2026-12-01T07:00:00.000Z')).toBe(false);
    expect(runTalkOpen({ status: 'cancelled', endsAt }, '2026-10-30T00:00:00.000Z')).toBe(false);
  });
});
