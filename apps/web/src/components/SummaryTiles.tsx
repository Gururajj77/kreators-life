import { focusQualityName, formatCount, LIFE_AREAS, PERIOD_META, type ReviewSummary } from '@kreators/shared';
import type { ReactNode } from 'react';
import { todayLocal } from '../lib/date';
import { tbClass, tbStyle } from '../lib/blockColor';
import { StatTile } from './Charts';
import { MoodFace } from './MoodFace';
import { delta, moneyDelta, moneyRounded, type SummaryPart } from './PeriodPanel';
import { TileGroups } from './TileGroups';

/** A period's tiles: two to a row on a phone and a tablet, four from the laptop width, in even rows (lib/bento.ts). */
const TILE_COLS = { base: 2, lg: 4 } as const;

/**
 * The categories a long block of tiles reads in (the founder, 2026-11-07), and the order inside each. The five areas of life go in their one
 * order, each holding what the life dashboard (shared lifeDashboard.ts) gives it; what belongs to no area sits round them. A label not listed
 * here is a type error, so a new tile always has a place.
 */
const TILE_CATEGORIES = [
  { key: 'tasks', name: 'Tasks and days', labels: ['Check-ins', 'Tasks done', 'Xp earned', 'Kinds of day', 'Kept days', 'Habits ticked', 'P0 and P1 done', 'Overdue'] },
  { key: 'physical', name: LIFE_AREAS.physical.name, labels: ['Sleep', 'Active minutes', 'Days moved', 'Eating', 'Water', 'Water a day', 'Water goal met', 'Supplements'] },
  { key: 'financial', name: LIFE_AREAS.financial.name, labels: ['Income', 'Spent', 'Kept', 'Budgets over', 'Owed to you', 'You owe', 'Savings goals'] },
  { key: 'mental', name: LIFE_AREAS.mental.name, labels: ['Focus', 'Focus quality', 'Stress', 'Mindful'] },
  { key: 'emotional', name: LIFE_AREAS.emotional.name, labels: ['Mood', 'Journal', 'Gratitude'] },
  { key: 'spiritual', name: LIFE_AREAS.spiritual.name, labels: ['Small acts', 'Routine'] },
  { key: 'work', name: 'Work and learning', labels: ['Orders', 'Sales', 'Lessons done', 'Programs finished', 'Applications', 'Decisions'] },
  { key: 'people', name: 'People', labels: ['Events', 'Posts', 'Circles', 'Runs'] },
] as const;
type TileLabel = (typeof TILE_CATEGORIES)[number]['labels'][number];

/**
 * The period's numbers as tiles, each next to the period before. Which parts show depends on the dashboard. Its own chunk (2026-11-07),
 * downloaded after the first paint by the "By period" blocks (PeriodPanel) and with Reviews, so the fuller parts never weigh on the entry.
 *
 * The fuller parts of 2026-11-07 (water, focus, the task and money extras, supplements) show only when the server sent them (it reads a
 * part only while its app is on) and the period or the one before holds something, so a part nobody uses is never a row of zeros.
 */
