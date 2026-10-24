import { PRODUCT_KIND_META } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useMe, useRefreshAll } from '../lib/queries';
import { storedRef, useSession } from '../lib/store';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

export function ProductPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const token = useSession((s) => s.token);
  const me = useMe();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const q = useQuery({ queryKey: ['product', id, token], queryFn: () => api.publicProduct(id) });
  const [coupon, setCoupon] = useState('');
  const [offer, setOffer] = useState('');
  const [question, setQuestion] = useState('');
  const [intake, setIntake] = useState<string[]>([]);
  const params = new URLSearchParams(loc.search);
  const src = params.get('src');
  const click = params.get('click');
  const d = q.data;
  const p = d?.product;
  const meta = p ? PRODUCT_KIND_META[p.kind] : null;
  const points = me.data?.user.points ?? 0;
  const isPast = Boolean(p?.startsAt && new Date(p.startsAt).getTime() < Date.now());
  const replayForSale = Boolean(p && p.kind === 'event' && isPast && p.replayPoints > 0);
  const needsIntake = Boolean(p && p.kind !== 'session' && p.intake.length > 0);
  const price = p ? (p.pwyw ? Math.max(p.pricePoints, Number(offer) || 0) : p.pricePoints) : 0;

  const buy = useMutation({
    mutationFn: ({ pay, replay }: { pay: 'points' | 'test'; replay?: boolean }) =>
      api.checkout(id, {
        coupon: coupon || undefined,
        affiliate: storedRef(),
        pay,
        points: p?.pwyw ? price : undefined,
        question: p?.kind === 'dm' ? question : undefined,
        intake: needsIntake ? intake : undefined,
        replay,
        click,
        src,
      }),
    onSuccess: async () => {
      await refresh();
      q.refetch();
      celebrate({ title: 'It is yours', color: '#FACC15' });
      nav(`/library/${id}`);
    },
  });

  const ready = (p?.kind !== 'dm' || question.trim().length > 0) && (!needsIntake || intake.filter((a) => a.trim()).length >= (p?.intake.length ?? 0)) && (!p?.pwyw || price >= (p?.pricePoints ?? 0));
  const buyLabel = (label: string) => (p?.pricePoints === 0 && !p?.pwyw ? `${label} for free` : `${label} for ${price} points`);

  return (
    <Screen tabs={false}>
      <header className="pt-lg">
        <Link to={p?.ownerHandle ? `/u/${p.ownerHandle}` : token ? '/apps' : '/'} className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {p?.ownerName ?? 'Back'}
        </Link>
      </header>
      {q.isError && <p className="mt-md font-bold">That product is not available.</p>}
      {p && meta && (
        <>
          <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
            <span className="text-[48px]" aria-hidden="true">
              {p.cover || meta.emoji}
            </span>
            <p className="mt-sm m-0 text-[14px] font-bold text-ink-soft">
              {meta.name} by {p.ownerName}
              {p.rating ? `, rated ${p.rating} by buyers` : ''}
            </p>
            <h1 className="text-[30px]">{p.title}</h1>
            {p.description && <p className="mt-sm m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{p.description}</p>}
            <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0 text-[14px] font-bold">
              {p.kind === 'course' && <li>{d.lessonCount} lessons{p.certificate ? ', with a certificate at the end' : ''}</li>}
              {p.kind === 'event' && p.startsAt && <li>{new Date(p.startsAt).toLocaleString()}</li>}
              {p.kind === 'event' && p.capacity && (
                <li>
                  {Math.max(0, p.capacity - p.sold)} of {p.capacity} seats left
                </li>
              )}
              {p.kind === 'session' && <li>{p.durationMin} minutes, booked from the creator's availability after purchase</li>}
              {p.kind === 'membership' && <li>Access to a members-only feed</li>}
              {p.kind === 'bundle' && <li>Includes {p.bundleIds.length} products</li>}
              {p.kind === 'locked' && <li>One post, shown to you after purchase</li>}
              {p.kind === 'dm' && <li>A written answer within {p.responseDays ?? 3} days</li>}
              {p.kind === 'payment' && <li>{p.pwyw ? `Pay what you want, from ${p.pricePoints} points` : 'A one-off payment'}</li>}
              {p.pwyw && p.kind !== 'payment' && <li>Pay what you want, from {p.pricePoints} points</li>}
              <li>{p.sold} people have this</li>
            </ul>
          </div>

          {d.owned ? (
            <Link to={`/library/${p.id}`} className="toy mt-md flex min-h-[56px] items-center justify-center rounded-pill bg-ink px-md text-[18px] font-bold text-on-ink">
              Open in my purchases
            </Link>
          ) : !token ? (
            <Link to={`/signin?next=${encodeURIComponent(`${loc.pathname}${loc.search}`)}`} className="toy mt-md flex min-h-[56px] items-center justify-center rounded-pill bg-ink px-md text-[18px] font-bold text-on-ink">
              Join to {meta.buy.toLowerCase()}
            </Link>
          ) : (
            <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="buy-heading">
              <h2 id="buy-heading" className="text-[24px]">
                {replayForSale ? 'This event has happened' : meta.buy}
              </h2>
              {replayForSale && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">The recording is for sale. Ticket holders already have it in their purchases.</p>}
              {p.pwyw && !replayForSale && (
                <label className="mt-sm block">
                  <span className="block text-[14px] font-bold">What you want to pay, in points</span>
                  <input type="number" min={p.pricePoints} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={String(p.pricePoints)} className={field} />
                  <span className="mt-xs block text-[12px] font-bold text-ink-soft">At least {p.pricePoints}.</span>
                </label>
              )}
              {p.kind === 'dm' && (
                <label className="mt-sm block">
                  <span className="block text-[14px] font-bold">Your question</span>
                  <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} maxLength={2000} required className={field} placeholder="Be specific. You get one written answer." />
                </label>
              )}
              {needsIntake &&
                p.intake.map((qn, i) => (
                  <label key={i} className="mt-sm block">
                    <span className="block text-[14px] font-bold">{qn}</span>
                    <input value={intake[i] ?? ''} onChange={(e) => setIntake((list) => p.intake.map((_, j) => (j === i ? e.target.value : (list[j] ?? ''))))} maxLength={500} required className={field} />
                  </label>
                ))}
              {!replayForSale && (
                <label className="mt-sm block">
                  <span className="block text-[14px] font-bold">Coupon</span>
                  <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Optional" className={field} />
                </label>
              )}
              {buy.isError && (
                <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
                  {buy.error instanceof Error ? buy.error.message : 'Could not complete that.'}
                </p>
              )}
              {replayForSale ? (
                <Button full size="lg" className="mt-md" onClick={() => buy.mutate({ pay: 'points', replay: true })} disabled={buy.isPending}>
                  Buy the replay for {p.replayPoints} points
                </Button>
              ) : (
                <Button full size="lg" className="mt-md" onClick={() => buy.mutate({ pay: 'points' })} disabled={buy.isPending || !ready}>
                  {buyLabel(meta.buy)}
                </Button>
              )}
              <p className="mt-xs m-0 text-center text-[12px] font-bold text-ink-soft">You have {points} points.</p>
              {p.priceCents > 0 && !replayForSale && (
                <Button variant="outline" full className="mt-sm" onClick={() => buy.mutate({ pay: 'test' })} disabled={buy.isPending || !ready}>
                  Pay {(p.priceCents / 100).toFixed(2)} {p.currency} (test mode)
                </Button>
              )}
            </section>
          )}

          {d.testimonials.length > 0 && (
            <section className="mt-lg" aria-labelledby="rev-heading">
              <h2 id="rev-heading" className="text-[24px]">
                Reviews
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.testimonials.map((t) => (
                  <li key={t.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[14px] font-bold">
                      {'★'.repeat(t.rating)} {t.authorName}
                    </p>
                    <p className="mt-xs m-0 text-[16px] font-semibold">{t.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
