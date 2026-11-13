import { QuoteOfTheDay } from '../components/QuoteOfTheDay';
import { RemindersSection } from '../components/Reminders';
import { badgeRoleOf, greetingFor, knowledgeKindIcon, LIFE_AREAS, MODULE_BY_KEY, MODULE_GROUP_ACCENT, MODULE_GROUPS, money, MOODS, RELATIONSHIP_BY_KEY, STRESS_LEVELS, type HomeResponse, type ModuleGroup, type RelationshipKey, formatCount } from '@kreators/shared';
import type { CSSProperties, ReactNode } from 'react';
import { Suspense, useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, CalendarDays, Check, Clock, Coins, Compass, EyeOff, FaceSlightlySmiling, Flame, Footprints, HandCoins, HeartPulse, MessageCircle, MessageCirclePlus, NotebookPen, PartyPopper, Pencil, Receipt, Sparkles, Star, UserRound, Users, UsersRound } from 'lucide-react';
import { AppIcon } from '../components/AppIcon';
import { AppTile } from '../components/AppTile';
import { Icon } from '../components/Icon';
import { PeriodPanel } from '../components/PeriodPanel';
import { Nudge } from '../components/Nudge';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { CountUp } from '../components/fx/CountUp';
import '../components/fx/spotlight';
import { AreaLine, Donut, Gauge, HBars, MultiLine, Segments, Sparkline } from '../components/Charts';
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
import { BENTO_SIZE, evenGrid, evenTile } from '../lib/bento';
import { tie } from '../lib/text';
import { useWide } from '../lib/useWide';
import { prettyDate, todayLocal, weekday, eventTime } from '../lib/date';
import { keepForApps, useFits, useGroupOrder, useHiddenApps, useModules } from '../lib/modules';
import { useAuthed, useMe } from '../lib/queries';
import { SkeletonList } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { IconTag } from '../components/FactTag';
import { CardHead } from '../components/CardHead';
import { Reveal } from '../components/fx/Reveal';
import { ToggleChevron, ToggleIcon } from '../components/ToggleMark';
import { lazyNamed } from '../lib/lazy';
import { useFocusPortal } from '../lib/focusPortal';

