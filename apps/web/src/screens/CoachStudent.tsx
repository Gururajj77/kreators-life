import { BADGE_META, COACH_NOTE_MAX, COACH_SHARE_META, COACH_SHARE_PARTS, type CoachShare, type CoachSharePart, KIND_META, levelFromXp, PENALTIES, RELATIONSHIP_BY_KEY, RELATIONSHIPS, SCORE_LABEL, SCORECARD, weightWord, type Node, type NodeKind } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { AreaLine, Gauge, HBars, MultiLine, StatTile, WeekDots } from '../components/Charts';
import { PlacementChart, ScoreRow } from '../components/LifeMap';
import { CoachFace } from '../components/MyCoach';
import { BackLink } from '../components/PageHeader';
import { Pager, usePage } from '../components/Pager';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { shortDay } from '../lib/date';
import { useAuthed } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const say = (e: unknown) => (e instanceof Error ? e.message : 'That did not work.');
const LAYERS: NodeKind[] = ['pillar', 'principle', 'value_goal', 'outcome'];
const PART_SECTION_ID: Record<CoachSharePart, string> = { daily: 'daily-heading', pillars: 'pillars-heading', routine: 'routine-heading', lifeMap: 'map-heading', reflection: 'reflection-heading' };

/** Scrolls a part's section to just under the stuck bar. Reduced motion jumps instead of sliding. */
function jumpTo(id: string) {
  const heading = document.getElementById(id);
  const bar = document.getElementById('share-bar');
  if (!heading) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stuckAt = bar ? parseFloat(getComputedStyle(bar).top) || 0 : 0;
  const top = heading.getBoundingClientRect().top + window.scrollY - stuckAt - (bar?.offsetHeight ?? 0) - 16;
  window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
}

/**
 * The parts a student shares, as a row that sticks to the top of the screen. Flat while it sits in the page; once it
 * sticks, a frosted backdrop and a hairline fade in. On a phone the strip reaches up behind the logo and the corner
 * buttons, and the chips sit under them.
 */
function ShareBar({ share }: { share: CoachShare }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(Boolean(e && !e.isIntersecting && e.boundingClientRect.top < 0)));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!backdrop.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) gsap.set(backdrop.current, { opacity: stuck ? 1 : 0 });
    else gsap.to(backdrop.current, { opacity: stuck ? 1 : 0, duration: 0.25, ease: 'power2.out' });
  }, [stuck]);
  return (
    <>
      <div ref={sentinel} aria-hidden="true" />
      <div id="share-bar" className="sticky top-[calc(64px+env(safe-area-inset-top))] z-20 -mx-md md:top-0 md:-mx-lg">
        <div ref={backdrop} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -top-[calc(64px+env(safe-area-inset-top))] border-b border-line bg-paper/85 opacity-0 backdrop-blur-md md:top-0" />
        <nav aria-label="What they share" className="scroll-row relative m-0 py-sm [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] md:px-lg md:[mask-image:none]">
          {COACH_SHARE_PARTS.map((k) =>
            share[k] ? (
              <button key={k} type="button" onClick={() => jumpTo(PART_SECTION_ID[k])} className="toy toy-soft inline-flex min-h-[40px] shrink-0 items-center rounded-pill bg-card px-sm text-[12px] font-extrabold text-ink">
                {COACH_SHARE_META[k].name}
              </button>
            ) : (
              <span key={k} title="They do not share this" className="inline-flex min-h-[40px] shrink-0 items-center rounded-pill bg-line px-sm text-[12px] font-extrabold text-ink-soft line-through">
                {COACH_SHARE_META[k].name}
              </span>
            ),
          )}
        </nav>
      </div>
    </>
  );
}

function Problem({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {say(e)}
    </p>
  );
}

