import { ATTENDEE_CODE_MAX, ATTENDEE_CODE_MIN, ATTENDEE_XP_DEFAULT, ATTENDEE_XP_MAX, attendeeXpLocked, BADGES, kmLabel, normalizeCode, paceLabel, RELATIONSHIP_BY_KEY, RUN_BADGES, RUN_PACE_META, RUN_PACES, RUN_REWARD, type Run as RunItem, type RunClub, type RunCollab, type RunCollabApplication, type RunPace, type RunResponse, type RunTracking } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { AreaLine, HBars, StatTile } from '../components/Charts';
import { Hero, HeroNumber } from '../components/Hero';
import { Nudge } from '../components/Nudge';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { shortDay } from '../lib/date';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { useNow } from '../lib/useNow';
import { Pager, usePage } from '../components/Pager';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const REL = RELATIONSHIP_BY_KEY.friendship;
const pill = (tint: string) => ({ background: `var(--tint-${tint})` });

type Tab = 'clubs' | 'tracking' | 'collabs';
const TABS: { key: Tab; label: string }[] = [
  { key: 'clubs', label: 'Clubs' },
  { key: 'tracking', label: 'My runs' },
  { key: 'collabs', label: 'Brand collabs' },
];

function Err({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {e instanceof Error ? e.message : 'That did not work.'}
    </p>
  );
}

function Choice<T extends string>({ options, value, onChange, label }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${value === o.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Giveaway({ giveaway, brand, count }: { giveaway: string; brand?: string; count?: number }) {
  return (
    <span className="inline-flex max-w-full items-center gap-xs rounded-pill px-sm text-[12px] font-extrabold leading-[24px]" style={pill('yellow')}>
      <span aria-hidden="true">🎁</span>
      <span className="truncate">
        {count && count > 0 ? `${count} × ` : ''}
        {giveaway}
        {brand ? `, from ${brand}` : ''}
      </span>
    </span>
  );
}

function ClubCard({ k }: { k: RunClub }) {
  return (
    <li>
      <Link to={`/run/clubs/${k.id}`} className="toy toy-soft flex items-start gap-sm rounded-tile bg-card p-sm">
        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill text-[22px]" style={{ background: `var(--soft-${REL.key})` }} aria-hidden="true">
          🏃
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-xs">
            <span className="text-[16px] font-bold">{k.name}</span>
            {k.host ? (
              <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={pill('green')}>
                You host
              </span>
            ) : k.mine ? (
              <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={pill('green')}>
                Member
              </span>
            ) : null}
          </span>
          <span className="block text-[14px] font-semibold text-ink-soft">
            {k.city}, {RUN_PACE_META[k.pace].name.toLowerCase()}, {k.members} {k.members === 1 ? 'runner' : 'runners'}
          </span>
          <span className="block text-[14px] font-semibold text-ink-soft">{k.nextRunAt ? `Next run ${when(k.nextRunAt)}` : k.meets || 'No run on the calendar yet'}</span>
        </span>
      </Link>
    </li>
  );
}

function stateLine(r: RunItem): string {
  if (r.mine) return `Logged, ${kmLabel(r.mine.metres)}${paceLabel(r.mine.metres, r.mine.minutes) ? `, ${paceLabel(r.mine.metres, r.mine.minutes)}` : ''}`;
  if (r.entryState === 'open') return 'Start code open now';
  if (r.entryState === 'early') return 'Code opens thirty minutes before the start';
  return 'Closed';
}

function UpcomingRow({ r }: { r: RunItem }) {
  return (
    <li>
      <Link to={`/run/clubs/${r.clubId}`} className="toy toy-soft flex items-start gap-sm rounded-tile bg-card p-sm">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">{r.title}</span>
          <span className="block text-[14px] font-semibold text-ink-soft">
            {when(r.startsAt)}, {kmLabel(r.metres)}
            {r.meetingPoint ? `, ${r.meetingPoint}` : ''}
          </span>
          <span className="block text-[14px] font-semibold text-ink-soft">{stateLine(r)}</span>
          {r.collab && (
            <span className="mt-xs block">
              <Giveaway giveaway={r.collab.giveaway} brand={r.collab.brand} />
            </span>
          )}
        </span>
        <span className="shrink-0 text-[14px] font-extrabold">{r.entries} in</span>
      </Link>
    </li>
  );
}

export function Run() {
  const pg = usePage();
  const q = useAuthed(['run', pg.query], () => api.run(pg.query));
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: Tab = TABS.some((t) => t.key === asked) ? (asked as Tab) : 'clubs';
  const setTab = (t: Tab) => setParams(t === 'clubs' ? {} : { tab: t }, { replace: true });
  const [starting, setStarting] = useState(false);
  const d = q.data;
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Kreators Run</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Run clubs near you. The host shows a start code at the line. Enter it and your run is logged once, with kilometres, xp and points.</p>
        <div className="mt-md flex flex-wrap gap-xs" role="group" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${tab === t.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {t.label}
              {t.key === 'collabs' && d && d.collabsOpen > 0 ? ` · ${d.collabsOpen}` : ''}
            </button>
          ))}
        </div>
      </header>

      {q.isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Finding clubs
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load Kreators Run.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && tab === 'clubs' && <ClubsTab d={d} onStart={() => setStarting(true)} />}
      {d && tab === 'tracking' && <TrackingTab t={d.tracking} />}
      {tab === 'collabs' && <CollabsTab />}

      <StartClubSheet open={starting} onClose={() => setStarting(false)} />
    </Screen>
  );
}

