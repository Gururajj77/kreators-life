import { PREOWNED_CONDITION_META, type PreownedOffer } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { prettyDate } from '../lib/date';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { money } from './PeriodPanel';
import { Sheet } from './Sheet';
import { TrustBadge } from './TrustBadge';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const offerWord: Record<PreownedOffer['status'], string> = { open: 'waiting', accepted: 'accepted', declined: 'declined', withdrawn: 'withdrawn' };

interface Props {
  id: string | null;
  onClose: () => void;
  feature: { feePoints: number; days: number; points: number };
}

/**
 * One pre-owned listing, opened from the Store: the details, then an offer and a chat for a buyer,
 * or the offers, the chats and the sold button for the seller.
 */
export function ListingSheet({ id, onClose, feature }: Props) {
  const token = useSession((s) => s.token);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['market', 'listing', id], queryFn: () => api.marketListing(id!), enabled: Boolean(token && id), refetchInterval: 10_000 });
  const d = q.data;
  const l = d?.listing;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['market'] });
  };
  const [cents, setCents] = useState('');
  const [note, setNote] = useState('');
  const [text, setText] = useState('');
  const [buyer, setBuyer] = useState<string | null>(null);
  const [soldFor, setSoldFor] = useState('');
  const thread = useQuery({ queryKey: ['market', 'thread', id, buyer], queryFn: () => api.marketMessages(id!, buyer!), enabled: Boolean(token && id && buyer && l?.mine), refetchInterval: 10_000 });

  const offer = useMutation({ mutationFn: () => api.marketOffer(id!, Math.round(Number(cents) * 100), note), onSuccess: () => { setCents(''); setNote(''); refresh(); } });
  const decide = useMutation({ mutationFn: (v: { offerId: string; action: 'accept' | 'decline' | 'withdraw' }) => api.marketDecide(v.offerId, v.action), onSuccess: refresh });
  const send = useMutation({ mutationFn: () => api.marketSend(id!, text, l?.mine ? (buyer ?? undefined) : undefined), onSuccess: () => { setText(''); refresh(); void thread.refetch(); } });
  const sold = useMutation({ mutationFn: () => api.marketSold(id!, soldFor ? Math.round(Number(soldFor) * 100) : null), onSuccess: refresh });
  const status = useMutation({ mutationFn: (s: 'live' | 'withdrawn') => api.marketUpdateListing(id!, { status: s }), onSuccess: refresh });
  const promote = useMutation({ mutationFn: () => api.marketFeature('listing', id!), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api.marketRemoveListing(id!), onSuccess: () => { refresh(); onClose(); } });
  const err = (m: { isError: boolean; error: unknown }) => (m.isError ? <p role="alert" className="mt-xs m-0 text-[14px] font-bold">{m.error instanceof Error ? m.error.message : 'That did not work.'}</p> : null);

  const messages = l?.mine ? (thread.data?.messages ?? []) : (d?.messages ?? []);
  const accepted = d?.offers.find((o) => o.status === 'accepted') ?? null;

  return (
    <Sheet open={id !== null} onClose={onClose} title={l?.title ?? 'Listing'}>
      {!l && <p className="m-0 text-[14px] font-bold text-ink-soft" role="status">{q.isError ? 'Could not load this one.' : 'Opening'}</p>}
      {l && (
        <div className="flex flex-col gap-md pb-xl">
          {l.images.length > 0 && (
            <div className="-mx-xs flex gap-xs overflow-x-auto px-xs scrollbar-none">
              {l.images.map((src) => (
                <img key={src} src={src} alt="" loading="lazy" className="h-[180px] w-[240px] shrink-0 rounded-tile bg-paper object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              ))}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-baseline gap-xs">
              <span className="font-display text-[28px] font-extrabold leading-none">{money(l.priceCents, l.currency)}</span>
              {l.originalCents && l.originalCents > l.priceCents && (
                <>
                  <span className="text-[14px] font-bold text-ink-mute line-through">{money(l.originalCents, l.currency)}</span>
                  <span className="rounded-pill bg-r4 px-xs text-[12px] font-extrabold leading-[20px] text-on-fill">Save {money(l.originalCents - l.priceCents, l.currency)}</span>
                </>
              )}
            </div>
            <p className="mt-xs m-0 text-[14px] font-bold">
              {PREOWNED_CONDITION_META[l.condition].name}
              {l.purchaseYear ? ` · bought ${l.purchaseYear}` : ''}
              {l.isKit ? ' · whole setup' : ''}
              {l.city ? ` · ${l.city}` : ''}
            </p>
            <p className="m-0 text-[12px] font-bold text-ink-soft">{PREOWNED_CONDITION_META[l.condition].blurb}</p>
            {l.status === 'sold' && <p className="mt-xs m-0 rounded-tile bg-paper px-sm py-xs text-[14px] font-extrabold">Sold{l.soldCents ? ` for ${money(l.soldCents, l.currency)}` : ''}.</p>}
            {l.status === 'agreed' && <p className="mt-xs m-0 rounded-tile bg-paper px-sm py-xs text-[14px] font-extrabold">An offer was accepted. The handover is being sorted in the chat.</p>}
            {l.status === 'withdrawn' && <p className="mt-xs m-0 rounded-tile bg-paper px-sm py-xs text-[14px] font-extrabold">Taken down for now.</p>}
          </div>
          {l.description && <p className="m-0 text-[16px] font-semibold whitespace-pre-wrap">{l.description}</p>}
          {l.includes && (
            <p className="m-0 text-[14px] font-semibold text-ink-soft">
              <span className="font-bold text-ink">Comes with: </span>
              {l.includes}
            </p>
          )}
          <div>
            <TrustBadge trust={l.sellerTrust} size="sm" />
          </div>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            Sold by {l.sellerName}
            {l.sellerHandle ? ` (@${l.sellerHandle})` : ''}. Listed {prettyDate(l.createdAt.slice(0, 10))}. Settle the payment and the handover between you; kreators.app takes nothing from it.
          </p>

          {!l.mine && (
            <>
              <section aria-labelledby="offer-heading">
                <h3 id="offer-heading" className="m-0 text-[18px]">
                  Your offer
                </h3>
                {d?.myOffer ? (
                  <div className="mt-xs rounded-tile bg-paper p-sm">
                    <p className="m-0 text-[16px] font-bold">
                      {money(d.myOffer.cents, l.currency)} · {offerWord[d.myOffer.status]}
                    </p>
                    {d.myOffer.note && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{d.myOffer.note}</p>}
                    {d.myOffer.status === 'open' && (
                      <Button variant="outline" size="sm" className="mt-sm" onClick={() => decide.mutate({ offerId: d.myOffer!.id, action: 'withdraw' })} disabled={decide.isPending}>
                        Take it back
                      </Button>
                    )}
                  </div>
                ) : l.status !== 'live' ? (
                  <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No longer open to offers.</p>
                ) : (
                  <form
                    className="mt-xs"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      offer.mutate();
                    }}
                  >
                    <label className="block text-[14px] font-bold" htmlFor="offer-cents">
                      How much, in {l.currency}
                    </label>
                    <input id="offer-cents" type="number" min={1} step="1" inputMode="numeric" value={cents} onChange={(e) => setCents(e.target.value)} placeholder={String(Math.round(l.priceCents / 100))} className={field} />
                    <label className="mt-sm block text-[14px] font-bold" htmlFor="offer-note">
                      A line for the seller
                    </label>
                    <input id="offer-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Can pick up this weekend" className={field} />
                    {err(offer)}
                    <Button type="submit" className="mt-sm" disabled={!cents || offer.isPending}>
                      Make the offer
                    </Button>
                  </form>
                )}
              </section>
              <Chat messages={messages} text={text} setText={setText} onSend={() => send.mutate()} busy={send.isPending} error={err(send)} title={`Chat with ${l.sellerName}`} />
            </>
          )}

          {l.mine && (
            <>
              <section aria-labelledby="offers-heading">
                <h3 id="offers-heading" className="m-0 text-[18px]">
                  Offers
                </h3>
                {d?.offers.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">None yet. A featured week puts it at the top.</p>}
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  {d?.offers.map((o) => (
                    <li key={o.id} className="rounded-tile bg-paper p-sm">
                      <p className="m-0 text-[16px] font-bold">
                        {money(o.cents, l.currency)} from {o.buyerName} · {offerWord[o.status]}
                      </p>
                      {o.note && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{o.note}</p>}
                      {o.status === 'open' && (
                        <div className="mt-sm flex gap-xs">
                          <Button size="sm" onClick={() => decide.mutate({ offerId: o.id, action: 'accept' })} disabled={decide.isPending}>
                            Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => decide.mutate({ offerId: o.id, action: 'decline' })} disabled={decide.isPending}>
                            Decline
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {err(decide)}
              </section>
              <section aria-labelledby="chats-heading">
                <h3 id="chats-heading" className="m-0 text-[18px]">
                  Chats
                </h3>
                {d?.threads.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nobody has written yet.</p>}
                {d && d.threads.length > 0 && (
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {d.threads.map((t) => (
                      <button key={t.buyerId} type="button" aria-pressed={buyer === t.buyerId} onClick={() => setBuyer(t.buyerId)} className={`toy min-h-[40px] rounded-pill border-2 px-sm text-[14px] font-bold ${buyer === t.buyerId ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`}>
                        {t.buyerName} · {t.count}
                      </button>
                    ))}
                  </div>
                )}
                {buyer && <Chat messages={messages} text={text} setText={setText} onSend={() => send.mutate()} busy={send.isPending} error={err(send)} title="" />}
              </section>
              <section aria-labelledby="seller-heading" className="rounded-card bg-paper p-sm">
                <h3 id="seller-heading" className="m-0 text-[18px]">
                  Your listing
                </h3>
                {l.status !== 'sold' && (
                  <form
                    className="mt-xs flex flex-wrap items-end gap-xs"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sold.mutate();
                    }}
                  >
                    <label className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold">Sold for, in {l.currency}</span>
                      <input type="number" min={0} inputMode="numeric" value={soldFor} onChange={(e) => setSoldFor(e.target.value)} placeholder={String(Math.round((accepted?.cents ?? l.priceCents) / 100))} className={field} />
                    </label>
                    <Button type="submit" disabled={sold.isPending}>
                      Mark as sold
                    </Button>
                  </form>
                )}
                <div className="mt-sm flex flex-wrap gap-xs">
                  {l.status === 'live' && (
                    <Button variant="outline" size="sm" onClick={() => promote.mutate()} disabled={promote.isPending || Boolean(l.featuredUntil && l.featuredUntil > new Date().toISOString())}>
                      {l.featuredUntil && l.featuredUntil > new Date().toISOString() ? `Featured until ${prettyDate(l.featuredUntil.slice(0, 10))}` : `Feature for ${feature.days} days · ${feature.feePoints} points`}
                    </Button>
                  )}
                  {l.status === 'live' && (
                    <Button variant="outline" size="sm" onClick={() => status.mutate('withdrawn')} disabled={status.isPending}>
                      Take it down
                    </Button>
                  )}
                  {l.status === 'withdrawn' && (
                    <Button variant="outline" size="sm" onClick={() => status.mutate('live')} disabled={status.isPending}>
                      Put it back up
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}>
                    Delete
                  </Button>
                </div>
                <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">You have {feature.points} points.</p>
                {err(promote)}
                {err(sold)}
              </section>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Chat({ messages, text, setText, onSend, busy, error, title }: { messages: { id: string; mine: boolean; senderName: string; body: string; createdAt: string }[]; text: string; setText: (v: string) => void; onSend: () => void; busy: boolean; error: React.ReactNode; title: string }) {
  return (
    <section aria-label={title || 'Chat'}>
      {title && <h3 className="m-0 text-[18px]">{title}</h3>}
      <ul className="mt-xs flex max-h-[280px] list-none flex-col gap-xs overflow-y-auto p-0 m-0" aria-live="polite">
        {messages.length === 0 && <li className="text-[14px] font-semibold text-ink-soft">Nothing said yet. Ask about the condition or the handover.</li>}
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-tile px-sm py-xs ${m.mine ? 'self-end bg-ink text-on-ink' : 'self-start bg-paper'}`}>
            <span className="block text-[14px] font-semibold">{m.body}</span>
            <span className={`block text-[12px] font-bold ${m.mine ? 'text-on-ink/70' : 'text-ink-soft'}`}>
              {m.mine ? 'You' : m.senderName} · {prettyDate(m.createdAt.slice(0, 10))}
            </span>
          </li>
        ))}
      </ul>
      <form
        className="mt-xs flex gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSend();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Write a message" aria-label="Message" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-paper px-md py-sm text-[16px]" />
        <Button type="submit" disabled={!text.trim() || busy}>
          Send
        </Button>
      </form>
      {error}
    </section>
  );
}