/** A task as the coach sees it: the title, when it is due, whether the coach added it, and a way to change it while it is open. */
function TaskLine({ t, onEdit }: { t: Node; onEdit?: () => void }) {
  const tags = [t.fromCoach ? 'From a coach' : null, t.dueDate ? `${shortDay(t.dueDate)}${t.dueTime ? `, ${t.dueTime}` : ''}` : null].filter(Boolean);
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start gap-xs">
        <span className="mt-xs size-[12px] shrink-0 rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[t.relationship].color }} aria-hidden="true" />
        <span className={`min-w-0 flex-1 text-[14px] font-bold ${t.status === 'done' ? 'text-ink-soft line-through' : ''}`}>{t.title}</span>
      </div>
      {(tags.length > 0 || (onEdit && t.status === 'active')) && (
        <div className="mt-xs flex flex-wrap items-center justify-end gap-xs">
          {tags.map((x) => (
            <span key={x} className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[24px] text-ink-soft">
              {x}
            </span>
          ))}
          {onEdit && t.status === 'active' && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Change
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

type Editing = { mode: 'add'; parentId: string } | { mode: 'edit'; task: Node };

/** Add a task under one of the projects of the student, or change an open one. The student ticks it; nobody else does. */
function TaskSheet({ studentId, editing, projects, onClose, onDone }: { studentId: string; editing: Editing | null; projects: Node[]; onClose: () => void; onDone: () => void }) {
  const task = editing?.mode === 'edit' ? editing.task : null;
  const [parentId, setParentId] = useState(editing?.mode === 'add' ? editing.parentId : '');
  const [title, setTitle] = useState(task?.title ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task?.dueTime ?? '');
  const [minutes, setMinutes] = useState(task?.estimateMin ? String(task.estimateMin) : '');
  const [note, setNote] = useState(task?.note ?? '');
  const save = useMutation({
    mutationFn: () => {
      const body = { title, note, dueDate: dueDate || null, dueTime: dueTime || null, estimateMin: Number(minutes) > 0 ? Number(minutes) : null };
      return task ? api.coachEditTask(studentId, task.id, body) : api.coachAddTask(studentId, { parentId, ...body });
    },
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={Boolean(editing)} onClose={onClose} title={task ? 'Change the task' : 'Add a task'}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && (task || parentId)) save.mutate();
        }}
      >
        {!task && (
          <label className="block">
            <span className="block text-[14px] font-bold">Under which project</span>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} required className={field}>
              <option value="">Pick a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {RELATIONSHIP_BY_KEY[p.relationship].name}: {p.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-[14px] font-bold">The task</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={140} placeholder={KIND_META.task.prompt} className={field} />
        </label>
        <div className="grid grid-cols-3 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Day</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Time</span>
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Minutes</span>
            <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">A note, optional</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={field} />
        </label>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">{task ? 'Renaming a task starts its wait again. The change goes in the change log and to their inbox.' : 'It shows as From your coach. It waits and pays like their own tasks, and only they tick it.'}</p>
        <Problem e={save.error} />
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || (!task && !parentId)}>
          {task ? 'Save the change' : 'Add the task'}
        </Button>
      </form>
    </Sheet>
  );
}

/** One student, as their life coach sees them: each part only when they share it, numbers first, and the change log at the end. */
export function CoachStudent() {
  const { id = '' } = useParams();
  const rev = usePage('rev');
  const notePg = usePage('note');
  const logPg = usePage('log');
  const query = `${rev.query}&${notePg.query}&${logPg.query}`;
  const q = useAuthed(['coach-student', id, query], () => api.coachStudent(id, query));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [note, setNote] = useState('');
  const write = useMutation({
    mutationFn: () => api.coachNote(id, note),
    onSuccess: () => {
      setNote('');
      void q.refetch();
    },
  });
  const takeBack = useMutation({ mutationFn: (noteId: string) => api.removeCoachNote(id, noteId), onSuccess: () => void q.refetch() });
  const d = q.data;
  if (q.isError)
    return (
      <Screen>
        <header className="pt-lg">
          <BackLink to="/coaching">Coaching</BackLink>
          <h1 className="text-[30px]">Not your student</h1>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{say(q.error)}</p>
        </header>
      </Screen>
    );
  if (!d) return null;
  const s = d.link.student;
  const share = d.link.share;
  const projects = (d.pillars?.nodes ?? []).filter((n) => n.kind === 'project' && n.status === 'active');
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/coaching">Coaching</BackLink>
        <div className="mt-xs flex items-center gap-sm">
          <CoachFace name={s.name} badge={s.badge} size={56} />
          <div className="min-w-0">
            <h1 className="text-[30px]">{s.name}</h1>
            <p className="m-0 text-[14px] font-semibold text-ink-soft">
              {BADGE_META[s.badge].name}{s.handle ? `, @${s.handle}` : ''}. Your student since {new Date(d.link.answeredAt ?? d.link.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. Their today is {shortDay(d.date)}.
            </p>
          </div>
        </div>
        <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">They pick what you see and can change it any time. Never their journal.</p>
      </header>

      <ShareBar share={share} />

      <div className="mt-lg grid grid-cols-2 gap-xs sm:grid-cols-3">
        {d.daily && <StatTile label="Streak" value={d.daily.streak} hint={`Best ${d.daily.bestStreak}. ${d.daily.checkedIn ? 'Checked in today.' : 'Not checked in today.'}`} />}
        {d.daily && <StatTile label="Level" value={levelFromXp(d.daily.xp)} hint={`${d.daily.xp} xp`} />}
        {d.daily && <StatTile label="Tasks, 30 days" value={d.daily.tasksByDay.reduce((a, b) => a + b, 0)} hint={`${d.daily.checkins.length} check-ins`} />}
        {d.routine && <StatTile label="Routine, 7 days" value={`${d.routine.week.done} of 7`} hint={d.routine.contract ? `Their plan: ${d.routine.contract.minDays} days a week` : 'No contract yet'} />}
        {d.reflection && <StatTile label="Wellbeing" value={d.reflection.wellbeing.score} hint={d.reflection.wellbeing.label} />}
      </div>

      {d.daily && (
        <Section id="daily-heading" title="Daily and streaks" lede="Tasks ticked each day over the last thirty, and the day as it stands.">
          <AreaLine values={d.daily.tasksByDay} max={Math.max(3, ...d.daily.tasksByDay)} color="var(--color-r4)" label={`Tasks ticked per day over thirty days, ${d.daily.tasksByDay.reduce((a, b) => a + b, 0)} in all`} labels={d.daily.tasksByDay.map((_, i) => shortDay(new Date(Date.parse(`${d.date}T00:00:00Z`) - (29 - i) * 86_400_000).toISOString().slice(0, 10)))} />
          <p className="mt-sm m-0 text-[14px] font-bold">Small act today: {d.daily.smallAct.done ? `done${d.daily.smallAct.relationship ? `, for ${RELATIONSHIP_BY_KEY[d.daily.smallAct.relationship].name}` : ''}` : 'not yet'}.</p>
          <h3 className="mt-md text-[18px]">Due by today</h3>
          {d.daily.tasks.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">Nothing due.</p>}
          <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
            {d.daily.tasks.map((t) => (
              <TaskLine key={t.id} t={t} onEdit={share.pillars ? () => setEditing({ mode: 'edit', task: t }) : undefined} />
            ))}
          </ul>
          {d.daily.done.length > 0 && (
            <>
              <h3 className="mt-md text-[18px]">Done today</h3>
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                {d.daily.done.map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </ul>
            </>
          )}
          {d.daily.notToDo.length > 0 && (
            <>
              <h3 className="mt-md text-[18px]">Not to do</h3>
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                {d.daily.notToDo.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                    <span className="min-w-0 flex-1 text-[14px] font-bold">{n.title}</span>
                    <WeekDots days={n.week.map((w) => w === 'kept')} color="var(--color-r4)" label={`Kept ${n.week.filter((w) => w === 'kept').length} of the last 7 days`} />
                    <span className="text-[12px] font-extrabold text-ink-soft">{n.streak} in a row</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      {d.pillars && (
        <Section
          id="pillars-heading"
         
          title="Pillars and pyramids"
          lede="Each pyramid top down: the foundation first, projects last. Add a task under a project, or change an open one."
          action={
            projects.length > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setEditing({ mode: 'add', parentId: '' })}>
                Add a task
              </Button>
            ) : undefined
          }
        >
          <HBars
            label="Xp in each pillar"
            rows={RELATIONSHIPS.map((r) => {
              const xp = d.pillars?.relationships.find((x) => x.key === r.key)?.xp ?? 0;
              const top = Math.max(1, ...(d.pillars?.relationships ?? []).map((x) => x.xp));
              return { key: r.key, label: r.name, value: xp / top, text: `${xp} xp`, color: r.color };
            })}
          />
          {RELATIONSHIPS.map((r) => {
            const mine = (d.pillars?.nodes ?? []).filter((n) => n.relationship === r.key);
            if (mine.length === 0) return null;
            return (
              <div key={r.key} className="mt-md rounded-card bg-card p-md shadow-toy-soft">
                <h3 className="text-[18px]" style={{ color: `var(--deep-${r.key})` }}>
                  {r.name}
                </h3>
                <dl className="mt-xs m-0 grid gap-xs text-[14px]">
                  {LAYERS.flatMap((k) =>
                    mine
                      .filter((n) => n.kind === k)
                      .map((n) => (
                        <div key={n.id}>
                          <dt className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{KIND_META[k].label}</dt>
                          <dd className="m-0 font-bold">{n.title}</dd>
                        </div>
                      )),
                  )}
                </dl>
                {mine
                  .filter((n) => n.kind === 'project')
                  .map((p) => {
                    const tasks = mine.filter((t) => t.kind === 'task' && t.parentId === p.id).sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
                    return (
                      <div key={p.id} className="mt-sm">
                        <div className="flex flex-wrap items-center justify-between gap-xs">
                          <p className="m-0 text-[14px] font-extrabold">
                            {KIND_META.project.label}: {p.title}
                            {p.status === 'done' ? ' (done)' : ''}
                          </p>
                          {p.status === 'active' && (
                            <Button size="sm" variant="ghost" onClick={() => setEditing({ mode: 'add', parentId: p.id })}>
                              Add a task here
                            </Button>
                          )}
                        </div>
                        <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                          {tasks.map((t) => (
                            <TaskLine key={t.id} t={t} onEdit={() => setEditing({ mode: 'edit', task: t })} />
                          ))}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </Section>
      )}

      {d.routine && (
        <Section id="routine-heading" title="Routine and contract" lede="The routine from their strategy session, the last seven days, and the plan they signed.">
          <WeekDots days={d.routine.week.days.map(Boolean)} color="var(--color-r4)" label={`Routine kept ${d.routine.week.done} of the last 7 days`} />
          {d.routine.contract ? (
            <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0 text-[14px] font-semibold">
              <li>At least {d.routine.contract.minDays} days a week. These seven days: {d.routine.week.done}.</li>
              <li>Check-in at {d.routine.contract.checkinTime}.</li>
              <li>A short week: {PENALTIES.find((p) => p.key === d.routine?.contract?.penalty)?.name.toLowerCase() ?? 'the streak breaks'}.</li>
              <li>Weekly check on {d.routine.contract.nextWeekly}, monthly review on {d.routine.contract.nextMonthly}.</li>
            </ul>
          ) : (
            <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No contract signed yet.</p>
          )}
          {d.routine.general.length > 0 && (
            <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
              {d.routine.general.map((b) => (
                <li key={b.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
                  <p className="m-0 text-[14px] font-extrabold">
                    {b.name}, {b.start} to {b.end}
                  </p>
                  {b.steps.length > 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">{b.steps.join(', ')}</p>}
                </li>
              ))}
            </ol>
          )}
          {d.routine.today && <p className="mt-sm m-0 text-[14px] font-bold">Today’s morning: {d.routine.today.done ? 'done' : `${d.routine.today.steps.length} steps ticked so far`}.</p>}
        </Section>
      )}

      {d.lifeMap && (
        <Section id="map-heading" title="Life map answers" lede={`From their strategy session on ${new Date(d.lifeMap.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. The bar runs from where they drop under stress to where they usually live.`}>
          <PlacementChart placements={d.lifeMap.placements} focus={d.lifeMap.focus} />
          <h3 className="mt-md text-[18px]">Scores</h3>
          <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
            {[...SCORECARD.health, ...SCORECARD.wealth].map((k) => (
              <ScoreRow key={k} label={SCORE_LABEL[k]} value={d.lifeMap?.scores[k]} color="var(--deep-self)" />
            ))}
            {RELATIONSHIPS.map((r) => (
              <ScoreRow key={r.key} label={r.name} value={d.lifeMap?.scores[r.key]} color={r.color} />
            ))}
          </ul>
          {(d.lifeMap.fears.length > 0 || d.lifeMap.insecurities.length > 0) && (
            <>
              <h3 className="mt-md text-[18px]">What gets in the way</h3>
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                {d.lifeMap.fears.map((f) => (
                  <li key={`f-${f.text}`} className="rounded-tile bg-card p-sm text-[14px] font-bold shadow-toy-soft">
                    {f.text} <span className="font-semibold text-ink-soft">({RELATIONSHIP_BY_KEY[f.relationship].name}; {f.drives === 'yes' ? 'drives decisions' : f.drives === 'sometimes' ? 'sometimes drives them' : 'does not drive them'})</span>
                  </li>
                ))}
                {d.lifeMap.insecurities.map((it, i) => (
                  <li key={`i-${i}`} className="rounded-tile bg-card p-sm text-[14px] font-bold shadow-toy-soft">
                    {it.text} <span className="font-semibold text-ink-soft">({RELATIONSHIP_BY_KEY[it.relationship].name}; weighs {weightWord(it.weight).toLowerCase()})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      {!d.lifeMap && share.lifeMap && (
        <Section id="map-heading" title="Life map answers" lede="Where each pillar sits on the map, their scores and what gets in the way.">
          <p className="m-0 text-[14px] font-semibold text-ink-soft">No life map yet. It fills in once they finish their strategy session.</p>
        </Section>
      )}

      {d.reflection && (
        <Section id="reflection-heading" title="Reflection" lede="Wellbeing and the trackers over thirty days, numbers only, and their saved reviews. Never their journal or tracker notes.">
          <div className="flex flex-wrap items-center gap-md">
            <Gauge value={d.reflection.wellbeing.score / 100} size={120} stroke={12} color="var(--color-r4)" label={`Wellbeing ${d.reflection.wellbeing.score} of 100, ${d.reflection.wellbeing.label}`}>
              <span className="font-display text-[28px] font-extrabold">{d.reflection.wellbeing.score}</span>
            </Gauge>
            <p className="m-0 min-w-0 flex-1 text-[14px] font-semibold text-ink-soft">{d.reflection.wellbeing.label}. Mood, sleep, stress, mindful minutes and the streak, over the last seven days.</p>
          </div>
          <div className="mt-md">
            <MultiLine
              label="Mood and stress over thirty days, from one to five"
              max={5}
              min={1}
              labels={d.reflection.days.map((x) => shortDay(x.date))}
              series={[
                { values: d.reflection.days.map((x) => x.mood), color: 'var(--color-r3)', label: 'Mood' },
                { values: d.reflection.days.map((x) => x.stress), color: 'var(--color-r1)', label: 'Stress' },
              ]}
            />
          </div>
          <div className="mt-md">
            <AreaLine label="Hours of sleep over thirty days" values={d.reflection.days.map((x) => x.sleep)} max={10} color="var(--color-r6)" labels={d.reflection.days.map((x) => shortDay(x.date))} />
          </div>
          <p className="mt-sm m-0 text-[14px] font-bold">
            Thirty days: {d.reflection.days.reduce((a, x) => a + x.mindful, 0)} mindful minutes, {d.reflection.days.reduce((a, x) => a + x.move, 0)} minutes moving.
          </p>
          <h3 className="mt-md text-[18px]">Saved reviews</h3>
          {d.reflection.reviews.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">No reviews saved yet.</p>}
          <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
            {d.reflection.reviews.map((r) => (
              <li key={r.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[14px] font-extrabold">
                  {r.templateName}, {shortDay(r.start)} to {shortDay(r.end)}
                  {r.rating ? `, ${r.rating} of 5` : ''}
                </p>
                <dl className="mt-xs m-0 grid gap-xs text-[14px]">
                  {r.prompts.map((p, i) =>
                    r.answers[i] ? (
                      <div key={i}>
                        <dt className="font-bold text-ink-soft">{p}</dt>
                        <dd className="m-0 whitespace-pre-wrap font-semibold">{r.answers[i]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </li>
            ))}
          </ul>
          <Pager page={d.reflection.reviewsPage} prefix="rev" label="reviews" />
        </Section>
      )}

      <Section id="notes-heading" title="Notes" lede="They read every note, here and in their inbox.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) write.mutate();
          }}
        >
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={COACH_NOTE_MAX} rows={3} placeholder="What you noticed, and one next step" aria-label="A note for your student" className={field} />
          <Button type="submit" className="mt-xs" disabled={write.isPending || !note.trim()}>
            Leave the note
          </Button>
        </form>
        <Problem e={write.error ?? takeBack.error} />
        <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {d.notes.map((n) => (
            <li key={n.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 whitespace-pre-wrap text-[16px] font-semibold">{n.body}</p>
              <div className="mt-xs flex flex-wrap items-center justify-between gap-xs">
                <span className="text-[12px] font-bold text-ink-soft">{when(n.createdAt)}</span>
                {n.mine && (
                  <Button size="sm" variant="ghost" disabled={takeBack.isPending} onClick={() => takeBack.mutate(n.id)}>
                    Take back
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <Pager page={d.notesPage} prefix="note" label="notes" />
      </Section>

      <Section id="log-heading" title="Change log" lede="Every ask, yes, note and task change between you two, with when it happened. They see the same lines.">
        {d.log.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">Nothing yet.</p>}
        <ol className="m-0 flex list-none flex-col gap-xs p-0">
          {d.log.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-xs rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="min-w-0 flex-1 text-[14px] font-semibold">{e.label}</span>
              <time dateTime={e.createdAt} className="shrink-0 text-[12px] font-bold text-ink-soft">
                {when(e.createdAt)}
              </time>
            </li>
          ))}
        </ol>
        <Pager page={d.logPage} prefix="log" label="changes" />
      </Section>

      <TaskSheet key={editing ? (editing.mode === 'edit' ? editing.task.id : `add-${editing.parentId}`) : 'none'} studentId={id} editing={editing} projects={projects} onClose={() => setEditing(null)} onDone={() => void q.refetch()} />
    </Screen>
  );
}
