import { LISTING_TYPE_META, LISTING_TYPES, MODULE_BY_KEY, formatCount, type ListingType } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { Pager, usePage } from '../components/Pager';
import { publicApi } from '../lib/api';
import { chip } from '../lib/ui';
import { SITE_LINK } from './buttons';
import { ListingCard } from './ListingCard';
import { SiteLayout } from './SiteLayout';
import { TabRow } from '../components/TabRow';

const TYPE_ITEMS: { key: ListingType | 'all'; label: ReactNode; name: string }[] = [
  { key: 'all', label: 'Everything', name: 'Everything' },
  ...LISTING_TYPES.map((t) => ({
    key: t,
    name: LISTING_TYPE_META[t].plural,
    label: (
      <>
        <AppIcon name={LISTING_TYPE_META[t].icon} size={16} />
        {LISTING_TYPE_META[t].plural}
      </>
    ),
  })),
];

const isType = (v: string | null): v is ListingType => Boolean(v && (LISTING_TYPES as readonly string[]).includes(v));

/** Everything on offer, searchable without an account. */
export function Explore() {
  const [params, setParams] = useSearchParams();
  const type = isType(params.get('type')) ? (params.get('type') as ListingType) : undefined;
  const [q, setQ] = useState(params.get('q') ?? '');
  const pg = usePage();
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced) next.set('q', debounced);
    else next.delete('q');
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true, preventScrollReset: true });
      pg.reset();
    }
    // A new search starts back on the first page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const results = useQuery({
    queryKey: ['explore', debounced, type ?? '', pg.query],
    queryFn: () => publicApi.explore({ q: debounced, type, pq: pg.query }),
  });
  const list = results.data?.listings ?? [];
  const about = type ? MODULE_BY_KEY[LISTING_TYPE_META[type].moduleKey] : undefined;

  const setType = (t: ListingType | undefined) => {
    const next = new URLSearchParams(params);
    if (t) next.set('type', t);
    else next.delete('type');
    setParams(next, { replace: true, preventScrollReset: true });
    pg.reset();
  };

  return (
    <SiteLayout>
      <header className="pt-lg">
        <h1 className="type-hook text-display-1">Explore</h1>
        <p className="mt-xs m-0 max-w-[640px] text-callout text-ink-soft">
          Search here, then sign in to join, apply or submit. You come straight back to the one you picked.
        </p>
        <label className="mt-md block">
          <span className="sr-only">Search listings</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by brand, title, skill or place"
            className="w-full rounded-pill border-2 border-line bg-card px-md py-sm text-headline shadow-toy-soft"
          />
        </label>
        {/* One line: as many types as fit, the rest behind More, so none is cut or left alone on a second line. */}
        <div className="mt-sm">
          <TabRow
            label="Type"
            items={TYPE_ITEMS}
            value={type ?? 'all'}
            onChange={(k) => setType(k === 'all' ? undefined : k)}
            pillClass={(on) => `${chip(on)} gap-xs`}
          />
        </div>
      </header>

      <section className="mt-lg" aria-live="polite">
        {results.isPending && <p className="m-0 text-callout text-ink-soft">Looking…</p>}
        {results.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            Could not load listings. Try again in a moment.
          </p>
        )}
        {results.data && list.length === 0 && (
          <p className="m-0 rounded-tile bg-card p-md text-callout text-ink-soft shadow-toy-soft">
            {debounced ? 'Nothing matches. Try fewer words, or a different type.' : 'Nothing here yet. The team adds new listings; check back soon.'}
          </p>
        )}
        {list.length > 0 && (
          <>
            {/* The count on the left; with one kind picked, the way to read about its app on the right (each card's icon links there too). */}
            <div className="flex flex-wrap items-center justify-between gap-x-sm">
              <p className="m-0 text-subhead text-ink-soft">
                {formatCount(list.length)} {list.length === 1 ? 'listing' : 'listings'}
              </p>
              {about && (
                <Link to={`/features/${about.key}`} className={`${SITE_LINK} text-subhead`}>
                  About {about.name}
                </Link>
              )}
            </div>
            <ul className="mt-sm grid list-none gap-sm p-0 m-0 md:grid-cols-2 lg:grid-cols-3">
              {list.map((l) => (
                <ListingCard key={`${l.type}-${l.id}`} listing={l} />
              ))}
            </ul>
            <Pager page={results.data?.page} label="listings" />
          </>
        )}
      </section>
    </SiteLayout>
  );
}
