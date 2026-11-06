import { LIFE_AREA_ORDER, LIFE_AREAS, RELATIONSHIP_BY_KEY, TASK_SORTS, addDays, groupTasks, openDay, isTaskSort, parseLifeArea, sortTasks, type LifeAreaKey, type Node, LOCALE } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Link, useSearchParams } from 'react-router';
import { useModule } from '../lib/modules';
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
import { EmergenceSlot, HabitsSlot, KindsSlot } from '../components/EmergenceSlot';
import { Nudge } from '../components/Nudge';
import { Person } from '../components/Person';
import { RoutineSection } from '../components/RoutineSection';
import { Screen } from '../components/Screen';
import { Skeleton, SkeletonList } from '../components/Skeleton';
import { RemindersSection, useUndatedRemember } from '../components/Reminders';
import { TaskRow } from '../components/TaskRow';
import { WeekPlanButton } from '../components/WeekPlan';
import { api } from '../lib/api';
import { dayLabel, prettyDate } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { keys, useAuthed, useMe, useRefreshAll, useToday } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { useActionQueue } from '../lib/useActionQueue';
import { useParamState } from '../lib/useParamState';
import { DayTemplateSelect, DayTypeNote, useDayTemplate } from '../components/DayTypePicker';
import { TaskGroups } from '../components/TaskGroups';
import { TabRow } from '../components/TabRow';
import { FilterSelect } from '../components/FilterSelect';

/** Daily's Area filter: every area, one of the five in their one order, or tasks with no area. Kept in the URL as `area`. */
type AreaPick = '' | LifeAreaKey | 'none';
const AREA_PICKS: readonly { key: AreaPick; label: string }[] = [{ key: '', label: 'Every area' }, ...LIFE_AREA_ORDER.map((k) => ({ key: k as AreaPick, label: LIFE_AREAS[k].name })), { key: 'none', label: 'No area' }];
const readArea = (raw: string): AreaPick => (raw.trim().toLowerCase() === 'none' ? 'none' : (parseLifeArea(raw) ?? ''));
const inArea = (pick: AreaPick) => (t: Node) => (pick === '' ? true : pick === 'none' ? !t.lifeArea : t.lifeArea === pick);
/** The sorts that draw Daily's coloured boxes. */
const isGrouped = (s: string): s is 'block' | 'area' => s === 'block' || s === 'area';
const outline = 'toy toy-ink btn-outline inline-flex min-h-[44px] items-center justify-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-sm text-subhead font-semibold leading-none text-ink select-none';

/**
 * Room for the Water bubble at the bottom left (see Today's Screen): the bubble's right edge (16px past the sidebar plus up to 10rem)
 * and an 8px gap, less the column's own left gap (32px, and from the laptop width half of what the window has past the 1072px frame).
 */
const WATER_LANE = 'md:[&>*]:ml-[max(0px,calc(10rem_-_var(--spacing-xs)_-_max(0px,(100vw_-_1040px_-_var(--spacing-lg))_/_2)))]';

// The month calendar downloads only when its toggle is opened.
const TaskMonth = lazyNamed(() => import('../components/TaskMonth'), 'TaskMonth');
const AddTaskForm = lazyNamed(() => import('../components/TaskMonth'), 'AddTaskForm');
// A task's plan form downloads the first time a plan is opened, so the whole form stays out of the first download.
const TaskPanel = lazyNamed(() => import('../components/TaskPlan'), 'TaskPanel');

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
            <Suspense fallback={<Skeleton className="mt-xs h-[240px]" />}>
              <TaskPanel task={t} today={date} />
            </Suspense>
          </div>
        ) : null
      }
    />
  );
}

/**
 * "8 more waiting": the open tasks past the ones Daily shows, read only once the fold opens (`GET /today/waiting`, in the server's order,
 * a page at a time, prefix `w`), each the same row as the main list.
 */
function MoreWaiting({ date, area, group, ask, sort, context, queue, onToggle, focusTask }: { date: string; area: string; group: boolean; /** The sort the person picked, sent so the server's halves follow it ('' for its default). */ ask: string; sort: Parameters<typeof sortTasks>[1]; context: Parameters<typeof sortTasks>[2]; queue: ReturnType<typeof useActionQueue>; onToggle: (id: string) => void; focusTask: string | null }) {
  const pg = usePage('w');
  const q = useAuthed([...keys.today(date), 'waiting', area, group, ask, pg.query], () => api.todayWaiting(date, area, group, pg.query, ask));
  if (q.isPending) return <SkeletonList count={2} lines={2} label="Loading the rest" />;
  if (q.isError || !q.data)
    return (
      <p role="alert" className="m-0 text-subhead">
        Could not load the rest. Try again.
      </p>
    );
  const rows = sortTasks(q.data.tasks, sort, context);
  return (
    <>
      <ul className="flex list-none flex-col gap-xs p-0 m-0">
        {rows.map((t) => (
          <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} onToggle={() => onToggle(t.id)} />
        ))}
      </ul>
      <Pager page={q.data.page} prefix="w" label="tasks" />
    </>
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
              <Suspense fallback={<Skeleton className="mt-xs h-[240px]" />}>
                <TaskPanel task={t} today={date} />
              </Suspense>
            </div>
          )}
        </>
      }
    />
  );
}

