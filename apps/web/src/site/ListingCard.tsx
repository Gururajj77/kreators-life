import { LISTING_TYPE_META, MODULE_BY_KEY, type Listing } from '@kreators/shared';
import { Link } from 'react-router';
import { MediaCover } from '../components/Media';
import { useSession } from '../lib/store';

/** One thing on offer, with the door into the app. Signing in brings you straight back to it. */
export function ListingCard({ listing, showFeature = true }: { listing: Listing; showFeature?: boolean }) {
  const token = useSession((s) => s.token);
  const meta = LISTING_TYPE_META[listing.type];
  const module = MODULE_BY_KEY[meta.moduleKey];
  const to = token ? listing.path : `/signin?next=${encodeURIComponent(listing.path)}`;
  return (
    <li className="flex flex-col rounded-tile bg-card p-md shadow-toy-soft">
      <MediaCover items={listing.media} />
      <div className="flex items-start gap-sm">
        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 type-eyebrow text-ink-mute">
            {meta.name}
            {listing.featured && <span className="ml-xs rounded-pill bg-r3 px-xs text-[11px] leading-[18px] text-ink-fixed">Featured</span>}
            {!listing.live && <span className="ml-xs rounded-pill bg-line px-xs text-[11px] leading-[18px] text-ink">Not live</span>}
          </p>
          <h3 className="m-0 text-[18px] font-extrabold leading-tight">{listing.title}</h3>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{listing.by}</p>
        </div>
      </div>
      {listing.blurb && <p className="mt-sm m-0 line-clamp-3 text-[14px] font-semibold leading-snug text-ink-soft">{listing.blurb}</p>}
      {listing.facts.length > 0 && (
        <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
          {listing.facts.map((f) => (
            <li key={f} className="rounded-pill bg-paper px-xs text-[12px] font-bold leading-[24px] text-ink-soft">
              {f}
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
