import { ATTENDEE_CODE_MAX, ATTENDEE_CODE_MIN, ATTENDEE_XP_DEFAULT, ATTENDEE_XP_MAX, attendeeXpLocked, BADGES, kmLabel, normalizeCode, paceLabel, RELATIONSHIP_BY_KEY, RUN_BADGES, RUN_PACE_META, RUN_PACES, RUN_REWARD, type Run as RunItem, type RunClub, type RunCollab, type RunCollabApplication, type RunPace, type RunResponse, type RunTracking, type TagTone } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Footprints, Gift } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Icon } from '../components/Icon';
import { EventPanel } from '../components/EventPanel';
import { Dot } from '../components/Channels';
import { RunDiscussions, useRunTalksUnread } from '../components/RunDiscussions';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { BadgeMedal } from '../components/BadgeArt';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { AreaLine, HBars, StatTile } from '../components/Charts';
import { Nudge } from '../components/Nudge';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { api } from '../lib/api';
import { shortDay, eventTime, clockTime, shortDate } from '../lib/date';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { useNow } from '../lib/useNow';
import { Pager, usePage } from '../components/Pager';
import { FIELD, FIELD_LINE } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { StatusTag } from '../components/StatusTag';
import { CardHead } from '../components/CardHead';
import { FactTag, IconTag } from '../components/FactTag';
import { useSeedOnce } from '../lib/useSeed';
import { RowCard } from '../components/RowCard';
import { Reveal } from '../components/fx/Reveal';
import { ToggleChevron } from '../components/ToggleMark';
import { RunMoveTool } from '../components/RunMoveTool';
import { StickyAction } from '../components/StickyAction';

const day = shortDate;
const REL = RELATIONSHIP_BY_KEY.friendship;
const pill = (tint: string) => ({ background: `var(--tint-${tint})` });
const TINT_TONE: Record<'green' | 'red' | 'yellow' | 'purple' | 'sky', TagTone> = { green: 'good', red: 'bad', yellow: 'warn', purple: 'deep', sky: 'info' };

type Tab = 'clubs' | 'tracking' | 'collabs' | 'talk';
const TABS: { key: Tab; label: string }[] = [
  { key: 'clubs', label: 'Clubs' },
  { key: 'tracking', label: 'My runs' },
  { key: 'collabs', label: 'Brand collabs' },
  { key: 'talk', label: 'Discussions' },
];