export function SummaryTiles({ summary, parts, keep, whole }: { summary: ReviewSummary; parts: readonly SummaryPart[]; /** Which tiles stay, by the page they open (Home and Reviews drop the tiles of apps that are off). */ keep?: (to: string | undefined) => boolean; /** Why this block stays one even block past the limit (`TileGroups`). */ whole?: string }) {
  const { now, before, currency } = summary;
  const prev = PERIOD_META[summary.period.kind].previous;
  const oneDay = summary.period.kind === 'day';
  const day = todayLocal();
  const soFar = summary.period.start <= day && day <= summary.period.end;
  const tiles: { label: TileLabel; value: ReactNode; hint: string; to?: string }[] = [];
  const face = (v: number | null, text: string) =>
    v === null ? (
      '–'
    ) : (
      <span className="flex items-center gap-xs">
        <MoodFace value={Math.round(v)} size={28} />
        {text}
      </span>
    );
  const days = (n: number) => `${formatCount(n)} ${n === 1 ? 'day' : 'days'}`;
  /** Something in this period or the one before (a count above zero, or an average that is not null). */
  const any = (...v: (number | null | undefined)[]) => v.some((x) => x !== undefined && x !== null && x !== 0);
  for (const part of parts) {
    if (part === 'daily') {
      tiles.push(
        { label: 'Check-ins', value: `${formatCount(now.checkins)} of ${formatCount(now.days)}`, hint: delta(now.checkins, before.checkins, prev), to: '/today' },
        { label: 'Tasks done', value: formatCount(now.tasksDone), hint: delta(now.tasksDone, before.tasksDone, prev), to: '/today' },
        { label: 'Small acts', value: formatCount(now.smallActs), hint: delta(now.smallActs, before.smallActs, prev), to: '/today' },
        { label: 'Xp earned', value: formatCount(now.xp), hint: delta(now.xp, before.xp, prev), to: '/tower' },
      );
    }
    if (part === 'tasksMore') {
      // Habit tasks ticked, P0 and P1 ticked, and what was overdue as the period ended (as of today while it is still going).
      if (now.habitTicks !== undefined && any(now.habitTicks, before.habitTicks)) tiles.push({ label: 'Habits ticked', value: formatCount(now.habitTicks), hint: delta(now.habitTicks, before.habitTicks ?? null, prev), to: '/today' });
      if (now.topPriorityDone !== undefined && any(now.topPriorityDone, before.topPriorityDone)) tiles.push({ label: 'P0 and P1 done', value: formatCount(now.topPriorityDone), hint: delta(now.topPriorityDone, before.topPriorityDone ?? null, prev), to: '/today' });
      if (now.overdueAtEnd !== undefined && any(now.overdueAtEnd, before.overdueAtEnd))
        tiles.push({ label: 'Overdue', value: formatCount(now.overdueAtEnd), hint: `${soFar ? 'as of today' : 'as it ended'} · ${delta(now.overdueAtEnd, before.overdueAtEnd ?? null, prev)}`, to: '/today' });
      // The strategy session's routine: the days with every morning step ticked, only for someone who keeps one.
      if (now.routineDays !== undefined && any(now.routineDays, before.routineDays)) tiles.push({ label: 'Routine', value: `${formatCount(now.routineDays)} of ${formatCount(now.days)}`, hint: delta(now.routineDays, before.routineDays ?? null, prev), to: '/today#routine' });
    }
    if (part === 'kinds') {
      // Kinds of day (2026-11-06): the period's days so far with a kind (set for the date or given by the week; the default has none),
      // the kind used most beside it. A review saved before then has no count, so it shows a dash. The count runs only to today, so a
      // period still going says "so far" beside the whole period before it (no other tile counts days, so none says it).
      const n = now.kindDays;
      const top = now.kinds?.[0];
      tiles.push({
        label: 'Kinds of day',
        value:
          n === undefined ? (
            '–'
          ) : (
            <span className={`flex items-center gap-xs ${top ? tbClass(top.color) : ''}`} style={top ? tbStyle(top.color) : undefined}>
              {top && <span className="tb-dot" aria-hidden="true" />}
              {days(n)}
            </span>
          ),
        hint: n === undefined ? 'not counted then' : `${soFar ? 'so far · ' : ''}${top ? `${top.name} most · ` : ''}${delta(n, before.kindDays ?? null, prev)}`,
        to: '/time-blocks',
      });
    }
    if (part === 'notToDo') {
      tiles.push({ label: 'Kept days', value: now.notToDoKept, hint: `${now.notToDoSlipped} ${now.notToDoSlipped === 1 ? 'slip' : 'slips'} · ${delta(now.notToDoKept, before.notToDoKept, prev)}`, to: '/today' });
    }
    if (part === 'wellbeing') {
      tiles.push(
        { label: 'Mood', value: face(now.moodAvg, now.moodAvg === null ? '' : now.moodAvg.toFixed(1)), hint: delta(now.moodAvg, before.moodAvg, prev, 1), to: '/mood' },
        { label: 'Sleep', value: now.sleepAvg === null ? '–' : `${now.sleepAvg.toFixed(1)} h`, hint: delta(now.sleepAvg, before.sleepAvg, prev, 1), to: '/sleep' },
        { label: 'Stress', value: now.stressAvg === null ? '–' : `${now.stressAvg.toFixed(1)} of 5`, hint: delta(now.stressAvg, before.stressAvg, prev, 1), to: '/stress' },
        { label: 'Mindful', value: `${formatCount(now.mindfulMin)} min`, hint: delta(now.mindfulMin, before.mindfulMin, prev), to: '/mindful' },
      );
    }
    if (part === 'water') {
      // Water (core, pays nothing): a day's amount, or a longer period's average over the days with water logged, and the days the goal was met.
      if (now.waterDays !== undefined && any(now.waterDays, before.waterDays)) {
        const avg = now.waterAvgMl ?? null;
        tiles.push(
          // A longer period's label says it is a day's average, so the value stays short enough for its tile ("1,750 ml").
          { label: oneDay ? 'Water' : 'Water a day', value: avg === null ? '–' : `${formatCount(avg)} ml`, hint: `${oneDay ? '' : `${days(now.waterDays)} logged · `}${delta(avg, before.waterAvgMl ?? null, prev)}`, to: '/today' },
          { label: 'Water goal met', value: `${now.waterGoalDays ?? 0} of ${now.days}`, hint: delta(now.waterGoalDays ?? 0, before.waterGoalDays ?? null, prev), to: '/today' },
        );
      }
    }
    if (part === 'focus') {
      // Focus (Mindfulness): minutes and sessions, and how deep the rated ones went (an unrated session is left out, never a zero).
      if (now.focusMin !== undefined && any(now.focusSessions, before.focusSessions)) {
        const q = now.focusQualityAvg ?? null;
        tiles.push(
          { label: 'Focus', value: `${formatCount(now.focusMin)} min`, hint: `${formatCount(now.focusSessions ?? 0)} ${now.focusSessions === 1 ? 'session' : 'sessions'} · ${delta(now.focusMin, before.focusMin ?? null, prev)}`, to: '/mindful' },
          { label: 'Focus quality', value: q === null ? '–' : focusQualityName(q), hint: q === null ? 'none rated' : `${q.toFixed(1)} of 5 · ${delta(q, before.focusQualityAvg ?? null, prev, 1)}`, to: '/mindful' },
        );
      }
    }
    if (part === 'fitness') {
      // Fitness (2026-11-07): the period's active minutes and how well the person ate on average. A review saved before has no eating number.
      const eat = now.eatAvg ?? null;
      // Days moved (2026-11-07): a count of days, so a saved review from before it shows a dash.
      const moved = now.moveDays;
      // Kreators Run's tool writes the same movement, so with Fitness off and Run on these two stay and open the tool; eating is Fitness's alone.
      const moveTo = keep && !keep('/fitness') && keep('/run') ? '/run?tab=tracking' : '/fitness';
      tiles.push(
        { label: 'Active minutes', value: `${formatCount(now.moveMin)} min`, hint: delta(now.moveMin, before.moveMin, prev), to: moveTo },
        { label: 'Days moved', value: moved === undefined ? '–' : days(moved), hint: moved === undefined ? 'not counted then' : delta(moved, before.moveDays ?? null, prev), to: moveTo },
        // A check-in with no fruit or veg said has no score, so "nothing logged" would not be true of it.
        { label: 'Eating', value: eat === null ? '–' : `${eat.toFixed(1)} of 5`, hint: eat === null ? 'no score yet' : (before.eatAvg ?? null) === null ? `no score ${prev}` : delta(eat, before.eatAvg ?? null, prev, 1), to: '/fitness' },
      );
    }
    if (part === 'supplements') {
      // Supplements: Reviews only, sent only while Track supplements is on. A count of ticks against what was due, never a name.
      if (now.suppDue !== undefined && any(now.suppDue, before.suppDue)) tiles.push({ label: 'Supplements', value: `${formatCount(now.suppTaken ?? 0)} of ${formatCount(now.suppDue)}`, hint: `${soFar ? 'so far · ' : ''}${delta(now.suppTaken ?? 0, before.suppTaken ?? null, prev)}`, to: '/fitness#supplements' });
    }
    if (part === 'journal') {
      tiles.push({ label: 'Journal', value: `${formatCount(now.journalEntries)} ${now.journalEntries === 1 ? 'entry' : 'entries'}`, hint: delta(now.journalEntries, before.journalEntries, prev), to: '/journal' });
      // Gratitude for the day, counted by day (never a word); a review saved before it came has no count, so it shows only when there is one.
      if (now.gratitudeDays !== undefined) {
        const g = now.gratitudeDays;
        tiles.push({ label: 'Gratitude', value: days(g), hint: delta(g, before.gratitudeDays ?? 0, prev), to: '/journal#gratitude-heading' });
      }
    }
    if (part === 'finance') {
      tiles.push(
        { label: 'Income', value: moneyRounded(now.incomeCents, currency), hint: moneyDelta(now.incomeCents, before.incomeCents, prev, currency), to: '/finance' },
        { label: 'Spent', value: moneyRounded(now.expenseCents, currency), hint: moneyDelta(now.expenseCents, before.expenseCents, prev, currency), to: '/finance' },
        { label: 'Kept', value: moneyRounded(now.incomeCents - now.expenseCents, currency), hint: moneyDelta(now.incomeCents - now.expenseCents, before.incomeCents - before.expenseCents, prev, currency), to: '/finance' },
      );
    }
    if (part === 'moneyMore') {
      // Finance's extras, in the person's own currency: budgets over in the months the period touches, what was owed at its end, and the
      // savings goals as they stand today (only a period that holds today has them).
      if ((now.budgetChecks ?? 0) > 0) tiles.push({ label: 'Budgets over', value: `${now.budgetsOver ?? 0} of ${now.budgetChecks}`, hint: delta(now.budgetsOver ?? 0, before.budgetsOver ?? null, prev), to: '/finance' });
      if (now.owedToYouCents !== undefined && any(now.owedToYouCents, now.youOweCents, before.owedToYouCents, before.youOweCents)) {
        tiles.push(
          { label: 'Owed to you', value: moneyRounded(now.owedToYouCents, currency), hint: `${soFar ? 'now' : 'as it ended'} · ${moneyDelta(now.owedToYouCents, before.owedToYouCents ?? 0, prev, currency)}`, to: '/finance' },
          { label: 'You owe', value: moneyRounded(now.youOweCents ?? 0, currency), hint: `${soFar ? 'now' : 'as it ended'} · ${moneyDelta(now.youOweCents ?? 0, before.youOweCents ?? 0, prev, currency)}`, to: '/finance' },
        );
      }
      if (now.goalsCount !== undefined && now.goalSavedCents !== undefined)
        tiles.push({ label: 'Savings goals', value: moneyRounded(now.goalSavedCents, currency), hint: `of ${moneyRounded(now.goalTargetCents ?? 0, currency)} · ${now.goalsReached ?? 0} of ${now.goalsCount} reached`, to: '/finance' });
    }
    if (part === 'shop') {
      tiles.push(
        { label: 'Orders', value: formatCount(now.orders), hint: delta(now.orders, before.orders, prev), to: '/shop' },
        { label: 'Sales', value: moneyRounded(now.salesCents, currency), hint: now.salesPoints ? `plus ${formatCount(now.salesPoints)} points · ${moneyDelta(now.salesCents, before.salesCents, prev, currency)}` : moneyDelta(now.salesCents, before.salesCents, prev, currency), to: '/shop' },
      );
    }
    if (part === 'school') {
      tiles.push(
        { label: 'Lessons done', value: now.lessonsDone, hint: delta(now.lessonsDone, before.lessonsDone, prev), to: '/school' },
        { label: 'Programs finished', value: now.programsDone, hint: delta(now.programsDone, before.programsDone, prev), to: '/school' },
      );
    }
    if (part === 'work') {
      tiles.push(
        { label: 'Applications', value: now.applications, hint: delta(now.applications, before.applications, prev), to: '/work' },
        { label: 'Decisions', value: now.decisions, hint: delta(now.decisions, before.decisions, prev), to: '/work' },
      );
    }
    if (part === 'people') {
      tiles.push(
        { label: 'Events', value: now.events, hint: delta(now.events, before.events, prev), to: '/party' },
        { label: 'Posts', value: now.posts, hint: delta(now.posts, before.posts, prev), to: '/community' },
        { label: 'Circles', value: now.circles, hint: delta(now.circles, before.circles, prev), to: '/circles' },
        { label: 'Runs', value: now.runs, hint: delta(now.runs, before.runs, prev), to: '/run' },
      );
    }
  }
  const shown = keep ? tiles.filter((t) => keep(t.to)) : tiles;
  const groups = TILE_CATEGORIES.map((c) => ({
    key: c.key,
    name: c.name,
    tiles: (c.labels as readonly TileLabel[]).flatMap((label) => shown.filter((t) => t.label === label)),
  }));
  return <TileGroups groups={groups} flat={shown} cols={TILE_COLS} whole={whole} render={(t, className) => <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} to={t.to} className={className} />} />;
}
