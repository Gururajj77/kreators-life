import { CONTENT_DAY_SEEDS, PLAN_DEFAULT_MINUTES, RELATIONSHIP_BY_KEY, dayBlocks, minuteOf, slotIndexOfTask, slotLength, slotOrder, spanLabel, type DayPlan, type FocusRoundRow, type Node, type TimeBlock } from '@kreators/shared';
import { tbClass, tbStyle } from '../lib/blockColor';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { todayLocal, clockAt, slotRange } from '../lib/date';
import { useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';
import { SELECT_SM } from '../lib/ui';
import { Fold } from './Fold';
import { Inert } from './Inert';
import { StatusTag } from './StatusTag';
import { STICKY_CLOSE_LANE, StickyClose, useTallOpen } from './StickyClose';
import { ToggleChevron } from './ToggleMark';
import { minuteNowOn, useDailyAnswer } from './useDailyAnswer';
import { useNow } from '../lib/useNow';
import type { DayPlacement } from './PlaceMyDay';

// Place my day and a content day's steps load only once Your day is opened, so Daily's first download never carries the placement rule
// (`@kreators/shared/blockHints`) or the step words (`@kreators/shared/contentDays`); each module is fetched once and kept.
type PlaceMod = typeof import('./PlaceMyDay');
type StepsMod = typeof import('./BlockSteps');
const PLACE: { m: PlaceMod | null } = { m: null };
const STEPS: { m: StepsMod | null } = { m: null };
function useModule<M>(on: boolean, cell: { m: M | null }, load: () => Promise<M>): M | null {
  const [m, setM] = useState<M | null>(cell.m);
  useEffect(() => {
    if (!on || m) return;
    let live = true;
    load()
      .then((x) => {
        cell.m = x;
        if (live) setM(x);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [on, m, cell, load]);
  return m ?? cell.m;
}
const loadPlace = () => import('./PlaceMyDay');
const loadSteps = () => import('./BlockSteps');
const CONTENT_SEEDS: ReadonlySet<string> = new Set(CONTENT_DAY_SEEDS);

const COPY = {
  title: 'Your day',
  lede: 'The blocks of your day, with the tasks that fall in each.',
  other: 'At other times',
  elsewhere: 'In blocks not in today’s plan',
  overlaps: 'Overlaps',
  edit: 'Edit in Time blocks',
  placed: 'Placed',
} as const;

/** A task in a band: by its time or block, or (`placed`) only by Place my day's plan, not saved yet. */
type Placed = { t: Node; start: number | null; overlaps: boolean; placed?: boolean };
type BlockChoice = { id: string; label: string };

/**
 * A task with no time and no block, with a picker of the day's blocks beside it. Picking one saves it at once through the task's ordinary
 * edit (`PATCH /nodes/:id {timeBlockId}`), and the task then shows in that block's band.
 */
function LooseTask({ t, choices, note }: { t: Node; choices: readonly BlockChoice[]; /** Where Place my day puts it, or why it has no room. */ note?: ReactNode }) {
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
        <div className="min-w-0 flex-1 basis-[60%]">
          <p className="m-0 text-subhead">
            <Inert text={t.title} />
          </p>
          {note}
        </div>
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

/**
 * "3 tasks have no time or block yet": a toggle that lists them right here, each with its block picker. Open and taller than the room the
 * window has (a long list on a phone), its close stays in view beside the list (`StickyClose`, 2026-11-14): the chevron keeps its slot
 * unseen, the list keeps a lane while the close runs down its own edge, so it never sits on a picker, and inside Your day's fold (whose
 * own close may show too) it sits one step lower, so the two never meet.
 */
function LooseTasks({ tasks, total, choices, noteOf }: { tasks: readonly Node[]; total: number; choices: readonly BlockChoice[]; noteOf?: (t: Node) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const railOn = useTallOpen(root, open);
  const n = Math.max(total, tasks.length);
  return (
    <div ref={root} data-sticky-close-root="" className="mt-xs @container">
      <button ref={toggle} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex min-h-[44px] items-center gap-xs rounded-tile text-left text-caption text-ink-soft hover:text-ink">
        <span>{n === 1 ? '1 task has no time or block yet.' : `${n} tasks have no time or block yet.`}</span>
        <ToggleChevron open={open} size={14} className={railOn ? 'invisible' : ''} />
      </button>
      {railOn && <StickyClose onClose={() => setOpen(false)} label="Close the tasks with no time or block" opener={() => toggle.current} />}
      {open && (
        <ul id={id} className={`mt-xs m-0 flex flex-col gap-sm p-0 ${STICKY_CLOSE_LANE}`}>
          {tasks.map((t) => (
            <LooseTask key={t.id} t={t} choices={choices} note={noteOf?.(t)} />
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
  // Opened, Your day brings Place my day's plan (the same answer and rule as By time block) and, on a content day, each block's steps.
  const [open, setOpen] = useState(false);
  const answer = useDailyAnswer(today);
  const after = minuteNowOn(today, useNow(60_000));
  const seed = day?.template.seed ?? null;
  const contentDay = Boolean(seed && CONTENT_SEEDS.has(seed));
  const place = useModule(open && ((looseAll?.length ?? 0) > 0 || (answer?.looseTasks?.length ?? 0) > 0), PLACE, loadPlace);
  const steps = useModule(open && contentDay, STEPS, loadSteps);
  const plan: DayPlacement | null = useMemo(() => (place && answer && answer.date === today ? place.dayPlacement(answer, after) : null), [place, answer, after, today]);
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
  // Place my day's plan, not saved yet: each placed task in the band its start falls in, marked Placed, after the band's own tasks.
  const looseById = new Map((looseAll ?? loose).map((t) => [t.id, t]));
  for (const pl of plan?.placed ?? []) {
    const t = looseById.get(pl.taskId);
    const i = t ? slotIndexOfTask({ timeBlockId: null, dueTime: pl.start }, slots) : null;
    if (t && i !== null && i >= 0) inSlot[i]!.push({ t, start: minuteOf(pl.start), overlaps: false, placed: true });
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
    if (b) choices.push({ id: b.id, label: `${b.name}, ${slotRange(s)}` });
  }

  const line = (p: Placed) => {
    const f = focused.get(p.t.id) ?? 0;
    const rel = RELATIONSHIP_BY_KEY[p.t.relationship].color;
    return (
      <li key={p.t.id} className="list-none">
        <div className="flex items-start justify-between gap-sm">
          <p className="m-0 min-w-0 text-subhead">
            {p.start !== null && <span className="whitespace-nowrap text-ink-soft">{clockAt(p.start)} </span>}
            <Inert text={p.t.title} />
          </p>
          {p.overlaps && <StatusTag tone="warn">{COPY.overlaps}</StatusTag>}
          {p.placed && <StatusTag tone="calm">{COPY.placed}</StatusTag>}
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
    <Fold id="your-day" className="mt-xs" title={COPY.title} hint={day.template.name} open={open} onOpenChange={setOpen}>
      <div role="group" aria-label={`${COPY.title}: ${day.template.name}`}>
        {/* The line on the left and its edit link at the bottom right (as Daily's DayTypeNote): the link keeps its own look (the founder,
            2026-11-06: only its place changes), and its 44px tap area is its ::after. */}
        <div className="mt-xs flex flex-wrap items-end justify-between gap-x-sm">
          <p className="m-0 min-w-0 flex-[1_1_240px] text-caption text-ink-soft">{COPY.lede}</p>
          <Link to="/time-blocks" className="relative ml-auto whitespace-nowrap text-caption font-semibold underline underline-offset-4 after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']">
            {COPY.edit}
          </Link>
        </div>
        {place && plan && <place.PlaceMyDay date={today} plan={plan} />}
        <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {slots.map((s, i) => {
            const b = blockById.get(s.blockId);
            const here = inSlot[i]!.sort((x, y) => Number(Boolean(x.placed)) - Number(Boolean(y.placed)) || byTime(x, y));
            // A block with two slots (Edit 9 to 1 and 2 to 4) shows its steps once, in its first band.
            const firstOfBlock = slots.findIndex((x) => x.blockId === s.blockId) === i;
            const len = slotLength(s);
            // The room left comes from every open task of the day (the server's sum), not only the tasks this list was given.
            const planned = (day.slotPlannedMin?.length === slots.length ? day.slotPlannedMin[i] : undefined) ?? here.filter((p) => !p.placed).reduce((n, p) => n + est(p.t), 0);
            // What the plan put here counts against the room left, so the band never says free for what it shows placed.
            const placedMin = here.filter((p) => p.placed).reduce((n, p) => n + est(p.t), 0);
            const over = planned > len;
            return (
              <li key={`${s.blockId}-${s.start}`} className="flex items-stretch gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className={`tb-band ${tbClass(b?.color, 'tb-slate')}`} style={tbStyle(b?.color)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <p className="m-0 text-eyebrow uppercase text-ink-soft">
                        {slotRange(s)}, {spanLabel(len)}
                      </p>
                      <p className="m-0 text-headline">{b?.name ?? 'A block'}</p>
                    </div>
                    {over ? (
                      <StatusTag tone="warn">Over by {spanLabel(planned - len)}</StatusTag>
                    ) : (
                      <span className="shrink-0 text-caption text-ink-soft">{`${spanLabel(Math.max(0, len - planned - placedMin))} free`}</span>
                    )}
                  </div>
                  {here.length > 0 && <ul className="mt-xs m-0 flex flex-col gap-xs p-0">{here.map(line)}</ul>}
                  {steps && b && firstOfBlock && <steps.BlockSteps date={today} templateSeed={seed} block={b} />}
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
        {looseList.length > 0 && <LooseTasks tasks={looseList} total={looseAll ? (looseTotal ?? looseList.length) : looseList.length} choices={choices} noteOf={place && plan ? (t) => <place.PlacedNote t={t} plan={plan} blocks={day.blocks} /> : undefined} />}
      </div>
    </Fold>
  );
}
