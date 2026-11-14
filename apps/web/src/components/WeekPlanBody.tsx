import { FOCUS_TAG, RELATIONSHIP_BY_KEY, minutesLabel2, type FocusTask, type TimeBlock, type Node, type PlanAttention, type PlanStrength, type RelationshipKey, type WeekPlan as WeekPlanData, type WeekPlanSuggestion } from '@kreators/shared';
import { tbClass, tbStyle } from '../lib/blockColor';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type TaskPlanBody } from '../lib/api';
import { prettyDate, todayLocal, weekday, dayLabel } from '../lib/date';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { tie } from '../lib/text';
import { FIELD } from '../lib/ui';
import { Button } from './Button';
import { Fold } from './Fold';
import { Inert } from './Inert';
import { Ring } from './Ring';
import { StatusTag } from './StatusTag';
import { STICKY_CLOSE_LANE, StickyClose, useTallOpen } from './StickyClose';
import { TaskPlanFields, planBody, planOf, planProblem, type Plan } from './TaskPlan';
import { COPY } from './WeekPlan';
import { ToggleChevron } from './ToggleMark';

// The body of the Plan my week sheet: the strength, the suggestions, the fixes and Keep. It downloads when the sheet opens
// (WeekPlan.tsx), so Daily's first download carries only the button.

const dayOption = dayLabel;
const tone = (s: PlanStrength) => (s.label === 'Strong' ? 'good' : s.label === 'Fair' ? 'warn' : 'neutral');

