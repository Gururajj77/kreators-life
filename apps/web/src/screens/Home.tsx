import { greetingFor, LIFE_AREAS, MODULE_GROUPS, money, MOODS, RELATIONSHIP_BY_KEY, STRESS_LEVELS, type HomeResponse, type ModuleGroup } from '@kreators/shared';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { PeriodPanel } from '../components/PeriodPanel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { AreaLine, Donut, Gauge, HBars, Legend, MultiLine, PillBars, Segments, Sparkline } from '../components/Charts';
import { HeroBlobs } from '../components/Hero';
import { MoodFace } from '../components/MoodFace';
import { Person } from '../components/Person';
import { Ring } from '../components/Ring';
import { RoleBadge } from '../components/RoleBadge';
import { Screen } from '../components/Screen';
import { SearchBox } from '../components/SearchBox';
import { Section, SeeAll } from '../components/Section';
import { api } from '../lib/api';
import { prettyDate, todayLocal } from '../lib/date';
import { useModules } from '../lib/modules';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { useMutation } from '@tanstack/react-query';

const SHORTCUT_ORDER: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'manage', 'internal'];
const weekday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const KIND_EMOJI: Record<string, string> = { article: '📄', exercise: '🧘', video: '🎥', audio: '🎧', link: '🔗' };
const SOURCE_META = {
  checkin: { label: 'Check-ins', color: 'var(--color-r3)' },
  spark: { label: 'Small acts', color: 'var(--color-r6)' },
  task: { label: 'Tasks', color: 'var(--color-r4)' },
  ripple: { label: 'Pyramids getting stronger', color: 'var(--color-r2)' },
  other: { label: 'Other', color: 'var(--color-r5)' },
} as const;
/** On a solid colour fill everything is white; a translucent white is the track. */
const WHITE = 'var(--color-on-fill)';
const WHITE_TRACK = 'rgba(255,255,255,0.3)';

/**
 * Home, laid out like the kit's Home frame: a dark header with the date, your avatar, a greeting
 * and three small pills, then a search field; a row of coloured metric cards; four stat tiles;
 * the day's three boxes as a green card; a tracker list with a small visual on every row;
 * what is coming up; the companion as a dark card; two pieces from Knowledge; then the game's
 * own views (xp per day and where it came from, the tower, money, the shop) and a door into every app.
 * On every coloured fill the foreground is white, as in the kit; dark elements sit only on cream.
 */