function Choice<T extends string>({ options, value, onChange, label, even = false }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; /** A few equal choices: the full width in equal parts, two by two where the sheet is narrow (as PeriodFilter). */ even?: boolean }) {
  const pills = (
    <div className={even ? `grid gap-xs ${options.length === 4 ? 'grid-cols-4 @max-[23rem]:grid-cols-2' : 'grid-cols-2'}` : 'mt-xs flex flex-wrap gap-xs'} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)} className={`toy min-h-[36px] md:min-h-[44px] tap-pad min-w-0 rounded-pill border-2 px-sm py-0 md:py-xs text-subhead font-medium ${value === o.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
  return even ? <div className="@container mt-xs">{pills}</div> : pills;
}

function Giveaway({ giveaway, brand, count }: { giveaway: string; brand?: string; count?: number }) {
  return (
    <span className="inline-flex max-w-full items-center gap-xs rounded-inner px-sm text-caption font-medium leading-[24px]" style={pill('yellow')}>
      <Icon icon={Gift} size={14} className="shrink-0" />
      <span className="min-w-0 text-balance">
        {count && count > 0 ? `${count} × ` : ''}
        {giveaway}
        {brand ? `, from ${brand}` : ''}
      </span>
    </span>
  );
}

function ClubCard({ k, index = 0 }: { k: RunClub; index?: number }) {
  // The footprints and the name at the top left, the person's place in the club in the corner of every card (You host, Member or
  // Open), the city, the pace, the runners and the next run as tags at the foot, and the arrow at the bottom right.
  return (
    <Reveal as="li" index={index} className="flex">
      <RowCard
        to={`/run/clubs/${k.id}`}
        lead={
          <span className="flex size-[44px] items-center justify-center rounded-pill" style={{ background: `var(--soft-${REL.key})` }} aria-hidden="true">
            <Icon icon={Footprints} size={22} />
          </span>
        }
        title={k.name}
        corner={<StatusTag tone={k.host || k.mine ? TINT_TONE['green'] : 'neutral'} fit>{k.host ? 'You host' : k.mine ? 'Member' : 'Open'}</StatusTag>}
        facts={[
          <FactTag key="city" kind="place">{k.city}</FactTag>,
          <FactTag key="pace" kind="category">{RUN_PACE_META[k.pace].name}</FactTag>,
          <FactTag key="runners" kind="availability">{`${k.members} ${k.members === 1 ? 'runner' : 'runners'}`}</FactTag>,
          <FactTag key="next" kind="when">{k.nextRunAt ? `Next run ${eventTime(k.nextRunAt)}` : k.meets || 'No run on the calendar yet'}</FactTag>,
        ]}
      />
    </Reveal>
  );
}

function stateLine(r: RunItem): string {
  if (r.mine) return `Logged, ${kmLabel(r.mine.metres)}${paceLabel(r.mine.metres, r.mine.minutes) ? `, ${paceLabel(r.mine.metres, r.mine.minutes)}` : ''}`;
  if (r.entryState === 'open') return 'Start code open now';
  if (r.entryState === 'early') return 'Code opens thirty minutes before the start';
  return 'Closed';
}

function UpcomingRow({ r, index = 0 }: { r: RunItem; index?: number }) {
  // The run at the top left, how many are in at the top right of every row, the day, distance, meeting point, the code's state and
  // any giveaway as tags at the foot, and the arrow at the bottom right.
  return (
    <Reveal as="li" index={index} className="flex">
      <RowCard
        to={`/run/clubs/${r.clubId}`}
        title={r.title}
        corner={<StatusTag tone="neutral">{`${r.entries} in`}</StatusTag>}
        facts={[
          <FactTag key="when" kind="when">{eventTime(r.startsAt)}</FactTag>,
          <FactTag key="km" kind="category">{kmLabel(r.metres)}</FactTag>,
          r.meetingPoint ? <FactTag key="where" kind="place">{r.meetingPoint}</FactTag> : null,
          <FactTag key="state" kind="status">{stateLine(r)}</FactTag>,
          r.collab ? <Giveaway key="gift" giveaway={r.collab.giveaway} brand={r.collab.brand} /> : null,
        ]}
      />
    </Reveal>
  );
}

export function Run() {
  const pg = usePage();
  const q = useAuthed(['run', pg.query], () => api.run(pg.query));
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: Tab = TABS.some((t) => t.key === asked) ? (asked as Tab) : 'clubs';
  const setTab = (t: Tab) => setParams(t === 'clubs' ? {} : { tab: t }, { replace: true, preventScrollReset: true });
  const [starting, setStarting] = useState(false);
  const unread = useRunTalksUnread();
  const d = q.data;
  return (
    <Screen>
      <AppCover back={{ to: '/apps', label: 'Apps' }} title="Kreators Run" lede="Run clubs near you. Enter the host’s start code and your run is logged once." />

      {/* Under the hero: the sections on the left and Start a club at the right of the same line. On a phone the four sections
          sit two by two (none alone on a line) and the button takes its own line under them. The line about pay sits under both. */}
      <div className="mt-md flex flex-wrap items-center justify-between gap-sm">
        <div className="grid w-full grid-cols-2 gap-xs sm:flex sm:w-auto sm:min-w-0 sm:flex-wrap" role="group" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)} className={`toy inline-flex min-h-[36px] md:min-h-[44px] tap-pad items-center justify-center rounded-pill border-2 px-sm py-0 md:py-xs text-subhead font-medium ${tab === t.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {t.label}
              {t.key === 'collabs' && d && d.collabsOpen > 0 ? ` · ${d.collabsOpen}` : ''}
              {t.key === 'talk' && tab !== 'talk' && <Dot n={unread} />}
            </button>
          ))}
        </div>
        <Button className="max-sm:w-full" onClick={() => setStarting(true)}>
          Start a club
        </Button>
      </div>
      <Nudge className="mt-sm" text={`A run pays its host’s xp (up to ${ATTENDEE_XP_MAX}) and ${RUN_REWARD.points} points. Minutes count as movement.`} />

      {q.isPending && (
        <p className="mt-md text-subhead text-ink-soft" role="status">
          Finding clubs
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load Kreators Run.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && tab === 'clubs' && <ClubsTab d={d} />}
      {d && tab === 'tracking' && <TrackingTab t={d.tracking} />}
      {tab === 'collabs' && <CollabsTab />}
      {tab === 'talk' && <RunDiscussions />}

      <StartClubSheet open={starting} onClose={() => setStarting(false)} />
    </Screen>
  );
}

