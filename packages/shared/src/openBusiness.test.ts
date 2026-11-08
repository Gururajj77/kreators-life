import { describe, expect, it } from 'vitest';
import { OPEN_KINDS, openKindProblem, openRank, openTag, parseOpenKind, isOpenFilter, sortTasks, DONE_PAGE_SIZE, DONE_PAGE_SIZES, type OpenKind, type Priority } from './index.ts';
import { OPEN_ENDINGS, OPEN_KIND_META } from './openBusiness.ts';

describe('close the unfinished', () => {
  it('reads the three kinds, in any case, and nothing else', () => {
    expect(OPEN_KINDS).toEqual(['unfinished', 'unresolved', 'undecided']);
    expect(parseOpenKind('Unresolved')).toBe('unresolved');
    expect(parseOpenKind(' undecided ')).toBe('undecided');
    for (const v of ['unsorted', 'constructor', 'toString', '__proto__', 'done', '', 'none', null, 3]) expect(parseOpenKind(v)).toBeNull();
    expect(openKindProblem(null)).toBeNull();
    expect(openKindProblem('none')).toBeNull();
    expect(openKindProblem('')).toBeNull();
    expect(openKindProblem('pending')).toBe('Pick unfinished, unresolved or undecided, or none.');
    expect(openKindProblem('constructor')).not.toBeNull();
    expect(isOpenFilter('any') && isOpenFilter('unfinished') && !isOpenFilter('unsorted') && !isOpenFilter('constructor')).toBe(true);
  });

  it('tags each kind with its word', () => {
    expect(OPEN_KINDS.map((k) => openTag(k))).toEqual(['Unfinished', 'Unresolved', 'Undecided']);
    expect(OPEN_KINDS.map((k) => OPEN_KIND_META[k].name)).toEqual(OPEN_KINDS.map((k) => openTag(k)));
  });

  it('By context puts open business after every priority, its kinds in order', () => {
    const t = (id: string, priority: Priority | null, openKind: OpenKind | null) => ({ id, doDate: '2026-11-07', dueDate: null, dueTime: null, priority, relationship: 'self' as const, openKind });
    const list = [t('undecided-p0', 0, 'undecided'), t('plain-none', null, null), t('unfinished-p3', 3, 'unfinished'), t('plain-p2', 2, null), t('unresolved-p1', 1, 'unresolved'), t('plain-p0', 0, null)];
    expect(sortTasks(list, 'context', { lead: 'self' }).map((x) => x.id)).toEqual(['plain-p0', 'plain-p2', 'plain-none', 'unfinished-p3', 'unresolved-p1', 'undecided-p0']);
    // Every other sort leaves the kind alone.
    expect(sortTasks(list, 'priority').map((x) => x.id)[0]).toBe('undecided-p0');
    expect(openRank(null)).toBe(0);
    expect(OPEN_KINDS.map((k) => openRank(k))).toEqual([1, 2, 3]);
  });

  it('pages done tasks ten at a time, with 25 and 50 on offer', () => {
    expect(DONE_PAGE_SIZE).toBe(10);
    expect([...DONE_PAGE_SIZES]).toEqual([10, 25, 50]);
  });

  it('says only that open things tend to stay on the mind: no claim, no life force', () => {
    const words = [...OPEN_KINDS.flatMap((k) => [OPEN_KIND_META[k].holds, OPEN_KIND_META[k].question]), ...Object.values(OPEN_ENDINGS).flatMap((e) => [e.name, e.line])].join(' ').toLowerCase();
    for (const banned of ['life force', 'drain', 'energy', 'zeigarnik', 'zarnic', 'proven', 'science', 'research shows', 'cure', 'guarantee']) expect(words).not.toContain(banned);
    expect(OPEN_ENDINGS.letGo.line).toContain('bring it back');
  });
});
