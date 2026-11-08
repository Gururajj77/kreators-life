import { describe, expect, it } from 'vitest';
import { INBOX_TAB_META, INBOX_TABS, inboxTabOf, isInboxKind, INBOX_KINDS, STAFF_INBOX_KINDS } from './index';

// The founder, 2026-11-07: "inbox items are not going in right place example water and all others need to be checked again".
describe('every kind of note has one tab', () => {
  it('puts each kind in exactly one tab besides Everything', () => {
    for (const kind of INBOX_KINDS) {
      const homes = INBOX_TABS.filter((t) => t !== 'all' && INBOX_TAB_META[t].kinds.includes(kind));
      expect(homes, kind).toHaveLength(1);
      expect(inboxTabOf(kind)).toBe(homes[0]);
    }
  });

  it('names only known kinds in the tabs, and no kind twice', () => {
    const named = INBOX_TABS.flatMap((t) => INBOX_TAB_META[t].kinds);
    for (const k of named) expect(isInboxKind(k), k).toBe(true);
    expect(new Set(named).size).toBe(named.length);
    expect(new Set(INBOX_KINDS).size).toBe(INBOX_KINDS.length);
    expect(named.length).toBe(INBOX_KINDS.length);
  });

  it('keeps Everything empty of its own kinds and the first three tabs in their place', () => {
    expect(INBOX_TAB_META.all.kinds).toEqual([]);
    expect(INBOX_TABS.slice(0, 3)).toEqual(['all', 'replies', 'following']);
    expect(INBOX_TAB_META.all.name).toBe('Everything');
    expect(INBOX_TAB_META.replies.name).toBe('Replies and mentions');
  });

  it('keeps Team to the kinds only staff are sent, and those in no other tab', () => {
    expect([...INBOX_TAB_META.team.kinds].sort()).toEqual([...STAFF_INBOX_KINDS].sort());
    for (const k of STAFF_INBOX_KINDS) expect(inboxTabOf(k)).toBe('team');
    // What a guide did with a member's own post is sent to the member, so it is not a staff kind.
    expect(inboxTabOf('moderation')).toBe('replies');
    expect(inboxTabOf('support')).toBe('replies');
  });

  it('files the everyday kinds where a person looks for them', () => {
    expect(inboxTabOf('reminder')).toBe('reminders');
    expect(inboxTabOf('order')).toBe('shop');
    expect(inboxTabOf('booking')).toBe('shop');
    expect(inboxTabOf('school')).toBe('learning');
    expect(inboxTabOf('coach')).toBe('learning');
    expect(inboxTabOf('bond')).toBe('friends');
    expect(inboxTabOf('campaign')).toBe('work');
    expect(inboxTabOf('party')).toBe('events');
    // A run club's brand collab is a deal, not a run: Work, beside Army's campaigns.
    expect(inboxTabOf('collab')).toBe('work');
    expect(inboxTabOf('run')).toBe('events');
  });

  it('keeps every tab name plain and short', () => {
    for (const t of INBOX_TABS) {
      expect(INBOX_TAB_META[t].name.split(' ').length, t).toBeLessThanOrEqual(3);
      expect(INBOX_TAB_META[t].name).toMatch(/^[A-Z][a-z]+( (and|[a-z]+))*( [a-z]+)?$/);
    }
  });
});
