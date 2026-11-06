import { usePillarAccent } from '../lib/usePillarAccent';
import type { CSSProperties } from 'react';
import { LISTING_TYPE_META, MODULE_GROUP_ACCENT, RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { m as motion } from 'motion/react';
import { BackLink } from '../components/PageHeader';
import { Link, Navigate, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { publicApi } from '../lib/api';
import { useSession } from '../lib/store';
import { keepTail } from '../lib/textNodes';
import { featureFor, SITE_FEATURES } from './content';
import { ListingCard } from './ListingCard';
import { GuideLine } from './GuideLine';
import { useRise } from './SevenRP';
import { SiteLayout } from './SiteLayout';
import { AppIcon } from '../components/AppIcon';
import { Fold } from '../components/Fold';
import { Books } from './Books';
import { SiteArrow, SITE_CHIP, SITE_CHIP_BASE, SITE_LINK, SITE_PRIMARY, SITE_SECONDARY } from './buttons';

/** The rest of a feature's story: one short fact a line, as a list (CopyOS: lists for features, paragraphs only for a story). */
function MoreList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 grid list-disc gap-xs pl-md text-callout text-ink-soft">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/**
 * One public page per part of the app. Each ends at the door into that part. `/features/books` is the founder's books, which are
 * not an app of their own: a separate component, so moving between it and an app's page never changes the hooks a page calls.
 */
export function Feature() {
  const { key = '' } = useParams();
  return key === 'books' ? <Books /> : <FeaturePage />;
}

function FeaturePage() {
  const { key = '' } = useParams();
  const token = useSession((s) => s.token);
  const found = featureFor(key);
  // The page wears the colour of the pillar this app serves first, so its buttons hover in it.
  usePillarAccent(found?.copy.relationships[0] ?? null);
  const rise = useRise();
  const listingType = found?.copy.listing;
  const listings = useQuery({
    queryKey: ['explore', 'feature', listingType ?? ''],
    queryFn: () => publicApi.explore({ type: listingType }),
    enabled: Boolean(listingType),
  });
  if (!found) return <Navigate to="/" replace />;
  const { module, copy } = found;
  const lead = RELATIONSHIP_BY_KEY[copy.relationships[0] ?? 'self'];
  const open = token ? module.path : `/signin?next=${encodeURIComponent(module.path)}`;
  const others = SITE_FEATURES.filter((m) => m.group === module.group && m.key !== module.key).slice(0, 6);

  return (
    <SiteLayout>
      {/* The guide sits beside the words only from 1200px, where it stands in the margin; narrower, a 128px guide beside them left its
          line a word or two wide, so it sits under them, at the right. */}
      <motion.header
        data-pillar={lead.key}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="wash mt-lg grid gap-md rounded-card bg-card p-md shadow-toy-soft min-[1200px]:grid-cols-[3fr_2fr] min-[1200px]:items-center md:p-lg"
        style={{ '--wash': lead.color } as CSSProperties}
      >
        <div>
          <BackLink to="/features">All features</BackLink>
          <p className="m-0 flex" style={{ color: `var(--deep-${lead.key})` }}>
            <AppIcon name={module.icon} size={40} />
          </p>
          <h1 className="type-hook mt-xs text-display-1">{module.name}</h1>
          <p className="mt-sm m-0 max-w-[560px] text-callout text-ink-soft">{copy.pitch}</p>
          {copy.more && copy.more.length > 0 && (
            <>
              {/* A phone keeps the first screen light: the rest of the story waits under a fold. A laptop shows it open, under the buttons. */}
              <Fold title={`More about ${module.name}`} className="mt-sm max-w-[560px] md:hidden">
                <MoreList items={copy.more} />
              </Fold>
            </>
          )}
          {/* One main action (the site's button system, site/buttons.ts): Start free for a visitor, with signing in as the second look; Open for someone signed in. */}
          <div className="mt-md flex flex-wrap items-center gap-sm">
            {token ? (
              <Link to={open} className={SITE_PRIMARY}>
                Open {module.name}
              </Link>
            ) : (
              <>
                <Link to="/start" className={SITE_PRIMARY}>
                  Start free
                </Link>
                <Link to={open} className={SITE_SECONDARY}>
                  Sign in to open {module.name}
                  <SiteArrow />
                </Link>
              </>
            )}
          </div>
          {/* The action comes before the explanation: on a laptop the rest of the story sits under the buttons. */}
          {copy.more && copy.more.length > 0 && (
            <div className="hidden md:block mt-md max-w-[560px]">
              <MoreList items={copy.more} />
            </div>
          )}
        </div>
        {/* The guide of the app's first pillar says what it is for, in one line: the tagline, in their voice. */}
        <GuideLine host={lead.key} side="right" mood="excited" size={128} className="justify-self-stretch">
          {/* Each part up to a comma or full stop kept whole, so a line breaks there on purpose ("Seven pillars," / "one life."). */}
          {copy.tagline.split(/(?<=[,.]) /).map((part, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <span className="inline-block">{part}</span>
            </span>
          ))}
        </GuideLine>
      </motion.header>

      {/* Three equal steps (every app has three): the old wide first step held one line in a box its neighbours stretched to four. */}
      <section className="mt-lg grid gap-sm sm:grid-cols-3" aria-label="How it goes">
        {copy.steps.map((s, i) => (
          // Only the lift animates; a step is never hidden, so a step below the fold (or a screenshot) never shows an empty card.
          <motion.div
            key={s}
            {...rise}
            className="rounded-tile bg-card p-md shadow-toy-soft"
          >
            {/* The deep token, not the raw relationship colour: the raw colour reads too faint on a thin glass card in dark mode. */}
            <p className="m-0 type-hook text-display-3 leading-none" style={{ color: `var(--deep-${lead.key})` }}>
              {i + 1}
            </p>
            <p className="mt-xs m-0 text-headline">{keepTail(s)}</p>
          </motion.div>
        ))}
      </section>

      <section className="mt-lg" aria-labelledby="serves">
        <h2 id="serves" className="text-title2 font-medium">
          Which pillars it serves
        </h2>
        <ul className="fill-row-all mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
          {copy.relationships.map((k) => {
            const r = RELATIONSHIP_BY_KEY[k];
            return (
              <li key={k} data-pillar={k}>
                <Link to={`/7rp?pillar=${k}`} className={`${SITE_CHIP_BASE} min-h-[48px] w-full pr-md pl-xs`}>
                  <Avatar relationship={k} size={32} decorative />
                  {r.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {listingType && (
        <section className="mt-lg" aria-labelledby="open-now">
          {/* "See all" level with the title at the top of the block, as Section's action: a box one title line tall, the link centred on it. */}
          <div className="flex items-start justify-between gap-sm">
            <h2 id="open-now" className="min-w-0 text-title2 font-medium">
              {LISTING_TYPE_META[listingType].plural} open now
            </h2>
            <div className="flex h-[1.2em] shrink-0 items-center text-[24px] leading-none">
              <Link to={`/explore?type=${listingType}`} className={`${SITE_LINK} text-subhead`}>
                See all in Explore
              </Link>
            </div>
          </div>
          {listings.data && listings.data.listings.length === 0 && (
            <p className="mt-sm m-0 rounded-tile bg-card p-md text-callout text-ink-soft shadow-toy-soft">
              None listed right now.
            </p>
          )}
          {listings.data && listings.data.listings.length > 0 && (
            <ul className="mt-sm grid list-none gap-sm p-0 m-0 md:grid-cols-2 lg:grid-cols-3">
              {listings.data.listings.slice(0, 12).map((l) => (
                <ListingCard key={`${l.type}-${l.id}`} listing={l} showFeature={false} />
              ))}
            </ul>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-lg" aria-labelledby="more" data-pillar={MODULE_GROUP_ACCENT[module.group]}>
          <h2 id="more" className="text-title2 font-medium">
            More in this group
          </h2>
          <ul className="fill-row-all mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
            {others.map((m) => (
              <li key={m.key}>
                <Link to={`/features/${m.key}`} className={`${SITE_CHIP} w-full`}>
                  <AppIcon name={m.icon} size={16} />
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
