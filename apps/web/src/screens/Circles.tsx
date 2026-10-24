import { INTERESTS, type CircleEvent } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { useNow } from '../lib/useNow';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const countdown = (iso: string, now: number) => {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'now';
  const h = Math.floor(ms / 3600_000);
  const d = Math.floor(h / 24);
  if (d >= 2) return `${d} days`;
  if (h >= 1) return `${h} h ${Math.floor((ms % 3600_000) / 60_000)} min`;
  return `${Math.ceil(ms / 60_000)} min`;
};

/** Anonymous small groups near you. */
export function Circles() {
  const q = useAuthed(['circles'], api.circles);
  const me = useMe();
  const refresh = useRefreshAll();
  const d = q.data;
  const [creating, setCreating] = useState(false);
  const join = useMutation({ mutationFn: (id: string) => api.joinCircle(id), onSuccess: () => q.refetch() });
  const leave = useMutation({ mutationFn: (id: string) => api.leaveCircle(id), onSuccess: () => q.refetch() });
  const match = useMutation({ mutationFn: (id: string) => api.matchCircle(id), onSuccess: () => refresh() });
  const ready = (d?.interests.length ?? 0) >= 2 && Boolean(d?.city);

  return (
    <Screen>
      <header className="pt-lg">
        <Link to="/apps" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Apps
        </Link>
        <h1 className="text-[30px]">Circles</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Small anonymous groups near you, seated by interests that fit together. Everyone has an alias. The chat opens a day before you meet; names only appear when someone chooses to reveal.</p>
        {d && !ready && (
          <p className="mt-sm m-0 rounded-tile bg-r3 p-sm text-[14px] font-bold text-ink-fixed">
            To join a circle, pick at least two interests and your city under{' '}
            <Link to="/profile" className="underline underline-offset-4">
              Profile
            </Link>
            .
          </p>
        )}
        {d && ready && (
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
            Matching on {d.interests.slice(0, 4).join(', ')} in {d.area ? `${d.area}, ` : ''}
            {d.city}
            {d.hasLocation ? ', within twenty kilometres of you' : ''}.
          </p>
        )}
        {d?.canCreate && (
          <Button variant="outline" className="mt-sm" onClick={() => setCreating(true)}>
            Open a circle
          </Button>
        )}
      </header>

      {d && d.groups.length > 0 && (
        <section className="mt-lg" aria-labelledby="tables-heading">
          <h2 id="tables-heading" className="text-[24px]">
            Your tables
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.groups.map((g) => (
              <li key={g.id}>
                <Link to={`/circles/${g.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
                  <span className="flex shrink-0 -space-x-[10px]" aria-hidden="true">
                    {g.members.slice(0, 4).map((m) => (
                      <Avatar key={m.alias} relationship={m.character} size={32} decorative still />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">
                      {g.eventTitle}, {g.name}
                    </span>
                    <span className="block text-[14px] font-semibold text-ink-soft">
                      {when(g.startsAt)}, {g.members.length} people. {g.chatOpen ? 'Chat is open.' : `Chat opens ${when(g.chatOpensAt)}.`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="events-heading">
        <h2 id="events-heading" className="text-[24px]">
          Upcoming{d?.city ? ` in ${d.city}` : ''}
        </h2>
        {d && d.events.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No circles here yet. The team opens them city by city; check Explore for other cities.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d?.events.map((e) => (
            <EventCard key={e.id} e={e} ready={ready} canMatch={Boolean(d.canCreate)} busy={join.isPending || leave.isPending || match.isPending} onJoin={() => join.mutate(e.id)} onLeave={() => leave.mutate(e.id)} onMatch={() => match.mutate(e.id)} />
          ))}
        </ul>
        {join.isError && (
          <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {join.error instanceof Error ? join.error.message : 'Could not join.'}
          </p>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-[24px]">
          How it works
        </h2>
        <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {[
            'Sign up for a circle. Signups close thirty-six hours before.',
            'Two days before, tables are set: people nearby whose interests complement yours, under aliases.',
            'The chat opens a day before. Agree on the exact place and time together.',
            'Meet. Afterwards, reveal who you are if you want to keep in touch, and ask for introductions under Bond.',
          ].map((t, i) => (
            <li key={t} className="flex gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="flex size-[28px] shrink-0 items-center justify-center rounded-pill bg-ink text-[14px] font-extrabold text-on-ink" aria-hidden="true">
                {i + 1}
              </span>
              <span className="text-[14px] font-semibold">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-sm m-0 text-[12px] font-semibold text-ink-mute">
          Your interests: {me.data?.user.interests.length ? me.data.user.interests.join(', ') : 'none yet'}. Pairs that gel include {INTERESTS[0]} with {INTERESTS[1]}, Writing with Video, Music with Dance.
        </p>
      </section>

      <CreateSheet open={creating} onClose={() => setCreating(false)} onDone={() => q.refetch()} />
    </Screen>
  );
}

function EventCard({ e, ready, canMatch, busy, onJoin, onLeave, onMatch }: { e: CircleEvent; ready: boolean; canMatch: boolean; busy: boolean; onJoin: () => void; onLeave: () => void; onMatch: () => void }) {
  const now = useNow();
  const closes = new Date(e.startsAt).getTime() - 36 * 3600_000;
  const open = e.status === 'open' && now < closes;
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 text-[16px] font-bold">{e.title}</p>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            {when(e.startsAt)}, {[e.area, e.city].filter(Boolean).join(', ')}. Tables of {e.groupSize}. {e.signups} signed up.
          </p>
          {e.venueHint && <p className="m-0 text-[14px] font-semibold text-ink-soft">{e.venueHint}</p>}
        </div>
        <span className={`shrink-0 rounded-pill px-xs text-[12px] font-extrabold leading-[20px] ${e.status === 'matched' ? 'bg-r4 text-ink-fixed' : open ? 'bg-paper text-ink-soft' : 'bg-line text-ink'}`}>{e.status === 'matched' ? 'tables set' : open ? `closes in ${countdown(new Date(closes).toISOString(), now)}` : 'closed'}</span>
      </div>
      <div className="mt-xs flex flex-wrap gap-xs">
        {e.myGroupId ? (
          <Link to={`/circles/${e.myGroupId}`} className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
            Your table
          </Link>
        ) : e.joined ? (
          <>
            <span className="inline-flex min-h-[48px] items-center text-[14px] font-bold">You are in. Tables are set two days before.</span>
            {open && (
              <Button variant="ghost" onClick={onLeave} disabled={busy}>
                Leave
              </Button>
            )}
          </>
        ) : open ? (
          <Button onClick={onJoin} disabled={busy || !ready}>
            Join
          </Button>
        ) : null}
        {canMatch && e.status === 'open' && e.signups >= 3 && (
          <Button variant="outline" onClick={onMatch} disabled={busy}>
            Set the tables now
          </Button>
        )}
      </div>
    </li>
  );
}

function CreateSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [venueHint, setVenueHint] = useState('');
  const [groupSize, setGroupSize] = useState('5');
  const create = useMutation({
    mutationFn: () => api.createCircle({ title, city, area, startsAt: new Date(startsAt).toISOString(), venueHint, groupSize: Number(groupSize) || 5 }),
    onSuccess: () => {
      setTitle('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Open a circle">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && city.trim() && startsAt) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="Wednesday creators table" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} required maxLength={80} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Area (optional)</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Starts</span>
            <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">People per table</span>
            <input type="number" min={3} max={8} value={groupSize} onChange={(e) => setGroupSize(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">Venue hint</span>
          <input value={venueHint} onChange={(e) => setVenueHint(e.target.value)} maxLength={200} placeholder="A cafe near the metro; each table picks the exact one" className={field} />
        </label>
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {create.error instanceof Error ? create.error.message : 'Could not open it.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending}>
          Open it
        </Button>
      </form>
    </Sheet>
  );
}

/** One table: who is at it (by alias), the plan, and the chat once it opens. */
export function CircleGroup() {
  const { id = '' } = useParams();
  const q = useAuthed(['circle-group', id], () => api.circleGroup(id));
  const now = useNow();
  const g = q.data?.group;
  const [text, setText] = useState('');
  const [venue, setVenue] = useState('');
  const [plan, setPlan] = useState('');
  const [planning, setPlanning] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const say = useMutation({
    mutationFn: () => api.circleSay(id, text),
    onSuccess: () => {
      setText('');
      void q.refetch();
    },
  });
  const savePlan = useMutation({
    mutationFn: () => api.circlePlan(id, { venue, plan }),
    onSuccess: () => {
      setPlanning(false);
      void q.refetch();
    },
  });
  const reveal = useMutation({ mutationFn: () => api.circleReveal(id), onSuccess: () => q.refetch() });
  const intro = useMutation({ mutationFn: (userId: string) => api.proposeIntro(userId, `We met at ${g?.eventTitle ?? 'a circle'}`) });

  // The chat refreshes itself while it is open.
  useEffect(() => {
    if (!g?.chatOpen) return;
    const t = window.setInterval(() => void q.refetch(), 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.chatOpen, id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [g?.messages.length]);
  useEffect(() => {
    if (g) {
      setVenue(g.venue);
      setPlan(g.plan);
    }
  }, [g?.venue, g?.plan, g]);

  if (q.isError)
    return (
      <Screen>
        <p className="pt-lg font-bold">That table is not yours.</p>
      </Screen>
    );
  if (!g) return null;
  const me = g.members.find((m) => m.isMe);

  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <Link to="/circles" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Circles
        </Link>
        <p className="m-0 text-[14px] font-bold text-ink-soft">
          {g.eventTitle}, {when(g.startsAt)}
        </p>
        <h1 className="text-[30px]">{g.name}</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          You are <span className="font-extrabold text-ink">{g.myAlias}</span> here. {g.chatOpen ? 'The chat is open.' : `The chat opens in ${countdown(g.chatOpensAt, now)}, a day before you meet.`}
        </p>
      </header>

      <section className="mt-md" aria-labelledby="who-heading">
        <h2 id="who-heading" className="text-[18px]">
          At the table
        </h2>
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          {g.members.map((m) => (
            <li key={m.alias} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <Avatar relationship={m.character} size={40} decorative still />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">
                  {m.alias}
                  {m.isMe ? ' (you)' : ''}
                  {m.revealed && m.name ? <span className="font-semibold text-ink-soft"> is {m.name}</span> : ''}
                </span>
                <span className="block truncate text-[14px] font-semibold text-ink-soft">{m.interests.join(', ') || 'interests hidden'}</span>
              </span>
              {m.revealed && m.handle && (
                <Link to={`/u/${m.handle}`} className="shrink-0 text-[14px] font-bold underline-offset-4 hover:underline">
                  Page
                </Link>
              )}
              {m.revealed && !m.isMe && m.userId && (
                <button type="button" onClick={() => intro.mutate(m.userId as string)} disabled={intro.isPending} className="toy toy-soft shrink-0 rounded-pill bg-paper px-sm text-[12px] font-extrabold leading-[32px]">
                  Introduce
                </button>
              )}
            </li>
          ))}
        </ul>
        {intro.isSuccess && <p className="mt-xs m-0 text-[14px] font-bold text-ink-soft">Introduction asked for. If they accept you both hear under Bond.</p>}
        {intro.isError && (
          <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {intro.error instanceof Error ? intro.error.message : 'Could not ask.'}
          </p>
        )}
      </section>

      <section className="mt-md rounded-tile bg-card p-sm shadow-toy-soft" aria-labelledby="plan-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="plan-heading" className="m-0 text-[18px]">
            The plan
          </h2>
          <Button variant="ghost" onClick={() => setPlanning(true)}>
            Edit
          </Button>
        </div>
        <p className="mt-xs m-0 text-[16px] font-bold">{g.venue || 'Where: not decided yet'}</p>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">{g.plan || 'Agree on the exact time and table in the chat, then write it here so everyone sees it.'}</p>
      </section>

      <section className="mt-md" aria-labelledby="chat-heading">
        <h2 id="chat-heading" className="text-[18px]">
          Chat
        </h2>
        {!g.chatOpen && (
          <div className="mt-xs rounded-card border-2 border-dashed border-line p-md text-center">
            <p className="m-0 text-[16px] font-bold">Opens in {countdown(g.chatOpensAt, now)}</p>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{now > new Date(g.chatClosesAt).getTime() ? 'This chat has closed.' : 'Everyone gets the same day to plan, so nobody is waiting on strangers for a week.'}</p>
          </div>
        )}
        {g.chatOpen && (
          <>
            <div className="mt-xs flex max-h-[420px] flex-col gap-xs overflow-y-auto rounded-card bg-paper p-sm">
              {g.messages.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">Nobody has said anything yet. Suggest a place and a time.</p>}
              {g.messages.map((m) => (
                <div key={m.id} className={`max-w-[85%] rounded-card p-sm text-[14px] font-semibold leading-snug ${m.mine ? 'self-end rounded-br-[8px] bg-ink text-on-ink' : 'self-start rounded-bl-[8px] bg-card shadow-toy-soft'}`}>
                  {!m.mine && <span className="block text-[12px] font-extrabold text-ink-mute">{m.alias}</span>}
                  {m.body}
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form
              className="mt-xs flex gap-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) say.mutate();
              }}
            >
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Say something as ${g.myAlias}`} aria-label="Message" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
              <Button type="submit" disabled={say.isPending || !text.trim()}>
                Send
              </Button>
            </form>
            {say.isError && (
              <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
                {say.error instanceof Error ? say.error.message : 'Could not send.'}
              </p>
            )}
            {me && !me.revealed && (
              <div className="mt-md rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[14px] font-bold">Ready to be yourself?</p>
                <p className="m-0 text-[14px] font-semibold text-ink-soft">Revealing posts your name and page to this table only. It cannot be undone.</p>
                <Button variant="outline" className="mt-xs" onClick={() => reveal.mutate()} disabled={reveal.isPending}>
                  Reveal who I am
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <Sheet open={planning} onClose={() => setPlanning(false)} title="The plan">
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            savePlan.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[14px] font-bold">Where</span>
            <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Details</span>
            <textarea value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={500} rows={3} placeholder="7 pm, ask for the table under the alias Quiet Ember" className={field} />
          </label>
          <Button type="submit" size="lg" full disabled={savePlan.isPending}>
            Save for the table
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
