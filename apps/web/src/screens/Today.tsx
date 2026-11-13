import { LIFE_AREA_ORDER, LIFE_AREAS, RELATIONSHIP_BY_KEY, TASK_SORTS, matchesTaskTags, parseTaskTags, taskTagOn, taskTagsKey, toggleTaskTag, type TaskTagCut, TASK_TAB_SORTS, TASK_TABS, addDays, formatCount, openDay, isTaskSort, parseLifeArea, parseTaskTab, sortTasks, taskTabOf, taskTabSort, type LifeAreaKey, type Node, type TaskTab } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { WATER_LANE } from '../lib/ui';
import { ON_FILL, pillarTick } from '../lib/relFill';
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
import { Segmented } from '../components/fx/Segmented';
import { DailyTask } from '../components/DailyTask';
import { DailyHiddenLine, DailyViewButton, DailyViewPanel, useDailyView } from '../components/DailyView';
import { Pager, usePage } from '../components/Pager';
import { useActionQueue } from '../lib/useActionQueue';
import { useParamState, writeParams } from '../lib/useParamState';
import { DayTemplateSelect, DayTypeNote, useDayTemplate } from '../components/DayTypePicker';
import { FilterSelect } from '../components/FilterSelect';
import { TagChips } from '../components/TagChips';
import { TagFilterHint } from '../components/TagFilterHint';
import { TagFilterContext, tagChips, tagSentence, type TagChip, type TagFilter } from '../lib/taskTagFilter';
import { sayStatus } from '../lib/sayStatus';
import { focusHeadingAfter } from '../lib/focusHeading';

/** Daily's Area filter: every area, one of the five in their one order, or tasks with no area. Kept in the URL as `area`. */
type AreaPick = '' | LifeAreaKey | 'none';
const AREA_PICKS: readonly { key: AreaPick; label: string }[] = [{ key: '', label: 'Every area' }, ...LIFE_AREA_ORDER.map((k) => ({ key: k as AreaPick, label: LIFE_AREAS[k].name })), { key: 'none', label: 'No area' }];
const readArea = (raw: string): AreaPick => (raw.trim().toLowerCase() === 'none' ? 'none' : (parseLifeArea(raw) ?? ''));
const inArea = (pick: AreaPick) => (t: Node) => (pick === '' ? true : pick === 'none' ? !t.lifeArea : t.lifeArea === pick);
/**
 * Daily's views in the Sort by row: every sort, then Unfinished business (2026-11-07, the founder: "could just be a filter like the others
 * with three group colors like time blocks"), which lists only the tasks marked with a kind, in three coloured boxes. Kept in the URL as
 * `taskSort=open`, like the rest.
 */
const VIEWS: readonly { key: string; label: string }[] = [...TASK_SORTS.map((s) => ({ key: s.key, label: s.name })), { key: 'open', label: 'Bottlenecks' }];
/** The sorts that draw Daily's coloured boxes. */
const isGrouped = (s: string): s is 'block' | 'area' => s === 'block' || s === 'area';
const outline = 'toy toy-ink btn-outline inline-flex min-h-[36px] md:min-h-[44px] tap-pad items-center justify-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-sm text-subhead font-semibold leading-none text-ink select-none';


// The month calendar downloads only when its toggle is opened.
const TaskMonth = lazyNamed(() => import('../components/TaskMonth'), 'TaskMonth');
const AddTaskForm = lazyNamed(() => import('../components/TaskMonth'), 'AddTaskForm');
// A task's plan form downloads the first time a plan is opened, so the whole form stays out of the first download (BacklogTask's; DailyTask
// keeps its own in components/DailyTask.tsx).
const TaskPanel = lazyNamed(() => import('../components/TaskPlan'), 'TaskPanel');
// The grouped view (By time block, By area) and its block hints load only when a grouped sort is picked.
const TaskGroups = lazyNamed(() => import('../components/TaskGroups'), 'TaskGroups');
// Supplements (2026-11-07): its own small chunk, downloaded only for someone with Fitness on.
const SupplementsToday = lazyNamed(() => import('../components/SupplementsToday'), 'SupplementsToday');
// Close the unfinished (2026-11-07): the Unfinished business view (its boxes, its empty line and what was let go), with the other boxes.
const OpenBusinessView = lazyNamed(() => import('../components/TaskGroups'), 'OpenBusinessView');
// Done today, paged (2026-11-07): its own small chunk, after the first paint.
const DoneToday = lazyNamed(() => import('../components/DoneToday'), 'DoneToday');
// Hidden tasks (2026-11-12): the last fold of Tasks, downloaded only while a task is hidden on the day.
const HiddenTasks = lazyNamed(() => import('../components/HiddenTasks'), 'HiddenTasks');
// The Past due and Upcoming tabs (2026-11-12): their paged lists download the first time either tab is picked.
const TaskTabList = lazyNamed(() => import('../components/TaskTabList'), 'TaskTabList');