function ClubsTab({ d }: { d: RunResponse }) {
  const others = d.clubs.filter((k) => !k.mine);
  return (
    <>
      {d.upcoming.length > 0 && (
        <section className="mt-lg" aria-labelledby="run-upcoming">
          <h2 id="run-upcoming" className="text-title2">
            Coming up
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.upcoming.map((r, i) => (
              <UpcomingRow key={r.id} r={r} index={i} />
            ))}
          </ul>
        </section>
      )}

      {d.mine.length > 0 && (
        <section className="mt-lg" aria-labelledby="run-mine">
          <h2 id="run-mine" className="text-title2">
            Your clubs
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.mine.map((k, i) => (
              <ClubCard key={k.id} k={k} index={i} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="run-clubs">
        <h2 id="run-clubs" className="text-title2">
          {d.mine.length > 0 ? 'Other clubs' : 'Clubs'}
        </h2>
        {others.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">No other clubs yet. Start the first one in your city.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {others.map((k, i) => (
            <ClubCard key={k.id} k={k} index={i} />
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
      {/* The run-or-walk tool (2026-11-07): logged on your own, apart from club entries, and paying nothing. The tiles under it are club runs only. */}
      <RunMoveTool />
      {/* Run wears the app cover, so the month's numbers sit in the tiles rather than a coloured hero (one or the other, never both). */}
      <h2 className="mt-lg text-title2">Club runs</h2>
      <div className="mt-sm grid grid-cols-2 gap-xs md:grid-cols-3">
        <StatTile label="Km this month" value={km(t.monthMetres)} hint="since the 1st" />
        <StatTile label="Runs this month" value={t.monthRuns} hint={t.monthRuns === 0 ? 'none logged yet' : 'since the 1st'} />
        <StatTile label="Runs" value={t.runs} hint="logged with a start code" />
        <StatTile label="Kilometres" value={km(t.metres)} hint="all time" />
        <StatTile label="Minutes" value={t.minutes} hint="count as movement in Life" to="/life" />
        <StatTile label="Week streak" value={t.weekStreak} hint={t.weekStreak > 0 ? 'weeks in a row with a run' : 'log a run this week to start one'} />
      </div>

      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="run-line">
        <h2 id="run-line" className="text-title3">
          Last thirty days
        </h2>
        <div className="mt-sm">
          <AreaLine values={values} max={max} color={REL.color} label="Kilometres per day over the last thirty days" labels={labels} yFormat={(v) => `${v} km`} empty="No runs in the last thirty days" />
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="run-badges">
        <h2 id="run-badges" className="text-title2">
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
                <BadgeMedal k={key} earned={earned} size="sm" decorative />
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">{b.name}</span>
                  <span className="block text-card-note text-ink-soft">{earned ? 'Earned' : need.runs > 0 ? `${t.runs} of ${need.runs} runs` : `${kmLabel(t.metres)} of ${kmLabel(need.metres)}`}</span>
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
  // Closing the collab asks first.
  const [closing, setClosing] = useState(false);
  const close = useMutation({
    mutationFn: () => api.setRunCollab(k.id, 'closed'),
    onSuccess: () => {
      setClosing(false);
      onChange();
    },
  });
  const appliedWith = new Set(k.mine.map((a) => a.clubId));
  const canApply = k.status === 'open' && myClubs.some((c) => !appliedWith.has(c.id));
  // The brand and the title at the top left, Open or Closed in the corner, the brief under them, the giveaway, the dates and the
  // counts lined up at the foot, and the actions at the bottom right.
  return (
    <li className="flex h-full flex-col rounded-card bg-card p-md shadow-toy-soft">
      <CardHead tag={<StatusTag tone={k.status === 'open' ? 'good' : 'neutral'}>{k.status === 'open' ? 'Open' : 'Closed'}</StatusTag>}>
        <p className="m-0 text-subhead text-ink-soft">
          {k.brand}
          {k.city ? `, ${k.city}` : ''}
        </p>
        <h3 className="m-0 text-balance text-card-title">{k.title}</h3>
      </CardHead>
      {k.brief && <p className="mt-sm m-0 whitespace-pre-wrap text-card-prose">{k.brief}</p>}
      {k.asks && (
        <p className="mt-xs m-0 text-card-note text-ink-soft">
          <span className="text-ink">The brand asks: </span>
          {k.asks}
        </p>
      )}
      <div className="mt-auto flex pt-sm">
        <span className="fill-row-all flex min-w-0 flex-wrap gap-xs">
          <Giveaway giveaway={k.giveaway} count={k.giveawayCount} />
          <FactTag kind="when">{`${day(k.startsAt)} to ${day(k.endsAt)}`}</FactTag>
          <FactTag kind="availability">{`${k.applications} ${k.applications === 1 ? 'club applied' : 'clubs applied'}, ${k.accepted} accepted`}</FactTag>
          {k.mine.map((a) => (
            <StatusTag key={a.id} tone={TINT_TONE[a.status === 'accepted' ? 'green' : a.status === 'declined' ? 'red' : 'purple']}>
              {`${a.status === 'accepted' ? 'Accepted' : a.status === 'declined' ? 'Not this time' : 'Applied'}: ${a.clubName}`}
            </StatusTag>
          ))}
        </span>
      </div>
      {(canApply || (k.poster && k.status === 'open')) && (
        <div className="mt-sm flex flex-wrap justify-end gap-xs">
          {k.poster && k.status === 'open' && (
            <Button
              variant="outline"
              onClick={() => {
                close.reset();
                setClosing(true);
              }}
              disabled={close.isPending}
            >
              Close collab
            </Button>
          )}
          {canApply && <Button variant="outline" onClick={onApply}>Apply with a club</Button>}
        </div>
      )}
      <ConfirmDelete
        open={closing}
        title="Close this collab?"
        body={`"${k.title}". No club can apply after this, and it cannot be opened again here.`}
        pending={close.isPending}
        failed={close.isError}
        onYes={() => close.mutate()}
        onClose={() => setClosing(false)}
        yes="Yes, close it"
      />
    </li>
  );
}

function ApplicationRow({ a, onChange }: { a: RunCollabApplication & { collabTitle: string }; onChange: () => void }) {
  const decide = useMutation({ mutationFn: (status: 'accepted' | 'declined') => api.decideRunCollab(a.collabId, a.id, status), onSuccess: onChange });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-card-title">
        <Link to={`/run/clubs/${a.clubId}`} className="underline underline-offset-4">
          {a.clubName}
        </Link>{' '}
        <span className="text-subhead text-ink-soft">by {a.hostName}, for {a.collabTitle}</span>
      </p>
      {a.note && <p className="mt-xs m-0 whitespace-pre-wrap text-card-prose">{a.note}</p>}
      <div className="mt-sm flex flex-wrap items-center gap-xs">
        {a.status === 'applied' ? (
          <>
            <Button variant="outline" onClick={() => decide.mutate('accepted')} disabled={decide.isPending}>
              Accept
            </Button>
            <Button variant="outline" onClick={() => decide.mutate('declined')} disabled={decide.isPending}>
              Decline
            </Button>
          </>
        ) : (
          <StatusTag tone={TINT_TONE[a.status === 'accepted' ? 'green' : 'red']}>
            {a.status === 'accepted' ? 'Accepted' : 'Declined'}
          </StatusTag>
        )}
      </div>
      <ErrorLine e={decide.isError ? decide.error : null} />
    </li>
  );
}

function CollabsTab() {
  const pg = usePage('c');
  const apg = usePage('a');
  const q = useAuthed(['run-collabs', pg.query, apg.query], () => api.runCollabs(`${pg.query}&${apg.query}`));
  const [posting, setPosting] = useState(false);
  const [applying, setApplying] = useState<RunCollab | null>(null);
  const d = q.data;
  return (
    <>
      <p className="mt-md m-0 text-subhead text-ink-soft">Brands post a giveaway for runners. A host applies, and it shows on the run.</p>
      {/* A lone add button: the full width in a row under 34rem (a phone), its own width from there up (as New document). */}
      {d?.canPost && (
        <div className="@container mt-md">
          <Button variant="outline" className="w-full @min-[34rem]:w-auto" onClick={() => setPosting(true)}>
            Post a collab
          </Button>
        </div>
      )}
      {q.isPending && (
        <p className="mt-md text-subhead text-ink-soft" role="status">
          Finding collabs
        </p>
      )}
      {d && d.collabs.length === 0 && <p className="mt-md m-0 text-subhead text-ink-soft">No open collabs right now. They land here when a brand posts one.</p>}
      <ul className="mt-md flex list-none flex-col gap-sm p-0 m-0">
        {d?.collabs.map((k) => (
          <CollabCard key={k.id} k={k} myClubs={d.myClubs} onApply={() => setApplying(k)} onChange={() => q.refetch()} />
        ))}
      </ul>
      <Pager page={d?.page} prefix="c" label="collabs" />
      {d && d.applications.length > 0 && (
        <section className="mt-lg" aria-labelledby="run-apps">
          <h2 id="run-apps" className="text-title2">
            Clubs that applied
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.applications.map((a) => (
              <ApplicationRow key={a.id} a={a} onChange={() => q.refetch()} />
            ))}
          </ul>
          <Pager page={d.applicationPage} prefix="a" label="applications" />
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
  const me = useMe();
  const [name, setName] = useState('');
  // The club's city starts as the person's own, from Profile; they can change it for this club.
  const [city, setCity] = useState(me.data?.user.city ?? '');
  useSeedOnce(me.data?.user, (u) => setCity((c) => c || u.city));
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
          <span className="block text-subhead font-semibold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={FIELD} />
          <p className="mt-xs m-0 text-caption text-ink-soft">You cannot change the name later.</p>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">City</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} required className={FIELD} />
          <p className="mt-xs m-0 text-caption text-ink-soft">Starts as your Profile city. It cannot change later.</p>
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Pace</legend>
          <Choice even label="Pace" options={RUN_PACES.map((p) => ({ key: p, label: RUN_PACE_META[p].name }))} value={pace} onChange={setPace} />
          <p className="mt-xs m-0 text-caption text-ink-soft">{RUN_PACE_META[pace].blurb}</p>
        </fieldset>
        <label className="block">
          <span className="block text-subhead">When and where you usually meet</span>
          <input value={meets} onChange={(e) => setMeets(e.target.value)} maxLength={200} placeholder="Sundays 6am, Cubbon Park gate" className={FIELD} />
          <p className="mt-xs m-0 text-caption text-ink-soft">Runners see this at the top of the club page.</p>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">About the club</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} className={FIELD} />
          <p className="mt-xs m-0 text-caption text-ink-soft">A few lines on who the club is for.</p>
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Who can find it</legend>
          <Choice
            even
            label="Who can find it"
            options={[
              { key: 'public', label: 'Everyone' },
              { key: 'private', label: 'People with the link' },
            ]}
            value={visibility}
            onChange={setVisibility}
          />
          <p className="mt-xs m-0 text-caption text-ink-soft">{visibility === 'public' ? 'It shows in the clubs list for everyone.' : 'It stays out of the list. Share its link to invite people.'}</p>
        </fieldset>
        <ErrorLine e={create.isError ? create.error : null} />
        <StickyAction>
          <Button type="submit" size="lg" full disabled={create.isPending || !name.trim() || !city.trim()}>
            Start the club
          </Button>
        </StickyAction>
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
            <span className="block text-subhead font-semibold">Brand</span>
            <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className={FIELD}>
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
            <span className="block text-subhead font-semibold">Brand name</span>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={80} className={FIELD} />
          </label>
        )}
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Sunday long run with Stride shoes" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">What runners can win</span>
          <input value={giveaway} onChange={(e) => setGiveaway(e.target.value)} maxLength={300} required placeholder="A pair of shoes for the first twenty at the line" className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">How many</span>
            <input type="number" min={0} value={giveawayCount} onChange={(e) => setGiveawayCount(e.target.value)} placeholder="Not counted" className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="Anywhere" className={FIELD} />
          </label>
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">What the brand gives</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={3000} rows={3} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">What the brand asks</span>
          <textarea value={asks} onChange={(e) => setAsks(e.target.value)} maxLength={1000} rows={2} placeholder="A photo at the start line, tagged" className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Open from</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Until</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className={FIELD} />
          </label>
        </div>
        <ErrorLine e={post.isError ? post.error : null} />
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
              <legend className="text-subhead font-semibold">Which club</legend>
              <Choice label="Which club" options={open.map((c) => ({ key: c.id, label: c.name }))} value={chosen} onChange={setClubId} />
            </fieldset>
          )}
          {open.length === 1 && <p className="m-0 text-subhead font-semibold">Applying with {open[0]?.name}.</p>}
          <label className="block">
            <span className="block text-subhead font-semibold">A note for the brand</span>
            <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="How many run with you, where, and when" className={FIELD} />
          </label>
          <ErrorLine e={apply.isError ? apply.error : null} />
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
  const box = FIELD_LINE;
  return (
    <div className="mt-sm flex flex-col gap-xs">
      <div className="grid grid-cols-[1fr_auto] gap-xs">
        <input type="number" inputMode="numeric" min={1} max={ATTENDEE_XP_MAX} value={xp} onChange={(e) => setXp(e.target.value)} disabled={started || busy} aria-label="Xp each runner" className={box} />
        <Button variant="outline" disabled={started || busy || Number(xp) === r.xp || !(Number(xp) >= 1)} onClick={() => onRecode({ xp: Number(xp) })}>
          Set xp
        </Button>
      </div>
      {started && <p className="m-0 text-caption text-ink-soft">The xp is fixed: the code is open.</p>}
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

/** The run's discussion (under Discussions), then its photos and the people to meet, opened on request so a list of runs does not poll for each. */
function RunTalk({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  return (
    // A note about the run's photo folder opens the club on `#run-photos-<id>`, which lands here and opens it (lib/useLandOnHash.ts).
    <li id={`run-photos-${runId}`} className="list-none">
      <span className="flex flex-wrap items-center gap-xs">
        <Link to={`/run?tab=talk&run=${runId}`} className="inline-flex min-h-[44px] items-center px-xs text-subhead font-semibold underline underline-offset-4 hover:text-ink-soft">
          Open the discussion
        </Link>
        <button type="button" aria-expanded={open} aria-controls={`run-people-${runId}`} data-land-open="" onClick={() => setOpen((v) => !v)} className="toy toy-flat inline-flex min-h-[44px] items-center gap-xs rounded-pill px-md text-subhead font-medium underline underline-offset-4">
          {open ? 'Hide photos and people' : 'Photos and people'}
          <ToggleChevron open={open} />
        </button>
      </span>
      {open && (
        <div id={`run-people-${runId}`}>
          <EventPanel app="run" id={runId} talk={false} />
        </div>
      )}
    </li>
  );
}

function RunCard({ r, host, member, onLog, onRecode, onStatus, busy }: { r: RunItem; host: boolean; member: boolean; onLog: () => void; onRecode: (change?: { xp?: number; code?: string }) => void; onStatus: (s: 'cancelled' | 'done') => void; busy: boolean }) {
  return (
    <li className="rounded-card bg-card p-md shadow-toy-soft">
      {/* The run at the top left and how many logged it in the corner of every run, like the Coming up rows. */}
      <CardHead tag={<StatusTag tone="neutral">{`${r.entries} logged`}</StatusTag>}>
        <p className="m-0 text-balance text-card-title">{r.title}</p>
      </CardHead>
      <p className="m-0 text-card-note text-ink-soft">
        {eventTime(r.startsAt)} to {clockTime(r.endsAt)}, {kmLabel(r.metres)}
        {r.meetingPoint ? `, ${r.meetingPoint}` : ''}
      </p>
      <p className="mt-xs m-0 text-card-note text-ink-soft">{stateLine(r)}.</p>
      {r.collab && (
        <p className="mt-sm m-0">
          <Giveaway giveaway={r.collab.giveaway} brand={r.collab.brand} />
        </p>
      )}
      {host && r.code && (
        <div className="mt-sm rounded-tile p-sm" style={pill('green')}>
          <div className="flex items-start justify-between gap-sm">
            <p className="m-0 text-eyebrow uppercase text-ink-soft">Start code</p>
            <p className="m-0 shrink-0 rounded-pill bg-card px-sm py-xs text-subhead font-medium">+{r.xp} xp each</p>
          </div>
          <p className="m-0 text-figure-lg type-figure leading-none tracking-[0.2em] break-all">{r.code}</p>
          <p className="mt-xs m-0 text-caption text-ink-soft">Show this at the start line, from thirty minutes before to three hours after. Once per runner, and you never log your own run.</p>
          <RunCodeEditor r={r} onRecode={onRecode} busy={busy} />
        </div>
      )}
      <div className="fill-row mt-sm flex flex-wrap gap-xs">
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
            <Button variant="ghost" onClick={() => onStatus('cancelled')} disabled={busy}>
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
          <p className="m-0 text-subhead text-ink-soft">{run.title}. The host shows the start code at the line.</p>
          <label className="block">
            <span className="block text-subhead font-semibold">Start code</span>
            <input autoFocus value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} maxLength={ATTENDEE_CODE_MAX} autoCapitalize="characters" autoComplete="off" spellCheck={false} required className={`${FIELD} text-title1 tracking-[0.2em]`} />
          </label>
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-subhead font-semibold">Kilometres</span>
              <input type="number" min={0} max={100} step={0.1} value={km} onChange={(e) => setKm(e.target.value)} placeholder={String(planned)} className={FIELD} />
            </label>
            <label className="block">
              <span className="block text-subhead font-semibold">Minutes</span>
              <input type="number" min={0} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Optional" className={FIELD} />
            </label>
          </div>
          <Nudge text={`${run?.xp ?? RUN_REWARD.xp} xp and ${RUN_REWARD.points} points, once per run, up to ${RUN_REWARD.perDay} a day. Minutes count as movement.`} />
          <ErrorLine e={log.isError ? log.error : null} />
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
          <span className="block text-subhead font-semibold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Sunday long run" className={FIELD} />
          <p className="mt-xs m-0 text-caption text-ink-soft">Leave it blank to use the club’s name.</p>
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Starts</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={FIELD} />
            <p className="mt-xs m-0 text-caption text-ink-soft">Club members get a note about the new run.</p>
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Minutes</span>
            <input type="number" min={10} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={FIELD} />
            <p className="mt-xs m-0 text-caption text-ink-soft">From 10 to 1,440. The code works until three hours after it ends.</p>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Kilometres</span>
            <input type="number" min={0.1} max={100} step={0.1} value={km} onChange={(e) => setKm(e.target.value)} className={FIELD} />
            <p className="mt-xs m-0 text-caption text-ink-soft">A runner who leaves their distance blank gets this.</p>
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Meeting point</span>
            <input value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} maxLength={200} className={FIELD} />
            <p className="mt-xs m-0 text-caption text-ink-soft">It shows on the run’s card.</p>
          </label>
        </div>
        {collabs.length > 0 && (
          <label className="block">
            <span className="block text-subhead font-semibold">Brand collab</span>
            <select value={collabId} onChange={(e) => setCollabId(e.target.value)} className={FIELD}>
              <option value="">None</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}: {c.giveaway}
                </option>
              ))}
            </select>
            <p className="mt-xs m-0 text-caption text-ink-soft">Only collabs that took this club are listed.</p>
          </label>
        )}
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Xp for each runner</span>
            <input type="number" inputMode="numeric" min={1} max={ATTENDEE_XP_MAX} value={xp} onChange={(e) => setXp(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Your own code</span>
            <input value={own} onChange={(e) => setOwn(normalizeCode(e.target.value))} maxLength={ATTENDEE_CODE_MAX} placeholder="Random" autoCapitalize="characters" className={`${FIELD} uppercase placeholder:normal-case`} />
          </label>
        </div>
        <p className="m-0 text-caption text-ink-soft">Up to {ATTENDEE_XP_MAX} xp, fixed thirty minutes before the start, when the code opens. You get a start code (six letters, or your own word) that only you see. Members log the run by entering it at the line.</p>
        {late && (
          <p role="status" className="m-0 rounded-tile bg-r3/30 p-sm text-subhead">
            {late}
          </p>
        )}
        <ErrorLine e={add.isError ? add.error : null} />
        <Button type="submit" size="lg" full disabled={add.isPending || !startsAt}>
          Add the run
        </Button>
      </form>
    </Sheet>
  );
}

export function RunClubPage() {
  const { id = '' } = useParams();
  const epg = usePage('e');
  const rupg = usePage('ru');
  const rrpg = usePage('rr');
  const rkpg = usePage('rk');
  const pq = [epg.query, rupg.query, rrpg.query, rkpg.query].join('&');
  const q = useAuthed(['run-club', id, pq], () => api.runClub(id, pq));
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState<RunItem | null>(null);
  // The one step asked before it happens (leave, close the club, cancel a run, void an entry), opened with what it is about.
  const [ask, setAsk] = useState<{ kind: 'leave' } | { kind: 'close' } | { kind: 'cancel'; runId: string; title: string } | { kind: 'void'; entryId: string; name: string } | null>(null);
  const after = () => {
    refresh();
    q.refetch();
  };
  const asked = () => {
    setAsk(null);
    after();
  };
  const join = useMutation({ mutationFn: () => api.joinRunClub(id), onSuccess: after });
  const leave = useMutation({ mutationFn: () => api.leaveRunClub(id), onSuccess: asked });
  const close = useMutation({ mutationFn: () => api.setRunClub(id, { status: 'closed' }), onSuccess: asked });
  const recode = useMutation({ mutationFn: (v: { runId: string; change?: { xp?: number; code?: string } }) => api.recodeRun(v.runId, v.change ?? {}), onSuccess: () => q.refetch() });
  const setRun = useMutation({ mutationFn: (v: { runId: string; status: 'cancelled' | 'done' }) => api.setRun(v.runId, v.status), onSuccess: after });
  const voidEntry = useMutation({ mutationFn: (entryId: string) => api.voidRunEntry(entryId), onSuccess: asked });

  if (q.isError) {
    return (
      <Screen>
        <AppCover back={{ to: '/run', label: 'Kreators Run' }} title="No such club" lede={q.error instanceof Error ? q.error.message : 'This club is gone or was never here.'} />
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
      <AppCover
        back={{ to: '/run', label: 'Kreators Run' }}
        eyebrow={
          <>
            <Icon icon={Footprints} size={14} className="mr-xs inline align-middle" />
            {k.city}, {RUN_PACE_META[k.pace].name.toLowerCase()}, hosted by {k.hostName}
            {k.status === 'closed' ? ', closed' : ''}
          </>
        }
        title={k.name}
        lede={
          k.meets || k.description ? (
            <>
              {k.meets && <p className="m-0 text-callout text-ink">{k.meets}</p>}
              {k.description && <p className="mt-xs m-0 whitespace-pre-wrap">{k.description}</p>}
            </>
          ) : undefined
        }
        actions={
          <>
            {!k.mine && k.status === 'active' && (
              <Button onClick={() => join.mutate()} disabled={join.isPending}>
                Join the club
              </Button>
            )}
            {k.mine && !k.host && (
              <Button
                variant="outline"
                onClick={() => {
                  leave.reset();
                  setAsk({ kind: 'leave' });
                }}
                disabled={leave.isPending}
              >
                Leave
              </Button>
            )}
            {k.host && k.status === 'active' && (
              <>
                <Button onClick={() => setAdding(true)}>Add a run</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    close.reset();
                    setAsk({ kind: 'close' });
                  }}
                  disabled={close.isPending}
                >
                  Close the club
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-xs">
          <IconTag tone="calm" icon="Users">{`${k.members} ${k.members === 1 ? 'runner' : 'runners'}`}</IconTag>
          {k.visibility === 'private' && (
            <StatusTag tone={TINT_TONE['purple']}>
              Private
            </StatusTag>
          )}
          {k.host && (
            <StatusTag tone={TINT_TONE['green']}>
              You host this
            </StatusTag>
          )}
        </div>
        <ErrorLine e={join.isError ? join.error : leave.isError ? leave.error : close.isError ? close.error : null} />
      </AppCover>

      <section className="mt-lg" aria-labelledby="club-runs">
        <h2 id="club-runs" className="text-title2">
          Next runs
        </h2>
        {d.runs.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">{k.host ? 'No run on the calendar. Add one and you get its start code.' : 'No run on the calendar yet. The host adds them here.'}</p>}
        <ErrorLine e={recode.isError ? recode.error : setRun.isError ? setRun.error : null} />
        <ul className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
          {d.runs.map((r) => (
            <Fragment key={r.id}>
              <RunCard r={r} host={k.host} member={k.mine} onLog={() => setLogging(r)} onRecode={(change) => recode.mutate({ runId: r.id, change })} onStatus={(status) => {
                  if (status !== 'cancelled') return setRun.mutate({ runId: r.id, status });
                  setRun.reset();
                  setAsk({ kind: 'cancel', runId: r.id, title: r.title });
                }} busy={busy} />
              {(k.host || k.mine) && <RunTalk runId={r.id} />}
            </Fragment>
          ))}
        </ul>
        <Pager page={d.runPage} prefix="ru" label="next runs" />
      </section>

      {(d.collabs.length > 0 || d.collabPage.page > 1) && (
        <section className="mt-lg" aria-labelledby="club-collabs">
          <h2 id="club-collabs" className="text-title2">
            Brand collabs
          </h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">What runners can win at the next collab run.</p>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.collabs.map((c) => (
              <li key={c.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-card-title">
                  {c.title} <span className="text-subhead text-ink-soft">by {c.brand}</span>
                </p>
                <p className="mt-xs m-0">
                  <Giveaway giveaway={c.giveaway} count={c.giveawayCount} />
                </p>
                {c.asks && <p className="mt-xs m-0 text-card-note text-ink-soft">The brand asks: {c.asks}</p>}
              </li>
            ))}
          </ul>
          <Pager page={d.collabPage} prefix="rk" label="brand collabs" />
        </section>
      )}

      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="club-board">
        <h2 id="club-board" className="text-title3">
          This month
        </h2>
        {d.board.length === 0 ? (
          <p className="mt-xs m-0 text-subhead text-ink-soft">Nobody has logged a run this month yet.</p>
        ) : (
          <div className="mt-sm">
            <HBars label="Kilometres this month per runner" rows={d.board.map((b) => ({ key: b.userId, label: b.name, value: b.metres / maxMetres, text: kmLabel(b.metres), color: REL.color }))} />
          </div>
        )}
      </section>

      {k.host && d.entries.length > 0 && (
        <section className="mt-lg" aria-labelledby="club-entries">
          <h2 id="club-entries" className="text-title2">
            Entries
          </h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">Every entry logged with a start code. Void one that should not be there and its points come back out.</p>
          <ErrorLine e={voidEntry.isError ? voidEntry.error : null} />
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">{e.name}</span>
                  <span className="block text-card-note text-ink-soft">
                    {eventTime(e.loggedAt)}, {kmLabel(e.metres)}
                    {e.minutes > 0 ? `, ${e.minutes} min` : ''}
                    {e.status === 'void' ? ', voided' : ''}
                  </span>
                </span>
                {e.status === 'logged' && (
                  <Button
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      voidEntry.reset();
                      setAsk({ kind: 'void', entryId: e.id, name: e.name });
                    }}
                    disabled={voidEntry.isPending}
                    aria-label={`Void ${e.name}'s entry`}
                  >
                    Void
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pager page={d.entryPage} prefix="e" label="entries" />
        </section>
      )}

      {(d.past.length > 0 || d.pastPage.page > 1) && (
        <section className="mt-lg" aria-labelledby="club-past">
          <h2 id="club-past" className="text-title2">
            Past runs
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.past.map((r) => (
              <li key={r.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="block text-card-title">{r.title}</span>
                <span className="block text-card-note text-ink-soft">
                  {eventTime(r.startsAt)}, {kmLabel(r.metres)}, {r.entries} {r.entries === 1 ? 'runner' : 'runners'}
                  {r.status !== 'published' ? `, ${r.status}` : ''}
                  {r.mine ? `, you ran ${kmLabel(r.mine.metres)}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <Pager page={d.pastPage} prefix="rr" label="past runs" />
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
      <ConfirmDelete
        open={ask !== null}
        title={ask?.kind === 'leave' ? 'Leave this club?' : ask?.kind === 'close' ? 'Close this club?' : ask?.kind === 'cancel' ? 'Cancel this run?' : 'Void this entry?'}
        body={
          ask?.kind === 'leave'
            ? `You leave ${k.name} and stop seeing its runs. You can join again while it is open.`
            : ask?.kind === 'close'
              ? 'Runs and entries stay, and nobody can join after that.'
              : ask?.kind === 'cancel'
                ? `"${ask.title}". Everyone in the club is told it is off.`
                : ask?.kind === 'void'
                  ? `${ask.name}'s entry stops counting and its xp and points come back out. This cannot be undone.`
                  : ''
        }
        pending={ask?.kind === 'leave' ? leave.isPending : ask?.kind === 'close' ? close.isPending : ask?.kind === 'cancel' ? setRun.isPending : voidEntry.isPending}
        failed={ask?.kind === 'leave' ? leave.isError : ask?.kind === 'close' ? close.isError : ask?.kind === 'cancel' ? setRun.isError : voidEntry.isError}
        onYes={() => {
          if (ask?.kind === 'leave') leave.mutate();
          else if (ask?.kind === 'close') close.mutate();
          else if (ask?.kind === 'cancel') setRun.mutate({ runId: ask.runId, status: 'cancelled' }, { onSuccess: () => setAsk(null) });
          else if (ask?.kind === 'void') voidEntry.mutate(ask.entryId);
        }}
        onClose={() => setAsk(null)}
        yes={ask?.kind === 'leave' ? 'Yes, leave the club' : ask?.kind === 'close' ? 'Yes, close it' : ask?.kind === 'cancel' ? 'Yes, cancel it' : 'Yes, void it'}
      />
    </Screen>
  );
}
