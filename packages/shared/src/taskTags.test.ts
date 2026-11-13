import { describe, expect, it } from 'vitest';
import { NO_TASK_TAGS, TASK_TAG_FLAGS, TASK_TAG_FLAG_WORDS, matchesTaskTags, parseTaskTags, taskTagOn, taskTagTokens, taskTagsKey, toggleTaskTag, type TemplateSlot } from './index';

const task = {
  relationship: 'parent_child' as const,
  priority: 1 as const,
  remind: true,
  forReview: false,
  repeat: null,
  habit: null,
  fromPillar: true,
  fromCoach: false,
  openKind: 'unfinished' as const,
  timeBlockId: null,
  dueTime: '09:30',
};

describe('Tap a tag to filter (Daily’s ?tags=)', () => {
  it('round-trips a cut through its canonical string, in the one order', () => {
    const t = parseTaskTags('remember,pillar:parent_child,block:blk-1,kind:undecided,pri:0,habit');
    expect(taskTagsKey(t)).toBe('pillar:parent_child,pri:0,remember,habit,kind:undecided,block:blk-1');
    expect(parseTaskTags(taskTagsKey(t))).toEqual(t);
    expect(taskTagsKey(NO_TASK_TAGS)).toBe('');
  });

  it('drops junk and never finds a prototype key', () => {
    expect(taskTagsKey(parseTaskTags('pri:9,constructor,toString,pillar:constructor,kind:__proto__,block:a b,,'))).toBe('');
    expect(parseTaskTags(undefined)).toEqual(NO_TASK_TAGS);
    expect(parseTaskTags(42)).toEqual(NO_TASK_TAGS);
  });

  it('keeps one of each kind, a later one replacing the earlier', () => {
    expect(taskTagsKey(parseTaskTags('pillar:self,pillar:divine,pri:1,pri:3'))).toBe('pillar:divine,pri:3');
  });

  it('toggles: a token on goes off, another of its kind replaces it, flags add up', () => {
    let t = toggleTaskTag(NO_TASK_TAGS, 'remember');
    expect(taskTagOn(t, 'remember')).toBe(true);
    t = toggleTaskTag(t, 'pillar:self');
    t = toggleTaskTag(t, 'pillar:divine');
    expect(taskTagsKey(t)).toBe('pillar:divine,remember');
    t = toggleTaskTag(t, 'remember');
    expect(taskTagsKey(t)).toBe('pillar:divine');
    expect(toggleTaskTag(t, 'constructor')).toBe(t);
  });

  it('names every flag in words', () => {
    for (const f of TASK_TAG_FLAGS) expect(TASK_TAG_FLAG_WORDS[f].length).toBeGreaterThan(0);
    expect(taskTagTokens(parseTaskTags(TASK_TAG_FLAGS.join(',')))).toEqual([...TASK_TAG_FLAGS]);
  });

  it('matches a task the way its tags show, the kinds combined with AND', () => {
    expect(matchesTaskTags(task, parseTaskTags('pillar:parent_child,remember'))).toBe(true);
    expect(matchesTaskTags(task, parseTaskTags('pillar:self,remember'))).toBe(false);
    expect(matchesTaskTags(task, parseTaskTags('pri:1,built,kind:unfinished'))).toBe(true);
    expect(matchesTaskTags(task, parseTaskTags('review'))).toBe(false);
    expect(matchesTaskTags(task, parseTaskTags('coach'))).toBe(false);
    // Habit is the tag's own rule: a task that repeats and counts as a habit.
    expect(matchesTaskTags(task, parseTaskTags('habit'))).toBe(false);
    expect(matchesTaskTags({ ...task, repeat: { kind: 'daily' as const, every: 1, days: [], until: null } }, parseTaskTags('habit'))).toBe(true);
    expect(matchesTaskTags({ ...task, repeat: { kind: 'daily' as const, every: 1, days: [], until: null }, habit: false }, parseTaskTags('habit'))).toBe(false);
  });

  it('places a timed task in the block its time falls in, and a picked block wins', () => {
    const slots: TemplateSlot[] = [{ blockId: 'blk-am', start: 9 * 60, end: 12 * 60 }];
    expect(matchesTaskTags(task, parseTaskTags('block:blk-am'), slots)).toBe(true);
    expect(matchesTaskTags(task, parseTaskTags('block:blk-am'), [])).toBe(false);
    expect(matchesTaskTags({ ...task, timeBlockId: 'blk-pm' }, parseTaskTags('block:blk-am'), slots)).toBe(false);
  });
});
