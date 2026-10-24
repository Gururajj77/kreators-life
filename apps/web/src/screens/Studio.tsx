import { PRODUCT_KIND_META, PRODUCT_KINDS, type Booking, type Product, type ProductKind } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll, useStudio } from '../lib/queries';

export function Studio({ tab = 'home' }: { tab?: 'home' | 'page' | 'bookings' | 'reviews' | 'audience' | 'content' | 'automations' | 'customers' | 'dm' }) {
  const me = useMe();
  const q = useStudio();
  const refresh = useRefreshAll();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const d = q.data;
  const handle = me.data?.user.handle ?? null;

  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Shop</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          Sell downloads, courses, memberships, sessions, events, payment links, bundles, locked posts and priority DMs. Points work today; money checkout is in test mode until a payment provider is connected.
        </p>
        <nav className="mt-md flex gap-xs overflow-x-auto pb-xs scrollbar-none" aria-label="Shop sections">
          {(
            [
              ['home', 'Overview', '/shop'],
              ['page', 'My page', '/shop/page'],
              ['bookings', 'Bookings', '/shop/bookings'],
              ['reviews', 'Reviews', '/shop/testimonials'],
              ['audience', 'Audience', '/shop/audience'],
              ['content', 'Content', '/shop/content'],
              ['automations', 'Auto-DM', '/shop/automations'],
              ['customers', 'Customers', '/shop/customers'],
              ['dm', 'Priority DMs', '/shop/dm'],
            ] as const
          ).map(([k, label, to]) => (
            <Link key={k} to={to} aria-current={tab === k ? 'page' : undefined} className={`inline-flex min-h-[44px] shrink-0 items-center rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${tab === k ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {tab === 'home' && d && (
        <>
          <section className="mt-md grid grid-cols-3 gap-xs" aria-label="Numbers">
            {[
              ['page views', d.analytics.views],
              ['followers', d.analytics.followers],
              ['leads', d.analytics.leads],
              ['orders', d.analytics.orders],
              ['points earned', d.analytics.pointsEarned],
              ['affiliate points', d.analytics.affiliatePoints],
              ['sales via links', d.analytics.attributed],
              ['profile direct', d.analytics.direct],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 font-display text-[24px] font-extrabold leading-none">{value}</p>
                <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
              </div>
            ))}
          </section>
          {d.analytics.centsEarned > 0 && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Plus {(d.analytics.centsEarned / 100).toFixed(2)} in test-mode money orders.</p>}
          <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
            See which post each sale came from under{' '}
            <Link to="/shop/content" className="underline underline-offset-4">
              Content
            </Link>
            .
          </p>

          <section className="mt-lg" aria-labelledby="products-heading">
            <div className="flex items-center justify-between gap-sm">
              <h2 id="products-heading" className="text-[24px]">
                Products
              </h2>
              <Button onClick={() => setCreating(true)}>New product</Button>
            </div>
            {!handle && (
              <p className="mt-sm m-0 rounded-tile bg-r3 p-sm text-[14px] font-bold text-ink-fixed">
                Pick a page name under{' '}
                <Link to="/profile" className="underline underline-offset-4">
                  My page
                </Link>{' '}
                so people can find your products.
              </p>
            )}
            {d.products.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing yet. Start with a download or a session.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.products.map((p) => (
                <li key={p.id}>
                  <Link to={`/shop/products/${p.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
                    <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
                      {p.cover || PRODUCT_KIND_META[p.kind].emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold">{p.title}</span>
                      <span className="block text-[14px] font-semibold text-ink-soft">
                        {PRODUCT_KIND_META[p.kind].name}, {p.status}, {p.sold} sold
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-extrabold">{p.pricePoints} pts</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {d.orders.length > 0 && (
            <section className="mt-lg" aria-labelledby="orders-heading">
              <h2 id="orders-heading" className="text-[24px]">
                Recent orders
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.orders.map((o) => (
                  <li key={o.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[16px] font-bold">
                      {o.buyerName} got {o.productTitle}
                    </p>
                    <p className="m-0 text-[14px] font-semibold text-ink-soft">
                      {o.points > 0 ? `${o.points} points` : `${(o.cents / 100).toFixed(2)} ${o.currency}, ${o.status}`}
                      {o.couponCode ? `, coupon ${o.couponCode}` : ''}
                      {o.affiliateCode ? `, via affiliate` : ''}, {new Date(o.createdAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'page' && <PageTab />}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'reviews' && <ReviewsTab />}

      <NewProductSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(p) => {
          refresh();
          setCreating(false);
          nav(`/shop/products/${p.id}`);
        }}
      />
    </Screen>
  );
}

function NewProductSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: Product) => void }) {
  const [kind, setKind] = useState<ProductKind>('digital');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('200');
  const create = useMutation({ mutationFn: () => api.createProduct({ kind, title, pricePoints: Number(price) || 0, status: 'draft' }), onSuccess: (r) => r.product && onCreated(r.product) });
  return (
    <Sheet open={open} onClose={onClose} title="New product">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">What are you selling?</legend>
          <div className="mt-xs grid grid-cols-2 gap-xs">
            {PRODUCT_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-[56px] rounded-tile border-2 p-xs text-left text-[14px] font-bold ${kind === k ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                <span aria-hidden="true">{PRODUCT_KIND_META[k].emoji} </span>
                {PRODUCT_KIND_META[k].name}
                <span className={`block text-[12px] font-semibold ${kind === k ? 'text-on-ink/80' : 'text-ink-soft'}`}>{PRODUCT_KIND_META[k].blurb}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        {kind !== 'link' && (
          <label className="block">
            <span className="block text-[14px] font-bold">Price in points</span>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
            <span className="mt-xs block text-[12px] font-bold text-ink-soft">Zero makes it free. Money prices, pay what you want and the rest are on the next screen.</span>
          </label>
        )}
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {create.error instanceof Error ? create.error.message : 'Could not create it.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending || !title.trim()}>
          Create draft
        </Button>
      </form>
    </Sheet>
  );
}

function PageTab() {
  const me = useMe();
  const refresh = useRefreshAll();
  const user = me.data?.user;
  const [handle, setHandle] = useState(user?.handle ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const save = useMutation({ mutationFn: () => api.updateMe({ handle: handle || null, bio }), onSuccess: () => refresh() });
  const link = user?.handle ? `${window.location.origin}/u/${user.handle}` : null;
  return (
    <section className="mt-md" aria-labelledby="page-heading">
      <h2 id="page-heading" className="text-[24px]">
        My page
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">One link for your bio. It lists your live products, a follow button and a form that sends you leads.</p>
      <form
        className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Page name</span>
          <div className="mt-xs flex items-center gap-xs">
            <span className="text-[16px] font-bold text-ink-soft">/u/</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} maxLength={20} pattern="[a-z0-9_]{3,20}" placeholder="yourname" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </div>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {save.error instanceof Error ? save.error.message : 'Could not save.'}
          </p>
        )}
        <Button type="submit" full disabled={save.isPending}>
          Save page
        </Button>
      </form>
      {link && (
        <div className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
          <p className="m-0 text-[14px] font-bold">Your link</p>
          <p className="m-0 break-all text-[16px] font-semibold">{link}</p>
          <div className="mt-sm flex gap-xs">
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(link)}>
              Copy
            </Button>
            <Link to={`/u/${user?.handle}`} className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
              Open
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function BookingsTab() {
  const q = useAuthed(['studio-bookings'], api.studioBookings);
  const avail = useAuthed(['availability'], api.availability);
  const refresh = useRefreshAll();
  const set = useMutation({ mutationFn: ({ id, body }: { id: string; body: { status?: Booking['status']; meetingUrl?: string } }) => api.setBooking(id, body), onSuccess: () => refresh() });
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const add = useMutation({ mutationFn: () => api.addAvailability({ weekday, startMin: toMin(start), endMin: toMin(end) }), onSuccess: () => avail.refetch() });
  const remove = useMutation({ mutationFn: (id: string) => api.removeAvailability(id), onSuccess: () => avail.refetch() });
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return (
    <>
      <section className="mt-md" aria-labelledby="avail-heading">
        <h2 id="avail-heading" className="text-[24px]">
          Availability
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Times in UTC. Session products offer slots inside these windows.</p>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {avail.data?.availability.map((a) => (
            <li key={a.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="flex-1 text-[16px] font-bold">
                {DAYS[a.weekday]} {fmt(a.startMin)} to {fmt(a.endMin)}
              </span>
              <Button variant="ghost" onClick={() => remove.mutate(a.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="mt-sm flex flex-wrap items-end gap-xs rounded-card bg-card p-md shadow-toy-soft"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[12px] font-bold">Day</span>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-bold">From</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-bold">To</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          <Button type="submit" disabled={add.isPending}>
            Add
          </Button>
        </form>
      </section>
      <section className="mt-lg" aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" className="text-[24px]">
          Bookings
        </h2>
        {q.data && q.data.bookings.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No bookings yet.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {q.data?.bookings.map((b) => (
            <li key={b.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">
                {b.buyerName}, {b.productTitle}
              </p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">
                {new Date(b.startsAt).toLocaleString()} UTC, {b.status}
                {b.note ? `. ${b.note}` : ''}
              </p>
              {b.status === 'requested' && (
                <div className="mt-sm flex gap-xs">
                  <Button onClick={() => set.mutate({ id: b.id, body: { status: 'confirmed', meetingUrl: window.prompt('Meeting link (optional)') ?? undefined } })}>Confirm</Button>
                  <Button variant="outline" onClick={() => set.mutate({ id: b.id, body: { status: 'cancelled' } })}>
                    Decline
                  </Button>
                </div>
              )}
              {b.status === 'confirmed' && (
                <Button variant="outline" className="mt-sm" onClick={() => set.mutate({ id: b.id, body: { status: 'done' } })}>
                  Mark done
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function ReviewsTab() {
  const q = useAuthed(['studio-testimonials'], api.testimonials);
  const refresh = useRefreshAll();
  const approve = useMutation({ mutationFn: ({ id, approved }: { id: string; approved: boolean }) => api.approveTestimonial(id, approved), onSuccess: () => refresh() });
  return (
    <section className="mt-md" aria-labelledby="rev-heading">
      <h2 id="rev-heading" className="text-[24px]">
        Reviews
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Buyers leave these. Approved ones show on your page.</p>
      {q.data && q.data.testimonials.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">None yet.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {q.data?.testimonials.map((t) => (
          <li key={t.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 text-[16px] font-bold">
              {'★'.repeat(t.rating)} {t.authorName} on {t.productTitle}
            </p>
            <p className="mt-xs m-0 text-[16px] font-semibold">{t.body}</p>
            <Button variant={t.approved ? 'ghost' : 'primary'} className="mt-sm" onClick={() => approve.mutate({ id: t.id, approved: !t.approved })}>
              {t.approved ? 'Hide from page' : 'Approve'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
