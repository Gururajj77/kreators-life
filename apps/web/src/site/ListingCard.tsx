import { LISTING_TYPE_META, MODULE_BY_KEY, type Listing } from '@kreators/shared';
import { Link } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { FactTag, IconTag } from '../components/FactTag';
import { CardHead } from '../components/CardHead';
import { MediaCover } from '../components/Media';
import { useSession } from '../lib/store';
import { SITE_CHIP_BASE, SITE_LINK } from './buttons';

/** One thing on offer, with the door into the app. Signing in brings you straight back to it. */
/** A card is a preview, so its line is short: the first sentence when it is short enough, else the first words and an ellipsis. The page itself has all of it. */
function cardBlurb(text: string, max = 24): string {
  const t = text.trim().replace(/\s+/g, ' ');
  const first = t.match(/^.*?[.?!](?=\s|$)/)?.[0] ?? t;
  const words = first.split(' ');
  return words.length <= max ? first : `${words.slice(0, max).join(' ').replace(/[,;:]$/, '')}…`;
}

export function ListingCard({ listing, showFeature = true }: { listing: Listing; showFeature?: boolean }) {
  const token = useSession((s) => s.token);
  const meta = LISTING_TYPE_META[listing.type];
  const module = MODULE_BY_KEY[meta.moduleKey];
  const to = token ? listing.path : `/signin?next=${encodeURIComponent(listing.path)}`;
  return (
    <li className="flex min-w-0 flex-col rounded-tile bg-card p-md shadow-toy-soft">
      <MediaCover items={listing.media} title={listing.title} />
      {/* The words start at the top left; the top right corner holds the kind's icon, with any marks (Featured, Not live) beside it. */}
      <CardHead
        tag={
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
            <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
              <AppIcon name={meta.icon} size={22} />
            </span>
          </>
        }
      >
        <p className="m-0 type-eyebrow text-ink-mute">{meta.name}</p>
        <h3 className="m-0 text-headline">{listing.title}</h3>
        <p className="m-0 text-subhead text-ink-soft">{listing.by}</p>
      </CardHead>
      {listing.blurb && <p className="mt-sm m-0 text-subhead text-ink-soft">{cardBlurb(listing.blurb)}</p>}
      {listing.facts.length > 0 && (
        // A card is a preview: the first three facts, wrapping onto a second line when they must, never a row that
        // scrolls sideways inside the card. The page itself lists every fact.
        // fill-row-all: a fact that wraps onto a line of its own spans the line instead of standing alone (the lone-pill rule).
        // mt-auto: the facts sit at the foot of the card, just above its actions, so they line up across a row of cards.
        <ul className="fill-row-all mt-auto flex list-none flex-wrap gap-xs p-0 pt-md" aria-label="Facts">
          {listing.facts.slice(0, 3).map((f, i) => (
            <li key={`${f.kind}-${i}`} className="flex max-w-full">
              <FactTag kind={f.kind} className="w-full justify-center">{f.text}</FactTag>
            </li>
          ))}
        </ul>
      )}
      {/* No column gap: justify-between already parts the two, and a gap made "About Win" and "Sign in to submit a video" wrap by 2px
          at the laptop's 309px card, which lifted that card's facts out of line with its row. */}
      <div className={`${listing.facts.length > 0 ? 'mt-md' : 'mt-auto pt-md'} flex flex-wrap items-end justify-between gap-y-xs`}>
        {showFeature && module ? (
          <Link to={`/features/${module.key}`} className={`${SITE_LINK} text-subhead`}>
            About {module.name}
          </Link>
        ) : (
          <span />
        )}
        <Link to={to} className={`${SITE_CHIP_BASE} px-md`}>
          {token ? meta.verb : `Sign in to ${meta.verb.toLowerCase()}`}
        </Link>
      </div>
    </li>
  );
}
