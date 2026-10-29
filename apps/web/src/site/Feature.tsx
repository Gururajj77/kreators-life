import { LISTING_TYPE_META, RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Link, Navigate, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { publicApi } from '../lib/api';
import { useSession } from '../lib/store';
import { featureFor, SITE_FEATURES } from './content';
import { ListingCard } from './ListingCard';
import { SiteLayout } from './SiteLayout';

/** One public page per part of the app. Each ends at the door into that part. */
export function Feature() {
  const { key = '' } = useParams();
  const token = useSession((s) => s.token);
  const found = featureFor(key);
  const listingType = found?.copy.listing;
  const listings = useQuery({ queryKey: ['explore', 'feature', listingType ?? ''], queryFn: () => publicApi.explore({ type: listingType, limit: 12 }), enabled: Boolean(listingType) });
  if (!found) return <Navigate to="/" replace />;
  const { module, copy } = found;
  const lead = RELATIONSHIP_BY_KEY[copy.relationships[0] ?? 'self'];
  const open = token ? module.path : `/signin?next=${encodeURIComponent(module.path)}`;
  const others = SITE_FEATURES.filter((m) => m.group === module.group && m.key !== module.key).slice(0, 6);

  return (
    <SiteLayout>
      <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-lg grid gap-md rounded-card p-md md:grid-cols-[2fr_1fr] md:items-center md:p-lg" style={{ background: `var(--soft-${lead.key})` }}>
        <div>
          <Link to="/#features" className="inline-flex min-h-[44px] items-center gap-xs text-[14px] font-bold text-ink-soft">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            All features
          </Link>
          <p className="m-0 text-[40px] leading-none" aria-hidden="true">
            {module.emoji}
          </p>
          <h1 className="mt-xs text-[clamp(36px,6vw,56px)] leading-[1.02]">{module.name}</h1>
          <p className="mt-xs m-0 text-[20px] font-extrabold" style={{ color: `var(--deep-${lead.key})` }}>
            {copy.tagline}
          </p>
          <p className="mt-sm m-0 max-w-[560px] text-[16px] font-semibold leading-snug text-ink-soft">{copy.pitch}</p>
          <div className="mt-md flex flex-wrap gap-sm">
            <Link to={open} className="toy inline-flex min-h-[56px] items-center rounded-pill bg-ink px-lg text-[18px] font-bold text-on-ink">
              {token ? `Open ${module.name}` : `Sign in to open ${module.name}`}
            </Link>
            {!token && (
              <Link to="/start" className="toy toy-ink inline-flex min-h-[56px] items-center rounded-pill border-2 border-ink bg-card px-lg text-[18px] font-bold">
                Start free
              </Link>
            )}
          </div>
        </div>
        <div className="flex justify-center" aria-hidden="true">
          <Avatar relationship={lead.key} size={180} mood="excited" />
        </div>
      </motion.header>

      <section className="mt-lg grid gap-sm md:grid-cols-3" aria-label="How it goes">
        {copy.steps.map((s, i) => (
          <motion.div key={s} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="rounded-tile bg-card p-md shadow-toy-soft">
            <p className="m-0 font-display text-[28px] font-extrabold leading-none" style={{ color: lead.color }}>
              {i + 1}
            </p>
            <p className="mt-xs m-0 text-[16px] font-bold leading-snug">{s}</p>
          </motion.div>
        ))}
      </section>

      <section className="mt-lg" aria-labelledby="serves">
        <h2 id="serves" className="text-[24px]">
          Which pillars it serves
        </h2>
        <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
          {copy.relationships.map((k) => {
            const r = RELATIONSHIP_BY_KEY[k];
            return (
              <li key={k}>
                <a href={`/#floors`} className="toy toy-soft inline-flex min-h-[48px] items-center gap-xs rounded-pill bg-card pr-md pl-xs text-[14px] font-bold">
                  <Avatar relationship={k} size={32} decorative />
                  {r.name}
                  <span className="text-ink-soft">floor {r.floor}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {listingType && (
        <section className="mt-lg" aria-labelledby="open-now">
          <div className="flex flex-wrap items-end justify-between gap-sm">
            <h2 id="open-now" className="text-[24px]">
              {LISTING_TYPE_META[listingType].plural} open now
            </h2>
            <Link to={`/explore?type=${listingType}`} className="inline-flex min-h-[44px] items-center text-[14px] font-bold underline-offset-4 hover:underline">
              See all in Explore
            </Link>
          </div>
          {listings.data && listings.data.listings.length === 0 && <p className="mt-sm m-0 rounded-tile bg-card p-md text-[16px] font-semibold text-ink-soft shadow-toy-soft">None listed at the moment. New ones appear here the moment they are published.</p>}
          {listings.data && listings.data.listings.length > 0 && (
            <ul className="mt-sm grid list-none gap-sm p-0 m-0 md:grid-cols-2 lg:grid-cols-3">
              {listings.data.listings.map((l) => (
                <ListingCard key={`${l.type}-${l.id}`} listing={l} showFeature={false} />
              ))}
            </ul>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-lg" aria-labelledby="more">
          <h2 id="more" className="text-[24px]">
            More in this group
          </h2>
          <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
            {others.map((m) => (
              <li key={m.key}>
                <Link to={`/features/${m.key}`} className="toy toy-soft inline-flex min-h-[44px] items-center gap-xs rounded-pill bg-card px-sm text-[14px] font-bold">
                  <span aria-hidden="true">{m.emoji}</span>
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </SiteLayout>
  );
}
