// Daily's quiet block hints (docs/time-blocks.md, "Tasks and blocks"): a task with no block and no time shown as a suggestion inside the
// block `suggestBlock` picks for it, and a task whose time put it in a block meant for another area or pillar. Rules only; nothing here
// writes. A subpath export (`@kreators/shared/blockHints`), not in the barrel: only lazy chunks read it (Daily's grouped view and the task
// form), so it never grows the shared chunk past the 400 kB a chunk may be. It imports the rest of shared; shared never imports it.
import { RELATIONSHIP_BY_KEY } from './core.ts';
import type { RelationshipKey } from './core.ts';
import { LIFE_AREAS } from './life.ts';
import type { LifeAreaKey } from './life.ts';
import { groupTasks, PLAN_DEFAULT_MINUTES } from './tasks.ts';
import type { Priority } from './tasks.ts';
import { blockDayMinutes, blockOfTask, minuteOf, hhmm, slotCrossesMidnight, slotLength, slotOrder, slotRangeLabel, suggestBlock, TASK_GROUP_NONE } from './timeBlocks.ts';
import type { GroupableTask, TaskGroup, TemplateSlot, TimeBlock } from './timeBlocks.ts';

/** Why a block was suggested: it shares the task's area, its pillar, or (a P0 or P1 with no match) it is a Focus block. */
export type SuggestWhy = 'area' | 'pillar' | 'focus';
/** A block group with the tasks only suggested into it (each also in `tasks`, after the placed ones). */
export interface SuggestedGroup<T> extends TaskGroup<T> {
  suggested: T[];
}

/** Whether a block is meant for this task: it shares the task's area of life, or its pillar. A block with neither is meant for nobody. */
export function blockFits(task: { lifeArea?: LifeAreaKey | null; relationship?: RelationshipKey }, block: Pick<TimeBlock, 'area' | 'pillar'>): boolean {
  return Boolean((block.area && task.lifeArea === block.area) || (block.pillar && task.relationship === block.pillar));
}
/** Why `suggestBlock` would pick this block for the task. */
export function suggestWhy(task: { lifeArea?: LifeAreaKey | null; relationship?: RelationshipKey }, block: Pick<TimeBlock, 'area' | 'pillar'>): SuggestWhy {
  if (block.area && task.lifeArea === block.area) return 'area';
  if (block.pillar && task.relationship === block.pillar) return 'pillar';
  return 'focus';
}
/** Who a block is for, in the person's words: its pillar's name ("Friends"), else its area ("the emotional area"); null for neither. */
export function blockIsFor(block: Pick<TimeBlock, 'area' | 'pillar'>): string | null {
  if (block.pillar) return RELATIONSHIP_BY_KEY[block.pillar].name;
  if (block.area) return `the ${LIFE_AREAS[block.area].name.toLowerCase()} area`;
  return null;
}

/** The minutes already planned in each block that day, from the server's per-slot sums (`DayPlan.slotPlannedMin`, in clock order). */
export function blockUsedMin(slots: readonly TemplateSlot[], slotPlannedMin?: readonly number[]): Record<string, number> | undefined {
  const ordered = slotOrder(slots);
  if (!slotPlannedMin || slotPlannedMin.length !== ordered.length) return undefined;
  const used: Record<string, number> = Object.create(null);
  ordered.forEach((s, i) => (used[s.blockId] = (used[s.blockId] ?? 0) + (slotPlannedMin[i] ?? 0)));
  return used;
}

const est = (t: { estimateMin?: number | null }): number => t.estimateMin ?? PLAN_DEFAULT_MINUTES;
/** Steps a Move it tries inside the better block, and what `after` is rounded up to. */
const MOVE_STEP = 15;
const fromOf = (after?: number | null): number | null => (after === undefined || after === null ? null : Math.ceil(after / MOVE_STEP) * MOVE_STEP);

/**
 * The part of a day's slots still to come once it is `after` (a minute of the device's day, for today only; null or undefined for any
 * other day): a slot that has ended is left out and one under way starts at `after`, rounded up to 15 minutes. A slot that runs past
 * midnight is kept whole. Used for room and targets only, never to say which block a time falls in.
 */
