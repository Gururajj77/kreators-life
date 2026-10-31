import { RELATIONSHIP_BY_KEY, TASK_SORTS, addDays, isTaskSort, sortTasks, type Node } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { CheckRow } from '../components/CheckRow';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { GuideCard, useGuide } from '../components/Guide';
import { NotToDoBlock } from '../components/NotToDoList';
import { Nudge } from '../components/Nudge';
import { Person } from '../components/Person';
import { RoutineSection } from '../components/RoutineSection';
import { Screen } from '../components/Screen';
import { RemindersSection } from '../components/Reminders';
import { TaskRow } from '../components/TaskRow';
import { TaskPanel } from '../components/TaskPlan';
import { api } from '../lib/api';
import { prettyDate } from '../lib/date';
import { useMe, useRefreshAll, useToday } from '../lib/queries';
import { useActionQueue } from '../lib/useActionQueue';
import { useParamState } from '../lib/useParamState';

/** A task on Daily with its plan panel one tap away. */
function DailyTask({ t, date, queue, onToggle, subtitle }: { t: Node; date: string; queue: ReturnType<typeof useActionQueue>; onToggle: () => void; subtitle: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TaskRow
      task={t}
      today={date}
      subtitle={subtitle}
      busy={queue.isPending(t.id)}
      hint={queue.hint(t.id)}
      onToggle={onToggle}
      onEdit={() => setOpen((v) => !v)}
      editLabel={open ? 'Close the plan for' : 'Plan'}
      panel={open ? <TaskPanel task={t} today={date} /> : null}
    />
  );
}

/** A task with no day yet: pick one and it moves up into Tasks. */
function BacklogTask({ t, date, queue }: { t: Node; date: string; queue: ReturnType<typeof useActionQueue> }) {
  const refresh = useRefreshAll();
  const [open, setOpen] = useState(false);
  const pick = useMutation({ mutationFn: (day: string) => api.updateNode(t.id, { doDate: day }), onSuccess: () => refresh() });
  return (
    <TaskRow
      task={t}
      today={date}
      subtitle={`${RELATIONSHIP_BY_KEY[t.relationship].name}, no day yet`}
      busy={queue.isPending(t.id) || pick.isPending}
      onToggle={() => setOpen(true)}
      hint="Pick a day first. Then it moves up into Tasks."
      onEdit={() => setOpen((v) => !v)}
      editLabel={open ? 'Close the plan for' : 'Plan'}
      panel={
        <>
          <div className="mt-xs flex flex-wrap items-center gap-xs" role="group" aria-label={`Pick a day for ${t.title}`}>
            <button type="button" onClick={() => pick.mutate(date)} className="toy toy-soft min-h-[44px] rounded-pill border-2 border-line bg-card px-sm text-[14px] font-bold">
              Today
            </button>
            <button type="button" onClick={() => pick.mutate(addDays(date, 1))} className="toy toy-soft min-h-[44px] rounded-pill border-2 border-line bg-card px-sm text-[14px] font-bold">
              Tomorrow
            </button>
            <input type="date" aria-label={`Do date for ${t.title}`} min={date} onChange={(e) => e.target.value && pick.mutate(e.target.value)} className="min-h-[44px] rounded-pill border-2 border-line bg-paper px-sm text-[14px] font-bold" />
          </div>
          {open && <TaskPanel task={t} today={date} />}
        </>
      }
    />
  );
}

