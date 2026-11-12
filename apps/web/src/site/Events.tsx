import { birthDateProblem, EVENT_TYPE_META, fact, MIN_AGE, passwordProblem, PHONE_HINT, phoneProblem, type EventType, type Listing, type PublicEvent } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorLine } from '../components/ErrorLine';
import { FactTag } from '../components/FactTag';
import { MediaCover } from '../components/Media';
import { Pager, usePage } from '../components/Pager';
import { SkeletonList } from '../components/Skeleton';
import { TermsBox } from '../components/TermsBox';
import { api, ApiError, publicApi } from '../lib/api';
import { evenGrid, evenTile } from '../lib/bento';
import { displayZone, eventTime, todayLocal, zoneName } from '../lib/date';
import { useMe } from '../lib/queries';
import { storedRef, useSession } from '../lib/store';
import { FIELD_CARD } from '../lib/ui';
import { PasswordField } from '../screens/Auth';
import { SITE_LINK, SITE_PRIMARY, SITE_SECONDARY, SiteArrow } from './buttons';
import { LISTING_COLS, ListingCard } from './ListingCard';
import { SiteLayout } from './SiteLayout';
import { StickyAction } from '../components/StickyAction';
import { InviteCodeField } from '../components/InviteGate';
import { inviteRefusal, keepInvite, keptInvite } from '../lib/invite';
import { clipDescription, pageTitle, usePageMeta } from '../lib/usePageMeta';

/** The kind of event in words ("Meetup"), from its stored key. */
const kindOf = (e: PublicEvent): string => EVENT_TYPE_META[e.eventType as EventType]?.name ?? 'Event';

/** Seats in words: what is left, or that it is full, or that there is no limit. */
function seatsLine(e: PublicEvent): string {
  if (e.seatsLeft === null) return 'Open to all';
  if (e.seatsLeft === 0) return 'Full, waitlist open';
  return `${e.seatsLeft} seat${e.seatsLeft === 1 ? '' : 's'} left`;
}

const priceLine = (e: PublicEvent) => `${e.pricePoints} points`;

/** A public event as a card on the list, in the site's listing look: the time is the visitor's own (lib/date.ts), never the server's. */
function toListing(e: PublicEvent): Listing {
  return {
    type: 'event',
    id: e.id,
    title: e.title,
    by: e.hostName,
    blurb: e.description,
    facts: [
      ...fact('category', kindOf(e)),
      ...(e.pricePoints > 0 ? fact('price', priceLine(e)) : fact('free', 'Free')),
      ...fact('when', eventTime(e.startsAt)),
      ...(e.online ? fact('online', 'Online') : fact('place', e.venue || 'Place to be announced')),
      ...fact('availability', seatsLine(e)),
    ],
    path: `/events/${e.id}`,
    featured: e.featured,
    live: true,
    endsAt: e.endsAt,
    createdAt: e.startsAt,
    media: e.media,
  };
}

/**
 * Every upcoming public event, a page at a time (2026-11-07, the event attendee's way in). Explore lists events too, among everything else;
 * this page is only events, with the seats left on each card, and each card opens the event's own page, where a visitor joins and signs up.
 */
export function EventsList() {
  usePageMeta('/events');
  const pg = usePage();
  const q = useQuery({ queryKey: ['public-events', pg.query], queryFn: () => publicApi.events(pg.query) });
  const list = q.data?.events ?? [];
  return (
    <SiteLayout>
      <header className="pt-lg">
        <h1 className="type-hook text-display-1">Events</h1>
        <p className="mt-xs m-0 max-w-[640px] text-callout text-ink-soft">Meetups, workshops and days you can join. Pick one to save your seat.</p>
      </header>
      <section className="mt-lg" aria-live="polite" aria-label="Upcoming events">
        {q.isPending && <SkeletonList count={3} label="Loading events" />}
        {q.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            Could not load the events. Try again in a moment.
          </p>
        )}
        {q.data && list.length === 0 && (
          <div className="rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 text-callout text-ink-soft">No events are open right now. Check back soon.</p>
            <Link to="/explore" className={`${SITE_LINK} text-subhead`}>
              See everything in Explore
            </Link>
          </div>
        )}
        {list.length > 0 && (
          <>
            <ul data-tile-list="paged" className={`grid list-none gap-sm p-0 m-0 ${evenGrid(list.length, LISTING_COLS)}`}>
              {list.map((e, i) => (
                <ListingCard key={e.id} listing={toListing(e)} maxFacts={4} className={evenTile(i, list.length, LISTING_COLS)} />
              ))}
            </ul>
            <Pager page={q.data?.page} label="events" />
          </>
        )}
      </section>
    </SiteLayout>
  );
}

