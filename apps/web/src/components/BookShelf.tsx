import { BOOKS, type Book } from '@kreators/shared';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { HeroBlobs } from './Hero';

const BY_SLUG: Record<string, Book> = Object.fromEntries(BOOKS.map((b) => [b.slug, b]));
/** The shelf's order: The Relationship Method large on the left, then the 20s book on top and the Creators book under it. */
/** Each card's colour, from its cover: deep indigo for the pyramid, purple for the 20s, rose for the Creators. */
const TONE: Record<string, { fill: string; flower: 'lotus' | 'violet' | 'poppy' }> = {
  'the-relationship-method': { fill: 'var(--color-r6)', flower: 'lotus' },
  'dictionary-of-mistakes-for-20s': { fill: 'var(--color-r7)', flower: 'violet' },
  'dictionary-of-mistakes-for-creators': { fill: 'var(--color-r1)', flower: 'poppy' },
};
const ORDER = ['the-relationship-method', 'dictionary-of-mistakes-for-20s', 'dictionary-of-mistakes-for-creators'] as const;

/**
 * The founder's three books as one shelf: The Relationship Method large on the left, and on the right the 20s book above the Creators
 * book, each a card of its own in a bento grid (like Home's metrics). Each opens `href(book)`. On a phone the large one takes the top
 * row and the two sit side by side under it.
 */
export function BookShelf({ href, caption = true, className = '' }: { href: (b: Book) => string; caption?: boolean; className?: string }) {
  const [big, top, bottom] = ORDER.map((s) => BY_SLUG[s]).filter((b): b is Book => Boolean(b));
  if (!big || !top || !bottom) return null;
  // Flush cards: the cover fills its card edge to edge, whole (its own ratio, never cropped), and the title sits in a strip under it.
  // A phone stacks the three, full width. From sm up the large one is a column of about two thirds and the two stack in the other third,
  // which makes the large cover as tall as the two small ones together.
  const item = (b: Book, size: 'big' | 'small'): ReactNode => (
    <li key={b.slug} className={`min-w-0 ${size === 'big' ? 'sm:row-span-2' : ''}`}>
      <Link to={href(b)} className="book-card book3d-link toy flex h-full flex-col overflow-hidden rounded-card text-on-fill" style={{ '--book-fill': TONE[b.slug]?.fill ?? 'var(--color-r6)' } as CSSProperties}>
        <span className="book-card-cover relative block">
          <img src={b.cover} alt={b.coverAlt} width={893} height={1263} loading="lazy" decoding="async" className="block h-auto w-full" />
          <span className="book3d-sheen" aria-hidden="true" />
        </span>
        {caption && (
          <span className={`relative flex flex-1 items-center justify-center px-sm py-sm text-balance text-center ${size === 'big' ? 'text-headline sm:text-title3' : 'text-subhead font-semibold'}`}>
            <HeroBlobs seed={b.slug} kind={TONE[b.slug]?.flower} opacity={0.12} />
            <span className="relative">{b.title}</span>
          </span>
        )}
      </Link>
    </li>
  );
  return (
    <ul className={`book-shelf grid list-none grid-cols-1 gap-sm p-0 m-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:grid-rows-[1fr_1fr] ${className}`}>
      {item(big, 'big')}
      {item(top, 'small')}
      {item(bottom, 'small')}
    </ul>
  );
}
