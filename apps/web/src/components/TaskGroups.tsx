import { CONTENT_DAY_SEEDS, DONE_PAGE_SIZE, DONE_PAGE_SIZES, LIFE_AREAS, OPEN_KINDS, PLAN_DEFAULT_MINUTES, RELATIONSHIP_BY_KEY, TASK_GROUP_NONE, groupTasks, openDay, spanLabel, type BlockColor, type Node, type OpenKind, type RelationshipKey, type TemplateSlot, type TimeBlock } from '@kreators/shared';
import { blockMismatch, blockMismatchLine, blockUsedMin, groupWithSuggestions, suggestLine, suggestWhy, type BlockMismatch, type SuggestedGroup } from '@kreators/shared/blockHints';
import { OPEN_KIND_META } from '@kreators/shared/openBusiness';
import { useMutation } from '@tanstack/react-query';
import { tbClass, tbStyle } from '../lib/blockColor';
import gsap from 'gsap';
import { Suspense, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { slotRange } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { useNow } from '../lib/useNow';
import { useKept } from '../lib/kept';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Fold } from './Fold';
import { AppIcon } from './AppIcon';
import { Button } from './Button';
import { tick } from './fx/haptics';
import { Pager, usePage } from './Pager';
import { SkeletonList } from './Skeleton';
import { StatusTag } from './StatusTag';
import { ToggleChevron } from './ToggleMark';
import { dayPlacement, placedRange, type DayPlacement } from './PlaceMyDay';
import { minuteNowOn, useDailyAnswer } from './useDailyAnswer';

// A content day's steps (their words are their own chunk), fetched only on a day whose template carries them.
const BlockSteps = lazyNamed(() => import('./BlockSteps'), 'BlockSteps');
const CONTENT_SEEDS: ReadonlySet<string> = new Set(CONTENT_DAY_SEEDS);

/** What the grouping reads: the day's slots and blocks, its lead and second pillar, and the server's minutes planned in each slot. */
export interface GroupContext {
  slots: readonly TemplateSlot[];
  blocks: readonly TimeBlock[];
  lead?: RelationshipKey;
  second?: RelationshipKey | null;
  slotPlannedMin?: readonly number[];
  /** The day shown (YYYY-MM-DD): on today, a block that is over is never suggested or pointed at. */
  day: string;
}

/** How Daily's boxes are drawn: by time block, by area of life, or by kind of open business. */
export type GroupBy = 'block' | 'area' | 'open';
/** A box: a block, an area or a kind of open business (which says its one question in `note`). `placed` are the tasks Place my day's
 *  plan puts in this block, not saved yet (each also in `tasks`, after the block's own). */
type Group = SuggestedGroup<Node> & { note?: string; placed?: Node[] };

/**
 * Each kind of open business wears one colour of the time-block wheel (2026-11-07), told apart from each other and from the priority
 * colours on the same rows (P0 red, P1 orange, P2 purple, P3 grey). The box's words stay ink on a 12% wash, so AA never rests on them.
 */
const OPEN_SWATCH: Record<OpenKind, BlockColor> = { unfinished: 'yellow', unresolved: 'blue', undecided: 'green' };

/** The kinds' boxes, in their one order, each only while it holds a task; inside each the order the tasks came in. */
function openGroups(tasks: Node[]): Group[] {
  return OPEN_KINDS.flatMap((k) => {
    const here = tasks.filter((t) => t.openKind === k);
    if (here.length === 0) return [];
    return [{ key: `open-${k}`, kind: 'block' as const, name: OPEN_KIND_META[k].name, color: OPEN_SWATCH[k], area: null, ranges: [], inDay: false, minutes: 0, plannedMin: 0, tasks: here, suggested: [], placed: [], note: OPEN_KIND_META[k].question }];
  });
}