function ClubsTab({ d, onStart }: { d: RunResponse; onStart: () => void }) {
  const others = d.clubs.filter((k) => !k.mine);
  return (
    <>
      <Nudge className="mt-sm" text={`A logged run pays the xp its host set (up to ${ATTENDEE_XP_MAX}) and ${RUN_REWARD.points} points, and its minutes count as movement in Life.`} />
      <Button className="mt-md" onClick={onStart}>
        Start a club
      </Button>

      {d.upcoming.length > 0 && (
        <section className="mt-lg" aria-labelledby="run-upcoming">
          <h2 id="run-upcoming" className="text-[24px]">
            Coming up
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.upcoming.map((r) => (
              <UpcomingRow key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}

      {d.mine.length > 0 && (
        <section className="mt-lg" aria-labelledby="run-mine">
          <h2 id="run-mine" className="text-[24px]">
            Your clubs
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.mine.map((k) => (
              <ClubCard key={k.id} k={k} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="run-clubs">
        <h2 id="run-clubs" className="text-[24px]">
          {d.mine.length > 0 ? 'Other clubs' : 'Clubs'}
        </h2>
        {others.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No other clubs yet. Start the first one in your city.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {others.map((k) => (
            <ClubCard key={k.id} k={k} />
          ))}
        </ul>
        <Pager page={d.page} label="clubs" />
      </section>
    </>
  );
}

function TrackingTab({ t }: { t: RunTracking }) {
  const any = t.days.some((d) => d.metres > 0);
  const values = t.days.map((d) => (any ? Math.round(d.metres / 100) / 10 : null));
  const max = Math.max(5, ...values.map((v) => v ?? 0));
  const labels = t.days.map((d) => shortDay(d.date));
  const km = (m: number) => kmLabel(m).replace(' km', '');
  return (
    <>
      <Hero color={REL.color} deep={`var(--deep-${REL.key})`} className="mt-md" character="friendship" characterSize={64} mood={t.monthRuns > 0 ? 'excited' : 'happy'}>
        <HeroNumber value={km(t.monthMetres)} unit="km" label={t.monthRuns === 0 ? 'No runs logged this month yet' : `${t.monthRuns} ${t.monthRuns === 1 ? 'run' : 'runs'} this month`} />
        <p className="mt-sm m-0 text-[14px] font-bold opacity-85">{t.weekStreak > 0 ? `${t.weekStreak} ${t.weekStreak === 1 ? 'week' : 'weeks'} in a row with a run.` : 'Log a run this week to start a weekly streak.'}</p>
      </Hero>

      <div className="mt-md grid grid-cols-2 gap-xs md:grid-cols-4">
        <StatTile label="Runs" value={t.runs} hint="logged with a start code" />
        <StatTile label="Kilometres" value={km(t.metres)} hint="all time" />
        <StatTile label="Minutes" value={t.minutes} hint="count as movement in Life" to="/life" />
        <StatTile label="Week streak" value={t.weekStreak} hint="weeks with a run" />
      </div>

      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="run-line">
        <h2 id="run-line" className="text-[18px]">
          Last thirty days
        </h2>
        <div className="mt-sm">
          <AreaLine values={values} max={max} color={REL.color} label="Kilometres per day over the last thirty days" labels={labels} yFormat={(v) => `${v} km`} empty="No runs in the last thirty days" />
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="run-badges">
        <h2 id="run-badges" className="text-[24px]">
          Run badges
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {(Object.keys(RUN_BADGES) as (keyof typeof RUN_BADGES)[]).map((key) => {
            const b = BADGES.find((x) => x.key === key);
            if (!b) return null;
            const need = RUN_BADGES[key];
            const earned = t.badges.includes(key);
            const have = need.runs > 0 ? t.runs : t.metres;
            const want = need.runs > 0 ? need.runs : need.metres;
            const pct = Math.min(1, have / want);
            return (
              <li key={key} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className={`flex size-[44px] shrink-0 items-center justify-center rounded-pill text-[22px] ${earned ? '' : 'opacity-40 grayscale'}`} style={{ background: `var(--soft-${REL.key})` }} aria-hidden="true">
                  {b.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">{b.name}</span>
                  <span className="block text-[14px] font-semibold text-ink-soft">{earned ? 'Earned' : need.runs > 0 ? `${t.runs} of ${need.runs} runs` : `${kmLabel(t.metres)} of ${kmLabel(need.metres)}`}</span>
                  <span className="mt-xs block h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                    <span className="block h-full rounded-pill" style={{ width: `${Math.round(pct * 100)}%`, background: REL.color }} />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function CollabCard({ k, myClubs, onApply, onChange }: { k: RunCollab; myClubs: RunClub[]; onApply: () => void; onChange: () => void }) {
  const close = useMutation({ mutationFn: () => api.setRunCollab(k.id, 'closed'), onSuccess: onChange });
  const appliedWith = new Set(k.mine.map((a) => a.clubId));
  const canApply = k.status === 'open' && myClubs.some((c) => !appliedWith.has(c.id));
  return (
    <li className="rounded-card bg-card p-md shadow-toy-soft">
      <p className="m-0 text-[14px] font-bold text-ink-soft">
        {k.brand}
        {k.city ? `, ${k.city}` : ''}
        {k.status === 'closed' ? ', closed' : ''}
      </p>
      <h3 className="m-0 text-[20px]">{k.title}</h3>
      <p className="mt-sm m-0">
        <Giveaway giveaway={k.giveaway} count={k.giveawayCount} />
      </p>
      {k.brief && <p className="mt-sm m-0 whitespace-pre-wrap text-[14px] font-semibold">{k.brief}</p>}
      {k.asks && (
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          <span className="text-ink">The brand asks: </span>
          {k.asks}
        </p>
      )}
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
        {day(k.startsAt)} to {day(k.endsAt)}. {k.applications} {k.applications === 1 ? 'club applied' : 'clubs applied'}, {k.accepted} accepted.
      </p>
      {k.mine.length > 0 && (
        <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
          {k.mine.map((a) => (
            <li key={a.id} className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={pill(a.status === 'accepted' ? 'green' : a.status === 'declined' ? 'red' : 'purple')}>
              {a.status === 'accepted' ? 'Accepted' : a.status === 'declined' ? 'Not this time' : 'Applied'}: {a.clubName}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-sm flex flex-wrap gap-xs">
        {canApply && <Button onClick={onApply}>Apply with a club</Button>}
        {k.poster && k.status === 'open' && (
          <Button variant="outline" onClick={() => close.mutate()} disabled={close.isPending}>
            Close collab
          </Button>
        )}
      </div>
      <Err e={close.isError ? close.error : null} />
    </li>
  );
}

function ApplicationRow({ a, onChange }: { a: RunCollabApplication & { collabTitle: string }; onChange: () => void }) {
  const decide = useMutation({ mutationFn: (status: 'accepted' | 'declined') => api.decideRunCollab(a.collabId, a.id, status), onSuccess: onChange });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-[16px] font-bold">
        <Link to={`/run/clubs/${a.clubId}`} className="underline underline-offset-4">
          {a.clubName}
        </Link>{' '}
        <span className="text-[14px] font-semibold text-ink-soft">by {a.hostName}, for {a.collabTitle}</span>
      </p>
      {a.note && <p className="mt-xs m-0 text-[14px] font-semibold">{a.note}</p>}
      <div className="mt-sm flex flex-wrap items-center gap-xs">
        {a.status === 'applied' ? (
          <>
            <Button onClick={() => decide.mutate('accepted')} disabled={decide.isPending}>
              Accept
            </Button>
            <Button variant="outline" onClick={() => decide.mutate('declined')} disabled={decide.isPending}>
              Decline
            </Button>
          </>
        ) : (
          <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={pill(a.status === 'accepted' ? 'green' : 'red')}>
            {a.status === 'accepted' ? 'Accepted' : 'Declined'}
          </span>
        )}
      </div>
      <Err e={decide.isError ? decide.error : null} />
    </li>
  );
}

function CollabsTab() {
  const pg = usePage('c');
  const q = useAuthed(['run-collabs', pg.query], () => api.runCollabs(pg.query));
  const [posting, setPosting] = useState(false);
  const [applying, setApplying] = useState<RunCollab | null>(null);
  const d = q.data;
  return (
    <>
      <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Brands post what they give, what they ask, and a giveaway for the runners. A host applies with the club, and the giveaway shows on the run.</p>
      {d?.canPost && (
        <Button className="mt-md" onClick={() => setPosting(true)}>
          Post a collab
        </Button>
      )}
      {q.isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Finding collabs
        </p>
      )}
      {d && d.collabs.length === 0 && <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">No open collabs right now. They land here when a brand posts one.</p>}
      <ul className="mt-md flex list-none flex-col gap-sm p-0 m-0">
        {d?.collabs.map((k) => (
          <CollabCard key={k.id} k={k} myClubs={d.myClubs} onApply={() => setApplying(k)} onChange={() => q.refetch()} />
        ))}
      </ul>
      <Pager page={d?.page} prefix="c" label="collabs" />
      {d && d.applications.length > 0 && (
        <section className="mt-lg" aria-labelledby="run-apps">
          <h2 id="run-apps" className="text-[24px]">
            Clubs that applied
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.applications.map((a) => (
              <ApplicationRow key={a.id} a={a} onChange={() => q.refetch()} />
            ))}
          </ul>
        </section>
      )}
      <PostCollabSheet open={posting} onClose={() => setPosting(false)} onDone={() => q.refetch()} />
      <ApplySheet collab={applying} clubs={d?.myClubs ?? []} onClose={() => setApplying(null)} onDone={() => q.refetch()} />
    </>
  );
}

function StartClubSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const refresh = useRefreshAll();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [pace, setPace] = useState<RunPace>('all');
  const [meets, setMeets] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const create = useMutation({
    mutationFn: () => api.createRunClub({ name, city, description, pace, meets, visibility }),
    onSuccess: (r) => {
      refresh();
      onClose();
      if (r.club) nav(`/run/clubs/${r.club.id}`);
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Start a run club">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && city.trim()) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">City</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} required className={field} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Pace</legend>
          <Choice label="Pace" options={RUN_PACES.map((p) => ({ key: p, label: RUN_PACE_META[p].name }))} value={pace} onChange={setPace} />
          <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{RUN_PACE_META[pace].blurb}</p>
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">When and where you usually meet</span>
          <input value={meets} onChange={(e) => setMeets(e.target.value)} maxLength={200} placeholder="Sundays 6am, Cubbon Park gate" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">About the club</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} className={field} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Who can find it</legend>
          <Choice
            label="Who can find it"
            options={[
              { key: 'public', label: 'Everyone' },
              { key: 'private', label: 'People with the link' },
            ]}
            value={visibility}
            onChange={setVisibility}
          />
        </fieldset>
        <Err e={create.isError ? create.error : null} />
        <Button type="submit" size="lg" full disabled={create.isPending || !name.trim() || !city.trim()}>
          Start the club
        </Button>
      </form>
    </Sheet>
  );
}

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function PostCollabSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const orgs = me.data?.organizations ?? [];
  const [organizationId, setOrganizationId] = useState<string>(orgs[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brief, setBrief] = useState('');
  const [asks, setAsks] = useState('');
  const [giveaway, setGiveaway] = useState('');
  const [giveawayCount, setGiveawayCount] = useState('');
  const [city, setCity] = useState('');
  const [startsAt, setStartsAt] = useState(local(new Date()));
  const [endsAt, setEndsAt] = useState(local(new Date(Date.now() + 30 * 86_400_000)));
  const post = useMutation({
    mutationFn: () => api.postRunCollab({ title, brandName, organizationId: organizationId || null, brief, asks, giveaway, giveawayCount: Number(giveawayCount) || 0, city, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }),
    onSuccess: () => {
      setTitle('');
      setGiveaway('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Post a brand collab">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && giveaway.trim()) post.mutate();
        }}
      >
        {orgs.length > 0 && (
          <label className="block">
            <span className="block text-[14px] font-bold">Brand</span>
            <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className={field}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
              <option value="">Another brand, by name</option>
            </select>
          </label>
        )}
        {!organizationId && (
          <label className="block">
            <span className="block text-[14px] font-bold">Brand name</span>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={80} className={field} />
          </label>
        )}
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Sunday long run with Stride shoes" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What runners can win</span>
          <input value={giveaway} onChange={(e) => setGiveaway(e.target.value)} maxLength={300} required placeholder="A pair of shoes for the first twenty at the line" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">How many</span>
            <input type="number" min={0} value={giveawayCount} onChange={(e) => setGiveawayCount(e.target.value)} placeholder="Not counted" className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="Anywhere" className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">What the brand gives</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={3000} rows={3} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What the brand asks</span>
          <textarea value={asks} onChange={(e) => setAsks(e.target.value)} maxLength={1000} rows={2} placeholder="A photo at the start line, tagged" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Open from</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Until</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className={field} />
          </label>
        </div>
        <Err e={post.isError ? post.error : null} />
        <Button type="submit" size="lg" full disabled={post.isPending || !title.trim() || !giveaway.trim()}>
          Post the collab
        </Button>
      </form>
    </Sheet>
  );
}

function ApplySheet({ collab, clubs, onClose, onDone }: { collab: RunCollab | null; clubs: RunClub[]; onClose: () => void; onDone: () => void }) {
  const applied = new Set(collab?.mine.map((a) => a.clubId) ?? []);
  const open = clubs.filter((c) => !applied.has(c.id));
  const [clubId, setClubId] = useState('');
  const [note, setNote] = useState('');
  const chosen = open.find((c) => c.id === clubId)?.id ?? open[0]?.id ?? '';
  const apply = useMutation({
    mutationFn: () => api.applyRunCollab(collab?.id ?? '', { clubId: chosen, note }),
    onSuccess: () => {
      setNote('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={Boolean(collab)} onClose={onClose} title={collab ? `Apply: ${collab.title}` : 'Apply'}>
      {collab && (
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (chosen) apply.mutate();
          }}
        >
          <p className="m-0">
            <Giveaway giveaway={collab.giveaway} brand={collab.brand} count={collab.giveawayCount} />
          </p>
          {open.length > 1 && (
            <fieldset className="m-0 border-0 p-0">
              <legend className="text-[14px] font-bold">Which club</legend>
              <Choice label="Which club" options={open.map((c) => ({ key: c.id, label: c.name }))} value={chosen} onChange={setClubId} />
            </fieldset>
          )}
          {open.length === 1 && <p className="m-0 text-[14px] font-bold">Applying with {open[0]?.name}.</p>}
          <label className="block">
            <span className="block text-[14px] font-bold">A note for the brand</span>
            <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="How many run with you, where, and when" className={field} />
          </label>
          <Err e={apply.isError ? apply.error : null} />
          <Button type="submit" size="lg" full disabled={apply.isPending || !chosen}>
            Send the application
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/** The host's own start code and the run's xp. The xp changes until the code opens, thirty minutes before the start; the code any time. */
function RunCodeEditor({ r, onRecode, busy }: { r: RunItem; onRecode: (change: { xp?: number; code?: string }) => void; busy: boolean }) {
  const [xp, setXp] = useState(String(r.xp));
  const [own, setOwn] = useState('');
  const started = attendeeXpLocked(r.startsAt, useNow());
  const box = 'w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
  return (
    <div className="mt-sm flex flex-col gap-xs">
      <div className="grid grid-cols-[1fr_auto] gap-xs">
        <input type="number" inputMode="numeric" min={1} max={ATTENDEE_XP_MAX} value={xp} onChange={(e) => setXp(e.target.value)} disabled={started || busy} aria-label="Xp each runner" className={box} />
        <Button variant="outline" disabled={started || busy || Number(xp) === r.xp || !(Number(xp) >= 1)} onClick={() => onRecode({ xp: Number(xp) })}>
          Set xp
        </Button>
      </div>
      {started && <p className="m-0 text-[12px] font-semibold text-ink-soft">The xp is fixed: the code is open.</p>}
      <div className="grid grid-cols-[1fr_auto] gap-xs">
        <input value={own} onChange={(e) => setOwn(normalizeCode(e.target.value))} maxLength={ATTENDEE_CODE_MAX} placeholder="Your own code" aria-label="Your own code" autoCapitalize="characters" disabled={busy} className={`${box} uppercase placeholder:normal-case`} />
        <Button
          variant="outline"
          disabled={busy || own.length < ATTENDEE_CODE_MIN}
          onClick={() => {
            onRecode({ code: own });
            setOwn('');
          }}
        >
          Use it
        </Button>
      </div>
    </div>
  );
}

function RunCard({ r, host, member, onLog, onRecode, onStatus, busy }: { r: RunItem; host: boolean; member: boolean; onLog: () => void; onRecode: (change?: { xp?: number; code?: string }) => void; onStatus: (s: 'cancelled' | 'done') => void; busy: boolean }) {
  return (
    <li className="rounded-card bg-card p-md shadow-toy-soft">
      <p className="m-0 text-[16px] font-bold">{r.title}</p>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">
        {when(r.startsAt)} to {new Date(r.endsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}, {kmLabel(r.metres)}
        {r.meetingPoint ? `, ${r.meetingPoint}` : ''}
      </p>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
        {r.entries} {r.entries === 1 ? 'runner logged' : 'runners logged'}. {stateLine(r)}.
      </p>
      {r.collab && (
        <p className="mt-sm m-0">
          <Giveaway giveaway={r.collab.giveaway} brand={r.collab.brand} />
        </p>
      )}
      {host && r.code && (
        <div className="mt-sm rounded-tile p-sm" style={pill('green')}>
          <div className="flex items-start justify-between gap-sm">
            <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Start code</p>
            <p className="m-0 shrink-0 rounded-pill bg-card px-sm py-xs text-[14px] font-extrabold">+{r.xp} xp each</p>
          </div>
          <p className="m-0 font-display text-[40px] font-extrabold leading-none tracking-[0.2em] break-all">{r.code}</p>
          <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Show this at the start line. It works from thirty minutes before the start until three hours after the end, once per runner. You do not log your own run.</p>
          <RunCodeEditor r={r} onRecode={onRecode} busy={busy} />
        </div>
      )}
      <div className="mt-sm flex flex-wrap gap-xs">
        {/* Whoever is shown the code (the host, the team) shows it; they never log the run. */}
        {member && !r.mine && !r.code && r.entryState === 'open' && (
          <Button onClick={onLog} disabled={busy}>
            Enter the start code
          </Button>
        )}
        {host && (
          <>
            <Button variant="outline" onClick={() => onRecode()} disabled={busy}>
              New random code
            </Button>
            <Button variant="outline" onClick={() => onStatus('done')} disabled={busy}>
              Mark done
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm('Cancel this run and tell the club?')) onStatus('cancelled');
              }}
              disabled={busy}
            >
              Cancel run
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function EntrySheet({ run, onClose, onDone }: { run: RunItem | null; onClose: () => void; onDone: (r: { xp: number; points: number; capped: boolean; newBadges: string[] }) => void }) {
  const [code, setCode] = useState('');
  const [km, setKm] = useState('');
  const [minutes, setMinutes] = useState('');
  const planned = run ? Math.round(run.metres / 100) / 10 : 5;
  const log = useMutation({
    mutationFn: () => api.logRun(run?.id ?? '', { code, metres: Math.round((Number(km) || planned) * 1000), minutes: Number(minutes) || 0 }),
    onSuccess: (r) => {
      setCode('');
      setKm('');
      setMinutes('');
      onDone(r);
      onClose();
    },
  });
  return (
    <Sheet open={Boolean(run)} onClose={onClose} title="Log this run">
      {run && (
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length >= ATTENDEE_CODE_MIN) log.mutate();
          }}
        >
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{run.title}. The host shows the start code at the line.</p>
          <label className="block">
            <span className="block text-[14px] font-bold">Start code</span>
            <input autoFocus value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} maxLength={ATTENDEE_CODE_MAX} autoCapitalize="characters" autoComplete="off" spellCheck={false} required className={`${field} font-display text-[28px] font-extrabold tracking-[0.2em]`} />
          </label>
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-[14px] font-bold">Kilometres</span>
              <input type="number" min={0} max={100} step={0.1} value={km} onChange={(e) => setKm(e.target.value)} placeholder={String(planned)} className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Minutes</span>
              <input type="number" min={0} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Optional" className={field} />
            </label>
          </div>
          <Nudge text={`Logs once per run. ${run?.xp ?? RUN_REWARD.xp} xp and ${RUN_REWARD.points} points, up to ${RUN_REWARD.perDay} runs a day. Minutes count as movement in Life.`} />
          <Err e={log.isError ? log.error : null} />
          <Button type="submit" size="lg" full disabled={log.isPending || code.length < ATTENDEE_CODE_MIN}>
            Log my run
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function AddRunSheet({ open, clubId, collabs, onClose, onDone }: { open: boolean; clubId: string; collabs: RunCollab[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [km, setKm] = useState('5');
  const [collabId, setCollabId] = useState('');
  const [xp, setXp] = useState(String(ATTENDEE_XP_DEFAULT));
  const [own, setOwn] = useState('');
  // A run added after its start keeps its code but pays the usual xp; the sheet says so instead of closing.
  const [late, setLate] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => api.addRun(clubId, { title, startsAt: new Date(startsAt).toISOString(), minutes: Number(minutes) || 60, meetingPoint, metres: Math.round((Number(km) || 5) * 1000), collabId: collabId || null, xp: Number(xp) || ATTENDEE_XP_DEFAULT, ...(own ? { code: own } : {}) }),
    onSuccess: (r) => {
      setTitle('');
      setStartsAt('');
      onDone();
      if (r.codeError) setLate(`The run is up. ${r.codeError}`);
      else onClose();
    },
  });
  return (
    <Sheet
      open={open}
      onClose={() => {
        setLate(null);
        onClose();
      }}
      title="Add a run"
    >
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (startsAt) add.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Sunday long run" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Starts</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Minutes</span>
            <input type="number" min={10} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Kilometres</span>
            <input type="number" min={0.1} max={100} step={0.1} value={km} onChange={(e) => setKm(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Meeting point</span>
            <input value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} maxLength={200} className={field} />
          </label>
        </div>
        {collabs.length > 0 && (
          <label className="block">
            <span className="block text-[14px] font-bold">Brand collab</span>
            <select value={collabId} onChange={(e) => setCollabId(e.target.value)} className={field}>
              <option value="">None</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}: {c.giveaway}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Xp for each runner</span>
            <input type="number" inputMode="numeric" min={1} max={ATTENDEE_XP_MAX} value={xp} onChange={(e) => setXp(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Your own code</span>
            <input value={own} onChange={(e) => setOwn(normalizeCode(e.target.value))} maxLength={ATTENDEE_CODE_MAX} placeholder="Random" autoCapitalize="characters" className={`${field} uppercase placeholder:normal-case`} />
          </label>
        </div>
        <p className="m-0 text-[12px] font-bold text-ink-soft">Up to {ATTENDEE_XP_MAX} xp, fixed thirty minutes before the start, when the code opens. You get a start code (six letters, or your own word) that only you see. Members log the run by entering it at the line.</p>
        {late && (
          <p role="status" className="m-0 rounded-tile bg-r3/30 p-sm text-[14px] font-bold">
            {late}
          </p>
        )}
        <Err e={add.isError ? add.error : null} />
        <Button type="submit" size="lg" full disabled={add.isPending || !startsAt}>
          Add the run
        </Button>
      </form>
    </Sheet>
  );
}

export function RunClubPage() {
  const { id = '' } = useParams();
  const q = useAuthed(['run-club', id], () => api.runClub(id));
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState<RunItem | null>(null);
  const after = () => {
    refresh();
    q.refetch();
  };
  const join = useMutation({ mutationFn: () => api.joinRunClub(id), onSuccess: after });
  const leave = useMutation({ mutationFn: () => api.leaveRunClub(id), onSuccess: after });
  const close = useMutation({ mutationFn: () => api.setRunClub(id, { status: 'closed' }), onSuccess: after });
  const recode = useMutation({ mutationFn: (v: { runId: string; change?: { xp?: number; code?: string } }) => api.recodeRun(v.runId, v.change ?? {}), onSuccess: () => q.refetch() });
  const setRun = useMutation({ mutationFn: (v: { runId: string; status: 'cancelled' | 'done' }) => api.setRun(v.runId, v.status), onSuccess: after });
  const voidEntry = useMutation({ mutationFn: (entryId: string) => api.voidRunEntry(entryId), onSuccess: after });

  if (q.isError) {
    return (
      <Screen>
        <header className="pt-lg">
          <BackLink to="/run">Kreators Run</BackLink>
          <h1 className="text-[30px]">No such club</h1>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{q.error instanceof Error ? q.error.message : 'This club is gone or was never here.'}</p>
        </header>
      </Screen>
    );
  }
  const d = q.data;
  if (!d) return null;
  const k = d.club;
  const maxMetres = Math.max(1, ...d.board.map((b) => b.metres));
  const busy = recode.isPending || setRun.isPending;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/run">Kreators Run</BackLink>
        <p className="m-0 text-[14px] font-bold text-ink-soft">
          <span aria-hidden="true">🏃 </span>
          {k.city}, {RUN_PACE_META[k.pace].name.toLowerCase()}, hosted by {k.hostName}
          {k.status === 'closed' ? ', closed' : ''}
        </p>
        <h1 className="text-[30px]">{k.name}</h1>
        {k.meets && <p className="mt-xs m-0 text-[16px] font-semibold">{k.meets}</p>}
        {k.description && <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold text-ink-soft">{k.description}</p>}
        <div className="mt-sm flex flex-wrap items-center gap-xs">
          <span className="rounded-pill bg-card px-xs text-[12px] font-extrabold leading-[20px] shadow-toy-soft">
            {k.members} {k.members === 1 ? 'runner' : 'runners'}
          </span>
          {k.visibility === 'private' && (
            <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={pill('purple')}>
              Private
            </span>
          )}
          {k.host && (
            <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={pill('green')}>
              You host this
            </span>
          )}
        </div>
        <div className="mt-md flex flex-wrap gap-xs">
          {!k.mine && k.status === 'active' && (
            <Button onClick={() => join.mutate()} disabled={join.isPending}>
              Join the club
            </Button>
          )}
          {k.mine && !k.host && (
            <Button variant="outline" onClick={() => leave.mutate()} disabled={leave.isPending}>
              Leave
            </Button>
          )}
          {k.host && k.status === 'active' && (
            <>
              <Button onClick={() => setAdding(true)}>Add a run</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm('Close this club? Runs and entries stay, nobody can join.')) close.mutate();
                }}
                disabled={close.isPending}
              >
                Close the club
              </Button>
            </>
          )}
        </div>
        <Err e={join.isError ? join.error : leave.isError ? leave.error : close.isError ? close.error : null} />
      </header>

      <section className="mt-lg" aria-labelledby="club-runs">
        <h2 id="club-runs" className="text-[24px]">
          Next runs
        </h2>
        {d.runs.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{k.host ? 'No run on the calendar. Add one and you get its start code.' : 'No run on the calendar yet. The host adds them here.'}</p>}
        <Err e={recode.isError ? recode.error : setRun.isError ? setRun.error : null} />
        <ul className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
          {d.runs.map((r) => (
            <RunCard key={r.id} r={r} host={k.host} member={k.mine} onLog={() => setLogging(r)} onRecode={(change) => recode.mutate({ runId: r.id, change })} onStatus={(status) => setRun.mutate({ runId: r.id, status })} busy={busy} />
          ))}
        </ul>
      </section>

      {d.collabs.length > 0 && (
        <section className="mt-lg" aria-labelledby="club-collabs">
          <h2 id="club-collabs" className="text-[24px]">
            Brand collabs
          </h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">What runners can win at the next collab run.</p>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.collabs.map((c) => (
              <li key={c.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[16px] font-bold">
                  {c.title} <span className="text-[14px] font-semibold text-ink-soft">by {c.brand}</span>
                </p>
                <p className="mt-xs m-0">
                  <Giveaway giveaway={c.giveaway} count={c.giveawayCount} />
                </p>
                {c.asks && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">The brand asks: {c.asks}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="club-board">
        <h2 id="club-board" className="text-[18px]">
          This month
        </h2>
        {d.board.length === 0 ? (
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nobody has logged a run this month yet.</p>
        ) : (
          <div className="mt-sm">
            <HBars label="Kilometres this month per runner" rows={d.board.map((b) => ({ key: b.userId, label: b.name, value: b.metres / maxMetres, text: kmLabel(b.metres), color: REL.color }))} />
          </div>
        )}
      </section>

      {k.host && d.entries.length > 0 && (
        <section className="mt-lg" aria-labelledby="club-entries">
          <h2 id="club-entries" className="text-[24px]">
            Entries
          </h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Every entry logged with a start code. Void one that should not be there and its points come back out.</p>
          <Err e={voidEntry.isError ? voidEntry.error : null} />
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">{e.name}</span>
                  <span className="block text-[14px] font-semibold text-ink-soft">
                    {when(e.loggedAt)}, {kmLabel(e.metres)}
                    {e.minutes > 0 ? `, ${e.minutes} min` : ''}
                    {e.status === 'void' ? ', voided' : ''}
                  </span>
                </span>
                {e.status === 'logged' && (
                  <Button variant="outline" className="shrink-0" onClick={() => voidEntry.mutate(e.id)} disabled={voidEntry.isPending}>
                    Void
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.past.length > 0 && (
        <section className="mt-lg" aria-labelledby="club-past">
          <h2 id="club-past" className="text-[24px]">
            Past runs
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.past.map((r) => (
              <li key={r.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="block text-[16px] font-bold">{r.title}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">
                  {when(r.startsAt)}, {kmLabel(r.metres)}, {r.entries} {r.entries === 1 ? 'runner' : 'runners'}
                  {r.status !== 'published' ? `, ${r.status}` : ''}
                  {r.mine ? `, you ran ${kmLabel(r.mine.metres)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AddRunSheet open={adding} clubId={id} collabs={d.collabs} onClose={() => setAdding(false)} onDone={after} />
      <EntrySheet
        run={logging}
        onClose={() => setLogging(null)}
        onDone={(r) => {
          celebrate({ title: r.capped ? 'Run logged. Two runs already paid today, so this one was for you' : 'Run logged', totalXp: r.xp, points: r.points, newBadges: r.newBadges, color: REL.color });
          after();
        }}
      />
    </Screen>
  );
}