export function Today() {
  const { date, data, isPending, isError, refetch } = useToday();
  const me = useMe();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const guide = useGuide();
  const queue = useActionQueue(refresh);

  const checkIn = () =>
    queue.run('checkin', async () => {
      const r = await api.checkin(date);
      if (!r.alreadyCheckedIn) {
        celebrate({ title: r.streakBonus > 0 ? `Day ${r.streak}. Streak bonus!` : `Day ${r.streak} checked in`, totalXp: r.awarded, points: r.points, color: '#FACC15' });
      }
    });
  const doSpark = () =>
    queue.run('spark', async () => {
      const r = await api.spark(date);
      if (!r.alreadyDone) celebrate({ title: 'Small act done', totalXp: r.awarded, color: RELATIONSHIP_BY_KEY[r.relationship].color });
    });
  const tick = (id: string) =>
    queue.run(id, async () => {
      const r = await api.complete(id, date);
      celebrate({
        title: r.capped ? 'Done. Daily xp limit reached, so this one was for you' : 'Ripple',
        totalXp: r.totalXp,
        ripple: r.ripple,
        newBadges: r.newBadges,
        projectCleared: r.projectCleared,
        color: RELATIONSHIP_BY_KEY[r.node.relationship].color,
      });
    });

  // A task ticked by mistake comes back: unticking takes back what it paid, the same as on a pillar page.
  const untick = (id: string) =>
    queue.run(id, async () => {
      await api.uncomplete(id);
    });

  const rel = data ? RELATIONSHIP_BY_KEY[data.spark.relationship] : null;
  const [sortRaw, setSort] = useParamState('taskSort', 'day');
  const sort = isTaskSort(sortRaw) ? sortRaw : 'day';
  const tasks = sortTasks(data?.tasks ?? [], sort);
  const backlog = sortTasks(data?.backlog ?? [], sort === 'day' ? 'priority' : sort);
  const done = data?.done ?? [];
  const doneAt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
  const taskDone = Boolean(data && data.doneRecently > 0);
  const doneCount = data ? Number(data.checkedIn) + Number(data.spark.done) + Number(taskDone) : 0;
  const identity = me.data?.identity ?? null;

  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <p className="m-0 text-[14px] font-bold text-ink-soft">{prettyDate(date)}</p>
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-[30px]">Daily</h1>
          {data && (
            <span className="shrink-0 rounded-pill bg-card px-sm py-xs text-[14px] font-extrabold shadow-toy-soft">
              <span aria-hidden="true">🔥 </span>
              {data.streak} {data.streak === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>
        {data && (
          <div className="mt-sm">
            <p className="m-0 text-[14px] font-bold">
              {doneCount === 3 ? 'All three done. See you tomorrow.' : `${doneCount} of 3 done. Tick a box when you have done the thing.`}
            </p>
            <div className="mt-xs flex gap-xs" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-[8px] flex-1 rounded-pill ${i < doneCount ? 'bg-r4' : 'bg-line'}`} />
              ))}
            </div>
            <Nudge className="mt-xs" text={!data.checkedIn ? 'Checking in is 10 xp and 10 points.' : !data.spark.done ? 'The small act is 15 xp for two minutes.' : !taskDone ? 'One ticked task is 20 xp.' : 'All three paid. A kept day on the not-to-do list is 5 more.'} />
          </div>
        )}
      </header>

      <RemindersSection />

      {!guide.seen && <GuideCard onDismiss={guide.dismiss} />}

      {isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Loading your day
        </p>
      )}
      {isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load today.</p>
          <Button variant="outline" className="mt-sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && rel && (
        <>
          <section className="mt-lg" aria-labelledby="show-heading">
            <h2 id="show-heading" className="text-[18px]">
              Show up
            </h2>
            <div className="mt-sm">
              <CheckRow
                large
                checked={data.checkedIn}
                onToggle={checkIn}
                title={data.checkedIn ? `Checked in, day ${data.streak}` : 'I showed up today'}
                subtitle={
                  data.checkedIn ? (
                    <>
                      Points banked.{' '}
                      <Link to="/rewards" className="underline underline-offset-4">
                        See rewards
                      </Link>
                    </>
                  ) : (
                    '+10 xp and +10 points. Fifty bonus points every seventh day in a row.'
                  )
                }
                color="#9BB068"
                deep="#5A6B38"
                text="#262626"
                busy={queue.isPending('checkin')}
                hint={queue.hint('checkin')}
                lockedMessage={data.checkedIn ? 'Already checked in today. Come back tomorrow.' : null}
              />
            </div>
          </section>

          <RoutineSection date={date} />

          <section className="mt-lg" aria-labelledby="spark-heading">
            <div className="flex items-center gap-sm">
              <Avatar relationship={rel.key} size={36} still decorative mood={data.spark.done ? 'excited' : 'happy'} />
              <h2 id="spark-heading" className="text-[18px]">
                {rel.character}&rsquo;s small act for today
              </h2>
            </div>
            <div className="mt-sm">
              <CheckRow
                large
                checked={data.spark.done}
                onToggle={doSpark}
                title={data.spark.text}
                subtitle={data.spark.done ? `Done. ${rel.character} is glowing.` : `${rel.character} is your ${rel.role}. Two minutes, +15 xp.`}
                color={rel.color}
                deep={`var(--deep-${rel.key})`}
                text={rel.text}
                busy={queue.isPending('spark')}
                hint={queue.hint('spark')}
                lockedMessage={data.spark.done ? 'Done for today. A new small act comes tomorrow.' : null}
              />
            </div>
          </section>

          <section className="mt-lg" aria-labelledby="tasks-heading">
            <div className="flex items-baseline justify-between gap-sm">
              <h2 id="tasks-heading" className="text-[18px]">
                Tasks
              </h2>
              {tasks.length > 0 && <span className="text-[14px] font-bold text-ink-soft">{tasks.length} waiting</span>}
            </div>
            {(tasks.length > 1 || backlog.length > 1) && (
              <div className="mt-xs flex flex-wrap items-center gap-xs" role="group" aria-label="Sort tasks by">
                <span className="text-[14px] font-bold text-ink-soft">Sort by</span>
                {TASK_SORTS.map((s) => (
                  <button key={s.key} type="button" aria-pressed={sort === s.key} title={s.blurb} onClick={() => setSort(s.key)} className={`toy min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${sort === s.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {data.timePlan.plannedMin + data.timePlan.doneMin > 0 && (
              <div className="mt-xs rounded-tile bg-card p-sm shadow-toy-soft" aria-label="Time plan">
                <div className="flex items-baseline justify-between gap-sm">
                  <p className="m-0 text-[14px] font-bold">
                    {data.timePlan.doneMin > 0 ? `${data.timePlan.doneMin} of ${data.timePlan.doneMin + data.timePlan.plannedMin} min done` : `${data.timePlan.plannedMin} min planned`}
                  </p>
                  <p className="m-0 text-[12px] font-bold text-ink-soft">{data.timePlan.timed > 0 ? `${data.timePlan.timed} with a set time` : 'no set times yet'}</p>
                </div>
                <div className="mt-xs h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                  <div className="h-full rounded-pill bg-r4" style={{ width: `${Math.round((data.timePlan.doneMin / Math.max(1, data.timePlan.doneMin + data.timePlan.plannedMin)) * 100)}%` }} />
                </div>
              </div>
            )}
            {tasks.length > 0 ? (
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                <AnimatePresence initial={false}>
                  {tasks.map((t) => (
                    <DailyTask key={t.id} t={t} date={date} queue={queue} onToggle={() => tick(t.id)} subtitle={RELATIONSHIP_BY_KEY[t.relationship].name} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="mt-sm rounded-card border-2 border-dashed border-line p-md">
                <p className="m-0 text-[14px] font-semibold text-ink-soft">
                  {taskDone ? 'Tasks done for today. Their pyramids got stronger. More arrive as their dates come up.' : 'Tasks come from pillars you set up.'}
                </p>
                <Link to="/tower" className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
                  {taskDone ? 'Set up another pillar' : 'Set up a pillar'}
                </Link>
              </div>
            )}
            {data.backlogTotal > 0 && (
              <details className="mt-md rounded-card bg-card p-sm shadow-toy-soft">
                <summary className="toy flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-sm text-[16px] font-bold">
                  <span>Not scheduled yet</span>
                  <span className="text-[14px] text-ink-soft">{data.backlogTotal}</span>
                </summary>
                <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">These have no date yet. They stay out of Tasks until you pick a do date or a due date; then one moves up.</p>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  {backlog.map((t) => (
                    <BacklogTask key={t.id} t={t} date={date} queue={queue} />
                  ))}
                </ul>
                {data.backlogTotal > backlog.length && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Showing {backlog.length} of {data.backlogTotal}. Pillars lists the rest.</p>}
              </details>
            )}
            {done.length > 0 && (
              <div role="group" className="mt-md" aria-labelledby="done-heading">
                <div className="flex items-baseline justify-between gap-sm">
                  <h3 id="done-heading" className="text-[16px]">
                    Done today
                  </h3>
                  <span className="text-[14px] font-bold text-ink-soft">{done.length}</span>
                </div>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  <AnimatePresence initial={false}>
                    {done.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        today={date}
                        subtitle={`${RELATIONSHIP_BY_KEY[t.relationship].name}${t.completedAt ? `, done at ${doneAt(t.completedAt)}` : ''}`}
                        busy={queue.isPending(t.id)}
                        hint={queue.hint(t.id)}
                        onToggle={() => untick(t.id)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
                <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
                  Tap one to untick it; that takes back its xp. Earlier days are on each pillar in{' '}
                  <Link to="/tower" className="underline underline-offset-4 hover:text-ink">
                    Pillars
                  </Link>
                  .
                </p>
              </div>
            )}
          </section>

          <NotToDoBlock />
        </>
      )}

      {identity && (
        <section className="mt-lg" aria-labelledby="evo-heading">
          <h2 id="evo-heading" className="text-[18px]">
            Who you are becoming
          </h2>
          <Link to="/you" className="toy toy-soft mt-sm block rounded-card bg-card p-md text-ink">
            <EvolutionReveal
              now={<Person stage={identity.stage.stage} size={72} decorative />}
              nowName={identity.stage.name}
              next={identity.next ? <Person stage={identity.next.stage} size={72} decorative /> : null}
              nextName={identity.next?.name ?? null}
              charge={identity.charge}
              preparing={identity.preparing}
              readyInDays={identity.readyInDays}
            />
            <p className="mt-sm m-0 text-center text-[14px] font-semibold text-ink-soft">
              {identity.preparing && identity.next
                ? `Fully revealed. Evolves in ${identity.readyInDays} ${identity.readyInDays === 1 ? 'day' : 'days'}.`
                : identity.next
                  ? `${identity.xpToNext} xp until ${identity.next.name} is fully revealed.`
                  : `${identity.stage.name}. Final form.`}
            </p>
          </Link>
        </section>
      )}
    </Screen>
  );
}