/**
 * Daily's grouped view (docs/time-blocks.md): the tasks in coloured boxes, one per time block of the day (in clock order) or one per area
 * of life (in LIFE_AREA_ORDER), drawn like the app groups on Profile: a box in its own soft colour whose header is one button that opens
 * and folds it. Inside each box the tasks keep the order `groupTasks` gave them, so the priority comes first. Which boxes are open is kept
 * for the tab and the person (lib/kept.ts); every box starts open. Lazy (its own chunk with @kreators/shared/blockHints), so the first
 * download stays inside its budget.
 *
 * Unfinished business (2026-11-07, the founder's ask) is a third grouping: only the tasks marked with a kind, one box per kind in
 * `OPEN_KINDS` order, each with its one question and its own colour from the time-block wheel (`OPEN_SWATCH`), a kind with none left out.
 *
 * By time block, a task with no block and no time sits in the block `suggestBlock` picks for it, after the placed ones, marked Suggested
 * with one Keep here; a task whose time put it in a block meant for another area or pillar gets one quiet line with Move it and Keep here
 * (`blockMismatch`). Nothing is written until one of those is tapped, through the ordinary PATCH /nodes/:id.
 *
 * Place my day (2026-11-12): a task the day's plan places (`dayPlacement`, the same answer and rule as Your day) sits in its block after the
 * block's own tasks, marked Placed with its time, in place of the old Suggested hint; one line above the boxes points to Your day's one
 * Place my day button. What the plan leaves out keeps the Suggested, Keep here and Move it hints. A content day's block also shows its steps.
 */
export function TaskGroups({ tasks, context, renderTask, more = false, by }: { tasks: Node[]; context: GroupContext; renderTask: (t: Node, below?: ReactNode) => ReactNode; /** More tasks wait past the ones sent (`tasksMore`). */ more?: boolean; by: GroupBy }) {
  const me = useMe();
  const { pathname, search } = useLocation();
  const after = minuteNowOn(context.day, useNow(60_000));
  const answer = useDailyAnswer(context.day);
  const plan: DayPlacement | null = useMemo(() => (by === 'block' && answer && answer.date === context.day ? dayPlacement(answer, after) : null), [by, answer, after, context.day]);
  const seed = answer?.day.template.seed ?? null;
  const contentDay = by === 'block' && Boolean(seed && CONTENT_SEEDS.has(seed));
  const base = by === 'block' ? blockUsedMin(context.slots, context.slotPlannedMin) : undefined;
  // What the plan placed counts as used, so a suggestion or a Move it never lands where the plan already put a task.
  const used = useMemo(() => {
    if (!base || !plan?.placed.length) return base;
    const out: Record<string, number> = Object.assign(Object.create(null) as Record<string, number>, base);
    const estOf = new Map((answer?.looseTasks ?? []).map((t) => [t.id, t.estimateMin ?? PLAN_DEFAULT_MINUTES]));
    for (const p of plan.placed) out[p.blockId] = (out[p.blockId] ?? 0) + (estOf.get(p.taskId) ?? PLAN_DEFAULT_MINUTES);
    return out;
  }, [base, plan, answer]);
  const groups: Group[] = by === 'block' ? withPlan(tasks, plan, groupWithSuggestions(tasks.filter((t) => !plan?.byId.has(t.id)), { ...context, used, after })) : by === 'open' ? openGroups(tasks) : groupTasks(tasks, 'area', context).map((g) => ({ ...g, suggested: [] }));
  // The day's other timed tasks, which a Move it never lands on (late ones from other days are not on this day's clock), and the plan's.
  const timed = [...tasks.filter((x) => x.dueTime && openDay(x) === context.day), ...(plan?.placed ?? []).map((p) => ({ id: p.taskId, dueTime: p.start, estimateMin: answer?.looseTasks?.find((t) => t.id === p.taskId)?.estimateMin ?? null }))];
  const placedHere = groups.reduce((n, g) => n + (g.placed?.length ?? 0), 0);
  // The line under a task: the plan's Placed and time, a suggestion's Keep here, the quiet mismatch prompt for one its time put in a
  // block meant for others, or (in No block yet) why the plan found no room for it.
  const below = (g: Group, t: Node): ReactNode => {
    if (by !== 'block') return null;
    if (g.key === TASK_GROUP_NONE) {
      const miss = plan?.missById.get(t.id);
      return miss ? <NoRoomLine line={miss.line} /> : null;
    }
    if (g.kind !== 'block' || !g.inDay) return null;
    const block = context.blocks.find((b) => b.id === g.key);
    if (!block) return null;
    const p = plan?.byId.get(t.id);
    if (p && g.placed?.includes(t)) return <PlacedLine range={placedRange(p)} />;
    if (g.suggested.includes(t)) return <SuggestLine task={t} block={block} />;
    const m = blockMismatch(t, context.slots, context.blocks, { used, after, taken: timed.filter((x) => x.id !== t.id) });
    return m ? <MismatchLine task={t} m={m} /> : null;
  };
  const steps = (g: Group): ReactNode => {
    if (!contentDay || g.kind !== 'block' || !g.inDay) return null;
    const block = context.blocks.find((b) => b.id === g.key);
    return block ? (
      <Suspense fallback={null}>
        <BlockSteps date={context.day} templateSeed={seed} block={block} />
      </Suspense>
    ) : null;
  };
  const [shut, setShut] = useKept<Record<string, boolean>>(`taskgroups:${me.data?.user.id ?? 'anon'}`, by, {});
  const openAll = () => setShut({});
  const foldAll = () => setShut(Object.fromEntries(groups.map((g) => [g.key, true])));
  const anyOpen = groups.some((g) => !shut[g.key]);
  const anyShut = groups.some((g) => shut[g.key]);
  if (groups.length === 0) return null;
  return (
    <div className="mt-sm">
      <div className="flex flex-wrap-reverse items-center justify-between gap-sm">
        <p className="m-0 min-w-0 text-subhead text-ink-soft">{groups.length === 1 ? '1 group' : `${groups.length} groups`}</p>
        <div className="flex shrink-0 gap-xs">
          <Button variant="outline" size="sm" disabled={!anyShut} onClick={openAll}>
            Open all
          </Button>
          <Button variant="outline" size="sm" disabled={!anyOpen} onClick={foldAll}>
            Fold all
          </Button>
        </div>
      </div>
      {placedHere > 0 && (
        <p className="mt-xs m-0 text-caption text-ink-soft">
          {placedHere === 1 ? '1 task is placed for you, not saved yet. ' : `${placedHere} tasks are placed for you, not saved yet. `}
          <Link to={{ pathname, search, hash: '#your-day' }} className="relative whitespace-nowrap font-semibold text-ink underline underline-offset-4 after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']">
            Place my day
          </Link>
        </p>
      )}
      <div className="mt-xs flex flex-col gap-xs">
        {groups.map((g) => (
          <Box key={g.key} g={g} open={!shut[g.key]} onToggle={() => setShut((s) => ({ ...s, [g.key]: !s[g.key] }))} renderTask={(t) => renderTask(t, below(g, t))} by={by} extra={steps(g)} />
        ))}
      </div>
      {more && <p className="mt-xs m-0 text-caption text-ink-soft">Showing the first 60.</p>}
    </div>
  );
}

