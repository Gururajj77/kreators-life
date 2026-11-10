import { EVENT_TYPE_META, EVENT_TYPES, type DiscountCheck, type EventRegistration, type EventType, type PartyEvent } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { MediaSection, useMediaMenuItem } from '../components/MediaSection';
import { MoreMenu } from '../components/MoreMenu';
import { EventPanel } from '../components/EventPanel';
import { Button } from '../components/Button';
import { DiscountField } from '../components/DiscountField';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Fold } from '../components/Fold';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { DOOR_SIZES, Pager, TEN_A_PAGE, usePage } from '../components/Pager';
import { attendeeBody, AttendeeFields, attendeeProblem, ClaimCard, HostCodeCard } from '../components/AttendeeCode';
import { AppIcon } from '../components/AppIcon';
import { FIELD, FIELD_CARD, RED_YES } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { eventTime, localDateTimeValue, clockTime, displayZone, zoneName } from '../lib/date';
import { FactTag, IconTag } from '../components/FactTag';
import { StatusTag } from '../components/StatusTag';
import { RowCard } from '../components/RowCard';
import { CardHead } from '../components/CardHead';
import { Reveal } from '../components/fx/Reveal';

const when = eventTime;
/** A link drawn as the small outline button (Button's own outline look at its small size). */
const LINK_OUTLINE = 'toy toy-ink btn-outline inline-flex min-h-[36px] md:min-h-[44px] tap-pad items-center justify-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-sm text-subhead font-semibold leading-none text-ink select-none';



/** A step asked once more before it happens, in a sheet instead of the browser's confirm box: a red button does it, a quiet one does not. */
function AskSheet({ ask, onClose }: { ask: { title: string; body: string; action: string; run: () => void } | null; onClose: () => void }) {
  return (
    <Sheet open={ask !== null} onClose={onClose} title={ask?.title ?? ''}>
      <div className="grid gap-md pb-xl">
        <p className="m-0 text-callout text-ink-soft">{ask?.body}</p>
        <div className="flex flex-wrap gap-xs">
          <button
            type="button"
            onClick={() => {
              ask?.run();
              onClose();
            }}
            className={RED_YES}
          >
            {ask?.action}
          </button>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
        </div>
      </div>
    </Sheet>
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
    <StatusTag tone={mine.status === 'waitlisted' ? 'warn' : 'good'}>{label}</StatusTag>
  );
}

function EventCard({ e, index = 0 }: { e: PartyEvent; index?: number }) {
  const meta = EVENT_TYPE_META[e.eventType];
  // The kind's icon and the title at the top left, the price in the corner of every card (Free or the points), the person's place,
  // the day, where and the seats as tags at the foot, and the arrow at the bottom right. A narrow phone no longer squeezes the words
  // beside a column of price and xp.
  return (
    <Reveal as="li" index={index} className="flex">
      <RowCard
        to={`/party/${e.id}`}
        lead={
          <span className="flex size-[44px] items-center justify-center rounded-pill bg-paper" aria-hidden="true">
            <AppIcon name={meta.icon} size={22} />
          </span>
        }
        title={e.title}
        sub={meta.name}
        corner={e.pricePoints > 0 ? <FactTag kind="price">{`${e.pricePoints} pts`}</FactTag> : <FactTag kind="free">Free</FactTag>}
        facts={[
          <MineBadge key="mine" mine={e.mine} />,
          <FactTag key="when" kind="when">{when(e.startsAt)}</FactTag>,
          e.onlineUrl ? <FactTag key="where" kind="online">Online</FactTag> : <FactTag key="where" kind="place">{e.venue || 'Venue to be announced'}</FactTag>,
          <FactTag key="seats" kind="availability">{seats(e)}</FactTag>,
          e.attendeeXp ? <IconTag key="xp" tone="calm" icon="Zap">{`+${e.attendeeXp} xp`}</IconTag> : null,
        ]}
      />
    </Reveal>
  );
}

