import { RELATIONSHIP_BY_KEY, TASK_SORTS, addDays, openDay, isTaskSort, sortTasks, type Node, LOCALE } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Link, useSearchParams } from 'react-router';
import { AgencyToday, TodayEvents } from '../components/AgencyToday';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { CheckRow } from '../components/CheckRow';
import { DayBlocks } from '../components/DayBlocks';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { Fold } from '../components/Fold';
import { Icon } from '../components/Icon';
import { Flame } from 'lucide-react';
import { RollNumber } from '../components/fx/RollNumber';
import { NotToDoBlock } from '../components/NotToDoList';
import { EmergenceSlot, HabitsSlot } from '../components/EmergenceSlot';
import { Nudge } from '../components/Nudge';
import { Person } from '../components/Person';
import { RoutineSection } from '../components/RoutineSection';
import { Screen } from '../components/Screen';
import { Skeleton, SkeletonList } from '../components/Skeleton';
import { RemindersSection } from '../components/Reminders';
import { TaskRow } from '../components/TaskRow';
import { TaskPanel } from '../components/TaskPlan';
import { WeekPlanButton } from '../components/WeekPlan';
import { api } from '../lib/api';
import { dayLabel, prettyDate } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { useMe, useRefreshAll, useToday } from '../lib/queries';
import { useActionQueue } from '../lib/useActionQueue';
import { useParamState } from '../lib/useParamState';
import { DayTypeNote, DayTypeSelect, useDayType } from '../components/DayTypePicker';
import { TabRow } from '../components/TabRow';

// The month calendar downloads only when its toggle is opened.
const TaskMonth = lazyNamed(() => import('../components/TaskMonth'), 'TaskMonth');
const AddTaskForm = lazyNamed(() => import('../components/TaskMonth'), 'AddTaskForm');

