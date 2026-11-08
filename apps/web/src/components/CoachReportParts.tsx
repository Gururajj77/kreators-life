import { MOVE_KIND_META, isMoveKind } from '@kreators/shared/fitness';
import { formatCount, KIND_META, LIFE_AREAS, PERIOD_META, RELATIONSHIP_BY_KEY, RELATIONSHIPS, type CoachPeriodNumbers, type CoachPillarRow, type CoachReport, type CoachStudentView, type Node, type NodeKind, type PaceStatus, type TagTone } from '@kreators/shared';
import type { ReactElement, ReactNode } from 'react';
import { evenGrid, evenTile } from '../lib/bento';
import { shortDay, weekday } from '../lib/date';
import { fillVar } from '../lib/relFill';
import { Button } from './Button';
import { AreaLine, Donut, Gauge, HBars, Legend, MultiLine, PillBars, StatTile, WeekDots } from './Charts';
import { Fold } from './Fold';
import { delta } from './PeriodPanel';
import { TileGroups } from './TileGroups';
import { StatusTag } from './StatusTag';
import { TaskLine } from './CoachTaskLine';

/** The numbers: two to a row on a phone, three from a small tablet, four on a laptop, in even rows (lib/bento.ts). */
const NUMBER_COLS = { base: 2, sm: 3, lg: 4 } as const;
/** Charts: one to a row on a phone, two from the tablet. */
const CHART_COLS = { base: 1, md: 2 } as const;

const avgOf = (v: number | null | undefined, unit = '') => (v === null || v === undefined ? '–' : `${v.toFixed(1)}${unit}`);

/** A long report reads in the same parts as Reviews' numbers (TileGroups): the tasks and days, then the areas of life in their one order. A label not listed is a type error, so no tile can go missing. */
const NUMBER_CATEGORIES = [
  { key: 'tasks', name: 'Tasks and days', labels: ['Tasks ticked', 'Check-ins', 'Habit tasks', 'Xp', 'Past due', 'Not to do slips'] },
  { key: 'physical', name: LIFE_AREAS.physical.name, labels: ['Sleep', 'Active minutes', 'Days moved', 'Eating'] },
  { key: 'mental', name: LIFE_AREAS.mental.name, labels: ['Stress', 'Mindful minutes'] },
  { key: 'emotional', name: LIFE_AREAS.emotional.name, labels: ['Mood'] },
  { key: 'spiritual', name: LIFE_AREAS.spiritual.name, labels: ['Routine days'] },
] as const;
type NumberLabel = (typeof NUMBER_CATEGORIES)[number]['labels'][number];

interface Tile {
  label: NumberLabel;
  value: ReactNode;
  hint: string;
}

/** The period's numbers beside the period before: only the fields the server let through, so a part not shared is simply not there. */
function numberTiles(now: CoachPeriodNumbers, before: CoachPeriodNumbers, prev: string): Tile[] {
  const out: Tile[] = [];
  const count = (label: NumberLabel, n: number | undefined, was: number | undefined) => {
    if (n !== undefined) out.push({ label, value: formatCount(n), hint: delta(n, was ?? null, prev) });
  };
  const average = (label: NumberLabel, n: number | null | undefined, was: number | null | undefined, unit = '') => {
    if (n !== undefined) out.push({ label, value: avgOf(n, unit), hint: delta(n, was ?? null, prev, 1) });
  };
  count('Tasks ticked', now.tasksDone, before.tasksDone);
  count('Check-ins', now.checkins, before.checkins);
  count('Habit tasks', now.habitTicks, before.habitTicks);
  count('Xp', now.xp, before.xp);
  // Only when there is something to say, so a clean week is not two more zeros.
  if (now.overdueAtEnd || before.overdueAtEnd) count('Past due', now.overdueAtEnd ?? 0, before.overdueAtEnd);
  if (now.notToDoSlipped || before.notToDoSlipped) count('Not to do slips', now.notToDoSlipped ?? 0, before.notToDoSlipped);
  count('Routine days', now.routineDays, before.routineDays);
  average('Mood', now.moodAvg, before.moodAvg);
  average('Sleep', now.sleepAvg, before.sleepAvg, ' h');
  average('Stress', now.stressAvg, before.stressAvg);
  count('Mindful minutes', now.mindfulMin, before.mindfulMin);
  count('Active minutes', now.moveMin, before.moveMin);
  count('Days moved', now.moveDays, before.moveDays);
  average('Eating', now.eatAvg, before.eatAvg);
  return out;
}