/** The sign-up on the event's own page: the same fields and rules as the sign-up page (passwordProblem, phoneProblem, birthDateProblem, the terms box). */
interface Account {
  name: string;
  email: string;
  password: string;
  confirm: string;
  phone: string;
  birthDate: string;
}
const EMPTY: Account = { name: '', email: '', password: '', confirm: '', phone: '', birthDate: '' };

/**
 * One public event's page (2026-11-07, the event attendee's way in): its story, then one main action, Join this event. A visitor with no
 * account signs up right here (the device session first, as Welcome makes it, then the account, so the same rules hold); a signed-in person
 * joins in one tap. Joining marks an account still setting up as an attendee and switches Party, Community and Bond on, then takes the seat
 * for a free event. A ticket that costs points is bought on the event's page in the app, only on the person's own yes. Either way they land
 * on the event in the app; the setup chat waits until they want it.
 */
export function EventLanding() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const token = useSession((s) => s.token);
  const setToken = useSession((s) => s.setToken);
  const me = useMe();
  const q = useQuery({ queryKey: ['public-event', id], queryFn: () => publicApi.publicEvent(id), retry: false });
  const [v, setV] = useState<Account>(EMPTY);
  const [agree, setAgree] = useState(false);
  const [networking, setNetworking] = useState(false);
  // While joining is by invite a visitor with no session needs a code (2026-11-10): the one this tab arrived with, or one typed here.
  const [invite, setInvite] = useState(() => keptInvite() ?? '');
  const gate = useQuery({ queryKey: ['site', 'join'], queryFn: publicApi.join, enabled: !token, staleTime: 60_000 });
  // Set once the account is made here, so a second try after a failed join never asks for a new account.
  const [madeHere, setMadeHere] = useState(false);
  const signedIn = Boolean(token && me.data?.user.email) || madeHere;
  const checking = Boolean(token) && me.isPending && !madeHere;

  const e = q.data?.event;
  // A live page the site's list does not hold: its own title and words, once the event is in (a page that is not public names nothing).
  usePageMeta(e ? `/events/${id}` : null, e ? { title: pageTitle(e.title), description: clipDescription(e.description || `${e.title}, an event on kreators.app.`), canonical: `/events/${id}` } : undefined);
  const paid = Boolean(e && e.pricePoints > 0);
  const join = useMutation({
    mutationFn: async () => {
      if (!signedIn) {
        // The device session first, as Welcome makes it, then the account on top of it, so nothing said on this device is lost.
        if (!token) {
          setToken((await api.anon(storedRef(), invite.trim() || null)).token);
          keepInvite(null);
        }
        const made = await api.signup({ email: v.email.trim(), password: v.password, displayName: v.name.trim(), phone: v.phone.trim(), birthDate: v.birthDate, acceptTerms: agree });
        setToken(made.token);
        setMadeHere(true);
      }
      await api.arriveEvent(id);
      // A paid ticket is bought on the event's page, where the price and any code are said again before anything is taken.
      if (paid) return null;
      try {
        return (await api.rsvp(id, networking)).status;
      } catch (err) {
        // Already in (two tabs, or a seat taken before): the event page says where they stand.
        if (err instanceof ApiError && err.status === 409) return null;
        throw err;
      }
    },
    onError: (err) => {
      if (inviteRefusal(err) === 'invite-unusable') keepInvite(null);
    },
    onSuccess: async (status) => {
      await qc.invalidateQueries();
      nav(`/party/${id}${paid ? '#rsvp-heading' : ''}`, { state: status ? { joined: status } : undefined });
    },
  });

  const weak = v.password ? passwordProblem(v.password, v.email) : null;
  const mismatch = v.confirm.length > 0 && v.confirm !== v.password;
  const phoneBad = v.phone ? phoneProblem(v.phone) : null;
  const ageBad = v.birthDate ? birthDateProblem(v.birthDate) : null;
  const formReady = v.email.includes('@') && v.password.length > 0 && !weak && v.confirm === v.password && v.phone.length > 0 && !phoneBad && v.birthDate.length > 0 && !ageBad && agree;
  const set = (k: keyof Account) => (value: string) => setV((x) => ({ ...x, [k]: value }));

  if (q.isError) {
    return (
      <SiteLayout wide={false}>
        <header className="pt-lg">
          <h1 className="type-hook text-display-2">Not open here</h1>
          <p className="mt-xs m-0 text-callout text-ink-soft">This event is not public, or it is gone.</p>
        </header>
        <Link to="/events" className={`mt-md ${SITE_SECONDARY}`}>
          See upcoming events
          <SiteArrow />
        </Link>
      </SiteLayout>
    );
  }
  if (!e) {
    return (
      <SiteLayout wide={false}>
        <div className="pt-lg">
          <SkeletonList count={2} label="Loading the event" />
        </div>
      </SiteLayout>
    );
  }

  const over = e.status !== 'published' || new Date(e.endsAt).getTime() < Date.now();
  const full = e.seatsLeft === 0;
  const label = full ? 'Join the waitlist' : 'Join this event';
  const ready = signedIn || (formReady && (Boolean(token) || !gate.data?.inviteOnly || invite.trim().length > 0));
  const caption = paid ? `The ticket is ${priceLine(e)}. You pay in the app, only when you say yes.` : full ? 'The room is full. You go on the waitlist and hear if a seat opens.' : 'Free. You land on the event, with its chat one tap away.';

  return (
    <SiteLayout wide={false}>
      <header className="pt-lg">
        <p className="m-0 type-eyebrow text-ink-mute">
          <span className="inline-block">{kindOf(e)},</span> <span className="inline-block">hosted by {e.hostName}</span>
        </p>
        <h1 className="mt-xs type-hook text-display-2">{e.title}</h1>
      </header>

      {e.media?.some((m) => m.url) && (
        <div className="mt-md [&>*]:rounded-tile">
          <MediaCover items={e.media} title={e.title} />
        </div>
      )}

      {/* The story: when, where, the seats and the price as tags, then the host's own words. */}
      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="About this event">
        <p className="m-0 text-card-title">{eventTime(e.startsAt)}</p>
        <p className="m-0 text-card-note text-ink-soft">
          Until {eventTime(e.endsAt)} ({zoneName(displayZone())})
        </p>
        <div className="mt-sm flex">
          <span className="fill-row-all flex min-w-0 flex-wrap gap-xs">
            {e.pricePoints > 0 ? <FactTag kind="price">{`${priceLine(e)} a ticket`}</FactTag> : <FactTag kind="free">Free</FactTag>}
            {e.online ? <FactTag kind="online">Online</FactTag> : <FactTag kind="place">{e.venue || 'Place to be announced'}</FactTag>}
            <FactTag kind="availability">{seatsLine(e)}</FactTag>
          </span>
        </div>
        {e.description && <p className="mt-sm m-0 whitespace-pre-wrap text-prose">{e.description}</p>}
      </section>

      {/* One main action. A visitor signs up right here; a signed-in person joins in one tap. */}
      <section className="mt-lg" aria-labelledby="join-heading">
        <h2 id="join-heading" className="text-title2">
          {over ? (e.status === 'cancelled' ? 'This event was cancelled' : 'This event is over') : signedIn ? 'Coming?' : 'Join in a minute'}
        </h2>
        {over ? (
          <Link to="/events" className={`mt-sm ${SITE_SECONDARY}`}>
            See upcoming events
            <SiteArrow />
          </Link>
        ) : checking ? (
          <SkeletonList count={1} label="Checking your account" className="mt-sm" />
        ) : (
          <form
            data-pillar="friendship"
            className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (ready && !join.isPending) join.mutate();
            }}
          >
            {!signedIn && (
              <>
                <p className="m-0 text-subhead text-ink-soft">{`Make your account to save your seat. You need to be ${MIN_AGE} or older.`}</p>
                <label className="block">
                  <span className="block text-subhead font-semibold">Name</span>
                  <input value={v.name} onChange={(x) => set('name')(x.target.value)} maxLength={40} autoComplete="nickname" className={FIELD_CARD} />
                </label>
                <label className="block">
                  <span className="block text-subhead font-semibold">Email</span>
                  <input type="email" required value={v.email} onChange={(x) => set('email')(x.target.value)} autoComplete="email" maxLength={254} className={FIELD_CARD} />
                </label>
                <PasswordField label="Password" value={v.password} onChange={set('password')} autoComplete="new-password" hint={weak ?? 'Eight characters or more. Not your email, not one from the usual guess lists.'} />
                <PasswordField label="Password, once more" value={v.confirm} onChange={set('confirm')} autoComplete="new-password" hint={mismatch ? 'The two do not match yet.' : undefined} />
                <label className="block">
                  <span className="block text-subhead font-semibold">Phone</span>
                  <input type="tel" required value={v.phone} onChange={(x) => set('phone')(x.target.value)} autoComplete="tel" maxLength={24} placeholder="+91 98765 43210" className={FIELD_CARD} />
                  <span className="mt-xs block text-caption text-ink-soft">{phoneBad ?? `${PHONE_HINT} Never shown to anyone.`}</span>
                </label>
                <label className="block">
                  <span className="block text-subhead font-semibold">Date of birth</span>
                  <input type="date" required value={v.birthDate} onChange={(x) => set('birthDate')(x.target.value)} autoComplete="bday" max={todayLocal()} className={FIELD_CARD} />
                  <span className="mt-xs block text-caption text-ink-soft">{ageBad ?? 'Nobody else sees it.'}</span>
                </label>
                <TermsBox checked={agree} onChange={setAgree} />
                {!token && (gate.data?.inviteOnly || invite || inviteRefusal(join.error)) && <InviteCodeField value={invite} onChange={setInvite} />}
              </>
            )}
            {!paid && (
              // Inset by the terms box's own 8px, so the two ticks above the button start on one edge.
              <label className={`flex min-h-[44px] cursor-pointer items-center gap-sm text-subhead font-semibold ${signedIn ? '' : 'px-xs'}`}>
                <input type="checkbox" checked={networking} onChange={(x) => setNetworking(x.target.checked)} className="size-[20px] accent-ink" />
                <span>Introduce me to other guests</span>
              </label>
            )}
            <ErrorLine e={join.isError ? join.error : null} />
            {/* With the sign-up above it the form runs past a phone's screen: Join stays in reach at the bottom edge (StickyAction). */}
            <StickyAction>
              <button type="submit" disabled={!ready || join.isPending} className={`${SITE_PRIMARY} w-full disabled:opacity-50`}>
                {join.isPending ? 'Joining' : label}
              </button>
              <p className="mt-xs m-0 text-center text-caption text-ink-soft">{caption}</p>
            </StickyAction>
          </form>
        )}
        {!over && !signedIn && !checking && (
          <p className="mt-sm m-0 text-center text-subhead text-ink-soft">
            Have an account?{' '}
            <Link to={`/signin?next=${encodeURIComponent(`/events/${id}`)}`} className="inline-flex min-h-[44px] min-w-[44px] items-center px-xs underline underline-offset-4">
              Sign in
            </Link>
          </p>
        )}
      </section>
    </SiteLayout>
  );
}
