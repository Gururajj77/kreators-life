import { PLAN_DEFAULT_MINUTES, RELATIONSHIP_BY_KEY, dayBlocks, minuteOf, slotIndexOfTask, slotLength, slotOrder, slotRangeLabel, spanLabel, minuteLabel, type DayPlan, type FocusRoundRow, type Node, type TimeBlock } from '@kreators/shared';
import { tbClass, tbStyle } from '../lib/blockColor';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';
import { SELECT_SM } from '../lib/ui';
import { Fold } from './Fold';
import { Inert } from './Inert';
import { StatusTag } from './StatusTag';
import { ToggleChevron } from './ToggleMark';

const COPY = {
  title: 'Your day',
  lede: 'The blocks of your day, with the tasks that fall in each.',
  other: 'At other times',
  elsewhere: 'In blocks not in today’s plan',
  overlaps: 'Overlaps',
  edit: 'Edit in Time blocks',
} as const;

type Placed = { t: Node; start: number | null; overlaps: boolean };
type BlockChoice = { id: string; label: string };

/**
 * A task with no time and no block, with a picker of the day's blocks beside it. Picking one saves it at once through the task's ordinary
 * edit (`PATCH /nodes/:id {timeBlockId}`), and the task then shows in that block's band.
 */
function LooseTask({ t, choices }: { t: Node; choices: readonly BlockChoice[] }) {
  const refresh = useRefreshAll();
  const [failed, setFailed] = useState(false);
  const put = useMutation({
    mutationFn: (id: string) => api.updateNode(t.id, { timeBlockId: id }),
    onMutate: () => setFailed(false),
    onSuccess: () => refresh(),
    onError: () => setFailed(true),
  });
  return (
    <li className="list-none">
      <div className="flex flex-wrap-reverse items-center justify-between gap-x-sm gap-y-xs">
        <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead">
          <Inert text={t.title} />
        </p>
        <select
          aria-label={`Time block for ${t.title}`}
          value=""
          disabled={put.isPending}
          onChange={(e) => e.target.value && put.mutate(e.target.value)}
          className={`${SELECT_SM} w-full @min-[34rem]:w-auto @min-[34rem]:max-w-[calc(40%-12px)]`}
        >
          <option value="">{put.isPending ? 'Saving…' : 'Pick a block'}</option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {failed && (
        <p role="alert" className="mt-xs m-0 text-caption">
          That did not save. Try again.
        </p>
      )}
    </li>
  );
}

