import { QuoteOfTheDay } from '../components/QuoteOfTheDay';
import { RemindersSection } from '../components/Reminders';
import { BOOKS, badgeRoleOf, greetingFor, knowledgeKindIcon, LIFE_AREAS, MODULE_BY_KEY, MODULE_GROUP_ACCENT, MODULE_GROUPS, money, MOODS, RELATIONSHIP_BY_KEY, STRESS_LEVELS, type HomeResponse, type ModuleGroup, type RelationshipKey, formatCount } from '@kreators/shared';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, CalendarClock, CalendarDays, Check, ChevronRight, Clock, Coins, Compass, FaceSlightlySmiling, Flame, Footprints, HandCoins, HeartPulse, MessageCircle, MessageCirclePlus, NotebookPen, PartyPopper, Pencil, Receipt, Sparkles, Star, UserRound, Users, UsersRound } from 'lucide-react';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { PeriodPanel } from '../components/PeriodPanel';
import { Nudge } from '../components/Nudge';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { CountUp } from '../components/fx/CountUp';
import '../components/fx/spotlight';
import { AreaLine, Donut, Gauge, HBars, Legend, MultiLine, Segments, Sparkline } from '../components/Charts';
import { HeroBlobs } from '../components/Hero';
import { MoodFace } from '../components/MoodFace';
import { Person } from '../components/Person';
import { Ring } from '../components/Ring';
import { RoleBadge } from '../components/RoleBadge';
import { BookShelf } from '../components/BookShelf';
import { Screen } from '../components/Screen';
import { SearchBox } from '../components/SearchBox';
import { DailyBrief } from '../components/DailyBrief';
import { EmergenceSlot } from '../components/EmergenceSlot';
import { Section, SeeAll } from '../components/Section';
import { Segmented } from '../components/fx/Segmented';
import { useParamState } from '../lib/useParamState';
import { api } from '../lib/api';
import { BENTO_SIZE, bento } from '../lib/bento';
import { tie } from '../lib/text';
import { prettyDate, todayLocal, weekday, eventTime } from '../lib/date';
import { useGroupOrder, useModules } from '../lib/modules';
import { useAuthed, useMe } from '../lib/queries';
import { SkeletonList } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { ToggleChevron } from '../components/ToggleMark';

const SHORTCUT_ORDER: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'manage'];
const when = eventTime;
/** What is coming up wears its app's icon: a Party event, a run, a circle, or a calendar for a session or booking. */
const upIcon = (kind: string): LucideIcon => (kind === 'event' ? PartyPopper : kind === 'run' ? Footprints : kind === 'circle' ? UsersRound : CalendarDays);
/** A reading's tag is free text; a pillar key among them reads as that pillar's name, never a raw snake_case key. */
const tagLabel = (t: string) => RELATIONSHIP_BY_KEY[t as keyof typeof RELATIONSHIP_BY_KEY]?.name ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * On a phone, Home runs long: this folds a few less-checked-daily sections behind one toggle, closed to start.
 * On a laptop, Home already flows into two columns and the grid pairs half-width sections up, so here the
 * sections render exactly as they always did, with no toggle and no extra wrapper in the way of that pairing.
 */
function MoreOnHome({ children }: { children: ReactNode }) {
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  if (!isPhone) return <div className="contents">{children}</div>;
  return (
    <div className="contents">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="toy toy-flat col-span-full flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile bg-paper px-sm text-left text-[16px] font-bold aria-expanded:bg-line">
        More on Home
        <ToggleChevron open={open} className="text-ink-soft" />
      </button>
      {open && children}
    </div>
  );
}
const SOURCE_META = {
  checkin: { label: 'Check-ins', color: 'var(--color-r3)' },
  spark: { label: 'Small acts', color: 'var(--color-r6)' },
  task: { label: 'Tasks', color: 'var(--color-r4)' },
  ripple: { label: 'Pyramids getting stronger', color: 'var(--color-r2)' },
  other: { label: 'Other', color: 'var(--color-r5)' },
} as const;
/** On a solid colour fill everything is white; a translucent white is the track. */
const XP_VIEWS = [
  { value: 'day', label: 'By day' },
  { value: 'source', label: 'By source' },
] as const;
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
/** True from the tablet width up (the same width and height the md layout uses), following the window as it changes. */
function useWide() {
  const q = '(min-width: 768px) and (min-height: 480px)';
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return on;
}

