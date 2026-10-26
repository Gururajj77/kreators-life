import { PRODUCT_KIND_META, type Page, type Product } from '@kreators/shared';
import { Link } from 'react-router';
import { BackLink } from '../components/PageHeader';
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
      <h2 className="text-[24px]">{title}</h2>
      {items && items.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">None listed yet.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {items?.map((p) => (
          <li key={p.id}>
            <Link to={`/p/${p.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
              <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
                {p.cover || PRODUCT_KIND_META[p.kind].emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{p.title}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">
                  {p.ownerName}
                  {p.kind === 'session' ? `, ${p.durationMin} min` : p.startsAt ? `, ${new Date(p.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-extrabold">{p.pricePoints === 0 && p.priceCents === 0 ? 'Free' : `${p.pricePoints} pts`}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={page} prefix={prefix} label={title.toLowerCase()} />
    </section>
  );
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Sessions</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">One-to-one time with guides and creators, and live events with a date.</p>
      </header>
      {upcoming.length > 0 && (
        <section className="mt-md rounded-card bg-card p-md shadow-toy-soft">
          <h2 className="text-[18px]">Coming up for you</h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {upcoming.map((b) => (
              <li key={b.id} className="text-[14px] font-semibold">
                <span className="font-bold">{b.productTitle}</span> with {b.ownerName}, {new Date(b.startsAt).toLocaleString()} UTC, {b.status}
              </li>
            ))}
          </ul>
          <Link to="/library" className="mt-sm inline-block text-[14px] font-bold underline underline-offset-4">
            Manage in my purchases
          </Link>
        </section>
      )}
      {list('One-to-one sessions', sessions.data?.products, sessions.data?.page, 's')}
      {list('Events', events.data?.products, events.data?.page, 'e')}
    </Screen>
  );
}
