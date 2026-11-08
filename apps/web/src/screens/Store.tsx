import { PUBLIC_BADGES, typedCents, isFeatured, PREOWNED_CONDITION_META, PREOWNED_CONDITIONS, STORE_CATEGORIES, STORE_STAGE_META, STORE_STAGES, unlockAt, type MarketCard, type PreownedListing, type StoreItem, type StoreKit, type StoreStage } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { LockedButton } from '../components/LockedButton';
import { ListingSheet } from '../components/ListingSheet';
import { FadeImage } from '../components/Media';
import { MediaSection, useMediaMenuItem } from '../components/MediaSection';
import { AppCover } from '../components/AppCover';
import { moneyRounded as money } from '../components/PeriodPanel';
import { Screen } from '../components/Screen';
import { SkeletonList } from '../components/Skeleton';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useParamState } from '../lib/useParamState';
import { useAuthed, useMe } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { chip, FIELD } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { FactTag, IconTag } from '../components/FactTag';
import { StatusTag } from '../components/StatusTag';
import { MoreMenu, type MoreMenuItem } from '../components/MoreMenu';
import { evenGrid, evenTile } from '../lib/bento';
import { FilterBar, FilterSelect } from '../components/FilterSelect';
import { CardHead } from '../components/CardHead';
import { Reveal } from '../components/fx/Reveal';
import { Icon } from '../components/Icon';
import { ArrowRight } from 'lucide-react';
import '../components/fx/spotlight';

const pill = chip;
/** Shelves of cards: one to a row on a phone and a tablet, two from the laptop width, in even rows (lib/bento.ts). */
const PAIR_COLS = { base: 1, lg: 2 } as const;
const BUDGETS: { label: string; cents: number | null }[] = [
  { label: 'Any budget', cents: null },
  { label: 'Under 10k', cents: 1_000_000 },
  { label: 'Under 25k', cents: 2_500_000 },
  { label: 'Under 50k', cents: 5_000_000 },
  { label: 'Under 1 lakh', cents: 10_000_000 },
];
// The three filter rows: as many pills as fit, the rest behind More, so none is ever cut at the screen's edge.
const CAT_ITEMS = [{ key: 'all', label: 'Everything' }, ...STORE_CATEGORIES.map((c) => ({ key: c as string, label: c }))];
const STAGE_ITEMS = [{ key: 'all' as StoreStage | 'all', label: 'Any stage' }, ...STORE_STAGES.filter((s) => s !== 'any').map((s) => ({ key: s as StoreStage | 'all', label: STORE_STAGE_META[s].name }))];
const BUDGET_ITEMS = BUDGETS.map((b) => ({ key: b.cents === null ? 'any' : String(b.cents), label: b.label }));

/** The yellow tag and the yellow edge: how a featured spot stands out everywhere. */
export function FeaturedTag() {
  return (
    <IconTag tone="warn" icon="Star">
      Featured
    </IconTag>
  );
}
export const cardClass = (featured: boolean) => `rounded-card bg-card p-sm ${featured ? 'border-2 border-r3 shadow-toy' : 'border-2 border-transparent shadow-toy-soft'}`;