/** "3 tasks have no time or block yet": a toggle that lists them right here, each with its block picker. */
function LooseTasks({ tasks, total, choices }: { tasks: readonly Node[]; total: number; choices: readonly BlockChoice[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const n = Math.max(total, tasks.length);
  return (
    <div className="mt-xs @container">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex min-h-[44px] items-center gap-xs rounded-tile text-left text-caption text-ink-soft hover:text-ink">
        <span>{n === 1 ? '1 task has no time or block yet.' : `${n} tasks have no time or block yet.`}</span>
        <ToggleChevron open={open} size={14} />
      </button>
      {open && (
        <ul id={id} className="mt-xs m-0 flex flex-col gap-sm p-0">
          {tasks.map((t) => (
            <LooseTask key={t.id} t={t} choices={choices} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The day as its time blocks (docs/time-blocks.md): every slot of the day's template in clock order, as a band in the block's colour, with
 * the tasks that fall in it (the block picked for a task, else the one its time falls in), how much room is left in it or how far over it
 * runs, and a faint "Focused" bar for a task with focus sessions today. Timed tasks outside every slot are listed at their time; two
 * timed tasks that run into each other are flagged. A fold, closed to start with, so Daily stays short. A task's block and time are changed
 * in its own plan panel, the blocks on the Time blocks page; the tasks with neither are listed under their count line, each with a block picker.
 */
export function DayBlocks({
  tasks,
  day,
  sessions,
  loose: looseAll,
  looseTotal,
}: {
  tasks: readonly Node[];
  day: DayPlan | undefined;
  /** Today's finished focus sessions; read here when not given. */
  sessions?: readonly Pick<FocusRoundRow, 'nodeId' | 'minutes' | 'createdAt'>[];
  /** Every open task of the day with no block and no time (GET /today `looseTasks`), past the ones `tasks` holds; else they are found in `tasks`. */
  loose?: readonly Node[];
  looseTotal?: number;
}) {
  const token = useSession((st) => st.token);
  const today = todayLocal();
  // The same query the focus panel's Today list reads, so a session finished there shows here at once.
  const own = useQuery({ queryKey: ['focus-today', today], queryFn: () => api.focusToday(today), enabled: Boolean(token) && sessions === undefined && tasks.length > 0, staleTime: 30_000 });
  if (!day || day.slots.length === 0) return null;
  const slots = slotOrder(day.slots);
  const blockById = new Map<string, TimeBlock>(day.blocks.map((b) => [b.id, b]));
  const overlapping = new Set(dayBlocks(tasks).blocks.filter((b) => b.overlaps).map((b) => b.id));
  // Minutes already focused on each task today.
  const focused = new Map<string, number>();
  for (const r of sessions ?? own.data?.rounds ?? []) if (r.nodeId) focused.set(r.nodeId, (focused.get(r.nodeId) ?? 0) + r.minutes);

  const inSlot: Placed[][] = slots.map(() => []);
  const elsewhere: Placed[] = [];
  const other: Placed[] = [];
  const loose: Node[] = [];
  for (const t of tasks) {
    const start = minuteOf(t.dueTime);
    const p: Placed = { t, start, overlaps: overlapping.has(t.id) };
    const i = slotIndexOfTask(t, slots);
    if (i === null) {
      if (start !== null) other.push(p);
      else loose.push(t);
    } else if (i < 0) elsewhere.push(p);
    else inSlot[i]!.push(p);
  }
  // The server's list holds every such task of the day, not only the ones Daily shows; an older answer without it falls back to these.
  const looseList = looseAll ?? loose;
  const byTime = (a: Placed, b: Placed) => (a.start ?? 9999) - (b.start ?? 9999);
  const est = (t: Node) => t.estimateMin ?? PLAN_DEFAULT_MINUTES;
  // The blocks in today's plan, each once, in clock order with its first slot's times: what a task with no time or block can be put in.
  const choices: BlockChoice[] = [];
  for (const s of slots) {
    if (choices.some((c) => c.id === s.blockId)) continue;
    const b = blockById.get(s.blockId);
    if (b) choices.push({ id: b.id, label: `${b.name}, ${slotRangeLabel(s)}` });
  }

  const line = (p: Placed) => {
    const f = focused.get(p.t.id) ?? 0;
    const rel = RELATIONSHIP_BY_KEY[p.t.relationship].color;
    return (
      <li key={p.t.id} className="list-none">
        <div className="flex items-start justify-between gap-sm">
          <p className="m-0 min-w-0 text-subhead">
            {p.start !== null && <span className="whitespace-nowrap text-ink-soft">{minuteLabel(p.start)} </span>}
            <Inert text={p.t.title} />
          </p>
          {p.overlaps && <StatusTag tone="warn">{COPY.overlaps}</StatusTag>}
        </div>
        {f > 0 && (
          <div className="mt-xs flex items-center gap-xs" data-focused={f}>
            <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-pill bg-line" aria-hidden="true">
              <span className="block h-full rounded-pill opacity-50" style={{ width: `${Math.min(100, Math.round((f / Math.max(1, est(p.t))) * 100))}%`, background: rel }} />
            </span>
            <span className="shrink-0 text-caption text-ink-soft">Focused {spanLabel(f)}</span>
          </div>
        )}
      </li>
    );
  };

  return (
    <Fold className="mt-xs" title={COPY.title} hint={day.template.name}>
      <div role="group" aria-label={`${COPY.title}: ${day.template.name}`}>
        {/* The line on the left and its edit link at the bottom right (as Daily's DayTypeNote): the link keeps its own look (the founder,
            2026-11-06: only its place changes), and its 44px tap area is its ::after. */}
        <div className="mt-xs flex flex-wrap items-end justify-between gap-x-sm">
          <p className="m-0 min-w-0 flex-[1_1_240px] text-caption text-ink-soft">{COPY.lede}</p>
          <Link to="/time-blocks" className="relative ml-auto whitespace-nowrap text-caption font-semibold underline underline-offset-4 after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']">
            {COPY.edit}
          </Link>
        </div>
        <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {slots.map((s, i) => {
            const b = blockById.get(s.blockId);
            const here = inSlot[i]!.sort(byTime);
            const len = slotLength(s);
            // The room left comes from every open task of the day (the server's sum), not only the tasks this list was given.
            const planned = (day.slotPlannedMin?.length === slots.length ? day.slotPlannedMin[i] : undefined) ?? here.reduce((n, p) => n + est(p.t), 0);
            const over = planned > len;
            return (
              <li key={`${s.blockId}-${s.start}`} className="flex items-stretch gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className={`tb-band ${tbClass(b?.color, 'tb-slate')}`} style={tbStyle(b?.color)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <p className="m-0 text-eyebrow uppercase text-ink-soft">
                        {slotRangeLabel(s)}, {spanLabel(len)}
                      </p>
                      <p className="m-0 text-headline">{b?.name ?? 'A block'}</p>
                    </div>
                    {over ? (
                      <StatusTag tone="warn">Over by {spanLabel(planned - len)}</StatusTag>
                    ) : (
                      <span className="shrink-0 text-caption text-ink-soft">{planned === 0 ? `${spanLabel(len)} free` : `${spanLabel(len - planned)} free`}</span>
                    )}
                  </div>
                  {here.length > 0 && <ul className="mt-xs m-0 flex flex-col gap-xs p-0">{here.map(line)}</ul>}
                </div>
              </li>
            );
          })}
        </ol>
        {elsewhere.length > 0 && (
          <div className="mt-sm">
            <h4 className="m-0 text-subhead font-semibold">{COPY.elsewhere}</h4>
            <ul className="mt-xs m-0 flex flex-col gap-xs p-0">{elsewhere.sort(byTime).map(line)}</ul>
          </div>
        )}
        {other.length > 0 && (
          <div className="mt-sm">
            <h4 className="m-0 text-subhead font-semibold">{COPY.other}</h4>
            <ul className="mt-xs m-0 flex flex-col gap-xs p-0">{other.sort(byTime).map(line)}</ul>
          </div>
        )}
        {looseList.length > 0 && <LooseTasks tasks={looseList} total={looseAll ? (looseTotal ?? looseList.length) : looseList.length} choices={choices} />}
      </div>
    </Fold>
  );
}
