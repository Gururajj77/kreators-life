import { describe, expect, it } from 'vitest';
import { BOOK_BY_SLUG, BOOKS, REWARDS } from './index';

describe('the founder\'s books', () => {
  it('are the three books under their real titles, never the PDF file names', () => {
    expect(BOOKS.map((b) => b.title)).toEqual(['The Relationship Method', 'Dictionary of Mistakes for Creators', 'Dictionary of Mistakes for 20s']);
    for (const b of BOOKS) {
      expect(b.author).toBe('Shubham Aggarwal');
      expect(/flow method|glitch|kreator/i.test(`${b.title} ${b.subtitle}`), b.slug).toBe(false);
    }
  });
  it('have unique slugs, covers, courses and reward keys, and every reward key is in REWARDS', () => {
    for (const field of ['slug', 'cover', 'courseId', 'rewardKey'] as const) expect(new Set(BOOKS.map((b) => b[field])).size, field).toBe(BOOKS.length);
    for (const b of BOOKS) {
      expect(b.slug).toMatch(/^[a-z0-9-]+$/);
      expect(b.cover).toMatch(/^\/books\/[a-z0-9-]+\.webp$/);
      expect(b.courseId).toMatch(/^prog-[a-z0-9-]+$/);
      expect(b.coverAlt.length).toBeGreaterThan(20);
      const r = REWARDS.find((x) => x.key === b.rewardKey);
      expect(r, b.rewardKey).toBeTruthy();
      expect(r?.group).toBe('books');
    }
  });
  it('carry back-cover words only where a back cover exists', () => {
    for (const b of BOOKS) {
      const hasBack = b.back.length > 0;
      expect(Boolean(b.insideLead), b.slug).toBe(hasBack);
      expect(b.inside.length > 0, b.slug).toBe(hasBack);
      expect(Boolean(b.closing), b.slug).toBe(hasBack);
    }
    // The Relationship Method has no back cover: only its tagline and title-page subtitle, nothing written for it.
    expect(BOOK_BY_SLUG['the-relationship-method'].back).toEqual([]);
    expect(BOOK_BY_SLUG['the-relationship-method'].tagline).toBeTruthy();
  });
  it('looks a slug up without the prototype', () => {
    expect(BOOK_BY_SLUG.constructor).toBeUndefined();
    expect(BOOK_BY_SLUG['dictionary-of-mistakes-for-20s'].title).toBe('Dictionary of Mistakes for 20s');
  });
});