export function slotsLeft<S extends TemplateSlot>(slots: readonly S[], after?: number | null): S[] {
  const from = fromOf(after);
  if (from === null) return [...slots];
  const out: S[] = [];
  for (const s of slots) {
    if (slotCrossesMidnight(s)) out.push(s);
    else if ((s.end === 0 ? 1440 : s.end) > from) out.push(from > s.start ? { ...s, start: from } : s);
  }
  return out;
}

/** The context the hints read: the day's slots and blocks, each block's planned minutes, and the minute it is now (today only). */
export interface HintContext {
  slots: readonly TemplateSlot[];
  blocks: readonly TimeBlock[];
  lead?: RelationshipKey;
  second?: RelationshipKey | null;
  /** The minutes already planned in each block that day (`blockUsedMin`); without it, each block's placed tasks. */
  used?: Readonly<Record<string, number>>;
  /** For today: the minute of the day it is now, so a block that is over is never a target. */
  after?: number | null;
}

/** Whether a block has room that day for `need` more minutes, counting only the part still to come. */
const hasRoom = (blockId: string, live: readonly TemplateSlot[], used: Readonly<Record<string, number>> | undefined, need: number): boolean => (used?.[blockId] ?? 0) + need <= blockDayMinutes(blockId, live);

/**
 * Daily's By time block view with suggestions. `groupTasks(list, 'block', ctx)`, then every task in "No block yet" that has no picked
 * block and no time goes, as a suggestion, into the block `suggestBlock` picks for it that day, after that block's placed tasks, but only
 * when that block still has room for it and is not over (`after`): a suggestion into a full or finished block would only be noise. Each
 * suggestion counts toward the room left for the next one (in the list's order, so the priority claims room first). A task with no
 * suggestion stays in No block yet, which is left out once it is empty. `plannedMin` stays the placed tasks only, so a suggestion never
 * makes a block "over".
 */
export function groupWithSuggestions<T extends GroupableTask>(list: T[], ctx: HintContext): SuggestedGroup<T>[] {
  const groups: SuggestedGroup<T>[] = groupTasks(list, 'block', ctx).map((g) => ({ ...g, suggested: [] }));
  const none = groups.find((g) => g.key === TASK_GROUP_NONE);
  if (!none) return groups;
  const used: Record<string, number> = Object.create(null);
  if (ctx.used) Object.assign(used, ctx.used);
  else for (const g of groups) if (g.kind === 'block') used[g.key] = g.plannedMin;
  const live = slotsLeft(ctx.slots, ctx.after);
  const stay: T[] = [];
  for (const t of none.tasks) {
    const id = t.timeBlockId || minuteOf(t.dueTime) !== null ? null : suggestBlock({ lifeArea: t.lifeArea ?? null, relationship: t.relationship, priority: t.priority, estimateMin: t.estimateMin ?? null }, live, ctx.blocks, used);
    const g = id && hasRoom(id, live, used, est(t)) ? groups.find((x) => x.kind === 'block' && x.inDay && x.key === id) : undefined;
    if (!g) {
      stay.push(t);
      continue;
    }
    g.suggested.push(t);
    used[g.key] = (used[g.key] ?? 0) + est(t);
  }
  for (const g of groups) if (g.suggested.length) g.tasks = [...g.tasks, ...g.suggested];
  if (stay.length === none.tasks.length) return groups;
  none.tasks = stay;
  none.plannedMin = stay.reduce((n, t) => n + est(t), 0);
  return stay.length ? groups : groups.filter((g) => g !== none);
}

/** What Daily says about a task whose time put it in a block meant for another area or pillar. */
export interface BlockMismatch {
  /** The block its time falls in. */
  block: TimeBlock;
  /** The block `suggestBlock` picks for it that day, which shares its area or pillar. */
  better: TimeBlock;
  /** "HH:MM": the time Move it sets, inside `better`. */
  start: string;
  /** The slot of `better` that holds `start`. */
  slot: TemplateSlot;
}
/** A timed task already in the day: from its time, for its estimate (30 minutes when none). */
export interface TakenTime {
  dueTime: string | null;
  estimateMin?: number | null;
}
/** Whether [a, a + al) and [b, b + bl) share a minute, on the 24-hour clock. */
const overlaps = (a: number, al: number, b: number, bl: number): boolean => (b - a + 1440) % 1440 < al || (a - b + 1440) % 1440 < bl;

