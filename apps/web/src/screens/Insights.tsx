import { useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { formatCount, insightsForPlace, isRealDay, LIFE_AREA_ORDER, LIFE_AREAS, PERIOD_KINDS, periodFor, type Insight, type InsightKey, type InsightsResponse, type LifeAreaKey, type Period, type PeriodKind } from '@kreators/shared';
import { Screen } from '../components/Screen';
import { PageHeader } from '../components/PageHeader';
import { Section, SeeAll } from '../components/Section';
import { StatTile } from '../components/Charts';
import { Segmented } from '../components/fx/Segmented';
import { HowItWorks } from '../components/HowTo';
import { Skeleton } from '../components/Skeleton';
import { ErrorLine } from '../components/ErrorLine';
import { PeriodFilter } from '../components/PeriodFilter';
import { Fold } from '../components/Fold';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { LifeDashboardBlock } from '../components/LifeDashboardBlock';
import { focusHeading, InsightGrid, SetAsideFold, SetAsideList, useHiddenInsights, useInsights } from '../components/Emergence';
import { ToggleChevron } from '../components/ToggleMark';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useModule } from '../lib/modules';
import { useSession } from '../lib/store';
import { useWide } from '../lib/useWide';
import { useParamState, writeParams } from '../lib/useParamState';

type Filter = 'all' | 'tasks' | 'body' | 'work';
type HabitFilter = 'good' | 'bad' | 'all';
const HABIT_FILTERS: readonly { value: HabitFilter; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'bad', label: 'Bad' },
  { value: 'all', label: 'All' },
];
const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'body', label: 'Body' },
  { value: 'work', label: 'Money' },
];
const GROUP: Record<InsightKey, Exclude<Filter, 'all'>> = {
  habit: 'tasks',
  'habit-tie': 'tasks',
  'pillar-balance': 'tasks',
  'best-hours': 'tasks',
  'streak-weekday': 'tasks',
  'daytype-done': 'tasks',
  'block-kept': 'tasks',
  'routine-tasks': 'tasks',
  'review-since': 'tasks',
  'discover-strength': 'tasks',
  'sleep-mood': 'body',
  'focus-tasks': 'body',
  'stress-calm': 'body',
  'slips-sleep': 'body',
  'journal-mood': 'body',
  'money-stress': 'work',
  'agency-load': 'work',
  'gratitude-mood': 'body',
  'move-weekday': 'body',
  'eat-days': 'body',
  'water-days': 'body',
  'water-weekday': 'body',
  'budget-over': 'work',
  'budget-pace': 'work',
};
/** Where each pattern sits under What stands out: its area of life, or across your days when it belongs to none. Habits have a section of their own. */
type Place = LifeAreaKey | 'across';
const PLACE: Record<Exclude<InsightKey, 'habit' | 'habit-tie'>, Place> = {
  'sleep-mood': 'physical',
  'slips-sleep': 'physical',
  'move-weekday': 'physical',
  'eat-days': 'physical',
  'water-days': 'physical',
  'water-weekday': 'physical',
  'money-stress': 'financial',
  'budget-over': 'financial',
  'budget-pace': 'financial',
  'agency-load': 'financial',
  'focus-tasks': 'mental',
  'stress-calm': 'mental',
  'best-hours': 'mental',
  'block-kept': 'mental',
  'daytype-done': 'mental',
  'journal-mood': 'emotional',
  'gratitude-mood': 'emotional',
  'routine-tasks': 'spiritual',
  'pillar-balance': 'across',
  'discover-strength': 'across',
  'review-since': 'across',
  'streak-weekday': 'across',
};
const isHabitKey = (i: Insight) => i.key === 'habit' || i.key === 'habit-tie';
/** How many cards a group shows until "Show N more" is tapped, the strongest first: fewer on a phone, where they stack (docs/copy-brief.md). */
const AREA_FIRST = { wide: 2, phone: 1 };
const HABITS_FIRST = { wide: 4, phone: 2 };

