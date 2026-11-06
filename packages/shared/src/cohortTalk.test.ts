import { describe, expect, it } from 'vitest';
import { COHORT_TALK_MAX_DEPTH, cohortTalkDepth, cohortTalkPrivateLabel, cohortTalkOrder, cohortTalkPlace, isCohortTalkVisibility, maskCode, maskHandle, pruneEmptyLines } from './index.ts';

describe('cohort discussions: masking', () => {
  it('keeps the first two and the last letter of a handle', () => {
    expect(maskHandle('shubham')).toBe('sh****m');
    expect(maskHandle('@shubham')).toBe('sh****m');
    expect(maskHandle('user_ab12cd')).toBe('us****d');
  });
  it('keeps only the first and last of a short handle, and never shows a tiny one whole', () => {
    expect(maskHandle('anna')).toBe('a****a');
    expect(maskHandle('abc')).toBe('a****c');
    expect(maskHandle('ab')).toBe('a****');
    expect(maskHandle('a')).toBe('a****');
    expect(maskHandle('')).toBe('****');
    expect(maskHandle(null)).toBe('****');
  });
  it('never returns the handle itself', () => {
    for (const h of ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef', 'shubham', 'user_xxxxxx']) expect(maskHandle(h)).not.toBe(h);
  });
  it('always puts four stars in the middle, so the length is never given away', () => {
    const long = maskHandle('averyveryverylonghandle');
    const short = maskHandle('abcdef');
    expect(long.length).toBe(short.length);
    expect(maskCode('AB3K9QYZ12').length).toBe(maskCode('AB3K9QYZ').length);
  });
  it('names a private member by the starred handle and code together, so two new members never read the same', () => {
    expect(cohortTalkPrivateLabel('user_ab12cd', 'AB3K9QYZ')).toBe('us****d · AB****YZ');
    expect(cohortTalkPrivateLabel('user_xy99zd', 'CD7M2PQR')).not.toBe(cohortTalkPrivateLabel('user_ab12cd', 'AB3K9QYZ'));
    expect(cohortTalkPrivateLabel('user_ab12cd', 'AB3K9QYZ')).not.toContain('ab12c');
    expect(cohortTalkPrivateLabel(null, null)).toBe('**** · ****');
  });
  it('keeps the first two and last two of a friend code', () => {
    expect(maskCode('AB3K9QYZ')).toBe('AB****YZ');
    expect(maskCode('ABCD')).toBe('****');
    expect(maskCode(null)).toBe('****');
  });
  it('reads a visibility only when it is one of the two', () => {
    expect(isCohortTalkVisibility('public')).toBe(true);
    expect(isCohortTalkVisibility('private')).toBe(true);
    expect(isCohortTalkVisibility('everyone')).toBe(false);
    expect(isCohortTalkVisibility(undefined)).toBe(false);
  });
});

describe('cohort discussions: depth', () => {
  it('nests three levels under a post and no further', () => {
    expect(COHORT_TALK_MAX_DEPTH).toBe(3);
    expect(cohortTalkDepth(null)).toBe(0);
    expect(cohortTalkDepth(0)).toBe(1);
    expect(cohortTalkDepth(1)).toBe(2);
    expect(cohortTalkDepth(2)).toBe(3);
    expect(cohortTalkDepth(3)).toBe(3);
    expect(cohortTalkDepth(9)).toBe(3);
  });
  it('keeps a reply to the deepest level beside it, naming who it answers', () => {
    expect(cohortTalkPlace({ id: 'b', parentId: 'a', depth: 1 })).toEqual({ parentId: 'b', replyToId: 'b', depth: 2 });
    expect(cohortTalkPlace({ id: 'd', parentId: 'c', depth: 3 })).toEqual({ parentId: 'c', replyToId: 'd', depth: 3 });
  });
  it('puts each reply right under what it answers, oldest first, posts in the order given', () => {
    const rows = [
      { id: 'p2', parentId: null, depth: 0, createdAt: '2026-11-06T10:00:00Z' },
      { id: 'p1', parentId: null, depth: 0, createdAt: '2026-11-06T09:00:00Z' },
      { id: 'r2', parentId: 'p1', depth: 1, createdAt: '2026-11-06T09:20:00Z' },
      { id: 'r1', parentId: 'p1', depth: 1, createdAt: '2026-11-06T09:10:00Z' },
      { id: 'r1a', parentId: 'r1', depth: 2, createdAt: '2026-11-06T09:30:00Z' },
      { id: 'r1b', parentId: 'r1a', depth: 3, createdAt: '2026-11-06T09:40:00Z' },
      { id: 'r1c', parentId: 'r1a', depth: 3, createdAt: '2026-11-06T09:50:00Z' },
      { id: 'lost', parentId: 'gone', depth: 1, createdAt: '2026-11-06T09:55:00Z' },
    ];
    expect(cohortTalkOrder(rows).map((r) => `${r.id}:${r.depth}`)).toEqual(['p2:0', 'p1:0', 'r1:1', 'r1a:2', 'r1b:3', 'r1c:3', 'r2:1']);
  });
  it('keeps an empty place only where replies hang from it', () => {
    const rows = [
      { id: 'a', parentId: null, empty: true },
      { id: 'a1', parentId: 'a', empty: false },
      { id: 'b', parentId: null, empty: true },
      { id: 'b1', parentId: 'b', empty: true },
      { id: 'c', parentId: null, empty: false },
    ];
    expect(pruneEmptyLines(rows).map((r) => r.id)).toEqual(['a', 'a1', 'c']);
  });
});
