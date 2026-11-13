import { usePillarAccent } from '../lib/usePillarAccent';
import { HeroBlobs, PILLAR_FLOWER } from '../components/Hero';
import {
  CHARACTER_STAGES,
  evolutionFor,
  isRelationshipKey,
  KIND_META,
  KINDS,
  levelProgress,
  mondayOf,
  parentKind,
  RELATIONSHIP_BY_KEY,
  type Node,
  type NodeKind,
  type RelationshipKey,
} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { BackLink } from '../components/PageHeader';
import { PaceTag } from '../components/PaceTag';
import { StatusTag } from '../components/StatusTag';
import { Pyramid } from '../components/Pyramid';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Skeleton } from '../components/Skeleton';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { ErrorLine } from '../components/ErrorLine';
import { TaskRow } from '../components/TaskRow';
import { HideTask, ProjectSelect, StartFocus, Subtasks, TaskEndings, TaskPlanFields, planBody, planOf, planProblem, type Plan } from '../components/TaskPlan';
import { api } from '../lib/api';
import { FIELD } from '../lib/ui';
import { dayLabel, localDateTimeValue, todayLocal } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { fillVar, ON_FILL } from '../lib/relFill';
import { useAuthed, useMe, useNodes, useRefreshAll } from '../lib/queries';
import { placementLine } from '../components/LifeMap';
import { Link } from 'react-router';
import { useActionQueue } from '../lib/useActionQueue';
import { Icon } from '../components/Icon';
import { Check } from 'lucide-react';
import { Fold } from '../components/Fold';
import { EmergenceSlot } from '../components/EmergenceSlot';
import { Pager, usePage } from '../components/Pager';
import { SkeletonList } from '../components/Skeleton';
import { DONE_PAGE_SIZE, DONE_PAGE_SIZES, HIDDEN_ALWAYS, matchesTaskTags, parseLifeArea, parseTaskTags, taskHiddenOn, taskTagOn, taskTagsKey, toggleTaskTag, type Node as TaskNode } from '@kreators/shared';
import { TagChips } from '../components/TagChips';
import { TagFilterHint } from '../components/TagFilterHint';
import { TagFilterContext, tagChips, tagSentence, type TagFilter } from '../lib/taskTagFilter';
import { useParamState } from '../lib/useParamState';
import { sayStatus } from '../lib/sayStatus';
import { useTimeBlocks } from '../lib/useTimeBlocks';
import { HiddenFoot } from '../components/HiddenTasks';
import { dialogOpen } from '../lib/useDialogFocus';
import { focusHeading } from '../lib/focusHeading';
import { useTapTwice } from '../lib/useTapTwice';

// The same form as "Add a task" on Daily, downloaded the first time the fold opens.
const AddTaskForm = lazyNamed(() => import('../components/TaskMonth'), 'AddTaskForm');

/** The layers above the tasks, top down like the pyramid: the foundation first, projects last. */
const RUNGS = KINDS.filter((k) => k !== 'task');

export function Realm() {
  const { key } = useParams();
  if (!isRelationshipKey(key)) return <Navigate to="/tower" replace />;
  return <RealmView key={key} relationship={key} />;
}

/** Done tasks are paged (2026-11-07): 10, 25 or 50, ten by default, prefix `dn`. */
const DONE_PAGES = { sizes: DONE_PAGE_SIZES, fallback: DONE_PAGE_SIZE };