export function Home() {
  const me = useMe();
  const date = todayLocal();
  const hour = new Date().getHours();
  const q = useAuthed(['home', date], () => api.home(date, hour));
  const { modules } = useModules();
  const refreshAll = useRefreshAll();
  const d = q.data;
  const user = me.data?.user;
  const firstName = user?.displayName?.split(' ')[0] ?? '';
  const identity = me.data?.identity ?? null;
  const myPage = user ? (user.handle ? `/u/${user.handle}` : `/people/${user.id}`) : '/profile';
  const moodToday = d ? (MOODS.find((m) => m.value === d.trackers.mood.today) ?? null) : null;
  const recentMoods = d ? d.trackers.mood.week.filter((m): m is number => m !== null).slice(-3) : [];

  return (
    <Screen columns>
      <header className="relative -mx-md overflow-hidden rounded-b-card bg-ink px-md pt-lg pb-md text-on-ink md:mx-0 md:mt-md md:rounded-card">
        <HeroBlobs opacity={0.06} />
        <div className="relative flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
          <p className="order-2 m-0 text-[14px] font-bold opacity-80 md:order-1">
            <span aria-hidden="true">📅 </span>
            {prettyDate(date)}, {greetingFor(hour).toLowerCase()}
          </p>
          <div className="order-1 mr-2xl flex shrink-0 items-center justify-end gap-xs md:order-2 md:mr-0">
            <Link to={myPage} className="toy inline-flex min-h-[44px] items-center gap-xs rounded-pill bg-on-ink/15 px-sm text-[14px] font-bold text-on-ink">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              My page
            </Link>
          <Link to="/inbox" aria-label={d && d.unread > 0 ? `Inbox, ${d.unread} unread` : 'Inbox'} className="toy relative flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-on-ink/15 text-on-ink">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
              <path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
            {d && d.unread > 0 && <span className="absolute -top-[2px] -right-[2px] flex min-w-[18px] items-center justify-center rounded-pill bg-r2 px-xs text-[11px] font-extrabold leading-[18px] text-on-fill">{d.unread > 9 ? '9+' : d.unread}</span>}
          </Link>
          </div>
        </div>
        <div className="relative mt-sm flex items-center gap-sm">
          <Link to="/you" aria-label="Profile" className="relative shrink-0">
            <span className="flex size-[64px] items-center justify-center overflow-hidden rounded-pill bg-paper">
              {identity ? <Person stage={identity.stage.stage} size={52} decorative /> : <Avatar relationship="self" size={44} decorative still />}
            </span>
            {user && <RoleBadge role={user.role} className="absolute right-0 bottom-0" />}
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[30px] text-on-ink">{firstName ? `Hi, ${firstName}!` : 'Hi there!'}</h1>
            {d && (
              <p className="mt-xs m-0 flex flex-wrap items-center gap-xs text-[14px] font-bold opacity-90" aria-label="At a glance">
                <Link to="/tower" className="underline-offset-4 hover:underline">
                  <span aria-hidden="true">⭐ </span>Level {d.xp.level}
                </Link>
                <span aria-hidden="true">·</span>
                <Link to="/today" className="underline-offset-4 hover:underline">
                  <span aria-hidden="true">🔥 </span>
                  {d.today.streak} {d.today.streak === 1 ? 'day' : 'days'}
                </Link>
                <span aria-hidden="true">·</span>
                <Link to="/mood" className="underline-offset-4 hover:underline">
                  <span aria-hidden="true">{moodToday ? moodToday.emoji : '🙂'} </span>
                  {moodToday ? moodToday.name : 'Log your mood'}
                </Link>
              </p>
            )}
          </div>
        </div>
        <div className="relative mt-md">
          <SearchBox placeholder="Search anything" onDark />
        </div>
      </header>

      {q.isPending && (
        <p className="span-all mt-md m-0 text-[14px] font-bold text-ink-soft" role="status">
          Adding up your week
        </p>
      )}
      {q.isError && (
        <div className="span-all mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load your numbers.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          <Section id="home-metrics" title="Your metrics" action={<SeeAll to="/life">Life</SeeAll>} span>
            <ul className="-mx-md flex snap-x list-none gap-xs overflow-x-auto px-md pb-xs scrollbar-none m-0 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
              <li className="w-[168px] shrink-0 snap-start md:w-auto">
                <MetricCard to="/life" title="Life score" emoji="🧭" tone="var(--color-r4)" deep="var(--deep-lover_partner)" corner={<Avatar relationship="lover_partner" size={36} decorative mood={(d.life?.overall ?? 0) >= 60 ? 'excited' : 'happy'} />}>
                  <span className="flex flex-1 items-center justify-center">
                    <Gauge value={(d.life?.overall ?? 0) / 100} size={120} stroke={12} color={WHITE} track={WHITE_TRACK} label={`Life ${d.life?.overall ?? 0} of 100`}>
                      <span className="flex flex-col items-center leading-none">
                        <span className="font-display text-[32px] font-extrabold">{d.life?.overall ?? 0}</span>
                        <span className="mt-xs text-[12px] font-bold opacity-90">{d.life?.label ?? ''}</span>
                      </span>
                    </Gauge>
                  </span>
                </MetricCard>
              </li>
              <li className="w-[168px] shrink-0 snap-start md:w-auto">
                <MetricCard to="/mood" title="Mood" emoji="" tone="var(--color-r2)" deep="var(--deep-friendship)" corner={<MoodFace value={moodToday?.value ?? 3} size={40} color="rgba(255,255,255,0.25)" face="var(--color-on-fill)" />}>
                  <span className="block font-display text-[26px] font-extrabold leading-none">{moodToday ? moodToday.name : 'Not logged'}</span>
                  <span className="mt-xs block flex-1">
                    <AreaLine values={d.trackers.mood.week} max={5} min={1} color={WHITE} height={80} onFill axes={false} empty="No moods yet" label="Mood for the last seven days" />
                  </span>
                </MetricCard>
              </li>
              <li className="w-[168px] shrink-0 snap-start md:w-auto">
                <MetricCard to="/wellbeing" title="Wellbeing" emoji="💚" tone="var(--color-r6)" deep="var(--deep-guru)" corner={<Avatar relationship="guru" size={36} decorative mood={d.trackers.score >= 60 ? 'excited' : 'happy'} />}>
                  <span className="flex flex-1 items-center justify-center">
                    <Ring value={d.trackers.score / 100} size={104} stroke={11} color={WHITE} track={WHITE_TRACK} label={`Wellbeing ${d.trackers.score} of 100`}>
                      <span className="flex flex-col items-center leading-none">
                        <span className="font-display text-[30px] font-extrabold">{d.trackers.score}</span>
                        <span className="mt-xs text-[12px] font-bold opacity-90">{d.trackers.label}</span>
                      </span>
                    </Ring>
                  </span>
                </MetricCard>
              </li>
            </ul>
          </Section>

          <Section id="home-stats" title="Your numbers" lede="Results first. Everything below is what moves them." span>
            <div className="grid grid-cols-2 gap-xs md:grid-cols-4">
              <KitTile to="/today" tone="bg-r4" icon="🔥" value={String(d.today.streak)} label="day streak" hint={d.today.checkedIn ? 'checked in today' : 'not yet today'} />
              <KitTile to="/today" tone="bg-r2" icon="✨" value={`+${d.xp.today}`} label="xp today" hint={`${d.xp.week} this week`} />
              <KitTile to="/rewards" tone="bg-r3" yellow icon="🪙" value={d.points.toLocaleString()} label="points" hint="trade for rewards" />
              <KitTile to="/tower" tone="bg-ink" icon="⭐" value={`Level ${d.xp.level}`} label={`${d.xp.into} of ${d.xp.span} xp`} hint={`${d.xp.span - d.xp.into} to level ${d.xp.level + 1}`}>
                <span className="mt-xs block h-[6px] overflow-hidden rounded-pill bg-on-ink/20" aria-hidden="true">
                  <span className="block h-full rounded-pill bg-on-ink" style={{ width: `${Math.round((d.xp.into / Math.max(1, d.xp.span)) * 100)}%` }} />
                </span>
              </KitTile>
            </div>
          </Section>

          <PeriodPanel id="home-period" parts={['daily', 'wellbeing', 'finance', 'shop']} span />
          <Section id="home-trends" title="This week" lede="Mood, sleep and calm as scores out of a hundred, day by day. Where the lines dip is where to look." action={<SeeAll to="/wellbeing">Wellbeing</SeeAll>} span>
            <div className="rounded-card bg-card p-md shadow-toy-soft">
              <MultiLine
                series={[
                  { values: d.trackers.mood.week.map((m) => (m === null ? null : ((m - 1) / 4) * 100)), color: 'var(--color-r3)', label: 'Mood' },
                  { values: d.trackers.sleep.week.map((h) => (h === null ? null : (Math.max(4, Math.min(8, h)) - 4) * 25)), color: 'var(--color-r6)', label: 'Sleep' },
                  { values: d.trackers.stress.week.map((st) => (st === null ? null : ((5 - st) / 4) * 100)), color: 'var(--color-r2)', label: 'Calm' },
                ]}
                max={100}
                labels={d.days.slice(-7).map((x) => weekday(x.date))}
                allLabels
                height={180}
                label="Mood, sleep and calm as scores out of a hundred for the last seven days"
                empty="Log a mood, a night or a stress level and the lines appear."
              />
            </div>
          </Section>

          <Section id="home-today" title="Daily" action={<SeeAll to="/today">Open</SeeAll>}>
            <div className="relative overflow-hidden rounded-card bg-r4 p-md text-on-fill">
              <HeroBlobs />
              <div className="relative">
                <div className="flex items-center justify-between gap-sm">
                  <div className="flex items-center gap-sm">
                    <Ring value={d.today.doneCount / 3} size={64} stroke={8} color={WHITE} track={WHITE_TRACK} label={`${d.today.doneCount} of 3 done`}>
                      <span className="font-display text-[18px] font-extrabold">{d.today.doneCount}/3</span>
                    </Ring>
                    <p className="m-0">
                      <span className="block font-display text-[24px] font-extrabold leading-none">{d.today.doneCount === 3 ? 'All three done' : `${3 - d.today.doneCount} to go`}</span>
                      <span className="mt-xs block text-[14px] font-bold opacity-90">Check in, small act, one task.</span>
                    </p>
                  </div>
                  <span className="shrink-0" aria-hidden="true">
                    <Avatar relationship={d.today.sparkRelationship} size={64} decorative mood={d.today.sparkDone ? 'excited' : d.today.doneCount > 0 ? 'happy' : 'sleepy'} />
                  </span>
                </div>
                <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0" aria-label="The three boxes">
                  {[
                    ['Check in', d.today.checkedIn],
                    [`${RELATIONSHIP_BY_KEY[d.today.sparkRelationship].character}'s small act`, d.today.sparkDone],
                    [d.today.taskDone ? 'A task' : d.today.tasksWaiting > 0 ? `${d.today.tasksWaiting} ${d.today.tasksWaiting === 1 ? 'task' : 'tasks'} waiting` : 'No task due', d.today.taskDone],
                  ].map(([text, done]) => (
                    <li key={String(text)} className={`inline-flex min-h-[32px] items-center gap-xs rounded-pill px-sm text-[12px] font-extrabold ${done ? 'bg-card text-ink' : 'bg-white/25 text-on-fill'}`}>
                      {done ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      ) : (
                        <span className="block size-[12px] rounded-[4px] border-2 border-current" aria-hidden="true" />
                      )}
                      {String(text)}
                    </li>
                  ))}
                </ul>
                <div className="mt-sm rounded-tile bg-white/25 p-sm">
                  <p className="m-0 font-display text-[18px] font-extrabold leading-tight">{d.nudge.lead}</p>
                  <p className="mt-xs m-0 text-[14px] font-semibold opacity-95">{d.nudge.body}</p>
                </div>
                <div className="mt-sm flex gap-xs">
                  <Link to={d.nudge.path} className="toy inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-pill bg-card px-md text-[16px] font-bold text-ink">
                    {d.nudge.action}
                  </Link>
                  <Link to="/today" aria-label="Open Today" className="toy flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-white/25 text-on-fill">
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </Section>

          <Section id="home-trackers" title="Trackers" lede="Tap a row to log today." action={<SeeAll to="/wellbeing">Wellbeing</SeeAll>}>
            <ul className="flex list-none flex-col gap-xs p-0 m-0">
              {[
                {
                  key: 'mindful', to: '/mindful', name: 'Mindful minutes', emoji: '🧘', tone: 'var(--tint-green)',
                  value: d.trackers.mindful.minutesWeek > 0 ? `${d.trackers.mindful.minutesWeek} min this week` : 'none this week',
                  visual: <Sparkline values={d.trackers.mindful.week} max={60} color="var(--color-r4)" width={80} height={32} />,
                },
                {
                  key: 'sleep', to: '/sleep', name: 'Sleep', emoji: '🌙', tone: 'var(--tint-purple)',
                  value: d.trackers.sleep.avg7 === null ? 'not logged' : `${d.trackers.sleep.avg7.toFixed(1)} h a night`,
                  visual: (
                    <Ring value={d.trackers.sleep.avg7 === null ? 0 : (Math.max(4, Math.min(8, d.trackers.sleep.avg7)) - 4) / 4} size={44} stroke={5} color="var(--color-r6)" track="var(--color-line)" label="Sleep quality">
                      <span className="text-[12px] font-extrabold">{d.trackers.sleep.avg7 === null ? '–' : Math.round(((Math.max(4, Math.min(8, d.trackers.sleep.avg7)) - 4) / 4) * 100)}</span>
                    </Ring>
                  ),
                },
                {
                  key: 'journal', to: '/journal', name: 'Journal', emoji: '📓', tone: 'var(--tint-orange)',
                  value: d.trackers.journal.streakDays > 0 ? `${d.trackers.journal.streakDays} day streak` : d.trackers.journal.entriesMonth > 0 ? `${d.trackers.journal.entriesMonth} this month` : 'nothing written yet',
                  visual: (
                    <span className="grid grid-cols-7 gap-xs" role="img" aria-label="Days with an entry in the last two weeks">
                      {d.trackers.journal.days14.map((on, i) => (
                        <span key={i} className="block size-[8px] rounded-[2px]" style={{ background: on ? 'var(--color-r2)' : 'var(--tint-orange)' }} />
                      ))}
                    </span>
                  ),
                },
                {
                  key: 'stress', to: '/stress', name: 'Stress', emoji: '🌊', tone: 'var(--tint-yellow)',
                  value: d.trackers.stress.latest === null ? 'not logged' : `Level ${d.trackers.stress.latest} (${STRESS_LEVELS[d.trackers.stress.latest - 1] ?? ''})`,
                  visual: <Segments value={d.trackers.stress.latest} color="var(--color-r3)" label="Stress level out of five" />,
                },
                {
                  key: 'mood', to: '/mood', name: 'Mood', emoji: '🙂', tone: 'var(--tint-brown)',
                  value: moodToday ? `${moodToday.name} today` : 'not logged today',
                  visual:
                    recentMoods.length === 0 ? (
                      <span className="text-[12px] font-bold text-ink-soft">no moods yet</span>
                    ) : (
                      <span className="flex items-center gap-xs" role="img" aria-label={`Last moods: ${recentMoods.map((m) => MOODS[m - 1]?.name ?? '').join(', then ')}`}>
                        {recentMoods.map((m, i) => (
                          <span key={i} className="flex items-center gap-xs">
                            {i > 0 && (
                              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-ink-mute">
                                <path d="M5 12h14M13 6l6 6-6 6" />
                              </svg>
                            )}
                            <MoodFace value={m} size={28} />
                          </span>
                        ))}
                      </span>
                    ),
                },
              ].map((r) => (
                <li key={r.key}>
                  <Link to={r.to} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink">
                    {r.key === 'mood' && moodToday ? (
                      <MoodFace value={moodToday.value} size={48} />
                    ) : (
                      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill text-[22px]" style={{ background: r.tone }} aria-hidden="true">
                        {r.emoji}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold">{r.name}</span>
                      <span className="block truncate text-[14px] font-semibold text-ink-soft">{r.value}</span>
                    </span>
                    <span className="shrink-0">{r.visual}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="home-next" title="Up next" action={<SeeAll to="/party">Party</SeeAll>}>
            <div className="rounded-card bg-card p-md shadow-toy-soft">
              <div className="flex items-center justify-between gap-sm">
                <p className="m-0 flex items-baseline gap-xs">
                  <span className="font-display text-[40px] font-extrabold leading-none">{d.upNext.length}</span>
                  <span className="text-[16px] font-bold">coming up</span>
                </p>
                <Link to="/party" aria-label="Open Party" className="toy flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-r4 text-on-fill" style={{ '--toy-color': 'var(--deep-lover_partner)' } as CSSProperties}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
              <p className="mt-xs m-0 flex flex-wrap gap-sm text-[12px] font-bold text-ink-soft">
                {(['event', 'session', 'booking', 'circle'] as const).map((k) => {
                  const n = d.upNext.filter((u) => u.kind === k).length;
                  if (n === 0) return null;
                  return (
                    <span key={k}>
                      <span aria-hidden="true">{k === 'event' ? '🎉' : k === 'circle' ? '🫧' : '📅'} </span>
                      {n} {k === 'booking' ? (n === 1 ? 'booking you host' : 'bookings you host') : n === 1 ? k : `${k}s`}
                    </span>
                  );
                })}
                {d.upNext.length === 0 && <span>Nothing booked. Meetups are under Party, small groups near you under Circles.</span>}
              </p>
              {d.upNext.length > 0 && (
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {d.upNext.map((u) => (
                    <li key={`${u.kind}-${u.path}-${u.at}`}>
                      <Link to={u.path} className="toy toy-flat flex items-center gap-sm rounded-tile bg-paper p-sm text-ink">
                        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-[20px] shadow-toy-soft" aria-hidden="true">
                          {u.kind === 'event' ? '🎉' : u.kind === 'circle' ? '🫧' : '📅'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-bold">{u.title}</span>
                          <span className="block text-[12px] font-bold text-ink-soft">
                            <span aria-hidden="true">🕒 </span>
                            {when(u.at)}
                            {u.note ? `, ${u.note}` : ''}
                          </span>
                        </span>
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-mute">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-sm flex justify-center gap-md">
                <Link to="/party" className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-ink-mute underline-offset-4 hover:underline">
                  All events
                </Link>
                <Link to="/circles" className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-ink-mute underline-offset-4 hover:underline">
                  Circles
                </Link>
              </div>
            </div>
          </Section>

          <Section id="home-companion" title="Companion" lede="A chat that knows how you are doing. Not a therapist.">
            <div className="relative overflow-hidden rounded-card bg-ink p-md text-on-ink">
              <HeroBlobs opacity={0.06} />
              <div className="relative z-10 max-w-[60%]">
                <p className="m-0 font-display text-[40px] font-extrabold leading-none">{d.companion.messages.toLocaleString()}</p>
                <p className="mt-xs m-0 text-[18px] font-extrabold">{d.companion.messages === 1 ? 'message' : 'messages'}</p>
                <p className="mt-xs m-0 text-[14px] font-bold opacity-80">
                  <span aria-hidden="true">💬 </span>
                  {d.companion.messages === 0 ? 'Say what is on your mind.' : 'Pick up where you left off.'}
                </p>
                <p className="m-0 text-[14px] font-bold opacity-80">
                  <span aria-hidden="true">📓 </span>Or write it in the journal.
                </p>
              </div>
              <span className="pointer-events-none absolute top-md right-md opacity-90" aria-hidden="true">
                <Avatar relationship="guru" size={112} decorative mood="happy" />
              </span>
              <div className="relative z-10 mt-md flex gap-sm">
                <Link to="/companion" aria-label="Talk to the companion" className="toy flex size-[56px] items-center justify-center rounded-pill bg-r4 text-on-fill" style={{ '--toy-color': 'var(--deep-lover_partner)' } as CSSProperties}>
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </Link>
                <Link to="/journal" aria-label="Write in the journal" className="toy flex size-[56px] items-center justify-center rounded-pill bg-r2 text-on-fill" style={{ '--toy-color': 'var(--deep-friendship)' } as CSSProperties}>
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                    <path d="M12.5 7.5l4 4" />
                  </svg>
                </Link>
              </div>
            </div>
          </Section>

          {d.resources.length > 0 && (
            <Section id="home-reads" title="Knowledge" action={<SeeAll to="/knowledge">See all</SeeAll>}>
              <ul className="grid list-none grid-cols-2 gap-xs p-0 m-0">
                {d.resources.map((r) => (
                  <li key={r.id}>
                    <Link to={`/knowledge/${r.id}`} className="toy toy-soft flex min-h-[160px] flex-col rounded-card bg-card p-sm text-ink">
                      <span className="flex size-[48px] items-center justify-center rounded-pill bg-r4 text-[22px]" aria-hidden="true">
                        {KIND_EMOJI[r.kind] ?? '📄'}
                      </span>
                      {r.tag && <span className="mt-xs inline-flex w-fit rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[22px] text-ink-soft">{r.tag}</span>}
                      <span className="clamp-2 mt-xs block text-[16px] font-bold leading-snug">{r.title}</span>
                      <span className="mt-xs block text-[12px] font-bold text-ink-soft">{r.kind}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section id="home-trend" title="Last 14 days" lede="Xp per day. A green dot under a day means a task was ticked." action={<SeeAll to="/today">Daily</SeeAll>}>
            <div className="rounded-card bg-card p-md shadow-toy-soft">
              <AreaLine values={d.days.map((x) => x.xp)} max={Math.max(60, ...d.days.map((x) => x.xp))} labels={d.days.map((x) => weekday(x.date))} color="var(--color-r4)" height={160} empty="No xp in the last two weeks" label={`Xp per day for the last fourteen days, ${d.xp.week} this week`} />
              <div className="mt-xs flex gap-xs" role="img" aria-label="Days with a task ticked">
                {d.days.map((x) => (
                  <span key={x.date} className="flex flex-1 justify-center">
                    <span className="block size-[8px] rounded-pill" style={{ background: x.tasks > 0 ? 'var(--color-r4)' : 'var(--color-line)' }} />
                  </span>
                ))}
              </div>
              {d.days.every((x) => x.xp === 0) && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Every box ticked on Daily lands here.</p>}
            </div>
          </Section>

          <Section id="home-sources" title="Where xp came from" lede="The last two weeks, by what you did.">
            <div className="flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
              <Donut segments={d.xpBySource.map((x) => ({ value: x.xp, color: SOURCE_META[x.source].color, label: SOURCE_META[x.source].label }))} size={132} stroke={20} label="Xp by source">
                <span className="flex flex-col items-center leading-none">
                  <span className="font-display text-[24px] font-extrabold">{d.xpBySource.reduce((s, x) => s + x.xp, 0)}</span>
                  <span className="mt-xs text-[12px] font-bold text-ink-soft">xp</span>
                </span>
              </Donut>
              <div className="min-w-0 flex-1">
                {d.xpBySource.length > 0 ? <Legend items={d.xpBySource.map((x) => ({ color: SOURCE_META[x.source].color, label: SOURCE_META[x.source].label, text: `${x.xp}` }))} /> : <p className="m-0 text-[14px] font-semibold text-ink-soft">Tick a box on Today and the ring fills in.</p>}
              </div>
            </div>
          </Section>

          {d.life && (
            <Section id="home-life" title="Life" lede={`${d.life.overall} of 100, ${d.life.label.toLowerCase()}. Only you see this.`} action={<SeeAll to="/life">Open</SeeAll>}>
              <Link to="/life" className="toy toy-soft block rounded-card bg-card p-md text-ink">
                <ul className="flex list-none justify-between gap-xs p-0 m-0">
                  {d.life.areas.map((a) => {
                    const meta = LIFE_AREAS[a.key];
                    const rel = RELATIONSHIP_BY_KEY[meta.relationship];
                    const trend = Math.round(a.trend);
                    return (
                      <li key={a.key} className="flex min-w-0 flex-1 flex-col items-center gap-xs">
                        <Gauge value={a.score / 100} size={56} stroke={6} color={rel.color} label={`${meta.name} ${a.score}`}>
                          <span className="font-display text-[14px] font-extrabold">{a.score}</span>
                        </Gauge>
                        <span className="truncate text-[12px] font-bold text-ink-soft">{meta.name}</span>
                        {trend !== 0 && (
                          <span className="text-[12px] font-extrabold" style={{ color: `var(--deep-${rel.key})` }}>
                            {trend > 0 ? `+${trend}` : trend}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Link>
            </Section>
          )}

          <Section id="home-tower" title="Your areas" lede="Seven areas of your life. The bar shows how far each one has come." action={<SeeAll to="/tower">Open</SeeAll>}>
            <Link to="/tower" className="toy toy-soft block rounded-card bg-card p-md text-ink">
              <HBars
                label="Area levels"
                rows={[...d.floors].reverse().map((f) => {
                  const r = RELATIONSHIP_BY_KEY[f.relationship];
                  return {
                    key: f.relationship,
                    label: r.name,
                    value: f.built ? Math.max(0.04, f.pct) : 0,
                    text: f.built ? `lvl ${f.level}` : 'not set up',
                    color: r.color,
                    lead: <Avatar relationship={f.relationship} size={28} decorative still mood={f.built ? 'happy' : 'sleepy'} />,
                  };
                })}
              />
            </Link>
          </Section>

          {d.money && (
            <Section id="home-money" title="Money this month" lede="From Finance. Only you see this." action={<SeeAll to="/finance">Open</SeeAll>}>
              <div className="grid grid-cols-2 gap-xs">
                <KitTile to="/finance" tone="bg-r4" icon="↓" value={money(d.money.incomeCents, d.money.currency)} label="in" />
                <KitTile to="/finance" tone="bg-r2" icon="↑" value={money(d.money.expenseCents, d.money.currency)} label="out" />
                <KitTile to="/finance" tone="bg-card" plain icon="🤝" value={money(d.money.owedToMeCents, d.money.currency)} label="owed to you" hint={d.money.overdueInvoices > 0 ? `${d.money.overdueInvoices} overdue ${d.money.overdueInvoices === 1 ? 'invoice' : 'invoices'}` : 'no overdue invoices'} />
                <KitTile to="/finance" tone="bg-card" plain icon="📅" value={money(d.money.iOweCents, d.money.currency)} label="you owe" hint={d.money.dueSoon > 0 ? `${d.money.dueSoon} due within a week` : 'nothing due this week'} />
              </div>
            </Section>
          )}

          {d.shop && (
            <Section id="home-shop" title="Shop this month" lede={`${d.shop.products} ${d.shop.products === 1 ? 'product' : 'products'} live or in draft.`} action={<SeeAll to="/shop">Open</SeeAll>} span>
              <div className="rounded-card bg-card p-md shadow-toy-soft">
                <div className="grid grid-cols-3 gap-xs">
                  <KitTile tone="bg-paper" plain icon="🧾" value={String(d.shop.ordersMonth)} label="orders" />
                  <KitTile tone="bg-paper" plain icon="🪙" value={d.shop.pointsMonth.toLocaleString()} label="points" hint={d.shop.centsMonth > 0 ? money(d.shop.centsMonth, d.shop.currency) : undefined} />
                  <KitTile tone="bg-paper" plain icon="👥" value={String(d.shop.followers)} label="followers" hint={`${d.shop.views} page views`} />
                </div>
                <div className="mt-md">
                  <AreaLine values={d.shop.days.map((x) => x.orders)} max={Math.max(3, ...d.shop.days.map((x) => x.orders))} labels={d.shop.days.map((x) => weekday(x.date))} color="var(--color-r6)" height={140} empty="No orders in the last two weeks" label="Orders per day for the last fourteen days" />
                </div>
              </div>
            </Section>
          )}

          <Section id="home-go" title="Go to" lede="Every app you have switched on." action={<SeeAll to="/apps">All apps</SeeAll>} span>
            {SHORTCUT_ORDER.map((g) => {
              const list = modules.filter((m) => m.on && m.group === g);
              if (list.length === 0) return null;
              return (
                <div key={g} className="mt-sm first:mt-0">
                  <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{MODULE_GROUPS[g]}</p>
                  <ul className="mt-xs grid list-none grid-cols-3 gap-xs p-0 m-0 md:grid-cols-6">
                    {list.map((m) => (
                      <li key={m.key}>
                        <Link to={m.path} className="toy toy-soft flex min-h-[72px] flex-col items-center justify-center gap-xs rounded-tile bg-card p-xs text-center text-ink">
                          <span className="text-[24px] leading-none" aria-hidden="true">
                            {m.emoji}
                          </span>
                          <span className="block w-full truncate text-[12px] font-bold">{m.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Section>
        </>
      )}
    </Screen>
  );
}

/** One of the kit's coloured metric cards: a title with its icon, then whatever the card shows, all in white. */
function MetricCard({ to, title, emoji, tone, deep, corner, children }: { to: string; title: string; emoji: string; tone: string; deep: string; corner?: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} className="toy relative flex h-[204px] flex-col overflow-hidden rounded-card p-sm text-on-fill" style={{ background: tone, '--toy-color': deep } as CSSProperties}>
      <HeroBlobs opacity={0.1} />
      <span className="relative flex items-center justify-between gap-xs text-[14px] font-extrabold">
        <span className="flex items-center gap-xs">
          {emoji && <span aria-hidden="true">{emoji}</span>}
          {title}
        </span>
        {corner && <span className="shrink-0">{corner}</span>}
      </span>
      <span className="relative flex min-h-0 flex-1 flex-col">{children}</span>
    </Link>
  );
}

/** One of the kit's stat tiles: a small icon and a big number on a solid fill, the label under it. White on colour, brown on yellow or on a plain card. */
function KitTile({ to, tone, icon, value, label, hint, yellow = false, plain = false, children }: { to?: string; tone: string; icon: string; value: string; label: string; hint?: string; yellow?: boolean; plain?: boolean; children?: ReactNode }) {
  const fg = plain ? 'text-ink' : yellow ? 'text-on-yellow' : tone === 'bg-ink' ? 'text-on-ink' : 'text-on-fill';
  const cls = `block min-h-[96px] rounded-tile p-sm ${tone} ${fg} ${plain ? 'shadow-toy-soft' : ''}`;
  const inner = (
    <>
      <span className="flex items-baseline gap-xs">
        <span className="text-[16px]" aria-hidden="true">
          {icon}
        </span>
        <span className="font-display text-[24px] font-extrabold leading-none">{value}</span>
      </span>
      <span className="mt-xs block text-[14px] font-bold">{label}</span>
      {hint && <span className={`mt-xs block text-[12px] font-bold ${plain ? 'text-ink-soft' : 'opacity-85'}`}>{hint}</span>}
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={`${cls} toy`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export type { HomeResponse };