export function Today() {
  // The Area filter (from the Life app's "Tasks for this area" too, `?area=physical`). The server cuts the six, the backlog and its
  // count to the area, so a task past the first six still shows; the lists are filtered on the device as well, for the moment an
  // older answer is still on screen.
  const [areaRaw, setAreaRaw] = useParamState('area', '');
  const area = readArea(areaRaw);
  // The sort picks the grouped view (By time block, By area), which reads the longer list the boxes need.
  const [sortRaw, setSort] = useParamState('taskSort', '');
  const ownSort = isTaskSort(sortRaw) ? sortRaw : null;
  // Blocks are not a filter (the founder, 2026-11-06): By time block draws them as boxes that fold, and an old `?block=` is ignored.
  // The picked sort goes to the server too, so the six shown are the top six of it and "N more waiting" starts where they end.
  const { date, data, isPending, isError, refetch } = useToday(area, { group: ownSort !== null && isGrouped(ownSort), sort: ownSort ?? '' });
  const undatedRemember = useUndatedRemember();
  const me = useMe();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const queue = useActionQueue(refresh);
  const [search] = useSearchParams();
  const focusTask = search.get('task');
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  // "2 late" opens Plan my week, where the late tasks are its first line worth a look.
  const [lateOpen, setLateOpen] = useState(0);

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
  // The kind of day is the day's template (docs/time-blocks.md). When the day was changed on purpose (a date change, or a weekday whose
  // template is not the default) and no sort is chosen, the list sorts By context: P0 first, then the template's lead pillar inside each
  // priority. A sort in the URL still wins. The block and area sorts draw the coloured boxes.
  const dayPlan = data?.day;
  const tpl = useDayTemplate(date, dayPlan);
  const sort = ownSort ?? (tpl.contextual ? 'context' : 'day');
  const slots = dayPlan?.slots ?? [];
  const blocks = dayPlan?.blocks ?? [];
  const lead = tpl.template?.lead ?? 'servant_leader';
  const context = { lead, second: tpl.template?.second ?? null, slots, blocks };
  const grouped = isGrouped(sort) ? sort : null;
  const sorts = TASK_SORTS;
  const keep = inArea(area);
  // The answer on screen was cut to this area by the server (or none is picked), so its counts and an empty list can be trusted.
  const cutHere = (data?.area ?? '') === area;
  const allTasks = data?.tasks ?? [];
  const tasks = sortTasks(allTasks.filter(keep), sort, context);
  const backlogAll = sortTasks((data?.backlog ?? []).filter(keep), sort === 'day' ? 'priority' : sort, context);
  // Things tagged Remember with no day: kept in plain sight, not folded away.
  const remembered = backlogAll.filter((t) => t.remind);
  const backlog = backlogAll.filter((t) => !t.remind);
  // The server's total is for the picked area once it cut the lists to it; an older answer can only count what is here.
  const waiting = cutHere ? Math.max(0, (data?.backlogTotal ?? 0) - remembered.length) : backlog.length;
  const done = (data?.done ?? []).filter(keep);
  // The filter shows once a task here carries an area, or one is picked (a link from Life), so nobody meets an empty control.
  // The server says so for every task (`areasUsed`); the lists here are only a fallback, since they are cut short.
  const showArea = area !== '' || (data?.areasUsed ?? [...allTasks, ...(data?.backlog ?? []), ...(data?.done ?? [])].some((t) => t.lifeArea));
  // Daily lists six open tasks. When they were not cut to the area, more for it may be waiting past them, so the empty line says so.
  const areaCapped = !cutHere && allTasks.length >= (grouped ? 60 : 6);
  // Water and reminders links to To remember while a task tagged Remember has no day; the heading stays when the filter hides them all.
  const rememberHidden = area !== '' && remembered.length === 0 && undatedRemember;
  const areaName = area === 'none' ? 'with no area' : area ? `for ${LIFE_AREAS[area].name}` : '';
  const groups = grouped && dayPlan ? groupTasks(tasks, grouped, context) : null;
  // The true count (2026-11-06): the server counts every open task whose day has come under the same cuts, and how many are late; an
  // older answer for another area can only count what is here.
  const totalWaiting = cutHere ? Math.max(tasks.length, data?.tasksTotal ?? tasks.length) : tasks.length;
  const lateWaiting = cutHere ? (data?.tasksLate ?? 0) : 0;
  const restWaiting = totalWaiting - tasks.length;
  const clearFilters = () => setAreaRaw('');
  const doneAt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' }) : '');
  const taskDone = Boolean(data && data.doneRecently > 0);
  const doneCount = data ? Number(data.checkedIn) + Number(data.spark.done) + Number(taskDone) : 0;
  const identity = me.data?.identity ?? null;

  // The streak pill opens the Leaderboard only while the person has it on (it is on for everyone unless switched off).
  const lb = useModule('leaderboard');
  const leaderboardOn = Boolean(lb?.available && lb.on);
  return (
    // How it works comes in with the day: drawn under the loading cards, it would be pushed down when the day lands.
    // From the tablet width the Water bubble (ReminderBubble, fixed at the bottom left, 16px past the sidebar, up to 10rem wide) keeps a
    // lane of its own: the column moves right only by as much as the bubble would reach into it, so no line ever sits under it (at 1280
    // it covered the start of "Your day"). Where the page's own gutter is wide enough (about 1376px and up) nothing moves.
    <Screen columns={false} howTo={!isPending} className={WATER_LANE}>
      <header className="pt-lg">
        <p className="m-0 text-subhead text-ink-soft">{prettyDate(date)}</p>
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-large-title">Daily</h1>
          {/* The streak opens the Leaderboard ranked by streak (the founder, 2026-11-06); the same pill, now a link with the toy press and
              44px to tap. Without the Leaderboard on, it stays a plain pill. */}
          {data &&
            (leaderboardOn ? (
              <Link
                to="/leaderboard?by=streak"
                aria-label={`Streak: ${data.streak} ${data.streak === 1 ? 'day' : 'days'}. See where you rank`}
                className="toy toy-soft inline-flex min-h-[44px] shrink-0 items-center gap-xs rounded-pill bg-card px-sm py-xs text-subhead font-medium text-ink no-underline shadow-toy-soft"
              >
                <Icon icon={Flame} size={16} />
                <span>
                  <RollNumber value={data.streak} /> {data.streak === 1 ? 'day' : 'days'}
                </span>
              </Link>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-xs rounded-pill bg-card px-sm py-xs text-subhead font-medium shadow-toy-soft">
                <Icon icon={Flame} size={16} />
                <span>
                  <RollNumber value={data.streak} /> {data.streak === 1 ? 'day' : 'days'}
                </span>
              </span>
            ))}
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
            {/* The title and its count at the left; the kind of day, Time blocks and Plan my week are one group that always moves together
                (the founder, 2026-11-06), sized by the room the section has (a container query, so the sidebar folding counts): from 41rem the
                group sits at the right, on the title's line with at least an `lg` gap after the count whenever 32rem is left there (the
                founder: right aligned, a space in between), else on the next line, still at the right; it grows to 640px, the dropdown up to
                about 280px, and only a long name is shortened when the line is tight; from 30rem to 41rem (a narrow laptop column)
                the title, its count and the kind of day share the first line and the two buttons half each under it; under 30rem (a phone) the
                title and its count alone on the first line, the kind of day on the next at full width, then the two buttons half each. */}
            <div className="@container">
              <div className="flex flex-wrap items-baseline gap-x-sm gap-y-sm">
                <h2 id="tasks-heading" className="text-title2">
                  Tasks
                </h2>
                {totalWaiting > 0 && (
                  <span className="text-subhead text-ink-soft @min-[41rem]:mr-lg">
                    {restWaiting > 0 ? `${tasks.length} of ${totalWaiting} waiting` : `${totalWaiting} waiting`}
                    {lateWaiting > 0 && (
                      <>
                        ,{' '}
                        <button
                          type="button"
                          onClick={() => setLateOpen((n) => n + 1)}
                          aria-label={`${lateWaiting} late. Open Plan my week`}
                          className="relative whitespace-nowrap underline underline-offset-4 hover:text-ink after:absolute after:left-1/2 after:top-1/2 after:h-[44px] after:w-[max(100%,44px)] after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
                        >
                          {lateWaiting} late
                        </button>
                      </>
                    )}
                  </span>
                )}
                <div className="contents @min-[41rem]:ml-auto @min-[41rem]:flex @min-[41rem]:min-w-0 @min-[41rem]:max-w-[640px] @min-[41rem]:flex-[1_1_32rem] @min-[41rem]:flex-nowrap @min-[41rem]:items-center @min-[41rem]:gap-sm">
                  <div className="min-w-0 basis-full @min-[30rem]:flex-[1_1_160px] @min-[41rem]:flex-1 @min-[41rem]:basis-auto">
                    <DayTemplateSelect templates={tpl.templates} blocks={tpl.blocks} picked={tpl.picked} follow={tpl.follow} onPick={tpl.set} />
                  </div>
                  <div className="flex min-w-0 basis-full items-center gap-sm *:flex-1 @min-[41rem]:flex-none @min-[41rem]:basis-auto @min-[41rem]:*:flex-none">
                    <Link to="/time-blocks" className={outline}>
                      Time blocks
                    </Link>
                    <WeekPlanButton openOn={lateOpen} />
                  </div>
                </div>
              </div>
            </div>
            {/* The Area filter and the sort share one line from the laptop width up; the sort keeps 420px or wraps onto a line of its own.
                There is no Block filter: By time block draws the blocks as boxes that fold (the founder, 2026-11-06). */}
            <div className="mt-sm flex w-full flex-col gap-xs lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-md">
              {showArea && (
                <div className="min-w-0 lg:w-[200px] lg:flex-none">
                  <FilterSelect label="Area" value={area} items={AREA_PICKS} onChange={(k) => setAreaRaw(k)} />
                </div>
              )}
              {(allTasks.length > 1 || (data?.backlog.length ?? 0) > 1 || grouped) && (
                <div className="min-w-0 flex-1 lg:min-w-[420px]">
                  <TabRow lead="Sort by" align="end" label="Sort tasks by" items={sorts.map((s) => ({ key: s.key, label: s.name }))} value={sort} onChange={setSort} />
                </div>
              )}
            </div>
            <DayTypeNote template={tpl.template} contextual={tpl.contextual} failed={tpl.failed} ownSort={ownSort && ownSort !== 'context' ? (TASK_SORTS.find((s) => s.key === ownSort)?.name.replace(/^By /, '').toLowerCase() ?? null) : null} />
            {/* The controls above (kind of day, sort, the note) end here: a wider gap before the day's own content. */}
            <Fold className="mt-md" title="Month calendar">
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
            <DayBlocks tasks={tasks.filter((t) => openDay(t) === date)} day={dayPlan} loose={data?.looseTasks} looseTotal={data?.looseTotal} />
            {groups && tasks.length > 0 ? (
              <TaskGroups groups={groups} by={grouped!} more={Boolean(data.tasksMore) && !(cutHere && restWaiting > 0)} renderTask={(t) => <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} onToggle={() => tick(t.id)} />} />
            ) : tasks.length > 0 ? (
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                <AnimatePresence initial={false}>
                  {tasks.map((t) => (
                    <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} onToggle={() => tick(t.id)} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : area ? (
              <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card border-2 border-dashed border-line p-md">
                <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">
                  {areaCapped
                    ? area === 'none'
                      ? `Each of the first ${allTasks.length} tasks has an area. More may be waiting.`
                      : `None of the first ${allTasks.length} tasks are ${areaName}. More may be waiting.`
                    : `No tasks ${areaName} today.`}
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Show every area
                </Button>
              </div>
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
            {/* The rest of what waits past the ones shown, in a fold that reads them only once opened. */}
            {cutHere && restWaiting > 0 && tasks.length > 0 && (
              <Fold className="mt-xs" title={`${restWaiting} more waiting`}>
                <MoreWaiting date={date} area={area} group={grouped !== null} ask={grouped !== null ? '' : (ownSort ?? '')} sort={sort} context={context} queue={queue} onToggle={tick} focusTask={focusTask} />
              </Fold>
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
            {rememberHidden && (
              <div role="group" className="mt-md" aria-labelledby="remember-heading">
                <h3 id="remember-heading" className="text-headline">
                  To remember
                </h3>
                <div className="mt-xs flex flex-wrap-reverse items-center justify-between gap-sm">
                  <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">None {areaName}.</p>
                  <Button variant="outline" onClick={clearFilters}>
                    Show every area
                  </Button>
                </div>
              </div>
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
          <HabitsSlot app="today" tasks={[...allTasks, ...(data.backlog ?? []), ...(data.done ?? [])]} />
          <KindsSlot />
          <EmergenceSlot app="today" max={2} exclude={['habit-tie', 'daytype-done']} />
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
