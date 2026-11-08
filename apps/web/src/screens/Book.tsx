import { BOOKS, formatCount, money, REWARD_BY_KEY, type Book as BookInfo, type BookState, type BooksResponse } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BookOpen, Coins, GraduationCap, ShoppingBag } from 'lucide-react';
import { Button } from '../components/Button';
import { Fold } from '../components/Fold';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { StatusTag } from '../components/StatusTag';
import { ErrorLine } from '../components/ErrorLine';
import { ApiError, api } from '../lib/api';
import { useModule } from '../lib/modules';

/** Where each book can be had: `GET /api/public/books` (public and read-only, so the public site can read it too). */
export async function fetchBooks(): Promise<BooksResponse> {
  const res = await fetch('/api/public/books');
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  return (await res.json()) as BooksResponse;
}

/** A book's front cover. When the picture cannot load, the title sits on a plain tile instead, so nothing shows broken. */
export function BookCover({ book, className = '' }: { book: BookInfo; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`relative block aspect-[7/10] overflow-hidden rounded-inner bg-paper shadow-toy-soft ${className}`}>
      {broken ? (
        <span className="flex h-full flex-col items-center justify-center gap-xs p-xs text-center text-ink">
          <Icon icon={BookOpen} size={20} />
          <span className="text-balance text-caption">{book.title}</span>
        </span>
      ) : (
        <img src={book.cover} alt={book.coverAlt} width={350} height={500} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      )}
    </span>
  );
}

const PRIMARY = 'toy inline-flex min-h-[48px] items-center justify-center gap-xs rounded-pill bg-ink px-md text-headline text-on-ink';
const OUTLINE = 'toy toy-ink inline-flex min-h-[48px] items-center justify-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-md text-callout text-ink';

/**
 * Book: the founder's three books, reached from Home. Not a module (no switch, no How it works, so `howTo={false}`); it is a door
 * into three that are: the Shop product (through the ordinary product page), the School course, and Rewards for points.
 * One solid button on the screen: the first book you can buy, else the first course you can start; every other way in is an outline.
 */