export function Home() {
  // Home's metrics lay out as a bento (a large Life score beside two cards) from the tablet width up; below it they are a sideways row.
  const wideMetrics = useWide();
  const me = useMe();
  const date = todayLocal();
  const hour = new Date().getHours();
  const q = useAuthed(['home', date], () => api.home(date, hour));
  const { modules } = useModules();
  const shortcutGroups = useGroupOrder(SHORTCUT_ORDER);
  const [xpView, setXpView] = useParamState('xp', 'day');
  const d = q.data;
  // The three half-width extras pair up in two columns; when one is left over it takes the whole row, so nothing stands alone.
  const extras = d ? ([d.life ? 'life' : null, d.resources.length > 0 ? 'reads' : null, d.money ? 'money' : null].filter(Boolean) as string[]) : [];
  const lastOptional = extras.length % 2 === 1 ? extras[extras.length - 1] : null;
  const user = me.data?.user;
  const firstName = user?.displayName?.split(' ')[0] ?? '';
  // The bell swings once when the unread count goes up while Home is open (never on the first load); still under reduced motion.
  const bell = useRef<HTMLSpanElement>(null);
  const lastUnread = useRef<number | null>(null);
  const unread = d?.unread;
  useEffect(() => {
    if (unread === undefined) return;
    const before = lastUnread.current;
    lastUnread.current = unread;
    const el = bell.current;
    if (before === null || unread <= before || !el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { rotation: 0 });
      return;
    }
    const tl = gsap.timeline();
    tl.set(el, { transformOrigin: '50% 0%' }).to(el, { keyframes: { rotation: [0, 18, -14, 9, -5, 0] }, duration: 0.7, ease: 'power1.out' });
    return () => {
      tl.kill();
    };
  }, [unread]);
  const identity = me.data?.identity ?? null;
  const myPage = user ? (user.handle ? `/u/${user.handle}` : `/people/${user.id}`) : '/profile';
  const moodToday = d ? (MOODS.find((m) => m.value === d.trackers.mood.today) ?? null) : null;
  const recentMoods = d ? d.trackers.mood.week.filter((m): m is number => m !== null).slice(-3) : [];

  return (
    <Screen columns className="screen-even">
      <header className="relative -mx-md overflow-hidden rounded-b-card night-card px-md pt-lg pb-md text-on-fill md:mx-0 md:mt-md md:rounded-card">
        <HeroBlobs opacity={0.06} kind="cosmos" />
        <div className="relative flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
          <p className="order-2 m-0 text-[14px] font-bold opacity-80 md:order-1">
            <Icon icon={CalendarDays} size={16} className="mr-xs inline-block align-[-3px]" />
            {prettyDate(date)}, {greetingFor(hour).toLowerCase()}
          </p>
          <div className="order-1 flex items-center justify-between gap-xs md:order-2 md:shrink-0 md:justify-end">
            <Link to={myPage} className="toy inline-flex min-h-[44px] items-center gap-xs rounded-pill bg-white/15 px-sm text-[14px] font-bold text-on-fill">
              <Icon icon={UserRound} size={18} />
              My page
            </Link>
          <Link to="/inbox" aria-label={d && d.unread > 0 ? `Inbox, ${d.unread} unread` : 'Inbox'} className="toy relative flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-white/15 text-on-fill">
            <span ref={bell} className="inline-flex">
              <Icon icon={Bell} size={20} />
            </span>
            {d && d.unread > 0 && <span className="absolute -top-[2px] -right-[2px] flex min-w-[18px] items-center justify-center rounded-pill bg-r2 px-xs text-[11px] font-extrabold leading-[18px] text-on-fill">{d.unread > 9 ? '9+' : d.unread}</span>}
          </Link>
          </div>
        </div>
        <div className="relative mt-sm flex items-center gap-sm">
          <Link to="/you" aria-label="Profile" className="relative shrink-0">
            <span className="flex size-[64px] items-center justify-center overflow-hidden rounded-pill bg-paper">
              {identity ? <Person stage={identity.stage.stage} size={52} decorative /> : <Avatar relationship="self" size={44} decorative still />}
            </span>
            {user && <RoleBadge role={badgeRoleOf(user)} className="absolute right-0 bottom-0" />}
          </Link>
          <div className="min-w-0">
            <h1 className="text-[28px] leading-[1.2] [overflow-wrap:anywhere] sm:text-[30px] text-on-fill">{firstName ? `Hi, ${firstName}!` : 'Hi there!'}</h1>
            {d && (
              <p className="fill-row m-0 flex flex-wrap items-center gap-x-xs text-[14px] font-bold opacity-90" aria-label="At a glance">
                <Link to="/tower" className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">
                  <Icon icon={Star} size={14} className="mr-xs inline-block align-[-2px]" />Level {d.xp.level}
                </Link>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <Link to="/today" className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">
                  <Icon icon={Flame} size={14} className="mr-xs inline-block align-[-2px]" />
                  {d.today.streak} {d.today.streak === 1 ? 'day' : 'days'}
                </Link>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <Link to="/mood" className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">
                  {moodToday ? <MoodFace value={moodToday.value} size={16} className="mr-xs inline-block align-[-3px]" /> : <Icon icon={FaceSlightlySmiling} size={14} className="mr-xs inline-block align-[-2px]" />}
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

      <RemindersSection always />
      <QuoteOfTheDay date={date} />
      <DailyBrief date={date} hour={hour} />


      {q.isPending && (
        <div className="span-all mt-md">
          <SkeletonList count={2} lines={3} label="Adding up your week" />
        </div>
      )}
      {q.isError && (
        <div className="span-all mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-bold min-w-0 flex-1 basis-[60%]">Could not load your numbers.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          <Section id="home-metrics" title="Your metrics" lede="Where you stand today. Tap one for the detail." action={<SeeAll to="/life">Life</SeeAll>} span>
            <ul className="bento-md -mx-md flex snap-x scroll-px-md list-none gap-xs overflow-x-auto px-md pb-xs scrollbar-none m-0 md:mx-0 md:overflow-visible md:px-0">
              <li data-pillar="lover_partner" className={`w-[168px] shrink-0 snap-start md:w-auto md:[&>a]:h-full ${BENTO_SIZE.large}`}>
                <MetricCard to="/life" title="Life score" icon={Compass} tone="var(--color-r4)" deep="var(--deep-lover_partner)" corner={<Avatar relationship="lover_partner" size={36} decorative mood={(d.life?.overall ?? 0) >= 60 ? 'excited' : 'happy'} />}>
                  <span className="flex flex-1 items-center justify-center">
                    {/* In proportion to its card: 140px in the phone's sideways row, 240px in the large bento cell beside two cards. */}
                    <Gauge value={(d.life?.overall ?? 0) / 100} size={wideMetrics ? 240 : 140} stroke={wideMetrics ? 20 : 13} color={WHITE} track={WHITE_TRACK} label={`Life ${d.life?.overall ?? 0} of 100`}>
                      <span className="flex flex-col items-center leading-none">
                        <span className={`font-display font-extrabold ${wideMetrics ? 'text-[56px]' : 'text-[34px]'}`}>
                          <CountUp value={d.life?.overall ?? 0} />
                        </span>
                        <span className={`mt-xs font-bold opacity-90 ${wideMetrics ? 'text-[16px]' : 'text-[12px]'}`}>{d.life?.label ?? ''}</span>
                      </span>
                    </Gauge>
                  </span>
                </MetricCard>
              </li>
              <li data-pillar="friendship" className={`w-[168px] shrink-0 snap-start md:w-auto ${BENTO_SIZE.medium}`}>
                <MetricCard to="/mood" title="Mood" tone="var(--color-r2)" deep="var(--deep-friendship)" corner={<MoodFace value={moodToday?.value ?? 3} size={40} color="rgba(255,255,255,0.25)" face="var(--color-on-fill)" />}>
                  <span className="block font-display text-[26px] font-extrabold leading-none">{moodToday ? moodToday.name : 'Not logged'}</span>
                  <span className="mt-xs block flex-1">
                    <AreaLine values={d.trackers.mood.week} max={5} min={1} color={WHITE} height={80} onFill axes={false} empty="No moods yet" label="Mood for the last seven days" />
                  </span>
                </MetricCard>
              </li>
              <li data-pillar="guru" className={`w-[168px] shrink-0 snap-start md:w-auto ${BENTO_SIZE.medium}`}>
                <MetricCard to="/wellbeing" title="Wellbeing" icon={HeartPulse} tone="var(--color-r6)" deep="var(--deep-guru)" corner={<Avatar relationship="guru" size={36} decorative mood={d.trackers.score >= 60 ? 'excited' : 'happy'} />}>
                  <span className="flex flex-1 items-center justify-center">
                    <Ring value={d.trackers.score / 100} size={104} stroke={11} color={WHITE} track={WHITE_TRACK} label={`Wellbeing ${d.trackers.score} of 100`}>
                      <span className="flex flex-col items-center leading-none">
                        <span className="font-display text-[30px] font-extrabold">
                          <CountUp value={d.trackers.score} />
                        </span>
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
              <KitTile to="/today" tone="bg-r4" icon={Flame} value={String(d.today.streak)} label="day streak" hint={d.today.checkedIn ? 'checked in today' : 'not yet today'} />
              <KitTile to="/today" tone="bg-r2" icon={Sparkles} value={`+${d.xp.today}`} label="xp today" hint={`${d.xp.week} this week`} />
              <KitTile to="/rewards" tone="bg-r3" yellow icon={Coins} value={formatCount(d.points)} label="points" hint="trade for rewards" />
              <KitTile to="/tower" tone="bg-ink" icon={Star} value={`Level ${d.xp.level}`} label={`${d.xp.into} of ${d.xp.span} xp`} hint={`${d.xp.span - d.xp.into} to level ${d.xp.level + 1}`}>
                <span className="mt-xs block h-[6px] overflow-hidden rounded-pill bg-on-ink/20" aria-hidden="true">
                  <span className="block h-full rounded-pill bg-on-ink" style={{ width: `${Math.round((d.xp.into / Math.max(1, d.xp.span)) * 100)}%` }} />
                </span>
              </KitTile>
            </div>
                      <Nudge className="mt-sm" text={`${d.xp.span - d.xp.into} xp to level ${d.xp.level + 1}. A ticked task is 20, a check-in 10.`} />
          </Section>

          <PeriodPanel id="home-period" parts={['daily', 'wellbeing', 'finance', 'shop']} span />
          <Section id="home-trends" title="This week" lede="Sleep, calm and mood as scores out of a hundred, day by day. Where the lines dip is where to look." action={<SeeAll to="/wellbeing">Wellbeing</SeeAll>} span>
            <div className="rounded-card bg-card p-md shadow-toy-soft">
              {/* Physical, mental, emotional: the order of the five areas, the same as Life's chart. */}
              <MultiLine
                series={[
                  { values: d.trackers.sleep.week.map((h) => (h === null ? null : (Math.max(4, Math.min(8, h)) - 4) * 25)), color: 'var(--color-r6)', label: 'Sleep' },
                  { values: d.trackers.stress.week.map((st) => (st === null ? null : ((5 - st) / 4) * 100)), color: 'var(--color-r2)', label: 'Calm' },
                  { values: d.trackers.mood.week.map((m) => (m === null ? null : ((m - 1) / 4) * 100)), color: 'var(--color-r3)', label: 'Mood' },
                ]}
                max={100}
                labels={d.days.slice(-7).map((x) => weekday(x.date))}
                allLabels
                height={180}
                label="Sleep, calm and mood as scores out of a hundred for the last seven days"
                empty="Log a night, a stress level or a mood and the lines appear."
              />
            </div>
          </Section>

          <EmergenceSlot app="home" max={3} />

          <Section id="home-today" title="Daily" lede="Tick each box when you have done it." action={<SeeAll to="/today">Open</SeeAll>}>
            <div data-pillar="lover_partner" className="relative flex flex-col overflow-hidden rounded-card bg-r4 p-md text-on-fill">
              <HeroBlobs kind="daisy" />
              <div className="relative flex flex-1 flex-col">
                <div className="flex items-center justify-between gap-sm">
                  <div className="flex items-center gap-sm">
                    <Ring value={d.today.doneCount / 3} size={64} stroke={8} color={WHITE} track={WHITE_TRACK} label={`${d.today.doneCount} of 3 done`}>
                      <span className="font-display text-[18px] font-extrabold">{d.today.doneCount}/3</span>
                    </Ring>
                    <p className="m-0">
                      <span className="block font-display text-[24px] font-extrabold leading-none">{d.today.doneCount === 3 ? 'All three done' : `${3 - d.today.doneCount} to go`}</span>
                      <span className="mt-xs block text-balance text-[14px] font-bold opacity-90">{tie('Check in, small act, one task.')}</span>
                    </p>
                  </div>
                  <span className="shrink-0" aria-hidden="true">
                    <Avatar relationship={d.today.sparkRelationship} size={64} decorative mood={d.today.sparkDone ? 'excited' : d.today.doneCount > 0 ? 'happy' : 'sleepy'} />
                  </span>
                </div>
                <ul className="fill-row-all mt-sm flex list-none flex-wrap gap-xs p-0 m-0" aria-label="The three boxes">
                  {[
                    ['Check in', d.today.checkedIn],
                    [`${RELATIONSHIP_BY_KEY[d.today.sparkRelationship].character}'s small act`, d.today.sparkDone],
                    [d.today.taskDone ? 'A task' : d.today.tasksWaiting > 0 ? `${d.today.tasksWaiting} ${d.today.tasksWaiting === 1 ? 'task' : 'tasks'} waiting` : 'No task due', d.today.taskDone],
                  ].map(([text, done]) => (
                    <li key={String(text)} className={`inline-flex min-h-[32px] items-center gap-xs rounded-pill px-sm text-[12px] font-extrabold ${done ? 'bg-card text-ink' : 'bg-ink-fixed/20 text-on-fill'}`}>
                      {done ? (
                        <Icon icon={Check} size={14} strokeWidth={3} />
                      ) : (
                        <span className="block size-[12px] rounded-[4px] border-2 border-current" aria-hidden="true" />
                      )}
                      {String(text)}
                    </li>
                  ))}
                </ul>
                <div className="mt-sm rounded-tile bg-ink-fixed/20 p-sm">
                  <p className="m-0 font-display text-[18px] font-extrabold leading-tight">{d.nudge.lead}</p>
                  <p className="mt-xs m-0 text-[14px] font-semibold opacity-95">{d.nudge.body}</p>
                </div>
                <div className="mt-auto flex items-stretch gap-xs pt-sm">
                  <Link to={d.nudge.path} className="toy inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-pill bg-card px-md text-[16px] font-bold text-ink">
                    {d.nudge.action}
                  </Link>
                  <Link to="/today" aria-label="Open Today" className="toy flex min-h-[48px] w-[48px] shrink-0 items-center justify-center rounded-pill bg-white/25 text-on-fill">
                    <Icon icon={ArrowRight} size={20} />
                  </Link>
                </div>
              </div>
            </div>
          </Section>

          <Section id="home-trackers" title="Trackers" lede="Tap a row to log today." action={<SeeAll to="/wellbeing">Wellbeing</SeeAll>}>
            <ul className="flex list-none flex-col gap-xs p-0 m-0">
              {[
                {
                  key: 'mindful', pillar: 'lover_partner', to: '/mindful', name: 'Mindfulness', icon: MODULE_BY_KEY.mindful?.icon, tone: 'var(--tint-green)',
                  value: d.trackers.mindful.minutesWeek > 0 ? `${d.trackers.mindful.minutesWeek} min this week` : 'none this week',
                  visual: <Sparkline values={d.trackers.mindful.week} max={60} color="var(--color-r4)" width={80} height={32} />,
                },
                {
                  key: 'sleep', pillar: 'guru', to: '/sleep', name: 'Sleep', icon: MODULE_BY_KEY.sleep?.icon, tone: 'var(--tint-purple)',
                  value: d.trackers.sleep.avg7 === null ? 'not logged' : `${d.trackers.sleep.avg7.toFixed(1)} h a night`,
                  visual: (
                    <Ring value={d.trackers.sleep.avg7 === null ? 0 : (Math.max(4, Math.min(8, d.trackers.sleep.avg7)) - 4) / 4} size={44} stroke={5} color="var(--color-r6)" track="var(--color-line)" label="Sleep quality">
                      <span className="text-[12px] font-extrabold">{d.trackers.sleep.avg7 === null ? '–' : Math.round(((Math.max(4, Math.min(8, d.trackers.sleep.avg7)) - 4) / 4) * 100)}</span>
                    </Ring>
                  ),
                },
                {
                  key: 'journal', pillar: 'friendship', to: '/journal', name: 'Journal', icon: MODULE_BY_KEY.journal?.icon, tone: 'var(--tint-orange)',
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
                  key: 'stress', pillar: 'parent_child', to: '/stress', name: 'Stress', icon: MODULE_BY_KEY.stress?.icon, tone: 'var(--tint-yellow)',
                  value: d.trackers.stress.latest === null ? 'not logged' : `Level ${d.trackers.stress.latest} (${STRESS_LEVELS[d.trackers.stress.latest - 1] ?? ''})`,
                  visual: <Segments value={d.trackers.stress.latest} color="var(--color-r3)" label="Stress level out of five" />,
                },
                {
                  key: 'mood', to: '/mood', name: 'Mood', icon: MODULE_BY_KEY.mood?.icon, tone: 'var(--tint-brown)',
                  value: moodToday ? `${moodToday.name} today` : 'not logged today',
                  visual:
                    recentMoods.length === 0 ? (
                      <span className="text-[12px] font-bold text-ink-soft">no moods yet</span>
                    ) : (
                      <span className="flex items-center gap-xs" role="img" aria-label={`Last moods: ${recentMoods.map((m) => MOODS[m - 1]?.name ?? '').join(', then ')}`}>
                        {recentMoods.map((m, i) => (
                          <span key={i} className="flex items-center gap-xs">
                            {i > 0 && (
                              <Icon icon={ArrowRight} size={12} className="text-ink-mute" />
                            )}
                            <MoodFace value={m} size={28} />
                          </span>
                        ))}
                      </span>
                    ),
                },
              ].map((r) => (
                <li key={r.key}>
                  <Link to={r.to} data-pillar={r.pillar} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink">
                    {r.key === 'mood' && moodToday ? (
                      <MoodFace value={moodToday.value} size={48} />
                    ) : (
                      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill text-ink" style={{ background: r.tone }}>
                        <AppIcon name={r.icon} size={22} />
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

          <Section id="home-next" title="Up next" lede="Events, runs and circles you joined." action={<SeeAll to="/party">Party</SeeAll>}>
            <div data-pillar="lover_partner" className="flex flex-col rounded-card bg-card p-md shadow-toy-soft">
              <div className="flex items-center justify-between gap-sm">
                <p className="m-0 flex items-baseline gap-xs">
                  <span className="font-display text-[40px] font-extrabold leading-none">{d.upNext.length}</span>
                  <span className="text-[16px] font-bold">coming up</span>
                </p>
                <Link to="/party" aria-label="Open Party" className="toy flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-r4 text-on-fill" style={{ '--toy-color': 'var(--deep-lover_partner)' } as CSSProperties}>
<Icon icon={ArrowRight} size={20} />
                </Link>
              </div>
              <p className="mt-xs m-0 flex flex-wrap gap-sm text-[12px] font-bold text-ink-soft">
                {(['event', 'run', 'session', 'booking', 'circle'] as const).map((k) => {
                  const n = d.upNext.filter((u) => u.kind === k).length;
                  if (n === 0) return null;
                  return (
                    <span key={k}>
                      <Icon icon={upIcon(k)} size={14} className="mr-xs inline-block align-[-2px]" />
                      {n} {k === 'booking' ? (n === 1 ? 'booking you host' : 'bookings you host') : n === 1 ? k : `${k}s`}
                    </span>
                  );
                })}
                {d.upNext.length === 0 && <span>Nothing booked. Meetups are under Party, run clubs under Kreators Run, small groups near you under Circles.</span>}
              </p>
              {d.upNext.length > 0 && (
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {d.upNext.map((u) => (
                    <li key={`${u.kind}-${u.path}-${u.at}`}>
                      <Link to={u.path} className="group toy toy-flat flex items-center gap-sm rounded-tile bg-paper p-sm text-ink">
                        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-ink-soft shadow-toy-soft">
                          <Icon icon={upIcon(u.kind)} size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-bold">{u.title}</span>
                          <span className="block text-[12px] font-bold text-ink-soft">
                            <Icon icon={Clock} size={12} className="mr-xs inline-block align-[-2px]" />
                            {when(u.at)}
                            {u.note ? `, ${u.note}` : ''}
                          </span>
                        </span>
                        <Icon icon={ChevronRight} size={18} className="transition-transform motion-safe:group-hover:translate-x-xs text-ink-mute" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex justify-center gap-md pt-sm">
                <Link to="/party" className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-ink-mute underline-offset-4 hover:underline">
                  All events
                </Link>
                <Link to="/circles" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[14px] font-bold text-ink-mute underline-offset-4 hover:underline">
                  Circles
                </Link>
              </div>
            </div>
          </Section>

          <Section id="home-companion" title="Companion" lede="A chat that knows how you are doing. Not a therapist.">
            {/* Centred in its half: when Up next beside it is taller, the room goes above and below, never one band at the foot. */}
            <div data-pillar="guru" className="relative flex flex-col justify-center overflow-hidden rounded-card bg-ink p-md text-on-ink">
              <HeroBlobs opacity={0.06} kind="violet" />
              <div className="relative z-10 max-w-[60%]">
                <p className="m-0 font-display text-[40px] font-extrabold leading-none">{formatCount(d.companion.messages)}</p>
                <p className="mt-xs m-0 text-[18px] font-extrabold">{d.companion.messages === 1 ? 'message' : 'messages'}</p>
                <p className="mt-xs m-0 text-[14px] font-bold opacity-80">
                  <Icon icon={MessageCircle} size={14} className="mr-xs inline-block align-[-2px]" />
                  {d.companion.messages === 0 ? 'Say what is on your mind.' : 'Pick up where you left off.'}
                </p>
                <p className="m-0 text-[14px] font-bold opacity-80">
                  <Icon icon={NotebookPen} size={14} className="mr-xs inline-block align-[-2px]" />Or write it in the journal.
                </p>
              </div>
              <span className="pointer-events-none absolute top-1/2 right-md -translate-y-1/2 opacity-90" aria-hidden="true">
                <Avatar relationship="guru" size={112} decorative mood="happy" />
              </span>
              <div className="relative z-10 mt-md flex gap-sm">
                <Link to="/companion" aria-label="Talk to the companion" className="toy flex size-[56px] items-center justify-center rounded-pill bg-r4 text-on-fill" style={{ '--toy-color': 'var(--deep-lover_partner)' } as CSSProperties}>
<Icon icon={MessageCirclePlus} size={24} />
                </Link>
                <Link to="/journal" aria-label="Write in the journal" className="toy flex size-[56px] items-center justify-center rounded-pill bg-r2 text-on-fill" style={{ '--toy-color': 'var(--deep-friendship)' } as CSSProperties}>
<Icon icon={Pencil} size={22} />
                </Link>
              </div>
            </div>
          </Section>

          <MoreOnHome>
          {/* One question, one box: how much xp came in over the last two weeks, by day or by what earned it. The tab lives in the URL. */}
          <Section id="home-trend" title="Xp, last 14 days" lede={xpView === 'source' ? 'The last two weeks, by what you did.' : 'Xp a day. A green dot is a task ticked.'} action={<SeeAll to="/today">Daily</SeeAll>} span className="col-span-full">
            <div className="rounded-card bg-card p-md shadow-toy-soft">
              <Segmented label="Show xp" value={xpView === 'source' ? 'source' : 'day'} onChange={(v) => setXpView(v)} options={XP_VIEWS} />
              {xpView === 'source' ? (
                (() => {
                  const total = d.xpBySource.reduce((t, x) => t + x.xp, 0);
                  const top = Math.max(1, ...d.xpBySource.map((x) => x.xp));
                  const rows = [...d.xpBySource].sort((a, b) => b.xp - a.xp);
                  return total === 0 ? (
                    <p className="mt-md m-0 rounded-tile bg-paper p-md text-center text-[14px] font-semibold text-ink-soft">No xp in the last two weeks yet. Tick a box on Daily and it shows here, by what earned it.</p>
                  ) : (
                    // The ring says how the two weeks split; the bars beside it compare the sources, biggest first, each with its xp and share.
                    <div className="mt-md grid items-center gap-md sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-lg">
                      <div className="flex justify-center">
                        <Donut segments={rows.map((x) => ({ value: x.xp, color: SOURCE_META[x.source].color, label: SOURCE_META[x.source].label }))} size={168} stroke={22} label="Xp by source">
                          <span className="flex flex-col items-center leading-none">
                            <span className="font-display text-[32px] font-extrabold tabular-nums">{formatCount(total)}</span>
                            <span className="mt-xs text-[12px] font-bold text-ink-soft">xp in 14 days</span>
                          </span>
                        </Donut>
                      </div>
                      <HBars
                        stacked
                        label="Xp by source over the last fourteen days"
                        rows={rows.map((x) => ({ key: x.source, label: SOURCE_META[x.source].label, value: x.xp / top, text: `${formatCount(x.xp)} · ${Math.round((x.xp / total) * 100)}%`, color: SOURCE_META[x.source].color }))}
                      />
                    </div>
                  );
                })()
              ) : (
                <div className="mt-md">
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
              )}
            </div>
          </Section>
          </MoreOnHome>

          {d.life && (
            <Section id="home-life" title="Life" lede="Your five areas. Only you see this." action={<SeeAll to="/life">Open</SeeAll>} span={lastOptional === 'life'}>
              <Link to="/life" className="toy toy-soft flex flex-col justify-center rounded-card bg-card p-md text-ink">
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
                        <span className="w-full text-balance break-words text-center text-[12px] font-bold leading-tight text-ink-soft">{meta.name}</span>
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

          {d.resources.length > 0 && (
            <Section id="home-reads" title="Knowledge" lede="Reads and guides from the library." action={<SeeAll to="/knowledge">See all</SeeAll>} span={lastOptional === 'reads'}>
              <ul className={`grid list-none grid-cols-2 gap-xs p-0 m-0 ${lastOptional === 'reads' ? 'md:grid-cols-4' : ''}`}>
                {d.resources.map((r, i) => (
                  <li key={r.id} className={`flex ${bento(i, d.resources.length, 2, lastOptional === 'reads' ? 4 : 2)}`}>
                    <Link to={`/knowledge/${r.id}`} data-pillar="lover_partner" className="toy toy-soft flex min-h-[160px] w-full flex-col rounded-card bg-card p-sm text-ink">
                      <span className="flex items-start justify-between gap-xs">
                        <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-r4 text-on-fill">
                          <AppIcon name={knowledgeKindIcon(r.kind)} size={22} />
                        </span>
                        {r.tag && <StatusTag fit tone="calm">{tagLabel(r.tag)}</StatusTag>}
                      </span>
                      <span className="mt-xs block text-balance text-[16px] font-bold leading-snug">{tie(r.title)}</span>
                      <span className="mt-xs block text-[12px] font-bold text-ink-soft">{r.kind}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {d.money && (
            <Section id="home-money" title="Money this month" lede="From Finance. Only you see this." action={<SeeAll to="/finance">Open</SeeAll>} span={lastOptional === 'money'}>
              <div className="grid grid-cols-2 gap-xs">
                <KitTile to="/finance" tone="bg-r4" icon={ArrowDownLeft} value={money(d.money.incomeCents, d.money.currency)} label="in" />
                <KitTile to="/finance" tone="bg-r2" icon={ArrowUpRight} value={money(d.money.expenseCents, d.money.currency)} label="out" />
                <KitTile to="/finance" tone="bg-card" plain icon={HandCoins} value={money(d.money.owedToMeCents, d.money.currency)} label="owed to you" hint={d.money.overdueInvoices > 0 ? `${d.money.overdueInvoices} overdue ${d.money.overdueInvoices === 1 ? 'invoice' : 'invoices'}` : 'no overdue invoices'} />
                <KitTile to="/finance" tone="bg-card" plain icon={CalendarClock} value={money(d.money.iOweCents, d.money.currency)} label="you owe" hint={d.money.dueSoon > 0 ? `${d.money.dueSoon} due within a week` : 'nothing due this week'} />
              </div>
            </Section>
          )}

          <Section id="home-tower" title="Your pillars" span lede="Seven pillars of your life. The bar shows how far each one has come." action={<SeeAll to="/tower">Open</SeeAll>}>
            <Link to="/tower" className="toy toy-soft block rounded-card bg-card p-md text-ink">
              <HBars
                label="Pillar levels"
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

          {/* Book: the founder's three books, the whole row so it never pairs with a half. Covers only; the page has the rest. */}
          <Section id="home-books" title="Books" span lede="Three books by Shubham Aggarwal, with a course for each." action={<SeeAll to="/book">Open</SeeAll>}>
            <BookShelf href={(b) => `/book#${b.slug}`} />
          </Section>

          {d.shop && (
            <Section id="home-shop" title="Shop this month" lede={`${d.shop.products} ${d.shop.products === 1 ? 'product' : 'products'} live or in draft.`} action={<SeeAll to="/shop">Open</SeeAll>} span>
              <div className="rounded-card bg-card p-md shadow-toy-soft">
                <div className="grid grid-cols-3 gap-xs">
                  <KitTile tone="bg-paper" plain icon={Receipt} value={String(d.shop.ordersMonth)} label="orders" />
                  <KitTile tone="bg-paper" plain icon={Coins} value={formatCount(d.shop.pointsMonth)} label="points" hint={d.shop.centsMonth > 0 ? money(d.shop.centsMonth, d.shop.currency) : undefined} />
                  <KitTile tone="bg-paper" plain icon={Users} value={String(d.shop.followers)} label="followers" hint={`${d.shop.views} page views`} />
                </div>
                <div className="mt-md">
                  <AreaLine values={d.shop.days.map((x) => x.orders)} max={Math.max(3, ...d.shop.days.map((x) => x.orders))} labels={d.shop.days.map((x) => weekday(x.date))} color="var(--color-r6)" height={140} empty="No orders in the last two weeks" label="Orders per day for the last fourteen days" />
                </div>
              </div>
            </Section>
          )}

          <Section id="home-go" title="Go to" lede="Every app you have switched on." action={<SeeAll to="/apps">All apps</SeeAll>} span>
            {shortcutGroups.map((g) => {
              const list = modules.filter((m) => m.on && m.group === g);
              if (list.length === 0) return null;
              return (
                <div key={g} data-pillar={MODULE_GROUP_ACCENT[g]} className="mt-sm first:mt-0">
                  <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{MODULE_GROUPS[g]}</p>
                  <ul className="mt-xs grid list-none grid-cols-3 gap-xs p-0 m-0 md:grid-cols-6">
                    {list.map((m, i) => (
                      <li key={m.key} className={bento(i, list.length, 3, 6)}>
                        <Link to={m.path} className="toy toy-soft flex min-h-[72px] flex-col items-center justify-center gap-xs rounded-tile bg-card p-xs text-center text-ink">
                          <AppIcon name={m.icon} size={24} />
                          <span className="block w-full text-balance break-words text-[12px] font-bold leading-tight">{m.name}</span>
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
function MetricCard({ to, title, icon, tone, deep, corner, children }: { to: string; title: string; icon?: LucideIcon; tone: string; deep: string; corner?: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} className="toy fx-spot relative flex h-[204px] flex-col overflow-hidden rounded-card p-sm text-on-fill" style={{ background: `linear-gradient(140deg, ${tone}, color-mix(in oklab, ${tone} 72%, var(--fill-shade)))`, '--toy-color': deep } as CSSProperties}>
      <HeroBlobs opacity={0.1} seed={title} />
      <span className="relative flex items-center justify-between gap-xs text-[14px] font-extrabold">
        <span className="flex items-center gap-xs">
          {icon && <Icon icon={icon} size={16} />}
          {title}
        </span>
        {corner && <span className="shrink-0">{corner}</span>}
      </span>
      <span className="relative flex min-h-0 flex-1 flex-col">{children}</span>
    </Link>
  );
}

/** One of the kit's stat tiles: a small icon and a big number on a solid fill, the label under it. White on colour, brown on yellow or on a plain card. */
function KitTile({ to, tone, icon, value, label, hint, yellow = false, plain = false, children }: { to?: string; tone: string; icon: LucideIcon; value: string; label: string; hint?: string; yellow?: boolean; plain?: boolean; children?: ReactNode }) {
  const fg = plain ? 'text-ink' : yellow ? 'text-on-yellow' : tone === 'bg-ink' ? 'text-on-ink' : 'text-on-fill';
  const cls = `block min-h-[96px] rounded-tile p-sm ${tone} ${fg} ${plain ? 'shadow-toy-soft' : ''}`;
  const pillar = ({ 'bg-r4': 'lover_partner', 'bg-r2': 'friendship', 'bg-r3': 'parent_child' } as Record<string, RelationshipKey>)[tone];
  const inner = (
    <>
      <span className="flex items-baseline gap-xs">
        <Icon icon={icon} size={16} className="self-center" />
        <span className="font-display text-[24px] font-extrabold leading-none">{value}</span>
      </span>
      <span className="mt-xs block text-[14px] font-bold">{label}</span>
      {hint && <span className={`mt-xs block text-[12px] font-bold ${plain ? 'text-ink-soft' : 'opacity-85'}`}>{hint}</span>}
      {children}
    </>
  );
  return to ? (
    <Link to={to} data-pillar={pillar} className={`${cls} toy`}>
      {inner}
    </Link>
  ) : (
    <div data-pillar={pillar} className={cls}>{inner}</div>
  );
}

export type { HomeResponse };