/** A pillar's done tasks, a page at a time from GET /nodes/done; the count beside the fold stays the pillar's true count. */
function DoneTasks({ relationship, today, queue, onToggle, onEdit }: { relationship: RelationshipKey; today: string; queue: ReturnType<typeof useActionQueue>; onToggle: (n: TaskNode) => void; onEdit: (n: TaskNode) => void }) {
  const pg = usePage('dn', DONE_PAGES);
  const q = useAuthed(['nodes', relationship, 'done', pg.query], () => api.nodesDone(relationship, pg.query));
  if (q.isPending) return <SkeletonList className="border-t border-line p-sm" count={2} lines={1} label="Loading done tasks" />;
  if (q.isError || !q.data)
    return (
      <p role="alert" className="m-0 border-t border-line p-sm text-subhead">
        Could not load the done tasks. Try again.
      </p>
    );
  return (
    <div className="border-t border-line p-sm">
      <ul className="flex list-none flex-col gap-xs p-0 m-0">
        <AnimatePresence initial={false}>
          {q.data.tasks.map((n) => (
            <TaskRow key={n.id} task={n} today={today} pillarTag={false} busy={queue.isPending(n.id)} hint={queue.hint(n.id)} onToggle={() => onToggle(n)} onEdit={() => onEdit(n)} />
          ))}
        </AnimatePresence>
      </ul>
      <Pager page={q.data.page} prefix="dn" label="done tasks" only={DONE_PAGES} />
    </div>
  );
}

