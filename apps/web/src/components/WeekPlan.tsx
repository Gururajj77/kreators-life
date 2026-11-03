import { PLAN_DAY_MINUTES, RELATIONSHIP_BY_KEY, minutesLabel2, type FocusTask, type Node, type PlanAttention, type PlanStrength, type RelationshipKey, type WeekPlan as WeekPlanData, type WeekPlanSuggestion, LOCALE } from '@kreators/shared';
import { useEffect, useState } from 'react';
import { api, type TaskPlanBody } from '../lib/api';
import { prettyDate, todayLocal, weekday } from '../lib/date';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { tie } from '../lib/text';
import { Button } from './Button';
import { Fold } from './Fold';
import { Inert } from './Inert';
import { Ring } from './Ring';
import { RulerPicker } from './RulerPicker';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { TaskPlanFields, planBody, planOf, planProblem, type Plan } from './TaskPlan';

/** The words on this sheet, in short plain sentences. */
const COPY = {
  button: 'Plan my week',
  title: 'Plan my week',
  lede: 'Seven days from today. Each task with no day gets a suggested one. Nothing changes until you keep them.',
  hours: 'Hours of planned work a day',
  strength: 'Plan strength',
  strengthLede: 'Days with something planned, days that are not overloaded, and tasks that say how long they take.',
  now: 'Now',
  with: 'With all of these',
  week: 'The week',
  suggestions: 'Suggested days',
  keep: 'Keep what fits',
  skip: 'Skip them all',
  look: 'Worth a look',
  lookLede: 'Tick one when you have dealt with it. Tap Fix to change the tasks here.',
  handled: 'Dealt with',
  fix: 'Fix',
  hide: 'Hide',
  chooseDay: 'Choose a day',
  addOn: 'Add a task on',
  own: 'Add your own',
  ownLede: 'Pick a task you already have, then give it a day, a length and the rest.',
  ownFold: 'Pick a task',
  pick: 'Find a task',
  pickPlaceholder: 'Type part of its name',
  change: 'Change',
  loadingTasks: 'Loading your tasks',
  noTasks: 'No other open tasks',
  loadingTask: 'Opening the task.',
  addOwnButton: 'Add to the plan',
  remove: 'Remove',
  empty: 'You have no open tasks to plan. Add a few, then come back.',
  allPlaced: 'Every open task already has a day.',
  over: 'Over',
  loading: 'Planning your week.',
  failed: 'The plan did not load. Try again in a moment.',
  noneKept: 'Nothing to keep yet. Tick a suggestion or make a change.',
} as const;

const HOURS_KEY = 'kreators.planHours';
const readHours = (): number => {
  try {
    const n = Number(localStorage.getItem(HOURS_KEY));
    return Number.isFinite(n) && n >= 1 && n <= 12 ? Math.round(n) : PLAN_DAY_MINUTES / 60;
  } catch {
    return PLAN_DAY_MINUTES / 60;
  }
};
const saveHours = (n: number) => {
  try {
    localStorage.setItem(HOURS_KEY, String(n));
  } catch {
    // not kept here, still used for this plan
  }
};

const dayOption = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const tone = (s: PlanStrength) => (s.label === 'Strong' ? 'good' : s.label === 'Fair' ? 'warn' : 'neutral');

