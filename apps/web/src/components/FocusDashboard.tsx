import { FOCUS_VIEWS, focusGoalMet, focusQualityName, RELATIONSHIP_BY_KEY, type FocusView } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useSession } from '../lib/store';
import { bento } from '../lib/bento';
import { useFocusPrefs } from '../lib/focusPrefs';
import { useParamState } from '../lib/useParamState';
import { HBars, PillBars, StatTile } from './Charts';
import { Section } from './Section';

type Unit = 'min' | 'hours';

/** Focus time in the unit the person picked: whole minutes, or hours to one decimal (worked out in whole tenths). */
const show = (min: number, unit: Unit) => (unit === 'hours' ? `${Math.round(min / 6) / 10} h` : `${min} min`);
/** A bar's size in the picked unit; only for drawing. */
const scale = (min: number, unit: Unit) => (unit === 'hours' ? Math.round(min / 6) / 10 : min);

/**
 * How productive the focus sessions were: minutes of focus and tasks ticked by day, week or month, a plain line on how this stretch
 * compares with the one before it, and where the time went by task. Owner only, from the sessions kept when each one finished.
 */
export function FocusDashboard() {
  const token = useSession((s) => s.token);
  const [viewRaw, setView] = useParamState('focusView', 'day');
  const [unitRaw, setUnit] = useParamState('focusUnit', 'min');
  const unit: Unit = unitRaw === 'hours' ? 'hours' : 'min';
  const view = (FOCUS_VIEWS.find((v) => v.key === viewRaw)?.key ?? 'day') as FocusView;
  const spec = FOCUS_VIEWS.find((v) => v.key === view)!;
  const q = useQuery({ queryKey: ['focus', view], queryFn: () => api.focusDashboard(view, todayLocal()), enabled: Boolean(token) });
  const d = q.data;
  // The optional daily goal adds one tile: the days in this stretch that met it. A count only, never a streak.
  const goal = useFocusPrefs().settings.goalMinutes;
  const tiles = goal ? 6 : 5;
  const cols = goal ? 3 : 5;
  const maxMin = d ? Math.max(unit === 'hours' ? 0.5 : 30, ...d.buckets.map((b) => scale(b.minutes, unit))) : unit === 'hours' ? 0.5 : 30;
  const maxTasks = d ? Math.max(3, ...d.buckets.map((b) => b.tasksDone)) : 3;

  return (
    <Section id="focus-dashboard" title="How productive you were" lede={`Focus time and tasks ticked. ${spec.blurb}`}>
      {/* One line on a laptop: the periods on the left, the unit at the right. A phone wraps the unit to its own line, still at the right. */}
      <div className="flex flex-wrap items-center gap-xs">
        <div className="flex gap-xs" role="group" aria-label="Show by">
        {FOCUS_VIEWS.map((v) => (
          <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setView(v.key)} className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${view === v.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {v.name}
          </button>
        ))}
      </div>

        <div className="ml-auto flex gap-xs" role="group" aria-label="Show focus time in">
        {(['min', 'hours'] as const).map((u) => (
          <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${unit === u ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {u === 'min' ? 'Minutes' : 'Hours'}
          </button>
        ))}
        </div>
      </div>

      {q.isPending && (
        <p className="mt-sm m-0 text-[14px] font-bold text-ink-soft" role="status">
          Adding it up
        </p>
      )}
      {q.isError && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load this. Try again in a moment.
        </p>
      )}

      {d && (
        <>
          <div className={`mt-sm grid grid-cols-2 gap-xs ${goal ? 'md:grid-cols-3' : 'md:grid-cols-5'}`}>
            <StatTile className={bento(0, tiles, 2, cols)} label="Focus time" value={show(d.totals.minutes, unit)} hint={`${d.totals.rounds} ${d.totals.rounds === 1 ? 'session' : 'sessions'}`} />
            <StatTile
              className={bento(1, tiles, 2, cols)}
              label="Focus quality"
              value={
                d.totals.quality === null ? (
                  '—'
                ) : (
                  <>
                    {d.totals.quality} <span className="text-[14px] font-bold text-ink-soft">{focusQualityName(d.totals.quality)}</span>
                  </>
                )
              }
              hint={d.totals.rated > 0 ? `${d.totals.rated} ${d.totals.rated === 1 ? 'session' : 'sessions'} rated` : 'Rate a session to see it'}
            />
            <StatTile className={bento(2, tiles, 2, cols)} label="Tasks ticked" value={d.totals.tasksDone} hint="in the same stretch" />
            <StatTile className={bento(3, tiles, 2, cols)} label="Active" value={`${d.totals.activeBuckets} of ${d.buckets.length}`} hint={view === 'day' ? 'days with a session' : view === 'week' ? 'weeks with a session' : 'months with a session'} />
            <StatTile className={bento(4, tiles, 2, cols)} label="Best" value={d.best ? show(d.best.minutes, unit) : 'None yet'} hint={d.best ? d.best.label : 'Finish a session'} />
            {goal && <StatTile className={bento(5, tiles, 2, cols)} label="Days the goal was met" value={`${focusGoalMet(d.dayMinutes, goal)} of ${d.dayMinutes.length}`} hint={`${goal} minutes a day`} />}
          </div>
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{d.trend}</p>

          <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 text-[14px] font-extrabold">{unit === 'hours' ? 'Focus hours' : 'Focus minutes'}</p>
            <div className="mt-xs">
              <PillBars values={d.buckets.map((b) => scale(b.minutes, unit))} max={maxMin} labels={d.buckets.map((b) => b.label)} color="var(--color-r1)" label={`Focus ${unit === 'hours' ? 'hours' : 'minutes'} by ${view}, ${show(d.totals.minutes, unit)} in all`} height={140} allLabels={d.buckets.length <= 8} />
            </div>
            <p className="mt-md m-0 text-[14px] font-extrabold">Tasks ticked</p>
            <div className="mt-xs">
              <PillBars values={d.buckets.map((b) => b.tasksDone)} max={maxTasks} labels={d.buckets.map((b) => b.label)} color="var(--color-r4)" label={`Tasks ticked by ${view}, ${d.totals.tasksDone} in all`} height={90} allLabels={d.buckets.length <= 8} />
            </div>
          </div>

          {d.tasks.length > 0 && (
            <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
              <p className="m-0 text-[14px] font-extrabold">Where the time went</p>
              <div className="mt-xs">
                <HBars
                  rows={d.tasks.map((t, i) => ({ key: t.nodeId ?? `none-${i}`, label: t.title, value: d.totals.minutes ? t.minutes / d.totals.minutes : 0, text: t.planned ? `${unit === 'hours' ? show(t.minutes, unit) : t.minutes} of ${show(t.planned, unit)} planned` : `${show(t.minutes, unit)}, ${t.rounds} ${t.rounds === 1 ? 'session' : 'sessions'}`, color: t.nodeId ? RELATIONSHIP_BY_KEY.servant_leader.color : RELATIONSHIP_BY_KEY.self.color }))}
                  label="Focus time by task"
                />
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
