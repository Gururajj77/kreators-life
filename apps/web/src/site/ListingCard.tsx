import { LISTING_TYPE_META, MODULE_BY_KEY, type Listing } from '@kreators/shared';
import { Link } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { FactTag, IconTag } from '../components/FactTag';
import { MediaCover } from '../components/Media';
import { useSession } from '../lib/store';

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
      <div className="flex items-start gap-sm">
        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
          <AppIcon name={meta.icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-xs type-eyebrow text-ink-mute">
            <span>{meta.name}</span>
            {listing.featured && (
              <IconTag tone="warn" icon="Star">
                Featured
              </IconTag>
            )}
            {!listing.live && (
              <IconTag tone="neutral" icon="Lock">
                Not live
              </IconTag>
            )}
          </p>
          <h3 className="m-0 text-[18px] font-extrabold leading-tight">{listing.title}</h3>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{listing.by}</p>
        </div>
      </div>
      {listing.blurb && <p className="mt-sm m-0 text-[14px] font-semibold leading-snug text-ink-soft">{cardBlurb(listing.blurb)}</p>}
      {listing.facts.length > 0 && (
        // A card is a preview: the first three facts, wrapping onto a second line when they must, never a row that
        // scrolls sideways inside the card. The page itself lists every fact.
        // fill-row-all: a fact that wraps onto a line of its own spans the line instead of standing alone (the lone-pill rule).
        <ul className="fill-row-all mt-sm flex list-none flex-wrap gap-xs p-0" aria-label="Facts">
          {listing.facts.slice(0, 3).map((f, i) => (
            <li key={`${f.kind}-${i}`} className="flex max-w-full">
              <FactTag kind={f.kind} className="w-full justify-center">{f.text}</FactTag>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-md flex flex-1 flex-wrap items-end justify-between gap-xs">
        {showFeature && module ? (
          <Link to={`/features/${module.key}`} className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-ink-soft underline-offset-4 hover:underline">
            About {module.name}
          </Link>
        ) : (
          <span />
        )}
        <Link to={to} className="toy inline-flex min-h-[44px] items-center rounded-pill bg-ink px-md text-[14px] font-bold text-on-ink">
          {token ? meta.verb : `Sign in to ${meta.verb.toLowerCase()}`}
        </Link>
      </div>
    </li>
  );
}
