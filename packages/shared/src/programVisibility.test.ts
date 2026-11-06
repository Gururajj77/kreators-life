import { describe, expect, it } from 'vitest';
import { PROGRAM_VISIBILITIES, PROGRAM_VISIBILITY_META, isProgramVisibility, programTakesEnrolment, programVisibleTo } from './index';

const nobody = { admin: false, runs: false, invited: false };

describe('program visibility', () => {
  it('has the four states in order, each with a name and a line', () => {
    expect(PROGRAM_VISIBILITIES).toEqual(['draft', 'private', 'public', 'archived']);
    for (const v of PROGRAM_VISIBILITIES) {
      expect(PROGRAM_VISIBILITY_META[v].name.length).toBeGreaterThan(0);
      expect(PROGRAM_VISIBILITY_META[v].line.endsWith('.')).toBe(true);
    }
    expect(isProgramVisibility('public')).toBe(true);
    expect(isProgramVisibility('published')).toBe(false);
    expect(isProgramVisibility('constructor')).toBe(false);
  });

  it('shows public to everyone, private to the invited, draft and archived to the people who run it', () => {
    expect(programVisibleTo('public', nobody)).toBe(true);
    expect(programVisibleTo('private', nobody)).toBe(false);
    expect(programVisibleTo('private', { ...nobody, invited: true })).toBe(true);
    expect(programVisibleTo('draft', { ...nobody, invited: true })).toBe(false);
    expect(programVisibleTo('archived', { ...nobody, invited: true })).toBe(false);
    for (const v of PROGRAM_VISIBILITIES) {
      expect(programVisibleTo(v, { ...nobody, runs: true })).toBe(true);
      expect(programVisibleTo(v, { ...nobody, admin: true })).toBe(true);
    }
  });

  it('takes no enrolment once archived, even for an admin', () => {
    expect(programTakesEnrolment('public', nobody)).toBe(true);
    expect(programTakesEnrolment('private', nobody)).toBe(false);
    expect(programTakesEnrolment('private', { ...nobody, invited: true })).toBe(true);
    expect(programTakesEnrolment('archived', { ...nobody, admin: true })).toBe(false);
  });
});
