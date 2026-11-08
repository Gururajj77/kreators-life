import { PRODUCT_KIND_META, productHasOwnCover, type Page, type Product } from '@kreators/shared';
import { dateTime, shortDate } from '../lib/date';
import { Link } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed, useLibrary } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';

export function Sessions() {
  const sp = usePage('s');
  const ep = usePage('e');
  const sessions = useAuthed(['browse', 'session', sp.query], () => api.browse('session', sp.query));
  const events = useAuthed(['browse', 'event', ep.query], () => api.browse('event', ep.query));
  const lib = useLibrary();
  const upcoming = (lib.data?.bookings ?? []).filter((b) => b.status === 'requested' || b.status === 'confirmed');
  const list = (title: string, items: Product[] | undefined, page: Page | undefined, prefix: string) => (
    <section className="mt-lg">
      <h2 className="text-title2">{title}</h2>
      {items && items.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">None listed yet.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {items?.map((p) => (
          <li key={p.id}>
            <Link to={`/p/${p.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
              <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
                {productHasOwnCover(p.kind, p.cover) ? p.cover : <AppIcon name={PRODUCT_KIND_META[p.kind].icon} size={22} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-card-title">{p.title}</span>
                <span className="block text-card-note text-ink-soft">
                  {p.ownerName}
                  {p.kind === 'session' ? `, ${p.durationMin} min` : p.startsAt ? `, ${shortDate(p.startsAt)}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-subhead font-semibold">{p.pricePoints === 0 && p.priceCents === 0 ? 'Free' : `${p.pricePoints} pts`}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={page} prefix={prefix} label={title.toLowerCase()} />
    </section>
  );
  return (
    <Screen>
      <AppCover back={{ to: '/apps', label: 'Apps' }} title="Sessions" lede="One-to-one time with guides and creators, and live events with a date." />
      {upcoming.length > 0 && (
        <section className="mt-md rounded-card bg-card p-md shadow-toy-soft">
          <h2 className="text-title3">Coming up for you</h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {upcoming.map((b) => (
              <li key={b.id} className="text-subhead">
                <span className="font-semibold">{b.productTitle}</span> with {b.ownerName}, {dateTime(b.startsAt)} your time, {b.status}
              </li>
            ))}
          </ul>
          <Link to="/library" className="mt-sm inline-block text-subhead font-semibold underline underline-offset-4">
            Manage in my purchases
          </Link>
        </section>
      )}
      {list('One-to-one sessions', sessions.data?.products, sessions.data?.page, 's')}
      {list('Events', events.data?.products, events.data?.page, 'e')}
    </Screen>
  );
}
