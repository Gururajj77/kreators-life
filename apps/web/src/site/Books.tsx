import type { CSSProperties } from 'react';
import { BOOK_AUTHOR, BOOKS, type Book } from '@kreators/shared';
import { BackLink } from '../components/PageHeader';
import { Link } from 'react-router';
import { Fold } from '../components/Fold';
import { Icon } from '../components/Icon';
import { useSession } from '../lib/store';
import { BOOK_CHAPTERS, BOOK_PAGE } from './content';
import { GuideLine } from './GuideLine';
import { SiteLayout } from './SiteLayout';
import { SiteArrow, SITE_CHIP_BASE, SITE_LINK_INLINE, SITE_PRIMARY, SITE_SECONDARY } from './buttons';

/** Where "Read the course in the app" goes: the Book page for someone signed in, through sign-in for a visitor. */
export function useBookEntry(): string {
  const token = useSession((s) => s.token);
  return token ? BOOK_PAGE : `/signin?next=${encodeURIComponent(BOOK_PAGE)}`;
}

/** A book's front cover, same-origin, at the covers' own shape (893 by 1263). */
export function BookCover({ book, className = '', eager = false }: { book: Book; className?: string; eager?: boolean }) {
  return (
    <img
      src={book.cover}
      alt={book.coverAlt}
      width={893}
      height={1263}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`block h-auto w-full rounded-inner bg-paper shadow-toy-soft ${className}`}
    />
  );
}

/** The book's own words: the back cover where there is one, else the front cover's line. Quoted, never written for it. */
function CoverWords({ book }: { book: Book }) {
  if (book.back.length === 0) {
    return (
      <blockquote className="prose-long m-0 border-l-2 border-line pl-sm text-prose text-ink-soft">
        <p className="m-0">{book.tagline}.</p>
        <p className="mt-xs m-0">{book.subtitle}.</p>
      </blockquote>
    );
  }
  return (
    <blockquote className="prose-long m-0 border-l-2 border-line pl-sm text-prose text-ink-soft">
      {book.back.map((p) => (
        <p key={p} className="m-0 mb-xs">
          {p}
        </p>
      ))}
      {book.inside.length > 0 && (
        <>
          <p className="m-0 font-semibold text-ink">{book.insideLead}</p>
          <ul className="mt-xs m-0 grid list-disc gap-xs pl-md">
            {book.inside.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {book.closing && <p className="mt-xs m-0">{book.closing}</p>}
    </blockquote>
  );
}

function Chapters({ slug }: { slug: string }) {
  const list = BOOK_CHAPTERS[slug] ?? [];
  return (
    <ol className="m-0 grid list-decimal gap-xs pl-lg text-callout text-ink-soft">
      {list.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ol>
  );
}

/**
 * The public Books page (at /features/books): the founder's three books, each with its cover, its own words and its chapters,
 * and the way into its course. The books are not sold here; the page says only what the app does with them.
 */
export function Books() {
  const token = useSession((s) => s.token);
  const course = useBookEntry();
  return (
    <SiteLayout>
      <header
        data-pillar="guru"
        className="wash mt-lg grid gap-md rounded-card bg-card p-md shadow-toy-soft lg:grid-cols-[3fr_2fr] lg:items-center md:p-lg"
        style={{ '--wash': 'var(--color-r6)' } as CSSProperties}
      >
        <div>
          <BackLink to="/features">All features</BackLink>
          <p className="m-0 type-eyebrow text-ink-mute">Books</p>
          <h1 className="type-hook mt-xs text-display-1">
            Three books, <em>three courses</em>
          </h1>
          <p className="mt-sm m-0 max-w-[560px] text-callout text-ink-soft">
            {BOOK_AUTHOR}, who builds kreators.app, wrote all three. He left college to live as a monk, and came back with the idea this app is built on: seven relationships make a life. Each book is a course in School.
          </p>
          {/* One main action (site/buttons.ts): Start free for a visitor, the courses for someone signed in. */}
          <div className="mt-md flex flex-wrap items-center gap-sm">
            {token ? (
              <Link to={course} className={SITE_PRIMARY}>
                Read the courses in the app
              </Link>
            ) : (
              <>
                <Link to="/start" className={SITE_PRIMARY}>
                  Start free
                </Link>
                <Link to={course} className={SITE_SECONDARY}>
                  Read the courses in the app
                  <SiteArrow />
                </Link>
              </>
            )}
          </div>
        </div>
        <GuideLine host="guru" side="right" mood="excited" size={128} className="justify-self-stretch">
          Read a lesson, then try one thing from it today.
        </GuideLine>
      </header>

      <ul className="mt-lg grid list-none gap-lg p-0 m-0">
        {BOOKS.map((b) => (
          <li key={b.slug} id={b.slug} className="scroll-mt-xl">
            <article className="grid gap-md rounded-card bg-card p-md shadow-toy-soft md:grid-cols-[240px_1fr] md:p-lg" aria-labelledby={`${b.slug}-title`}>
              <div className="mx-auto w-[180px] md:w-full">
                <BookCover book={b} eager />
              </div>
              {/* The words at the top, the way into the course at the foot on the right, level with the cover's foot: the column used to end
                  in a lone link under the folds with an empty band below it. */}
              <div className="flex min-w-0 flex-col">
                <h2 id={`${b.slug}-title`} className="type-hook m-0 text-display-3">
                  {b.title}
                </h2>
                <p className="mt-xs m-0 text-callout text-ink-soft">{b.subtitle}</p>
                <p className="mt-xs m-0 text-subhead text-ink-mute">by {b.author}</p>
                {b.slug === 'the-relationship-method' && (
                  <p className="mt-sm m-0 text-callout text-ink">
                    The book behind the seven relationships this app is built on.{' '}
                    <Link to="/7rp" className={SITE_LINK_INLINE}>
                      Meet the seven
                    </Link>
                  </p>
                )}
                <div className="mt-sm grid gap-xs">
                  <Fold title={`From the ${b.back.length > 0 ? 'back' : 'front'} cover`}>
                    <div className="px-sm pb-sm">
                      <CoverWords book={b} />
                    </div>
                  </Fold>
                  <Fold title="The eight chapters">
                    <div className="px-sm pb-sm">
                      <Chapters slug={b.slug} />
                    </div>
                  </Fold>
                </div>
                <p className="mt-auto m-0 flex justify-end pt-md">
                  <Link to={course} className={`${SITE_CHIP_BASE} px-md`}>
                    Read the course in the app
                    <SiteArrow />
                  </Link>
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <p className="type-measure mt-lg m-0 text-subhead text-ink-soft">
        The courses teach from the books in plain words. Each lesson marks what comes from the book, and anything it adds is the app’s own.
      </p>
    </SiteLayout>
  );
}
