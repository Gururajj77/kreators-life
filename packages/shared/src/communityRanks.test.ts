import { describe, expect, it } from 'vitest';
import { canModerate, canMute, canUndo, COMMUNITY_RANKS, type CommunityRank } from './index.ts';

const RANKS = Object.keys(COMMUNITY_RANKS) as CommunityRank[];

describe('the community rank ladder', () => {
  it('lets a guide act only on members, and nobody on an equal or higher rank', () => {
    expect(canModerate('guide', 'member')).toBe(true);
    expect(canModerate('guide', 'guide')).toBe(false);
    expect(canModerate('guide', 'staff')).toBe(false);
    expect(canModerate('guide', 'admin')).toBe(false);
    expect(canModerate('staff', 'guide')).toBe(true);
    expect(canModerate('staff', 'admin')).toBe(false);
    expect(canModerate('admin', 'staff')).toBe(true);
    expect(canModerate('admin', 'admin')).toBe(false);
    for (const t of RANKS) expect(canModerate('member', t)).toBe(false);
  });
  it('moderates by the same rule as muting', () => {
    for (const a of RANKS) for (const t of RANKS) expect(canModerate(a, t)).toBe(canMute(a, t));
  });
  it('undoes only at the rank that acted or higher', () => {
    expect(canUndo('guide', 'guide')).toBe(true);
    expect(canUndo('guide', 'staff')).toBe(false);
    expect(canUndo('staff', 'guide')).toBe(true);
    expect(canUndo('admin', 'admin')).toBe(true);
    for (const b of RANKS) expect(canUndo('member', b)).toBe(false);
  });
});