/** The strongest cards of a group, and an inline toggle for the rest in place (the same quiet toggle as Show N set aside). */
function FirstCards({ list, first, onHide }: { list: Insight[]; first: { wide: number; phone: number }; onHide: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wide = useWide();
  const shown = wide ? first.wide : first.phone;
  const more = list.length - shown;
  if (more <= 0) return <InsightGrid list={list} onHide={onHide} corner />;
  return (
    <>
      <InsightGrid list={open ? list : list.slice(0, shown)} onHide={onHide} corner />
      <div className="mt-xs">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="toy toy-flat inline-flex min-h-[44px] items-center gap-xs rounded-pill px-sm text-subhead text-ink-soft">
          {open ? 'Show fewer' : `Show ${formatCount(more)} more`}
          <ToggleChevron open={open} size={14} />
        </button>
      </div>
    </>
  );
}
const isKind = (v: string | null): v is PeriodKind => Boolean(v) && (PERIOD_KINDS as readonly string[]).includes(v!);

/**
 * Emerging, the core page (not an app: it holds nothing of its own, it only reads what the person's apps already show them). A period filter
 * sets the window for the page (none picked: the last eight weeks): first "Your life" for that window, the five areas and the seven pillars
 * with their numbers, then the patterns by area of life, the habits, and what is still being watched. Owner only, computed on read, nothing
 * stored.
 */
export function Insights() {
  const today = todayLocal();
  const token = useSession((s) => s.token);
  const [params, setParams] = useSearchParams();
  const kindQ = params.get('kind');
  const dateQ = params.get('date');
  // The period lives in the address, the same words as Reviews (`kind`, `date`), so its link lands here on the period it was on. A day
  // that is not on the calendar, or a period still to come, opens that kind's own period today.
  const period = useMemo<Period | null>(() => {
    if (!isKind(kindQ)) return null;
    const asked = isRealDay(dateQ) ? periodFor(kindQ, dateQ) : null;
    return asked && asked.start <= today ? asked : periodFor(kindQ, today);
  }, [kindQ, dateQ, today]);
  const setPeriod = (p: Period | null) => writeParams(setParams, { kind: p ? p.kind : null, date: p ? p.start : null });
  const windowKey = period ? [period.kind, period.start] : ['rolling', ''];
  // With no period the page shares the one answer every screen reads; a picked period is its own read.
  const rolling = useInsights('insights', null, !period);
  const windowed = useQuery({
    queryKey: ['insights', today, ...windowKey],
    queryFn: () => api.insights(today, period),
    enabled: Boolean(token) && Boolean(period),
    staleTime: 5 * 60 * 1000,
    select: (d: InsightsResponse): InsightsResponse => ({ ...d, insights: insightsForPlace(d.insights, 'insights') }),
  });
  const q = period ? windowed : rolling;
  const board = useQuery({ queryKey: ['insights', 'dashboard', today, ...windowKey], queryFn: () => api.insightsDashboard(today, period), enabled: Boolean(token), staleTime: 5 * 60 * 1000 });
  const reviewsOn = useModule('reviews')?.on ?? false;
  const [hidden, hide, show] = useHiddenInsights();
  // "N set aside" under the counts opens those cards in place, each with Show again (2026-11-06).
  const [asideOpen, setAsideOpen] = useState(false);
  const asideId = useId();
  const asideBtn = useRef<HTMLButtonElement>(null);
  const [raw, setFilter] = useParamState('show', 'all');
  const filter: Filter = FILTERS.some((f) => f.value === raw) ? (raw as Filter) : 'all';
  const all = q.data?.insights ?? [];
  const fits = (i: Insight) => filter === 'all' || GROUP[i.key] === filter;
  const found = all.filter((i) => i.state === 'ready' && fits(i));
  // Good and bad habits and the plain habits have their own section, so What stands out holds the rest, by area of life.
  const ready = found.filter((i) => !isHabitKey(i));
  const shown = ready.filter((i) => !hidden.has(i.id));
  const aside = found.filter((i) => !i.tie && hidden.has(i.id));
  const [rawHabits, setHabits] = useParamState('habits', 'all');
  const habitFilter: HabitFilter = HABIT_FILTERS.some((f) => f.value === rawHabits) ? (rawHabits as HabitFilter) : 'all';
  const ties = all.filter((i) => i.state === 'ready' && i.tie && !hidden.has(i.id));
  const tiesAside = all.filter((i) => i.state === 'ready' && i.tie && hidden.has(i.id));
  const plainHabits = all.filter((i) => i.state === 'ready' && i.key === 'habit' && !hidden.has(i.id));
  const good = ties.filter((i) => i.tie?.verdict === 'good');
  const bad = ties.filter((i) => i.tie?.verdict === 'bad');
  const tiesShown = habitFilter === 'good' ? good : habitFilter === 'bad' ? bad : [...ties, ...plainHabits];
  const watching = all.filter((i) => i.state === 'watching' && fits(i));
  const places: Place[] = [...LIFE_AREA_ORDER, 'across'];
  const inPlace = (p: Place) => shown.filter((i) => PLACE[i.key as keyof typeof PLACE] === p);
  const anyShown = places.some((p) => inPlace(p).length > 0);
  // Not now takes the card and its menu away, so the keyboard's place moves to the section's heading.
  const hideIn = (heading: string) => (id: string) => {
    hide(id);
    focusHeadingAfter(heading);
  };
  return (
    <Screen howTo={false}>
      <PageHeader back={{ to: '/home', label: 'Home' }} title="Emerging" lede="Your life by period, and the patterns in what you log. Things that happen together, not causes." />
      <div className="mt-md">
        <PeriodFilter period={period} blank="The last 8 weeks" onChange={setPeriod} today={today} kinds={PERIOD_KINDS} />
        {period && (
          <div className="mt-xs flex justify-end">
            <button
              type="button"
              onClick={() => {
                setPeriod(null);
                // This button goes with the period, so the keyboard's place moves to the numbers it changed.
                focusHeadingAfter('your-life');
              }}
              className="toy toy-flat inline-flex min-h-[44px] items-center rounded-pill px-sm text-subhead text-ink-soft"
            >
              Back to the last 8 weeks
            </button>
          </div>
        )}
      </div>

      <Section
        id="your-life"
        title={
          // Two parts kept whole, broken after the comma where a phone cannot fit both.
          <>
            <span className="inline-block">Your life,</span> <span className="inline-block">{board.data?.heading ?? (period ? 'this period' : 'the last 8 weeks')}</span>
          </>
        }
        lede={board.data?.compare}
        action={reviewsOn ? <SeeAll to={period ? `/reviews?kind=${period.kind}&date=${period.start}` : '/reviews'}>Review it</SeeAll> : undefined}
      >
        {board.data ? (
          <LifeDashboardBlock data={board.data} />
        ) : board.isError ? (
          <ErrorLine e={board.error} />
        ) : (
          <div className="grid grid-cols-2 gap-sm md:grid-cols-4" role="status" aria-label="Adding up your numbers">
            <Skeleton className="h-[160px]" />
            <Skeleton className="h-[160px]" />
            <Skeleton className="h-[160px]" />
            <Skeleton className="h-[160px]" />
          </div>
        )}
      </Section>

      {q.isLoading ? (
        <div className="mt-lg grid grid-cols-2 gap-sm">
          <Skeleton className="h-[96px]" />
          <Skeleton className="h-[96px]" />
        </div>
      ) : q.error ? (
        <ErrorLine e={q.error} className="mt-lg" />
      ) : (
        <>
          <div className="mt-lg grid grid-cols-2 gap-sm">
            <StatTile label="Patterns found" value={formatCount(found.length)} hint={aside.length > 0 ? undefined : period ? 'In this period' : 'From your own logs'}>
              {aside.length > 0 && (
                <button
                  ref={asideBtn}
                  type="button"
                  aria-expanded={asideOpen}
                  aria-controls={asideId}
                  onClick={() => setAsideOpen((o) => !o)}
                  className="toy toy-flat -ml-sm mt-xs inline-flex min-h-[44px] items-center gap-xs rounded-pill px-sm text-caption text-ink-soft"
                >
                  {formatCount(aside.length)} set aside
                  <ToggleChevron open={asideOpen} size={14} />
                </button>
              )}
            </StatTile>
            <StatTile label="Still watching" value={formatCount(watching.length)} hint="Waiting for more days" />
          </div>
          {asideOpen && aside.length > 0 && (
            <div className="mt-sm">
              <SetAsideList
                id={asideId}
                list={aside}
                onShow={(x) => {
                  // The row leaves the list: focus goes back to the count, or, after the last one, the list closes (so the next Not now
                  // starts it closed) and focus moves to the section's heading, since the count goes too.
                  const last = aside.length <= 1;
                  show(x);
                  if (!last) asideBtn.current?.focus();
                  else {
                    setAsideOpen(false);
                    focusHeading('emerging-found');
                  }
                }}
              />
            </div>
          )}
          <Section
            id="emerging-found"
            title="What stands out"
            lede={
              // Said once: why a short period shows less here. With no card at all the line is the section's content instead (below), so the
              // block never ends in an empty gap (the spacing pass, 2026-11-07).
              anyShown
                ? period
                  ? 'Patterns need enough days to be fair, so a short period shows more under Still watching.'
                  : 'The strongest first, by area of life.'
                : undefined
            }
            tools={<Segmented label="Show" value={filter} onChange={(v) => setFilter(v)} options={FILTERS} />}
          >
            {!anyShown && (
              <p className="m-0 text-balance text-subhead text-ink-soft">
                {period ? 'Patterns need enough days to be fair, so a short period shows more under Still watching.' : aside.length ? 'You set these aside. Show them again above.' : 'Nothing yet. Keep logging and patterns show up here.'}
              </p>
            )}
            {places.map((p) => {
              const list = inPlace(p);
              if (!list.length) return null;
              return (
                <div key={p} className="mt-md first:mt-0" data-pillar={p === 'across' ? undefined : LIFE_AREAS[p].relationship}>
                  <h3 className="m-0 flex items-center gap-xs text-headline">
                    {p === 'across' ? <Icon icon={CalendarDays} size={20} /> : <AppIcon name={LIFE_AREAS[p].icon} size={20} />}
                    {p === 'across' ? 'Across your days' : LIFE_AREAS[p].name}
                  </h3>
                  <div className="mt-xs">
                    <FirstCards list={list} first={AREA_FIRST} onHide={hideIn('emerging-found')} />
                  </div>
                </div>
              );
            })}
          </Section>
          <Section
            id="emerging-habits"
            title="Good and bad habits"
            lede={ties.length || plainHabits.length ? 'Tasks you keep doing, beside how those days went.' : tiesAside.length ? 'You set these aside for now.' : 'Nothing clear yet. Keep ticking and logging how your days go.'}
            tools={ties.length > 0 ? <Segmented label="Show habits" value={habitFilter} onChange={(v) => setHabits(v)} options={HABIT_FILTERS} /> : undefined}
          >
            <div className="grid grid-cols-2 gap-sm">
              <StatTile label="Good habits" value={formatCount(good.length)} hint="Days went better" />
              <StatTile label="Bad habits" value={formatCount(bad.length)} hint="Days went worse" />
            </div>
            {(ties.length > 0 || plainHabits.length > 0) && (
              <div className="mt-md">
                {tiesShown.length > 0 ? <FirstCards list={tiesShown} first={HABITS_FIRST} onHide={hideIn('emerging-habits')} /> : <p className="m-0 text-subhead text-ink-soft">{habitFilter === 'good' ? 'No good habits yet.' : 'No bad habits yet.'}</p>}
              </div>
            )}
            <SetAsideFold list={tiesAside} onShow={show} heading="emerging-habits" />
          </Section>
          {watching.length > 0 && (
            <Section id="emerging-watching" title="Still watching" lede="Each one says what it still needs.">
              <Fold title={`${formatCount(watching.length)} waiting for more days`} defaultOpen={watching.length <= 3}>
                <ul className="m-0 flex list-none flex-col gap-xs p-0">
                  {watching.map((i) => (
                    <li key={i.id} className="rounded-tile bg-card p-sm">
                      <p className="m-0 text-card-title">{i.text}</p>
                      {i.need && <p className="mt-xs m-0 text-card-note text-ink-soft">{i.need}</p>}
                    </li>
                  ))}
                </ul>
              </Fold>
            </Section>
          )}
        </>
      )}
      <HowItWorks page={{ key: 'insights', name: 'Emerging' }} />
    </Screen>
  );
}
