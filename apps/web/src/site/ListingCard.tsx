import { LISTING_TYPE_META, MODULE_BY_KEY, type Listing } from '@kreators/shared';
import { Link } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { FactTag, IconTag } from '../components/FactTag';
import { MediaCover } from '../components/Media';
import { useSession } from '../lib/store';

/** One thing on offer, with the door into the app. Signing in brings you straight back to it. */
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
      {listing.blurb && <p className="mt-sm m-0 text-[14px] font-semibold leading-snug text-ink-soft text-pretty">{listing.blurb}</p>}
      {listing.facts.length > 0 && (
        // One line that scrolls sideways, never a wrapped row that leaves one tag alone on the line under it.
        <div className="mt-sm">
          <ul className="scroll-row scroll-fade list-none" aria-label="Facts">
          {listing.facts.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="flex shrink-0">
              <FactTag kind={f.kind}>{f.text}</FactTag>
            </li>
          ))}
          </ul>
        </div>
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