/**
 * The time Move it sets in a block: the first start in its slots that day, in steps of 15 minutes from the slot's start (from `after`
 * for today, so never a time already gone), where the task fits whole before the slot ends (`need` minutes; a task longer than the
 * slot takes it from its start) and overlaps no timed task already there (`taken`). Null when no start is free: the block is full.
 */
export function moveStartIn(blockId: string, slots: readonly TemplateSlot[], taken: readonly TakenTime[] = [], need: number = PLAN_DEFAULT_MINUTES, after?: number | null): { start: string; slot: TemplateSlot } | null {
  const from = fromOf(after);
  const spans = taken.map((t) => ({ at: minuteOf(t.dueTime), len: est(t) })).filter((x): x is { at: number; len: number } => x.at !== null);
  for (const s of slotOrder(slots).filter((x) => x.blockId === blockId)) {
    const len = slotLength(s);
    const span = Math.min(need, len);
    const first = from !== null && !slotCrossesMidnight(s) && from > s.start ? from - s.start : 0;
    for (let d = first; d + span <= len; d += MOVE_STEP) {
      const m = (s.start + d) % 1440;
      if (!spans.some((x) => overlaps(m, span, x.at, x.len))) return { start: hhmm(m), slot: s };
    }
  }
  return null;
}

/**
 * A quiet prompt, or null. Only for a task placed in a block by its TIME (never one the person picked), when that block has an area or a
 * pillar and the task shares neither, and `suggestBlock` picks a different block of the day that does share one (a Focus fallback is not
 * enough), that block still has room for it (`used`) and is not over (`after`), and a start in it is free of the day's other timed tasks
 * (`taken`, for Move it's time). Daily and the task form pass the same, so both name the same block and time.
 */
export function blockMismatch(
  task: { timeBlockId?: string | null; dueTime: string | null; lifeArea?: LifeAreaKey | null; relationship?: RelationshipKey; priority: Priority | null; estimateMin?: number | null },
  slots: readonly TemplateSlot[],
  blocks: readonly TimeBlock[],
  opts: { used?: Readonly<Record<string, number>>; taken?: readonly TakenTime[]; after?: number | null } = {},
): BlockMismatch | null {
  const hit = blockOfTask(task, slots);
  if (!hit || hit.how !== 'time') return null;
  const block = blocks.find((b) => b.id === hit.blockId);
  if (!block || (!block.area && !block.pillar) || blockFits(task, block)) return null;
  const live = slotsLeft(slots, opts.after);
  const need = est(task);
  const id = suggestBlock({ lifeArea: task.lifeArea ?? null, relationship: task.relationship, priority: task.priority, estimateMin: task.estimateMin ?? null }, live, blocks, opts.used);
  const better = id && id !== block.id ? blocks.find((b) => b.id === id) : undefined;
  if (!better || !blockFits(task, better) || !hasRoom(better.id, live, opts.used, need)) return null;
  const move = moveStartIn(better.id, slots, opts.taken, need, opts.after);
  return move ? { block, better, ...move } : null;
}

/** "Fun/social is for Friends. This fits Deep work, 10:00 am to 1:00 pm." */
export function blockMismatchLine(m: BlockMismatch, range: (s: TemplateSlot) => string = slotRangeLabel): string {
  return `${m.block.name} is for ${blockIsFor(m.block)}. This fits ${m.better.name}, ${range(m.slot)}.`;
}
/** The line beside a suggestion: "It fits here by its pillar, Friends." */
export function suggestLine(why: SuggestWhy, block: Pick<TimeBlock, 'area' | 'pillar'>): string {
  if (why === 'area' && block.area) return `It fits here by its area, ${LIFE_AREAS[block.area].name}.`;
  if (why === 'pillar' && block.pillar) return `It fits here by its pillar, ${RELATIONSHIP_BY_KEY[block.pillar].name}.`;
  return 'A top task with no match goes to a Focus block.';
}
