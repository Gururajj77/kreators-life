import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_EXPIRY_CHOICES,
  INVITE_GATE_LINE,
  INVITE_UNUSABLE,
  INVITE_UNUSABLE_WHY,
  inviteCodeProblem,
  inviteLinkPath,
  inviteStateOf,
  normalizeInviteCode,
  WAITLIST_DONE,
} from './invites.ts';
import { BADGE_BY_KEY, BADGE_FAMILY_META, CONNECT_REWARD, canInvite, CREATOR_PERMISSIONS, earningGuide, INVITE_ACTIVE_DAYS, INVITE_REWARD, isPrivateBadge, isStaffFor, PERMISSION_META, PERMISSIONS } from './index.ts';

describe('invite codes', () => {
  it('use ten characters with no look-alikes', () => {
    expect(INVITE_CODE_LENGTH).toBe(10);
    for (const ch of ['0', 'O', '1', 'I', 'L']) expect(INVITE_ALPHABET.includes(ch), ch).toBe(false);
    expect(new Set(INVITE_ALPHABET).size).toBe(INVITE_ALPHABET.length);
  });
  it('read a typed code kindly and refuse what cannot be one', () => {
    expect(normalizeInviteCode(' abcde-fghjk ')).toBe('ABCDEFGHJK');
    expect(normalizeInviteCode('abcd efgh jk')).toBe('ABCDEFGHJK');
    expect(normalizeInviteCode('ABCDEFGHJ')).toBeNull();
    expect(normalizeInviteCode('ABCDEFGHJKM')).toBeNull();
    expect(normalizeInviteCode('ABCDEFGHJ0')).toBeNull();
    expect(normalizeInviteCode('ABCDEFGHJL')).toBeNull();
    expect(normalizeInviteCode(42)).toBeNull();
    expect(inviteCodeProblem('')).toMatch(/Type/);
    expect(inviteCodeProblem('abc')).toMatch(/10/);
    expect(inviteCodeProblem('abcde-fghjk')).toBeNull();
    expect(inviteLinkPath('ABCDEFGHJK')).toBe('/join/ABCDEFGHJK');
  });
  it('have one reading of their state: used, then taken back, then past their day', () => {
    const now = '2026-11-10T12:00:00.000Z';
    expect(inviteStateOf({ usedAt: null, revokedAt: null, expiresAt: null }, now)).toBe('open');
    expect(inviteStateOf({ usedAt: null, revokedAt: null, expiresAt: '2026-11-11T00:00:00.000Z' }, now)).toBe('open');
    expect(inviteStateOf({ usedAt: null, revokedAt: null, expiresAt: '2026-11-10T11:59:59.000Z' }, now)).toBe('expired');
    expect(inviteStateOf({ usedAt: null, revokedAt: '2026-11-09T00:00:00.000Z', expiresAt: '2026-11-01T00:00:00.000Z' }, now)).toBe('revoked');
    expect(inviteStateOf({ usedAt: '2026-11-02T00:00:00.000Z', revokedAt: '2026-11-09T00:00:00.000Z', expiresAt: '2026-11-01T00:00:00.000Z' }, now)).toBe('used');
    expect(INVITE_EXPIRY_CHOICES).toEqual([7, 30, 90, null]);
  });
  it('say one plain thing each, with no reply time and no position', () => {
    for (const line of [INVITE_GATE_LINE, INVITE_UNUSABLE, INVITE_UNUSABLE_WHY, WAITLIST_DONE]) {
      expect(line.split(/\s+/).length).toBeLessThan(20);
      expect(line).not.toMatch(/\d|hour|day|week|position|place in line|soon/i);
    }
  });
  it('are a leaf: the file imports only types from the rest of shared', () => {
    const src = readFileSync(new URL('./invites.ts', import.meta.url), 'utf8');
    const imports = src.split('\n').filter((l) => /^import\s/.test(l));
    for (const l of imports) expect(l, l).toMatch(/^import type /);
  });
});

describe('who may invite', () => {
  it('is an admin, anyone on staff, or an Inviter, and a creator can be one', () => {
    expect(PERMISSIONS).toContain('invite');
    expect(CREATOR_PERMISSIONS).toContain('invite');
    expect(PERMISSION_META.invite.name).toBe('Inviter');
    expect(canInvite({ role: 'admin', permissions: [] })).toBe(true);
    expect(canInvite({ role: 'sub_admin', permissions: [] })).toBe(true);
    expect(canInvite({ role: 'user', permissions: ['invite'] })).toBe(true);
    expect(canInvite({ role: 'user', permissions: ['mentor', 'coach'] })).toBe(false);
    expect(isStaffFor({ role: 'user', permissions: ['invite'] }, 'invite')).toBe(true);
    expect(isStaffFor({ role: 'admin', permissions: [] }, 'invite')).toBe(true);
  });
});

describe('what bringing people in and the team’s connections pay', () => {
  it('pays a referral on the third day of use and a connection on its yes, within a daily cap', () => {
    expect(INVITE_REWARD).toEqual({ xp: 50, points: 20, perDay: 5 });
    expect(INVITE_ACTIVE_DAYS).toBe(3);
    expect(CONNECT_REWARD).toEqual({ xp: 10, points: 0, perDay: 5 });
  });
  it('lists both in the earning guide, so Help says how they pay', () => {
    const lines = earningGuide().flatMap((g) => g.lines);
    const invite = lines.find((l) => /invited/.test(l.what));
    const connect = lines.find((l) => /connection/.test(l.what));
    expect(invite?.pays).toBe(`${INVITE_REWARD.xp} xp and ${INVITE_REWARD.points} points`);
    expect(invite?.how).toMatch(/Admins earn nothing/);
    // The moment it pays reads the constant, never "finishes setting up" (2026-11-10).
    expect(invite?.how).toContain(`${INVITE_ACTIVE_DAYS} days`);
    expect(`${invite?.what} ${invite?.how}`).not.toMatch(/setting up|setup/);
    expect(connect?.pays).toBe(`${CONNECT_REWARD.xp} xp`);
    // Never its maker, never a manager given the job, once per pair.
    expect(connect?.how).toMatch(/never its maker/);
    expect(connect?.how).toMatch(/manager/);
    expect(connect?.how).toMatch(/Once per pair/);
  });
  it('has public Community badges for both, at the asked counts', () => {
    const want: [string, string, number][] = [['invite_1', 'invites_joined', 1], ['invite_5', 'invites_joined', 5], ['invite_20', 'invites_joined', 20], ['invite_50', 'invites_joined', 50], ['connect_1', 'connections_made', 1], ['connect_5', 'connections_made', 5]];
    for (const [key, stat, min] of want) {
      const b = BADGE_BY_KEY[key];
      expect(b?.stat, key).toBe(stat);
      expect(b?.min, key).toBe(min);
      expect(b?.family, key).toBe('Community');
      expect(isPrivateBadge(key), key).toBe(false);
    }
    expect(BADGE_FAMILY_META.Community.private).toBe(false);
    expect(BADGE_BY_KEY.invite_50?.tier).toBe('platinum');
  });
});
