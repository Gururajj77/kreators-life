import { LISTING_TYPE_META, MODULE_BY_KEY, MODULE_GROUP_ACCENT, type FactKind, type Listing, type ListingFact } from '@kreators/shared';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { CardHead } from '../components/CardHead';
import { FactTag, IconTag } from '../components/FactTag';
import { Icon } from '../components/Icon';
import { MediaCover } from '../components/Media';
import '../components/fx/spotlight';
import { useSession } from '../lib/store';
import { tie } from '../lib/text';

/** A grid of listing cards: one to a row on a phone, two on a tablet, three on a laptop, in even rows (evenGrid in lib/bento.ts). */
export const LISTING_COLS = { base: 1, md: 2, lg: 3 } as const;

/** A card is a preview, so its line is short: the first sentence when it is short enough, else the first words and an ellipsis. The page itself has all of it. */
function cardBlurb(text: string, max = 16): string {
  const t = text.trim().replace(/\s+/g, ' ');
  const first = t.match(/^.*?[.?!](?=\s|$)/)?.[0] ?? t;
  const words = first.split(' ');
  return words.length <= max ? first : `${words.slice(0, max).join(' ').replace(/[,;:]$/, '')}…`;
}

/** What a visitor weighs first: what it costs, then when, then where, then how many places are left. */
const FACT_ORDER: FactKind[] = ['price', 'free', 'when', 'place', 'online', 'availability', 'verified', 'status', 'category'];

/** The kind of thing (a meetup, a gig, short video) joins the eyebrow; the rest are the card's facts, most weighed first, three at most. */
function splitFacts(facts: ListingFact[], by: string): { kind: string | null; shown: ListingFact[] } {
  const cat = facts.find((f) => f.kind === 'category');
  const kind = cat && cat.text.toLowerCase() !== by.trim().toLowerCase() ? cat.text : null;
  const rest = facts.filter((f) => f !== cat);
  const shown = rest
    .map((f, i) => ({ f, i }))
    .sort((a, b) => FACT_ORDER.indexOf(a.f.kind) - FACT_ORDER.indexOf(b.f.kind) || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.f);
  return { kind, shown };
}

/**
 * One thing on offer, with the door into the app; signing in brings you straight back to it. Laid out by the app's card rules
 * (2026-11-05, the founder: "the explore page the cards are very poorly designed"): the owner's picture as a cover when there is one,
 * the kind (with the kind of thing from its category fact), the title in the card role and who it is from under it, left-aligned; the app's
 * icon in its pillar's soft colour in the top right corner, with Featured and Not live before it; then one foot with up to three facts stacked on the left (price first) and the arrow on the right. The whole card is one
 * link (the title's link stretched over it), so there is one thing to tap; with `showFeature` the app's icon is its own small link to
 * that app's feature page, laid over the card.
 */
export function ListingCard({ listing, showFeature = true, className = '' }: { listing: Listing; showFeature?: boolean; /** Its span in an even grid (lib/bento.ts). */ className?: string }) {
  const token = useSession((s) => s.token);
  const meta = LISTING_TYPE_META[listing.type];
  const module = MODULE_BY_KEY[meta.moduleKey];
  const accent = module?.accent ?? (module ? MODULE_GROUP_ACCENT[module.group] : undefined);
  const to = token ? listing.path : `/signin?next=${encodeURIComponent(listing.path)}`;
  const verb = token ? meta.verb : `Sign in to ${meta.verb.toLowerCase()}`;
  const hasCover = Boolean(listing.media?.some((m) => m.url));
  const { kind, shown } = splitFacts(listing.facts, listing.by);

  const tileLook = 'flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink';
  const tileStyle = { background: accent ? `var(--soft-${accent})` : 'var(--color-line)' };
  const lead =
    showFeature && module ? (
      <Link to={`/features/${module.key}`} aria-label={`About ${module.name}`} title={`About ${module.name}`} className={`relative z-[1] ${tileLook}`} style={tileStyle}>
        <AppIcon name={meta.icon} size={20} />
      </Link>
    ) : (
      <span className={tileLook} style={tileStyle} aria-hidden="true">
        <AppIcon name={meta.icon} size={20} />
      </span>
    );

  const marks =
    listing.featured || !listing.live ? (
      <>
        {listing.featured && (
          <IconTag tone="warn" icon="Star" fit>
            Featured
          </IconTag>
        )}
        {!listing.live && (
          <IconTag tone="neutral" icon="Lock" fit>
            Not live
          </IconTag>
        )}
      </>
    ) : null;

  return (
    <li
      data-pillar={accent}
      className={`fx-spot toy toy-soft group flex min-w-0 flex-col rounded-card bg-card p-md text-ink has-[.listing-go:focus-visible]:outline-3 has-[.listing-go:focus-visible]:outline-offset-3 has-[.listing-go:focus-visible]:outline-[color:var(--deep-self)] ${className}`}
    >
      {/* The cover sits inside the card's padding, its corners concentric with the card's (32 less 16). */}
      {hasCover && (
        <div className="[&>*]:rounded-inner">
          <MediaCover items={listing.media} title={listing.title} />
        </div>
      )}
      {/* The app's icon in the top right corner, any Featured or Not live mark just before it; the words start at the card's left
          edge (the founder, 2026-11-05: "put icons on top right of each card in explore, let that text be left aligned"). */}
      <CardHead
        tag={
          <span className="flex min-w-0 items-center gap-xs">
            {marks}
            {lead}
          </span>
        }
      >
        {/* The kind of listing and the kind of thing, each part kept whole, so a narrow card breaks after the comma, never mid-part. */}
        <p className="m-0 type-eyebrow text-ink-mute">
          <span className="inline-block">{kind ? `${meta.name},` : meta.name}</span>
          {kind && (
            <>
              {' '}
              <span className="inline-block">{kind}</span>
            </>
          )}
        </p>
        <h3 className="m-0 text-card-title text-balance">
          {/* The one link: its ::after covers the whole card, so a tap anywhere opens the listing. */}
          <Link to={to} aria-label={`${listing.title}: ${verb}`} className="listing-go text-ink no-underline after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none">
            {tie(listing.title)}
          </Link>
        </h3>
        {listing.by && <p className="mb-0 text-card-note text-ink-soft">{listing.by}</p>}
      </CardHead>
      {listing.blurb && <p className="mt-sm m-0 text-card-note text-ink-soft">{cardBlurb(listing.blurb)}</p>}
      {/* One foot: the facts stacked on the left, each at its own width (a short spec list, so no chip is stretched or left alone
          on a wrapped line), the arrow at the right, level with the last fact. mt-auto lines the feet up across a row of cards. */}
      <div className="mt-auto flex items-end justify-between gap-sm pt-md">
        {shown.length > 0 ? (
          <ul className="m-0 flex min-w-0 list-none flex-col items-start gap-xs p-0" aria-label="Facts">
            {shown.map((f, i) => (
              <li key={`${f.kind}-${i}`} className="flex min-w-0 max-w-full">
                <FactTag kind={f.kind} fit>
                  {f.text}
                </FactTag>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-card-note text-ink-soft">{verb}</span>
        )}
        <Icon icon={ArrowUpRight} size={16} className="read-arrow mb-[4px] shrink-0 text-ink-mute" />
      </div>
    </li>
  );
}
