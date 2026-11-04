import { formatCount, type Insight, type InsightKey } from '@kreators/shared';
import { Screen } from '../components/Screen';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { StatTile } from '../components/Charts';
import { Segmented } from '../components/fx/Segmented';
import { HowItWorks } from '../components/HowTo';
import { Skeleton } from '../components/Skeleton';
import { ErrorLine } from '../components/ErrorLine';
import { InsightGrid, useHiddenInsights, useInsights } from '../components/Emergence';
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
  const [hidden, hide] = useHiddenInsights();
  const [raw, setFilter] = useParamState('show', 'all');
  const filter: Filter = FILTERS.some((f) => f.value === raw) ? (raw as Filter) : 'all';
  const all = q.data?.insights ?? [];
  const fits = (i: Insight) => filter === 'all' || GROUP[i.key] === filter;
  // Good and bad habits have their own block, so "What stands out" holds the rest.
  const ready = all.filter((i) => i.state === 'ready' && !i.tie && fits(i));
  const shown = ready.filter((i) => !hidden.has(i.id));
  const [rawHabits, setHabits] = useParamState('habits', 'all');
  const habitFilter: HabitFilter = HABIT_FILTERS.some((f) => f.value === rawHabits) ? (rawHabits as HabitFilter) : 'all';
  const ties = all.filter((i) => i.state === 'ready' && i.tie && !hidden.has(i.id));
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
            <StatTile label="Patterns found" value={formatCount(ready.length)} hint={ready.length - shown.length > 0 ? `${formatCount(ready.length - shown.length)} set aside` : 'From your own logs'} />
            <StatTile label="Still watching" value={formatCount(watching.length)} hint="Waiting for more days" />
          </div>
          <Segmented label="Show" value={filter} onChange={(v) => setFilter(v)} options={FILTERS} className="mt-md" />
          <Section id="emerging-found" title="What stands out" lede={shown.length ? 'The strongest first.' : 'Nothing yet. Keep logging and patterns show up here.'}>
            {shown.length > 0 && <InsightGrid list={shown} onHide={hide} />}
          </Section>
          <Section id="emerging-habits" title="Good and bad habits" lede={ties.length ? 'Tasks you keep doing, beside how those days went.' : 'Nothing clear yet. Keep ticking and logging how your days go.'}>
            <div className="grid grid-cols-2 gap-sm">
              <StatTile label="Good habits" value={formatCount(good.length)} hint="Days went better" />
              <StatTile label="Bad habits" value={formatCount(bad.length)} hint="Days went worse" />
            </div>
            {ties.length > 0 && (
              <>
                <Segmented label="Show habits" value={habitFilter} onChange={(v) => setHabits(v)} options={HABIT_FILTERS} className="mt-md" />
                <div className="mt-md">
                  {tiesShown.length > 0 ? <InsightGrid list={tiesShown} onHide={hide} /> : <p className="m-0 text-[14px] font-semibold text-ink-soft">{habitFilter === 'good' ? 'No good habits yet.' : 'No bad habits yet.'}</p>}
                </div>
              </>
            )}
          </Section>
          {watching.length > 0 && (
            <Section id="emerging-watching" title="Still watching" lede="Each one says what it still needs.">
              <ul className="m-0 flex list-none flex-col gap-xs p-0">
                {watching.map((i) => (
                  <li key={i.id} className="rounded-tile bg-card p-sm">
                    <p className="m-0 text-[16px] font-bold">{i.text}</p>
                    {i.need && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{i.need}</p>}
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