/** One reading of how strong a plan is: a ring with the score, the label, and the three parts as small bars. */
function Strength({ title, s }: { title: string; s: PlanStrength }) {
  return (
    <div className="min-w-0 flex-1 rounded-tile bg-paper p-sm">
      <p className="m-0 text-eyebrow uppercase text-ink-soft">{title}</p>
      <div className="mt-xs flex items-center gap-sm">
        <Ring value={s.score / 100} size={56} stroke={7} color="var(--color-r4)" label={`${title}: plan strength ${s.score} out of 100`}>
          <span className="text-headline">{s.score}</span>
        </Ring>
        <StatusTag tone={tone(s)}>{s.label}</StatusTag>
      </div>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {s.parts.map((p) => (
          <li key={p.name}>
            <span className="block text-caption text-ink-soft">{tie(p.name)}</span>
            <span className="mt-xs block h-[6px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
              <span className="block h-full rounded-pill bg-r4" style={{ width: `${Math.round((p.score / p.max) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ESTIMATES = [15, 25, 45, 60, 90] as const;
type Change = { doDate?: string; estimateMin?: number; timeBlockId?: string | null };
interface Own {
  id: string;
  title: string;
  relationship: RelationshipKey;
  plan: Plan;
}
const chip = (on: boolean) => `toy min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-sm text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`;
const selectBase = 'block min-h-[44px] rounded-pill border-2 border-line bg-card-strong px-sm text-subhead font-medium text-ink';

/** The block a "worth a look" line about an empty block names: matched by the name it starts with, else the first Focus-tagged block. */
function blockOfLine(a: PlanAttention, blocks: readonly TimeBlock[]): TimeBlock | null {
  const named = [...blocks].sort((x, y) => y.name.length - x.name.length).find((b) => a.text.startsWith(`${b.name} is empty`));
  return named ?? blocks.find((b) => b.tag.trim().toLowerCase() === FOCUS_TAG.toLowerCase()) ?? null;
}

/** A suggestion's time block under its title: a dot in the block's colour and its name (the select beside the day picker changes it). */
function BlockMark({ id, blocks }: { id: string | null; blocks: readonly TimeBlock[] }) {
  const b = id ? blocks.find((x) => x.id === id) : undefined;
  if (!b) return null;
  return (
    <p className="mt-xs m-0 flex items-center gap-xs text-caption font-medium">
      <span className={`tb-dot ${tbClass(b.color)} shrink-0`} style={tbStyle(b.color)} aria-hidden="true" />
      <span className="min-w-0">{b.name}</span>
    </p>
  );
}

/** The form for a task you pick yourself: its day, how long it takes, a time, a priority and the rest, from the same form a task uses on Daily. */
function OwnForm({ node, day, today, onAdd }: { node: Node; day: string; today: string; onAdd: (o: Own) => void }) {
  const [p, setP] = useState<Plan>(() => planOf(node, day));
  const problem = planProblem(p);
  return (
    <div className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft">
      <TaskPlanFields plan={p} onChange={setP} today={today} pillar={node.relationship} taskId={node.id} />
      {problem && (
        <p role="alert" className="m-0 text-subhead">
          {problem}
        </p>
      )}
      <Button disabled={problem !== null} onClick={() => onAdd({ id: node.id, title: node.title, relationship: node.relationship, plan: p })}>
        {COPY.addOwnButton}
      </Button>
    </div>
  );
}

/** "Add your own": find a task you already have by name, then set its day, its length and the other options. It joins the plan; nothing is saved until Keep. */
function AddOwn({ day, today, taken, onAdd }: { day: string; today: string; taken: Set<string>; onAdd: (o: Own) => void }) {
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<FocusTask | null>(null);
  // Search after a short pause in typing, so each letter is not a request.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(typed.trim()), 250);
    return () => window.clearTimeout(t);
  }, [typed]);
  const tasks = useAuthed(['today', 'plan-tasks', q], () => api.focusTasks(q), !chosen);
  const node = useAuthed(['nodes', 'one', chosen?.id ?? ''], () => api.node(chosen!.id), Boolean(chosen));
  const choices = (tasks.data?.tasks ?? []).filter((t) => !taken.has(t.id)).slice(0, 8);
  if (chosen)
    return (
      <div>
        <p className="m-0 flex items-center justify-between gap-sm text-headline">
          <span className="min-w-0">
            <Inert text={chosen.title} />
          </span>
          <Button variant="outline" size="sm" onClick={() => setChosen(null)}>
            {COPY.change}
          </Button>
        </p>
        {node.isPending && (
          <p role="status" className="mt-xs m-0 text-caption text-ink-soft">
            {COPY.loadingTask}
          </p>
        )}
        {node.data && (
          <OwnForm
            key={chosen.id}
            node={node.data.node}
            day={day}
            today={today}
            onAdd={(o) => {
              onAdd(o);
              setChosen(null);
              setTyped('');
            }}
          />
        )}
      </div>
    );
  return (
    <div>
      <label className="block text-subhead font-semibold" htmlFor="own-find">
        {COPY.pick}
      </label>
      <input id="own-find" type="search" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={COPY.pickPlaceholder} autoComplete="off" className={FIELD} />
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0" aria-label="Your open tasks">
        {tasks.isPending && (
          <li role="status" className="text-caption text-ink-soft">
            {COPY.loadingTasks}
          </li>
        )}
        {!tasks.isPending && choices.length === 0 && <li className="text-caption text-ink-soft">{COPY.noTasks}</li>}
        {choices.map((t) => (
          <li key={t.id} data-pillar={t.relationship}>
            <button type="button" onClick={() => setChosen(t)} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile bg-paper px-sm text-left text-subhead">
              <span className="flex min-w-0 items-center gap-xs">
                <span className="inline-block size-[10px] shrink-0 rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[t.relationship].color }} aria-hidden="true" />
                <span className="min-w-0">
                  <Inert text={t.title} />
                </span>
              </span>
              {t.dueDate && <span className="shrink-0 text-caption text-ink-soft">{dayOption(t.dueDate)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What each line under "Worth a look" lets you fix right here. Nothing is saved until Keep. */
function Fix({ a, plan, blocks, edits, stage, onFill }: { a: PlanAttention; plan: WeekPlanData; blocks: readonly TimeBlock[]; edits: Record<string, Change>; stage: (id: string, c: Change) => void; onFill: (day: string) => void }) {
  // A Focus block with nothing in it: give one of the open tasks with no block a day it is empty on, and that block with it.
  if (a.kind === 'blockEmpty') {
    const b = blockOfLine(a, blocks);
    if (!b || a.tasks.length === 0) return <p className="m-0 text-subhead text-ink-soft">No open task without a block to put here.</p>;
    return (
      <ul className="m-0 flex list-none flex-col gap-sm p-0">
        {a.tasks.slice(0, 5).map((t) => {
          const staged = edits[t.id]?.timeBlockId === b.id ? (edits[t.id]?.doDate ?? '') : '';
          return (
            <li key={t.id} className="flex items-center gap-sm">
              <p className="m-0 min-w-0 flex-1 text-subhead">
                <Inert text={t.title} />
                {t.estimateMin ? <span className="text-ink-soft"> {minutesLabel2(t.estimateMin)}</span> : null}
              </p>
              <select value={staged} onChange={(e) => e.target.value && stage(t.id, { doDate: e.target.value, timeBlockId: b.id })} aria-label={`Put ${t.title} in ${b.name} on`} className={`${selectBase} w-[148px] shrink-0`}>
                <option value="">{COPY.chooseDay}</option>
                {a.days.map((d) => (
                  <option key={d} value={d}>
                    {dayOption(d)}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    );
  }
  if (a.kind === 'empty')
    return (
      <div className="flex flex-wrap gap-xs">
        {a.days.slice(0, 5).map((d) => (
          <button key={d} type="button" onClick={() => onFill(d)} className={chip(false)}>
            {COPY.addOn} {dayOption(d)}
          </button>
        ))}
      </div>
    );
  if (a.kind === 'unsized')
    return (
      <ul className="m-0 flex list-none flex-col gap-sm p-0">
        {a.tasks.map((t) => (
          <li key={t.id}>
            <p className="m-0 text-subhead font-semibold">
              <Inert text={t.title} />
            </p>
            <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label={`How long ${t.title} takes`}>
              {ESTIMATES.map((m) => (
                <button key={m} type="button" aria-pressed={edits[t.id]?.estimateMin === m} onClick={() => stage(t.id, { estimateMin: m })} className={chip(edits[t.id]?.estimateMin === m)}>
                  {minutesLabel2(m)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    );
  // A heavy day, a late task, or one that did not fit: choose a day to move it to.
  return (
    <ul className="m-0 flex list-none flex-col gap-sm p-0">
      {a.tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-sm">
          <p className="m-0 min-w-0 flex-1 text-subhead">
            <Inert text={t.title} />
            {t.estimateMin ? <span className="text-ink-soft"> {minutesLabel2(t.estimateMin)}</span> : null}
          </p>
          <select value={edits[t.id]?.doDate ?? t.day ?? ''} onChange={(e) => stage(t.id, { doDate: e.target.value })} aria-label={`Day for ${t.title}`} className={`${selectBase} w-[148px] shrink-0`}>
            {!t.day && <option value="">{COPY.chooseDay}</option>}
            {plan.days.map((d) => (
              <option key={d.date} value={d.date}>
                {dayOption(d.date)}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}

/**
 * A "worth a look" line whose Fix opens what it is about in place. Open and taller than the sheet's panel, its close stays in view beside
 * the fix as the panel scrolls (`StickyClose`, 2026-11-14, the founder: "the close buttons that need one to scroll back top need the close
 * button to be sticky"): the line (its Fix at the right) and the fix each keep the lane the close runs down, and the chevron keeps its slot
 * unseen. The fix's own card sits inside the lane, so the close never lands on it.
 */
function LookLine({ open, onClose, label, toggleId, head, children }: { open: boolean; onClose: () => void; label: string; toggleId: string; head: (railOn: boolean) => ReactNode; children: ReactNode }) {
  const root = useRef<HTMLLIElement>(null);
  const railOn = useTallOpen(root, open);
  return (
    <li ref={root} data-sticky-close-root="" className="rounded-tile bg-paper p-sm">
      {head(railOn)}
      {railOn && <StickyClose onClose={onClose} label={label} opener={() => document.getElementById(toggleId)} />}
      {open && <div className={`mt-sm ${STICKY_CLOSE_LANE}`}>{children}</div>}
    </li>
  );
}

/** The sheet's body. It is made again whenever a new plan arrives, so the ticks and days start from what the plan suggested. */
export function PlanBody({ plan, blocks = [], onDone }: { plan: WeekPlanData; /** The person's time blocks, for the block each suggestion goes in. */ blocks?: readonly TimeBlock[]; onDone: (kept: number, failed: number) => void }) {
  // Keep can give a task a day, a repeat or a habit pick, which decide what an Emerging card offers, so it is read again at once.
  const refresh = useRefreshAll({ insights: true });
  const today = todayLocal();
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(plan.suggestions.map((s) => [s.id, true])));
  const [day, setDay] = useState<Record<string, string>>(() => Object.fromEntries(plan.suggestions.map((s) => [s.id, s.day])));
  // The block each suggestion goes in: the one the plan suggested (its own, or one from its area and pillar), changed here if you like.
  const [blockOf, setBlockOf] = useState<Record<string, string | null>>(() => Object.fromEntries(plan.suggestions.map((s) => [s.id, s.blockId ?? null])));
  const [edits, setEdits] = useState<Record<string, Change>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [own, setOwn] = useState<Own[]>([]);
  const [ownOpen, setOwnOpen] = useState(false);
  const [ownDay, setOwnDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const kept = plan.suggestions.filter((s) => on[s.id]);
  const stage = (id: string, c: Change) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...c } }));
  // The lightest day, where a task you add yourself starts when you have not picked one.
  const lightest = [...plan.days].sort((a, b) => a.plannedMin - b.plannedMin || a.date.localeCompare(b.date))[0]?.date ?? today;

  // Everything to save, one entry for each task, so a task in two places is saved once: the suggestions, then the fixes, then what you added.
  const changes = new Map<string, TaskPlanBody>();
  for (const s of kept) {
    const b = blockOf[s.id] ?? null;
    // The block goes with the day when there is one, or when the suggested one was taken off on purpose. A block the task's time falls in
    // is not pinned while it is left as it was, so a later change to the time still moves the task to the right block.
    const byTime = s.blockHow === 'time' && b === s.blockId;
    changes.set(s.id, !byTime && (b !== null || b !== (s.blockId ?? null)) ? { doDate: day[s.id]!, timeBlockId: b } : { doDate: day[s.id]! });
  }
  for (const [id, c] of Object.entries(edits)) changes.set(id, { ...changes.get(id), ...c });
  for (const o of own) changes.set(o.id, planBody(o.plan));

  // The strip follows the ticks, the days and what you add, so a change is seen at once.
  const added = new Map<string, number>();
  for (const s of kept) added.set(day[s.id]!, (added.get(day[s.id]!) ?? 0) + s.estimateMin);
  for (const o of own) if (o.plan.doDate) added.set(o.plan.doDate, (added.get(o.plan.doDate) ?? 0) + (Number(o.plan.minutes) || 30));
  const peak = Math.max(plan.capacityMin, ...plan.days.map((d) => d.plannedMin + (added.get(d.date) ?? 0)));

  const keep = async () => {
    if (changes.size === 0) {
      setError(COPY.noneKept);
      return;
    }
    setBusy(true);
    setError('');
    let ok = 0;
    // One at a time through the ordinary edit, so every rule on a task still applies.
    for (const [id, body] of changes) {
      try {
        await api.updateNode(id, body);
        ok += 1;
      } catch {
        // counted below
      }
    }
    refresh();
    setBusy(false);
    onDone(ok, changes.size - ok);
  };
  const handled = (a: PlanAttention, i: number) => Boolean(checked[i]) || (a.tasks.length > 0 && a.tasks.every((t) => edits[t.id]));

  return (
    <div className="flex flex-col gap-md">
      <section aria-labelledby="plan-strength-heading">
        <h3 id="plan-strength-heading" className="text-headline">
          {COPY.strength}
        </h3>
        <p className="mt-xs m-0 text-caption text-ink-soft">{COPY.strengthLede}</p>
        <div className="mt-sm flex flex-col gap-xs md:flex-row">
          <Strength title={COPY.now} s={plan.strengthNow} />
          <Strength title={COPY.with} s={plan.strengthWith} />
        </div>
      </section>

      <section aria-labelledby="plan-week-heading">
        <h3 id="plan-week-heading" className="text-headline">
          {COPY.week}
        </h3>
        <ul className="mt-xs grid list-none grid-cols-7 gap-xs p-0 m-0">
          {plan.days.map((d) => {
            const extra = added.get(d.date) ?? 0;
            const total = d.plannedMin + extra;
            const over = total > plan.capacityMin;
            return (
              <li key={d.date} className="min-w-0 text-center" aria-label={`${prettyDate(d.date)}${d.templateName ? `, ${d.templateName}` : ''}: ${minutesLabel2(d.plannedMin)} planned, ${minutesLabel2(extra)} suggested`}>
                <div className="mx-auto flex h-[72px] w-full max-w-[40px] flex-col justify-end overflow-hidden rounded-tile bg-line" aria-hidden="true">
                  <div className="w-full bg-r4" style={{ height: `${Math.round((extra / peak) * 100)}%` }} />
                  <div className="w-full bg-r5" style={{ height: `${Math.round((d.plannedMin / peak) * 100)}%` }} />
                </div>
                <p className="mt-xs m-0 text-caption font-semibold">{weekday(d.date)}</p>
                <p className="m-0 text-caption text-ink-soft">{total > 0 ? minutesLabel2(total) : '0'}</p>
                {over && <StatusTag tone="bad">{COPY.over}</StatusTag>}
              </li>
            );
          })}
        </ul>
        <p className="mt-xs m-0 text-caption text-ink-soft">Blue is already planned. Green is what you would add.</p>
      </section>

      <section aria-labelledby="plan-suggest-heading">
        <h3 id="plan-suggest-heading" className="text-headline">
          {COPY.suggestions}
        </h3>
        {plan.suggestions.length === 0 ? (
          <p className="mt-xs m-0 text-subhead text-ink-soft">{COPY.allPlaced}</p>
        ) : (
          // A narrow list (a phone, under 32rem) stacks each row: the box on top, the words under it, then the two pickers side by side;
          // from 32rem the row is one line as before (the founder, 2026-11-08). The box is 24px and its label's ::before the 44px target.
          <ul className="@container mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {plan.suggestions.map((s: WeekPlanSuggestion) => (
              <li key={s.id} data-pillar={s.relationship} className="flex flex-col items-start gap-sm rounded-tile bg-card p-sm shadow-toy-soft @lg:flex-row @lg:items-center">
                <label className="relative flex size-[24px] shrink-0 before:absolute before:-inset-[10px] before:content-['']">
                  <input type="checkbox" checked={on[s.id] ?? false} onChange={(e) => setOn((o) => ({ ...o, [s.id]: e.target.checked }))} aria-label={`Keep ${s.title}`} className="m-0 size-[24px] shrink-0" />
                </label>
                <div className="flex w-full min-w-0 items-start gap-xs @lg:w-auto @lg:flex-1">
                  {/* The pillar's dot hangs beside the words in a row; stacked, it starts the title's line, so every line starts under the box. */}
                  <span className="hidden h-[22px] shrink-0 items-center @lg:flex">
                    <span className="inline-block size-[10px] rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[s.relationship].color }} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-row-title">
                      <span className="mr-xs inline-block size-[10px] rounded-pill align-middle @lg:hidden" style={{ background: RELATIONSHIP_BY_KEY[s.relationship].color }} aria-hidden="true" />
                      <Inert text={s.title} />
                    </p>
                    <p className="m-0 text-card-note text-ink-soft">
                      {minutesLabel2(s.estimateMin)}, {s.reason.toLowerCase()}
                    </p>
                    <BlockMark id={blockOf[s.id] ?? null} blocks={blocks} />
                  </div>
                </div>
                {/* The day and the time block, each a fixed width: side by side under the words on a phone, one over the other at the
                    row's right end from 32rem, so the title keeps the rest of the line. */}
                <div className="flex flex-wrap gap-xs @lg:w-[148px] @lg:shrink-0 @lg:flex-col">
                  <select value={day[s.id]} onChange={(e) => setDay((d) => ({ ...d, [s.id]: e.target.value }))} aria-label={`Day for ${s.title}`} className={`${selectBase} w-[148px] @lg:w-full`}>
                    {plan.days.map((d) => (
                      <option key={d.date} value={d.date}>
                        {dayOption(d.date)}
                      </option>
                    ))}
                  </select>
                  {blocks.length > 0 && (
                    <select value={blockOf[s.id] ?? ''} onChange={(e) => setBlockOf((o) => ({ ...o, [s.id]: e.target.value || null }))} aria-label={`Time block for ${s.title}`} className={`${selectBase} w-[148px] @lg:w-full`}>
                      <option value="">No block</option>
                      {blocks.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {plan.attention.length > 0 && (
        <section aria-labelledby="plan-look-heading">
          <h3 id="plan-look-heading" className="text-headline">
            {COPY.look}
          </h3>
          <p className="mt-xs m-0 text-caption text-ink-soft">{COPY.lookLede}</p>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {plan.attention.map((a, i) => {
              const fixable = a.tasks.length > 0 || a.kind === 'empty';
              const done = handled(a, i);
              return (
                <LookLine
                  key={`${a.kind}${i}`}
                  open={openLine === i}
                  onClose={() => setOpenLine(null)}
                  label={`Close the fix: ${a.text.split('. ')[0]?.replace(/\.$/, '') ?? a.text}`}
                  toggleId={`plan-fix-toggle-${i}`}
                  head={(railOn) => (
                    <div className={`flex items-center gap-sm ${STICKY_CLOSE_LANE}`}>
                      <label className="relative flex size-[24px] shrink-0 before:absolute before:-inset-[10px] before:content-['']">
                        <input type="checkbox" checked={done} onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} aria-label={`${COPY.handled}: ${a.text}`} className="m-0 size-[24px] shrink-0" />
                      </label>
                      <p className={`m-0 min-w-0 flex-1 text-subhead ${done ? 'text-ink-soft line-through' : ''}`}>{tie(a.text)}</p>
                      {fixable && (
                        <button type="button" id={`plan-fix-toggle-${i}`} aria-expanded={openLine === i} aria-controls={`plan-fix-${i}`} onClick={() => setOpenLine(openLine === i ? null : i)} className="toy toy-flat inline-flex min-h-[36px] md:min-h-[44px] tap-pad shrink-0 items-center gap-xs rounded-pill border border-line bg-card-strong px-sm text-subhead font-medium">
                          {openLine === i ? COPY.hide : COPY.fix}
                          <ToggleChevron open={openLine === i} size={14} className={railOn ? 'invisible' : ''} />
                        </button>
                      )}
                    </div>
                  )}
                >
                  <div id={`plan-fix-${i}`} className="rounded-tile bg-card p-sm">
                    <Fix
                      a={a}
                      plan={plan}
                      blocks={blocks}
                      edits={edits}
                      stage={stage}
                      onFill={(d) => {
                        setOwnDay(d);
                        setOwnOpen(true);
                      }}
                    />
                  </div>
                </LookLine>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="plan-own-heading">
        <h3 id="plan-own-heading" className="text-headline">
          {COPY.own}
        </h3>
        <p className="mt-xs m-0 text-caption text-ink-soft">{COPY.ownLede}</p>
        {own.length > 0 && (
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {own.map((o) => (
              <li key={o.id} data-pillar={o.relationship} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex items-center gap-xs text-card-title">
                    <span className="inline-block size-[10px] shrink-0 rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[o.relationship].color }} aria-hidden="true" />
                    <span className="min-w-0">
                      <Inert text={o.title} />
                    </span>
                  </p>
                  <p className="m-0 text-card-note text-ink-soft">
                    {[o.plan.doDate ? dayOption(o.plan.doDate) : 'No day', Number(o.plan.minutes) > 0 ? minutesLabel2(Number(o.plan.minutes)) : '', o.plan.time ? o.plan.time : '', o.plan.priority !== null ? `P${o.plan.priority}` : ''].filter(Boolean).join(', ')}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setOwn((l) => l.filter((x) => x.id !== o.id))}>
                  {COPY.remove}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Fold className="mt-xs" title={COPY.ownFold} adds open={ownOpen} onOpenChange={setOwnOpen}>
          <AddOwn
            day={ownDay || lightest}
            today={today}
            taken={new Set([...own.map((o) => o.id)])}
            onAdd={(o) => {
              setOwn((l) => [...l.filter((x) => x.id !== o.id), o]);
              setOwnDay('');
              setOwnOpen(false);
            }}
          />
        </Fold>
      </section>

      {error && (
        <p role="alert" className="m-0 text-subhead">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-xs">
        {(plan.suggestions.length > 0 || changes.size > 0) && (
          <Button onClick={keep} disabled={busy} className="flex-1">
            {busy ? 'Keeping' : `${COPY.keep} (${changes.size})`}
          </Button>
        )}
        <Button variant="outline" onClick={() => onDone(0, 0)} disabled={busy}>
          {plan.suggestions.length > 0 || changes.size > 0 ? COPY.skip : 'Close'}
        </Button>
      </div>
    </div>
  );
}

