import { isFeatured, PREOWNED_CONDITION_META, PREOWNED_CONDITIONS, STORE_CATEGORIES, STORE_STAGE_META, STORE_STAGES, type MarketCard, type PreownedListing, type StoreItem, type StoreKit, type StoreStage } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { ListingSheet } from '../components/ListingSheet';
import { BackLink } from '../components/PageHeader';
import { money } from '../components/PeriodPanel';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const pill = (on: boolean) => `toy min-h-[40px] shrink-0 rounded-pill border-2 px-sm text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`;
const BUDGETS: { label: string; cents: number | null }[] = [
  { label: 'Any budget', cents: null },
  { label: 'Under 10k', cents: 1_000_000 },
  { label: 'Under 25k', cents: 2_500_000 },
  { label: 'Under 50k', cents: 5_000_000 },
  { label: 'Under 1 lakh', cents: 10_000_000 },
];

/** The yellow tag and the yellow edge: how a featured spot stands out everywhere. */
export function FeaturedTag() {
  return <span className="rounded-pill bg-r3 px-xs text-[12px] font-extrabold leading-[20px] text-on-yellow">Featured</span>;
}
export const cardClass = (featured: boolean) => `rounded-card bg-card p-sm ${featured ? 'border-2 border-r3 shadow-toy' : 'border-2 border-transparent shadow-toy-soft'}`;