export function Book() {
  const q = useQuery({ queryKey: ['books'], queryFn: fetchBooks, staleTime: 60_000 });
  const school = useModule('school');
  const state = new Map((q.data?.books ?? []).map((b) => [b.slug, b]));
  const firstBuy = BOOKS.find((b) => state.get(b.slug)?.product?.live)?.slug ?? null;
  const firstCourse = firstBuy ? null : (school?.on ? (BOOKS.find((b) => state.get(b.slug)?.course)?.slug ?? null) : null);

  return (
    <Screen howTo={false}>
      <PageHeader back={{ to: '/home', label: 'Home' }} title="Book" lede="Three books by Shubham Aggarwal. Read the back, take the course or get a copy." />

      {q.isError && (
        <div className="mt-md flex flex-wrap-reverse items-center justify-between gap-sm rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead">Could not check the shop and School just now.</p>
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      <ul className="mt-md grid list-none gap-md p-0 m-0">
        {BOOKS.map((b) => (
          <li key={b.slug} id={b.slug} data-contents-section="" className="scroll-mt-[64px]">
            <BookCard book={b} state={state.get(b.slug) ?? null} loading={q.isPending} schoolOn={Boolean(school?.on)} schoolAvailable={Boolean(school?.available)} primary={firstBuy === b.slug ? 'buy' : firstCourse === b.slug ? 'course' : null} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}

function BookCard({ book: b, state, loading, schoolOn, schoolAvailable, primary }: { book: BookInfo; state: BookState | null; loading: boolean; schoolOn: boolean; schoolAvailable: boolean; primary: 'buy' | 'course' | null }) {
  const reward = REWARD_BY_KEY[b.rewardKey];
  const product = state?.product ?? null;
  const course = state?.course ?? null;
  const [opening, ...rest] = b.back;
  const hasMore = rest.length > 0 || b.inside.length > 0 || Boolean(b.closing);
  return (
    <article aria-labelledby={`${b.slug}-title`} className="rounded-card bg-card p-md shadow-toy-soft">
      <div className="flex gap-md">
        <BookCover book={b} className="w-[112px] shrink-0 self-start sm:w-[160px]" />
        <div className="min-w-0 flex-1">
          <h2 id={`${b.slug}-title`} className="m-0 text-title3">
            {b.title}
          </h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">{b.subtitle}</p>
          <p className="mt-xs m-0 text-subhead font-semibold">By {b.author}</p>
          {/* On a laptop the back cover's opening sits beside the cover; on a phone it goes under, where the line is wider. */}
          {opening && <p className="prose-long mt-sm m-0 hidden text-prose sm:block">{opening}</p>}
          {b.tagline && (
            <p className="mt-sm m-0 text-callout">
              <span className="text-ink-soft">On the cover: </span>
              {b.tagline}.
            </p>
          )}
        </div>
      </div>
      {opening && <p className="prose-long mt-sm m-0 text-prose sm:hidden">{opening}</p>}
      {hasMore && (
        <Fold className="mt-sm" title="From the back cover">
          <div className="prose-long px-sm pb-xs text-prose">
            {rest.map((p) => (
              <p key={p} className="m-0 mt-xs first:mt-0">
                {p}
              </p>
            ))}
            {b.insideLead && <p className="m-0 mt-sm font-semibold">{b.insideLead}</p>}
            {b.inside.length > 0 && (
              <ul className="m-0 mt-xs list-disc pl-md">
                {b.inside.map((x) => (
                  <li key={x} className="text-balance">
                    {x}
                  </li>
                ))}
              </ul>
            )}
            {b.closing && <p className="m-0 mt-sm">{b.closing}</p>}
            {b.publisher && <p className="m-0 mt-sm text-subhead text-ink-soft">{b.publisher}</p>}
          </div>
        </Fold>
      )}

      <div className="fill-row-all mt-md flex flex-wrap items-center gap-xs" aria-busy={loading}>
        {product?.live && product.id ? (
          <Link to={`/p/${product.id}`} className={primary === 'buy' ? PRIMARY : OUTLINE}>
            <Icon icon={ShoppingBag} size={18} />
            {product.priceCents > 0 ? `Buy, ${money(product.priceCents, product.currency)}` : 'Get it free'}
          </Link>
        ) : (
          !loading && (
            <span className="inline-flex min-h-[48px] items-center justify-center gap-xs rounded-pill bg-paper px-md text-subhead font-medium text-ink-soft">
              <Icon icon={ShoppingBag} size={16} />
              Book: coming soon
            </span>
          )
        )}
        {course && schoolOn && <StartCourse course={course} className={primary === 'course' ? PRIMARY : OUTLINE} />}
        {course && !schoolOn && schoolAvailable && (
          <Link to="/apps" className={OUTLINE}>
            <Icon icon={GraduationCap} size={18} />
            Show School for the course
          </Link>
        )}
        {!course && !loading && (
          <span className="inline-flex min-h-[48px] items-center justify-center gap-xs rounded-pill bg-paper px-md text-subhead font-medium text-ink-soft">
            <Icon icon={GraduationCap} size={16} />
            Course: coming soon
          </span>
        )}
        {reward && (
          <Link to="/rewards#books" className={OUTLINE}>
            <Icon icon={Coins} size={18} />
            Redeem for {formatCount(reward.cost)} points
          </Link>
        )}
      </div>
      {loading && <StatusTag tone="neutral" className="mt-xs">Checking the shop</StatusTag>}
    </article>
  );
}

/**
 * "Start the course": a free course with an open cohort takes the seat through School's own enrol (the same call as School's
 * Enrol, so its limit and checks hold) and opens the lessons; already in opens them too. A priced course, or one with no open
 * cohort yet, goes to School, where the Enrol button shows what it costs.
 */
function StartCourse({ course, className }: { course: NonNullable<BookState['course']>; className: string }) {
  const navigate = useNavigate();
  const cohortId = course.cohortId;
  const start = useMutation({
    mutationFn: async (id: string) => {
      try {
        await api.enroll(id);
      } catch (e) {
        // 409 is "already in" (or full, which School's page then says); anything else is a real error.
        if (!(e instanceof ApiError && e.status === 409)) throw e;
      }
      return id;
    },
    onSuccess: (id) => navigate(`/school/${id}`),
  });
  if (!course.free || !cohortId) {
    return (
      <Link to="/school" className={className}>
        <Icon icon={GraduationCap} size={18} />
        Start the course
      </Link>
    );
  }
  return (
    <>
      <button type="button" className={className} onClick={() => start.mutate(cohortId)} disabled={start.isPending} aria-busy={start.isPending}>
        <Icon icon={GraduationCap} size={18} />
        Start the course
      </button>
      {start.error && <ErrorLine e={start.error} className="basis-full" />}
    </>
  );
}