export function Party() {
  const pg = usePage();
  // What you host is its own list, a page at a time (prefix `h`, ten by default).
  const hp = usePage('h', TEN_A_PAGE);
  const pq = `${pg.query}&${hp.query}`;
  const q = useAuthed(['party', pq], () => api.party(pq));
  const [hosting, setHosting] = useState(false);
  const d = q.data;
  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Party"
        lede="Meetups, workshops, camps and flagship days. RSVP, join a waitlist, check in at the door."
        actions={<Button onClick={() => setHosting(true)}>Host a meetup</Button>}
      >
        {d && !d.club ? <p className="m-0 text-subhead text-ink-soft">Some events are for Club members only. Club is in Apps.</p> : null}
      </AppCover>

      {q.isPending && (
        <p className="mt-md text-subhead text-ink-soft" role="status">
          Finding what is on
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load events.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          <section className="mt-lg" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="text-title2">
              Coming up
            </h2>
            {d.events.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">Nothing on the calendar yet. Host the first meetup.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.events.map((e, i) => (
                <EventCard key={e.id} e={e} index={i} />
              ))}
            </ul>
            <Pager page={d.page} label="events" />
          </section>

          {(d.hosting.length > 0 || d.hostingPage.page > 1) && (
            <section className="mt-lg" aria-labelledby="hosting-heading">
              <h2 id="hosting-heading" className="text-title2">
                Hosting
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.hosting.map((e, i) => (
                  <Reveal as="li" key={e.id} index={i} className="flex">
                    <RowCard
                      to={`/party/${e.id}`}
                      title={e.title}
                      corner={<StatusTag tone={e.status === 'published' ? 'good' : e.status === 'cancelled' ? 'bad' : 'neutral'}>{e.status === 'published' ? 'Live' : e.status === 'cancelled' ? 'Cancelled' : 'Done'}</StatusTag>}
                      facts={[
                        <FactTag key="when" kind="when">{when(e.startsAt)}</FactTag>,
                        <FactTag key="reg" kind="availability">{`${e.registered} registered`}</FactTag>,
                        e.waitlisted > 0 ? <FactTag key="wait" kind="availability">{`${e.waitlisted} waiting`}</FactTag> : null,
                      ]}
                    />
                  </Reveal>
                ))}
              </ul>
              <Pager page={d.hostingPage} prefix="h" label="events you host" only={TEN_A_PAGE} />
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
  const [attendeeXp, setAttendeeXp] = useState('');
  const [attendeeCode, setAttendeeCode] = useState('');
  const hid = useId();
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
        ...attendeeBody(attendeeXp, attendeeCode),
      }),
    onSuccess: (r) => {
      refresh();
      onClose();
      // The event is up either way; a code the server would not set is said on the event page, where it is set again.
      if (r.event) nav(`/party/${r.event.id}`, { state: r.codeError ? { codeError: r.codeError } : null });
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
          <legend className="text-subhead font-semibold">What kind</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {types.map((t) => (
              <button key={t} type="button" aria-pressed={eventType === t} onClick={() => setEventType(t)} className={`toy inline-flex min-h-[36px] md:min-h-[44px] tap-pad items-center gap-xs rounded-pill border-2 px-sm text-subhead font-medium ${eventType === t ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                <AppIcon name={EVENT_TYPE_META[t].icon} size={16} />
                {EVENT_TYPE_META[t].name}
              </button>
            ))}
          </div>
          <p className="mt-xs m-0 text-caption text-ink-soft">{canHostAll ? 'Members can host a meetup. The rest are team events.' : 'Parties, workshops, camps and Kreators Days are run by the team.'}</p>
        </fieldset>
        <div>
          <label className="block">
            <span className="block text-subhead font-semibold">Title</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required aria-describedby={`${hid}-title`} className={FIELD} />
          </label>
          <p id={`${hid}-title`} className="mt-xs m-0 text-caption text-ink-soft">A short name, up to 120 characters.</p>
        </div>
        <div>
          <label className="block">
            <span className="block text-subhead font-semibold">What to expect</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} rows={3} aria-describedby={`${hid}-about`} className={FIELD} />
          </label>
          <p id={`${hid}-about`} className="mt-xs m-0 text-caption text-ink-soft">Optional. What guests will do there.</p>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <div>
            <label className="block">
              <span className="block text-subhead font-semibold">Starts</span>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required aria-describedby={`${hid}-starts`} className={FIELD} />
            </label>
            <p id={`${hid}-starts`} className="mt-xs m-0 text-caption text-ink-soft">Your local time.</p>
          </div>
          <div>
            <label className="block">
              <span className="block text-subhead font-semibold">Minutes</span>
              <input type="number" min={15} max={10080} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-describedby={`${hid}-minutes`} className={FIELD} />
            </label>
            <p id={`${hid}-minutes`} className="mt-xs m-0 text-caption text-ink-soft">How long it runs.</p>
          </div>
        </div>
        <div>
          <label className="block">
            <span className="block text-subhead font-semibold">Venue</span>
            <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} placeholder="Leave empty for online" aria-describedby={`${hid}-venue`} className={FIELD} />
          </label>
          <p id={`${hid}-venue`} className="mt-xs m-0 text-caption text-ink-soft">Where guests should go.</p>
        </div>
        <div>
          <label className="block">
            <span className="block text-subhead font-semibold">Online link</span>
            <input type="url" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} maxLength={500} placeholder="https://" aria-describedby={`${hid}-link`} className={FIELD} />
          </label>
          <p id={`${hid}-link`} className="mt-xs m-0 text-caption text-ink-soft">Optional. The call link for guests.</p>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <div>
            <label className="block">
              <span className="block text-subhead font-semibold">Seats</span>
              <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="No limit" aria-describedby={`${hid}-seats`} className={FIELD} />
            </label>
            <p id={`${hid}-seats`} className="mt-xs m-0 text-caption text-ink-soft">Once full, people wait in line.</p>
          </div>
          <div>
            <label className="block">
              <span className="block text-subhead font-semibold">Price in points</span>
              <input type="number" min={0} value={pricePoints} onChange={(e) => setPricePoints(e.target.value)} aria-describedby={`${hid}-price`} className={FIELD} />
            </label>
            <p id={`${hid}-price`} className="mt-xs m-0 text-caption text-ink-soft">0 makes it free.</p>
          </div>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Who can see it</legend>
          {/* Three equal choices across the full width in equal parts; where the sheet is narrow, two by two (as PeriodFilter) with the
              third taking the whole second line, so none is left alone. */}
          <div className="@container mt-xs">
          <div className="grid grid-cols-3 gap-xs @max-[23rem]:grid-cols-2 @max-[23rem]:*:last:col-span-2">
            {(
              [
                ['public', 'Everyone'],
                ['club', 'Club members'],
                ['private', 'People with the link'],
              ] as [PartyEvent['visibility'], string][]
            ).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={visibility === v} onClick={() => setVisibility(v)} className={`toy min-h-[36px] md:min-h-[44px] tap-pad min-w-0 rounded-pill border-2 px-sm py-0 md:py-xs text-subhead font-medium ${visibility === v ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {label}
              </button>
            ))}
          </div>
          </div>
          <p className="mt-xs m-0 text-caption text-ink-soft">Everyone: listed for all. Club members: only the club sees it. People with the link: kept off the list.</p>
        </fieldset>
        <AttendeeFields xp={attendeeXp} onXp={setAttendeeXp} code={attendeeCode} onCode={setAttendeeCode} />
        <ErrorLine e={create.isError ? create.error : null} />
        <Button type="submit" size="lg" full disabled={create.isPending || !title.trim() || !startsAt || attendeeProblem(attendeeXp, attendeeCode) !== null}>
          Publish event
        </Button>
      </form>
    </Sheet>
  );
}

export function EventPage() {
  const { id = '' } = useParams();
  // The host's guest list is a page at a time (prefix `g`). With no size in the address the server sends 100 a page, so the whole room shows at the door.
  const gp = usePage('g', DOOR_SIZES);
  const [params] = useSearchParams();
  const gq = `gpage=${gp.page}${params.get('gsize') ? `&gsize=${gp.size}` : ''}`;
  const q = useAuthed(['event', id, gq], () => api.event(id, gq));
  const refresh = useRefreshAll();
  const navState = useLocation().state as { codeError?: string; joined?: EventRegistration['status'] } | null;
  const codeError = navState?.codeError ?? null;
  const [networking, setNetworking] = useState(false);
  // "Add pictures and videos" sits with the page's actions on the cover (a More menu), as on Store, Tools, Work and Win, never loose
  // between the details and Coming?.
  const [editingMedia, setEditingMedia] = useState(false);
  const mediaItem = useMediaMenuItem('event', id, () => setEditingMedia(true));
  // A team discount code on a ticket that costs points. The server prices it again when the RSVP is sent.
  const [discount, setDiscount] = useState<DiscountCheck | null>(null);
  // Someone who joined from the event's public page lands here with how it went (the event attendee's way in).
  const [rsvpResult, setRsvpResult] = useState<string | null>(navState?.joined === 'registered' ? 'You are in. See you there.' : navState?.joined === 'waitlisted' ? 'The room is full, so you are on the waitlist. We will tell you if a seat opens.' : null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [thanks, setThanks] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rsvp = useMutation({
    mutationFn: () => api.rsvp(id, networking, discount && discount.offPoints > 0 ? discount.code : undefined),
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
        <AppCover back={{ to: '/party', label: 'Party' }} title="Not for you, or gone" lede={q.error instanceof Error ? q.error.message : 'This event is private, Club-only, or no longer exists.'} />
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
      <AppCover
        back={{ to: '/party', label: 'Party' }}
        eyebrow={
          <span className="inline-flex flex-wrap items-center justify-start gap-xs md:justify-end">
            <AppIcon name={meta.icon} size={16} />
            <span>
              {meta.name}, hosted by {e.hostName}
              {e.status !== 'published' ? `, ${e.status}` : ''}
            </span>
          </span>
        }
        title={e.title}
        lede={
          mine || e.visibility !== 'public' ? (
            <span className="inline-flex flex-wrap items-center justify-start gap-xs md:justify-end">
              <MineBadge mine={mine} />
              {e.visibility !== 'public' && (
                <IconTag tone="deep" icon="Lock">{e.visibility === 'club' ? 'Club only' : 'Private'}</IconTag>
              )}
            </span>
          ) : undefined
        }
        actions={mediaItem ? <MoreMenu label={`More for ${e.title}`} title={e.title} items={[mediaItem]} /> : undefined}
      />

      {/* The day at the top left with the price in the corner, where, the seats as tags under it, then the words. */}
      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="Details">
        <CardHead tag={e.pricePoints > 0 ? <FactTag kind="price">{`${e.pricePoints} points a ticket`}</FactTag> : <FactTag kind="free">Free</FactTag>}>
          <p className="m-0 text-card-title">{when(e.startsAt)}</p>
          <p className="m-0 text-card-note text-ink-soft">
            Until {when(e.endsAt)} ({zoneName(displayZone())})
          </p>
        </CardHead>
        <div className="mt-sm flex">
          <span className="fill-row-all flex min-w-0 flex-wrap gap-xs">
            {e.onlineUrl ? <FactTag kind="online">Online</FactTag> : <FactTag kind="place">{e.venue || 'Venue to be announced'}</FactTag>}
            <FactTag kind="availability">{seats(e)}</FactTag>
          </span>
        </div>
        {mine && mine.status !== 'waitlisted' && e.onlineUrl && (
          <a href={e.onlineUrl} target="_blank" rel="noreferrer" className="toy mt-sm inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
            Open the room
          </a>
        )}
        {e.description && <p className="mt-sm m-0 whitespace-pre-wrap text-prose">{e.description}</p>}
      </section>

      {/* The pictures under the facts they show, so the day, the place and the seats are read first; their editor opens from the More menu. */}
      <MediaSection type="event" id={e.id} trigger={null} open={editingMedia} onOpenChange={setEditingMedia} />

      {d.attendee && (
        <section className="mt-lg" aria-labelledby="code-heading">
          <h2 id="code-heading" className="text-title2">
            Attendee code
          </h2>
          <ClaimCard
            view={d.attendee}
            onClaim={async (code) => {
              const r = await api.claimEventCode(id, code);
              refresh();
              return r;
            }}
          />
        </section>
      )}

      {e.status === 'published' && !over && (
        <section className="mt-lg" aria-labelledby="rsvp-heading">
          <h2 id="rsvp-heading" className="text-title2">
            {mine ? 'Your spot' : 'Coming?'}
          </h2>
          {rsvpResult && (
            <p role="status" className="mt-xs m-0 rounded-tile p-sm text-subhead" style={{ background: 'var(--tint-green)' }}>
              {rsvpResult}
            </p>
          )}
          {!mine ? (
            <div className="mt-sm flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-sm text-subhead font-semibold">
                <input type="checkbox" checked={networking} onChange={(ev) => setNetworking(ev.target.checked)} className="size-[20px] accent-ink" />
                <span>Introduce me to other guests</span>
              </label>
              {e.pricePoints > 0 && <DiscountField area="event" itemId={id} value={discount?.code ?? ''} check={discount} onChange={(_c, check) => setDiscount(check)} />}
              <ErrorLine e={rsvp.isError ? rsvp.error : null} />
              <Button size="lg" full onClick={() => rsvp.mutate()} disabled={rsvp.isPending}>
                {e.capacity !== null && e.registered >= e.capacity ? 'Join the waitlist' : e.pricePoints > 0 ? `RSVP for ${discount && discount.offPoints > 0 ? discount.payPoints : e.pricePoints} points` : 'RSVP'}
              </Button>
            </div>
          ) : (
            <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
              <p className="m-0 text-card-title">{mine.status === 'waitlisted' ? 'You are on the waitlist.' : 'You are registered.'}</p>
              <p className="mt-xs m-0 text-card-note text-ink-soft">{mine.networkingOptIn ? 'Open to introductions at this event.' : 'Not open to introductions at this event.'}</p>
              <ErrorLine e={cancel.isError ? cancel.error : null} />
              <Button variant="outline" className="mt-sm" onClick={() => setLeaving(true)} disabled={cancel.isPending}>
                Cancel my RSVP
              </Button>
            </div>
          )}
        </section>
      )}

      {/* One tap each to the people: this event's conversation, Community and Bond (the event attendee's way in, 2026-11-07). */}
      {mine && (mine.status === 'registered' || mine.status === 'attended') && e.status !== 'cancelled' && (
        <nav aria-label="Meet the people" className="mt-sm flex flex-wrap gap-xs fill-row">
          <Link to={`#talk-${e.id}`} className={LINK_OUTLINE}>
            Event chat
          </Link>
          <Link to="/community" className={LINK_OUTLINE}>
            Community
          </Link>
          <Link to="/bond" className={LINK_OUTLINE}>
            Bond
          </Link>
        </nav>
      )}

      {canFeedback && (
        <section className="mt-lg" aria-labelledby="fb-heading">
          <h2 id="fb-heading" className="text-title2">
            How was it?
          </h2>
          {thanks ? (
            <p className="mt-xs m-0 rounded-tile p-sm text-subhead" style={{ background: 'var(--tint-green)' }}>
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
                  <button key={n} type="button" aria-pressed={rating === n} aria-label={`${n} out of 5`} onClick={() => setRating(n)} className={`toy flex size-[44px] items-center justify-center rounded-pill border-2 text-headline ${rating >= n ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="block text-subhead font-semibold">A few words</span>
                <textarea value={comment} onChange={(ev) => setComment(ev.target.value)} maxLength={1000} rows={3} className={FIELD} />
              </label>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-sm text-subhead font-semibold">
                <input type="checkbox" checked={networking} onChange={(ev) => setNetworking(ev.target.checked)} className="size-[20px] accent-ink" />
                Introduce me to people I met here
              </label>
              <ErrorLine e={feedback.isError ? feedback.error : null} />
              <Button type="submit" full disabled={feedback.isPending || rating === 0}>
                Send feedback
              </Button>
            </form>
          )}
        </section>
      )}

      {d.host && (
        <section className="mt-lg" aria-labelledby="host-heading">
          <h2 id="host-heading" className="text-title2">
            Hosting tools
          </h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            {e.registered} registered, {e.waitlisted} waiting.{' '}
            {d.feedback.count > 0 ? `Rated ${d.feedback.average} by ${d.feedback.count} ${d.feedback.count === 1 ? 'guest' : 'guests'}.` : 'No feedback yet.'}
          </p>
          {e.status !== 'cancelled' && (
            <div className="mt-sm">
              {codeError && !d.hostCode && (
                <p role="alert" className="m-0 mb-sm rounded-tile bg-r1/15 p-sm text-subhead">
                  The event is up, but its xp was not set: {codeError} Set it here.
                </p>
              )}
              <HostCodeCard
                value={d.hostCode}
                startsAt={e.startsAt}
                onSave={async (change) => {
                  await api.setEventCode(id, change);
                  await q.refetch();
                }}
              />
            </div>
          )}
          <DuplicateEvent id={e.id} startsAt={e.startsAt} />
          {e.status === 'published' && (
            <div className="mt-sm flex flex-wrap gap-xs">
              <Button variant="outline" onClick={() => setStatus.mutate('done')} disabled={setStatus.isPending}>
                Mark done
              </Button>
              <Button
                variant="outline"
                onClick={() => setCancelling(true)}
                disabled={setStatus.isPending}
              >
                Cancel event
              </Button>
            </div>
          )}
          <ErrorLine e={setStatus.isError ? setStatus.error : checkin.isError ? checkin.error : null} />
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.registrations.length === 0 && gp.page === 1 && <li className="text-subhead text-ink-soft">Nobody registered yet.</li>}
            {d.registrations.map((r) => (
              <li key={r.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">{r.name}</span>
                  <span className="block text-card-note text-ink-soft">
                    {r.status}
                    {r.networkingOptIn ? ', open to intros' : ''}
                    {r.checkedInAt ? `, checked in ${clockTime(r.checkedInAt)}` : ''}
                  </span>
                </span>
                {r.status === 'registered' && (
                  <Button variant="outline" className="shrink-0" onClick={() => checkin.mutate(r.userId)} disabled={checkin.isPending}>
                    Check in
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {/* The bar shows only when there is more than one page, or a size was picked: a short guest list needs none. */}
          <Pager page={d.registrationsPage && (d.registrationsPage.more || d.registrationsPage.page > 1 || params.get('gsize')) ? d.registrationsPage : undefined} prefix="g" label="guests" only={DOOR_SIZES} />
        </section>
      )}
      {(d.host || (mine && (mine.status === 'registered' || mine.status === 'attended'))) && <EventPanel app="party" id={e.id} />}
      <AskSheet
        ask={leaving ? { title: 'Cancel your RSVP?', body: mine?.status === 'waitlisted' ? 'You leave the waitlist. You can join again while the event has room for it.' : 'Your seat goes to the next person. Any points you paid come back.', action: 'Yes, cancel it', run: () => cancel.mutate() } : null}
        onClose={() => setLeaving(false)}
      />
      <AskSheet ask={cancelling ? { title: 'Cancel this event?', body: 'Everyone registered is told it is off. This cannot be undone.', action: 'Yes, cancel it', run: () => setStatus.mutate('cancelled') } : null} onClose={() => setCancelling(false)} />
    </Screen>
  );
}

/** The datetime-local value for an instant, in the device's own time. */
const localInput = (iso: string) => localDateTimeValue(new Date(iso));

/** Make the same event again on a new date: a week later to start with. Guests do not carry over; the xp does, with a new code. */
function DuplicateEvent({ id, startsAt }: { id: string; startsAt: string }) {
  const nav = useNavigate();
  const refresh = useRefreshAll();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(() => localInput(new Date(Math.max(Date.parse(startsAt), Date.now()) + 7 * 86_400_000).toISOString()));
  const copy = useMutation({
    mutationFn: () => api.duplicateEvent(id, new Date(when).toISOString()),
    onSuccess: (r) => {
      setOpen(false);
      refresh();
      if (r.event) nav(`/party/${r.event.id}`);
    },
  });
  // A fold under its own title, in the host's card (2026-11-06, no sheet): the date field takes focus as it opens, Escape folds it back.
  const fieldRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) fieldRef.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => wrapRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus());
  };
  return (
    <div ref={wrapRef} className="mt-sm">
      <Fold title="Run it again" adds open={open} onOpenChange={setOpen}>
        <div
          className="rounded-tile bg-paper p-sm"
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') {
              ev.preventDefault();
              close();
            }
          }}
        >
          <p className="m-0 text-subhead text-ink-soft">Same title, place, seats and price on a new date. Guests sign up again, with a new code.</p>
          <label className="mt-sm block">
            <span className="block text-subhead font-semibold">Starts</span>
            <input ref={fieldRef} type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} className={FIELD_CARD} />
          </label>
          <ErrorLine e={copy.isError ? copy.error : null} />
          <div className="mt-sm flex flex-wrap gap-xs">
            <Button variant="outline" disabled={copy.isPending || !when} onClick={() => copy.mutate()}>
              Make the new event
            </Button>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      </Fold>
    </div>
  );
}