/**
 * "8 more waiting": the open tasks past the ones Daily shows, read only once the fold opens (`GET /today/waiting`, in the server's order,
 * a page at a time, prefix `w`), each the same row as the main list.
 */
function MoreWaiting({ date, area, tags = '', open = '', tab = '', group, ask, sort, context, queue, onToggle, focusTask }: { date: string; area: string; /** The tags tapped (`taskTagsKey`), sent like the area. */ tags?: string; /** 'today' on the Today tab, so the rest are today's too; '' in the Bottlenecks view. */ tab?: TaskTab | ''; /** The Unfinished business view's cut ('any'), sent like the area. */ open?: string; group: boolean; /** The sort the person picked, sent so the server's halves follow it ('' for its default). */ ask: string; sort: Parameters<typeof sortTasks>[1]; context: Parameters<typeof sortTasks>[2]; queue: ReturnType<typeof useActionQueue>; onToggle: (id: string) => void; focusTask: string | null }) {
  const pg = usePage('w');
  const q = useAuthed([...keys.today(date), 'waiting', area, tags, group, ask, open, tab, pg.query], () => api.todayWaiting(date, area, group, pg.query, ask, open, tab, tags));
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
          <div className="row-lane mt-xs flex flex-wrap items-center gap-xs" role="group" aria-label={`Pick a day for ${t.title}`}>
            <button type="button" onClick={() => pick.mutate(date)} className="toy toy-soft min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium">
              Today
            </button>
            <button type="button" onClick={() => pick.mutate(addDays(date, 1))} className="toy toy-soft min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium">
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
  const [areaRaw, setAreaOnly] = useParamState('area', '');
  // A new area, sort or tab starts the paged lists under it (more waiting, done today, let go, past due, upcoming) on their first page.
  const [, setParams] = useSearchParams();
  const firstPages = () => writeParams(setParams, { wpage: null, dpage: null, lgpage: null, pdpage: null, ucpage: null });
  const setAreaRaw = (k: string) => {
    setAreaOnly(k);
    firstPages();
  };
  const area = readArea(areaRaw);
  // Tap a tag to filter (2026-11-13, the founder: "apply click for those tags and make filters from them"; he chose: filter this list): a
  // task's pillar, priority, Remember, For review, Habit, From pillar, From your coach, kind of open business and time block, kept in the URL
  // as `tags` (one fixed order, `taskTagsKey`), combined with each other and with the Area filter. The server cuts every list and count the
  // same way it cuts by Area; the chips above the list say what is on and take each off.
  const [tagsRaw, setTagsOnly] = useParamState('tags', '');
  const tagCut = parseTaskTags(tagsRaw);
  const tagsKey = taskTagsKey(tagCut);
  const tagsOn = tagsKey !== '';
  const setTagCut = (next: TaskTagCut) => {
    setTagsOnly(taskTagsKey(next));
    firstPages();
  };
  // The sort picks the grouped view (By time block, By area), which reads the longer list the boxes need.
  const [sortRaw, setSortOnly] = useParamState('taskSort', '');
  // Past due keeps its own order in its own key (`pdSort`, 2026-11-12), so a sort picked there never changes the Today tab's, and a grouped
  // view picked on Today never reads as Day there.
  const [pdSortRaw, setPdSortOnly] = useParamState('pdSort', '');
  const ownSort = isTaskSort(sortRaw) ? sortRaw : null;
  // Unfinished business (2026-11-07) is one more view in the same row: only the tasks with a kind, in their three boxes. The server cuts
  // the lists to them (`open=any`) and reads the longer list the boxes need, like By time block.
  const openView = sortRaw === 'open';
  const openPick = openView ? 'any' : '';
  // Blocks have no filter of their own (the founder, 2026-11-06): By time block draws them as boxes that fold, and an old `?block=` is
  // ignored. A block comes back only as a tapped tag (2026-11-13, `tags=block:<id>`, from a task's block or its time).
  // The picked sort goes to the server too, so the six shown are the top six of it and "N more waiting" starts where they end.
  // Today, Past due and Upcoming (2026-11-12, the founder), kept in the URL as `taskTab`. The Bottlenecks view stands apart: it lists every
  // open bottleneck, so while it is on there are no tabs and nothing is cut by one. The day's own read is always the Today tab's.
  const [tabRaw, setTabOnly] = useParamState('taskTab', 'today');
  const tab: TaskTab = openView ? 'today' : parseTaskTab(tabRaw);
  const pickTab = (k: TaskTab) => {
    setTabOnly(k);
    firstPages();
  };
  const setSort = (k: string) => {
    if (tab === 'pastdue') setPdSortOnly(k);
    else setSortOnly(k);
    firstPages();
  };
  const { date, data, isPending, isError, refetch } = useToday(area, { group: openView || (tab === 'today' && ownSort !== null && isGrouped(ownSort)), sort: tab === 'today' ? (ownSort ?? '') : '', open: openPick, tab: openView ? '' : 'today', tags: tagsKey });
  // View (2026-11-12): the sections the person hid, kept on the account; a link to one still shows it for the visit.
  const view = useDailyView();
  const [viewOpen, setViewOpen] = useState(false);
  const viewPanelId = useId();
  const viewButton = useRef<HTMLButtonElement>(null);
  const undatedRemember = useUndatedRemember();
  const me = useMe();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const queue = useActionQueue(refresh);
  const [search] = useSearchParams();
  const focusTask = search.get('task');
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  // Plan my week opens from the Past due tab, where the late tasks are its first line worth a look.
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
  // A tick by mistake (2026-11-13, the frictionless pass): the ticked row leaves the list, so one quiet line under it says what was ticked,
  // with Undo, for about ten seconds or until the next tick, as Inbox's "Archived. Undo" does. Focus moves to Undo, since the row went.
  const [lastTick, setLastTick] = useState<{ id: string; title: string } | null>(null);
  const undoTickBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!lastTick) return;
    undoTickBtn.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => setLastTick(null), 10_000);
    return () => window.clearTimeout(t);
  }, [lastTick]);
  const tick = (id: string) =>
    queue.run(id, async () => {
      setLastTick(null);
      const r = await api.complete(id, date);
      setLastTick({ id, title: r.node.title });
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
  const byArea = inArea(area);
  const keep = (t: Node) => byArea(t) && matchesTaskTags(t, tagCut, slots) && (!openView || Boolean(t.openKind));
  // The answer on screen was cut to this area and these tags by the server (or none is picked), so its counts and an empty list can be trusted.
  const cutHere = (data?.area ?? '') === area && (data?.open ?? '') === openPick && (data?.tags ?? '') === tagsKey;
  const allTasks = data?.tasks ?? [];
  const tasks = sortTasks(allTasks.filter(keep), openView ? 'priority' : sort, context);
  const backlogAll = sortTasks((data?.backlog ?? []).filter(keep), sort === 'day' ? 'priority' : sort, context);
  // Things tagged Remember with no day: kept in plain sight, not folded away.
  const remembered = backlogAll.filter((t) => t.remind);
  const backlog = backlogAll.filter((t) => !t.remind);
  // The server's total is for the picked area once it cut the lists to it; an older answer can only count what is here.
  const waiting = cutHere ? Math.max(0, (data?.backlogTotal ?? 0) - remembered.length) : backlog.length;
  const doneFirst = data?.done ?? [];
  // The filter shows once a task here carries an area, or one is picked (a link from Life), so nobody meets an empty control.
  // The server says so for every task (`areasUsed`); the lists here are only a fallback, since they are cut short.
  const showArea = area !== '' || (data?.areasUsed ?? [...allTasks, ...(data?.backlog ?? []), ...(data?.done ?? [])].some((t) => t.lifeArea));
  // Daily lists six open tasks. When they were not cut to the area, more for it may be waiting past them, so the empty line says so.
  const areaCapped = !cutHere && allTasks.length >= (grouped ? 60 : 6);
  // Water and reminders links to To remember while a task tagged Remember has no day; the heading stays when the filter hides them all.
  const rememberHidden = (area !== '' || tagsOn) && remembered.length === 0 && undatedRemember;
  const areaName = area === 'none' ? 'with no area' : area ? `for ${LIFE_AREAS[area].name}` : '';
  // The true count (2026-11-06): the server counts every open task whose day has come under the same cuts, and how many are late; an
  // older answer for another area can only count what is here.
  const totalWaiting = cutHere ? Math.max(tasks.length, data?.tasksTotal ?? tasks.length) : tasks.length;
  // The three tabs' counts come with the day (one count read on the server), under the same Area cut; an older answer shows the names alone.
  const tabCount: Record<TaskTab, number | undefined> = cutHere ? { today: data?.todayTotal, pastdue: data?.pastDueTotal, upcoming: data?.upcomingTotal } : { today: undefined, pastdue: undefined, upcoming: undefined };
  const tabOptions = TASK_TABS.map((t) => ({ value: t.key, label: tabCount[t.key] === undefined ? t.name : `${t.name} (${formatCount(tabCount[t.key]!)})` }));
  const elsewhere = (tabCount.pastdue ?? 0) + (tabCount.upcoming ?? 0);
  const showTabs = !openView && Boolean(data) && (data?.todayTotal !== undefined || tab !== 'today');
  // The Sort row follows the tab: every sort and Bottlenecks on Today, the day, priority and due date on Past due, none on Upcoming.
  const sortItems = tab === 'today' ? VIEWS : TASK_SORTS.filter((s) => TASK_TAB_SORTS[tab].includes(s.key)).map((s) => ({ key: s.key, label: s.name }));
  const tabSort = taskTabSort(tab, tab === 'pastdue' ? pdSortRaw : '');
  const showSort = tab === 'today' ? allTasks.length > 1 || (data?.backlog.length ?? 0) > 1 || grouped !== null || openView : tab === 'pastdue' && (tabCount.pastdue ?? 2) > 1;
  // A Remember note opens Daily on its task (`?task=<id>`). When that task is not among today's six, its own day says which tab holds it.
  const focusOffList = Boolean(focusTask) && Boolean(data) && cutHere && !openView && !tasks.some((t) => t.id === focusTask);
  const focusNode = useAuthed(['node', focusTask], () => api.node(focusTask!), focusOffList && tabRaw === 'today');
  const focusTab = focusNode.data ? taskTabOf(focusNode.data.node, date) : null;
  useEffect(() => {
    if (focusTab && focusTab !== 'today' && focusNode.data?.node.status === 'active') setTabOnly(focusTab);
  }, [focusTab, focusNode.data, setTabOnly]);
  const restWaiting = totalWaiting - tasks.length;
  // Clears the Area filter and every tag (both writes go out as one, `writeParams`).
  const clearFilters = () => {
    setAreaOnly('');
    setTagsOnly('');
    firstPages();
  };
  const filtersOn = area !== '' || tagsOn;
  // The chips above the list, and the filter every task row in it reads (lib/taskTagFilter.ts): a tag tapped turns its filter on, or off
  // when it is on, and the status line says what the list shows now. An area tag sets the Area filter itself.
  const blockName = (id: string) => blocks.find((b) => b.id === id)?.name;
  const chips = tagChips(tagCut, area, blockName);
  const toggleTag = (token: string) => {
    if (token.startsWith('area:')) {
      const k = token.slice(5);
      const next = area === k ? '' : k;
      setAreaRaw(next);
      sayStatus(next ? tagSentence(tagChips(tagCut, next, blockName)) : 'Filter removed.');
      return;
    }
    const was = taskTagOn(tagCut, token);
    const next = toggleTaskTag(tagCut, token);
    setTagCut(next);
    sayStatus(was ? 'Filter removed.' : tagSentence(tagChips(next, area, blockName)));
  };
  const removeChip = (c: TagChip) => {
    toggleTag(c.token);
  };
  const tagFilter: TagFilter = { on: (token) => (token.startsWith('area:') ? area === token.slice(5) : taskTagOn(tagCut, token)), toggle: toggleTag, slots, pillar: true, time: true };
  // A block tag whose block has gone (a link kept from before it was deleted) is dropped from the address once the day's blocks are in.
  const staleBlock = Boolean(data && tagCut.block && !data.day.blocks.some((b) => b.id === tagCut.block));
  useEffect(() => {
    if (staleBlock) setTagsOnly(taskTagsKey({ ...tagCut, block: null }));
  }, [staleBlock]); // eslint-disable-line react-hooks/exhaustive-deps
  // The Unfinished business view: its boxes hold every task with a kind whose day has come, and those with no day yet (which the server
  // sent as the backlog under the same cut), so Not scheduled yet and To remember stand aside while it is on, never listing one twice.
  const openTasks = openView ? sortTasks([...tasks, ...backlogAll.filter((t) => !openDay(t))], 'priority', context) : [];
  const openCount = cutHere ? Math.max(openTasks.length, (data?.tasksTotal ?? 0) + (data?.backlogTotal ?? 0)) : openTasks.length;
  const taskDone = Boolean(data && data.doneRecently > 0);
  const doneCount = data ? Number(data.checkedIn) + Number(data.spark.done) + Number(taskDone) : 0;
  const identity = me.data?.identity ?? null;

  // The streak pill opens the Leaderboard only while the person has it on (it is on for everyone unless switched off).
  const lb = useModule('leaderboard');
  const fitnessOn = useModule('fitness')?.on ?? false;
  const leaderboardOn = Boolean(lb?.available && lb.on);
  return (
    // How it works comes in with the day: drawn under the loading cards, it would be pushed down when the day lands.
    // From the laptop width the Water bubble (ReminderBubble, fixed at the bottom left, 16px past the sidebar, up to 10rem wide) keeps a
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
                className="toy toy-soft inline-flex min-h-[36px] md:min-h-[44px] tap-pad shrink-0 items-center gap-xs rounded-pill bg-card px-sm py-0 md:py-xs text-subhead font-medium text-ink no-underline shadow-toy-soft"
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
                      {/* Raised above the row's stretched label, so the link is its own tap and not a tick. */}
                      <Link to="/rewards" className="relative z-[1] underline underline-offset-4">
                        See rewards
                      </Link>
                    </>
                  ) : (
                    '+10 xp and +10 points. Fifty bonus points every seventh day in a row.'
                  )
                }
                color="var(--color-r4)"
                deep="var(--deep-lover_partner)"
                text={ON_FILL}
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
                {...pillarTick(rel)}
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
                title and its count alone on the first line, the kind of day on the next at full width, then the two buttons half each. View
                (2026-11-12) is a round button at the end of the buttons' row, keeping its own size everywhere, so the rest of the layout is as it
                was; its panel opens in place under the heading. */}
            <div className="@container">
              <div className="flex flex-wrap items-baseline gap-x-sm gap-y-sm">
                <h2 id="tasks-heading" className="text-title2">
                  Tasks
                </h2>
                {openView ? (
                  openCount > 0 && <span className="text-subhead text-ink-soft @min-[41rem]:mr-lg">{openTasks.length < openCount ? `${openTasks.length} of ${openCount} open` : `${openCount} open`}</span>
                ) : (
                  // The tabs carry the counts (2026-11-12, the founder: "remove the other 7 past due"), so the title stands alone; only a
                  // list longer than the six it shows says so here.
                  tab === 'today' && restWaiting > 0 && <span className="text-subhead text-ink-soft @min-[41rem]:mr-lg">{`${tasks.length} of ${formatCount(totalWaiting)} shown`}</span>
                )}
                <div className="contents @min-[41rem]:ml-auto @min-[41rem]:flex @min-[41rem]:min-w-0 @min-[41rem]:max-w-[640px] @min-[41rem]:flex-[1_1_36rem] @min-[41rem]:flex-nowrap @min-[41rem]:items-center @min-[41rem]:gap-sm">
                  <div className="min-w-0 basis-full @min-[30rem]:flex-[1_1_160px] @min-[41rem]:flex-1 @min-[41rem]:basis-auto">
                    <DayTemplateSelect templates={tpl.templates} blocks={tpl.blocks} picked={tpl.picked} follow={tpl.follow} onPick={tpl.set} />
                  </div>
                  <div className="flex min-w-0 basis-full items-center gap-sm *:flex-1 @min-[41rem]:flex-none @min-[41rem]:basis-auto @min-[41rem]:*:flex-none">
                    <Link to="/time-blocks" className={outline}>
                      Time blocks
                    </Link>
                    <WeekPlanButton openOn={lateOpen} />
                    {/* View (2026-11-12): an eye at the end of the group, opening its switches in place under the heading. */}
                    <DailyViewButton ref={viewButton} open={viewOpen} onToggle={() => setViewOpen((o) => !o)} controls={viewPanelId} hidden={view.hiddenCount} />
                  </div>
                </div>
              </div>
            </div>
            {viewOpen ? <DailyViewPanel id={viewPanelId} state={view} onClose={() => setViewOpen(false)} button={viewButton} /> : <DailyHiddenLine state={view} />}
            {/* One line (2026-11-12, the founder): the tabs at the left, then Area and Sort as two dropdowns at the right, Sort after Area
                ("instead of sort by call it sort and make it right aligned to area dropdown in same line"). Where the line is too short for all
                three, the two dropdowns move to the next line together, still at the right; under a 34rem column each takes the full width,
                the tabs in equal parts and the dropdowns one per line with their labels lined up. The Bottlenecks view (a choice in Sort)
                stands apart from the tabs. There is no Block dropdown: By time block draws the blocks as boxes that fold (the founder, 2026-11-06); a
                block filters only as a tapped tag (2026-11-13). */}
            {(showTabs || showArea || showSort) && (
              <div className="@container mt-sm">
                <div className="flex flex-col gap-xs @min-[34rem]:flex-row @min-[34rem]:flex-wrap @min-[34rem]:items-center @min-[34rem]:gap-x-md @min-[34rem]:gap-y-sm">
                  {showTabs && <Segmented<TaskTab> label="Which tasks" value={tab} onChange={pickTab} options={tabOptions} className="@max-[34rem]:grid! @max-[34rem]:w-full @max-[34rem]:grid-flow-col @max-[34rem]:auto-cols-fr @max-[34rem]:[&>button]:px-xs!" />}
                  {(showArea || showSort) && (
                    <div role="group" aria-label="Filter and sort tasks" className="flex min-w-0 flex-col gap-xs @min-[34rem]:ml-auto @min-[34rem]:flex-row @min-[34rem]:items-center @min-[34rem]:gap-md">
                      {showArea && (
                        <div className="min-w-0 @min-[34rem]:w-[200px] @min-[34rem]:flex-none">
                          <FilterSelect label="Area" value={area} items={AREA_PICKS} onChange={(k) => setAreaRaw(k)} />
                        </div>
                      )}
                      {showSort && (
                        <div className="min-w-0 @min-[34rem]:w-[200px] @min-[34rem]:flex-none">
                          <FilterSelect label="Sort" value={openView ? 'open' : tab === 'today' ? sort : tabSort} items={sortItems} onChange={setSort} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* What is on (2026-11-13): the Area filter and every tag tapped on a task, each a chip that takes it off, with Clear filters for two or more. */}
            {filtersOn && <TagChips chips={chips} onRemove={removeChip} onClear={() => { clearFilters(); sayStatus('Filters cleared. Showing every task.'); }} heading="tasks-heading" />}
            {/* The Unfinished view is a filter, not a sort (its boxes go by priority), so the note says only the kind of day while it is on. */}
            <DayTypeNote template={tpl.template} contextual={!openView && tab === 'today' && tpl.contextual} failed={tpl.failed} ownSort={!openView && tab === 'today' && ownSort && ownSort !== 'context' ? (TASK_SORTS.find((s) => s.key === ownSort)?.name.replace(/^By /, '').toLowerCase() ?? null) : null} />
            {/* The controls above (kind of day, sort, the note) end here: a wider gap before the day's own content. */}
            {view.shows('month') && (
              <Fold id="month-calendar" className="mt-md" title="Month calendar">
                <Suspense fallback={<Skeleton className="h-[320px]" />}>
                  <TaskMonth today={date} />
                </Suspense>
              </Fold>
            )}
            {/* Your day (the time plan and the blocks) belongs to the Today tab; View can hide it. */}
            {(tab === 'today' || openView) && view.shows('yourDay') && (
              <div>
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
              </div>
            )}
            {/* Every task row from here to Done today filters by its tags when one is tapped (lib/taskTagFilter.ts); Hidden tasks below stays whole. */}
            <TagFilterContext.Provider value={tagFilter}>
            <TagFilterHint />
            {openView ? (
              <Suspense fallback={<SkeletonList count={3} lines={2} label="Loading the groups" />}>
                <OpenBusinessView tasks={openTasks} context={{ ...context, day: date }} more={Boolean(data.tasksMore) && !(cutHere && restWaiting > 0)} areaName={areaName} letGoTotal={data.letGoTotal ?? 0} renderTask={(t, below) => <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} onToggle={() => tick(t.id)} below={below} />} />
              </Suspense>
            ) : tab !== 'today' ? (
              <Suspense fallback={<SkeletonList className="mt-sm" count={3} lines={2} label="Loading the tasks" />}>
                <TaskTabList tab={tab} date={date} area={area} tags={tagsKey} areaName={areaName} sort={tabSort} queue={queue} onToggle={tick} focusTask={focusTask} onClearArea={clearFilters} onPlanWeek={() => setLateOpen((n) => n + 1)} />
              </Suspense>
            ) : grouped && dayPlan && tasks.length > 0 ? (
              <Suspense fallback={<SkeletonList count={3} lines={2} label="Loading the groups" />}>
                <TaskGroups tasks={tasks} context={{ ...context, slotPlannedMin: dayPlan.slotPlannedMin, day: date }} by={grouped} more={Boolean(data.tasksMore) && !(cutHere && restWaiting > 0)} renderTask={(t, below) => <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} onToggle={() => tick(t.id)} below={below} />} />
              </Suspense>
            ) : tasks.length > 0 ? (
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                <AnimatePresence initial={false}>
                  {tasks.map((t) => (
                    <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} onToggle={() => tick(t.id)} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : filtersOn ? (
              <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card border-2 border-dashed border-line p-md">
                <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">
                  {tagsOn
                    ? areaCapped
                      ? `None of the first ${allTasks.length} tasks match these filters. More may be waiting.`
                      : 'No tasks match these filters today.'
                    : areaCapped
                    ? area === 'none'
                      ? `Each of the first ${allTasks.length} tasks has an area. More may be waiting.`
                      : `None of the first ${allTasks.length} tasks are ${areaName}. More may be waiting.`
                    : `No tasks ${areaName} today.`}
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  {tagsOn ? 'Clear filters' : 'Show every area'}
                </Button>
              </div>
            ) : elsewhere > 0 ? (
              // Nothing is set for today, but tasks wait on another tab: the way there, not the pillars.
              <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card border-2 border-dashed border-line p-md">
                <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">{taskDone ? 'Tasks done for today. Their pyramids got stronger.' : 'Nothing is set for today.'}</p>
                <Button variant="outline" onClick={() => pickTab((tabCount.pastdue ?? 0) > 0 ? 'pastdue' : 'upcoming')}>
                  {(tabCount.pastdue ?? 0) > 0 ? 'See past due' : 'See upcoming'}
                </Button>
              </div>
            ) : (
              <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card border-2 border-dashed border-line p-md">
                <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">
                  {taskDone ? 'Tasks done for today. Their pyramids got stronger. More arrive as their dates come up.' : 'Tasks come from pillars you set up.'}
                </p>
                <Link to="/tower" className="toy inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
                  {taskDone ? 'Set up another pillar' : 'Set up a pillar'}
                </Link>
              </div>
            )}
            {/* The rest of what waits past the ones shown, in a fold that reads them only once opened. */}
            {(tab === 'today' || openView) && cutHere && restWaiting > 0 && tasks.length > 0 && (
              // A Remember note opens Daily on its task (`?task=<id>`): when that task is not among the ones shown, this opens on it.
              <Fold className="mt-xs" title={`${restWaiting} more waiting`} defaultOpen={Boolean(focusTask) && !tasks.some((t) => t.id === focusTask)}>
                <MoreWaiting date={date} area={area} tags={tagsKey} open={openPick} tab={openView ? '' : 'today'} group={grouped !== null || openView} ask={grouped !== null || openView ? '' : (ownSort ?? '')} sort={openView ? 'priority' : sort} context={context} queue={queue} onToggle={tick} focusTask={focusTask} />
              </Fold>
            )}
            {/* The task just ticked, offered back; always in the tree so a reader hears it. */}
            <div role="status" className={lastTick ? 'mt-xs flex flex-wrap items-center gap-xs text-subhead text-ink-soft' : 'sr-only'}>
              {lastTick && (
                <>
                  <span className="min-w-0">Ticked “{lastTick.title}”.</span>
                  <button
                    ref={undoTickBtn}
                    type="button"
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center font-semibold text-ink underline underline-offset-4"
                    onClick={() => {
                      untick(lastTick.id);
                      setLastTick(null);
                      focusHeadingAfter('tasks-heading');
                    }}
                  >
                    Undo
                  </button>
                </>
              )}
            </div>
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
            {!openView && view.shows('remember') && rememberHidden && (
              <div role="group" className="mt-md" aria-labelledby="remember-heading">
                <h3 id="remember-heading" className="text-headline">
                  To remember
                </h3>
                <div className="mt-xs flex flex-wrap-reverse items-center justify-between gap-sm">
                  <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">{tagsOn ? 'None match these filters.' : `None ${areaName}.`}</p>
                  <Button variant="outline" onClick={clearFilters}>
                    {tagsOn ? 'Clear filters' : 'Show every area'}
                  </Button>
                </div>
              </div>
            )}
            {!openView && view.shows('remember') && remembered.length > 0 && (
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
            {!openView && view.shows('backlog') && waiting > 0 && (
              // Right under the tasks' own folds (Add a task) it keeps their 8px; after To remember's list it takes a section's 16px, as
              // To remember and Done today do, so it never reads as a row of that list.
              <Fold id="backlog-heading" className={view.shows('remember') && (remembered.length > 0 || rememberHidden) ? 'mt-md' : 'mt-xs'} title="Not scheduled yet" hint={String(waiting)}>
                <p className="mt-xs m-0 text-subhead text-ink-soft">Pick a do date or a due date to move one into Tasks.</p>
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {backlog.map((t) => (
                    <BacklogTask key={t.id} t={t} date={date} queue={queue} />
                  ))}
                </ul>
                {waiting > backlog.length && <p className="mt-xs m-0 text-caption text-ink-soft">Showing {backlog.length} of {waiting}. Pillars lists the rest.</p>}
              </Fold>
            )}
            {view.shows('done') && (
              <Suspense fallback={null}>
                <DoneToday date={date} first={doneFirst} total={data.doneTotal ?? doneFirst.length} queue={queue} onUntick={untick} keep={keep} area={area} tags={tagsKey} open={openPick} />
              </Suspense>
            )}
            </TagFilterContext.Provider>
            {/* Hidden tasks (2026-11-12, the founder): at the bottom of Tasks, after Done today, closed, its count beside it; whole, so the Area
                filter and Bottlenecks never cut it. A tick there pays and counts like any. Shown only while one is hidden. */}
            {(data.hiddenTotal ?? 0) > 0 && (
              <Suspense fallback={null}>
                <HiddenTasks
                  date={date}
                  total={data.hiddenTotal ?? 0}
                  queue={queue}
                  onToggle={tick}
                  focusTask={focusTask}
                  // Like Not scheduled yet (2026-11-13): 8px under Tasks' own folds (Add a task, Not scheduled yet, Done today), a section's
                  // 16px only right after To remember's list, so it never reads as a row of that list.
                  className={!(view.shows('done') && (data.doneTotal ?? doneFirst.length) > 0) && !(!openView && view.shows('backlog') && waiting > 0) && !openView && view.shows('remember') && (remembered.length > 0 || rememberHidden) ? 'mt-md' : 'mt-xs'}
                />
              </Suspense>
            )}
          </section>

          {data.agency && <AgencyToday agency={data.agency} />}
          <TodayEvents events={data.events ?? []} />

          {view.shows('notToDo') && <NotToDoBlock />}
          {view.shows('habits') && <HabitsSlot app="today" tasks={[...allTasks, ...(data.backlog ?? []), ...(data.done ?? [])]} />}
          {fitnessOn && (
            <Suspense fallback={null}>
              <SupplementsToday date={date} />
            </Suspense>
          )}
          {view.shows('patterns') && (
            <>
              <KindsSlot />
              <EmergenceSlot app="today" max={2} exclude={['habit-tie', 'daytype-done']} />
            </>
          )}
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
