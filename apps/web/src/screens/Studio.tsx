import { PRODUCT_KIND_META, PRODUCT_KINDS, type Booking, type Order, type Product, type ProductKind } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { AreaLine, Donut, Legend, StatTile } from '../components/Charts';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll, useStudio } from '../lib/queries';
import { useSession } from '../lib/store';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const STATUS_PILL: Record<Order['status'], string> = {
  paid: 'bg-r4 text-on-fill',
  test: 'bg-paper text-ink-soft',
  pending: 'bg-r3 text-ink-fixed',
  refunded: 'bg-line text-ink',
  failed: 'bg-r1 text-white',
  expired: 'bg-line text-ink',
};

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
        <BackLink to="/apps">Apps</BackLink>
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
          <section className="span-all mt-md" aria-label="Numbers">
            <div className="grid grid-cols-2 gap-xs md:grid-cols-4">
              <StatTile label="orders" value={d.analytics.orders} hint={`${d.analytics.attributed} via links, ${d.analytics.direct} from your page`} tone="var(--tint-purple)" to="/shop/content" />
              <StatTile label="points earned" value={d.analytics.pointsEarned.toLocaleString()} hint={d.analytics.centsEarned > 0 ? `plus ${(d.analytics.centsEarned / 100).toFixed(2)} in money orders` : d.analytics.affiliatePoints > 0 ? `${d.analytics.affiliatePoints} from referrals` : 'from sales'} tone="var(--tint-green)" to="/shop/customers" />
              <StatTile label="page views" value={d.analytics.views} hint={`${d.analytics.clicks} link clicks`} to="/shop/page" />
              <StatTile label="followers" value={d.analytics.followers} hint={`${d.analytics.leads} ${d.analytics.leads === 1 ? 'lead' : 'leads'}`} to="/shop/audience" />
            </div>
            <div className="mt-xs rounded-card bg-card p-md shadow-toy-soft">
              <div className="flex items-baseline justify-between gap-sm">
                <p className="m-0 text-[14px] font-bold">Orders, last 14 days</p>
                <Link to="/shop/content" className="text-[12px] font-bold text-ink-mute underline-offset-4 hover:underline">
                  Which post made the sale
                </Link>
              </div>
              <div className="mt-sm">
                <AreaLine values={d.analytics.days.map((x) => x.orders)} max={Math.max(3, ...d.analytics.days.map((x) => x.orders))} labels={d.analytics.days.map((x) => new Date(`${x.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }))} color="var(--color-r6)" height={160} empty="No orders in the last two weeks" label="Orders per day for the last fourteen days" />
              </div>
            </div>
            <div className="mt-xs flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
              <Donut segments={d.analytics.byProduct.filter((p) => p.orders > 0).slice(0, 6).map((p, i) => ({ value: p.orders, color: ['var(--color-r6)', 'var(--color-r2)', 'var(--color-r4)', 'var(--color-r3)', 'var(--color-r5)', 'var(--color-r1)'][i] ?? 'var(--color-r6)', label: p.title }))} size={132} stroke={20} label="Orders by product">
                <span className="flex flex-col items-center leading-none">
                  <span className="font-display text-[24px] font-extrabold">{d.analytics.orders}</span>
                  <span className="mt-xs text-[12px] font-bold text-ink-soft">orders</span>
                </span>
              </Donut>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] font-bold">What sells</p>
                <div className="mt-xs">
                  {d.analytics.byProduct.some((p) => p.orders > 0) ? <Legend items={d.analytics.byProduct.filter((p) => p.orders > 0).slice(0, 6).map((p, i) => ({ color: ['var(--color-r6)', 'var(--color-r2)', 'var(--color-r4)', 'var(--color-r3)', 'var(--color-r5)', 'var(--color-r1)'][i] ?? 'var(--color-r6)', label: p.title, text: `${p.orders}` }))} /> : <p className="m-0 text-[14px] font-semibold text-ink-soft">No orders yet. Share a product link.</p>}
                </div>
              </div>
            </div>
          </section>

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

          <SalesSection />
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

/** Every order, filtered, with a CSV for the accountant. */
function SalesSection() {
  const token = useSession((s) => s.token);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const sales = useAuthed(['sales', status, from, to], () => api.sales({ status: status || undefined, from: from || undefined, to: to || undefined }));
  const downloadCsv = async () => {
    setCsvError(null);
    try {
      const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
      const res = await fetch(`${api.salesCsvUrl}${qs ? `&${qs}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Could not build the file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sales.csv';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : 'Could not download.');
    }
  };
  const orders = sales.data?.orders ?? [];
  return (
    <section className="mt-lg" aria-labelledby="sales-heading">
      <div className="flex items-center justify-between gap-sm">
        <h2 id="sales-heading" className="text-[24px]">
          Sales
        </h2>
        <Button variant="outline" onClick={() => void downloadCsv()} disabled={orders.length === 0}>
          Download CSV
        </Button>
      </div>
      <div className="mt-sm grid grid-cols-3 gap-xs">
        <label className="block">
          <span className="block text-[12px] font-bold">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="test">Test</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[12px] font-bold">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-bold">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
      </div>
      {csvError && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {csvError}
        </p>
      )}
      {sales.data && orders.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No orders match.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {orders.map((o) => (
          <li key={o.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <div className="flex items-start justify-between gap-sm">
              <p className="m-0 min-w-0 text-[16px] font-bold">
                {o.buyerName} got {o.productTitle}
              </p>
              <span className={`shrink-0 rounded-pill px-xs text-[12px] font-extrabold leading-[20px] ${STATUS_PILL[o.status]}`}>{o.status}</span>
            </div>
            <p className="m-0 text-[14px] font-semibold text-ink-soft">
              {new Date(o.createdAt).toLocaleDateString()}. {o.points > 0 ? `${o.points} points` : `${(o.cents / 100).toFixed(2)} ${o.currency}${o.provider === 'razorpay' ? '' : ', test'}`}
              {o.couponCode ? `, coupon ${o.couponCode}` : ''}
              {o.affiliateCode ? ', via affiliate' : ''}
              {o.sourceLabel ? `, from ${o.sourceLabel}` : ', profile direct'}
              {o.variant === 'replay' ? ', replay' : ''}.
            </p>
          </li>
        ))}
      </ul>
    </section>
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
  const me = useMe();
  const q = useAuthed(['studio-bookings'], api.studioBookings);
  const avail = useAuthed(['availability'], api.availability);
  const refresh = useRefreshAll();
  const zone = me.data?.user.timezone ?? 'Asia/Kolkata';
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
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          Times in your zone, {zone} (change it under{' '}
          <Link to="/profile" className="underline underline-offset-4">
            Profile
          </Link>
          ). Session products offer slots inside these windows, shown to buyers in their own zone.
        </p>
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
      <OverridesSection />
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
                {new Date(b.startsAt).toLocaleString()}, {b.status}
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

/** Days off and days with their own hours. An empty set of hours blocks the whole day. */
function OverridesSection() {
  const overrides = useAuthed(['overrides'], api.overrides);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('13:00');
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const set = useMutation({ mutationFn: (ranges: { startMin: number; endMin: number }[]) => api.setOverride(date, ranges), onSuccess: () => overrides.refetch() });
  const remove = useMutation({ mutationFn: (d: string) => api.removeOverride(d), onSuccess: () => overrides.refetch() });
  const ready = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return (
    <section className="mt-lg" aria-labelledby="overrides-heading">
      <h2 id="overrides-heading" className="text-[24px]">
        Days off and special hours
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Block a date, or give it hours of its own. These win over the weekly windows above.</p>
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {overrides.data?.overrides.map((o) => (
          <li key={o.date} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <span className="flex-1 text-[16px] font-bold">
              {new Date(`${o.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              <span className="font-semibold text-ink-soft">{o.ranges.length === 0 ? ', day off' : `, ${o.ranges.map((r) => `${fmt(r.startMin)} to ${fmt(r.endMin)}`).join(', ')}`}</span>
            </span>
            <Button variant="ghost" onClick={() => remove.mutate(o.date)} disabled={remove.isPending}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-sm flex flex-wrap items-end gap-xs rounded-card bg-card p-md shadow-toy-soft">
        <label className="block">
          <span className="block text-[12px] font-bold">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        <Button variant="outline" onClick={() => set.mutate([])} disabled={!ready || set.isPending}>
          Block this day
        </Button>
        <label className="block">
          <span className="block text-[12px] font-bold">Or custom hours from</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        <label className="block">
          <span className="block text-[12px] font-bold">to</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        <Button onClick={() => set.mutate([{ startMin: toMin(start), endMin: toMin(end) }])} disabled={!ready || set.isPending || toMin(end) <= toMin(start)}>
          Set hours
        </Button>
      </div>
      {set.isError && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {set.error instanceof Error ? set.error.message : 'Could not save that day.'}
        </p>
      )}
    </section>
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