/** "3 tasks · 1 h 30 of 3 h": the placed tasks, and for a block of the day the minutes placed in it against its length; a box that holds
 *  only suggestions says "2 suggested" (each suggested row carries its own mark, so the pill stays short on a phone). */
function countLine(g: Group): string {
  const planned = g.placed?.length ?? 0;
  const placed = g.tasks.length - g.suggested.length - planned;
  const n = placed === 0 && planned > 0 ? `${planned} placed` : placed === 0 && g.suggested.length > 0 ? `${g.suggested.length} suggested` : placed === 1 ? '1 task' : `${placed} tasks`;
  if (g.kind !== 'block' || !g.inDay || g.minutes === 0 || placed === 0) return n;
  return `${n} · ${spanLabel(g.plannedMin)} of ${spanLabel(g.minutes)}`;
}

function Box({ g, open, onToggle, renderTask, by, extra }: { g: Group; open: boolean; onToggle: () => void; renderTask: (t: Node) => ReactNode; by: GroupBy; /** Under the tasks: a content day's steps for this block. */ extra?: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const id = useId();
  const area = g.area ? LIFE_AREAS[g.area] : null;
  // An area box wears its area's pillar colour, like the app groups; a block box its own swatch (the "Time blocks" block in app.css).
  const areaBox = g.kind === 'area' && area;
  const over = g.kind === 'block' && g.inDay && g.minutes > 0 && g.plannedMin > g.minutes;

  // A box that starts open shows open at once; only a tap slides it. The effect alone owns `hidden` (never the JSX), so a fold plays its
  // close before the body is hidden; a layout effect, so a box that starts closed is hidden before the first paint.
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      el.hidden = !open;
      if (open) gsap.set(el, { height: 'auto', opacity: 1 });
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tween: gsap.core.Tween | null = null;
    if (open) {
      el.hidden = false;
      if (reduce) gsap.set(el, { height: 'auto', opacity: 1 });
      else tween = gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.32, ease: 'power3.out' });
    } else if (!el.hidden) {
      if (reduce) {
        gsap.set(el, { height: 0, opacity: 0 });
        el.hidden = true;
      } else tween = gsap.to(el, { height: 0, opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: () => void (el.hidden = true) });
    }
    return () => {
      tween?.kill();
      if (!open) el.hidden = true;
    };
  }, [open]);

  const note = g.note ? g.note : g.kind === 'block' ? [g.ranges.map((r) => slotRange(r)).join(', '), g.inDay ? '' : 'Not in today’s plan'].filter(Boolean).join('. ') : area ? area.blurb : by === 'block' ? 'Tasks with no block yet.' : 'Tasks with no area of life yet.';
  return (
    <section
      aria-labelledby={`${id}-h`}
      data-group-key={g.key}
      data-pillar={areaBox ? area.relationship : undefined}
      className={`rounded-card ${g.kind === 'block' && g.color ? `tb-box ${tbClass(g.color)}` : g.kind === 'none' ? 'bg-card' : ''}`}
      style={areaBox ? { background: `var(--soft-${area.relationship})` } : g.kind === 'block' ? tbStyle(g.color) : undefined}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-b`}
        onClick={() => {
          tick();
          onToggle();
        }}
        className="toy toy-flat flex min-h-[72px] w-full items-center gap-sm rounded-card p-sm text-left"
      >
        {areaBox ? (
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card-strong" style={{ color: `var(--deep-${area.relationship})` }} aria-hidden="true">
            <AppIcon name={area.icon} size={22} />
          </span>
        ) : (
          <span className="flex size-[44px] shrink-0 items-center justify-center" aria-hidden="true">
            <span className={g.color ? `tb-dot ${tbClass(g.color)}` : 'tb-dot'} style={tbStyle(g.color)} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span id={`${id}-h`} className="block text-title3">
            {g.name}
          </span>
          <span className="block text-footnote text-ink-soft">{note}</span>
        </span>
        <span className={`shrink-0 rounded-pill bg-card-strong px-sm text-caption font-medium leading-[26px] ${over ? 'text-ink' : 'text-ink-soft'}`}>{over ? `${countLine(g)}, over` : countLine(g)}</span>
        <ToggleChevron open={open} size={20} className="text-ink-soft" />
      </button>
      {/* The gap under the header sits on an inner wrapper, never on the element GSAP takes to height 0, so the header's hover tint
          never meets the first row (the same fix as AppGroups). */}
      <div ref={body} id={`${id}-b`} className="overflow-hidden">
        <div className="pt-xs">
          {g.tasks.length === 0 ? (
            <p className={`m-0 px-md text-subhead text-ink-soft ${extra ? '' : 'pb-md'}`}>Nothing here yet.</p>
          ) : (
            <ul className={`m-0 flex list-none flex-col gap-xs px-sm ${extra ? '' : 'pb-sm'}`}>{g.tasks.map((t) => renderTask(t))}</ul>
          )}
          {extra ? <div className="px-sm pb-sm">{extra}</div> : null}
        </div>
      </div>
    </section>
  );
}

/**
 * One PATCH /nodes/:id from a hint, then the day is read again. The hint line goes away with the save (and Move it takes the row to
 * another box), so focus moves to the task's own Plan button where it now sits, else to its box's header, never back to the page top.
 */
function useHintSave(task: Node) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (body: { timeBlockId?: string; dueTime?: string; to: string }) => api.updateNode(task.id, { timeBlockId: body.timeBlockId, dueTime: body.dueTime }),
    onSuccess: (_d, body) =>
      refresh().then(() =>
        requestAnimationFrame(() => {
          const row = document.querySelector<HTMLElement>(`li[data-task-id="${CSS.escape(task.id)}"]`);
          const plan = row?.querySelector<HTMLElement>('button[aria-label^="Plan "], button[aria-label^="Close the plan"]');
          const header = document.querySelector<HTMLElement>(`section[data-group-key="${CSS.escape(body.to)}"] > button`);
          const target = plan && plan.offsetParent !== null ? plan : header;
          target?.focus();
        }),
      ),
  });
}

/** The quiet line under a row: a line and the actions it belongs to, words at the left and the actions at the right (wrapping under the
 *  words, still at the right, when they do not fit beside them), so a list of suggestions stays a list of tasks. `more` is the why, shown
 *  from the tablet width up: on a phone a suggestion is one line, its mark and its Keep here. */
function HintLine({ words, more, mark, children, failed, data }: { words?: string; more?: string; mark?: ReactNode; children: ReactNode; failed: boolean; data: Record<string, string> }) {
  return (
    <div className="mt-xs px-sm" {...data}>
      <div className="flex flex-wrap items-center justify-between gap-xs">
        <p className="m-0 min-w-0 flex-[1_1_60%] text-caption text-ink-soft">
          {mark}
          {mark && (words || more) ? ' ' : null}
          {words}
          {more ? <span className="hidden sm:inline">{more}</span> : null}
        </p>
        <div className="ml-auto flex shrink-0 gap-xs">{children}</div>
      </div>
      {failed && (
        <p role="alert" className="mt-xs m-0 text-caption">
          That did not save. Try again.
        </p>
      )}
    </div>
  );
}

/** A task the day's plan places: Placed and its time, saved with the one Place my day in Your day (nothing to tap on the row). */
function PlacedLine({ range }: { range: string }) {
  return (
    <div className="mt-xs px-sm" data-block-placed="">
      <p className="m-0 flex flex-wrap items-center gap-xs text-caption text-ink-soft">
        <StatusTag tone="calm">Placed</StatusTag>
        <span className="whitespace-nowrap">{range}</span>
      </p>
    </div>
  );
}
/** A task the plan found no room for: No room today, and why. */
function NoRoomLine({ line }: { line: string }) {
  return (
    <div className="mt-xs px-sm" data-no-room="">
      <p className="m-0 flex flex-wrap items-center gap-xs text-caption text-ink-soft">
        <StatusTag tone="neutral">No room today</StatusTag>
        <span>{line}</span>
      </p>
    </div>
  );
}

/**
 * The plan's tasks into their blocks' boxes: each one this list holds goes into the box of the block the plan put it in, after the box's
 * own tasks and before its suggestions, in the order of its time. A task whose block has no box (never, since the plan only uses the day's
 * blocks) goes to No block yet, so no task is ever dropped.
 */
function withPlan(tasks: Node[], plan: DayPlacement | null, groups: SuggestedGroup<Node>[]): Group[] {
  if (!plan || plan.placed.length === 0) return groups;
  const out: Group[] = groups.map((g) => ({ ...g, placed: [] }));
  const mine = tasks.filter((t) => plan.byId.has(t.id)).sort((a, b) => plan.byId.get(a.id)!.start.localeCompare(plan.byId.get(b.id)!.start));
  const lost: Node[] = [];
  for (const t of mine) {
    const g = out.find((x) => x.kind === 'block' && x.inDay && x.key === plan.byId.get(t.id)!.blockId);
    if (g) g.placed!.push(t);
    else lost.push(t);
  }
  for (const g of out) {
    if (!g.placed?.length) continue;
    const own = g.tasks.filter((t) => !g.suggested.includes(t));
    g.tasks = [...own, ...g.placed, ...g.suggested];
  }
  if (lost.length) {
    const none = out.find((g) => g.key === TASK_GROUP_NONE);
    if (none) none.tasks = [...none.tasks, ...lost];
    else out.push({ key: TASK_GROUP_NONE, kind: 'none', name: 'No block yet', color: null, area: null, ranges: [], inDay: true, minutes: 0, plannedMin: 0, tasks: lost, suggested: [], placed: [] });
  }
  return out;
}

/** A task with no block and no time, shown in the block suggested for it: Suggested, why, and Keep here (its block from now on). */
function SuggestLine({ task, block }: { task: Node; block: TimeBlock }) {
  const save = useHintSave(task);
  return (
    <HintLine more={suggestLine(suggestWhy(task, block), block)} mark={<StatusTag tone="calm">Suggested</StatusTag>} failed={save.isError} data={{ 'data-block-suggested': block.id }}>
      <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate({ timeBlockId: block.id, to: block.id })} aria-label={`Keep here, in ${block.name}: ${task.title}`}>
        Keep here
      </Button>
    </HintLine>
  );
}

/** A task its time put in a block meant for another area or pillar: one quiet line, Move it (to the better block's time) or Keep here. */
function MismatchLine({ task, m }: { task: Node; m: BlockMismatch }) {
  const save = useHintSave(task);
  return (
    <HintLine words={blockMismatchLine(m, slotRange)} failed={save.isError} data={{ 'data-block-mismatch': m.better.id }}>
      <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate({ dueTime: m.start, to: m.better.id })} aria-label={`Move it to ${m.better.name}: ${task.title}`}>
        Move it
      </Button>
      <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate({ timeBlockId: m.block.id, to: m.block.id })} aria-label={`Keep here, in ${m.block.name}: ${task.title}`}>
        Keep here
      </Button>
    </HintLine>
  );
}

/**
 * Daily's Unfinished business view (2026-11-07): the tasks marked with a kind in their three boxes, one plain line when there are none, and
 * what was let go in a closed fold under them (read only once it opens, each with Bring back). Lazy with the other boxes.
 */
export function OpenBusinessView({ tasks, context, renderTask, more, areaName, letGoTotal }: { tasks: Node[]; context: GroupContext; renderTask: (t: Node, below?: ReactNode) => ReactNode; more: boolean; /** "for Physical" while the Area filter is on, else ''. */ areaName: string; letGoTotal: number }) {
  const [search] = useSearchParams();
  return (
    <>
      {tasks.length > 0 ? (
        <TaskGroups tasks={tasks} context={context} by="open" more={more} renderTask={renderTask} />
      ) : (
        <p className="mt-sm m-0 text-subhead text-ink-soft">{areaName ? `No unfinished business ${areaName}.` : 'No unfinished business. Mark a task Unfinished, Unresolved or Undecided in its plan.'}</p>
      )}
      {letGoTotal > 0 && (
        <Fold className="mt-xs" title="Let go" hint={String(letGoTotal)} defaultOpen={search.has('lgpage') || search.has('lgsize')}>
          <LetGoList />
        </Fold>
      )}
    </>
  );
}

/** The Let go list pages like Done today: 10, 25 or 50, ten by default (prefix `lg`). */
const LET_GO_PAGES = { sizes: DONE_PAGE_SIZES, fallback: DONE_PAGE_SIZE };

/**
 * What was let go (Close the unfinished, 2026-11-07), under the Unfinished business view's boxes: the archived tasks, newest first, read
 * only once its fold opens, each with Bring back (the ordinary PATCH /nodes/:id, status active), which puts it back where it was.
 */
export function LetGoList() {
  const pg = usePage('lg', LET_GO_PAGES);
  const q = useAuthed(['today', 'let-go', pg.query], () => api.letGo(pg.query));
  const refresh = useRefreshAll();
  const [said, setSaid] = useState<string | null>(null);
  const back = useMutation({
    mutationFn: (t: Node) => api.updateNode(t.id, { status: 'active' }),
    onSuccess: (_r, t) => {
      setSaid(`“${t.title}” is back.`);
      void q.refetch();
      void refresh();
    },
    onError: (x) => setSaid(x instanceof Error ? x.message : 'That did not work. Try again.'),
  });
  if (q.isPending) return <SkeletonList className="mt-xs" count={2} lines={1} label="Loading what you let go" />;
  if (q.isError || !q.data)
    return (
      <p role="alert" className="mt-xs m-0 text-subhead">
        Could not load this. Try again.
      </p>
    );
  return (
    <div className="mt-xs">
      {said && (
        <p role="status" className="m-0 mb-xs text-subhead text-ink-soft">
          {said}
        </p>
      )}
      {q.data.tasks.length === 0 ? (
        <p className="m-0 text-subhead text-ink-soft">Nothing let go.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {q.data.tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap-reverse items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="min-w-0 flex-1 basis-[60%]">
                <span className="block text-card-title">{t.title}</span>
                <span className="block text-card-note text-ink-soft">{RELATIONSHIP_BY_KEY[t.relationship].name}</span>
              </span>
              <Button variant="outline" size="sm" disabled={back.isPending} onClick={() => back.mutate(t)} aria-label={`Bring back: ${t.title}`}>
                Bring back
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Pager page={q.data.page} prefix="lg" label="what you let go" only={LET_GO_PAGES} />
    </div>
  );
}
