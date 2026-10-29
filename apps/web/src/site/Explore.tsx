import { LISTING_TYPE_META, LISTING_TYPES, type ListingType } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { publicApi } from '../lib/api';
import { ListingCard } from './ListingCard';
import { SiteLayout } from './SiteLayout';

const isType = (v: string | null): v is ListingType => Boolean(v && (LISTING_TYPES as readonly string[]).includes(v));

/** Everything on offer, searchable without an account. */
export function Explore() {
  const [params, setParams] = useSearchParams();
  const type = isType(params.get('type')) ? (params.get('type') as ListingType) : undefined;
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced) next.set('q', debounced);
    else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [debounced, params, setParams]);

  const results = useQuery({ queryKey: ['explore', debounced, type ?? ''], queryFn: () => publicApi.explore({ q: debounced, type, limit: 100 }) });
  const list = results.data?.listings ?? [];

  const setType = (t: ListingType | undefined) => {
    const next = new URLSearchParams(params);
    if (t) next.set('type', t);
    else next.delete('type');
    setParams(next, { replace: true });
  };

  return (
    <SiteLayout>
      <header className="pt-lg">
        <h1 className="type-hook text-[clamp(40px,9vw,72px)]">Explore</h1>
        <p className="mt-xs m-0 max-w-[640px] text-[16px] font-semibold text-ink-soft">Content rewards, opportunities, events, programs, tools and campaigns. Search here, then sign in to join, apply or submit. You come straight back to the one you picked.</p>
        <label className="mt-md block">
          <span className="sr-only">Search listings</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by brand, title, skill or place"
            className="w-full rounded-pill border-2 border-line bg-card px-md py-sm text-[18px] font-semibold shadow-toy-soft"
          />
        </label>
        <div className="mt-sm flex flex-wrap gap-xs" role="group" aria-label="Type">
          <button type="button" aria-pressed={!type} onClick={() => setType(undefined)} className={`toy min-h-[40px] rounded-pill border-2 px-sm text-[14px] font-bold ${!type ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            Everything
          </button>
          {LISTING_TYPES.map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`toy min-h-[40px] rounded-pill border-2 px-sm text-[14px] font-bold ${type === t ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              <span aria-hidden="true">{LISTING_TYPE_META[t].emoji} </span>
              {LISTING_TYPE_META[t].plural}
            </button>
          ))}
        </div>
      </header>

      <section className="mt-lg" aria-live="polite">
        {results.isPending && <p className="m-0 text-[16px] font-semibold text-ink-soft">Looking…</p>}
        {results.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            Could not load listings. Try again in a moment.
          </p>
        )}
        {results.data && list.length === 0 && (
          <p className="m-0 rounded-tile bg-card p-md text-[16px] font-semibold text-ink-soft shadow-toy-soft">
            Nothing matches yet. {debounced ? 'Try fewer words, or a different type.' : 'The team adds listings from the admin console; check back soon.'}
          </p>
        )}
        {list.length > 0 && (
          <>
            <p className="m-0 text-[14px] font-bold text-ink-soft">
              {list.length} {list.length === 1 ? 'listing' : 'listings'}
            </p>
            <ul className="mt-sm grid list-none gap-sm p-0 m-0 md:grid-cols-2 lg:grid-cols-3">
              {list.map((l) => (
                <ListingCard key={`${l.type}-${l.id}`} listing={l} />
              ))}
            </ul>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