/** One reading of how strong a plan is: a ring with the score, the label, and the three parts as small bars. */
function Strength({ title, s }: { title: string; s: PlanStrength }) {
  return (
    <div className="min-w-0 flex-1 rounded-tile bg-paper p-sm">
      <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{title}</p>
      <div className="mt-xs flex items-center gap-sm">
        <Ring value={s.score / 100} size={56} stroke={7} color="var(--color-r4)" label={`${title}: plan strength ${s.score} out of 100`}>
          <span className="font-display text-[16px] font-extrabold">{s.score}</span>
        </Ring>
        <StatusTag tone={tone(s)}>{s.label}</StatusTag>
      </div>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {s.parts.map((p) => (
          <li key={p.name}>
            <span className="block text-[12px] font-semibold text-ink-soft">{tie(p.name)}</span>
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
type Change = { doDate?: string; estimateMin?: number };
interface Own {
  id: string;
  title: string;
  relationship: RelationshipKey;
  plan: Plan;
}
const chip = (on: boolean) => `toy min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`;
const selectBase = 'block min-h-[44px] rounded-pill border-2 border-line bg-card-strong px-sm text-[14px] font-bold text-ink';
const selectClass = `${selectBase} w-full`;

/** The form for a task you pick yourself: its day, how long it takes, a time, a priority and the rest, from the same form a task uses on Daily. */
function OwnForm({ node, day, today, onAdd }: { node: Node; day: string; today: string; onAdd: (o: Own) => void }) {
  const [p, setP] = useState<Plan>(() => planOf(node, day));
  const problem = planProblem(p);
  return (
    <div className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft">
      <TaskPlanFields plan={p} onChange={setP} today={today} />
      {problem && (
        <p role="alert" className="m-0 text-[14px] font-bold">
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
        <p className="m-0 flex items-center justify-between gap-sm text-[16px] font-bold">
          <span className="min-w-0">
            <Inert text={chosen.title} />
          </span>
          <Button variant="outline" size="sm" onClick={() => setChosen(null)}>
            {COPY.change}
          </Button>
        </p>
        {node.isPending && (
          <p role="status" className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
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
      <label className="block text-[14px] font-bold" htmlFor="own-find">
        {COPY.pick}
      </label>
      <input id="own-find" type="search" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={COPY.pickPlaceholder} autoComplete="off" className={`mt-xs ${selectClass}`} />
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0" aria-label="Your open tasks">
        {tasks.isPending && (
          <li role="status" className="text-[12px] font-bold text-ink-soft">
            {COPY.loadingTasks}
          </li>
        )}
        {!tasks.isPending && choices.length === 0 && <li className="text-[12px] font-bold text-ink-soft">{COPY.noTasks}</li>}
        {choices.map((t) => (
          <li key={t.id} data-pillar={t.relationship}>
            <button type="button" onClick={() => setChosen(t)} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile bg-paper px-sm text-left text-[14px] font-bold">
              <span className="flex min-w-0 items-center gap-xs">
                <span className="inline-block size-[10px] shrink-0 rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[t.relationship].color }} aria-hidden="true" />
                <span className="min-w-0">
                  <Inert text={t.title} />
                </span>
              </span>
              {t.dueDate && <span className="shrink-0 text-[12px] font-semibold text-ink-soft">{dayOption(t.dueDate)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What each line under "Worth a look" lets you fix right here. Nothing is saved until Keep. */
function Fix({ a, plan, edits, stage, onFill }: { a: PlanAttention; plan: WeekPlanData; edits: Record<string, Change>; stage: (id: string, c: Change) => void; onFill: (day: string) => void }) {
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
            <p className="m-0 text-[14px] font-bold">
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
          <p className="m-0 min-w-0 flex-1 text-[14px] font-bold">
            <Inert text={t.title} />
            {t.estimateMin ? <span className="font-semibold text-ink-soft"> {minutesLabel2(t.estimateMin)}</span> : null}
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

/** The sheet's body. It is made again whenever a new plan arrives, so the ticks and days start from what the plan suggested. */
function PlanBody({ plan, onDone }: { plan: WeekPlanData; onDone: (kept: number, failed: number) => void }) {
  const refresh = useRefreshAll();
  const today = todayLocal();
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(plan.suggestions.map((s) => [s.id, true])));
  const [day, setDay] = useState<Record<string, string>>(() => Object.fromEntries(plan.suggestions.map((s) => [s.id, s.day])));
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
  for (const s of kept) changes.set(s.id, { doDate: day[s.id]! });
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
        <h3 id="plan-strength-heading" className="text-[18px]">
          {COPY.strength}
        </h3>
        <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{COPY.strengthLede}</p>
        <div className="mt-xs flex flex-col gap-xs md:flex-row">
          <Strength title={COPY.now} s={plan.strengthNow} />
          <Strength title={COPY.with} s={plan.strengthWith} />
        </div>
      </section>

      <section aria-labelledby="plan-week-heading">
        <h3 id="plan-week-heading" className="text-[18px]">
          {COPY.week}
        </h3>
        <ul className="mt-xs grid list-none grid-cols-7 gap-xs p-0 m-0">
          {plan.days.map((d) => {
            const extra = added.get(d.date) ?? 0;
            const total = d.plannedMin + extra;
            const over = total > plan.capacityMin;
            return (
              <li key={d.date} className="min-w-0 text-center" aria-label={`${prettyDate(d.date)}: ${minutesLabel2(d.plannedMin)} planned, ${minutesLabel2(extra)} suggested`}>
                <div className="mx-auto flex h-[72px] w-full max-w-[40px] flex-col justify-end overflow-hidden rounded-tile bg-line" aria-hidden="true">
                  <div className="w-full bg-r4" style={{ height: `${Math.round((extra / peak) * 100)}%` }} />
                  <div className="w-full bg-r5" style={{ height: `${Math.round((d.plannedMin / peak) * 100)}%` }} />
                </div>
                <p className="mt-xs m-0 text-[12px] font-extrabold">{weekday(d.date)}</p>
                <p className="m-0 text-[12px] font-semibold text-ink-soft">{total > 0 ? minutesLabel2(total) : '0'}</p>
                {over && <StatusTag tone="bad">{COPY.over}</StatusTag>}
              </li>
            );
          })}
        </ul>
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Blue is already planned. Green is what you would add.</p>
      </section>

      <section aria-labelledby="plan-suggest-heading">
        <h3 id="plan-suggest-heading" className="text-[18px]">
          {COPY.suggestions}
        </h3>
        {plan.suggestions.length === 0 ? (
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{COPY.allPlaced}</p>
        ) : (
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {plan.suggestions.map((s: WeekPlanSuggestion) => (
              <li key={s.id} data-pillar={s.relationship} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <input type="checkbox" checked={on[s.id] ?? false} onChange={(e) => setOn((o) => ({ ...o, [s.id]: e.target.checked }))} aria-label={`Keep ${s.title}`} className="size-[24px] shrink-0" />
                <div className="flex min-w-0 flex-1 items-start gap-xs">
                  <span className="flex h-[22px] shrink-0 items-center">
                    <span className="inline-block size-[10px] rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[s.relationship].color }} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-[16px] font-bold leading-snug">
                      <Inert text={s.title} />
                    </p>
                    <p className="m-0 text-[12px] font-semibold text-ink-soft">
                      {minutesLabel2(s.estimateMin)}, {s.reason.toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className="w-[148px] shrink-0">
                  <select value={day[s.id]} onChange={(e) => setDay((d) => ({ ...d, [s.id]: e.target.value }))} aria-label={`Day for ${s.title}`} className={selectClass}>
                    {plan.days.map((d) => (
                      <option key={d.date} value={d.date}>
                        {dayOption(d.date)}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {plan.attention.length > 0 && (
        <section aria-labelledby="plan-look-heading">
          <h3 id="plan-look-heading" className="text-[18px]">
            {COPY.look}
          </h3>
          <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{COPY.lookLede}</p>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {plan.attention.map((a, i) => {
              const fixable = a.tasks.length > 0 || a.kind === 'empty';
              const done = handled(a, i);
              return (
                <li key={`${a.kind}${i}`} className="rounded-tile bg-paper p-sm">
                  <div className="flex items-center gap-sm">
                    <input type="checkbox" checked={done} onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} aria-label={`${COPY.handled}: ${a.text}`} className="size-[24px] shrink-0" />
                    <p className={`m-0 min-w-0 flex-1 text-[14px] font-semibold ${done ? 'text-ink-soft line-through' : ''}`}>{tie(a.text)}</p>
                    {fixable && (
                      <button type="button" aria-expanded={openLine === i} onClick={() => setOpenLine(openLine === i ? null : i)} className="toy toy-flat min-h-[44px] shrink-0 rounded-pill border border-line bg-card-strong px-sm text-[14px] font-bold">
                        {openLine === i ? COPY.hide : COPY.fix}
                      </button>
                    )}
                  </div>
                  {openLine === i && (
                    <div className="mt-sm rounded-tile bg-card p-sm">
                      <Fix
                        a={a}
                        plan={plan}
                        edits={edits}
                        stage={stage}
                        onFill={(d) => {
                          setOwnDay(d);
                          setOwnOpen(true);
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="plan-own-heading">
        <h3 id="plan-own-heading" className="text-[18px]">
          {COPY.own}
        </h3>
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{COPY.ownLede}</p>
        {own.length > 0 && (
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {own.map((o) => (
              <li key={o.id} data-pillar={o.relationship} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex items-center gap-xs text-[16px] font-bold leading-snug">
                    <span className="inline-block size-[10px] shrink-0 rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[o.relationship].color }} aria-hidden="true" />
                    <span className="min-w-0">
                      <Inert text={o.title} />
                    </span>
                  </p>
                  <p className="m-0 text-[12px] font-semibold text-ink-soft">
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
        <p role="alert" className="m-0 text-[14px] font-bold">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-xs">
        {(plan.suggestions.length > 0 || changes.size > 0) && (
          <Button onClick={keep} disabled={busy}>
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

/** The "Plan my week" button for Daily, its sheet, and a short line after the plan is kept. */
export function WeekPlanButton() {
  const date = todayLocal();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(readHours);
  const [said, setSaid] = useState('');
  const q = useAuthed(['today', 'week-plan', date, hours], () => api.weekPlan(date, hours), open);
  const plan = q.data?.plan;
  const [draftHours, setDraftHours] = useState(hours);
  const setH = (n: number) => {
    const next = Math.max(1, Math.min(12, n));
    setHours(next);
    setDraftHours(next);
    saveHours(next);
  };
  const done = (kept: number, failed: number) => {
    setOpen(false);
    setSaid(kept === 0 && failed === 0 ? '' : failed > 0 ? `${kept} ${kept === 1 ? 'task now has' : 'tasks now have'} a day. ${failed} did not save.` : `${kept} ${kept === 1 ? 'task now has' : 'tasks now have'} a day.`);
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSaid('');
          setOpen(true);
        }}
      >
        {COPY.button}
      </Button>
      {said && (
        <p role="status" className="m-0 basis-full text-right text-[12px] font-bold text-ink-soft">
          {said}
        </p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={COPY.title}>
        <div className="pb-md">
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.lede}</p>
          <div className="mt-sm rounded-tile bg-paper p-sm">
            <div className="flex items-baseline justify-between gap-sm">
              <span className="text-[14px] font-bold">{COPY.hours}</span>
              <span className="font-display text-[20px] font-extrabold" aria-hidden="true">
                {draftHours} h
              </span>
            </div>
            {/* The plan is asked for again only once the ruler settles, not at every tick it passes. */}
            <RulerPicker label={COPY.hours} tone="paper" accent="r2" min={1} max={12} step={1} labelEvery={2} majorStep={2} value={draftHours} onChange={setDraftHours} onCommit={setH} valueText={(v) => `${v} ${v === 1 ? 'hour' : 'hours'} a day`} />
          </div>
          <div className="mt-md">
            {q.isPending && (
              <p role="status" className="m-0 text-[14px] font-bold text-ink-soft">
                {COPY.loading}
              </p>
            )}
            {q.isError && (
              <p role="alert" className="m-0 text-[14px] font-bold">
                {COPY.failed}
              </p>
            )}
            {plan && plan.suggestions.length === 0 && plan.days.every((d) => d.tasks === 0) && plan.noRoom.length === 0 ? (
              <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.empty}</p>
            ) : (
              plan && <PlanBody key={`${hours}:${plan.suggestions.map((s) => `${s.id}${s.day}`).join()}`} plan={plan} onDone={done} />
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