function RealmView({ relationship }: { relationship: RelationshipKey }) {
  usePillarAccent(relationship);
  const rel = RELATIONSHIP_BY_KEY[relationship];
  const me = useMe();
  const nodesQ = useNodes(relationship);
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const today = todayLocal();
  const [adding, setAdding] = useState<NodeKind | null>(null);
  const [editing, setEditing] = useState<Node | null>(null);
  // Opened from a project's "Add a due day" line: the edit sheet starts in its due day field.
  const [focusDue, setFocusDue] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // "Add a task" opens in place, like Daily's; an Emerging card's "Add a task to …" (`?add=1`) lands with it open.
  const [params] = useSearchParams();
  const [addOpen, setAddOpen] = useState(params.get('add') === '1');
  const [added, setAdded] = useState<string | null>(null);
  const fail = (e: unknown) => setNotice(e instanceof Error ? e.message : 'That did not work. Try again.');

  const state = me.data?.relationships.find((r) => r.key === relationship);
  const sess = useAuthed(['session', today], () => api.session(today));
  const placement = sess.data?.assessment?.placements.find((p) => p.relationship === relationship) ?? null;
  const nodes = nodesQ.data?.nodes ?? [];
  const byKind = (k: NodeKind) => nodes.filter((n) => n.kind === k);
  const built = nodes.some((n) => n.kind === 'pillar');
  const lp = levelProgress(state?.xp ?? 0);
  const evo = evolutionFor(CHARACTER_STAGES, state?.xp ?? 0, state?.floorAgeDays ?? 0);
  // Hidden tasks (2026-11-13, the founder's yes): one hidden on the person's own day leaves Tasks to do for the Hidden fold under it, Until
  // tomorrow first. Cut here on the screen, since GET /nodes is the whole pyramid (the layers' counts and a project's pace count every task).
  const openTasks = byKind('task').filter((n) => n.status === 'active');
  const shownTasks = openTasks.filter((n) => !taskHiddenOn(n.hiddenUntil, today));
  // Tap a tag to filter Tasks to do (2026-11-13, as on Daily): kept in the URL as `tags` and `area`, cut here on the screen like the hidden
  // ones (GET /nodes is the whole pyramid). No pillar tag (every task is this pillar's) and no time chip (no day plan here); a block tag is
  // the block picked. Done tasks and the Hidden fold stay whole.
  const [tagsRaw, setTagsRaw] = useParamState('tags', '');
  const [areaRaw, setAreaRaw] = useParamState('area', '');
  const tagCut = parseTaskTags(tagsRaw);
  const tagArea = areaRaw === 'none' ? 'none' : (parseLifeArea(areaRaw) ?? '');
  const filtersOn = tagArea !== '' || taskTagsKey(tagCut) !== '';
  const weekBlocks = useTimeBlocks(mondayOf(today), Boolean(tagCut.block));
  const blockName = (id: string) => weekBlocks.data?.blocks.find((b) => b.id === id)?.name;
  const chips = tagChips(tagCut, tagArea, blockName);
  const toggleTag = (token: string) => {
    if (token.startsWith('area:')) {
      const next = tagArea === token.slice(5) ? '' : token.slice(5);
      setAreaRaw(next);
      sayStatus(next ? tagSentence(tagChips(tagCut, next, blockName)) : 'Filter removed.');
      return;
    }
    const was = taskTagOn(tagCut, token);
    const next = toggleTaskTag(tagCut, token);
    setTagsRaw(taskTagsKey(next));
    sayStatus(was ? 'Filter removed.' : tagSentence(tagChips(next, tagArea, blockName)));
  };
  const clearFilters = () => {
    setTagsRaw('');
    setAreaRaw('');
  };
  const tagFilter: TagFilter = { on: (token) => (token.startsWith('area:') ? tagArea === token.slice(5) : taskTagOn(tagCut, token)), toggle: toggleTag, slots: [], pillar: false, time: false };
  const activeTasks = shownTasks.filter((n) => (tagArea === '' || (tagArea === 'none' ? !n.lifeArea : n.lifeArea === tagArea)) && matchesTaskTags(n, tagCut));
  const hiddenTasks = openTasks.filter((n) => taskHiddenOn(n.hiddenUntil, today)).sort((a, b) => Number(a.hiddenUntil === HIDDEN_ALWAYS) - Number(b.hiddenUntil === HIDDEN_ALWAYS));
  const doneTasks = byKind('task').filter((n) => n.status === 'done');
  const projects = byKind('project').filter((n) => n.status === 'active');
  // The latest tasks, read once the edit sheet has closed (below).
  const latest = useRef(nodes);
  latest.current = nodes;
  /**
   * A hide or an unhide from the edit sheet moves the row between Tasks to do and the closed Hidden fold, so the sheet's opener is gone and
   * focus would fall to the page. Each frame until the closing sheet has left (it keeps focus while it animates out), and only when focus
   * then fell to the page, it goes to the Hidden fold's toggle (the task is hidden now) or to Tasks to do's heading. Never moves the page.
   */
  const landAfterEdit = (id: string) => {
    const until = performance.now() + 2000;
    const go = () => {
      const now = document.activeElement;
      const fell = !now || now === document.body;
      if (!fell) {
        // Still in the sheet on its way out: look again. Anywhere else, someone put it there on purpose.
        if ((dialogOpen() || now.closest('[role="dialog"]')) && performance.now() < until) requestAnimationFrame(go);
        return;
      }
      const n = latest.current.find((x) => x.id === id);
      const fold = document.querySelector<HTMLButtonElement>('#pillar-hidden-tasks > button[aria-expanded]');
      if (n && n.status === 'active' && taskHiddenOn(n.hiddenUntil, todayLocal()) && fold) fold.focus({ preventScroll: true });
      else focusHeading('do-heading', { preventScroll: true });
    };
    requestAnimationFrame(go);
  };

  const queue = useActionQueue(refresh);
  const toggle = (n: Node) =>
    queue.run(n.id, async () => {
      if (n.status === 'done') {
        await api.uncomplete(n.id);
        return;
      }
      const r = await api.complete(n.id, todayLocal());
      celebrate({
        title: r.capped ? 'Done. Daily xp limit reached, so this one was for you' : 'Ripple',
        totalXp: r.totalXp,
        ripple: r.ripple,
        newBadges: r.newBadges,
        projectCleared: r.projectCleared,
        color: rel.color,
      });
    });
  const acceptQuest = useMutation({
    mutationFn: () => api.acceptQuest(relationship, today),
    onError: fail,
    onSuccess: () => {
      refresh();
      celebrate({ title: `${rel.character} is awake`, color: rel.color });
    },
  });

  return (
    <>
      {/* A calm wash instead of a flat block: the pillar's colour with a soft light at the top left, deepening toward the bottom. */}
      <div className="relative overflow-hidden rounded-b-card" style={{ background: `radial-gradient(70% 55% at 12% 0%, rgba(255, 255, 255, 0.22), transparent 70%), linear-gradient(165deg, ${fillVar(rel)}, color-mix(in oklab, ${fillVar(rel)} 62%, var(--fill-shade)))`, color: ON_FILL }}>
        <HeroBlobs kind={PILLAR_FLOWER[relationship]} />
        {/* The same column as Screen below it (its widths and the sidebar's --nav-w), so the title, the guide's line and the tasks share
            one left edge, the sidebar open or folded. */}
        <div className="safe-top relative mx-auto w-full max-w-[480px] px-md pb-lg pt-md md:ml-[var(--nav-w)] md:w-auto md:max-w-[1040px] md:px-lg lg:mx-auto lg:max-w-[calc(1040px+var(--spacing-lg))] lg:pl-[calc(var(--nav-w)+var(--spacing-lg))]">
          {/* On a phone the brand and the corner buttons float over the top 56px, so the way back starts below them. */}
          <div className="pt-xl md:pt-0">
            <BackLink to="/tower" inherit>
              Pillars
            </BackLink>
          </div>
          <p className="mt-sm m-0 text-subhead font-semibold">
            Pillar {rel.floor} of 7, {rel.character}, your {rel.role}
          </p>
          <h1 className="text-large-title">{rel.name}</h1>
          <div className="mt-md">
            <EvolutionReveal
              now={<Avatar relationship={relationship} size={88} mood={built ? 'happy' : 'sleepy'} stage={evo.stage.stage} decorative />}
              nowName={evo.stage.name}
              next={evo.next ? <Avatar relationship={relationship} size={88} stage={evo.next.stage} still decorative /> : null}
              nextName={evo.next?.name ?? null}
              charge={evo.charge}
              preparing={evo.preparing}
              readyInDays={evo.readyInDays}
            />
          </div>
          <p className="mt-sm m-0 text-center text-subhead font-semibold">
            Level {lp.level}, {state?.xp ?? 0} xp.{' '}
            {evo.preparing && evo.next
              ? `${evo.next.name} evolves in ${evo.readyInDays} ${evo.readyInDays === 1 ? 'day' : 'days'}.`
              : evo.next
                ? `${evo.xpToNext} xp until ${evo.next.name}.`
                : 'Final form.'}
          </p>
          <p className="mt-md m-0 rounded-card rounded-tl-[8px] bg-card p-md text-callout text-ink">{rel.greeting}</p>
          {placement && (
            <p className="mt-sm m-0 text-subhead font-semibold">
              {placementLine(placement)}{' '}
              <Link to="/tower#life-map" className="underline underline-offset-4">
                See the map
              </Link>
            </p>
          )}
        </div>
      </div>

      <Screen>
        {notice && (
          <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {notice}
          </p>
        )}

        {!nodesQ.isPending && !built && (
          <section className="mt-lg" aria-labelledby="build-heading">
            <h2 id="build-heading" className="text-title2">
              Set up this pillar
            </h2>
            <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft" style={{ backgroundImage: `linear-gradient(145deg, color-mix(in oklab, ${rel.color} 16%, transparent), transparent 65%)` }}>
              <p className="m-0 text-callout">
                {rel.character} built a pyramid from your answers: the foundation you picked, then a guiding principle, a value goal, a goal outcome, a project and three tasks. One tap and they show up on Daily.
              </p>
              <Button variant="color" color={fillVar(rel)} deep={`var(--deep-${rel.key})`} full className="mt-md" style={{ color: ON_FILL }} onClick={() => acceptQuest.mutate()} disabled={acceptQuest.isPending}>
                Set up {rel.character}&rsquo;s pyramid
              </Button>
              <Button variant="ghost" full className="mt-xs" onClick={() => setAdding('pillar')}>
                Or start by hand with a foundation
              </Button>
            </div>
          </section>
        )}

        {built && (
          <>
            <section className="mt-lg" aria-labelledby="do-heading">
              <h2 id="do-heading" className="text-title2">
                Tasks to do
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Tick the box when you have done it. The whole pyramid gets stronger.</p>
              {filtersOn && <TagChips chips={chips} onRemove={(c) => toggleTag(c.token)} onClear={() => { clearFilters(); sayStatus('Filters cleared. Showing every task.'); }} heading="do-heading" />}
              {activeTasks.length > 0 ? (
                <TagFilterContext.Provider value={tagFilter}>
                <TagFilterHint />
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  <AnimatePresence initial={false}>
                    {activeTasks.map((n) => {
                      const project = nodes.find((p) => p.id === n.parentId);
                      return (
                        <TaskRow
                          key={n.id}
                          task={n}
                          today={today}
                          subtitle={project ? `Project: ${project.title}` : undefined}
                          pillarTag={false}
                          busy={queue.isPending(n.id)}
                          hint={queue.hint(n.id)}
                          onToggle={() => toggle(n)}
                          onEdit={() => setEditing(n)}
                        />
                      );
                    })}
                  </AnimatePresence>
                </ul>
                </TagFilterContext.Provider>
              ) : filtersOn && shownTasks.length > 0 ? (
                <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card border-2 border-dashed border-line p-md">
                  <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">No tasks match these filters.</p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <p className="mt-sm m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft shadow-toy-soft">{hiddenTasks.length > 0 ? `Nothing waiting. ${hiddenTasks.length} hidden below.` : 'Nothing waiting. Add one below.'}</p>
              )}
              {/* A fold whose plus turns into a cross, opening the form right here (the founder's layout pass, 2026-11-06): this pillar's own
                  projects, so a task never lands on another pillar by accident. Saving folds it again and says where the task went. */}
              {projects.length > 0 ? (
                <Fold
                  className="mt-sm"
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
                      today={today}
                      projects={projects}
                      autoFocus
                      note="No do date? It waits in Not scheduled yet on Daily. A new task can be ticked after ten minutes."
                      onAdded={(title, doDate) => {
                        setAddOpen(false);
                        setAdded(!doDate ? `Added “${title}”. It waits in Not scheduled yet on Daily.` : doDate === today ? `Added “${title}” to today's tasks.` : `Added “${title}”. It shows on Daily from ${dayLabel(doDate)}.`);
                      }}
                    />
                  </Suspense>
                </Fold>
              ) : (
                <p className="mt-sm m-0 text-subhead text-ink-soft">Tasks need a project. Open the pyramid below to add one.</p>
              )}
              {added && (
                <p role="status" className="mt-xs m-0 text-subhead text-ink-soft">
                  {added}
                </p>
              )}
              {/* Hidden (2026-11-13): the last fold of Tasks to do, closed, its count beside it, shown only while a task is hidden today. Each
                  is the ordinary row (a tick pays and counts, the edit sheet one tap away) with Daily's own foot: its state and Unhide. */}
              {hiddenTasks.length > 0 && (
                <Fold id="pillar-hidden-tasks" className={projects.length > 0 ? 'mt-xs' : 'mt-sm'} title="Hidden" hint={String(hiddenTasks.length)}>
                  <p className="m-0 text-caption text-ink-soft">Out of your lists, with no reminders. A tick still counts.</p>
                  <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                    <AnimatePresence initial={false}>
                      {hiddenTasks.map((n) => {
                        const project = nodes.find((p) => p.id === n.parentId);
                        return (
                          <TaskRow
                            key={n.id}
                            task={n}
                            today={today}
                            subtitle={project ? `Project: ${project.title}` : undefined}
                            pillarTag={false}
                            busy={queue.isPending(n.id)}
                            hint={queue.hint(n.id)}
                            onToggle={() => toggle(n)}
                            onEdit={() => setEditing(n)}
                            panel={<HiddenFoot task={n} date={today} back="in Tasks to do" place={{ fold: 'pillar-hidden-tasks', heading: 'do-heading' }} />}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </Fold>
              )}
            </section>

            <section className="mt-lg" aria-labelledby="ladder-heading">
              <h2 id="ladder-heading" className="text-title2">
                The pyramid
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">
                Five layers lead down to the tasks. Open a layer to see what is there, change it, or add to it.
              </p>
              <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                <Pyramid
                  relationship={relationship}
                  compact
                  words={Object.fromEntries(KINDS.map((k) => [k, (k === 'task' ? shownTasks[0] : byKind(k).find((n) => n.status === 'active'))?.title ?? (k === 'task' ? 'Your next task' : 'Nothing here yet')]))}
                />
              </div>
              <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {RUNGS.map((kind) => {
                  const meta = KIND_META[kind];
                  const items = byKind(kind).filter((n) => n.status !== 'archived');
                  const parent = parentKind(kind);
                  const parents = parent ? byKind(parent).filter((n) => n.status === 'active') : [];
                  const locked = parent !== null && parents.length === 0;
                  const summary = items.length > 0 ? items.map((n) => n.title).join(', ') : locked && parent ? `Unlocks after your first ${KIND_META[parent].label.toLowerCase()}` : 'Nothing yet';
                  return (
                    <li key={kind}>
                      <Fold
                        // The fold's own row is the card's face (no 8px frame of card round a second tile), so a layer reads as one box.
                        className="rounded-tile bg-card shadow-toy-soft"
                        title={
                          <span className="flex items-center gap-sm py-xs">
                            <span
                              className="flex size-[32px] shrink-0 items-center justify-center rounded-pill text-subhead font-medium"
                              style={locked ? { background: 'var(--color-line)', color: 'var(--color-ink-soft)' } : { background: fillVar(rel), color: ON_FILL }}
                              aria-hidden="true"
                            >
                              {meta.rung}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-card-title">
                                {meta.plural}
                                {items.length > 0 && <span className="text-ink-mute"> {items.length}</span>}
                              </span>
                              <span className="block truncate text-card-note text-ink-soft">{summary}</span>
                            </span>
                          </span>
                        }
                      >
                        <div className="border-t border-line p-sm">
                          <p className="m-0 text-subhead text-ink-soft">{meta.hint}</p>
                          {items.length > 0 && (
                            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                              {items.map((n) => {
                                const parentNode = nodes.find((p) => p.id === n.parentId);
                                return (
                                  <li key={n.id}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        setFocusDue(n.kind === 'project' && e.target instanceof Element && e.target.closest('[data-due-hint]') !== null);
                                        setEditing(n);
                                      }}
                                      className="toy toy-flat flex w-full items-center gap-sm rounded-tile bg-paper p-sm text-left"
                                    >
                                      <span className="w-[6px] self-stretch rounded-pill" style={{ background: n.status === 'done' ? rel.deep : rel.color }} aria-hidden="true" />
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-card-title">
                                          {n.title}
                                          {n.status === 'done' && <span className="text-ink-mute"> (cleared)</span>}
                                        </span>
                                        {parentNode && <span className="block truncate text-card-note text-ink-soft">Holds up: {parentNode.title}</span>}
                                        {n.kind === 'project' && n.status === 'active' && (
                                          <span className="block" data-due-hint={n.dueDate ? undefined : ''}>
                                            <PaceTag
                                              created={n.createdAt}
                                              dueDate={n.dueDate}
                                              done={byKind('task').filter((t) => t.parentId === n.id && t.status === 'done').length}
                                              total={byKind('task').filter((t) => t.parentId === n.id && t.status !== 'archived').length}
                                              today={today}
                                              hint
                                            />
                                          </span>
                                        )}
                                      </span>
                                      <StatusTag tone="warn">{`${n.xp} xp`}</StatusTag>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          <Button variant="outline" className="mt-sm" onClick={() => setAdding(kind)} disabled={locked}>
                            Add {meta.label.toLowerCase()}
                          </Button>
                        </div>
                      </Fold>
                    </li>
                  );
                })}
                {doneTasks.length > 0 && (
                  <li>
                    <Fold
                      className="rounded-tile bg-card shadow-toy-soft"
                      defaultOpen={params.has('dnpage') || params.has('dnsize')}
                      title={
                        <span className="flex items-center gap-sm py-xs">
                          <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-r4 text-on-fill" aria-hidden="true">
                            <Icon icon={Check} size={16} strokeWidth={3} />
                          </span>
                          <span className="min-w-0 flex-1 text-headline">Done tasks {doneTasks.length}</span>
                        </span>
                      }
                    >
                      <DoneTasks relationship={relationship} today={today} queue={queue} onToggle={toggle} onEdit={setEditing} />
                    </Fold>
                  </li>
                )}
              </ol>
            </section>
          </>
        )}
        <EmergenceSlot app="pillar" rel={relationship} max={2} />
      </Screen>

      <AddSheet kind={adding} relationship={relationship} nodes={nodes} onClose={() => setAdding(null)} />
      <EditSheet
        node={editing}
        focusDue={focusDue}
        onClose={() => {
          if (editing) landAfterEdit(editing.id);
          setEditing(null);
          setFocusDue(false);
        }}
      />
    </>
  );
}

/** A new layer of the pyramid, in a sheet. A task has its own form, in place under Tasks to do. */
function AddSheet({ kind, relationship, nodes, onClose }: { kind: NodeKind | null; relationship: RelationshipKey; nodes: Node[]; onClose: () => void }) {
  const refresh = useRefreshAll({ insights: true });
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const meta = kind ? KIND_META[kind] : null;
  const parent = kind ? parentKind(kind) : null;
  const parents = parent ? nodes.filter((n) => n.kind === parent && n.status === 'active') : [];

  useEffect(() => {
    setTitle('');
    setParentId(parents[0]?.id ?? '');
    // Reset the form each time a rung's add button opens the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const create = useMutation({
    mutationFn: () => {
      if (!kind) throw new Error('no kind');
      return api.createNode({ kind, parentId: parent ? parentId : null, relationship, title: title.trim() });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  return (
    <Sheet open={kind !== null} onClose={onClose} title={meta ? `New ${meta.label.toLowerCase()}` : ''}>
      {meta && (
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate();
          }}
        >
          <label className="block">
            <span className="block text-subhead">{meta.hint}</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder={meta.prompt}
              required
              className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body"
            />
          </label>
          {parent && (
            <label className="block">
              <span className="block text-subhead font-semibold">Which {KIND_META[parent].label.toLowerCase()} does it hold up?</span>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body">
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {create.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {create.error instanceof Error ? create.error.message : 'Could not add it. Try again.'}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={create.isPending || !title.trim()}>
            Add {meta.label.toLowerCase()}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function EditSheet({ node, focusDue = false, onClose }: { node: Node | null; focusDue?: boolean; onClose: () => void }) {
  const refresh = useRefreshAll({ insights: true });
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  // A project's due day, which its pace counts towards (a task keeps its own in TaskPlanFields).
  const [due, setDue] = useState('');
  const [plan, setPlan] = useState<Plan>(() => planOf(null));
  // An open task can move under any of the person's active projects, in any pillar: the same read and picker as TaskPanel on Daily.
  const [parentId, setParentId] = useState('');
  const [asking, setAsking] = useState(false);
  // A task is a small personal remove (a second tap, the founder, 2026-11-13); a layer that holds others up still asks in a sheet.
  const taskAsk = useTapTwice();
  const day = todayLocal();
  const month = day.slice(0, 7);
  const movable = node?.kind === 'task' && node.status === 'active';
  const projectsQ = useAuthed(['today', 'month', month, day], () => api.todayMonth(month, day), movable);
  const projects = projectsQ.data?.projects ?? [];

  useEffect(() => {
    setTitle(node?.title ?? '');
    setNote(node?.note ?? '');
    setDue(node?.dueDate ?? '');
    setPlan(planOf(node));
    setParentId(node?.parentId ?? '');
    setAsking(false);
    taskAsk.disarm();
  }, [node]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('no node');
      return api.updateNode(node.id, {
        title: title.trim(),
        note,
        ...(node.kind === 'task' ? planBody(plan) : {}),
        ...(node.kind === 'project' ? { dueDate: due || null } : {}),
        ...(movable && parentId && parentId !== node.parentId ? { parentId } : {}),
      });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('no node');
      return api.deleteNode(node.id);
    },
    onSuccess: () => {
      setAsking(false);
      refresh();
      onClose();
    },
  });

  const meta = node ? KIND_META[node.kind] : null;
  return (
    <Sheet open={node !== null} onClose={onClose} title={meta ? `Edit ${meta.label.toLowerCase()}` : ''}>
      {node && meta && (
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) save.mutate();
          }}
        >
          <label className="block">
            <span className="block text-subhead font-semibold">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Note</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Why this matters, in your words" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
          </label>
          {node.kind === 'project' && (
            <label className="block">
              <span className="block text-subhead font-semibold">Due by</span>
              <input type="date" value={due} min={node.createdAt ? localDateTimeValue(new Date(node.createdAt)).slice(0, 10) : undefined} onChange={(e) => setDue(e.target.value)} data-autofocus={focusDue ? '' : undefined} className={FIELD} />
              <span className="mt-xs block text-caption text-ink-soft">The day you want it done. Its pace counts the tasks done against the days gone. Clear it to drop the pace.</span>
            </label>
          )}
          {node.kind === 'task' && (
            <>
              {movable && projects.length > 0 && <ProjectSelect projects={projects} value={parentId} onChange={setParentId} />}
              <TaskPlanFields plan={plan} onChange={setPlan} today={todayLocal()} pillar={node.relationship} taskId={node.id} />
              <Subtasks task={node} />
              <StartFocus task={{ ...node, estimateMin: Number(plan.minutes) > 0 ? Number(plan.minutes) : node.estimateMin }} />
              <TaskEndings task={node} today={todayLocal()} onPlan={(patch) => setPlan((p) => ({ ...p, ...patch }))} onGone={onClose} />
              {/* Hide it (2026-11-12): from Daily, and from 2026-11-13 from Tasks to do into this page's Hidden fold; the sheet says so and offers Unhide. */}
              <HideTask task={node} today={todayLocal()} pillar />
            </>
          )}
          <p className="m-0 text-subhead text-ink-soft">
            {node.xp} xp earned here. {node.kind === 'task' ? 'Changing the title makes it a new task, so the ten-minute wait starts again.' : 'Removing it also removes everything it holds up.'}
          </p>
          <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || (node.kind === 'task' && planProblem(plan) !== null)}>
            Save changes
          </Button>
          {node.kind === 'task' ? (
            <Button
              variant="ghost"
              className={taskAsk.isArmed(true) ? 'red-armed' : ''}
              onClick={() => {
                remove.reset();
                taskAsk.tap(true, () => remove.mutate());
              }}
              disabled={remove.isPending}
            >
              <span aria-hidden={taskAsk.isArmed(true) || undefined}>{taskAsk.isArmed(true) ? 'Tap again to remove' : `Remove this ${meta.label.toLowerCase()}`}</span>
<span className="sr-only" aria-live="polite">{taskAsk.isArmed(true) ? 'Tap again to remove' : ''}</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                remove.reset();
                setAsking(true);
              }}
              disabled={remove.isPending}
            >
              Remove this {meta.label.toLowerCase()}
            </Button>
          )}
          {node.kind === 'task' && remove.isError && <ErrorLine e={remove.error} />}
        </form>
      )}
      {node && meta && (
        <ConfirmDelete
          open={asking}
          title={`Remove this ${meta.label.toLowerCase()}?`}
          body={`“${node.title}” and everything it holds up go from your pyramid. This cannot be undone.`}
          pending={remove.isPending}
          failed={remove.isError}
          onYes={() => remove.mutate()}
          onClose={() => setAsking(false)}
          yes="Yes, remove it"
        />
      )}
    </Sheet>
  );
}