/** Go to's hidden-apps panel, downloaded only when its button is first opened (Home is in the first download). */
const HiddenAppsPanel = lazyNamed(() => import('../components/AppGroups'), 'HiddenAppsPanel');
const SHORTCUT_ORDER: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'manage'];
const when = eventTime;
// Even rows (lib/bento.ts): the reads four to a row across the whole width (one on a phone and a tablet). The Go to tiles are one sideways row on a phone
// (the columns below only start from the tablet, `md:grid`), then three, four and five to a row, so a tile keeps about 145px or more.
const READ_COLS = { base: 1, lg: 4 } as const;
const GO_COLS = { base: 3, lg: 4, xl: 5 } as const;
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
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="toy toy-flat col-span-full mt-lg flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile bg-paper px-sm text-left text-headline aria-expanded:bg-line">
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
export function Home() {
  // Home's metrics lay out as a bento (a large Life score beside two cards) from the tablet width up; below it they are a sideways row.
  const wideMetrics = useWide();
  const me = useMe();
  const date = todayLocal();
  const hour = new Date().getHours();
  const q = useAuthed(['home', date], () => api.home(date, hour));
  const { modules } = useModules();
  // A widget on Home belongs to its app: it shows only while that app is on for the person (the founder, 2026-11-06: "when apps are
  // toggled off then widget should go off in home"). Home's own numbers, Daily, the pillars and xp are core and always show.
  const isOn = (key: string) => modules.some((m) => m.key === key && m.on);
  const mindfulOn = isOn('mindful');
  const setTarget = useFocusPortal((s) => s.setTarget);
  const focusHeight = useFocusPortal((s) => s.height);
  // A steady ref callback, so the slot is set once and the living clock is not moved out and back on every render.
  const setFocusSlot = useCallback((el: HTMLDivElement | null) => setTarget(el, 'home'), [setTarget]);
  const shortcutGroups = useGroupOrder(SHORTCUT_ORDER);
  // Go to's hidden-apps button, as on Apps: one inline panel under the title with every hidden app, the ones that fit the person first.
  const hiddenApps = useHiddenApps(shortcutGroups).reduce((n, x) => n + x.list.length, 0);
  const [showHidden, setShowHidden] = useState(false);
  const hiddenPanel = useId();
  const fits = useFits();
  const hiddenLabel = showHidden ? 'Close hidden apps' : `Hidden apps (${hiddenApps})`;
  const [xpView, setXpView] = useParamState('xp', 'day');
  const d = q.data;
  // The three half-width extras pair up in two columns; when one is left over it takes the whole row, so nothing stands alone.
  const listWords = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const lifeOn = isOn('life');
  const readsOn = isOn('knowledge');
  const moneyOn = isOn('finance');
  const extras = d ? ([d.life && lifeOn ? 'life' : null, d.resources.length > 0 && readsOn ? 'reads' : null, d.money && moneyOn ? 'money' : null].filter(Boolean) as string[]) : [];
  const lastOptional = extras.length % 2 === 1 ? extras[extras.length - 1] : null;
  // The four halves under the brief pair up the same way: Daily always, then Trackers, Up next and the Companion while their apps are on.
  const trackerKeys = ['mindful', 'sleep', 'journal', 'stress', 'mood'].filter(isOn);
  const upApps = { event: 'party', run: 'run', circle: 'circles', session: 'library', booking: 'shop' } as const;
  const upNext = d ? d.upNext.filter((u) => isOn(upApps[u.kind])) : [];
  const upOn = upNext.length > 0 || ['party', 'run', 'circles'].some(isOn);
  const UP_WORDS: [string, string, string][] = [
    ['party', 'Events', 'meetups are under Party'],
    ['run', 'runs', 'run clubs under Kreators Run'],
    ['circles', 'circles', 'small groups near you under Circles'],
  ];
  const upShown = UP_WORDS.filter(([k]) => isOn(k));
  const upWords = upShown.length > 0 ? upShown.map(([, w], i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase())) : ['Sessions'];
  const upWhereRaw = listWords(upShown.map(([, , w]) => w));
  const upWhere = upShown.length > 0 ? upWhereRaw.charAt(0).toUpperCase() + upWhereRaw.slice(1) : 'Your bookings show here';
  const halves = ['today', trackerKeys.length > 0 ? 'trackers' : null, upOn ? 'next' : null, isOn('companion') ? 'companion' : null].filter(Boolean) as string[];
  const lastHalf = halves.length % 2 === 1 ? halves[halves.length - 1] : null;
  // The metric cards: the Life score (Life), Mood and Wellbeing, each while its app is on. All three make the bento (a large Life beside
  // two); two sit side by side as halves; one takes the whole row.
  const metricKeys = ['life', 'mood', 'wellbeing'].filter(isOn);
  const metricSize = (key: string) => (metricKeys.length === 1 ? BENTO_SIZE.wide : metricKeys.length === 3 && key === 'life' ? BENTO_SIZE.large : BENTO_SIZE.medium);
  const lifeLarge = metricKeys.length === 3;
  // The week's lines: sleep, calm and mood, each while its tracker is on.
  const trendKeys = ['sleep', 'stress', 'mood'].filter(isOn);
  const TREND_WORDS: Record<string, [string, string]> = { sleep: ['sleep', 'a night'], stress: ['calm', 'a stress level'], mood: ['mood', 'a mood'] };
  const trendNames = listWords(trendKeys.map((k) => TREND_WORDS[k]![0]));
  const trendWords = trendNames.charAt(0).toUpperCase() + trendNames.slice(1);
  const trendLog = trendKeys.map((k) => TREND_WORDS[k]![1]).reduce((a, b, i, xs) => (i === 0 ? b : `${a}${i === xs.length - 1 ? ' or ' : ', '}${b}`), '');
  // A period tile that opens an app shows only while that app is on (Daily's and the pillars' tiles always show).
  const keepTile = keepForApps(modules);
  const user = me.data?.user;
  const firstName = user?.displayName?.split(' ')[0] ?? '';
  const identity = me.data?.identity ?? null;
  const myPage = user ? (user.handle ? `/u/${user.handle}` : `/people/${user.id}`) : '/profile';
  const moodToday = d ? (MOODS.find((m) => m.value === d.trackers.mood.today) ?? null) : null;
  const recentMoods = d ? d.trackers.mood.week.filter((m): m is number => m !== null).slice(-3) : [];

  return (
    <Screen columns className="screen-even">
      {/* The line of the day opens Home, above the greeting (the founder, 2026-11-13), so the header is no longer the screen's first
          child: on a phone it is a card in the gutter like on a laptop, not the bleed under the corner buttons. */}
      <QuoteOfTheDay date={date} />
      <header className="relative mt-md overflow-hidden rounded-card night-card px-md pt-lg pb-md text-on-fill">
        <HeroBlobs opacity={0.06} kind="cosmos" />
        <div className="relative flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
          <p className="order-2 m-0 text-subhead opacity-80 md:order-1">
            <Icon icon={CalendarDays} size={16} className="mr-xs inline-block align-[-3px]" />
            {prettyDate(date)}, {greetingFor(hour).toLowerCase()}
          </p>
          {/* My page alone (2026-11-07, the founder): the Inbox bell lives in the phone's top bar and the sidebar, so Home no longer
              carries a second one with the same count. */}
          <div className="order-1 flex items-center gap-xs md:order-2 md:shrink-0 md:justify-end">
            <Link to={myPage} className="toy inline-flex min-h-[36px] md:min-h-[44px] tap-pad items-center gap-xs rounded-pill bg-white/15 px-sm text-subhead font-medium text-on-fill">
              <Icon icon={UserRound} size={18} />
              My page
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
            <h1 className="text-large-title [overflow-wrap:anywhere] text-on-fill">{firstName ? `Hi, ${firstName}!` : 'Hi there!'}</h1>
            {d && (
              <p className="fill-row m-0 flex flex-wrap items-center gap-x-xs text-subhead opacity-90" aria-label="At a glance">
                <Link to="/tower" className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">
                  <Icon icon={Star} size={14} className="mr-xs inline-block align-[-2px]" />Level {d.xp.level}
                </Link>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <Link to="/today" className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">
                  <Icon icon={Flame} size={14} className="mr-xs inline-block align-[-2px]" />
                  {d.today.streak} {d.today.streak === 1 ? 'day' : 'days'}
                </Link>
                {isOn('mood') && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                    <Link to="/mood" className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">
                      {moodToday ? <MoodFace value={moodToday.value} size={16} className="mr-xs inline-block align-[-3px]" /> : <Icon icon={FaceSlightlySmiling} size={14} className="mr-xs inline-block align-[-2px]" />}
                      {moodToday ? moodToday.name : 'Log your mood'}
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="relative mt-md">
          <SearchBox placeholder="Search anything" onDark />
        </div>
      </header>

      {/* + Glass in the water green on Home too (the founder, 2026-11-06), beside Breathe and focus's own Start. */}
      <RemindersSection always />
      {/* Breathe and focus, the same living panel as Mindfulness (FocusRoundsHost moves it here while Home is showing), above the daily
          brief (the founder, 2026-11-06). */}
      {/* A section's own 32px from Water and reminders, like every titled section on Home: on a phone the panel's 16px top margin
          folds into this one, and in the laptop grid (an item keeps its child's margin) the two add up to the same 32. */}
      {mindfulOn && <div ref={setFocusSlot} className="span-all mt-lg lg:mt-md" style={{ minHeight: focusHeight || undefined }} />}
      <DailyBrief date={date} hour={hour} />


      {q.isPending && (
        <div className="span-all mt-md">
          <SkeletonList count={2} lines={3} label="Adding up your week" />
        </div>
      )}
      {q.isError && (
        <div className="span-all mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load your numbers.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          {metricKeys.length > 0 && (
          <Section id="home-metrics" title="Your metrics" lede="Where you stand today. Tap one for the detail." action={lifeOn ? <SeeAll to="/life">Life</SeeAll> : undefined} span>
            <ul className="bento-md -mx-md flex snap-x scroll-px-md list-none gap-xs overflow-x-auto px-md pb-xs scrollbar-none m-0 md:mx-0 md:overflow-visible md:px-0">
              {lifeOn && (
              <li data-pillar="lover_partner" className={`w-[168px] shrink-0 snap-start md:w-auto md:[&>a]:h-full ${metricSize('life')}`}>
                <MetricCard to="/life" title="Life score" icon={Compass} tone="var(--color-r4)" deep="var(--deep-lover_partner)" corner={<Avatar relationship="lover_partner" size={36} decorative mood={(d.life?.overall ?? 0) >= 60 ? 'excited' : 'happy'} />}>
                  <span className="flex flex-1 items-center justify-center">
                    {/* In proportion to its card: 140px in the phone's sideways row, 240px in the large bento cell beside two cards. */}
                    <Gauge value={(d.life?.overall ?? 0) / 100} size={wideMetrics && lifeLarge ? 240 : 140} stroke={wideMetrics && lifeLarge ? 20 : 13} color={WHITE} track={WHITE_TRACK} label={`Life ${d.life?.overall ?? 0} of 100`}>
                      <span className="flex flex-col items-center leading-none">
                        <span className={`font-display ${wideMetrics && lifeLarge ? 'text-[56px] font-[500]' : 'text-[34px] font-bold'}`}>
                          <CountUp value={d.life?.overall ?? 0} />
                        </span>
                        <span className={`mt-xs font-medium opacity-90 ${wideMetrics && lifeLarge ? 'text-callout' : 'text-caption'}`}>{d.life?.label ?? ''}</span>
                      </span>
                    </Gauge>
                  </span>
                </MetricCard>
              </li>
              )}
              {isOn('mood') && (
              <li data-pillar="friendship" className={`w-[168px] shrink-0 snap-start md:w-auto ${metricSize('mood')}`}>
                <MetricCard to="/mood" title="Mood" tone="var(--color-r2)" deep="var(--deep-friendship)" corner={<MoodFace value={moodToday?.value ?? 3} size={40} color="rgba(255,255,255,0.25)" face="var(--color-on-fill)" />}>
                  <span className="block text-title2">{moodToday ? moodToday.name : 'Not logged'}</span>
                  <span className="mt-xs block flex-1">
                    <AreaLine values={d.trackers.mood.week} max={5} min={1} color={WHITE} height={80} onFill axes={false} empty="No moods yet" label="Mood for the last seven days" />
                  </span>
                </MetricCard>
              </li>
              )}
              {isOn('wellbeing') && (
              <li data-pillar="guru" className={`w-[168px] shrink-0 snap-start md:w-auto ${metricSize('wellbeing')}`}>
                <MetricCard to="/wellbeing" title="Wellbeing" icon={HeartPulse} tone="var(--color-r6)" deep="var(--deep-guru)" corner={<Avatar relationship="guru" size={36} decorative mood={d.trackers.score >= 60 ? 'excited' : 'happy'} />}>
                  <span className="flex flex-1 items-center justify-center">
                    <Ring value={d.trackers.score / 100} size={104} stroke={11} color={WHITE} track={WHITE_TRACK} label={`Wellbeing ${d.trackers.score} of 100`}>
                      <span className="flex flex-col items-center leading-none">
                        <span className="text-large-title type-figure">
                          <CountUp value={d.trackers.score} />
                        </span>
                        <span className="mt-xs text-caption opacity-90">{d.trackers.label}</span>
                      </span>
                    </Ring>
                  </span>
                </MetricCard>
              </li>
              )}
            </ul>
          </Section>
          )}

          <Section id="home-stats" title="Your numbers" lede="Results first. Everything below is what moves them." span>
            <div className="grid grid-cols-2 gap-xs md:grid-cols-4">
              <KitTile to="/today#show-heading" tone="bg-r4" icon={Flame} value={String(d.today.streak)} label="day streak" hint={d.today.checkedIn ? 'checked in today' : 'not yet today'} />
              <KitTile to="/today#tasks-heading" tone="bg-r2" icon={Sparkles} value={`+${d.xp.today}`} label="xp today" hint={`${d.xp.week} this week`} />
              <KitTile to="/rewards" tone="bg-r3" yellow icon={Coins} value={formatCount(d.points)} label="points" hint="trade for rewards" />
              <KitTile to="/tower" tone="bg-ink" icon={Star} value={`Level ${d.xp.level}`} label={`${d.xp.into} of ${d.xp.span} xp`} hint={`${d.xp.span - d.xp.into} to level ${d.xp.level + 1}`}>
                <span className="mt-xs block h-[6px] overflow-hidden rounded-pill bg-on-ink/20" aria-hidden="true">
                  <span className="block h-full rounded-pill bg-on-ink" style={{ width: `${Math.round((d.xp.into / Math.max(1, d.xp.span)) * 100)}%` }} />
                </span>
              </KitTile>
            </div>
                      <Nudge className="mt-sm" text={`${d.xp.span - d.xp.into} xp to level ${d.xp.level + 1}. A ticked task is 20, a check-in 10.`} />
          </Section>

          <PeriodPanel id="home-period" parts={['daily', 'wellbeing', 'water', 'finance', 'shop']} keep={keepTile} whole="Home's By period: one small even block, no headings (the founder, 2026-11-07)" span />
          {trendKeys.length > 0 && (
          <Section id="home-trends" title="This week" lede={`${trendWords} as ${trendKeys.length === 1 ? 'a score' : 'scores'} out of a hundred, day by day. Where ${trendKeys.length === 1 ? 'the line dips' : 'the lines dip'} is where to look.`} action={isOn('wellbeing') ? <SeeAll to="/wellbeing">Wellbeing</SeeAll> : undefined} span>
            <div className="rounded-card bg-card p-md shadow-toy-soft">
              {/* Physical, mental, emotional: the order of the five areas, the same as Life's chart. */}
              <MultiLine
                series={[
                  { key: 'sleep', values: d.trackers.sleep.week.map((h) => (h === null ? null : (Math.max(4, Math.min(8, h)) - 4) * 25)), color: 'var(--color-r6)', label: 'Sleep' },
                  { key: 'stress', values: d.trackers.stress.week.map((st) => (st === null ? null : ((5 - st) / 4) * 100)), color: 'var(--color-r2)', label: 'Calm' },
                  { key: 'mood', values: d.trackers.mood.week.map((m) => (m === null ? null : ((m - 1) / 4) * 100)), color: 'var(--color-r3)', label: 'Mood' },
                ]
                  .filter((x) => trendKeys.includes(x.key))
                  .map(({ key: _k, ...x }) => x)}
                max={100}
                labels={d.days.slice(-7).map((x) => weekday(x.date))}
                allLabels
                height={180}
                label={`${trendWords} as scores out of a hundred for the last seven days`}
                empty={`Log ${trendLog} and the ${trendKeys.length === 1 ? 'line appears' : 'lines appear'}.`}
              />
            </div>
          </Section>
          )}

          <Section id="home-today" title="Daily" lede="Tick each box when you have done it." action={<SeeAll to="/today">Open</SeeAll>} span={lastHalf === 'today'}>
            <div data-pillar="lover_partner" className="relative flex flex-col overflow-hidden rounded-card bg-r4 p-md text-on-fill">
              <HeroBlobs kind="daisy" />
              <div className="relative flex flex-1 flex-col">
                <div className="flex items-center justify-between gap-sm">
                  <div className="flex items-center gap-sm">
                    <Ring value={d.today.doneCount / 3} size={64} stroke={8} color={WHITE} track={WHITE_TRACK} label={`${d.today.doneCount} of 3 done`}>
                      <span className="text-title3 type-figure">{d.today.doneCount}/3</span>
                    </Ring>
                    <p className="m-0">
                      <span className="block text-title2 type-figure leading-none">{d.today.doneCount === 3 ? 'All three done' : `${3 - d.today.doneCount} to go`}</span>
                      <span className="mt-xs block text-balance text-subhead opacity-90">{tie('Check in, small act, one task.')}</span>
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
                    <li key={String(text)} className={`inline-flex min-h-[32px] items-center gap-xs rounded-pill px-sm text-caption font-medium ${done ? 'bg-card text-ink' : 'bg-ink-fixed/20 text-on-fill'}`}>
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
                  <p className="m-0 text-title3">{d.nudge.lead}</p>
                  <p className="mt-xs m-0 text-subhead opacity-95">{d.nudge.body}</p>
                </div>
                <div className="mt-auto flex items-stretch gap-xs pt-sm">
                  <Link to={d.nudge.path} className="toy inline-flex min-h-[40px] md:min-h-[48px] tap-pad min-w-0 flex-1 items-center justify-center rounded-pill bg-card px-md text-headline text-ink">
                    {d.nudge.action}
                  </Link>
                  <Link to="/today" aria-label="Open Today" className="toy tap-pad flex min-h-[40px] w-[40px] md:min-h-[48px] md:w-[48px] shrink-0 items-center justify-center rounded-pill bg-white/25 text-on-fill">
                    <Icon icon={ArrowUpRight} size={20} />
                  </Link>
                </div>
                {/* Close the unfinished (2026-11-07, the founder's ask): Daily with its Bottlenecks view on, the tasks with a kind in
                    their three boxes. The arrow's own look beside it, so the card keeps one solid action; the count says how much is open.
                    Shown only while a bottleneck is open (the founder, 2026-11-07): the count is the view's own, so it comes back with the
                    first task given a kind, the next time Home reads (a task write marks Home stale). */}
                {d.today.openBusiness ? (
                  <Link
                    to="/today?taskSort=open#tasks-heading"
                    aria-label={`Close the unfinished: ${d.today.openBusiness} open`}
                    className="toy mt-xs inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center justify-center gap-xs rounded-pill bg-ink-fixed/20 px-md text-headline text-on-fill"
                  >
                    {/* The card's own darker wash (the three boxes, the nudge), so its white words keep AA on the green (four-check: 3.4:1 on white/25). */}
                    Close the unfinished
                    <span className="text-subhead">{d.today.openBusiness} open</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </Section>

          {trackerKeys.length > 0 && (
          <Section id="home-trackers" title="Trackers" lede="Tap a row to log today." action={isOn('wellbeing') ? <SeeAll to="/wellbeing">Wellbeing</SeeAll> : undefined} span={lastHalf === 'trackers'}>
            <ul className="flex list-none flex-col gap-xs p-0 m-0">
              {[
                {
                  key: 'mindful', pillar: 'lover_partner', to: '/mindful', name: 'Mindfulness', icon: MODULE_BY_KEY.mindful?.icon, tone: 'var(--tint-green)',
                  value: d.trackers.mindful.minutesWeek > 0 ? `${d.trackers.mindful.minutesWeek} min this week` : 'none this week',
                  visual: <Sparkline values={d.trackers.mindful.week} max={60} color="var(--color-r4)" width={80} height={32} />,
                },
                {
                  key: 'sleep', pillar: 'guru', to: '/sleep#log-heading', name: 'Sleep', icon: MODULE_BY_KEY.sleep?.icon, tone: 'var(--tint-purple)',
                  value: d.trackers.sleep.avg7 === null ? 'not logged' : `${d.trackers.sleep.avg7.toFixed(1)} h a night`,
                  visual: (
                    <Ring value={d.trackers.sleep.avg7 === null ? 0 : (Math.max(4, Math.min(8, d.trackers.sleep.avg7)) - 4) / 4} size={44} stroke={5} color="var(--color-r6)" track="var(--color-line)" label="Sleep quality">
                      <span className="text-caption font-semibold">{d.trackers.sleep.avg7 === null ? '–' : Math.round(((Math.max(4, Math.min(8, d.trackers.sleep.avg7)) - 4) / 4) * 100)}</span>
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
                  key: 'stress', pillar: 'parent_child', to: '/stress#level-heading', name: 'Stress', icon: MODULE_BY_KEY.stress?.icon, tone: 'var(--tint-yellow)',
                  value: d.trackers.stress.latest === null ? 'not logged' : `Level ${d.trackers.stress.latest} (${STRESS_LEVELS[d.trackers.stress.latest - 1] ?? ''})`,
                  visual: <Segments value={d.trackers.stress.latest} color="var(--color-r3)" label="Stress level out of five" />,
                },
                {
                  key: 'mood', to: '/mood', name: 'Mood', icon: MODULE_BY_KEY.mood?.icon, tone: 'var(--tint-brown)',
                  value: moodToday ? `${moodToday.name} today` : 'not logged today',
                  visual:
                    recentMoods.length === 0 ? (
                      <span className="text-caption text-ink-soft">no moods yet</span>
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
              ]
                .filter((r) => trackerKeys.includes(r.key))
                .map((r) => (
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
                      <span className="block text-card-title">{r.name}</span>
                      <span className="block truncate text-card-note text-ink-soft">{r.value}</span>
                    </span>
                    <span className="shrink-0">{r.visual}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
          )}

          {upOn && (
          <Section id="home-next" title="Up next" lede={`${listWords(upWords)} you joined.`} action={isOn('party') ? <SeeAll to="/party">Party</SeeAll> : undefined} span={lastHalf === 'next'}>
            <div data-pillar="lover_partner" className="flex flex-col rounded-card bg-card p-md shadow-toy-soft">
              <div className="flex items-center justify-between gap-sm">
                <p className="m-0 flex items-baseline gap-xs">
                  <span className="text-figure-lg type-figure leading-none">{upNext.length}</span>
                  <span className="text-headline">coming up</span>
                </p>
                {isOn('party') && (
                <Link to="/party" aria-label="Open Party" className="toy flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-r4 text-on-fill" style={{ '--toy-color': 'var(--deep-lover_partner)' } as CSSProperties}>
<Icon icon={ArrowUpRight} size={20} />
                </Link>
                )}
              </div>
              {/* With nothing booked the line sits in the middle of the card (beside the taller Companion), never under an empty band. */}
              <p className={`mt-xs m-0 flex flex-wrap gap-sm text-caption text-ink-soft ${upNext.length === 0 ? 'flex-1 content-center' : ''}`}>
                {(['event', 'run', 'session', 'booking', 'circle'] as const).map((k) => {
                  const n = upNext.filter((u) => u.kind === k).length;
                  if (n === 0) return null;
                  return (
                    <span key={k}>
                      <Icon icon={upIcon(k)} size={14} className="mr-xs inline-block align-[-2px]" />
                      {n} {k === 'booking' ? (n === 1 ? 'booking you host' : 'bookings you host') : n === 1 ? k : `${k}s`}
                    </span>
                  );
                })}
                {upNext.length === 0 && <span>Nothing booked. {upWhere}.</span>}
              </p>
              {upNext.length > 0 && (
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {upNext.map((u) => (
                    <li key={`${u.kind}-${u.path}-${u.at}`}>
                      <Link to={u.path} className="group toy toy-flat flex items-center gap-sm rounded-tile bg-paper p-sm text-ink">
                        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-ink-soft shadow-toy-soft">
                          <Icon icon={upIcon(u.kind)} size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-headline">{u.title}</span>
                          {/* The time never breaks ("2:13 / am"): it stays whole, and the note follows it, as a part of its own after the comma, so
                              a narrow card breaks there on purpose ("Mon, 9 Nov, 2:47 pm," over "chat opens 8 Nov"). */}
                          <span className="block text-caption text-ink-soft">
                            <span className="inline-block whitespace-nowrap">
                              <Icon icon={Clock} size={12} className="mr-xs inline-block align-[-2px]" />
                              {when(u.at)}
                              {u.note ? ',' : ''}
                            </span>
                            {u.note ? ' ' : ''}
                            {u.note ? <span className="inline-block">{u.note}</span> : null}
                          </span>
                        </span>
                        <Icon icon={ArrowUpRight} size={18} className="transition-transform motion-safe:group-hover:translate-x-xs motion-safe:group-hover:-translate-y-xs text-ink-mute" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {/* The card's foot: its two ways on at the bottom right, where a card's action sits (they were centred, the only centred links on Home). */}
              {(isOn('party') || isOn('circles')) && (
              <div className="mt-auto flex justify-end gap-md pt-sm">
                {isOn('party') && (
                <Link to="/party" className="inline-flex min-h-[44px] items-center text-subhead text-ink-mute underline-offset-4 hover:underline">
                  All events
                </Link>
                )}
                {isOn('circles') && (
                <Link to="/circles" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-subhead text-ink-mute underline-offset-4 hover:underline">
                  Circles
                </Link>
                )}
              </div>
              )}
            </div>
          </Section>
          )}

          {isOn('companion') && (
          <Section id="home-companion" title="Companion" lede="A chat that knows how you are doing. Not a therapist." span={lastHalf === 'companion'}>
            {/* Centred in its half: when Up next beside it is taller, the room goes above and below, never one band at the foot. */}
            <div data-pillar="guru" className="relative flex flex-col justify-center overflow-hidden rounded-card bg-ink p-md text-on-ink">
              <HeroBlobs opacity={0.06} kind="violet" />
              <div className="relative z-10 max-w-[60%]">
                <p className="m-0 text-figure-lg type-figure leading-none">{formatCount(d.companion.messages)}</p>
                <p className="mt-xs m-0 text-headline">{d.companion.messages === 1 ? 'message' : 'messages'}</p>
                <p className="mt-xs m-0 text-subhead opacity-80">
                  <Icon icon={MessageCircle} size={14} className="mr-xs inline-block align-[-2px]" />
                  {d.companion.messages === 0 ? 'Say what is on your mind.' : 'Pick up where you left off.'}
                </p>
                {isOn('journal') && (
                <p className="m-0 text-subhead opacity-80">
                  <Icon icon={NotebookPen} size={14} className="mr-xs inline-block align-[-2px]" />Or write it in the journal.
                </p>
                )}
              </div>
              <span className="pointer-events-none absolute top-1/2 right-md -translate-y-1/2 opacity-90" aria-hidden="true">
                <Avatar relationship="guru" size={112} decorative mood="happy" />
              </span>
              <div className="relative z-10 mt-md flex gap-sm">
                <Link to="/companion" aria-label="Talk to the companion" className="toy flex size-[56px] items-center justify-center rounded-pill bg-r4 text-on-fill" style={{ '--toy-color': 'var(--deep-lover_partner)' } as CSSProperties}>
<Icon icon={MessageCirclePlus} size={24} />
                </Link>
                {isOn('journal') && (
                <Link to="/journal" aria-label="Write in the journal" className="toy flex size-[56px] items-center justify-center rounded-pill bg-r2 text-on-fill" style={{ '--toy-color': 'var(--deep-friendship)' } as CSSProperties}>
<Icon icon={Pencil} size={22} />
                </Link>
                )}
              </div>
            </div>
          </Section>
          )}

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
                    <p className="mt-md m-0 rounded-tile bg-paper p-md text-center text-subhead text-ink-soft">No xp in the last two weeks yet. Tick a box on Daily and it shows here, by what earned it.</p>
                  ) : (
                    // The ring says how the two weeks split; the bars beside it compare the sources, biggest first, each with its xp and share.
                    <div className="mt-md grid items-center gap-md sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-lg">
                      <div className="flex justify-center">
                        <Donut segments={rows.map((x) => ({ value: x.xp, color: SOURCE_META[x.source].color, label: SOURCE_META[x.source].label }))} size={168} stroke={22} label="Xp by source">
                          <span className="flex flex-col items-center leading-none">
                            <span className="text-large-title type-figure tabular-nums">{formatCount(total)}</span>
                            <span className="mt-xs text-caption text-ink-soft">xp in 14 days</span>
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
                  {d.days.every((x) => x.xp === 0) && <p className="mt-sm m-0 text-subhead text-ink-soft">Every box ticked on Daily lands here.</p>}
                </div>
              )}
            </div>
          </Section>
          </MoreOnHome>

          {d.life && lifeOn && (
            <Section id="home-life" title="Life" lede="Your five areas. Only you see this." action={<SeeAll to="/life">Open</SeeAll>} span={lastOptional === 'life'}>
              {/* One row per area, like a task row (2026-11-05): who it is on the left (a small gauge in the area's pillar colour with the
                  score counting up inside, then the name), how it moved on the right (up, down or Same, the same place on every row), so a name
                  is never cut and the tags line up. Each row opens its area; they rise in one after another once. */}
              <ul className="fx-spot m-0 flex h-full list-none flex-col justify-center gap-[2px] rounded-card bg-card p-xs shadow-toy-soft">
                {d.life.areas.map((a, i) => {
                  const meta = LIFE_AREAS[a.key];
                  const rel = RELATIONSHIP_BY_KEY[meta.relationship];
                  const trend = Math.round(a.trend);
                  const change = trend > 0 ? `up ${trend}` : trend < 0 ? `down ${-trend}` : 'the same as last week';
                  return (
                    <Reveal as="li" key={a.key} index={i} className="flex">
                      <Link to={meta.path} data-pillar={rel.key} aria-label={`${meta.name}: ${a.score} of 100, ${change}`} className="toy toy-flat flex min-h-[52px] w-full min-w-0 items-center gap-sm rounded-inner px-xs py-[2px] text-ink">
                        <Gauge value={a.score / 100} size={44} stroke={5} color={rel.color} label={`${meta.name} ${a.score}`}>
                          <CountUp value={a.score} className="text-caption font-semibold tabular-nums" />
                        </Gauge>
                        <span className="min-w-0 flex-1 truncate text-subhead font-semibold">{meta.name}</span>
                        <span
                          aria-hidden="true"
                          className={`inline-flex min-h-[24px] shrink-0 items-center gap-[2px] rounded-pill px-xs text-caption font-medium tabular-nums ${trend === 0 ? 'text-ink-mute' : ''}`}
                          style={trend > 0 ? { background: 'var(--tint-green)', color: 'var(--deep-lover_partner)' } : trend < 0 ? { background: 'var(--tint-red)', color: 'var(--deep-servant_leader)' } : undefined}
                        >
                          {trend !== 0 && <Icon icon={trend > 0 ? ArrowUpRight : ArrowDownRight} size={12} strokeWidth={3} />}
                          {trend > 0 ? `+${trend}` : trend < 0 ? `${trend}` : 'Same'}
                        </span>
                      </Link>
                    </Reveal>
                  );
                })}
              </ul>
            </Section>
          )}

          {d.resources.length > 0 && readsOn && (
            <Section id="home-reads" title="Knowledge" lede="Reads and guides from the library." action={<SeeAll to="/knowledge">See all</SeeAll>} span={lastOptional === 'reads'}>
              {/* Beside another half (Life or Money) the reads stack one to a row, so a title keeps the card's width and the card is not a
                  tall empty box; across the whole width they sit four to a row. A phone stacks them too. Every row takes the tallest card's
                  height (auto-rows-fr), so a three-line title or wrapped tags never leave one card taller (the founder, 2026-11-07). */}
              <ul className={`grid h-full auto-rows-fr list-none gap-xs p-0 m-0 ${lastOptional === 'reads' ? evenGrid(d.resources.length, READ_COLS) : 'grid-cols-1'}`}>
                {d.resources.map((r, i) => (
                  <Reveal as="li" key={r.id} index={i} className={`flex ${lastOptional === 'reads' ? evenTile(i, d.resources.length, READ_COLS) : ''}`}>
                    {/* A read, placed like Explore's cards: the title at the top left, the kind's icon at the top right, the topic and the kind
                        as tags lined up at the foot on the left, and an arrow at the bottom right that nudges on hover. */}
                    <Link to={`/knowledge/${r.id}`} className="fx-spot toy toy-soft group flex min-h-[120px] w-full flex-col rounded-card bg-card p-sm text-ink">
                      <CardHead
                        tag={
                          <span className="flex size-[44px] items-center justify-center rounded-inner bg-paper text-ink-soft" aria-hidden="true">
                            <AppIcon name={knowledgeKindIcon(r.kind)} size={22} />
                          </span>
                        }
                      >
                        <span className="block text-balance text-headline">{tie(r.title)}</span>
                      </CardHead>
                      <span className="mt-auto flex items-end justify-between gap-xs pt-sm">
                        <span className="flex min-w-0 flex-wrap gap-xs">
                          {r.tag && (
                            <StatusTag fit tone="calm">
                              {tagLabel(r.tag)}
                            </StatusTag>
                          )}
                          <IconTag fit tone="neutral" icon={knowledgeKindIcon(r.kind)}>
                            {r.kind ? r.kind[0]!.toUpperCase() + r.kind.slice(1) : 'Read'}
                          </IconTag>
                        </span>
                        <Icon icon={ArrowUpRight} size={16} className="read-arrow mb-xs shrink-0 text-ink-mute" />
                      </span>
                    </Link>
                  </Reveal>
                ))}
              </ul>
            </Section>
          )}

          {d.money && moneyOn && (
            <Section id="home-money" title="Money this month" lede="From Finance. Never shown to brands." action={<SeeAll to="/finance">Open</SeeAll>} span={lastOptional === 'money'}>
              <div className="grid grid-cols-2 gap-xs">
                <KitTile to="/finance" tone="bg-r4" icon={ArrowDownLeft} value={money(d.money.incomeCents, d.money.currency)} label="in" hint="this month" />
                <KitTile to="/finance" tone="bg-r2" icon={ArrowUpRight} value={money(d.money.expenseCents, d.money.currency)} label="out" hint="this month" />
                <KitTile to="/finance" tone="bg-card" plain icon={HandCoins} value={money(d.money.owedToMeCents, d.money.currency)} label="owed to you" hint={d.money.overdueInvoices > 0 ? `${d.money.overdueInvoices} overdue ${d.money.overdueInvoices === 1 ? 'invoice' : 'invoices'}` : 'no overdue invoices'} />
                <KitTile to="/finance" tone="bg-card" plain icon={CalendarClock} value={money(d.money.iOweCents, d.money.currency)} label="you owe" hint={d.money.dueSoon > 0 ? `${d.money.dueSoon} due within a week` : 'nothing due this week'} />
              </div>
            </Section>
          )}

          {/* Emerging beside Your pillars (the founder, 2026-11-13): one row on the laptop's two columns, Emerging the left half and the
              pillars the right, one height (`.home-pair` in app.css); on a phone and a tablet Emerging sits right above the pillars. Emerging
              holds its half while it loads (`paired`); only when it draws nothing at all do the pillars take the whole row. */}
          <div className="home-pair span-all">
            <EmergenceSlot app="home" max={3} always paired />
            <Section id="home-tower" title="Your pillars" lede="Seven pillars of your life. The bar shows how far each one has come." action={<SeeAll to="/tower">Open</SeeAll>}>
              {/* Its bars sit in the middle of the card when Emerging beside it is the taller half. */}
              <Link to="/tower" className="toy toy-soft flex flex-col justify-center rounded-card bg-card p-md text-ink">
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
          </div>

          {/* Book: the founder's three books, the whole row so it never pairs with a half. Covers only; the page has the rest. */}
          <Section id="home-books" title="Books" span lede="Three books by Shubham Aggarwal, with a course for each." action={<SeeAll to="/book">Open</SeeAll>}>
            <BookShelf href={(b) => `/book#${b.slug}`} />
          </Section>

          {d.shop && isOn('shop') && (
            <Section id="home-shop" title="Shop this month" lede={`${d.shop.products} ${d.shop.products === 1 ? 'product' : 'products'} live or in draft.`} action={<SeeAll to="/shop">Open</SeeAll>} span>
              <div className="rounded-card bg-card p-md shadow-toy-soft">
                <div className="grid grid-cols-3 gap-xs">
                  <KitTile tone="bg-paper" plain icon={Receipt} value={String(d.shop.ordersMonth)} label="orders" hint="this month" />
                  {/* Every tile carries a line under its label, so the three end level (2026-11-05); "and ₹0" when nothing sold for money,
                      which stays on one line in a narrow tile where "no money sales" broke short. */}
                  <KitTile tone="bg-paper" plain icon={Coins} value={formatCount(d.shop.pointsMonth)} label="points" hint={`and ${money(d.shop.centsMonth, d.shop.currency)}`} />
                  <KitTile tone="bg-paper" plain icon={Users} value={String(d.shop.followers)} label="followers" hint={`${d.shop.views} page views`} />
                </div>
                <div className="mt-md">
                  <AreaLine values={d.shop.days.map((x) => x.orders)} max={Math.max(3, ...d.shop.days.map((x) => x.orders))} labels={d.shop.days.map((x) => weekday(x.date))} color="var(--color-r6)" height={140} empty="No orders in the last two weeks" label="Orders per day for the last fourteen days" />
                </div>
              </div>
            </Section>
          )}

          <Section
            id="home-go"
            title="Go to"
            lede="Every app you have not hidden."
            action={
              <div className="flex items-center gap-xs">
                {(hiddenApps > 0 || showHidden) && (
                  <button type="button" className="mf-round toy shrink-0" data-at="tr" data-tip={hiddenLabel} aria-label={hiddenLabel} aria-expanded={showHidden} aria-controls={hiddenPanel} onClick={() => setShowHidden((v) => !v)}>
                    <ToggleIcon open={showHidden} icon={EyeOff} />
                  </button>
                )}
                <SeeAll to="/apps">All apps</SeeAll>
              </div>
            }
            span
          >
            {showHidden && (
              <Suspense fallback={null}>
                <HiddenAppsPanel groups={shortcutGroups} id={hiddenPanel} fits={fits} empty="No hidden apps. Hide one under Apps." />
              </Suspense>
            )}
            {shortcutGroups.map((g) => {
              const list = modules.filter((m) => m.on && m.group === g);
              if (list.length === 0) return null;
              return (
                <div key={g} data-pillar={MODULE_GROUP_ACCENT[g]} className="mt-md first:mt-0">
                  <p className="m-0 text-eyebrow uppercase text-ink-soft">{MODULE_GROUPS[g]}</p>
                  {/* The top margin sits on a wrapper: a scroll-row bleeds into the gutters with margins of its own. */}
                  <div className="mt-xs">
                    <ul className={`scroll-row list-none snap-x snap-proximity scroll-px-md gap-sm md:m-0 md:grid md:snap-none md:overflow-visible md:p-0 ${evenGrid(list.length, GO_COLS)}`}>
                      {list.map((m, i) => (
                        <li key={m.key} className={`flex flex-[1_0_145px] snap-start ${evenTile(i, list.length, GO_COLS)}`}>
                          <AppTile app={m} />
                        </li>
                      ))}
                    </ul>
                  </div>
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
      <span className="relative flex items-center justify-between gap-xs text-subhead font-semibold">
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
        <span className="text-title2 type-figure leading-none">{value}</span>
      </span>
      <span className="mt-xs block text-subhead">{label}</span>
      {hint && <span className={`mt-xs block text-caption ${plain ? 'text-ink-soft' : 'opacity-85'}`}>{hint}</span>}
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