export function Store() {
  const me = useMe();
  const qc = useQueryClient();
  const ip = usePage('i');
  const lp = usePage('l');
  const q = useAuthed(['market', ip.query, lp.query], () => api.market(`${ip.query}&${lp.query}`));
  const d = q.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['market'] });
  };
  const [cat, setCat] = useParamState('cat', 'all');
  const [stageRaw, setStageRaw] = useParamState('stage', 'all');
  const stage: StoreStage | 'all' = (STORE_STAGES as readonly string[]).includes(stageRaw) ? (stageRaw as StoreStage) : 'all';
  const setStage = (s: StoreStage | 'all') => setStageRaw(s);
  const [budgetRaw, setBudgetRaw] = useParamState('budget', '');
  const budget: number | null = budgetRaw ? Number(budgetRaw) : null;
  const setBudget = (c: number | null) => setBudgetRaw(c === null ? '' : String(c));
  // The open listing lives in the address (`?listing=<id>`), so an inbox note about an offer or a message opens that listing's sheet.
  const [listingParam, setListingParam] = useParamState('listing', '');
  const open = listingParam || null;
  const setOpen = (id: string | null) => setListingParam(id ?? '');
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
  // The team's actions on a card sit behind one More button, so a card shows what a shopper needs and nothing else.
  const teamItems = (type: 'item' | 'kit', id: string, featuredUntil: string | null): MoreMenuItem[] =>
    admin
      ? [
          { key: 'feature', label: isFeatured(featuredUntil) ? 'Featured this week' : 'Feature for a week', disabled: feature.isPending || isFeatured(featuredUntil), onSelect: () => feature.mutate({ type, id }) },
          { key: 'hide', label: type === 'item' ? 'Hide this product' : 'Hide this kit', destructive: true, confirm: 'Tap again to hide it from everyone', onSelect: () => (type === 'item' ? hideItem.mutate(id) : hideKit.mutate(id)) },
        ]
      : [];
  
  return (
    <Screen>
      {/* The cover card: the main action and the team's More sit on the helper's line, at its left (founder, 2026-11-04). */}
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Store"
        lede="Gear new from partners, or pre-owned from other creators."
        actions={
          <>
            <Button onClick={() => setSelling(true)}>Sell something</Button>
            {admin && (
              <MoreMenu
                label="Team actions for the store"
                title="Team actions"
                items={[
                  { key: 'item', label: 'Add a product', onSelect: () => setAdding('item') },
                  { key: 'kit', label: 'Make a kit', onSelect: () => setAdding('kit') },
                ]}
              />
            )}
          </>
        }
      />

      <section className="mt-md" aria-label="Filters">
        {/* Three choices of one value each: three dropdowns on one line, one per line on a phone. */}
        <FilterBar count={3}>
          <FilterSelect label="Category" items={CAT_ITEMS} value={cat} onChange={setCat} />
          <FilterSelect label="Stage" items={STAGE_ITEMS} value={stage} onChange={setStage} />
          <FilterSelect label="Budget" items={BUDGET_ITEMS} value={budget === null ? 'any' : String(budget)} onChange={(k) => setBudget(k === 'any' ? null : Number(k))} />
        </FilterBar>
      </section>

      {q.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          Could not load the store. Try again in a moment.
        </p>
      )}

      {q.isPending && <SkeletonList className="mt-lg" count={3} lines={3} label="Loading the store" />}

      {d && d.featured.length > 0 && (
        <section className="mt-lg" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="text-title2">
            Featured this week
          </h2>
          <div className="mt-sm">
          {/* A single featured piece fills the row instead of sitting at a fixed card width with empty space beside it. */}
          <ul className={d.featured.length === 1 ? 'list-none' : 'scroll-row list-none gap-sm'}>
            {d.featured.map((f) => (
              <li key={`${f.type}-${f.type === 'item' ? f.item.id : f.type === 'kit' ? f.kit.id : f.listing.id}`} className={`flex ${d.featured.length === 1 ? 'w-full' : 'w-[260px] shrink-0'}`}>
                <FeaturedCard card={f} onOpen={setOpen} />
              </li>
            ))}
          </ul>
          </div>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="kits-heading">
        <h2 id="kits-heading" className="text-title2">
          Kits by budget
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">What to buy at your stage, and what it comes to. A kit can mix new gear with pre-owned pieces.</p>
        {kits.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">{d?.kits.length ? 'Nothing in this budget or stage.' : 'No kits yet.'}</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {kits.map((k, n) => (
            <Reveal as="li" key={k.id} index={n} className={cardClass(isFeatured(k.featuredUntil))}>
              <KitBody kit={k} team={teamItems('kit', k.id, k.featuredUntil)} />
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="new-heading">
        <h2 id="new-heading" className="text-title2">
          New
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Picked by the team. Each link opens the seller's site.</p>
        {items.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">{d?.items.length ? 'Nothing here for these filters.' : 'Nothing on the shelf yet.'}</p>}
        <ul data-tile-list="paged" className={`mt-sm grid list-none gap-xs p-0 m-0 ${evenGrid(items.length, PAIR_COLS)}`}>
          {items.map((i, n) => (
            <Reveal as="li" key={i.id} index={n} className={`${cardClass(isFeatured(i.featuredUntil))} ${evenTile(n, items.length, PAIR_COLS)}`}>
              <ItemBody item={i} team={teamItems('item', i.id, i.featuredUntil)} />
            </Reveal>
          ))}
        </ul>
        <Pager page={d?.itemsPage} prefix="i" label="new gear" />
      </section>

      <section className="mt-lg" aria-labelledby="preowned-heading">
        <h2 id="preowned-heading" className="text-title2">
          Pre-owned
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Tap one to make an offer or ask a question. Sold ones stay two weeks, so you see prices.</p>
        {listings.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">{d?.listings.length ? 'Nothing here for these filters.' : 'Nothing listed yet. Yours could be first.'}</p>}
        <ul data-tile-list="paged" className={`mt-sm grid list-none gap-xs p-0 m-0 ${evenGrid(listings.length, PAIR_COLS)}`}>
          {listings.map((l, n) => (
            <Reveal as="li" key={l.id} index={n} className={`flex ${evenTile(n, listings.length, PAIR_COLS)}`}>
              <ListingButton l={l} onOpen={setOpen} />
            </Reveal>
          ))}
        </ul>
        <Pager page={d?.listingsPage} prefix="l" label="pre-owned gear" />
      </section>

      {d && (d.mine.listings.length > 0 || d.mine.offers.length > 0) && (
        <section className="mt-lg" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-title2">
            Yours
          </h2>
          {d.mine.listings.length > 0 && (
            <ul data-tile-list="their own, up to twenty" className={`mt-sm grid list-none gap-xs p-0 m-0 ${evenGrid(d.mine.listings.length, PAIR_COLS)}`}>
              {d.mine.listings.map((l, n) => (
                <li key={l.id} className={`flex ${evenTile(n, d.mine.listings.length, PAIR_COLS)}`}>
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
                      <span className="block text-card-title">{o.listingTitle}</span>
                      <span className="block text-card-note text-ink-soft">Your offer {money(o.cents, 'INR')}</span>
                    </span>
                    <StatusTag tone={o.status === 'accepted' ? 'good' : o.status === 'declined' ? 'bad' : o.status === 'open' ? 'info' : 'neutral'}>{o.status}</StatusTag>
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
      <span className="text-title3 type-figure leading-none">{money(cents, currency)}</span>
      {original && original > cents && <span className="text-caption text-ink-mute line-through">{money(original, currency)}</span>}
    </span>
  );
}

/** One More button for the team's actions, sitting beside the card's main action at its foot; nothing when there are none. */
function TeamMenu({ title, items }: { title: string; items: MoreMenuItem[] }) {
  if (items.length === 0) return null;
  return <MoreMenu label={`Team actions for ${title}`} title={title} items={items} />;
}

/** The facts on a store card, at its foot: one line that fills, so no tag stands alone. */
function TagRow({ children }: { children: ReactNode }) {
  return <span className="fill-row-all flex min-w-0 flex-wrap gap-xs">{children}</span>;
}

// A store card is placed like every card (2026-11-05): the title at the top left, the price in the top right corner, the words under
// them, then at the foot the tags on the left and the main action at the bottom right, so the cards of a row line up.
function ItemBody({ item, team = [] }: { item: StoreItem; team?: MoreMenuItem[] }) {
  // Pictures and videos are edited from the card's More menu (the team's), never a button of their own.
  const [editingMedia, setEditingMedia] = useState(false);
  const mediaItem = useMediaMenuItem('item', item.id, () => setEditingMedia(true));
  const menu = mediaItem ? [mediaItem, ...team] : team;
  return (
    <div className="flex h-full flex-col">
      {item.imageUrl && <FadeImage src={item.imageUrl} alt={item.title} loading="lazy" decoding="async" frame="mb-sm aspect-video w-full rounded-tile bg-paper" className="h-full w-full object-cover" />}
      <CardHead tag={<Price cents={item.priceCents} currency={item.currency} />}>
        <span className="block text-balance text-card-title">{item.title}</span>
      </CardHead>
      {item.description && <span className="mt-xs block text-card-note text-ink-soft">{item.description}</span>}
      <div className="mt-auto flex flex-col gap-xs pt-sm">
        <span className="flex">
          <TagRow>
            {isFeatured(item.featuredUntil) && <FeaturedTag />}
            <FactTag kind="category">{item.category}</FactTag>
            {item.stage !== 'any' && <IconTag tone="calm" icon="Sprout">{STORE_STAGE_META[item.stage].name}</IconTag>}
          </TagRow>
        </span>
        {!item.unlock.ok && <LockedButton unlock={item.unlock} />}
        <div className="flex items-end justify-between gap-sm">
          <span className="min-w-0 text-caption text-ink-mute">{item.unlock.ok ? `Partner link. Kreators may earn a share.${item.minPoints > 0 || item.minXp > 0 || item.badge ? ` ${unlockAt(item.unlock)}. You have it.` : ''}` : ''}</span>
          <span className="flex shrink-0 items-center gap-xs">
            <TeamMenu title={item.title} items={menu} />
            {item.unlock.ok ? (
              // The outline look Tools uses for Open and Get it, so the screen keeps one solid button, Sell something.
              <a href={`/out/item/${item.id}`} target="_blank" rel="noreferrer" className="toy toy-ink inline-flex min-h-[44px] items-center rounded-pill border-2 border-ink bg-card px-sm text-subhead font-semibold">
                Get it
              </a>
            ) : null}
          </span>
        </div>
      </div>
      <MediaSection type="item" id={item.id} title="More pictures, GIFs and video" trigger={null} open={editingMedia} onOpenChange={setEditingMedia} />
    </div>
  );
}

function KitBody({ kit, team = [] }: { kit: StoreKit; team?: MoreMenuItem[] }) {
  const over = kit.budgetCents > 0 && kit.totalCents > kit.budgetCents;
  return (
    <div className="flex h-full flex-col">
      <CardHead tag={<IconTag tone="calm" icon="Sprout" fit>{STORE_STAGE_META[kit.stage].name}</IconTag>}>
        <span className="block text-balance text-card-title">{kit.title}</span>
      </CardHead>
      {kit.description && <span className="mt-xs block text-card-note text-ink-soft">{kit.description}</span>}
      <ul className="mt-xs list-none p-0 m-0">
        {kit.items.map((it) => (
          <li key={`${it.type}-${it.id}`} className="flex items-baseline justify-between gap-sm border-t border-line py-xs text-subhead">
            <span className="min-w-0 flex-1">
              {it.title}
              <span className="text-ink-soft"> · {it.type === 'listing' ? (it.status === 'live' ? 'pre-owned' : `pre-owned, ${it.status}`) : 'new'}</span>
            </span>
            <span className="shrink-0 font-semibold">{money(it.priceCents, kit.currency)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-sm pt-sm">
        <span className="flex min-w-0 flex-col items-start gap-xs">
          {(isFeatured(kit.featuredUntil) || kit.budgetCents > 0) && (
            <TagRow>
              {isFeatured(kit.featuredUntil) && <FeaturedTag />}
              {kit.budgetCents > 0 && <FactTag kind="price">{`Budget ${money(kit.budgetCents, kit.currency)}`}</FactTag>}
            </TagRow>
          )}
          <span className={`text-subhead font-semibold ${over ? 'text-r1' : ''}`}>
            Comes to {money(kit.totalCents, kit.currency)}
            {over ? ', over the budget' : ''}
          </span>
        </span>
        <TeamMenu title={kit.title} items={team} />
      </div>
    </div>
  );
}

function ListingButton({ l, onOpen }: { l: PreownedListing; onOpen: (id: string) => void }) {
  // The picture and the title at the top left, the price in the corner, who and where under the title, the condition, trust and
  // state as tags at the foot and an arrow at the bottom right.
  return (
    <button type="button" onClick={() => onOpen(l.id)} className={`fx-spot toy group flex h-full w-full flex-col text-left text-ink ${cardClass(isFeatured(l.featuredUntil) && l.status === 'live')}`}>
      <CardHead
        lead={l.images[0] ? <FadeImage src={l.images[0]} alt={l.title} loading="lazy" decoding="async" frame="size-[64px] rounded-inner bg-paper" className="h-full w-full object-cover" /> : null}
        tag={<Price cents={l.priceCents} original={l.originalCents} currency={l.currency} />}
      >
        <span className="block text-balance text-headline">{l.title}</span>
        <span className="block text-caption text-ink-soft">
          {l.offers > 0 ? `${l.offers} ${l.offers === 1 ? 'offer' : 'offers'}` : 'No offers yet'}
          {l.city ? ` · ${l.city}` : ''}
          {l.mine ? ' · yours' : ` · ${l.sellerName}`}
        </span>
      </CardHead>
      <span className="mt-auto flex items-end justify-between gap-xs pt-sm">
        <TagRow>
          {isFeatured(l.featuredUntil) && l.status === 'live' && <FeaturedTag />}
          {l.status === 'sold' && <StatusTag tone="good">Sold{l.soldCents ? ` for ${money(l.soldCents, l.currency)}` : ''}</StatusTag>}
          {l.status === 'agreed' && <StatusTag tone="info">Offer accepted</StatusTag>}
          {l.status === 'withdrawn' && <StatusTag tone="bad">Taken down</StatusTag>}
          <IconTag tone="info" icon="Sparkle">{PREOWNED_CONDITION_META[l.condition].name}</IconTag>
          {l.isKit && <FactTag kind="category">Whole setup</FactTag>}
          <IconTag tone="good" icon="ShieldCheck" title={l.sellerTrust.label}>{`Trust ${l.sellerTrust.score}`}</IconTag>
        </TagRow>
        <Icon icon={ArrowRight} size={16} className="read-arrow mb-xs shrink-0 text-ink-mute" />
      </span>
    </button>
  );
}

function FeaturedCard({ card, onOpen }: { card: MarketCard; onOpen: (id: string) => void }) {
  if (card.type === 'listing') return <ListingButton l={card.listing} onOpen={onOpen} />;
  return (
    <div className={`w-full ${cardClass(true)}`}>
      {card.type === 'item' ? <ItemBody item={card.item} /> : <KitBody kit={card.kit} />}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-subhead font-semibold">{label}</span>
      {children}
    </label>
  );
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
        priceCents: typedCents(price),
        originalCents: original ? typedCents(original) : null,
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
        <p className="m-0 text-subhead text-ink-soft">Say what it is, its state and your price. You and the buyer settle the handover.</p>
        <Field label="What is it">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Sony ZV-E10 body" className={FIELD} />
        </Field>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Category</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {STORE_CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={pill(category === c)}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Condition</legend>
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
            <input type="number" min={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={FIELD} />
          </Field>
          <Field label="What it cost new">
            <input type="number" min={0} inputMode="numeric" value={original} onChange={(e) => setOriginal(e.target.value)} className={FIELD} />
          </Field>
          <Field label="Bought in">
            <input type="number" min={1990} max={2100} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" className={FIELD} />
          </Field>
          <Field label="City">
            <input value={where} onChange={(e) => setWhere(e.target.value)} maxLength={80} className={FIELD} />
          </Field>
        </div>
        <Field label="What comes with it">
          <input value={includes} onChange={(e) => setIncludes(e.target.value)} maxLength={300} placeholder="Box, charger, two batteries" className={FIELD} />
        </Field>
        <Field label="Anything a buyer should know">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={3000} placeholder="Shutter count, marks, repairs." className={FIELD} />
        </Field>
        <Field label="Picture links, one per line (https)">
          <textarea value={images} onChange={(e) => setImages(e.target.value)} rows={2} className={FIELD} />
        </Field>
        <label className="flex min-h-[44px] items-center gap-sm">
          <input type="checkbox" checked={isKit} onChange={(e) => setIsKit(e.target.checked)} className="size-[20px]" />
          <span className="text-subhead">This is a whole setup sold together</span>
        </label>
        <ErrorLine e={save.isError ? save.error : null} />
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
  const [minPoints, setMinPoints] = useState('0');
  const [minXp, setMinXp] = useState('0');
  const [badge, setBadge] = useState('');
  const save = useMutation({
    mutationFn: () => api.marketAddItem({ title, category, stage, priceCents: typedCents(price), url, imageUrl: image, description, minPoints: Number(minPoints) || 0, minXp: Number(minXp) || 0, badge }),
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
        <p className="m-0 text-subhead text-ink-soft">Team only. The link is the partner link; people go through it when they tap Get it.</p>
        <Field label="Name">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={FIELD} />
        </Field>
        <Field label="Partner link">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://" className={FIELD} />
        </Field>
        <div className="grid grid-cols-2 gap-xs">
          <Field label="Price, INR">
            <input type="number" min={0} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={FIELD} />
          </Field>
          <Field label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value as StoreStage)} className={FIELD}>
              {STORE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STORE_STAGE_META[s].name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Category</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {STORE_CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={pill(category === c)}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Picture link (https)">
          <input type="url" value={image} onChange={(e) => setImage(e.target.value)} maxLength={500} className={FIELD} />
        </Field>
        <Field label="Why it is on the shelf">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={FIELD} />
        </Field>
        <div className="grid grid-cols-2 gap-xs">
          <Field label="Xp of at least">
            <input type="number" min={0} value={minXp} onChange={(e) => setMinXp(e.target.value)} className={FIELD} />
          </Field>
          <Field label="Points of at least">
            <input type="number" min={0} value={minPoints} onChange={(e) => setMinPoints(e.target.value)} className={FIELD} />
          </Field>
          {/* The third field takes the whole second row, so the row is filled (the form rules, 2026-11-06). */}
          <Field label="Holds the badge" className="col-span-2">
            <select value={badge} onChange={(e) => setBadge(e.target.value)} className={FIELD}>
              <option value="">Any badge or none</option>
              {PUBLIC_BADGES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorLine e={save.isError ? save.error : null} />
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
    mutationFn: () => api.marketAddKit({ title, stage, budgetCents: typedCents(budget), description, items: picked }),
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
        <p className="m-0 text-subhead text-ink-soft">Team only. Pick what to buy at this stage, in this budget, new or pre-owned.</p>
        <Field label="Name">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Starter kit under 50k" className={FIELD} />
        </Field>
        <div className="grid grid-cols-2 gap-xs">
          <Field label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value as StoreStage)} className={FIELD}>
              {STORE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STORE_STAGE_META[s].name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Budget, INR">
            <input type="number" min={0} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} className={FIELD} />
          </Field>
        </div>
        <Field label="Who it is for">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} className={FIELD} />
        </Field>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Pieces</legend>
          <ul className="mt-xs flex max-h-[280px] list-none flex-col gap-xs overflow-y-auto p-0 m-0">
            {items.map((i) => (
              <li key={i.id}>
                <label className="flex min-h-[44px] items-center gap-sm rounded-tile bg-paper px-sm">
                  <input type="checkbox" checked={has('item', i.id)} onChange={() => toggle('item', i.id)} className="size-[20px]" />
                  <span className="min-w-0 flex-1 truncate text-subhead font-semibold">{i.title}</span>
                  <span className="text-subhead text-ink-soft">{money(i.priceCents, i.currency)}</span>
                </label>
              </li>
            ))}
            {listings.map((l) => (
              <li key={l.id}>
                <label className="flex min-h-[44px] items-center gap-sm rounded-tile bg-paper px-sm">
                  <input type="checkbox" checked={has('listing', l.id)} onChange={() => toggle('listing', l.id)} className="size-[20px]" />
                  <span className="min-w-0 flex-1 truncate text-subhead font-semibold">
                    {l.title} <span className="text-ink-soft">· pre-owned</span>
                  </span>
                  <span className="text-subhead text-ink-soft">{money(l.priceCents, l.currency)}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="m-0 text-subhead font-semibold">Comes to {money(total, 'INR')}</p>
        <ErrorLine e={save.isError ? save.error : null} />
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || picked.length === 0}>
          Make the kit
        </Button>
      </form>
    </Sheet>
  );
}
