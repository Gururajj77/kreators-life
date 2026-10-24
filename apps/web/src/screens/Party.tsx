import { EVENT_TYPE_META, EVENT_TYPES, type EventRegistration, type EventType, type PartyEvent } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Back({ to, label }: { to: string; label: string }) {
  return (
    <BackLink to={to}>{label}</BackLink>
  );
}

function Err({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {e instanceof Error ? e.message : 'That did not work.'}
    </p>
  );
}

function seats(e: PartyEvent): string {
  if (e.capacity === null) return 'Open to all';
  const left = e.capacity - e.registered;
  if (left > 0) return `${left} seat${left === 1 ? '' : 's'} left`;
  return e.waitlisted > 0 ? `Full, ${e.waitlisted} waiting` : 'Full, waitlist open';
}

function MineBadge({ mine }: { mine: EventRegistration | null }) {
  if (!mine || mine.status === 'cancelled') return null;
  const label = mine.status === 'waitlisted' ? 'Waitlisted' : mine.status === 'attended' ? 'Attended' : "You're in";
  return (
    <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: mine.status === 'waitlisted' ? 'var(--tint-yellow)' : 'var(--tint-green)' }}>
      {label}
    </span>
  );
}

function EventCard({ e }: { e: PartyEvent }) {
  const meta = EVENT_TYPE_META[e.eventType];
  return (
    <li>
      <Link to={`/party/${e.id}`} className="toy toy-soft flex items-start gap-sm rounded-tile bg-card p-sm">
        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
          {meta.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-xs">
            <span className="text-[16px] font-bold">{e.title}</span>
            <MineBadge mine={e.mine} />
          </span>
          <span className="block text-[14px] font-semibold text-ink-soft">
            {meta.name}, {when(e.startsAt)}
          </span>
          <span className="block text-[14px] font-semibold text-ink-soft">
            {e.onlineUrl ? 'Online' : e.venue || 'Venue to be announced'}, {seats(e)}
          </span>
        </span>
        <span className="shrink-0 text-[14px] font-extrabold">{e.pricePoints > 0 ? `${e.pricePoints} pts` : 'Free'}</span>
      </Link>
    </li>
  );
}

export function Party() {
  const q = useAuthed(['party'], api.party);
  const [hosting, setHosting] = useState(false);
  const d = q.data;
  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Party</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Meetups, workshops, camps and flagship days. RSVP, join a waitlist, check in at the door.</p>
        <Button className="mt-md" onClick={() => setHosting(true)}>
          Host a meetup
        </Button>
        {d && !d.club && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Some events are for Club members only. Club is in Apps.</p>}
      </header>

      {q.isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Finding what is on
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load events.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          <section className="mt-lg" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="text-[24px]">
              Coming up
            </h2>
            {d.events.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nothing on the calendar yet. Host the first meetup.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.events.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </ul>
          </section>

          {d.hosting.length > 0 && (
            <section className="mt-lg" aria-labelledby="hosting-heading">
              <h2 id="hosting-heading" className="text-[24px]">
                Hosting
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.hosting.map((e) => (
                  <li key={e.id}>
                    <Link to={`/party/${e.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-bold">{e.title}</span>
                        <span className="block text-[14px] font-semibold text-ink-soft">
                          {when(e.startsAt)}, {e.registered} registered, {e.waitlisted} waiting, {e.status}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <HostSheet open={hosting} onClose={() => setHosting(false)} canHostAll={d?.canHostAll ?? false} />
    </Screen>
  );
}

function HostSheet({ open, onClose, canHostAll }: { open: boolean; onClose: () => void; canHostAll: boolean }) {
  const nav = useNavigate();
  const refresh = useRefreshAll();
  const types = EVENT_TYPES.filter((t) => canHostAll || !EVENT_TYPE_META[t].staffOnly);
  const [eventType, setEventType] = useState<EventType>('meetup');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [minutes, setMinutes] = useState('120');
  const [venue, setVenue] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [capacity, setCapacity] = useState('');
  const [pricePoints, setPricePoints] = useState('0');
  const [visibility, setVisibility] = useState<PartyEvent['visibility']>('public');
  const create = useMutation({
    mutationFn: () =>
      api.createEvent({
        title,
        eventType,
        description,
        startsAt: new Date(startsAt).toISOString(),
        minutes: Number(minutes) || 120,
        venue,
        onlineUrl: onlineUrl || null,
        capacity: capacity ? Number(capacity) : null,
        pricePoints: Number(pricePoints) || 0,
        visibility,
      }),
    onSuccess: (r) => {
      refresh();
      onClose();
      if (r.event) nav(`/party/${r.event.id}`);
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Host an event">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && startsAt) create.mutate();
        }}
      >
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">What kind</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {types.map((t) => (
              <button key={t} type="button" aria-pressed={eventType === t} onClick={() => setEventType(t)} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${eventType === t ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                <span aria-hidden="true">{EVENT_TYPE_META[t].emoji} </span>
                {EVENT_TYPE_META[t].name}
              </button>
            ))}
          </div>
          {!canHostAll && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Parties, workshops, camps and Kreators Days are run by the team.</p>}
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What to expect</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} rows={3} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Starts</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Minutes</span>
            <input type="number" min={15} max={10080} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">Venue</span>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} placeholder="Leave empty for online" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Online link</span>
          <input type="url" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} maxLength={500} placeholder="https://" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Seats</span>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="No limit" className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Price in points</span>
            <input type="number" min={0} value={pricePoints} onChange={(e) => setPricePoints(e.target.value)} className={field} />
          </label>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Who can see it</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {(
              [
                ['public', 'Everyone'],
                ['club', 'Club members'],
                ['private', 'People with the link'],
              ] as [PartyEvent['visibility'], string][]
            ).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={visibility === v} onClick={() => setVisibility(v)} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${visibility === v ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Err e={create.isError ? create.error : null} />
        <Button type="submit" size="lg" full disabled={create.isPending || !title.trim() || !startsAt}>
          Publish event
        </Button>
      </form>
    </Sheet>
  );
}

export function EventPage() {
  const { id = '' } = useParams();
  const q = useAuthed(['event', id], () => api.event(id));
  const refresh = useRefreshAll();
  const [networking, setNetworking] = useState(false);
  const [rsvpResult, setRsvpResult] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [thanks, setThanks] = useState(false);
  const rsvp = useMutation({
    mutationFn: () => api.rsvp(id, networking),
    onSuccess: (r) => {
      setRsvpResult(r.status === 'registered' ? 'You are in. See you there.' : 'The room is full, so you are on the waitlist. We will tell you if a seat opens.');
      refresh();
      q.refetch();
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelRsvp(id),
    onSuccess: () => {
      setRsvpResult(null);
      refresh();
      q.refetch();
    },
  });
  const feedback = useMutation({
    mutationFn: () => api.eventFeedback(id, { rating, comment, networking }),
    onSuccess: () => {
      setThanks(true);
      q.refetch();
    },
  });
  const checkin = useMutation({ mutationFn: (userId: string) => api.checkinGuest(id, userId), onSuccess: () => q.refetch() });
  const setStatus = useMutation({
    mutationFn: (status: 'published' | 'cancelled' | 'done') => api.setEvent(id, status),
    onSuccess: () => {
      refresh();
      q.refetch();
    },
  });

  if (q.isError) {
    return (
      <Screen>
        <header className="pt-lg">
          <Back to="/party" label="Party" />
          <h1 className="text-[30px]">Not for you, or gone</h1>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{q.error instanceof Error ? q.error.message : 'This event is private, Club-only, or no longer exists.'}</p>
        </header>
      </Screen>
    );
  }
  const d = q.data;
  if (!d) return null;
  const e = d.event;
  const meta = EVENT_TYPE_META[e.eventType];
  const over = new Date(e.endsAt).getTime() < Date.now();
  const mine = e.mine && e.mine.status !== 'cancelled' ? e.mine : null;
  const canFeedback = over && mine && (mine.status === 'registered' || mine.status === 'attended');

  return (
    <Screen>
      <header className="pt-lg">
        <Back to="/party" label="Party" />
        <p className="m-0 text-[14px] font-bold text-ink-soft">
          <span aria-hidden="true">{meta.emoji} </span>
          {meta.name}, hosted by {e.hostName}
          {e.status !== 'published' ? `, ${e.status}` : ''}
        </p>
        <h1 className="text-[30px]">{e.title}</h1>
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <MineBadge mine={mine} />
          {e.visibility !== 'public' && (
            <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: 'var(--tint-purple)' }}>
              {e.visibility === 'club' ? 'Club only' : 'Private'}
            </span>
          )}
        </div>
      </header>

      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="Details">
        <p className="m-0 text-[16px] font-bold">{when(e.startsAt)}</p>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">
          Until {when(e.endsAt)} ({e.timezone})
        </p>
        <p className="mt-sm m-0 text-[16px] font-semibold">{e.onlineUrl ? 'Online' : e.venue || 'Venue to be announced'}</p>
        {mine && mine.status !== 'waitlisted' && e.onlineUrl && (
          <a href={e.onlineUrl} target="_blank" rel="noreferrer" className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
            Open the room
          </a>
        )}
        <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
          {seats(e)}. {e.pricePoints > 0 ? `${e.pricePoints} points a ticket.` : 'Free.'}
        </p>
        {e.description && <p className="mt-sm m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{e.description}</p>}
      </section>

      {e.status === 'published' && !over && (
        <section className="mt-lg" aria-labelledby="rsvp-heading">
          <h2 id="rsvp-heading" className="text-[24px]">
            {mine ? 'Your spot' : 'Coming?'}
          </h2>
          {rsvpResult && (
            <p role="status" className="mt-xs m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-green)' }}>
              {rsvpResult}
            </p>
          )}
          {!mine ? (
            <div className="mt-sm flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft">
              <label className="flex items-center gap-sm text-[14px] font-bold">
                <input type="checkbox" checked={networking} onChange={(ev) => setNetworking(ev.target.checked)} className="size-[20px] accent-ink" />
                Happy to be introduced to other guests
              </label>
              <Err e={rsvp.isError ? rsvp.error : null} />
              <Button size="lg" full onClick={() => rsvp.mutate()} disabled={rsvp.isPending}>
                {e.capacity !== null && e.registered >= e.capacity ? 'Join the waitlist' : e.pricePoints > 0 ? `RSVP for ${e.pricePoints} points` : 'RSVP'}
              </Button>
            </div>
          ) : (
            <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">{mine.status === 'waitlisted' ? 'You are on the waitlist.' : 'You are registered.'}</p>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{mine.networkingOptIn ? 'Open to introductions at this event.' : 'Not open to introductions at this event.'}</p>
              <Err e={cancel.isError ? cancel.error : null} />
              <Button variant="outline" className="mt-sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                Cancel my RSVP
              </Button>
            </div>
          )}
        </section>
      )}

      {canFeedback && (
        <section className="mt-lg" aria-labelledby="fb-heading">
          <h2 id="fb-heading" className="text-[24px]">
            How was it?
          </h2>
          {thanks ? (
            <p className="mt-xs m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-green)' }}>
              Thanks. The host will see this.
            </p>
          ) : (
            <form
              className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (rating > 0) feedback.mutate();
              }}
            >
              <div className="flex gap-xs" role="group" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={rating === n} aria-label={`${n} out of 5`} onClick={() => setRating(n)} className={`toy flex size-[44px] items-center justify-center rounded-pill border-2 text-[18px] font-extrabold ${rating >= n ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="block text-[14px] font-bold">A few words</span>
                <textarea value={comment} onChange={(ev) => setComment(ev.target.value)} maxLength={1000} rows={3} className={field} />
              </label>
              <label className="flex items-center gap-sm text-[14px] font-bold">
                <input type="checkbox" checked={networking} onChange={(ev) => setNetworking(ev.target.checked)} className="size-[20px] accent-ink" />
                Introduce me to people I met here
              </label>
              <Err e={feedback.isError ? feedback.error : null} />
              <Button type="submit" full disabled={feedback.isPending || rating === 0}>
                Send feedback
              </Button>
            </form>
          )}
        </section>
      )}

      {d.host && (
        <section className="mt-lg" aria-labelledby="host-heading">
          <h2 id="host-heading" className="text-[24px]">
            Hosting tools
          </h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            {e.registered} registered, {e.waitlisted} waiting.{' '}
            {d.feedback.count > 0 ? `Rated ${d.feedback.average} by ${d.feedback.count} ${d.feedback.count === 1 ? 'guest' : 'guests'}.` : 'No feedback yet.'}
          </p>
          {e.status === 'published' && (
            <div className="mt-sm flex flex-wrap gap-xs">
              <Button variant="outline" onClick={() => setStatus.mutate('done')} disabled={setStatus.isPending}>
                Mark done
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (window.confirm('Cancel this event and tell everyone registered?')) setStatus.mutate('cancelled');
                }}
                disabled={setStatus.isPending}
              >
                Cancel event
              </Button>
            </div>
          )}
          <Err e={setStatus.isError ? setStatus.error : checkin.isError ? checkin.error : null} />
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.registrations.length === 0 && <li className="text-[14px] font-semibold text-ink-soft">Nobody registered yet.</li>}
            {d.registrations.map((r) => (
              <li key={r.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">{r.name}</span>
                  <span className="block text-[14px] font-semibold text-ink-soft">
                    {r.status}
                    {r.networkingOptIn ? ', open to intros' : ''}
                    {r.checkedInAt ? `, checked in ${new Date(r.checkedInAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                </span>
                {r.status === 'registered' && (
                  <Button className="shrink-0" onClick={() => checkin.mutate(r.userId)} disabled={checkin.isPending}>
                    Check in
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