/** Report numbers: tiles against the period before. */
export function ReportNumbers({ report }: { report: CoachReport }) {
  const tiles = numberTiles(report.now, report.before, PERIOD_META[report.period.kind].previous);
  if (tiles.length === 0) return <p className="m-0 text-subhead text-ink-soft">They do not share the parts these numbers come from.</p>;
  const groups = NUMBER_CATEGORIES.map((c) => ({ key: c.key, name: c.name, tiles: (c.labels as readonly NumberLabel[]).flatMap((l) => tiles.filter((t) => t.label === l)) }));
  return <TileGroups groups={groups} flat={tiles} cols={NUMBER_COLS} render={(t, className) => <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} className={className} />} />;
}

function ChartCard({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-xs rounded-tile bg-card p-sm shadow-toy-soft ${className}`}>
      <h3 className="m-0 text-headline">{title}</h3>
      <div className="flex min-w-0 flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

/**
 * Charts, picture first: the streak and the contract's days as gauges, ticks and xp across the picked period, xp by pillar, and the trackers
 * over thirty days. Each only while the student shares what it draws.
 */
export function ReportCharts({ report, view }: { report: CoachReport; view: CoachStudentView }) {
  const cards: ReactElement[] = [];
  const series = report.series;
  const days = series?.map((s) => s.date) ?? [];
  if (report.streak) {
    const { current, best, checkedIn } = report.streak;
    cards.push(
      <ChartCard key="streak" title="Streak">
        <div className="flex flex-wrap items-center gap-md">
          <Gauge value={best > 0 ? Math.min(1, current / best) : 0} size={120} stroke={12} color="var(--color-r6)" label={`Streak ${current} days, best ${best}`}>
            <span className="text-title1 type-figure">{current}</span>
          </Gauge>
          <p className="m-0 min-w-[160px] flex-1 text-subhead text-ink-soft">
            <span className="block">Best {formatCount(best)}.</span>
            <span className="block">{checkedIn ? 'Checked in today.' : 'Not checked in today.'}</span>
          </p>
        </div>
      </ChartCard>,
    );
  }
  if (report.routine) {
    const { days: week, kept, minDays } = report.routine;
    cards.push(
      <ChartCard key="contract" title="Routine and contract">
        <div className="flex flex-wrap items-center gap-md">
          <Gauge value={minDays ? Math.min(1, kept / minDays) : kept / 7} size={120} stroke={12} color="var(--color-r4)" label={`Routine kept ${kept} of the last 7 days${minDays ? `, the contract asks for ${minDays}` : ''}`}>
            <span className="text-title1 type-figure">{kept}</span>
          </Gauge>
          <div className="min-w-[160px] flex-1">
            <WeekDots days={week.map(Boolean)} color="var(--color-r4)" label={`Routine kept ${kept} of the last 7 days`} />
            <p className="mt-xs m-0 text-subhead text-ink-soft">
              <span className="block">Last 7 days.</span>
              <span className="block">{minDays ? `The contract says ${minDays}.` : 'No contract yet.'}</span>
            </p>
          </div>
        </div>
      </ChartCard>,
    );
  }
  if (series && series.length > 1) {
    const tasks = series.map((s) => s.tasks);
    const xp = series.map((s) => s.xp);
    const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const labels = days.map((d) => (report.period.kind === 'week' ? weekday(d) : shortDay(d)));
    cards.push(
      <ChartCard key="tasks" title="Tasks ticked a day">
        {report.period.kind === 'week' ? (
          <PillBars values={tasks} max={Math.max(3, ...tasks)} labels={labels} color="var(--color-r4)" label={`Tasks ticked each day, ${total(tasks)} in all`} allLabels />
        ) : (
          <AreaLine values={tasks} max={Math.max(3, ...tasks)} color="var(--color-r4)" label={`Tasks ticked each day, ${total(tasks)} in all`} labels={labels} />
        )}
      </ChartCard>,
      <ChartCard key="xp" title="Xp a day">
        <AreaLine values={xp} max={Math.max(10, ...xp)} color="var(--color-r6)" label={`Xp each day, ${total(xp)} in all`} labels={labels} />
      </ChartCard>,
    );
  }
  if (report.xpByPillar) {
    const parts = report.xpByPillar;
    const total = parts.reduce((a, p) => a + p.xp, 0);
    const shown = parts.filter((p) => p.xp > 0).sort((a, b) => b.xp - a.xp);
    cards.push(
      <ChartCard key="pillars" title="Xp by pillar">
        {total === 0 ? (
          <p className="m-0 text-subhead text-ink-soft">No xp in a pillar this period.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-md">
            <Donut size={120} stroke={18} label={shown.map((p) => `${RELATIONSHIP_BY_KEY[p.key].name} ${p.xp} xp`).join(', ')} segments={RELATIONSHIPS.map((r) => ({ value: parts.find((p) => p.key === r.key)?.xp ?? 0, color: fillVar(r), label: r.name }))}>
              <span className="text-title3 type-figure">{formatCount(total)}</span>
            </Donut>
            <div className="min-w-[180px] flex-1">
              <Legend items={shown.slice(0, 5).map((p) => ({ color: fillVar(RELATIONSHIP_BY_KEY[p.key]), label: RELATIONSHIP_BY_KEY[p.key].name, text: `${formatCount(p.xp)} xp` }))} />
            </div>
          </div>
        )}
      </ChartCard>,
    );
  }
  const reflection = view.reflection;
  if (reflection) {
    cards.push(
      <ChartCard key="wellbeing" title="Wellbeing">
        <div className="flex flex-wrap items-center gap-md">
          <Gauge value={reflection.wellbeing.score / 100} size={120} stroke={12} color="var(--color-r4)" label={`Wellbeing ${reflection.wellbeing.score} of 100, ${reflection.wellbeing.label}`}>
            <span className="text-title1 type-figure">{reflection.wellbeing.score}</span>
          </Gauge>
          <p className="m-0 min-w-[160px] flex-1 text-subhead text-ink-soft">
            <span className="block">{reflection.wellbeing.label}.</span>
            <span className="block">The last seven days.</span>
          </p>
        </div>
      </ChartCard>,
    );
    const labels = reflection.days.map((x) => shortDay(x.date));
    const moved = reflection.days.filter((x) => x.move > 0).length;
    const minutes = reflection.days.reduce((a, x) => a + x.move, 0);
    cards.push(
      <ChartCard key="feel" title="Mood, stress and eating, 30 days">
        <MultiLine
          label="Mood, stress and how they ate over thirty days, from one to five"
          max={5}
          min={1}
          labels={labels}
          series={[
            { values: reflection.days.map((x) => x.mood), color: 'var(--color-r3)', label: 'Mood' },
            { values: reflection.days.map((x) => x.stress), color: 'var(--color-r1)', label: 'Stress' },
            ...(reflection.days.some((x) => x.eat != null) ? [{ values: reflection.days.map((x) => x.eat ?? null), color: 'var(--color-r5)', label: 'Eating' }] : []),
          ]}
        />
      </ChartCard>,
      <ChartCard key="sleep" title="Sleep, 30 days">
        <AreaLine label="Hours of sleep over thirty days" values={reflection.days.map((x) => x.sleep)} max={10} color="var(--color-r6)" labels={labels} />
      </ChartCard>,
      <ChartCard key="move" title="Movement, 30 days">
        <AreaLine label={`Active minutes a day over thirty days, ${minutes} in all`} values={reflection.days.map((x) => (x.move > 0 ? x.move : null))} max={Math.max(30, ...reflection.days.map((x) => x.move))} color="var(--color-r5)" labels={labels} />
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          {formatCount(minutes)} minutes on {formatCount(moved)} {moved === 1 ? 'day' : 'days'}. {formatCount(reflection.days.reduce((a, x) => a + x.mindful, 0))} mindful minutes.
        </p>
      </ChartCard>,
    );
    if (reflection.moveKinds.length > 0) {
      const top = Math.max(1, ...reflection.moveKinds.map((k) => k.minutes));
      cards.push(
        <ChartCard key="kinds" title="Kinds of movement">
          <HBars
            label={reflection.moveKinds.map((k) => `${k.kind}: ${k.minutes} minutes`).join(', ')}
            rows={reflection.moveKinds.map((k) => ({ key: k.kind, label: isMoveKind(k.kind) ? MOVE_KIND_META[k.kind].name : k.kind, value: k.minutes / top, text: `${formatCount(k.minutes)} min`, color: 'var(--color-r5)' }))}
          />
        </ChartCard>,
      );
    }
  }
  if (cards.length === 0) return <p className="m-0 text-subhead text-ink-soft">They do not share the parts these charts come from.</p>;
  // An odd number leaves one card a row of its own at the top, so that one is a line that reads well wide, never a small gauge.
  if (cards.length % 2 === 1) {
    const keys = cards.map((c) => c.key);
    const wide = ['feel', 'sleep', 'xp'].map((k) => keys.indexOf(k)).find((at) => at >= 0) ?? -1;
    if (wide > 0) cards.unshift(...cards.splice(wide, 1));
  }
  return (
    <div className={`grid gap-xs ${evenGrid(cards.length, CHART_COLS)}`}>
      {cards.map((c, i) => (
        <div key={c.key} className={`flex min-w-0 ${evenTile(i, cards.length, CHART_COLS)}`}>
          <div className="flex w-full min-w-0 [&>*]:w-full">{c}</div>
        </div>
      ))}
    </div>
  );
}

const PACE_TONE: Record<Exclude<PaceStatus, 'none'>, TagTone> = { on: 'good', slipping: 'warn', behind: 'bad' };
const LAYER_WORD: Partial<Record<NodeKind, string>> = { pillar: 'foundation', principle: 'guiding principle', value_goal: 'value goal', outcome: 'goal outcome' };
const WORDS_LAYERS: NodeKind[] = ['pillar', 'principle', 'value_goal', 'outcome'];

/** One pillar's layers: what is made, each project's pace, and its tasks with a way to change the open ones. */
function PillarFold({ row, nodes, onAdd, onEdit }: { row: CoachPillarRow; nodes: Node[]; onAdd: (projectId: string) => void; onEdit: (task: Node) => void }) {
  const rel = RELATIONSHIP_BY_KEY[row.key];
  const mine = nodes.filter((n) => n.relationship === row.key);
  const active = row.projects.filter((p) => p.status === 'active');
  const behind = active.filter((p) => p.pace.status === 'behind').length;
  const layerCount = (k: NodeKind) => row.layers.find((l) => l.kind === k);
  const projects = layerCount('project');
  const tasks = layerCount('task');
  const facts = [
    ...WORDS_LAYERS.flatMap((k) => {
      const n = layerCount(k)?.total ?? 0;
      return n ? [`${n} ${LAYER_WORD[k]}${n === 1 ? '' : 's'}`] : [];
    }),
    ...(projects?.total ? [`${projects.done} of ${projects.total} projects cleared`] : []),
    ...(tasks?.total ? [`${tasks.done} of ${tasks.total} tasks done`] : []),
  ];
  return (
    <Fold title={rel.name} hint={`${formatCount(row.xp)} xp${behind ? `, ${behind} behind` : ''}`}>
      <div data-pillar={row.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
        <ul className="fill-row m-0 flex list-none flex-wrap gap-xs p-0">
          {facts.map((f) => (
            <li key={f}>
              <StatusTag tone="calm">{f}</StatusTag>
            </li>
          ))}
        </ul>
        <dl className="mt-sm m-0 grid gap-xs text-subhead">
          {WORDS_LAYERS.flatMap((k) =>
            mine
              .filter((n) => n.kind === k)
              .map((n) => (
                <div key={n.id}>
                  <dt className="text-eyebrow uppercase text-ink-soft">{KIND_META[k].label}</dt>
                  <dd className="m-0 font-semibold">{n.title}</dd>
                </div>
              )),
          )}
        </dl>
        {row.projects.map((p) => {
          const list = mine.filter((t) => t.kind === 'task' && t.parentId === p.id).sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
          return (
            <div key={p.id} className="mt-md">
              <div className="flex flex-wrap-reverse items-start justify-between gap-xs">
                <p className="m-0 min-w-[60%] flex-1 text-subhead font-semibold">
                  {KIND_META.project.label}: {p.title}
                  {p.status === 'done' ? ' (done)' : ''}
                </p>
                {p.status === 'active' && (
                  <Button size="sm" variant="ghost" plusToX onClick={() => onAdd(p.id)}>
                    Add a task here
                  </Button>
                )}
              </div>
              {p.status === 'active' &&
                (p.pace.status === 'none' ? (
                  <span className="mt-xs block text-caption text-ink-mute">{p.pace.line}</span>
                ) : (
                  <span className="mt-xs flex flex-wrap items-center gap-xs">
                    <StatusTag tone={PACE_TONE[p.pace.status]}>{p.pace.label}</StatusTag>
                    <span className="text-caption text-ink-soft">{p.pace.line}</span>
                  </span>
                ))}
              {list.length > 0 && (
                <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                  {list.map((t) => (
                    <TaskLine key={t.id} t={t} onEdit={() => onEdit(t)} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Fold>
  );
}

/** Pillars and pace: xp in each pillar, then each pyramid in its own fold, so seven of them never fill the page. */
export function ReportPillars({ rows, nodes, onAdd, onEdit }: { rows: CoachPillarRow[]; nodes: Node[]; onAdd: (projectId: string) => void; onEdit: (task: Node) => void }) {
  const top = Math.max(1, ...rows.map((r) => r.xp));
  const here = rows.filter((r) => nodes.some((n) => n.relationship === r.key));
  return (
    <>
      <HBars label="Xp in each pillar" rows={RELATIONSHIPS.map((r) => ({ key: r.key, label: r.name, value: (rows.find((x) => x.key === r.key)?.xp ?? 0) / top, text: `${formatCount(rows.find((x) => x.key === r.key)?.xp ?? 0)} xp`, color: r.color }))} />
      {here.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No pyramid yet. It fills in once they build one.</p>}
      <div className="mt-sm flex flex-col gap-xs">
        {here.map((r) => (
          <PillarFold key={r.key} row={r} nodes={nodes} onAdd={onAdd} onEdit={onEdit} />
        ))}
      </div>
    </>
  );
}