export function Store() {
  const me = useMe();
  const qc = useQueryClient();
  const q = useAuthed(['market'], api.market);
  const d = q.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['market'] });
  };
  const [cat, setCat] = useState<string>('all');
  const [stage, setStage] = useState<StoreStage | 'all'>('all');
  const [budget, setBudget] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [selling, setSelling] = useState(false);
  const [adding, setAdding] = useState<'item' | 'kit' | null>(null);
  const feature = useMutation({ mutationFn: (v: { type: 'item' | 'kit' | 'listing'; id: string }) => api.marketFeature(v.type, v.id), onSuccess: refresh });
  const hideItem = useMutation({ mutationFn: (id: string) => api.marketUpdateItem(id, { hidden: true }), onSuccess: refresh });
  const hideKit = useMutation({ mutationFn: (id: string) => api.marketUpdateKit(id, { hidden: true }), onSuccess: refresh });

  const fits = (category: string, s: StoreStage | null, cents: number) => (cat === 'all' || category === cat) && (stage === 'all' || !s || s === 'any' || s === stage) && (budget === null || cents <= budget);
  const items = (d?.items ?? []).filter((i) => fits(i.category, i.stage, i.priceCents));
  const listings = (d?.listings ?? []).filter((l) => fits(l.category, null, l.priceCents));
  const kits = (d?.kits ?? []).filter((k) => (stage === 'all' || k.stage === 'any' || k.stage === stage) && (budget === null || k.totalCents <= budget));
  const admin = d?.admin ?? false;
  const adminBar = (type: 'item' | 'kit', id: string, featuredUntil: string | null) =>
    admin ? (
      <div className="mt-sm flex flex-wrap gap-xs">
        <Button size="sm" variant="outline" onClick={() => feature.mutate({ type, id })} disabled={feature.isPending || isFeatured(featuredUntil)}>
          {isFeatured(featuredUntil) ? 'Featured' : 'Feature for a week'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => (type === 'item' ? hideItem.mutate(id) : hideKit.mutate(id))}>
          Hide
        </Button>
      </div>
    ) : null;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Store</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Gear and software for creators. New things come through partner links, so Kreators may earn a share. Pre-owned things come from other creators: make an offer, talk it over, meet up. Kits say what to buy at your stage, within a budget.</p>
        <div className="mt-md flex flex-wrap gap-xs">
          <Button onClick={() => setSelling(true)}>Sell something</Button>
          {admin && (
            <>
              <Button variant="outline" onClick={() => setAdding('item')}>
                Add a product
              </Button>
              <Button variant="outline" onClick={() => setAdding('kit')}>
                Make a kit
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="mt-md" aria-label="Filters">
        <div className="-mx-xs flex gap-xs overflow-x-auto px-xs py-xs scrollbar-none" role="group" aria-label="Category">
          <button type="button" aria-pressed={cat === 'all'} onClick={() => setCat('all')} className={pill(cat === 'all')}>
            Everything
          </button>
          {STORE_CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={pill(cat === c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="-mx-xs flex gap-xs overflow-x-auto px-xs py-xs scrollbar-none" role="group" aria-label="Stage">
          <button type="button" aria-pressed={stage === 'all'} onClick={() => setStage('all')} className={pill(stage === 'all')}>
            Any stage
          </button>
          {STORE_STAGES.filter((s) => s !== 'any').map((s) => (
            <button key={s} type="button" aria-pressed={stage === s} onClick={() => setStage(s)} className={pill(stage === s)}>
              {STORE_STAGE_META[s].name}
            </button>
          ))}
        </div>
        <div className="-mx-xs flex gap-xs overflow-x-auto px-xs py-xs scrollbar-none" role="group" aria-label="Budget">
          {BUDGETS.map((b) => (
            <button key={b.label} type="button" aria-pressed={budget === b.cents} onClick={() => setBudget(b.cents)} className={pill(budget === b.cents)}>
              {b.label}
            </button>
          ))}
        </div>
      </section>

      {q.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load the store. Try again in a moment.
        </p>
      )}

      {d && d.featured.length > 0 && (
        <section className="mt-lg" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="text-[24px]">
            Featured this week
          </h2>
          <ul className="-mx-md mt-sm flex list-none gap-sm overflow-x-auto px-md py-xs scrollbar-none p-0 m-0">
            {d.featured.map((f) => (
              <li key={`${f.type}-${f.type === 'item' ? f.item.id : f.type === 'kit' ? f.kit.id : f.listing.id}`} className="w-[260px] shrink-0">
                <FeaturedCard card={f} onOpen={setOpen} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="kits-heading">
        <h2 id="kits-heading" className="text-[24px]">
          Kits by budget
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">What to buy at your stage, and what it comes to. A kit can mix new gear with pre-owned pieces.</p>
        {kits.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{d?.kits.length ? 'Nothing in this budget or stage.' : 'No kits yet.'}</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {kits.map((k) => (
            <li key={k.id} className={cardClass(isFeatured(k.featuredUntil))}>
              <KitBody kit={k} />
              {adminBar('kit', k.id, k.featuredUntil)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="new-heading">
        <h2 id="new-heading" className="text-[24px]">
          New
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Picked by the team. The link takes you to the seller's site; Kreators may earn a share of what you buy.</p>
        {items.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{d?.items.length ? 'Nothing here for these filters.' : 'Nothing on the shelf yet.'}</p>}
        <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
          {items.map((i) => (
            <li key={i.id} className={cardClass(isFeatured(i.featuredUntil))}>
              <ItemBody item={i} />
              {adminBar('item', i.id, i.featuredUntil)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="preowned-heading">
        <h2 id="preowned-heading" className="text-[24px]">
          Pre-owned
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">From other creators. Tap one to make an offer or ask a question. Sold ones stay for two weeks so you can see what things go for.</p>
        {listings.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{d?.listings.length ? 'Nothing here for these filters.' : 'Nothing listed yet. Yours could be first.'}</p>}
        <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
          {listings.map((l) => (
            <li key={l.id}>
              <ListingButton l={l} onOpen={setOpen} />
            </li>
          ))}
        </ul>
      </section>

      {d && (d.mine.listings.length > 0 || d.mine.offers.length > 0) && (
        <section className="mt-lg" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-[24px]">
            Yours
          </h2>
          {d.mine.listings.length > 0 && (
            <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
              {d.mine.listings.map((l) => (
                <li key={l.id}>
                  <ListingButton l={l} onOpen={setOpen} />
                </li>
              ))}
            </ul>
          )}
          {d.mine.offers.length > 0 && (
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Your offers">
              {d.mine.offers.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setOpen(o.listingId)} className="toy toy-soft flex w-full items-center gap-sm rounded-tile bg-card p-sm text-left text-ink">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold">{o.listingTitle}</span>
                      <span className="block text-[14px] font-semibold text-ink-soft">Your offer {money(o.cents, 'INR')}</span>
                    </span>
                    <span className="shrink-0 rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[24px] text-ink-soft">{o.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ListingSheet id={open} onClose={() => setOpen(null)} feature={d?.feature ?? { feePoints: 0, days: 7, points: 0 }} />
      <SellSheet open={selling} onClose={() => setSelling(false)} onSaved={refresh} city={me.data?.user.city ?? ''} />
      <ItemSheet open={adding === 'item'} onClose={() => setAdding(null)} onSaved={refresh} />
      <KitSheet open={adding === 'kit'} onClose={() => setAdding(null)} onSaved={refresh} items={d?.items ?? []} listings={(d?.listings ?? []).filter((l) => l.status === 'live')} />
    </Screen>
  );
}

function Price({ cents, original, currency }: { cents: number; original?: number | null; currency: string }) {
  return (
    <span className="flex flex-wrap items-baseline gap-xs">
      <span className="font-display text-[20px] font-extrabold leading-none">{money(cents, currency)}</span>
      {original && original > cents && <span className="text-[12px] font-bold text-ink-mute line-through">{money(original, currency)}</span>}
    </span>
  );
}

function ItemBody({ item }: { item: StoreItem }) {
  return (
    <div className="flex flex-col gap-xs">
      {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" className="aspect-video w-full rounded-tile bg-paper object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
      <div className="flex flex-wrap items-center gap-xs">
        {isFeatured(item.featuredUntil) && <FeaturedTag />}
        <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">{item.category}</span>
        {item.stage !== 'any' && <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">{STORE_STAGE_META[item.stage].name}</span>}
      </div>
      <span className="block text-[16px] font-bold">{item.title}</span>
      {item.description && <span className="block text-[14px] font-semibold text-ink-soft">{item.description}</span>}
      <div className="flex items-center justify-between gap-sm">
        <Price cents={item.priceCents} currency={item.currency} />
        <a href={`/out/item/${item.id}`} target="_blank" rel="noreferrer" className="toy inline-flex min-h-[44px] shrink-0 items-center rounded-pill bg-ink px-md text-[14px] font-bold text-on-ink">
          Get it
        </a>
      </div>
      <span className="block text-[12px] font-bold text-ink-mute">Partner link. Kreators may earn a share.</span>
    </div>
  );
}

function KitBody({ kit }: { kit: StoreKit }) {
  const over = kit.budgetCents > 0 && kit.totalCents > kit.budgetCents;
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex flex-wrap items-center gap-xs">
        {isFeatured(kit.featuredUntil) && <FeaturedTag />}
        <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">{STORE_STAGE_META[kit.stage].name}</span>
        {kit.budgetCents > 0 && <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">Budget {money(kit.budgetCents, kit.currency)}</span>}
      </div>
      <span className="block text-[18px] font-bold">{kit.title}</span>
      {kit.description && <span className="block text-[14px] font-semibold text-ink-soft">{kit.description}</span>}
      <ul className="list-none p-0 m-0">
        {kit.items.map((it) => (
          <li key={`${it.type}-${it.id}`} className="flex items-baseline justify-between gap-sm border-t border-line py-xs text-[14px] font-semibold">
            <span className="min-w-0 flex-1 truncate">
              {it.title}
              <span className="text-ink-soft"> · {it.type === 'listing' ? (it.status === 'live' ? 'pre-owned' : `pre-owned, ${it.status}`) : 'new'}</span>
            </span>
            <span className="shrink-0 font-bold">{money(it.priceCents, kit.currency)}</span>
          </li>
        ))}
      </ul>
      <p className={`m-0 text-[14px] font-extrabold ${over ? 'text-r1' : ''}`}>
        Comes to {money(kit.totalCents, kit.currency)}
        {over ? ', over the budget' : ''}
      </p>
    </div>
  );
}

function ListingButton({ l, onOpen }: { l: PreownedListing; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(l.id)} className={`toy w-full text-left text-ink ${cardClass(isFeatured(l.featuredUntil) && l.status === 'live')}`}>
      <span className="flex gap-sm">
        {l.images[0] && <img src={l.images[0]} alt="" loading="lazy" className="size-[80px] shrink-0 rounded-tile bg-paper object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-xs">
            {isFeatured(l.featuredUntil) && l.status === 'live' && <FeaturedTag />}
            <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">{PREOWNED_CONDITION_META[l.condition].name}</span>
            {l.isKit && <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">Whole setup</span>}
            {l.status === 'sold' && <span className="rounded-pill bg-ink px-xs text-[12px] font-extrabold leading-[20px] text-on-ink">Sold{l.soldCents ? ` for ${money(l.soldCents, l.currency)}` : ''}</span>}
            {l.status === 'agreed' && <span className="rounded-pill bg-ink px-xs text-[12px] font-extrabold leading-[20px] text-on-ink">Offer accepted</span>}
            {l.status === 'withdrawn' && <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">Taken down</span>}
          </span>
          <span className="mt-xs block text-[16px] font-bold">{l.title}</span>
          <Price cents={l.priceCents} original={l.originalCents} currency={l.currency} />
          <span className="block text-[12px] font-bold text-ink-soft">
            {l.offers > 0 ? `${l.offers} ${l.offers === 1 ? 'offer' : 'offers'}` : 'No offers yet'}
            {l.city ? ` · ${l.city}` : ''}
            {l.mine ? ' · yours' : ` · ${l.sellerName}`}
          </span>
        </span>
      </span>
    </button>
  );
}

function FeaturedCard({ card, onOpen }: { card: MarketCard; onOpen: (id: string) => void }) {
  if (card.type === 'listing') return <ListingButton l={card.listing} onOpen={onOpen} />;
  return (
    <div className={cardClass(true)}>
      {card.type === 'item' ? <ItemBody item={card.item} /> : <KitBody kit={card.kit} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[14px] font-bold">{label}</span>
      {children}
    </label>
  );
}
function Err({ m }: { m: { isError: boolean; error: unknown } }) {
  return m.isError ? (
    <p role="alert" className="m-0 text-[14px] font-bold">
      {m.error instanceof Error ? m.error.message : 'That did not work.'}
    </p>
  ) : null;
}

function SellSheet({ open, onClose, onSaved, city }: { open: boolean; onClose: () => void; onSaved: () => void; city: string }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Camera');
  const [condition, setCondition] = useState<string>('lightly_used');
  const [price, setPrice] = useState('');
  const [original, setOriginal] = useState('');
  const [year, setYear] = useState('');
  const [includes, setIncludes] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState('');
  const [isKit, setIsKit] = useState(false);
  const [where, setWhere] = useState(city);
  const save = useMutation({
    mutationFn: () =>
      api.marketSell({
        title,
        category,
        condition,
        priceCents: Math.round(Number(price) * 100),
        originalCents: original ? Math.round(Number(original) * 100) : null,
        purchaseYear: year ? Number(year) : null,
        includes,
        description,
        images: images
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        isKit,
        city: where,
      }),
    onSuccess: () => {
      setTitle('');
      setPrice('');
      setOriginal('');
      setYear('');
      setIncludes('');
      setDescription('');
      setImages('');
      setIsKit(false);
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Sell something">
      <form
        className="flex flex-col gap-sm pb-xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Say what it is, what state it is in and what you want for it. Buyers make offers and ask questions here; you settle the handover between you.</p>
        <Field label="What is it">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Sony ZV-E10 body" className={field} />
        </Field>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Category</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {STORE_CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={pill(category === c)}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Condition</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {PREOWNED_CONDITIONS.map((c) => (
              <button key={c} type="button" aria-pressed={condition === c} onClick={() => setCondition(c)} className={pill(condition === c)} title={PREOWNED_CONDITION_META[c].blurb}>
                {PREOWNED_CONDITION_META[c].name}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-xs">
          <Field label="Asking price, INR">
            <input type="number" min={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
          </Field>
          <Field label="What it cost new">
            <input type="number" min={0} inputMode="numeric" value={original} onChange={(e) => setOriginal(e.target.value)} className={field} />
          </Field>
          <Field label="Bought in">
            <input type="number" min={1990} max={2100} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" className={field} />
          </Field>
          <Field label="City">
            <input value={where} onChange={(e) => setWhere(e.target.value)} maxLength={80} className={field} />
          </Field>
        </div>
        <Field label="What comes with it">
          <input value={includes} onChange={(e) => setIncludes(e.target.value)} maxLength={300} placeholder="Box, charger, two batteries" className={field} />
        </Field>
        <Field label="Anything a buyer should know">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={3000} placeholder="Shutter count, marks, repairs." className={field} />
        </Field>
        <Field label="Picture links, one per line (https)">
          <textarea value={images} onChange={(e) => setImages(e.target.value)} rows={2} className={field} />
        </Field>
        <label className="flex min-h-[44px] items-center gap-sm">
          <input type="checkbox" checked={isKit} onChange={(e) => setIsKit(e.target.checked)} className="size-[20px]" />
          <span className="text-[14px] font-bold">This is a whole setup sold together</span>
        </label>
        <Err m={save} />
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || !price}>
          List it
        </Button>
      </form>
    </Sheet>
  );
}

function ItemSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Camera');
  const [stage, setStage] = useState<StoreStage>('any');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const save = useMutation({
    mutationFn: () => api.marketAddItem({ title, category, stage, priceCents: Math.round(Number(price) * 100), url, imageUrl: image, description }),
    onSuccess: () => {
      setTitle('');
      setPrice('');
      setUrl('');
      setImage('');
      setDescription('');
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Add a product">
      <form
        className="flex flex-col gap-sm pb-xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Team only. The link is the partner link; people go through it when they tap Get it.</p>
        <Field label="Name">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} />
        </Field>
        <Field label="Partner link">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://" className={field} />
        </Field>
        <div className="grid grid-cols-2 gap-xs">
          <Field label="Price, INR">
            <input type="number" min={0} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
          </Field>
          <Field label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value as StoreStage)} className={field}>
              {STORE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STORE_STAGE_META[s].name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Category</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {STORE_CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={pill(category === c)}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Picture link (https)">
          <input type="url" value={image} onChange={(e) => setImage(e.target.value)} maxLength={500} className={field} />
        </Field>
        <Field label="Why it is on the shelf">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={field} />
        </Field>
        <Err m={save} />
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || !url.trim()}>
          Put it in the store
        </Button>
      </form>
    </Sheet>
  );
}

function KitSheet({ open, onClose, onSaved, items, listings }: { open: boolean; onClose: () => void; onSaved: () => void; items: StoreItem[]; listings: PreownedListing[] }) {
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<StoreStage>('starting');
  const [budget, setBudget] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<{ type: 'item' | 'listing'; id: string }[]>([]);
  const has = (type: 'item' | 'listing', id: string) => picked.some((p) => p.type === type && p.id === id);
  const toggle = (type: 'item' | 'listing', id: string) => setPicked((p) => (has(type, id) ? p.filter((x) => !(x.type === type && x.id === id)) : [...p, { type, id }]));
  const total = picked.reduce((s, p) => s + (p.type === 'item' ? (items.find((i) => i.id === p.id)?.priceCents ?? 0) : (listings.find((l) => l.id === p.id)?.priceCents ?? 0)), 0);
  const save = useMutation({
    mutationFn: () => api.marketAddKit({ title, stage, budgetCents: Math.round(Number(budget) * 100), description, items: picked }),
    onSuccess: () => {
      setTitle('');
      setBudget('');
      setDescription('');
      setPicked([]);
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Make a kit">
      <form
        className="flex flex-col gap-sm pb-xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Team only. Pick the pieces someone at this stage should buy within this budget. New gear and pre-owned pieces both go in.</p>
        <Field label="Name">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Starter kit under 50k" className={field} />
        </Field>
        <div className="grid grid-cols-2 gap-xs">
          <Field label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value as StoreStage)} className={field}>
              {STORE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STORE_STAGE_META[s].name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Budget, INR">
            <input type="number" min={0} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} className={field} />
          </Field>
        </div>
        <Field label="Who it is for">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} className={field} />
        </Field>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Pieces</legend>
          <ul className="mt-xs flex max-h-[280px] list-none flex-col gap-xs overflow-y-auto p-0 m-0">
            {items.map((i) => (
              <li key={i.id}>
                <label className="flex min-h-[44px] items-center gap-sm rounded-tile bg-paper px-sm">
                  <input type="checkbox" checked={has('item', i.id)} onChange={() => toggle('item', i.id)} className="size-[20px]" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{i.title}</span>
                  <span className="text-[14px] font-semibold text-ink-soft">{money(i.priceCents, i.currency)}</span>
                </label>
              </li>
            ))}
            {listings.map((l) => (
              <li key={l.id}>
                <label className="flex min-h-[44px] items-center gap-sm rounded-tile bg-paper px-sm">
                  <input type="checkbox" checked={has('listing', l.id)} onChange={() => toggle('listing', l.id)} className="size-[20px]" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
                    {l.title} <span className="text-ink-soft">· pre-owned</span>
                  </span>
                  <span className="text-[14px] font-semibold text-ink-soft">{money(l.priceCents, l.currency)}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="m-0 text-[14px] font-extrabold">Comes to {money(total, 'INR')}</p>
        <Err m={save} />
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || picked.length === 0}>
          Make the kit
        </Button>
      </form>
    </Sheet>
  );
}
