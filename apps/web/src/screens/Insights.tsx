import { useId, useRef, useState } from 'react';
import { formatCount, type Insight, type InsightKey } from '@kreators/shared';
import { Screen } from '../components/Screen';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { StatTile } from '../components/Charts';
import { Segmented } from '../components/fx/Segmented';
import { HowItWorks } from '../components/HowTo';
import { Skeleton } from '../components/Skeleton';
import { ErrorLine } from '../components/ErrorLine';
import { focusHeading, InsightGrid, SetAsideFold, SetAsideList, useHiddenInsights, useInsights } from '../components/Emergence';
import { ToggleChevron } from '../components/ToggleMark';
import { useParamState } from '../lib/useParamState';

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
};

/**
 * Emerging, the core page (not an app: it holds nothing of its own, it only reads what the person's apps already show them). Every
 * pattern found, then what is still being watched with what it needs. Owner only, computed on read, nothing stored.
 */
export function Insights() {
  const q = useInsights('insights');
  const [hidden, hide, show] = useHiddenInsights();
  // "N set aside" under Patterns found opens those cards in place, each with Show again (2026-11-06).
  const [asideOpen, setAsideOpen] = useState(false);
  const asideId = useId();
  const asideBtn = useRef<HTMLButtonElement>(null);
  const [raw, setFilter] = useParamState('show', 'all');
  const filter: Filter = FILTERS.some((f) => f.value === raw) ? (raw as Filter) : 'all';
  const all = q.data?.insights ?? [];
  const fits = (i: Insight) => filter === 'all' || GROUP[i.key] === filter;
  // Good and bad habits have their own block, so "What stands out" holds the rest.
  const ready = all.filter((i) => i.state === 'ready' && !i.tie && fits(i));
  const shown = ready.filter((i) => !hidden.has(i.id));
  const aside = ready.filter((i) => hidden.has(i.id));
  const [rawHabits, setHabits] = useParamState('habits', 'all');
  const habitFilter: HabitFilter = HABIT_FILTERS.some((f) => f.value === rawHabits) ? (rawHabits as HabitFilter) : 'all';
  const ties = all.filter((i) => i.state === 'ready' && i.tie && !hidden.has(i.id));
  const tiesAside = all.filter((i) => i.state === 'ready' && i.tie && hidden.has(i.id));
  const good = ties.filter((i) => i.tie?.verdict === 'good');
  const bad = ties.filter((i) => i.tie?.verdict === 'bad');
  const tiesShown = habitFilter === 'good' ? good : habitFilter === 'bad' ? bad : ties;
  const watching = all.filter((i) => i.state === 'watching' && fits(i));
  return (
    <Screen howTo={false}>
      <PageHeader back={{ to: '/home', label: 'Home' }} title="Emerging" lede="Patterns in what you already log. Things that happen together, not causes." />
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
            <StatTile label="Patterns found" value={formatCount(ready.length)} hint={aside.length > 0 ? undefined : 'From your own logs'}>
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
            lede={shown.length ? 'The strongest first.' : aside.length ? 'You set these aside. Show them again above.' : 'Nothing yet. Keep logging and patterns show up here.'}
            tools={<Segmented label="Show" value={filter} onChange={(v) => setFilter(v)} options={FILTERS} />}
          >
            {shown.length > 0 && <InsightGrid list={shown} onHide={hide} />}
          </Section>
          <Section
            id="emerging-habits"
            title="Good and bad habits"
            lede={ties.length ? 'Tasks you keep doing, beside how those days went.' : tiesAside.length ? 'You set these aside for now.' : 'Nothing clear yet. Keep ticking and logging how your days go.'}
            tools={ties.length > 0 ? <Segmented label="Show habits" value={habitFilter} onChange={(v) => setHabits(v)} options={HABIT_FILTERS} /> : undefined}
          >
            <div className="grid grid-cols-2 gap-sm">
              <StatTile label="Good habits" value={formatCount(good.length)} hint="Days went better" />
              <StatTile label="Bad habits" value={formatCount(bad.length)} hint="Days went worse" />
            </div>
            {ties.length > 0 && (
              <>
                <div className="mt-md">
                  {tiesShown.length > 0 ? <InsightGrid list={tiesShown} onHide={hide} /> : <p className="m-0 text-subhead text-ink-soft">{habitFilter === 'good' ? 'No good habits yet.' : 'No bad habits yet.'}</p>}
                </div>
              </>
            )}
            <SetAsideFold list={tiesAside} onShow={show} heading="emerging-habits" />
          </Section>
          {watching.length > 0 && (
            <Section id="emerging-watching" title="Still watching" lede="Each one says what it still needs.">
              <ul className="m-0 flex list-none flex-col gap-xs p-0">
                {watching.map((i) => (
                  <li key={i.id} className="rounded-tile bg-card p-sm">
                    <p className="m-0 text-card-title">{i.text}</p>
                    {i.need && <p className="mt-xs m-0 text-card-note text-ink-soft">{i.need}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
      <HowItWorks page={{ key: 'insights', name: 'Emerging' }} />
    </Screen>
  );
}
