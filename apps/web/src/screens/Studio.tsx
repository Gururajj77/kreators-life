import { money, PRODUCT_KIND_META, PRODUCT_KINDS, productHasOwnCover, type Booking, type Order, type Product, type ProductKind, LOCALE, formatCount } from '@kreators/shared';
import { longDate, dateTime } from '../lib/date';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { PeriodPanel } from '../components/PeriodPanel';
import { Button } from '../components/Button';
import { AreaLine, Donut, Legend, StatTile } from '../components/Charts';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api, downloadCsv as fetchCsv, errorText } from '../lib/api';
import { useAuthed, useMe, useRefreshAll, useStudio } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { Stars } from '../components/Stars';
import { TabRow } from '../components/TabRow';
import { FIELD } from '../lib/ui';
import { useCopy } from '../lib/clipboard';
import { RowCard } from '../components/RowCard';
import { StatusTag } from '../components/StatusTag';
import { FactTag, IconTag } from '../components/FactTag';
import { Reveal } from '../components/fx/Reveal';

const STATUS_PILL: Record<Order['status'], string> = {
  paid: 'bg-r4 text-on-fill',
  test: 'bg-paper text-ink-soft',
  pending: 'bg-r3 text-ink-fixed',
  refunded: 'bg-line text-ink',
  failed: 'bg-r1 text-white',
  expired: 'bg-line text-ink',
};

type ShopTab = 'home' | 'page' | 'bookings' | 'reviews' | 'audience' | 'content' | 'automations' | 'customers' | 'dm';

/** Most used first: the row shows what fits and puts the rest behind More. */
const SHOP_TABS: readonly { key: ShopTab; label: string; to: string }[] = [
  { key: 'home', label: 'Overview', to: '/shop' },
  { key: 'page', label: 'My page', to: '/shop/page' },
  { key: 'customers', label: 'Customers', to: '/shop/customers' },
  { key: 'bookings', label: 'Bookings', to: '/shop/bookings' },
  { key: 'content', label: 'Content', to: '/shop/content' },
  { key: 'dm', label: 'Priority DMs', to: '/shop/dm' },
  { key: 'reviews', label: 'Reviews', to: '/shop/testimonials' },
  { key: 'audience', label: 'Audience', to: '/shop/audience' },
  { key: 'automations', label: 'Auto-DM', to: '/shop/automations' },
];

