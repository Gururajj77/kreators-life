import { PRODUCT_KIND_META, type CourseDraft, type Lesson, type QuizQuestion , BADGES, HONORS} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll, useStudio } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

export function StudioProduct() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const q = useAuthed(['studio-product', id], () => api.studioProduct(id));
  const coupons = useAuthed(['coupons'], api.coupons);
  const studio = useStudio();
  const refresh = useRefreshAll();
  const d = q.data;
  const p = d?.product;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pricePoints, setPricePoints] = useState('0');
  const [priceCents, setPriceCents] = useState('0');
  const [url, setUrl] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [durationMin, setDurationMin] = useState('30');
  const [capacity, setCapacity] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [cover, setCover] = useState('');
  const [pwyw, setPwyw] = useState(false);
  const [intake, setIntake] = useState<string[]>([]);
  const [replayUrl, setReplayUrl] = useState('');
  const [replayPoints, setReplayPoints] = useState('0');
  const [bundleIds, setBundleIds] = useState<string[]>([]);
  const [lockedBody, setLockedBody] = useState('');
  const [responseDays, setResponseDays] = useState('3');
  const [leadMagnet, setLeadMagnet] = useState(false);
  const [certificate, setCertificate] = useState(false);
  const [bufferMin, setBufferMin] = useState('0');
  const [noticeHours, setNoticeHours] = useState('2');
  const [maxDaysAhead, setMaxDaysAhead] = useState('30');
  const [periodMonths, setPeriodMonths] = useState('');
  const [minPoints, setMinPoints] = useState('0');
  const [minXp, setMinXp] = useState('0');
  const [badge, setBadge] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [lesson, setLesson] = useState<Lesson | 'new' | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponOff, setCouponOff] = useState('20');

  useEffect(() => {
    if (!p) return;
    setTitle(p.title);
    setDescription(p.description);
    setPricePoints(String(p.pricePoints));
    setPriceCents(String(p.priceCents));
    setUrl(p.url ?? '');
    setStartsAt(p.startsAt ? p.startsAt.slice(0, 16) : '');
    setDurationMin(String(p.durationMin ?? 30));
    setCapacity(p.capacity ? String(p.capacity) : '');
    setMeetingUrl(p.meetingUrl ?? '');
    setCover(p.cover);
    setPwyw(p.pwyw);
    setIntake(p.intake);
    setReplayUrl(p.replayUrl ?? '');
    setReplayPoints(String(p.replayPoints));
    setBundleIds(p.bundleIds);
    setLockedBody(p.lockedBody);
    setResponseDays(String(p.responseDays ?? 3));
    setLeadMagnet(p.leadMagnet);
    setCertificate(p.certificate);
    setBufferMin(String(p.bufferMin));
    setNoticeHours(String(p.noticeHours));
    setMaxDaysAhead(String(p.maxDaysAhead));
    setPeriodMonths(p.periodMonths ? String(p.periodMonths) : '');
    setMinPoints(String(p.minPoints));
    setMinXp(String(p.minXp ?? 0));
    setBadge(p.badge);
  }, [p]);

  const save = useMutation({
    mutationFn: (status?: 'live' | 'draft' | 'archived') =>
      api.updateProduct(id, {
        title,
        description,
        pricePoints: Number(pricePoints) || 0,
        priceCents: Number(priceCents) || 0,
        url: url || null,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        durationMin: Number(durationMin) || 30,
        capacity: capacity ? Number(capacity) : null,
        meetingUrl: meetingUrl || null,
        cover,
        pwyw,
        intake: intake.map((s) => s.trim()).filter(Boolean),
        replayUrl: replayUrl || null,
        replayPoints: Number(replayPoints) || 0,
        bundleIds,
        lockedBody,
        responseDays: Number(responseDays) || 3,
        leadMagnet,
        certificate,
        bufferMin: Number(bufferMin) || 0,
        noticeHours: Number(noticeHours) || 0,
        maxDaysAhead: Number(maxDaysAhead) || 30,
        periodMonths: periodMonths ? Number(periodMonths) : null,
        minPoints: Number(minPoints) || 0,
        minXp: Number(minXp) || 0,
        badge,
        ...(status ? { status } : {}),
      }),
    onSuccess: () => refresh(),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteProduct(id),
    onSuccess: () => {
      refresh();
      nav('/shop');
    },
  });
  const addCoupon = useMutation({ mutationFn: () => api.createCoupon({ code: couponCode, percentOff: Number(couponOff), productId: id }), onSuccess: () => coupons.refetch() });
  const delCoupon = useMutation({ mutationFn: (cid: string) => api.deleteCoupon(cid), onSuccess: () => coupons.refetch() });

  if (q.isError) {
    return (
      <Screen>
        <p className="pt-lg font-bold">That product is not yours or does not exist.</p>
      </Screen>
    );
  }
  if (!p || !d) return null;
  const meta = PRODUCT_KIND_META[p.kind];
  const mine = coupons.data?.coupons.filter((c) => c.productId === id || c.productId === null) ?? [];
  const others = (studio.data?.products ?? []).filter((x) => x.id !== id && x.kind !== 'bundle');
  const priced = p.kind !== 'link';
  const setIntakeAt = (i: number, v: string) => setIntake((list) => list.map((x, j) => (j === i ? v : x)));

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/shop">Shop</BackLink>
        <p className="m-0 text-[14px] font-bold text-ink-soft">
          {meta.name}, {p.status}, {p.sold} sold{p.rating ? `, rated ${p.rating}` : ''}
        </p>
        <h1 className="text-[30px]">{p.title}</h1>
        <div className="mt-sm flex flex-wrap gap-xs">
          {p.status !== 'live' ? (
            <Button onClick={() => save.mutate('live')} disabled={save.isPending}>
              Publish
            </Button>
          ) : (
            <Button variant="outline" onClick={() => save.mutate('draft')} disabled={save.isPending}>
              Unpublish
            </Button>
          )}
          {p.status === 'live' && (
            <Link to={`/p/${p.id}`} className="toy toy-ink inline-flex min-h-[48px] items-center rounded-pill border-2 border-ink bg-card px-md font-bold">
              View as buyer
            </Link>
          )}
        </div>
      </header>

      <form
        className="mt-md flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Emoji cover</span>
            <input value={cover} onChange={(e) => setCover(e.target.value)} maxLength={8} className={field} />
          </label>
          {priced && (
            <label className="block">
              <span className="block text-[14px] font-bold">{pwyw ? 'Minimum points' : 'Points price'}</span>
              <input type="number" min={0} value={pricePoints} onChange={(e) => setPricePoints(e.target.value)} className={field} />
            </label>
          )}
        </div>
        {priced && (
          <label className="block">
            <span className="block text-[14px] font-bold">Money price, in {p.currency} cents (test mode)</span>
            <input type="number" min={0} value={priceCents} onChange={(e) => setPriceCents(e.target.value)} className={field} />
          </label>
        )}
        <fieldset className="m-0 rounded-tile border-2 border-line p-sm">
          <legend className="px-xs text-[14px] font-bold">Who can buy</legend>
          <p className="m-0 text-[12px] font-bold text-ink-soft">Leave them empty and anyone can. Set an xp floor, a points floor, a badge, or any mix, and only people who earned them can. A super admin is never locked out.</p>
          <div className="mt-xs grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-[14px] font-bold">Xp of at least</span>
              <input type="number" min={0} value={minXp} onChange={(e) => setMinXp(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Points balance of at least</span>
              <input type="number" min={0} value={minPoints} onChange={(e) => setMinPoints(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Holds the badge</span>
              <select value={badge} onChange={(e) => setBadge(e.target.value)} className={field}>
                <option value="">Any badge or none</option>
                {BADGES.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.emoji} {b.name}
                  </option>
                ))}
                {HONORS.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.emoji} {h.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        {(p.kind === 'payment' || p.kind === 'digital' || p.kind === 'locked') && (
          <label className="flex min-h-[44px] items-center gap-sm text-[14px] font-bold">
            <input type="checkbox" checked={pwyw} onChange={(e) => setPwyw(e.target.checked)} className="size-[20px] accent-ink" />
            Pay what you want, this price is the minimum
          </label>
        )}
        {p.kind === 'digital' && (
          <label className="flex min-h-[44px] items-center gap-sm text-[14px] font-bold">
            <input type="checkbox" checked={leadMagnet} onChange={(e) => setLeadMagnet(e.target.checked)} className="size-[20px] accent-ink" />
            <span>
              Capture the buyer as a lead
              <span className="block text-[12px] font-semibold text-ink-soft">Works when the price is zero: a free download in exchange for an email.</span>
            </span>
          </label>
        )}
        {(p.kind === 'digital' || p.kind === 'link') && (
          <label className="block">
            <span className="block text-[14px] font-bold">{p.kind === 'link' ? 'Link' : 'Download link, shown after purchase'}</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className={field} placeholder="https://" />
          </label>
        )}
        {p.kind === 'locked' && (
          <label className="block">
            <span className="block text-[14px] font-bold">The post, shown only after purchase</span>
            <textarea value={lockedBody} onChange={(e) => setLockedBody(e.target.value)} rows={8} maxLength={20000} className={field} placeholder="Text, links, a video address" />
          </label>
        )}
        {p.kind === 'bundle' && (
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-[14px] font-bold">Products in this bundle</legend>
            {others.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Make a few other products first.</p>}
            <div className="mt-xs flex flex-col gap-xs">
              {others.map((o) => {
                const on = bundleIds.includes(o.id);
                return (
                  <label key={o.id} className="flex min-h-[44px] items-center gap-sm rounded-tile bg-paper p-xs text-[14px] font-bold">
                    <input type="checkbox" checked={on} onChange={(e) => setBundleIds((list) => (e.target.checked ? [...list, o.id] : list.filter((x) => x !== o.id)))} className="size-[20px] accent-ink" />
                    <span className="min-w-0 flex-1 truncate">
                      {o.title} <span className="font-semibold text-ink-soft">{PRODUCT_KIND_META[o.kind].name}, {o.pricePoints} pts</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <span className="mt-xs block text-[12px] font-bold text-ink-soft">Buyers get every product inside at the bundle price.</span>
          </fieldset>
        )}
        {p.kind === 'dm' && (
          <label className="block">
            <span className="block text-[14px] font-bold">Answer within this many days</span>
            <input type="number" min={1} max={30} value={responseDays} onChange={(e) => setResponseDays(e.target.value)} className={field} />
            <span className="mt-xs block text-[12px] font-bold text-ink-soft">Questions arrive under Shop, Priority DMs.</span>
          </label>
        )}
        {p.kind === 'event' && (
          <>
            <label className="block">
              <span className="block text-[14px] font-bold">Starts at</span>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Capacity, blank for unlimited</span>
              <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Recording link, shown to ticket holders afterwards</span>
              <input value={replayUrl} onChange={(e) => setReplayUrl(e.target.value)} className={field} placeholder="https://" />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Price for people who missed it, in points</span>
              <input type="number" min={0} value={replayPoints} onChange={(e) => setReplayPoints(e.target.value)} className={field} />
              <span className="mt-xs block text-[12px] font-bold text-ink-soft">Zero means the replay is not for sale.</span>
            </label>
          </>
        )}
        {(p.kind === 'event' || p.kind === 'session') && (
          <label className="block">
            <span className="block text-[14px] font-bold">Joining link, shown to ticket holders</span>
            <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} className={field} placeholder="Zoom, Meet, anything" />
          </label>
        )}
        {p.kind === 'session' && (
          <>
            <label className="block">
              <span className="block text-[14px] font-bold">Length in minutes</span>
              <input type="number" min={5} max={600} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className={field} />
              <span className="mt-xs block text-[12px] font-bold text-ink-soft">Slots come from your availability under Shop, Bookings.</span>
            </label>
            <div className="grid grid-cols-3 gap-xs">
              <label className="block">
                <span className="block text-[14px] font-bold">Buffer, minutes</span>
                <input type="number" min={0} max={120} step={5} value={bufferMin} onChange={(e) => setBufferMin(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="block text-[14px] font-bold">Notice, hours</span>
                <input type="number" min={0} max={720} value={noticeHours} onChange={(e) => setNoticeHours(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="block text-[14px] font-bold">Book up to, days</span>
                <input type="number" min={1} max={365} value={maxDaysAhead} onChange={(e) => setMaxDaysAhead(e.target.value)} className={field} />
              </label>
            </div>
            <span className="block text-[12px] font-bold text-ink-soft">Buffer keeps minutes free before and after each session. Notice is how soon someone can book. The last is how far ahead the calendar opens.</span>
          </>
        )}
        {p.kind === 'membership' && (
          <label className="block">
            <span className="block text-[14px] font-bold">Lasts this many months, blank for forever</span>
            <input type="number" min={1} max={36} value={periodMonths} onChange={(e) => setPeriodMonths(e.target.value)} className={field} placeholder="Forever" />
            <span className="mt-xs block text-[12px] font-bold text-ink-soft">When it runs out the member sees a Renew button and buys again.</span>
          </label>
        )}
        {(p.kind === 'session' || p.kind === 'dm') && (
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-[14px] font-bold">{p.kind === 'session' ? 'Questions to answer when booking' : 'Questions to answer at checkout'}</legend>
            <div className="mt-xs flex flex-col gap-xs">
              {intake.map((qn, i) => (
                <div key={i} className="flex items-center gap-xs">
                  <input value={qn} onChange={(e) => setIntakeAt(i, e.target.value)} maxLength={200} aria-label={`Question ${i + 1}`} className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                  <Button variant="ghost" onClick={() => setIntake((list) => list.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            {intake.length < 8 && (
              <Button variant="outline" className="mt-xs" onClick={() => setIntake((list) => [...list, ''])}>
                Add a question
              </Button>
            )}
          </fieldset>
        )}
        {p.kind === 'course' && (
          <label className="flex min-h-[44px] items-center gap-sm text-[14px] font-bold">
            <input type="checkbox" checked={certificate} onChange={(e) => setCertificate(e.target.checked)} className="size-[20px] accent-ink" />
            <span>
              Issue a certificate on completion
              <span className="block text-[12px] font-semibold text-ink-soft">Every lesson done and every gated quiz passed. Anyone can check the code at /c/code.</span>
            </span>
          </label>
        )}
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {save.error instanceof Error ? save.error.message : 'Could not save.'}
          </p>
        )}
        <Button type="submit" full disabled={save.isPending}>
          Save
        </Button>
      </form>

      {p.kind === 'course' && (
        <section className="mt-lg" aria-labelledby="lessons-heading">
          <div className="flex items-center justify-between gap-sm">
            <h2 id="lessons-heading" className="text-[24px]">
              Lessons
            </h2>
            <div className="flex flex-wrap justify-end gap-xs">
              <Button variant="outline" onClick={() => setDrafting(true)}>
                Draft from notes
              </Button>
              <Button onClick={() => setLesson('new')}>Add lesson</Button>
            </div>
          </div>
          <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.lessons.map((l, i) => (
              <li key={l.id}>
                <button type="button" onClick={() => setLesson(l)} className="toy toy-soft flex w-full items-center gap-sm rounded-tile bg-card p-sm text-left">
                  <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-r3 font-display text-[14px] font-extrabold text-ink-fixed" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">{l.title}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">
                      {l.dripDays > 0 ? `Unlocks ${l.dripDays} days after enrolling` : 'Available at once'}
                      {l.quiz.length > 0 ? `, quiz of ${l.quiz.length}${l.passScore > 0 ? `, pass at ${l.passScore}%` : ''}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {p.kind === 'membership' && (
        <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft">
          <h2 className="text-[24px]">Members feed</h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Members and you can post in a feed only they can see.</p>
          <Link to={`/community?product=${p.id}`} className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
            Open members feed
          </Link>
        </section>
      )}

      {priced && (
        <section className="mt-lg" aria-labelledby="coupon-heading">
          <h2 id="coupon-heading" className="text-[24px]">
            Coupons
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {mine.map((c) => (
              <li key={c.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="flex-1 text-[16px] font-bold">
                  {c.code}, {c.percentOff}% off{c.productId ? '' : ', all products'}, used {c.uses}
                  {c.maxUses ? ` of ${c.maxUses}` : ''}
                </span>
                <Button variant="ghost" onClick={() => delCoupon.mutate(c.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="mt-sm flex items-end gap-xs"
            onSubmit={(e) => {
              e.preventDefault();
              if (couponCode.trim()) addCoupon.mutate();
            }}
          >
            <label className="block min-w-0 flex-1">
              <span className="block text-[12px] font-bold">Code</span>
              <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} maxLength={24} className={field} placeholder="LAUNCH20" />
            </label>
            <label className="block w-[96px]">
              <span className="block text-[12px] font-bold">% off</span>
              <input type="number" min={1} max={100} value={couponOff} onChange={(e) => setCouponOff(e.target.value)} className={field} />
            </label>
            <Button type="submit" disabled={addCoupon.isPending}>
              Add
            </Button>
          </form>
          {addCoupon.isError && <p className="mt-xs m-0 text-[14px] font-bold">{addCoupon.error instanceof Error ? addCoupon.error.message : 'Could not add.'}</p>}
        </section>
      )}

      {(d.orders.length > 0 || d.bookings.length > 0) && (
        <section className="mt-lg" aria-labelledby="buyers-heading">
          <h2 id="buyers-heading" className="text-[24px]">
            {p.kind === 'event' ? 'Attendees' : p.kind === 'session' ? 'Sessions booked' : 'Buyers'}
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.orders.map((o) => (
              <li key={o.id} className="rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">
                <span className="font-bold">{o.buyerName}</span>, {o.points > 0 ? `${o.points} points` : `${(o.cents / 100).toFixed(2)} ${o.currency}, ${o.status}`}
                {o.variant === 'replay' ? ', replay' : ''}
                {o.sourceLabel ? `, via ${o.sourceLabel}` : ''}, {new Date(o.createdAt).toLocaleDateString()}
                {o.intake.length > 0 && (
                  <ul className="mt-xs list-none p-0 m-0 text-ink-soft">
                    {o.intake.map((a, i) => (
                      <li key={i}>
                        {p.intake[i] ? `${p.intake[i]}: ` : ''}
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {d.bookings.map((b) => (
              <li key={b.id} className="rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">
                <span className="font-bold">{b.buyerName}</span>, {new Date(b.startsAt).toLocaleString()} UTC, {b.status}
                {b.intake.length > 0 && (
                  <ul className="mt-xs list-none p-0 m-0 text-ink-soft">
                    {b.intake.map((a, i) => (
                      <li key={i}>
                        {p.intake[i] ? `${p.intake[i]}: ` : ''}
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button variant="ghost" className="mt-lg" disabled={remove.isPending} onClick={() => window.confirm(`Delete "${p.title}"? Buyers lose access.`) && remove.mutate()}>
        Delete product
      </Button>

      <LessonSheet productId={id} lesson={lesson} onClose={() => setLesson(null)} onSaved={() => q.refetch()} />
      {p.kind === 'course' && <DraftSheet productId={id} title={p.title} open={drafting} onClose={() => setDrafting(false)} onSaved={() => q.refetch()} />}
    </Screen>
  );
}

/** Turn pasted notes, a transcript or an outline into draft lessons. Nothing is published; lessons land on the course to edit. */
function DraftSheet({ productId, title, open, onClose, onSaved }: { productId: string; title: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [source, setSource] = useState('');
  const preview = useMutation({ mutationFn: () => api.draftCourse({ source, title }) });
  const draft: CourseDraft | undefined = preview.data?.draft;
  const save = useMutation({
    mutationFn: () => api.saveDraft(productId, draft?.lessons ?? []),
    onSuccess: () => {
      preview.reset();
      setSource('');
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Draft lessons from your notes">
      <div className="flex flex-col gap-md">
        <label className="block">
          <span className="block text-[14px] font-bold">Your notes, a transcript, or an outline</span>
          <textarea value={source} onChange={(e) => setSource(e.target.value)} rows={8} maxLength={20000} className={field} placeholder={'# Lesson one\nWhat it covers, in a few lines.\nWhich cut keeps the energy up?\n- Cut on action *\n- Cut at random'} />
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">With AI on the server, lessons and quizzes are written from the notes. Without it, an outline is parsed: a line starting with # is a lesson, a line ending with ? is a question, lines starting with - are its options, and * marks the right one.</span>
        </label>
        <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending || source.trim().length < 20}>
          {preview.isPending ? 'Drafting' : 'Preview draft'}
        </Button>
        {preview.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {preview.error instanceof Error ? preview.error.message : 'Could not draft that.'}
          </p>
        )}
        {draft && (
          <>
            <p className="m-0 text-[14px] font-bold">
              {draft.lessons.length} {draft.lessons.length === 1 ? 'lesson' : 'lessons'}, {draft.source === 'ai' ? 'written by AI from your notes' : 'parsed from your outline'}
              {preview.data && !preview.data.aiAvailable && draft.source === 'outline' ? '. No AI on this server, so headings and questions came straight from the text.' : '.'}
            </p>
            <ol className="m-0 flex list-none flex-col gap-xs p-0">
              {draft.lessons.map((l, i) => (
                <li key={i} className="rounded-tile bg-paper p-sm">
                  <p className="m-0 text-[16px] font-bold">
                    {i + 1}. {l.title}
                  </p>
                  <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
                    {l.body ? `${l.body.slice(0, 140)}${l.body.length > 140 ? '…' : ''}` : 'No text yet.'}
                    {l.quiz.length > 0 ? ` Quiz of ${l.quiz.length}.` : ''}
                  </p>
                </li>
              ))}
            </ol>
            {save.isError && (
              <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
                {save.error instanceof Error ? save.error.message : 'Could not add them.'}
              </p>
            )}
            <Button size="lg" full onClick={() => save.mutate()} disabled={save.isPending || draft.lessons.length === 0}>
              Add to course
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

const blankQuestion = (): QuizQuestion => ({ q: '', options: ['', ''], answer: 0 });

function LessonSheet({ productId, lesson, onClose, onSaved }: { productId: string; lesson: Lesson | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const existing = lesson && lesson !== 'new' ? lesson : null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [drip, setDrip] = useState('0');
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [passScore, setPassScore] = useState('0');
  useEffect(() => {
    setTitle(existing?.title ?? '');
    setBody(existing?.body ?? '');
    setVideoUrl(existing?.videoUrl ?? '');
    setDrip(String(existing?.dripDays ?? 0));
    setQuiz(existing?.quiz ?? []);
    setPassScore(String(existing?.passScore ?? 0));
  }, [lesson]); // eslint-disable-line react-hooks/exhaustive-deps
  const cleanQuiz = quiz.map((qn) => ({ ...qn, q: qn.q.trim(), options: qn.options.map((o) => o.trim()) })).filter((qn) => qn.q && qn.options.filter(Boolean).length >= 2);
  const payload = { title, body, videoUrl: videoUrl || null, dripDays: Number(drip) || 0, quiz: cleanQuiz, passScore: Number(passScore) || 0 };
  const save = useMutation({
    mutationFn: () => (existing ? api.updateLesson(existing.id, payload) : api.createLesson(productId, payload)),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteLesson(existing!.id),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const setQ = (i: number, patch: Partial<QuizQuestion>) => setQuiz((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setOpt = (i: number, k: number, v: string) => setQ(i, { options: (quiz[i]?.options ?? []).map((o, m) => (m === k ? v : o)) });
  return (
    <Sheet open={lesson !== null} onClose={onClose} title={existing ? 'Edit lesson' : 'New lesson'}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Lesson text</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Video link</span>
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={field} placeholder="Optional" />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Drip: unlock this many days after enrolling</span>
          <input type="number" min={0} max={365} value={drip} onChange={(e) => setDrip(e.target.value)} className={field} />
        </label>

        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Quiz</legend>
          <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Multiple choice. Mark the right option. Passing marks the lesson done.</p>
          <ol className="mt-xs flex list-none flex-col gap-sm p-0 m-0">
            {quiz.map((qn, i) => (
              <li key={i} className="rounded-tile bg-paper p-sm">
                <label className="block">
                  <span className="block text-[12px] font-bold">Question {i + 1}</span>
                  <input value={qn.q} onChange={(e) => setQ(i, { q: e.target.value })} maxLength={300} className={field} />
                </label>
                <div className="mt-xs flex flex-col gap-xs" role="radiogroup" aria-label={`Right answer for question ${i + 1}`}>
                  {qn.options.map((o, k) => (
                    <div key={k} className="flex items-center gap-xs">
                      <input type="radio" name={`q-${i}`} checked={qn.answer === k} onChange={() => setQ(i, { answer: k })} aria-label={`Option ${k + 1} is right`} className="size-[20px] accent-ink" />
                      <input value={o} onChange={(e) => setOpt(i, k, e.target.value)} maxLength={200} placeholder={`Option ${k + 1}`} aria-label={`Option ${k + 1}`} className="min-w-0 flex-1 rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px]" />
                      {qn.options.length > 2 && (
                        <Button variant="ghost" aria-label={`Remove option ${k + 1}`} onClick={() => setQ(i, { options: qn.options.filter((_, m) => m !== k), answer: qn.answer >= k && qn.answer > 0 ? qn.answer - 1 : qn.answer })}>
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-xs flex flex-wrap gap-xs">
                  {qn.options.length < 6 && (
                    <Button variant="outline" onClick={() => setQ(i, { options: [...qn.options, ''] })}>
                      Add option
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setQuiz((list) => list.filter((_, j) => j !== i))}>
                    Remove question
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          {quiz.length < 20 && (
            <Button variant="outline" className="mt-xs" onClick={() => setQuiz((list) => [...list, blankQuestion()])}>
              Add a question
            </Button>
          )}
          {quiz.length > 0 && (
            <label className="mt-sm block">
              <span className="block text-[14px] font-bold">Percent needed to pass, zero for no gate</span>
              <input type="number" min={0} max={100} value={passScore} onChange={(e) => setPassScore(e.target.value)} className={field} />
            </label>
          )}
        </fieldset>

        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {save.error instanceof Error ? save.error.message : 'Could not save.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim()}>
          {existing ? 'Save lesson' : 'Add lesson'}
        </Button>
        {existing && (
          <Button variant="ghost" disabled={remove.isPending} onClick={() => window.confirm('Delete this lesson?') && remove.mutate()}>
            Delete lesson
          </Button>
        )}
      </form>
    </Sheet>
  );
}
