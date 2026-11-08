import { PRODUCT_KIND_META, productHasOwnCover, type Booking, type Lesson, type Order } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { BackLink } from '../components/PageHeader';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { api, errorText } from '../lib/api';
import { todayLocal, clockTime, longDate, dateTime } from '../lib/date';
import { useAuthed, useLibrary, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { Icon } from '../components/Icon';
import { Play, Star } from 'lucide-react';
import { FIELD, FIELD_LINE } from '../lib/ui';
import { StatusTag } from '../components/StatusTag';

const clock = clockTime;
const day = longDate;

/** The newest purchase of a product; for memberships it carries the expiry. */
function latestOrder(orders: Order[] | undefined, productId: string): Order | null {
  return (orders ?? []).filter((o) => o.productId === productId && o.variant === '').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
}
const expired = (o: Order | null) => Boolean(o?.expiresAt && new Date(o.expiresAt).getTime() < Date.now());

export function Library() {
  const { id } = useParams();
  if (id) return <Owned id={id} />;
  return <Mine />;
}

function Mine() {
  const pg = usePage();
  const bk = usePage('bk');
  const q = useLibrary(`${pg.query}&${bk.query}`);
  const certs = useAuthed(['certificates'], api.certificates);
  const dms = useAuthed(['my-dm'], api.myDmRequests);
  const refresh = useRefreshAll();
  const [askingCancel, setAskingCancel] = useState<Booking | null>(null);
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelBooking(id),
    onSuccess: () => {
      setAskingCancel(null);
      refresh();
    },
  });
  const [moving, setMoving] = useState<Booking | null>(null);
  const d = q.data;
  return (
    <Screen>
      <AppCover back={{ to: '/apps', label: 'Apps' }} title="My purchases" lede="Courses, downloads, memberships, tickets, sessions, bundles, posts and answers you own." />
      {d && d.products.length === 0 && (
        <p className="mt-md m-0 text-subhead text-ink-soft">
          Nothing yet. Find creators under{' '}
          <Link to="/search" className="underline underline-offset-4">
            Search
          </Link>{' '}
          or browse{' '}
          <Link to="/sessions" className="underline underline-offset-4">
            sessions and events
          </Link>
          .
        </p>
      )}
      <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
        {d?.products.map((p) => (
          <li key={p.id}>
            <Link to={`/library/${p.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
              <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
                {productHasOwnCover(p.kind, p.cover) ? p.cover : <AppIcon name={PRODUCT_KIND_META[p.kind].icon} size={22} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-balance text-card-title [overflow-wrap:anywhere]">{p.title}</span>
                <span className="block text-card-note text-ink-soft">
                  {PRODUCT_KIND_META[p.kind].name} by {p.ownerName}
                  {p.kind === 'membership' && (() => {
                    const o = latestOrder(d.orders, p.id);
                    return o?.expiresAt ? (expired(o) ? ', ended' : `, member until ${day(o.expiresAt)}`) : '';
                  })()}
                </span>
              </span>
              {p.kind === 'membership' && expired(latestOrder(d.orders, p.id)) && <StatusTag tone="warn">Renew</StatusTag>}
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={d?.page} label="purchases" />
      {d && (d.bookings.length > 0 || d.bookingsPage.page > 1) && (
        <section className="mt-lg" aria-labelledby="bk-heading">
          <h2 id="bk-heading" className="text-title2">
            My sessions
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.bookings.map((b) => (
              <li key={b.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-card-title">
                  {b.productTitle} with {b.ownerName}
                </p>
                <p className="m-0 text-card-note text-ink-soft">
                  {dateTime(b.startsAt)} in your zone, {b.status}
                </p>
                {b.meetingUrl && b.status === 'confirmed' && (
                  <a href={b.meetingUrl} target="_blank" rel="noreferrer" className="toy mt-sm inline-flex min-h-[44px] items-center rounded-pill bg-ink px-md text-subhead font-semibold text-on-ink">
                    Join
                  </a>
                )}
                {(b.status === 'requested' || b.status === 'confirmed') && (
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {new Date(b.startsAt).getTime() > Date.now() && (
                      <Button variant="outline" onClick={() => setMoving(b)}>
                        Reschedule
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setAskingCancel(b)} disabled={cancel.isPending}>
                      Cancel
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pager page={d.bookingsPage} prefix="bk" label="sessions" />
          <RescheduleSheet booking={moving} onClose={() => setMoving(null)} onDone={() => refresh()} />
          <ConfirmDelete
            open={askingCancel !== null}
            title="Cancel this booking?"
            body={askingCancel ? `${askingCancel.productTitle} with ${askingCancel.ownerName}, ${dateTime(askingCancel.startsAt)}, is called off. To meet, you would book again.` : ''}
            yes="Yes, cancel it"
            keep="Keep it"
            pending={cancel.isPending}
            failed={cancel.isError}
            onYes={() => askingCancel && cancel.mutate(askingCancel.id)}
            onClose={() => setAskingCancel(null)}
          />
        </section>
      )}
      {dms.data && dms.data.requests.length > 0 && (
        <section className="mt-lg" aria-labelledby="dm-heading">
          <h2 id="dm-heading" className="text-title2">
            My questions
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {dms.data.requests.map((r) => (
              <li key={r.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-subhead text-ink-soft">
                  To {r.ownerName}, {r.productTitle}. {r.status === 'open' ? `Answer promised by ${longDate(r.dueAt)}` : r.status === 'answered' ? `Answered ${longDate(r.answeredAt ?? r.createdAt)}` : 'Refunded'}.
                </p>
                <p className="mt-xs m-0 whitespace-pre-wrap text-prose">{r.question}</p>
                {r.answer && <p className="mt-sm m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-prose">{r.answer}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {certs.data && certs.data.certificates.length > 0 && (
        <section className="mt-lg" aria-labelledby="cert-heading">
          <h2 id="cert-heading" className="text-title2">
            Certificates
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {certs.data.certificates.map((c) => (
              <li key={c.code} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-card-title">{c.productTitle}</p>
                <p className="m-0 text-card-note text-ink-soft">
                  By {c.ownerName}, issued {longDate(c.issuedAt)}. Code {c.code}.
                </p>
                <Link to={`/c/${c.code}`} className="mt-xs inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4">
                  Open the certificate page
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}

/** Move a session to another open slot. The old slot frees up only once the new one is taken. */
function RescheduleSheet({ booking, onClose, onDone }: { booking: Booking | null; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(todayLocal());
  const slots = useAuthed(['slots', booking?.productId ?? '', date], () => api.slots(booking?.productId ?? '', date), booking !== null);
  const move = useMutation({
    mutationFn: (startsAt: string) => api.reschedule(booking!.id, startsAt),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={booking !== null} onClose={onClose} title="Pick a new time">
      {booking && (
        <div className="flex flex-col gap-md">
          <p className="m-0 text-subhead text-ink-soft">
            {booking.productTitle} with {booking.ownerName}, now {dateTime(booking.startsAt)}. Moving it asks {booking.ownerName} to confirm again. Not possible within two hours of the start.
          </p>
          <label className="block">
            <span className="block text-subhead font-semibold">Day</span>
            <input type="date" value={date} min={todayLocal()} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </label>
          {slots.data && <p className="m-0 text-caption text-ink-soft">Times shown in your zone; the host is in {slots.data.zone}.</p>}
          {slots.data && slots.data.slots.length === 0 && <p className="m-0 text-subhead text-ink-soft">No free slots that day. Try another.</p>}
          <div className="grid grid-cols-3 gap-xs">
            {slots.data?.slots.map((s) => (
              <Button key={s} variant="outline" onClick={() => move.mutate(s)} disabled={move.isPending}>
                {clock(s)}
              </Button>
            ))}
          </div>
          {move.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {errorText(move.error, 'Could not move it.')}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Owned({ id }: { id: string }) {
  const q = useAuthed(['owned', id], () => api.owned(id));
  const lib = useLibrary();
  const myOrder = latestOrder(lib.data?.orders, id);
  const lapsed = expired(myOrder);
  const dms = useAuthed(['my-dm'], api.myDmRequests, q.data?.product.kind === 'dm');
  const refresh = useRefreshAll();
  const done = useMutation({ mutationFn: (lid: string) => api.completeLesson(lid), onSuccess: () => q.refetch() });
  const [date, setDate] = useState(todayLocal());
  const [intake, setIntake] = useState<string[]>([]);
  const slots = useAuthed(['slots', id, date], () => api.slots(id, date), q.data?.product.kind === 'session');
  const book = useMutation({ mutationFn: (startsAt: string) => api.book(id, { startsAt, intake }), onSuccess: () => refresh() });
  const claim = useMutation({ mutationFn: () => api.claimCertificate(id), onSuccess: () => q.refetch() });
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const review = useMutation({ mutationFn: () => api.review(id, { rating, body: reviewText }) });
  const p = q.data?.product;
  const lessons = q.data?.lessons ?? [];
  const finished = lessons.filter((l) => l.completedAt).length;
  const intakeReady = !p || p.intake.length === 0 || intake.filter((a) => a.trim()).length >= p.intake.length;
  const bundled = p?.kind === 'bundle' ? (lib.data?.products ?? []).filter((x) => p.bundleIds.includes(x.id)) : [];
  const allDone = lessons.length > 0 && lessons.every((l) => l.completedAt && (l.passScore === 0 || l.quiz.length === 0 || l.quizPassed));

  return (
    <Screen>
      {p ? (
        <AppCover back={{ to: '/library', label: 'My purchases' }} title={p.title} lede={`${PRODUCT_KIND_META[p.kind].name} by ${p.ownerName}`} />
      ) : (
        <header className="pt-lg">
          <BackLink to="/library">My purchases</BackLink>
        </header>
      )}
      {q.isError && lapsed && myOrder && (
        <div className="mt-md flex flex-wrap-reverse items-center justify-between gap-sm rounded-card bg-card p-md shadow-toy-soft">
          <div className="min-w-0 flex-1 basis-[60%]">
            <p className="m-0 text-card-title">Your membership ended on {day(myOrder.expiresAt ?? myOrder.createdAt)}.</p>
            <p className="mt-xs m-0 text-card-note text-ink-soft">Renew to open the members feed again. Nothing you posted is lost.</p>
          </div>
          <Link to={`/p/${id}`} className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
            Renew
          </Link>
        </div>
      )}
      {q.isError && !(lapsed && myOrder) && <p className="mt-md font-semibold">{errorText(q.error, 'Not available.')}</p>}
      {p && (
        <>
          {p.kind === 'digital' && p.url && (
            <a href={p.url} target="_blank" rel="noreferrer" className="toy mt-md flex min-h-[56px] items-center justify-center rounded-pill bg-ink px-md text-headline text-on-ink">
              Open your download
            </a>
          )}
          {p.kind === 'digital' && !p.url && (
            <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
              <p className="m-0 text-card-title">{p.ownerName} has not added the file yet.</p>
              <p className="mt-xs m-0 text-card-note text-ink-soft">You will see it here when they do. Questions about it go through Help.</p>
              <Link to="/help" className="mt-xs inline-flex min-h-[44px] items-center text-subhead font-semibold underline underline-offset-4">
                Open Help
              </Link>
            </div>
          )}
          {p.kind === 'payment' && (
            <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
              <p className="m-0 text-card-title">Thank you. {p.ownerName} has your payment.</p>
              {p.description && <p className="mt-xs m-0 whitespace-pre-wrap text-card-prose text-ink-soft">{p.description}</p>}
            </div>
          )}
          {p.kind === 'locked' && (
            <article className="mt-md rounded-card bg-card p-md shadow-toy-soft">
              <p className="m-0 whitespace-pre-wrap text-prose">{p.lockedBody || 'The creator has not written this post yet.'}</p>
            </article>
          )}
          {p.kind === 'bundle' && (
            <section className="mt-md" aria-labelledby="bundle-heading">
              <h2 id="bundle-heading" className="text-title2">
                What is inside
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {bundled.map((x) => (
                  <li key={x.id}>
                    <Link to={`/library/${x.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
                      <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
                        {productHasOwnCover(x.kind, x.cover) ? x.cover : <AppIcon name={PRODUCT_KIND_META[x.kind].icon} size={22} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-balance text-card-title [overflow-wrap:anywhere]">{x.title}</span>
                        <span className="block text-card-note text-ink-soft">{PRODUCT_KIND_META[x.kind].name}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {bundled.length < p.bundleIds.length && <p className="mt-xs m-0 text-subhead text-ink-soft">The rest appears here once it loads.</p>}
            </section>
          )}
          {p.kind === 'dm' && (
            <section className="mt-md" aria-labelledby="ask-heading">
              <h2 id="ask-heading" className="text-title2">
                Your questions
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {dms.data?.requests
                  .filter((r) => r.productId === p.id)
                  .map((r) => (
                    <li key={r.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                      <p className="m-0 text-subhead text-ink-soft">{r.status === 'open' ? `Answer promised by ${longDate(r.dueAt)}` : r.status === 'answered' ? `Answered ${longDate(r.answeredAt ?? r.createdAt)}` : 'Refunded'}</p>
                      <p className="mt-xs m-0 whitespace-pre-wrap text-prose">{r.question}</p>
                      {r.answer && <p className="mt-sm m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-prose">{r.answer}</p>}
                    </li>
                  ))}
              </ul>
            </section>
          )}
          {p.kind === 'event' && (
            <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
              <p className="m-0 text-card-title">{p.startsAt ? dateTime(p.startsAt) : 'Date to be announced'}</p>
              {p.meetingUrl ? (
                <a href={p.meetingUrl} target="_blank" rel="noreferrer" className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
                  Join the event
                </a>
              ) : (
                <p className="mt-xs m-0 text-card-note text-ink-soft">The joining link appears here once the host adds it.</p>
              )}
              {p.replayUrl && (
                <a href={p.replayUrl} target="_blank" rel="noreferrer" className="toy toy-ink mt-sm ml-xs inline-flex min-h-[48px] items-center rounded-pill border-2 border-ink bg-card px-md font-semibold">
                  Watch the recording
                </a>
              )}
            </div>
          )}
          {p.kind === 'membership' && (
            <>
              {lapsed ? (
                <div className="mt-md flex flex-wrap-reverse items-center justify-between gap-sm rounded-card bg-card p-md shadow-toy-soft">
                  <p className="m-0 min-w-0 flex-1 basis-[60%] text-headline">Your membership ended on {day(myOrder?.expiresAt ?? '')}.</p>
                  <Link to={`/p/${p.id}`} className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
                    Renew
                  </Link>
                </div>
              ) : (
                <Link to={`/community?product=${p.id}`} className="toy mt-md flex min-h-[56px] items-center justify-center rounded-pill bg-ink px-md text-headline text-on-ink">
                  Open the members feed
                </Link>
              )}
              {myOrder?.expiresAt && !lapsed && <p className="mt-xs m-0 text-center text-subhead text-ink-soft">Member until {day(myOrder.expiresAt)}.</p>}
            </>
          )}
          {p.kind === 'course' && (
            <section className="mt-md" aria-labelledby="lessons-heading">
              <h2 id="lessons-heading" className="text-title2">
                Lessons, {finished} of {lessons.length} done
              </h2>
              <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {lessons.map((l) => (
                  <li key={l.id} data-pillar="lover_partner">
                    <CheckRow
                      checked={Boolean(l.completedAt)}
                      onToggle={() => !l.completedAt && done.mutate(l.id)}
                      title={l.title}
                      subtitle={l.unlocked ? (l.body ? l.body.slice(0, 160) : undefined) : `Unlocks ${longDate(l.unlocksOn ?? '')}`}
                      lockedMessage={l.unlocked ? null : `This lesson unlocks on ${longDate(l.unlocksOn ?? '')}.`}
                      strike
                      color="var(--color-r4)"
                      deep="var(--deep-lover_partner)"
                      text="var(--color-ink-fixed)"
                      aside={
                        l.unlocked && l.videoUrl ? (
                          <a href={l.videoUrl} target="_blank" rel="noreferrer" className="toy toy-soft flex w-[48px] shrink-0 items-center justify-center rounded-tile bg-card" aria-label={`Watch ${l.title}`}>
                            <Icon icon={Play} size={18} filled />
                          </a>
                        ) : undefined
                      }
                    />
                    {l.unlocked && l.body && l.body.length > 160 && <p className="mt-xs m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-subhead">{l.body}</p>}
                    {l.unlocked && l.quiz.length > 0 && <Quiz lesson={l} onDone={() => q.refetch()} />}
                  </li>
                ))}
              </ol>
              {p.certificate && (
                <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
                  <h3 className="text-card-title">Certificate</h3>
                  {q.data?.certificateCode ? (
                    <p className="mt-xs m-0 text-card-note">
                      Yours. Code {q.data.certificateCode}.{' '}
                      <Link to={`/c/${q.data.certificateCode}`} className="font-semibold underline underline-offset-4">
                        Open the certificate page
                      </Link>
                    </p>
                  ) : (
                    <>
                      <p className="mt-xs m-0 text-card-note text-ink-soft">{allDone ? 'Every lesson is done. Claim it.' : 'Finish every lesson and pass every gated quiz, then claim it here.'}</p>
                      {claim.isError && (
                        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
                          {errorText(claim.error, 'Not yet.')}
                        </p>
                      )}
                      <Button className="mt-sm" onClick={() => claim.mutate()} disabled={claim.isPending}>
                        Claim certificate
                      </Button>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
          {p.kind === 'session' && (
            <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="book-heading">
              <h2 id="book-heading" className="text-title2">
                Book a time
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">
                {p.durationMin} minutes. {p.ownerName} confirms it and adds the meeting link.
                {slots.data ? ` Times shown in your zone; the host is in ${slots.data.zone}.` : ''}
              </p>
              {p.intake.map((qn, i) => (
                <label key={i} className="mt-sm block">
                  <span className="block text-subhead font-semibold">{qn}</span>
                  <input value={intake[i] ?? ''} onChange={(e) => setIntake((list) => p.intake.map((_, j) => (j === i ? e.target.value : (list[j] ?? ''))))} maxLength={500} className={FIELD} />
                </label>
              ))}
              <label className="mt-sm block">
                <span className="block text-subhead font-semibold">Day</span>
                <input type="date" value={date} min={todayLocal()} onChange={(e) => setDate(e.target.value)} className={FIELD} />
              </label>
              {slots.data && slots.data.slots.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No free slots that day. Try another.</p>}
              {!intakeReady && <p className="mt-sm m-0 text-subhead text-ink-soft">Answer the questions above, then pick a time.</p>}
              <div className="mt-sm grid grid-cols-3 gap-xs">
                {slots.data?.slots.map((s) => (
                  <Button key={s} variant="outline" onClick={() => book.mutate(s)} disabled={book.isPending || !intakeReady}>
                    {clock(s)}
                  </Button>
                ))}
              </div>
              {book.isSuccess && <p className="mt-sm m-0 text-subhead">Requested. You will hear back in your inbox.</p>}
              {book.isError && (
                <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
                  {errorText(book.error, 'Could not book.')}
                </p>
              )}
            </section>
          )}

          <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="review-heading">
            <h2 id="review-heading" className="text-title2">
              Leave a review
            </h2>
            {review.isSuccess ? (
              <p className="mt-xs m-0 text-subhead font-semibold">Thanks. {p.ownerName} will see it.</p>
            ) : (
              <form
                className="mt-sm flex flex-col gap-md"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reviewText.trim()) review.mutate();
                }}
              >
                <div className="flex gap-xs" role="group" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-pressed={rating === n} onClick={() => setRating(n)} className={`flex size-[44px] items-center justify-center rounded-pill ${n <= rating ? 'bg-r3 text-ink-fixed' : 'bg-paper'}`} aria-label={`${n} stars`}>
                      <Icon icon={Star} size={20} filled={n <= rating} />
                    </button>
                  ))}
                </div>
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={3} maxLength={600} aria-label="Your review" placeholder="A few honest words" className={FIELD_LINE} />
                {review.isError && <p className="m-0 text-subhead">{errorText(review.error, 'Could not send.')}</p>}
                <Button type="submit" full disabled={review.isPending || !reviewText.trim()}>
                  Send review
                </Button>
              </form>
            )}
          </section>
        </>
      )}
    </Screen>
  );
}

function Quiz({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const submit = useMutation({ mutationFn: () => api.quiz(lesson.id, answers), onSuccess: onDone });
  const result = submit.data;
  const filled = lesson.quiz.every((_, i) => (answers[i] ?? -1) >= 0);
  return (
    <div className="mt-xs rounded-tile bg-paper p-sm">
      {/* The quiz line on the left and its button at the bottom right of the same block (the founder, 2026-11-06, like "Schedule a
          review" beside Coming up); on a narrow phone the button wraps under the words, still at the right. */}
      <div className="flex flex-wrap items-end justify-between gap-sm">
        <p className="m-0 min-w-0 flex-[1_1_220px] text-subhead font-semibold">
          Quiz, {lesson.quiz.length} {lesson.quiz.length === 1 ? 'question' : 'questions'}
          {lesson.passScore > 0 ? `, pass at ${lesson.passScore}%` : ''}.
          {typeof lesson.quizScore === 'number' ? ` Your best: ${lesson.quizScore}%${lesson.quizPassed ? ', passed' : ''}.` : ''}
        </p>
        {!open && (
          <div className="ml-auto">
            <Button variant="outline" onClick={() => setOpen(true)}>
              {typeof lesson.quizScore === 'number' ? 'Try again' : 'Take the quiz'}
            </Button>
          </div>
        )}
      </div>
      {!open ? null : (
        <form
          className="mt-sm flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (filled) submit.mutate();
          }}
        >
          {lesson.quiz.map((qn, i) => (
            <fieldset key={i} className="m-0 border-0 p-0">
              <legend className="text-subhead font-semibold">
                {i + 1}. {qn.q}
              </legend>
              <div className="mt-xs flex flex-col gap-xs">
                {qn.options.map((o, k) => {
                  const chosen = answers[i] === k;
                  const correct = result ? result.correct[i] === k : null;
                  return (
                    <label key={k} className={`flex min-h-[44px] items-center gap-sm rounded-tile border-2 px-sm py-xs text-subhead font-semibold ${correct === true ? 'border-r4' : correct === false && chosen ? 'border-r1' : chosen ? 'border-ink' : 'border-line'} bg-card`}>
                      <input type="radio" name={`quiz-${lesson.id}-${i}`} checked={chosen} disabled={Boolean(result)} onChange={() => setAnswers((a) => lesson.quiz.map((_, j) => (j === i ? k : (a[j] ?? -1))))} className="size-[20px] accent-ink" />
                      {o}
                      {correct === true && <span className="ml-auto text-caption font-semibold">right</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {submit.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {errorText(submit.error, 'Could not check that.')}
            </p>
          )}
          {result ? (
            <p className="m-0 text-headline">
              {result.right} of {result.total} right, {result.score}%. {result.passed ? 'Passed.' : 'Not passed yet.'}
            </p>
          ) : (
            <Button type="submit" full disabled={submit.isPending || !filled}>
              Check my answers
            </Button>
          )}
          {result && (
            <Button
              variant="outline"
              onClick={() => {
                submit.reset();
                setAnswers([]);
              }}
            >
              Try again
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