export function Studio({ tab = 'home' }: { tab?: ShopTab }) {
  const me = useMe();
  const q = useStudio();
  const refresh = useRefreshAll();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const d = q.data;
  const handle = me.data?.user.handle ?? null;

  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Shop"
        lede="Sell downloads, courses, memberships, sessions, events, payment links, bundles, locked posts and priority DMs. Points work today; money checkout is in test mode until a payment provider is connected."
      >
        <TabRow pillClass={(on) => `inline-flex min-h-[44px] items-center rounded-pill border-2 px-sm py-xs text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`} label="Shop sections" items={SHOP_TABS} value={tab} onChange={(k) => nav(SHOP_TABS.find((t) => t.key === k)!.to)} />
      </AppCover>

      {tab === 'home' && d && (
        <>
          <section className="span-all mt-md" aria-label="Numbers">
            <div className="grid grid-cols-2 gap-xs md:grid-cols-4">
              <StatTile label="orders" value={d.analytics.orders} hint={`${d.analytics.attributed} via links, ${d.analytics.direct} from your page`} tone="var(--tint-purple)" to="/shop/content" />
              <StatTile label="points earned" value={formatCount(d.analytics.pointsEarned)} hint={d.analytics.centsEarned > 0 ? `plus ${money(d.analytics.centsEarned)} in money orders` : d.analytics.affiliatePoints > 0 ? `${d.analytics.affiliatePoints} from referrals` : 'from sales'} tone="var(--tint-green)" to="/shop/customers" />
              <StatTile label="page views" value={d.analytics.views} hint={`${d.analytics.clicks} link clicks`} to="/shop/page" />
              <StatTile label="followers" value={d.analytics.followers} hint={`${d.analytics.leads} ${d.analytics.leads === 1 ? 'lead' : 'leads'}`} to="/shop/audience" />
            </div>
            <div className="mt-xs rounded-card bg-card p-md shadow-toy-soft">
              <div className="flex items-baseline justify-between gap-sm">
                <p className="m-0 text-headline">Orders, last 14 days</p>
                <Link to="/shop/content" className="inline-flex min-h-[44px] items-center text-caption text-ink-mute underline-offset-4 hover:underline">
                  Which post made the sale
                </Link>
              </div>
              <div className="mt-sm">
                <AreaLine values={d.analytics.days.map((x) => x.orders)} max={Math.max(3, ...d.analytics.days.map((x) => x.orders))} labels={d.analytics.days.map((x) => new Date(`${x.date}T00:00:00`).toLocaleDateString(LOCALE, { weekday: 'short' }))} color="var(--color-r6)" height={160} empty="No orders in the last two weeks" label="Orders per day for the last fourteen days" />
              </div>
            </div>
            <div className="mt-xs flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
              <Donut segments={d.analytics.byProduct.filter((p) => p.orders > 0).slice(0, 6).map((p, i) => ({ value: p.orders, color: ['var(--color-r6)', 'var(--color-r2)', 'var(--color-r4)', 'var(--color-r3)', 'var(--color-r5)', 'var(--color-r1)'][i] ?? 'var(--color-r6)', label: p.title }))} size={132} stroke={20} label="Orders by product">
                <span className="flex flex-col items-center leading-none">
                  <span className="text-title2 type-figure">{d.analytics.orders}</span>
                  <span className="mt-xs text-caption text-ink-soft">orders</span>
                </span>
              </Donut>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-headline">What sells</p>
                <div className="mt-xs">
                  {d.analytics.byProduct.some((p) => p.orders > 0) ? <Legend items={d.analytics.byProduct.filter((p) => p.orders > 0).slice(0, 6).map((p, i) => ({ color: ['var(--color-r6)', 'var(--color-r2)', 'var(--color-r4)', 'var(--color-r3)', 'var(--color-r5)', 'var(--color-r1)'][i] ?? 'var(--color-r6)', label: p.title, text: `${p.orders}` }))} /> : <p className="m-0 text-subhead text-ink-soft">No orders yet. Share a product link.</p>}
                </div>
              </div>
            </div>
          </section>

          {/* The orders and points tiles above already show the shop's numbers, so the period block adds only money in and out. */}
          <PeriodPanel id="shop-period" parts={['finance']} />
          <section className="mt-lg" aria-labelledby="products-heading">
            <div className="flex items-center justify-between gap-sm">
              <h2 id="products-heading" className="text-title2">
                Products
              </h2>
              <Button onClick={() => setCreating(true)}>New product</Button>
            </div>
            {!handle && (
              <p className="mt-sm m-0 rounded-tile bg-r3 p-sm text-subhead text-ink-fixed">
                Pick a page name under{' '}
                <Link to="/profile" className="underline underline-offset-4">
                  My page
                </Link>{' '}
                so people can find your products.
              </p>
            )}
            {d.products.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing yet. Start with a download or a session.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.products.map((p, i) => (
                <Reveal as="li" key={p.id} index={i} className="flex">
                  {/* The cover and the title at the top left, never cut, the price in the corner, the kind, state and sales as tags at the foot. */}
                  <RowCard
                    to={`/shop/products/${p.id}`}
                    lead={
                      <span className="flex size-[44px] items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
                        {productHasOwnCover(p.kind, p.cover) ? p.cover : <AppIcon name={PRODUCT_KIND_META[p.kind].icon} size={22} />}
                      </span>
                    }
                    title={p.title}
                    corner={
                      p.pricePoints === 0 && p.priceCents > 0 ? (
                        <FactTag kind="price">{money(p.priceCents, p.currency)}</FactTag>
                      ) : p.pricePoints > 0 ? (
                        <FactTag kind="price">{`${formatCount(p.pricePoints)} pts`}</FactTag>
                      ) : (
                        <FactTag kind="free">Free</FactTag>
                      )
                    }
                    facts={[
                      <FactTag key="kind" kind="category">{PRODUCT_KIND_META[p.kind].name}</FactTag>,
                      <StatusTag key="status" tone={p.status === 'live' ? 'good' : 'neutral'}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</StatusTag>,
                      <IconTag key="sold" tone="neutral" icon="ShoppingBag">{`${formatCount(p.sold)} sold`}</IconTag>,
                    ]}
                  />
                </Reveal>
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
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const sp = usePage('s');
  const sales = useAuthed(['sales', status, from, to, sp.query], () => api.sales({ status: status || undefined, from: from || undefined, to: to || undefined }, sp.query));
  const downloadCsv = async () => {
    setCsvError(null);
    try {
      const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
      await fetchCsv(`${api.salesCsvUrl}${qs ? `&${qs}` : ''}`, 'sales.csv');
    } catch (e) {
      setCsvError(errorText(e, 'Could not download.'));
    }
  };
  const orders = sales.data?.orders ?? [];
  return (
    <section className="mt-lg" aria-labelledby="sales-heading">
      <div className="flex items-center justify-between gap-sm">
        <h2 id="sales-heading" className="text-title2">
          Sales
        </h2>
        <Button variant="outline" onClick={() => void downloadCsv()} disabled={orders.length === 0}>
          Download CSV
        </Button>
      </div>
      <div className="mt-sm grid grid-cols-3 gap-xs">
        <label className="block">
          <span className="block text-caption">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD}>
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="test">Test</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-caption">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-caption">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={FIELD} />
        </label>
      </div>
      {csvError && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {csvError}
        </p>
      )}
      {sales.data && orders.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No orders match.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {orders.map((o) => (
          <li key={o.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <div className="flex items-start justify-between gap-sm">
              <p className="m-0 min-w-0 text-headline">
                {o.buyerName} got {o.productTitle}
              </p>
              <span className={`shrink-0 rounded-pill px-xs text-caption font-medium leading-[20px] ${STATUS_PILL[o.status]}`}>{o.status}</span>
            </div>
            <p className="m-0 text-subhead text-ink-soft">
              {longDate(o.createdAt)}. {o.points > 0 ? `${o.points} points` : `${money(o.cents, o.currency)}${o.provider === 'razorpay' ? '' : ', test'}`}
              {o.couponCode ? `, coupon ${o.couponCode}` : ''}
              {o.affiliateCode ? ', via affiliate' : ''}
              {o.sourceLabel ? `, from ${o.sourceLabel}` : ', profile direct'}
              {o.variant === 'replay' ? ', replay' : ''}.
            </p>
          </li>
        ))}
      </ul>
      <Pager page={sales.data?.page} prefix="s" label="sales" />
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
          <legend className="text-subhead font-semibold">What are you selling?</legend>
          <div className="mt-xs grid grid-cols-2 gap-xs">
            {PRODUCT_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-[56px] rounded-tile border-2 p-xs text-left text-subhead ${kind === k ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                <AppIcon name={PRODUCT_KIND_META[k].icon} size={16} className="mr-xs inline-block align-[-3px]" />
                {PRODUCT_KIND_META[k].name}
                <span className={`block text-caption ${kind === k ? 'text-on-ink/80' : 'text-ink-soft'}`}>{PRODUCT_KIND_META[k].blurb}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
        </label>
        {kind !== 'link' && (
          <label className="block">
            <span className="block text-subhead font-semibold">Price in points</span>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
            <span className="mt-xs block text-caption text-ink-soft">Zero makes it free. Money prices, pay what you want and the rest are on the next screen.</span>
          </label>
        )}
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
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
  const copier = useCopy();
  const me = useMe();
  const refresh = useRefreshAll();
  const user = me.data?.user;
  const [handle, setHandle] = useState(user?.handle ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const save = useMutation({ mutationFn: () => api.updateMe({ handle: handle || null, bio }), onSuccess: () => refresh() });
  const link = user?.handle ? `${window.location.origin}/u/${user.handle}` : null;
  return (
    <section className="mt-md" aria-labelledby="page-heading">
      <h2 id="page-heading" className="text-title2">
        My page
      </h2>
      <p className="mt-xs m-0 text-subhead text-ink-soft">One link for your bio. It lists your live products, a follow button and a form that sends you leads.</p>
      <form
        className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Page name</span>
          <div className="mt-xs flex items-center gap-xs">
            <span className="text-headline text-ink-soft">/u/</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} maxLength={20} pattern="[a-z0-9_]{3,20}" placeholder="yourname" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
          </div>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
        </label>
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {save.error instanceof Error ? save.error.message : 'Could not save.'}
          </p>
        )}
        <Button type="submit" full disabled={save.isPending}>
          Save page
        </Button>
      </form>
      {link && (
        <div className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
          <p className="m-0 text-subhead font-semibold">Your link</p>
          <p className="m-0 break-all text-callout">{link}</p>
          <div className="mt-sm flex gap-xs">
            <Button variant="outline" onClick={() => void copier.copy(link)}>
              {copier.said === 'Copied' ? 'Copied' : 'Copy'}
            </Button>
            <Link to={`/u/${user?.handle}`} className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
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
  const bp = usePage('b');
  const q = useAuthed(['studio-bookings', bp.query], () => api.studioBookings(bp.query));
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
        <h2 id="avail-heading" className="text-title2">
          Availability
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          Times in your zone, {zone} (change it under{' '}
          <Link to="/profile" className="underline underline-offset-4">
            Public page
          </Link>
          ). Session products offer slots inside these windows, shown to buyers in their own zone.
        </p>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {avail.data?.availability.map((a) => (
            <li key={a.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="flex-1 text-headline">
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
            <span className="block text-caption">Day</span>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-body">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-caption">From</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
          </label>
          <label className="block">
            <span className="block text-caption">To</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
          </label>
          <Button type="submit" disabled={add.isPending}>
            Add
          </Button>
        </form>
      </section>
      <OverridesSection />
      <section className="mt-lg" aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" className="text-title2">
          Bookings
        </h2>
        {q.data && q.data.bookings.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">No bookings yet. They appear here once someone books a session you offer.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {q.data?.bookings.map((b) => (
            <li key={b.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-headline">
                {b.buyerName}, {b.productTitle}
              </p>
              <p className="m-0 text-subhead text-ink-soft">
                {dateTime(b.startsAt)}, {b.status}
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
        <Pager page={q.data?.page} prefix="b" label="bookings" />
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
      <h2 id="overrides-heading" className="text-title2">
        Days off and special hours
      </h2>
      <p className="mt-xs m-0 text-subhead text-ink-soft">Block a date, or give it hours of its own. These win over the weekly windows above.</p>
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {overrides.data?.overrides.map((o) => (
          <li key={o.date} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <span className="flex-1 text-headline">
              {new Date(`${o.date}T00:00:00`).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })}
              <span className="text-ink-soft">{o.ranges.length === 0 ? ', day off' : `, ${o.ranges.map((r) => `${fmt(r.startMin)} to ${fmt(r.endMin)}`).join(', ')}`}</span>
            </span>
            <Button variant="ghost" onClick={() => remove.mutate(o.date)} disabled={remove.isPending}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-sm flex flex-wrap items-end gap-xs rounded-card bg-card p-md shadow-toy-soft">
        <label className="block">
          <span className="block text-caption">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
        </label>
        <Button variant="outline" onClick={() => set.mutate([])} disabled={!ready || set.isPending}>
          Block this day
        </Button>
        <label className="block">
          <span className="block text-caption">Or custom hours from</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
        </label>
        <label className="block">
          <span className="block text-caption">to</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-xs rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
        </label>
        <Button onClick={() => set.mutate([{ startMin: toMin(start), endMin: toMin(end) }])} disabled={!ready || set.isPending || toMin(end) <= toMin(start)}>
          Set hours
        </Button>
      </div>
      {set.isError && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {set.error instanceof Error ? set.error.message : 'Could not save that day.'}
        </p>
      )}
    </section>
  );
}

function ReviewsTab() {
  const rp = usePage('r');
  const q = useAuthed(['studio-testimonials', rp.query], () => api.testimonials(rp.query));
  const refresh = useRefreshAll();
  const approve = useMutation({ mutationFn: ({ id, approved }: { id: string; approved: boolean }) => api.approveTestimonial(id, approved), onSuccess: () => refresh() });
  return (
    <section className="mt-md" aria-labelledby="rev-heading">
      <h2 id="rev-heading" className="text-title2">
        Reviews
      </h2>
      <p className="mt-xs m-0 text-subhead text-ink-soft">Buyers leave these. Approved ones show on your page.</p>
      {q.data && q.data.testimonials.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">None yet.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {q.data?.testimonials.map((t) => (
          <li key={t.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 text-headline">
              <Stars n={t.rating} /> {t.authorName} on {t.productTitle}
            </p>
            <p className="mt-xs m-0 text-callout">{t.body}</p>
            <Button variant={t.approved ? 'ghost' : 'primary'} className="mt-sm" onClick={() => approve.mutate({ id: t.id, approved: !t.approved })}>
              {t.approved ? 'Hide from page' : 'Approve'}
            </Button>
          </li>
        ))}
      </ul>
      <Pager page={q.data?.page} prefix="r" label="reviews" />
    </section>
  );
}