/** A task on Daily with its plan panel one tap away. */
function DailyTask({ t, date, queue, onToggle, subtitle, focus = false }: { t: Node; date: string; queue: ReturnType<typeof useActionQueue>; onToggle: () => void; subtitle?: string; focus?: boolean }) {
  // A reminder note opens Daily on its task (`?task=<id>`): that task starts with its plan open and is scrolled into view, once.
  const [open, setOpen] = useState(focus);
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`task-plan-${t.id}`);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [focus, t.id]);
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
      editOpen={open}
      editControls={`task-plan-${t.id}`}
      panel={
        open ? (
          <div id={`task-plan-${t.id}`}>
            <TaskPanel task={t} today={date} />
          </div>
        ) : null
      }
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
      subtitle="No day yet"
      busy={queue.isPending(t.id) || pick.isPending}
      onToggle={() => setOpen(true)}
      hint="Pick a day first. Then it moves up into Tasks."
      onEdit={() => setOpen((v) => !v)}
      editLabel={open ? 'Close the plan for' : 'Plan'}
      editOpen={open}
      editControls={`task-plan-${t.id}`}
      panel={
        <>
          <div className="mt-xs flex flex-wrap items-center gap-xs" role="group" aria-label={`Pick a day for ${t.title}`}>
            <button type="button" onClick={() => pick.mutate(date)} className="toy toy-soft min-h-[44px] rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium">
              Today
            </button>
            <button type="button" onClick={() => pick.mutate(addDays(date, 1))} className="toy toy-soft min-h-[44px] rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium">
              Tomorrow
            </button>
            <input type="date" aria-label={`Do date for ${t.title}`} min={date} onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && e.target.value >= '2000-01-01' && pick.mutate(e.target.value)} className="min-h-[44px] rounded-pill border-2 border-line bg-paper px-sm text-subhead font-medium" />
          </div>
          {open && (
            <div id={`task-plan-${t.id}`}>
              <TaskPanel task={t} today={date} />
            </div>
          )}
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
  const queue = useActionQueue(refresh);
  const [search] = useSearchParams();
  const focusTask = search.get('task');
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

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
  // The kind of day the person picked (none to start with). With one picked and no sort chosen, the list sorts By context: P0 first,
  // then the day's lead pillar inside each priority. A sort in the URL still wins.
  const dayType = useDayType(date);
  const [sortRaw, setSort] = useParamState('taskSort', '');
  const ownSort = isTaskSort(sortRaw) ? sortRaw : null;
  const sort = ownSort ?? (dayType.type ? 'context' : 'day');
  const context = dayType.type ? { lead: dayType.type.lead, second: dayType.type.second } : null;
  const sorts = TASK_SORTS.filter((s) => s.key !== 'context' || dayType.type);
  const tasks = sortTasks(data?.tasks ?? [], sort, context);
  const backlogAll = sortTasks(data?.backlog ?? [], sort === 'day' ? 'priority' : sort, context);
  // Things tagged Remember with no day: kept in plain sight, not folded away.
  const remembered = backlogAll.filter((t) => t.remind);
  const backlog = backlogAll.filter((t) => !t.remind);
  const waiting = Math.max(0, (data?.backlogTotal ?? 0) - remembered.length);
  const done = data?.done ?? [];
  const doneAt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' }) : '');
  const taskDone = Boolean(data && data.doneRecently > 0);
  const doneCount = data ? Number(data.checkedIn) + Number(data.spark.done) + Number(taskDone) : 0;
  const identity = me.data?.identity ?? null;

  return (
    // How it works comes in with the day: drawn under the loading cards, it would be pushed down when the day lands.
    <Screen columns={false} howTo={!isPending}>
      <header className="pt-lg">
        <p className="m-0 text-subhead text-ink-soft">{prettyDate(date)}</p>
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-large-title">Daily</h1>
          {data && (
            <span className="inline-flex shrink-0 items-center gap-xs rounded-pill bg-card px-sm py-xs text-subhead font-medium shadow-toy-soft">
              <Icon icon={Flame} size={16} />
              <span>
                <RollNumber value={data.streak} /> {data.streak === 1 ? 'day' : 'days'}
              </span>
            </span>
          )}
          {/* While /today loads, placeholders of the same size hold the header, so nothing under it jumps when it answers. */}
          {isPending && <Skeleton className="h-[calc(1lh+16px)] w-[88px] shrink-0 rounded-pill text-subhead" />}
        </div>
        {isPending && (
          <div className="mt-sm" aria-hidden="true">
            <Skeleton className="h-[1lh] w-3/4 text-subhead" />
            <div className="mt-xs flex gap-xs">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-[8px] flex-1 rounded-pill bg-line" />
              ))}
            </div>
            <Skeleton className="mt-xs h-[1lh] w-1/2 text-caption" />
          </div>
        )}
        {data && (
          <div className="mt-sm">
            <p className="m-0 text-subhead">
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

      {/* Daily lists the remembered tasks once, under To remember; the section here leaves its copy out. */}
      <RemindersSection tasks={false} />

      {isPending && (
        <SkeletonList className="mt-md" count={3} lines={3} label="Loading your day" />
      )}
      {isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load today.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && rel && (
        <>
          <section className="mt-lg" aria-labelledby="show-heading">
            <h2 id="show-heading" className="text-title2">
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

          <section data-pillar={rel.key} className="mt-lg" aria-labelledby="spark-heading">
            <div className="flex items-center gap-sm">
              <Avatar relationship={rel.key} size={36} still decorative mood={data.spark.done ? 'excited' : 'happy'} />
              <h2 id="spark-heading" className="text-title2">
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
              <h2 id="tasks-heading" className="text-title2">
                Tasks
              </h2>
              <div className="flex flex-wrap items-center justify-end gap-sm">
                {tasks.length > 0 && <span className="text-subhead text-ink-soft">{tasks.length} waiting</span>}
                <WeekPlanButton />
              </div>
            </div>
            {/* The kind of day and the sort share one line from the laptop width up (the dropdown at the left of the sort row and its All
                button); below it, a phone or a tablet beside the sidebar, each takes a line of its own (at 768 they ran into each other). */}
            <div className="mt-xs flex w-full flex-col gap-xs lg:flex-row lg:items-center lg:justify-between lg:gap-md">
              <DayTypeSelect type={dayType.type} onPick={dayType.set} />
              {(tasks.length > 1 || backlog.length > 1) && (
                <div className="min-w-0 flex-1">
                  <TabRow lead="Sort by" align="end" label="Sort tasks by" items={sorts.map((s) => ({ key: s.key, label: s.name }))} value={sort} onChange={setSort} />
                </div>
              )}
            </div>
            <DayTypeNote type={dayType.type} failed={dayType.failed} ownSort={ownSort && ownSort !== 'context' ? (TASK_SORTS.find((s) => s.key === ownSort)?.name ?? null) : null} />
            <Fold className="mt-xs" title="Month calendar">
              <Suspense fallback={<Skeleton className="h-[320px]" />}>
                <TaskMonth today={date} />
              </Suspense>
            </Fold>
            {data.timePlan.plannedMin + data.timePlan.doneMin > 0 && (
              <div className="mt-xs rounded-tile bg-card p-sm shadow-toy-soft" aria-label="Time plan">
                <div className="flex items-baseline justify-between gap-sm">
                  <p className="m-0 text-subhead font-semibold">
                    {data.timePlan.doneMin > 0 ? `${data.timePlan.doneMin} of ${data.timePlan.doneMin + data.timePlan.plannedMin} min done` : `${data.timePlan.plannedMin} min planned`}
                  </p>
                  <p className="m-0 text-caption text-ink-soft">{data.timePlan.timed > 0 ? `${data.timePlan.timed} with a set time` : 'no set times yet'}</p>
                </div>
                <div className="mt-xs h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                  <div className="h-full rounded-pill bg-r4" style={{ width: `${Math.round((data.timePlan.doneMin / Math.max(1, data.timePlan.doneMin + data.timePlan.plannedMin)) * 100)}%` }} />
                </div>
              </div>
            )}
            <DayBlocks tasks={tasks.filter((t) => openDay(t) === date)} />
            {tasks.length > 0 ? (
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                <AnimatePresence initial={false}>
                  {tasks.map((t) => (
                    <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} onToggle={() => tick(t.id)} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card border-2 border-dashed border-line p-md">
                <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">
                  {taskDone ? 'Tasks done for today. Their pyramids got stronger. More arrive as their dates come up.' : 'Tasks come from pillars you set up.'}
                </p>
                <Link to="/tower" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
                  {taskDone ? 'Set up another pillar' : 'Set up a pillar'}
                </Link>
              </div>
            )}
            {/* Under the list: a quiet fold whose plus turns into a cross, opening the add form right here (downloaded on first open). */}
            {/* Saving a task folds it away again and says where the task went, right here, since the new row lands up in the list. */}
            <Fold
              className="mt-xs"
              title="Add a task"
              adds
              open={addOpen}
              onOpenChange={(o) => {
                setAddOpen(o);
                if (o) setAdded(null);
              }}
            >
              <Suspense fallback={<Skeleton className="h-[240px]" />}>
                <AddTaskForm
                  today={date}
                  autoFocus
                  onAdded={(title, doDate) => {
                    setAddOpen(false);
                    setAdded(!doDate || doDate === date ? `Added “${title}” to today's tasks.` : `Added “${title}”. It shows here from ${dayLabel(doDate)}.`);
                  }}
                />
              </Suspense>
            </Fold>
            {added && (
              <p role="status" className="mt-xs m-0 text-subhead text-ink-soft">
                {added}
              </p>
            )}
            {remembered.length > 0 && (
              <div role="group" className="mt-md" aria-labelledby="remember-heading">
                <div className="flex items-baseline justify-between gap-sm">
                  <h3 id="remember-heading" className="text-headline">
                    To remember
                  </h3>
                  <span className="text-subhead text-ink-soft">{remembered.length}</span>
                </div>
                <p className="mt-xs m-0 text-caption text-ink-soft">Pick a day to move one into Tasks, with an inbox note.</p>
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {remembered.map((t) => (
                    <BacklogTask key={t.id} t={t} date={date} queue={queue} />
                  ))}
                </ul>
              </div>
            )}
            {waiting > 0 && (
              <Fold className="mt-md" title="Not scheduled yet" hint={String(waiting)}>
                <p className="mt-xs m-0 text-subhead text-ink-soft">Pick a do date or a due date to move one into Tasks.</p>
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {backlog.map((t) => (
                    <BacklogTask key={t.id} t={t} date={date} queue={queue} />
                  ))}
                </ul>
                {waiting > backlog.length && <p className="mt-xs m-0 text-caption text-ink-soft">Showing {backlog.length} of {waiting}. Pillars lists the rest.</p>}
              </Fold>
            )}
            {done.length > 0 && (
              <div role="group" className="mt-md" aria-labelledby="done-heading">
                <div className="flex items-baseline justify-between gap-sm">
                  <h3 id="done-heading" className="text-headline">
                    Done today
                  </h3>
                  <span className="text-subhead text-ink-soft">{done.length}</span>
                </div>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  <AnimatePresence initial={false}>
                    {done.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        today={date}
                        subtitle={t.completedAt ? `Done at ${doneAt(t.completedAt)}` : undefined}
                        busy={queue.isPending(t.id)}
                        hint={queue.hint(t.id)}
                        onToggle={() => untick(t.id)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
                <p className="mt-xs m-0 text-caption text-ink-soft">
                  Tap one to untick it; that takes back its xp. Earlier days are on each pillar in{' '}
                  <Link to="/tower" className="underline underline-offset-4 hover:text-ink">
                    Pillars
                  </Link>
                  .
                </p>
              </div>
            )}
          </section>

          {data.agency && <AgencyToday agency={data.agency} />}
          <TodayEvents events={data.events ?? []} />

          <NotToDoBlock />
          <HabitsSlot app="today" />
          <EmergenceSlot app="today" max={2} exclude={['habit-tie']} />
        </>
      )}

      {/* Under the day, so it waits for it: shown before /today answers, the whole day would land above it and push it away. */}
      {identity && !isPending && (
        <section className="mt-lg" aria-labelledby="evo-heading">
          <h2 id="evo-heading" className="text-title2">
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
            <p className="mt-sm m-0 text-center text-subhead text-ink-soft">
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
