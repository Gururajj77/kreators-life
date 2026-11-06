import { BOOKS, type Book } from '@kreators/shared';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { HeroBlobs } from './Hero';

const BY_SLUG: Record<string, Book> = Object.fromEntries(BOOKS.map((b) => [b.slug, b]));
/** Each card's colour, from its cover: deep indigo for the pyramid, purple for the 20s, rose for the Creators. */
const TONE: Record<string, { fill: string; flower: 'lotus' | 'violet' | 'poppy' }> = {
  'the-relationship-method': { fill: 'var(--color-r6)', flower: 'lotus' },
  'dictionary-of-mistakes-for-20s': { fill: 'var(--color-r7)', flower: 'violet' },
  'dictionary-of-mistakes-for-creators': { fill: 'var(--color-r1)', flower: 'poppy' },
};
/** The shelf's order, left to right: The Relationship Method, then the 20s book, then the Creators book. */
const ORDER = ['the-relationship-method', 'dictionary-of-mistakes-for-20s', 'dictionary-of-mistakes-for-creators'] as const;

/**
 * The founder's three books as one shelf: three equal cards left to right from `sm` up, stacked full width on a phone (2026-11-06, the
 * founder: "make them 3 cards left to right, instead of the 1 and 2 style, on mobile keep them one below the other"). Each opens
 * `href(book)`.
 */
export function BookShelf({ href, caption = true, className = '' }: { href: (b: Book) => string; caption?: boolean; className?: string }) {
  const books = ORDER.map((slug) => BY_SLUG[slug]).filter((b): b is Book => Boolean(b));
  if (!books.length) return null;
  // Flush cards: the cover fills its card edge to edge, whole (its own ratio, never cropped), and the title sits in a strip under it;
  // the strips stretch so the three cards are one height.
  const item = (b: Book): ReactNode => (
    <li key={b.slug} className="min-w-0">
      <Link to={href(b)} className="book-card book3d-link toy flex h-full flex-col overflow-hidden rounded-card text-on-fill" style={{ '--book-fill': TONE[b.slug]?.fill ?? 'var(--color-r6)' } as CSSProperties}>
        <span className="book-card-cover relative block">
          <img src={b.cover} alt={b.coverAlt} width={893} height={1263} loading="lazy" decoding="async" className="block h-auto w-full" />
          <span className="book3d-sheen" aria-hidden="true" />
        </span>
        {caption && (
          <span className="relative flex flex-1 items-center justify-center px-sm py-sm text-balance text-center text-headline">
            <HeroBlobs seed={b.slug} kind={TONE[b.slug]?.flower} opacity={0.12} />
            <span className="relative">{b.title}</span>
          </span>
        )}
      </Link>
    </li>
  );
  return <ul className={`book-shelf grid list-none grid-cols-1 gap-sm p-0 m-0 sm:grid-cols-3 ${className}`}>{books.map(item)}</ul>;
}
